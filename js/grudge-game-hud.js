/**
 * grudge-game HUD resolver — mirrors Character-Animator grudge-game pages.
 * Icons from Grudge ObjectStore (weaponSkills / master-items); frames from CraftPix UI kit.
 */
(function (global) {
  'use strict';

  var GRUDGE_API_BASE = 'https://molochdagod.github.io/ObjectStore';
  // Always absolute so icons work regardless of base URL / deep routes
  var ASSET_BASE = '/assets/grudge-game/';
  var UI_BASE = ASSET_BASE + 'ui/';
  var CLASS_EMBLEM_BASE = ASSET_BASE + 'class-emblems/';
  var MINE_UI = '/assets/mine-loader/ui-icons/';
  var LOCAL_FALLBACK = '/branding/logo-256.png';
  /** Canonical feed (weaponSkills.json is archived → master-weaponSkills.json). */
  var WEAPON_SKILLS_URL = GRUDGE_API_BASE + '/api/v1/master-weaponSkills.json';
  var WEAPON_SKILLS_FALLBACK = GRUDGE_API_BASE + '/api/v1/archive/weaponSkills.v1.json';
  var MASTER_ITEMS_URL = GRUDGE_API_BASE + '/api/v1/master-items.json';

  /** Local mine-loader / CraftPix when ObjectStore skill row is missing. */
  var LOCAL_SKILL_ICONS = {
    heroic_cleave: MINE_UI + 'attack.png',
    shadow_edge: MINE_UI + 'ambush.png',
    blood_rush: MINE_UI + 'charge.png',
    execute: MINE_UI + 'boss-fight.png',
    whirl_pain: MINE_UI + 'aoe-blast.png',
    carnage_spin: MINE_UI + 'combat-pad.png',
    bloodletting: MINE_UI + 'damage-log.png',
    apocalypse_cleave: MINE_UI + 'explosive-charge.png',
    aimed_shot: MINE_UI + 'scout.png',
    multi_shot: MINE_UI + 'projectile-launcher.png',
    piercing_arrow: MINE_UI + 'attack.png',
    rain_of_arrows: MINE_UI + 'aoe-blast.png',
    fireball: MINE_UI + 'aoe-blast.png',
    chain_lightning: MINE_UI + 'skill-vfx-lab.png',
    blink: MINE_UI + 'parkour.png',
    emberwrath_nova: MINE_UI + 'boss-core.png',
    burst_fire: MINE_UI + 'projectile-launcher.png',
    sniper_shot: MINE_UI + 'scout.png',
    explosive_round: MINE_UI + 'explosive-barrel.png',
    ironstorm_minigun: MINE_UI + 'combat-pad.png',
  };
  var LOCAL_WEAPON_ICONS = {
    sword: UI_BASE + 'Icons_128x128/Icon_Sword_128.png',
    axe: MINE_UI + 'attack.png',
    bow: MINE_UI + 'scout.png',
    staff: UI_BASE + 'Icons_128x128/Icon_Fireball_128.png',
    gun: MINE_UI + 'projectile-launcher.png',
    greatsword: UI_BASE + 'Icons_128x128/Icon_Sword_128.png',
    sword_shield: UI_BASE + 'Icons_128x128/Icon_Shield_128.png',
    hammer: MINE_UI + 'build.png',
    mace: UI_BASE + 'Icons_128x128/Icon_Shield_128.png',
    dagger: MINE_UI + 'ambush.png',
    crossbow: MINE_UI + 'projectile-launcher.png',
    spear: MINE_UI + 'attack.png',
    wand: UI_BASE + 'Icons_128x128/Icon_Fireball_128.png',
    tome: UI_BASE + 'Icons_128x128/Icon_Leafs_128.png',
  };
  var LOCAL_RESOURCE_ICONS = {
    wood: MINE_UI + 'support-beam.png',
    stone: MINE_UI + 'stone-block.png',
    ore: MINE_UI + 'iron-ore.png',
  };
  var LOCAL_BUILD_ICONS = {
    wood: MINE_UI + 'support-beam.png',
    stone: MINE_UI + 'stone-block.png',
    floor: MINE_UI + 'dirt-block.png',
    heal: MINE_UI + 'health-pack.png',
  };

  var GAME_TO_API_WEAPON = {
    sword: 'SWORD',
    axe: 'AXE',
    bow: 'BOW',
    crossbow: 'CROSSBOW',
    gun: 'GUN',
    dagger: 'DAGGER',
    staff: 'STAFF',
    hammer: 'HAMMER',
    sword_shield: 'SHIELD',
    greatsword: 'GREATSWORD',
    spear: 'SPEAR',
    tome: 'TOME',
    mace: 'MACE',
    wand: 'WAND',
  };

  var VOX_CLASS_TO_EMBLEM = {
    swordsman: 'warrior',
    archer: 'ranger',
    mage: 'mage',
    druid: 'ranger',
    paladin: 'warrior',
    necromancer: 'mage',
  };

  /** voxgrudge weapon id → skill slot ids (Q/E/R/F order). */
  var VOX_WEAPON_SKILLS = {
    sword: ['heroic_cleave', 'shadow_edge', 'blood_rush', 'execute'],
    axe: ['whirl_pain', 'carnage_spin', 'bloodletting', 'apocalypse_cleave'],
    bow: ['aimed_shot', 'multi_shot', 'piercing_arrow', 'rain_of_arrows'],
    staff: ['fireball', 'chain_lightning', 'blink', 'emberwrath_nova'],
    gun: ['burst_fire', 'sniper_shot', 'explosive_round', 'ironstorm_minigun'],
    greatsword: ['gs_whirlwind', 'gs_leapslam', 'gs_execute', 'gs_channel_fury'],
    sword_shield: ['ss_shield_bash', 'ss_dash_strike', 'ss_heal_channel', 'ss_fortress'],
    hammer: ['hm_overhead', 'hm_groundslam', 'hm_warshout', 'hm_earthshatter'],
    mace: ['mc_smite', 'mc_holyslam', 'mc_judgement', 'mc_consecrate'],
    dagger: ['dg_backstab', 'dg_fanofknives', 'dg_shadowstep', 'dg_deathmark'],
    crossbow: ['xb_powershot', 'xb_explosive', 'xb_triplebolt', 'xb_siegemode'],
    spear: ['sp_thrust', 'sp_sweep', 'sp_impale', 'sp_cyclone'],
    wand: ['wn_arcaneblast', 'wn_frostbolt', 'wn_blinkstrike', 'wn_arcanebarrage'],
    tome: ['tm_soulfire', 'tm_lifedrain', 'tm_darkpact', 'tm_doomchannel'],
  };

  var VOX_ITEM_KEYS = {
    health_potion: ['health potion', 'minor healing', 'healing potion'],
    medkit: ['medkit', 'field kit', 'first aid'],
    swiftness: ['swiftness', 'speed potion', 'haste'],
    rage_potion: ['rage', 'berserk'],
    frag_grenade: ['grenade', 'frag'],
    berserker: ['berserker', 'fury elixir'],
    invuln_potion: ['invulner', 'ward potion', 'iron skin'],
    iron_helm: ['iron helm', 'helm'],
    leather_vest: ['leather vest', 'vest', 'cuirass'],
    boots: ['boot', 'greave', 'march'],
    power_charm: ['charm', 'amulet', 'sigil'],
  };

  var state = {
    weaponSkills: null,
    items: null,
    itemByName: null,
    ready: false,
    loadPromise: null,
  };

  function grudgeAssetUrl(path) {
    if (!path) return '';
    return GRUDGE_API_BASE + '/' + String(path).replace(/^\//, '');
  }

  function tex(rel) {
    return UI_BASE + rel;
  }

  function allWeaponTypes(doc) {
    if (!doc) return [];
    var out = [];
    var seen = {};
    (doc.weaponTypes || []).forEach(function (w) {
      seen[w.id.toUpperCase()] = w;
      out.push(w);
    });
    (doc.artifactWeapons || []).forEach(function (w) {
      var k = w.id.toUpperCase();
      if (seen[k]) {
        var idx = out.findIndex(function (x) { return x.id.toUpperCase() === k; });
        if (idx >= 0) out[idx] = w;
      } else {
        seen[k] = w;
        out.push(w);
      }
    });
    return out;
  }

  function findWeaponType(apiId) {
    if (!apiId || !state.weaponSkills) return null;
    var up = apiId.toUpperCase();
    return allWeaponTypes(state.weaponSkills).find(function (w) {
      return w.id.toUpperCase() === up;
    }) || null;
  }

  function flattenSkills(weaponType) {
    var out = [];
    (weaponType.slots || []).forEach(function (slot) {
      (slot.skills || []).forEach(function (sk) { out.push(sk); });
    });
    return out;
  }

  function buildItemIndex(doc) {
    var map = new Map();
    if (!doc || !Array.isArray(doc.items)) return map;
    doc.items.forEach(function (it) {
      var name = (it.name || '').toLowerCase().trim();
      if (name && it.iconUrl && !map.has(name)) map.set(name, it.iconUrl);
      var key = (it.id || it.key || '').toLowerCase().trim();
      if (key && it.iconUrl && !map.has(key)) map.set(key, it.iconUrl);
    });
    return map;
  }

  function normalizeWeaponDoc(doc) {
    if (!doc) return null;
    // Archived stub: { deprecated, replacement }
    if (doc.deprecated || doc.archived) return null;
    if (Array.isArray(doc.weaponTypes) && doc.weaponTypes.length) return doc;
    return null;
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function loadFeeds() {
    if (state.loadPromise) return state.loadPromise;
    state.loadPromise = Promise.all([
      fetchJson(WEAPON_SKILLS_URL)
        .then(function (doc) {
          var n = normalizeWeaponDoc(doc);
          if (n) return n;
          return fetchJson(WEAPON_SKILLS_FALLBACK).then(normalizeWeaponDoc);
        })
        .catch(function () {
          return fetchJson(WEAPON_SKILLS_FALLBACK).then(normalizeWeaponDoc).catch(function () { return null; });
        }),
      fetchJson(MASTER_ITEMS_URL).catch(function () { return null; }),
    ])
      .then(function (pair) {
        state.weaponSkills = pair[0];
        state.items = pair[1];
        state.itemByName = buildItemIndex(pair[1]);
        state.ready = true;
        return state;
      })
      .catch(function (err) {
        console.warn('[GrudgeGameHud] feed load failed:', err);
        state.ready = true;
        return state;
      });
    return state.loadPromise;
  }

  function skillIconUrl(id) {
    if (!id) return null;
    if (LOCAL_SKILL_ICONS[id]) return LOCAL_SKILL_ICONS[id];
    var keys = Object.keys(VOX_WEAPON_SKILLS);
    for (var i = 0; i < keys.length; i++) {
      var wid = keys[i];
      var skills = VOX_WEAPON_SKILLS[wid];
      var idx = skills.indexOf(id);
      if (idx < 0) continue;
      var wt = findWeaponType(GAME_TO_API_WEAPON[wid]);
      if (!wt) continue;
      var flat = flattenSkills(wt);
      // Prefer matching skill id token; else index into primary→other slots
      var byId = flat.find(function (sk) {
        return sk && sk.id && (sk.id === id || String(sk.id).indexOf(id) >= 0 || id.indexOf(String(sk.id)) >= 0);
      });
      if (byId && byId.icon) return grudgeAssetUrl(byId.icon);
      if (flat[idx] && flat[idx].icon) return grudgeAssetUrl(flat[idx].icon);
      if (wt.icon) return grudgeAssetUrl(wt.icon);
    }
    return MINE_UI + 'skill-slot.png';
  }

  function weaponIconUrl(wid) {
    if (LOCAL_WEAPON_ICONS[wid]) return LOCAL_WEAPON_ICONS[wid];
    var wt = findWeaponType(GAME_TO_API_WEAPON[wid]);
    if (wt && wt.icon) return grudgeAssetUrl(wt.icon);
    if (wt) {
      var flat = flattenSkills(wt);
      if (flat[0] && flat[0].icon) return grudgeAssetUrl(flat[0].icon);
    }
    if (global.GrudgeCodex) return GrudgeCodex.weaponIconUrl(wid);
    return UI_BASE + 'Icons_128x128/Icon_Sword_128.png';
  }

  function classIconUrl(cid) {
    var emblem = VOX_CLASS_TO_EMBLEM[cid];
    return emblem ? CLASS_EMBLEM_BASE + emblem + '.webp' : null;
  }

  function lookupItemIcon(id, def) {
    if (!state.itemByName) return null;
    if (id && state.itemByName.has(id)) return grudgeAssetUrl(state.itemByName.get(id));
    var keys = VOX_ITEM_KEYS[id];
    if (keys) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        for (var entry of state.itemByName.entries()) {
          if (entry[0].indexOf(k) >= 0) return grudgeAssetUrl(entry[1]);
        }
      }
    }
    if (def && def.name) {
      var n = def.name.toLowerCase();
      for (var e of state.itemByName.entries()) {
        if (e[0].indexOf(n) >= 0 || n.indexOf(e[0]) >= 0) return grudgeAssetUrl(e[1]);
      }
    }
    return null;
  }

  function itemIconUrl(id, def) {
    var fromStore = lookupItemIcon(id, def);
    if (fromStore) return fromStore;
    if (global.GrudgeCodex) return GrudgeCodex.itemIconUrl(id, def);
    return null;
  }

  function resourceIconUrl(res) {
    if (LOCAL_RESOURCE_ICONS[res]) return LOCAL_RESOURCE_ICONS[res];
    if (res === 'wood') return grudgeAssetUrl('/icons/pack/weapons/Axe_01.png');
    if (res === 'stone') return grudgeAssetUrl('/icons/pack/weapons/Hammer_01.png');
    if (res === 'ore') return grudgeAssetUrl('/icons/pack/weapons/Sword_01.png');
    if (global.GrudgeCodex) return GrudgeCodex.resourceIconUrl(res);
    return null;
  }

  function buildIconUrl(blockId) {
    if (LOCAL_BUILD_ICONS[blockId]) return LOCAL_BUILD_ICONS[blockId];
    if (blockId === 'wood' || blockId === 'floor') return grudgeAssetUrl('/icons/pack/weapons/Axe_01.png');
    if (blockId === 'stone') return grudgeAssetUrl('/icons/pack/weapons/Hammer_01.png');
    if (blockId === 'heal') return grudgeAssetUrl('/icons/pack/weapons/Staff_01.png');
    if (global.GrudgeCodex) return GrudgeCodex.buildIconUrl(blockId);
    return null;
  }

  function setHudIcon(el, url, fallbackEmoji) {
    if (!el) return;
    // Prefer local absolute paths; rewrite relative
    if (url && url.charAt(0) !== '/' && url.indexOf('http') !== 0 && url.indexOf('data:') !== 0) {
      url = '/' + url.replace(/^\.?\//, '');
    }
    var img = el.querySelector('.hud-icon-img');
    if (!img) {
      el.textContent = '';
      img = document.createElement('img');
      img.className = 'hud-icon-img gg-icon';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      el.appendChild(img);
    }
    if (!url) {
      url = LOCAL_FALLBACK;
    }
    el.textContent = '';
    el.appendChild(img);
    img.style.display = '';
    img.classList.add('is-loading');
    var chain = [url];
    if (url.indexOf(GRUDGE_API_BASE) === 0) {
      // nothing — ObjectStore is primary for pack icons
    } else if (url.indexOf('assets.grudge-studio.com') >= 0) {
      chain.push(url.replace('https://assets.grudge-studio.com', GRUDGE_API_BASE));
    }
    if (chain.indexOf(LOCAL_FALLBACK) < 0) chain.push(LOCAL_FALLBACK);
    var step = 0;
    img.onload = function () {
      img.classList.remove('is-loading');
      el.classList.add('has-hud-icon');
    };
    img.onerror = function () {
      step++;
      if (step < chain.length) {
        img.setAttribute('src', chain[step]);
        return;
      }
      img.classList.remove('is-loading');
      img.style.display = 'none';
      el.classList.remove('has-hud-icon');
      if (fallbackEmoji) el.textContent = fallbackEmoji;
    };
    if (img.getAttribute('src') !== chain[0]) img.setAttribute('src', chain[0]);
  }

  function refreshHudIcons() {
    if (typeof global.updateSkillUI === 'function') global.updateSkillUI();
    if (typeof global.initResourceIcons === 'function') global.initResourceIcons();
    if (typeof global.initBuildIcons === 'function') global.initBuildIcons();
  }

  global.GrudgeGameHud = {
    GRUDGE_API_BASE: GRUDGE_API_BASE,
    UI_BASE: UI_BASE,
    grudgeAssetUrl: grudgeAssetUrl,
    tex: tex,
    loadFeeds: loadFeeds,
    skillIconUrl: skillIconUrl,
    weaponIconUrl: weaponIconUrl,
    classIconUrl: classIconUrl,
    itemIconUrl: itemIconUrl,
    resourceIconUrl: resourceIconUrl,
    buildIconUrl: buildIconUrl,
    setHudIcon: setHudIcon,
    refreshHudIcons: refreshHudIcons,
    slotBg: function (variant) {
      var map = {
        action: 'Action_Bar/Slots/ActionBar_Slot_Background.png',
        inventory: 'Inventory/Inventory_Slot_Background.png',
        weapon: 'Action_Bar/Slots/ActionBar_Extra_Slot_Background.png',
      };
      return tex(map[variant] || map.action);
    },
  };

  loadFeeds().then(refreshHudIcons);
})(typeof window !== 'undefined' ? window : globalThis);