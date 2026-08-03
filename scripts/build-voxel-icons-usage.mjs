#!/usr/bin/env node
/**
 * Build usage-catalog.json from VoxelForge voxel-icons.csv
 * Maps every icon → inventory / vendor / command / craft / build surfaces.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SRC =
  process.env.VOXEL_ICONS_SRC ||
  path.join(
    process.env.USERPROFILE || '',
    'Documents',
    '_grudge-kit-extract',
    'Creative-Sandbox-Engine',
    'artifacts',
    'voxel-studio',
    'public',
    'assets',
    'ui',
    'icons',
  );

const CDN = 'https://assets.grudge-studio.com';
const PREFIX = 'ui/voxel-icons';

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  function splitLine(line) {
    const row = [];
    let cur = '';
    let inQ = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        if (inQ && line[c + 1] === '"') {
          cur += '"';
          c++;
        } else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        row.push(cur);
        cur = '';
      } else cur += ch;
    }
    row.push(cur);
    return row;
  }
  const headers = splitLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const o = {};
    headers.forEach((h, idx) => {
      o[h] = (cols[idx] || '').replace(/^"|"$/g, '');
    });
    rows.push(o);
  }
  return rows;
}

function derive(row) {
  const role = (row.craft_role || '').toLowerCase();
  const cat = (row.category || '').toLowerCase();
  const slot = (row.slot || '').toLowerCase();
  const pack = row.pack || '';
  const uses = new Set();
  const surfaces = new Set();

  if (role.includes('ui action') || cat === 'ui-action') {
    uses.add('command');
    uses.add('action_bar');
    uses.add('hotkey');
    surfaces.add('command_dock');
    surfaces.add('rts_panel');
  }
  if (
    role.includes('set piece') ||
    cat === 'set-piece' ||
    ['head', 'chest', 'hand', 'feet', 'weapon', 'tool'].includes(slot)
  ) {
    uses.add('inventory');
    uses.add('equipment');
    uses.add('vendor_gear');
    surfaces.add('inventory_grid');
    surfaces.add('equip_panel');
    surfaces.add('vendor_shop');
    if (slot) uses.add('slot_' + slot);
  }
  if (
    role.includes('craftable recipe') ||
    role.includes('research recipe') ||
    cat === 'weapon' ||
    cat === 'tool' ||
    cat === 'wearable'
  ) {
    uses.add('inventory');
    uses.add('craft_recipe');
    uses.add('vendor_goods');
    surfaces.add('inventory_grid');
    surfaces.add('craft_panel');
    surfaces.add('vendor_shop');
  }
  if (role.includes('crafting station') || cat === 'station') {
    uses.add('build_menu');
    uses.add('craft_station');
    uses.add('vendor_station');
    surfaces.add('build_bar');
    surfaces.add('world_interact');
    surfaces.add('vendor_shop');
  }
  if (
    role.includes('gathered material') ||
    cat === 'material' ||
    cat === 'block' ||
    role.includes('building material')
  ) {
    uses.add('inventory');
    uses.add('material');
    uses.add('vendor_buy_sell');
    surfaces.add('inventory_grid');
    surfaces.add('vendor_shop');
    surfaces.add('resource_hud');
  }
  if (
    role.includes('buildable') ||
    cat === 'structure' ||
    cat === 'logistics' ||
    cat === 'storage' ||
    cat === 'beacon' ||
    cat === 'trap' ||
    cat === 'power'
  ) {
    uses.add('build_menu');
    uses.add('placeable');
    surfaces.add('build_bar');
    surfaces.add('ghost_place');
  }
  if (role.includes('consumable') || cat === 'consumable') {
    uses.add('inventory');
    uses.add('consumable');
    uses.add('vendor_goods');
    uses.add('quick_slot');
    surfaces.add('inventory_grid');
    surfaces.add('action_bar');
    surfaces.add('vendor_shop');
  }
  if (role.includes('ordnance') || role.includes('ammo') || cat === 'throwable' || cat === 'projectile') {
    uses.add('inventory');
    uses.add('combat_item');
    uses.add('vendor_goods');
    uses.add('ammo');
    surfaces.add('inventory_grid');
    surfaces.add('weapon_panel');
    surfaces.add('vendor_shop');
  }
  if (role.includes('reward') || cat === 'reward') {
    uses.add('loot');
    uses.add('inventory');
    uses.add('quest_reward');
    surfaces.add('loot_popup');
    surfaces.add('inventory_grid');
  }
  if (role.includes('utility') || cat === 'utility' || cat === 'navigation' || cat === 'item') {
    uses.add('inventory');
    uses.add('utility');
    uses.add('vendor_goods');
    surfaces.add('inventory_grid');
    surfaces.add('vendor_shop');
  }
  if (cat === 'effect' || role.includes('fx')) {
    uses.add('vfx_icon');
    uses.add('ability_fx');
    surfaces.add('skill_panel');
    surfaces.add('combat_log');
  }
  if (pack === 'command-actions') {
    uses.add('command');
    uses.add('action_bar');
    uses.add('rts_order');
    surfaces.add('command_dock');
  }
  if (pack.startsWith('ops-tier-') || pack.startsWith('fantasy-') || pack.startsWith('tactical-')) {
    uses.add('tiered_gear');
    uses.add('progression');
    surfaces.add('equip_panel');
    surfaces.add('vendor_shop');
  }
  uses.add('codex');
  surfaces.add('codex');

  const vendorTabs = [];
  if (uses.has('vendor_gear') || uses.has('equipment')) vendorTabs.push('gear');
  if (uses.has('vendor_goods') || uses.has('consumable') || uses.has('material')) vendorTabs.push('goods');
  if (uses.has('vendor_station') || uses.has('craft_station')) vendorTabs.push('stations');
  if (uses.has('combat_item') || uses.has('ammo')) vendorTabs.push('combat');
  if (uses.has('build_menu') || uses.has('placeable')) vendorTabs.push('build');
  if (!vendorTabs.length && uses.has('inventory')) vendorTabs.push('general');

  const stackable =
    uses.has('material') || uses.has('consumable') || uses.has('ammo') || uses.has('combat_item') || cat === 'block';
  const equipable =
    uses.has('equipment') ||
    uses.has('slot_head') ||
    uses.has('slot_chest') ||
    uses.has('slot_hand') ||
    uses.has('slot_feet') ||
    uses.has('slot_weapon') ||
    uses.has('slot_tool');
  const maxStack = stackable ? (cat === 'block' || uses.has('material') ? 64 : uses.has('ammo') ? 99 : 16) : 1;

  // Suggested default bag value for vendors (placeholder economy)
  let vendorBuy = 0;
  let vendorSell = 0;
  if (uses.has('material')) {
    vendorBuy = 4;
    vendorSell = 2;
  } else if (uses.has('consumable')) {
    vendorBuy = 12;
    vendorSell = 5;
  } else if (uses.has('equipment') || uses.has('tiered_gear')) {
    const tierMult = { common: 1, rare: 2, epic: 4, legendary: 8, T1: 1, T2: 1.5, T3: 2, T4: 3, T5: 4, T6: 6 };
    const tm = tierMult[row.tier] || 1;
    vendorBuy = Math.round(40 * tm);
    vendorSell = Math.round(vendorBuy * 0.4);
  } else if (uses.has('craft_station') || uses.has('placeable')) {
    vendorBuy = 80;
    vendorSell = 25;
  } else if (uses.has('combat_item') || uses.has('ammo')) {
    vendorBuy = 8;
    vendorSell = 3;
  }

  return {
    uses: [...uses].sort(),
    surfaces: [...surfaces].sort(),
    vendorTabs,
    stackable,
    equipable,
    maxStack,
    equipSlot: slot || null,
    vendorBuy,
    vendorSell,
  };
}

function main() {
  const csvPath = path.join(SRC, 'voxel-icons.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Missing CSV', csvPath);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const icons = rows.map((r) => {
    const d = derive(r);
    const pack = r.pack;
    const slug = r.slug;
    return {
      id: pack + '/' + slug,
      name: r.name,
      pack,
      slug,
      category: r.category,
      slot: r.slot || null,
      set: r.set || null,
      tier: r.tier || null,
      craft_role: r.craft_role,
      blurb: r.use,
      crafting: r.crafting,
      resource_info: r.resource_info,
      mining_info: r.mining_info,
      theme: r.theme,
      url: `${CDN}/${PREFIX}/${pack}/${slug}.png`,
      localPath: `ui/voxel-icons/${pack}/${slug}.png`,
      ...d,
    };
  });

  const byUse = {};
  const bySurface = {};
  const byVendorTab = {};
  const byPack = {};
  const byEquipSlot = {};
  const byId = {};
  const commands = [];
  const inventory = [];
  const vendor = [];

  for (const ic of icons) {
    byId[ic.id] = ic;
    byPack[ic.pack] = byPack[ic.pack] || [];
    byPack[ic.pack].push(ic.id);
    for (const u of ic.uses) {
      byUse[u] = byUse[u] || [];
      byUse[u].push(ic.id);
    }
    for (const s of ic.surfaces) {
      bySurface[s] = bySurface[s] || [];
      bySurface[s].push(ic.id);
    }
    for (const t of ic.vendorTabs) {
      byVendorTab[t] = byVendorTab[t] || [];
      byVendorTab[t].push(ic.id);
    }
    if (ic.equipSlot) {
      byEquipSlot[ic.equipSlot] = byEquipSlot[ic.equipSlot] || [];
      byEquipSlot[ic.equipSlot].push(ic.id);
    }
    if (ic.uses.includes('command') || ic.uses.includes('rts_order')) commands.push(ic.id);
    if (ic.uses.includes('inventory')) inventory.push(ic.id);
    if (ic.vendorTabs.length) vendor.push(ic.id);
  }

  // Command actions ordered for action dock
  const commandOrder = [
    'attack',
    'move',
    'stop',
    'hold',
    'patrol',
    'guard',
    'defend',
    'charge',
    'retreat',
    'ambush',
    'siege',
    'rally',
    'scout',
    'explore',
    'harvest',
    'build',
    'repair',
    'trade',
    'inventory',
    'equip',
    'unequip',
    'loot',
    'disband',
    'rest',
    'pray',
  ];
  const commandDock = commandOrder
    .map((slug) => 'command-actions/' + slug)
    .filter((id) => byId[id]);

  const out = {
    version: 2,
    generatedAt: new Date().toISOString(),
    sourceCsv: csvPath,
    cdnBase: `${CDN}/${PREFIX}`,
    count: icons.length,
    usageLegend: {
      command: 'RTS/RPG order buttons (action dock, unit commands)',
      action_bar: 'Bottom/quick action bar slots',
      hotkey: 'Bindable hotkey icon',
      inventory: 'Player bag / inventory grid cell',
      equipment: 'Worn gear; equip panel by equipSlot',
      vendor_gear: 'Vendor shop gear tab',
      vendor_goods: 'Vendor goods / mats / consumables',
      vendor_station: 'Vendor stations / craft benches',
      vendor_buy_sell: 'Materials bought/sold at vendors',
      craft_recipe: 'Crafting panel recipe icon',
      craft_station: 'World station / craft UI',
      build_menu: 'Build mode structure placement',
      placeable: 'Ghost-placeable world object',
      consumable: 'Usable from bag or quick slot',
      combat_item: 'Grenades, charges, combat tools',
      ammo: 'Projectile ammo stacks',
      material: 'Crafting ingredients / ore',
      loot: 'Loot popup / quest rewards',
      quest_reward: 'Quest reward presentation',
      quick_slot: 'Hotbar consumable/utility',
      codex: 'Catalog / encyclopedia',
      tiered_gear: 'Fantasy/tactical/ops set lines',
      progression: 'Tier/set upgrade progression',
      vfx_icon: 'Skill/VFX thumbnails',
      ability_fx: 'Ability effect picker',
      rts_order: 'RTS unit order',
      utility: 'Misc bag tools',
      slot_head: 'Equip head',
      slot_chest: 'Equip chest',
      slot_hand: 'Equip hands',
      slot_feet: 'Equip feet',
      slot_weapon: 'Equip weapon',
      slot_tool: 'Equip tool',
    },
    surfaceLegend: {
      inventory_grid: 'I-key inventory grid',
      equip_panel: 'Equipment paper-doll slots',
      vendor_shop: 'Vendor trade UI tabs',
      command_dock: 'Command / order buttons',
      craft_panel: 'Crafting recipes list',
      build_bar: 'Build mode selection bar',
      action_bar: 'Combat/utility hotbar',
      loot_popup: 'Chest / kill loot',
      resource_hud: 'Stockpile strip',
      codex: 'Item codex',
      world_interact: 'E-interact station icon',
      ghost_place: 'Build ghost cursor',
      skill_panel: 'Ability/VFX picker',
      weapon_panel: 'Weapon/ammo panel',
      rts_panel: 'RTS orders panel',
      combat_log: 'Combat log chip',
    },
    vendorTabLegend: {
      gear: 'Armor/weapons/tools for sale',
      goods: 'Mats, consumables, utilities',
      stations: 'Craft benches & stations',
      combat: 'Ordnance & ammo',
      build: 'Structures & logistics kits',
      general: 'Misc inventory items',
    },
    indexes: {
      byUse: Object.fromEntries(Object.entries(byUse).map(([k, v]) => [k, v.length])),
      bySurface: Object.fromEntries(Object.entries(bySurface).map(([k, v]) => [k, v.length])),
      byVendorTab: Object.fromEntries(Object.entries(byVendorTab).map(([k, v]) => [k, v.length])),
      byEquipSlot: Object.fromEntries(Object.entries(byEquipSlot).map(([k, v]) => [k, v.length])),
      byPack: Object.fromEntries(Object.entries(byPack).map(([k, v]) => [k, v.length])),
    },
    lists: {
      commandDock,
      commands,
      inventoryEligible: inventory,
      vendorEligible: vendor,
    },
    byUse,
    bySurface,
    byVendorTab,
    byEquipSlot,
    byPack,
    icons,
  };

  const dests = [
    path.join(SRC, 'usage-catalog.json'),
    path.join(ROOT, 'ui', 'voxel-icons', 'usage-catalog.json'),
    path.join(ROOT, '..', 'GrudgeBuilder', 'dist', 'voxel-icons-usage-catalog.json'),
  ];
  for (const d of dests) {
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.writeFileSync(d, JSON.stringify(out, null, 0));
    console.log('wrote', d, fs.statSync(d).size);
  }

  // Human-readable pack usage map (markdown section data as JSON for docs)
  const packUsage = {};
  for (const [pack, ids] of Object.entries(byPack)) {
    const sample = ids.slice(0, 3).map((id) => byId[id]);
    const useTally = {};
    for (const id of ids) {
      for (const u of byId[id].uses) useTally[u] = (useTally[u] || 0) + 1;
    }
    const topUses = Object.entries(useTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([u, n]) => `${u}(${n})`);
    packUsage[pack] = {
      count: ids.length,
      topUses,
      primarySurface: sample[0]?.surfaces?.[0] || 'codex',
      how:
        pack === 'command-actions'
          ? 'Command dock / RTS orders / action bar — not bag items'
          : pack.startsWith('fantasy-') || pack.startsWith('tactical-') || pack.startsWith('ops-tier-')
            ? 'Equipment + vendor gear tabs; inventory equip by slot'
            : pack.includes('mining') || pack.includes('industrial') || pack.includes('heavy') || pack.includes('crafting')
              ? 'Inventory materials/tools, craft stations, build menu, vendor goods/stations'
              : pack === 'projectiles-fx'
                ? 'Ammo / combat items / VFX skill icons'
                : 'Codex + inventory/vendor as tagged',
    };
  }
  fs.writeFileSync(
    path.join(ROOT, 'ui', 'voxel-icons', 'pack-usage.json'),
    JSON.stringify({ version: 1, packs: packUsage }, null, 2),
  );

  console.log('icons', out.count);
  console.log('byUse', out.indexes.byUse);
  console.log('vendorTabs', out.indexes.byVendorTab);
  console.log('equipSlots', out.indexes.byEquipSlot);
  console.log('commandDock', commandDock.length, 'inventory', inventory.length, 'vendor', vendor.length);
}

main();
