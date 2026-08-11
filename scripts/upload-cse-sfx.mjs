/**
 * Upload CSE (mattflat) combat SFX to R2 — unmodified WAVs (CC BY-ND 3.0).
 *
 *   node scripts/upload-cse-sfx.mjs
 *   node scripts/upload-cse-sfx.mjs --dry-run
 *   node scripts/upload-cse-sfx.mjs --verify
 *
 * Keys:  audio/cse/sfx/{file}.wav + catalog.json + CREDITS.txt
 * CDN:   https://assets.grudge-studio.com/audio/cse/sfx/…
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'audio', 'cse-sfx');
const BUCKET = process.env.R2_BUCKET || 'grudge-assets';
const PREFIX = 'audio/cse/sfx';
const CDN = 'https://assets.grudge-studio.com';
const DRY = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

function r2Put(abs, key, ct) {
  return spawnSync(
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
}

async function headOk(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    if (r.ok) return true;
    const g = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return g.ok || g.status === 206;
  } catch {
    return false;
  }
}

function mimeFor(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.json') return 'application/json';
  if (ext === '.txt') return 'text/plain';
  return 'application/octet-stream';
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Missing', SRC);
    process.exit(1);
  }
  const files = fs
    .readdirSync(SRC)
    .filter((n) => /\.(wav|json|txt)$/i.test(n))
    .map((n) => path.join(SRC, n));
  console.log(`upload-cse-sfx: ${files.length} → r2://${BUCKET}/${PREFIX}/`);
  console.log('  License: CC BY-ND 3.0 — WAVs unmodified (mattflat)');

  let ok = 0;
  for (const abs of files) {
    const name = path.basename(abs);
    const key = `${PREFIX}/${name}`;
    const kb = (fs.statSync(abs).size / 1024).toFixed(1);
    console.log(`  ${DRY ? 'DRY ' : ''}put ${key} (${kb}KB)`);
    if (DRY) {
      ok++;
      continue;
    }
    const r = r2Put(abs, key, mimeFor(name));
    if (r.status !== 0) console.error(r.stderr || r.stdout);
    else ok++;
  }
  console.log(`Done ${ok}/${files.length}`);
  if (!DRY && ok < files.length) process.exit(1);

  if (VERIFY && !DRY) {
    console.log('Verify CDN…');
    let vOk = 0;
    let vBad = 0;
    for (const abs of files) {
      const name = path.basename(abs);
      const url = `${CDN}/${PREFIX}/${name}`;
      const good = await headOk(url);
      console.log(`  ${good ? 'OK ' : 'BAD'} ${name}`);
      if (good) vOk++;
      else vBad++;
    }
    console.log(`Verify ok=${vOk} bad=${vBad}`);
    if (vBad) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
