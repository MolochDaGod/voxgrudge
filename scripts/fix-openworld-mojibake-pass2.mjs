/**
 * Second pass: remaining triple-encoded sequences after pass1.
 */
import fs from "fs";

const file = "grudge-warlords-openworld.html";
let s = fs.readFileSync(file, "utf8");

const reps = [
  // middle dot ·
  [/Ãƒâ€šÃ‚Â·/g, " · "],
  [/Ãƒâ€šÃ‚·/g, " · "],
  [/Ã‚Â·/g, " · "],
  [/Â·/g, " · "],
  // ellipsis …
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦/g, "…"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã‚¦/g, "…"],
  [/Ã¢â€šÂ¬Ã‚Â¦/g, "…"],
  [/â€¦/g, "…"],
  // arrows
  [/ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢/g, " → "],
  [/ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢/g, " → "],
  [/ÃƒÂ¢Ã¢â‚¬Â Ã‚/g, " ← "],
  [/Ã¢â‚¬Â Ã¢â‚¬â„¢/g, " → "],
  [/â†’/g, " → "],
  [/â†/g, " → "],
  // em dash / en dash fragments
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Âœ/g, "–"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬/g, "—"],
  [/Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—"],
  [/Ã¢â€šÂ¬Ã¢â‚¬/g, "—"],
  [/â€”/g, "—"],
  [/â€“/g, "–"],
  // quotes
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢/g, "'"],
  [/ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“/g, "'"],
  [/â€™/g, "'"],
  [/â€˜/g, "'"],
  [/â€œ/g, '"'],
  [/â€/g, '"'],
  // bullets / box drawing leftovers used as separators
  [/ÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â/g, ""],
  [/ÃƒÂ¢Ã¢â‚¬Â¢Ã‚/g, ""],
  // common emoji recovery (partial - replace broken emoji with ascii icons)
  [/ÃƒÂ¢Ã‹Å“Ã¢â€šÂ¬ÃƒÂ¯Ã‚Â¸Ã‚Â?/g, "☀"],
  [/ÃƒÂ¢Ã…Â¡Ã¢â‚¬Â ?ÃƒÂ¯Ã‚Â¸Ã‚Â?/g, "⚔"],
  [/ÃƒÂ¢Ã…Â¡Ã¢â‚¬/g, "⚔"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬/g, "💀"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬/g, "💀"],
  [/ÃƒÂ°Ã…Â¸Ã…Â’Ã¢â‚¬Ëœ/g, "👑"],
  [/ÃƒÂ°Ã…Â¸Ã‚Â©Ã‚Â¸/g, "🛡"],
  [/ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬/g, "💀"],
  [/ÃƒÂ°Ã…Â¸[\s\S]{0,12}/g, ""], // strip remaining broken emoji clusters
  [/ÃƒÂ¢Ã‹â€ Ã…Â¾/g, "∞"],
  [/ÃƒÂ¢Ã…â€œÃ‚Â¨/g, "✦"],
  [/ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â?/g, "⚙"],
  [/ÃƒÆ’Ã¢â‚¬â€/g, "×"],
  // leftover Ã garbage
  [/ÃƒÂ¢/g, ""],
  [/Ãƒâ€š/g, ""],
  [/ÃƒÂ¯/g, ""],
  [/ÃƒÂ°/g, ""],
  [/ÃƒÂ/g, ""],
  [/Ã‚/g, ""],
  [/Ã/g, ""],
  [/Â/g, ""],
  // tidy separators
  [/\s*·\s*/g, " · "],
  [/·\s*·/g, "·"],
  [/\s{2,}/g, " "],
  [/ \n/g, "\n"],
];

let n = 0;
for (const [re, to] of reps) {
  const before = s.length;
  s = s.replace(re, to);
  if (s.length !== before) n++;
}

// Normalize step rail labels if still weird
s = s.replace(/>\s*1\s*·\s*Character\s*</g, ">1 · Character<");
s = s.replace(/>\s*2\s*·\s*World\s*</g, ">2 · World<");
s = s.replace(/>\s*3\s*·\s*Load\s*</g, ">3 · Load<");
s = s.replace(/>\s*4\s*·\s*Play\s*</g, ">4 · Play<");
s = s.replace(/Loading UI PNG frames[^<]*/g, "Loading UI PNG frames…");
s = s.replace(/Continue to world[^<]*/g, "Continue to world →");
s = s.replace(/In game:[^<]*/g, "In game: WASD · C camera · K main panel · Esc pause");
s = s.replace(/CAM[^<]{0,80}TPS[^<]*/g, "CAM · TPS · Hold RMB free-look · C cycle");
s = s.replace(/LMB attack[^<]*/g, "LMB attack · RMB free-look");
s = s.replace(/Esc resume[^<]*/g, "Esc resume · PNG frames stay hot · TVS assets loaded");
s = s.replace(/Lv\.1[^<]{0,40}XP/g, "Lv.1 — 0 XP");

fs.writeFileSync(file, s, "utf8");

// report
const bad = [];
const re = />([^<]{4,100})</g;
let m;
while ((m = re.exec(s))) {
  if (/Ã|Â|â€|ƒ|¢|¬|�/.test(m[1])) bad.push(m[1]);
}
console.log("pass2 replacements batches", n);
console.log("remaining bad visible", bad.length);
bad.slice(0, 20).forEach((x) => console.log(JSON.stringify(x)));
console.log(
  "title",
  s.slice(s.indexOf("<title>"), s.indexOf("<title>") + 70),
);
