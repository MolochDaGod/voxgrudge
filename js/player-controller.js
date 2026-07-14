/**
 * Third-person player controller + camera for TerraForge / VoxGrudge open world.
 *
 * - Camera is locked to the selected character (smooth follow + orbit)
 * - WASD is relative to camera yaw
 * - Character selection is external (host sets mesh via setTarget)
 * - Modes: 'tps' (default third-person), 'iso' (legacy top-down), 'fps'
 */
(function (global) {
  'use strict';

  function create(opts) {
    opts = opts || {};
    var THREE = opts.THREE;
    if (!THREE) throw new Error('PlayerController requires THREE');

    var mode = opts.mode || 'tps';
    var target = null; // Object3D (player mesh)
    var camera = opts.camera || null;

    // Orbit spherical coords around target
    var yaw = 0; // radians, 0 = looking toward -Z from behind character when char faces +Z
    var pitch = 0.42; // ~24°
    var dist = opts.distance != null ? opts.distance : 11;
    var minDist = 4;
    var maxDist = 28;
    var minPitch = 0.12;
    var maxPitch = 1.25;
    var followHeight = opts.followHeight != null ? opts.followHeight : 1.45;
    var lookHeight = opts.lookHeight != null ? opts.lookHeight : 1.35;
    var smooth = opts.smooth != null ? opts.smooth : 10;
    var orbitSensitivity = opts.orbitSensitivity != null ? opts.orbitSensitivity : 0.0045;
    var invertY = !!opts.invertY;

    var desired = new THREE.Vector3();
    var lookAt = new THREE.Vector3();
    var _fwd = new THREE.Vector3();
    var _right = new THREE.Vector3();
    var _tmp = new THREE.Vector3();

    // Input
    var orbiting = false;
    var lastMX = 0;
    var lastMY = 0;
    var pointerNdc = { x: 0, y: 0 };

    function setCamera(cam) {
      camera = cam;
    }

    function setTarget(mesh) {
      target = mesh || null;
      if (target && camera) {
        // Snap once so first frame isn't a long lerp from world origin
        yaw = target.rotation.y + Math.PI;
        forceSnap();
      }
    }

    function setMode(m) {
      if (m === 'tps' || m === 'iso' || m === 'fps') mode = m;
    }

    function getMode() {
      return mode;
    }

    function forceSnap() {
      if (!camera || !target) return;
      applyCamera(1);
    }

    function onPointerDown(e) {
      // Middle mouse or Alt+LMB orbits the camera
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        orbiting = true;
        lastMX = e.clientX;
        lastMY = e.clientY;
        e.preventDefault();
      }
    }

    function onPointerUp(e) {
      if (e.button === 1 || e.button === 0) orbiting = false;
    }

    function onPointerMove(e) {
      var w = global.innerWidth || 1;
      var h = global.innerHeight || 1;
      pointerNdc.x = (e.clientX / w) * 2 - 1;
      pointerNdc.y = -(e.clientY / h) * 2 + 1;

      if (!orbiting) return;
      var dx = e.clientX - lastMX;
      var dy = e.clientY - lastMY;
      lastMX = e.clientX;
      lastMY = e.clientY;
      yaw -= dx * orbitSensitivity;
      pitch += (invertY ? -dy : dy) * orbitSensitivity;
      pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
    }

    function onWheel(e, allowZoom) {
      if (!allowZoom) return false;
      dist *= e.deltaY > 0 ? 1.08 : 0.92;
      dist = Math.max(minDist, Math.min(maxDist, dist));
      return true;
    }

    /**
     * Camera-relative move vector on XZ from WASD keys map.
     * Returns { dx, dz, moving } in world space (normalized if moving).
     */
    function getMoveInput(keys) {
      var f = 0;
      var s = 0;
      if (keys['KeyW'] || keys['ArrowUp']) f += 1;
      if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) s -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) s += 1;

      if (f === 0 && s === 0) return { dx: 0, dz: 0, moving: false, forward: 0, strafe: 0 };

      // Camera basis on XZ
      if (mode === 'iso') {
        // World axes (legacy top-down)
        var len = Math.hypot(s, -f) || 1;
        return { dx: s / len, dz: -f / len, moving: true, forward: f, strafe: s };
      }

      var cy = Math.cos(yaw);
      var sy = Math.sin(yaw);
      // Forward is where camera looks on XZ (from cam to look target ≈ -orbit offset)
      // Orbit: cam sits at yaw around target; forward movement goes opposite the cam offset on XZ
      var fx = -Math.sin(yaw);
      var fz = -Math.cos(yaw);
      var rx = Math.cos(yaw);
      var rz = -Math.sin(yaw);
      var dx = fx * f + rx * s;
      var dz = fz * f + rz * s;
      var len2 = Math.hypot(dx, dz) || 1;
      return { dx: dx / len2, dz: dz / len2, moving: true, forward: f, strafe: s };
    }

    function applyCamera(alpha) {
      if (!camera || !target) return;
      var px = target.position.x;
      var py = target.position.y;
      var pz = target.position.z;
      var groundY = py;

      if (mode === 'iso') {
        desired.set(px, groundY + 34, pz + 28);
        lookAt.set(px, groundY + 1.2, pz);
      } else if (mode === 'fps') {
        var fy = target.rotation.y;
        desired.set(
          px + Math.sin(fy) * 0.25,
          groundY + followHeight + 0.35,
          pz + Math.cos(fy) * 0.25
        );
        lookAt.set(
          px + Math.sin(fy) * 8,
          groundY + lookHeight + 0.2,
          pz + Math.cos(fy) * 8
        );
      } else {
        // TPS orbit
        var cp = Math.cos(pitch);
        var sp = Math.sin(pitch);
        var ox = Math.sin(yaw) * cp * dist;
        var oy = sp * dist;
        var oz = Math.cos(yaw) * cp * dist;
        desired.set(px + ox, groundY + followHeight + oy, pz + oz);
        lookAt.set(px, groundY + lookHeight, pz);
      }

      if (alpha >= 1) {
        camera.position.copy(desired);
      } else {
        camera.position.lerp(desired, alpha);
      }
      camera.lookAt(lookAt);
    }

    function update(dt) {
      if (!camera || !target) return;
      var a = 1 - Math.exp(-smooth * Math.max(0.001, dt));
      applyCamera(a);
    }

    /** Sync orbit yaw to face behind character (call after spawn / respawn). */
    function alignBehindCharacter() {
      if (!target) return;
      yaw = target.rotation.y + Math.PI;
    }

    /**
     * Ground-plane aim from pointer NDC (combat). Falls back to camera forward.
     */
    function getAimDir(raycaster, mouseNdc) {
      if (!camera || !target) return new THREE.Vector3(0, 0, 1);
      var ndc = mouseNdc || pointerNdc;
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -target.position.y);
      var hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hit)) {
        hit.sub(target.position);
        hit.y = 0;
        if (hit.lengthSq() > 1e-6) return hit.normalize();
      }
      // Fallback: camera forward on XZ
      camera.getWorldDirection(_fwd);
      _fwd.y = 0;
      if (_fwd.lengthSq() < 1e-6) return new THREE.Vector3(0, 0, 1);
      return _fwd.normalize();
    }

    function getPointerNdc() {
      return pointerNdc;
    }

    function getOrbit() {
      return { yaw: yaw, pitch: pitch, dist: dist };
    }

    function setOrbit(o) {
      if (!o) return;
      if (o.yaw != null) yaw = o.yaw;
      if (o.pitch != null) pitch = Math.max(minPitch, Math.min(maxPitch, o.pitch));
      if (o.dist != null) dist = Math.max(minDist, Math.min(maxDist, o.dist));
    }

    function bindDom(el) {
      el = el || global;
      el.addEventListener('mousedown', onPointerDown);
      el.addEventListener('mouseup', onPointerUp);
      el.addEventListener('mousemove', onPointerMove);
      el.addEventListener('blur', function () {
        orbiting = false;
      });
    }

    return {
      setCamera: setCamera,
      setTarget: setTarget,
      setMode: setMode,
      getMode: getMode,
      forceSnap: forceSnap,
      update: update,
      getMoveInput: getMoveInput,
      getAimDir: getAimDir,
      getPointerNdc: getPointerNdc,
      alignBehindCharacter: alignBehindCharacter,
      getOrbit: getOrbit,
      setOrbit: setOrbit,
      onWheel: onWheel,
      bindDom: bindDom,
      isOrbiting: function () {
        return orbiting;
      },
    };
  }

  /** Selectable Kenney character roster for the class / body picker. */
  var CHARACTER_ROSTER = [
    { id: 'a', name: 'Brute', tag: 'Heavy', desc: 'Broad frame, front-line presence' },
    { id: 'b', name: 'Ranger', tag: 'Scout', desc: 'Lean build for open ground' },
    { id: 'c', name: 'Mystic', tag: 'Caster', desc: 'Slight frame, focus on arts' },
    { id: 'd', name: 'Warden', tag: 'Hybrid', desc: 'Balanced field survivor' },
    { id: 'e', name: 'Paladin', tag: 'Guard', desc: 'Upright stance, shield lines' },
    { id: 'f', name: 'Shade', tag: 'Rogue', desc: 'Compact, quick silhouette' },
    { id: 'g', name: 'Raider', tag: 'Assault', desc: 'Aggressive posture' },
    { id: 'h', name: 'Nomad', tag: 'Explorer', desc: 'Travel-ready build' },
    { id: 'i', name: 'Sentinel', tag: 'Tank', desc: 'Sturdy outline' },
    { id: 'j', name: 'Strider', tag: 'Agile', desc: 'Long-stride runner' },
  ];

  global.PlayerController = {
    create: create,
    CHARACTER_ROSTER: CHARACTER_ROSTER,
  };
})(typeof window !== 'undefined' ? window : globalThis);
