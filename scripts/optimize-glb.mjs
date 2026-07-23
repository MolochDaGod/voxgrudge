/**
 * Optimize GLB files with @gltf-transform (Meshopt + WebP textures).
 *
 *   npm run optimize:glb -- models/creatures/cheetah.glb
 *   npm run optimize:glb -- models/creatures --out dist/models
 *
 * Requires: npm i -D @gltf-transform/cli (or project devDependency)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2).filter((a) => a !== '--');
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : null;
const inputs = args.filter((_, i) => outIdx < 0 || (i !== outIdx && i !== outIdx + 1));

function walkGlb(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkGlb(p, out);
    else if (/\.glb$/i.test(ent.name)) out.push(p);
  }
  return out;
}

function resolveInputs() {
  const files = [];
  for (const raw of inputs.length ? inputs : ['models']) {
    const abs = path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) walkGlb(abs, files);
    else if (fs.existsSync(abs)) files.push(abs);
    else console.warn('skip missing', raw);
  }
  return files;
}

function hasCli() {
  const r = spawnSync('npx', ['--no-install', 'gltf-transform', '--version'], {
    encoding: 'utf8',
    shell: true,
    cwd: ROOT,
  });
  return r.status === 0;
}

function optimize(src) {
  const rel = path.relative(ROOT, src);
  const dest = outDir
    ? path.join(ROOT, outDir, rel)
    : src.replace(/\.glb$/i, '.opt.glb');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = spawnSync(
    'npx',
    [
      'gltf-transform',
      'optimize',
      src,
      dest,
      '--compress',
      'meshopt',
      '--texture-compress',
      'webp',
      '--texture-size',
      '1024',
    ],
    { encoding: 'utf8', shell: true, cwd: ROOT },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    return false;
  }
  const before = fs.statSync(src).size;
  const after = fs.statSync(dest).size;
  console.log(`OK ${rel}  ${(before / 1024).toFixed(1)}KB → ${(after / 1024).toFixed(1)}KB`);
  return true;
}

function main() {
  if (!hasCli()) {
    console.error('gltf-transform not found. Run: npm install');
    process.exit(1);
  }
  const files = resolveInputs();
  if (!files.length) {
    console.error('No GLB inputs');
    process.exit(1);
  }
  console.log(`Optimizing ${files.length} GLB(s)…`);
  let ok = 0;
  for (const f of files) if (optimize(f)) ok++;
  console.log(`Done ${ok}/${files.length}`);
  process.exit(ok === files.length ? 0 : 1);
}

main();
