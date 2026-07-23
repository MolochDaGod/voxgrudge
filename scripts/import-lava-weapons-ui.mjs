/**
 * Import LavaBiome sprites, voxel RPG weapons, free TVS T-pose heroes,
 * and CraftPix/BuildYourself unit-frame UI into VoxGrudge production tree.
 *
 *   node scripts/import-lava-weapons-ui.mjs
 *   node scripts/import-lava-weapons-ui.mjs --convert
 *   node scripts/import-lava-weapons-ui.mjs --convert --upload
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DO_CONVERT = process.argv.includes('--convert');
const DO_UPLOAD = process.argv.includes('--upload');

const CONVERT = path.join(ROOT, '..', 'ObjectStore', 'tools', 'grudge-convert', 'bin', 'grudge-convert.mjs');
const LAVA_SRC = path.join(ROOT, '_asset_unpack', 'LavaBiome', 'LavaBiome');
const WEAPON_SRC = path.join(
  'D:',
  'Games',
  'Models',
  'Voxel RPG Weapons (Individual assets)',
  'Voxel RPG Weapons',
);
const WEAPONS_OBJ = path.join('D:', 'Games', 'Models', 'weapons.obj');
const FREE_CHARS = path.join(ROOT, '_asset_unpack', 'rpgvoxelweapons', 'FreeContent');
const FREE_TEX = path.join(ROOT, '_asset_unpack', 'rpgvoxelweapons', 'DungeonCrawler_Character.png');
const UNIT_FRAMES_SRC = path.join('D:', 'Games', 'Models', 'craftpix-rpg-mmo-ui', 'Textures', 'Unit Frames');
const BUILDYOURSELF_PREVIEW = path.join(ROOT, '_asset_unpack', 'refs', 'lava-biome-itch-preview.png');
// User itch URL is BuildYourself Status Bar preview (not lava 3D)
const BUILDYOURSELF_REF = path.join(ROOT, '_asset_unpack', 'refs', 'buildyourself-status-bar.png');

const OUT_LAVA = path.join(ROOT, 'assets', 'lava-biome');
const OUT_WEAPONS = path.join(ROOT, 'models', 'weapons', 'voxel-rpg');
const OUT_CHARS = path.join(ROOT, 'models', 'voxels', 'free-rpg');
const OUT_FRAMES = path.join(ROOT, 'ui', 'hud', 'party-frames');
const OUT_MANIFEST = path.join(ROOT, 'assets', 'voxels', 'weapon-roster.json');
const OUT_CHAR_MANIFEST = path.join(ROOT, 'assets', 'voxels', 'free-rpg-roster.json');

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return dest;
}

function walkFiles(dir, extFilter) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(p, extFilter));
    else if (!extFilter || extFilter.test(ent.name)) out.push(p);
  }
  return out;
}

function copyTree(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('[skip] missing', src);
    return 0;
  }
  let n = 0;
  for (const f of walkFiles(src)) {
    const rel = path.relative(src, f).replace(/\\/g, '/');
    copyFile(f, path.join(dest, rel));
    n++;
  }
  return n;
}

function runConvert(args) {
  if (!fs.existsSync(CONVERT)) {
    console.error('grudge-convert missing:', CONVERT);
    return false;
  }
  const r = spawnSync(process.execPath, [CONVERT, ...args], {
    stdio: 'inherit',
    cwd: path.dirname(path.dirname(CONVERT)),
  });
  return r.status === 0;
}

function importLava() {
  console.log('\n=== LavaBiome 2D pack → assets/lava-biome ===');
  const n = copyTree(LAVA_SRC, OUT_LAVA);
  // Keep itch preview as art ref
  if (fs.existsSync(BUILDYOURSELF_PREVIEW)) {
    copyFile(BUILDYOURSELF_PREVIEW, path.join(OUT_LAVA, '_refs', 'itch-preview.png'));
  }
  // Manifest for runtime
  const categories = {};
  for (const f of walkFiles(OUT_LAVA, /\.png$/i)) {
    const rel = path.relative(OUT_LAVA, f).replace(/\\/g, '/');
    if (rel.startsWith('_refs/')) continue;
    const cat = rel.split('/')[0] || 'misc';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(rel);
  }
  const man = {
    version: 1,
    source: 'LavaBiome.zip (2D isometric sprites)',
    itchPreview: 'https://img.itch.zone/aW1hZ2UvNjAxNTMzLzMyMTUyMTYucG5n/original/rDFE%2Fa.png',
    categories,
    scatter: {
      trees: (categories.Trees || []).filter((p) => !/SpriteSheet/i.test(p)),
      rocks: (categories.Rocks || []).filter((p) => !/SpriteSheet/i.test(p)),
      plants: (categories.Plants || []).filter((p) => !/SpriteSheet/i.test(p)),
      volcanoes: (categories.Volcano || []).filter((p) => !/SpriteSheet/i.test(p)),
      mounds: (categories.MiniVolcans || []).filter((p) => !/SpriteSheet/i.test(p)),
      constructions: (categories.Constructions || []).filter((p) => !/SpriteSheet/i.test(p)),
      bubbles: (categories.Bubble || []).filter((p) => !/SpriteSheet/i.test(p)),
      tiles: (categories.Tiles || []).filter((p) => !/SpriteSheet/i.test(p)),
    },
  };
  fs.writeFileSync(path.join(OUT_LAVA, 'manifest.json'), JSON.stringify(man, null, 2));
  console.log(`lava files=${n} cats=${Object.keys(categories).join(',')}`);
  return man;
}

function importUnitFrames() {
  console.log('\n=== Unit / party frames (CraftPix + BuildYourself ref) ===');
  ensureDir(OUT_FRAMES);
  let n = 0;
  if (fs.existsSync(UNIT_FRAMES_SRC)) {
    n = copyTree(UNIT_FRAMES_SRC, OUT_FRAMES);
  }
  // BuildYourself Status Bar preview (user itch URL) — full zip was empty/broken
  if (fs.existsSync(BUILDYOURSELF_PREVIEW)) {
    copyFile(BUILDYOURSELF_PREVIEW, path.join(OUT_FRAMES, 'buildyourself-status-bar-sheet.png'));
    // Also copy as branding-friendly name
    copyFile(BUILDYOURSELF_PREVIEW, BUILDYOURSELF_REF);
    n++;
  }
  // Map aliases for CSS
  const aliases = {
    'player-frame.png': 'Avatar/UnitFrame_Avatar_Background.png',
    'player-border.png': 'Avatar/UnitFrame_Avatar_Border.png',
    'party-hp-bg.png': 'Bars/UnitFrame_Party_PB_Background.png',
    'party-mp-bg.png': 'Bars/UnitFrame_Party_SB_Background.png',
    'hp-fill.png': 'Bars/UnitFrame_PB_Fill.png',
    'mp-fill.png': 'Bars/UnitFrame_SB_Fill.png',
    'level-frame.png': 'Level Frame/UnitFrame_LevelFrame_Background.png',
    'buff-frame.png': 'UnitFrame_Buff_Frame.png',
  };
  for (const [alias, rel] of Object.entries(aliases)) {
    const src = path.join(OUT_FRAMES, rel);
    if (fs.existsSync(src)) {
      copyFile(src, path.join(OUT_FRAMES, alias));
      n++;
    }
  }
  console.log(`unit/party frames copied≈${n}`);
  return n;
}

function weaponIdFromFile(name) {
  const base = path.basename(name, path.extname(name));
  return 'voxwpn_' + base.padStart(2, '0');
}

function importWeapons() {
  console.log('\n=== Voxel RPG weapons → models/weapons/voxel-rpg ===');
  ensureDir(OUT_WEAPONS);
  const weapons = [];
  if (!fs.existsSync(WEAPON_SRC)) {
    console.warn('[skip] weapon pack missing', WEAPON_SRC);
  } else {
    // Ensure shared atlas name expected by MTLs
    const pngs = walkFiles(WEAPON_SRC, /\.png$/i).filter((p) => !/preview/i.test(p));
    for (const p of pngs) {
      copyFile(p, path.join(OUT_WEAPONS, path.basename(p)));
    }
    // Common MagicaVoxel atlas name referenced by mtl
    const atlasCandidates = pngs.filter((p) => /Voxel RPG Weapons/i.test(path.basename(p)) || /0\.png$/i.test(path.basename(p)));
    if (atlasCandidates[0]) {
      copyFile(atlasCandidates[0], path.join(OUT_WEAPONS, 'Voxel RPG Weapons-0.png'));
    }
    const objs = walkFiles(WEAPON_SRC, /\.obj$/i).sort();
    for (const obj of objs) {
      const base = path.basename(obj, '.obj');
      const id = weaponIdFromFile(base);
      copyFile(obj, path.join(OUT_WEAPONS, path.basename(obj)));
      const mtl = path.join(path.dirname(obj), base + '.mtl');
      if (fs.existsSync(mtl)) copyFile(mtl, path.join(OUT_WEAPONS, base + '.mtl'));
      const preview = path.join(path.dirname(obj), base + '-preview.png');
      if (fs.existsSync(preview)) copyFile(preview, path.join(OUT_WEAPONS, base + '-preview.png'));
      weapons.push({
        id,
        label: 'Voxel Weapon ' + base,
        obj: `models/weapons/voxel-rpg/${base}.obj`,
        mtl: fs.existsSync(mtl) ? `models/weapons/voxel-rpg/${base}.mtl` : null,
        glb: `models/weapons/voxel-rpg/${base}.glb`,
        preview: fs.existsSync(preview) ? `models/weapons/voxel-rpg/${base}-preview.png` : null,
        heightM: 1.1,
        source: 'Voxel RPG Weapons (Individual assets)',
      });
    }
  }

  // MagicaVoxel multi-weapon OBJ
  if (fs.existsSync(WEAPONS_OBJ)) {
    copyFile(WEAPONS_OBJ, path.join(OUT_WEAPONS, 'weapons_magica.obj'));
    // Synthesize palette MTL if missing (vertex/UV palette)
    const mtlPath = path.join(OUT_WEAPONS, 'bronie.mtl');
    if (!fs.existsSync(mtlPath)) {
      fs.writeFileSync(
        mtlPath,
        `# synthetic MagicaVoxel palette\nnewmtl palette\nillum 1\nKd 0.85 0.85 0.9\nKs 0.1 0.1 0.1\n`,
      );
    }
    // Fix mtllib path in copied obj
    let objTxt = fs.readFileSync(path.join(OUT_WEAPONS, 'weapons_magica.obj'), 'utf8');
    objTxt = objTxt.replace(/mtllib\s+\S+/, 'mtllib bronie.mtl');
    fs.writeFileSync(path.join(OUT_WEAPONS, 'weapons_magica.obj'), objTxt);
    weapons.push({
      id: 'voxwpn_magica_set',
      label: 'Magica Voxel Weapons Set',
      obj: 'models/weapons/voxel-rpg/weapons_magica.obj',
      mtl: 'models/weapons/voxel-rpg/bronie.mtl',
      glb: 'models/weapons/voxel-rpg/weapons_magica.glb',
      heightM: 1.2,
      source: 'weapons.obj',
    });
  }

  const roster = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: weapons.length,
    weapons,
  };
  ensureDir(path.dirname(OUT_MANIFEST));
  fs.writeFileSync(OUT_MANIFEST, JSON.stringify(roster, null, 2));
  console.log(`weapons=${weapons.length}`);
  return roster;
}

function importFreeChars() {
  console.log('\n=== Free RPG T-pose characters → models/voxels/free-rpg ===');
  ensureDir(OUT_CHARS);
  const units = [];
  if (!fs.existsSync(FREE_CHARS)) {
    console.warn('[skip] free chars missing');
    return { units };
  }
  if (fs.existsSync(FREE_TEX)) {
    copyFile(FREE_TEX, path.join(OUT_CHARS, 'DungeonCrawler_Character.png'));
  }
  const fbxs = walkFiles(FREE_CHARS, /\.fbx$/i).sort();
  fbxs.forEach((fbx, i) => {
    const base = path.basename(fbx, '.fbx');
    const id = 'free-rpg-' + String(i).padStart(2, '0') + '-' + base.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    copyFile(fbx, path.join(OUT_CHARS, path.basename(fbx)));
    units.push({
      unitId: id,
      label: base.replace(/_/g, ' '),
      modelUrl: `models/voxels/free-rpg/${path.basename(fbx)}`,
      glbUrl: `models/voxels/free-rpg/${base}.glb`,
      textureUrl: fs.existsSync(FREE_TEX)
        ? 'models/voxels/free-rpg/DungeonCrawler_Character.png'
        : null,
      heightM: 2.0,
      pack: 'free-rpg',
      source: 'rpgvoxelassetsweapons FreeContent / the-voxel-store free',
    });
  });
  const roster = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: units.length,
    units,
  };
  fs.writeFileSync(OUT_CHAR_MANIFEST, JSON.stringify(roster, null, 2));
  console.log(`free chars=${units.length}`);
  return roster;
}

function convertWeapons(roster) {
  console.log('\n=== Convert weapons OBJ → GLB ===');
  let ok = 0;
  let fail = 0;
  for (const w of roster.weapons || []) {
    if (!w.obj) continue;
    const objAbs = path.join(ROOT, w.obj);
    const glbAbs = path.join(ROOT, w.glb);
    if (!fs.existsSync(objAbs)) {
      fail++;
      continue;
    }
    console.log('obj2glb', path.basename(objAbs));
    const args = ['obj2glb', objAbs, '-o', glbAbs, '--height', String(w.heightM || 1.1)];
    if (runConvert(args)) ok++;
    else fail++;
  }
  console.log(`weapons convert ok=${ok} fail=${fail}`);
}

function convertFreeChars(roster) {
  console.log('\n=== Convert free T-pose FBX → GLB (2.0m + atlas) ===');
  let ok = 0;
  let fail = 0;
  for (const u of roster.units || []) {
    const fbxAbs = path.join(ROOT, u.modelUrl);
    const glbAbs = path.join(ROOT, u.glbUrl);
    if (!fs.existsSync(fbxAbs)) {
      fail++;
      continue;
    }
    const args = ['fbx2glb', fbxAbs, '-o', glbAbs, '--height', '2.0', '--texture-size', '256'];
    if (u.textureUrl) {
      const tex = path.join(ROOT, u.textureUrl);
      if (fs.existsSync(tex)) args.push('--texture', tex);
    }
    console.log('fbx2glb', path.basename(fbxAbs));
    if (runConvert(args)) ok++;
    else fail++;
  }
  console.log(`free chars convert ok=${ok} fail=${fail}`);
}

function uploadPrefixes() {
  console.log('\n=== Upload new prefixes to R2 ===');
  const prefixes = [
    'assets/lava-biome',
    'models/weapons',
    'models/voxels/free-rpg',
    'ui/hud/party-frames',
    'assets/voxels/weapon-roster.json',
    'assets/voxels/free-rpg-roster.json',
  ];
  for (const p of prefixes) {
    const abs = path.join(ROOT, p);
    if (!fs.existsSync(abs)) continue;
    console.log('upload', p);
    spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'upload-r2.mjs'), '--prefix', p], {
      stdio: 'inherit',
      cwd: ROOT,
    });
  }
}

async function main() {
  console.log('VoxGrudge asset import — lava / weapons / frames / free TVS');
  const lava = importLava();
  importUnitFrames();
  const weapons = importWeapons();
  const freeChars = importFreeChars();

  if (DO_CONVERT) {
    convertWeapons(weapons);
    convertFreeChars(freeChars);
  }
  if (DO_UPLOAD) uploadPrefixes();

  console.log('\nDone.');
  console.log('  Lava cats:', Object.keys(lava.categories || {}).join(', '));
  console.log('  Weapons:', weapons.count);
  console.log('  Free chars:', freeChars.count);
  console.log('Next: wire loaders + npm run convert (if not --convert) + upload');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
