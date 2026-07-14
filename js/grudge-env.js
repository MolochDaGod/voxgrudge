/**
 * Grudge environment detection — local / test / staging / fleet / production.
 * Also sets <base href> when mounted under /voxgrudge or /embed/vox so relative
 * asset URLs resolve correctly for TerraForge on grudge-studio.com.
 */
(function (global) {
  'use strict';

  var HOSTS = {
    test: ['test.grudge-studio.com'],
    staging: ['voxgrudge.vercel.app', 'vox.grudge-studio.com'],
    fleet: ['grudox.grudge-studio.com'],
  };

  function detect() {
    var h = (global.location && global.location.hostname) || '';
    var path = (global.location && global.location.pathname) || '';
    // Embed on main portal still runs as fleet-static (bundled files under /embed/vox)
    if (path.indexOf('/embed/vox') >= 0 || path.indexOf('/voxgrudge') >= 0) return 'fleet';
    if (h === 'grudox.grudge-studio.com') return 'fleet';
    if (h === 'localhost' || h === '127.0.0.1') return 'local';
    if (HOSTS.test.indexOf(h) >= 0) return 'test';
    if (HOSTS.staging.indexOf(h) >= 0) return 'staging';
    if (HOSTS.fleet.indexOf(h) >= 0) return 'fleet';
    return 'production';
  }

  function isLiveDeploy() {
    return detect() !== 'local';
  }

  function label() {
    var e = detect();
    if (e === 'local') return 'LOCAL DEV';
    if (e === 'test') return 'TEST';
    if (e === 'staging') return 'STAGING';
    if (e === 'fleet') return 'FLEET';
    return 'LIVE';
  }

  function applyTestBadge() {
    if (detect() !== 'test') return;
    var ver = document.querySelector('#class-screen .version');
    if (ver && ver.textContent.indexOf('TEST') < 0) {
      ver.textContent = 'TEST · ' + ver.textContent;
      ver.style.color = '#e8a86e';
    }
    var pill = document.getElementById('zone-pill');
    if (pill) {
      pill.textContent = 'Env · test.grudge-studio.com';
      pill.style.borderColor = '#e8a86e';
      pill.style.color = '#e8a86e';
    }
  }

  /** Ensure relative asset URLs resolve under subpath mounts. */
  function applyFleetBaseHref() {
    if (!global.document || !global.document.head) return;
    var path = (global.location && global.location.pathname) || '';
    var baseHref = null;
    if (path.indexOf('/embed/vox') >= 0) {
      baseHref = path.replace(/\/[^/]*$/, '/');
      if (baseHref.indexOf('/embed/vox') < 0) baseHref = '/embed/vox/';
    } else if (path.indexOf('/voxgrudge') >= 0) {
      baseHref = '/voxgrudge/';
    }
    if (!baseHref) return;
    if (document.querySelector('base[data-vox-base]')) return;
    var el = document.createElement('base');
    el.setAttribute('data-vox-base', '1');
    el.href = baseHref;
    document.head.insertBefore(el, document.head.firstChild);
  }

  global.GrudgeEnv = {
    detect: detect,
    isLiveDeploy: isLiveDeploy,
    label: label,
    applyTestBadge: applyTestBadge,
    applyFleetBaseHref: applyFleetBaseHref,
  };

  applyFleetBaseHref();
  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', applyTestBadge);
  } else {
    applyTestBadge();
  }
})(typeof window !== 'undefined' ? window : globalThis);
