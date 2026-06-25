import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'js/grudge-game-hud.js',
  'js/grudge-hud-icons.js',
  'assets/grudge-game/ui/Action_Bar/Slots/ActionBar_Slot_Background.png',
  'assets/grudge-game/ui/Action_Bar/Slots/ActionBar_Extra_Slot_Background.png',
  'assets/grudge-game/class-emblems/warrior.webp',
  'assets/grudge-game/class-emblems/ranger.webp',
  'assets/grudge-game/class-emblems/mage.webp',
];

const missing = required.filter((p) => !fs.existsSync(path.join(root, p)));
console.log(`checked ${required.length} HUD paths`);
console.log(`missing ${missing.length}`);
missing.forEach((p) => console.log('  -', p));
process.exit(missing.length ? 1 : 0);