/**
 * Load Grudge Warlords item definitions from the fleet Item Database SSOT.
 *
 * Surface: https://info.grudge-studio.com/GRUDGE_Item_Database.html
 * Catalog: info + objectstore `/api/v1/master-items.json`
 * Icons:   assets.grudge-studio.com (never info.* HTML shells for weapon paths)
 *
 * Merges into openworld ITEM_DEFS while preserving gameplay fields (effect/heal/etc).
 */
(function (global) {
  'use strict';

  var ASSETS_CDN = 'https://assets.grudge-studio.com';
  var INFO_API = 'https://info.grudge-studio.com/api/v1/master-items.json';
  var OBJECTSTORE_API = 'https://objectstore.grudge-studio.com/api/v1/master-items.json';

  /** Openworld gameplay keys → catalog name / keyword matchers (order = priority). */
  var GAMEPLAY_ALIASES = {
    health_potion: { names: ['Health Potion', 'Minor Health Potion'], keywords: ['health potion'] },
    medkit: { names: ['Medkit', 'Heavy Bandage', 'Bandage'], keywords: ['medkit', 'bandage'] },
    swiftness: { names: ['Swiftness Potion'], keywords: ['swiftness', 'haste'] },
    rage_potion: { names: ['Rage Potion'], keywords: ['rage potion'] },
    frag_grenade: { names: ['Frag Grenade', 'Smoke Grenade', 'Flashbang'], keywords: ['frag', 'grenade'] },
    berserker: { names: ['Berserker Elixir'], keywords: ['berserker'] },
    invuln_potion: { names: ['Invulnerability Potion'], keywords: ['invulner'] },
    iron_helm: { names: ['Iron Helm', 'Kinrend Helm', 'Oathbreaker Helm'], keywords: ['helm'] },
    leather_vest: { names: ['Leather Vest', 'Kinrend Chest', 'Oathbreaker Chest'], keywords: ['chest', 'vest', 'cuirass'] },
    boots: { names: ['Trail Boots', 'Kinrend Feet', 'Oathbreaker Feet'], keywords: ['feet', 'boot'] },
    power_charm: { names: ['Power Charm', 'Kinrend Ring', 'Bloodfeud Relic'], keywords: ['ring', 'relic', 'charm', 'amulet'] },
    cannon: { names: ['Bloodcannon', 'Cannon'], keywords: ['cannon'] },
  };

  function normalizeIconUrl(url) {
    if (!url) return null;
    var u = String(url).trim();
    if (!u || /management\.png/i.test(u)) return null;
    // info.* icon paths often serve HTML shells — always use assets CDN for /icons/
    u = u.replace(/^https?:\/\/info\.grudge-studio\.com\//i, ASSETS_CDN + '/');
    u = u.replace(/^https?:\/\/molochdagod\.github\.io\/ObjectStore\//i, ASSETS_CDN + '/');
    u = u.replace(/^https?:\/\/objectstore\.grudge-studio\.com\/icons\//i, ASSETS_CDN + '/icons/');
    if (u.indexOf('/icons/') === 0) u = ASSETS_CDN + u;
    if (u.indexOf('icons/') === 0) u = ASSETS_CDN + '/' + u;
    // Relative codex path without host
    if (u.indexOf('http') !== 0 && u.indexOf('data:') !== 0) {
      u = ASSETS_CDN + '/' + u.replace(/^\//, '');
    }
    return u;
  }

  function toRelativeIconPath(url) {
    var u = normalizeIconUrl(url);
    if (!u) return null;
    var m = u.match(/https?:\/\/assets\.grudge-studio\.com\/(.+)$/i);
    return m ? m[1] : null;
  }

  function slugify(name, uuid, type, tier) {
    var base = String(name || uuid || type || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
    if (!base) base = 'item';
    if (tier != null && tier !== '' && !/_t\d+$/i.test(base)) base += '_t' + String(tier);
    return base;
  }

  function mapCatalogEffect(it, prev) {
    if (prev && prev.effect) return prev.effect;
    var type = String(it.type || '').toLowerCase();
    var name = String(it.name || '').toLowerCase();
    if (type === 'weapon' || type === 'tool') return 'equip';
    if (type === 'armor') return 'equip';
    if (type === 'potion' || type === 'consumable' || type === 'food') {
      if (/health|heal|bandage|medkit|meat|food|grog/.test(name)) return 'heal';
      if (/mana|swift|speed|haste|stamina/.test(name)) return 'speed';
      if (/rage|berserk/.test(name)) return 'rage';
      if (/invuln|ward|iron skin/.test(name)) return 'invuln';
      if (/grenade|bomb|flash/.test(name)) return 'explosive';
      return 'heal';
    }
    return 'material';
  }

  function inferEquipSlot(it, prev) {
    if (prev && prev.slot) return prev.slot;
    if (it.slot || it.equipSlot || it.armorSlot) {
      return String(it.slot || it.equipSlot || it.armorSlot).toLowerCase();
    }
    var name = String(it.name || '').toLowerCase();
    var cat = String(it.category || '').toLowerCase();
    var blob = name + ' ' + cat;
    if (/helm|hood|hat|head/.test(blob)) return 'head';
    if (/chest|vest|cuirass|plate|robe|torso/.test(blob)) return 'chest';
    if (/boot|feet|greave|shoe/.test(blob)) return 'feet';
    if (/ring|relic|charm|amulet|necklace|trinket/.test(blob)) return 'trinket';
    if (String(it.type || '').toLowerCase() === 'weapon') return 'mainhand';
    return null;
  }

  function normalizeMasterItem(raw, prev) {
    if (!raw) return null;
    var id = raw.id || raw.uuid || slugify(raw.name, raw.uuid, raw.type, raw.tier);
    var iconUrl = normalizeIconUrl(raw.iconUrl || raw.icon || raw.icon_path);
    var codexIcon = toRelativeIconPath(iconUrl);
    var type = String(raw.type || (prev && prev.grudgeType) || 'misc').toLowerCase();
    var tier = raw.tier != null ? Number(raw.tier) : (prev && prev.tier) || 0;
    var stats = raw.stats || {};

    var out = Object.assign({}, prev || {}, {
      name: raw.name || raw.baseName || (prev && prev.name) || id,
      iconUrl: iconUrl,
      codexIcon: codexIcon || (prev && prev.codexIcon) || null,
      // Keep emoji/short icon for text fallback only — HUD uses iconUrl
      icon: (prev && prev.icon && String(prev.icon).length <= 8) ? prev.icon : (prev && prev.icon) || '📦',
      color: (prev && prev.color) || 0xaa8844,
      effect: mapCatalogEffect(raw, prev),
      grudgeType: type,
      type: type,
      tier: tier,
      tierLabel: raw.tierLabel || (prev && prev.tierLabel) || null,
      weaponType: raw.weaponType || (prev && prev.weaponType) || null,
      category: raw.category || (prev && prev.category) || '',
      uuid: raw.uuid || (prev && prev.uuid) || null,
      stats: stats,
      sellValue: (prev && prev.sellValue) || stats.sellValue || 1,
      slot: inferEquipSlot(raw, prev),
      armor: (prev && prev.armor) != null ? prev.armor : (stats.defense || stats.armor || null),
      dmg: (prev && prev.dmg) != null ? prev.dmg : (stats.damage || null),
      speed: (prev && prev.speed) != null ? prev.speed : null,
      source: 'item-database',
    });

    // Preserve openworld combat fields when aliasing into gameplay keys
    if (prev) {
      ['healAmt', 'duration', 'mult', 'dmgMult', 'defMult', 'radius', 'ally', 'model'].forEach(function (k) {
        if (prev[k] != null && out[k] == null) out[k] = prev[k];
      });
      if (prev.effect) out.effect = prev.effect;
      if (prev.slot) out.slot = prev.slot;
    }

    // Default heal amounts for catalog potions with no gameplay binding
    if (out.effect === 'heal' && out.healAmt == null) {
      out.healAmt = type === 'food' ? 40 : Math.max(50, 50 + tier * 40);
    }
    if (out.effect === 'speed' && out.duration == null) {
      out.duration = 12;
      out.mult = out.mult || 1.35;
    }
    if (out.effect === 'explosive' && out.dmg == null) {
      out.dmg = 150 + tier * 25;
      out.radius = out.radius || 7;
    }

    return { id: String(id), def: out };
  }

  function pickAliasMatch(list, alias) {
    if (!list || !list.length) return null;
    var i, it, n;
    // Exact name (prefer lowest tier among exact)
    if (alias.names) {
      var exact = list.filter(function (x) {
        return alias.names.some(function (nm) {
          return String(x.name || '').toLowerCase() === String(nm).toLowerCase();
        });
      });
      if (exact.length) {
        exact.sort(function (a, b) { return (a.tier || 0) - (b.tier || 0); });
        return exact[0];
      }
    }
    // Keyword contains
    if (alias.keywords) {
      var scored = [];
      for (i = 0; i < list.length; i++) {
        it = list[i];
        n = String(it.name || '').toLowerCase();
        for (var k = 0; k < alias.keywords.length; k++) {
          if (n.indexOf(alias.keywords[k]) >= 0) {
            scored.push(it);
            break;
          }
        }
      }
      if (scored.length) {
        scored.sort(function (a, b) { return (a.tier || 0) - (b.tier || 0); });
        return scored[0];
      }
    }
    return null;
  }

  function fetchMasterItems() {
    var candidates = [INFO_API, OBJECTSTORE_API];
    var chain = Promise.reject(new Error('start'));
    candidates.forEach(function (url) {
      chain = chain.catch(function () {
        return fetch(url, { mode: 'cors' }).then(function (res) {
          if (!res.ok) throw new Error(url + ' ' + res.status);
          return res.json();
        });
      });
    });
    return chain;
  }

  function fetchLocalManifest() {
    return fetch('data/grudge-items.json')
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function () { return null; });
  }

  /**
   * @param {object} baseItemDefs openworld ITEM_DEFS
   * @returns {Promise<{items: object, chestLoot: object, catalog: object, version: string}>}
   */
  async function loadGrudgeItems(baseItemDefs) {
    var merged = {};
    Object.keys(baseItemDefs || {}).forEach(function (k) {
      merged[k] = Object.assign({}, baseItemDefs[k]);
    });

    var local = await fetchLocalManifest();
    if (local && Array.isArray(local.items)) {
      local.items.forEach(function (it) {
        if (!it || !it.id) return;
        var prev = merged[it.id] || {};
        var iconUrl = normalizeIconUrl(it.iconUrl || it.icon);
        merged[it.id] = Object.assign({}, prev, {
          name: it.name || prev.name || it.id,
          icon: prev.icon || it.icon || '📦',
          iconUrl: iconUrl || prev.iconUrl || null,
          codexIcon: toRelativeIconPath(iconUrl) || it.codexIcon || prev.codexIcon || null,
          color: it.color != null ? it.color : prev.color,
          effect: it.effect || prev.effect,
          healAmt: it.healAmt != null ? it.healAmt : prev.healAmt,
          duration: it.duration != null ? it.duration : prev.duration,
          mult: it.mult != null ? it.mult : prev.mult,
          slot: it.slot || prev.slot,
          armor: it.armor != null ? it.armor : prev.armor,
          speed: it.speed != null ? it.speed : prev.speed,
          dmg: it.dmg != null ? it.dmg : prev.dmg,
          sellValue: it.sellValue != null ? it.sellValue : prev.sellValue,
          grudgeType: it.type || prev.grudgeType,
          hudPack: it.hudPack || prev.hudPack,
          hudNum: it.hudNum || prev.hudNum,
        });
      });
    }

    var catalogDoc = null;
    try {
      catalogDoc = await fetchMasterItems();
    } catch (err) {
      console.warn('[GrudgeItems] master-items unavailable — using local/base only', err && err.message);
    }

    var catalogById = {};
    var catalogList = [];
    if (catalogDoc && Array.isArray(catalogDoc.items)) {
      catalogDoc.items.forEach(function (raw) {
        var norm = normalizeMasterItem(raw, null);
        if (!norm) return;
        catalogById[norm.id] = norm.def;
        catalogList.push(Object.assign({ id: norm.id }, raw, { _def: norm.def }));

        // Index under id without clobbering gameplay keys that already have effect bindings
        if (!merged[norm.id] || !merged[norm.id].effect) {
          merged[norm.id] = Object.assign({}, merged[norm.id] || {}, norm.def);
        } else {
          // Enrich gameplay entry with icons only
          var g = merged[norm.id];
          if (!g.iconUrl && norm.def.iconUrl) g.iconUrl = norm.def.iconUrl;
          if (!g.codexIcon && norm.def.codexIcon) g.codexIcon = norm.def.codexIcon;
          if (!g.uuid && norm.def.uuid) g.uuid = norm.def.uuid;
        }
      });

      // Wire openworld gameplay keys to best catalog icon/name match
      Object.keys(GAMEPLAY_ALIASES).forEach(function (gameId) {
        var match = pickAliasMatch(catalogDoc.items, GAMEPLAY_ALIASES[gameId]);
        if (!match) return;
        var prev = merged[gameId] || {};
        var norm = normalizeMasterItem(match, prev);
        if (!norm) return;
        merged[gameId] = norm.def;
        // Also keep catalog id pointing at same def for bag sync
        if (norm.id && norm.id !== gameId) {
          catalogById[norm.id] = norm.def;
        }
      });
    }

    // Seed bare base defs with codex-relative icons if still missing
    Object.keys(merged).forEach(function (id) {
      var d = merged[id];
      if (!d) return;
      if (d.iconUrl) d.iconUrl = normalizeIconUrl(d.iconUrl);
      if (!d.codexIcon && d.iconUrl) d.codexIcon = toRelativeIconPath(d.iconUrl);
    });

    if (global.GrudgeGameHud && typeof global.GrudgeGameHud.ingestMasterItems === 'function') {
      try {
        global.GrudgeGameHud.ingestMasterItems(catalogDoc);
      } catch (_) { /* optional */ }
    }

    return {
      items: merged,
      chestLoot: (local && local.chestLoot) || {},
      catalog: catalogById,
      catalogCount: catalogList.length,
      version: (catalogDoc && catalogDoc.version) || (local && local.version) || 'local',
      source: catalogDoc ? 'item-database' : (local ? 'local-json' : 'base-only'),
    };
  }

  function rollChestLoot(chestLoot, tier, rand) {
    var pool = chestLoot[String(tier)] || chestLoot['1'] || [];
    if (!pool.length) return null;
    return pool[Math.floor(rand() * pool.length)];
  }

  global.GrudgeItems = {
    loadGrudgeItems: loadGrudgeItems,
    rollChestLoot: rollChestLoot,
    normalizeIconUrl: normalizeIconUrl,
    ASSETS_CDN: ASSETS_CDN,
    INFO_API: INFO_API,
    OBJECTSTORE_API: OBJECTSTORE_API,
  };
})(typeof window !== 'undefined' ? window : globalThis);
