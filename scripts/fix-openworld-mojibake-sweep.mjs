import fs from "fs";

const file = "grudge-warlords-openworld.html";
let s = fs.readFileSync(file, "utf8");

// Trademark / residual after sword emoji
s = s.replace(/\u2694\uFE0F?\u2122\s*/g, "\u2694 ");
s = s.replace(/⚔â„¢\s*/g, "⚔ ");
s = s.replace(/â„¢/g, "");
s = s.replace(/\u2122/g, "");

// Any remaining classic mojibake crumbs
s = s.replace(/Ãƒ[^A-Za-z0-9]{0,12}/g, "");
s = s.replace(/Ã‚./g, "");
s = s.replace(/Ã./g, "");
s = s.replace(/Â./g, "");
s = s.replace(/â€[^\s<]{0,3}/g, "—");
s = s.replace(/\uFFFD+/g, "");

// Clean known labels again if crumbs left holes
s = s.replace(/Vox Forge\s*[—\-]?\s*Crafting/g, "Vox Forge — Crafting");
s = s.replace(/⚔\s+Vox Forge/g, "Vox Forge");

fs.writeFileSync(file, s, "utf8");

const bad = [];
const re = />([^<]{2,100})</g;
let m;
while ((m = re.exec(s))) {
  if (/Ã|Â|â€|ƒ|¢|¬|\uFFFD|�/.test(m[1])) bad.push(m[1].trim());
}
console.log("title", s.match(/<title>[^<]+/)?.[0]);
console.log("bad visible", bad.length);
[...new Set(bad)].slice(0, 20).forEach((x) => console.log(JSON.stringify(x)));
console.log(
  "moji marker count",
  (s.match(/Ãƒ|Ã‚|â€|Â·|\uFFFD/g) || []).length,
);
console.log("lines", s.split(/\n/).length);
console.log("has Inter", s.includes("family=Inter"));
console.log("1 · Character", s.includes("1 · Character"));
