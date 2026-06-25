/**
 * Mesh/box collider registry with layer masks, ground sampling, horizontal resolution.
 */
(function (global) {
  'use strict';

  var Layers = global.VoxLayers;

  function create(opts) {
    var THREE = opts.THREE;
    var raycaster = opts.raycaster;
    var entries = [];
    var terrain = null;
    var _box = new THREE.Box3();
    var _vec = new THREE.Vector3();

    function registerTerrain(terrainHandle) {
      terrain = terrainHandle;
      register({
        id: 'terrain',
        kind: 'terrain',
        layer: Layers.LAYERS.TERRAIN,
        mesh: terrainHandle.mesh,
        solid: true,
        trigger: false,
      });
    }

    function register(spec) {
      var entry = {
        id: spec.id || ('col_' + entries.length),
        kind: spec.kind || 'prop',
        layer: spec.layer || Layers.layerForKind(spec.kind, spec.def),
        mesh: spec.mesh || null,
        solid: spec.solid !== false,
        trigger: !!spec.trigger,
        data: spec.data || null,
        def: spec.def || null,
      };
      if (spec.box) {
        entry.box = spec.box;
      } else if (spec.mesh) {
        entry.box = meshBox(spec.mesh);
      }
      entries.push(entry);
      if (spec.mesh) {
        spec.mesh.userData = spec.mesh.userData || {};
        spec.mesh.userData.colliderId = entry.id;
        spec.mesh.userData.collisionLayer = entry.layer;
      }
      return entry;
    }

    function unregister(id) {
      var idx = entries.findIndex(function (e) { return e.id === id; });
      if (idx >= 0) entries.splice(idx, 1);
    }

    function meshBox(mesh) {
      _box.setFromObject(mesh);
      var c = _box.getCenter(new THREE.Vector3());
      var s = _box.getSize(new THREE.Vector3());
      return { cx: c.x, cy: c.y, cz: c.z, hx: s.x * 0.5, hy: s.y * 0.5, hz: s.z * 0.5 };
    }

    function refreshBox(id) {
      var e = entries.find(function (x) { return x.id === id; });
      if (e && e.mesh) e.box = meshBox(e.mesh);
    }

    function getGroundHeight(x, z) {
      if (terrain && terrain.sampleHeight) return terrain.sampleHeight(x, z);
      return 0;
    }

    function snapObject(obj, footY) {
      if (!obj || !obj.position) return;
      var y = getGroundHeight(obj.position.x, obj.position.z);
      obj.position.y = y + (footY || 0);
    }

    function circleHitsBox(px, pz, radius, box) {
      var dx = Math.max(Math.abs(px - box.cx) - box.hx, 0);
      var dz = Math.max(Math.abs(pz - box.cz) - box.hz, 0);
      return dx * dx + dz * dz < radius * radius;
    }

    function resolveHorizontal(oldX, oldZ, newX, newZ, radius, mask) {
      var x = newX;
      var z = newZ;
      for (var pass = 0; pass < 3; pass++) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (!e.solid || e.trigger || !e.box) continue;
          if (mask && !(e.layer & mask)) continue;
          if (!circleHitsBox(x, z, radius, e.box)) continue;
          var odx = Math.max(Math.abs(oldX - e.box.cx) - e.box.hx, 0);
          var odz = Math.max(Math.abs(oldZ - e.box.cz) - e.box.hz, 0);
          if (odx * odx + odz * odz >= radius * radius) {
            var ndx = x - e.box.cx;
            var ndz = z - e.box.cz;
            if (Math.abs(ndx) > Math.abs(ndz)) {
              x = ndx > 0 ? e.box.cx + e.box.hx + radius : e.box.cx - e.box.hx - radius;
            } else {
              z = ndz > 0 ? e.box.cz + e.box.hz + radius : e.box.cz - e.box.hz - radius;
            }
          }
        }
      }
      return { x: x, z: z };
    }

    function raycast(origin, dir, maxDist, mask) {
      var hits = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (mask && !(e.layer & mask)) continue;
        if (!e.mesh) continue;
        raycaster.set(origin, dir.clone().normalize());
        raycaster.far = maxDist || 80;
        var rh = raycaster.intersectObject(e.mesh, true);
        if (rh.length) {
          hits.push({ entry: e, hit: rh[0] });
        }
      }
      hits.sort(function (a, b) { return a.hit.distance - b.hit.distance; });
      return hits[0] || null;
    }

    function querySphere(x, y, z, radius, mask) {
      var out = [];
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (mask && !(e.layer & mask)) continue;
        if (e.box) {
          var dx = Math.max(Math.abs(x - e.box.cx) - e.box.hx - radius, 0);
          var dy = Math.max(Math.abs(y - e.box.cy) - e.box.hy - radius, 0);
          var dz = Math.max(Math.abs(z - e.box.cz) - e.box.hz - radius, 0);
          if (dx * dx + dy * dy + dz * dz <= radius * radius) out.push(e);
        }
      }
      return out;
    }

    function isInSafeZone(x, z) {
      var hits = querySphere(x, getGroundHeight(x, z), z, 1, Layers.LAYERS.SAFE_ZONE);
      return hits.some(function (e) { return e.trigger && e.kind === 'safe_zone'; });
    }

    function registerSafeZone(cx, cz, radius, data) {
      return register({
        id: 'safe_zone_starter',
        kind: 'safe_zone',
        layer: Layers.LAYERS.SAFE_ZONE,
        trigger: true,
        solid: false,
        box: { cx: cx, cy: 0, cz: cz, hx: radius, hy: 50, hz: radius },
        data: data || { label: 'Starter Island' },
      });
    }

    return {
      register: register,
      unregister: unregister,
      refreshBox: refreshBox,
      registerTerrain: registerTerrain,
      registerSafeZone: registerSafeZone,
      getGroundHeight: getGroundHeight,
      snapObject: snapObject,
      resolveHorizontal: resolveHorizontal,
      raycast: raycast,
      querySphere: querySphere,
      isInSafeZone: isInSafeZone,
      getTerrain: function () { return terrain; },
      getEntries: function () { return entries; },
    };
  }

  global.VoxCollision = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);