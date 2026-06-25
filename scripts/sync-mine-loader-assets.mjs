/**
 * Sync Mine-Loader gold icon assets into voxgrudge/assets/mine-loader.
 * Run: node scripts/sync-mine-loader-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  path.resolve('F:/GitHub/voxgrudge/Mine-Loader/artifacts/voxelcraft/public/assets'),
  path.resolve('D:/GitHub/voxgrudge/Mine-Loader/artifacts/voxelcraft/public/assets'),
];

const src = candidates.find((p) => fs.existsSync(path.join(p, 'ui-icons')));
if (!src) {
  console.error('Mine-Loader assets not found. Expected one of:', candidates);
  process.exit(1);
}

const dst = path.join(root, 'assets', 'mine-loader');
const packs = [
  'fantasy-common', 'fantasy-rare', 'fantasy-epic', 'fantasy-legendary',
  'tactical-common', 'tactical-rare', 'tactical-epic', 'tactical-legendary',
  'mining-ops', 'projectiles-fx', 'command-actions', 'mining-blocks', 'mining-gear',
  'ops-tier-1', 'ops-tier-2', 'ops-tier-3', 'ops-tier-4', 'ops-tier-5', 'ops-tier-6',
];

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, ent.name);
    const b = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

copyDir(path.join(src, 'ui-icons'), path.join(dst, 'ui-icons'));
for (const pack of packs) {
  const from = path.join(src, 'item-icons', pack);
  if (fs.existsSync(from)) copyDir(from, path.join(dst, 'item-icons', pack));
}

const count = fs.readdirSync(dst, { recursive: true }).filter((f) => String(f).endsWith('.png')).length;
console.log('Synced Mine-Loader assets to', dst);
console.log('PNG files:', count);