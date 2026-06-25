/**
 * Deploy voxgrudge to Vercel production alias test.grudge-studio.com
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const TEST_DOMAIN = 'test.grudge-studio.com';

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('[deploy-test] verifying HUD assets…');
run('node', ['scripts/verify-hud-icons.mjs']);

console.log('[deploy-test] deploying to Vercel…');
run('npx', ['vercel', 'deploy', '--prod', '--yes']);

console.log('[deploy-test] attaching domain', TEST_DOMAIN, '(skip if already linked)…');
const domain = spawnSync('npx', ['vercel', 'domains', 'add', TEST_DOMAIN], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: isWin,
  env: process.env,
});
if (domain.status !== 0) {
  console.warn('[deploy-test] domain add skipped — attach', TEST_DOMAIN, 'in Vercel dashboard if needed');
}

console.log('[deploy-test] done → https://' + TEST_DOMAIN);