/**
 * Grudge HUD icons — local Craftpix skill packs (class-selector pattern).
 * Skills/weapons/class portraits use baked craftpix paths; consumables/materials use GrudgeCodex.
 */
(function (global) {
  'use strict';

  var HUD = 'ui/hud/skills/';
  var SRC = 'grudge-skill-tree/icons-src/';

  function craftpix(pack, file) {
    return SRC + pack + '/' + pack + '/' + file + '.png';
  }

  function hudPack(folder, num) {
    return HUD + folder + '/' + num + '.png';
  }

  var FROST = 'FrostMage_Free';
  var FIRE = 'FireMage_Free';
  var EARTH = 'EarthMage_Free';
  var HUNTER = 'Hunter_Free';
  var NECRO = 'Necromancer_Free';

  /** Skill id → relative PNG path (individual craftpix exports, not sprite sheets). */
  var SKILL_ICONS = {
    heroic_cleave: hudPack('swordsman', 4),
    shadow_edge: craftpix(HUNTER, 'Hunter_14'),
    blood_rush: craftpix(FIRE, 'FireMage_26'),
    execute: craftpix(FIRE, 'FireMage_19'),

    whirl_pain: hudPack('swordsman', 5),
    carnage_spin: hudPack('swordsman', 6),
    bloodletting: hudPack('swordsman', 7),
    apocalypse_cleave: hudPack('swordsman', 8),

    aimed_shot: craftpix(HUNTER, 'Hunter_4'),
    multi_shot: craftpix(HUNTER, 'Hunter_8'),
    piercing_arrow: craftpix(HUNTER, 'Hunter_25'),
    rain_of_arrows: craftpix(HUNTER, 'Hunter_22'),

    fireball: craftpix(FIRE, 'FireMage_28'),
    chain_lightning: craftpix(FIRE, 'FireMage_25'),
    blink: craftpix(FROST, 'FrostMage_19'),
    emberwrath_nova: craftpix(FIRE, 'FireMage_35'),

    burst_fire: hudPack('archer', 9),
    sniper_shot: craftpix(HUNTER, 'Hunter_24'),
    explosive_round: craftpix(HUNTER, 'Hunter_17'),
    ironstorm_minigun: hudPack('archer', 12),

    gs_whirlwind: hudPack('swordsman', 9),
    gs_leapslam: hudPack('swordsman', 10),
    gs_execute: hudPack('swordsman', 11),
    gs_channel_fury: hudPack('swordsman', 12),

    ss_shield_bash: craftpix(EARTH, 'EarthMage_4'),
    ss_dash_strike: craftpix(HUNTER, 'Hunter_6'),
    ss_heal_channel: craftpix(FIRE, 'FireMage_13'),
    ss_fortress: craftpix(EARTH, 'EarthMage_31'),

    shadow_strike_enhanced: craftpix(HUNTER, 'Hunter_14'),

    hm_overhead: hudPack('swordsman', 13),
    hm_groundslam: hudPack('swordsman', 14),
    hm_warshout: hudPack('swordsman', 15),
    hm_earthshatter: hudPack('swordsman', 16),

    mc_smite: hudPack('paladin', 5),
    mc_holyslam: hudPack('paladin', 6),
    mc_judgement: hudPack('paladin', 7),
    mc_consecrate: hudPack('paladin', 8),

    dg_backstab: craftpix(NECRO, 'Necromancer_14'),
    dg_fanofknives: craftpix(NECRO, 'Necromancer_2'),
    dg_shadowstep: craftpix(HUNTER, 'Hunter_6'),
    dg_deathmark: craftpix(NECRO, 'Necromancer_16'),

    xb_powershot: craftpix(HUNTER, 'Hunter_24'),
    xb_explosive: craftpix(HUNTER, 'Hunter_17'),
    xb_triplebolt: craftpix(HUNTER, 'Hunter_8'),
    xb_siegemode: hudPack('archer', 8),

    sp_thrust: hudPack('swordsman', 17),
    sp_sweep: hudPack('swordsman', 18),
    sp_impale: hudPack('swordsman', 19),
    sp_cyclone: hudPack('swordsman', 20),

    wn_arcaneblast: craftpix(FROST, 'FrostMage_14'),
    wn_frostbolt: craftpix(FROST, 'FrostMage_3'),
    wn_blinkstrike: craftpix(FROST, 'FrostMage_19'),
    wn_arcanebarrage: craftpix(FIRE, 'FireMage_30'),

    tm_soulfire: craftpix(NECRO, 'Necromancer_5'),
    tm_lifedrain: craftpix(NECRO, 'Necromancer_16'),
    tm_darkpact: craftpix(NECRO, 'Necromancer_7'),
    tm_doomchannel: craftpix(NECRO, 'Necromancer_8'),
  };

  var CLASS_ICONS = {
    swordsman: hudPack('swordsman', 1),
    archer: craftpix(HUNTER, 'Hunter_4'),
    mage: craftpix(FROST, 'FrostMage_14'),
    druid: craftpix(EARTH, 'EarthMage_20'),
    paladin: craftpix(EARTH, 'EarthMage_13'),
    necromancer: craftpix(NECRO, 'Necromancer_1'),
  };

  var WEAPON_SKILL_ICON = {
    sword: 'heroic_cleave',
    axe: 'whirl_pain',
    greatsword: 'gs_whirlwind',
    sword_shield: 'ss_shield_bash',
    bow: 'aimed_shot',
    staff: 'fireball',
    gun: 'burst_fire',
    hammer: 'hm_overhead',
    mace: 'mc_smite',
    dagger: 'dg_backstab',
    crossbow: 'xb_powershot',
    spear: 'sp_thrust',
    wand: 'wn_arcaneblast',
    tome: 'tm_soulfire',
  };

  var ITEM_SKILL_ICON = {
    health_potion: craftpix(FROST, 'FrostMage_13'),
    medkit: craftpix(FIRE, 'FireMage_22'),
    swiftness: craftpix(HUNTER, 'Hunter_14'),
    rage_potion: craftpix(FIRE, 'FireMage_3'),
    frag_grenade: craftpix(HUNTER, 'Hunter_17'),
    berserker: craftpix(FIRE, 'FireMage_34'),
    invuln_potion: craftpix(EARTH, 'EarthMage_25'),
    iron_helm: hudPack('paladin', 12),
    leather_vest: hudPack('swordsman', 14),
    boots: craftpix(HUNTER, 'Hunter_15'),
    power_charm: craftpix(FROST, 'FrostMage_9'),
    ally_crow: craftpix(NECRO, 'Necromancer_20'),
    ally_spider: craftpix(NECRO, 'Necromancer_21'),
    ally_snake: hudPack('druid', 5),
  };

  function skillIconUrl(skillId) {
    return SKILL_ICONS[skillId] || null;
  }

  function weaponIconUrl(weaponId) {
    if (global.GrudgeCodex) {
      var codex = GrudgeCodex.weaponIconUrl(weaponId);
      if (codex) return codex;
    }
    var sid = WEAPON_SKILL_ICON[weaponId];
    return sid ? skillIconUrl(sid) : null;
  }

  function classIconUrl(classId) {
    return CLASS_ICONS[classId] || null;
  }

  function itemIconUrl(itemId, def) {
    if (global.GrudgeCodex) {
      var codex = GrudgeCodex.itemIconUrl(itemId, def);
      if (codex) return codex;
    }
    if (def && def.hudIcon) return def.hudIcon;
    if (ITEM_SKILL_ICON[itemId]) return ITEM_SKILL_ICON[itemId];
    if (def && def.hudPack && def.hudNum) {
      return def.hudPack === 'mage'
        ? HUD + 'mage/FrostMage_' + def.hudNum + '.png'
        : hudPack(def.hudPack, def.hudNum);
    }
    return null;
  }

  function setHudIcon(el, url, fallbackEmoji) {
    if (!el) return;
    var img = el.querySelector('.hud-icon-img');
    if (!img) {
      el.textContent = '';
      img = document.createElement('img');
      img.className = 'hud-icon-img';
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
    if (img.getAttribute('src') !== url) {
      img.setAttribute('src', url);
    }
  }

  global.GrudgeHudIcons = {
    skillIconUrl: skillIconUrl,
    weaponIconUrl: weaponIconUrl,
    classIconUrl: classIconUrl,
    itemIconUrl: itemIconUrl,
    setHudIcon: setHudIcon,
    SKILL_ICONS: SKILL_ICONS,
    CLASS_ICONS: CLASS_ICONS,
  };
})(typeof window !== 'undefined' ? window : globalThis);