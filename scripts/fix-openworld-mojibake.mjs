/**
 * Repair double/triple UTF-8 mojibake in grudge-warlords-openworld.html
 * and apply UI font/title polish for voxgrudge.vercel.app.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const file = path.join(root, "grudge-warlords-openworld.html");

const cp1252 = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};
const rev = {};
for (const [b, cp] of Object.entries(cp1252)) rev[cp] = +b;

function encodeCp1252(str) {
  const out = [];
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c >= 0xa0 && c <= 0xff) out.push(c);
    else if (rev[c] != null) out.push(rev[c]);
    else return null;
  }
  return Buffer.from(out);
}

function fixOnce(s) {
  const bytes = encodeCp1252(s);
  if (!bytes) return null;
  return bytes.toString("utf8");
}

function mojiScore(s) {
  return (
    (s.match(/Ã|Â|ƒ|¢|â€|�|\uFFFD/g) || []).length +
    (s.includes("\uFFFD") ? 5000 : 0)
  );
}

let s = fs.readFileSync(file, "utf8");
let best = s;
let bestScore = mojiScore(s);
console.log("initial score", bestScore);

for (let i = 0; i < 6; i++) {
  const n = fixOnce(s);
  if (!n || n === s) break;
  const score = mojiScore(n);
  console.log(
    "round",
    i + 1,
    "score",
    score,
    "title",
    JSON.stringify(n.slice(n.indexOf("<title>"), n.indexOf("<title>") + 72)),
  );
  if (score < bestScore) {
    bestScore = score;
    best = n;
  }
  s = n;
  if (score === 0) break;
}

let out = best;
const reps = [
  [/\uFFFD+/g, ""],
  [/â€”/g, "—"],
  [/â€“/g, "–"],
  [/â€˜/g, "'"],
  [/â€™/g, "'"],
  [/â€œ/g, '"'],
  [/â€\u009d/g, '"'],
  [/â€/g, '"'],
  [/â€¦/g, "…"],
  [/Â·/g, "·"],
  [/Â /g, " "],
  [/Â/g, ""],
  [/Ã—/g, "×"],
  [/â€¢/g, "•"],
  [/â†’/g, "→"],
  [/â†’/g, "→"],
  [/â†/g, "→"],
  [/â†/g, "→"],
  [/â‡’/g, "↔"],
  [/â€\?/g, "—"],
  [/â€\?\?/g, "—"],
  [/â€�\?\?/g, "—"],
  [/â€�\?/g, "—"],
  [/â€�/g, "—"],
  [/â€\u0094/g, "—"],
  // broken multi-byte residue after partial decode
  [/\?{2,}/g, "—"],
];
for (const [re, to] of reps) out = out.replace(re, to);

// Canonical titles / meta (always clean)
out = out.replace(
  /<title>[^<]*<\/title>/,
  "<title>Grudge Warlords — Open World Voxel Edition</title>",
);
out = out.replace(
  /content="Nexus Era[^"]*"/g,
  'content="Nexus Era open world voxel survival — classes, crafting, combat, and GRUDOX co-op."',
);
out = out.replace(
  /content="Grudge Warlords[^"]*Open World Voxel Edition"/g,
  'content="Grudge Warlords — Open World Voxel Edition"',
);
out = out.replace(
  /<div class="sub">[^<]*<\/div>/,
  '<div class="sub">Nexus Era · Open World Survival</div>',
);
out = out.replace(
  /<div class="version">[^<]*<\/div>/,
  '<div class="version">Player · Explorer · World cast · TVS units · GRUDOX co-op</div>',
);

// Fonts + cleaner body type
if (!out.includes("fonts.googleapis.com/css2?family=Inter")) {
  out = out.replace(
    '<link rel="stylesheet" href="ui/craftpix-rpg/craftpix-rpg-ui.css">',
    `<link rel="stylesheet" href="ui/craftpix-rpg/craftpix-rpg-ui.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">`,
  );
}

out = out.replace(
  /body\{margin:0;overflow:hidden;background:#0a0e14;font-family:'Segoe UI',sans-serif;color:#fff;user-select:none\}/,
  "body{margin:0;overflow:hidden;background:#0a0e14;font-family:Inter,system-ui,'Segoe UI',Roboto,sans-serif;color:#e8eef8;user-select:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}",
);

// Monospace HUD bits
if (!out.includes("font-family:JetBrains Mono") && out.includes("#fps-counter")) {
  out = out.replace(
    /#fps-counter\{([^}]*)font-family:monospace/,
    "#fps-counter{$1font-family:'JetBrains Mono',ui-monospace,monospace",
  );
}

// Soft-fix common remaining mojibake words in UI copy
out = out.replace(/A[—\-]?\s*Open World/g, "— Open World");
out = out.replace(/Warlords\s+[^\w\s]{1,12}\s+Open/g, "Warlords — Open");

fs.writeFileSync(file, out, "utf8");
console.log("wrote", file);
console.log(
  "title",
  out.slice(out.indexOf("<title>"), out.indexOf("<title>") + 70),
);
console.log("final score", mojiScore(out));
