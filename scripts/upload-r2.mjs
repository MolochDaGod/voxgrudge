/**
 * Upload VoxGrudge static assets to Cloudflare R2 (grudge-assets bucket).
 *
 * Keys: voxgrudge/<relative path>
 * Public: https://assets.grudge-studio.com/voxgrudge/...
 *
 * Usage:
 *   node scripts/upload-r2.mjs                  # critical UI + branding + emblems
 *   node scripts/upload-r2.mjs --all            # full assets/ + branding/ + sample models
 *   node scripts/upload-r2.mjs --dry-run
 *   node scripts/upload-r2.mjs --prefix assets/grudge-game/ui
 *
 * Requires: wrangler logged in (wrangler whoami)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUCKET = process.env.R2_BUCKET || 'grudge-assets';
const APP_PREFIX = 'voxgrudge';
const DRY = process.argv.includes('--dry-run');
const ALL = process.argv.includes('--all');
const prefixArg = (() => {
  const i = process.argv.indexOf('--prefix');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.fbx': 'application/octet-stream',
  '.obj': 'text/plain',
  '.mtl': 'text/plain',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
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

function contentType(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function collectFiles() {
  const files = [];
  if (prefixArg) {
    const abs = path.join(ROOT, prefixArg);
    for (const f of walk(abs)) {
      files.push({ abs: f, rel: path.relative(ROOT, f).replace(/\\/g, '/') });
    }
    return files;
  }
  if (ALL) {
    for (const dir of [
      'assets',
      'branding',
      'vfx',
      'ui/hud',
      'ui/craftpix-rpg',
      'models/kenney',
      'models/creatures',
      'models/anims',
      'models/fantasy',
      'models/buildings',
      'models/city',
      'models/voxels',
    ]) {
      for (const f of walk(path.join(ROOT, dir))) {
        // Skip huge intermediate convert trees if present under models
        const rel = path.relative(ROOT, f).replace(/\\/g, '/');
        if (rel.includes('/work/') || rel.includes('/raw/')) continue;
        files.push({ abs: f, rel });
      }
    }
    return files;
  }
  // Production playable set: HUD chrome + icons + anim packs + creatures + VFX + maps props
  const critical = [
    'branding',
    'assets/grudge-game/ui',
    'assets/grudge-game/class-emblems',
    'assets/grudge-game/emblems',
    'assets/mine-loader/ui-icons',
    'assets/mine-loader/item-icons',
    'ui/hud',
    'ui/craftpix-rpg',
    'vfx',
    'models/kenney',
    'models/creatures',
    'models/anims',
    'models/fantasy',
    'models/buildings',
    'models/city',
    'models/weapons',
    'models/voxels/free-rpg',
    'avatar/races',
    'assets/voxels/avatar-races',
    'assets/lava-biome',
    'ui/hud/party-frames',
  ];
  for (const dir of critical) {
    for (const f of walk(path.join(ROOT, dir))) {
      files.push({ abs: f, rel: path.relative(ROOT, f).replace(/\\/g, '/') });
    }
  }
  return files;
}

function resolveWranglerJs() {
  if (process.env.WRANGLER_JS && fs.existsSync(process.env.WRANGLER_JS)) return process.env.WRANGLER_JS;
  const candidates = [
    path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
    path.join(process.env.USERPROFILE || '', 'npm-global', 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
    'C:/Users/nugye/npm-global/node_modules/wrangler/bin/wrangler.js',
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

function putOne(abs, rel) {
  const key = `${APP_PREFIX}/${rel}`;
  const ct = contentType(abs);
  if (DRY) {
    console.log(`[dry] ${key} (${ct})`);
    return { ok: true, dry: true };
  }
  const needsPipe = /[&^%!]/.test(abs) || /[&^%!]/.test(key);
  const wranglerJs = resolveWranglerJs();
  const run = (args, opts = {}) => {
    if (wranglerJs) {
      return spawnSync(process.execPath, [wranglerJs, ...args], {
        encoding: opts.encoding || 'utf8',
        shell: false,
        windowsHide: true,
        input: opts.input,
        maxBuffer: 32 * 1024 * 1024,
      });
    }
    return spawnSync('wrangler', args, {
      encoding: opts.encoding || 'utf8',
      shell: true,
      windowsHide: true,
      input: opts.input,
      maxBuffer: 32 * 1024 * 1024,
    });
  };

  let r;
  if (needsPipe) {
    // Avoid cmd.exe splitting on & in paths like Scroll_Bars_&_Sliders
    const buf = fs.readFileSync(abs);
    r = run(
      ['r2', 'object', 'put', `${BUCKET}/${key}`, '--pipe', '--content-type', ct, '--remote'],
      { input: buf, encoding: 'buffer' },
    );
  } else {
    r = run(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', abs, '--content-type', ct, '--remote']);
  }
  if (r.status !== 0) {
    const err = (r.stderr && r.stderr.toString ? r.stderr.toString() : r.stderr) ||
      (r.stdout && r.stdout.toString ? r.stdout.toString() : r.stdout) || '';
    console.error(`FAIL ${key}\n${String(err).slice(0, 400)}`);
    return { ok: false, key };
  }
  return { ok: true, key };
}

async function main() {
  const files = collectFiles();
  console.log(`Upload target: r2://${BUCKET}/${APP_PREFIX}/  files=${files.length} dry=${DRY}`);
  let ok = 0;
  let fail = 0;
  const concurrency = 4;
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const results = batch.map((f) => putOne(f.abs, f.rel));
    for (const r of results) {
      if (r.ok) ok++;
      else fail++;
    }
    if ((i + concurrency) % 40 === 0 || i + concurrency >= files.length) {
      console.log(`… ${Math.min(i + concurrency, files.length)}/${files.length} (ok=${ok} fail=${fail})`);
    }
  }
  const manifest = {
    generated: new Date().toISOString(),
    bucket: BUCKET,
    prefix: APP_PREFIX,
    publicBase: `https://assets.grudge-studio.com/${APP_PREFIX}/`,
    count: files.length,
    ok,
    fail,
    dry: DRY,
  };
  const outPath = path.join(ROOT, 'data', 'r2-upload-manifest.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  console.log(`Done ok=${ok} fail=${fail} → ${outPath}`);
  if (!DRY && ok > 0) {
    console.log(`Sample: https://assets.grudge-studio.com/${APP_PREFIX}/assets/grudge-game/ui/Window/Window_Background.png`);
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
