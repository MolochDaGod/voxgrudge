/**
 * Grudge asset URLs — same-origin static first, optional CDN proxy second.
 *
 * IMPORTANT: Prefer bundled relative paths on every host. The /api/assets → R2
 * proxy has been 522/404 on grudge-studio.com, which left TerraForge broken when
 * env detection flipped to "production"/"staging" and forced CDN model URLs.
 */
(function (global) {
  'use strict';

  var R2_ORIGIN = 'https://assets.grudge-studio.com';
  var LOCAL_PREFIX = '/api/assets/';

  function env() {
    return global.GrudgeEnv && GrudgeEnv.detect ? GrudgeEnv.detect() : 'local';
  }

  function pathname() {
    return (global.location && global.location.pathname) || '';
  }

  /**
   * Base path when the game is mounted under a subpath
   * (/embed/vox/... or /voxgrudge/...). Relative asset URLs must stay under that root.
   */
  function bundleBase() {
    var path = pathname();
    if (path.indexOf('/embed/vox') >= 0) {
      // e.g. /embed/vox/grudge-warlords-openworld.html → /embed/vox/
      return path.replace(/\/[^/]*$/, '/').replace(/\/+$/, '/') || '/embed/vox/';
    }
    if (path.indexOf('/voxgrudge') >= 0) return '/voxgrudge/';
    return '';
  }

  function bundleUrl(localPath) {
    var p = String(localPath || '').replace(/^\//, '');
    var base = bundleBase();
    return base ? base + p : p;
  }

  /**
   * CDN only when explicitly requested (?cdn=1) — never the default.
   * Static deploy ships models/, vfx/, assets/ next to the HTML.
   */
  function useR2() {
    try {
      var q = (global.location && global.location.search) || '';
      if (q.indexOf('cdn=1') >= 0 || q.indexOf('cdn=true') >= 0) return true;
    } catch (e) {}
    return false;
  }

  function assetRoot() {
    return useR2() ? R2_ORIGIN + '/' : '';
  }

  function r2(path) {
    if (!path) return '';
    var p = String(path).replace(/^\//, '');
    if (useR2()) return LOCAL_PREFIX + p;
    return bundleUrl('assets/' + p.replace(/^assets\//, ''));
  }

  function localOrR2(localPath, r2Path) {
    return useR2() ? r2(r2Path || localPath) : bundleUrl(localPath);
  }

  /** GLB/OBJ/FBX under models/ — always same-origin static unless ?cdn=1 */
  function modelUrl(localPath) {
    if (!localPath) return '';
    var p = String(localPath).replace(/^\//, '').replace(/^assets\//, '');
    if (useR2()) return LOCAL_PREFIX + 'voxgrudge/' + p;
    return bundleUrl(p);
  }

  function vfxFrame(folder, name) {
    if (useR2()) return LOCAL_PREFIX + 'voxgrudge/vfx/' + folder + '/' + name;
    return bundleUrl('vfx/' + folder + '/' + name);
  }

  function uiFrame(rel) {
    var p = String(rel || '').replace(/^\//, '');
    if (useR2()) return LOCAL_PREFIX + 'grudge-game/ui/' + p;
    return bundleUrl('assets/grudge-game/ui/' + p);
  }

  function iconUrl(rel) {
    if (!rel) return '';
    var p = String(rel).replace(/^\//, '');
    if (useR2()) return LOCAL_PREFIX + p;
    return bundleUrl('assets/codex/' + p);
  }

  function codexIcon(path) {
    if (!path) return '';
    var p = String(path).replace(/^\//, '');
    if (useR2()) return R2_ORIGIN + '/' + p;
    return bundleUrl('assets/codex/' + p);
  }

  function hudFrame(rel) {
    var p = String(rel || '').replace(/^\//, '');
    if (useR2()) return LOCAL_PREFIX + 'voxgrudge/ui/hud/frames/' + p;
    return bundleUrl('ui/hud/frames/' + p);
  }

  var VFX_MANIFEST = {
    muzzle_front: { folder: 'muzzle', prefix: 'flash_front_', count: 6, pad: 2, fps: 30, scale: 3.0, dur: 0.2 },
    muzzle_side:  { folder: 'muzzle', prefix: 'flash_side_', count: 6, pad: 2, fps: 30, scale: 2.5, dur: 0.2 },
    muzzle_long:  { folder: 'muzzle', prefix: 'flash_long_', count: 4, pad: 2, fps: 24, scale: 2.0, dur: 0.18 },
    bone_burst_1: { folder: 'bones', prefix: 'vnbv_', indices: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27], fps: 20, scale: 3.5, dur: 0.55 },
    bone_burst_2: { folder: 'bones', prefix: 'vnbvx_', indices: [1, 4, 7, 10, 13, 16, 19, 22, 25, 29], fps: 20, scale: 3.5, dur: 0.55 },
    bone_burst_3: { folder: 'bones', prefix: 'vnbvq_', indices: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27], fps: 20, scale: 3.5, dur: 0.55 },
    hit_spark:    { folder: 'bones', prefix: 'vnbv_', indices: [12, 15, 18, 21], fps: 24, scale: 2.2, dur: 0.28 },
    flame_core:   { procedural: true, fps: 12, scale: 2.5, dur: 0.4 },
    flame_burst:  { procedural: true, fps: 10, scale: 4.0, dur: 0.6 },
    magic_cast:   { procedural: true, fps: 14, scale: 3.0, dur: 0.35 },
    magic_proj:   { procedural: true, fps: 16, scale: 1.8, dur: 0.3 },
    beam_flash:   { procedural: true, fps: 12, scale: 2.8, dur: 0.25 },
    frost_crystal:{ procedural: true, fps: 10, scale: 3.0, dur: 0.45 },
    holy_radiance:{ procedural: true, fps: 10, scale: 3.5, dur: 0.5 },
    nature_bloom: { procedural: true, fps: 8, scale: 3.0, dur: 0.55 },
    zombie_burst: { alias: 'bone_burst_1' },
    bone_melee:   { alias: 'hit_spark' },
  };

  function buildVfxDefs() {
    var out = {};
    Object.keys(VFX_MANIFEST).forEach(function (key) {
      var m = VFX_MANIFEST[key];
      if (m.alias) {
        out[key] = { alias: m.alias };
        return;
      }
      if (m.procedural) {
        out[key] = m;
        return;
      }
      out[key] = Object.assign({}, m, {
        path: 'vfx/' + m.folder + '/' + m.prefix,
        r2Path: 'voxgrudge/vfx/' + m.folder + '/' + m.prefix,
      });
    });
    return out;
  }

  function vfxUrl(def, frameSuffix) {
    if (useR2() && def.r2Path) {
      return LOCAL_PREFIX + def.r2Path + frameSuffix;
    }
    return bundleUrl((def.path || '') + frameSuffix);
  }

  function applyHudCssVars() {
    var root = document.documentElement;
    if (!root) return;
    root.style.setProperty('--gg-r2-ui', uiFrame(''));
    root.style.setProperty('--gg-slot-action', 'url("' + uiFrame('Action_Bar/Slots/ActionBar_Slot_Background.png') + '")');
    root.style.setProperty('--gg-slot-extra', 'url("' + uiFrame('Action_Bar/Slots/ActionBar_Extra_Slot_Background.png') + '")');
    root.style.setProperty('--gg-slot-inv', 'url("' + uiFrame('Inventory/Inventory_Slot_Background.png') + '")');
    root.style.setProperty('--gg-hp-frame', 'url("' + uiFrame('Unit_Frames/Party/UnitFrame_Party_Background.png') + '")');
    root.style.setProperty('--gg-hp-fill', 'url("' + uiFrame('Unit_Frames/Party/Bars/UnitFrame_Party_HP_Fill_Red.png') + '")');
    root.style.setProperty('--gg-panel-bg', 'url("' + hudFrame('panel-bg.png') + '")');
    root.style.setProperty('--gg-panel-fg', 'url("' + hudFrame('panel-fg.png') + '")');
    root.style.setProperty('--gg-slot-gothic', 'url("' + hudFrame('slot-gothic.png') + '")');
    root.style.setProperty('--gg-window-bg', 'url("' + uiFrame('Window/Window_Background.png') + '")');
    root.style.setProperty('--gg-window-header', 'url("' + uiFrame('Window/Window_Header_Background.png') + '")');
    root.style.setProperty('--gg-chat-tab-active', 'url("' + uiFrame('Chat/Tabs/Chat_Tab_Active.png') + '")');
  }

  global.GrudgeAssets = {
    R2_ORIGIN: R2_ORIGIN,
    env: env,
    useR2: useR2,
    bundleBase: bundleBase,
    bundleUrl: bundleUrl,
    r2: r2,
    localOrR2: localOrR2,
    modelUrl: modelUrl,
    vfxFrame: vfxFrame,
    uiFrame: uiFrame,
    hudFrame: hudFrame,
    iconUrl: iconUrl,
    codexIcon: codexIcon,
    VFX_MANIFEST: VFX_MANIFEST,
    buildVfxDefs: buildVfxDefs,
    vfxUrl: vfxUrl,
    applyHudCssVars: applyHudCssVars,
  };

  if (global.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyHudCssVars);
    } else {
      applyHudCssVars();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
