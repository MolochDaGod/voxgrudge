/**
 * Tick-budgeted world asset loader — REST catalogs + textured models via GrudgeAssets.
 * Yields work across requestAnimationFrame ticks so the load screen stays responsive.
 */
(function (global) {
  'use strict';

  var DEFAULT_MAX_PER_TICK = 4;
  var DEFAULT_MAX_INFLIGHT = 8;

  function assetUrl(localPath) {
    if (global.GrudgeAssets && GrudgeAssets.modelUrl) return GrudgeAssets.modelUrl(localPath);
    return String(localPath || '').replace(/^\//, '');
  }

  function sameOriginAsset(localPath) {
    if (global.GrudgeAssets && GrudgeAssets.sameOriginUrl) return GrudgeAssets.sameOriginUrl(localPath);
    return String(localPath || '').replace(/^\//, '');
  }

  /** Load FBX with R2 primary + same-origin fallback (anims often lag CDN backfill). */
  function loadFbxResilient(fbxLoader, localPath) {
    var primary = assetUrl(localPath);
    var fallback = sameOriginAsset(localPath);
    return loadFbx(fbxLoader, primary).catch(function () {
      if (fallback && fallback !== primary) return loadFbx(fbxLoader, fallback);
      return Promise.reject(new Error('FBX failed: ' + localPath));
    });
  }

  function fmtEta(sec) {
    if (!isFinite(sec) || sec < 0) return '—';
    if (sec < 1) return '<1s';
    if (sec < 60) return Math.ceil(sec) + 's';
    var m = Math.floor(sec / 60);
    var s = Math.ceil(sec % 60);
    return m + 'm ' + s + 's';
  }

  function createQueue(opts) {
    var tasks = [];
    var idx = 0;
    var inflight = 0;
    var completed = 0;
    var failed = 0;
    var tick = 0;
    var startedAt = 0;
    var stage = '';
    var currentLabel = '';
    var maxPerTick = opts.maxPerTick || DEFAULT_MAX_PER_TICK;
    var maxInflight = opts.maxInflight || DEFAULT_MAX_INFLIGHT;
    var onProgress = opts.onProgress || function () {};

    function total() { return tasks.length; }

    function emit() {
      var elapsed = (performance.now() - startedAt) / 1000;
      var done = completed + failed;
      var pct = total() ? Math.min(100, Math.round((done / total()) * 100)) : 0;
      var rate = elapsed > 0.2 ? done / elapsed : 0;
      var remain = total() - done;
      var eta = rate > 0 ? remain / rate : Infinity;
      onProgress({
        tick: tick,
        stage: stage,
        label: currentLabel,
        completed: completed,
        failed: failed,
        total: total(),
        pct: pct,
        elapsed: elapsed,
        eta: eta,
        etaText: fmtEta(eta),
        inflight: inflight,
      });
    }

    function add(stageName, label, run) {
      tasks.push({ stage: stageName, label: label, run: run });
    }

    function pump(resolve, reject) {
      requestAnimationFrame(function () {
        tick++;
        var budget = maxPerTick;
        while (budget > 0 && idx < tasks.length && inflight < maxInflight) {
          var task = tasks[idx++];
          budget--;
          inflight++;
          stage = task.stage;
          currentLabel = task.label;
          emit();
          Promise.resolve()
            .then(task.run)
            .then(function () { completed++; })
            .catch(function (err) {
              failed++;
              console.warn('[GrudgeAssetLoader]', task.label, err);
            })
            .finally(function () {
              inflight--;
              emit();
            });
        }
        emit();
        if (completed + failed >= total() && inflight === 0) {
          resolve({
            tick: tick,
            elapsed: (performance.now() - startedAt) / 1000,
            completed: completed,
            failed: failed,
          });
        } else {
          pump(resolve, reject);
        }
      });
    }

    function run() {
      startedAt = performance.now();
      tick = 0;
      idx = 0;
      completed = 0;
      failed = 0;
      inflight = 0;
      emit();
      return new Promise(function (resolve, reject) { pump(resolve, reject); });
    }

    return { add: add, run: run, total: total };
  }

  function loadTexture(THREE, url, opts) {
    return new Promise(function (resolve, reject) {
      var loader = new THREE.TextureLoader();
      loader.load(
        url,
        function (tex) {
          if (opts && opts.nearest) {
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
          }
          resolve(tex);
        },
        undefined,
        reject
      );
    });
  }

  function loadGltf(gltfLoader, url) {
    return new Promise(function (resolve, reject) {
      gltfLoader.load(url, function (gltf) { resolve(gltf); }, undefined, reject);
    });
  }

  function loadFbx(fbxLoader, url) {
    return new Promise(function (resolve, reject) {
      fbxLoader.load(url, function (fbx) { resolve(fbx); }, undefined, reject);
    });
  }

  /**
   * Build and run the open-world asset queue. Expects ctx hooks from grudge-warlords-openworld.html.
   */
  function runOpenWorldLoad(ctx) {
    var THREE = ctx.THREE;
    var q = createQueue({ onProgress: ctx.onProgress, maxPerTick: ctx.maxPerTick });

    // ── REST catalogs ──
    q.add('rest', 'Item catalog (local + api.grudge-studio.com)', function () {
      return global.GrudgeItems.loadGrudgeItems(ctx.ITEM_DEFS).then(function (bundle) {
        if (ctx.onItemsLoaded) ctx.onItemsLoaded(bundle);
      });
    });
    q.add('rest', 'HUD feeds (ObjectStore weaponSkills + items)', function () {
      return global.GrudgeGameHud && GrudgeGameHud.loadFeeds
        ? GrudgeGameHud.loadFeeds()
        : Promise.resolve();
    });

    // ── Kenney palette textures ──
    (ctx.KENNEY_TEXTURE_LETTERS || []).forEach(function (letter) {
      q.add('textures', 'Palette texture ' + letter, function () {
        var url = assetUrl('models/kenney/textures/texture-' + letter + '.png');
        return loadTexture(THREE, url, { nearest: true }).then(function (tex) {
          ctx.TEXTURE_CACHE[letter] = tex;
        });
      });
    });

    // ── VFX frame textures (R2 / local) ──
    if (ctx.buildVfxLoadTasks) {
      ctx.buildVfxLoadTasks().forEach(function (t) {
        q.add('vfx', t.label, function () {
          return loadTexture(THREE, t.url, { nearest: true }).then(function (tex) {
            if (!ctx.vfxTexCache[t.key]) ctx.vfxTexCache[t.key] = [];
            ctx.vfxTexCache[t.key].push(tex);
          }).catch(function () {
            if (t.fallback) {
              return loadTexture(THREE, t.fallback, { nearest: true }).then(function (tex) {
                if (!ctx.vfxTexCache[t.key]) ctx.vfxTexCache[t.key] = [];
                ctx.vfxTexCache[t.key].push(tex);
              });
            }
          });
        });
      });
    }
    q.add('vfx', 'Procedural VFX textures', function () {
      if (ctx.generateProceduralVFX) ctx.generateProceduralVFX();
      return Promise.resolve();
    });

    // ── Kenney character GLBs ──
    var gltfLoader = ctx.glbLoader || new THREE.GLTFLoader();
    ctx.glbLoader = gltfLoader;
    (ctx.KENNEY_BODY_LETTERS || []).forEach(function (letter) {
      q.add('models', 'Character body ' + letter, function () {
        return loadGltf(gltfLoader, assetUrl('models/kenney/character-' + letter + '.glb')).then(function (gltf) {
          var model = gltf.scene;
          model.traverse(function (c) {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
          });
          ctx.MODEL_CACHE[letter] = model;
        });
      });
    });

    // ── Fantasy allies / enemies ──
    Object.keys(ctx.FANTASY_MODEL_MAP || {}).forEach(function (key) {
      q.add('models', 'Fantasy model ' + key, function () {
        return loadGltf(gltfLoader, assetUrl(ctx.FANTASY_MODEL_MAP[key])).then(function (gltf) {
          var model = gltf.scene;
          model.traverse(function (c) {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
          });
          ctx.FANTASY_CACHE[key] = model;
        });
      });
    });

    // ── Creature GLBs ──
    var creatures = ctx.getCreatureNames ? ctx.getCreatureNames() : [];
    creatures.forEach(function (name) {
      q.add('models', 'Creature ' + name, function () {
        return loadGltf(gltfLoader, assetUrl('models/creatures/' + name + '.glb')).then(function (gltf) {
          var model = gltf.scene;
          model.traverse(function (c) {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
          });
          ctx.CREATURE_CACHE[name] = model;
        });
      });
    });

    // ── Cold-biom units (textured OBJ/GLB) ──
    q.add('models', 'Cold-biom loader init', function () {
      if (!ctx.coldBiomLoader && global.ColdBiomLoader) {
        ctx.coldBiomLoader = ColdBiomLoader.create({
          THREE: THREE,
          objLoader: new THREE.OBJLoader(),
          mtlLoader: new THREE.MTLLoader(),
          gltfLoader: gltfLoader,
          basePath: assetUrl('models/cold-biom/').replace(/\/$/, '/') ,
        });
      }
      return Promise.resolve();
    });
    var coldIds = Object.keys((global.ColdBiomManifest && ColdBiomManifest.UNITS) || {});
    coldIds.forEach(function (id) {
      q.add('models', 'Cold-biom ' + id, function () {
        if (!ctx.coldBiomLoader) return Promise.resolve();
        return ctx.coldBiomLoader.loadUnit(id).then(function (g) {
          if (g) ctx.COLD_BIOM_CACHE[id] = g;
        });
      });
    });

    // ── Crafting table + roll rig (optional — missing GLB must not block boot) ──
    q.add('models', 'Crafting table GLB', function () {
      return loadGltf(gltfLoader, assetUrl('models/crafting_table.glb')).then(function (gltf) {
        ctx.craftTableTemplate = gltf.scene;
        ctx.craftTableTemplate.traverse(function (c) {
          if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });
      }).catch(function () {
        // Procedural crate fallback so craft stations still spawn
        if (!ctx.THREE) return;
        var THREE = ctx.THREE;
        var g = new THREE.Group();
        var box = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.9, 1.0),
          new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 })
        );
        box.position.y = 0.45;
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);
        var top = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.12, 1.1),
          new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.75 })
        );
        top.position.y = 0.96;
        top.castShadow = true;
        g.add(top);
        ctx.craftTableTemplate = g;
      });
    });
    q.add('models', 'Vox roll / dodge rig', function () {
      if (!ctx.voxRollAnim) return Promise.resolve();
      return new Promise(function (resolve) {
        ctx.voxRollAnim.load(function () { resolve(); });
      });
    });

    // ── FBX skeleton base clip ──
    q.add('anims', 'FBX idle skeleton', function () {
      if (typeof THREE.FBXLoader === 'undefined') return Promise.resolve();
      var fbxLoader = new THREE.FBXLoader();
      ctx.fbxLoader = fbxLoader;
      return loadFbxResilient(fbxLoader, 'models/anims/idle.fbx').then(function (fbx) {
        var sc = 0.028;
        fbx.scale.set(sc, sc, sc);
        fbx.traverse(function (c) { if (c.isMesh) c.visible = false; });
        global._fbxSkelTemplate = fbx;
        if (fbx.animations && fbx.animations.length) ctx.animClipCache.idle = fbx.animations[0];
        ctx.fbxSkeletonReady = true;
        if (ctx.preloadCoreAnims) ctx.preloadCoreAnims(fbxLoader);
      }).catch(function () {
        ctx.fbxSkeletonReady = false;
      });
    });

    return q.run().then(function (stats) {
      ctx.kenneyTexturesLoaded = true;
      ctx.modelsLoaded = true;
      if (ctx.onComplete) ctx.onComplete(stats);
      return stats;
    });
  }

  function bindLoadScreen(root) {
    if (!root) return;
    root.classList.add('gw-load-screen', 'is-active');
    var video = root.querySelector('#load-screen-video');
    if (video) {
      video.play().catch(function () {});
    }
  }

  function unbindLoadScreen(root) {
    if (!root) return;
    root.classList.remove('is-active');
    root.style.display = 'none';
    var video = root.querySelector('#load-screen-video');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }

  function updateLoadScreenUI(state) {
    var msg = document.getElementById('world-loading-msg');
    var bar = document.getElementById('world-loading-bar');
    var pct = document.getElementById('world-loading-pct');
    var eta = document.getElementById('world-loading-eta');
    var tickEl = document.getElementById('world-loading-tick');
    var asset = document.getElementById('world-loading-asset');
    if (msg) msg.textContent = state.stage ? state.stage + ' · ' + state.label : state.label;
    if (bar) bar.style.width = state.pct + '%';
    if (pct) pct.textContent = state.pct + '%';
    if (eta) eta.textContent = state.etaText + ' left';
    if (tickEl) tickEl.textContent = 'tick ' + state.tick;
    if (asset) asset.textContent = state.completed + ' / ' + state.total + ' assets';
  }

  global.GrudgeAssetLoader = {
    createQueue: createQueue,
    runOpenWorldLoad: runOpenWorldLoad,
    bindLoadScreen: bindLoadScreen,
    unbindLoadScreen: unbindLoadScreen,
    updateLoadScreenUI: updateLoadScreenUI,
  };
})(typeof window !== 'undefined' ? window : globalThis);
