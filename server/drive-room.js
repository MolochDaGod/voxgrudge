/**
 * Houston Velocity open-world room — `/api/drive`
 * THREE.Multiplayer-style pose relay (introduce + move + broadcast).
 * Protocol matches vfc-build driveNetClient / drive-room (JSON over WS).
 */

let room = null;

export function getDriveRoom() {
  if (!room) room = new DriveRoom();
  return room;
}

export class DriveRoom {
  constructor() {
    this.clients = new Map();
    this.seq = 0;
  }

  playerCount() {
    return this.clients.size;
  }

  add(send) {
    const id = `d${++this.seq}-${Math.random().toString(36).slice(2, 8)}`;
    this.clients.set(id, {
      send,
      name: "driver",
      pose: { position: [0, 0, 0], rotation: [0, 0, 0] },
    });
    send(
      JSON.stringify({
        t: "introduction",
        id,
        count: this.clients.size,
        clients: this.snapshot(),
      }),
    );
    this.broadcast({
      t: "newUserConnected",
      count: this.clients.size,
      id,
    });
    this.broadcastPositions();
    return id;
  }

  setName(id, name) {
    const c = this.clients.get(id);
    if (!c) return;
    c.name = String(name || "driver").slice(0, 24) || "driver";
    c.pose.name = c.name;
  }

  move(id, position, rotation) {
    const c = this.clients.get(id);
    if (!c) return;
    if (!Array.isArray(position) || position.length < 3) return;
    if (!position.every((n) => typeof n === "number" && Number.isFinite(n))) return;
    c.pose.position = [position[0], position[1] ?? 0, position[2]];
    if (Array.isArray(rotation) && rotation.length >= 1) {
      c.pose.rotation = [
        Number(rotation[0]) || 0,
        Number(rotation[1]) || 0,
        Number(rotation[2]) || 0,
      ];
    }
    c.pose.name = c.name;
    this.broadcastPositions();
  }

  remove(id) {
    if (!this.clients.delete(id)) return;
    this.broadcast({
      t: "userDisconnected",
      count: this.clients.size,
      id,
    });
    this.broadcastPositions();
  }

  snapshot() {
    const out = {};
    for (const [id, c] of this.clients) {
      out[id] = { ...c.pose, name: c.name };
    }
    return out;
  }

  broadcastPositions() {
    this.broadcast({
      t: "userPositions",
      clients: this.snapshot(),
      count: this.clients.size,
    });
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      try {
        c.send(data);
      } catch {
        /* drop */
      }
    }
  }
}
