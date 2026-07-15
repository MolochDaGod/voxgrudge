# VoxGrudge — Macro review & best practices

**Live:** https://voxgrudge.vercel.app/  
**Repo SSOT:** `MolochDaGod/voxgrudge` → Vercel (not grudox `dist/`)

## Architecture (layers)

```
┌─────────────────────────────────────────────────────────────┐
│  Shell UI  (class screen · flow rail · pause · PNG frames) │
│  VoxUiDeps · VoxUiKit · vox-game-shell.css                  │
├─────────────────────────────────────────────────────────────┤
│  Flow FSM  boot→select→loading→playing⇄pause→dead|error    │
│  VoxGameFlow (+ runLoadStages)                              │
├─────────────────────────────────────────────────────────────┤
│  Boot gate  deps · UI preload · CDN mode · start unlock    │
│  VoxBoot                                                    │
├─────────────────────────────────────────────────────────────┤
│  Canvas    DPR≤2 · ResizeObserver · visibility · WebGL lost │
│  VoxGameCanvas (delta-clamped loop)                         │
├─────────────────────────────────────────────────────────────┤
│  Content   TVS units/settlements · D1/R2 · GrudgeAssets     │
│  TvsUnitLoader · TvsWorldContent · TvsSettlementBuilder     │
├─────────────────────────────────────────────────────────────┤
│  Sim       world-engine · combat · player · collision       │
└─────────────────────────────────────────────────────────────┘
```

## Hard rules

| Rule | Why |
|------|-----|
| **Deploy only from this repo** | Vercel tracks `voxgrudge`, not grudox |
| **TVS units first** | Kenney is fallback only |
| **R2 CDN on live** | `GrudgeAssets.useR2()`; `?cdn=0` / `?local=1` force local; `?cdn=1` on localhost |
| **Magic-byte assets** | Reject HTML fake-200 before FBX/GLB parse |
| **Normalize height ~2.0 m** | Local bbox, then ground feet |
| **No permanent capsules** | Placeholder only until mesh loads |
| **Legal flow transitions** | Always `VoxGameFlow.goto` — don't fight the FSM |
| **Pause on tab hide** | Canvas + flow; reset dt on resume |
| **Cap dt ≤ 50 ms** | Avoid physics explosions after AFK |

## Module contracts

### `VoxBoot.run()`
1. `VoxGameCanvas.checkDeps` (THREE, fflate, loaders, TVS, WebGL)  
2. CDN mode log + HUD CSS vars  
3. `VoxUiDeps.preload(critical)` + repair images  
4. Unlock start button attribute; set `#vox-boot-status`

### `VoxGameFlow`
- States: `boot | select | loading | playing | pause | dead | error`
- `runLoadStages([{id,label,run}])` for structured progress
- `shouldTick()` → only when `playing`
- UI hooks: class screen, HUD, loading, pause, dead, error

### `VoxGameCanvas.mount`
- DPR cap 2, sRGB encoding (r128) / color space (newer)
- Visibility pause, ResizeObserver, context lost/restored
- Loop signature: `(timeMs, dtSec) => void`

### `GrudgeAssets`
- Live keys: `assets.grudge-studio.com/voxgrudge/...`
- TVS shared: `models/voxels/tvs/...`
- UI frames: `voxgrudge/assets/grudge-game/ui/...`

### GLTF optimize path
- `npm run optimize:glb` → Meshopt/Draco  
- Runtime: `VoxGltfConfigure(loader)` or `VoxGameCanvas.configureGltfLoader`

## Game flow (player journey)

1. **Boot** — scripts load → `VoxBoot.run` → status line  
2. **Hero** — class + TVS hero/tint (+ Kenney fallback)  
3. **World** — settlement types + seed  
4. **Load** — items, textures, models, skeleton, world build  
5. **Play** — WASD · C camera · K panel · Esc pause  
6. **Dead** — respawn → select or reload stages  

## Checklist before shipping

- [ ] `npm run verify:assets` (or `:cdn`)  
- [ ] `VoxBoot` status green on prod  
- [ ] Class → Enter Surface → no console red on deps  
- [ ] TVS hero visible (not Kenney unless intentional fallback)  
- [ ] Esc pause freezes sim; resume OK  
- [ ] Tab background freezes RAF work  
- [ ] Settlement strip spawns without throw  
- [ ] UI PNG frames resolve (CDN or local mirror)  
- [ ] CSP allows puter + three CDN hosts  

## Debug query flags

| Flag | Effect |
|------|--------|
| `?cdn=0` / `?local=1` | Force bundled assets on live |
| `?cdn=1` | Force R2 on localhost |

## Related surfaces

| Surface | URL / path |
|---------|------------|
| Production game | `/` → `grudge-warlords-openworld.html` |
| TVS showcase | `/tvs-showcase.html` |
| Settlements | `/tvs-showcase.html#settlements` |
| GRUDOX fleet | https://grudox.grudge-studio.com/ |
| Stats guide | https://survival.grudge-studio.com/stats-guide.html |
