/**
 * Grudge asset URLs — Cloudflare R2 CDN first on live deploys.
 *
 * SSOT: https://assets.grudge-studio.com  (r2-cdn Worker → grudge-assets bucket)
 * Keys:  voxgrudge/...                     (this game's prefix)
 *        models/voxels/tvs/...             (TVS shared)
 *
 * Localhost / ?local=1 → same-origin static (assets/, models/, vfx/)
 * Live + ?cdn=0        → force local bundle (debug)
 * Live default         → direct R2 origin (not Vercel proxy)
 */
(function (global) {
  'use strict';

  var R2_ORIGIN = 'https://assets.grudge-studio.com';
  /** Public CDN prefix for this app's uploaded tree */
  var R2_APP = 'voxgrudge';
  /** Same-origin proxy (optional fallback if CORS blocks; usually unused) */
  var LOCAL_PROXY = '/api/assets/';

  function env() {
    return global.GrudgeEnv && GrudgeEnv.detect ? GrudgeEnv.detect() : 'local';
  }

  function isLocalHost() {
    var h = (global.location && global.location.hostname) || '';
    return h === 'localhost' || h === '127.0.0.1' || h === '';
  }

  function queryFlag(name) {
    try {
      var q = (global.location && global.location.search) || '';
      if (q.indexOf(name + '=1') >= 0 || q.indexOf(name + '=true') >= 0) return true;
      if (q.indexOf(name + '=0') >= 0 || q.indexOf(name + '=false') >= 0) return false;
    } catch (e) {}
    return null;
  }

  /**
   * CDN on for any non-local deploy unless ?cdn=0 / ?local=1.
   * Localhost stays on bundled files unless ?cdn=1.
   */
  function useR2() {
    var force = queryFlag('cdn');
    if (force === true) return true;
    if (force === false) return false;
    if (queryFlag('local') === true) return false;
    if (isLocalHost()) return false;
    // Live: Vercel, grudge-studio subdomains, production
    return true;
  }

  function pathname() {
    return (global.location && global.location.pathname) || '';
  }

  function bundleBase() {
    var path = pathname();
    if (path.indexOf('/embed/vox') >= 0) {
      return path.replace(/\/[^/]*$/, '/').replace(/\/+$/, '/') || '/embed/vox/';
    }
    if (path.indexOf('/voxgrudge') >= 0) return '/voxgrudge/';
    return '';
  }

  function bundleUrl(localPath) {
    var p = String(localPath || '').replace(/^\//, '');
    var base = bundleBase();
    return base ? base + p : '/' + p;
  }

  /** Absolute URL under R2 (never uses broken host-relative proxy by default). */
  function cdnUrl(r2Key) {
    var p = String(r2Key || '').replace(/^\//, '');
    return R2_ORIGIN + '/' + p;
  }

  function assetRoot() {
    return useR2() ? R2_ORIGIN + '/' : '/';
  }

  /**
   * Game binary under voxgrudge/ prefix on R2, or local path.
   * r2() with key "assets/foo.png" → CDN voxgrudge/assets/foo.png
   */
  function r2(path) {
    if (!path) return '';
    var p = String(path).replace(/^\//, '');
    if (useR2()) return cdnUrl(R2_APP + '/' + p.replace(/^voxgrudge\//, ''));
    return bundleUrl(p.indexOf('assets/') === 0 || p.indexOf('models/') === 0 || p.indexOf('vfx/') === 0 || p.indexOf('branding/') === 0
      ? p
      : 'assets/' + p.replace(/^assets\//, ''));
  }

  function localOrR2(localPath, r2Path) {
    if (useR2()) {
      var key = r2Path || localPath;
      key = String(key || '').replace(/^\//, '');
      if (key.indexOf(R2_APP + '/') !== 0 && key.indexOf('models/') !== 0 && key.indexOf('icons/') !== 0) {
        key = R2_APP + '/' + key;
      }
      return cdnUrl(key);
    }
    return bundleUrl(localPath);
  }

  /** GLB/OBJ/FBX under models/ */
  function modelUrl(localPath) {
    if (!localPath) return '';
    var p = String(localPath).replace(/^\//, '').replace(/^assets\//, '');
    if (useR2()) return cdnUrl(R2_APP + '/' + p);
    return bundleUrl(p);
  }

  /** TVS shared pack — always R2 when online (canonical fleet path). */
  function tvsUrl(rel) {
    var p = String(rel || '').replace(/^\//, '');
    if (isLocalHost() && queryFlag('cdn') !== true) {
      return bundleUrl('assets/voxels/' + p.replace(/^models\/voxels\/tvs\//, ''));
    }
    return cdnUrl('models/voxels/tvs/' + p.replace(/^models\/voxels\/tvs\//, ''));
  }

  function vfxFrame(folder, name) {
    if (useR2()) return cdnUrl(R2_APP + '/vfx/' + folder + '/' + name);
    return bundleUrl('vfx/' + folder + '/' + name);
  }

  /** CraftPix / grudge-game UI PNGs */
  function uiFrame(rel) {
    var p = String(rel || '').replace(/^\//, '');
    if (useR2()) return cdnUrl(R2_APP + '/assets/grudge-game/ui/' + p);
    return bundleUrl('assets/grudge-game/ui/' + p);
  }

  function emblemUrl(name) {
    var n = String(name || 'warrior').replace(/\.webp$/i, '');
    if (useR2()) return cdnUrl(R2_APP + '/assets/grudge-game/class-emblems/' + n + '.webp');
    return bundleUrl('assets/grudge-game/class-emblems/' + n + '.webp');
  }

  function mineIcon(name) {
    var n = String(name || '').replace(/^\//, '');
    if (useR2()) return cdnUrl(R2_APP + '/assets/mine-loader/ui-icons/' + n);
    return bundleUrl('assets/mine-loader/ui-icons/' + n);
  }

  function brandingUrl(name) {
    var n = String(name || '').replace(/^\//, '');
    if (useR2()) return cdnUrl(R2_APP + '/branding/' + n);
    return bundleUrl('branding/' + n);
  }

  function iconUrl(rel) {
    if (!rel) return '';
    var p = String(rel).replace(/^\//, '');
    // Pack icons live at bucket root (icons/...)
    if (useR2()) {
      if (p.indexOf('icons/') === 0 || p.indexOf('sprites/') === 0) return cdnUrl(p);
      return cdnUrl(R2_APP + '/' + p);
    }
    return bundleUrl('assets/codex/' + p);
  }

  function codexIcon(path) {
    if (!path) return '';
    var p = String(path).replace(/^\//, '');
    if (useR2()) return cdnUrl(p);
    return bundleUrl('assets/codex/' + p);
  }

  function hudFrame(rel) {
    var p = String(rel || '').replace(/^\//, '');
    if (useR2()) return cdnUrl(R2_APP + '/ui/hud/frames/' + p);
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
        r2Path: R2_APP + '/vfx/' + m.folder + '/' + m.prefix,
      });
    });
    return out;
  }

  function vfxUrl(def, frameSuffix) {
    if (useR2() && def.r2Path) {
      return cdnUrl(def.r2Path + frameSuffix);
    }
    return bundleUrl((def.path || '') + frameSuffix);
  }

  function applyHudCssVars() {
    var root = document.documentElement;
    if (!root) return;
    root.style.setProperty('--gg-r2-ui', uiFrame(''));
    root.style.setProperty('--gg-cdn', useR2() ? R2_ORIGIN : '');
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
    R2_APP: R2_APP,
    LOCAL_PROXY: LOCAL_PROXY,
    env: env,
    useR2: useR2,
    isLocalHost: isLocalHost,
    bundleBase: bundleBase,
    bundleUrl: bundleUrl,
    cdnUrl: cdnUrl,
    r2: r2,
    localOrR2: localOrR2,
    modelUrl: modelUrl,
    tvsUrl: tvsUrl,
    vfxFrame: vfxFrame,
    uiFrame: uiFrame,
    emblemUrl: emblemUrl,
    mineIcon: mineIcon,
    brandingUrl: brandingUrl,
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
