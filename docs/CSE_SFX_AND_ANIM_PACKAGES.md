# CSE SFX + baked anim packages

## Combat SFX (Creative Sandbox Engine)

| Item | Value |
|------|--------|
| Source | `artifacts/voxel-studio/public/assets/audio/sfx` (mattflat pack) |
| Local | `assets/audio/cse-sfx/` |
| CDN | `https://assets.grudge-studio.com/audio/cse/sfx/` |
| License | **CC BY-ND 3.0** — attribution required; **unmodified** WAVs only |
| Author | Mattis Flettner (mattflat) — https://mattflat.itch.io/ |
| Upload | `npm run upload:cse:sfx` (`--verify` recommended) |
| Runtime | `js/tvs-cse-sfx.js` → `TvsCseSfx.play(role)` / `playForAnim(anim)` |

### Best game roles

| Role | Files | Use |
|------|--------|-----|
| `combat_hit` | hit_1…5 | Melee land, dig impact |
| `combat_hit_light` | hit_4, hit_5 | Graze / light tool |
| `combat_hit_heavy` | hit_1…3 | Crit / death thump |
| `ranged_fire` | shot_2, 7, 10 | Bow / bolt / gun |
| `ranged_heavy` | shot_7, 10 | Charged / staff bolt |
| `explosion` | explosion_4 | AOE / detonate |
| `ui_misc` | misc_2 | Rare interact (sparingly) |

**Kenney** remains SSOT for footsteps, harvest, UI clicks, deploy (skill `kenney-audio`).  
CSE pack = combat punch only.

Attribution line (show once in credits / about):

> Sound effects by Mattis Flettner (mattflat) — CC BY-ND 3.0

## Baked anim packages (`maxClips: 20`)

All unit loads use **`maxClips: 20`** (default in `TvsUnitLoader.loadAndBindAnims`).

### TVS humanoid (CDN `*.anims.json` allClips)

| Package | Roles |
|---------|--------|
| **locomotion** | idle, locomotion |
| **traversal** | jump, sit, dig, mounted, broom |
| **weapon** | attack, defend, aim, cast, command, hit, death |
| social (extra) | barter, drunk, pray, preach |

`opts.animPackages: ["locomotion","weapon"]` can limit loads.

### Explorer Mixamo bake (`voxgrudge/models/anims`)

Manifest: `models/anims/anim-pack.manifest.json`  
CDN: `https://assets.grudge-studio.com/voxgrudge/models/anims/`

| Package | Contents |
|---------|----------|
| **locomotion** | idle, walk*, run*, sprint |
| **traversal** | jump, land, fall, climb, dodge*, swim |
| **weapon** | by equip: sword_shield, greatsword, bow, magic, pistol + hit/death |

Runtime: `TvsDangerAnim.ANIM_PACKAGES`, `TvsUnitLoader.ANIM_PACKAGES`.
