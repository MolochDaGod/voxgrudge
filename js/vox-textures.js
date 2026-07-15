/**
 * VoxGrudge procedural terrain textures — seeded noise canvases,
 * biome atlas, and optional splat-friendly maps for heightfield mesh.
 */
(function (global) {
  'use strict';

  var CACHE = {};

  function mulberry32(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y, seed) {
    var n = Math.sin(x * 127.1 + y * 311.7 + seed * 0.17) * 43758.5453;
    return n - Math.floor(n);
  }

  function valueNoise(x, y, seed) {
    var ix = Math.floor(x);
    var iy = Math.floor(y);
    var fx = x - ix;
    var fy = y - iy;
    var a = hash2(ix, iy, seed);
    var b = hash2(ix + 1, iy, seed);
    var c = hash2(ix, iy + 1, seed);
    var d = hash2(ix + 1, iy + 1, seed);
    var ux = fx * fx * (3 - 2 * fx);
    var uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y, seed, oct) {
    var amp = 1;
    var freq = 1;
    var sum = 0;
    var norm = 0;
    for (var i = 0; i < (oct || 4); i++) {
      sum += valueNoise(x * freq, y * freq, seed + i * 19) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.05;
    }
    return sum / norm;
  }

  function hexToRgb(hex) {
    return {
      r: (hex >> 16) & 255,
      g: (hex >> 8) & 255,
      b: hex & 255,
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mixRgb(c0, c1, t) {
    return {
      r: Math.round(lerp(c0.r, c1.r, t)),
      g: Math.round(lerp(c0.g, c1.g, t)),
      b: Math.round(lerp(c0.b, c1.b, t)),
    };
  }

  var BIOME_PALETTES = {
    grass: {
      base: 0x3a6a2a,
      dark: 0x2d5a1a,
      light: 0x5a8a4a,
      accent: 0x4a7a3a,
      rock: 0x6a6a55,
    },
    swamp: {
      base: 0x2a4a1a,
      dark: 0x1a3a10,
      light: 0x3a5a2a,
      accent: 0x224418,
      rock: 0x3a4030,
    },
    ruins: {
      base: 0x554444,
      dark: 0x332222,
      light: 0x665555,
      accent: 0x443333,
      rock: 0x777770,
    },
    wasteland: {
      base: 0x7a5a2a,
      dark: 0x5a3a0a,
      light: 0x8a6a3a,
      accent: 0x6a4a1a,
      rock: 0x8a7a55,
    },
    cold: {
      base: 0xc8d8e8,
      dark: 0xa8bcd4,
      light: 0xffffff,
      accent: 0xeef4ff,
      rock: 0x8899aa,
    },
    dark: {
      base: 0x220033,
      dark: 0x110022,
      light: 0x440066,
      accent: 0x330044,
      rock: 0x2a1a40,
    },
  };

  /**
   * Build a seeded CanvasTexture for a biome type.
   * @param {object} THREE
   * @param {string} type grass|swamp|ruins|wasteland|cold|dark
   * @param {object} [opts] size, seed, repeat
   */
  function createBiomeTexture(THREE, type, opts) {
    opts = opts || {};
    var size = opts.size || 256;
    var seed = (opts.seed >>> 0) || 1;
    var key = type + ':' + size + ':' + seed;
    if (CACHE[key]) return CACHE[key];

    var pal = BIOME_PALETTES[type] || BIOME_PALETTES.grass;
    var base = hexToRgb(pal.base);
    var dark = hexToRgb(pal.dark);
    var light = hexToRgb(pal.light);
    var accent = hexToRgb(pal.accent);
    var rock = hexToRgb(pal.rock);
    var rand = mulberry32(seed + type.length * 97);

    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(size, size);
    var data = img.data;

    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var nx = x / size;
        var ny = y / size;
        var n = fbm(nx * 6, ny * 6, seed, 5);
        var detail = fbm(nx * 22, ny * 22, seed + 40, 3);
        var ridge = 1 - Math.abs(fbm(nx * 4.5, ny * 4.5, seed + 90, 3) * 2 - 1);
        var t = n * 0.65 + detail * 0.25 + ridge * 0.1;
        var col;
        if (type === 'ruins' && ridge > 0.72) {
          col = mixRgb(rock, light, (ridge - 0.72) * 3);
        } else if (type === 'grass' && detail > 0.7) {
          col = mixRgb(accent, light, (detail - 0.7) * 2.5);
        } else if (type === 'cold' && n > 0.62) {
          col = mixRgb(light, accent, (n - 0.62) * 2);
        } else if (type === 'dark' && ridge > 0.68) {
          col = mixRgb(accent, light, (ridge - 0.68) * 2);
        } else {
          col = mixRgb(dark, light, t);
          col = mixRgb(col, base, 0.35);
        }
        // Micro grain
        var grain = (rand() - 0.5) * 12;
        var i = (y * size + x) * 4;
        data[i] = Math.max(0, Math.min(255, col.r + grain));
        data[i + 1] = Math.max(0, Math.min(255, col.g + grain));
        data[i + 2] = Math.max(0, Math.min(255, col.b + grain * 0.8));
        data[i + 3] = 255;
      }
    }

    // Sparse organic marks (grass blades / cracks / snow flecks)
    ctx.putImageData(img, 0, 0);
    if (type === 'grass' || type === 'swamp') {
      for (var k = 0; k < size * 1.2; k++) {
        ctx.fillStyle = k % 3 === 0 ? '#4a7a3a' : '#2d5a1a';
        ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 2 + rand() * 5);
      }
    } else if (type === 'ruins') {
      ctx.strokeStyle = 'rgba(30,20,20,0.45)';
      for (var r = 0; r < 28; r++) {
        ctx.beginPath();
        ctx.moveTo(rand() * size, rand() * size);
        ctx.lineTo(rand() * size, rand() * size);
        ctx.stroke();
      }
    } else if (type === 'cold') {
      for (var s = 0; s < 80; s++) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(rand() * size, rand() * size, 1, 2 + rand() * 4);
      }
    }

    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    if (THREE.NearestFilter && opts.nearest) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
    }
    var rep = opts.repeat != null ? opts.repeat : 48;
    tex.repeat.set(rep, rep);
    tex.needsUpdate = true;
    CACHE[key] = tex;
    return tex;
  }

  /**
   * Drop-in replacement for legacy genProcTexture(type).
   * Uses world seed when available for stable maps across sessions.
   */
  function genProcTexture(THREE, type, opts) {
    opts = opts || {};
    if (opts.seed == null && global._voxWorldSeed) opts.seed = global._voxWorldSeed;
    return createBiomeTexture(THREE, type || 'grass', opts);
  }

  /** Pre-warm common biome maps so first frame does not hitch. */
  function preloadBiomeTextures(THREE, seed) {
    ['grass', 'swamp', 'ruins', 'wasteland', 'cold', 'dark'].forEach(function (t) {
      createBiomeTexture(THREE, t, { seed: seed || 1, size: 256 });
    });
  }

  function clearCache() {
    Object.keys(CACHE).forEach(function (k) {
      if (CACHE[k] && CACHE[k].dispose) CACHE[k].dispose();
      delete CACHE[k];
    });
  }

  global.VoxTextures = {
    createBiomeTexture: createBiomeTexture,
    genProcTexture: genProcTexture,
    preloadBiomeTextures: preloadBiomeTextures,
    clearCache: clearCache,
    BIOME_PALETTES: BIOME_PALETTES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
