/**
 * Best-practice local dev: GRUDOX room + static game server.
 * Run setup once: npm run setup
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDevEnv, applyEnv, ROOT_DIR } from './load-env.mjs';

const ROOT = ROOT_DIR;
const isWin = process.platform === 'win32';

applyEnv(loadDevEnv());

const DEV_PORT = process.env.DEV_PORT || '3000';
const GRUDOX_PORT = process.env.GRUDOX_PORT || '8787';
const ALLOWED_ORIGINS =
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:3000,http://127.0.0.1:3000,https://test.grudge-studio.com,https://voxgrudge.vercel.app,https://vox.grudge-studio.com';

function run(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: opts.cwd || ROOT,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ...opts.env },
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[voxgrudge-dev] ${name} exited with code ${code}`);
      shutdown(1);
    }
  });
  return child;
}

const children = [];

const room = run('grudox-room', 'node', ['--watch', 'index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: {
    PORT: GRUDOX_PORT,
    TICK_HZ: process.env.TICK_HZ || '20',
    MAX_PLAYERS: process.env.MAX_PLAYERS || '16',
    ALLOWED_ORIGINS,
  },
});
children.push(room);

const game = run('static', 'node', ['scripts/dev-static.mjs'], {
  env: { DEV_PORT, GRUDOX_PORT },
});
children.push(game);

function shutdown(code = 0) {
  for (const c of children) c.kill();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('');
console.log('[voxgrudge-dev] ─────────────────────────────────────');
console.log('[voxgrudge-dev]  Local game   http://127.0.0.1:' + DEV_PORT + '/');
console.log('[voxgrudge-dev]  GRUDOX room  ws://127.0.0.1:' + GRUDOX_PORT + '/api/grudox');
console.log('[voxgrudge-dev]  Test deploy  ' + (process.env.TEST_URL || 'https://test.grudge-studio.com'));
console.log('[voxgrudge-dev]  Health check npm run dev:check');
console.log('[voxgrudge-dev]  Ctrl+C to stop');
console.log('[voxgrudge-dev] ─────────────────────────────────────');
console.log('');