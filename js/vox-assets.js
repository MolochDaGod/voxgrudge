/**
 * Asset usage helpers — LOD culling, Kenney/creature resolution,
 * and consistent model scaling against VoxStandards.
 */
(function (global) {
  'use strict';

  var ASSET = (global.VoxStandards && global.VoxStandards.ASSET) || {
    lodNear: 48,
    lodFar: 110,
    unload: 160,
  };

  function modelUrl(path) {
    if (global.GrudgeAssets && GrudgeAssets.modelUrl) return GrudgeAssets.modelUrl(path);
    return path;
  }

  function resolveCreaturePath(typeId, def) {
    def = def || {};
    if (def.fantasy && global.FANTASY_MODEL_MAP && FANTASY_MODEL_MAP[def.fantasy]) {
      return FANTASY_MODEL_MAP[def.fantasy];
    }
    if (def.model) return 'models/creatures/' + def.model + '.glb';
    if (global.CREATURE_MODEL_MAP && CREATURE_MODEL_MAP[typeId]) {
      var n = CREATURE_MODEL_MAP[typeId];
      return 'models/creatures/' + n + (String(n).indexOf('.') >= 0 ? '' : '.glb');
    }
    return null;
  }

  function kenneyTextureUrl(letter) {
    var p = 'models/kenney/textures/texture-' + (letter || 'a') + '.png';
    return modelUrl(p);
  }

  function kenneyBodyUrl(letter) {
    var p = 'models/kenney/character-' + (letter || 'a') + '.glb';
    return modelUrl(p);
  }

  /**
   * Apply uniform scale so model bounding height ≈ targetHeightM.
   */
  function normalizeModelHeight(THREE, root, targetHeightM) {
    if (!root || !THREE) return 1;
    // Canonical humanoid / ORC height = 2.0 m (fleet SSOT)
    targetHeightM = targetHeightM || 2.0;
    var box = new THREE.Box3().setFromObject(root);
    var size = new THREE.Vector3();
    box.getSize(size);
    var h = size.y || 1;
    if (h < 1e-4) return 1;
    var s = targetHeightM / h;
    root.scale.multiplyScalar(s);
    // Re-center feet on origin Y
    box.setFromObject(root);
    root.position.y -= box.min.y;
    return s;
  }

  /**
   * Frame budget LOD: hide far meshes, optional low-opacity mid band.
   * Call once per frame with player position.
   */
  function updateLod(objects, px, pz, opts) {
    opts = opts || {};
    var near = opts.near != null ? opts.near : ASSET.lodNear;
    var far = opts.far != null ? opts.far : ASSET.lodFar;
    var n = objects ? objects.length : 0;
    for (var i = 0; i < n; i++) {
      var o = objects[i];
      if (!o || !o.mesh) continue;
      var d = Math.hypot(o.mesh.position.x - px, o.mesh.position.z - pz);
      var vis = d < far;
      if (o.mesh.visible !== vis) o.mesh.visible = vis;
      if (vis && o.mesh.traverse && d > near) {
        // Mid-range: disable shadows for cost
        if (o._lodMid !== true) {
          o._lodMid = true;
          o.mesh.traverse(function (c) {
            if (c.isMesh) {
              c.castShadow = false;
            }
          });
        }
      } else if (vis && o._lodMid) {
        o._lodMid = false;
        o.mesh.traverse(function (c) {
          if (c.isMesh) c.castShadow = true;
        });
      }
    }
  }

  /** Tint MeshStandard materials without losing maps. */
  function tintObject(root, hex, intensity) {
    if (!root) return;
    intensity = intensity != null ? intensity : 0.35;
    root.traverse(function (c) {
      if (!c.isMesh || !c.material) return;
      var mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(function (m) {
        if (!m.color) return;
        if (!m.userData._baseColor) m.userData._baseColor = m.color.getHex();
        var base = m.userData._baseColor;
        m.color.setHex(base);
        m.color.lerp(new (global.THREE || THREE).Color(hex), intensity);
      });
    });
  }

  global.VoxAssets = {
    modelUrl: modelUrl,
    resolveCreaturePath: resolveCreaturePath,
    kenneyTextureUrl: kenneyTextureUrl,
    kenneyBodyUrl: kenneyBodyUrl,
    normalizeModelHeight: normalizeModelHeight,
    updateLod: updateLod,
    tintObject: tintObject,
  };
})(typeof window !== 'undefined' ? window : globalThis);
