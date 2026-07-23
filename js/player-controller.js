/**
 * Character-locked player controller + camera for TerraForge / VoxGrudge open world.
 *
 * Modes follow genre best practices for mouse + RMB:
 *   ISO — Diablo/PoE: visible ground-aim cursor; RMB = combat (block/mine/parry). No free-look.
 *   TPS — Action third-person: hold RMB free-look orbit (Alt/MMB also); otherwise soft aim.
 *         Host can claim RMB for mine/shield via claimRmbCombat / releaseRmbCombat.
 *   FPS — Pointer-lock look; center crosshair; hold RMB = ADS (host also uses for block/mine).
 *
 * Enhancements: shoulder offset, terrain camera collision, combat zoom, FPS head bob.
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

    var camStd = (global.VoxStandards && global.VoxStandards.CAMERA) || {};
    var tpsStd = camStd.tps || {};
    var isoStd = camStd.iso || {};
    var fpsStd = camStd.fps || {};

    var mode = opts.mode || 'tps';
    var target = null;
    var camera = opts.camera || null;

    var yaw = 0;
    var pitch = 0.42;
    var fpsPitch = 0;
    var dist = opts.distance != null ? opts.distance : tpsStd.distance || 12;
    var minDist = tpsStd.minDist || 3.5;
    var maxDist = tpsStd.maxDist || 30;
    var minPitch = tpsStd.minPitch != null ? tpsStd.minPitch : 0.1;
    var maxPitch = tpsStd.maxPitch != null ? tpsStd.maxPitch : 1.35;
    var minFpsPitch = -1.15;
    var maxFpsPitch = 1.15;
    var followHeight = opts.followHeight != null ? opts.followHeight : 1.45;
    var lookHeight = opts.lookHeight != null ? opts.lookHeight : 1.35;
    var smooth = opts.smooth != null ? opts.smooth : tpsStd.smooth || 11;
    var orbitSensitivity = opts.orbitSensitivity != null ? opts.orbitSensitivity : 0.0045;
    var fpsSensitivity = opts.fpsSensitivity != null ? opts.fpsSensitivity : 0.0022;
    var invertY = !!opts.invertY;
    var adsFovMult = opts.adsFovMult != null ? opts.adsFovMult : fpsStd.adsFovMult || 0.78;
    var baseFov = opts.baseFov != null ? opts.baseFov : 60;
    var shoulder = opts.shoulder != null ? opts.shoulder : tpsStd.shoulder != null ? tpsStd.shoulder : 0.55;
    var collisionPad = tpsStd.collisionPad != null ? tpsStd.collisionPad : 0.45;
    var combatZoom = tpsStd.combatZoom != null ? tpsStd.combatZoom : 0.82;
    var combatZoomActive = false;
    var bobPhase = 0;
    var moveSpeedHint = 0;

    var desired = new THREE.Vector3();
    var lookAt = new THREE.Vector3();
    var _fwd = new THREE.Vector3();
    var _right = new THREE.Vector3();
    var _camRay = new THREE.Raycaster();
    var _camFrom = new THREE.Vector3();
    var _camTo = new THREE.Vector3();
    var _camDir = new THREE.Vector3();

    // Input state
    var orbiting = false;
    var freeLooking = false;
    var rmbHeld = false;
    var ads = false;
    var rmbCombatClaimed = false;
    var lastMX = 0;
    var lastMY = 0;
    var pointerNdc = { x: 0, y: 0 };
    var pointerClient = { x: 0, y: 0 };
    var pointerLocked = false;
    var lockEl = null;
    var collisionMeshes = null; // optional array or single mesh

    function setCamera(cam) {
      camera = cam;
      if (camera && camera.fov != null && opts.baseFov == null) baseFov = camera.fov;
    }

    /**
     * Attach follow target. Only re-aligns yaw / snaps when the mesh *changes*
     * or opts.realign === true. Safe to call every frame with the same mesh
     * (host update loops used to reset free-look every tick).
     */
    function setTarget(mesh, optsSet) {
      optsSet = optsSet || {};
      var prev = target;
      var changed = prev !== mesh;
      target = mesh || null;
      if (!target || !camera) return;
      if (changed || optsSet.realign === true) {
        if (mode === 'fps') yaw = target.rotation.y;
        else yaw = target.rotation.y + Math.PI;
        forceSnap();
      }
    }

    /** Runtime adjust follow/look heights (settings cameraHeight mult). */
    function setHeights(follow, look) {
      if (follow != null && Number.isFinite(follow)) followHeight = follow;
      if (look != null && Number.isFinite(look)) lookHeight = look;
    }

    function getHeights() {
      return { followHeight: followHeight, lookHeight: lookHeight };
    }

    /** Provide terrain / world meshes for camera collision. */
    function setCollisionMeshes(meshes) {
      collisionMeshes = meshes || null;
    }

    function setCombatZoom(on) {
      combatZoomActive = !!on;
    }

    function setMoveSpeedHint(speed) {
      moveSpeedHint = speed || 0;
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
        if (camera && fpsStd.fov) {
          baseFov = opts.baseFov != null ? opts.baseFov : fpsStd.fov;
        }
      } else if (prev === 'fps' && target) {
        yaw = target.rotation.y + Math.PI;
        pitch = 0.42;
        exitPointerLock();
        if (m === 'tps' && tpsStd.fov) baseFov = opts.baseFov != null ? opts.baseFov : tpsStd.fov;
        if (m === 'iso' && isoStd.fov) baseFov = opts.baseFov != null ? opts.baseFov : isoStd.fov;
      } else if (m === 'iso' && isoStd.fov) {
        baseFov = opts.baseFov != null ? opts.baseFov : isoStd.fov;
      } else if (m === 'tps' && tpsStd.fov) {
        baseFov = opts.baseFov != null ? opts.baseFov : tpsStd.fov;
      }
      applyFov(false, 1);
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
      applyCamera(1, 0);
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

    function claimRmbCombat() {
      rmbCombatClaimed = true;
      freeLooking = false;
    }

    function releaseRmbCombat() {
      rmbCombatClaimed = false;
    }

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

    function applyFov(adsOn, hard) {
      if (!camera || camera.fov == null) return;
      var targetFov = adsOn ? baseFov * adsFovMult : baseFov;
      if (mode === 'tps' && combatZoomActive) targetFov *= 0.94;
      if (hard) {
        camera.fov = targetFov;
      } else {
        camera.fov += (targetFov - camera.fov) * 0.22;
      }
      camera.updateProjectionMatrix();
    }

    function onPointerDown(e) {
      if (e.button === 2) {
        rmbHeld = true;
        lastMX = e.clientX;
        lastMY = e.clientY;
        if (mode === 'fps') {
          ads = true;
        }
      }
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        if (mode !== 'fps') {
          orbiting = true;
          lastMX = e.clientX;
          lastMY = e.clientY;
          e.preventDefault();
        }
      }
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
      var el = lockEl || (camera && camera.domElement) || (global.document && global.document.body);
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
      pointerLocked = !!(global.document && global.document.pointerLockElement);
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

    function resolveCameraCollision(from, to) {
      if (!collisionMeshes) return to;
      var list = Array.isArray(collisionMeshes) ? collisionMeshes : [collisionMeshes];
      var valid = list.filter(function (m) {
        return m && m.isObject3D !== false;
      });
      if (!valid.length) return to;

      _camDir.subVectors(to, from);
      var maxDist = _camDir.length();
      if (maxDist < 1e-4) return to;
      _camDir.multiplyScalar(1 / maxDist);
      _camRay.set(from, _camDir);
      _camRay.far = maxDist;
      var hits = _camRay.intersectObjects(valid, true);
      if (!hits || !hits.length) return to;
      // Ignore hits very close to pivot (character self)
      for (var i = 0; i < hits.length; i++) {
        if (hits[i].distance > 0.35) {
          var d = Math.max(minDist * 0.55, hits[i].distance - collisionPad);
          return from.clone().add(_camDir.clone().multiplyScalar(d));
        }
      }
      return to;
    }

    function applyCamera(alpha, dt) {
      if (!camera || !target) return;
      var px = target.position.x;
      var py = target.position.y;
      var pz = target.position.z;
      var groundY = py;
      dt = dt || 0.016;

      // Pull camera in during combat
      var useDist = dist;
      if (mode === 'tps' && combatZoomActive) useDist = dist * combatZoom;

      if (mode === 'iso') {
        var isoH = isoStd.height || 36;
        var isoB = isoStd.back || 30;
        desired.set(px, groundY + isoH, pz + isoB);
        lookAt.set(px, groundY + 1.2, pz);
      } else if (mode === 'fps') {
        var eyeY = groundY + followHeight + (fpsStd.eyeOffset != null ? fpsStd.eyeOffset : 0.35);
        // Head bob when moving
        var bobAmp = fpsStd.bobAmp != null ? fpsStd.bobAmp : 0.028;
        var bobFreq = fpsStd.bobFreq != null ? fpsStd.bobFreq : 9.5;
        if (moveSpeedHint > 0.15) {
          bobPhase += dt * bobFreq * (0.7 + moveSpeedHint * 0.5);
          eyeY += Math.sin(bobPhase) * bobAmp * Math.min(1, moveSpeedHint);
        } else {
          bobPhase *= 0.9;
        }
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
        var ox = Math.sin(yaw) * cp2 * useDist;
        var oy = sp2 * useDist;
        var oz = Math.cos(yaw) * cp2 * useDist;
        // Shoulder offset along camera right
        _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        var sh = shoulder * (freeLooking || orbiting ? 1 : 0.75);
        desired.set(
          px + ox + _right.x * sh,
          groundY + followHeight + oy,
          pz + oz + _right.z * sh
        );
        lookAt.set(px + _right.x * sh * 0.35, groundY + lookHeight, pz + _right.z * sh * 0.35);

        // Camera vs terrain / world
        _camFrom.set(px, groundY + lookHeight + 0.35, pz);
        desired.copy(resolveCameraCollision(_camFrom, desired));
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
      tryBeginTpsFreeLook();
      var a = 1 - Math.exp(-smooth * Math.max(0.001, dt));
      if (mode === 'fps') a = Math.min(1, a * 1.8 + 0.35);
      if (mode === 'iso') a = Math.min(1, a * 0.85);
      applyCamera(a, dt);
      applyFov(mode === 'fps' && ads && rmbHeld, false);
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
      // Prefer heightmap plane when available
      var planeY = target.position.y;
      if (global._terrainHandle && global._terrainHandle.sampleHeight) {
        try {
          planeY = global._terrainHandle.sampleHeight(target.position.x, target.position.z);
        } catch (_) {}
      }
      var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
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

    function getFaceYaw() {
      if (mode === 'fps') return yaw;
      return null;
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
      setCollisionMeshes: setCollisionMeshes,
      setCombatZoom: setCombatZoom,
      setMoveSpeedHint: setMoveSpeedHint,
      setHeights: setHeights,
      getHeights: getHeights,
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
