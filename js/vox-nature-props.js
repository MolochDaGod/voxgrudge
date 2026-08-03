/**
 * VoxNatureProps — multi-block voxel trees / rocks / ore for openworld harvest nodes.
 * Replaces single BoxGeometry "lollipop" trees with proper voxel silhouettes.
 * Pure THREE; no new package. Optional seed for deterministic variants.
 */
(function (global) {
  'use strict';

  var _boxGeoCache = {};
  function boxGeo(w, h, d) {
    var k = w.toFixed(2) + 'x' + h.toFixed(2) + 'x' + d.toFixed(2);
    if (!_boxGeoCache[k]) _boxGeoCache[k] = new THREE.BoxGeometry(w, h, d);
    return _boxGeoCache[k];
  }

  function mulberry32(a) {
    return function () {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(x, z, salt) {
    var n = ((x * 73856093) ^ (z * 19349663) ^ (salt * 83492791)) >>> 0;
    return n || 1;
  }

  function mat(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness != null ? opts.roughness : 0.88,
      metalness: opts.metalness != null ? opts.metalness : 0.04,
      emissive: opts.emissive != null ? opts.emissive : 0x000000,
      emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 0,
      flatShading: true,
    });
  }

  function addBox(group, w, h, d, color, x, y, z, matOpts) {
    var m = new THREE.Mesh(boxGeo(w, h, d), mat(color, matOpts));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  /** Pine / oak / dead variants — multi-layer canopy + tapered trunk. */
  function buildTree(THREE, opts) {
    opts = opts || {};
    var rand = opts.rand || Math.random;
    var variant = opts.variant != null ? opts.variant : Math.floor(rand() * 3);
    // 0 pine, 1 oak, 2 dead / sparse
    var g = new THREE.Group();
    g.name = 'vox-tree-' + (['pine', 'oak', 'dead'][variant] || 'pine');
    g.userData.natureKind = 'tree';
    g.userData.variant = variant;

    var hScale = 0.85 + rand() * 0.55;
    var trunkH = (variant === 1 ? 2.2 : 2.8) * hScale;
    var trunkW = (variant === 1 ? 0.55 : 0.42) * (0.9 + rand() * 0.25);
    var trunkCol = variant === 2 ? 0x4a3a28 : 0x5c3d1e;
    var barkDark = 0x3a2814;

    // Trunk stack (slight lean / offset for organic read)
    var lean = (rand() - 0.5) * 0.08;
    var segments = 4 + Math.floor(rand() * 2);
    for (var i = 0; i < segments; i++) {
      var t = i / segments;
      var w = trunkW * (1.15 - t * 0.35);
      var y = (i + 0.5) * (trunkH / segments);
      addBox(g, w, trunkH / segments + 0.02, w, i % 2 ? barkDark : trunkCol, lean * i * 0.15, y, 0);
    }

    // Roots
    if (variant !== 2 || rand() > 0.4) {
      for (var r = 0; r < 3; r++) {
        var ang = (r / 3) * Math.PI * 2 + rand() * 0.4;
        var rx = Math.cos(ang) * trunkW * 0.9;
        var rz = Math.sin(ang) * trunkW * 0.9;
        addBox(g, trunkW * 0.55, 0.28, trunkW * 0.9, barkDark, rx, 0.12, rz);
      }
    }

    if (variant === 0) {
      // Pine: stacked diamond canopies
      var greens = [0x1a5c1a, 0x228b22, 0x2d6b2d, 0x145214];
      var layers = 4 + Math.floor(rand() * 2);
      var baseY = trunkH * 0.55;
      for (var L = 0; L < layers; L++) {
        var frac = L / (layers - 1 || 1);
        var layerW = (2.4 - frac * 1.5) * hScale * (0.9 + rand() * 0.15);
        var layerH = 0.85 * hScale;
        var ly = baseY + L * layerH * 0.72;
        var gc = greens[(L + Math.floor(rand() * 3)) % greens.length];
        addBox(g, layerW, layerH, layerW, gc, lean * 2, ly, 0);
        // side nubs
        if (L < layers - 1) {
          addBox(g, layerW * 0.55, layerH * 0.55, layerW * 0.55, greens[(L + 1) % greens.length], lean * 2 + layerW * 0.28, ly + 0.1, 0);
          addBox(g, layerW * 0.5, layerH * 0.5, layerW * 0.5, greens[(L + 2) % greens.length], lean * 2 - layerW * 0.22, ly + 0.05, layerW * 0.15);
        }
      }
      // tip
      addBox(g, 0.55 * hScale, 0.7 * hScale, 0.55 * hScale, 0x1f6b1f, lean * 2, baseY + layers * layerH * 0.72, 0);
    } else if (variant === 1) {
      // Oak: rounded multi-block canopy
      var oakGreens = [0x2e7d32, 0x388e3c, 0x1b5e20, 0x43a047];
      var cy = trunkH * 0.95;
      var clusters = [
        [0, 0, 0, 2.2],
        [0.9, 0.3, 0.2, 1.5],
        [-0.85, 0.2, -0.3, 1.45],
        [0.3, 0.55, -0.8, 1.35],
        [-0.4, 0.5, 0.75, 1.3],
        [0.1, 0.95, 0.1, 1.4],
      ];
      for (var c = 0; c < clusters.length; c++) {
        var cl = clusters[c];
        var s = cl[3] * hScale * (0.88 + rand() * 0.2);
        addBox(
          g,
          s,
          s * 0.85,
          s,
          oakGreens[c % oakGreens.length],
          cl[0] * hScale + lean * 2,
          cy + cl[1] * hScale,
          cl[2] * hScale
        );
      }
    } else {
      // Dead: sparse branches, few leaves
      var branchCol = 0x4a3a28;
      for (var b = 0; b < 5; b++) {
        var ba = (b / 5) * Math.PI * 2 + rand();
        var bh = trunkH * (0.45 + rand() * 0.4);
        var bl = 0.8 + rand() * 1.1;
        addBox(
          g,
          bl,
          0.18,
          0.18,
          branchCol,
          Math.cos(ba) * bl * 0.4,
          bh,
          Math.sin(ba) * bl * 0.4
        );
      }
      if (rand() > 0.45) {
        addBox(g, 0.9, 0.7, 0.9, 0x3d5c2e, 0.4, trunkH * 0.75, -0.2);
      }
    }

    // Overall uniform scale for SI-ish height (~3–5 m canopy top)
    var worldScale = opts.scale != null ? opts.scale : 1.0 + rand() * 0.35;
    g.scale.setScalar(worldScale);
    g.rotation.y = rand() * Math.PI * 2;
    g.userData.harvestHeight = trunkH * worldScale + (variant === 0 ? 3.5 : 2.5) * worldScale;
    return g;
  }

  /** Clustered boulder / cliff rock / ore-vein. */
  function buildRock(THREE, opts) {
    opts = opts || {};
    var rand = opts.rand || Math.random;
    var isOre = !!opts.ore;
    var g = new THREE.Group();
    g.name = isOre ? 'vox-ore' : 'vox-rock';
    g.userData.natureKind = isOre ? 'ore' : 'rock';

    var greys = isOre
      ? [0x3a4a55, 0x2a3844, 0x4a5a66, 0x334455]
      : [0x6a6a6e, 0x55555a, 0x7a7a80, 0x4a4a50, 0x8a8a90];
    var moss = 0x3d5c2e;
    var count = 4 + Math.floor(rand() * 4);
    var baseS = (isOre ? 0.7 : 0.9) * (0.85 + rand() * 0.4);

    for (var i = 0; i < count; i++) {
      var sx = baseS * (0.6 + rand() * 1.1);
      var sy = baseS * (0.45 + rand() * 0.9);
      var sz = baseS * (0.6 + rand() * 1.0);
      var ox = (rand() - 0.5) * baseS * 1.4;
      var oy = sy * 0.45 + rand() * 0.15;
      var oz = (rand() - 0.5) * baseS * 1.4;
      var col = greys[Math.floor(rand() * greys.length)];
      var m = addBox(g, sx, sy, sz, col, ox, oy, oz, { roughness: 0.95, metalness: isOre ? 0.25 : 0.08 });
      m.rotation.y = rand() * 0.5;
      m.rotation.z = (rand() - 0.5) * 0.2;
    }

    // Moss patches on non-ore
    if (!isOre && rand() > 0.35) {
      addBox(g, baseS * 0.7, 0.12, baseS * 0.55, moss, (rand() - 0.5) * 0.4, baseS * 0.7, (rand() - 0.5) * 0.3);
    }

    // Ore glow crystals
    if (isOre) {
      var oreCols = [0x44aaff, 0x66ccff, 0x3388cc];
      for (var o = 0; o < 3; o++) {
        addBox(
          g,
          0.22,
          0.35 + rand() * 0.25,
          0.22,
          oreCols[o % oreCols.length],
          (rand() - 0.5) * baseS,
          baseS * 0.5 + rand() * 0.4,
          (rand() - 0.5) * baseS,
          { emissive: oreCols[o % oreCols.length], emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.4 }
        );
      }
    }

    var sc = opts.scale != null ? opts.scale : 1.0 + rand() * 0.5;
    g.scale.setScalar(sc);
    g.rotation.y = rand() * Math.PI * 2;
    g.userData.harvestHeight = baseS * sc * 1.4;
    return g;
  }

  function buildProp(THREE, type, x, z, opts) {
    opts = opts || {};
    var seed = opts.seed != null ? opts.seed : hashSeed(x || 0, z || 0, type === 'tree' ? 11 : type === 'ore' ? 22 : 33);
    var rand = mulberry32(seed >>> 0);
    var mesh;
    if (type === 'tree') {
      mesh = buildTree(THREE, { rand: rand, scale: opts.scale, variant: opts.variant });
    } else if (type === 'ore') {
      mesh = buildRock(THREE, { rand: rand, ore: true, scale: opts.scale });
    } else {
      mesh = buildRock(THREE, { rand: rand, ore: false, scale: opts.scale });
    }
    if (x != null && z != null) {
      var gy = typeof opts.groundY === 'number' ? opts.groundY : 0;
      mesh.position.set(x, gy, z);
    }
    mesh.userData.harvestType = type;
    mesh.userData.natureSeed = seed;
    return mesh;
  }

  /**
   * Improved open-ocean water plane with wave-ready vertices + better material.
   */
  function buildWater(THREE, opts) {
    opts = opts || {};
    var size = opts.size != null ? opts.size : 3000;
    var segs = opts.segments != null ? opts.segments : 64;
    var y = opts.y != null ? opts.y : -1.2;
    var geo = new THREE.PlaneGeometry(size, size, segs, segs);
    // Soft blue-green water, not flat plastic blue
    var mat = new THREE.MeshStandardMaterial({
      color: opts.color != null ? opts.color : 0x1a6a8a,
      transparent: true,
      opacity: opts.opacity != null ? opts.opacity : 0.72,
      roughness: 0.18,
      metalness: 0.35,
      emissive: 0x062030,
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide,
      flatShading: false,
    });
    var water = new THREE.Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = y;
    water.receiveShadow = true;
    water.name = 'vox-water';
    water.userData.wave = true;
    water.userData.waveAmp = opts.waveAmp != null ? opts.waveAmp : 0.22;
    water.userData.waveSpeed = opts.waveSpeed != null ? opts.waveSpeed : 0.55;
    // Store bind Z (after plane rot, local Y is height)
    var pos = geo.attributes.position;
    var base = new Float32Array(pos.count);
    for (var i = 0; i < pos.count; i++) base[i] = pos.getZ(i);
    water.userData.waveBase = base;
    return water;
  }

  function updateWater(water, time) {
    if (!water || !water.userData || !water.userData.wave) return;
    var pos = water.geometry && water.geometry.attributes && water.geometry.attributes.position;
    var base = water.userData.waveBase;
    if (!pos || !base) return;
    var amp = water.userData.waveAmp || 0.2;
    var spd = water.userData.waveSpeed || 0.5;
    var t = time || 0;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var y = pos.getY(i);
      var w =
        Math.sin(x * 0.04 + t * spd) * amp +
        Math.cos(y * 0.035 + t * spd * 0.85) * amp * 0.65 +
        Math.sin((x + y) * 0.02 + t * spd * 1.3) * amp * 0.35;
      pos.setZ(i, base[i] + w);
    }
    pos.needsUpdate = true;
    water.geometry.computeVertexNormals();
  }

  /**
   * Retry helper for flaky layer / UI / water registration.
   * fn() should return truthy on success. Retries with backoff.
   */
  function withRetry(fn, opts) {
    opts = opts || {};
    var tries = opts.tries != null ? opts.tries : 5;
    var delay = opts.delay != null ? opts.delay : 120;
    var label = opts.label || 'retry';
    var n = 0;
    function attempt() {
      n++;
      try {
        var ok = fn(n);
        if (ok) {
          if (opts.onSuccess) opts.onSuccess(n);
          return Promise.resolve(ok);
        }
      } catch (e) {
        console.warn('[VoxNature] ' + label + ' try ' + n, e && e.message || e);
      }
      if (n >= tries) {
        if (opts.onFail) opts.onFail();
        return Promise.resolve(null);
      }
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(attempt());
        }, delay * n);
      });
    }
    return attempt();
  }

  global.VoxNatureProps = {
    buildTree: buildTree,
    buildRock: buildRock,
    buildProp: buildProp,
    buildWater: buildWater,
    updateWater: updateWater,
    withRetry: withRetry,
    hashSeed: hashSeed,
  };
})(typeof window !== 'undefined' ? window : globalThis);
