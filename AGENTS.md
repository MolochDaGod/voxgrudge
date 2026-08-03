# VoxGrudge / GRUDOX — agent build contract

**Load these skills before changing characters, convert, or deploy:**

| Order | Skill | Why |
|-------|--------|-----|
| 1 | `grudge-studio` | Fleet topology |
| 2 | `grudge-asset-convert` | **Only** production bake: fbx2glb / glb2glb |
| 3 | `grudge-character-correctness` | Feet Y=0, **not** hips; facing; no double-scale |
| 4 | `grudge-warlords-assets` / TVS CDN | No Meshy; magic-byte CDN |
| 5 | `grudge-d1-r2` | Registry + R2 keys |
| 6 | `grudge-world-scale` | SI metres; characters ≠ props |

## SSOT code (do not invent a second path)

| Concern | Where |
|---------|--------|
| TVS unit load (GLB first, height, texture, AnimationMixer) | `js/tvs-unit-loader.js` → `TvsUnitLoader` |
| TVS catalog / roster | `assets/voxels/{catalog,unit-roster}.json` + CDN `models/voxels/tvs/` |
| Settlement placement | `js/tvs-world-content.js` |
| Hero convert | `scripts/convert-tvs-heroes.mjs` → grudge-convert `--height 2.0` |
| Full pipeline | `scripts/pipeline-tvs-full.mjs` |
| UI chrome (no text on LOGIN/PLAY art) | `ui/UI_ASSET_RULES.md` |

## Three.js / bake rules (TVS voxels)

1. **Units:** 1 = 1 m. TVS heroes target **2.0 m** height (pack scale), feet grounded via **body bbox min.y**, never pelvis Y=0.
2. **Bake:** `fbx2glb` + atlas `--texture` → `.glb` + `.collider.json` + `.manifest.json`. Prefer **GLB at runtime** (`preferGlb: true`).
3. **Textures:** NearestFilter, no mipmaps, metalness 0, flatShading — voxel look. Rebind strip atlas if FBX lacks maps.
4. **Anims:** `AnimationMixer` on unit root; semantic packs from `*.anims.json`; prefer human clips over animal; fade transitions.
5. **Retarget:** TVS packs are **self-contained** (clips match skeleton). Do **not** force Mixamo/Bip001 rematch. Grudge6 Bip001 rules apply only to Warlords race kits.
6. **Props/env:** `glb2glb` static; scale mode `native_voxel` unless recipe height set; never fitCharacterHeight on buildings.
7. **CDN:** `assets.grudge-studio.com/models/voxels/tvs/…` — HEAD + magic bytes (`glTF` / `Kaydara` / PNG).

## Commands

```bash
cd F:\GitHub\voxgrudge
npm run convert:doctor
npm run convert:tvs                 # 38 heroes (height 2.0m) — run BEFORE statics
npm run pipeline:tvs:statics        # env/props/animals only (never characters)
npm run pipeline:tvs:anims          # pack anim FBX→GLB + unit *.anims.json
npm run upload:tvs
npm run seed:tvs:d1                 # grudge-assets-db.asset_registry
npm run verify:assets:cdn
```

**Order matters:** statics must not re-bake `/characters/` (loose tag filters once overwrote farm heroes without height).

## Kill list

- ❌ Pelvis as ground plane  
- ❌ HTML text on LOGIN/PLAY baked button PNGs  
- ❌ Loading raw FBX when production GLB exists  
- ❌ Fit 1.8 m / 2.0 m on weapons, trees, or barns  
- ❌ Inventing a new loader beside TvsUnitLoader  

If a change reintroduces hip-float or double labels, **reject**.
