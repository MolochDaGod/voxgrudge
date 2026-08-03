# `@ai-rpg-engine/modules` vs VoxRpgBase fleet combat

**Package:** `@ai-rpg-engine/modules@3.5.0`  
**Homepage:** https://mcp-tool-shop-org.github.io/ai-rpg-engine/  
**Nature:** Text / simulation RPG modules for `@ai-rpg-engine/core` (entity WorldState, deterministic ticks, dialogue, factions). **Not** a Three.js or voxel runtime.

## Decision

| Approach | Choice |
|----------|--------|
| `npm i @ai-rpg-engine/modules` in Z-Brawl HTML | **No** — pulls core + content-schema + character-profile; wrong runtime model for browser shells |
| `npm i` in DCQ / Node design tools | **Optional** for content authoring / encounter packs later |
| Port patterns into `VoxRpgBase` | **Yes** — browser-friendly, shared with Z-Brawl / openworld / DCQ |

## What we ported (SSOT only: `js/vox-rpgbase-combat.js`)

DCQ `vox-rpgbase.ts` is a **typed re-export** of the vendor `.cjs` sync — not a second port.

| ai-rpg module | Idea | Fleet implementation |
|---------------|------|----------------------|
| `combatCore` | Guard DR, combat states | `mitigateDamage`, `COMBAT_FLAGS` (guarded / off_balance / exposed / fleeing) |
| `combat-resources` | Stamina spend/regen | `stamina`, block drain, attack/dash costs, guard-break |
| `combat-roles` | 8 role templates | `ROLES` brute/skirmisher/backliner/bodyguard/minion/elite/boss/coward |
| `combat-intent` | Score attack/guard/flee/… | `selectCombatIntent` → chase/flank/flee/hold |
| `combat-core` intercept | Ally bodyguard | `allyInterceptDamage` (Z-Brawl squad) |
| `statusCore` | Duration statuses | light `STATUS` + `applyStatus` / `tickStatuses` |
| `bossPhaseListener` | HP phase | Z-Brawl boss faster summon under 50% HP |
| `targeting` | Soft/explicit target | existing `softTargetAngle` / `pickClickTarget` |

## What we deliberately did **not** pull

| Module | Why skip (for now) |
|--------|---------------------|
| `dialogueCore` | Narrative graphs — Puter/Open identity + fleet chat instead |
| `cognitionCore` / beliefs | Heavy text AI; EnemyBrain covers 3D field AI |
| `factionCognition` / `rumorPropagation` | MMO faction layer later, not Z-Brawl |
| `questCore` / `opportunity-*` | Separate progression systems |
| `crafting-recipes` | Fleet already has grudge-crafting / mine-loader |
| `abilityCore` suite | DCQ already has ability keys; map later if needed |
| `world-tick` / full Engine | Incompatible with Three render loop ownership |
| `defeatFallout` / narration | Text-director facing |

## Install note (optional tooling only)

```bash
# Design / content tools — NOT required for z-brawl.html CDN shells
npm i @ai-rpg-engine/modules @ai-rpg-engine/core --save-dev
```

Use for: encounter pack authoring, balance audits (`combat-summary`), ability builders — export JSON into fleet gamedata, don’t run Engine inside the canvas.

## Forgotten gaps we closed this pass

1. **Stamina-gated block** + guard break (was infinite DR)  
2. **Role-biased enemy AI** (was pure chase)  
3. **Squad intercept** on damage  
4. **DCQ TypeScript port** + combat-machine Tab stance / E-block stamina  
5. **Combat flags** off_balance / exposed after hits  

## Still open (future)

- Full ability cooldowns catalog from `ability-builders`  
- Wound/morale aftermath (`combatRecovery`) after boss nights  
- Engagement frontline/backline for 5-man squad positioning  
- Optional Node script: convert ai-rpg encounter packs → `ENEMY_TYPES` JSON  
