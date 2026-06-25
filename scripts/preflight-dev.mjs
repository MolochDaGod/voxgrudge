/**
 * Preflight checks before npm run dev.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 18) errors.push(`Node >= 18 required (found ${process.versions.node})`);

const serverModules = path.join(ROOT, 'server', 'node_modules', 'ws');
if (!fs.existsSync(serverModules)) {
  errors.push('server dependencies missing — run: npm run setup');
}

const hudSlot = path.join(
  ROOT,
  'assets/grudge-game/ui/Action_Bar/Slots/ActionBar_Slot_Background.png',
);
if (!fs.existsSync(hudSlot)) {
  errors.push('grudge-game HUD assets missing — run: npm run sync:grudge-game-hud');
}

const envLocal = path.join(ROOT, '.env.local');
if (!fs.existsSync(envLocal)) {
  console.warn('[preflight] no .env.local — using defaults (.env.example)');
}

if (errors.length) {
  console.error('[preflight] dev environment not ready:');
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}

console.log('[preflight] ok — node', process.versions.node);