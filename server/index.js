/**
 * GRUDOX co-located room server (Railway: voxgrudge-grudox-room)
 *
 * Paths:
 *   GET  / /health /api/health     — health
 *   WS   /api/grudox               — open-world intent relay (existing)
 *   WS   /api/space                — Live Waters naval PvP (space-net protocol)
 *   WS   /api/carrier              — Carrier combat + missiles (carrier-net protocol)
 *   WS   /api/drive                — Houston Velocity open-world (THREE.Multiplayer poses)
 *
 * Deploy: Railway service voxgrudge-grudox-room-production
 * Optional: CARRIER_WEBHOOK_URL or DISCORD_WEBHOOK_URL for combat event posts
 *
 * Pattern (grudoxinfo / L2): same HTTP process, WebSocket upgrade per path —
 * no separate socket cluster.
 */
import http from "http";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import { getSpaceRoom } from "./space-room.js";
import { getCarrierRoom } from "./carrier-room.js";
import { getDriveRoom } from "./drive-room.js";

const PORT = Number(process.env.PORT || 8787);
const TICK_HZ = Number(process.env.TICK_HZ || 20);
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 16);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const players = new Map();
const allies = new Map();

function corsOrigin(origin) {
  if (!origin) return "*";
  if (ALLOWED_ORIGINS.includes("*")) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
}

function json(res, status, body, origin) {
  const o = corsOrigin(origin);
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...(o ? { "Access-Control-Allow-Origin": o } : {}),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function originAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes("*")) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // CF Pages preview deploys: https://<hash>.grudge-velocity.pages.dev
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === "grudge-velocity.pages.dev" || host.endsWith(".grudge-velocity.pages.dev")) {
      return true;
    }
    // Fleet shells that always share the same Velocity product origin
    if (
      host === "drive.grudge-studio.com" ||
      host === "grudge-drive.vercel.app" ||
      host.endsWith(".grudge-drive.vercel.app")
    ) {
      return true;
    }
  } catch {
    /* ignore bad Origin */
  }
  return false;
}

const spaceRoom = getSpaceRoom();
const carrierRoom = getCarrierRoom();
const driveRoom = getDriveRoom();

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || "";
  if (req.method === "OPTIONS") {
    json(res, 204, {}, origin);
    return;
  }
  const pathOnly = (req.url || "/").split("?")[0];

  if (pathOnly === "/" || pathOnly === "/health" || pathOnly === "/api/health") {
    json(
      res,
      200,
      {
        ok: true,
        service: "voxgrudge-grudox-room",
        players: players.size,
        watersPlayers: spaceRoom.playerCount(),
        carrierPlayers: carrierRoom.playerCount(),
        drivePlayers: driveRoom.playerCount(),
        tickHz: TICK_HZ,
        paths: {
          openworld: "/api/grudox",
          waters: "/api/space",
          carrier: "/api/carrier",
          drive: "/api/drive",
        },
        arenaHalf: 6000,
        carrierArenaHalf: 12000,
        webhooks: !!(process.env.CARRIER_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL),
      },
      origin,
    );
    return;
  }

  if (pathOnly === "/api/grudox" || pathOnly === "/api/grudox/rooms") {
    json(
      res,
      200,
      {
        ok: true,
        room: "vox-openworld",
        players: players.size,
        maxPlayers: MAX_PLAYERS,
        transport: "websocket",
        path: "/api/grudox",
      },
      origin,
    );
    return;
  }

  if (pathOnly === "/api/space") {
    json(
      res,
      200,
      {
        ok: true,
        room: "live-waters",
        players: spaceRoom.playerCount(),
        transport: "websocket",
        path: "/api/space",
        arenaHalf: 6000,
        protocol: "space-net",
      },
      origin,
    );
    return;
  }

  if (pathOnly === "/api/carrier") {
    json(
      res,
      200,
      {
        ok: true,
        room: "carrier",
        players: carrierRoom.playerCount(),
        transport: "websocket",
        path: "/api/carrier",
        arenaHalf: 12000,
        protocol: "carrier-net",
        features: ["bolts", "missiles", "ai-hostiles", "mothership-turrets", "webhooks"],
      },
      origin,
    );
    return;
  }

  if (pathOnly === "/api/drive" || pathOnly === "/api/drive/") {
    json(
      res,
      200,
      {
        ok: true,
        room: "houston-velocity",
        players: driveRoom.playerCount(),
        transport: "websocket",
        path: "/api/drive",
        protocol: "three-multiplayer-poses",
        features: ["introduction", "move", "userPositions"],
      },
      origin,
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

const wssOpenworld = new WebSocketServer({ noServer: true });
const wssSpace = new WebSocketServer({ noServer: true });
const wssCarrier = new WebSocketServer({ noServer: true });
const wssDrive = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = req.url || "";
  const pathOnly = url.split("?")[0];
  const origin = req.headers.origin || "";

  if (!originAllowed(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  if (pathOnly === "/api/space" || pathOnly.startsWith("/api/space/")) {
    wssSpace.handleUpgrade(req, socket, head, (ws) => wssSpace.emit("connection", ws, req));
    return;
  }

  if (pathOnly === "/api/carrier" || pathOnly.startsWith("/api/carrier/")) {
    wssCarrier.handleUpgrade(req, socket, head, (ws) => wssCarrier.emit("connection", ws, req));
    return;
  }

  if (pathOnly === "/api/drive" || pathOnly.startsWith("/api/drive/")) {
    wssDrive.handleUpgrade(req, socket, head, (ws) => wssDrive.emit("connection", ws, req));
    return;
  }

  if (pathOnly.startsWith("/api/grudox")) {
    wssOpenworld.handleUpgrade(req, socket, head, (ws) => wssOpenworld.emit("connection", ws, req));
    return;
  }

  // Unknown upgrade path — close cleanly (was socket.destroy → 502 for waters)
  socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
  socket.destroy();
});

// ── Live Waters (/api/space) ────────────────────────────────────────────────

wssSpace.on("connection", (ws) => {
  const id = spaceRoom.add((data) => {
    if (ws.readyState === 1) ws.send(data);
  });

  ws.on("message", (raw) => {
    spaceRoom.handleMessage(id, raw);
  });

  ws.on("close", () => spaceRoom.remove(id));
  ws.on("error", () => spaceRoom.remove(id));
});

// ── Carrier combat (/api/carrier) ───────────────────────────────────────────

wssCarrier.on("connection", (ws) => {
  const id = carrierRoom.add((data) => {
    if (ws.readyState === 1) ws.send(data);
  });

  ws.on("message", (raw) => {
    carrierRoom.handleMessage(id, raw);
  });

  ws.on("close", () => carrierRoom.remove(id));
  ws.on("error", () => carrierRoom.remove(id));
});

// ── Houston Velocity open-world (/api/drive) ────────────────────────────────

wssDrive.on("connection", (ws) => {
  const id = driveRoom.add((data) => {
    if (ws.readyState === 1) ws.send(data);
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.t === "join" && typeof msg.name === "string") {
      driveRoom.setName(id, msg.name);
    } else if (msg.t === "move" && Array.isArray(msg.position)) {
      driveRoom.move(id, msg.position, msg.rotation ?? [0, 0, 0]);
    }
  });

  ws.on("close", () => driveRoom.remove(id));
  ws.on("error", () => driveRoom.remove(id));
});

// ── Open-world relay (/api/grudox) ──────────────────────────────────────────

function broadcast(msg, exceptId) {
  const raw = JSON.stringify(msg);
  for (const [id, p] of players) {
    if (id === exceptId) continue;
    if (p.ws.readyState === 1) p.ws.send(raw);
  }
}

function snapshot() {
  return {
    type: "state",
    t: Date.now(),
    players: [...players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      z: p.z,
      rot: p.rot,
      class: p.class,
      hp: p.hp,
    })),
    allies: [...allies.values()],
  };
}

wssOpenworld.on("connection", (ws) => {
  if (players.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: "error", message: "room full" }));
    ws.close();
    return;
  }
  const id = randomUUID();
  const player = {
    id,
    ws,
    name: "Survivor",
    x: 0,
    z: 0,
    rot: 0,
    class: "swordsman",
    hp: 100,
  };
  players.set(id, player);
  ws.send(JSON.stringify({ type: "welcome", id, tickHz: TICK_HZ }));
  broadcast({ type: "join", player: { id, name: player.name, x: 0, z: 0 } }, id);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === "intent") {
      if (typeof msg.x === "number") player.x = msg.x;
      if (typeof msg.z === "number") player.z = msg.z;
      if (typeof msg.rot === "number") player.rot = msg.rot;
      if (typeof msg.hp === "number") player.hp = msg.hp;
      if (msg.name) player.name = String(msg.name).slice(0, 24);
      if (msg.class) player.class = String(msg.class).slice(0, 24);
      broadcast(
        { type: "intent", id, x: player.x, z: player.z, rot: player.rot, hp: player.hp },
        id,
      );
    }
    if (msg.type === "ally_spawn" && msg.ally) {
      const aid = randomUUID();
      const ally = { id: aid, owner: id, ...msg.ally };
      allies.set(aid, ally);
      broadcast({ type: "ally_spawn", ally }, null);
    }
    if (msg.type === "projectile" && msg.projectile) {
      broadcast({ type: "projectile", owner: id, projectile: msg.projectile }, id);
    }
    if (msg.type === "chat" && msg.text) {
      broadcast({ type: "chat", id, name: player.name, text: String(msg.text).slice(0, 120) }, null);
    }
  });

  ws.on("close", () => {
    players.delete(id);
    for (const [aid, a] of allies) {
      if (a.owner === id) allies.delete(aid);
    }
    broadcast({ type: "leave", id }, null);
  });
});

setInterval(() => {
  if (!players.size) return;
  const snap = snapshot();
  const raw = JSON.stringify(snap);
  for (const p of players.values()) {
    if (p.ws.readyState === 1) p.ws.send(raw);
  }
}, 1000 / TICK_HZ);

server.listen(PORT, () => {
  console.log(
    `[grudox-room] :${PORT} openworld=/api/grudox waters=/api/space carrier=/api/carrier drive=/api/drive`,
  );
});
