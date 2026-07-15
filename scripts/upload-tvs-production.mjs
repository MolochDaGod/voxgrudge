/**
 * Upload dist/tvs/production/** to R2 under models/voxels/tvs/
 *
 *   npm run upload:tvs
 *   npm run upload:tvs -- --dry-run
 *
 * Keys match CDN paths already used by unit-roster (characters/*.glb next to .fbx).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'dist', 'tvs', 'production');
const BUCKET = process.env.R2_BUCKET || 'grudge-assets';
const DRY = process.argv.includes('--dry-run');

const MIME = {
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('No dist/tvs/production — run: npm run convert:tvs');
    process.exit(1);
  }
  const files = walk(SRC).filter((f) => /\.(glb|json|png|webp)$/i.test(f));
  console.log(`upload-tvs: ${files.length} file(s) → r2://${BUCKET}/models/voxels/tvs/…`);
  let ok = 0;
  for (const abs of files) {
    const rel = path.relative(SRC, abs).replace(/\\/g, '/');
    // unit-roster.production.json → models/voxels/tvs/unit-roster.production.json
    // pack/characters/x.glb → models/voxels/tvs/pack/characters/x.glb
    const key = rel.startsWith('unit-roster')
      ? `models/voxels/tvs/${rel}`
      : `models/voxels/tvs/${rel}`;
    const ct = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
    console.log(`  ${DRY ? 'DRY ' : ''}put ${key} (${(fs.statSync(abs).size / 1024).toFixed(1)}KB)`);
    if (DRY) {
      ok++;
      continue;
    }
    const r = spawnSync(
      'npx',
      [
        'wrangler',
        'r2',
        'object',
        'put',
        `${BUCKET}/${key}`,
        '--file',
        abs,
        '--content-type',
        ct,
        '--remote',
      ],
      { encoding: 'utf8', shell: true, cwd: ROOT },
    );
    if (r.status !== 0) {
      console.error(r.stderr || r.stdout);
    } else {
      ok++;
    }
  }
  console.log(`Done ${ok}/${files.length}`);
  // Optionally also put production roster as primary unit-roster.json
  const prodRoster = path.join(SRC, 'unit-roster.production.json');
  if (!DRY && fs.existsSync(prodRoster)) {
    console.log('Also publishing unit-roster.json from production roster…');
    spawnSync(
      'npx',
      [
        'wrangler',
        'r2',
        'object',
        'put',
        `${BUCKET}/models/voxels/tvs/unit-roster.json`,
        '--file',
        prodRoster,
        '--content-type',
        'application/json',
        '--remote',
      ],
      { encoding: 'utf8', shell: true, cwd: ROOT, stdio: 'inherit' },
    );
  }
  process.exit(ok ? 0 : 1);
}

main();
