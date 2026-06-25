/**
 * Local static file server for voxgrudge.
 * GRUDOX WebSocket: local room on GRUDOX_PORT (default 8787).
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { loadDevEnv, applyEnv, ROOT_DIR } from './load-env.mjs';

applyEnv(loadDevEnv());

const ROOT = ROOT_DIR;
const HOST = process.env.DEV_HOST || '127.0.0.1';
const PORT = Number(process.env.DEV_PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
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

const NO_CACHE_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json']);

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
    res.writeHead(403, devHeaders());
    res.end('Forbidden');
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, devHeaders());
      res.end('Not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      ...devHeaders(),
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ...(NO_CACHE_EXT.has(ext)
        ? { 'Cache-Control': 'no-store, must-revalidate' }
        : { 'Cache-Control': 'public, max-age=300' }),
    };
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
});

function devHeaders() {
  return {
    'X-Grudge-Env': 'development',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  };
}

server.listen(PORT, HOST, () => {
  console.log(`[voxgrudge-dev] game → http://${HOST}:${PORT}/`);
  console.log(`[voxgrudge-dev] test deploy → ${process.env.TEST_URL || 'https://test.grudge-studio.com'}`);
});