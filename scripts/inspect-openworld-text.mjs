import fs from "fs";
const s = fs.readFileSync("grudge-warlords-openworld.html", "utf8");
console.log("TITLE", s.slice(s.indexOf("<title>"), s.indexOf("<title>") + 80));
const a = s.indexOf('class="sub"');
console.log("SUB", s.slice(a, a + 100));
const b = s.indexOf('class="version"');
console.log("VER", s.slice(b, b + 140));
const bad = [];
const re = />([^<]{6,120})</g;
let m;
while ((m = re.exec(s))) {
  const t = m[1];
  if (/Ã|Â|â€|ƒ|¢|¬|š|ž|�/.test(t)) bad.push(t);
}
console.log("bad visible snippets", bad.length);
bad.slice(0, 30).forEach((x) => console.log(JSON.stringify(x)));
