/**
 * One-time / refresh dev environment setup.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const envExample = path.join(ROOT, '.env.example');
const envLocal = path.join(ROOT, '.env.local');
if (!fs.existsSync(envLocal) && fs.existsSync(envExample)) {
  fs.copyFileSync(envExample, envLocal);
  console.log('[setup] created .env.local from .env.example');
}

run('npm', ['install']);
run('npm', ['install'], { cwd: path.join(ROOT, 'server') });
run('node', ['scripts/sync-grudge-game-hud.mjs']);
run('node', ['scripts/verify-hud-icons.mjs']);

console.log('[setup] ready — run: npm run dev');