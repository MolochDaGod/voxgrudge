/**
 * Bridge to ObjectStore grudge-convert production pipeline.
 *
 *   npm run convert -- --help
 *   npm run convert -- fbx2glb raw/hero.fbx -o dist/hero.glb
 *
 * Looks for:
 *   ../ObjectStore/tools/grudge-convert
 *   ../../ObjectStore/tools/grudge-convert
 *   GRUDGE_CONVERT_ROOT env
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function findConvert() {
  if (process.env.GRUDGE_CONVERT_ROOT) {
    const p = path.join(process.env.GRUDGE_CONVERT_ROOT, 'bin', 'grudge-convert.mjs');
    if (fs.existsSync(p)) return p;
  }
  const candidates = [
    path.join(ROOT, '..', 'ObjectStore', 'tools', 'grudge-convert', 'bin', 'grudge-convert.mjs'),
    path.join(ROOT, '..', '..', 'ObjectStore', 'tools', 'grudge-convert', 'bin', 'grudge-convert.mjs'),
    path.join('C:', 'Users', 'nugye', 'Documents', '1111111', 'ObjectStore', 'tools', 'grudge-convert', 'bin', 'grudge-convert.mjs'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const bin = findConvert();
if (!bin) {
  console.error(`grudge-convert not found.
Install/clone ObjectStore tools or set GRUDGE_CONVERT_ROOT.
Expected: ObjectStore/tools/grudge-convert/bin/grudge-convert.mjs`);
  process.exit(1);
}

const args = process.argv.slice(2);
console.log(`[convert] ${bin} ${args.join(' ')}`);
const r = spawnSync(process.execPath, [bin, ...args], {
  stdio: 'inherit',
  cwd: path.dirname(path.dirname(bin)),
});
process.exit(r.status ?? 1);
