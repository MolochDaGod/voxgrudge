/**
 * Seed grudge-assets-db.asset_registry from dist/tvs/production/d1-registry-seed-tvs.json
 *
 *   node scripts/seed-tvs-d1.mjs
 *   node scripts/seed-tvs-d1.mjs --dry-run
 *   node scripts/seed-tvs-d1.mjs --limit 50
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SEED =
  process.argv.find((a) => a.startsWith("--seed="))?.split("=")[1] ||
  path.join(ROOT, "dist", "tvs", "production", "d1-registry-seed-tvs.json");
const OS_SEED = path.join(ROOT, "..", "ObjectStore", "data", "seeds", "tvs-d1-registry-seed.json");
const DB = "grudge-assets-db";
const DRY = process.argv.includes("--dry-run");
const limIdx = process.argv.indexOf("--limit");
const LIMIT = limIdx >= 0 ? parseInt(process.argv[limIdx + 1], 10) : 0;
const BATCH = 40;

function esc(s) {
  if (s == null) return "NULL";
  return `'${String(s).replace(/'/g, "''")}'`;
}

function idFromR2(r2) {
  return String(r2)
    .replace(/^models\//, "")
    .replace(/[\/\\.]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function nameFromR2(r2) {
  return path.basename(String(r2)).replace(/\.(glb|fbx|png|json)$/i, "");
}

function mapCategory(c) {
  const x = String(c || "tvs").toLowerCase();
  if (x === "characters" || x === "character") return "character";
  if (x === "animations" || x === "animation") return "animation";
  if (x === "environment" || x === "env") return "environment";
  if (x === "props" || x === "prop") return "item";
  if (x === "animals" || x === "animal") return "monster";
  if (x === "textures" || x === "texture") return "texture";
  return x.slice(0, 32) || "item";
}

function main() {
  if (!fs.existsSync(SEED)) {
    console.error("Missing seed:", SEED, "— run pipeline:tvs:statics first");
    process.exit(1);
  }
  const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
  let rows = seed.rows || [];
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);
  console.log(`[seed-tvs-d1] ${rows.length} rows → ${DB}.asset_registry dry=${DRY}`);

  // Copy into ObjectStore seeds
  try {
    fs.mkdirSync(path.dirname(OS_SEED), { recursive: true });
    fs.copyFileSync(SEED, OS_SEED);
    console.log("[seed-tvs-d1] copied", OS_SEED);
  } catch (e) {
    console.warn("copy seed", e.message);
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const stmts = batch.map((r) => {
      const r2 = r.r2_key;
      const id = idFromR2(r2);
      const name = nameFromR2(r2);
      const cat = mapCategory(r.category);
      const packs = JSON.stringify({
        source_set: r.source_set || "the-voxel-store",
        pack: r.pack,
        tags: r.tags,
        cdn_url: r.cdn_url,
        content_type: r.content_type,
      });
      return `INSERT INTO asset_registry (id, name, category, r2_key, bone_map, animation_packs, file_size, grudge_uuid, updated_at)
VALUES (${esc(id)}, ${esc(name)}, ${esc(cat)}, ${esc(r2)}, NULL, ${esc(packs)}, NULL, ${esc(r.grudge_uuid)}, unixepoch() * 1000)
ON CONFLICT(r2_key) DO UPDATE SET
  name=excluded.name,
  category=excluded.category,
  animation_packs=excluded.animation_packs,
  grudge_uuid=COALESCE(excluded.grudge_uuid, asset_registry.grudge_uuid),
  updated_at=unixepoch() * 1000;`;
    });
    const sql = stmts.join("\n");
    const tmp = path.join(ROOT, "dist", "tvs", `.d1-seed-batch-${i}.sql`);
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.writeFileSync(tmp, sql);
    console.log(`  batch ${i / BATCH + 1}/${Math.ceil(rows.length / BATCH)} (${batch.length})`);
    if (DRY) {
      ok += batch.length;
      continue;
    }
    const r = spawnSync(
      "npx",
      ["wrangler", "d1", "execute", DB, "--remote", "--file", tmp],
      { encoding: "utf8", shell: true, cwd: path.join(ROOT, "..", "ObjectStore") },
    );
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    if (r.status !== 0) {
      console.error(r.stderr || r.stdout);
      fail += batch.length;
    } else {
      ok += batch.length;
    }
  }
  console.log(`[seed-tvs-d1] done ok=${ok} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}

main();
