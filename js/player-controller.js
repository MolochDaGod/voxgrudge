/**
 * Character-locked player controller + camera for TerraForge / VoxGrudge open world.
 *
 * Modes follow genre best practices for mouse + RMB:
 *   ISO — Diablo/PoE: visible ground-aim cursor; RMB = combat (block/mine/parry). No free-look.
 *   TPS — Action third-person: hold RMB free-look orbit (Alt/MMB also); otherwise soft aim.
 *         Host can claim RMB for mine/shield via claimRmbCombat / releaseRmbCombat.
 *   FPS — Pointer-lock look; center crosshair; hold RMB = ADS (host also uses for block/mine).
 */
(function (global) {
  'use strict';

  var MODE_HINTS = {
    iso: 'ISO · Cursor aim · RMB block/mine · C cycle',
    tps: 'TPS · Hold RMB free-look · Alt/MMB orbit · C cycle',
    fps: 'FPS · Click to lock · RMB ADS/block · C cycle',
  };

  var CURSOR_STYLES = {
    iso: 'iso-aim',
    tps_idle: 'tps-reticle',
    tps_look: 'tps-look',
    fps: 'fps-cross',
    fps_ads: 'fps-ads',
    combat: 'combat-block',
    mine: 'mine-pick',
  };

  function create(opts) {
    opts = opts || {};
    var THREE = opts.THREE;
    if (!THREE) throw new Error('PlayerController requires THREE');

    var mode = opts.mode || 'tps';
    var target = null;
    var camera = opts.camera || null;

    var yaw = 0;
    var pitch = 0.42;
    var fpsPitch = 0;
    var dist = opts.distance != null ? opts.distance : 11;
    var minDist = 4;
    var maxDist = 28;
    var minPitch = 0.12;
    var maxPitch = 1.25;
    var minFpsPitch = -1.15;
    var maxFpsPitch = 1.15;
    var followHeight = opts.followHeight != null ? opts.followHeight : 1.45;
    var lookHeight = opts.lookHeight != null ? opts.lookHeight : 1.35;
    var smooth = opts.smooth != null ? opts.smooth : 10;
    var orbitSensitivity = opts.orbitSensitivity != null ? opts.orbitSensitivity : 0.0045;
    var fpsSensitivity = opts.fpsSensitivity != null ? opts.fpsSensitivity : 0.0022;
    var invertY = !!opts.invertY;
    var adsFovMult = opts.adsFovMult != null ? opts.adsFovMult : 0.82;
    var baseFov = opts.baseFov != null ? opts.baseFov : 60;

    var desired = new THREE.Vector3();
    var lookAt = new THREE.Vector3();
    var _fwd = new THREE.Vector3();

    // Input state
    var orbiting = false; // Alt+LMB / MMB
    var freeLooking = false; // TPS RMB free-look
    var rmbHeld = false;
    var ads = false; // FPS RMB hold
    var rmbCombatClaimed = false; // host uses RMB for mine/block — suppress free-look
    var lastMX = 0;
    var lastMY = 0;
    var pointerNdc = { x: 0, y: 0 };
    var pointerClient = { x: 0, y: 0 };
    var pointerLocked = false;
    var lockEl = null;

    function setCamera(cam) {
      camera = cam;
      if (camera && camera.fov != null && opts.baseFov == null) baseFov = camera.fov;
    }

    function setTarget(mesh) {
      target = mesh || null;
      if (target && camera) {
        yaw = target.rotation.y + Math.PI;
        if (mode === 'fps') yaw = target.rotation.y;
        forceSnap();
      }
    }

    function setMode(m) {
      if (m !== 'tps' && m !== 'iso' && m !== 'fps') return;
      var prev = mode;
      mode = m;
      orbiting = false;
      freeLooking = false;
      rmbHeld = false;
      ads = false;
      rmbCombatClaimed = false;
      if (m === 'fps') {
        if (target) yaw = target.rotation.y;
        fpsPitch = 0;
      } else if (prev === 'fps' && target) {
        yaw = target.rotation.y + Math.PI;
        pitch = 0.42;
        exitPointerLock();
      }
      applyFov(false);
      if (camera && target) forceSnap();
    }

    function getMode() {
      return mode;
    }

    function getModeHint() {
      return MODE_HINTS[mode] || MODE_HINTS.tps;
    }

    function forceSnap() {
      if (!camera || !target) return;
      applyCamera(1);
    }

    function isLooking() {
      if (mode === 'fps') return true;
      if (mode === 'iso') return false;
      return freeLooking || orbiting;
    }

    function isOrbiting() {
      return orbiting || freeLooking;
    }

    function isFreeLooking() {
      return freeLooking || orbiting;
    }

    function isAds() {
      return mode === 'fps' && ads && rmbHeld;
    }

    function isRmbHeld() {
      return rmbHeld;
    }

    /** Host: RMB used for mine/block this press — do not start TPS free-look. */
    function claimRmbCombat() {
      rmbCombatClaimed = true;
      freeLooking = false;
    }

    function releaseRmbCombat() {
      rmbCombatClaimed = false;
    }

    /**
     * Cursor presentation for HUD. style drives CSS class on custom cursor.
     */
    function getCursorState() {
      var style = CURSOR_STYLES.iso;
      var hideOs = false;
      var center = false;
      var follow = true;

      if (mode === 'iso') {
        style = CURSOR_STYLES.iso;
        hideOs = true;
        follow = true;
        center = false;
      } else if (mode === 'tps') {
        hideOs = true;
        if (freeLooking || orbiting) {
          style = CURSOR_STYLES.tps_look;
          center = true;
          follow = false;
        } else {
          style = CURSOR_STYLES.tps_idle;
          center = false;
          follow = true;
        }
      } else {
        // fps
        hideOs = true;
        center = true;
        follow = false;
        style = ads && rmbHeld ? CURSOR_STYLES.fps_ads : CURSOR_STYLES.fps;
      }

      return {
        mode: mode,
        style: style,
        hideOsCursor: hideOs,
        center: center,
        followPointer: follow,
        freeLooking: freeLooking || orbiting,
        ads: isAds(),
        rmbHeld: rmbHeld,
        pointerLocked: pointerLocked,
        clientX: pointerClient.x,
        clientY: pointerClient.y,
      };
    }

    function applyFov(adsOn) {
      if (!camera || camera.fov == null) return;
      var targetFov = adsOn ? baseFov * adsFovMult : baseFov;
      camera.fov += (targetFov - camera.fov) * 0.25;
      camera.updateProjectionMatrix();
    }

    function onPointerDown(e) {
      if (e.button === 2) {
        rmbHeld = true;
        lastMX = e.clientX;
        lastMY = e.clientY;
        // TPS free-look is deferred: host may claimRmbCombat() on same click (mine/shield).
        // Actual freeLooking starts on move or in update() if still unclaimed.
        if (mode === 'fps') {
          ads = true;
        }
      }
      // MMB or Alt+LMB: orbit (ISO pan feel / TPS orbit backup)
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        if (mode !== 'fps') {
          orbiting = true;
          lastMX = e.clientX;
          lastMY = e.clientY;
          e.preventDefault();
        }
      }
      // FPS: click canvas to pointer-lock
      if (mode === 'fps' && e.button === 0 && !e.altKey) {
        requestPointerLock();
      }
    }

    function tryBeginTpsFreeLook() {
      if (mode !== 'tps') return;
      if (!rmbHeld || rmbCombatClaimed || freeLooking) return;
      freeLooking = true;
    }

    function onPointerUp(e) {
      if (e.button === 2) {
        rmbHeld = false;
        freeLooking = false;
        ads = false;
        rmbCombatClaimed = false;
      }
      if (e.button === 1 || e.button === 0) {
        orbiting = false;
      }
    }

    function onPointerMove(e) {
      var w = global.innerWidth || 1;
      var h = global.innerHeight || 1;

      if (e.clientX != null) {
        pointerClient.x = e.clientX;
        pointerClient.y = e.clientY;
      }

      if (pointerLocked && (e.movementX != null || e.movementY != null)) {
        // Keep NDC at center while locked
        pointerNdc.x = 0;
        pointerNdc.y = 0;
      } else {
        pointerNdc.x = (e.clientX / w) * 2 - 1;
        pointerNdc.y = -(e.clientY / h) * 2 + 1;
      }

      var dx = 0;
      var dy = 0;
      var hasMovement = false;

      if (pointerLocked || mode === 'fps') {
        if (e.movementX != null || e.movementY != null) {
          dx = e.movementX || 0;
          dy = e.movementY || 0;
          hasMovement = true;
        }
      }

      if (mode === 'fps') {
        if (!hasMovement) return;
        var sens = fpsSensitivity * (ads && rmbHeld ? 0.65 : 1);
        yaw -= dx * sens;
        fpsPitch -= (invertY ? -dy : dy) * sens;
        fpsPitch = Math.max(minFpsPitch, Math.min(maxFpsPitch, fpsPitch));
        return;
      }

      // Start TPS free-look on first move while RMB held and host did not claim combat
      if (mode === 'tps' && rmbHeld && !rmbCombatClaimed) {
        freeLooking = true;
      }

      var looking = freeLooking || orbiting;
      if (!looking) return;

      if (!hasMovement) {
        dx = e.clientX - lastMX;
        dy = e.clientY - lastMY;
        lastMX = e.clientX;
        lastMY = e.clientY;
      } else {
        lastMX = e.clientX;
        lastMY = e.clientY;
      }

      yaw -= dx * orbitSensitivity;
      pitch += (invertY ? -dy : dy) * orbitSensitivity;
      pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
    }

    function onWheel(e, allowZoom) {
      if (!allowZoom) return false;
      if (mode === 'fps') return false;
      dist *= e.deltaY > 0 ? 1.08 : 0.92;
      dist = Math.max(minDist, Math.min(maxDist, dist));
      return true;
    }

    function requestPointerLock() {
      var el = lockEl || (camera && camera.domElement) || global.document && global.document.body;
      if (!el || !el.requestPointerLock) return;
      if (global.document.pointerLockElement === el) return;
      try {
        el.requestPointerLock();
      } catch (_) {}
    }

    function exitPointerLock() {
      if (global.document && global.document.exitPointerLock && global.document.pointerLockElement) {
        try {
          global.document.exitPointerLock();
        } catch (_) {}
      }
    }

    function onPointerLockChange() {
      var el = lockEl || (global.document && global.document.body);
      pointerLocked = !!(global.document && global.document.pointerLockElement);
      if (!pointerLocked && mode === 'fps') {
        // stay in fps without lock; mouse look only while locked or via movementX when locked
      }
    }

    function getMoveInput(keys) {
      var f = 0;
      var s = 0;
      if (keys['KeyW'] || keys['ArrowUp']) f += 1;
      if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) s -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) s += 1;

      if (f === 0 && s === 0) return { dx: 0, dz: 0, moving: false, forward: 0, strafe: 0 };

      if (mode === 'iso') {
        var len = Math.hypot(s, -f) || 1;
        return { dx: s / len, dz: -f / len, moving: true, forward: f, strafe: s };
      }

      // Camera-relative on XZ (TPS orbit yaw or FPS look yaw)
      var lookYaw = mode === 'fps' ? yaw : yaw;
      // TPS: orbit yaw places camera behind; forward is opposite cam offset
      var fx, fz, rx, rz;
      if (mode === 'fps') {
        fx = Math.sin(yaw);
        fz = Math.cos(yaw);
        rx = Math.cos(yaw);
        rz = -Math.sin(yaw);
      } else {
        fx = -Math.sin(yaw);
        fz = -Math.cos(yaw);
        rx = Math.cos(yaw);
        rz = -Math.sin(yaw);
      }
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
        var eyeY = groundY + followHeight + 0.35;
        desired.set(px, eyeY, pz);
        var cp = Math.cos(fpsPitch);
        var sp = Math.sin(fpsPitch);
        var lx = Math.sin(yaw) * cp;
        var ly = sp;
        var lz = Math.cos(yaw) * cp;
        lookAt.set(px + lx * 8, eyeY + ly * 8, pz + lz * 8);
      } else {
        var cp2 = Math.cos(pitch);
        var sp2 = Math.sin(pitch);
        var ox = Math.sin(yaw) * cp2 * dist;
        var oy = sp2 * dist;
        var oz = Math.cos(yaw) * cp2 * dist;
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
      // Hold RMB without move still enters free-look if combat did not claim
      tryBeginTpsFreeLook();
      var a = 1 - Math.exp(-smooth * Math.max(0.001, dt));
      // FPS snaps tighter for responsiveness
      if (mode === 'fps') a = Math.min(1, a * 1.8 + 0.35);
      applyCamera(a);
      applyFov(mode === 'fps' && ads && rmbHeld);
    }

    function alignBehindCharacter() {
      if (!target) return;
      if (mode === 'fps') {
        yaw = target.rotation.y;
        fpsPitch = 0;
      } else {
        yaw = target.rotation.y + Math.PI;
      }
    }

    /**
     * Aim direction for combat.
     * ISO / TPS (not free-looking): ground plane under cursor.
     * TPS free-look / FPS: camera forward on XZ (or full 3D for projectiles).
     */
    function getAimDir(raycaster, mouseNdc, optsAim) {
      if (!camera || !target) return new THREE.Vector3(0, 0, 1);
      var useCamForward = mode === 'fps' || (mode === 'tps' && (freeLooking || orbiting));

      if (useCamForward) {
        camera.getWorldDirection(_fwd);
        if (optsAim && optsAim.full3d) return _fwd.clone().normalize();
        _fwd.y = 0;
        if (_fwd.lengthSq() < 1e-6) {
          if (mode === 'fps') return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          return new THREE.Vector3(0, 0, 1);
        }
        return _fwd.normalize();
      }

      var ndc = mouseNdc || pointerNdc;
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -target.position.y);
      var hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hit)) {
        hit.sub(target.position);
        hit.y = 0;
        if (hit.lengthSq() > 1e-6) return hit.normalize();
      }
      camera.getWorldDirection(_fwd);
      _fwd.y = 0;
      if (_fwd.lengthSq() < 1e-6) return new THREE.Vector3(0, 0, 1);
      return _fwd.normalize();
    }

    /** Character face yaw: FPS uses look yaw; others use aim. */
    function getFaceYaw() {
      if (mode === 'fps') return yaw;
      return null; // host uses getAimDir
    }

    function getPointerNdc() {
      return pointerNdc;
    }

    function getOrbit() {
      return { yaw: yaw, pitch: pitch, dist: dist, fpsPitch: fpsPitch };
    }

    function setOrbit(o) {
      if (!o) return;
      if (o.yaw != null) yaw = o.yaw;
      if (o.pitch != null) pitch = Math.max(minPitch, Math.min(maxPitch, o.pitch));
      if (o.dist != null) dist = Math.max(minDist, Math.min(maxDist, o.dist));
      if (o.fpsPitch != null) fpsPitch = Math.max(minFpsPitch, Math.min(maxFpsPitch, o.fpsPitch));
    }

    function bindDom(el, canvasEl) {
      el = el || global;
      lockEl = canvasEl || (global.document && global.document.getElementById('c')) || null;
      el.addEventListener('mousedown', onPointerDown);
      el.addEventListener('mouseup', onPointerUp);
      el.addEventListener('mousemove', onPointerMove);
      el.addEventListener('blur', function () {
        orbiting = false;
        freeLooking = false;
        rmbHeld = false;
        ads = false;
      });
      if (global.document) {
        global.document.addEventListener('pointerlockchange', onPointerLockChange);
        global.document.addEventListener('pointerlockerror', function () {
          pointerLocked = false;
        });
      }
    }

    return {
      setCamera: setCamera,
      setTarget: setTarget,
      setMode: setMode,
      getMode: getMode,
      getModeHint: getModeHint,
      forceSnap: forceSnap,
      update: update,
      getMoveInput: getMoveInput,
      getAimDir: getAimDir,
      getFaceYaw: getFaceYaw,
      getPointerNdc: getPointerNdc,
      getCursorState: getCursorState,
      alignBehindCharacter: alignBehindCharacter,
      getOrbit: getOrbit,
      setOrbit: setOrbit,
      onWheel: onWheel,
      bindDom: bindDom,
      isOrbiting: isOrbiting,
      isFreeLooking: isFreeLooking,
      isLooking: isLooking,
      isAds: isAds,
      isRmbHeld: isRmbHeld,
      claimRmbCombat: claimRmbCombat,
      releaseRmbCombat: releaseRmbCombat,
      requestPointerLock: requestPointerLock,
      exitPointerLock: exitPointerLock,
      CURSOR_STYLES: CURSOR_STYLES,
      MODE_HINTS: MODE_HINTS,
    };
  }

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
    MODE_HINTS: MODE_HINTS,
    CURSOR_STYLES: CURSOR_STYLES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
