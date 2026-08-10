/**
 * TVS Voxel Unit Loader — production runtime for VoxGrudge / RTS / showcase.
 *
 * Loads characters from the D1-aligned unit roster + R2 CDN:
 *   https://assets.grudge-studio.com/models/voxels/tvs/unit-roster.json
 *
 * Best practices:
 *   - Normalize unit records (modelUrl/meshUrl/r2Key consistency)
 *   - Magic-byte verify FBX (reject HTML fake-200); parse buffer once
 *   - Height normalize via local scale (skinned measure + decade unit fix + ground feet)
 *   - Texture rebind MeshStandard + NearestFilter + CORS + flipY false for external atlases
 *   - Color tint via material.color
 *   - Semantic anim packs from *.anims.json
 */
(function (global) {
  "use strict";

  var CDN = "https://assets.grudge-studio.com";
  var TVS_PREFIX = "models/voxels/tvs";
  var CDN_ROSTER =
    (global.GrudgeFleet &&
      global.GrudgeFleet.endpoints &&
      global.GrudgeFleet.endpoints.tvsVoxelRoster) ||
    CDN + "/" + TVS_PREFIX + "/unit-roster.json";
  var CDN_CATALOG = CDN + "/" + TVS_PREFIX + "/catalog.json";

  var DEFAULT_HEIGHT = 2.0;
  var HUMAN_CLIP_RE = /human[-_]/i;
  var ANIMAL_CLIP_RE = /^(horse|cow|pig|sheep|chicken|duck|bull|owl|corgi|goat)[-_]/i;

  // ── URL / unit consistency ─────────────────────────────────────────────────

  /** Absolute CDN URL from relative r2 key or partial path. */
  function absCdnUrl(u) {
    if (!u) return null;
    var s = String(u).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.indexOf("//") === 0) return "https:" + s;
    s = s.replace(/^\//, "");
    if (s.indexOf("models/") === 0 || s.indexOf("icons/") === 0) return CDN + "/" + s;
    if (s.indexOf("voxgrudge/") === 0) return CDN + "/" + s;
    // Bare pack-relative: characters/foo.fbx under TVS
    return CDN + "/" + TVS_PREFIX + "/" + s.replace(/^models\/voxels\/tvs\//, "");
  }

  /**
   * Normalize a roster unit so loaders always see consistent absolute URLs.
   * Accepts modelUrl | meshUrl | url | r2Key aliases.
   */
  /** Derive production GLB URL beside FBX path (converted + compressed pack). */
  function glbUrlFromModel(modelUrl) {
    if (!modelUrl) return null;
    var s = String(modelUrl);
    if (/\.glb($|\?)/i.test(s)) return s;
    return s.replace(/\.fbx($|\?)/i, ".glb$1");
  }

  function normalizeUnit(unit) {
    if (!unit) return null;
    var u = Object.assign({}, unit);
    var model =
      u.modelUrl ||
      u.meshUrl ||
      u.url ||
      u.model ||
      (u.r2Key ? absCdnUrl(u.r2Key) : null) ||
      (u.modelR2Key ? absCdnUrl(u.modelR2Key) : null);
    var tex =
      u.textureUrl ||
      u.texUrl ||
      u.albedoUrl ||
      (u.textureR2Key ? absCdnUrl(u.textureR2Key) : null);
    var anims =
      u.animationPackUrl ||
      u.animsUrl ||
      u.animationUrl ||
      (u.animsR2Key ? absCdnUrl(u.animsR2Key) : null);
    var collider = u.colliderUrl || (u.colliderR2Key ? absCdnUrl(u.colliderR2Key) : null);
    var brain = u.brainUrl || (u.brainR2Key ? absCdnUrl(u.brainR2Key) : null);
    var glb =
      u.glbUrl ||
      u.productionGlbUrl ||
      (u.glbR2Key ? absCdnUrl(u.glbR2Key) : null) ||
      glbUrlFromModel(model);

    u.modelUrl = absCdnUrl(model);
    u.textureUrl = absCdnUrl(tex);
    u.animationPackUrl = absCdnUrl(anims);
    u.colliderUrl = absCdnUrl(collider);
    u.brainUrl = absCdnUrl(brain);
    u.glbUrl = absCdnUrl(glb);
    // Back-compat aliases
    u.meshUrl = u.modelUrl;
    u.animsUrl = u.animationPackUrl;
    u.production = u.production || null;
    return u;
  }

  function normalizeRoster(roster) {
    if (!roster) return roster;
    var out = Object.assign({}, roster);
    out.cdnBase = out.cdnBase || CDN;
    out.r2Prefix = out.r2Prefix || TVS_PREFIX;
    out.units = (roster.units || []).map(normalizeUnit).filter(function (u) {
      return u && u.modelUrl;
    });
    return out;
  }

  // ── fetch helpers ──────────────────────────────────────────────────────────

  async function fetchJson(url) {
    if (!url) return null;
    try {
      var res = await fetch(url, { mode: "cors" });
      if (!res.ok) return null;
      return res.json();
    } catch (e) {
      return null;
    }
  }

  async function fetchRealFbxBuffer(url) {
    var res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("FBX HTTP " + res.status + ": " + url);
    var buf = await res.arrayBuffer();
    var bytes = new Uint8Array(buf);
    if (bytes.length < 32) throw new Error("FBX too small: " + url);
    var head = "";
    for (var i = 0; i < 20 && i < bytes.length; i++) head += String.fromCharCode(bytes[i]);
    if (head.indexOf("<!DOCTYPE") >= 0 || head.indexOf("<html") >= 0 || head.indexOf("<HTML") >= 0) {
      throw new Error("HTML fake-200 (not FBX): " + url);
    }
    if (head.indexOf("Kaydara") < 0 && bytes[0] !== 0x4b) {
      if (bytes.length < 2048) throw new Error("Not FBX: " + url);
    }
    return buf;
  }

  /** Prefer parse(arrayBuffer) so we only download once (verify + import). */
  async function loadFbxFromUrl(FBXLoader, url, opts) {
    opts = opts || {};
    var loader = new FBXLoader();
    if (opts.verify === false) {
      return new Promise(function (resolve, reject) {
        loader.load(url, resolve, undefined, reject);
      });
    }
    var buf = await fetchRealFbxBuffer(url);
    // three r128 FBXLoader: parse(buffer, path)
    if (typeof loader.parse === "function") {
      var path = url.replace(/[^/]+$/, "");
      try {
        var parsed = loader.parse(buf, path);
        return Promise.resolve(parsed);
      } catch (e) {
        console.warn("[TvsUnitLoader] parse buffer failed, retry load()", e && e.message);
      }
    }
    return new Promise(function (resolve, reject) {
      loader.load(url, resolve, undefined, reject);
    });
  }

  async function assertRealFbx(url) {
    await fetchRealFbxBuffer(url);
    return true;
  }

  /**
   * Known missing CDN texture keys → working pack sibling atlas.
   * (7 roster rows still point at PNGs that 404 on R2.)
   */
  var TEXTURE_ALIASES = {
    "voxel-farm-farm-hand":
      CDN + "/" + TVS_PREFIX + "/voxel-farm/textures/voxel-farm-farmer-texture.png",
    "voxel-knights-knight-helm-down":
      CDN + "/" + TVS_PREFIX + "/voxel-knights/textures/voxel-knights-knight-texture.png",
    "voxel-rangers-hooded":
      CDN + "/" + TVS_PREFIX + "/voxel-rangers/textures/voxel-rangers-captain-texture.png",
    "voxel-rangers-hooded-with-stubble":
      CDN + "/" + TVS_PREFIX + "/voxel-rangers/textures/voxel-rangers-captain-texture.png",
    "voxel-rangers-long-hair":
      CDN + "/" + TVS_PREFIX + "/voxel-rangers/textures/voxel-rangers-captain-texture.png",
    "voxel-rangers-long-hair-and-beard":
      CDN + "/" + TVS_PREFIX + "/voxel-rangers/textures/voxel-rangers-captain-texture.png",
    "voxel-village-jeweller":
      CDN + "/" + TVS_PREFIX + "/voxel-village/textures/voxel-village-barmaid-texture.png",
  };

  /** Prefer pack sibling when unit-specific PNG is missing. */
  function textureCandidates(unit) {
    var list = [];
    var seen = {};
    function push(u) {
      u = absCdnUrl(u);
      if (!u || seen[u]) return;
      seen[u] = 1;
      list.push(u);
    }
    if (unit && unit.unitId && TEXTURE_ALIASES[unit.unitId]) {
      push(TEXTURE_ALIASES[unit.unitId]);
    }
    push(unit && unit.textureUrl);
    // Derive pack default: models/voxels/tvs/{pack}/textures/{pack}-*-texture.png via alias table only
    // + strip variant suffixes for near-miss names
    if (unit && unit.textureUrl) {
      var t = String(unit.textureUrl);
      // helm-down → base knight, long-hair-and-beard → long-hair, etc.
      push(t.replace(/-helm-down-texture/, "-texture").replace(/-helm-down/, ""));
      push(t.replace(/-with-stubble-texture/, "-texture"));
      push(t.replace(/-and-beard-texture/, "-texture"));
      push(t.replace(/-long-hair-texture/, "-captain-texture"));
      push(t.replace(/-hooded-texture/, "-captain-texture"));
      push(t.replace(/-farm-hand-texture/, "-farmer-texture"));
      push(t.replace(/-jeweller-texture/, "-barmaid-texture"));
    }
    if (unit && unit.pack) {
      // Last resort: any known-good atlas for pack
      var packDefaults = {
        "voxel-farm": "voxel-farm-farmer-texture.png",
        "voxel-knights": "voxel-knights-knight-texture.png",
        "voxel-rangers": "voxel-rangers-captain-texture.png",
        "voxel-village": "voxel-village-barmaid-texture.png",
        "voxel-wizards": "voxel-wizards-wizard-texture.png",
        "voxel-cathedral": "voxel-cathedral-crusader-texture.png",
        "voxel-palace": "voxel-palace-guard-texture.png",
      };
      if (packDefaults[unit.pack]) {
        push(CDN + "/" + TVS_PREFIX + "/" + unit.pack + "/textures/" + packDefaults[unit.pack]);
      }
    }
    return list;
  }

  function prepVoxelTexture(THREE, tex, flipY) {
    // External TVS PNG atlases + FBX UVs: flipY false by default
    tex.flipY = flipY === true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    if ("colorSpace" in tex && THREE.SRGBColorSpace != null) {
      tex.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding != null) {
      tex.encoding = THREE.sRGBEncoding;
    }
    tex.needsUpdate = true;
    return tex;
  }

  async function loadTexture(THREE, url, flipY) {
    return new Promise(function (resolve, reject) {
      var loader = new THREE.TextureLoader();
      if (loader.setCrossOrigin) loader.setCrossOrigin("anonymous");
      loader.load(
        url,
        function (tex) {
          resolve(prepVoxelTexture(THREE, tex, flipY));
        },
        undefined,
        function (err) {
          reject(err || new Error("texture load failed: " + url));
        }
      );
    });
  }

  /** Try primary + alias/fallback texture URLs until one loads. */
  async function loadTextureWithFallbacks(THREE, unit) {
    var cands = textureCandidates(unit);
    var lastErr = null;
    for (var i = 0; i < cands.length; i++) {
      var url = cands[i];
      try {
        var tex = await loadTexture(THREE, url, false);
        return { tex: tex, url: url, flipY: false };
      } catch (e1) {
        lastErr = e1;
        try {
          var tex2 = await loadTexture(THREE, url, true);
          return { tex: tex2, url: url, flipY: true };
        } catch (e2) {
          lastErr = e2;
        }
      }
    }
    throw lastErr || new Error("no texture candidates for " + (unit && unit.unitId));
  }

  // ── roster ─────────────────────────────────────────────────────────────────

  async function loadTvsRoster(force) {
    // Prefer production roster (glbUrl + baked meta) when published
    var prodUrls = [
      CDN + "/" + TVS_PREFIX + "/unit-roster.production.json",
      CDN_ROSTER,
      "/assets/voxels/unit-roster.json",
      "assets/voxels/unit-roster.json",
    ];
    if (global.TvsVoxelAssets && global.TvsVoxelAssets.loadRoster && !force) {
      try {
        var r0 = await global.TvsVoxelAssets.loadRoster(force);
        // Still try production overlay if units lack glbUrl
        var prod = await fetchJson(prodUrls[0]);
        if (prod && prod.units && prod.units.length) {
          return normalizeRoster(mergeProductionRoster(r0, prod));
        }
        return normalizeRoster(r0);
      } catch (e0) { /* fall through */ }
    }
    if (global.GrudgeFleet && global.GrudgeFleet.loadTvsVoxelRoster) {
      try {
        return normalizeRoster(await global.GrudgeFleet.loadTvsVoxelRoster());
      } catch (e1) { /* fall through */ }
    }
    var lastErr = null;
    for (var i = 0; i < prodUrls.length; i++) {
      try {
        var data = await fetchJson(prodUrls[i]);
        if (data && data.units) return normalizeRoster(data);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("TVS roster unavailable");
  }

  /** Overlay glbUrl/production fields from production roster onto base units. */
  function mergeProductionRoster(base, prod) {
    if (!base || !prod) return prod || base;
    var byId = {};
    (prod.units || []).forEach(function (u) {
      if (u && u.unitId) byId[u.unitId] = u;
    });
    var units = (base.units || []).map(function (u) {
      var p = byId[u.unitId];
      if (!p) return u;
      return Object.assign({}, u, {
        glbUrl: p.glbUrl || u.glbUrl,
        production: p.production || u.production,
        textureUrl: p.textureUrl || u.textureUrl,
      });
    });
    return Object.assign({}, base, {
      version: prod.version || base.version,
      playerHeightM: prod.playerHeightM || base.playerHeightM || DEFAULT_HEIGHT,
      units: units,
    });
  }

  async function loadTvsCatalog(force) {
    if (global.TvsVoxelAssets && global.TvsVoxelAssets.loadCatalog) {
      return global.TvsVoxelAssets.loadCatalog(force);
    }
    try {
      var res = await fetch(CDN_CATALOG, { mode: "cors" });
      if (!res.ok) throw new Error("catalog " + res.status);
      return res.json();
    } catch (e) {
      return (
        (await fetchJson("/assets/voxels/catalog.json")) ||
        (await fetchJson("assets/voxels/catalog.json"))
      );
    }
  }

  function pickUnit(roster, classHint) {
    var units = (roster && roster.units) || [];
    if (!classHint) return units[0] || null;
    var want = String(classHint).toLowerCase();
    return (
      units.find(function (u) {
        return u.classHint === want;
      }) ||
      units[0] ||
      null
    );
  }

  function unitsByPack(roster, packId) {
    return ((roster && roster.units) || []).filter(function (u) {
      return u.pack === packId;
    });
  }

  function findUnit(roster, unitId) {
    if (!roster || !roster.units) return null;
    var key = String(unitId || "").toLowerCase();
    return (
      roster.units.find(function (u) {
        return (
          u.unitId === unitId ||
          (u.unitId && u.unitId.toLowerCase() === key) ||
          (u.displayName && u.displayName.toLowerCase() === key) ||
          (u.unitId && u.unitId.toLowerCase().endsWith(key))
        );
      }) || null
    );
  }

  var CLASS_HINT_MAP = {
    swordsman: "melee",
    paladin: "melee",
    archer: "ranged",
    mage: "magic",
    necromancer: "magic",
    druid: "civilian",
    farmer: "civilian",
    melee: "melee",
    ranged: "ranged",
    magic: "magic",
    civilian: "civilian",
  };

  function classToHint(classId) {
    return CLASS_HINT_MAP[String(classId || "").toLowerCase()] || "melee";
  }

  var CLASS_UNIT_PREFS = {
    swordsman: ["voxel-knights-champion", "voxel-knights-knight", "voxel-cathedral-crusader"],
    paladin: ["voxel-cathedral-crusader", "voxel-knights-champion", "voxel-palace-guard"],
    archer: ["voxel-rangers-archer", "voxel-knights-archer", "voxel-rangers-long-hair"],
    mage: ["voxel-wizards-wizard", "voxel-wizards-warlock", "voxel-cathedral-priest"],
    necromancer: ["voxel-wizards-warlock", "voxel-wizards-witch", "voxel-wizards-wizard"],
    druid: ["voxel-rangers-hooded", "voxel-farm-farmer", "voxel-village-herbalist"],
  };

  function pickBestUnit(roster, classId) {
    var prefs = CLASS_UNIT_PREFS[String(classId || "").toLowerCase()] || [];
    for (var i = 0; i < prefs.length; i++) {
      var u = findUnit(roster, prefs[i]);
      if (u) return u;
    }
    return pickUnit(roster, classToHint(classId));
  }

  // ── scale ──────────────────────────────────────────────────────────────────

  /**
   * World AABB for SI measure. Prefer full setFromObject after author-scale
   * collapse — skinned geometry.boundingBox * matrixWorld often separates
   * mesh parts (bind pose vs scaled skeleton) and yields 100× junk.
   */
  function measureBodyBox(object3d, THREE) {
    object3d.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(object3d);
  }

  /**
   * Ground / optional unit-fix only. NEVER stretch production GLBs.
   *
   * Production grudge-convert GLBs are already SI (characters ~1.8–2 m, buildings
   * already baked). Calling height/size.y on those is the forbidden stretch and
   * yields junk like scaleFactor 0.01 + nativeHeight 200.
   *
   * opts.alreadyBaked / userData.productionBaked → feet only, scale untouched.
   * opts.groundOnly → same (buildings/props/env).
   * Raw FBX only: decade unitFix when bbox clearly cm-authored (>40), then
   * optional character targetHeight if opts.allowStretch === true (characters).
   */
  function groundFeetOnly(object3d, THREE, opts) {
    if (!object3d || !THREE) return object3d;
    opts = opts || {};
    // Always SI-guard first (Armature scale 100 / giant bbox)
    if (global.TvsProductionPipeline && global.TvsProductionPipeline.ensureSiWorldScale) {
      global.TvsProductionPipeline.ensureSiWorldScale(object3d, {
        targetHeight: opts.targetHeight || object3d.userData.targetHeight,
        fitHeight: opts.fitHeight === true,
        maxDimM: opts.maxDimM != null ? opts.maxDimM : 40,
      });
    } else {
      object3d.updateMatrixWorld(true);
      var boxProbe = new THREE.Box3().setFromObject(object3d);
      var sz = new THREE.Vector3();
      boxProbe.getSize(sz);
      if (Math.max(sz.x, sz.y, sz.z) > 40) {
        object3d.scale.multiplyScalar(0.01);
        object3d.userData.unitFix = (object3d.userData.unitFix || 1) * 0.01;
        object3d.userData.fixedAuthorScale = true;
      }
    }
    object3d.updateMatrixWorld(true);
    // Prefer full world AABB — skinned geometry.boundingBox * scale can be wrong
    var box = new THREE.Box3().setFromObject(object3d);
    var size = new THREE.Vector3();
    box.getSize(size);
    // Sanity: if still absurd, force fit to target / 2 m
    if (Math.max(size.x, size.y, size.z) > 40) {
      var th = opts.targetHeight || object3d.userData.targetHeight || 2;
      var s = th / Math.max(size.y, 1e-6);
      if (s > 0.00001 && s < 1) {
        object3d.scale.multiplyScalar(s);
        object3d.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(object3d);
        box.getSize(size);
        object3d.userData.unitFix = (object3d.userData.unitFix || 1) * s;
      }
    }
    object3d.position.y -= box.min.y;
    object3d.userData.nativeHeight = size.y;
    object3d.userData.scaleFactor = object3d.scale.x;
    if (object3d.userData.unitFix == null) object3d.userData.unitFix = 1;
    object3d.userData.feetGrounded = true;
    object3d.userData.productionBaked = true;
    return object3d;
  }

  function normalizeHeight(object3d, targetHeight, THREE, opts) {
    opts = opts || {};
    if (!object3d || !THREE) return object3d;
    if (targetHeight) object3d.userData.targetHeight = targetHeight;

    // Production GLB / ground-only: SI-guard + feet (may fix scale 100 leftovers)
    if (
      opts.alreadyBaked ||
      opts.groundOnly ||
      object3d.userData.productionBaked ||
      object3d.userData.noStretch
    ) {
      return groundFeetOnly(object3d, THREE, {
        targetHeight: targetHeight,
        // Heroes: allow gentle height fit to 2.0 after decade fix
        fitHeight: opts.fitHeight === true || (!!targetHeight && targetHeight <= 2.5),
        maxDimM: opts.maxDimM,
      });
    }

    // Measured already SI (0.3–50 m): treat as baked, do not unitFix 0.01
    object3d.updateMatrixWorld(true);
    var box0 = measureBodyBox(object3d, THREE);
    var size0 = new THREE.Vector3();
    box0.getSize(size0);
    if (size0.y >= 0.3 && size0.y <= 50) {
      object3d.userData.productionBaked = true;
      if (targetHeight) object3d.userData.targetHeight = targetHeight;
      return groundFeetOnly(object3d, THREE);
    }

    // Raw FBX cm path only
    object3d.scale.set(1, 1, 1);
    object3d.position.set(0, 0, 0);
    object3d.updateMatrixWorld(true);

    var box = measureBodyBox(object3d, THREE);
    var size = new THREE.Vector3();
    box.getSize(size);
    if (!(size.y > 1e-6)) {
      console.warn("[TvsUnitLoader] zero height bbox", object3d.name);
      return object3d;
    }

    var unitFix = 1;
    if (size.y > 40) unitFix = 0.01;
    else if (size.y < 0.05) unitFix = 100;
    if (unitFix !== 1) {
      object3d.scale.setScalar(unitFix);
      object3d.updateMatrixWorld(true);
      box = measureBodyBox(object3d, THREE);
      box.getSize(size);
    }

    // Characters only: optional height match after unitFix (allowStretch)
    if (opts.allowStretch && targetHeight && size.y > 1e-6) {
      var s = targetHeight / size.y;
      // Reject insane stretch (the 0.01 × 100× failure mode)
      if (s > 0.2 && s < 5) {
        object3d.scale.multiplyScalar(s);
        object3d.updateMatrixWorld(true);
        box = measureBodyBox(object3d, THREE);
        box.getSize(size);
      } else {
        console.warn(
          "[TvsUnitLoader] skip stretch s=" + s + " nativeH=" + size.y + " — ground only"
        );
      }
    }

    object3d.updateMatrixWorld(true);
    var box2 = measureBodyBox(object3d, THREE);
    object3d.position.y -= box2.min.y;
    var size2 = new THREE.Vector3();
    box2.getSize(size2);
    object3d.userData.nativeHeight = size2.y / (unitFix || 1);
    object3d.userData.measuredAfterUnitFix = size2.y;
    object3d.userData.targetHeight = targetHeight || size2.y;
    object3d.userData.scaleFactor = object3d.scale.x;
    object3d.userData.unitFix = unitFix;
    object3d.userData.feetGrounded = true;
    return object3d;
  }

  /** Prep embedded GLB maps for voxel strip atlases (often 256×1). */
  function prepEmbeddedTextures(root, THREE) {
    root.traverse(function (ch) {
      if (!ch.isMesh && !ch.isSkinnedMesh) return;
      var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      mats.forEach(function (m) {
        if (!m) return;
        if (m.map) {
          m.map.magFilter = THREE.NearestFilter;
          m.map.minFilter = THREE.NearestFilter;
          m.map.generateMipmaps = false;
          m.map.wrapS = THREE.ClampToEdgeWrapping;
          m.map.wrapT = THREE.ClampToEdgeWrapping;
          // Baked GLB usually has correct flipY; do not force false if already set by loader
          if ("colorSpace" in m.map && THREE.SRGBColorSpace != null) {
            m.map.colorSpace = THREE.SRGBColorSpace;
          } else if (THREE.sRGBEncoding != null) {
            m.map.encoding = THREE.sRGBEncoding;
          }
          m.map.needsUpdate = true;
        }
        if ("metalness" in m) m.metalness = 0;
        if ("roughness" in m) m.roughness = Math.max(m.roughness || 0, 0.8);
        if ("flatShading" in m) m.flatShading = true;
        if (m.color && m.color.getHex() === 0x000000 && m.map) m.color.setHex(0xffffff);
        m.needsUpdate = true;
      });
      ch.castShadow = true;
      ch.receiveShadow = true;
      if (ch.isSkinnedMesh) ch.frustumCulled = false;
    });
  }

  function hasUsableMap(root) {
    if (global.TvsVoxelColors && global.TvsVoxelColors.hasUsableMap) {
      return global.TvsVoxelColors.hasUsableMap(root);
    }
    var ok = false;
    root.traverse(function (ch) {
      if ((!ch.isMesh && !ch.isSkinnedMesh) || !ch.material) return;
      var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      mats.forEach(function (m) {
        if (!m || !m.map) return;
        var img = m.map.image;
        if (img && (img.width || img.naturalWidth || img.data)) ok = true;
        else if (m.map.source && m.map.source.data) ok = true;
      });
    });
    return ok;
  }

  async function headOk(url) {
    if (!url) return false;
    try {
      var r = await fetch(url, { method: "HEAD", mode: "cors" });
      if (r.ok) return true;
      var g = await fetch(url, { method: "GET", headers: { Range: "bytes=0-15" }, mode: "cors" });
      return g.ok || g.status === 206;
    } catch (e) {
      return false;
    }
  }

  /** Candidate GLB URLs: CDN production → same-origin Vercel mirror. */
  function glbCandidates(unit) {
    var list = [];
    var seen = {};
    function push(u) {
      u = absCdnUrl(u) || u;
      if (!u || seen[u]) return;
      seen[u] = 1;
      list.push(u);
    }
    push(unit.glbUrl);
    push(glbUrlFromModel(unit.modelUrl));
    // Same-origin mirror shipped with Vercel (models/voxels/tvs/…)
    if (unit.pack && unit.unitId) {
      push("/models/voxels/tvs/" + unit.pack + "/characters/" + unit.unitId + ".glb");
      push("models/voxels/tvs/" + unit.pack + "/characters/" + unit.unitId + ".glb");
    }
    return list;
  }

  async function loadGlbFromUrl(THREE, url, opts) {
    opts = opts || {};
    // All production TVS GLBs are Meshopt — wait before parse
    if (global.TvsProductionPipeline && global.TvsProductionPipeline.ensureMeshoptReady) {
      try {
        await global.TvsProductionPipeline.ensureMeshoptReady();
      } catch (eMesh) {
        console.warn("[TvsUnitLoader] meshopt", eMesh && eMesh.message);
      }
    }
    // Prefer pipeline path (fetch + parse + materials)
    if (
      global.TvsProductionPipeline &&
      global.TvsProductionPipeline.loadProductionGlb &&
      opts.usePipeline !== false
    ) {
      try {
        var pipeRoot = await global.TvsProductionPipeline.loadProductionGlb(url, {
          voxel: true,
          // Unit loader finalizeGameDelivery owns SI/ground once — raw avoids double collapse
          raw: opts.raw === true || opts.ground === false,
          ground: opts.ground !== false && opts.raw !== true,
          // Heroes: kill scale-100 + fit ~2 m; anim carriers pass ground:false
          targetHeight: opts.targetHeight != null ? opts.targetHeight : 2.0,
          fitHeight: opts.ground !== false && opts.fitHeight !== false && opts.raw !== true,
          maxDimM: opts.maxDimM != null ? opts.maxDimM : 12,
        });
        // Mimic gltf shape for callers that expect .scene
        return {
          scene: pipeRoot,
          scenes: [pipeRoot],
          animations: pipeRoot.userData.gltfAnimations || [],
        };
      } catch (ePipe) {
        console.warn("[TvsUnitLoader] pipeline GLB fail, fallback", url, ePipe && ePipe.message);
      }
    }
    var loader = null;
    if (global.TvsProductionPipeline && global.TvsProductionPipeline.getGltfLoader) {
      try {
        loader = global.TvsProductionPipeline.getGltfLoader();
      } catch (e0) {}
    }
    if (!loader) {
      var GLTFLoader = opts.GLTFLoader || (THREE && THREE.GLTFLoader) || global.GLTFLoader;
      if (!GLTFLoader) throw new Error("GLTFLoader required for GLB");
      loader = new GLTFLoader();
      if (global.VoxGltfConfigure) {
        try {
          loader = global.VoxGltfConfigure(loader) || loader;
        } catch (e) {}
      } else if (global.VoxGameCanvas && VoxGameCanvas.configureGltfLoader) {
        try {
          loader = VoxGameCanvas.configureGltfLoader(loader) || loader;
        } catch (e) {}
      }
    }
    // Magic-byte verify glTF
    if (opts.verify !== false) {
      var res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("GLB HTTP " + res.status);
      var buf = await res.arrayBuffer();
      var u8 = new Uint8Array(buf);
      var magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
      if (magic !== "glTF") {
        var head = new TextDecoder().decode(u8.slice(0, 32));
        if (head.indexOf("<!DOCTYPE") >= 0 || head.indexOf("<html") >= 0) {
          throw new Error("HTML fake-200 (not GLB): " + url);
        }
        throw new Error("Not glTF/GLB: " + url);
      }
      if (typeof loader.parse === "function") {
        return new Promise(function (resolve, reject) {
          loader.parse(
            buf,
            url.replace(/[^/]+$/, ""),
            function (gltf) {
              resolve(gltf);
            },
            reject
          );
        });
      }
    }
    return new Promise(function (resolve, reject) {
      loader.load(url, resolve, undefined, reject);
    });
  }

  // ── materials / color ──────────────────────────────────────────────────────

  function collectMaterials(root) {
    var mats = [];
    var seen = typeof Set !== "undefined" ? new Set() : null;
    var listSeen = [];
    root.traverse(function (ch) {
      if (!ch.isMesh && !ch.isSkinnedMesh) return;
      ch.castShadow = true;
      ch.receiveShadow = true;
      if (ch.isSkinnedMesh) ch.frustumCulled = false;
      var list = Array.isArray(ch.material) ? ch.material : [ch.material];
      list.forEach(function (m) {
        if (!m) return;
        if (seen) {
          if (seen.has(m)) return;
          seen.add(m);
        } else {
          if (listSeen.indexOf(m) >= 0) return;
          listSeen.push(m);
        }
        mats.push(m);
      });
    });
    return mats;
  }

  /**
   * Rebind atlas as fresh MeshStandardMaterial on every mesh (voxel look).
   * Avoids broken FBX Phong materials without maps.
   */
  function applyTextureToRoot(root, texture, THREE) {
    if (global.TvsVoxelColors && global.TvsVoxelColors.applyAtlasMap) {
      global.TvsVoxelColors.applyAtlasMap(root, texture, { THREE: THREE, flipY: false });
      return root.userData.sharedAtlasMaterial || texture;
    }
    if (global.TvsVoxelColors && global.TvsVoxelColors.prepVoxelTexture) {
      global.TvsVoxelColors.prepVoxelTexture(texture, { THREE: THREE, flipY: false, voxel: true });
    } else {
      prepVoxelTexture(THREE, texture, false);
    }
    var shared = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      metalness: 0,
      roughness: 0.88,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    shared.userData = { _tvsOwned: true, _baseColor: 0xffffff };

    root.traverse(function (ch) {
      if (!ch.isMesh && !ch.isSkinnedMesh) return;
      // Dispose previous tvs-owned materials to avoid leaks on swap
      var prev = Array.isArray(ch.material) ? ch.material : [ch.material];
      prev.forEach(function (m) {
        if (m && m.userData && m.userData._tvsOwned && m !== shared) {
          try {
            m.dispose();
          } catch (e) {}
        }
      });
      ch.material = shared;
      ch.castShadow = true;
      ch.receiveShadow = true;
    });
    return shared;
  }

  function attachColorApi(root, THREE) {
    // Prefer fleet colour SSOT (multiply tint keeps atlas maps readable)
    if (global.TvsVoxelColors && global.TvsVoxelColors.attachColorApi) {
      global.TvsVoxelColors.attachColorApi(root, { THREE: THREE });
      var mats0 = collectMaterials(root);
      root.userData.materials = mats0;
      root.userData.setEmissive = function (hex, intensity) {
        intensity = intensity == null ? 0.25 : intensity;
        var c =
          typeof hex === "number"
            ? hex
            : parseInt(String(hex).replace("#", ""), 16);
        mats0.forEach(function (m) {
          if (m.emissive) {
            m.emissive.setHex(c);
            if ("emissiveIntensity" in m) m.emissiveIntensity = intensity;
          }
        });
        return root;
      };
      return root;
    }

    var mats = collectMaterials(root);
    mats.forEach(function (m) {
      if (!m.userData) m.userData = {};
      if (m.color && m.userData._baseColor == null) {
        m.userData._baseColor = m.color.getHex();
      }
      // Textured: never leave black base (kills strip atlases)
      if (m.map && m.color && m.color.getHex() === 0x000000) {
        m.color.setHex(0xffffff);
        m.userData._baseColor = 0xffffff;
      }
    });

    root.userData.materials = mats;

    root.userData.setColorTint = function (hex) {
      var c = typeof hex === "number" ? hex : parseInt(String(hex).replace("#", ""), 16);
      if (!isFinite(c)) c = 0xffffff;
      var tint = new THREE.Color(c);
      mats.forEach(function (m) {
        if (!m.color) return;
        var baseHex =
          m.userData._baseColor != null
            ? m.userData._baseColor
            : m.map
              ? 0xffffff
              : m.color.getHex();
        var base = new THREE.Color(baseHex);
        // Multiply so maps stay visible
        m.color.setRGB(base.r * tint.r, base.g * tint.g, base.b * tint.b);
      });
      root.userData.colorTint = c;
      return root;
    };

    root.userData.setColorMultiply = function (hex, strength) {
      strength = strength == null ? 1 : strength;
      var tint = new THREE.Color(typeof hex === "number" ? hex : hex);
      mats.forEach(function (m) {
        if (!m.color) return;
        var base = m.userData._baseColor != null ? m.userData._baseColor : 0xffffff;
        var bc = new THREE.Color(base);
        bc.lerp(tint, strength);
        m.color.copy(bc);
      });
      return root;
    };

    root.userData.resetColor = function () {
      mats.forEach(function (m) {
        if (m.color && m.userData._baseColor != null) {
          m.color.setHex(m.userData._baseColor);
        }
      });
      root.userData.colorTint = null;
      return root;
    };

    root.userData.setEmissive = function (hex, intensity) {
      intensity = intensity == null ? 0.25 : intensity;
      mats.forEach(function (m) {
        if (m.emissive) {
          m.emissive.setHex(typeof hex === "number" ? hex : parseInt(String(hex).replace("#", ""), 16));
          if ("emissiveIntensity" in m) m.emissiveIntensity = intensity;
        }
      });
      return root;
    };
  }

  // ── animations ─────────────────────────────────────────────────────────────

  function scoreClipEntry(entry, preferHuman) {
    var id = (entry && (entry.id || entry.semantic || "")) || "";
    var score = 0;
    if (preferHuman && HUMAN_CLIP_RE.test(id)) score += 50;
    if (ANIMAL_CLIP_RE.test(id)) score -= 40;
    // Prefer plain idle over banner/bar variants when picking "idle"
    if (/banner|bar-idle|drawn/i.test(id)) score -= 5;
    if (/idle/i.test(id)) score += 2;
    return score;
  }

  /**
   * Map free-form / author TVS clip ids → semantic roles.
   * Author names from pipeline allClips: human-dig-anim, human-command-anim,
   * human-barter-anim, human-drunk-anim, human-praying-anim, human-mounted-anim, …
   */
  function semanticFromClipName(name) {
    var n = String(name || "").toLowerCase();
    // Work / social / mount (before generic idle so "bar-idle" still → idle)
    if (/dig|harvest|farm|mine|hoe|shovel|pickaxe|work-?anim/.test(n)) return "dig";
    if (/barter|trade|deal|haggle/.test(n)) return "barter";
    if (/drunk|drink|toast|swig/.test(n)) return "drunk";
    if (/pray|praying|kneel|worship/.test(n)) return "pray";
    if (/preach|sermon|bless/.test(n)) return "preach";
    if (/command|order|signal|point(?!er)/.test(n)) return "command";
    if (/mounted|riding(?!-broom)|ride(?!.*broom)/.test(n)) return "mounted";
    if (/broom|riding-broom/.test(n)) return "broom";
    if (/aim|draw.?bow|ready.?bow|bow.?ready/.test(n)) return "aim";
    if (/spell|cast|wand|staff.?spell|magic(?!.?block)/.test(n)) return "cast";
    // Combat / loco
    if (/death|die|dead/.test(n)) return "death";
    if (/hit.?react|hurt|damage|recieve|receive/.test(n)) return "hit";
    if (/defend|block|guard|parry|magic.?block/.test(n)) return "defend";
    if (/attack|slash|strike|swing|punch|shoot|flanchet/.test(n)) return "attack";
    if (/jump|leap/.test(n)) return "jump";
    if (/sit|sitt|seat/.test(n)) return "sit";
    if (/walk|run|locom|move|jog|sprint|charg/.test(n)) return "locomotion";
    if (/idle|stand|wait|breath|ready|banner|bar-idle|drawnidle|normal.?idol/.test(n))
      return "idle";
    return null;
  }

  /**
   * Baked anim packages (load order / preferOrder).
   * locomotion → traversal → equipped weapon → social overlays.
   * maxClips default 20 covers all three core packages + social extras.
   */
  var ANIM_PACKAGES = {
    locomotion: ["idle", "locomotion"],
    traversal: ["jump", "sit", "dig", "mounted", "broom"],
    weapon: ["attack", "defend", "aim", "cast", "command", "hit", "death"],
    social: ["barter", "drunk", "pray", "preach"],
  };

  /** Flatten packages for preferOrder (core three first, then social). */
  var SEMANTIC_ROLES = []
    .concat(ANIM_PACKAGES.locomotion)
    .concat(ANIM_PACKAGES.traversal)
    .concat(ANIM_PACKAGES.weapon)
    .concat(ANIM_PACKAGES.social);

  function resolveClipMap(animsJson, unit) {
    var out = {};
    if (!animsJson) return out;
    var isAnimal =
      unit &&
      (unit.tags || []).some(function (t) {
        return t === "animal" || t === "creature";
      });
    var preferHuman = !isAnimal;

    // Primary map from author clips{}
    var clips = animsJson.clips || {};
    Object.keys(clips).forEach(function (sem) {
      var c = clips[sem];
      if (c && (c.url || c.glbUrl || c.fbxUrl)) {
        out[sem] = Object.assign({}, c, {
          url: absCdnUrl(c.glbUrl || c.url || c.fbxUrl),
          glbUrl: absCdnUrl(c.glbUrl || c.url),
        });
      }
    });

    // Expand allClips → semantic roles (dig, command, barter, pray, …)
    if (animsJson.allClips && animsJson.allClips.length) {
      var bySem = {};
      animsJson.allClips.forEach(function (c) {
        if (!c) return;
        var id = c.id || "";
        // Animals: keep animal clips; humanoids: skip pure animal except mount mounts
        if (preferHuman && ANIMAL_CLIP_RE.test(id) && !/human/i.test(id)) {
          // horse-* only for mounted role if no human-mounted
          if (!/horse|mount/i.test(id)) return;
        }
        var sem =
          semanticFromClipName(id) ||
          (c.semantic && c.semantic !== "other" ? c.semantic : null);
        if (!sem) return;
        // Don't map horse-walk to human locomotion
        if (preferHuman && /horse|cow|pig|sheep|chicken|duck|owl|corgi/i.test(id) && sem !== "mounted") {
          return;
        }
        var entry = Object.assign({}, c, {
          url: absCdnUrl(c.glbUrl || c.url || c.fbxUrl),
          glbUrl: absCdnUrl(c.glbUrl || c.url),
        });
        if (!bySem[sem]) bySem[sem] = [];
        bySem[sem].push(entry);
      });
      SEMANTIC_ROLES.forEach(function (sem) {
        var list = bySem[sem] || [];
        if (!list.length) return;
        list.sort(function (a, b) {
          return scoreClipEntry(b, preferHuman) - scoreClipEntry(a, preferHuman);
        });
        var best = list[0];
        var cur = out[sem];
        if (!cur || scoreClipEntry(best, preferHuman) > scoreClipEntry(cur, preferHuman)) {
          out[sem] = best;
        }
      });
    }

    // Direct id: keys for admin / playClip("human-dig-anim") — not auto-loaded
    if (animsJson.allClips) {
      animsJson.allClips.forEach(function (c) {
        if (c && c.id && (c.url || c.glbUrl)) {
          out["id:" + c.id] = Object.assign({}, c, {
            url: absCdnUrl(c.glbUrl || c.url),
            glbUrl: absCdnUrl(c.glbUrl || c.url),
          });
        }
      });
    }
    return out;
  }

  /** Collect bone/node names under root for track filtering. */
  function collectBoneNames(root) {
    var names = {};
    root.traverse(function (o) {
      if (o.name) names[o.name] = true;
      // Three r128 skinned meshes store skeleton.bones
      if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones) {
        o.skeleton.bones.forEach(function (b) {
          if (b && b.name) names[b.name] = true;
        });
      }
    });
    return names;
  }

  /**
   * Keep only tracks that target nodes present on the loaded skeleton.
   * Drops foreign Mixamo/Human tracks that would spam console warnings.
   *
   * Track names: "BoneName.quaternion" — bone may itself contain dots
   * (TVS: "Bicep.Right", "Hip.Left"). Must split on the LAST property suffix only.
   */
  function boneNameFromTrack(trackName) {
    var n = String(trackName || "");
    // Three: "Bone.quaternion" | "Bone.position" | "Bone.scale"
    // Also: "mixamorig:Hips.quaternion" / "Armature|Bone.quaternion"
    var lastDot = n.lastIndexOf(".");
    if (lastDot <= 0) return n;
    var prop = n.slice(lastDot + 1).toLowerCase();
    if (
      prop === "quaternion" ||
      prop === "position" ||
      prop === "scale" ||
      prop === "rotation" ||
      prop === "matrix" ||
      prop === "weights"
    ) {
      return n.slice(0, lastDot);
    }
    // Fallback: strip trailing property after last dot
    return n.slice(0, lastDot);
  }

  /**
   * Keep / rematch tracks onto TVS pack bones (Base, Torso, Bicep.Right, …).
   * Rewrites "Armature|Bone.quaternion" → "Bone.quaternion" when needed.
   * Does NOT invent Mixamo tracks — only author pack clips on this skeleton.
   */
  function filterClipToSkeleton(clip, boneNames, THREE) {
    if (!clip || !clip.tracks || !clip.tracks.length) return clip;
    var kept = [];
    for (var i = 0; i < clip.tracks.length; i++) {
      var t = clip.tracks[i];
      var trackName = String(t.name || "");
      var bone = boneNameFromTrack(trackName);
      var bare = bone.indexOf("|") >= 0 ? bone.split("|").pop() : bone;
      // strip leading "Armature." if present
      if (bare.indexOf("Armature.") === 0) bare = bare.slice(9);
      var prop = "";
      var lastDot = trackName.lastIndexOf(".");
      if (lastDot > 0) prop = trackName.slice(lastDot); // ".quaternion" etc
      var target = null;
      if (boneNames[bone]) target = bone;
      else if (boneNames[bare]) target = bare;
      if (!target) continue;
      // Rematch track name to actual skeleton bone so mixer binds
      if (target + prop !== trackName && prop) {
        try {
          t.name = target + prop;
        } catch (eRename) {
          /* immutable track — keep original if bone matched loosely */
        }
      }
      kept.push(t);
    }
    if (!kept.length) return null;
    if (kept.length === clip.tracks.length) return clip;
    var next = clip.clone();
    next.tracks = kept;
    return next;
  }

  /** Load animations from a sidecar GLB (preferred) or FBX pack entry. */
  async function loadAnimClipsFromUrl(url, FBXLoader, THREE, opts) {
    opts = opts || {};
    if (!url) return [];
    var u = String(url);
    // Prefer glbUrl sibling when entry only had fbx
    if (/\.fbx($|\?)/i.test(u) && opts.preferGlb !== false) {
      var glbTry = u.replace(/\.fbx($|\?)/i, ".glb$1");
      try {
        var g0 = await loadGlbFromUrl(THREE, glbTry, {
          verify: opts.verify !== false,
          GLTFLoader: opts.GLTFLoader,
          ground: false,
          usePipeline: false,
        });
        if (g0 && g0.animations && g0.animations.length) return g0.animations;
      } catch (eGlb) {
        /* fall through to original */
      }
    }
    if (/\.glb($|\?)/i.test(u) || /\.gltf($|\?)/i.test(u)) {
      var g = await loadGlbFromUrl(THREE, u, {
        verify: opts.verify !== false,
        GLTFLoader: opts.GLTFLoader,
        // Anim packs are armature-only — never ground/stretch the clip carrier
        ground: false,
        usePipeline: false,
      });
      return (g && g.animations) || [];
    }
    if (!FBXLoader) return [];
    var animRoot = await loadFbxFromUrl(FBXLoader, u, {
      verify: opts.verify !== false,
    });
    return (animRoot && animRoot.animations) || [];
  }

  async function loadAndBindAnims(root, clipMap, FBXLoader, THREE, opts) {
    opts = opts || {};
    var mixer = new THREE.AnimationMixer(root);
    var actions = {};
    var clips = {};
    var boneNames = collectBoneNames(root);
    var keys = Object.keys(clipMap || {}).filter(function (k) {
      return k.indexOf("id:") !== 0;
    });
    // Packages: locomotion → traversal → weapon → social (dig, command, barter, …)
    var preferOrder = SEMANTIC_ROLES.slice();
    // Optional: restrict to named packages (e.g. opts.animPackages: ["locomotion","weapon"])
    if (opts.animPackages && opts.animPackages.length) {
      preferOrder = [];
      opts.animPackages.forEach(function (pkg) {
        var list = ANIM_PACKAGES[pkg];
        if (list) preferOrder = preferOrder.concat(list);
      });
    }
    keys.sort(function (a, b) {
      var ia = preferOrder.indexOf(a);
      var ib = preferOrder.indexOf(b);
      if (ia < 0) ia = 99;
      if (ib < 0) ib = 99;
      return ia - ib;
    });
    // Production default: 20 — enough for locomotion + traversal + equipped weapon packs
    var maxLoad = opts.maxClips != null ? opts.maxClips : 20;
    var loadKeys = keys.slice(0, maxLoad);

    // 1) Embedded GLB clips first (same skeleton — preferred)
    var embedded = root.animations || [];
    embedded.forEach(function (clip, i) {
      var rawName = clip.name || "embedded-" + i;
      var filtered = filterClipToSkeleton(clip, boneNames, THREE) || clip;
      var sem = semanticFromClipName(rawName) || rawName;
      if (!clips[sem]) {
        var c = filtered.clone();
        c.name = sem;
        clips[sem] = c;
        actions[sem] = mixer.clipAction(c);
      }
      if (!clips[rawName]) {
        clips[rawName] = filtered;
        actions[rawName] = mixer.clipAction(filtered);
      }
    });

    // 2) External pack — production clips are GLB (grudge-convert); FBX fallback
    if (loadKeys.length) {
      await Promise.all(
        loadKeys.map(async function (sem) {
          if (actions[sem]) return; // already have embedded
          var entry = clipMap[sem];
          if (!entry) return;
          var url = entry.glbUrl || entry.url || entry.fbxUrl;
          if (!url) return;
          try {
            var list = await loadAnimClipsFromUrl(url, FBXLoader, THREE, opts);
            if (!list.length) return;
            // Prefer clip whose tracks match skeleton; try all if first fails filter
            var clip = null;
            for (var ci = 0; ci < list.length; ci++) {
              clip = filterClipToSkeleton(list[ci].clone(), boneNames, THREE);
              if (clip) break;
            }
            if (!clip) {
              // Rematch full clip once more (pack is same TVS humanoid rig)
              clip = filterClipToSkeleton(list[0].clone(), boneNames, THREE);
              if (!clip) {
                console.warn(
                  "[TvsUnitLoader] pack clip has no tracks for this skeleton",
                  sem,
                  "bones",
                  Object.keys(boneNames).length
                );
                return;
              }
            }
            clip.name = sem;
            clips[sem] = clip;
            var action = mixer.clipAction(clip);
            action.enabled = true;
            actions[sem] = action;
          } catch (err) {
            console.warn("[TvsUnitLoader] anim fail", sem, url, err && err.message);
          }
        })
      );
    }

    var current = null;

    var ONESHOT_RE =
      /^(attack|dig|command|barter|drunk|pray|preach|cast|jump|hit|death|slash|aim)$/i;

    function playClip(name, fade) {
      fade = fade == null ? 0.15 : fade;
      var action = actions[name];
      if (!action) {
        // resolve semantic alias or substring
        var want = semanticFromClipName(name) || name;
        action = actions[want];
      }
      if (!action) {
        var k = Object.keys(actions).find(function (n) {
          return n.toLowerCase().indexOf(String(name).toLowerCase()) >= 0;
        });
        action = k ? actions[k] : actions.idle || actions.locomotion || Object.values(actions)[0];
      }
      if (!action) return null;
      if (current && current !== action) {
        current.fadeOut(fade);
      }
      var oneShot = ONESHOT_RE.test(String(name));
      if (THREE.LoopOnce != null) {
        action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
        action.clampWhenFinished = !!oneShot;
      }
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
      current = action;
      root.userData.currentAnim = name;
      // Combat SFX on one-shots (CSE mattflat pack when TvsCseSfx is loaded)
      if (oneShot && global.TvsCseSfx && typeof global.TvsCseSfx.playForAnim === "function") {
        try {
          global.TvsCseSfx.playForAnim(name);
        } catch (eSfx) {
          /* non-fatal */
        }
      }
      return action;
    }

    function updateMixer(dt) {
      if (mixer) mixer.update(dt);
    }

    /** List loaded semantic roles for UI / AI. */
    function listAnims() {
      return Object.keys(actions).filter(function (k) {
        return k.indexOf("id:") !== 0;
      });
    }

    root.userData.mixer = mixer;
    root.userData.animActions = actions;
    root.userData.animClips = clips;
    root.userData.playClip = playClip;
    root.userData.updateMixer = updateMixer;
    root.userData.listAnims = listAnims;
    root.userData.clipMap = clipMap;
    root.userData.skeletonBones = Object.keys(boneNames).length;
    root.userData.semanticRoles = listAnims();

    // Hand / grip bones for weapon & tool placement (AI + equip)
    installHandAttachmentApi(root, THREE);

    if (actions.idle) playClip("idle", 0);
    else if (actions.locomotion) playClip("locomotion", 0);

    return { mixer: mixer, actions: actions, playClip: playClip, listAnims: listAnims };
  }

  /**
   * Find hand / weapon bones on TVS humanoid kits (Bicep.Right, Hand.Right, …)
   * and expose attachProp / detachProp for tools & weapons.
   */
  function installHandAttachmentApi(root, THREE) {
    if (!root || !THREE) return;

    function findBone(predicates) {
      var found = null;
      root.traverse(function (o) {
        if (found || !o.name) return;
        var n = String(o.name);
        for (var i = 0; i < predicates.length; i++) {
          if (predicates[i].test(n)) {
            found = o;
            return;
          }
        }
      });
      return found;
    }

    var rightHand =
      findBone([
        /hand\.?right/i,
        /right\.?hand/i,
        /hand_r\b/i,
        /\br_hand\b/i,
        /weapon\.?right/i,
        /hold\.?right/i,
      ]) ||
      findBone([/bicep\.?right/i, /forearm\.?right/i, /arm\.?right/i]);
    var leftHand =
      findBone([
        /hand\.?left/i,
        /left\.?hand/i,
        /hand_l\b/i,
        /\bl_hand\b/i,
        /weapon\.?left/i,
      ]) || findBone([/bicep\.?left/i, /forearm\.?left/i]);

    root.userData.handBones = {
      right: rightHand ? rightHand.name : null,
      left: leftHand ? leftHand.name : null,
    };
    root.userData._handAttachments = root.userData._handAttachments || {};

    /**
     * Attach a weapon/tool Object3D to a hand bone.
     * opts: { hand: "right"|"left", pos, rot, scale, grip }
     */
    root.userData.attachProp = function (obj, opts) {
      opts = opts || {};
      if (!obj) return false;
      var hand = String(opts.hand || "right").toLowerCase();
      var bone = hand === "left" ? leftHand : rightHand;
      if (!bone) {
        console.warn("[TvsUnitLoader] no hand bone for", hand, root.userData.handBones);
        return false;
      }
      var key = opts.slot || hand;
      var prev = root.userData._handAttachments[key];
      if (prev && prev.parent) prev.parent.remove(prev);
      bone.add(obj);
      if (opts.pos) obj.position.set(opts.pos.x || 0, opts.pos.y || 0, opts.pos.z || 0);
      else obj.position.set(0, 0, 0);
      if (opts.rot) {
        obj.rotation.set(
          opts.rot.x || 0,
          opts.rot.y || 0,
          opts.rot.z || 0
        );
      }
      if (opts.scale != null) {
        var s = typeof opts.scale === "number" ? opts.scale : 1;
        obj.scale.setScalar(s);
      }
      // SI grip default: small offset along bone +Y for TVS props
      if (opts.grip === true) {
        obj.position.y += 0.05;
        obj.rotation.x = opts.rot && opts.rot.x != null ? opts.rot.x : -Math.PI / 2;
      }
      root.userData._handAttachments[key] = obj;
      obj.userData.attachedTo = bone.name;
      obj.userData.attachSlot = key;
      return true;
    };

    root.userData.detachProp = function (slot) {
      slot = slot || "right";
      var prev = root.userData._handAttachments[slot];
      if (prev && prev.parent) prev.parent.remove(prev);
      delete root.userData._handAttachments[slot];
      return !!prev;
    };
  }

  // ── main load ──────────────────────────────────────────────────────────────

  async function loadTvsUnit(unitIn, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    var FBXLoader = opts.FBXLoader || (THREE && THREE.FBXLoader) || global.FBXLoader;
    if (!THREE) throw new Error("THREE required");

    var unit = normalizeUnit(unitIn);
    if (!unit || (!unit.modelUrl && !unit.glbUrl)) {
      throw new Error("unit.modelUrl/glbUrl required (got " + (unitIn && unitIn.unitId) + ")");
    }

    var height = opts.height != null ? opts.height : DEFAULT_HEIGHT;
    var group = null;
    var format = "fbx";
    var sourceUrl = unit.modelUrl;

    // ── Prefer production GLB (converted + compressed, height baked 2.0m) ───
    var preferGlb = opts.preferGlb !== false;
    if (preferGlb) {
      var glbList = glbCandidates(unit);
      for (var gi = 0; gi < glbList.length && !group; gi++) {
        var gUrl = glbList[gi];
        var exists = opts.skipGlbProbe ? true : await headOk(gUrl);
        if (!exists) continue;
        try {
          var gltf = await loadGlbFromUrl(THREE, gUrl, {
            verify: opts.verify !== false,
            GLTFLoader: opts.GLTFLoader,
            // Caller (this function) runs finalizeGameDelivery once
            raw: true,
            ground: false,
          });
          group = gltf.scene || gltf.scenes[0];
          if (gltf.animations && gltf.animations.length) {
            group.animations = gltf.animations;
          }
          format = "glb";
          sourceUrl = gUrl;
          group.userData.productionBaked = true;
        } catch (glbErr) {
          console.warn("[TvsUnitLoader] GLB candidate fail", gUrl, glbErr && glbErr.message);
          group = null;
        }
      }
    }

    if (!group) {
      if (!FBXLoader) throw new Error("FBXLoader required (GLB unavailable)");
      group = await loadFbxFromUrl(FBXLoader, unit.modelUrl, { verify: opts.verify !== false });
      format = "fbx";
      sourceUrl = unit.modelUrl;
    }

    group.userData.tvsUnit = unit;
    group.userData.grudgeUuid = unit.grudgeUuid;
    group.userData.assetSource = "tvs-voxel";
    group.userData.assetFormat = format;
    group.userData.sourceUrl = sourceUrl;
    group.userData.r2Key = String(sourceUrl).replace(CDN + "/", "");
    group.userData.d1 = {
      grudgeUuid: unit.grudgeUuid,
      unitId: unit.unitId,
      pack: unit.pack,
      classHint: unit.classHint,
      modelUrl: unit.modelUrl,
      glbUrl: unit.glbUrl,
      textureUrl: unit.textureUrl,
      animationPackUrl: unit.animationPackUrl,
      colliderUrl: unit.colliderUrl,
      brainUrl: unit.brainUrl,
    };
    group.name = unit.unitId || unit.displayName || "tvs-unit";

    // ── Textures ────────────────────────────────────────────────────────────
    // GLB: prefer embedded atlas (already compressed); rebind only if missing.
    // FBX: always rebind external 256×1 strip (NearestFilter).
    if (format === "glb") {
      // Prefer shared pipeline materials (keeps embeds, voxel Nearest, sRGB)
      if (global.TvsProductionPipeline && global.TvsProductionPipeline.prepMeshMaterials) {
        global.TvsProductionPipeline.prepMeshMaterials(group, { voxel: true });
      } else {
        prepEmbeddedTextures(group, THREE);
      }
      if (opts.withTexture !== false && !hasUsableMap(group) && (unit.textureUrl || TEXTURE_ALIASES[unit.unitId])) {
        try {
          var loadedGlb = await loadTextureWithFallbacks(THREE, unit);
          applyTextureToRoot(group, loadedGlb.tex, THREE);
          group.userData.texture = loadedGlb.tex;
          group.userData.textureUrl = loadedGlb.url;
          group.userData.textureFlipY = loadedGlb.flipY;
        } catch (err) {
          console.warn("[TvsUnitLoader] GLB texture rebind fail", err && err.message);
        }
      }
    } else if (opts.withTexture !== false && (unit.textureUrl || TEXTURE_ALIASES[unit.unitId])) {
      try {
        var loaded = await loadTextureWithFallbacks(THREE, unit);
        applyTextureToRoot(group, loaded.tex, THREE);
        group.userData.texture = loaded.tex;
        group.userData.textureUrl = loaded.url;
        group.userData.textureFlipY = loaded.flipY;
        if (loaded.url !== unit.textureUrl) {
          console.info("[TvsUnitLoader] texture fallback", unit.unitId, "→", loaded.url);
        }
      } catch (err) {
        console.warn("[TvsUnitLoader] texture fail", unit.unitId, unit.textureUrl, err && err.message);
      }
    }

    // Characters: 2.0 m yardstick · uniform grow · face +Z · feet ground (game delivery)
    group.userData.category = "character";
    group.userData.categoryLabel = "Characters";
    group.userData.fitAxis = "y";
    group.userData.relativeToCharacter = 1;
    group.userData.characterHeightM = DEFAULT_HEIGHT;
    group.userData.gameUsage = "Playable / NPC humanoids — feet ground, ~2 m tall, forward +Z";
    var faceOpts = {
      targetHeight: height,
      targetM: height,
      fitHeight: true,
      fitAxis: "y",
      maxDimM: 12,
      category: "character",
      relativeToCharacter: 1,
      isCharacter: true,
      yawOffset: opts.yawOffset,
      faceMinusZ: opts.faceMinusZ === true,
      yawDeg: opts.yawDeg,
      centerXZ: opts.centerXZ,
      keepXZ: opts.keepXZ,
    };
    if (
      global.TvsProductionPipeline &&
      global.TvsProductionPipeline.finalizeGameDelivery
    ) {
      group.userData.productionBaked = format === "glb";
      global.TvsProductionPipeline.finalizeGameDelivery(group, faceOpts);
    } else if (format === "glb") {
      group.userData.productionBaked = true;
      normalizeHeight(group, height, THREE, {
        alreadyBaked: true,
        groundOnly: true,
        fitHeight: true,
        maxDimM: 12,
      });
    } else {
      normalizeHeight(group, height, THREE, {
        allowStretch: opts.allowStretch !== false,
        fitHeight: true,
      });
    }
    // Colour SSOT: white base with maps, tint API, Nearest voxel filters
    if (global.TvsVoxelColors) {
      if (global.TvsVoxelColors.ensureReadableAlbedo) {
        global.TvsVoxelColors.ensureReadableAlbedo(group, { THREE: THREE });
      }
      if (global.TvsVoxelColors.attachColorApi) {
        global.TvsVoxelColors.attachColorApi(group, { THREE: THREE });
      } else {
        attachColorApi(group, THREE);
      }
    } else {
      attachColorApi(group, THREE);
    }
    group.userData.hasTexture = hasUsableMap(group);
    if (opts.colorTint != null && group.userData.setColorTint) {
      group.userData.setColorTint(opts.colorTint);
    }

    // Sidecars from CDN/database: collider · anim pack · AI brain (default ON)
    var wantBrain = opts.withBrain !== false;
    var wantAnims = opts.withAnims !== false;
    if (opts.loadSidecars !== false) {
      var collider = unit.colliderUrl ? await fetchJson(unit.colliderUrl) : null;
      var animsJson = unit.animationPackUrl ? await fetchJson(unit.animationPackUrl) : null;
      var brain = null;
      if (wantBrain && unit.brainUrl) {
        try {
          brain = await fetchJson(unit.brainUrl);
        } catch (brainErr) {
          console.warn("[TvsUnitLoader] brain fetch fail", unit.brainUrl, brainErr && brainErr.message);
        }
      }

      group.userData.collider = collider;
      group.userData.animationPack = animsJson;
      group.userData.brain = brain;

      // Physics descriptor for Rapier/Cannon (from baked collider.json)
      if (global.TvsNpcPrefabs && global.TvsNpcPrefabs.physicsFromCollider) {
        group.userData.physics = global.TvsNpcPrefabs.physicsFromCollider(collider, {
          friendly: opts.team !== "enemy",
          layer: opts.team === "enemy" ? "hostile" : "character",
        });
        group.userData.physicsReady = true;
      } else if (collider && collider.rootCollider) {
        var rc = collider.rootCollider;
        var cap = rc.capsule || {};
        group.userData.physics = {
          type: rc.type || "capsule",
          align: cap.align || "Y",
          radius: Math.min(cap.radius != null ? cap.radius : 0.35, 0.55),
          height: Math.min(Math.max(cap.height != null ? cap.height : 1.3, 0.5), 2.0),
          center: rc.center || [0, 1, 0],
          bodyType: "kinematicPosition",
          layer: "character",
          source: "collider.json",
        };
        group.userData.physicsReady = true;
      }

      if (collider && opts.debugColliders) {
        var phys = group.userData.physics;
        var rootC =
          collider.rootCollider ||
          (collider.colliders || []).find(function (c) {
            return c.name === "character_root" || c.type === "capsule";
          });
        if (phys && THREE.CapsuleGeometry) {
          var geo = new THREE.CapsuleGeometry(phys.radius || 0.32, phys.height || 1.0, 4, 8);
          var mat = new THREE.MeshBasicMaterial({
            color: 0x3dd6c6,
            wireframe: true,
            transparent: true,
            opacity: 0.35,
          });
          var mesh = new THREE.Mesh(geo, mat);
          mesh.position.fromArray(phys.center || [0, 0.85, 0]);
          mesh.name = "tvs-collider-debug";
          group.add(mesh);
        } else if (rootC && rootC.type === "capsule" && THREE.CapsuleGeometry) {
          var cap0 = rootC.capsule || rootC;
          var geo2 = new THREE.CapsuleGeometry(cap0.radius || 0.32, cap0.height || 1.0, 4, 8);
          var mat2 = new THREE.MeshBasicMaterial({
            color: 0x3dd6c6,
            wireframe: true,
            transparent: true,
            opacity: 0.35,
          });
          var mesh2 = new THREE.Mesh(geo2, mat2);
          mesh2.position.fromArray(rootC.center || [0, 0.85, 0]);
          mesh2.name = "tvs-collider-debug";
          group.add(mesh2);
        }
      }

      if (wantAnims && animsJson) {
        var clipMap = resolveClipMap(animsJson, unit);
        await loadAndBindAnims(group, clipMap, FBXLoader, THREE, opts);
      } else if (group.animations && group.animations.length) {
        group.userData.mixer = new THREE.AnimationMixer(group);
        group.userData.playClip = function (nameOrIndex) {
          var clist = group.animations;
          var clip =
            typeof nameOrIndex === "number"
              ? clist[nameOrIndex]
              : clist.find(function (c) {
                  return c.name.toLowerCase().indexOf(String(nameOrIndex).toLowerCase()) >= 0;
                });
          if (!clip) clip = clist[0];
          if (!clip) return null;
          return group.userData.mixer.clipAction(clip).reset().fadeIn(0.15).play();
        };
      }

      // AI strategy agent from database brain JSON
      if (brain) {
        if (global.TvsAiBrain && global.TvsAiBrain.createAgent) {
          group.userData.aiAgent = global.TvsAiBrain.createAgent(brain, {
            unitId: unit.unitId,
            team: opts.team || "a",
            home: opts.home || { x: 0, z: 0 },
          });
          group.userData.brainMerged =
            group.userData.aiAgent.brain || global.TvsAiBrain.mergeBrain(brain);
          group.userData.voxBehavior =
            global.TvsAiBrain.toVoxBehavior(group.userData.brainMerged);
        } else {
          group.userData.brainMerged = brain;
          console.warn("[TvsUnitLoader] TvsAiBrain missing — brain JSON loaded, no agent");
        }
      }
    }

    group.userData.setTextureUrl = async function (url) {
      var t = await loadTexture(THREE, absCdnUrl(url) || url);
      applyTextureToRoot(group, t, THREE);
      group.userData.texture = t;
      group.userData.textureUrl = url;
      attachColorApi(group, THREE);
      return group;
    };

    // Consistency report for debugging #hero / showcase
    var animKeys = group.userData.animActions
      ? Object.keys(group.userData.animActions)
      : [];
    group.userData.importReport = {
      unitId: unit.unitId,
      format: format,
      sourceUrl: sourceUrl,
      glbUrl: unit.glbUrl,
      modelUrl: unit.modelUrl,
      textureUrl: group.userData.textureUrl || unit.textureUrl,
      brainUrl: unit.brainUrl,
      animationPackUrl: unit.animationPackUrl,
      colliderUrl: unit.colliderUrl,
      grudgeUuid: unit.grudgeUuid,
      classHint: unit.classHint,
      height: group.userData.targetHeight,
      measuredHeight: group.userData.measuredAfterUnitFix || group.userData.nativeHeight,
      scale: group.userData.scaleFactor,
      unitFix: group.userData.unitFix,
      productionBaked: !!group.userData.productionBaked,
      hasTexture: !!group.userData.texture || hasUsableMap(group),
      hasMixer: !!group.userData.mixer,
      animClips: animKeys,
      hasBrain: !!group.userData.brain,
      hasAiAgent: !!group.userData.aiAgent,
      strategy: group.userData.brainMerged
        ? {
            id: group.userData.brainMerged.id,
            archetype: group.userData.brainMerged.archetype,
            goals: (group.userData.brainMerged.goals || []).map(function (g) {
              return g.id + "→" + g.action;
            }),
            voxBehavior: group.userData.voxBehavior || null,
          }
        : null,
      compressed: format === "glb",
      source: "cdn-roster",
    };
    console.info("[TvsUnitLoader] loaded", group.userData.importReport);

    return group;
  }

  async function loadArmySample(opts) {
    opts = opts || {};
    // Army always pulls CDN roster + brain + anims unless caller disables
    if (opts.withBrain === undefined) opts.withBrain = true;
    if (opts.withAnims === undefined) opts.withAnims = true;
    if (opts.loadSidecars === undefined) opts.loadSidecars = true;
    var roster = await loadTvsRoster();
    var picks = ["melee", "ranged", "magic", "civilian"]
      .map(function (c) {
        return pickUnit(roster, c);
      })
      .filter(Boolean);
    var roots = [];
    // Compact shoulder gap (SI meters). Width from post-SI AABB — never fixed 100× stride.
    var gap = 0.4;
    var cursor = 0;
    for (var i = 0; i < picks.length; i++) {
      var root = await loadTvsUnit(
        picks[i],
        Object.assign({}, opts, {
          home: { x: 0, z: 0 },
          team: opts.team || "a",
        })
      );
      // Placement after SI: measured width so characters stand shoulder-to-shoulder
      root.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(root);
      var size = new THREE.Vector3();
      box.getSize(size);
      // Clamp absurd widths from pre-fix explode (should not happen after pipeline)
      var bodyW = size.x;
      if (!(bodyW > 0.1) || bodyW > 4) bodyW = 0.9;
      var halfW = Math.max(0.3, bodyW * 0.5);
      if (i === 0) cursor = halfW;
      else cursor += halfW + gap;
      root.position.x = cursor;
      root.position.z = 0;
      roots.push(root);
      cursor += halfW;
    }
    // Center the line on x=0
    if (roots.length) {
      var mid = cursor * 0.5;
      roots.forEach(function (r) {
        r.position.x -= mid;
      });
    }
    return { roster: roster, units: picks, roots: roots };
  }

  var api = {
    CDN: CDN,
    CDN_ROSTER: CDN_ROSTER,
    DEFAULT_HEIGHT: DEFAULT_HEIGHT,
    CLASS_HINT_MAP: CLASS_HINT_MAP,
    CLASS_UNIT_PREFS: CLASS_UNIT_PREFS,
    absCdnUrl: absCdnUrl,
    glbUrlFromModel: glbUrlFromModel,
    normalizeUnit: normalizeUnit,
    normalizeRoster: normalizeRoster,
    loadTvsRoster: loadTvsRoster,
    loadTvsCatalog: loadTvsCatalog,
    pickUnit: pickUnit,
    pickBestUnit: pickBestUnit,
    findUnit: findUnit,
    unitsByPack: unitsByPack,
    classToHint: classToHint,
    loadTvsUnit: loadTvsUnit,
    loadArmySample: loadArmySample,
    normalizeHeight: normalizeHeight,
    prepEmbeddedTextures: prepEmbeddedTextures,
    resolveClipMap: resolveClipMap,
    semanticFromClipName: semanticFromClipName,
    SEMANTIC_ROLES: SEMANTIC_ROLES,
    ANIM_PACKAGES: ANIM_PACKAGES,
    assertRealFbx: assertRealFbx,
    headOk: headOk,
  };

  global.TvsUnitLoader = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
