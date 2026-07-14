/**
 * Carrier — authoritative room for `/api/carrier`.
 * Wire protocol matches `@workspace/carrier-net` (join / input / fire / missile).
 *
 * Features:
 *  - Fighter + mothership per player
 *  - Primary bolts (LMB) + homing missiles (RMB)
 *  - AI hostiles for PvE pressure
 *  - Shield soak + hull damage
 *  - Optional Discord webhook on join/kill (DISCORD_WEBHOOK_URL or CARRIER_WEBHOOK_URL)
 */

import { randomUUID } from "crypto";

const TICK_HZ = 30;
const SNAPSHOT_HZ = 20;
const TICK_DT = 1 / TICK_HZ;
const ARENA = 12000;

const SHIP = {
  yawRate: 1.6,
  pitchRate: 1.4,
  rollRate: 2.4,
  thrustAccel: 90,
  maxSpeed: 90,
  boostMaxSpeed: 160,
  boostMult: 1.8,
  drag: 0.7,
  maxHp: 100,
  maxShield: 60,
  respawnDelay: 3000,
};

const MOTHER = {
  yawRate: 0.35,
  pitchRate: 0.22,
  rollRate: 0.4,
  thrustAccel: 22,
  maxSpeed: 28,
  boostMaxSpeed: 42,
  boostMult: 1.35,
  drag: 0.55,
  maxHp: 2200,
  maxShield: 1200,
  respawnDelay: 10000,
  turretRange: 950,
  turretCdMs: 900,
  turretDamage: 16,
  turretSpeed: 380,
};

const WEAPON = {
  cooldownMs: 160,
  projectileSpeed: 360,
  projectileLifeMs: 1500,
  damage: 14,
  hitRadius: 11,
  muzzleForward: 8,
};

const MISSILE = {
  cooldownMs: 950,
  projectileSpeed: 210,
  projectileLifeMs: 4500,
  damage: 42,
  hitRadius: 18,
  muzzleForward: 12,
  homingStrength: 4.8,
  splashRadius: 48,
};

const SHIELD = { regenPerSec: 16, regenDelayMs: 3500 };
const FACTIONS = ["network", "scavengers", "hollow", "brood", "prospector"];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function clamp1(v) {
  return clamp(v, -1, 1);
}
function forwardVec(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
}
function len3(x, y, z) {
  return Math.hypot(x, y, z);
}

function tunables(kind) {
  if (kind === "mother_ship") return MOTHER;
  return SHIP;
}

function stepShip(s, cmd, dt) {
  if (!s.alive || dt <= 0) {
    s.boost = false;
    return;
  }
  s.boost = !!cmd.boost;
  const T = tunables(s.kind);
  s.yaw += clamp1(cmd.yaw) * T.yawRate * dt;
  s.pitch += clamp1(cmd.pitch) * T.pitchRate * dt;
  s.pitch = clamp(s.pitch, -1.3, 1.3);
  s.roll += clamp1(cmd.roll) * T.rollRate * dt;
  s.roll += (0 - s.roll) * Math.min(1, 2 * dt) * (cmd.roll === 0 ? 1 : 0.15);
  if (s.yaw > Math.PI) s.yaw -= 2 * Math.PI;
  else if (s.yaw < -Math.PI) s.yaw += 2 * Math.PI;

  const [fx, fy, fz] = forwardVec(s.yaw, s.pitch);
  const thrust = clamp1(cmd.thrust);
  const accel = T.thrustAccel * (cmd.boost ? T.boostMult : 1);
  s.vx += fx * thrust * accel * dt;
  s.vy += fy * thrust * accel * dt;
  s.vz += fz * thrust * accel * dt;

  const keep = Math.pow(T.drag, dt);
  s.vx *= keep;
  s.vy *= keep;
  s.vz *= keep;

  const cap = cmd.boost ? T.boostMaxSpeed : T.maxSpeed;
  const sp = len3(s.vx, s.vy, s.vz);
  if (sp > cap) {
    const k = cap / sp;
    s.vx *= k;
    s.vy *= k;
    s.vz *= k;
  }

  s.px += s.vx * dt;
  s.py += s.vy * dt;
  s.pz += s.vz * dt;
  const a = ARENA;
  s.px = clamp(s.px, -a, a);
  s.py = clamp(s.py, -a, a);
  s.pz = clamp(s.pz, -a, a);
}

function makeEntity({ id, uid, name, kind, owner, team, shipType, faction, px, py, pz, yaw }) {
  const T = tunables(kind);
  const maxHp = T.maxHp;
  const maxShield = T.maxShield;
  return {
    id,
    uid: uid || randomUUID(),
    name,
    shipType: shipType | 0,
    kind,
    faction: FACTIONS.includes(faction) ? faction : "network",
    owner,
    team: team | 0,
    px,
    py,
    pz,
    yaw,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    hp: maxHp,
    maxHp,
    shield: maxShield,
    maxShield,
    alive: true,
    respawnAt: 0,
    kills: 0,
    deaths: 0,
    role: "none",
    zoneX: px,
    zoneY: py,
    zoneZ: pz,
    zoneR: 0,
    boost: false,
    _lastDamageAt: 0,
  };
}

async function postWebhook(payload) {
  const url = process.env.CARRIER_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[carrier-room] webhook failed", e?.message || e);
  }
}

export class CarrierRoom {
  constructor() {
    this.players = new Map();
    this.entities = new Map();
    this.projectiles = [];
    this.events = [];
    this.celestials = this.seedCelestials();
    this.nextId = 1;
    this.nextProj = 1;
    this.startedAt = Date.now();
    this.tickTimer = null;
    this.snapTimer = null;
    this.aiSeeded = false;
  }

  seedCelestials() {
    // Sparse rock field for map/nav context
    const rocks = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 1800 + (i % 5) * 900;
      rocks.push({
        id: `rock-${i}`,
        kind: "asteroid",
        px: Math.cos(a) * r,
        py: ((i % 3) - 1) * 120,
        pz: Math.sin(a) * r,
        radius: 40 + (i % 4) * 18,
        hp: 500,
        maxHp: 500,
      });
    }
    rocks.push({
      id: "planet-core",
      kind: "planet",
      px: 0,
      py: -200,
      pz: -4200,
      radius: 380,
      hp: 99999,
      maxHp: 99999,
    });
    return rocks;
  }

  start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000 / TICK_HZ);
    this.snapTimer = setInterval(() => this.broadcast(), 1000 / SNAPSHOT_HZ);
    this.ensureAiHostiles();
    console.log(`[carrier-room] started arena=${ARENA * 2} combat+missiles`);
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.snapTimer) clearInterval(this.snapTimer);
    this.tickTimer = null;
    this.snapTimer = null;
  }

  playerCount() {
    return this.players.size;
  }

  now() {
    return Date.now();
  }

  ensureAiHostiles() {
    if (this.aiSeeded) return;
    this.aiSeeded = true;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 900 + i * 180;
      const id = `ai_${i}`;
      this.entities.set(
        id,
        makeEntity({
          id,
          name: `Raider ${i + 1}`,
          kind: "fighter",
          owner: "ai",
          team: 9,
          shipType: 1 + (i % 4),
          faction: "hollow",
          px: Math.cos(a) * r,
          py: (i % 3) * 40,
          pz: Math.sin(a) * r,
          yaw: a + Math.PI,
        }),
      );
    }
  }

  add(send) {
    const id = `p${this.nextId++}`;
    const sp = {
      px: (Math.random() - 0.5) * 600,
      py: 40,
      pz: (Math.random() - 0.5) * 600,
      yaw: Math.random() * Math.PI * 2,
    };
    const motherId = `${id}_m`;
    const fighter = makeEntity({
      id,
      name: id,
      kind: "fighter",
      owner: id,
      team: this.players.size % 4,
      shipType: 1,
      faction: "network",
      ...sp,
    });
    const mother = makeEntity({
      id: motherId,
      name: `${id}-MS`,
      kind: "mother_ship",
      owner: id,
      team: fighter.team,
      shipType: 0,
      faction: "network",
      px: sp.px - 120,
      py: sp.py + 30,
      pz: sp.pz - 80,
      yaw: sp.yaw,
    });
    this.entities.set(id, fighter);
    this.entities.set(motherId, mother);
    this.players.set(id, {
      id,
      send,
      controlledEntityId: id,
      motherShipId: motherId,
      joined: false,
      lastSeq: 0,
      credits: 250,
      fireAt: 0,
      missileAt: 0,
      turretAt: 0,
      queue: [],
    });
    send(
      JSON.stringify({
        t: "welcome",
        id,
        serverTime: Date.now() - this.startedAt,
        tickHz: TICK_HZ,
        snapshotHz: SNAPSHOT_HZ,
      }),
    );
    console.log(`[carrier-room] join ${id} players=${this.players.size}`);
    return id;
  }

  remove(id) {
    if (!this.players.delete(id)) return;
    for (const [eid, e] of this.entities) {
      if (e.owner === id) this.entities.delete(eid);
    }
    console.log(`[carrier-room] leave ${id} players=${this.players.size}`);
  }

  handleMessage(id, raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;
    const p = this.players.get(id);
    if (!p) return;

    if (msg.t === "join") {
      this.setIdentity(id, msg.name, msg.shipType, msg.faction);
    } else if (msg.t === "input" && msg.cmd) {
      this.enqueue(id, msg.cmd);
    } else if (msg.t === "become" && typeof msg.entityId === "string") {
      const e = this.entities.get(msg.entityId);
      if (e && e.owner === id) p.controlledEntityId = msg.entityId;
    } else if (msg.t === "navigate" && Number.isFinite(msg.tx) && Number.isFinite(msg.tz)) {
      p.navTarget = {
        tx: clamp(msg.tx, -ARENA, ARENA),
        ty: Number.isFinite(msg.ty) ? msg.ty : 0,
        tz: clamp(msg.tz, -ARENA, ARENA),
        celestialId: typeof msg.celestialId === "string" ? msg.celestialId : null,
      };
    } else if (msg.t === "deploy" || msg.t === "summon" || msg.t === "build" || msg.t === "produce") {
      // Acknowledged no-ops for now — keeps client happy without poisoning state.
      p.credits = Math.max(0, p.credits);
    }
  }

  setIdentity(id, name, shipType, faction) {
    const p = this.players.get(id);
    if (!p) return;
    const fighter = this.entities.get(id);
    const mother = this.entities.get(p.motherShipId);
    const fac = FACTIONS.includes(faction) ? faction : "network";
    const st = Math.max(0, Math.min(5, shipType | 0));
    if (fighter) {
      fighter.name = String(name || id).slice(0, 18);
      fighter.shipType = st || 1;
      fighter.faction = fac;
    }
    if (mother) {
      mother.name = `${fighter?.name || id} · Carrier`;
      mother.shipType = st;
      mother.faction = fac;
    }
    p.joined = true;
    void postWebhook({
      content: `🚀 **Carrier** — \`${fighter?.name || id}\` joined the sector (${fac}).`,
    });
  }

  enqueue(id, cmd) {
    const p = this.players.get(id);
    if (!p || !cmd) return;
    if (!Number.isFinite(cmd.seq) || cmd.seq <= p.lastSeq) return;
    p.queue.push({
      seq: cmd.seq | 0,
      dt: Number.isFinite(cmd.dt) ? Math.min(0.1, Math.max(0, cmd.dt)) : TICK_DT,
      thrust: clamp1(+cmd.thrust || 0),
      yaw: clamp1(+cmd.yaw || 0),
      pitch: clamp1(+cmd.pitch || 0),
      roll: clamp1(+cmd.roll || 0),
      boost: !!cmd.boost,
      fire: !!cmd.fire,
      missile: !!cmd.missile,
    });
    if (p.queue.length > 32) p.queue.shift();
  }

  tick() {
    const now = this.now();

    // Respawn
    for (const e of this.entities.values()) {
      if (!e.alive && now >= e.respawnAt) {
        e.alive = true;
        e.hp = e.maxHp;
        e.shield = e.maxShield;
        e.vx = e.vy = e.vz = 0;
        e.px += (Math.random() - 0.5) * 200;
        e.py = 40 + Math.random() * 40;
        e.pz += (Math.random() - 0.5) * 200;
        e.respawnAt = 0;
      }
      // Shield regen
      if (e.alive && e.shield < e.maxShield && now - e._lastDamageAt > SHIELD.regenDelayMs) {
        e.shield = Math.min(e.maxShield, e.shield + SHIELD.regenPerSec * TICK_DT);
      }
    }

    // Player input + weapons
    for (const p of this.players.values()) {
      if (!p.joined) continue;
      const ent = this.entities.get(p.controlledEntityId);
      if (!ent || !ent.alive) continue;

      let cmd = {
        seq: p.lastSeq,
        dt: TICK_DT,
        thrust: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
        boost: false,
        fire: false,
        missile: false,
      };
      if (p.queue.length) {
        cmd = p.queue.shift();
        p.lastSeq = cmd.seq;
      }
      stepShip(ent, cmd, TICK_DT);

      if (cmd.fire) this.tryFire(p, ent, now, false);
      if (cmd.missile) this.tryFire(p, ent, now, true);

      // Mothership auto-turrets
      const mother = this.entities.get(p.motherShipId);
      if (mother?.alive) this.stepMotherTurret(p, mother, now);

      // Nav mothership gently toward course
      if (p.navTarget && mother?.alive) {
        const dx = p.navTarget.tx - mother.px;
        const dz = p.navTarget.tz - mother.pz;
        const dy = p.navTarget.ty - mother.py;
        const dist = len3(dx, dy, dz);
        if (dist > 80) {
          const inv = 1 / dist;
          mother.vx += dx * inv * 8 * TICK_DT;
          mother.vy += dy * inv * 4 * TICK_DT;
          mother.vz += dz * inv * 8 * TICK_DT;
          mother.yaw = Math.atan2(dx, dz);
          stepShip(
            mother,
            {
              seq: 0,
              dt: TICK_DT,
              thrust: 0.6,
              yaw: 0,
              pitch: 0,
              roll: 0,
              boost: false,
              fire: false,
              missile: false,
            },
            TICK_DT,
          );
        }
      }

      // Credits trickle while boosting / combat
      if (cmd.boost || cmd.fire || cmd.missile) p.credits += 1.2 * TICK_DT;
    }

    // AI hostiles: hunt nearest player fighter
    for (const e of this.entities.values()) {
      if (e.owner !== "ai" || !e.alive) continue;
      let target = null;
      let best = Infinity;
      for (const p of this.players.values()) {
        if (!p.joined) continue;
        const t = this.entities.get(p.controlledEntityId);
        if (!t?.alive) continue;
        const d = len3(t.px - e.px, t.py - e.py, t.pz - e.pz);
        if (d < best) {
          best = d;
          target = t;
        }
      }
      if (!target) continue;
      const dx = target.px - e.px;
      const dy = target.py - e.py;
      const dz = target.pz - e.pz;
      const dist = len3(dx, dy, dz) || 1;
      const yaw = Math.atan2(dx, dz);
      const pitch = Math.asin(clamp(dy / dist, -0.9, 0.9));
      let yawCmd = yaw - e.yaw;
      while (yawCmd > Math.PI) yawCmd -= 2 * Math.PI;
      while (yawCmd < -Math.PI) yawCmd += 2 * Math.PI;
      const pitchCmd = pitch - e.pitch;
      stepShip(
        e,
        {
          seq: 0,
          dt: TICK_DT,
          thrust: dist > 180 ? 1 : 0.35,
          yaw: clamp1(yawCmd * 2),
          pitch: clamp1(pitchCmd * 2),
          roll: 0,
          boost: dist > 700,
          fire: false,
          missile: false,
        },
        TICK_DT,
      );
      if (dist < 520 && Math.random() < 0.04) {
        this.spawnProjectile(e, false, now);
      }
      if (dist < 700 && Math.random() < 0.008) {
        this.spawnProjectile(e, true, now, target.id);
      }
    }

    this.stepProjectiles(now);
  }

  tryFire(p, ent, now, isMissile) {
    const cd = isMissile ? MISSILE.cooldownMs : WEAPON.cooldownMs;
    const last = isMissile ? p.missileAt : p.fireAt;
    if (now - last < cd) return;
    if (isMissile) p.missileAt = now;
    else p.fireAt = now;

    let targetId = null;
    if (isMissile) {
      let best = 900;
      for (const t of this.entities.values()) {
        if (!t.alive || t.owner === p.id || t.team === ent.team) continue;
        const d = len3(t.px - ent.px, t.py - ent.py, t.pz - ent.pz);
        if (d < best) {
          best = d;
          targetId = t.id;
        }
      }
    }
    this.spawnProjectile(ent, isMissile, now, targetId);
  }

  spawnProjectile(ent, isMissile, now, targetId = null) {
    const W = isMissile ? MISSILE : WEAPON;
    const [fx, fy, fz] = forwardVec(ent.yaw, ent.pitch);
    const mx = ent.px + fx * W.muzzleForward;
    const my = ent.py + fy * W.muzzleForward;
    const mz = ent.pz + fz * W.muzzleForward;
    const sp = W.projectileSpeed;
    this.projectiles.push({
      id: this.nextProj++,
      owner: ent.id,
      ownerPlayer: ent.owner,
      team: ent.team,
      px: mx,
      py: my,
      pz: mz,
      vx: fx * sp + ent.vx * 0.25,
      vy: fy * sp + ent.vy * 0.25,
      vz: fz * sp + ent.vz * 0.25,
      dieAt: now + W.projectileLifeMs,
      damage: W.damage,
      hitRadius: W.hitRadius,
      kind: isMissile ? "missile" : "bolt",
      targetId,
      splash: isMissile ? MISSILE.splashRadius : 0,
    });
    this.events.push({ k: "fire", px: mx, py: my, pz: mz });
  }

  stepMotherTurret(p, mother, now) {
    if (now - p.turretAt < MOTHER.turretCdMs) return;
    let nearest = null;
    let best = MOTHER.turretRange;
    for (const t of this.entities.values()) {
      if (!t.alive || t.owner === p.id || t.team === mother.team) continue;
      const d = len3(t.px - mother.px, t.py - mother.py, t.pz - mother.pz);
      if (d < best) {
        best = d;
        nearest = t;
      }
    }
    if (!nearest) return;
    p.turretAt = now;
    const dx = nearest.px - mother.px;
    const dy = nearest.py - mother.py;
    const dz = nearest.pz - mother.pz;
    const dist = len3(dx, dy, dz) || 1;
    const inv = 1 / dist;
    const sp = MOTHER.turretSpeed;
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const ox = Math.cos(ang) * 70;
      const oz = Math.sin(ang) * 70;
      this.projectiles.push({
        id: this.nextProj++,
        owner: mother.id,
        ownerPlayer: p.id,
        team: mother.team,
        px: mother.px + ox,
        py: mother.py + 20,
        pz: mother.pz + oz,
        vx: dx * inv * sp,
        vy: dy * inv * sp,
        vz: dz * inv * sp,
        dieAt: now + 2200,
        damage: MOTHER.turretDamage,
        hitRadius: 14,
        kind: "bolt",
        targetId: null,
        splash: 0,
      });
    }
  }

  stepProjectiles(now) {
    const alive = [];
    for (const pr of this.projectiles) {
      if (now >= pr.dieAt) continue;

      // Homing
      if (pr.kind === "missile" && pr.targetId) {
        const t = this.entities.get(pr.targetId);
        if (t?.alive) {
          const dx = t.px - pr.px;
          const dy = t.py - pr.py;
          const dz = t.pz - pr.pz;
          const dist = len3(dx, dy, dz) || 1;
          const inv = 1 / dist;
          const desiredVx = dx * inv * MISSILE.projectileSpeed;
          const desiredVy = dy * inv * MISSILE.projectileSpeed;
          const desiredVz = dz * inv * MISSILE.projectileSpeed;
          const k = Math.min(1, MISSILE.homingStrength * TICK_DT);
          pr.vx += (desiredVx - pr.vx) * k;
          pr.vy += (desiredVy - pr.vy) * k;
          pr.vz += (desiredVz - pr.vz) * k;
        }
      }

      pr.px += pr.vx * TICK_DT;
      pr.py += pr.vy * TICK_DT;
      pr.pz += pr.vz * TICK_DT;
      if (Math.abs(pr.px) > ARENA || Math.abs(pr.py) > ARENA || Math.abs(pr.pz) > ARENA) continue;

      let hit = false;
      for (const target of this.entities.values()) {
        if (!target.alive || target.id === pr.owner || target.team === pr.team) continue;
        const dx = target.px - pr.px;
        const dy = target.py - pr.py;
        const dz = target.pz - pr.pz;
        const r = pr.hitRadius;
        if (dx * dx + dy * dy + dz * dz <= r * r) {
          this.applyDamage(target, pr, now);
          this.events.push({ k: "hit", px: pr.px, py: pr.py, pz: pr.pz });
          if (pr.splash > 0) {
            for (const splash of this.entities.values()) {
              if (!splash.alive || splash.id === target.id || splash.team === pr.team) continue;
              const sx = splash.px - pr.px;
              const sy = splash.py - pr.py;
              const sz = splash.pz - pr.pz;
              if (sx * sx + sy * sy + sz * sz <= pr.splash * pr.splash) {
                this.applyDamage(splash, { ...pr, damage: pr.damage * 0.45 }, now);
              }
            }
            this.events.push({ k: "impact", px: pr.px, py: pr.py, pz: pr.pz });
          }
          hit = true;
          break;
        }
      }
      if (!hit) alive.push(pr);
    }
    this.projectiles = alive;
  }

  applyDamage(entity, pr, now) {
    let dmg = pr.damage;
    entity._lastDamageAt = now;
    if (entity.shield > 0) {
      const absorbed = Math.min(entity.shield, dmg);
      entity.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg <= 0) return;
    entity.hp -= dmg;
    if (entity.hp > 0) return;
    entity.hp = 0;
    entity.alive = false;
    entity.deaths += 1;
    entity.respawnAt = now + (entity.kind === "mother_ship" ? MOTHER.respawnDelay : SHIP.respawnDelay);
    entity.vx = entity.vy = entity.vz = 0;
    const attacker = this.entities.get(pr.owner);
    if (attacker && attacker.id !== entity.id) {
      attacker.kills += 1;
      const ownerPlayer = this.players.get(attacker.owner);
      if (ownerPlayer) ownerPlayer.credits += 35;
      void postWebhook({
        content: `💥 **Carrier combat** — \`${attacker.name}\` destroyed \`${entity.name}\`.`,
      });
    }
    this.events.push({ k: "explode", px: entity.px, py: entity.py, pz: entity.pz });
  }

  broadcast() {
    if (this.players.size === 0) {
      this.events = [];
      return;
    }
    const time = Date.now() - this.startedAt;
    const entities = [...this.entities.values()].map((e) => ({
      id: e.id,
      uid: e.uid,
      name: e.name,
      shipType: e.shipType,
      kind: e.kind,
      faction: e.faction,
      owner: e.owner,
      team: e.team,
      px: e.px,
      py: e.py,
      pz: e.pz,
      yaw: e.yaw,
      pitch: e.pitch,
      roll: e.roll,
      vx: e.vx,
      vy: e.vy,
      vz: e.vz,
      hp: e.hp,
      maxHp: e.maxHp,
      shield: e.shield,
      maxShield: e.maxShield,
      alive: e.alive,
      respawnAt: e.respawnAt,
      kills: e.kills,
      deaths: e.deaths,
      role: e.role,
      zoneX: e.zoneX,
      zoneY: e.zoneY,
      zoneZ: e.zoneZ,
      zoneR: e.zoneR,
      boost: e.boost,
    }));

    const projectiles = this.projectiles.map((pr) => ({
      id: pr.id,
      owner: pr.owner,
      px: pr.px,
      py: pr.py,
      pz: pr.pz,
      vx: pr.vx,
      vy: pr.vy,
      vz: pr.vz,
      kind: pr.kind,
    }));

    const economy = [];
    for (const p of this.players.values()) {
      if (!p.joined) continue;
      economy.push({
        playerId: p.id,
        controlledEntityId: p.controlledEntityId,
        motherShipId: p.motherShipId,
        credits: Math.floor(p.credits),
        navTarget: p.navTarget || null,
        claimedRockId: null,
        produceProgress: 0,
        atRockNode: false,
      });
    }

    const events = this.events;
    const payloadBase = {
      t: "snapshot",
      time,
      entities,
      projectiles,
      events,
      economy,
      celestials: this.celestials,
      rewards: [],
      outposts: [],
      beams: [],
      platforms: [],
    };

    for (const p of this.players.values()) {
      try {
        p.send(JSON.stringify({ ...payloadBase, ack: p.lastSeq }));
      } catch {
        /* dead socket */
      }
    }
    this.events = [];
  }
}

let room = null;
export function getCarrierRoom() {
  if (!room) {
    room = new CarrierRoom();
    room.start();
  }
  return room;
}
