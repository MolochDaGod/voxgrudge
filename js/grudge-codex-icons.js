/**
 * Grudge ObjectStore codex icons — same paths as grudge-guide + items-loader.
 * Primary: assets.grudge-studio.com · Fallback: molochdagod.github.io/ObjectStore
 */
(function (global) {
  'use strict';

  var CDN_PRIMARY = 'https://assets.grudge-studio.com';
  var CDN_FALLBACK = 'https://molochdagod.github.io/ObjectStore';

  var SKILL_PACK_CODEX = {
    swordsman: 'swordsman',
    archer: 'pirate',
    mage: 'aeromancer',
    druid: 'aeromancer',
    paladin: 'swordsman',
    necromancer: 'warlock',
  };

  var WEAPON_CODEX = {
    sword: 'icons/wcs/weapons/Sword_01.png',
    axe: 'icons/wcs/weapons/Axe_01.png',
    greatsword: 'icons/wcs/weapons/Sword_31.png',
    sword_shield: 'icons/wcs/weapons/Sword_01.png',
    bow: 'icons/wcs/weapons/Bow_01.png',
    staff: 'icons/wcs/weapons/Staff_01.png',
    gun: 'icons/wcs/weapons/Crossbow_16.png',
    hammer: 'icons/wcs/weapons/Hammer_01.png',
    mace: 'icons/wcs/weapons/Hammer_05.png',
    dagger: 'icons/wcs/weapons/Dagger_01.png',
    crossbow: 'icons/wcs/weapons/Crossbow_01.png',
    spear: 'icons/wcs/weapons/Spear_01.png',
    wand: 'icons/wcs/weapons/Staff_66.png',
    tome: 'sprites/ui/icons/item_book.png',
  };

  var CLASS_CODEX = {
    swordsman: 'sprites/ui/icons/warrior.png',
    archer: 'sprites/ui/icons/ranger.png',
    mage: 'sprites/ui/icons/mage.png',
    druid: 'sprites/ui/icons/icon_nature.png',
    paladin: 'sprites/ui/icons/icon_shield_blue.png',
    necromancer: 'sprites/ui/icons/icon_skull.png',
  };

  var RESOURCE_CODEX = {
    wood: 'icons/materials/driftwood-log.png',
    stone: 'sprites/ui/icons/icon_stone_orb.png',
    ore: 'icons/materials/iron-ore.png',
  };

  var BUILD_CODEX = {
    wood: 'icons/materials/driftwood-log.png',
    stone: 'sprites/ui/icons/icon_stone_orb.png',
    floor: 'icons/materials/ironwood-plank.png',
    heal: 'icons/consumables/health_potion.png',
  };

  var ITEM_CODEX = {
    health_potion: 'icons/consumables/health_potion.png',
    medkit: 'icons/consumables/health_potion.png',
    swiftness: 'icons/consumables/mana_potion.png',
    rage_potion: 'icons/consumables/potion_3.png',
    frag_grenade: 'icons/loot/loot_12.png',
    berserker: 'icons/consumables/potion_15.png',
    invuln_potion: 'icons/consumables/potion_1.png',
    iron_helm: 'sprites/ui/icons/item_helm.png',
    leather_vest: 'sprites/ui/icons/item_armor.png',
    boots: 'sprites/ui/icons/item_armor.png',
    power_charm: 'sprites/ui/icons/item_ring.png',
    ally_crow: 'sprites/ui/icons/icon_skull.png',
    ally_spider: 'sprites/ui/icons/icon_spider_eye.png',
    ally_snake: 'sprites/ui/icons/icon_poison_gland.png',
    t0_herb: 'icons/consumables/herb_herb_grass.png',
    t0_wood_log: 'icons/materials/driftwood-log.png',
    t0_stone_chunk: 'sprites/ui/icons/icon_stone_orb.png',
    t0_iron_ore: 'icons/materials/iron-ore.png',
    t0_health_potion: 'icons/consumables/health_potion.png',
    t0_mana_potion: 'icons/consumables/mana_potion.png',
    t0_cooked_meat: 'sprites/ui/icons/icon_meat.png',
    t0_rusty_dagger: 'icons/wcs/weapons/Dagger_01.png',
    t0_leather_scrap: 'icons/materials/rugged-leather.png',
    t0_moonflower: 'icons/consumables/herb_herb_lavender.png',
    t0_water_vial: 'icons/consumables/mana_potion.png',
    t0_salvage_gear: 'icons/materials/scrap-ingot.png',
    t0_grudge_relic: 'sprites/ui/icons/item_gem.png',
    t0_smoke_bomb: 'icons/loot/loot_12.png',
    t0_field_bandage: 'icons/consumables/health_potion.png',
  };

  function url(path, useFallback) {
    var base = useFallback ? CDN_FALLBACK : CDN_PRIMARY;
    return base + '/' + String(path).replace(/^\//, '');
  }

  function skillIconUrl(pack, num) {
    var codexPack = SKILL_PACK_CODEX[pack] || pack;
    return url('icons/skills/' + codexPack + '_' + num + '.png');
  }

  function weaponIconUrl(weaponId) {
    var p = WEAPON_CODEX[weaponId];
    return p ? url(p) : null;
  }

  function classIconUrl(classId) {
    var p = CLASS_CODEX[classId];
    return p ? url(p) : null;
  }

  function resourceIconUrl(res) {
    var p = RESOURCE_CODEX[res];
    return p ? url(p) : null;
  }

  function buildIconUrl(blockId) {
    var p = BUILD_CODEX[blockId];
    return p ? url(p) : null;
  }

  function itemIconUrl(id, def) {
    if (def && def.codexIcon) return url(def.codexIcon);
    if (ITEM_CODEX[id]) return url(ITEM_CODEX[id]);
    if (def && def.hudPack && def.hudNum) return skillIconUrl(def.hudPack, def.hudNum);
    return null;
  }

  function setHudIcon(el, primaryUrl, fallbackEmoji) {
    if (!el) return;
    var img = el.querySelector('.hud-icon-img');
    if (!img) {
      el.textContent = '';
      img = document.createElement('img');
      img.className = 'hud-icon-img';
      img.alt = '';
      el.appendChild(img);
    }
    if (!primaryUrl) {
      img.style.display = 'none';
      el.textContent = fallbackEmoji || '';
      return;
    }
    el.textContent = '';
    img.style.display = '';
    var triedFallback = false;
    img.onerror = function () {
      if (!triedFallback && primaryUrl.indexOf(CDN_PRIMARY) === 0) {
        triedFallback = true;
        img.src = primaryUrl.replace(CDN_PRIMARY, CDN_FALLBACK);
        return;
      }
      img.style.display = 'none';
      el.textContent = fallbackEmoji || '';
    };
    img.src = primaryUrl;
  }

  global.GrudgeCodex = {
    url: url,
    skillIconUrl: skillIconUrl,
    weaponIconUrl: weaponIconUrl,
    classIconUrl: classIconUrl,
    resourceIconUrl: resourceIconUrl,
    buildIconUrl: buildIconUrl,
    itemIconUrl: itemIconUrl,
    setHudIcon: setHudIcon,
    ITEM_CODEX: ITEM_CODEX,
    WEAPON_CODEX: WEAPON_CODEX,
  };
})(typeof window !== 'undefined' ? window : globalThis);