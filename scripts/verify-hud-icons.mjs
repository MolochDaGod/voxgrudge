import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const js = fs.readFileSync(path.join(root, 'js/grudge-hud-icons.js'), 'utf8');
const block = js.slice(js.indexOf('var SKILL_ICONS'), js.indexOf('global.GrudgeHudIcons'));
const paths = [...block.matchAll(/['"]([^'"]+\.png)['"]/g)].map((m) => m[1]);
const missing = paths.filter((p) => !fs.existsSync(path.join(root, p)));
console.log(`checked ${paths.length} icon paths`);
console.log(`missing ${missing.length}`);
missing.forEach((p) => console.log('  -', p));
process.exit(missing.length ? 1 : 0);