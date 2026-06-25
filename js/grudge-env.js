/**
 * Grudge environment detection — local / test / production.
 */
(function (global) {
  'use strict';

  var HOSTS = {
    test: ['test.grudge-studio.com'],
    staging: ['voxgrudge.vercel.app', 'vox.grudge-studio.com'],
  };

  function detect() {
    var h = (global.location && global.location.hostname) || '';
    if (h === 'localhost' || h === '127.0.0.1') return 'local';
    if (HOSTS.test.indexOf(h) >= 0) return 'test';
    if (HOSTS.staging.indexOf(h) >= 0) return 'staging';
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

  global.GrudgeEnv = {
    detect: detect,
    isLiveDeploy: isLiveDeploy,
    label: label,
    applyTestBadge: applyTestBadge,
  };

  if (global.document && global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', applyTestBadge);
  } else {
    applyTestBadge();
  }
})(typeof window !== 'undefined' ? window : globalThis);