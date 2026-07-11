/**
 * Grudge asset URLs — R2 CDN (production) with local /api/assets proxy fallback.
 * VFX: individual frame PNGs (never full sprite sheets).
 * UI: CraftPix 9-slice frames + unit frame bars from grudge-game kit.
 */
(function (global) {
  'use strict';

  var R2_ORIGIN = 'https://assets.grudge-studio.com';
  var LOCAL_PREFIX = '/api/assets/';

  function env() {
    return global.GrudgeEnv && GrudgeEnv.detect ? GrudgeEnv.detect() : 'local';
  }

  function useR2() {
    var e = env();
    return e === 'staging' || e === 'production' || e === 'test';
  }

  function assetRoot() {
    return useR2() ? R2_ORIGIN + '/' : '';
  }

  /** Resolve a path under assets.grudge-studio.com (or /api/assets/ on Vercel). */
  function r2(path) {
    if (!path) return '';
    var p = String(path).replace(/^\//, '');
    if (useR2()) return LOCAL_PREFIX + p;
    return 'assets/' + p.replace(/^assets\//, '');
  }

  function localOrR2(localPath, r2Path) {
    return useR2() ? r2(r2Path || localPath) : localPath;
  }

  /** GLB/OBJ/FBX under models/ — proxied via /api/assets/ on deploy. */
  function modelUrl(localPath) {
    if (!localPath) return '';
    var p = String(localPath).replace(/^\//, '').replace(/^assets\//, '');
    if (useR2()) return LOCAL_PREFIX + 'voxgrudge/' + p;
    return p;
  }

  function vfxFrame(folder, name) {
    var base = useR2() ? 'voxgrudge/vfx/' + folder + '/' : 'vfx/' + folder + '/';
    return assetRoot() + base + name;
  }

  function uiFrame(rel) {
    return localOrR2('assets/grudge-game/ui/' + rel, 'grudge-game/ui/' + rel);
  }

  function hudFrame(rel) {
    return localOrR2('ui/hud/frames/' + rel, 'voxgrudge/ui/hud/frames/' + rel);
  }

  /** Muzzle flash — numbered frames (not sheets). */
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
      var r2Path = 'voxgrudge/vfx/' + m.folder + '/' + m.prefix;
      var localPath = 'vfx/' + m.folder + '/' + m.prefix;
      out[key] = Object.assign({}, m, {
        path: localPath,
        r2Path: r2Path,
      });
    });
    return out;
  }

  /** Prefer R2 frame URL when on CDN deploy; fall back to bundled vfx/. */
  function vfxUrl(def, frameSuffix) {
    if (useR2() && def.r2Path) {
      return LOCAL_PREFIX + def.r2Path + frameSuffix;
    }
    return def.path + frameSuffix;
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
  }

  global.GrudgeAssets = {
    R2_ORIGIN: R2_ORIGIN,
    env: env,
    useR2: useR2,
    r2: r2,
    localOrR2: localOrR2,
    modelUrl: modelUrl,
    vfxFrame: vfxFrame,
    uiFrame: uiFrame,
    hudFrame: hudFrame,
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
