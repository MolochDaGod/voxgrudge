/**
 * Full The Voxel Store (TVS) pipeline — convert + asset-database best practices.
 *
 * Source of truth: https://the-voxel-store.itch.io/ packs already on CDN:
 *   models/voxels/tvs/{voxel-cathedral|farm|knights|palace|rangers|village|wizards}/
 *
 * Steps:
 *   1. Audit catalog + roster from local/CDN
 *   2. Convert all character units → production GLB (height 2.0m, atlas, collider)
 *   3. Convert static env/props/animals → production GLB (meshopt path via glb2glb)
 *   4. Emit production catalog + D1 registry seed + promote report
 *
 * Usage:
 *   node scripts/pipeline-tvs-full.mjs --dry-run
 *   node scripts/pipeline-tvs-full.mjs --characters-only
 *   node scripts/pipeline-tvs-full.mjs --statics --limit-static 20
 *   node scripts/pipeline-tvs-full.mjs --all
 *   node scripts/pipeline-tvs-full.mjs --all --upload
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
const DRY = args.includes("--dry-run");
const DO_CHARS = args.includes("--all") || args.includes("--characters-only") || args.includes("--characters");
const DO_STATIC = args.includes("--all") || args.includes("--statics");
const DO_UPLOAD = args.includes("--upload");
const ONLY_AUDIT = !DO_CHARS && !DO_STATIC;
const limS = args.indexOf("--limit-static");
const LIMIT_STATIC = limS >= 0 ? parseInt(args[limS + 1], 10) : 0;
const limC = args.indexOf("--limit");
const LIMIT_CHARS = limC >= 0 ? parseInt(args[limC + 1], 10) : 0;

const PLAYER_H = 2.0;

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function sha1Uuid(r2Key) {
  const h = crypto.createHash("sha1").update("grudge-asset:" + r2Key).digest();
  const b = Buffer.from(h);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${r.status} ${url}`);
  return r.json();
}

async function download(url, dest) {
  ensureDir(path.dirname(dest));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 64) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // reject HTML
  const head = buf.slice(0, 20).toString("utf8");
  if (head.includes("<!DOCTYPE") || head.includes("<html")) {
    throw new Error("HTML fake-200: " + url);
  }
  fs.writeFileSync(dest, buf);
  return dest;
}

function runConvert(cmdArgs) {
  if (DRY) {
    console.log("  DRY convert", cmdArgs.join(" "));
    return true;
  }
  if (!fs.existsSync(CONVERT)) {
    console.error("grudge-convert missing", CONVERT);
    return false;
  }
  const r = spawnSync(process.execPath, [CONVERT, ...cmdArgs], {
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

function convertCharacter(fbxPath, texPath, glbOut) {
  ensureDir(path.dirname(glbOut));
  const a = [
    "fbx2glb",
    fbxPath,
    "-o",
    glbOut,
    "--height",
    String(PLAYER_H),
    "--texture-size",
    "256",
    "--texture-format",
    "png",
  ];
  if (texPath && fs.existsSync(texPath)) a.push("--texture", texPath);
  return runConvert(a) && (DRY || fs.existsSync(glbOut));
}

function convertStatic(fbxPath, glbOut) {
  ensureDir(path.dirname(glbOut));
  // Static props: glb2glb after fbx2glb without height (preserve voxel scale, then light normalize at runtime)
  const rawGlb = glbOut.replace(/\.glb$/i, ".raw.glb");
  const ok1 = runConvert(["fbx2glb", fbxPath, "-o", rawGlb, "--texture-size", "512", "--texture-format", "png", "--no-colliders"]);
  if (!ok1 && !DRY) return false;
  if (DRY) return true;
  if (!fs.existsSync(rawGlb)) return false;
  const ok2 = runConvert(["glb2glb", rawGlb, "-o", glbOut, "--texture-size", "512", "--no-colliders"]);
  try {
    fs.unlinkSync(rawGlb);
  } catch {
    /* ignore */
  }
  return ok2 && fs.existsSync(glbOut);
}

async function loadCatalog() {
  try {
    return await fetchJson(`${CDN}/${R2_PREFIX}/catalog.json`);
  } catch {
    return JSON.parse(fs.readFileSync(LOCAL_CATALOG, "utf8"));
  }
}

async function loadRoster() {
  try {
    return await fetchJson(`${CDN}/${R2_PREFIX}/unit-roster.json`);
  } catch {
    return JSON.parse(fs.readFileSync(LOCAL_ROSTER, "utf8"));
  }
}

function absCdn(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${CDN}/${String(u).replace(/^\//, "")}`;
}

function glbKeyFromR2(r2Key) {
  return String(r2Key).replace(/\.fbx$/i, ".glb");
}

async function main() {
  ensureDir(OUT);
  ensureDir(WORK);

  console.log("[tvs-pipeline] audit…");
  const catalog = await loadCatalog();
  const roster = await loadRoster();
  const assets = catalog.assets || {};
  const assetList = Object.values(assets);

  const audit = {
    generatedAt: new Date().toISOString(),
    source: "https://the-voxel-store.itch.io/",
    packs: Object.keys(catalog.packs || {}),
    catalogAssets: assetList.length,
    rosterUnits: (roster.units || []).length,
    byRole: {},
    practices: [
      "Bake with grudge-convert (fbx2glb/glb2glb) before R2",
      "Characters: height 2.0m, atlas rebind, collider.json, anims.json",
      "Static env/props: production GLB, NearestFilter voxel materials",
      "Runtime: TvsUnitLoader preferGlb + magic-byte verify",
      "Registry: deterministic UUID from r2Key + D1 seed",
      "Never HTML fake-200; never untextured capsules as final",
    ],
  };
  for (const a of assetList) {
    const role = a.role || a.kind || "unk";
    audit.byRole[role] = (audit.byRole[role] || 0) + 1;
  }
  console.log(JSON.stringify({ packs: audit.packs, units: audit.rosterUnits, assets: audit.catalogAssets, byRole: audit.byRole }, null, 2));

  if (ONLY_AUDIT) {
    fs.writeFileSync(path.join(OUT, "pipeline-audit.json"), JSON.stringify(audit, null, 2));
    console.log("[tvs-pipeline] audit-only written. Pass --characters / --statics / --all to convert.");
    return;
  }

  const results = { characters: { ok: 0, fail: 0 }, statics: { ok: 0, fail: 0 }, rows: [] };

  // ── Characters via existing convert script ───────────────────────────────
  if (DO_CHARS) {
    console.log("[tvs-pipeline] characters…");
    const convArgs = [path.join(ROOT, "scripts", "convert-tvs-heroes.mjs")];
    if (LIMIT_CHARS > 0) convArgs.push("--limit", String(LIMIT_CHARS));
    if (DRY) {
      console.log("  DRY would run convert-tvs-heroes", convArgs.slice(1).join(" "));
    } else {
      const r = spawnSync(process.execPath, convArgs, {
        encoding: "utf8",
        cwd: ROOT,
        stdio: "inherit",
        env: process.env,
      });
      if (r.status !== 0) console.error("character convert exited", r.status);
    }
    // Count outputs
    let n = 0;
    function walk(d) {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.glb$/i.test(e.name) && p.includes(`${path.sep}characters${path.sep}`)) n++;
      }
    }
    walk(OUT);
    results.characters.ok = n;
  }

  // ── Static env / props / animals / animations (never characters) ────────
  if (DO_STATIC) {
    console.log("[tvs-pipeline] statics (environment/props/animals/animations)…");
    // IMPORTANT: do NOT match characters via loose tag regex — that re-baked
    // farm heroes without --height 2.0 and wiped colliders/atlases.
    const statics = assetList.filter((a) => {
      const role = String(a.role || a.kind || "").toLowerCase();
      const r2 = a.r2Key || String(a.cdnUrl || "");
      if (/\/characters\//i.test(r2)) return false;
      if (["character", "characters"].includes(role)) return false;
      return ["environment", "props", "animals", "prop", "env", "animations", "animation"].includes(role);
    }).filter((a) => (a.r2Key || a.cdnUrl || "").match(/\.fbx$/i));

    let list = statics;
    if (LIMIT_STATIC > 0) list = list.slice(0, LIMIT_STATIC);
    console.log(`  converting ${list.length} / ${statics.length} static FBX`);

    for (const a of list) {
      const r2 = a.r2Key || String(a.cdnUrl || "").replace(CDN + "/", "");
      const url = absCdn(a.cdnUrl || r2);
      const glbR2 = glbKeyFromR2(r2);
      const rel = glbR2.replace(new RegExp("^" + R2_PREFIX + "/"), "");
      const glbOut = path.join(OUT, rel);
      const workFbx = path.join(WORK, r2.replace(/\//g, "__"));

      try {
        if (!DRY) await download(url, workFbx);
        const ok = convertStatic(workFbx, glbOut);
        if (ok) {
          results.statics.ok++;
          results.rows.push({
            role: a.role || a.kind,
            r2Key: glbR2,
            sourceFbx: r2,
            grudgeUuid: sha1Uuid(glbR2),
            local: glbOut,
          });
          console.log("  OK", rel);
        } else {
          results.statics.fail++;
          console.warn("  FAIL", rel);
        }
      } catch (e) {
        results.statics.fail++;
        console.warn("  FAIL", r2, e.message);
      }
    }
  }

  // ── Production catalog overlay (glbUrl on every FBX asset) ───────────────
  const prodCatalog = JSON.parse(JSON.stringify(catalog));
  const prodAssets = prodCatalog.assets || {};
  for (const [id, a] of Object.entries(prodAssets)) {
    const r2 = a.r2Key || "";
    if (/\.fbx$/i.test(r2)) {
      const glbR2 = glbKeyFromR2(r2);
      a.glbR2Key = glbR2;
      a.glbUrl = `${CDN}/${glbR2}`;
      a.grudgeUuid = a.grudgeUuid || sha1Uuid(r2);
      a.production = a.production || {
        preferGlb: true,
        scale: (a.role === "characters" || a.kind === "characters") ? { heightM: PLAYER_H } : { mode: "native_voxel" },
        texture: "nearest",
        pipeline: "grudge-convert",
      };
    }
  }
  ensureDir(OUT);
  fs.writeFileSync(path.join(OUT, "catalog.production.json"), JSON.stringify(prodCatalog, null, 2));

  // D1 registry seed (batch-friendly)
  const d1Rows = [];
  for (const a of Object.values(prodAssets)) {
    const r2 = a.glbR2Key || a.r2Key;
    if (!r2) continue;
    d1Rows.push({
      grudge_uuid: a.grudgeUuid || sha1Uuid(r2),
      r2_key: r2,
      category: a.role || a.kind || "tvs",
      content_type: r2.endsWith(".glb") ? "model/gltf-binary" : r2.endsWith(".png") ? "image/png" : "application/octet-stream",
      source_set: "the-voxel-store",
      tags: (a.tags || []).join(","),
      cdn_url: `${CDN}/${r2}`,
      pack: (a.tags || []).find((t) => String(t).startsWith("voxel-")) || null,
    });
  }
  const seedPath = path.join(OUT, "d1-registry-seed-tvs.json");
  fs.writeFileSync(
    seedPath,
    JSON.stringify(
      {
        version: "1.0.0",
        generatedAt: new Date().toISOString(),
        bucket: "grudge-assets",
        table: "asset_registry",
        practices: audit.practices,
        count: d1Rows.length,
        rows: d1Rows,
      },
      null,
      2,
    ),
  );

  // Copy seed into ObjectStore + library
  const osSeed = path.join(ROOT, "..", "ObjectStore", "data", "seeds", "tvs-d1-registry-seed.json");
  try {
    ensureDir(path.dirname(osSeed));
    fs.copyFileSync(seedPath, osSeed);
  } catch (e) {
    console.warn("ObjectStore seed copy", e.message);
  }

  const report = {
    ...audit,
    results,
    outputs: {
      productionDir: OUT,
      catalogProduction: path.join(OUT, "catalog.production.json"),
      d1Seed: seedPath,
    },
  };
  fs.writeFileSync(path.join(OUT, "pipeline-report.json"), JSON.stringify(report, null, 2));
  console.log("[tvs-pipeline] done", JSON.stringify(results));

  if (DO_UPLOAD && !DRY) {
    console.log("[tvs-pipeline] upload…");
    spawnSync(process.execPath, [path.join(ROOT, "scripts", "upload-tvs-production.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
