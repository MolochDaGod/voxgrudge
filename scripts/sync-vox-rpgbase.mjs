#!/usr/bin/env node
/**
 * Sync VoxRpgBase SSOT → GRUDOX + DCQ vendor.
 *
 * SSOT: js/vox-rpgbase-combat.js  (+ js/vox-standards.js for grudox)
 *
 *   node scripts/sync-vox-rpgbase.mjs
 *   node scripts/sync-vox-rpgbase.mjs --check
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SSOT = path.join(ROOT, 'js', 'vox-rpgbase-combat.js');
const STANDARDS = path.join(ROOT, 'js', 'vox-standards.js');
const checkOnly = process.argv.includes('--check');

const COPIES = [
  {
    src: SSOT,
    dest: path.join(ROOT, '..', 'grudox', 'js', 'vox-rpgbase-combat.js'),
    banner: false,
  },
  {
    src: STANDARDS,
    dest: path.join(ROOT, '..', 'grudox', 'js', 'vox-standards.js'),
    banner: false,
  },
  {
    // .cjs so Vite/Node resolve as CommonJS (voxgrudge package is "type":"module")
    src: SSOT,
    dest: path.join(
      'D:',
      'Games',
      'Models',
      'Dungeon-Crawler-Quest',
      'Dungeon-Crawler-Quest',
      'client',
      'src',
      'game',
      'vendor',
      'vox-rpgbase-combat.cjs',
    ),
    banner: true,
  },
];

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

function syncOne({ src, dest, banner }) {
  if (!fs.existsSync(src)) {
    console.error('Missing SSOT:', src);
    return false;
  }
  const body = fs.readFileSync(src);
  const srcHash = sha(body);
  let destHash = null;
  if (fs.existsSync(dest)) {
    let existing = fs.readFileSync(dest);
    // strip auto banner for compare
    const s = existing.toString('utf8');
    if (s.startsWith('/** AUTO-SYNCED')) {
      const idx = s.indexOf('\n');
      existing = Buffer.from(s.slice(idx + 1));
    }
    destHash = sha(existing);
  }
  if (destHash === srcHash) {
    console.log('OK  ', dest, `(${srcHash})`);
    return true;
  }
  if (checkOnly) {
    console.error('DRIFT', dest, `src=${srcHash} dest=${destHash || 'missing'}`);
    return false;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let out = body;
  if (banner) {
    out = Buffer.concat([
      Buffer.from(
        '/** AUTO-SYNCED from voxgrudge/js/vox-rpgbase-combat.js — do not edit. npm run sync:rpgbase */\n',
      ),
      body,
    ]);
  }
  fs.writeFileSync(dest, out);
  console.log('SYNC', dest, `→ ${srcHash}`);
  return true;
}

console.log(checkOnly ? 'check…' : 'sync…', 'SSOT', SSOT);
let ok = true;
for (const c of COPIES) {
  if (!syncOne(c)) ok = false;
}

// Ensure DCQ typed facade does not embed a second formula tree
const facade = path.join(
  'D:',
  'Games',
  'Models',
  'Dungeon-Crawler-Quest',
  'Dungeon-Crawler-Quest',
  'client',
  'src',
  'game',
  'vox-rpgbase.ts',
);
if (fs.existsSync(facade)) {
  const t = fs.readFileSync(facade, 'utf8');
  const usesVendor = t.includes('vendor/vox-rpgbase-combat');
  const embedsFormulas =
    /blockDr:\s*0\.72/.test(t) && /export const WEAPONS\s*=\s*\{/.test(t);
  if (!usesVendor) {
    console.error('STALE: vox-rpgbase.ts must import vendor/vox-rpgbase-combat.cjs');
    ok = false;
  }
  if (embedsFormulas) {
    console.error('STALE: vox-rpgbase.ts must not embed weapon formulas');
    ok = false;
  }
}

if (!ok) {
  console.error('sync-vox-rpgbase FAILED');
  process.exit(1);
}
console.log('sync-vox-rpgbase done');
