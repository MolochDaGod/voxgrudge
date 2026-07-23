/**
 * HEAD-check critical asset URLs (local + R2 CDN).
 * Fails CI when production CDN misses after upload.
 *
 *   npm run verify:assets
 *   npm run verify:assets -- --cdn-only
 *   npm run verify:assets -- --base https://voxgrudge.vercel.app
 */
const CDN = 'https://assets.grudge-studio.com';
const APP = 'voxgrudge';
const args = process.argv.slice(2);
const cdnOnly = args.includes('--cdn-only');
const baseIdx = args.indexOf('--base');
const LOCAL = baseIdx >= 0 ? args[baseIdx + 1].replace(/\/$/, '') : 'https://voxgrudge.vercel.app';

const UI = [
  'Window/Window_Background.png',
  'Window/Window_Header_Background.png',
  'Buttons/Rectangular/Large/Button_RL_Background_Yellow.png',
  'Buttons/Rectangular/Medium/Button_RM_Background.png',
  'Character_Select/CharacterSelect_Glow.png',
  'Character_Select/Buttons/CharacterSelect_Arrow_Left_Background.png',
  'Action_Bar/Slots/ActionBar_Slot_Background.png',
  'Action_Bar/Slots/ActionBar_Extra_Slot_Background.png',
  'Unit_Frames/Main/UnitFrame_Background.png',
  'Chat/Tabs/Chat_Tab_Active.png',
  'Notifications/Notification_Background.png',
  'Spell_Book/Tabs/SpellBook_Tab_Background_Active.png',
];

const RUNTIME = [
  // Anim pack (Mixamo FBX → skinned locomotion/combat)
  'models/anims/idle.fbx',
  'models/anims/run-forward.fbx',
  'models/anims/sword-shield-attack.fbx',
  // Creatures / maps props
  'models/creatures/skeleton-warrior.glb',
  'models/kenney/character-a.glb',
  'models/kenney/textures/texture-a.png',
  // VFX + HUD chrome
  'vfx/muzzle/flash_front_01.png',
  'ui/hud/grudge-hud.css',
  'ui/hud/frames/panel-bg.png',
  'ui/craftpix-rpg/bars/pb_frame.png',
  'assets/mine-loader/ui-icons/skill-slot.png',
  // Lava biome + voxel weapons + free TVS + party frames (R2-hosted binaries)
  'assets/lava-biome/manifest.json',
  'assets/lava-biome/Trees/LavaTree1.png',
  'models/weapons/voxel-rpg/00.glb',
  'models/weapons/voxel-rpg/weapons_magica.glb',
  'assets/voxels/weapon-roster.json',
  'models/voxels/free-rpg/TPose_Character.glb',
  'assets/voxels/free-rpg-roster.json',
  'ui/hud/party-frames/player-frame.png',
];

/** App shell files — Vercel same-origin only (not mirrored on R2) */
const LOCAL_ONLY = [
  'ui/hud/party-frames.css',
  'js/lava-biom-loader.js',
  'js/lava-biom-manifest.js',
  'js/voxel-weapon-loader.js',
  'js/player-controller.js',
  'grudge-warlords-openworld.html',
];

const EXTRA = [
  `${CDN}/models/voxels/tvs/catalog.json`,
  `${CDN}/models/voxels/tvs/unit-roster.json`,
  `${CDN}/models/voxels/tvs/unit-roster.production.json`,
  // Production converted+compressed heroes (glTF magic verified via GET in CI optional)
  `${CDN}/models/voxels/tvs/voxel-knights/characters/voxel-knights-champion.glb`,
  `${CDN}/models/voxels/tvs/voxel-cathedral/characters/voxel-cathedral-crusader.glb`,
  `${CDN}/models/voxels/tvs/voxel-rangers/characters/voxel-rangers-captain.glb`,
  `${CDN}/models/voxels/tvs/voxel-wizards/characters/voxel-wizards-wizard.glb`,
  `${CDN}/icons/wcs/weapons/Sword_01.png`,
  `${CDN}/${APP}/branding/logo-256.png`,
  `${CDN}/${APP}/assets/grudge-game/class-emblems/warrior.webp`,
  `${LOCAL}/branding/logo-256.png`,
  `${LOCAL}/js/grudge-asset-config.js`,
  `${LOCAL}/js/vox-ui-deps.js`,
  `${LOCAL}/js/tvs-unit-loader.js`,
  `${LOCAL}/js/tvs-hero-preview.js`,
  `${LOCAL}/js/player-controller.js`,
  `${LOCAL}/ui/hud/grudge-hud.css`,
];

function urls() {
  const list = [];
  for (const rel of UI) {
    list.push(`${CDN}/${APP}/assets/grudge-game/ui/${rel}`);
    if (!cdnOnly) list.push(`${LOCAL}/assets/grudge-game/ui/${rel}`);
  }
  for (const rel of RUNTIME) {
    list.push(`${CDN}/${APP}/${rel}`);
    if (!cdnOnly) list.push(`${LOCAL}/${rel}`);
  }
  // Shell JS/CSS live on the app host (Vercel), not R2
  if (!cdnOnly) {
    for (const rel of LOCAL_ONLY) {
      list.push(`${LOCAL}/${rel}`);
    }
  }
  list.push(...EXTRA);
  return [...new Set(list)];
}

async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (r.ok) return { url, status: r.status, ok: true };
    // Some CDNs block HEAD — try GET range
    const g = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return { url, status: g.status, ok: g.ok || g.status === 206 };
  } catch (e) {
    return { url, status: 0, ok: false, err: String(e.message || e) };
  }
}

async function main() {
  const list = urls();
  console.log(`verify-assets: ${list.length} URLs (cdnOnly=${cdnOnly})`);
  let ok = 0;
  let fail = 0;
  const bad = [];
  for (let i = 0; i < list.length; i += 8) {
    const batch = list.slice(i, i + 8);
    const results = await Promise.all(batch.map(head));
    for (const r of results) {
      if (r.ok) {
        ok++;
        console.log(`  OK  ${r.status} ${r.url}`);
      } else {
        fail++;
        bad.push(r);
        console.log(`  BAD ${r.status} ${r.url}${r.err ? ' ' + r.err : ''}`);
      }
    }
  }
  console.log(`\nSummary ok=${ok} fail=${fail}`);
  if (fail) {
    console.error('Missing assets — run: npm run upload:r2');
    process.exit(1);
  }
}

main();
