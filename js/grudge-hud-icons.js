/**
 * Grudge HUD icons — local CraftPix/mine-loader first, ObjectStore master feeds,
 * then GrudgeCodex CDN. Never leave empty skill/item slots when a PNG exists.
 */
(function (global) {
  'use strict';

  function gg() {
    return global.GrudgeGameHud;
  }

  function skillIconUrl(id) {
    var g = gg();
    if (g) {
      var u = g.skillIconUrl(id);
      if (u) return u;
    }
    // Codex skill pack fallbacks by class pack numbers
    if (global.GrudgeCodex && id) {
      var packHint = String(id).split('_')[0] || 'swordsman';
      var packMap = {
        heroic: 'swordsman', shadow: 'swordsman', blood: 'swordsman', execute: 'swordsman',
        whirl: 'swordsman', carnage: 'swordsman', apocalypse: 'swordsman',
        aimed: 'pirate', multi: 'pirate', piercing: 'pirate', rain: 'pirate',
        fireball: 'aeromancer', chain: 'aeromancer', blink: 'aeromancer', emberwrath: 'aeromancer',
        burst: 'pirate', sniper: 'pirate', explosive: 'pirate', ironstorm: 'pirate',
        gs: 'swordsman', ss: 'swordsman', hm: 'swordsman', mc: 'swordsman',
        dg: 'pirate', xb: 'pirate', sp: 'pirate', wn: 'aeromancer', tm: 'warlock',
      };
      var pack = packMap[packHint] || 'swordsman';
      var num = (Math.abs(hash(id)) % 8) + 1;
      return GrudgeCodex.skillIconUrl(pack, num);
    }
    return resolveLocal('assets/mine-loader/ui-icons/skill-slot.png');
  }

  function resolveLocal(path) {
    if (global.GrudgeAssets && GrudgeAssets.localOrR2) return GrudgeAssets.localOrR2(path);
    return '/' + String(path || '').replace(/^\//, '');
  }

  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }

  function weaponIconUrl(id) {
    var g = gg();
    if (g) {
      var u = g.weaponIconUrl(id);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.weaponIconUrl(id);
    return resolveLocal('assets/grudge-game/ui/Icons_128x128/Icon_Sword_128.png');
  }

  function classIconUrl(id) {
    var g = gg();
    if (g) {
      var u = g.classIconUrl(id);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.classIconUrl(id);
    return resolveLocal('assets/grudge-game/class-emblems/warrior.webp');
  }

  function itemIconUrl(id, def) {
    var g = gg();
    if (g) {
      var u = g.itemIconUrl(id, def);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.itemIconUrl(id, def);
    return resolveLocal('assets/mine-loader/ui-icons/inventory.png');
  }

  function resourceIconUrl(res) {
    var g = gg();
    if (g) {
      var u = g.resourceIconUrl(res);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.resourceIconUrl(res);
    return null;
  }

  function buildIconUrl(blockId) {
    var g = gg();
    if (g) {
      var u = g.buildIconUrl(blockId);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.buildIconUrl(blockId);
    return null;
  }

  function setHudIcon(el, url, fallback) {
    var g = gg();
    if (g) return g.setHudIcon(el, url, fallback);
    if (global.GrudgeCodex) return GrudgeCodex.setHudIcon(el, url, fallback);
    if (!el) return;
    if (!url) {
      el.textContent = fallback || '';
      return;
    }
    var img = el.querySelector('.hud-icon-img');
    if (!img) {
      el.textContent = '';
      img = document.createElement('img');
      img.className = 'hud-icon-img';
      img.alt = '';
      el.appendChild(img);
    }
    el.textContent = '';
    el.appendChild(img);
    img.onerror = function () {
      img.style.display = 'none';
      if (fallback) el.textContent = fallback;
    };
    img.src = url.charAt(0) === '/' || url.indexOf('http') === 0 ? url : '/' + url;
  }

  global.GrudgeHudIcons = {
    skillIconUrl: skillIconUrl,
    weaponIconUrl: weaponIconUrl,
    classIconUrl: classIconUrl,
    itemIconUrl: itemIconUrl,
    resourceIconUrl: resourceIconUrl,
    buildIconUrl: buildIconUrl,
    setHudIcon: setHudIcon,
  };
})(typeof window !== 'undefined' ? window : globalThis);
