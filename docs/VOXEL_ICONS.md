# VoxelForge UI icons — review, CDN, and **game usage**

**Source:** `Creative-Sandbox-Engine/.../public/assets/ui/icons` (550 PNGs, 22 packs)  
**CDN:** `https://assets.grudge-studio.com/ui/voxel-icons/`  
**D1:** `asset_registry` · `category=ui_icon` · 550 rows  
**Usage SSOT:** `ui/voxel-icons/usage-catalog.json` (also on CDN)

---

## Where each kind of icon goes in game

| Game surface | What shows | Packs / tags | How to resolve |
|--------------|------------|--------------|----------------|
| **Command dock / RTS orders** | Attack, Move, Hold, Build… | `command-actions` · use `command` | `VoxelIcons.commandDock()` / `commandAction(slug)` |
| **Inventory grid (I)** | Bag items | use `inventory` (413) | `VoxelIcons.inventoryItems()` / `asInventoryItem` |
| **Equipment panel** | Head/chest/hand/feet/weapon/tool | use `equipment` + `equipSlot` | `VoxelIcons.equipSlotIcons('head')` |
| **Vendor shop** | Buy/sell tabs | `vendorTabs`: gear, goods, stations, combat, build | `VoxelIcons.asVendorStock('gear')` |
| **Craft panel** | Recipes | use `craft_recipe` | `listByUse('craft_recipe')` |
| **Craft stations (world)** | Bench icons | use `craft_station` | `listByUse('craft_station')` |
| **Build mode bar** | Structures / logistics | use `build_menu` / `placeable` | `listByUse('build_menu')` |
| **Quick / action bar** | Consumables + commands | use `quick_slot` / `action_bar` | filter inventory or command dock |
| **Loot popup** | Rewards | use `loot` | `listByUse('loot')` |
| **Resource HUD** | Ores / mats | use `material` | `listByUse('material')` |
| **Codex** | Everything | all 550 | full catalog |
| **VFX / skills** | FX thumbs | use `vfx_icon` | `listByUse('vfx_icon')` |

### Pack → primary use (reviewed)

| Pack | Primary in-game use |
|------|---------------------|
| **command-actions** | Command dock / orders only — **not** bag stackables |
| **fantasy-*** / **tactical-*** / **ops-tier-*** | Equip sets + vendor **gear** tab; inventory equippable by slot |
| **mining-ops / blocks / gear** | Materials, tools, stations, build pieces; vendor goods/stations |
| **crafting-stations / industrial / heavy** | Stations, utilities, gear recipes |
| **projectiles-fx** | Ammo, combat items, ability VFX icons |

Same **display name** across packs (e.g. Support Beam ×3) is intentional **tier/set variant** — always key by `pack/slug`.

---

## URL pattern

```
https://assets.grudge-studio.com/ui/voxel-icons/<pack>/<slug>.png
```

Examples:

- Command Attack → `…/command-actions/attack.png`
- Epic Magma Helm → `…/fantasy-legendary/magma-helm.png`
- Usage catalog → `…/usage-catalog.json`

---

## Runtime API (`voxel-icons.js`)

```html
<link rel="stylesheet" href="https://assets.grudge-studio.com/ui/voxel-icons/voxel-icons.css" />
<script src="https://assets.grudge-studio.com/ui/voxel-icons/voxel-icons.js"></script>
<script>
  // Commands
  VoxelIcons.renderCommandDock(document.getElementById('cmd-dock'), (cmd) => {
    console.log('order', cmd.slug);
  });

  // Inventory bag cell
  await VoxelIcons.loadCatalog();
  const item = VoxelIcons.asInventoryItem('fantasy-epic', 'magma-helm', 1);
  VoxelIcons.renderInventorySlot(bagEl, item);

  // Vendor gear tab
  const stock = await VoxelIcons.asVendorStock('gear', 24);
  stock.forEach((row) => { /* row.icon, row.buy, row.sell */ });

  // Equip head options
  const helms = await VoxelIcons.equipSlotIcons('head');
</script>
```

Local dev (voxgrudge):

```html
<link rel="stylesheet" href="ui/voxel-icons/voxel-icons.css" />
<script src="ui/voxel-icons/voxel-icons.js"></script>
<script>VoxelIcons.setPreferLocal(true);</script>
```

---

## Inventory rules (from catalog)

| Flag | Meaning |
|------|---------|
| `stackable` | Mats / consumables / ammo / blocks |
| `maxStack` | 64 mats/blocks, 99 ammo, 16 consumables, else 1 |
| `equipable` | Can move to equip panel |
| `equipSlot` | `head` \| `chest` \| `hand` \| `feet` \| `weapon` \| `tool` |
| `vendorBuy` / `vendorSell` | Placeholder scrap prices (tune per game economy) |

---

## Vendor tabs

| Tab | Contents (approx) |
|-----|-------------------|
| `gear` | 266 equip / set pieces |
| `goods` | 239 mats, recipes, utilities, consumables |
| `stations` | 62 craft stations |
| `build` | 109 placeables / structures |
| `combat` | 36 ordnance / ammo |
| `general` | leftover inventory |

---

## Counts (usage-catalog v2)

| Tag | Icons |
|-----|------:|
| inventory | 413 |
| equipment / vendor_gear | 266 |
| vendor eligible | 506 |
| craft_recipe | 141 |
| build_menu | 109 |
| craft_station | 62 |
| command / command dock | 36 / 25 |
| material | 21 |
| consumable | 14 |
| loot | 13 |

Equip slots: head 53 · chest 45 · hand 48 · feet 51 · weapon 37 · tool 32.

---

## Regenerate usage map

```bash
cd F:\GitHub\voxgrudge
node scripts/build-voxel-icons-usage.mjs
# then re-upload helpers:
cd F:\GitHub\GrudgeBuilder
# force-upload usage-catalog.json + voxel-icons.js via upload script or S3
```

Full PNG re-upload: `npm run upload:voxel-icons` in GrudgeBuilder.

---

## Integration checklist (Z-Brawl / openworld / DCQ)

1. Load `voxel-icons.js` (+ CSS if using dock/slots).
2. `await VoxelIcons.loadCatalog()` once at boot (or rely on CDN cache).
3. Wire **command dock** → `renderCommandDock` or `COMMAND_DOCK` slugs.
4. Wire **inventory** → `asInventoryItem` / `inventoryItems({ equipable:true })`.
5. Wire **vendor** → `asVendorStock(tab)` for gear/goods/stations.
6. Wire **equip panel** → `equipSlotIcons(slot)` for empty-slot pickers.
7. Prefer CDN URLs in prod; `setPreferLocal(true)` only offline.
