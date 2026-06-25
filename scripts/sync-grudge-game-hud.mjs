/**
 * Sync grudge-game HUD assets (CraftPix UI kit + class emblems) into voxgrudge.
 * Source: Character-Animator-two artifacts/grudge-game/public/assets
 * Run: npm run sync:grudge-game-hud
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  path.resolve(
    'C:/Users/nugye/Documents/Character-Animator-two/Character-Animator-two/artifacts/grudge-game/public/assets',
  ),
  path.resolve(
    'D:/Games/Character-Animator-two/Character-Animator-two/artifacts/grudge-game/public/assets',
  ),
];

const src = candidates.find((p) => fs.existsSync(path.join(p, 'ui')));
if (!src) {
  console.error('grudge-game assets not found. Expected one of:', candidates);
  process.exit(1);
}

const dst = path.join(root, 'assets', 'grudge-game');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, ent.name);
    const b = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

const packs = [
  ['ui', 'ui'],
  ['class-emblems', 'class-emblems'],
  ['emblems', 'emblems'],
];

for (const [folder, sub] of packs) {
  const from = path.join(src, folder);
  if (fs.existsSync(from)) {
    copyDir(from, path.join(dst, sub));
    console.log('Copied', folder, '→', path.join(dst, sub));
  }
}

const count = fs
  .readdirSync(dst, { recursive: true })
  .filter((f) => /\.(png|webp)$/i.test(String(f))).length;
console.log('Synced grudge-game HUD assets to', dst);
console.log('Image files:', count);