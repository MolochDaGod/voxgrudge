/**
 * TVS Voxel pack resolver for GRUDOX / VoxGrudge / RTS loaders.
 *
 * Canonical catalog on CDN (D1-aligned grudgeUuid + r2Key):
 *   https://assets.grudge-studio.com/models/voxels/tvs/catalog.json
 *   https://assets.grudge-studio.com/models/voxels/tvs/unit-roster.json
 *
 * Usage (browser):
 *   <script src="/js/tvs-voxel-assets.js"></script>
 *   const roster = await TvsVoxelAssets.loadRoster();
 *   const unit = roster.units.find(u => u.unitId === 'voxel-knights-champion');
 */
(function (global) {
  "use strict";

  var CDN =
    (global.GrudgeAssets && global.GrudgeAssets.R2_ORIGIN) ||
    (global.GrudgeFleet && global.GrudgeFleet.endpoints && global.GrudgeFleet.endpoints.assets) ||
    "https://assets.grudge-studio.com";
  // Always absolute TVS CDN base for file consistency (not voxgrudge/ app prefix).
  // Localhost may still fall back to /assets/voxels/* when CDN fails.
  var BASE = CDN.replace(/\/$/, "") + "/models/voxels/tvs";

  var cache = { catalog: null, roster: null };

  async function fetchJson(url) {
    var res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("TVS voxel fetch " + res.status + ": " + url);
    return res.json();
  }

  async function loadCatalog(force) {
    if (cache.catalog && !force) return cache.catalog;
    var urls = [BASE + "/catalog.json", "/assets/voxels/catalog.json", "assets/voxels/catalog.json"];
    var lastErr;
    for (var i = 0; i < urls.length; i++) {
      try {
        cache.catalog = await fetchJson(urls[i]);
        return cache.catalog;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("TVS catalog unavailable");
  }

  async function loadRoster(force) {
    if (cache.roster && !force) return cache.roster;
    var urls = [BASE + "/unit-roster.json", "/assets/voxels/unit-roster.json", "assets/voxels/unit-roster.json"];
    var lastErr;
    for (var i = 0; i < urls.length; i++) {
      try {
        var raw = await fetchJson(urls[i]);
        // Normalize via TvsUnitLoader when present (absolute model/texture URLs)
        if (global.TvsUnitLoader && global.TvsUnitLoader.normalizeRoster) {
          cache.roster = global.TvsUnitLoader.normalizeRoster(raw);
        } else {
          cache.roster = raw;
        }
        return cache.roster;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("TVS roster unavailable");
  }

  function characterUrl(slugOrId) {
    var key = String(slugOrId).toLowerCase();
    var packs = [
      "voxel-cathedral",
      "voxel-farm",
      "voxel-knights",
      "voxel-palace",
      "voxel-rangers",
      "voxel-village",
      "voxel-wizards",
    ];
    for (var i = 0; i < packs.length; i++) {
      var pack = packs[i];
      if (key.startsWith(pack) || key.indexOf(pack.replace("voxel-", "")) >= 0) {
        var slug = key.startsWith("voxel-") ? key : pack + "-" + key;
        return BASE + "/" + pack + "/characters/" + slug + ".fbx";
      }
    }
    return BASE + "/catalog.json#" + encodeURIComponent(key);
  }

  function resolveFromRoster(roster, unitId) {
    if (!roster || !roster.units) return null;
    return (
      roster.units.find(function (x) {
        return (
          x.unitId === unitId ||
          x.unitId.endsWith(unitId) ||
          (x.displayName && x.displayName.toLowerCase() === String(unitId).toLowerCase())
        );
      }) || null
    );
  }

  function pickDefaultUnit(roster, classHint) {
    if (!roster || !roster.units) return null;
    var want = (classHint || "melee").toLowerCase();
    return (
      roster.units.find(function (u) {
        return u.classHint === want;
      }) ||
      roster.units[0] ||
      null
    );
  }

  var PACKS = {
    "voxel-knights": { title: "Knights", theme: "melee fortress" },
    "voxel-rangers": { title: "Rangers", theme: "forest camp" },
    "voxel-wizards": { title: "Wizards", theme: "arcane tower" },
    "voxel-cathedral": { title: "Cathedral", theme: "holy" },
    "voxel-palace": { title: "Palace", theme: "royalty" },
    "voxel-village": { title: "Village", theme: "economy" },
    "voxel-farm": { title: "Farm", theme: "animals crops" },
  };

  function packBase(packId) {
    return BASE + "/" + packId;
  }

  function envUrl(packId, slug) {
    return packBase(packId) + "/environment/" + slug + ".fbx";
  }

  function propUrl(packId, slug) {
    return packBase(packId) + "/props/" + slug + ".fbx";
  }

  function textureUrl(packId, slug) {
    var s = slug.endsWith("-texture") ? slug : slug + "-texture";
    return packBase(packId) + "/textures/" + s + ".png";
  }

  /**
   * Three.js helper: load FBX with optional texture rebind + height normalize.
   * Prefer TvsUnitLoader.loadTvsUnit for full production path.
   */
  async function loadCharacterFbx(unit, THREE, FBXLoader) {
    if (global.TvsUnitLoader && global.TvsUnitLoader.loadTvsUnit) {
      return global.TvsUnitLoader.loadTvsUnit(unit, {
        THREE: THREE,
        FBXLoader: FBXLoader,
        height: 2.0,
        withAnims: true,
        withTexture: true,
      });
    }
    var Loader = FBXLoader || (THREE && THREE.FBXLoader);
    if (!Loader) throw new Error("FBXLoader required");
    var loader = new Loader();
    var modelUrl = unit.modelUrl || characterUrl(unit.unitId || unit);
    var group = await new Promise(function (resolve, reject) {
      loader.load(modelUrl, resolve, undefined, reject);
    });
    group.userData.grudgeUuid = unit.grudgeUuid;
    group.userData.tvsUnit = unit;
    group.userData.assetSource = "tvs-voxel";
    return group;
  }

  var api = {
    CDN: CDN,
    BASE: BASE,
    PACKS: PACKS,
    loadCatalog: loadCatalog,
    loadRoster: loadRoster,
    characterUrl: characterUrl,
    resolveFromRoster: resolveFromRoster,
    pickDefaultUnit: pickDefaultUnit,
    packBase: packBase,
    envUrl: envUrl,
    propUrl: propUrl,
    textureUrl: textureUrl,
    loadCharacterFbx: loadCharacterFbx,
  };

  global.TvsVoxelAssets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
