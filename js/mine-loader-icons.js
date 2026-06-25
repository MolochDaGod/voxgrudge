/**
 * Mine-Loader icon resolver — gold-framed ui-icons + item-icons catalog.
 * Source: Mine-Loader/artifacts/voxelcraft/public/assets
 */
(function (global) {
  'use strict';

  var BASE = 'assets/mine-loader/';

  function ui(key) {
    return BASE + 'ui-icons/' + key + '.png';
  }

  function item(pack, slug) {
    return BASE + 'item-icons/' + pack + '/' + slug + '.png';
  }

  var SKILL_ICONS = {
    heroic_cleave: ui('attack'),
    shadow_edge: ui('ambush'),
    blood_rush: ui('charge'),
    execute: item('command-actions', 'siege'),

    whirl_pain: ui('aoe-blast'),
    carnage_spin: item('projectiles-fx', 'shockwave-ring'),
    bloodletting: item('projectiles-fx', 'crystal-spike'),
    apocalypse_cleave: item('mining-ops', 'aoe-blast'),

    aimed_shot: item('projectiles-fx', 'laser-sight'),
    multi_shot: item('projectiles-fx', 'tracer-round'),
    piercing_arrow: item('projectiles-fx', 'rail-slug'),
    rain_of_arrows: item('projectiles-fx', 'cluster-bomb'),

    fireball: item('projectiles-fx', 'flare-round'),
    chain_lightning: item('projectiles-fx', 'arc-discharge'),
    blink: item('projectiles-fx', 'gravity-orb'),
    emberwrath_nova: item('projectiles-fx', 'vortex-blast'),

    burst_fire: item('tactical-common', 'assault-rifle'),
    sniper_shot: item('projectiles-fx', 'photon-lance'),
    explosive_round: item('projectiles-fx', 'grenade'),
    ironstorm_minigun: item('tactical-rare', 'pulse-rifle'),

    gs_whirlwind: item('fantasy-epic', 'crystal-edge'),
    gs_leapslam: item('ops-tier-6', 'sledgehammer'),
    gs_execute: item('fantasy-legendary', 'runeblade'),
    gs_channel_fury: ui('boss-fight'),

    ss_shield_bash: ui('defend'),
    ss_dash_strike: ui('charge'),
    ss_heal_channel: item('mining-blocks', 'health-pack'),
    ss_fortress: ui('guard'),

    shadow_strike_enhanced: ui('ambush'),

    hm_overhead: item('fantasy-common', 'hammer'),
    hm_groundslam: item('ops-tier-6', 'sledgehammer'),
    hm_warshout: ui('rally'),
    hm_earthshatter: item('mining-ops', 'cave-in'),

    mc_smite: ui('attack'),
    mc_holyslam: item('fantasy-common', 'hammer'),
    mc_judgement: item('command-actions', 'siege'),
    mc_consecrate: item('projectiles-fx', 'fusion-core'),

    dg_backstab: item('tactical-common', 'knife'),
    dg_fanofknives: item('tactical-rare', 'mono-knife'),
    dg_shadowstep: ui('ambush'),
    dg_deathmark: item('projectiles-fx', 'emp-pulse'),

    xb_powershot: item('fantasy-rare', 'repeater-crossbow'),
    xb_explosive: item('projectiles-fx', 'grenade'),
    xb_triplebolt: item('fantasy-common', 'crossbow'),
    xb_siegemode: item('mining-ops', 'projectile-launcher'),

    sp_thrust: item('fantasy-epic', 'crystal-edge'),
    sp_sweep: item('fantasy-rare', 'stoneblade-sword'),
    sp_impale: item('projectiles-fx', 'crystal-spike'),
    sp_cyclone: item('projectiles-fx', 'shockwave-ring'),

    wn_arcaneblast: item('projectiles-fx', 'plasma-bolt'),
    wn_frostbolt: item('projectiles-fx', 'ion-cannon-shot'),
    wn_blinkstrike: item('projectiles-fx', 'gravity-orb'),
    wn_arcanebarrage: item('projectiles-fx', 'energy-beam'),

    tm_soulfire: item('projectiles-fx', 'fusion-core'),
    tm_lifedrain: item('projectiles-fx', 'nano-swarm'),
    tm_darkpact: item('projectiles-fx', 'emp-pulse'),
    tm_doomchannel: item('projectiles-fx', 'quantum-torpedo'),
  };

  var WEAPON_ICONS = {
    sword: item('fantasy-common', 'sword'),
    axe: item('fantasy-common', 'pickaxe'),
    greatsword: item('fantasy-legendary', 'runeblade'),
    sword_shield: ui('defend'),
    bow: item('fantasy-rare', 'repeater-crossbow'),
    staff: item('projectiles-fx', 'energy-beam'),
    gun: item('tactical-common', 'assault-rifle'),
    hammer: item('fantasy-common', 'hammer'),
    mace: item('ops-tier-6', 'sledgehammer'),
    dagger: item('tactical-common', 'knife'),
    crossbow: item('fantasy-common', 'crossbow'),
    spear: item('fantasy-epic', 'crystal-edge'),
    wand: item('projectiles-fx', 'plasma-bolt'),
    tome: ui('mission-log'),
  };

  var CLASS_ICONS = {
    swordsman: ui('attack'),
    archer: item('projectiles-fx', 'tracer-round'),
    mage: item('projectiles-fx', 'arc-discharge'),
    druid: ui('harvest'),
    paladin: ui('defend'),
    necromancer: item('projectiles-fx', 'gravity-orb'),
  };

  var ITEM_ICONS = {
    health_potion: item('mining-blocks', 'health-pack'),
    medkit: ui('health-pack'),
    swiftness: ui('explore'),
    rage_potion: ui('charge'),
    frag_grenade: item('projectiles-fx', 'grenade'),
    berserker: ui('boss-fight'),
    invuln_potion: ui('defend'),
    iron_helm: item('fantasy-common', 'iron-helm'),
    leather_vest: item('fantasy-common', 'leather-armor'),
    boots: item('fantasy-common', 'leather-boots'),
    power_charm: item('projectiles-fx', 'fusion-core'),
    ally_crow: ui('scout'),
    ally_spider: item('projectiles-fx', 'nano-swarm'),
    ally_snake: ui('ambush'),
    t0_herb: ui('cave-mushroom'),
    t0_wood_log: ui('wooden-pickaxe'),
    t0_stone_chunk: ui('stone-block'),
    t0_iron_ore: ui('iron-ore'),
    t0_health_potion: item('mining-blocks', 'health-pack'),
    t0_mana_potion: item('projectiles-fx', 'plasma-bolt'),
    t0_cooked_meat: ui('rest'),
    t0_rusty_dagger: item('tactical-common', 'knife'),
    t0_leather_scrap: item('fantasy-common', 'leather-gloves'),
    t0_moonflower: ui('pray'),
    t0_water_vial: item('projectiles-fx', 'ion-cannon-shot'),
    t0_salvage_gear: ui('repair'),
    t0_grudge_relic: ui('treasure-chest'),
    t0_smoke_bomb: item('projectiles-fx', 'emp-pulse'),
    t0_field_bandage: item('mining-blocks', 'health-pack'),
  };

  var RESOURCE_ICONS = {
    wood: ui('wooden-pickaxe'),
    stone: ui('stone-block'),
    ore: ui('iron-ore'),
  };

  var BUILD_ICONS = {
    wood: ui('support-beam'),
    stone: ui('stone-block'),
    floor: ui('dirt-block'),
    heal: item('mining-blocks', 'health-pack'),
  };

  function skillIconUrl(id) {
    return SKILL_ICONS[id] || null;
  }

  function weaponIconUrl(id) {
    return WEAPON_ICONS[id] || null;
  }

  function classIconUrl(id) {
    return CLASS_ICONS[id] || null;
  }

  function itemIconUrl(id, def) {
    if (def && def.mineIcon) return def.mineIcon;
    if (ITEM_ICONS[id]) return ITEM_ICONS[id];
    if (def && def.codexIcon && global.GrudgeCodex) return GrudgeCodex.url(def.codexIcon);
    return null;
  }

  function resourceIconUrl(res) {
    return RESOURCE_ICONS[res] || null;
  }

  function buildIconUrl(blockId) {
    return BUILD_ICONS[blockId] || null;
  }

  function setHudIcon(el, url, fallbackEmoji) {
    if (!el) return;
    var img = el.querySelector('.hud-icon-img');
    if (!img) {
      el.textContent = '';
      img = document.createElement('img');
      img.className = 'hud-icon-img ml-icon';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      el.appendChild(img);
    }
    if (!url) {
      img.removeAttribute('src');
      img.style.display = 'none';
      el.classList.remove('has-hud-icon');
      el.textContent = fallbackEmoji || '';
      return;
    }
    el.textContent = '';
    img.style.display = '';
    img.classList.add('is-loading');
    img.onload = function () {
      img.classList.remove('is-loading');
      el.classList.add('has-hud-icon');
    };
    img.onerror = function () {
      img.classList.remove('is-loading');
      img.style.display = 'none';
      el.classList.remove('has-hud-icon');
      el.textContent = fallbackEmoji || '';
    };
    if (img.getAttribute('src') !== url) img.setAttribute('src', url);
  }

  global.MineLoaderIcons = {
    BASE: BASE,
    ui: ui,
    item: item,
    skillIconUrl: skillIconUrl,
    weaponIconUrl: weaponIconUrl,
    classIconUrl: classIconUrl,
    itemIconUrl: itemIconUrl,
    resourceIconUrl: resourceIconUrl,
    buildIconUrl: buildIconUrl,
    setHudIcon: setHudIcon,
    SKILL_ICONS: SKILL_ICONS,
    WEAPON_ICONS: WEAPON_ICONS,
    CLASS_ICONS: CLASS_ICONS,
    ITEM_ICONS: ITEM_ICONS,
  };
})(typeof window !== 'undefined' ? window : globalThis);