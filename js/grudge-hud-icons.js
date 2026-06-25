/**
 * Grudge HUD icons — Mine-Loader gold-framed assets (primary).
 * Falls back to GrudgeCodex CDN only when Mine-Loader has no mapping.
 */
(function (global) {
  'use strict';

  function ml() {
    return global.MineLoaderIcons;
  }

  function skillIconUrl(id) {
    var m = ml();
    if (m) {
      var u = m.skillIconUrl(id);
      if (u) return u;
    }
    return null;
  }

  function weaponIconUrl(id) {
    var m = ml();
    if (m) {
      var u = m.weaponIconUrl(id);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.weaponIconUrl(id);
    return null;
  }

  function classIconUrl(id) {
    var m = ml();
    if (m) {
      var u = m.classIconUrl(id);
      if (u) return u;
    }
    return null;
  }

  function itemIconUrl(id, def) {
    var m = ml();
    if (m) {
      var u = m.itemIconUrl(id, def);
      if (u) return u;
    }
    if (global.GrudgeCodex) return GrudgeCodex.itemIconUrl(id, def);
    return null;
  }

  function setHudIcon(el, url, fallback) {
    var m = ml();
    if (m) return m.setHudIcon(el, url, fallback);
    if (global.GrudgeCodex) return GrudgeCodex.setHudIcon(el, url, fallback);
  }

  global.GrudgeHudIcons = {
    skillIconUrl: skillIconUrl,
    weaponIconUrl: weaponIconUrl,
    classIconUrl: classIconUrl,
    itemIconUrl: itemIconUrl,
    setHudIcon: setHudIcon,
  };
})(typeof window !== 'undefined' ? window : globalThis);