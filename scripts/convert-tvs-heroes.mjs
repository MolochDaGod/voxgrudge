/**
 * Convert TVS hero FBX (+ atlas) → production GLB pack for VoxGrudge.
 *
 *   npm run convert:tvs
 *   npm run convert:tvs -- --limit 6
 *   npm run convert:tvs -- --unit voxel-knights-champion
 *
 * Uses ObjectStore grudge-convert (fbx2glb):
 *   --height 2.0  --texture <png>  --texture-size 256  --texture-format png
 *
 * Outputs:
 *   dist/tvs/production/{pack}/characters/{unitId}.glb
 *   dist/tvs/production/{pack}/characters/{unitId}.collider.json
 *   dist/tvs/production/{pack}/characters/{unitId}.manifest.json
 *   dist/tvs/production/unit-roster.production.json  (glbUrl + baked meta)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CDN = 'https://assets.grudge-studio.com';
const OUT = path.join(ROOT, 'dist', 'tvs', 'production');
const WORK = path.join(ROOT, 'dist', 'tvs', 'work');
const ROSTER_LOCAL = path.join(ROOT, 'assets', 'voxels', 'unit-roster.json');
const CONVERT = path.join(ROOT, '..', 'ObjectStore', 'tools', 'grudge-convert', 'bin', 'grudge-convert.mjs');

const PLAYER_H = 2.0;
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;
const unitIdx = args.indexOf('--unit');
const onlyUnit = unitIdx >= 0 ? args[unitIdx + 1] : null;

const TEXTURE_ALIASES = {
  'voxel-farm-farm-hand':
    `${CDN}/models/voxels/tvs/voxel-farm/textures/voxel-farm-farmer-texture.png`,
  'voxel-knights-knight-helm-down':
    `${CDN}/models/voxels/tvs/voxel-knights/textures/voxel-knights-knight-texture.png`,
  'voxel-rangers-hooded':
    `${CDN}/models/voxels/tvs/voxel-rangers/textures/voxel-rangers-captain-texture.png`,
  'voxel-rangers-hooded-with-stubble':
    `${CDN}/models/voxels/tvs/voxel-rangers/textures/voxel-rangers-captain-texture.png`,
  'voxel-rangers-long-hair':
    `${CDN}/models/voxels/tvs/voxel-rangers/textures/voxel-rangers-captain-texture.png`,
  'voxel-rangers-long-hair-and-beard':
    `${CDN}/models/voxels/tvs/voxel-rangers/textures/voxel-rangers-captain-texture.png`,
  'voxel-village-jeweller':
    `${CDN}/models/voxels/tvs/voxel-village/textures/voxel-village-barmaid-texture.png`,
};

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

async function download(url, dest) {
  if (!url) throw new Error('no url');
  ensureDir(path.dirname(dest));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 64) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

function convertOne(fbxPath, texPath, glbOut) {
  ensureDir(path.dirname(glbOut));
  const cmdArgs = [
    CONVERT,
    'fbx2glb',
    fbxPath,
    '-o',
    glbOut,
    '--height',
    String(PLAYER_H),
    '--texture-size',
    '256',
    '--texture-format',
    'png',
  ];
  if (texPath && fs.existsSync(texPath)) {
    cmdArgs.push('--texture', texPath);
  }
  const r = spawnSync(process.execPath, cmdArgs, {
    encoding: 'utf8',
    cwd: path.dirname(path.dirname(CONVERT)),
    env: {
      ...process.env,
      BLENDER_PATH: process.env.BLENDER_PATH || path.join(process.env.USERPROFILE || '', 'tools', 'Blender', 'blender.exe'),
    },
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    return false;
  }
  return fs.existsSync(glbOut);
}

async function main() {
  if (!fs.existsSync(CONVERT)) {
    console.error('grudge-convert missing at', CONVERT);
    process.exit(1);
  }
  ensureDir(OUT);
  ensureDir(WORK);

  let roster;
  try {
    const res = await fetch(`${CDN}/models/voxels/tvs/unit-roster.json`);
    roster = await res.json();
  } catch {
    roster = JSON.parse(fs.readFileSync(ROSTER_LOCAL, 'utf8'));
  }

  let units = roster.units || [];
  if (onlyUnit) units = units.filter((u) => u.unitId === onlyUnit);
  if (limit > 0) units = units.slice(0, limit);

  console.log(`convert-tvs: ${units.length} unit(s) → ${OUT}`);
  const produced = [];
  let ok = 0;
  let fail = 0;

  for (const u of units) {
    const id = u.unitId;
    const pack = u.pack || 'unknown';
    const fbxUrl = u.modelUrl || u.meshUrl;
    const texUrl = TEXTURE_ALIASES[id] || u.textureUrl;
    if (!fbxUrl) {
      console.warn('skip no model', id);
      fail++;
      continue;
    }
    const rawDir = path.join(WORK, pack, id);
    const fbxPath = path.join(rawDir, `${id}.fbx`);
    const texPath = path.join(rawDir, `${id}-texture.png`);
    const glbOut = path.join(OUT, pack, 'characters', `${id}.glb`);

    try {
      process.stdout.write(`  ${id}… `);
      await download(fbxUrl, fbxPath);
      try {
        await download(texUrl, texPath);
      } catch (e) {
        console.warn(`tex miss (${e.message}), convert without rebind`);
      }
      const done = convertOne(fbxPath, fs.existsSync(texPath) ? texPath : null, glbOut);
      if (!done) {
        console.log('FAIL convert');
        fail++;
        continue;
      }
      const size = fs.statSync(glbOut).size;
      const glbUrl = `${CDN}/models/voxels/tvs/${pack}/characters/${id}.glb`;
      const entry = {
        ...u,
        modelUrl: fbxUrl,
        textureUrl: texUrl,
        glbUrl,
        production: {
          height: PLAYER_H,
          compressed: true,
          textureFormat: 'png-in-glb',
          glbBytes: size,
          bakedAt: new Date().toISOString(),
        },
      };
      produced.push(entry);
      ok++;
      console.log(`OK ${(size / 1024).toFixed(1)}KB`);
    } catch (e) {
      console.log('FAIL', e.message || e);
      fail++;
    }
  }

  const outRoster = {
    version: '3.0.0-production',
    generatedAt: new Date().toISOString(),
    description: 'TVS heroes with production GLB (height 2.0m, compressed, atlas baked)',
    cdnBase: CDN,
    r2Prefix: 'models/voxels/tvs',
    playerHeightM: PLAYER_H,
    units: produced.length ? produced : units,
  };

  // Merge: prefer produced glbUrl into full roster
  if (produced.length && produced.length < (roster.units || []).length) {
    const byId = new Map(produced.map((u) => [u.unitId, u]));
    outRoster.units = (roster.units || []).map((u) => byId.get(u.unitId) || u);
  }

  const rosterPath = path.join(OUT, 'unit-roster.production.json');
  fs.writeFileSync(rosterPath, JSON.stringify(outRoster, null, 2) + '\n');
  // Also refresh local assets roster with glbUrl when we have them
  const localMerged = {
    ...JSON.parse(fs.readFileSync(ROSTER_LOCAL, 'utf8')),
    version: outRoster.version,
    generatedAt: outRoster.generatedAt,
    playerHeightM: PLAYER_H,
    units: outRoster.units,
  };
  fs.writeFileSync(ROSTER_LOCAL, JSON.stringify(localMerged, null, 2) + '\n');

  console.log(`\nDone ok=${ok} fail=${fail}`);
  console.log(`Roster: ${rosterPath}`);
  console.log(`Upload: npm run upload:tvs`);
  process.exit(fail && !ok ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
