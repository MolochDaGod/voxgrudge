/**
 * Structure-preserving mojibake repair for grudge-warlords-openworld.html.
 * Exact UI string fixes + safe generic strips. Never collapses whitespace.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const file = path.join(root, "grudge-warlords-openworld.html");

let s = fs.readFileSync(file, "utf8");
const beforeLen = s.length;

// Exact visible / title replacements (longest first where overlapping)
const exact = [
  // titles / meta
  [
    /<title>[\s\S]*?<\/title>/,
    "<title>Grudge Warlords — Open World Voxel Edition</title>",
  ],
  [
    /content="Grudge Warlords[^"]*Open World Voxel Edition"/g,
    'content="Grudge Warlords — Open World Voxel Edition"',
  ],
  [
    /content="Nexus Era[^"]*"/g,
    'content="Nexus Era open world voxel survival — classes, crafting, combat, and GRUDOX co-op."',
  ],
  [
    /<div class="sub">[\s\S]*?<\/div>/,
    '<div class="sub">Nexus Era · Open World Survival</div>',
  ],
  [
    /<div class="version">[\s\S]*?<\/div>/,
    '<div class="version">Player · Explorer · World cast · TVS units · GRUDOX co-op</div>',
  ],

  // step rail + create flow
  [/>1 Ãƒâ€šÃ‚· Character</g, ">1 · Character<"],
  [/>1 Ãƒâ€šÃ‚Â· Character</g, ">1 · Character<"],
  [/>2 Ãƒâ€šÃ‚· World</g, ">2 · World<"],
  [/>2 Ãƒâ€šÃ‚Â· World</g, ">2 · World<"],
  [/>3 Ãƒâ€šÃ‚· Load</g, ">3 · Load<"],
  [/>3 Ãƒâ€šÃ‚Â· Load</g, ">3 · Load<"],
  [/>4 Ãƒâ€šÃ‚· Play</g, ">4 · Play<"],
  [/>4 Ãƒâ€šÃ‚Â· Play</g, ">4 · Play<"],
  [/Loading UI PNG frames[^<]*/g, "Loading UI PNG frames…"],
  [/>1 Ãƒâ€šÃ‚· Race avatar</g, ">1 · Race avatar<"],
  [/>1 Ãƒâ€šÃ‚Â· Race avatar</g, ">1 · Race avatar<"],
  [/>2 Ãƒâ€šÃ‚· Class loadout</g, ">2 · Class loadout<"],
  [/>2 Ãƒâ€šÃ‚Â· Class loadout</g, ">2 · Class loadout<"],
  [/>3 Ãƒâ€šÃ‚· Color tint /g, ">3 · Color tint "],
  [/>3 Ãƒâ€šÃ‚Â· Color tint /g, ">3 · Color tint "],
  [/Continue to world [^<]*/g, "Continue to world →"],
  [/World Ãƒâ€šÃ‚· settlements/g, "World · settlements"],
  [/World Ãƒâ€šÃ‚Â· settlements/g, "World · settlements"],
  [/Ãƒ¢Ã¢â‚¬ Ã‚ Character/g, "← Character"],
  [/ÃƒÂ¢Ã¢â‚¬Â Ã‚Â Character/g, "← Character"],
  [/ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢/g, "→"],
  [/Ãƒ¢Ã¢â‚¬ Ã¢â‚¬â„¢/g, "→"],
  [/In game: WASD[^<]*/g, "In game: WASD · C camera · K main panel · Esc pause"],
  [/Content Ãƒâ€šÃ‚· [^<]*/g, "Content · —"],
  [/Content Ãƒâ€šÃ‚Â· [^<]*/g, "Content · —"],
  [/CAM Ãƒâ€šÃ‚· TPS[^<]*/g, "CAM · TPS · Hold RMB free-look · C cycle"],
  [/CAM Ãƒâ€šÃ‚Â· TPS[^<]*/g, "CAM · TPS · Hold RMB free-look · C cycle"],
  [/LMB attack[^<]*/g, "LMB attack · RMB free-look"],
  [/Esc resume[^<]*/g, "Esc resume · PNG frames stay hot · TVS assets loaded"],
  [/Lv\.1 [^<]*0 XP/g, "Lv.1 — 0 XP"],
  [/Zone Ãƒâ€šÃ‚· Starter/g, "Zone · Starter"],
  [/Zone Ãƒâ€šÃ‚Â· Starter/g, "Zone · Starter"],
  [/GRUDOX Ãƒâ€šÃ‚· offline/g, "GRUDOX · offline"],
  [/GRUDOX Ãƒâ€šÃ‚Â· offline/g, "GRUDOX · offline"],
  [/\[X\] Open chest[^<]*/g, "[X] Open chest · [X] Talk to survivor"],
  [/Connecting to asset registry[^<]*/g, "Connecting to asset registry…"],
  [/TVS roster offline[^<]*/g, "TVS roster offline — Kenney fallback"],
  [/00:00 [^<]*GCD READY/g, "00:00 — GCD READY"],
  [/NIGHT RAID[^<]*/g, "NIGHT RAID — DEFEND YOUR BASE"],
  [/BUILD MODE[^<]*/g, "BUILD MODE — LClick:Place RClick:Remove"],
  [/Vox Forge[^<]*Crafting/g, "Vox Forge — Crafting"],
  [/Inventory/g, "Inventory"], // keep if already clean
];

for (const [re, to] of exact) s = s.replace(re, to);

// Generic symbol recoveries (order matters — longer first)
const generics = [
  // middle dot variants
  [/Ãƒâ€šÃ‚Â·/g, " · "],
  [/Ãƒâ€šÃ‚·/g, " · "],
  [/Ã‚Â·/g, " · "],
  [/Â·/g, " · "],
  // ellipsis
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦/g, "…"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã‚¦/g, "…"],
  [/Ãƒ¢Ã¢â€š¬Ã‚¦/g, "…"],
  [/â€¦/g, "…"],
  // em/en dash
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âœ/g, "–"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬/g, "—"],
  [/Ãƒ¢Ã¢â€š¬Ã¢â‚¬/g, "—"],
  [/â€”/g, "—"],
  [/â€“/g, "–"],
  // arrows
  [/ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢/g, "→"],
  [/ÃƒÂ¢Ã¢â‚¬Â Ã‚Â/g, "←"],
  [/Ãƒ¢Ã¢â‚¬ Ã¢â‚¬â„¢/g, "→"],
  [/â†’/g, "→"],
  [/â†/g, "←"],
  // infinity / sparkle
  [/ÃƒÂ¢Ã‹â€ Ã…Â¾/g, "∞"],
  [/Ãƒ¢Ã‹â€ Ã…¾/g, "∞"],
  [/ÃƒÂ¢Ã…â€œÃ‚Â¨/g, "✦"],
  [/Ãƒ¢Ã…â€œÃ‚¨/g, "✦"],
  // common emoji → readable ascii/emoji (partial recoveries)
  [/ÃƒÂ¢Ã‹Å“Ã¢â€šÂ¬ÃƒÂ¯Ã‚Â¸Ã‚Â?/g, "☀"],
  [/ÃƒÂ¢Ã‹Å“Ã¢â€šÂ¬ÃƒÂ¯Ã‚Â¸Ã‚/g, "☀"],
  [/ÃƒÂ¢Ã…Â¡Ã¢â‚¬Â?ÃƒÂ¯Ã‚Â¸Ã‚Â?/g, "⚔"],
  [/ÃƒÂ¢Ã…Â¡Ã¢â‚¬Â/g, "⚔"],
  [/ÃƒÂ¢Ã…Â¡Ã¢â‚¬/g, "⚔"],
  [/ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â?/g, "⚙"],
  [/ÃƒÂ¢Ã…Â¡Ã‚Â /g, "⚠"],
  [/ÃƒÂ¢Ã‹Å“Ã‚Â°/g, "⌚"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬/g, "💀"],
  [/ÃƒÂ°Ã…Â¸Ã…â€™Ã¢â‚¬Ëœ/g, "👑"],
  [/ÃƒÂ°Ã…Â¸Ã‚Â©Ã‚Â¸/g, "🛡"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¨/g, "💣"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡/g, "🛡"],
  [/ÃƒÂ°Ã…Â¸Ã‚ÂªÃ¢â‚¬Å“/g, "🪓"],
  [/ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯/g, "🎯"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬â€œ/g, "📖"],
  [/ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬â„¢/g, "🎒"],
  [/ÃƒÂ°Ã…Â¸Ã‚ÂªÃ‚Âµ/g, "🪵"],
  [/ÃƒÂ°Ã…Â¸Ã‚ÂªÃ‚Â¨/g, "🪨"],
  [/ÃƒÂ°Ã…Â¸Ã…Â¸Ã‚Â«/g, "🟢"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬â€™Ã…Â¡/g, "💚"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â?/g, "⛏"],
  [/ÃƒÂ°Ã…Â¸[\s\S]{0,14}/g, ""], // leftover broken emoji clusters
  // strip residual triple-encode crumbs
  [/ÃƒÂ¢/g, ""],
  [/Ãƒâ€š/g, ""],
  [/ÃƒÂ¯/g, ""],
  [/ÃƒÂ°/g, ""],
  [/ÃƒÂ/g, ""],
  [/Ã‚/g, ""],
  [/Ã/g, ""],
  [/Â/g, ""],
  [/\uFFFD+/g, ""],
];

for (const [re, to] of generics) s = s.replace(re, to);

// Tidy double spaces inside text nodes only (not newlines / indentation)
s = s.replace(/([^\n\r]) {2,}([^\n\r])/g, "$1 $2");
s = s.replace(/ ·  · /g, " · ");
s = s.replace(/—\s*—/g, "—");

// Fonts
if (!s.includes("fonts.googleapis.com/css2?family=Inter")) {
  s = s.replace(
    '<link rel="stylesheet" href="ui/craftpix-rpg/craftpix-rpg-ui.css">',
    `<link rel="stylesheet" href="ui/craftpix-rpg/craftpix-rpg-ui.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">`,
  );
}

s = s.replace(
  /body\{margin:0;overflow:hidden;background:#0a0e14;font-family:'Segoe UI',sans-serif;color:#fff;user-select:none\}/,
  "body{margin:0;overflow:hidden;background:#0a0e14;font-family:Inter,system-ui,'Segoe UI',Roboto,sans-serif;color:#e8eef8;user-select:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}",
);

if (s.includes("#fps-counter") && !s.includes("JetBrains Mono")) {
  s = s.replace(
    /#fps-counter\{([^}]*)font-family:monospace/,
    "#fps-counter{$1font-family:'JetBrains Mono',ui-monospace,monospace",
  );
}

// Ensure create-step-hint prose is clean (TVS world cast sentence)
s = s.replace(
  /TVS units are for world cast[^<]{0,80}not the player mesh\./g,
  "TVS units are for world cast — enemies, villagers, allies, camps — not the player mesh.",
);

fs.writeFileSync(file, s, "utf8");

// Report
const bad = [];
const re = />([^<]{2,100})</g;
let m;
while ((m = re.exec(s))) {
  if (/Ã|Â|â€|ƒ|¢|¬|�|\uFFFD/.test(m[1])) bad.push(m[1].trim());
}
const lines = s.split(/\n/).length;
console.log("beforeLen", beforeLen, "afterLen", s.length, "lines", lines);
console.log(
  "title",
  s.slice(s.indexOf("<title>"), s.indexOf("</title>") + 8),
);
console.log("remaining bad visible", bad.length);
[...new Set(bad)].slice(0, 25).forEach((x) => console.log(JSON.stringify(x)));
console.log(
  "has Inter",
  s.includes("family=Inter"),
  "step1",
  /1 · Character/.test(s),
);
