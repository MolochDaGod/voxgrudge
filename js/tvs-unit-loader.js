/**
 * TVS Voxel Unit Loader — production runtime for VoxGrudge / RTS / showcase.
 *
 * Loads characters from the D1-aligned unit roster + R2 CDN:
 *   https://assets.grudge-studio.com/models/voxels/tvs/unit-roster.json
 *
 * Best practices:
 *   - Magic-byte verify FBX (reject HTML fake-200)
 *   - Height normalize via local scale (reset → measure → scale → ground feet)
 *   - Texture rebind with NearestFilter (voxel atlases)
 *   - Color tint via material.color (editable without re-bake)
 *   - Semantic anim packs from *.anims.json; prefer human-* over animal clips
 *   - Sidecars: collider / brain / grudgeUuid for D1 join
 *
 * Example:
 *   const roster = await TvsUnitLoader.loadTvsRoster();
 *   const unit = TvsUnitLoader.pickUnit(roster, 'melee');
 *   const root = await TvsUnitLoader.loadTvsUnit(unit, {
 *     THREE, FBXLoader, height: 2.0, withAnims: true, withTexture: true,
 *   });
 *   root.userData.setColorTint(0xff6644);
 *   root.userData.playClip('idle');
 */
(function (global) {
  "use strict";

  var CDN = "https://assets.grudge-studio.com";
  var CDN_ROSTER =
    (global.GrudgeFleet &&
      global.GrudgeFleet.endpoints &&
      global.GrudgeFleet.endpoints.tvsVoxelRoster) ||
    CDN + "/models/voxels/tvs/unit-roster.json";
  var CDN_CATALOG = CDN + "/models/voxels/tvs/catalog.json";

  var DEFAULT_HEIGHT = 2.0;
  var HUMAN_CLIP_RE = /human[-_]/i;
  var ANIMAL_CLIP_RE = /^(horse|cow|pig|sheep|chicken|duck|bull|owl|corgi|goat)[-_]/i;

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

  async function assertRealFbx(url) {
    var res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("FBX HTTP " + res.status + ": " + url);
    var buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 32) throw new Error("FBX too small: " + url);
    var head = "";
    for (var i = 0; i < 20 && i < buf.length; i++) head += String.fromCharCode(buf[i]);
    if (head.indexOf("<!DOCTYPE") >= 0 || head.indexOf("<html") >= 0 || head.indexOf("<HTML") >= 0) {
      throw new Error("HTML fake-200 (not FBX): " + url);
    }
    if (head.indexOf("Kaydara") < 0 && buf[0] !== 0x4b) {
      // Allow binary without full Kaydara string only if size looks like a model
      if (buf.length < 2048) throw new Error("Not FBX: " + url);
    }
    return buf;
  }

  async function loadFbxFromUrl(FBXLoader, url, opts) {
    opts = opts || {};
    if (opts.verify !== false) {
      await assertRealFbx(url);
    }
    var loader = new FBXLoader();
    return new Promise(function (resolve, reject) {
      loader.load(url, resolve, undefined, reject);
    });
  }

  async function loadTexture(THREE, url) {
    return new Promise(function (resolve, reject) {
      var loader = new THREE.TextureLoader();
      loader.load(
        url,
        function (tex) {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.generateMipmaps = false;
          if (THREE.sRGBEncoding != null) tex.encoding = THREE.sRGBEncoding;
          // FBXLoader + external PNG atlases: keep default flipY (true)
          resolve(tex);
        },
        undefined,
        reject
      );
    });
  }

  // ── roster ─────────────────────────────────────────────────────────────────

  async function loadTvsRoster(force) {
    if (global.TvsVoxelAssets && global.TvsVoxelAssets.loadRoster) {
      return global.TvsVoxelAssets.loadRoster(force);
    }
    if (global.GrudgeFleet && global.GrudgeFleet.loadTvsVoxelRoster) {
      return global.GrudgeFleet.loadTvsVoxelRoster();
    }
    try {
      var res = await fetch(CDN_ROSTER, { mode: "cors" });
      if (!res.ok) throw new Error("roster " + res.status);
      return res.json();
    } catch (e) {
      var local = await fetchJson("assets/voxels/unit-roster.json");
      if (local) return local;
      throw e;
    }
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
      return fetchJson("assets/voxels/catalog.json");
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
          u.unitId.toLowerCase() === key ||
          (u.displayName && u.displayName.toLowerCase() === key) ||
          u.unitId.toLowerCase().endsWith(key)
        );
      }) || null
    );
  }

  /** Map VoxGrudge / Nexus class ids → TVS classHint */
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

  // Preferred heroes per class for best showcase look
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

  // ── scale (local, not world-bbox-as-scale) ──────────────────────────────────

  /**
   * Normalize character height in meters.
   * Always resets scale to 1 first so we never compound world-space bbox bugs.
   */
  function normalizeHeight(object3d, targetHeight, THREE) {
    if (!object3d || !targetHeight || !THREE) return object3d;
    object3d.scale.set(1, 1, 1);
    object3d.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(object3d);
    var size = new THREE.Vector3();
    box.getSize(size);
    if (!(size.y > 0.001)) return object3d;
    var s = targetHeight / size.y;
    // Guard pathological FBX units (µm / km)
    if (s > 1000 || s < 0.0001) {
      console.warn("[TvsUnitLoader] extreme scale factor", s, "height", size.y);
    }
    object3d.scale.setScalar(s);
    object3d.updateMatrixWorld(true);
    var box2 = new THREE.Box3().setFromObject(object3d);
    object3d.position.y -= box2.min.y;
    object3d.userData.nativeHeight = size.y;
    object3d.userData.targetHeight = targetHeight;
    object3d.userData.scaleFactor = s;
    return object3d;
  }

  // ── materials / color ──────────────────────────────────────────────────────

  function collectMaterials(root) {
    var mats = [];
    var seen = new Set();
    root.traverse(function (ch) {
      if (!ch.isMesh) return;
      ch.castShadow = true;
      ch.receiveShadow = true;
      var list = Array.isArray(ch.material) ? ch.material : [ch.material];
      list.forEach(function (m) {
        if (!m || seen.has(m)) return;
        seen.add(m);
        mats.push(m);
      });
    });
    return mats;
  }

  function applyTextureToRoot(root, texture, THREE) {
    root.traverse(function (ch) {
      if (!ch.isMesh || !ch.material) return;
      var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      for (var i = 0; i < mats.length; i++) {
        var m = mats[i];
        if (!m) continue;
        // Clone so multiple instances don't share tint state incorrectly
        if (!m.userData || !m.userData._tvsOwned) {
          m = m.clone();
          m.userData = m.userData || {};
          m.userData._tvsOwned = true;
          mats[i] = m;
        }
        m.map = texture;
        m.needsUpdate = true;
        if (m.color) m.color.setHex(0xffffff);
        if ("metalness" in m) m.metalness = 0;
        if ("roughness" in m) m.roughness = 0.85;
        if ("flatShading" in m) m.flatShading = true;
      }
      ch.material = Array.isArray(ch.material) ? mats : mats[0];
    });
  }

  function attachColorApi(root, THREE) {
    var mats = collectMaterials(root);
    // Store original colors for reset
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

  /**
   * Resolve best clip URLs from anims.json.
   * Prefer human-* when unit is a character (not animal).
   */
  function resolveClipMap(animsJson, unit) {
    var out = {};
    if (!animsJson) return out;
    var isAnimal =
      unit &&
      (unit.tags || []).some(function (t) {
        return t === "animal" || t === "creature";
      });
    var preferHuman = !isAnimal;

    // Semantic map first
    var clips = animsJson.clips || {};
    Object.keys(clips).forEach(function (sem) {
      var c = clips[sem];
      if (c && c.url) out[sem] = c;
    });

    // Fix bad idle/walk mappings (horse-* on human heroes)
    if (preferHuman && animsJson.allClips) {
      var bySem = {};
      animsJson.allClips.forEach(function (c) {
        var sem = c.semantic || "other";
        if (!bySem[sem]) bySem[sem] = [];
        bySem[sem].push(c);
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

    // Also index allClips by id for freeform play
    if (animsJson.allClips) {
      animsJson.allClips.forEach(function (c) {
        if (c.id && c.url) out["id:" + c.id] = c;
      });
    }
    return out;
  }

  async function loadAndBindAnims(root, clipMap, FBXLoader, THREE, opts) {
    opts = opts || {};
    var mixer = new THREE.AnimationMixer(root);
    var actions = {};
    var clips = {};
    var keys = Object.keys(clipMap).filter(function (k) {
      return k.indexOf("id:") !== 0;
    });
    // Cap concurrent anim loads for game path
    var maxLoad = opts.maxClips || 6;
    var loadKeys = keys.slice(0, maxLoad);

    await Promise.all(
      loadKeys.map(async function (sem) {
        var entry = clipMap[sem];
        if (!entry || !entry.url) return;
        try {
          var animRoot = await loadFbxFromUrl(FBXLoader, entry.url, { verify: opts.verify });
          var list = animRoot.animations || [];
          if (!list.length) return;
          var clip = list[0].clone();
          clip.name = sem;
          clips[sem] = clip;
          var action = mixer.clipAction(clip);
          action.enabled = true;
          actions[sem] = action;
        } catch (err) {
          console.warn("[TvsUnitLoader] anim fail", sem, entry.url, err && err.message);
        }
      })
    );

    // Also use embedded clips on the mesh itself
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
        // fuzzy
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

    // Auto-idle
    if (actions.idle) playClip("idle", 0);
    else if (actions.locomotion) playClip("locomotion", 0);

    return { mixer: mixer, actions: actions, playClip: playClip };
  }

  // ── main load ──────────────────────────────────────────────────────────────

  /**
   * Load unit mesh + texture + anims + sidecars.
   * opts: {
   *   THREE, FBXLoader, height=2.0,
   *   withTexture=true, withAnims=true, loadSidecars=true, withBrain=false,
   *   verify=true, debugColliders=false, colorTint=null, team='a', maxClips=6
   * }
   */
  async function loadTvsUnit(unit, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    var FBXLoader = opts.FBXLoader || (THREE && THREE.FBXLoader) || global.FBXLoader;
    if (!FBXLoader) throw new Error("FBXLoader required");
    if (!THREE) throw new Error("THREE required");
    if (!unit || !unit.modelUrl) throw new Error("unit.modelUrl required");

    var height = opts.height != null ? opts.height : DEFAULT_HEIGHT;
    var group = await loadFbxFromUrl(FBXLoader, unit.modelUrl, { verify: opts.verify !== false });

    group.userData.tvsUnit = unit;
    group.userData.grudgeUuid = unit.grudgeUuid;
    group.userData.assetSource = "tvs-voxel";
    group.userData.r2Key = unit.modelUrl.replace(CDN + "/", "");
    group.userData.d1 = {
      grudgeUuid: unit.grudgeUuid,
      unitId: unit.unitId,
      pack: unit.pack,
      classHint: unit.classHint,
      modelUrl: unit.modelUrl,
      textureUrl: unit.textureUrl,
      animationPackUrl: unit.animationPackUrl,
      colliderUrl: unit.colliderUrl,
      brainUrl: unit.brainUrl,
    };
    group.name = unit.unitId || unit.displayName || "tvs-unit";

    // Texture rebind
    if (opts.withTexture !== false && unit.textureUrl) {
      try {
        var tex = await loadTexture(THREE, unit.textureUrl);
        applyTextureToRoot(group, tex, THREE);
        group.userData.texture = tex;
        group.userData.textureUrl = unit.textureUrl;
      } catch (err) {
        console.warn("[TvsUnitLoader] texture fail", unit.textureUrl, err && err.message);
      }
    }

    // Scale + ground
    normalizeHeight(group, height, THREE);

    // Color API
    attachColorApi(group, THREE);
    if (opts.colorTint != null) group.userData.setColorTint(opts.colorTint);

    // Sidecars
    if (opts.loadSidecars !== false) {
      var collider = await fetchJson(unit.colliderUrl);
      var animsJson = await fetchJson(unit.animationPackUrl);
      var brain =
        opts.withBrain && unit.brainUrl ? await fetchJson(unit.brainUrl) : null;

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
          var clips = group.animations;
          var clip =
            typeof nameOrIndex === "number"
              ? clips[nameOrIndex]
              : clips.find(function (c) {
                  return c.name.toLowerCase().indexOf(String(nameOrIndex).toLowerCase()) >= 0;
                });
          if (!clip) clip = clips[0];
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

    // Runtime texture swap helper
    group.userData.setTextureUrl = async function (url) {
      var t = await loadTexture(THREE, url);
      applyTextureToRoot(group, t, THREE);
      group.userData.texture = t;
      group.userData.textureUrl = url;
      return group;
    };

    return group;
  }

  /** Sample army for RTS / danger room / showcase strip */
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
    resolveClipMap: resolveClipMap,
    assertRealFbx: assertRealFbx,
  };

  global.TvsUnitLoader = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
