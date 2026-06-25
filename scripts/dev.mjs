/**
 * Start GRUDOX room server (8787) + static game server (3000) together.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

function run(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: opts.cwd || ROOT,
    stdio: 'inherit',
    shell: isWin,
    env: {
      ...process.env,
      ...opts.env,
    },
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[voxgrudge-dev] ${name} exited with code ${code}`);
    }
  });
  return child;
}

const room = run('grudox-room', 'node', ['--watch', 'index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: {
    PORT: '8787',
    ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000,https://voxgrudge.vercel.app,https://vox.grudge-studio.com',
  },
});

const game = run('static', 'node', ['scripts/dev-static.mjs'], {
  env: { DEV_PORT: '3000' },
});

function shutdown() {
  room.kill();
  game.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('[voxgrudge-dev] Press Ctrl+C to stop both servers');