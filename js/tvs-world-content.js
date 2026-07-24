/**
 * TVS World Content — shared settlement / PvE recipes for fleet games.
 *
 * Consumes D1/R2 catalogs:
 *   models/voxels/tvs/unit-roster.json
 *   models/voxels/tvs/catalog.json
 *   assets/voxels/settlements.json (local or CDN)
 *
 * Games: VoxGrudge open world, Grudox RPG, top-down, RTS placeables.
 *
 *   const content = await TvsWorldContent.load();
 *   const recipe = content.getSettlement('castle');
 *   const placement = content.planSettlement('village', { x: 40, z: -20, seed: 42 });
 */
(function (global) {
  "use strict";

  var CDN = "https://assets.grudge-studio.com";
  var BASE = CDN + "/models/voxels/tvs";
  var cache = {
    settlements: null,
    catalog: null,
    roster: null,
  };

  async function fetchJson(urls) {
    var list = Array.isArray(urls) ? urls : [urls];
    var lastErr = null;
    for (var i = 0; i < list.length; i++) {
      try {
        var res = await fetch(list[i], { mode: "cors" });
        if (!res.ok) throw new Error(res.status + " " + list[i]);
        return res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("fetchJson failed");
  }

  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function envUrl(pack, slug, preferGlb) {
    var base = BASE + "/" + pack + "/environment/" + slug;
    return preferGlb === false ? base + ".fbx" : base + ".glb";
  }

  function propUrl(pack, slug, preferGlb) {
    var base = BASE + "/" + pack + "/props/" + slug;
    return preferGlb === false ? base + ".fbx" : base + ".glb";
  }

  function animalUrl(pack, slug, preferGlb) {
    var base = BASE + "/" + pack + "/animals/" + slug;
    return preferGlb === false ? base + ".fbx" : base + ".glb";
  }

  function textureUrlForSlug(pack, slug) {
    return BASE + "/" + pack + "/textures/" + slug + "-texture.png";
  }

  /** Resolve asset URLs with GLB-first fallback chain (production bake). */
  function resolveAssetUrls(entry) {
    if (!entry) return null;
    var r2 = entry.r2Key || entry.r2_key || "";
    var cdn = entry.cdnUrl || entry.cdn_url || (r2 ? CDN + "/" + r2 : null);
    var glbR2 = entry.glbR2Key || entry.glb_r2_key || (r2 ? r2.replace(/\.fbx$/i, ".glb") : null);
    var glbUrl = entry.glbUrl || entry.glb_url || (glbR2 ? CDN + "/" + glbR2 : null);
    var tex =
      entry.textureUrl ||
      entry.texture_url ||
      (entry.pack && entry.slug ? textureUrlForSlug(entry.pack, entry.slug) : null);
    return {
      fbxUrl: cdn,
      glbUrl: glbUrl,
      textureUrl: tex,
      preferGlb: true,
      grudgeUuid: entry.grudgeUuid || entry.grudge_uuid || null,
      r2Key: r2,
      role: entry.role || entry.kind || null,
      // Runtime load order: production GLB → FBX
      modelCandidates: [glbUrl, cdn].filter(Boolean),
      scale: {
        mode: (entry.role === "characters" || entry.kind === "characters") ? "height" : "native_voxel",
        heightM: 2.0,
      },
      material: { nearest: true, flatShading: true, metalness: 0, roughness: 0.88 },
    };
  }

  async function loadSettlements(force) {
    if (cache.settlements && !force) return cache.settlements;
    cache.settlements = await fetchJson([
      "assets/voxels/settlements.json",
      "/assets/voxels/settlements.json",
      BASE + "/settlements.json",
    ]);
    return cache.settlements;
  }

  async function loadCatalog(force) {
    if (cache.catalog && !force) return cache.catalog;
    if (global.TvsVoxelAssets && global.TvsVoxelAssets.loadCatalog) {
      cache.catalog = await global.TvsVoxelAssets.loadCatalog(force);
      return cache.catalog;
    }
    cache.catalog = await fetchJson([
      BASE + "/catalog.json",
      "assets/voxels/catalog.json",
      "/assets/voxels/catalog.json",
    ]);
    return cache.catalog;
  }

  async function loadRoster(force) {
    if (cache.roster && !force) return cache.roster;
    if (global.TvsUnitLoader && global.TvsUnitLoader.loadTvsRoster) {
      cache.roster = await global.TvsUnitLoader.loadTvsRoster(force);
      return cache.roster;
    }
    if (global.TvsVoxelAssets && global.TvsVoxelAssets.loadRoster) {
      cache.roster = await global.TvsVoxelAssets.loadRoster(force);
      return cache.roster;
    }
    cache.roster = await fetchJson([
      BASE + "/unit-roster.json",
      "assets/voxels/unit-roster.json",
    ]);
    return cache.roster;
  }

  async function load(force) {
    var pair = await Promise.all([
      loadSettlements(force),
      loadRoster(force).catch(function () {
        return { units: [] };
      }),
      loadCatalog(force).catch(function () {
        return null;
      }),
    ]);
    return {
      settlements: pair[0],
      roster: pair[1],
      catalog: pair[2],
    };
  }

  function listSettlementTypes(data) {
    var s = (data && data.settlements) || cache.settlements;
    if (!s || !s.settlementTypes) return [];
    return Object.keys(s.settlementTypes).map(function (id) {
      var t = s.settlementTypes[id];
      return {
        id: id,
        title: t.title,
        pack: t.pack,
        theme: t.theme,
        pve: t.pve,
      };
    });
  }

  function getSettlement(id, data) {
    var s = (data && data.settlements) || cache.settlements;
    if (!s || !s.settlementTypes) return null;
    return s.settlementTypes[id] || null;
  }

  function resolveUnit(roster, pref) {
    if (!roster || !roster.units) return null;
    if (pref.unitId) {
      var byId = roster.units.find(function (u) {
        return u.unitId === pref.unitId || u.unitId.endsWith(pref.unitId);
      });
      if (byId) return byId;
    }
    if (pref.classHint) {
      return (
        roster.units.find(function (u) {
          return u.classHint === pref.classHint;
        }) || null
      );
    }
    return null;
  }

  /**
   * Expand a settlement recipe into concrete placed instances (no mesh load).
   * opts: { x, z, seed, radius, rotation, includeEnemies=true, includeNpcs=true }
   */
  function planSettlement(typeId, opts) {
    opts = opts || {};
    var recipe = getSettlement(typeId);
    if (!recipe) throw new Error("Unknown settlement: " + typeId);
    var rng = mulberry32((opts.seed || 1) ^ (typeId.length * 9973));
    var cx = opts.x || 0;
    var cz = opts.z || 0;
    var radius = opts.radius || recipe.defaultRadius || 20;
    var rot0 = opts.rotation || 0;
    var pack = recipe.pack;
    var instances = [];
    var actors = [];

    function ringPos(i, n, r) {
      var a = rot0 + (i / Math.max(1, n)) * Math.PI * 2 + rng() * 0.25;
      var rr = r * (0.55 + rng() * 0.45);
      return { x: cx + Math.cos(a) * rr, z: cz + Math.sin(a) * rr, rot: a + Math.PI };
    }

    // Landmark first (center)
    var buildings = recipe.buildings || [];
    var landmark = buildings.filter(function (b) {
      return b.role === "landmark";
    });
    var rest = buildings.filter(function (b) {
      return b.role !== "landmark";
    });
    function placeModel(kind, slug, height, x, z, rot, role, solid) {
      var glb = kind === "prop" ? propUrl(pack, slug, true) : kind === "animal" ? animalUrl(pack, slug, true) : envUrl(pack, slug, true);
      var fbx = kind === "prop" ? propUrl(pack, slug, false) : kind === "animal" ? animalUrl(pack, slug, false) : envUrl(pack, slug, false);
      return {
        kind: kind,
        slug: slug,
        pack: pack,
        // Production GLB first (grudge-convert); FBX fallback
        glbUrl: glb,
        modelUrl: glb,
        fbxUrl: fbx,
        modelCandidates: [glb, fbx],
        textureUrl: textureUrlForSlug(pack, slug),
        preferGlb: true,
        height: height,
        x: x,
        z: z,
        rot: rot,
        role: role,
        solid: solid,
        scale: { mode: kind === "animal" ? "height" : "native_voxel", heightM: height },
        material: { nearest: true, flatShading: true },
        assetSource: "tvs-voxel",
      };
    }

    landmark.forEach(function (b, i) {
      instances.push(
        placeModel(
          "environment",
          b.slug,
          b.height || 6,
          cx + (i - (landmark.length - 1) / 2) * 4,
          cz,
          rot0,
          b.role,
          true
        )
      );
    });

    rest.forEach(function (b) {
      var count = b.count || 1;
      for (var i = 0; i < count; i++) {
        var p = ringPos(i + rng() * 3, count + 2, radius * (b.role === "defense" ? 0.85 : 0.7));
        instances.push(
          placeModel(
            "environment",
            b.slug,
            b.height || 4,
            p.x,
            p.z,
            p.rot,
            b.role || "building",
            b.role !== "crop" && b.role !== "nature"
          )
        );
      }
    });

    (recipe.props || []).forEach(function (p) {
      var count = p.count || 1;
      for (var i = 0; i < count; i++) {
        var pos = ringPos(i, count, radius * 0.4);
        instances.push(
          placeModel("prop", p.slug, p.height || 1, pos.x, pos.z, rng() * Math.PI * 2, "prop", false)
        );
      }
    });

    (recipe.animals || []).forEach(function (a) {
      var count = a.count || 1;
      for (var i = 0; i < count; i++) {
        var pos = ringPos(i, count, radius * 0.5);
        instances.push(
          placeModel("animal", a.slug, a.height || 1.2, pos.x, pos.z, rng() * Math.PI * 2, "animal", false)
        );
      }
    });

    if (opts.includeNpcs !== false) {
      (recipe.npcs || []).forEach(function (n, i) {
        var pos = ringPos(i, Math.max(3, recipe.npcs.length), radius * 0.35);
        actors.push({
          kind: "npc",
          pref: n,
          x: pos.x,
          z: pos.z,
          rot: pos.rot,
          friendly: true,
        });
      });
    }

    if (opts.includeEnemies !== false) {
      (recipe.enemies || []).forEach(function (e) {
        var count = e.count || 1;
        for (var i = 0; i < count; i++) {
          var pos = ringPos(i + 1, count + 1, radius * 0.95);
          actors.push({
            kind: "enemy",
            pref: e,
            x: pos.x,
            z: pos.z,
            rot: pos.rot,
            friendly: false,
          });
        }
      });
    }

    return {
      typeId: typeId,
      recipe: recipe,
      center: { x: cx, z: cz },
      radius: radius,
      instances: instances,
      actors: actors,
      pve: recipe.pve,
      pack: pack,
    };
  }

  /**
   * Suggested world ring of settlements for open-world / RPG start.
   */
  function planStarterRing(opts) {
    opts = opts || {};
    var types = opts.types || ["village", "farm", "camp", "castle"];
    var dist = opts.distance || 55;
    var seed = opts.seed || 7;
    var plans = [];
    for (var i = 0; i < types.length; i++) {
      var a = (i / types.length) * Math.PI * 2 + 0.4;
      plans.push(
        planSettlement(types[i], {
          x: Math.cos(a) * dist,
          z: Math.sin(a) * dist,
          seed: seed + i * 17,
          includeEnemies: opts.includeEnemies !== false,
          includeNpcs: opts.includeNpcs !== false,
        })
      );
    }
    return plans;
  }

  /** Catalog helpers for RTS / editors — assets may be array or id→entry map */
  function catalogAssetList(catalog) {
    if (!catalog || !catalog.assets) return [];
    return Array.isArray(catalog.assets) ? catalog.assets : Object.values(catalog.assets);
  }

  function listAssetsByRole(catalog, role) {
    return catalogAssetList(catalog).filter(function (a) {
      var r = a.role || a.kind || "";
      return r === role || (a.tags || []).indexOf(role) >= 0;
    }).map(function (a) {
      return Object.assign({}, a, resolveAssetUrls(a));
    });
  }

  function listBuildings(catalog) {
    return listAssetsByRole(catalog, "environment");
  }

  function listCharacters(roster) {
    return ((roster && roster.units) || []).slice();
  }

  var api = {
    CDN: CDN,
    BASE: BASE,
    load: load,
    loadSettlements: loadSettlements,
    loadCatalog: loadCatalog,
    loadRoster: loadRoster,
    listSettlementTypes: listSettlementTypes,
    getSettlement: getSettlement,
    planSettlement: planSettlement,
    planStarterRing: planStarterRing,
    resolveUnit: resolveUnit,
    resolveAssetUrls: resolveAssetUrls,
    catalogAssetList: catalogAssetList,
    listAssetsByRole: listAssetsByRole,
    listBuildings: listBuildings,
    listCharacters: listCharacters,
    envUrl: envUrl,
    propUrl: propUrl,
    animalUrl: animalUrl,
    textureUrlForSlug: textureUrlForSlug,
  };

  global.TvsWorldContent = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
