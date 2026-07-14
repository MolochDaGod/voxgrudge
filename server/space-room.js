/**
 * Live Waters PvP — authoritative room for `/api/space`.
 * Wire protocol matches `@workspace/space-net` used by the arcade waters client.
 *
 * Arena is 10× the original (half-extent 6000). Naval ships stay on y≈0.
 */

const TICK_HZ = 30;
const SNAPSHOT_HZ = 20;
const TICK_DT = 1 / TICK_HZ;

/** Half-extent of the sea (matches client SHIP.arena). */
const ARENA = 6000;

const CARRIER = {
  courseMaxSpeed: 80,
  courseTurnRate: 0.55,
  thrustAccel: 35,
  drag: 0.55,
  arrivalRadius: 250,
  creditRatePerSec: 5,
  creditMoveThreshold: 1.0,
  turretRange: 1000,
  turretCooldownMs: 550,
  turretDamage: 18,
  turretProjectileSpeed: 450,
  turretProjectileLifeMs: 3500,
  numTurrets: 4,
};

const RESPAWN_MS = 10000;
const PLAYER_MUZZLE_FORWARD = 80;
const PLAYER_MUZZLE_UP = 14;
const HIT_RADIUS_DEFAULT = 12;

const SHIP_CLASSES = [
  { id: "vanguard", name: "Vanguard", maxHp: 2400 },
  { id: "prospector", name: "Prospector", maxHp: 1400 },
  { id: "citadel", name: "Citadel", maxHp: 4000 },
  { id: "phantom", name: "Phantom", maxHp: 1200 },
  { id: "brood_mother", name: "Brood Mother", maxHp: 1600 },
  { id: "siege_king", name: "Siege King", maxHp: 2800 },
];

const WEAPONS = [
  { cooldownMs: 480, projectileSpeed: 280, lifeMs: 2200, damage: 32, pellets: 1, spread: 0, hitRadius: 12 },
  { cooldownMs: 120, projectileSpeed: 360, lifeMs: 1500, damage: 9, pellets: 1, spread: 0, hitRadius: 9 },
  { cooldownMs: 900, projectileSpeed: 220, lifeMs: 2800, damage: 70, pellets: 1, spread: 0, hitRadius: 18 },
  { cooldownMs: 700, projectileSpeed: 300, lifeMs: 1800, damage: 18, pellets: 5, spread: 0.18, hitRadius: 10 },
  { cooldownMs: 1100, projectileSpeed: 400, lifeMs: 2400, damage: 55, pellets: 1, spread: 0, hitRadius: 14 },
];

const UPGRADES = {
  hull: { maxLevel: 5, baseCost: 80, costMult: 1.45, step: 0.12 },
  damage: { maxLevel: 5, baseCost: 70, costMult: 1.45, step: 0.15 },
  reload: { maxLevel: 5, baseCost: 70, costMult: 1.45, step: 0.1 },
  range: { maxLevel: 5, baseCost: 70, costMult: 1.45, step: 0.12 },
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function emptyUpgrades() {
  return { hull: 0, damage: 0, reload: 0, range: 0 };
}

function upgradeMultiplier(id, level) {
  const def = UPGRADES[id];
  if (!def) return 1;
  return 1 + def.step * Math.max(0, level | 0);
}

function upgradeCost(id, level) {
  const def = UPGRADES[id];
  if (!def || level >= def.maxLevel) return Infinity;
  return Math.round(def.baseCost * Math.pow(def.costMult, level));
}

function getClass(shipType) {
  const i = Math.max(0, Math.min(SHIP_CLASSES.length - 1, shipType | 0));
  return SHIP_CLASSES[i];
}

function getWeapon(slot) {
  const i = Math.max(0, Math.min(WEAPONS.length - 1, slot | 0));
  return WEAPONS[i];
}

function forwardVec(yaw) {
  return [Math.sin(yaw), 0, Math.cos(yaw)];
}

function randSpawn() {
  const r = ARENA * 0.45;
  return {
    px: (Math.random() * 2 - 1) * r,
    py: 0,
    pz: (Math.random() * 2 - 1) * r,
    yaw: Math.random() * Math.PI * 2,
  };
}

function clampCourse(v) {
  const limit = ARENA - 400;
  return clamp(v, -limit, limit);
}

function makeEntity(id, name, shipType, sp) {
  const cls = getClass(shipType);
  return {
    id,
    name: name || id,
    kind: "mother_ship",
    owner: id,
    team: 0,
    shipType: Math.max(0, Math.min(5, shipType | 0)),
    px: sp.px,
    py: 0,
    pz: sp.pz,
    yaw: sp.yaw,
    pitch: 0,
    roll: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    hp: cls.maxHp,
    maxHp: cls.maxHp,
    alive: true,
    kills: 0,
    deaths: 0,
    respawnAt: 0,
    hasCourse: false,
    courseTx: 0,
    courseTz: 0,
  };
}

function stepMotherShipCourse(s, dt) {
  if (!s.alive || !s.hasCourse) return;
  s.py = 0;
  s.vy = 0;

  const dx = s.courseTx - s.px;
  const dz = s.courseTz - s.pz;
  const dist = Math.hypot(dx, dz);

  if (dist < CARRIER.arrivalRadius) {
    s.hasCourse = false;
    const keepStop = Math.pow(CARRIER.drag * 0.7, dt);
    s.vx *= keepStop;
    s.vz *= keepStop;
    s.px += s.vx * dt;
    s.pz += s.vz * dt;
    s.px = clamp(s.px, -ARENA, ARENA);
    s.pz = clamp(s.pz, -ARENA, ARENA);
    return;
  }

  const targetYaw = Math.atan2(dx, dz);
  let yawDiff = targetYaw - s.yaw;
  while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
  while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;

  const maxTurn = CARRIER.courseTurnRate * dt;
  s.yaw += clamp(yawDiff, -maxTurn, maxTurn);
  if (s.yaw > Math.PI) s.yaw -= 2 * Math.PI;
  else if (s.yaw < -Math.PI) s.yaw += 2 * Math.PI;

  if (Math.abs(yawDiff) < Math.PI / 3) {
    const [fx, , fz] = forwardVec(s.yaw);
    s.vx += fx * CARRIER.thrustAccel * dt;
    s.vz += fz * CARRIER.thrustAccel * dt;
  }

  const keep = Math.pow(CARRIER.drag, dt);
  s.vx *= keep;
  s.vz *= keep;
  const sp = Math.hypot(s.vx, s.vz);
  if (sp > CARRIER.courseMaxSpeed) {
    const k = CARRIER.courseMaxSpeed / sp;
    s.vx *= k;
    s.vz *= k;
  }

  s.px += s.vx * dt;
  s.pz += s.vz * dt;
  s.px = clamp(s.px, -ARENA, ARENA);
  s.pz = clamp(s.pz, -ARENA, ARENA);
  s.pitch += (0 - s.pitch) * Math.min(1, 3 * dt);
  s.roll += (0 - s.roll) * Math.min(1, 2 * dt);
}

function turretOffsets(entity) {
  const r = 70;
  const cy = Math.cos(entity.yaw);
  const sy = Math.sin(entity.yaw);
  return [
    [r, r],
    [-r, r],
    [r, -r],
    [-r, -r],
  ].map(([lx, lz]) => [lx * cy - lz * sy, 12, lx * sy + lz * cy]);
}

export class SpaceRoom {
  constructor() {
    this.players = new Map();
    this.entities = new Map();
    this.projectiles = [];
    this.events = [];
    this.nextId = 1;
    this.nextProjId = 1;
    this.startedAt = Date.now();
    this.tickTimer = null;
    this.snapTimer = null;
  }

  start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => this.tick(), 1000 / TICK_HZ);
    this.snapTimer = setInterval(() => this.broadcast(), 1000 / SNAPSHOT_HZ);
    console.log(`[space-room] started arena=${ARENA * 2} tick=${TICK_HZ} snap=${SNAPSHOT_HZ}`);
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.snapTimer) clearInterval(this.snapTimer);
    this.tickTimer = null;
    this.snapTimer = null;
  }

  now() {
    return Date.now();
  }

  playerCount() {
    return this.players.size;
  }

  add(send) {
    const id = `p${this.nextId++}`;
    const sp = randSpawn();
    const entity = makeEntity(id, id, 0, sp);
    this.entities.set(id, entity);
    this.players.set(id, {
      id,
      send,
      controlledEntityId: id,
      joined: false,
      credits: 0,
      turretLastFireAt: 0,
      weapon: 0,
      upgrades: emptyUpgrades(),
      weaponLastFireAt: 0,
      lastSeq: 0,
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
    console.log(`[space-room] join ${id} players=${this.players.size}`);
    return id;
  }

  remove(id) {
    if (!this.players.delete(id)) return;
    this.entities.delete(id);
    console.log(`[space-room] leave ${id} players=${this.players.size}`);
  }

  handleMessage(id, raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg.t !== "string") return;

    if (msg.t === "join") {
      this.setIdentity(id, msg.name, msg.shipType);
    } else if (msg.t === "course") {
      this.setCourse(id, msg.tx, msg.tz);
    } else if (msg.t === "fire") {
      this.fireWeapon(id);
    } else if (msg.t === "weapon") {
      this.selectWeapon(id, msg.w);
    } else if (msg.t === "upgrade") {
      this.buyUpgrade(id, msg.id);
    } else if (msg.t === "input" && msg.cmd) {
      const p = this.players.get(id);
      if (p && Number.isFinite(msg.cmd.seq) && msg.cmd.seq > p.lastSeq) {
        p.lastSeq = msg.cmd.seq;
      }
    }
  }

  setIdentity(id, name, shipType) {
    const p = this.players.get(id);
    if (!p) return;
    const entity = this.entities.get(p.controlledEntityId);
    if (!entity) return;
    const cls = getClass(shipType);
    entity.name = String(name || id).slice(0, 16);
    entity.shipType = Math.max(0, Math.min(5, shipType | 0));
    entity.kind = "mother_ship";
    entity.maxHp = Math.round(cls.maxHp * upgradeMultiplier("hull", p.upgrades.hull));
    entity.hp = entity.maxHp;
    p.joined = true;
    console.log(`[space-room] identity ${id} name=${entity.name} class=${cls.id}`);
  }

  setCourse(id, rawTx, rawTz) {
    if (!Number.isFinite(rawTx) || !Number.isFinite(rawTz)) return;
    const p = this.players.get(id);
    if (!p || !p.joined) return;
    const entity = this.entities.get(p.controlledEntityId);
    if (!entity || !entity.alive) return;
    entity.hasCourse = true;
    entity.courseTx = clampCourse(rawTx);
    entity.courseTz = clampCourse(rawTz);
  }

  selectWeapon(id, w) {
    const p = this.players.get(id);
    if (!p || !Number.isFinite(w)) return;
    p.weapon = Math.max(0, Math.min(WEAPONS.length - 1, w | 0));
  }

  fireWeapon(id) {
    const p = this.players.get(id);
    if (!p || !p.joined) return;
    const entity = this.entities.get(p.controlledEntityId);
    if (!entity || !entity.alive) return;

    const now = this.now();
    const weapon = getWeapon(p.weapon);
    const cooldown = weapon.cooldownMs * upgradeMultiplier("reload", p.upgrades.reload);
    if (now - p.weaponLastFireAt < cooldown) return;
    p.weaponLastFireAt = now;

    const dmg = weapon.damage * upgradeMultiplier("damage", p.upgrades.damage);
    const rangeMul = upgradeMultiplier("range", p.upgrades.range);
    const speed = weapon.projectileSpeed * rangeMul;
    const life = weapon.lifeMs * rangeMul;
    const [fx, , fz] = forwardVec(entity.yaw);
    const mx = entity.px + fx * PLAYER_MUZZLE_FORWARD;
    const my = PLAYER_MUZZLE_UP;
    const mz = entity.pz + fz * PLAYER_MUZZLE_FORWARD;
    const pellets = Math.max(1, weapon.pellets | 0);

    for (let i = 0; i < pellets; i++) {
      const offset = pellets === 1 ? 0 : (i / (pellets - 1) - 0.5) * weapon.spread;
      const a = entity.yaw + offset;
      this.projectiles.push({
        id: this.nextProjId++,
        owner: entity.id,
        px: mx,
        py: my,
        pz: mz,
        vx: Math.sin(a) * speed,
        vy: 0,
        vz: Math.cos(a) * speed,
        dieAt: now + life,
        damage: dmg,
        hitRadius: weapon.hitRadius,
      });
    }
    this.events.push({ k: "fire", px: mx, py: my, pz: mz });
  }

  buyUpgrade(id, upgradeId) {
    const p = this.players.get(id);
    if (!p || !p.joined) return;
    const def = UPGRADES[upgradeId];
    if (!def) return;
    const current = p.upgrades[upgradeId] ?? 0;
    if (current >= def.maxLevel) return;
    const cost = upgradeCost(upgradeId, current);
    if (!Number.isFinite(cost) || p.credits < cost) return;
    p.credits -= cost;
    p.upgrades[upgradeId] = current + 1;
    if (upgradeId === "hull") {
      const entity = this.entities.get(p.controlledEntityId);
      if (entity) {
        const base = getClass(entity.shipType).maxHp;
        const newMax = Math.round(base * upgradeMultiplier("hull", p.upgrades.hull));
        const delta = Math.max(0, newMax - entity.maxHp);
        entity.maxHp = newMax;
        entity.hp = Math.min(newMax, entity.hp + delta);
      }
    }
  }

  tick() {
    const now = this.now();

    for (const entity of this.entities.values()) {
      if (!entity.alive && now >= entity.respawnAt) {
        const sp = randSpawn();
        entity.px = sp.px;
        entity.py = 0;
        entity.pz = sp.pz;
        entity.yaw = sp.yaw;
        entity.pitch = 0;
        entity.roll = 0;
        entity.vx = entity.vy = entity.vz = 0;
        entity.hp = entity.maxHp;
        entity.alive = true;
        entity.respawnAt = 0;
        entity.hasCourse = false;
      }
    }

    for (const p of this.players.values()) {
      const entity = this.entities.get(p.controlledEntityId);
      if (!entity || !entity.alive || entity.kind !== "mother_ship") continue;
      stepMotherShipCourse(entity, TICK_DT);
      const speed = Math.hypot(entity.vx, entity.vz);
      if (speed >= CARRIER.creditMoveThreshold) {
        p.credits += CARRIER.creditRatePerSec * TICK_DT;
      }
      this.stepTurrets(p, entity, now);
    }

    this.stepProjectiles(now);
  }

  stepTurrets(p, ship, now) {
    if (now - p.turretLastFireAt < CARRIER.turretCooldownMs) return;
    let nearest = null;
    let nearestDist = Infinity;
    for (const target of this.entities.values()) {
      if (!target.alive || target.owner === p.id) continue;
      const dist = Math.hypot(target.px - ship.px, target.pz - ship.pz);
      if (dist < nearestDist && dist <= CARRIER.turretRange) {
        nearestDist = dist;
        nearest = target;
      }
    }
    if (!nearest) return;
    p.turretLastFireAt = now;
    for (const [ox, oy, oz] of turretOffsets(ship)) {
      const mx = ship.px + ox;
      const my = ship.py + oy;
      const mz = ship.pz + oz;
      const dx = nearest.px - mx;
      const dy = nearest.py - my;
      const dz = nearest.pz - mz;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 0.01) continue;
      const inv = 1 / dist;
      const sp = CARRIER.turretProjectileSpeed;
      this.projectiles.push({
        id: this.nextProjId++,
        owner: ship.id,
        px: mx,
        py: my,
        pz: mz,
        vx: dx * inv * sp,
        vy: dy * inv * sp,
        vz: dz * inv * sp,
        dieAt: now + CARRIER.turretProjectileLifeMs,
        damage: CARRIER.turretDamage,
        hitRadius: HIT_RADIUS_DEFAULT * 1.5,
      });
    }
  }

  stepProjectiles(now) {
    const alive = [];
    for (const pr of this.projectiles) {
      if (now >= pr.dieAt) continue;
      pr.px += pr.vx * TICK_DT;
      pr.py += pr.vy * TICK_DT;
      pr.pz += pr.vz * TICK_DT;
      if (Math.abs(pr.px) > ARENA || Math.abs(pr.pz) > ARENA) continue;

      let hit = false;
      for (const target of this.entities.values()) {
        if (!target.alive || target.id === pr.owner) continue;
        const dx = target.px - pr.px;
        const dy = target.py - pr.py;
        const dz = target.pz - pr.pz;
        const r = pr.hitRadius;
        if (dx * dx + dy * dy + dz * dz <= r * r) {
          this.applyDamage(target, pr.owner, now, pr.damage);
          this.events.push({ k: "hit", px: pr.px, py: pr.py, pz: pr.pz });
          hit = true;
          break;
        }
      }
      if (!hit) alive.push(pr);
    }
    this.projectiles = alive;
  }

  applyDamage(entity, attackerId, now, dmg) {
    entity.hp -= dmg;
    if (entity.hp > 0) return;
    entity.hp = 0;
    entity.alive = false;
    entity.deaths += 1;
    entity.respawnAt = now + RESPAWN_MS;
    entity.vx = entity.vy = entity.vz = 0;
    entity.hasCourse = false;
    const attacker = this.entities.get(attackerId);
    if (attacker && attacker.id !== entity.id) attacker.kills += 1;
    this.events.push({ k: "explode", px: entity.px, py: entity.py, pz: entity.pz });
  }

  broadcast() {
    if (this.players.size === 0) {
      this.events = [];
      return;
    }
    const time = Date.now() - this.startedAt;
    const joined = new Set();
    for (const p of this.players.values()) if (p.joined) joined.add(p.id);

    const entities = [];
    for (const e of this.entities.values()) {
      if (joined.has(e.owner)) entities.push(e);
    }

    const projectiles = this.projectiles.map((pr) => ({
      id: pr.id,
      owner: pr.owner,
      px: pr.px,
      py: pr.py,
      pz: pr.pz,
      vx: pr.vx,
      vy: pr.vy,
      vz: pr.vz,
    }));

    const economy = [];
    for (const p of this.players.values()) {
      if (!p.joined) continue;
      economy.push({
        playerId: p.id,
        controlledEntityId: p.controlledEntityId,
        credits: Math.floor(p.credits),
        weapon: p.weapon,
        upgrades: { ...p.upgrades },
      });
    }

    const events = this.events;
    for (const p of this.players.values()) {
      try {
        p.send(
          JSON.stringify({
            t: "snapshot",
            time,
            ack: p.lastSeq,
            entities,
            projectiles,
            events,
            economy,
          }),
        );
      } catch {
        /* socket dead — cleaned on close */
      }
    }
    this.events = [];
  }
}

let room = null;
export function getSpaceRoom() {
  if (!room) {
    room = new SpaceRoom();
    room.start();
  }
  return room;
}
