/**
 * Procedural heightfield terrain with mesh-level ground collider + height sampling.
 */
(function (global) {
  'use strict';

  function mulberry32(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, z, seed) {
    var n = Math.sin(x * 127.1 + z * 311.7 + seed * 0.13) * 43758.5453;
    return n - Math.floor(n);
  }

  function smoothNoise(x, z, seed) {
    var ix = Math.floor(x);
    var iz = Math.floor(z);
    var fx = x - ix;
    var fz = z - iz;
    var a = hash2(ix, iz, seed);
    var b = hash2(ix + 1, iz, seed);
    var c = hash2(ix, iz + 1, seed);
    var d = hash2(ix + 1, iz + 1, seed);
    var ux = fx * fx * (3 - 2 * fx);
    var uz = fz * fz * (3 - 2 * fz);
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }

  function fbm(x, z, seed, octaves) {
    var amp = 1;
    var freq = 1;
    var sum = 0;
    var norm = 0;
    for (var i = 0; i < (octaves || 4); i++) {
      sum += smoothNoise(x * freq, z * freq, seed + i * 17) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return sum / norm;
  }

  function biomeProfile(zoneId) {
    var profiles = [
      { base: 0.4, amp: 2.2, rough: 0.35 },
      { base: 0.2, amp: 1.8, rough: 0.55, dip: 1.4 },
      { base: 1.8, amp: 4.5, rough: 0.45 },
      { base: 2.5, amp: 5.5, rough: 0.5 },
      { base: 3.5, amp: 8.0, rough: 0.55 },
    ];
    return profiles[Math.min(zoneId, profiles.length - 1)];
  }

  function build(opts) {
    var THREE = opts.THREE;
    var scene = opts.scene;
    var seed = (opts.seed >>> 0) || 1;
    var size = opts.size || 1400;
    var segments = opts.segments || 128;
    var getBiomeAt = opts.getBiomeAt;
    var genProcTexture = opts.genProcTexture;
    var biomeTexTypes = opts.biomeTexTypes || ['grass', 'swamp', 'ruins', 'wasteland', 'dark'];
    var half = size * 0.5;

    function heightAt(x, z) {
      var d = Math.sqrt(x * x + z * z);
      var biome = getBiomeAt ? getBiomeAt(x, z) : { zoneId: 0 };
      var prof = biomeProfile(biome.zoneId || 0);
      var edgeR = half * 0.92;
      var edge = d > edgeR ? Math.max(0, 1 - (d - edgeR) / (half - edgeR)) : 1;
      var macro = (fbm(x * 0.004, z * 0.004, seed, 5) - 0.5) * prof.amp;
      var meso = (fbm(x * 0.02, z * 0.02, seed + 99, 3) - 0.5) * prof.amp * prof.rough;
      var micro = (fbm(x * 0.08, z * 0.08, seed + 199, 2) - 0.5) * 0.8;
      var dip = prof.dip ? -fbm(x * 0.03, z * 0.03, seed + 7, 2) * prof.dip : 0;
      var h = (prof.base + macro + meso + micro + dip) * edge;
      if (d > half) h -= (d - half) * 0.35;
      return h;
    }

    var geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = [];
    var color = new THREE.Color();
    var biomeColors = [0x3a6a2a, 0x2a4a1a, 0x554444, 0x7a5a2a, 0x220033];

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var y = heightAt(x, z);
      pos.setY(i, y);
      var biome = getBiomeAt ? getBiomeAt(x, z) : { zoneId: 0 };
      color.setHex(biomeColors[biome.zoneId || 0] || 0x3a6a2a);
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    var tex = genProcTexture ? genProcTexture(biomeTexTypes[0] || 'grass') : null;
    if (tex) tex.repeat.set(48, 48);
    var mat = new THREE.MeshStandardMaterial({
      map: tex,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'vox-terrain';
    scene.add(mesh);

    var cols = segments + 1;
    var heights = new Float32Array(cols * cols);
    for (var iz = 0; iz < cols; iz++) {
      for (var ix = 0; ix < cols; ix++) {
        var wx = -half + (ix / segments) * size;
        var wz = -half + (iz / segments) * size;
        heights[iz * cols + ix] = heightAt(wx, wz);
      }
    }

    function sampleHeight(x, z) {
      var u = (x + half) / size;
      var v = (z + half) / size;
      if (u < 0 || u > 1 || v < 0 || v > 1) return heightAt(x, z);
      var fx = u * segments;
      var fz = v * segments;
      var x0 = Math.floor(fx);
      var z0 = Math.floor(fz);
      var x1 = Math.min(x0 + 1, segments);
      var z1 = Math.min(z0 + 1, segments);
      var tx = fx - x0;
      var tz = fz - z0;
      var h00 = heights[z0 * cols + x0];
      var h10 = heights[z0 * cols + x1];
      var h01 = heights[z1 * cols + x0];
      var h11 = heights[z1 * cols + x1];
      var h0 = h00 + (h10 - h00) * tx;
      var h1 = h01 + (h11 - h01) * tx;
      return h0 + (h1 - h0) * tz;
    }

    function sampleNormal(x, z) {
      var e = 1.2;
      var hx = sampleHeight(x + e, z) - sampleHeight(x - e, z);
      var hz = sampleHeight(x, z + e) - sampleHeight(x, z - e);
      return new THREE.Vector3(-hx, 2 * e, -hz).normalize();
    }

    return {
      mesh: mesh,
      size: size,
      half: half,
      segments: segments,
      seed: seed,
      heightAt: heightAt,
      sampleHeight: sampleHeight,
      sampleNormal: sampleNormal,
      heights: heights,
    };
  }

  global.VoxTerrain = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);