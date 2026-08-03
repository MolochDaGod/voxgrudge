/**
 * VoxRpgBase combat — FLEET SSOT (single implementation).
 *
 * Consumers (do not re-implement):
 *   - HTML shells: window.VoxRpgBase via <script src="js/vox-rpgbase-combat.js">
 *   - GRUDOX: copy via scripts/sync-vox-rpgbase.mjs → grudox/js/
 *   - DCQ: vendor copy + typed re-export client/src/game/vox-rpgbase.ts
 *   - Open World / future cabinets: same script
 *
 * Sync: npm run sync:rpgbase (from voxgrudge)
 * Do NOT maintain a second combat formula tree in TypeScript or inline HTML.
 *
 * Design note: @ai-rpg-engine/modules is text-sim only — patterns ported here,
 * package is not a runtime dependency of browser shells.
 */
(function (global, factory) {
  'use strict';
  var api = factory();
  // Browser classic script + Node (always attach for HTML shells)
  if (global) global.VoxRpgBase = api;
  // CJS: works when this file is loaded as .cjs (DCQ vendor / Node require)
  // Under package.json "type":"module", bare .js is ESM — use the .cjs sync copy for import.
  if (typeof module === 'object' && module !== null) {
    module.exports = api;
  }
  return api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var WEAPONS = {
    sns: {
      id: 'sns',
      name: 'Sword & Shield',
      shortName: 'BLADE',
      color: 0x4da6ff,
      trail: 0x00ffff,
      damage: 15,
      range: 2.5,
      knockback: 1.5,
      comboMax: 3,
      animSpeed: 0.08,
      lunge: 0.4,
      blockDr: 0.72,
      parryWindow: 0.18,
      stanceLabel: 'SPEED / COMBO',
      heavy: false,
    },
    gs: {
      id: 'gs',
      name: 'Greatsword',
      shortName: '2H SWORD',
      color: 0xff4444,
      trail: 0xff8800,
      damage: 45,
      range: 4.0,
      knockback: 3.0,
      comboMax: 2,
      animSpeed: 0.04,
      lunge: 0.8,
      blockDr: 0.55,
      parryWindow: 0.12,
      stanceLabel: 'HEAVY / AOE',
      heavy: true,
    },
  };

  var DEFAULTS = {
    comboWindowMs: 1200,
    dashDuration: 0.45,
    dashCooldown: 0.6,
    dashSpeedMult: 2.4,
    baseMove: 1,
    attackMoveMult: 0.45,
    blockMoveMult: 0.55,
    snapRange: 6,
    snapCone: 0.4,
    perfectParryMult: 0.05,
    // Stamina / guard (combat-resources + combat-core guardReduction patterns)
    maxStamina: 100,
    staminaRegen: 18, // /s when not blocking
    blockStaminaDrain: 22, // /s while holding block
    blockHitStaminaCost: 12, // per mitigated hit
    attackStaminaCost: { sns: 8, gs: 16 },
    dashStaminaCost: 22,
    guardBreakStun: 0.55,
    // combat:guarded / off_balance / exposed / fleeing (COMBAT_STATES)
    offBalanceSec: 0.7,
    exposedSec: 0.45,
  };

  /** Roles inspired by @ai-rpg-engine/modules combat-roles (8 templates → voxel field). */
  var ROLES = {
    brute: {
      role: 'brute',
      speedMult: 0.72,
      hpMult: 1.45,
      dmgMult: 1.35,
      stopDist: 1.4,
      aggro: 28,
      intents: { attack: 1.35, guard: 0.4, disengage: 0.15, pressure: 1.1, flank: 0.25, finish: 1.0 },
      fleeHp: 0.08,
    },
    skirmisher: {
      role: 'skirmisher',
      speedMult: 1.35,
      hpMult: 0.85,
      dmgMult: 0.9,
      stopDist: 1.2,
      aggro: 32,
      intents: { attack: 1.0, guard: 0.25, disengage: 0.55, pressure: 0.9, flank: 1.4, finish: 0.85 },
      fleeHp: 0.22,
    },
    backliner: {
      role: 'backliner',
      speedMult: 0.9,
      hpMult: 0.9,
      dmgMult: 1.05,
      stopDist: 9,
      aggro: 36,
      intents: { attack: 0.95, guard: 0.5, disengage: 1.1, pressure: 0.7, flank: 0.8, finish: 0.7 },
      fleeHp: 0.28,
      ranged: true,
    },
    bodyguard: {
      role: 'bodyguard',
      speedMult: 0.95,
      hpMult: 1.2,
      dmgMult: 1.0,
      stopDist: 1.5,
      aggro: 26,
      intents: { attack: 0.85, guard: 1.2, disengage: 0.2, pressure: 0.9, flank: 0.4, finish: 0.8 },
      fleeHp: 0.1,
      intercept: true,
    },
    minion: {
      role: 'minion',
      speedMult: 1.0,
      hpMult: 1.0,
      dmgMult: 1.0,
      stopDist: 1.5,
      aggro: 22,
      intents: { attack: 1.1, guard: 0.2, disengage: 0.25, pressure: 0.85, flank: 0.45, finish: 0.7 },
      fleeHp: 0.18,
    },
    elite: {
      role: 'elite',
      speedMult: 1.05,
      hpMult: 1.6,
      dmgMult: 1.25,
      stopDist: 1.45,
      aggro: 30,
      intents: { attack: 1.15, guard: 0.7, disengage: 0.35, pressure: 1.15, flank: 0.7, finish: 1.1 },
      fleeHp: 0.12,
    },
    boss: {
      role: 'boss',
      speedMult: 0.85,
      hpMult: 1.0,
      dmgMult: 1.0,
      stopDist: 1.8,
      aggro: 40,
      intents: { attack: 1.2, guard: 0.55, disengage: 0.05, pressure: 1.3, flank: 0.35, finish: 1.25 },
      fleeHp: 0,
      immovable: true,
    },
    coward: {
      role: 'coward',
      speedMult: 1.15,
      hpMult: 0.75,
      dmgMult: 0.8,
      stopDist: 2.2,
      aggro: 18,
      intents: { attack: 0.55, guard: 0.8, disengage: 1.5, pressure: 0.4, flank: 0.9, finish: 0.4 },
      fleeHp: 0.45,
    },
  };

  /** Map common voxel archetype names → role id */
  var ARCHETYPE_ROLE = {
    GRUNT: 'minion',
    RUNNER: 'skirmisher',
    TANK: 'brute',
    EXPLODER: 'skirmisher',
    SPITTER: 'backliner',
    BRUTE: 'brute',
    WENDIGO: 'elite',
    INFECTOR: 'minion',
    BOSS: 'boss',
    ABOMINATION: 'boss',
  };

  var STATUS = {
    stun: { id: 'stun', maxStacks: 1, blocksAct: true },
    slow: { id: 'slow', maxStacks: 3, moveMult: 0.72 },
    bleed: { id: 'bleed', maxStacks: 5, tickDmg: 1, tickRate: 0.8 },
    burn: { id: 'burn', maxStacks: 3, tickDmg: 2, tickRate: 0.6 },
    shield: { id: 'shield', maxStacks: 1, absorb: true },
    haste: { id: 'haste', maxStacks: 1, moveMult: 1.2 },
  };

  var COMBAT_FLAGS = {
    GUARDED: 'guarded',
    OFF_BALANCE: 'off_balance',
    EXPOSED: 'exposed',
    FLEEING: 'fleeing',
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getTHREE(opts) {
    return (opts && opts.THREE) || global.THREE || null;
  }

  function weaponConfig(id) {
    return WEAPONS[id] || WEAPONS.sns;
  }

  function createCombatState(opts) {
    opts = opts || {};
    var d = Object.assign({}, DEFAULTS, opts.defaults || {});
    var maxStam = opts.maxStamina != null ? opts.maxStamina : d.maxStamina;
    return {
      weapon: opts.weapon || 'sns',
      isAttacking: false,
      isBlocking: false,
      isDashing: false,
      dashCooldown: false,
      comboStep: 0,
      lastAttackTime: 0,
      hitStop: 0,
      attackProgress: 0,
      hasHitThisSwing: false,
      parryTimer: 0,
      blockHeld: false,
      defaults: d,
      pivots: opts.pivots || null,
      clickedTarget: null,
      hoverTarget: null,
      snapActive: false,
      targeted: false,
      // stamina + combat flags (ai-rpg combat-core / combat-resources)
      stamina: maxStam,
      maxStamina: maxStam,
      flag: null, // guarded | off_balance | exposed | fleeing
      flagTimer: 0,
      statuses: [], // { id, remaining, stacks, tickTimer, value }
      morale: opts.morale != null ? opts.morale : 1,
    };
  }

  function roleConfig(id) {
    return ROLES[id] || ROLES.minion;
  }

  function roleForArchetype(type) {
    var key = String(type || '').toUpperCase();
    return ARCHETYPE_ROLE[key] || 'minion';
  }

  function applyCombatFlag(state, flag, sec) {
    state.flag = flag;
    state.flagTimer = sec != null ? sec : 0.5;
  }

  function clearCombatFlag(state) {
    state.flag = null;
    state.flagTimer = 0;
  }

  function applyStatus(target, statusId, duration, stacks) {
    if (!target) return null;
    var def = STATUS[statusId];
    if (!def) return null;
    if (!target.statuses) target.statuses = [];
    var existing = null;
    for (var i = 0; i < target.statuses.length; i++) {
      if (target.statuses[i].id === statusId) {
        existing = target.statuses[i];
        break;
      }
    }
    var st = stacks != null ? stacks : 1;
    if (existing) {
      existing.remaining = Math.max(existing.remaining, duration || 1);
      existing.stacks = Math.min(def.maxStacks || 1, existing.stacks + st);
      return existing;
    }
    var entry = {
      id: statusId,
      remaining: duration != null ? duration : 2,
      stacks: Math.min(def.maxStacks || 1, st),
      tickTimer: def.tickRate || 0,
      value: def.tickDmg || 0,
    };
    target.statuses.push(entry);
    return entry;
  }

  /**
   * Tick statuses on a combatant (player state or enemy.userData-like object).
   * Returns { dmg, moveMult, blockedAct }
   */
  function tickStatuses(target, dt, opts) {
    opts = opts || {};
    var out = { dmg: 0, moveMult: 1, blockedAct: false };
    if (!target || !target.statuses || !target.statuses.length) return out;
    for (var i = target.statuses.length - 1; i >= 0; i--) {
      var s = target.statuses[i];
      var def = STATUS[s.id] || {};
      s.remaining -= dt;
      if (def.blocksAct) out.blockedAct = true;
      if (def.moveMult) out.moveMult *= Math.pow(def.moveMult, s.stacks || 1);
      if (def.tickDmg && def.tickRate) {
        s.tickTimer = (s.tickTimer || 0) - dt;
        if (s.tickTimer <= 0) {
          s.tickTimer += def.tickRate;
          out.dmg += (def.tickDmg || 0) * (s.stacks || 1);
        }
      }
      if (s.remaining <= 0) target.statuses.splice(i, 1);
    }
    return out;
  }

  function spendStamina(state, amount) {
    if (!state) return false;
    amount = amount || 0;
    if (state.stamina < amount) return false;
    state.stamina = Math.max(0, state.stamina - amount);
    return true;
  }

  function regenStamina(state, dt) {
    if (!state || state.isBlocking || state.isAttacking || state.isDashing) return;
    var rate = state.defaults.staminaRegen;
    if (state.flag === COMBAT_FLAGS.OFF_BALANCE) rate *= 0.35;
    state.stamina = Math.min(state.maxStamina, state.stamina + rate * dt);
  }

  /**
   * Soft target assist — rpgbase priority:
   * 1) clicked enemy  2) hover enemy  3) ground aim + snap cone
   * Returns { angle, snapped, targeted, targetPos }
   */
  function softTargetAngle(playerPos, mouseWorld, enemies, state, opts) {
    opts = opts || {};
    var snapRange = opts.snapRange != null ? opts.snapRange : state.defaults.snapRange;
    var snapCone = opts.snapCone != null ? opts.snapCone : state.defaults.snapCone;
    var getPos = opts.getPos || function (e) {
      return e.position || (e.obj && e.obj.root && e.obj.root.position) || e;
    };
    var isDead = opts.isDead || function (e) {
      return !!(e.isDead || (e.userData && e.userData.hp != null && e.userData.hp <= 0));
    };

    var px = playerPos.x;
    var pz = playerPos.z;
    var angle = null;
    var snapped = false;
    var targeted = false;
    var targetPos = null;

    function angleTo(tx, tz) {
      return Math.atan2(tx - px, tz - pz);
    }

    if (state.clickedTarget) {
      targetPos = state.clickedTarget;
      angle = angleTo(targetPos.x, targetPos.z);
      targeted = true;
    } else if (state.hoverTarget) {
      targetPos = state.hoverTarget;
      angle = angleTo(targetPos.x, targetPos.z);
      targeted = true;
    } else if (mouseWorld) {
      var raw = angleTo(mouseWorld.x, mouseWorld.z);
      var bestScore = Infinity;
      var snapAngle = null;
      var snapPos = null;
      var list = enemies || [];
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (isDead(e)) continue;
        var p = getPos(e);
        if (!p) continue;
        var dx = p.x - px;
        var dz = p.z - pz;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > snapRange || dist < 0.05) continue;
        var enemyAngle = Math.atan2(dx, dz);
        var diff = enemyAngle - raw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < snapCone) {
          var score = Math.abs(diff) * 10 + dist;
          if (score < bestScore) {
            bestScore = score;
            snapAngle = enemyAngle;
            snapPos = p;
          }
        }
      }
      if (snapAngle != null) {
        angle = snapAngle;
        snapped = true;
        targetPos = snapPos;
      } else {
        angle = raw;
      }
    }

    state.snapActive = snapped;
    state.targeted = targeted;
    return { angle: angle, snapped: snapped, targeted: targeted, targetPos: targetPos };
  }

  /**
   * Arc / cone hit test. playerDir = forward unit on XZ.
   * Returns array of { entity, dist, toEnemy normalized-ish }
   */
  function checkArcHit(playerPos, playerDirYOrVec, enemies, arcAngle, range, opts) {
    opts = opts || {};
    var getPos = opts.getPos || function (e) {
      return e.position || (e.obj && e.obj.root && e.obj.root.position) || e;
    };
    var isDead = opts.isDead || function (e) {
      return !!(e.isDead || (e.userData && e.userData.hp != null && e.userData.hp <= 0));
    };
    var half = (arcAngle != null ? arcAngle : Math.PI) / 2;
    var fwdX, fwdZ;
    if (typeof playerDirYOrVec === 'number') {
      fwdX = Math.sin(playerDirYOrVec);
      fwdZ = Math.cos(playerDirYOrVec);
    } else {
      fwdX = playerDirYOrVec.x;
      fwdZ = playerDirYOrVec.z != null ? playerDirYOrVec.z : playerDirYOrVec.y;
      var fl = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1;
      fwdX /= fl;
      fwdZ /= fl;
    }

    var hits = [];
    var list = enemies || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (isDead(e)) continue;
      var p = getPos(e);
      if (!p) continue;
      var dx = p.x - playerPos.x;
      var dz = p.z - playerPos.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > range || dist < 0.01) continue;
      var nx = dx / dist;
      var nz = dz / dist;
      var dot = nx * fwdX + nz * fwdZ;
      var ang = Math.acos(clamp(dot, -1, 1));
      if (ang <= half) {
        hits.push({ entity: e, dist: dist, dirX: nx, dirZ: nz });
      }
    }
    return hits;
  }

  /** Combo attack profiles (arc, range mult, dmg mult) per weapon + step */
  function swingProfile(weaponId, comboStep) {
    var w = weaponConfig(weaponId);
    var step = comboStep || 0;
    if (w.id === 'gs') {
      if (step === 0) {
        return { arc: Math.PI / 2, rangeMult: 1, dmgMult: 1.1, hitAt: 0.55, heavy: true };
      }
      return { arc: Math.PI * 1.5, rangeMult: 0.88, dmgMult: 0.9, hitAt: 0.5, heavy: true };
    }
    // SnS 3-hit
    if (step === 0) return { arc: Math.PI, rangeMult: 1, dmgMult: 1, hitAt: 0.5, heavy: false };
    if (step === 1) return { arc: Math.PI, rangeMult: 1, dmgMult: 1, hitAt: 0.5, heavy: false };
    return { arc: Math.PI / 3, rangeMult: 1.4, dmgMult: 1.65, hitAt: 0.5, heavy: false };
  }

  function canAttack(state) {
    if (!state) return false;
    if (state.flag === COMBAT_FLAGS.OFF_BALANCE) return false;
    if (state.statuses) {
      for (var i = 0; i < state.statuses.length; i++) {
        if (STATUS[state.statuses[i].id] && STATUS[state.statuses[i].id].blocksAct) return false;
      }
    }
    return !state.isDashing && !state.isAttacking && !state.isBlocking && state.hitStop <= 0;
  }

  function attemptAttack(state) {
    if (!canAttack(state)) return false;
    var costMap = state.defaults.attackStaminaCost || {};
    var cost = costMap[state.weapon] != null ? costMap[state.weapon] : 10;
    if (state.stamina < cost * 0.35) return false; // too exhausted
    spendStamina(state, Math.min(state.stamina, cost));
    var now = Date.now();
    if (now - state.lastAttackTime > state.defaults.comboWindowMs) state.comboStep = 0;
    state.isAttacking = true;
    state.lastAttackTime = now;
    state.attackProgress = 0;
    state.hasHitThisSwing = false;
    clearCombatFlag(state);
    return true;
  }

  /**
   * Frame-rate independent attack driver. Call once per frame while isAttacking.
   * hooks: { onActiveHit(profile, progress, weapon), onLunge(step), onComplete(weapon, nextCombo) }
   */
  function tickAttackFrame(state, dt, hooks) {
    hooks = hooks || {};
    if (!state.isAttacking) return null;
    if (state.hitStop > 0) return { phase: 'hitstop' };

    var w = weaponConfig(state.weapon);
    // Prototype: +0.08 (sns) / +0.04 (gs) every 16ms → rate 5 / 2.5 per second
    var rate = (w.animSpeed / 0.016) * (hooks.speedMult || 1);
    state.attackProgress += rate * dt;
    var progress = state.attackProgress;
    var profile = swingProfile(state.weapon, state.comboStep);
    var phase = 'windup';

    if (progress < 0.4) {
      phase = 'windup';
      if (hooks.onLunge) hooks.onLunge(w.lunge * rate * dt * 0.35);
    } else if (progress < 0.85) {
      phase = 'active';
      var t = (progress - 0.4) / 0.45;
      if (!state.hasHitThisSwing && t >= profile.hitAt) {
        state.hasHitThisSwing = true;
        if (hooks.onActiveHit) hooks.onActiveHit(profile, progress, w);
      }
    } else {
      phase = 'recovery';
    }

    if (progress >= 1) {
      state.isAttacking = false;
      state.hasHitThisSwing = false;
      state.attackProgress = 0;
      state.comboStep = (state.comboStep + 1) % w.comboMax;
      state.clickedTarget = null;
      if (hooks.onComplete) hooks.onComplete(w, state.comboStep);
      return { phase: 'done', weapon: w, profile: profile };
    }
    return { phase: phase, progress: progress, weapon: w, profile: profile };
  }

  function setBlocking(state, on) {
    var was = state.isBlocking;
    // Need a little stamina to raise guard
    var canGuard = state.stamina > 1 && state.flag !== COMBAT_FLAGS.OFF_BALANCE;
    state.isBlocking = !!on && !state.isDashing && !state.isAttacking && canGuard;
    state.blockHeld = !!on;
    if (state.isBlocking && !was) {
      state.parryTimer = weaponConfig(state.weapon).parryWindow;
      applyCombatFlag(state, COMBAT_FLAGS.GUARDED, 999);
    }
    if (!state.isBlocking) {
      state.parryTimer = 0;
      if (state.flag === COMBAT_FLAGS.GUARDED) clearCombatFlag(state);
    }
    return state.isBlocking;
  }

  /**
   * Apply block / perfect parry / guard-break. Returns { amount, blocked, parried, guardBreak, shake }
   * guardReduction pattern from @ai-rpg-engine/modules combat-core.
   */
  function mitigateDamage(state, amount) {
    amount = amount || 0;
    if (amount <= 0) {
      return { amount: 0, blocked: false, parried: false, guardBreak: false, shake: 0 };
    }
    // shield status absorb
    if (state.statuses) {
      for (var i = 0; i < state.statuses.length; i++) {
        if (state.statuses[i].id === 'shield') {
          state.statuses.splice(i, 1);
          return { amount: 0, blocked: true, parried: false, guardBreak: false, shake: 0.4, absorbed: true };
        }
      }
    }
    if (!state.isBlocking) {
      applyCombatFlag(state, COMBAT_FLAGS.EXPOSED, state.defaults.exposedSec);
      return { amount: amount, blocked: false, parried: false, guardBreak: false, shake: amount * 0.3 };
    }
    var w = weaponConfig(state.weapon);
    if (state.parryTimer > 0) {
      spendStamina(state, 4);
      return {
        amount: Math.max(0, amount * state.defaults.perfectParryMult),
        blocked: true,
        parried: true,
        guardBreak: false,
        shake: 1.2,
      };
    }
    var hitCost = state.defaults.blockHitStaminaCost + amount * 0.8;
    var broke = state.stamina < hitCost * 0.5;
    spendStamina(state, Math.min(state.stamina, hitCost));
    if (broke || state.stamina <= 0) {
      state.isBlocking = false;
      state.blockHeld = false;
      applyCombatFlag(state, COMBAT_FLAGS.OFF_BALANCE, state.defaults.guardBreakStun);
      applyStatus(state, 'stun', state.defaults.guardBreakStun, 1);
      return {
        amount: amount * 0.85,
        blocked: false,
        parried: false,
        guardBreak: true,
        shake: Math.max(2, amount * 0.4),
      };
    }
    // resolve-scaled DR: blockDr + small stamina ratio bonus (cap ~0.82)
    var stamRatio = state.stamina / state.maxStamina;
    var dr = clamp(w.blockDr + stamRatio * 0.08, 0.4, 0.82);
    var reduced = amount * (1 - dr);
    return {
      amount: Math.max(0, reduced),
      blocked: true,
      parried: false,
      guardBreak: false,
      shake: Math.max(0.8, amount * 0.12),
    };
  }

  /**
   * Ally / squad intercept — bodyguard pattern from combat-core interceptChance.
   * allies: array of { position, userData? } near defender.
   * Returns { amount, intercepted, ally } 
   */
  function allyInterceptDamage(amount, defenderPos, allies, opts) {
    opts = opts || {};
    var radius = opts.radius != null ? opts.radius : 3.2;
    var chance = opts.chance != null ? opts.chance : 0.35;
    var list = allies || [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var p = a.position || a;
      if (!p || !defenderPos) continue;
      var dx = p.x - defenderPos.x;
      var dz = p.z - defenderPos.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > radius) continue;
      var role = (a.userData && a.userData.combatRole) || 'bodyguard';
      var mult = role === 'bodyguard' ? 1.4 : role === 'brute' ? 1.1 : 1;
      if (Math.random() < chance * mult) {
        return { amount: amount * 0.15, intercepted: true, ally: a, transferred: amount * 0.85 };
      }
    }
    return { amount: amount, intercepted: false, ally: null, transferred: 0 };
  }

  /**
   * Role-biased combat intent — simplified combat-intent selectNpcCombatAction.
   * Context: { hpRatio, dist, playerBlocking, morale, flankSide }
   * Returns { intent, verb, reason, speedMult, stopDist }
   */
  function selectCombatIntent(roleId, ctx) {
    ctx = ctx || {};
    var role = roleConfig(roleId);
    var hp = ctx.hpRatio != null ? ctx.hpRatio : 1;
    var dist = ctx.dist != null ? ctx.dist : 5;
    var scores = {};
    var intents = role.intents || {};
    var keys = Object.keys(intents);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var s = intents[k];
      if (k === 'attack') s += hp > 0.35 ? 0.2 : -0.15;
      if (k === 'disengage' || k === 'flank') s += hp < (role.fleeHp || 0.2) ? 0.8 : 0;
      if (k === 'guard') s += ctx.playerBlocking ? 0.3 : 0;
      if (k === 'finish') s += hp > 0.6 && dist < 2.5 ? 0.4 : 0;
      if (k === 'pressure') s += dist > 4 && dist < 12 ? 0.25 : 0;
      if (role.immovable && (k === 'disengage' || k === 'flank')) s = 0;
      scores[k] = s;
    }
    var best = 'attack';
    var bestV = -Infinity;
    for (var j = 0; j < keys.length; j++) {
      if (scores[keys[j]] > bestV) {
        bestV = scores[keys[j]];
        best = keys[j];
      }
    }
    if (!role.immovable && hp < (role.fleeHp || 0) && scores.disengage > 0.5) {
      best = 'disengage';
    }
    var verb = 'chase';
    if (best === 'attack' || best === 'finish' || best === 'pressure') verb = 'chase';
    else if (best === 'flank') verb = 'flank';
    else if (best === 'disengage') verb = 'flee';
    else if (best === 'guard') verb = 'hold';
    return {
      intent: best,
      verb: verb,
      reason: role.role + ':' + best,
      speedMult: role.speedMult * (best === 'disengage' ? 1.25 : best === 'pressure' ? 1.1 : 1),
      stopDist: best === 'disengage' ? role.stopDist + 4 : role.ranged && dist < role.stopDist ? role.stopDist : role.stopDist,
      role: role,
    };
  }

  function moveSpeedMult(state) {
    if (state.isDashing) return state.defaults.dashSpeedMult;
    if (state.isAttacking) return state.defaults.attackMoveMult;
    if (state.isBlocking) return state.defaults.blockMoveMult;
    return state.defaults.baseMove;
  }

  function startDash(state) {
    if (state.isDashing || state.dashCooldown || state.isAttacking || state.isBlocking) return false;
    var cost = state.defaults.dashStaminaCost || 20;
    if (state.stamina < cost * 0.5) return false;
    spendStamina(state, Math.min(state.stamina, cost));
    state.isDashing = true;
    state.dashCooldown = true;
    state.isBlocking = false;
    clearCombatFlag(state);
    return true;
  }

  function endDash(state) {
    state.isDashing = false;
    var cd = state.defaults.dashCooldown * 1000;
    setTimeout(function () {
      state.dashCooldown = false;
    }, cd);
  }

  function cycleWeapon(state) {
    if (state.isAttacking || state.isBlocking) return state.weapon;
    state.weapon = state.weapon === 'sns' ? 'gs' : 'sns';
    state.comboStep = 0;
    return state.weapon;
  }

  function setWeapon(state, id) {
    if (!WEAPONS[id]) return state.weapon;
    if (state.isAttacking || state.isBlocking) return state.weapon;
    state.weapon = id;
    state.comboStep = 0;
    return state.weapon;
  }

  function addHitStop(state, frames) {
    state.hitStop = Math.max(state.hitStop, frames || 0);
  }

  function tick(state, dt) {
    if (!state) return;
    if (state.hitStop > 0) {
      state.hitStop = Math.max(0, state.hitStop - dt * 60);
    }
    if (state.parryTimer > 0) {
      state.parryTimer = Math.max(0, state.parryTimer - dt);
    }
    if (state.flagTimer > 0) {
      state.flagTimer -= dt;
      if (state.flagTimer <= 0) clearCombatFlag(state);
    }
    // continuous block drain
    if (state.isBlocking) {
      var drain = state.defaults.blockStaminaDrain * dt;
      state.stamina = Math.max(0, state.stamina - drain);
      if (state.stamina <= 0) {
        state.isBlocking = false;
        applyCombatFlag(state, COMBAT_FLAGS.OFF_BALANCE, state.defaults.guardBreakStun * 0.6);
      }
    } else {
      regenStamina(state, dt);
    }
    tickStatuses(state, dt);
  }

  /**
   * Simple chase + separation AI from rpgbase (for lightweight games).
   * Prefer EnemyBrain for openworld ARPG.
   */
  function createChaseAI(opts) {
    opts = opts || {};
    var chaseSpeed = opts.chaseSpeed != null ? opts.chaseSpeed : 0.04;
    var stopDist = opts.stopDist != null ? opts.stopDist : 1.5;
    var aggro = opts.aggro != null ? opts.aggro : 20;
    var separate = opts.separate != null ? opts.separate : 1.0;
    var friction = opts.friction != null ? opts.friction : 0.85;

    function step(entity, playerPos, others, dt) {
      if (!entity || entity.isDead) return;
      var pos = entity.position || (entity.obj && entity.obj.root && entity.obj.root.position);
      if (!pos) return;
      var vel = entity.velocity;
      if (vel) {
        pos.x += vel.x * (dt ? dt * 60 : 1);
        pos.z += vel.z * (dt ? dt * 60 : 1);
        vel.x *= friction;
        vel.z *= friction;
      }
      var dx = playerPos.x - pos.x;
      var dz = playerPos.z - pos.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > stopDist && dist < aggro) {
        var s = chaseSpeed * (dt ? dt * 60 : 1);
        pos.x += (dx / dist) * s;
        pos.z += (dz / dist) * s;
        if (entity.lookAt && typeof entity.lookAt === 'function') {
          entity.lookAt(playerPos);
        } else if (entity.rotation) {
          entity.rotation.y = Math.atan2(dx, dz);
        }
      }
      if (others && separate > 0) {
        for (var i = 0; i < others.length; i++) {
          var o = others[i];
          if (o === entity) continue;
          var op = o.position || (o.obj && o.obj.root && o.obj.root.position);
          if (!op) continue;
          var ox = pos.x - op.x;
          var oz = pos.z - op.z;
          var od = Math.sqrt(ox * ox + oz * oz);
          if (od > 0.01 && od < separate) {
            pos.x += (ox / od) * 0.02 * (dt ? dt * 60 : 1);
            pos.z += (oz / od) * 0.02 * (dt ? dt * 60 : 1);
          }
        }
      }
    }

    return { step: step, chaseSpeed: chaseSpeed, stopDist: stopDist, aggro: aggro };
  }

  /**
   * Host adapter: pick nearest enemy under pointer for click-to-target.
   */
  function pickClickTarget(enemies, opts) {
    opts = opts || {};
    var getPos = opts.getPos || function (e) {
      return e.position;
    };
    var isDead = opts.isDead || function (e) {
      return !!(e.userData && e.userData.hp != null && e.userData.hp <= 0);
    };
    var mouseWorld = opts.mouseWorld;
    var maxDist = opts.maxDist != null ? opts.maxDist : 2.2;
    if (!mouseWorld) return null;
    var best = null;
    var bestD = maxDist;
    for (var i = 0; i < (enemies || []).length; i++) {
      var e = enemies[i];
      if (isDead(e)) continue;
      var p = getPos(e);
      if (!p) continue;
      var dx = p.x - mouseWorld.x;
      var dz = p.z - mouseWorld.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = { x: p.x, y: p.y || 0, z: p.z, entity: e };
      }
    }
    return best;
  }

  return {
    WEAPONS: WEAPONS,
    DEFAULTS: DEFAULTS,
    ROLES: ROLES,
    ARCHETYPE_ROLE: ARCHETYPE_ROLE,
    STATUS: STATUS,
    COMBAT_FLAGS: COMBAT_FLAGS,
    weaponConfig: weaponConfig,
    roleConfig: roleConfig,
    roleForArchetype: roleForArchetype,
    createCombatState: createCombatState,
    softTargetAngle: softTargetAngle,
    checkArcHit: checkArcHit,
    swingProfile: swingProfile,
    canAttack: canAttack,
    attemptAttack: attemptAttack,
    tickAttackFrame: tickAttackFrame,
    setBlocking: setBlocking,
    mitigateDamage: mitigateDamage,
    allyInterceptDamage: allyInterceptDamage,
    selectCombatIntent: selectCombatIntent,
    applyStatus: applyStatus,
    tickStatuses: tickStatuses,
    applyCombatFlag: applyCombatFlag,
    clearCombatFlag: clearCombatFlag,
    spendStamina: spendStamina,
    regenStamina: regenStamina,
    moveSpeedMult: moveSpeedMult,
    startDash: startDash,
    endDash: endDash,
    cycleWeapon: cycleWeapon,
    setWeapon: setWeapon,
    addHitStop: addHitStop,
    tick: tick,
    createChaseAI: createChaseAI,
    pickClickTarget: pickClickTarget,
  };
});
