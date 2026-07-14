/**
 * Enemy combat kit — colliders, scale helpers, ARPG attack timing + telegraphs.
 *
 * Attack phases (genre standard):
 *   idle → windup (telegraph readable) → active (hit frames) → recovery → cooldown
 *
 * Telegraphs:
 *   circle — ground AoE / slam / leap land
 *   arc    — melee cone in front of attacker
 *   line   — charge path / projectile aim
 */
(function (global) {
  'use strict';

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /** Horizontal collision radius + vertical half-height from enemy size. */
  function getColliderSpec(def, typeId, heightM) {
    def = def || {};
    heightM = heightM || 2;
    var beh = def.beh || 'chase';
    var radius = heightM * 0.22;
    if (beh === 'tank' || beh === 'titan' || beh === 'charger' || beh === 'heavy') {
      radius = heightM * 0.28;
    } else if (beh === 'swoop') {
      radius = heightM * 0.16;
    } else if (beh === 'spitter' || beh === 'poison') {
      radius = heightM * 0.2;
    } else if (beh === 'leaper' || beh === 'ghost_leap') {
      radius = heightM * 0.2;
    }
    // Width from def.sc when present
    if (def.sc != null) radius *= clamp(0.75 + def.sc * 0.2, 0.7, 1.35);
    radius = clamp(radius, 0.35, 1.85);
    var height = clamp(heightM, 0.6, 4.2);
    return {
      radius: radius,
      height: height,
      halfH: height * 0.5,
      // Fixed local box (updated in world space each tick)
      hx: radius,
      hy: height * 0.5,
      hz: radius,
    };
  }

  /**
   * Attack timing by behavior. Windups long enough to read + dodge;
   * higher tiers slightly slower but harder hitting.
   */
  function getAttackProfile(beh, tier, heightM) {
    beh = beh || 'chase';
    tier = tier || 1;
    heightM = heightM || 2;
    var tSlow = 1 + Math.max(0, tier - 2) * 0.06; // bosses wind up a bit longer
    var baseRange = 1.55 + heightM * 0.22;

    var profiles = {
      chase: {
        windup: 0.32 * tSlow,
        active: 0.1,
        recovery: 0.48,
        cd: 1.15,
        range: baseRange,
        engage: baseRange + 0.35,
        telegraph: 'arc',
        arcDeg: 70,
        dmgMult: 1,
        moveMultWindup: 0.35,
        moveMultActive: 0.15,
      },
      heavy: {
        windup: 0.65 * tSlow,
        active: 0.16,
        recovery: 0.85,
        cd: 1.85,
        range: baseRange * 1.15,
        engage: baseRange * 1.2,
        telegraph: 'circle',
        dmgMult: 1.35,
        moveMultWindup: 0.15,
        moveMultActive: 0.05,
      },
      berserker: {
        windup: 0.22 * tSlow,
        active: 0.09,
        recovery: 0.32,
        cd: 0.85,
        range: baseRange * 0.95,
        engage: baseRange + 0.2,
        telegraph: 'arc',
        arcDeg: 90,
        dmgMult: 1.1,
        moveMultWindup: 0.55,
        moveMultActive: 0.2,
      },
      tank: {
        windup: 0.75 * tSlow,
        active: 0.18,
        recovery: 1.05,
        cd: 2.1,
        range: baseRange * 1.25,
        engage: baseRange * 1.3,
        telegraph: 'circle',
        dmgMult: 1.45,
        moveMultWindup: 0.1,
        moveMultActive: 0,
      },
      swoop: {
        windup: 0.38 * tSlow,
        active: 0.12,
        recovery: 0.55,
        cd: 1.35,
        range: baseRange * 1.05,
        engage: baseRange + 0.5,
        telegraph: 'circle',
        dmgMult: 1,
        moveMultWindup: 0.8,
        moveMultActive: 0.4,
      },
      leaper: {
        windup: 0.48 * tSlow,
        active: 0.14,
        recovery: 0.7,
        cd: 2.0,
        range: baseRange * 1.1,
        engage: 9,
        telegraph: 'circle',
        dmgMult: 1.2,
        leap: true,
        leapDist: 7,
        moveMultWindup: 0.2,
        moveMultActive: 0,
      },
      ghost_leap: {
        windup: 0.42 * tSlow,
        active: 0.12,
        recovery: 0.65,
        cd: 2.4,
        range: baseRange,
        engage: 10,
        telegraph: 'circle',
        dmgMult: 1.15,
        ghostLeap: true,
        moveMultWindup: 0.25,
        moveMultActive: 0,
      },
      charger: {
        windup: 0.85 * tSlow,
        active: 0.75,
        recovery: 0.95,
        cd: 2.8,
        range: 14,
        engage: 12,
        telegraph: 'line',
        dmgMult: 1.4,
        charge: true,
        chargeSpeed: 14,
        moveMultWindup: 0,
        moveMultActive: 1,
      },
      spitter: {
        windup: 0.5 * tSlow,
        active: 0.08,
        recovery: 0.75,
        cd: 1.9,
        range: 22,
        engage: 20,
        telegraph: 'line',
        dmgMult: 0.75,
        projectile: true,
        preferRange: 10,
        moveMultWindup: 0.25,
        moveMultActive: 0,
      },
      poison: {
        windup: 0.45 * tSlow,
        active: 0.08,
        recovery: 0.7,
        cd: 1.75,
        range: 18,
        engage: 16,
        telegraph: 'line',
        dmgMult: 0.7,
        projectile: true,
        preferRange: 8,
        moveMultWindup: 0.3,
        moveMultActive: 0,
      },
      titan: {
        windup: 1.05 * tSlow,
        active: 0.22,
        recovery: 1.25,
        cd: 2.6,
        range: baseRange * 1.55,
        engage: baseRange * 1.6,
        telegraph: 'circle',
        dmgMult: 1.65,
        aoe: true,
        moveMultWindup: 0.05,
        moveMultActive: 0,
      },
    };

    var p = profiles[beh] || profiles.chase;
    // Clone so callers can mutate safely
    return {
      windup: p.windup,
      active: p.active,
      recovery: p.recovery,
      cd: p.cd,
      range: p.range,
      engage: p.engage,
      telegraph: p.telegraph,
      arcDeg: p.arcDeg || 75,
      dmgMult: p.dmgMult,
      leap: !!p.leap,
      leapDist: p.leapDist || 0,
      ghostLeap: !!p.ghostLeap,
      charge: !!p.charge,
      chargeSpeed: p.chargeSpeed || 12,
      projectile: !!p.projectile,
      preferRange: p.preferRange || 0,
      aoe: !!p.aoe,
      moveMultWindup: p.moveMultWindup != null ? p.moveMultWindup : 0.3,
      moveMultActive: p.moveMultActive != null ? p.moveMultActive : 0.1,
    };
  }

  function makeRingGeo(THREE, inner, outer, segments) {
    segments = segments || 48;
    var shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    var hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    var geo = new THREE.ShapeGeometry(shape, segments);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  function makeDiscGeo(THREE, radius, segments) {
    var geo = new THREE.CircleGeometry(radius, segments || 40);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  function makeArcGeo(THREE, radius, arcDeg, segments) {
    segments = segments || 28;
    var half = ((arcDeg || 75) * Math.PI) / 180 / 2;
    var geo = new THREE.CircleGeometry(radius, segments, -half + Math.PI / 2, half * 2);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  /**
   * Create a telegraph visual attached to scene (world-space).
   * Returns handle with update(progress 0..1, pos, facingYaw) and dispose().
   */
  function createTelegraph(THREE, scene, kind, opts) {
    opts = opts || {};
    var range = opts.range || 2;
    var color = opts.color != null ? opts.color : 0xff3344;
    var group = new THREE.Group();
    group.renderOrder = 5;
    var fillMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    var edgeMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    var fill = null;
    var edge = null;
    var line = null;

    if (kind === 'line') {
      var len = range;
      var w = opts.width || 1.1;
      fill = new THREE.Mesh(new THREE.PlaneGeometry(w, len), fillMat);
      fill.rotation.x = -Math.PI / 2;
      fill.position.z = -len * 0.5;
      group.add(fill);
      // Leading tip marker
      var tip = new THREE.Mesh(makeDiscGeo(THREE, w * 0.45, 16), edgeMat);
      tip.position.z = -len;
      tip.position.y = 0.03;
      group.add(tip);
    } else if (kind === 'arc') {
      fill = new THREE.Mesh(makeArcGeo(THREE, range, opts.arcDeg || 75, 32), fillMat);
      fill.position.y = 0.04;
      group.add(fill);
      edge = new THREE.Mesh(
        makeRingGeo(THREE, Math.max(0.05, range - 0.12), range, 40),
        edgeMat
      );
      edge.position.y = 0.05;
      // Clip ring to arc via scale trick — full ring is ok as outer bound
      group.add(edge);
    } else {
      // circle default
      fill = new THREE.Mesh(makeDiscGeo(THREE, range, 40), fillMat);
      fill.position.y = 0.04;
      group.add(fill);
      edge = new THREE.Mesh(makeRingGeo(THREE, Math.max(0.08, range - 0.14), range, 48), edgeMat);
      edge.position.y = 0.05;
      group.add(edge);
    }

    // Pulse ring for windup progress
    var pulse = new THREE.Mesh(
      makeRingGeo(THREE, 0.08, 0.18, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    pulse.position.y = 0.06;
    group.add(pulse);

    scene.add(group);

    return {
      group: group,
      kind: kind,
      range: range,
      update: function (progress, x, y, z, yaw) {
        progress = clamp(progress, 0, 1);
        group.position.set(x, y + 0.02, z);
        if (yaw != null) group.rotation.y = yaw;
        fillMat.opacity = 0.12 + progress * 0.35;
        edgeMat.opacity = 0.45 + progress * 0.5;
        // Expand pulse from 0 → range
        var pr = 0.15 + progress * Math.max(range, 1);
        pulse.scale.set(pr, 1, pr);
        pulse.material.opacity = 0.15 + (1 - progress) * 0.5;
        // Danger flash near end of windup
        if (progress > 0.75) {
          var flash = (Math.sin(progress * 40) * 0.5 + 0.5) * 0.25;
          fillMat.opacity = Math.min(0.65, fillMat.opacity + flash);
        }
      },
      setActiveFlash: function () {
        fillMat.color.setHex(0xffffff);
        fillMat.opacity = 0.45;
        edgeMat.opacity = 0.95;
      },
      dispose: function () {
        scene.remove(group);
        group.traverse(function (c) {
          if (c.geometry) c.geometry.dispose();
          if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(function (m) { m.dispose(); });
            else c.material.dispose();
          }
        });
      },
    };
  }

  /** World-space AABB box for collision registry. */
  function worldBoxFromSpec(x, y, z, spec) {
    return {
      cx: x,
      cy: y + spec.halfH,
      cz: z,
      hx: spec.hx,
      hy: spec.hy,
      hz: spec.hz,
    };
  }

  /**
   * Begin attack state on enemy object (mutates e).
   * e needs: mesh, def, attackProfile, atkPhase
   */
  function beginAttack(e, dir, playerPos) {
    var p = e.attackProfile || getAttackProfile(e.beh, e.def && e.def.tier, e.heightM);
    e.atkPhase = 'windup';
    e.atkTimer = p.windup;
    e.atkDir = dir.clone ? dir.clone() : { x: dir.x, y: 0, z: dir.z };
    e.atkHit = false;
    e.atkProfile = p;
    if (playerPos && p.leap) {
      e.atkLeapTarget = { x: playerPos.x, z: playerPos.z };
    }
    if (playerPos && p.ghostLeap) {
      e.atkLeapTarget = {
        x: playerPos.x + (Math.random() - 0.5) * 3,
        z: playerPos.z + (Math.random() - 0.5) * 3,
      };
    }
    if (p.charge && dir) {
      var dlen = Math.hypot(dir.x, dir.z) || 1;
      e.chargeVel = {
        x: (dir.x / dlen) * p.chargeSpeed,
        z: (dir.z / dlen) * p.chargeSpeed,
      };
    }
  }

  function clearAttack(e) {
    e.atkPhase = 'idle';
    e.atkTimer = 0;
    e.atkHit = false;
    e.atkDir = null;
    e.atkLeapTarget = null;
    if (e.telegraph) {
      e.telegraph.dispose();
      e.telegraph = null;
    }
  }

  /**
   * Horizontal distance accounting for both radii (ARPG body sizes).
   */
  function surfaceDist(distCenters, rA, rB) {
    return Math.max(0, distCenters - (rA || 0) - (rB || 0));
  }

  global.EnemyCombat = {
    getColliderSpec: getColliderSpec,
    getAttackProfile: getAttackProfile,
    createTelegraph: createTelegraph,
    worldBoxFromSpec: worldBoxFromSpec,
    beginAttack: beginAttack,
    clearAttack: clearAttack,
    surfaceDist: surfaceDist,
    clamp: clamp,
  };
})(typeof window !== 'undefined' ? window : globalThis);
