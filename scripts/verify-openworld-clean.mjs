import fs from "fs";
const s = fs.readFileSync("grudge-warlords-openworld.html", "utf8");
const checks = [
  "function startGame",
  "GrudgeAssets",
  "localOrR2",
  "avatar-races",
  "free-rpg-roster",
  "assets/voxels",
  "class-screen",
  "create-next-btn",
  "WASD",
  "family=Inter",
  "Grudge Warlords — Open World Voxel Edition",
  "1 · Character",
  "Continue to world",
  "</html>",
  "grudge-game-bootstrap",
  "characterId",
];
for (const c of checks) console.log(c, s.includes(c) ? "OK" : "MISSING");
console.log("html", (s.match(/<html/g) || []).length, (s.match(/<\/html>/g) || []).length);
console.log("script", (s.match(/<script/g) || []).length, (s.match(/<\/script>/g) || []).length);
console.log("size", s.length, "lines", s.split("\n").length);
console.log("moji", (s.match(/Ã|Â|â€|\uFFFD/g) || []).length);
