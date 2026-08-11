/**
 * Upload explorer Mixamo anim pack (FBX) to R2 for TVS showcase / openworld.
 *
 *   node scripts/upload-tvs-anims.mjs
 *   node scripts/upload-tvs-anims.mjs --dry-run
 *   node scripts/upload-tvs-anims.mjs --verify
 *
 * Keys:  voxgrudge/models/anims/{file}.fbx
 * CDN:   https://assets.grudge-studio.com/voxgrudge/models/anims/...
 *
 * SSOT clip map: js/tvs-explorer-skeleton.js ANIM_FILES + js/tvs-danger-anim.js
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'models', 'anims');
const BUCKET = process.env.R2_BUCKET || 'grudge-assets';
const PREFIX = 'voxgrudge/models/anims';
const CDN = 'https://assets.grudge-studio.com';
const DRY = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

/** Core roles required by TvsExplorerSkeleton + TvsDangerAnim (filenames). */
const REQUIRED = [
  'idle.fbx',
  'walk-forward.fbx',
  'run-forward.fbx',
  'sprint.fbx',
  'jump.fbx',
  'land.fbx',
  'fall-loop.fbx',
  'climb.fbx',
  'dodge-forward.fbx',
  'dodge-back.fbx',
  'death-forward.fbx',
  'hit-react.fbx',
  'sword-shield-attack.fbx',
  'sword-shield-block.fbx',
  'Attack.fbx',
  'greatsword-slash.fbx',
  'greatsword-spin.fbx',
  'magic-1h-cast.fbx',
];

function r2Put(abs, key, ct) {
  // No --cache-control: Windows shell:true splits on commas inside the value.
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
  return r;
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

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Missing', SRC);
    process.exit(1);
  }
  const files = fs
    .readdirSync(SRC)
    .filter((n) => /\.fbx$/i.test(n))
    .map((n) => path.join(SRC, n));
  console.log(`upload-tvs-anims: ${files.length} FBX → r2://${BUCKET}/${PREFIX}/`);

  const missingRequired = REQUIRED.filter((n) => !fs.existsSync(path.join(SRC, n)));
  if (missingRequired.length) {
    console.warn('  WARN local missing required:', missingRequired.join(', '));
  }

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
    const r = r2Put(abs, key, 'application/octet-stream');
    if (r.status !== 0) console.error(r.stderr || r.stdout);
    else ok++;
  }

  // Manifest for agents / loaders — baked packages: locomotion / traversal / weapon
  const existingMan = path.join(SRC, 'anim-pack.manifest.json');
  let packages = null;
  if (fs.existsSync(existingMan)) {
    try {
      packages = JSON.parse(fs.readFileSync(existingMan, 'utf8')).packages || null;
    } catch {
      packages = null;
    }
  }
  if (!packages) {
    packages = {
      locomotion: {
        description: 'Idle + walk/run/sprint + strafe',
        files: [
          'idle.fbx',
          'walk-forward.fbx',
          'walk-back.fbx',
          'walk-left.fbx',
          'walk-right.fbx',
          'run-forward.fbx',
          'run-back.fbx',
          'run-left.fbx',
          'run-right.fbx',
          'sprint.fbx',
          'Run.fbx',
        ],
      },
      traversal: {
        description: 'Jump, land, fall, climb, dodge, swim',
        files: [
          'jump.fbx',
          'land.fbx',
          'fall-loop.fbx',
          'climb.fbx',
          'dodge-forward.fbx',
          'dodge-back.fbx',
          'dodge-left.fbx',
          'dodge-right.fbx',
          'swim.fbx',
          'tread-water.fbx',
        ],
      },
      weapon: {
        description: 'Equipped weapon combat packs',
        byEquip: {
          unarmed: ['Attack.fbx', 'Hit.fbx', 'hit-react.fbx', 'death-forward.fbx', 'Death.fbx'],
          sword_shield: ['sword-shield-attack.fbx', 'sword-shield-block.fbx'],
          greatsword: [
            'greatsword-slash.fbx',
            'greatsword-spin.fbx',
            'greatsword-block.fbx',
            'greatsword-jump-attack.fbx',
          ],
          bow: ['bow-aim.fbx', 'bow-draw.fbx'],
          magic: ['magic-1h-cast.fbx', 'magic-2h-area.fbx', 'magic-2h-attack.fbx', 'spell-cast.fbx'],
          pistol: ['pistol-idle.fbx', 'pistol-run.fbx'],
        },
      },
    };
  }
  const manifest = {
    version: '1.1.0-baked-packages',
    generatedAt: new Date().toISOString(),
    description: 'Mixamo explorer baked anims — packages: locomotion, traversal, equipped weapon',
    cdnBase: `${CDN}/${PREFIX}`,
    r2Prefix: PREFIX,
    skeleton: 'mixamo',
    maxClips: 20,
    packages,
    required: REQUIRED,
    files: files.map((f) => path.basename(f)),
  };
  const manPath = path.join(SRC, 'anim-pack.manifest.json');
  fs.writeFileSync(manPath, JSON.stringify(manifest, null, 2) + '\n');
  if (!DRY) {
    const key = `${PREFIX}/anim-pack.manifest.json`;
    console.log(`  put ${key}`);
    r2Put(manPath, key, 'application/json');
  }

  console.log(`Done ${ok}/${files.length}`);
  if (!DRY && ok < files.length) process.exit(1);

  if (VERIFY && !DRY) {
    console.log('Verify required anims on CDN…');
    let vOk = 0;
    let vBad = 0;
    for (const name of REQUIRED) {
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
