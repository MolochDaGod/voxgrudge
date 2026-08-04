import fs from "fs";
const file = "grudge-warlords-openworld.html";
let s = fs.readFileSync(file, "utf8");
const i = s.indexOf("function tickOpenworld");
if (i < 0) throw new Error("tickOpenworld not found");
const j = s.indexOf("function updateEnergyOrbs", i);
if (j < 0) throw new Error("updateEnergyOrbs not found");
const mid = s.slice(i, j);
const k = mid.lastIndexOf("renderer.render(scene,camera);");
if (k < 0) {
  console.log("no render in tick — already clean?");
  process.exit(0);
}
const fixed =
  mid.slice(0, k) + "/* render owned by FleetGameLoop.onRender */" + mid.slice(k + "renderer.render(scene,camera);".length);
s = s.slice(0, i) + fixed + s.slice(j);
fs.writeFileSync(file, s);
console.log("stripped render from tickOpenworld");
