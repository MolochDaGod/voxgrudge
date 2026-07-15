/**
 * TVS Settlement Builder — load planned settlements into a Three.js scene.
 *
 * Requires: THREE, FBXLoader, TvsWorldContent
 * Optional: TvsUnitLoader (NPCs), collision callback
 *
 *   const group = await TvsSettlementBuilder.spawn(plan, { THREE, FBXLoader, scene });
 *   // group.userData.instances / actors
 */
(function (global) {
  "use strict";

  var meshCache = Object.create(null);

  function cacheKey(url, height) {
    return url + "|h" + (height || 0);
  }

  async function loadTexturedFbx(THREE, FBXLoader, url, textureUrl, height, opts) {
    opts = opts || {};
    var key = cacheKey(url, height) + (textureUrl || "");
    if (meshCache[key] && opts.useCache !== false) {
      return meshCache[key].clone(true);
    }

    var loader = new FBXLoader();
    var root = await new Promise(function (resolve, reject) {
      loader.load(url, resolve, undefined, reject);
    });

    if (textureUrl) {
      try {
        var tex = await new Promise(function (resolve, reject) {
          new THREE.TextureLoader().load(textureUrl, resolve, undefined, reject);
        });
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        root.traverse(function (ch) {
          if (!ch.isMesh || !ch.material) return;
          var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
          for (var i = 0; i < mats.length; i++) {
            var m = mats[i].clone();
            m.map = tex;
            m.needsUpdate = true;
            if (m.color) m.color.setHex(0xffffff);
            if ("roughness" in m) m.roughness = 0.9;
            if ("metalness" in m) m.metalness = 0;
            mats[i] = m;
          }
          ch.material = Array.isArray(ch.material) ? mats : mats[0];
          ch.castShadow = true;
          ch.receiveShadow = true;
        });
      } catch (e) {
        /* texture optional */
      }
    }

    if (height && global.TvsUnitLoader && global.TvsUnitLoader.normalizeHeight) {
      global.TvsUnitLoader.normalizeHeight(root, height, THREE);
    } else if (height) {
      root.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(root);
      var size = new THREE.Vector3();
      box.getSize(size);
      if (size.y > 0.001) {
        var s = height / size.y;
        root.scale.setScalar(s);
        root.updateMatrixWorld(true);
        var box2 = new THREE.Box3().setFromObject(root);
        root.position.y -= box2.min.y;
      }
    }

    meshCache[key] = root;
    return root.clone(true);
  }

  /**
   * Spawn a plan from TvsWorldContent.planSettlement.
   * opts: {
   *   THREE, FBXLoader, scene,
   *   onInstance(mesh, inst),
   *   onActor(mesh, actor, unit),
   *   maxConcurrent=4,
   *   includeActors=true,
   *   unitHeight=2.0,
   * }
   */
  async function spawn(plan, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    var FBXLoader = opts.FBXLoader || (THREE && THREE.FBXLoader) || global.FBXLoader;
    if (!THREE || !FBXLoader) throw new Error("THREE + FBXLoader required");
    if (!plan) throw new Error("plan required");

    var root = new THREE.Group();
    root.name = "tvs-settlement-" + plan.typeId;
    root.userData.plan = plan;
    root.userData.instances = [];
    root.userData.actors = [];

    var queue = (plan.instances || []).slice();
    var maxC = opts.maxConcurrent || 4;
    var i = 0;

    async function worker() {
      while (i < queue.length) {
        var idx = i++;
        var inst = queue[idx];
        try {
          var mesh = await loadTexturedFbx(
            THREE,
            FBXLoader,
            inst.modelUrl,
            inst.textureUrl,
            inst.height,
            opts
          );
          mesh.position.set(inst.x, 0, inst.z);
          mesh.rotation.y = inst.rot || 0;
          mesh.userData.tvsInstance = inst;
          mesh.name = inst.slug;
          root.add(mesh);
          root.userData.instances.push({ mesh: mesh, inst: inst });
          if (opts.onInstance) opts.onInstance(mesh, inst);
        } catch (err) {
          console.warn("[TvsSettlement]", inst.slug, err && err.message);
        }
      }
    }

    var workers = [];
    for (var w = 0; w < maxC; w++) workers.push(worker());
    await Promise.all(workers);

    if (opts.includeActors !== false && plan.actors && plan.actors.length) {
      var roster =
        opts.roster ||
        (global.TvsWorldContent && (await global.TvsWorldContent.loadRoster().catch(function () {
          return null;
        })));
      for (var a = 0; a < plan.actors.length; a++) {
        var actor = plan.actors[a];
        var unit =
          global.TvsWorldContent && global.TvsWorldContent.resolveUnit
            ? global.TvsWorldContent.resolveUnit(roster, actor.pref || {})
            : null;
        if (!unit && global.TvsUnitLoader && roster) {
          unit = global.TvsUnitLoader.pickUnit(roster, (actor.pref && actor.pref.classHint) || "melee");
        }
        if (!unit || !global.TvsUnitLoader) continue;
        try {
          var body = await global.TvsUnitLoader.loadTvsUnit(unit, {
            THREE: THREE,
            FBXLoader: FBXLoader,
            height: opts.unitHeight || 2.0,
            withTexture: true,
            withAnims: opts.withAnims !== false,
            loadSidecars: true,
            maxClips: 4,
            verify: false,
          });
          body.position.set(actor.x, 0, actor.z);
          body.rotation.y = actor.rot || 0;
          body.userData.tvsActor = actor;
          body.userData.friendly = !!actor.friendly;
          root.add(body);
          root.userData.actors.push({ mesh: body, actor: actor, unit: unit });
          if (opts.onActor) opts.onActor(body, actor, unit);
        } catch (err) {
          console.warn("[TvsSettlement] actor", actor, err && err.message);
        }
      }
    }

    if (opts.scene) opts.scene.add(root);
    return root;
  }

  async function spawnStarterRing(opts) {
    if (!global.TvsWorldContent) throw new Error("TvsWorldContent required");
    await global.TvsWorldContent.loadSettlements();
    var plans = global.TvsWorldContent.planStarterRing(opts);
    var groups = [];
    for (var i = 0; i < plans.length; i++) {
      groups.push(await spawn(plans[i], opts));
    }
    return { plans: plans, groups: groups };
  }

  function clearCache() {
    meshCache = Object.create(null);
  }

  var api = {
    spawn: spawn,
    spawnStarterRing: spawnStarterRing,
    loadTexturedFbx: loadTexturedFbx,
    clearCache: clearCache,
  };

  global.TvsSettlementBuilder = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
