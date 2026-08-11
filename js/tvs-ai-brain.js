/**
 * TVS AI Brain — runtime for CDN *.brain.json (GOAP-style goals + archetype strategy).
 *
 * SSOT brain files live next to units on R2:
 *   https://assets.grudge-studio.com/models/voxels/tvs/{pack}/characters/{unitId}.brain.json
 *
 * Loaded by TvsUnitLoader when withBrain:true (default). Does not invent a second
 * combat stack — emits intent { state, moveDir, speed, face, anim, fire, target }
 * that games / VoxAIBrain / enemy-brain can consume.
 *
 * Archetypes from classHint: melee · ranged · magic · civilian · animal
 */
(function (global) {
  "use strict";

  var CDN = "https://assets.grudge-studio.com";

  /** Default strategy templates when brain JSON is thin / missing goals. */
  var ARCHETYPE_DEFAULTS = {
    melee: {
      preferredRange: 1.6,
      maxRange: 2.2,
      walkSpeed: 2.4,
      runSpeed: 4.8,
      attackCooldown: 1.1,
      aggression: 0.75,
      goals: [
        { id: "survive", priority: 100, when: "hp < 0.25", action: "flee_or_defend" },
        { id: "engage", priority: 80, when: "enemyInRange", action: "melee_combo" },
        { id: "hunt", priority: 50, when: "enemyKnown", action: "chase" },
        { id: "command", priority: 15, when: "idle", action: "command_ally" },
        { id: "patrol", priority: 10, when: "idle", action: "patrol_waypoints" },
      ],
    },
    ranged: {
      preferredRange: 8,
      maxRange: 14,
      walkSpeed: 2.2,
      runSpeed: 4.2,
      attackCooldown: 1.4,
      aggression: 0.55,
      goals: [
        { id: "survive", priority: 100, when: "hp < 0.2", action: "flee_or_defend" },
        { id: "kite", priority: 85, when: "enemyTooClose", action: "kite_back" },
        { id: "engage", priority: 75, when: "enemyInRange", action: "ranged_shot" },
        { id: "hunt", priority: 50, when: "enemyKnown", action: "chase" },
        { id: "patrol", priority: 10, when: "idle", action: "patrol_waypoints" },
      ],
    },
    magic: {
      preferredRange: 7,
      maxRange: 12,
      walkSpeed: 2.0,
      runSpeed: 3.8,
      attackCooldown: 1.6,
      aggression: 0.6,
      goals: [
        { id: "survive", priority: 100, when: "hp < 0.22", action: "flee_or_defend" },
        { id: "engage", priority: 80, when: "enemyInRange", action: "cast_spell" },
        { id: "hunt", priority: 50, when: "enemyKnown", action: "chase" },
        { id: "patrol", priority: 10, when: "idle", action: "patrol_waypoints" },
      ],
    },
    civilian: {
      preferredRange: 99,
      maxRange: 99,
      walkSpeed: 1.6,
      runSpeed: 3.2,
      attackCooldown: 2.5,
      aggression: 0.05,
      goals: [
        { id: "flee", priority: 100, when: "enemyKnown", action: "flee_or_defend" },
        { id: "work", priority: 45, when: "idle", action: "idle_work" },
        { id: "social", priority: 30, when: "idle", action: "idle_social" },
        { id: "patrol", priority: 10, when: "idle", action: "patrol_waypoints" },
      ],
    },
    animal: {
      preferredRange: 1.4,
      maxRange: 2.0,
      walkSpeed: 2.0,
      runSpeed: 5.5,
      attackCooldown: 1.0,
      aggression: 0.35,
      goals: [
        { id: "flee", priority: 90, when: "hp < 0.4", action: "flee_or_defend" },
        { id: "engage", priority: 60, when: "enemyInRange", action: "melee_combo" },
        { id: "wander", priority: 10, when: "idle", action: "patrol_waypoints" },
      ],
    },
  };

  function archetypeOf(brain) {
    var a = String(
      (brain && (brain.archetype || brain.classHint)) || "melee"
    ).toLowerCase();
    if (a === "mage" || a === "caster") return "magic";
    if (a === "archer" || a === "bow") return "ranged";
    if (a === "worker" || a === "villager" || a === "npc") return "civilian";
    if (ARCHETYPE_DEFAULTS[a]) return a;
    return "melee";
  }

  function mergeBrain(raw) {
    raw = raw || {};
    var arch = archetypeOf(raw);
    var def = ARCHETYPE_DEFAULTS[arch] || ARCHETYPE_DEFAULTS.melee;
    var combat = Object.assign(
      {
        preferredRange: def.preferredRange,
        maxRange: def.maxRange,
        attackCooldown: def.attackCooldown,
        windup: 0.25,
        recovery: 0.35,
        damage: 12,
        combo: ["attack"],
      },
      raw.combat || {}
    );
    var loco = Object.assign(
      {
        walkSpeed: def.walkSpeed,
        runSpeed: def.runSpeed,
        turnSpeed: 8,
        acceleration: 12,
      },
      raw.locomotion || {}
    );
    var senses = Object.assign(
      {
        visionRange: 16,
        visionFov: 120,
        hearRange: 10,
        memorySeconds: 6,
      },
      raw.senses || {}
    );
    var goals =
      raw.goals && raw.goals.length ? raw.goals.slice() : def.goals.slice();
    goals.sort(function (a, b) {
      return (b.priority || 0) - (a.priority || 0);
    });
    var bb = Object.assign(
      { aggression: def.aggression, courage: 0.6, teamwork: 0.4 },
      raw.blackboard || {}
    );
    return {
      id: raw.id || raw.brainId || "brain-unknown",
      unitId: raw.unitId || null,
      displayName: raw.displayName || raw.unitId || "unit",
      pack: raw.pack || null,
      grudgeUuid: raw.grudgeUuid || null,
      archetype: arch,
      classHint: raw.classHint || arch,
      tickHz: raw.tickHz || 10,
      senses: senses,
      combat: combat,
      locomotion: loco,
      goals: goals,
      states: raw.states || [
        "idle",
        "patrol",
        "chase",
        "attack",
        "defend",
        "flee",
        "dead",
      ],
      blackboard: bb,
      animationPackUrl: raw.animationPackUrl || null,
      colliderUrl: raw.colliderUrl || null,
      modelUrl: raw.modelUrl || null,
      _raw: raw,
    };
  }

  async function fetchJson(url) {
    if (!url) return null;
    var res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("brain " + res.status + " " + url);
    return res.json();
  }

  async function load(urlOrBrain) {
    if (!urlOrBrain) throw new Error("[TvsAiBrain] missing brain");
    if (typeof urlOrBrain === "object" && !Array.isArray(urlOrBrain)) {
      return mergeBrain(urlOrBrain);
    }
    var data = await fetchJson(String(urlOrBrain));
    return mergeBrain(data);
  }

  function evalWhen(when, ctx) {
    when = String(when || "idle").trim();
    var hp = ctx.hpPct != null ? ctx.hpPct : 1;
    var dist = ctx.dist != null ? ctx.dist : 999;
    var known = !!ctx.enemyKnown;
    var inRange = !!ctx.enemyInRange;
    var tooClose = !!ctx.enemyTooClose;
    var idle = !known;

    if (when === "idle") return idle;
    if (when === "enemyKnown") return known;
    if (when === "enemyInRange") return inRange;
    if (when === "enemyTooClose") return tooClose;

    // hp < 0.25
    var m = when.match(/^hp\s*<\s*([\d.]+)$/i);
    if (m) return hp < parseFloat(m[1]);
    m = when.match(/^hp\s*<=\s*([\d.]+)$/i);
    if (m) return hp <= parseFloat(m[1]);
    m = when.match(/^hp\s*>\s*([\d.]+)$/i);
    if (m) return hp > parseFloat(m[1]);

    // always
    if (when === "true" || when === "always") return true;
    return false;
  }

  function pickGoal(brain, ctx) {
    var goals = brain.goals || [];
    for (var i = 0; i < goals.length; i++) {
      if (evalWhen(goals[i].when, ctx)) return goals[i];
    }
    return { id: "idle", priority: 0, when: "idle", action: "idle" };
  }

  function actionToIntent(action, brain, ctx) {
    var arch = brain.archetype;
    var loco = brain.locomotion;
    var combat = brain.combat;
    var home = ctx.home || { x: 0, z: 0 };
    var self = ctx.self || { x: 0, z: 0 };
    var target = ctx.target || null;
    var dist = ctx.dist != null ? ctx.dist : 999;

    var moveDir = null;
    var speed = 0;
    var face = null;
    var anim = "idle";
    var fire = false;
    var state = "idle";

    function dirTo(tx, tz) {
      var dx = tx - self.x;
      var dz = tz - self.z;
      var len = Math.hypot(dx, dz) || 1;
      return { x: dx / len, z: dz / len };
    }

    switch (String(action || "idle")) {
      case "melee_combo":
      case "attack":
        state = "attack";
        anim = "attack";
        if (target) {
          face = dirTo(target.x, target.z);
          if (dist > combat.preferredRange * 1.05) {
            moveDir = face;
            speed = loco.runSpeed;
            state = "chase";
            anim = "locomotion";
          } else {
            fire = ctx.attackReady !== false;
            speed = 0;
          }
        }
        break;

      case "ranged_shot":
        state = "attack";
        // Prefer aim pose when holding shot in range
        anim = "aim";
        if (target) {
          face = dirTo(target.x, target.z);
          if (dist < combat.preferredRange * 0.55) {
            moveDir = { x: -face.x, z: -face.z };
            speed = loco.walkSpeed;
            state = "kite";
            anim = "locomotion";
          } else if (dist > combat.maxRange) {
            moveDir = face;
            speed = loco.runSpeed;
            state = "chase";
            anim = "locomotion";
          } else {
            fire = ctx.attackReady !== false;
            anim = fire ? "attack" : "aim";
            speed = 0;
          }
        }
        break;

      case "cast_spell":
        state = "attack";
        anim = "cast";
        if (target) {
          face = dirTo(target.x, target.z);
          if (dist < combat.preferredRange * 0.55) {
            moveDir = { x: -face.x, z: -face.z };
            speed = loco.walkSpeed;
            state = "kite";
            anim = "locomotion";
          } else if (dist > combat.maxRange) {
            moveDir = face;
            speed = loco.runSpeed;
            state = "chase";
            anim = "locomotion";
          } else {
            fire = ctx.attackReady !== false;
            anim = fire ? "cast" : "idle";
            speed = 0;
          }
        }
        break;

      case "kite_back":
        state = "kite";
        anim = "locomotion";
        if (target) {
          face = dirTo(target.x, target.z);
          moveDir = { x: -face.x, z: -face.z };
          speed = loco.runSpeed;
          if (dist >= combat.preferredRange * 0.9 && dist <= combat.maxRange) {
            fire = ctx.attackReady !== false;
            anim = "attack";
            speed = loco.walkSpeed * 0.5;
          }
        }
        break;

      case "chase":
        state = "chase";
        anim = "locomotion";
        if (target) {
          face = dirTo(target.x, target.z);
          moveDir = face;
          speed = loco.runSpeed;
        }
        break;

      case "flee_or_defend":
        if (brain.blackboard.courage > 0.55 && arch === "melee" && target) {
          state = "defend";
          anim = "defend";
          face = dirTo(target.x, target.z);
          fire = false;
          speed = 0;
        } else {
          state = "flee";
          anim = "locomotion";
          if (target) {
            face = dirTo(target.x, target.z);
            moveDir = { x: -face.x, z: -face.z };
            speed = loco.runSpeed;
          } else {
            moveDir = dirTo(home.x, home.z);
            speed = loco.runSpeed;
          }
        }
        break;

      case "patrol_waypoints":
        state = "patrol";
        anim = "locomotion";
        // Orbit home on a slow circle (waypoint-free default)
        var ang = (ctx.time || 0) * 0.35 + (ctx.seed || 0);
        var pr = ctx.patrolRadius != null ? ctx.patrolRadius : 6;
        var wx = home.x + Math.cos(ang) * pr;
        var wz = home.z + Math.sin(ang) * pr;
        moveDir = dirTo(wx, wz);
        speed = loco.walkSpeed;
        face = moveDir;
        break;

      case "idle_work":
        // Farm dig / sit cycle — uses author human-dig-anim when loaded
        state = "work";
        {
          var wt = Math.floor((ctx.time || 0) / 3.5) % 4;
          anim = ["dig", "idle", "sit", "dig"][wt] || "idle";
        }
        speed = 0;
        break;

      case "idle_social":
        // Village barter / drunk / pray when available
        state = "social";
        {
          var st = Math.floor((ctx.time || 0) / 4) % 5;
          anim = ["barter", "drunk", "pray", "sit", "idle"][st] || "idle";
        }
        speed = 0;
        break;

      case "command_ally":
        state = "command";
        anim = "command";
        speed = 0;
        if (target) face = dirTo(target.x, target.z);
        break;

      case "aim_ready":
        state = "aim";
        anim = "aim";
        speed = 0;
        if (target) {
          face = dirTo(target.x, target.z);
          if (dist > combat.preferredRange) {
            moveDir = face;
            speed = loco.walkSpeed;
            anim = "locomotion";
          }
        }
        break;

      case "mount":
        state = "mounted";
        anim = "mounted";
        speed = loco.walkSpeed * 1.2;
        if (target) {
          face = dirTo(target.x, target.z);
          moveDir = face;
        }
        break;

      case "cast_ready":
        state = "cast";
        anim = "cast";
        speed = 0;
        if (target) face = dirTo(target.x, target.z);
        fire = ctx.attackReady !== false;
        break;

      default:
        state = "idle";
        anim = "idle";
        speed = 0;
        break;
    }

    return {
      state: state,
      moveDir: moveDir,
      speed: speed,
      face: face,
      anim: anim,
      fire: fire,
      target: target,
      goalId: ctx.goalId || null,
      action: action,
      archetype: arch,
    };
  }

  /**
   * Create a tickable agent from merged brain JSON.
   * agent.think(ctx) → intent
   * agent.tick(dt, ctx) → intent (rate-limited by tickHz)
   */
  function createAgent(brainIn, opts) {
    opts = opts || {};
    var brain = mergeBrain(brainIn);
    var interval = 1 / Math.max(1, brain.tickHz || 10);
    var accum = Math.random() * interval;
    var lastIntent = {
      state: "idle",
      moveDir: null,
      speed: 0,
      face: null,
      anim: "idle",
      fire: false,
      target: null,
      goalId: null,
      action: "idle",
      archetype: brain.archetype,
    };
    var attackCd = 0;
    var seed = opts.seed != null ? opts.seed : Math.random() * Math.PI * 2;
    var home = opts.home ? { x: opts.home.x || 0, z: opts.home.z || 0 } : null;

    function buildCtx(ctx) {
      ctx = ctx || {};
      var self = ctx.self || ctx.position || { x: 0, z: 0 };
      var target = ctx.target || ctx.enemy || null;
      var dist = 999;
      if (target) {
        dist =
          ctx.dist != null
            ? ctx.dist
            : Math.hypot((target.x || 0) - self.x, (target.z || 0) - self.z);
      }
      var combat = brain.combat;
      var senses = brain.senses;
      var enemyKnown =
        !!target &&
        (dist <= senses.visionRange || dist <= senses.hearRange || !!ctx.memory);
      var enemyInRange = !!target && dist <= combat.maxRange;
      var enemyTooClose =
        !!target && dist < combat.preferredRange * 0.45 && brain.archetype !== "melee";
      var hpPct = ctx.hpPct != null ? ctx.hpPct : ctx.hp != null && ctx.maxHp ? ctx.hp / ctx.maxHp : 1;

      if (!home) home = { x: self.x, z: self.z };
      if (ctx.home) home = { x: ctx.home.x, z: ctx.home.z };

      return {
        self: self,
        target: target,
        dist: dist,
        hpPct: hpPct,
        enemyKnown: enemyKnown,
        enemyInRange: enemyInRange,
        enemyTooClose: enemyTooClose,
        attackReady: attackCd <= 0,
        time: ctx.time != null ? ctx.time : 0,
        seed: seed,
        home: home,
        patrolRadius: ctx.patrolRadius != null ? ctx.patrolRadius : 6,
      };
    }

    function think(ctx) {
      var c = buildCtx(ctx);
      var goal = pickGoal(brain, c);
      c.goalId = goal.id;
      var intent = actionToIntent(goal.action, brain, c);
      intent.goalId = goal.id;
      intent.brainId = brain.id;
      intent.unitId = opts.unitId || brain.unitId;
      intent.team = opts.team || "a";
      intent.damage = brain.combat.damage;
      intent.classHint = brain.classHint;
      lastIntent = intent;
      return intent;
    }

    function tick(dt, ctx) {
      dt = dt || 0.016;
      attackCd = Math.max(0, attackCd - dt);
      accum += dt;
      if (accum < interval && lastIntent) {
        // still return last; fire only on think frames
        var held = Object.assign({}, lastIntent, { fire: false });
        return held;
      }
      accum = 0;
      var intent = think(ctx);
      if (intent.fire) {
        attackCd = brain.combat.attackCooldown || 1;
      }
      return intent;
    }

    /** Apply intent anim to a loaded unit root (if playClip exists). */
    function applyAnim(root, intent) {
      if (!root || !intent || !root.userData) return;
      var name = intent.anim || "idle";
      if (root.userData.currentAnim === name && name !== "attack") return;
      if (typeof root.userData.playClip === "function") {
        root.userData.playClip(name, name === "attack" ? 0.08 : 0.15);
      }
    }

    return {
      brain: brain,
      think: think,
      tick: tick,
      applyAnim: applyAnim,
      getLastIntent: function () {
        return lastIntent;
      },
      setHome: function (x, z) {
        home = { x: x, z: z };
      },
      resetAttackCd: function () {
        attackCd = 0;
      },
    };
  }

  /** Map brain archetype → VoxAIBrain / enemy-brain behaviour string. */
  function toVoxBehavior(brain) {
    var a = archetypeOf(brain);
    if (a === "ranged") return "spitter";
    if (a === "magic") return "poison";
    if (a === "civilian" || a === "animal") return "wildlife";
    return "chase";
  }

  /**
   * Bridge: attach agent to a live entity for openworld/z-brawl.
   * entity needs mesh.position; optional hp/maxHp.
   */
  function updateTvsEntity(entity, dt, ctx) {
    if (!entity) return null;
    var agent = entity.aiAgent || entity.userData && entity.userData.aiAgent;
    if (!agent) return null;
    var mesh = entity.mesh || entity;
    var pos = mesh.position || { x: 0, y: 0, z: 0 };
    var intent = agent.tick(dt, {
      self: { x: pos.x, z: pos.z },
      target: ctx && ctx.target,
      enemy: ctx && (ctx.enemy || ctx.playerPos),
      hp: entity.hp,
      maxHp: entity.maxHp,
      hpPct: entity.maxHp ? entity.hp / entity.maxHp : 1,
      time: ctx && ctx.time,
      home: entity.home || (entity.homeX != null ? { x: entity.homeX, z: entity.homeZ } : null),
      patrolRadius: entity.patrolRadius,
    });
    if (intent.moveDir && intent.speed > 0 && mesh.position) {
      mesh.position.x += intent.moveDir.x * intent.speed * dt;
      mesh.position.z += intent.moveDir.z * intent.speed * dt;
      if (intent.face && mesh.rotation) {
        mesh.rotation.y = Math.atan2(intent.face.x, intent.face.z);
      }
    }
    if (mesh.userData) agent.applyAnim(mesh, intent);
    entity.lastIntent = intent;
    return intent;
  }

  async function loadFromUnit(unit, opts) {
    opts = opts || {};
    if (!unit) throw new Error("[TvsAiBrain] unit required");
    var url = unit.brainUrl || unit.brainR2Key;
    if (!url && unit.unitId && unit.pack) {
      url =
        CDN +
        "/models/voxels/tvs/" +
        unit.pack +
        "/characters/" +
        unit.unitId +
        ".brain.json";
    }
    var brain = url ? await load(url) : mergeBrain({ archetype: unit.classHint || "melee", unitId: unit.unitId });
    var agent = createAgent(brain, {
      unitId: unit.unitId,
      team: opts.team || "a",
      home: opts.home,
    });
    return { brain: brain, agent: agent };
  }

  var api = {
    CDN: CDN,
    ARCHETYPE_DEFAULTS: ARCHETYPE_DEFAULTS,
    mergeBrain: mergeBrain,
    load: load,
    createAgent: createAgent,
    toVoxBehavior: toVoxBehavior,
    updateTvsEntity: updateTvsEntity,
    loadFromUnit: loadFromUnit,
    archetypeOf: archetypeOf,
  };

  global.TvsAiBrain = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
