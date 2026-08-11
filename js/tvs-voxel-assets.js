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
  var TVS_PREFIX = "models/voxels/tvs";
  // Always absolute TVS CDN base for file consistency (not voxgrudge/ app prefix).
  // Localhost may still fall back to /assets/voxels/* when CDN fails.
  var BASE = CDN.replace(/\/$/, "") + "/" + TVS_PREFIX;

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
        var raw = await fetchJson(urls[i]);
        // Stamp category + SI targets (2 m character yardstick) for game usage
        if (global.TvsAssetCategories && global.TvsAssetCategories.enrichCatalog) {
          cache.catalog = global.TvsAssetCategories.enrichCatalog(raw);
        } else {
          cache.catalog = raw;
        }
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

  function envUrl(packId, slug, preferGlb) {
    var ext = preferGlb === false ? ".fbx" : ".glb";
    return packBase(packId) + "/environment/" + slug + ext;
  }

  function propUrl(packId, slug, preferGlb) {
    var ext = preferGlb === false ? ".fbx" : ".glb";
    return packBase(packId) + "/props/" + slug + ext;
  }

  function animalUrl(packId, slug, preferGlb) {
    var ext = preferGlb === false ? ".fbx" : ".glb";
    return packBase(packId) + "/animals/" + slug + ext;
  }

  function textureUrl(packId, slug) {
    var s = String(slug || "");
    if (!s) return null;
    s = s.endsWith("-texture") ? s : s + "-texture";
    return packBase(packId) + "/textures/" + s + ".png";
  }

  /**
   * Known catalog slug → texture slug mismatches (singular/plural / shared atlas).
   */
  var TEXTURE_SLUG_ALIASES = {
    "voxel-cathedral-statue": "voxel-cathedral-statues",
    "voxel-farm-hay-bale": "voxel-farm-haybale",
    "voxel-rangers-campfire-frame1": "voxel-rangers-campfire",
    "voxel-rangers-campfire-frame2": "voxel-rangers-campfire",
    "voxel-rangers-campfire-frame3": "voxel-rangers-campfire",
    "voxel-rangers-campfire-tree": "voxel-rangers-tree",
    "voxel-rangers-wall-with-ladder": "voxel-rangers-wall-with-ladders",
    "voxel-village-lamppost": "voxel-village-single-lamppost",
    "voxel-village-house": "voxel-village-inn",
  };

  function texCdn(pack, slugStem) {
    if (!pack || !slugStem) return null;
    var s = String(slugStem).toLowerCase().replace(/\s+/g, "-");
    if (!s.endsWith("-texture")) s = s + "-texture";
    return BASE + "/" + pack + "/textures/" + s + ".png";
  }

  /**
   * Ordered atlas URL candidates for a mesh asset (catalog + conventional + aliases).
   */
  function resolveTextureCandidates(asset, catalog) {
    var list = [];
    var seen = {};
    function push(u) {
      if (!u || seen[u]) return;
      seen[u] = 1;
      list.push(u);
    }
    if (!asset) return list;
    if (asset.textureUrl) push(asset.textureUrl);
    if (asset.albedoUrl) push(asset.albedoUrl);

    var pack = asset.pack;
    var slug = asset.slug || asset.name || asset.unitId || "";
    slug = String(slug)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/\.fbx$/i, "")
      .replace(/\.glb$/i, "");
    if (!slug) return list;

    var stems = [slug];
    if (TEXTURE_SLUG_ALIASES[slug]) stems.push(TEXTURE_SLUG_ALIASES[slug]);
    // frame / variant strip
    stems.push(slug.replace(/-frame\d+$/i, ""));
    stems.push(slug.replace(/-with-[a-z0-9-]+$/i, ""));
    // plural/singular
    if (slug.endsWith("s")) stems.push(slug.slice(0, -1));
    else stems.push(slug + "s");
    // house1 style
    stems.push(slug + "1");
    stems.push(slug.replace(/e$/, "") + "es");

    // Catalog texture rows (exact + fuzzy)
    if (catalog && catalog.assets) {
      var packTex = [];
      for (var i = 0; i < catalog.assets.length; i++) {
        var a = catalog.assets[i];
        if (!a) continue;
        var role = String(a.role || "").toLowerCase();
        var fmt = String(a.format || "").toLowerCase();
        if (role !== "textures" && fmt !== "png") continue;
        if (pack && a.pack && a.pack !== pack) continue;
        var as = String(a.slug || a.name || "")
          .toLowerCase()
          .replace(/\s+/g, "-");
        var asStem = as.replace(/-texture$/, "");
        packTex.push({ as: as, asStem: asStem, url: a.cdnUrl || (a.r2Key ? CDN.replace(/\/$/, "") + "/" + a.r2Key.replace(/^\//, "") : null) });
      }
      for (var si = 0; si < stems.length; si++) {
        var stem = stems[si];
        if (!stem) continue;
        var want = stem.endsWith("-texture") ? stem : stem + "-texture";
        var wantStem = want.replace(/-texture$/, "");
        for (var j = 0; j < packTex.length; j++) {
          var row = packTex[j];
          if (
            row.as === want ||
            row.asStem === wantStem ||
            row.asStem === stem ||
            row.as.indexOf(wantStem) === 0 ||
            wantStem.indexOf(row.asStem) === 0 ||
            (row.asStem.length > 6 && wantStem.indexOf(row.asStem) >= 0) ||
            (wantStem.length > 6 && row.asStem.indexOf(wantStem) >= 0)
          ) {
            push(row.url);
          }
        }
      }
      // last resort: first pack texture (shared atlas packs)
      if (packTex.length && list.length < 2) {
        for (var k = 0; k < Math.min(3, packTex.length); k++) push(packTex[k].url);
      }
    }

    for (var t = 0; t < stems.length; t++) {
      push(texCdn(pack, stems[t]));
    }
    return list;
  }

  /**
   * Resolve atlas PNG for a catalog asset (characters / env / props / animals).
   * Prefer catalog texture rows, then conventional pack/textures/{slug}-texture.png.
   */
  function resolveTextureUrl(asset, catalog) {
    var c = resolveTextureCandidates(asset, catalog);
    return c.length ? c[0] : null;
  }

  /** Absolute CDN URL for a catalog asset row (prefer production GLB). */
  function absAssetUrl(asset, preferGlb) {
    if (!asset) return null;
    if (preferGlb !== false) {
      if (asset.glbUrl) return asset.glbUrl;
      if (asset.cdnUrl && /\.fbx($|\?)/i.test(asset.cdnUrl)) {
        return String(asset.cdnUrl).replace(/\.fbx($|\?)/i, ".glb$1");
      }
      if (asset.cdnUrl && /\.glb($|\?)/i.test(asset.cdnUrl)) return asset.cdnUrl;
      if (asset.r2Key) {
        var k = String(asset.r2Key).replace(/\.fbx$/i, ".glb").replace(/\.obj$/i, ".glb").replace(/\.mtl$/i, ".glb");
        if (/\.(png|jpg|jpeg|webp|json)$/i.test(k)) {
          /* not a mesh */
        } else {
          return CDN.replace(/\/$/, "") + "/" + k.replace(/^\//, "");
        }
      }
      // Local author path → CDN key (packs/ → models/voxels/tvs/)
      if (asset.localPath) {
        var lp = String(asset.localPath)
          .replace(/^assets\/voxels\/packs\//, TVS_PREFIX + "/")
          .replace(/^\/?models\/voxels\/tvs\//, TVS_PREFIX + "/")
          .replace(/\.fbx$/i, ".glb");
        if (/\.glb$/i.test(lp)) {
          return CDN.replace(/\/$/, "") + "/" + lp.replace(/^\//, "");
        }
      }
    }
    return asset.cdnUrl || (asset.r2Key ? CDN.replace(/\/$/, "") + "/" + asset.r2Key.replace(/^\//, "") : null);
  }

  /**
   * Candidate URLs for a mesh asset: CDN GLB → local models/ mirror → FBX.
   * Local hero GLBs live at models/voxels/tvs/{pack}/characters/{slug}.glb
   */
  function assetUrlCandidates(asset) {
    var list = [];
    var seen = {};
    function push(u) {
      if (!u || seen[u]) return;
      seen[u] = 1;
      list.push(u);
    }
    push(absAssetUrl(asset, true));
    var pack = asset && asset.pack;
    var slug = asset && (asset.slug || asset.name);
    if (slug) slug = String(slug).toLowerCase().replace(/\s+/g, "-");
    var role = String((asset && asset.role) || "").toLowerCase();
    var folder =
      role === "environment" || role === "building"
        ? "environment"
        : role === "animals" || role === "animal"
          ? "animals"
          : role === "props" || role === "prop" || role === "weapon"
            ? "props"
            : role === "characters" || role === "character"
              ? "characters"
              : null;
    if (pack && slug && folder) {
      push(CDN.replace(/\/$/, "") + "/" + TVS_PREFIX + "/" + pack + "/" + folder + "/" + slug + ".glb");
      push("models/voxels/tvs/" + pack + "/" + folder + "/" + slug + ".glb");
      push("/models/voxels/tvs/" + pack + "/" + folder + "/" + slug + ".glb");
    }
    push(absAssetUrl(asset, false));
    return list;
  }

  /** Mesh loaders only — skip png/mtl/obj sidecars (catalog triples per slug). */
  var MESH_FORMATS = { fbx: 1, glb: 1, gltf: 1 };
  var SKIP_FORMATS = { png: 1, mtl: 1, obj: 1, jpg: 1, jpeg: 1, webp: 1, json: 1 };

  function isMeshRow(a) {
    if (!a) return false;
    var f = String(a.format || "").toLowerCase();
    if (f && SKIP_FORMATS[f]) return false;
    if (f && MESH_FORMATS[f]) return true;
    // No format: accept if path looks like a mesh
    var key = String(a.r2Key || a.cdnUrl || a.localPath || a.slug || "");
    return /\.(fbx|glb|gltf)($|\?)/i.test(key);
  }

  function listByRole(catalog, role, formats) {
    if (!catalog || !catalog.assets) return [];
    var want = String(role || "").toLowerCase();
    var fmtOk = formats || null;
    return catalog.assets.filter(function (a) {
      if (!a) return false;
      var r = String(a.role || a.kind || "").toLowerCase();
      if (r !== want && !(want === "environment" && (r === "building" || r === "env"))) return false;
      if (want === "props" && (r === "prop" || r === "weapon" || r === "equipment")) {
        /* allow kind alias when role mismatched */
      }
      if (fmtOk && fmtOk.length) {
        var f = String(a.format || "").toLowerCase();
        if (fmtOk.indexOf(f) < 0) return false;
      }
      return true;
    });
  }

  /**
   * Dedupe mesh rows by slug. Prefer glb > fbx > anything else.
   * Catalog often has fbx + mtl + obj for the same asset.
   */
  function dedupeMeshRows(rows) {
    var best = {};
    var rank = function (a) {
      var f = String((a && a.format) || "").toLowerCase();
      if (f === "glb" || f === "gltf") return 3;
      if (f === "fbx") return 2;
      if (isMeshRow(a)) return 1;
      return 0;
    };
    (rows || []).forEach(function (a) {
      if (!isMeshRow(a)) return;
      var k = a.slug || a.id;
      if (!k) return;
      var prev = best[k];
      if (!prev || rank(a) > rank(prev)) best[k] = a;
    });
    return Object.keys(best)
      .sort()
      .map(function (k) {
        return best[k];
      });
  }

  function listBuildings(catalog) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.listMeshGroup) {
      var b = global.TvsAssetCategories.listMeshGroup(catalog, "buildings", dedupeMeshRows);
      if (b && b.length) return b;
    }
    return dedupeMeshRows(listByRole(catalog, "environment"));
  }

  function listProps(catalog) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.listMeshGroup) {
      var p = global.TvsAssetCategories
        .listMeshGroup(catalog, "props", dedupeMeshRows)
        .concat(global.TvsAssetCategories.listMeshGroup(catalog, "items", dedupeMeshRows));
      // Weapons are their own browse mode; keep in props for back-compat "props" filter
      p = p.concat(global.TvsAssetCategories.listMeshGroup(catalog, "weapons", dedupeMeshRows));
      p = p.concat(global.TvsAssetCategories.listMeshGroup(catalog, "nature", dedupeMeshRows));
      if (p.length) return dedupeMeshRows(p);
    }
    var rows = listByRole(catalog, "props").concat(listByRole(catalog, "prop"));
    if (catalog && catalog.assets) {
      catalog.assets.forEach(function (a) {
        var k = String((a && a.kind) || "").toLowerCase();
        var r = String((a && a.role) || "").toLowerCase();
        if (
          (k === "weapon" || k === "equipment" || k === "prop") &&
          r !== "props" &&
          r !== "prop" &&
          r !== "characters" &&
          r !== "environment" &&
          r !== "animals"
        ) {
          rows.push(a);
        }
      });
    }
    return dedupeMeshRows(rows);
  }

  function listWeapons(catalog) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.listMeshGroup) {
      return global.TvsAssetCategories.listMeshGroup(catalog, "weapons", dedupeMeshRows);
    }
    return listProps(catalog).filter(function (a) {
      return a && String(a.categoryGroup || "").indexOf("weapon") >= 0;
    });
  }

  function listItems(catalog) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.listMeshGroup) {
      return global.TvsAssetCategories.listMeshGroup(catalog, "items", dedupeMeshRows);
    }
    return [];
  }

  function listNature(catalog) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.listMeshGroup) {
      return global.TvsAssetCategories.listMeshGroup(catalog, "nature", dedupeMeshRows);
    }
    return listProps(catalog).filter(function (a) {
      return a && a.categoryGroup === "nature";
    });
  }

  function listAnimals(catalog) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.listMeshGroup) {
      var an = global.TvsAssetCategories.listMeshGroup(catalog, "animals", dedupeMeshRows);
      if (an && an.length) return an;
    }
    return dedupeMeshRows(
      listByRole(catalog, "animals").concat(listByRole(catalog, "animal"))
    );
  }

  /** Catalog characters (TVS packs) as mesh rows — not Avatar Edit races. */
  function listCharacters(catalog) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.listMeshGroup) {
      var ch = global.TvsAssetCategories.listMeshGroup(catalog, "characters", dedupeMeshRows);
      if (ch && ch.length) return ch;
    }
    return dedupeMeshRows(
      listByRole(catalog, "characters").concat(listByRole(catalog, "character"))
    );
  }

  /** Browse by category group for games UI. */
  function listByGroup(catalog, groupId) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.listMeshGroup) {
      return global.TvsAssetCategories.listMeshGroup(catalog, groupId, dedupeMeshRows);
    }
    return [];
  }

  /**
   * All browsable world meshes: environment + props + animals (+ optional chars).
   * opts.includeCharacters default false (units come from unit-roster).
   */
  function listAllAssets(catalog, opts) {
    opts = opts || {};
    // Showcase "all world assets" includes catalog character meshes + env/props/animals
    var includeChars = opts.includeCharacters !== false;
    var out = listBuildings(catalog)
      .concat(listProps(catalog))
      .concat(listAnimals(catalog));
    if (includeChars) out = out.concat(listCharacters(catalog));
    // Final slug dedupe across roles
    return dedupeMeshRows(out);
  }

  function catalogStats(catalog) {
    var buildings = listBuildings(catalog).length;
    var props = listProps(catalog).length;
    var animals = listAnimals(catalog).length;
    var characters = listCharacters(catalog).length;
    return {
      buildings: buildings,
      props: props,
      animals: animals,
      characters: characters,
      // Mesh rows only (not textures/anims/mtl)
      all: buildings + props + animals + characters,
    };
  }

  /**
   * Category SI target (metres) relative to 2.0 m character yardstick.
   * SSOT: TvsAssetCategories — weapons/items/buildings/animals each have own fit.
   */
  function defaultHeightForAsset(asset) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.defaultHeightForAsset) {
      return global.TvsAssetCategories.defaultHeightForAsset(asset);
    }
    // Fallback if categories module not loaded
    var role = String((asset && asset.role) || "").toLowerCase();
    var slug = String((asset && asset.slug) || (asset && asset.name) || "").toLowerCase();
    if (role === "characters" || role === "character") return 2.0;
    if (role === "animals" || role === "animal") return 1.35;
    if (/weapon|sword|axe|bow|spear|staff|shield|hammer|mace/.test(slug)) return 1.0;
    if (/tree/.test(slug)) return 6.0;
    if (role === "environment") return 8.0;
    return 1.0;
  }

  function defineAssetForGame(asset) {
    if (global.TvsAssetCategories && global.TvsAssetCategories.defineAsset) {
      return global.TvsAssetCategories.defineAsset(asset);
    }
    return asset;
  }

  /**
   * Load static building/prop/animal (GLB preferred, FBX fallback).
   * Production GLB: keep bake scale + embedded textures — ground feet only.
   * NEVER height/size.y stretch (that made scaleFactor 0.01 / nativeHeight 200).
   */
  async function loadStaticAsset(asset, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    if (!THREE) throw new Error("THREE required");
    if (global.TvsProductionPipeline && global.TvsProductionPipeline.ensureMeshoptReady) {
      await global.TvsProductionPipeline.ensureMeshoptReady();
    }
    var glbUrl = absAssetUrl(asset, true);
    var fbxUrl = absAssetUrl(asset, false);
    // Prefer true FBX URL when glb rewrite equals fbx path incorrectly
    if (glbUrl && fbxUrl && glbUrl === fbxUrl && /\.fbx/i.test(glbUrl)) {
      glbUrl = String(glbUrl).replace(/\.fbx($|\?)/i, ".glb$1");
    }
    var urlList = assetUrlCandidates(asset);
    var catRef = opts.catalog || cache.catalog;
    var texCandidates = resolveTextureCandidates(asset, catRef);
    if (opts.textureUrl) {
      texCandidates = [opts.textureUrl].concat(texCandidates);
    }
    var texUrl = texCandidates.length ? texCandidates[0] : null;

    var root = null;
    var loadedFrom = null;
    var fromGlb = false;
    var lastErr = null;
    var boundExternalTex = false;
    var boundTexUrl = null;

    async function loadAtlasTex(url) {
      if (!url) return null;
      if (global.TvsProductionPipeline && global.TvsProductionPipeline.loadTextureUrl) {
        return global.TvsProductionPipeline.loadTextureUrl(url, {
          voxel: true,
          flipY: false,
          kind: "color",
        });
      }
      if (global.TvsVoxelColors && global.TvsVoxelColors.prepVoxelTexture) {
        var raw = await new Promise(function (resolve, reject) {
          var tl = new THREE.TextureLoader();
          if (tl.setCrossOrigin) tl.setCrossOrigin("anonymous");
          tl.load(url, resolve, undefined, reject);
        });
        return global.TvsVoxelColors.prepVoxelTexture(raw, {
          THREE: THREE,
          flipY: false,
          voxel: true,
        });
      }
      return new Promise(function (resolve, reject) {
        var tl = new THREE.TextureLoader();
        if (tl.setCrossOrigin) tl.setCrossOrigin("anonymous");
        tl.load(
          url,
          function (tex) {
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            tex.flipY = false;
            if ("colorSpace" in tex && THREE.SRGBColorSpace != null) {
              tex.colorSpace = THREE.SRGBColorSpace;
            } else if (THREE.sRGBEncoding != null) {
              tex.encoding = THREE.sRGBEncoding;
            }
            resolve(tex);
          },
          undefined,
          reject
        );
      });
    }

    async function tryBindAnyAtlas(r) {
      for (var ti = 0; ti < texCandidates.length; ti++) {
        var u = texCandidates[ti];
        try {
          var atlas = await loadAtlasTex(u);
          if (atlas) {
            bindAtlas(r, atlas);
            boundTexUrl = u;
            return true;
          }
        } catch (eTex) {
          /* try next candidate */
        }
      }
      return false;
    }

    function bindAtlas(r, tex) {
      if (!r || !tex) return;
      if (global.TvsVoxelColors && global.TvsVoxelColors.applyAtlasMap) {
        global.TvsVoxelColors.applyAtlasMap(r, tex, { THREE: THREE, flipY: false });
      } else {
        r.traverse(function (ch) {
          if (!ch.isMesh || !ch.material) return;
          var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
          for (var i = 0; i < mats.length; i++) {
            var m = mats[i].clone();
            m.map = tex;
            if (m.color) m.color.setHex(0xffffff);
            if ("roughness" in m) m.roughness = 0.9;
            if ("metalness" in m) m.metalness = 0;
            if ("flatShading" in m) m.flatShading = true;
            m.needsUpdate = true;
            mats[i] = m;
          }
          ch.material = Array.isArray(ch.material) ? mats : mats[0];
          ch.castShadow = true;
          ch.receiveShadow = true;
        });
      }
      boundExternalTex = true;
    }

    function meshHasMap(r) {
      if (global.TvsVoxelColors && global.TvsVoxelColors.hasUsableMap) {
        return global.TvsVoxelColors.hasUsableMap(r);
      }
      if (global.TvsProductionPipeline && global.TvsProductionPipeline.hasUsableMap) {
        return global.TvsProductionPipeline.hasUsableMap(r);
      }
      return false;
    }

    // Try all GLB candidates (CDN production + local models/voxels/tvs mirrors)
    for (var ui = 0; ui < urlList.length && !root; ui++) {
      var tryUrl = urlList[ui];
      if (!tryUrl || !/\.glb($|\?)/i.test(tryUrl)) continue;
      if (global.TvsProductionPipeline && global.TvsProductionPipeline.loadProductionGlb) {
        try {
          root = await global.TvsProductionPipeline.loadProductionGlb(tryUrl, {
            voxel: true,
            ground: true,
          });
          loadedFrom = tryUrl;
          fromGlb = true;
          break;
        } catch (ePipe) {
          lastErr = ePipe;
          console.warn("[TvsVoxelAssets] pipeline GLB fail", tryUrl, ePipe && ePipe.message);
        }
      }
      if (!root) {
        var GLTFLoader = opts.GLTFLoader || THREE.GLTFLoader || global.GLTFLoader;
        if (GLTFLoader) {
          try {
            var gltfLoader =
              global.TvsProductionPipeline && global.TvsProductionPipeline.getGltfLoader
                ? global.TvsProductionPipeline.getGltfLoader()
                : new GLTFLoader();
            var gltf = await new Promise(function (resolve, reject) {
              gltfLoader.load(tryUrl, resolve, undefined, reject);
            });
            root = gltf.scene || gltf.scenes[0];
            loadedFrom = tryUrl;
            fromGlb = true;
            break;
          } catch (e1) {
            lastErr = e1;
            console.warn("[TvsVoxelAssets] GLB fail", tryUrl, e1 && e1.message);
          }
        }
      }
    }

    if (!root && fbxUrl) {
      var FBXLoader = opts.FBXLoader || THREE.FBXLoader || global.FBXLoader;
      if (!FBXLoader) {
        throw lastErr || new Error("FBXLoader required for FBX fallback");
      }
      try {
        var fbxLoader = new FBXLoader();
        root = await new Promise(function (resolve, reject) {
          fbxLoader.load(fbxUrl, resolve, undefined, reject);
        });
        loadedFrom = fbxUrl;
      } catch (eFbx) {
        lastErr = eFbx;
      }
    }

    if (!root) {
      var slug = (asset && (asset.slug || asset.id)) || "?";
      var hint =
        typeof location !== "undefined" && location.protocol === "file:"
          ? " (open via local static server — file:// blocks CDN CORS)"
          : "";
      throw new Error(
        "Failed to load TVS asset " +
          slug +
          hint +
          (lastErr && lastErr.message ? " · " + lastErr.message : "")
      );
    }

    // Materials: pipeline SSOT (keep maps; voxel Nearest; MeshStandard)
    if (global.TvsProductionPipeline && global.TvsProductionPipeline.prepMeshMaterials) {
      global.TvsProductionPipeline.prepMeshMaterials(root, { voxel: true });
    }

    // Textures: keep healthy GLB embeds; otherwise bind external atlas (try all candidates).
    // forceTexture / preferExternalAtlas rebinds PNG over embeds (showcase "force color").
    var needAtlas =
      opts.forceTexture === true ||
      opts.preferExternalAtlas === true ||
      (!fromGlb && opts.withTexture !== false) ||
      (fromGlb && !meshHasMap(root) && opts.withTexture !== false);
    if (needAtlas && texCandidates.length && opts.withTexture !== false) {
      var bound = await tryBindAnyAtlas(root);
      if (!bound) {
        console.warn(
          "[TvsVoxelAssets] no atlas loaded for",
          asset.slug || asset.id,
          "tried",
          texCandidates.length
        );
      }
    }

    // Readable albedo + game colour API (white base × map, tint without killing atlas)
    if (global.TvsVoxelColors) {
      if (global.TvsVoxelColors.ensureReadableAlbedo) {
        global.TvsVoxelColors.ensureReadableAlbedo(root, { THREE: THREE });
      }
      if (global.TvsVoxelColors.attachColorApi) {
        global.TvsVoxelColors.attachColorApi(root, { THREE: THREE });
      }
      // Optional pack theme / team tint for games
      if (opts.teamTint != null) {
        root.userData.applyTeamTint(opts.teamTint, opts.teamTintStrength);
      } else if (opts.colorTint != null) {
        root.userData.setColorTint(opts.colorTint);
      } else if (opts.packTint && asset && asset.pack) {
        root.userData.setColorMultiply(
          global.TvsVoxelColors.packHex(asset.pack),
          opts.packTintStrength != null ? opts.packTintStrength : 0.2
        );
      }
    } else if (global.TvsProductionPipeline && global.TvsProductionPipeline.prepMeshMaterials) {
      global.TvsProductionPipeline.prepMeshMaterials(root, { voxel: true });
    }

    // Category SI scale (2 m character yardstick) — uniform grow only
    var def = defineAssetForGame(asset);
    var scaleOpts =
      global.TvsAssetCategories && global.TvsAssetCategories.scaleOptsForAsset
        ? global.TvsAssetCategories.scaleOptsForAsset(def, {
            targetHeight: opts.height != null ? opts.height : undefined,
            fitHeight: opts.fitHeight,
            fitAxis: opts.fitAxis,
            maxDimM: opts.maxDimM,
          })
        : {
            targetHeight: opts.height != null ? opts.height : defaultHeightForAsset(asset),
            fitHeight: true,
            fitAxis: "y",
            maxDimM: 40,
          };

    var hasSkin = false;
    root.traverse(function (ch) {
      if (ch.isSkinnedMesh) hasSkin = true;
    });
    // ONLY true characters → 2.0 m. Weapons/arrows often ship as SkinnedMesh
    // but must keep category SI (projectile ~0.72 m, 1H ~0.85 m). NEVER force 2 m.
    var catId = scaleOpts.category || (def && def.category) || "";
    var isCharacterCat = catId === "character";
    if (hasSkin && isCharacterCat) {
      scaleOpts.targetHeight = 2.0;
      scaleOpts.targetM = 2.0;
      scaleOpts.fitAxis = "y";
      scaleOpts.fitHeight = true;
      scaleOpts.category = "character";
      scaleOpts.relativeToCharacter = 1;
      scaleOpts.maxDimM = Math.min(scaleOpts.maxDimM || 12, 12);
    } else if (hasSkin && !isCharacterCat) {
      // Keep category targets; stamp so UI can debug
      root.userData.skinnedNonCharacter = true;
      root.userData.skinnedKeptCategory = catId || "unknown";
    }

    var targetH = scaleOpts.targetHeight;
    root.userData.targetHeight = targetH;
    root.userData.productionBaked = fromGlb;
    root.userData.category = scaleOpts.category || (def && def.category);
    root.userData.categoryLabel = def && def.categoryLabel;
    root.userData.fitAxis = scaleOpts.fitAxis;
    root.userData.relativeToCharacter = scaleOpts.relativeToCharacter;
    root.userData.characterHeightM = 2.0;
    root.userData.siScaleDef = def && def.siScaleDef;
    root.userData.gameUsage = def && def.gameUsage;

    var role = String((asset && asset.role) || "").toLowerCase();
    // Props/weapons/projectiles always get SI category fit (even if skinned)
    var isStaticRole =
      !isCharacterCat &&
      (role === "environment" ||
        role === "building" ||
        role === "env" ||
        role === "props" ||
        role === "prop" ||
        role === "weapon" ||
        role === "equipment" ||
        role === "animals" ||
        role === "animal" ||
        !!scaleOpts.category);

    // Professional game delivery: SI category fit + upright facing + ground
    var deliveryOpts = {
      targetHeight: targetH,
      targetM: targetH,
      fitHeight: scaleOpts.fitHeight !== false && (hasSkin || isStaticRole),
      fitAxis: scaleOpts.fitAxis || "y",
      maxDimM: scaleOpts.maxDimM != null ? scaleOpts.maxDimM : 40,
      category: scaleOpts.category,
      relativeToCharacter: scaleOpts.relativeToCharacter,
      isCharacter: isCharacterCat,
      // Props/weapons/projectiles: no character face correction
      skipFacing: !isCharacterCat,
      yawOffset: opts.yawOffset,
      faceMinusZ: opts.faceMinusZ === true,
      yawDeg: opts.yawDeg,
      centerXZ: opts.centerXZ,
      keepXZ: opts.keepXZ,
    };
    if (global.TvsProductionPipeline && global.TvsProductionPipeline.finalizeGameDelivery) {
      global.TvsProductionPipeline.finalizeGameDelivery(root, deliveryOpts);
    } else if (global.TvsProductionPipeline && global.TvsProductionPipeline.groundFeet) {
      global.TvsProductionPipeline.groundFeet(root, deliveryOpts);
    } else if (global.TvsUnitLoader && global.TvsUnitLoader.normalizeHeight) {
      global.TvsUnitLoader.normalizeHeight(root, targetH, THREE, {
        alreadyBaked: fromGlb,
        groundOnly: true,
        fitHeight: true,
        maxDimM: scaleOpts.maxDimM || 40,
      });
    } else {
      root.updateMatrixWorld(true);
      var box0 = new THREE.Box3().setFromObject(root);
      var sz0 = new THREE.Vector3();
      box0.getSize(sz0);
      if (Math.max(sz0.x, sz0.y, sz0.z) > 40) {
        root.scale.multiplyScalar(0.01);
        root.updateMatrixWorld(true);
      }
      var box = new THREE.Box3().setFromObject(root);
      root.position.y -= box.min.y;
      var size = new THREE.Vector3();
      box.getSize(size);
      root.userData.nativeHeight = size.y;
    }

    // Framing helpers for showcase / games
    root.updateMatrixWorld(true);
    var frameBox = new THREE.Box3().setFromObject(root);
    var frameSize = new THREE.Vector3();
    var frameCenter = new THREE.Vector3();
    frameBox.getSize(frameSize);
    frameBox.getCenter(frameCenter);
    root.userData.frameSize = { x: frameSize.x, y: frameSize.y, z: frameSize.z };
    root.userData.frameCenter = { x: frameCenter.x, y: frameCenter.y, z: frameCenter.z };
    root.userData.suggestDist = Math.max(
      2.5,
      Math.max(frameSize.x, frameSize.y, frameSize.z) * 1.9 + 1.4
    );
    root.userData.noStretch = hasSkin || (fromGlb && !root.userData.siFit);

    root.userData.tvsAsset = asset;
    root.userData.assetSource = "tvs-voxel";
    root.userData.loadedFrom = loadedFrom;
    root.userData.textureUrl = boundExternalTex
      ? boundTexUrl || texUrl
      : meshHasMap(root)
        ? fromGlb
          ? loadedFrom + "#embed"
          : texUrl
        : boundTexUrl || texUrl;
    root.userData.externalAtlas = boundExternalTex;
    root.userData.hasTexture = meshHasMap(root);
    root.userData.textureCandidates = texCandidates.slice(0, 8);
    return root;
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
    MESH_FORMATS: MESH_FORMATS,
    loadCatalog: loadCatalog,
    loadRoster: loadRoster,
    characterUrl: characterUrl,
    resolveFromRoster: resolveFromRoster,
    pickDefaultUnit: pickDefaultUnit,
    packBase: packBase,
    envUrl: envUrl,
    propUrl: propUrl,
    animalUrl: animalUrl,
    textureUrl: textureUrl,
    resolveTextureUrl: resolveTextureUrl,
    resolveTextureCandidates: resolveTextureCandidates,
    absAssetUrl: absAssetUrl,
    assetUrlCandidates: assetUrlCandidates,
    isMeshRow: isMeshRow,
    listByRole: listByRole,
    dedupeMeshRows: dedupeMeshRows,
    listBuildings: listBuildings,
    listProps: listProps,
    listWeapons: listWeapons,
    listItems: listItems,
    listNature: listNature,
    listAnimals: listAnimals,
    listCharacters: listCharacters,
    listByGroup: listByGroup,
    listAllAssets: listAllAssets,
    catalogStats: catalogStats,
    defaultHeightForAsset: defaultHeightForAsset,
    defineAssetForGame: defineAssetForGame,
    loadStaticAsset: loadStaticAsset,
    loadCharacterFbx: loadCharacterFbx,
    CHARACTER_HEIGHT_M: 2.0,
  };

  global.TvsVoxelAssets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
