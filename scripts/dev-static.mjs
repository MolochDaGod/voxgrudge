/**
 * Local static file server for voxgrudge (port 3000).
 * GRUDOX WebSocket connects directly to localhost:8787 (see grudoxWsUrl in game HTML).
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.DEV_PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded === '/' ? '/grudge-warlords-openworld.html' : decoded;
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const file = safePath(req.url || '/');
  if (!file) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[voxgrudge-dev] game → http://localhost:${PORT}/`);
  console.log(`[voxgrudge-dev] GRUDOX room → ws://localhost:8787/api/grudox`);
});