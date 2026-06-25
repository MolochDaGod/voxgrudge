/**
 * Grudge HUD icons — grudge-game ObjectStore + CraftPix kit (primary).
 * Falls back to GrudgeCodex CDN when ObjectStore has no mapping.
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
    return null;
  }

  function weaponIconUrl(id) {
    var g = gg();
    if (g) {
      var u = g.weaponIconUrl(id);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.weaponIconUrl(id);
    return null;
  }

  function classIconUrl(id) {
    var g = gg();
    if (g) {
      var u = g.classIconUrl(id);
      if (u) return u;
    }
    return null;
  }

  function itemIconUrl(id, def) {
    var g = gg();
    if (g) {
      var u = g.itemIconUrl(id, def);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.itemIconUrl(id, def);
    return null;
  }

  function resourceIconUrl(res) {
    var g = gg();
    if (g) return g.resourceIconUrl(res);
    return null;
  }

  function buildIconUrl(blockId) {
    var g = gg();
    if (g) return g.buildIconUrl(blockId);
    return null;
  }

  function setHudIcon(el, url, fallback) {
    var g = gg();
    if (g) return g.setHudIcon(el, url, fallback);
    if (global.GrudgeCodex) return GrudgeCodex.setHudIcon(el, url, fallback);
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