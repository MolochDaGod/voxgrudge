/**
 * Enemy AI brain — Albion/ARPG-style state machine layered on combat kit.
 *
 * States: idle → patrol → alert → chase / flank / kite → combat → retreat → leash
 * Memory: keeps last-known player position briefly after LOS break.
 */
(function (global) {
  'use strict';

  var AI = (global.VoxStandards && global.VoxStandards.AI) || {
    STATES: {
      IDLE: 'idle',
      PATROL: 'patrol',
      ALERT: 'alert',
      CHASE: 'chase',
      COMBAT: 'combat',
      KITE: 'kite',
      FLANK: 'flank',
      RETREAT: 'retreat',
      LEASH: 'leash',
      STUNNED: 'stunned',
    },
    MEMORY_SEC: 4.5,
    ALERT_HOLD: 1.6,
    FLANK_CHANCE: 0.28,
    CALL_HELP_RADIUS: 22,
  };

  var S = AI.STATES;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function initBrain(e, opts) {
    opts = opts || {};
    e.brain = {
      state: e.campId ? S.PATROL : S.IDLE,
      prev: S.IDLE,
      timer: 0.5 + Math.random(),
      memory: null, // {x,z,t}
      flankSide: Math.random() < 0.5 ? 1 : -1,
      calledHelp: false,
      alertT: 0,
      thinkCd: 0,
    };
    e.aggro = !!opts.aggro;
    return e.brain;
  }

  function setState(e, next, hold) {
    if (!e.brain) initBrain(e);
    if (e.brain.state === next) return;
    e.brain.prev = e.brain.state;
    e.brain.state = next;
    e.brain.timer = hold != null ? hold : 0.4 + Math.random() * 0.4;
    if (next === S.ALERT) e.brain.alertT = AI.ALERT_HOLD;
    if (next === S.FLANK) e.brain.flankSide = Math.random() < 0.5 ? 1 : -1;
    if (next === S.PATROL || next === S.IDLE || next === S.LEASH) {
      e.brain.calledHelp = false;
    }
  }

  function rememberPlayer(e, pp) {
    e.brain.memory = { x: pp.x, z: pp.z, t: AI.MEMORY_SEC };
  }

  function decayMemory(e, dt) {
    if (!e.brain.memory) return;
    e.brain.memory.t -= dt;
    if (e.brain.memory.t <= 0) e.brain.memory = null;
  }

  function isRanged(beh) {
    return beh === 'spitter' || beh === 'poison' || beh === 'titan';
  }

  function isKiter(beh) {
    return beh === 'spitter' || beh === 'poison';
  }

  function isFlanker(beh) {
    return beh === 'chase' || beh === 'berserker' || beh === 'leaper' || beh === 'ghost_leap';
  }

  /**
   * Decide high-level state. Does not move the mesh — returns intent:
   * { state, moveDir:{x,z}|null, speedMult, wantAttack, faceDir }
   */
  function think(e, ctx) {
    ctx = ctx || {};
    var pp = ctx.playerPos;
    var dt = ctx.dt || 0.016;
    var dist = ctx.dist != null ? ctx.dist : 999;
    var inSafe = !!ctx.inSafe;
    var aggroR = ctx.aggroRadius != null ? ctx.aggroRadius : 32;
    var leashR = ctx.leashRadius != null ? ctx.leashRadius : 90;
    var patrolR = ctx.patrolRadius != null ? ctx.patrolRadius : 14;
    var alertR = ctx.alertRadius != null ? ctx.alertRadius : aggroR * 1.25;
    var busy = !!ctx.busy;

    if (!e.brain) initBrain(e);
    var b = e.brain;
    b.timer = Math.max(0, b.timer - dt);
    b.thinkCd = Math.max(0, b.thinkCd - dt);
    decayMemory(e, dt);

    if (e.stunTimer && e.stunTimer > 0) {
      setState(e, S.STUNNED, e.stunTimer);
      return intent(S.STUNNED, null, 0, false, null);
    }

    var ep = e.mesh.position;
    var homeX = e.homeX != null ? e.homeX : ep.x;
    var homeZ = e.homeZ != null ? e.homeZ : ep.z;
    var distHome = Math.hypot(ep.x - homeX, ep.z - homeZ);
    var hpPct = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    var fleePct = (global.VoxStandards && global.VoxStandards.SCALE.FLEE_HP_PCT) || 0.18;

    // Leash always wins for camp units
    if (e.campId && distHome > leashR) {
      setState(e, S.LEASH, 0.5);
      e.aggro = false;
      e.leashed = true;
      var toHome = norm(homeX - ep.x, homeZ - ep.z);
      return intent(S.LEASH, toHome, 1.25, false, toHome);
    }
    e.leashed = false;

    if (inSafe) {
      e.aggro = false;
      if (e.campId) setState(e, S.PATROL);
      else setState(e, S.IDLE);
      return patrolOrIdle(e, homeX, homeZ, patrolR, dt);
    }

    // Sense player
    var canSee = !inSafe && dist < aggroR;
    var canHear = !inSafe && dist < (alertR * 0.55);
    if (canSee || canHear) rememberPlayer(e, pp);
    if (canSee) e.aggro = true;

    // Low HP retreat (ranged / scouts)
    if (e.aggro && hpPct < fleePct && isKiter(e.beh) && dist < 14) {
      setState(e, S.RETREAT, 1.2);
      var away = norm(ep.x - pp.x, ep.z - pp.z);
      return intent(S.RETREAT, away, 1.1, false, away);
    }

    if (e.aggro || b.memory) {
      var target = canSee
        ? { x: pp.x, z: pp.z }
        : b.memory
          ? { x: b.memory.x, z: b.memory.z }
          : null;

      if (!target) {
        e.aggro = false;
        setState(e, e.campId ? S.PATROL : S.IDLE);
        return patrolOrIdle(e, homeX, homeZ, patrolR, dt);
      }

      var toT = norm(target.x - ep.x, target.z - ep.z);
      var tDist = Math.hypot(target.x - ep.x, target.z - ep.z);

      // Soft alert when first sensing outside hard aggro
      if (!canSee && canHear && b.state !== S.CHASE && b.state !== S.COMBAT) {
        setState(e, S.ALERT, AI.ALERT_HOLD);
        return intent(S.ALERT, toT, 0.35, false, toT);
      }

      if (b.state === S.ALERT) {
        b.alertT -= dt;
        if (b.alertT <= 0 || canSee) {
          setState(e, S.CHASE);
        } else {
          return intent(S.ALERT, toT, 0.4, false, toT);
        }
      }

      // Call nearby campmates once
      if (canSee && !b.calledHelp && ctx.callHelp) {
        b.calledHelp = true;
        ctx.callHelp(e, AI.CALL_HELP_RADIUS);
      }

      // Ranged kite band
      if (isKiter(e.beh) && canSee) {
        var prefer = (e.attackProfile && e.attackProfile.preferRange) || 9;
        if (tDist < prefer - 2.2) {
          setState(e, S.KITE);
          var back = norm(ep.x - pp.x, ep.z - pp.z);
          return intent(S.KITE, back, 0.9, !busy && tDist < (e.attackProfile && e.attackProfile.range || 18), toT);
        }
        if (tDist > prefer + 1.5) {
          setState(e, S.CHASE);
          return intent(S.CHASE, toT, 0.75, false, toT);
        }
        setState(e, S.COMBAT);
        return intent(S.COMBAT, null, 0.15, !busy, toT);
      }

      // Flank occasionally while closing
      if (isFlanker(e.beh) && canSee && tDist > 4 && tDist < aggroR * 0.85) {
        if (b.state !== S.FLANK && b.thinkCd <= 0 && Math.random() < AI.FLANK_CHANCE) {
          setState(e, S.FLANK, 1.4 + Math.random());
          b.thinkCd = 2.5;
        }
      }

      if (b.state === S.FLANK && tDist > 2.5) {
        var side = b.flankSide || 1;
        var fx = toT.x;
        var fz = toT.z;
        var sx = -fz * side;
        var sz = fx * side;
        var blend = norm(fx * 0.55 + sx * 0.85, fz * 0.55 + sz * 0.85);
        return intent(S.FLANK, blend, 1.05, false, toT);
      }

      // Melee close / combat
      var stopAt = (e.radius || 0.5) + 0.45 + 0.15;
      var engage = (e.attackProfile && e.attackProfile.engage) || 2.5;

      if (tDist <= engage * 1.15) {
        setState(e, S.COMBAT);
        var hold = tDist > stopAt ? toT : null;
        return intent(S.COMBAT, hold, hold ? 0.55 : 0.1, !busy && canSee, toT);
      }

      setState(e, S.CHASE);
      var spd =
        e.beh === 'berserker' && tDist < 10
          ? 1.45
          : e.beh === 'charger'
            ? 0.75
            : e.beh === 'leaper' || e.beh === 'ghost_leap'
              ? 0.6
              : 1;
      return intent(S.CHASE, toT, spd, false, toT);
    }

    // Passive
    if (e.campId) {
      setState(e, S.PATROL);
      return patrolOrIdle(e, homeX, homeZ, patrolR, dt);
    }
    setState(e, S.IDLE);
    return patrolOrIdle(e, homeX, homeZ, patrolR * 0.3, dt);
  }

  function patrolOrIdle(e, homeX, homeZ, patrolR, dt) {
    var ep = e.mesh.position;
    if (!e.campId) {
      return intent(S.IDLE, null, 0, false, null);
    }
    e.patrolAngle = (e.patrolAngle || 0) + dt * 0.4;
    var pr = patrolR * 0.45;
    var tx = homeX + Math.cos(e.patrolAngle) * pr;
    var tz = homeZ + Math.sin(e.patrolAngle) * pr;
    var toP = norm(tx - ep.x, tz - ep.z);
    var d = Math.hypot(tx - ep.x, tz - ep.z);
    return intent(S.PATROL, d > 0.5 ? toP : null, 0.35, false, d > 0.5 ? toP : null);
  }

  function intent(state, moveDir, speedMult, wantAttack, faceDir) {
    return {
      state: state,
      moveDir: moveDir,
      speedMult: speedMult != null ? speedMult : 1,
      wantAttack: !!wantAttack,
      faceDir: faceDir,
    };
  }

  function norm(x, z) {
    var l = Math.hypot(x, z) || 1;
    return { x: x / l, z: z / l };
  }

  /** Aggro nearby enemies (camp call-for-help). */
  function callHelp(source, enemies, radius, playerPos) {
    if (!source || !enemies) return;
    var sp = source.mesh.position;
    var mem =
      playerPos ||
      (source.brain && source.brain.memory) ||
      sp;
    enemies.forEach(function (o) {
      if (!o.alive || o === source) return;
      if (source.campId && o.campId && o.campId !== source.campId) return;
      var d = Math.hypot(o.mesh.position.x - sp.x, o.mesh.position.z - sp.z);
      if (d < radius) {
        o.aggro = true;
        if (!o.brain) initBrain(o, { aggro: true });
        rememberPlayer(o, mem);
        setState(o, S.CHASE);
      }
    });
  }

  global.EnemyBrain = {
    STATES: S,
    init: initBrain,
    setState: setState,
    think: think,
    callHelp: callHelp,
    rememberPlayer: rememberPlayer,
  };
})(typeof window !== 'undefined' ? window : globalThis);
