/**
 * LavaBiome 2D sprite scatter — billboards + ground tint for volcanic zone.
 * Uses LavaBiomManifest PNG paths resolved via GrudgeAssets.
 */
(function (global) {
  'use strict';

  var texCache = {};
  var spritePool = [];

  function resolveUrl(rel) {
    var p = String(rel || '').replace(/^\//, '');
    if (p.indexOf('assets/') !== 0 && p.indexOf('models/') !== 0) {
      p = 'assets/lava-biome/' + p.replace(/^assets\/lava-biome\//, '');
    }
    if (global.GrudgeAssets && GrudgeAssets.localOrR2) {
      return GrudgeAssets.localOrR2(p);
    }
    return '/' + p;
  }

  function create(opts) {
    opts = opts || {};
    var THREE = opts.THREE;
    if (!THREE) throw new Error('LavaBiomLoader requires THREE');
    var scene = opts.scene || null;
    var man = global.LavaBiomManifest || {};
    var group = new THREE.Group();
    group.name = 'LavaBiomScatter';
    if (scene) scene.add(group);

    function loadTexture(rel) {
      var url = resolveUrl(rel);
      if (texCache[url]) return Promise.resolve(texCache[url]);
      return new Promise(function (resolve) {
        var loader = new THREE.TextureLoader();
        loader.load(
          url,
          function (tex) {
            tex.encoding = THREE.sRGBEncoding || THREE.SRGBColorSpace;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            texCache[url] = tex;
            resolve(tex);
          },
          undefined,
          function () {
            resolve(null);
          }
        );
      });
    }

    function makeBillboard(tex, scale) {
      scale = scale || 2;
      var mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.15,
      });
      var spr = new THREE.Sprite(mat);
      var aspect = tex && tex.image ? tex.image.width / Math.max(1, tex.image.height) : 1;
      spr.scale.set(scale * aspect, scale, 1);
      spr.center.set(0.5, 0);
      return spr;
    }

    function pick(arr, rand) {
      if (!arr || !arr.length) return null;
      return arr[Math.floor((rand || Math.random)() * arr.length)];
    }

    /**
     * Spawn lava scatter around (cx, cz) in a radius.
     * density: 0..1
     */
    function populateZone(cx, cz, radius, density, randFn) {
      var rand = randFn || Math.random;
      density = density != null ? density : 0.35;
      var count = Math.floor(radius * radius * 0.012 * density);
      var scatter = man.SCATTER || {};
      var jobs = [];

      function addKind(kind, weight, yOff) {
        var list = scatter[kind];
        if (!list || !list.length) return;
        var n = Math.max(1, Math.floor(count * weight));
        for (var i = 0; i < n; i++) {
          var entry = pick(list, rand);
          if (!entry) continue;
          jobs.push({ entry: entry, kind: kind, yOff: yOff || 0 });
        }
      }

      addKind('rocks', 0.28, 0);
      addKind('plants', 0.18, 0);
      addKind('trees', 0.2, 0);
      addKind('mounds', 0.12, 0);
      addKind('constructions', 0.08, 0);
      addKind('volcanoes', 0.04, 0);
      addKind('bubbles', 0.1, 0.2);

      return Promise.all(
        jobs.map(function (job) {
          return loadTexture(job.entry.sprite).then(function (tex) {
            if (!tex) return null;
            var spr = makeBillboard(tex, job.entry.scale || 2);
            var ang = rand() * Math.PI * 2;
            var dist = 4 + rand() * Math.max(6, radius - 4);
            spr.position.set(cx + Math.cos(ang) * dist, job.yOff, cz + Math.sin(ang) * dist);
            spr.userData.lavaKind = job.kind;
            group.add(spr);
            spritePool.push(spr);
            return spr;
          });
        })
      );
    }

    function applyGroundTint(mesh) {
      if (!mesh) return;
      mesh.traverse(function (c) {
        if (!c.isMesh || !c.material) return;
        var mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(function (m) {
          if (m.color) m.color.setHex(man.GROUND || 0x4a1a0a);
          if (m.emissive) {
            m.emissive.setHex(0x331100);
            m.emissiveIntensity = 0.25;
          }
        });
      });
    }

    function preloadCore() {
      var scatter = man.SCATTER || {};
      var urls = [];
      Object.keys(scatter).forEach(function (k) {
        (scatter[k] || []).slice(0, 2).forEach(function (e) {
          if (e.sprite) urls.push(e.sprite);
        });
      });
      if (man.TILES && man.TILES.top) urls.push(man.TILES.top.replace(/^assets\/lava-biome\//, ''));
      return Promise.all(urls.map(loadTexture));
    }

    function clear() {
      while (group.children.length) {
        var c = group.children.pop();
        if (c.material) {
          if (c.material.map) c.material.map = null;
          c.material.dispose();
        }
      }
      spritePool = [];
    }

    function setScene(s) {
      scene = s;
      if (scene && group.parent !== scene) scene.add(group);
    }

    return {
      group: group,
      populateZone: populateZone,
      applyGroundTint: applyGroundTint,
      preloadCore: preloadCore,
      clear: clear,
      setScene: setScene,
      loadTexture: loadTexture,
    };
  }

  global.LavaBiomLoader = { create: create, resolveUrl: resolveUrl };
})(typeof window !== 'undefined' ? window : globalThis);
