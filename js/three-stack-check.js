/**
 * Runtime check for Grudge CDN Three stack (r128 + fflate + loaders).
 * Non-fatal: logs errors so gameplay can still boot with degraded assets.
 */
(function (global) {
  'use strict';
  var issues = [];
  if (typeof THREE === 'undefined') {
    issues.push('THREE global missing — three.min.js did not load');
  } else {
    if (typeof THREE.GLTFLoader !== 'function') issues.push('THREE.GLTFLoader missing');
    if (typeof THREE.FBXLoader !== 'function') issues.push('THREE.FBXLoader missing');
    if (typeof THREE.OBJLoader !== 'function') issues.push('THREE.OBJLoader missing');
    if (typeof THREE.MTLLoader !== 'function') issues.push('THREE.MTLLoader missing');
  }
  if (typeof fflate === 'undefined') {
    issues.push('fflate missing — FBX binary properties will throw (load fflate UMD before FBXLoader)');
  }
  try {
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) issues.push('WebGL not available in this browser');
  } catch (e) {
    issues.push('WebGL probe failed: ' + (e && e.message));
  }

  global.GrudgeThreeStack = {
    track: 'cdn-r128',
    three: typeof THREE !== 'undefined' ? (THREE.REVISION || 'r128') : null,
    ok: issues.length === 0,
    issues: issues,
  };

  if (issues.length) {
    console.error('[GrudgeThreeStack]', issues.join(' | '));
  } else {
    console.info('[GrudgeThreeStack] OK — r' + (THREE.REVISION || '128') + ' + fflate + loaders + WebGL');
  }
})(typeof window !== 'undefined' ? window : globalThis);
