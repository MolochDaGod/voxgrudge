/**
 * Danger Room Explorer combat — combo chains, dash lunges, scheduled hits.
 * Ported from Voxel-Forge-Core artifacts/animator Studio.ts + arcade ExplorerGame.ts
 */
(function (global) {
  'use strict';

  var COMBO_WINDOW = 0.9;
  var MOVE_ATTACK_MIN_SPEED = 0.08;
  var COMBO_STAGES = 3;

  /** Weapon id → explorer animation combo (maps to models/anims/*.fbx via host ANIM_FILES). */
  var WEAPON_SETS = {
    sword: {
      combo: ['atk-ss-1', 'atk-ss-2', 'atk-ss-3', 'atk-ss-4', 'atk-ss-5', 'atk-ss-6'],
      rangeScale: 1,
    },
    sword_shield: {
      combo: ['atk-ss-1', 'atk-ss-2', 'atk-ss-3', 'atk-ss-4', 'atk-ss-5', 'atk-ss-6'],
      rangeScale: 1,
    },
    axe: {
      combo: ['atk-ss-1', 'atk-ss-2', 'atk-ss-3', 'atk-gs-spin', 'atk-ss-6'],
      rangeScale: 1.1,
    },
    greatsword: {
      combo: ['atk-greatsword', 'atk-gs-spin', 'atk-ss-6', 'gs-slide'],
      rangeScale: 1.25,
    },
    hammer: {
      combo: ['atk-greatsword', 'atk-ss-3', 'atk-ss-6'],
      rangeScale: 1.15,
    },
    mace: {
      combo: ['atk-ss-1', 'atk-ss-3', 'atk-ss-5'],
      rangeScale: 1,
    },
    dagger: {
      combo: ['unarmed-kick', 'atk-ss-2', 'sword-outward'],
      rangeScale: 0.85,
    },
    spear: {
      combo: ['atk-ss-2', 'atk-ss-3', 'atk-ss-4'],
      rangeScale: 1.2,
    },
    unarmed: {
      combo: ['unarmed-punch', 'unarmed-kick', 'hurricane-kick'],
      rangeScale: 0.9,
    },
  };

  function getWeaponSet(weapon) {
    if (!weapon) return WEAPON_SETS.sword;
    var id = weapon.id || 'sword';
    if (WEAPON_SETS[id]) return WEAPON_SETS[id];
    if (weapon.type === 'heavy_melee') return WEAPON_SETS.greatsword;
    if (weapon.type === 'melee') return WEAPON_SETS.sword;
    return WEAPON_SETS.unarmed;
  }

  /**
   * Resolve strike params — mirrors artifacts/animator combat.ts meleeStrike().
   */
  function meleeStrike(weapon, opts) {
    opts = opts || {};
    var finisher = !!opts.finisher;
    var skill = !!opts.skill;
    var intensityN = 0.65;
    var range = (weapon.range || 4) * (getWeaponSet(weapon).rangeScale || 1);
    var rMin = range * 0.35;
    var rMax = range;
    var damageScale = opts.damageScale || 1;
    var skillForce = opts.skillForce != null ? opts.skillForce : 1;
    var damage = (10 + 26 * intensityN) * (finisher ? 1.6 : 1) * (skill ? 1.5 : 1) * damageScale;
    var force = skillForce * (0.4 + intensityN * 0.9) * (finisher ? 1.5 : 1) * (skill ? 1.4 : 1);
    var radius = (rMax - rMin) * 0.5 + 0.5 + (finisher ? 0.3 : 0) + (skill ? 0.6 : 0);
    return { reach: (rMin + rMax) * 0.5, radius: radius, damage: damage, force: force, rMin: rMin, rMax: rMax };
  }

  function create(opts) {
    opts = opts || {};
    var state = {
      comboIndex: 0,
      comboTimer: 0,
      comboLock: 0,
      chainIdx: 0,
      pendingHits: [],
      lunge: null,
      swingTimer: 0,
      movingAttack: false,
      lastStage: 0,
      meleeCd: 0,
    };

    function canAttack() {
      return state.comboLock <= 0 && state.meleeCd <= 0;
    }

    function isMoving(ctx) {
      return ctx.moving && (ctx.gaitSpeed || 0) > MOVE_ATTACK_MIN_SPEED;
    }

    /**
     * Begin one combo swing (Danger Room doComboHit pattern).
     * ctx: { weapon, aimDir, moving, gaitSpeed, playerPos, onAnim, onLunge, onResolveHit }
     */
    function beginAttack(ctx) {
      if (!canAttack()) return false;
      var weapon = ctx.weapon;
      if (!weapon) return false;
      var stage = state.comboTimer > 0 ? state.comboIndex : 0;
      var finisher = stage === COMBO_STAGES - 1;
      var set = getWeaponSet(weapon);
      var animName = set.combo[state.chainIdx % set.combo.length];
      var moving = isMoving(ctx);

      state.movingAttack = moving;
      state.lastStage = stage;

      var intensityN = 0.65;
      var range = (weapon.range || 4) * (set.rangeScale || 1);
      var rMin = range * 0.35;
      var rMax = range;
      var lungeDist, lungeDur, impactAt;

      if (stage === 0) {
        lungeDist = Math.min(rMax * 0.5, 2.5);
        lungeDur = 0.22;
        impactAt = 0.7;
      } else {
        lungeDist = 0.3 + 0.5 * intensityN;
        lungeDur = 0.18;
        impactAt = 0.5;
      }

      var dur = moving ? 0.38 : 0.52;
      if (ctx.onAnim) {
        ctx.onAnim(animName, {
          moving: moving,
          stage: stage,
          finisher: finisher,
          dur: dur,
          chainIdx: state.chainIdx,
        });
      }

      state.swingTimer = dur * 0.45;

      if (ctx.onLunge) {
        ctx.onLunge(ctx.aimDir, lungeDist, lungeDur, impactAt, stage);
      }

      var delay = lungeDur * impactAt;
      state.pendingHits.push({
        t: (ctx.now != null ? ctx.now : performance.now()) + delay * 1000,
        stage: stage,
        finisher: finisher,
        dir: ctx.aimDir,
        weapon: weapon,
        intensityN: intensityN,
        rMin: rMin,
        rMax: rMax,
        onResolve: ctx.onResolveHit,
      });

      state.comboIndex = (stage + 1) % COMBO_STAGES;
      state.comboTimer = COMBO_WINDOW;
      state.comboLock = stage === 0 ? 0.22 : 0.16;
      state.chainIdx = (state.chainIdx + 1) % set.combo.length;
      state.meleeCd = opts.meleeCooldown != null ? opts.meleeCooldown : 0.28;

      return true;
    }

    function update(dt, now) {
      now = now != null ? now : performance.now();
      if (state.comboTimer > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) {
          state.comboIndex = 0;
          state.chainIdx = 0;
        }
      }
      if (state.comboLock > 0) state.comboLock -= dt;
      if (state.swingTimer > 0) state.swingTimer -= dt;
      if (state.meleeCd > 0) state.meleeCd -= dt;

      if (state.lunge) {
        var L = state.lunge;
        L.elapsed += dt;
        var p = Math.min(1, L.elapsed / L.dur);
        var ease = p < L.impactAt ? p / L.impactAt : 1;
        var dist = L.startDist + (L.endDist - L.startDist) * ease;
        if (ctxApplyLunge(L, dist) === false) {
          state.lunge = null;
        } else if (L.elapsed >= L.dur) {
          state.lunge = null;
        }
      }

      var i = 0;
      while (i < state.pendingHits.length) {
        if (state.pendingHits[i].t <= now) {
          var hit = state.pendingHits[i];
          resolveHit(hit);
          state.pendingHits.splice(i, 1);
        } else {
          i++;
        }
      }
    }

    function ctxApplyLunge(L, dist) {
      if (!L.mesh || !L.dir) return false;
      var nx = L.originX + L.dir.x * dist;
      var nz = L.originZ + L.dir.z * dist;
      if (L.resolveMove) {
        var resolved = L.resolveMove(nx, nz);
        L.mesh.position.x = resolved.x;
        L.mesh.position.z = resolved.z;
      } else {
        L.mesh.position.x = nx;
        L.mesh.position.z = nz;
      }
      return true;
    }

    function resolveHit(hit) {
      var strike = meleeStrike(hit.weapon, {
        finisher: hit.finisher,
        damageScale: hit.weapon.dmg ? hit.weapon.dmg / 45 : 1,
      });
      if (hit.onResolve) {
        hit.onResolve({
          strike: strike,
          dir: hit.dir,
          stage: hit.stage,
          finisher: hit.finisher,
          weapon: hit.weapon,
        });
      }
    }

    function startLunge(mesh, dir, dist, dur, impactAt, origin, resolveMove) {
      state.lunge = {
        mesh: mesh,
        dir: dir,
        dur: dur,
        impactAt: impactAt,
        elapsed: 0,
        startDist: 0,
        endDist: dist,
        originX: origin.x,
        originZ: origin.z,
        resolveMove: resolveMove,
      };
    }

    function resetCombo() {
      state.comboIndex = 0;
      state.comboTimer = 0;
      state.chainIdx = 0;
      state.pendingHits = [];
      state.lunge = null;
    }

    return {
      state: state,
      canAttack: canAttack,
      beginAttack: beginAttack,
      update: update,
      startLunge: startLunge,
      resetCombo: resetCombo,
      getStage: function () { return state.lastStage; },
      isSwinging: function () { return state.swingTimer > 0; },
      isMovingAttack: function () { return state.movingAttack; },
    };
  }

  global.GrudgeExplorerCombat = {
    create: create,
    WEAPON_SETS: WEAPON_SETS,
    meleeStrike: meleeStrike,
    getWeaponSet: getWeaponSet,
    COMBO_WINDOW: COMBO_WINDOW,
    MOVE_ATTACK_MIN_SPEED: MOVE_ATTACK_MIN_SPEED,
  };
})(typeof window !== 'undefined' ? window : globalThis);