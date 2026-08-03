/**
 * Convert TVS pack animation FBX → production GLB and rebuild per-unit anims.json
 * (prefer GLB URLs for AnimationMixer; FBX kept as fallback).
 *
 *   node scripts/pipeline-tvs-anims.mjs
 *   node scripts/pipeline-tvs-anims.mjs --upload
 *   node scripts/pipeline-tvs-anims.mjs --skip-convert   # only rewrite anims.json
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CDN = "https://assets.grudge-studio.com";
const R2_PREFIX = "models/voxels/tvs";
const OUT = path.join(ROOT, "dist", "tvs", "production");
const WORK = path.join(ROOT, "dist", "tvs", "work");
const CONVERT = path.join(ROOT, "..", "ObjectStore", "tools", "grudge-convert", "bin", "grudge-convert.mjs");
const LOCAL_CATALOG = path.join(ROOT, "assets", "voxels", "catalog.json");
const LOCAL_ROSTER = path.join(ROOT, "assets", "voxels", "unit-roster.json");

const args = process.argv.slice(2);
const DO_UPLOAD = args.includes("--upload");
const SKIP_CONVERT = args.includes("--skip-convert");

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

async function download(url, dest) {
  ensureDir(path.dirname(dest));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 64) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.slice(0, 20).toString("utf8");
  if (head.includes("<!DOCTYPE") || head.includes("<html")) throw new Error("HTML fake-200: " + url);
  fs.writeFileSync(dest, buf);
  return dest;
}

function runConvert(argv) {
  const r = spawnSync(process.execPath, [CONVERT, ...argv], {
    encoding: "utf8",
    cwd: path.dirname(path.dirname(CONVERT)),
    env: {
      ...process.env,
      BLENDER_PATH:
        process.env.BLENDER_PATH ||
        path.join(process.env.USERPROFILE || "", "tools", "Blender", "blender.exe"),
    },
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || "convert failed");
    return false;
  }
  return true;
}

function convertAnim(fbxPath, glbOut) {
  ensureDir(path.dirname(glbOut));
  const rawGlb = glbOut.replace(/\.glb$/i, ".raw.glb");
  const ok1 = runConvert([
    "fbx2glb",
    fbxPath,
    "-o",
    rawGlb,
    "--texture-size",
    "256",
    "--texture-format",
    "png",
    "--no-colliders",
  ]);
  if (!ok1 || !fs.existsSync(rawGlb)) return false;
  const ok2 = runConvert(["glb2glb", rawGlb, "-o", glbOut, "--texture-size", "256", "--no-colliders"]);
  try {
    fs.unlinkSync(rawGlb);
  } catch {
    /* ignore */
  }
  return ok2 && fs.existsSync(glbOut);
}

function semanticFromSlug(slug) {
  const s = String(slug || "").toLowerCase();
  if (/idle/.test(s)) return "idle";
  if (/walk|run|locomotion/.test(s)) return "locomotion";
  if (/slash|attack|swing|chop|dig|peck|shoot|cast|magic/.test(s)) return "attack";
  if (/defend|block|parry|shield/.test(s)) return "defend";
  if (/jump/.test(s)) return "jump";
  if (/sit|sitting/.test(s)) return "sit";
  if (/pray|preach/.test(s)) return "emote";
  return "other";
}

function scoreHuman(slug, semantic) {
  let n = 0;
  if (/human/.test(slug)) n += 50;
  if (/animal|cow|pig|sheep|chicken|duck|bull|horse|owl|corgi|goat|rooster|mallard/.test(slug)) n -= 40;
  if (semantic === "idle") n += 2;
  return n;
}

async function loadCatalog() {
  try {
    const r = await fetch(`${CDN}/${R2_PREFIX}/catalog.json`);
    if (r.ok) return r.json();
  } catch {
    /* local */
  }
  return JSON.parse(fs.readFileSync(LOCAL_CATALOG, "utf8"));
}

async function loadRoster() {
  const prod = path.join(OUT, "unit-roster.production.json");
  if (fs.existsSync(prod)) return JSON.parse(fs.readFileSync(prod, "utf8"));
  try {
    const r = await fetch(`${CDN}/${R2_PREFIX}/unit-roster.json`);
    if (r.ok) return r.json();
  } catch {
    /* local */
  }
  return JSON.parse(fs.readFileSync(LOCAL_ROSTER, "utf8"));
}

function absCdn(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${CDN}/${String(u).replace(/^\//, "")}`;
}

async function main() {
  ensureDir(OUT);
  ensureDir(WORK);
  const catalog = await loadCatalog();
  const roster = await loadRoster();
  const assets = Object.values(catalog.assets || {});
  const animAssets = assets.filter((a) => {
    const role = String(a.role || a.kind || "").toLowerCase();
    return (role === "animations" || role === "animation") && /\.fbx$/i.test(a.r2Key || a.cdnUrl || "");
  });

  console.log(`[tvs-anims] ${animAssets.length} animation FBX in catalog`);
  let ok = 0;
  let fail = 0;
  const byPack = new Map();

  for (const a of animAssets) {
    const r2 = a.r2Key || String(a.cdnUrl || "").replace(CDN + "/", "");
    const glbR2 = r2.replace(/\.fbx$/i, ".glb");
    const rel = glbR2.replace(new RegExp("^" + R2_PREFIX + "/"), "");
    const glbOut = path.join(OUT, rel);
    const pack = a.pack || rel.split("/")[0];
    const slug = a.slug || path.basename(r2, ".fbx");
    const semantic = semanticFromSlug(slug);
    const entry = {
      id: slug,
      semantic,
      url: `${CDN}/${glbR2}`,
      fbxUrl: `${CDN}/${r2}`,
      r2Key: glbR2,
      fbxR2Key: r2,
      grudgeUuid: a.grudgeUuid || null,
      pack,
    };
    if (!byPack.has(pack)) byPack.set(pack, []);
    byPack.get(pack).push(entry);

    if (SKIP_CONVERT) {
      if (fs.existsSync(glbOut)) ok++;
      continue;
    }
    if (fs.existsSync(glbOut) && fs.statSync(glbOut).size > 64) {
      console.log("  skip", rel);
      ok++;
      continue;
    }
    try {
      process.stdout.write(`  ${rel}… `);
      const fbxPath = path.join(WORK, r2.replace(/\//g, "__"));
      await download(absCdn(a.cdnUrl || r2), fbxPath);
      if (!convertAnim(fbxPath, glbOut)) {
        console.log("FAIL");
        fail++;
        // Keep entry pointing at FBX if GLB bake fails
        entry.url = entry.fbxUrl;
        entry.r2Key = r2;
        continue;
      }
      console.log(`OK ${(fs.statSync(glbOut).size / 1024).toFixed(1)}KB`);
      ok++;
    } catch (e) {
      console.log("FAIL", e.message || e);
      fail++;
      entry.url = entry.fbxUrl;
      entry.r2Key = r2;
    }
  }

  // Per-unit anims.json from pack clip pool (prefer human clips for heroes)
  const units = roster.units || [];
  let animsWritten = 0;
  for (const u of units) {
    const pack = u.pack;
    const pool = byPack.get(pack) || [];
    if (!pool.length) continue;

    const bySem = {};
    for (const c of pool) {
      if (!bySem[c.semantic]) bySem[c.semantic] = [];
      bySem[c.semantic].push(c);
    }
    const clips = {};
    for (const sem of ["idle", "locomotion", "attack", "defend", "jump", "sit", "emote"]) {
      const list = (bySem[sem] || []).slice().sort((a, b) => scoreHuman(b.id, sem) - scoreHuman(a.id, sem));
      if (!list.length) continue;
      const best = list[0];
      const glbExists =
        fs.existsSync(path.join(OUT, best.r2Key.replace(new RegExp("^" + R2_PREFIX + "/"), ""))) ||
        /\.glb$/i.test(best.url);
      clips[sem] = {
        id: best.id,
        semantic: sem,
        url: glbExists ? best.url : best.fbxUrl,
        glbUrl: best.url.endsWith(".glb") ? best.url : best.url.replace(/\.fbx$/i, ".glb"),
        fbxUrl: best.fbxUrl,
        r2Key: glbExists ? best.r2Key : best.fbxR2Key,
        grudgeUuid: best.grudgeUuid,
      };
    }

    const anims = {
      unitId: u.unitId,
      skeleton: "humanoid",
      classHint: u.classHint || null,
      preferGlb: true,
      clips,
      allClips: pool.map((c) => ({
        id: c.id,
        semantic: c.semantic,
        url: c.url,
        glbUrl: c.url.endsWith(".glb") ? c.url : undefined,
        fbxUrl: c.fbxUrl,
        r2Key: c.r2Key,
        grudgeUuid: c.grudgeUuid,
      })),
      generatedAt: new Date().toISOString(),
      pipeline: "pipeline-tvs-anims",
    };

    const outPath = path.join(OUT, pack, "characters", `${u.unitId}.anims.json`);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, JSON.stringify(anims, null, 2) + "\n");
    animsWritten++;
  }

  console.log(`\n[tvs-anims] convert ok=${ok} fail=${fail}; anims.json=${animsWritten}`);

  // Refresh production roster animationPackUrl (already correct path)
  const rosterPath = path.join(OUT, "unit-roster.production.json");
  if (fs.existsSync(rosterPath)) {
    const r = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
    r.generatedAt = new Date().toISOString();
    r.animsPreferGlb = true;
    fs.writeFileSync(rosterPath, JSON.stringify(r, null, 2) + "\n");
  }
  // Promote into local assets roster
  if (fs.existsSync(LOCAL_ROSTER) && fs.existsSync(rosterPath)) {
    const local = JSON.parse(fs.readFileSync(LOCAL_ROSTER, "utf8"));
    const prod = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
    const byId = new Map((prod.units || []).map((u) => [u.unitId, u]));
    local.units = (local.units || []).map((u) => {
      const p = byId.get(u.unitId);
      if (!p) return u;
      return {
        ...u,
        glbUrl: p.glbUrl || u.glbUrl,
        production: p.production || u.production,
        animationPackUrl:
          u.animationPackUrl ||
          `${CDN}/${R2_PREFIX}/${u.pack}/characters/${u.unitId}.anims.json`,
      };
    });
    local.version = prod.version || local.version;
    local.generatedAt = new Date().toISOString();
    local.playerHeightM = 2.0;
    fs.writeFileSync(LOCAL_ROSTER, JSON.stringify(local, null, 2) + "\n");
    console.log("[tvs-anims] promoted assets/voxels/unit-roster.json");
  }

  if (DO_UPLOAD) {
    console.log("[tvs-anims] upload…");
    const up = spawnSync(process.execPath, [path.join(ROOT, "scripts", "upload-tvs-production.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    process.exit(up.status || 0);
  }
  process.exit(fail && !ok ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
