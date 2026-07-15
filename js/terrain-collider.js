/**
 * Procedural heightfield terrain with mesh-level ground collider + height sampling.
 *
 * Standards-aligned heightmap:
 *   - Domain-warped FBM (macro continents)
 *   - Ridge noise (peaks / ruined spines)
 *   - Biome blend across zone rings
 *   - River / valley carving
 *   - Multi-biome vertex colors + procedural texture
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

  /** Ridge / mountain creases (1 - |2n-1|). */
  function ridge(x, z, seed, octaves) {
    var n = fbm(x, z, seed, octaves || 4);
    return 1 - Math.abs(n * 2 - 1);
  }

  function biomeProfile(zoneId) {
    var profiles = [
      { base: 0.55, amp: 2.4, rough: 0.32, ridge: 0.15, river: 0.35 }, // starter grass
      { base: 0.15, amp: 1.9, rough: 0.58, ridge: 0.1, river: 0.85, dip: 1.6 }, // swamp
      { base: 2.0, amp: 5.0, rough: 0.48, ridge: 0.55, river: 0.25 }, // ruins
      { base: 2.8, amp: 6.2, rough: 0.52, ridge: 0.45, river: 0.2 }, // wasteland
      { base: 4.0, amp: 9.5, rough: 0.58, ridge: 0.75, river: 0.15 }, // dark / outer
    ];
    return profiles[Math.min(zoneId, profiles.length - 1)];
  }

  var biomeColors = [0x3a6a2a, 0x2a4a1a, 0x554444, 0x7a5a2a, 0x220033];

  function build(opts) {
    var THREE = opts.THREE;
    var scene = opts.scene;
    var seed = (opts.seed >>> 0) || 1;
    var size = opts.size || 1400;
    var stdSeg =
      (global.VoxStandards && global.VoxStandards.SCALE.TERRAIN_SEGMENTS) || 160;
    var segments = opts.segments || stdSeg;
    var getBiomeAt = opts.getBiomeAt;
    var genProcTexture = opts.genProcTexture;
    var biomeTexTypes = opts.biomeTexTypes || ['grass', 'swamp', 'ruins', 'wasteland', 'dark'];
    var half = size * 0.5;

    function heightAt(x, z) {
      var d = Math.sqrt(x * x + z * z);
      var biome = getBiomeAt ? getBiomeAt(x, z) : { zoneId: 0 };
      var zoneId = biome.zoneId || 0;
      var prof = biomeProfile(zoneId);

      // Soft blend with neighboring biome rings for less cliff seams
      var blend = 0;
      var prof2 = prof;
      if (getBiomeAt && d > 8) {
        var outer = getBiomeAt(x * 1.02, z * 1.02);
        if (outer && outer.zoneId !== zoneId) {
          blend = 0.35;
          prof2 = biomeProfile(outer.zoneId || 0);
        }
      }

      var edgeR = half * 0.92;
      var edge = d > edgeR ? Math.max(0, 1 - (d - edgeR) / Math.max(1, half - edgeR)) : 1;

      // Domain warp — organic continents instead of grid-aligned hills
      var wx = x + (fbm(x * 0.003, z * 0.003, seed + 3, 3) - 0.5) * 48;
      var wz = z + (fbm(x * 0.003, z * 0.003, seed + 11, 3) - 0.5) * 48;

      var macro = (fbm(wx * 0.0038, wz * 0.0038, seed, 5) - 0.5) * prof.amp;
      var meso = (fbm(wx * 0.018, wz * 0.018, seed + 99, 4) - 0.5) * prof.amp * prof.rough;
      var micro = (fbm(wx * 0.07, wz * 0.07, seed + 199, 2) - 0.5) * 0.95;
      var rid = Math.pow(ridge(wx * 0.006, wz * 0.006, seed + 50, 4), 1.6) * prof.amp * (prof.ridge || 0.3);
      var dip = prof.dip ? -fbm(wx * 0.028, wz * 0.028, seed + 7, 2) * prof.dip : 0;

      // River / valley mask (meandering low bands)
      var riverN = fbm(wx * 0.0055, wz * 0.0055, seed + 300, 3);
      var river = Math.max(0, 1 - Math.abs(riverN - 0.5) * 6.5);
      var riverCarve = -river * river * (2.2 + prof.amp * 0.15) * (prof.river || 0.3);

      var base = prof.base * (1 - blend) + prof2.base * blend;
      var ampMix = prof.amp * (1 - blend) + prof2.amp * blend;
      var h =
        (base +
          macro * (ampMix / Math.max(0.001, prof.amp)) +
          meso +
          micro +
          rid +
          dip +
          riverCarve) *
        edge;

      // Soft beach / coast drop near world edge
      if (d > half * 0.88) {
        var coast = (d - half * 0.88) / (half * 0.12);
        h *= Math.max(0.05, 1 - coast * 0.85);
        h -= coast * 1.8;
      }
      if (d > half) h -= (d - half) * 0.4;
      return h;
    }

    var geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    var colors = [];
    var color = new THREE.Color();
    var colorB = new THREE.Color();

    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i);
      var z = pos.getZ(i);
      var y = heightAt(x, z);
      pos.setY(i, y);
      var biome = getBiomeAt ? getBiomeAt(x, z) : { zoneId: 0 };
      var zid = biome.zoneId || 0;
      color.setHex(biomeColors[zid] || 0x3a6a2a);
      // Slope darkening from local height variance (approx)
      var slope = Math.min(1, Math.abs(y - heightAt(x + 2, z)) * 0.18);
      color.multiplyScalar(1 - slope * 0.35);
      // Peak snow tint on high outer zones
      if (y > 6.5 && zid >= 3) {
        colorB.setHex(0xddeeff);
        color.lerp(colorB, Math.min(0.55, (y - 6.5) * 0.08));
      }
      // River bed darker
      if (y < 0.15 && zid <= 1) {
        colorB.setHex(0x1a3020);
        color.lerp(colorB, 0.4);
      }
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    // Prefer VoxTextures seeded maps when available
    var tex = null;
    if (global.VoxTextures && global.VoxTextures.createBiomeTexture) {
      tex = global.VoxTextures.createBiomeTexture(THREE, biomeTexTypes[0] || 'grass', {
        seed: seed,
        size: 256,
        repeat: 56,
      });
    } else if (genProcTexture) {
      tex = genProcTexture(biomeTexTypes[0] || 'grass');
      if (tex && tex.repeat) tex.repeat.set(56, 56);
    }
    var mat = new THREE.MeshStandardMaterial({
      map: tex,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.04,
      flatShading: false,
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = 'vox-terrain';
    scene.add(mesh);

    // Dense heightmap grid for O(1) bilinear sampling (gameplay / camera / snap)
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
      var e =
        (global.VoxStandards && global.VoxStandards.SCALE.HEIGHT_SAMPLE_EPS) || 1.2;
      var hx = sampleHeight(x + e, z) - sampleHeight(x - e, z);
      var hz = sampleHeight(x, z + e) - sampleHeight(x, z - e);
      return new THREE.Vector3(-hx, 2 * e, -hz).normalize();
    }

    /** Export raw heightmap (Float32 grid) for tools / debug. */
    function getHeightmap() {
      return {
        widths: cols,
        heights: cols,
        size: size,
        half: half,
        data: heights,
        seed: seed,
      };
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
      getHeightmap: getHeightmap,
    };
  }

  global.VoxTerrain = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
