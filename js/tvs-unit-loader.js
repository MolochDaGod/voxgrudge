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

  var DEFAULT_HEIGHT = 1.8; // fleet SI yardstick (was 2.0)
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
   * Body-only bbox: prefer SkinnedMesh after skeleton.pose().
   * Skip weapon-only meshes so spears don't inflate height.
   * IMPORTANT: pose skeleton first — bind-pose AABBs can be near-zero and
   * trigger a false unitFix×100 → 100× giant characters.
   */
  function poseSkeletons(object3d) {
    object3d.traverse(function (ch) {
      if (ch.isSkinnedMesh && ch.skeleton) {
        try {
          ch.skeleton.pose();
          ch.skeleton.update();
        } catch (e) {
          /* */
        }
      }
    });
  }

  function measureBodyBox(object3d, THREE) {
    var box = new THREE.Box3();
    var found = false;
    poseSkeletons(object3d);
    object3d.updateMatrixWorld(true);
    object3d.traverse(function (ch) {
      if (!ch.isMesh && !ch.isSkinnedMesh) return;
      if (ch.visible === false) return;
      var n = (ch.name || "").toLowerCase();
      if (
        /weapon|sword|axe|bow|staff|shield|spear|arrow|tool|prop|quiver|bag/i.test(n) &&
        !/body|torso|legs|arms|head|units_/i.test(n)
      ) {
        return;
      }
      // World AABB after pose (more reliable than raw geometry BB × matrix)
      try {
        box.expandByObject(ch);
        found = true;
      } catch (e) {
        /* */
      }
    });
    if (!found) {
      try {
        box.setFromObject(object3d);
      } catch (e) {
        /* empty */
      }
    }
    return box;
  }

  /** Humanoid player band (m) — reject 100× giants / dust motes. */
  var HEIGHT_BAND_MIN = 0.9;
  var HEIGHT_BAND_MAX = 2.6;

  /**
   * Normalize character height in meters (fleet SI · 1.8 m human).
   * Production TVS GLBs may already be ~1.8–2.0 m — light pass if in band.
   * grudge6 CDN kits are often 12–22 m raw OR cm — always full fit + post-check.
   */
  function normalizeHeight(object3d, targetHeight, THREE, opts) {
    opts = opts || {};
    if (!object3d || !targetHeight || !THREE) return object3d;

    // Always clear pitch/roll so heroes never lie parallel to ground
    object3d.rotation.x = 0;
    object3d.rotation.z = 0;

    // grudge6 / forceFull: never trust "alreadyBaked" — CDN kits are modular raw
    var forceFull =
      opts.forceFull === true ||
      opts.asset === "grudge6" ||
      (object3d.userData && object3d.userData.assetSource === "grudge6");

    if (!forceFull && (opts.alreadyBaked || object3d.userData.productionBaked)) {
      // Light pass: only ground feet; keep baked mesh scale if within band
      object3d.updateMatrixWorld(true);
      var boxB = measureBodyBox(object3d, THREE);
      var sizeB = new THREE.Vector3();
      boxB.getSize(sizeB);
      if (sizeB.y > HEIGHT_BAND_MIN && sizeB.y < HEIGHT_BAND_MAX) {
        var err = Math.abs(sizeB.y - targetHeight) / targetHeight;
        if (err > 0.15) {
          // Baked height drifted — full renormalize (TVS 2.0 → fleet 1.8)
          object3d.userData.productionBaked = false;
        } else {
          // Soft residual fit into target when close
          if (err > 0.04) {
            object3d.scale.multiplyScalar(targetHeight / sizeB.y);
            object3d.updateMatrixWorld(true);
            boxB = measureBodyBox(object3d, THREE);
            boxB.getSize(sizeB);
          }
          object3d.position.y -= boxB.min.y;
          object3d.userData.nativeHeight = sizeB.y;
          object3d.userData.targetHeight = targetHeight;
          object3d.userData.scaleFactor = object3d.scale.x;
          object3d.userData.unitFix = 1;
          object3d.userData.feetGrounded = true;
          object3d.userData.productionBaked = true;
          return object3d;
        }
      } else {
        // Out of band despite "baked" flag — full fit (prevents 100× / dust)
        object3d.userData.productionBaked = false;
      }
    }

    object3d.scale.set(1, 1, 1);
    object3d.position.set(0, 0, 0);
    // keep yaw if already set for art-forward; zero pitch/roll already done
    poseSkeletons(object3d);
    object3d.updateMatrixWorld(true);

    var box = measureBodyBox(object3d, THREE);
    var size = new THREE.Vector3();
    box.getSize(size);
    if (!(size.y > 1e-6)) {
      console.warn("[TvsUnitLoader] zero height bbox", object3d.name);
      return object3d;
    }

    var beforeH = size.y;

    // Decade unit fix:
    //  - cm FBX/GLB often ~100–300 units tall
    //  - grudge6 CDN kits often ~12–22 m raw → residual fit only (no ×0.01)
    //  - NEVER ×100 on a near-zero bbox without post-height guard (100× giant bug)
    var unitFix = 1;
    if (size.y > 40) {
      unitFix = 0.01;
    } else if (size.y < 0.05) {
      // Only decade-up if post-fix lands in human band; else residual only
      unitFix = 100;
    }
    if (unitFix !== 1) {
      object3d.scale.setScalar(unitFix);
      object3d.updateMatrixWorld(true);
      box = measureBodyBox(object3d, THREE);
      box.getSize(size);
      // Guard: unitFix×100 on a bad tiny measure makes 100× giants
      if (unitFix === 100 && (size.y > HEIGHT_BAND_MAX || size.y < HEIGHT_BAND_MIN * 0.5)) {
        console.warn(
          "[TvsUnitLoader] reject unitFix×100 (would leave h=" +
            size.y.toFixed(3) +
            ") — residual fit from identity",
        );
        object3d.scale.set(1, 1, 1);
        object3d.updateMatrixWorld(true);
        box = measureBodyBox(object3d, THREE);
        box.getSize(size);
        unitFix = 1;
      }
    }

    var s = targetHeight / Math.max(size.y, 1e-4);
    // Hard caps — never 100× a humanoid
    if (s > 12) s = 12;
    if (s < 0.02) s = 0.02;
    if (s > 4 || s < 0.08) {
      console.warn("[TvsUnitLoader] scale factor", s.toFixed(4), "nativeH", beforeH.toFixed(3), "afterUnit", size.y.toFixed(3), "unitFix", unitFix);
    }

    object3d.scale.multiplyScalar(s);
    object3d.updateMatrixWorld(true);
    var box2 = measureBodyBox(object3d, THREE);
    var size2 = new THREE.Vector3();
    box2.getSize(size2);

    // Final band clamp: if still outside [0.9, 2.6], force exact target height
    if (size2.y > HEIGHT_BAND_MAX || size2.y < HEIGHT_BAND_MIN) {
      var s2 = targetHeight / Math.max(size2.y, 1e-4);
      s2 = Math.min(Math.max(s2, 0.02), 12);
      object3d.scale.multiplyScalar(s2);
      object3d.updateMatrixWorld(true);
      box2 = measureBodyBox(object3d, THREE);
      box2.getSize(size2);
      console.warn(
        "[TvsUnitLoader] post-band re-fit → h=" +
          size2.y.toFixed(3) +
          "m (was out of " +
          HEIGHT_BAND_MIN +
          "–" +
          HEIGHT_BAND_MAX +
          ")",
      );
    }

    object3d.position.y -= box2.min.y;
    // Sanity re-plant
    object3d.updateMatrixWorld(true);
    box2 = measureBodyBox(object3d, THREE);
    if (Math.abs(box2.min.y) > 0.02) {
      object3d.position.y -= box2.min.y;
    }
    box2.getSize(size2);
    object3d.userData.nativeHeight = beforeH;
    object3d.userData.measuredAfterUnitFix = size.y;
    object3d.userData.measuredFinal = size2.y;
    object3d.userData.targetHeight = targetHeight;
    object3d.userData.scaleFactor = object3d.scale.x;
    object3d.userData.unitFix = unitFix;
    object3d.userData.feetGrounded = true;
    if (size2.y > HEIGHT_BAND_MAX || size2.y < HEIGHT_BAND_MIN) {
      console.error(
        "[TvsUnitLoader] STILL out of band after fit h=" +
          size2.y.toFixed(3) +
          " scale=" +
          object3d.scale.x.toFixed(4),
      );
    } else {
      console.info(
        "[TvsUnitLoader] SI fit " +
          beforeH.toFixed(2) +
          "m → " +
          size2.y.toFixed(2) +
          "m (target " +
          targetHeight +
          ") scale×" +
          object3d.scale.x.toFixed(4),
      );
    }
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
    var ok = false;
    root.traverse(function (ch) {
      if ((!ch.isMesh && !ch.isSkinnedMesh) || !ch.material) return;
      var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      mats.forEach(function (m) {
        if (m && m.map && m.map.image) ok = true;
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
    var GLTFLoader = opts.GLTFLoader || (THREE && THREE.GLTFLoader) || global.GLTFLoader;
    if (!GLTFLoader) throw new Error("GLTFLoader required for GLB");
    var loader = new GLTFLoader();
    if (global.VoxGltfConfigure) {
      try {
        loader = global.VoxGltfConfigure(loader) || loader;
      } catch (e) {}
    } else if (global.VoxGameCanvas && VoxGameCanvas.configureGltfLoader) {
      try {
        loader = VoxGameCanvas.configureGltfLoader(loader) || loader;
      } catch (e) {}
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
    });
    return shared;
  }

  function attachColorApi(root, THREE) {
    var mats = collectMaterials(root);
    mats.forEach(function (m) {
      if (!m.userData) m.userData = {};
      if (m.color && m.userData._baseColor == null) {
        m.userData._baseColor = m.color.getHex();
      }
    });

    root.userData.materials = mats;

    root.userData.setColorTint = function (hex) {
      var c = typeof hex === "number" ? hex : parseInt(String(hex).replace("#", ""), 16);
      if (!isFinite(c)) c = 0xffffff;
      mats.forEach(function (m) {
        if (m.color) m.color.setHex(c);
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
    if (/idle/i.test(id)) score += 2;
    return score;
  }

  function resolveClipMap(animsJson, unit) {
    var out = {};
    if (!animsJson) return out;
    var isAnimal =
      unit &&
      (unit.tags || []).some(function (t) {
        return t === "animal" || t === "creature";
      });
    var preferHuman = !isAnimal;

    var clips = animsJson.clips || {};
    Object.keys(clips).forEach(function (sem) {
      var c = clips[sem];
      if (c && c.url) {
        out[sem] = Object.assign({}, c, { url: absCdnUrl(c.url) });
      }
    });

    if (preferHuman && animsJson.allClips) {
      var bySem = {};
      animsJson.allClips.forEach(function (c) {
        var sem = c.semantic || "other";
        if (!bySem[sem]) bySem[sem] = [];
        bySem[sem].push(Object.assign({}, c, { url: absCdnUrl(c.url) }));
      });
      ["idle", "locomotion", "attack", "defend", "jump", "sit"].forEach(function (sem) {
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

    if (animsJson.allClips) {
      animsJson.allClips.forEach(function (c) {
        if (c.id && c.url) out["id:" + c.id] = Object.assign({}, c, { url: absCdnUrl(c.url) });
      });
    }
    return out;
  }

  async function loadAnimClipsFromUrl(url, FBXLoader, THREE, opts) {
    opts = opts || {};
    var u = String(url || "");
    if (/\.glb($|\?)/i.test(u) || /\.gltf($|\?)/i.test(u)) {
      var gltf = await loadGlbFromUrl(THREE, u, {
        verify: opts.verify !== false,
        GLTFLoader: opts.GLTFLoader,
      });
      return gltf.animations || [];
    }
    if (!FBXLoader) throw new Error("FBXLoader required for anim " + u);
    var animRoot = await loadFbxFromUrl(FBXLoader, u, { verify: opts.verify !== false });
    return animRoot.animations || [];
  }

  async function loadAndBindAnims(root, clipMap, FBXLoader, THREE, opts) {
    opts = opts || {};
    var mixer = new THREE.AnimationMixer(root);
    var actions = {};
    var clips = {};
    var keys = Object.keys(clipMap).filter(function (k) {
      return k.indexOf("id:") !== 0;
    });
    var maxLoad = opts.maxClips || 6;
    var loadKeys = keys.slice(0, maxLoad);

    await Promise.all(
      loadKeys.map(async function (sem) {
        var entry = clipMap[sem];
        if (!entry || !entry.url) return;
        // Prefer production GLB when anims.json still points at FBX
        var urls = [];
        if (entry.glbUrl) urls.push(entry.glbUrl);
        if (entry.url) {
          urls.push(entry.url);
          if (/\.fbx($|\?)/i.test(entry.url)) {
            urls.push(String(entry.url).replace(/\.fbx($|\?)/i, ".glb$1"));
          }
        }
        var seen = {};
        var list = [];
        for (var ui = 0; ui < urls.length && !list.length; ui++) {
          var tryUrl = absCdnUrl(urls[ui]) || urls[ui];
          if (!tryUrl || seen[tryUrl]) continue;
          seen[tryUrl] = true;
          try {
            list = await loadAnimClipsFromUrl(tryUrl, FBXLoader, THREE, opts);
            if (list && list.length) entry._resolvedUrl = tryUrl;
          } catch (err) {
            list = [];
            if (ui === urls.length - 1) {
              console.warn("[TvsUnitLoader] anim fail", sem, tryUrl, err && err.message);
            }
          }
        }
        if (!list.length) return;
        var clip = list[0].clone();
        clip.name = sem;
        clips[sem] = clip;
        // Grounded kits: drop hip/root .position tracks (DRC SSOT — kills float)
        if (clip && clip.tracks) {
          var kept = clip.tracks.filter(function (t) {
            return (t.name || "").indexOf(".position") === -1;
          });
          if (kept.length && kept.length < clip.tracks.length) {
            try {
              clip = new THREE.AnimationClip(clip.name, clip.duration, kept);
            } catch (eStrip) {
              /* keep original */
            }
          }
        }
        var action = mixer.clipAction(clip);
        action.enabled = true;
        actions[sem] = action;
      })
    );

    if (root.animations && root.animations.length) {
      root.animations.forEach(function (clip, i) {
        var name = clip.name || "embedded-" + i;
        if (!clips[name]) {
          clips[name] = clip;
          actions[name] = mixer.clipAction(clip);
        }
      });
    }

    var current = null;

    function playClip(name, fade) {
      fade = fade == null ? 0.15 : fade;
      var action = actions[name];
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
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
      current = action;
      root.userData.currentAnim = name;
      return action;
    }

    function updateMixer(dt) {
      if (mixer) mixer.update(dt);
    }

    root.userData.mixer = mixer;
    root.userData.animActions = actions;
    root.userData.animClips = clips;
    root.userData.playClip = playClip;
    root.userData.updateMixer = updateMixer;
    root.userData.clipMap = clipMap;

    if (actions.idle) playClip("idle", 0);
    else if (actions.locomotion) playClip("locomotion", 0);

    return { mixer: mixer, actions: actions, playClip: playClip };
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
      prepEmbeddedTextures(group, THREE);
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

    normalizeHeight(group, height, THREE, {
      alreadyBaked: format === "glb" || group.userData.productionBaked,
    });
    attachColorApi(group, THREE);
    if (opts.colorTint != null) group.userData.setColorTint(opts.colorTint);

    if (opts.loadSidecars !== false) {
      var collider = await fetchJson(unit.colliderUrl);
      var animsJson = await fetchJson(unit.animationPackUrl);
      var brain = opts.withBrain && unit.brainUrl ? await fetchJson(unit.brainUrl) : null;

      group.userData.collider = collider;
      group.userData.animationPack = animsJson;
      group.userData.brain = brain;

      if (collider && opts.debugColliders) {
        var rootC = (collider.colliders || []).find(function (c) {
          return c.name === "character_root" || c.type === "capsule";
        });
        if (rootC && rootC.type === "capsule" && THREE.CapsuleGeometry) {
          var geo = new THREE.CapsuleGeometry(rootC.radius || 0.32, rootC.height || 1.0, 4, 8);
          var mat = new THREE.MeshBasicMaterial({
            color: 0x3dd6c6,
            wireframe: true,
            transparent: true,
            opacity: 0.35,
          });
          var mesh = new THREE.Mesh(geo, mat);
          mesh.position.fromArray(rootC.center || [0, 0.85, 0]);
          mesh.name = "tvs-collider-debug";
          group.add(mesh);
        }
      }

      if (opts.withAnims !== false && animsJson) {
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

      if (brain && global.TvsAiBrain) {
        group.userData.aiAgent = global.TvsAiBrain.createAgent(brain, {
          unitId: unit.unitId,
          team: opts.team || "a",
        });
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
    group.userData.importReport = {
      unitId: unit.unitId,
      format: format,
      sourceUrl: sourceUrl,
      glbUrl: unit.glbUrl,
      modelUrl: unit.modelUrl,
      textureUrl: group.userData.textureUrl || unit.textureUrl,
      height: group.userData.targetHeight,
      measuredHeight: group.userData.measuredAfterUnitFix || group.userData.nativeHeight,
      scale: group.userData.scaleFactor,
      unitFix: group.userData.unitFix,
      productionBaked: !!group.userData.productionBaked,
      hasTexture: !!group.userData.texture || hasUsableMap(group),
      hasMixer: !!group.userData.mixer,
      compressed: format === "glb",
    };
    console.info("[TvsUnitLoader] loaded", group.userData.importReport);

    return group;
  }

  async function loadArmySample(opts) {
    var roster = await loadTvsRoster();
    var picks = ["melee", "ranged", "magic", "civilian"]
      .map(function (c) {
        return pickUnit(roster, c);
      })
      .filter(Boolean);
    var roots = [];
    for (var i = 0; i < picks.length; i++) {
      var root = await loadTvsUnit(picks[i], opts);
      root.position.x = (i - (picks.length - 1) / 2) * 2.5;
      roots.push(root);
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
    assertRealFbx: assertRealFbx,
    headOk: headOk,
  };

  global.TvsUnitLoader = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
