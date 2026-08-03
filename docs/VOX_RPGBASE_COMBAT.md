# VoxRpgBase — fleet combat SSOT

**One implementation. Many hosts. No parallel formula trees.**

| Role | Path |
|------|------|
| **SSOT** | `voxgrudge/js/vox-rpgbase-combat.js` → `window.VoxRpgBase` / CJS export |
| **Sync** | `npm run sync:rpgbase` → GRUDOX `js/` + DCQ `client/src/game/vendor/vox-rpgbase-combat.cjs` |
| **DCQ types** | `client/src/game/vox-rpgbase.ts` — **re-exports only** (no formulas) |
| **Playground** | `grudox/vox-mods/rpg-base.html` — thin host, loads SSOT |
| **Z-Brawl** | `z-brawl.html` — loads SSOT only (no hanging EnemyBrain/Controller scripts) |
| **Open World** | loads SSOT + `PlayerController` + `EnemyBrain` (those are **openworld** systems, not Z-Brawl) |
| **ai-rpg** | patterns only — see `AI_RPG_ENGINE_GAP.md` (not a runtime dep) |

## Authority rules (no hanging / dual systems)

| Concern | Single owner |
|---------|----------------|
| Weapons, block DR, stamina, combos, roles, intent | `VoxRpgBase` |
| Z-Brawl melee stance / RMB block / F swing | z-brawl host → VoxRpgBase |
| DCQ player block / parry damage | `playerRpgCombat` + `resolvePlayerDamage` → VoxRpgBase |
| DCQ stamina tick | **once** per frame: `combat-machine` root `TICK` only |
| DCQ hero `blockActive` mirror | engine reads `playerRpgCombat.isBlocking` (no second timer for player) |
| Openworld camera modes | `PlayerController` only |
| Openworld ARPG AI | `EnemyBrain` + `EnemyCombat` (not loaded in Z-Brawl) |
| Explorer combo VFX | `grudge-explorer-combat.js` (openworld) — separate from VoxRpgBase stances |

## Sync / CI

```bash
cd F:\GitHub\voxgrudge
npm run sync:rpgbase        # write copies
npm run sync:rpgbase:check  # fail if drift
# verify script includes --check
```

## API surface (do not fork)

`createCombatState`, `setWeapon` / `cycleWeapon`, `attemptAttack`, `tickAttackFrame`, `setBlocking`, `mitigateDamage`, `tick`, `softTargetAngle`, `checkArcHit`, `selectCombatIntent`, `roleForArchetype`, `allyInterceptDamage`, `applyStatus`, `moveSpeedMult`, `startDash` / `endDash`, …

Full list: `Object.keys(VoxRpgBase)` after load.

## Controls (shared semantics)

| Input | Meaning |
|-------|---------|
| Tab / cycle stance | SnS ↔ Greatsword (`sns` / `gs`) |
| Attack | LMB / F → combo (`attemptAttack` + `tickAttackFrame`) |
| Block | Hold RMB (Z-Brawl melee) or E/V (DCQ) → `setBlocking` |
| Soft target | pointer + snap cone |

## What not to do

- Do not re-copy weapon numbers into HTML/TS.
- Do not load `enemy-brain.js` in Z-Brawl “just in case”.
- Do not `tick(playerRpgCombat)` from both combat-machine and engine.
- Do not `npm i @ai-rpg-engine/modules` into HTML shells for combat.
