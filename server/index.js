/**
 * GRUDOX Vox Studio — co-located room server (Carrier pattern)
 * Deploy to Railway; Vercel frontend proxies /api/grudox → this service.
 */
import http from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

const PORT = Number(process.env.PORT || 8787);
const TICK_HZ = Number(process.env.TICK_HZ || 20);
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 16);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const players = new Map();
const allies = new Map();

function corsOrigin(origin) {
  if (!origin) return '*';
  if (ALLOWED_ORIGINS.includes('*')) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : '';
}

function json(res, status, body, origin) {
  const o = corsOrigin(origin);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...(o ? { 'Access-Control-Allow-Origin': o } : {}),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    json(res, 204, {}, origin);
    return;
  }
  const pathOnly = (req.url || '/').split('?')[0];
  if (pathOnly === '/' || pathOnly === '/health' || pathOnly === '/api/health') {
    json(res, 200, {
      ok: true,
      service: 'voxgrudge-grudox-room',
      players: players.size,
      tickHz: TICK_HZ,
    }, origin);
    return;
  }
  if (pathOnly === '/api/grudox' || pathOnly === '/api/grudox/rooms') {
    // HTTP GET is health/room metadata; realtime is WebSocket upgrade on same path.
    json(res, 200, {
      ok: true,
      room: 'vox-openworld',
      players: players.size,
      maxPlayers: MAX_PLAYERS,
      transport: 'websocket',
      path: '/api/grudox',
    }, origin);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (!url.startsWith('/api/grudox')) {
    socket.destroy();
    return;
  }
  const origin = req.headers.origin || '';
  if (origin && !ALLOWED_ORIGINS.includes('*') && !ALLOWED_ORIGINS.includes(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

function broadcast(msg, exceptId) {
  const raw = JSON.stringify(msg);
  for (const [id, p] of players) {
    if (id === exceptId) continue;
    if (p.ws.readyState === 1) p.ws.send(raw);
  }
}

function snapshot() {
  return {
    type: 'state',
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

wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', message: 'room full' }));
    ws.close();
    return;
  }
  const id = randomUUID();
  const player = {
    id,
    ws,
    name: 'Survivor',
    x: 0,
    z: 0,
    rot: 0,
    class: 'swordsman',
    hp: 100,
  };
  players.set(id, player);
  ws.send(JSON.stringify({ type: 'welcome', id, tickHz: TICK_HZ }));
  broadcast({ type: 'join', player: { id, name: player.name, x: 0, z: 0 } }, id);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.type === 'intent') {
      if (typeof msg.x === 'number') player.x = msg.x;
      if (typeof msg.z === 'number') player.z = msg.z;
      if (typeof msg.rot === 'number') player.rot = msg.rot;
      if (typeof msg.hp === 'number') player.hp = msg.hp;
      if (msg.name) player.name = String(msg.name).slice(0, 24);
      if (msg.class) player.class = String(msg.class).slice(0, 24);
      broadcast({ type: 'intent', id, x: player.x, z: player.z, rot: player.rot, hp: player.hp }, id);
    }
    if (msg.type === 'ally_spawn' && msg.ally) {
      const aid = randomUUID();
      const ally = { id: aid, owner: id, ...msg.ally };
      allies.set(aid, ally);
      broadcast({ type: 'ally_spawn', ally }, null);
    }
    if (msg.type === 'projectile' && msg.projectile) {
      broadcast({ type: 'projectile', owner: id, projectile: msg.projectile }, id);
    }
    if (msg.type === 'chat' && msg.text) {
      broadcast({ type: 'chat', id, name: player.name, text: String(msg.text).slice(0, 120) }, null);
    }
  });

  ws.on('close', () => {
    players.delete(id);
    for (const [aid, a] of allies) {
      if (a.owner === id) allies.delete(aid);
    }
    broadcast({ type: 'leave', id }, null);
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
  console.log(`[grudox-vox] listening on :${PORT} tick=${TICK_HZ}hz`);
});