# VoxGrudge

Open-world voxel survival for Grudge Studio.

| Surface | URL |
|---------|-----|
| Standalone | https://voxgrudge.vercel.app |
| Fleet openworld | https://grudox.grudge-studio.com/voxgrudge/openworld |

## Character SSOT

| Role | Body system |
|------|-------------|
| **Player** | **Avatar Explorer only** — Avatar Edit 6-race defaults + AnimationMixer + locomotion + weapon skills |
| **Enemies, villagers, vendors, allies, camps** | **TVS** cast (`loadTvsWorldActor`) |
| **Buildings / settlements** | TVS settlement builder |

Player never takes a TVS or grudge6 body in openworld. Race selection writes head config to fleet keys (`avatarEdit:playerHead:v1`).

### Create flow (`/openworld`)

1. **Character** — pick one of 6 race avatars (Human, Barbarian, Orc, Undead, Dwarf, Elf) + class loadout + optional tint  
2. **World** — settlements + seed → **ENTER THE SURFACE**

Race defaults: `avatar/races/defaults.json` (Avatar Edit catalog export).

### Scale

- SI units: 1 unit = 1 m  
- Player height from race defaults (~1.5–2.0 m); human yardstick **1.8 m**  
- Normalize path in `js/vox-assets.js` / `GrudgeScale`

## Nature props

Multi-block voxel trees/rocks/ore via `js/vox-nature-props.js` (pine / oak / dead variants; clustered rocks; ore crystals). Not single-box placeholders.

Water uses the same module’s wave plane when available; collision layers register with retry.

## Choose Survivor UI

- Class cards always paint via `ensureSurvivorsUI` grid fallback if the carousel fails  
- Race cards render immediately from embedded defaults (offline-safe)

## Key scripts

| Script | Role |
|--------|------|
| `js/vox-nature-props.js` | Voxel trees/rocks/ore + wave water + retry helper |
| `js/grudge-explorer-combat.js` | Weapon skill combos on Explorer mixer |
| `js/player-controller.js` | TPS/ISO/FPS camera |
| `js/tvs-unit-loader.js` | TVS world cast load |
| `js/world-engine.js` | Chunked zones, camps, resource nodes |
| `js/vox-ui-kit.js` | Create tabs Character \| World |

## Deploy

Standalone: Vercel project `voxgrudge`.  
Fleet shell: sync into `grudox` `dist/voxgrudge` + worker static, then `vercel --prod` / `wrangler deploy` from grudox.
