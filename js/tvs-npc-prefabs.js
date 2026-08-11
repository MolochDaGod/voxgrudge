/**
 * TVS NPC Prefabs — placeable vendor shops, missions hub, enemy camp.
 *
 * Stack (do not fork):
 *   GLTFLoader + MeshoptDecoder (TvsProductionPipeline)
 *   TvsUnitLoader — GLB · skeleton · anim pack · brain · collider
 *   TvsSettlementBuilder.loadTexturedFbx — buildings/props SI
 *   TvsAiBrain — strategy agents
 *
 * Physics: attaches Rapier/Cannon-ready descriptors from *.collider.json
 * (capsule character_root). Does not invent a second physics engine.
 *
 *   const g = await TvsNpcPrefabs.spawn('vendor-weapons', { THREE, x:10, z:-5 });
 *   // g.userData.actors[].mesh.userData.physics
 *   // g.userData.actors[].mesh.userData.mixer / playClip / aiAgent
 */
(function (global) {
  "use strict";

  var CDN = "https://assets.grudge-studio.com";
  var BASE = CDN + "/models/voxels/tvs";
  var LOCAL_JSON = "assets/voxels/npc-prefabs.json";
  var cache = { defs: null };

  async function fetchJson(urls) {
    var list = Array.isArray(urls) ? urls : [urls];
    var last = null;
    for (var i = 0; i < list.length; i++) {
      try {
        var res = await fetch(list[i], { mode: "cors" });
        if (!res.ok) throw new Error(res.status + " " + list[i]);
        return res.json();
      } catch (e) {
        last = e;
      }
    }
    throw last || new Error("npc-prefabs fetch failed");
  }

  async function loadDefs(force) {
    if (cache.defs && !force) return cache.defs;
    cache.defs = await fetchJson([
      LOCAL_JSON,
      "/" + LOCAL_JSON,
      BASE + "/npc-prefabs.json",
    ]);
    return cache.defs;
  }

  function listPrefabs(defs) {
    defs = defs || cache.defs;
    if (!defs) return [];
    var order = defs.list || Object.keys(defs.prefabs || {});
    return order
      .map(function (id) {
        return defs.prefabs[id];
      })
      .filter(Boolean);
  }

  function getPrefab(id, defs) {
    defs = defs || cache.defs;
    if (!defs || !defs.prefabs) return null;
    return defs.prefabs[id] || null;
  }

  /**
   * Build physics descriptor for games (Rapier capsule / Cannon).
   * Prefers baked collider.json rootCollider.
   */
  function physicsFromCollider(colliderJson, opts) {
    opts = opts || {};
    var rootC =
      (colliderJson && colliderJson.rootCollider) ||
      (colliderJson &&
        (colliderJson.colliders || []).find(function (c) {
          return c.role === "character_root" || c.name === "character_root";
        })) ||
      (colliderJson && colliderJson.colliders && colliderJson.colliders[0]);

    if (!rootC) {
      return {
        type: "capsule",
        align: "Y",
        radius: 0.35,
        height: 1.3,
        center: [0, 1.0, 0],
        bodyType: opts.friendly === false ? "dynamic" : "kinematicPosition",
        layer: opts.layer || "character",
        source: "default-si-2m",
      };
    }

    var cap = rootC.capsule || {};
    var radius = cap.radius != null ? cap.radius : 0.35;
    var height = cap.height != null ? cap.height : 1.3;
    // Clamp absurd bake capsules (some author packs export huge radius)
    if (radius > 0.6) radius = 0.35;
    if (height > 2.2) height = 1.3;
    if (height < 0.4) height = 1.3;

    var center = rootC.center || [0, 1, 0];
    if (Math.abs(center[1] - 1) > 1.5) center = [0, 1, 0];

    return {
      type: rootC.type || "capsule",
      align: cap.align || "Y",
      radius: radius,
      height: height,
      center: center,
      halfExtents: rootC.box && rootC.box.halfExtents,
      bodyType: opts.friendly === false ? "dynamic" : "kinematicPosition",
      layer: opts.layer || (opts.friendly === false ? "hostile" : "character"),
      source: "collider.json",
      practice:
        (rootC.practice) ||
        "Attach Rapier capsule / CCT to character root; one body per NPC; SI meters.",
    };
  }

  /** Box collider from mesh AABB for static buildings (no baked collider). */
  function physicsBoxFromMesh(mesh, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    if (!mesh || !THREE) {
      return {
        type: "box",
        halfExtents: [1, 1, 1],
        center: [0, 1, 0],
        bodyType: "fixed",
        layer: "static",
        source: "fallback",
      };
    }
    mesh.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(mesh);
    var size = new THREE.Vector3();
    var c = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(c);
    // Local half-extents relative to mesh origin (approx world if mesh at placement)
    return {
      type: "box",
      halfExtents: [size.x * 0.5, size.y * 0.5, size.z * 0.5],
      center: [0, size.y * 0.5, 0],
      worldCenter: { x: c.x, y: c.y, z: c.z },
      bodyType: "fixed",
      layer: "static",
      solid: opts.solid !== false,
      source: "aabb",
    };
  }

  function attachCharacterPhysics(root, opts) {
    opts = opts || {};
    var phys = physicsFromCollider(root.userData.collider, {
      friendly: opts.friendly,
      layer: opts.layer,
    });
    root.userData.physics = phys;
    root.userData.physicsReady = true;

    // Optional debug wire capsule
    if (opts.debugColliders && global.THREE && THREE.CapsuleGeometry) {
      var geo = new THREE.CapsuleGeometry(phys.radius, phys.height, 4, 8);
      var mat = new THREE.MeshBasicMaterial({
        color: opts.friendly === false ? 0xff4444 : 0x3dd6c6,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(phys.center[0], phys.center[1], phys.center[2]);
      mesh.name = "tvs-prefab-collider-debug";
      root.add(mesh);
    }
    return phys;
  }

  function stampSkeletonReport(root) {
    var bones = 0;
    var skinned = 0;
    var boneNames = [];
    root.traverse(function (o) {
      if (o.isBone) {
        bones++;
        if (boneNames.length < 8) boneNames.push(o.name);
      }
      if (o.isSkinnedMesh) {
        skinned++;
        if (o.skeleton && o.skeleton.bones) {
          bones = Math.max(bones, o.skeleton.bones.length);
        }
      }
    });
    root.userData.skeletonReport = {
      skinnedMeshes: skinned,
      boneCount: bones,
      sampleBones: boneNames,
      armaturePreserved: skinned > 0 && bones > 0,
    };
    return root.userData.skeletonReport;
  }

  function stampAnimReport(root) {
    var actions = root.userData.animActions || {};
    var keys = Object.keys(actions);
    root.userData.animReport = {
      hasMixer: !!root.userData.mixer,
      clips: keys,
      clipCount: keys.length,
      playClip: typeof root.userData.playClip === "function",
    };
    return root.userData.animReport;
  }

  async function resolveUnit(roster, pref) {
    if (!pref) return null;
    if (global.TvsWorldContent && global.TvsWorldContent.resolveUnit) {
      var u = global.TvsWorldContent.resolveUnit(roster, pref);
      if (u) return u;
    }
    if (global.TvsUnitLoader) {
      if (pref.unitId && global.TvsUnitLoader.findUnit) {
        var f = global.TvsUnitLoader.findUnit(roster, pref.unitId);
        if (f) return f;
      }
      if (pref.classHint) return global.TvsUnitLoader.pickUnit(roster, pref.classHint);
    }
    if (roster && roster.units) {
      if (pref.unitId) {
        return (
          roster.units.find(function (x) {
            return x.unitId === pref.unitId;
          }) || null
        );
      }
      if (pref.classHint) {
        return (
          roster.units.find(function (x) {
            return x.classHint === pref.classHint;
          }) || null
        );
      }
    }
    return null;
  }

  function envUrl(pack, slug) {
    return BASE + "/" + pack + "/environment/" + slug + ".glb";
  }
  function propUrl(pack, slug) {
    return BASE + "/" + pack + "/props/" + slug + ".glb";
  }
  function texUrl(pack, slug) {
    return BASE + "/" + pack + "/textures/" + slug + "-texture.png";
  }

  /**
   * Spawn one prefab into a Group.
   * opts: { THREE, FBXLoader, scene, x, z, yaw, seed, roster, debugColliders,
   *         withAnims, withBrain, unitHeight }
   */
  async function spawn(prefabIdOrDef, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    var FBXLoader = opts.FBXLoader || (THREE && THREE.FBXLoader) || global.FBXLoader;
    if (!THREE) throw new Error("[TvsNpcPrefabs] THREE required");

    if (global.TvsProductionPipeline && global.TvsProductionPipeline.ensureMeshoptReady) {
      await global.TvsProductionPipeline.ensureMeshoptReady();
    }

    var defs = await loadDefs();
    var def =
      typeof prefabIdOrDef === "string"
        ? getPrefab(prefabIdOrDef, defs)
        : prefabIdOrDef;
    if (!def) throw new Error("[TvsNpcPrefabs] unknown prefab: " + prefabIdOrDef);

    var roster =
      opts.roster ||
      (global.TvsUnitLoader
        ? await global.TvsUnitLoader.loadTvsRoster()
        : { units: [] });

    var ox = opts.x || 0;
    var oz = opts.z || 0;
    var baseYaw = opts.yaw || 0;

    var root = new THREE.Group();
    root.name = "tvs-prefab-" + def.id;
    root.position.set(ox, 0, oz);
    root.rotation.y = baseYaw;
    root.userData.prefab = def;
    root.userData.prefabId = def.id;
    root.userData.kind = def.kind;
    root.userData.interaction = def.interaction || null;
    root.userData.friendly = def.friendly !== false;
    root.userData.instances = [];
    root.userData.actors = [];
    root.userData.gameDelivery = {
      version: 1,
      characterHeightM: 2.0,
      facing: "+Z",
      loader: "Meshopt GLB + finalizeGameDelivery",
      physics: "collider.json capsule / AABB box",
    };

    // ── buildings / props ────────────────────────────────────────────────
    var statics = []
      .concat(
        (def.buildings || []).map(function (b) {
          return Object.assign({ kind: "environment" }, b);
        })
      )
      .concat(
        (def.props || []).map(function (p) {
          return Object.assign({ kind: "prop" }, p);
        })
      );

    for (var i = 0; i < statics.length; i++) {
      var inst = statics[i];
      var pack = inst.pack || def.pack;
      var slug = inst.slug;
      var modelUrl =
        inst.kind === "prop" ? propUrl(pack, slug) : envUrl(pack, slug);
      var textureUrl = texUrl(pack, slug);
      try {
        var mesh;
        if (global.TvsSettlementBuilder && global.TvsSettlementBuilder.loadTexturedFbx) {
          mesh = await global.TvsSettlementBuilder.loadTexturedFbx(
            THREE,
            FBXLoader,
            modelUrl,
            textureUrl,
            inst.height,
            opts
          );
        } else if (global.TvsProductionPipeline && global.TvsProductionPipeline.loadProductionGlb) {
          mesh = await global.TvsProductionPipeline.loadProductionGlb(modelUrl, {
            voxel: true,
            ground: true,
            targetHeight: inst.height,
            fitHeight: true,
            fitAxis: "y",
          });
        } else {
          console.warn("[TvsNpcPrefabs] no mesh loader for", slug);
          continue;
        }
        // Category SI if available
        if (
          global.TvsProductionPipeline &&
          global.TvsProductionPipeline.finalizeGameDelivery &&
          !mesh.userData.gameDelivery
        ) {
          var cat =
            global.TvsAssetCategories &&
            global.TvsAssetCategories.defineAsset({
              role: inst.kind === "prop" ? "props" : "environment",
              slug: slug,
              pack: pack,
            });
          global.TvsProductionPipeline.finalizeGameDelivery(mesh, {
            targetHeight: (cat && cat.targetM) || inst.height || 4,
            fitHeight: true,
            fitAxis: (cat && cat.fitAxis) || "y",
            maxDimM: (cat && cat.maxDimM) || 40,
            category: cat && cat.category,
            skipFacing: true,
          });
        }
        mesh.position.set(inst.x || 0, 0, inst.z || 0);
        if (inst.rot != null) mesh.rotation.y = inst.rot;
        mesh.name = slug;
        mesh.userData.tvsInstance = inst;
        mesh.userData.physics = physicsBoxFromMesh(mesh, {
          THREE: THREE,
          solid: def.physics && def.physics.buildingsSolid !== false,
        });
        mesh.userData.physicsReady = true;
        root.add(mesh);
        root.userData.instances.push({ mesh: mesh, inst: inst });
      } catch (err) {
        console.warn("[TvsNpcPrefabs] static fail", slug, err && err.message);
      }
    }

    // ── NPCs + enemies ───────────────────────────────────────────────────
    var actors = []
      .concat(
        (def.npcs || []).map(function (n) {
          return Object.assign({ kind: "npc", friendly: true }, n);
        })
      )
      .concat(
        (def.enemies || []).map(function (e) {
          return Object.assign({ kind: "enemy", friendly: false, aggro: true }, e);
        })
      );

    for (var a = 0; a < actors.length; a++) {
      var actor = actors[a];
      var unit = await resolveUnit(roster, actor);
      if (!unit || !global.TvsUnitLoader) {
        console.warn("[TvsNpcPrefabs] no unit for", actor.unitId || actor.classHint);
        continue;
      }
      try {
        var body = await global.TvsUnitLoader.loadTvsUnit(unit, {
          THREE: THREE,
          FBXLoader: FBXLoader,
          height: opts.unitHeight || 2.0,
          withTexture: true,
          withAnims: opts.withAnims !== false,
          withBrain: opts.withBrain !== false,
          loadSidecars: true,
          maxClips: opts.maxClips != null ? opts.maxClips : 20,
          verify: opts.verify !== false,
          team: actor.friendly === false ? "enemy" : "npc",
          home: { x: actor.x || 0, z: actor.z || 0 },
          debugColliders: opts.debugColliders,
        });

        body.position.set(actor.x || 0, 0, actor.z || 0);
        body.rotation.y = actor.rot != null ? actor.rot : 0;
        body.userData.tvsActor = actor;
        body.userData.friendly = actor.friendly !== false;
        body.userData.role = actor.role || actor.kind;
        body.userData.dialogue = actor.dialogue || null;
        body.userData.interaction = def.interaction || null;
        body.userData.aggro = !!actor.aggro;
        body.userData.leashRadius = actor.leashRadius != null ? actor.leashRadius : 16;
        body.userData.aggroRadius = actor.aggroRadius != null ? actor.aggroRadius : 12;
        body.userData.inventoryHint = actor.inventoryHint || null;
        body.userData.missionsHint = actor.missionsHint || null;

        // Physics from baked collider
        attachCharacterPhysics(body, {
          friendly: body.userData.friendly,
          layer: body.userData.friendly ? "npc" : "hostile",
          debugColliders: opts.debugColliders,
        });
        stampSkeletonReport(body);
        stampAnimReport(body);

        // AI agent home at spawn
        if (body.userData.aiAgent && body.userData.aiAgent.setHome) {
          body.userData.aiAgent.setHome(body.position.x, body.position.z);
        }

        // Default idle clip
        if (body.userData.playClip) {
          body.userData.playClip(
            body.userData.animActions && body.userData.animActions.idle
              ? "idle"
              : "locomotion",
            0
          );
        }

        root.add(body);
        root.userData.actors.push({
          mesh: body,
          actor: actor,
          unit: unit,
          physics: body.userData.physics,
          skeleton: body.userData.skeletonReport,
          anims: body.userData.animReport,
          brain: body.userData.brainMerged || body.userData.brain || null,
        });
      } catch (errA) {
        console.warn(
          "[TvsNpcPrefabs] actor fail",
          actor.unitId || actor.classHint,
          errA && errA.message
        );
      }
    }

    // Prefab report for QA
    root.userData.prefabReport = {
      id: def.id,
      title: def.title,
      statics: root.userData.instances.length,
      actors: root.userData.actors.length,
      withMixer: root.userData.actors.filter(function (x) {
        return x.anims && x.anims.hasMixer;
      }).length,
      withPhysics: root.userData.actors.filter(function (x) {
        return x.physics;
      }).length,
      withBrain: root.userData.actors.filter(function (x) {
        return x.brain;
      }).length,
      withSkeleton: root.userData.actors.filter(function (x) {
        return x.skeleton && x.skeleton.armaturePreserved;
      }).length,
    };

    console.info("[TvsNpcPrefabs] spawned", root.userData.prefabReport);

    if (opts.scene) opts.scene.add(root);
    return root;
  }

  /** Spawn all 5 prefabs in a ring for showcase / QA. */
  async function spawnAll(opts) {
    opts = opts || {};
    var defs = await loadDefs();
    var list = listPrefabs(defs);
    var groups = [];
    var n = list.length;
    var radius = opts.ringRadius != null ? opts.ringRadius : 16;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2;
      var g = await spawn(list[i].id, Object.assign({}, opts, {
        x: Math.cos(ang) * radius,
        z: Math.sin(ang) * radius,
        yaw: ang + Math.PI,
      }));
      groups.push(g);
    }
    return groups;
  }

  /** Tick mixers + optional AI for all actors under a prefab group. */
  function updatePrefab(group, dt, ctx) {
    if (!group || !group.userData || !group.userData.actors) return;
    dt = dt || 0.016;
    ctx = ctx || {};
    group.userData.actors.forEach(function (entry) {
      var mesh = entry.mesh;
      if (!mesh || !mesh.userData) return;
      if (mesh.userData.updateMixer) mesh.userData.updateMixer(dt);
      else if (mesh.userData.mixer) mesh.userData.mixer.update(dt);

      if (ctx.runAi && mesh.userData.aiAgent && mesh.userData.friendly === false) {
        var agent = mesh.userData.aiAgent;
        var target = ctx.target || ctx.playerPos || null;
        var intent = agent.tick(dt, {
          self: { x: mesh.position.x, z: mesh.position.z },
          target: target,
          enemy: target,
          hpPct: 1,
          time: ctx.time || 0,
          home: {
            x: mesh.userData._homeX != null ? mesh.userData._homeX : mesh.position.x,
            z: mesh.userData._homeZ != null ? mesh.userData._homeZ : mesh.position.z,
          },
        });
        if (mesh.userData._homeX == null) {
          mesh.userData._homeX = mesh.position.x;
          mesh.userData._homeZ = mesh.position.z;
        }
        if (intent.moveDir && intent.speed > 0) {
          mesh.position.x += intent.moveDir.x * intent.speed * dt;
          mesh.position.z += intent.moveDir.z * intent.speed * dt;
          if (intent.face) {
            mesh.rotation.y = Math.atan2(intent.face.x, intent.face.z);
          }
        }
        if (agent.applyAnim) agent.applyAnim(mesh, intent);
      }
    });
  }

  var api = {
    CDN: CDN,
    loadDefs: loadDefs,
    listPrefabs: listPrefabs,
    getPrefab: getPrefab,
    spawn: spawn,
    spawnAll: spawnAll,
    updatePrefab: updatePrefab,
    physicsFromCollider: physicsFromCollider,
    physicsBoxFromMesh: physicsBoxFromMesh,
    attachCharacterPhysics: attachCharacterPhysics,
  };

  global.TvsNpcPrefabs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
