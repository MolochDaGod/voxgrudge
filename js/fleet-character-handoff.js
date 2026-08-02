/**
 * Fleet character handoff — Open → VoxGrudge.
 *
 * Query SSOT (productionRuntime HANDOFF_QUERY):
 *   characterId | grudge_token | sso | open=1 | from=gameopen
 *
 * Loads Railway hero → grudge6 race kit (CDN) → SI fit ~1.8 m → Bip001 idle anims.
 * Reuses TvsUnitLoader.normalizeHeight when present (no parallel scale stack).
 */
(function (global) {
  "use strict";

  var CDN = "https://assets.grudge-studio.com";
  var ANIMS_BAKED = "https://open.grudge-studio.com/anims/baked";
  var HUMAN_HEIGHT_M = 1.8;
  var API_CHARS = "/api/characters";

  /** raceId / short / library → kit paths */
  var RACES = {
    human: {
      short: "human",
      prefix: "WK_",
      kitGlb: CDN + "/models/grudge6/races/WK_Characters.glb",
      atlas: CDN + "/textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
      animPack: "sword_shield",
    },
    "western-kingdoms": null,
    barbarian: {
      short: "barbarian",
      prefix: "BRB_",
      kitGlb: CDN + "/models/grudge6/races/BRB_Characters.glb",
      atlas: CDN + "/textures/grudge6/barbarians/BRB_Standard_Units.webp",
      animPack: "sword_shield",
    },
    barbarians: null,
    elf: {
      short: "elf",
      prefix: "ELF_",
      kitGlb: CDN + "/models/grudge6/races/ELF_Characters.glb",
      atlas: CDN + "/textures/grudge6/high-elves/ELF_Standard_Units.webp",
      animPack: "longbow",
    },
    "high-elves": null,
    dwarf: {
      short: "dwarf",
      prefix: "DWF_",
      kitGlb: CDN + "/models/grudge6/races/DWF_Characters.glb",
      atlas: CDN + "/textures/grudge6/dwarves/DWF_Standard_Units.webp",
      animPack: "sword_shield",
    },
    dwarves: null,
    orc: {
      short: "orc",
      prefix: "ORC_",
      kitGlb: CDN + "/models/grudge6/races/ORC_Characters.glb",
      atlas: CDN + "/textures/grudge6/orcs/ORC_Standard_Units.webp",
      animPack: "twohand",
    },
    orcs: null,
    undead: {
      short: "undead",
      prefix: "UD_",
      kitGlb: CDN + "/models/grudge6/races/UD_Characters.glb",
      atlas: CDN + "/textures/grudge6/undead/UD_Standard_Units.webp",
      animPack: "magic",
    },
  };
  // aliases
  RACES["western-kingdoms"] = RACES.human;
  RACES.barbarians = RACES.barbarian;
  RACES["high-elves"] = RACES.elf;
  RACES.dwarves = RACES.dwarf;
  RACES.orcs = RACES.orc;

  var CLASS_TO_PACK = {
    warrior: "sword_shield",
    knight: "sword_shield",
    ranger: "longbow",
    archer: "longbow",
    mage: "magic",
    priest: "magic",
    worge: "twohand",
    unarmed: "unarmed",
  };

  var CLASS_TO_RACE = {
    warrior: "human",
    knight: "human",
    ranger: "elf",
    archer: "elf",
    mage: "undead",
    priest: "dwarf",
    worge: "orc",
    unarmed: "orc",
  };

  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch (e) {
      /* quota */
    }
  }

  function parseHandoff() {
    var q = new URLSearchParams(global.location.search || "");
    var token =
      q.get("grudge_token") ||
      q.get("sso") ||
      q.get("token") ||
      q.get("sessionToken") ||
      null;
    var characterId =
      q.get("characterId") ||
      q.get("character") ||
      q.get("cid") ||
      null;
    var open = q.get("open") === "1" || q.get("open") === "true";
    var from = q.get("from") || "";
    return { token: token, characterId: characterId, open: open, from: from };
  }

  /** Store Open/SSO token into fleet keys GrudgeAuth + VoxCloud read. */
  function applyToken(token) {
    if (!token) return;
    lsSet("grudge_auth_token", token);
    lsSet("grudge_session_token", token);
    lsSet("sso_token", token);
    lsSet("grudge.token", token);
    if (global.GrudgeAuth && typeof global.GrudgeAuth.storeToken === "function") {
      try {
        global.GrudgeAuth.storeToken(token, "", "");
      } catch (e) {
        /* ignore */
      }
    }
  }

  function authHeaders() {
    if (global.VoxCloud && global.VoxCloud.authHeaders) return global.VoxCloud.authHeaders();
    if (global.GrudgeAuth && global.GrudgeAuth.authHeaders) return global.GrudgeAuth.authHeaders();
    var t =
      lsGet("grudge_auth_token") ||
      lsGet("grudge_session_token") ||
      lsGet("sso_token") ||
      lsGet("grudge.token");
    var h = { Accept: "application/json", "Content-Type": "application/json" };
    if (t) {
      h.Authorization = "Bearer " + t;
      h["X-Session-Token"] = t;
    }
    return h;
  }

  async function fetchCharacter(characterId) {
    if (!characterId) return null;
    var urls = [
      API_CHARS + "/" + encodeURIComponent(characterId),
      "https://grudge-api-production-0d46.up.railway.app/api/characters/" +
        encodeURIComponent(characterId),
    ];
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try {
        var res = await fetch(urls[i], { headers: authHeaders(), credentials: "omit" });
        if (!res.ok) {
          lastErr = new Error("HTTP " + res.status);
          continue;
        }
        var data = await res.json();
        return data.character || data.item || data;
      } catch (e) {
        lastErr = e;
      }
    }
    console.warn("[FleetHandoff] fetch character failed", lastErr);
    return null;
  }

  function resolveRaceKey(ch) {
    if (!ch) return "human";
    var r =
      ch.raceId ||
      ch.race ||
      ch.libraryRace ||
      (ch.meta && (ch.meta.raceId || ch.meta.race)) ||
      "";
    r = String(r).toLowerCase().replace(/\s+/g, "-");
    if (RACES[r]) return RACES[r].short || r;
    var cls =
      ch.classId ||
      ch.class ||
      ch.playerClass ||
      (ch.meta && ch.meta.classId) ||
      "";
    cls = String(cls).toLowerCase();
    if (CLASS_TO_RACE[cls]) return CLASS_TO_RACE[cls];
    return "human";
  }

  function resolveClassKey(ch) {
    if (!ch) return "warrior";
    var c =
      ch.classId ||
      ch.class ||
      ch.playerClass ||
      (ch.meta && ch.meta.classId) ||
      "warrior";
    return String(c).toLowerCase();
  }

  function raceDef(raceKey) {
    var d = RACES[raceKey] || RACES.human;
    return d;
  }

  function stripPositionTracks(clip, THREE) {
    if (!clip || !clip.tracks) return clip;
    var kept = clip.tracks.filter(function (t) {
      var n = t.name || "";
      return n.indexOf(".position") === -1;
    });
    if (kept.length === clip.tracks.length) return clip;
    try {
      return new THREE.AnimationClip(clip.name, clip.duration, kept);
    } catch (e) {
      return clip;
    }
  }

  function equipDefaultMeshes(root, prefix) {
    if (!root || !prefix) return;
    var bodyShown = false;
    var armsShown = false;
    var legsShown = false;
    var headShown = false;
    root.traverse(function (o) {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      var n = o.name || "";
      if (n.indexOf(prefix) !== 0 && n.indexOf("Units_") < 0) return;
      // Hide all equippable, then show A variants
      var isEquip =
        /Units_Body|Units_Arms|Units_Legs|Units_head|shoulderpads|sword|axe|bow|staff|shield|hammer|spear|pick|bag|wood|quiver/i.test(
          n,
        );
      if (!isEquip) return;
      o.visible = false;
      if (/Units_Body_A/i.test(n) && !bodyShown) {
        o.visible = true;
        bodyShown = true;
      } else if (/Units_Arms_A/i.test(n) && !armsShown) {
        o.visible = true;
        armsShown = true;
      } else if (/Units_Legs_A/i.test(n) && !legsShown) {
        o.visible = true;
        legsShown = true;
      } else if (/Units_head_A|_head_A/i.test(n) && !headShown) {
        o.visible = true;
        headShown = true;
      } else if (/sword_A/i.test(n)) {
        o.visible = true;
      } else if (/shield_A/i.test(n)) {
        o.visible = true;
      }
    });
  }

  function applyAtlas(root, atlasUrl, THREE) {
    if (!atlasUrl || !THREE) return Promise.resolve();
    return new Promise(function (resolve) {
      var loader = new THREE.TextureLoader();
      if (loader.setCrossOrigin) loader.setCrossOrigin("anonymous");
      loader.load(
        atlasUrl,
        function (tex) {
          tex.flipY = false;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          if ("colorSpace" in tex && THREE.SRGBColorSpace != null) {
            tex.colorSpace = THREE.SRGBColorSpace;
          } else if (THREE.sRGBEncoding != null) {
            tex.encoding = THREE.sRGBEncoding;
          }
          tex.needsUpdate = true;
          root.traverse(function (o) {
            if (!o.isMesh && !o.isSkinnedMesh) return;
            var mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(function (m) {
              if (!m) return;
              m.map = tex;
              if (m.vertexColors) m.vertexColors = false;
              m.color && m.color.setHex(0xffffff);
              if (typeof m.roughness === "number") m.roughness = 0.8;
              if (typeof m.metalness === "number") m.metalness = 0.05;
              m.needsUpdate = true;
            });
          });
          resolve(tex);
        },
        undefined,
        function () {
          resolve(null);
        },
      );
    });
  }

  /**
   * SI fit to ~1.8 m. Prefer TvsUnitLoader (forceFull for grudge6).
   * Prevents classic 100×: never decade-up on tiny bind-pose bbox without post-check.
   */
  function fitHeight(root, targetH, THREE) {
    targetH = targetH || HUMAN_HEIGHT_M;
    if (global.TvsUnitLoader && typeof global.TvsUnitLoader.normalizeHeight === "function") {
      return global.TvsUnitLoader.normalizeHeight(root, targetH, THREE, {
        forceFull: true,
        asset: "grudge6",
      });
    }
    // Inline DRC-style fallback (mirrors Multiverse characterDeploy)
    root.scale.set(1, 1, 1);
    root.position.set(0, 0, 0);
    root.rotation.x = 0;
    root.rotation.z = 0;
    root.traverse(function (o) {
      if (o.isSkinnedMesh && o.skeleton) {
        try {
          o.skeleton.pose();
          o.skeleton.update();
        } catch (e) {
          /* */
        }
      }
    });
    root.updateMatrixWorld(true);
    var box = new THREE.Box3();
    var n = 0;
    root.traverse(function (o) {
      if (!o.isSkinnedMesh) return;
      if (o.visible === false) return;
      if (/weapon|shield|quiver|bag|xtra|sword|axe|bow|staff/i.test(o.name || "") &&
          !/body|units_/i.test(o.name || "")) return;
      try {
        box.expandByObject(o);
        n++;
      } catch (e) {
        /* */
      }
    });
    if (!n) {
      try {
        box.setFromObject(root);
      } catch (e) {
        return root;
      }
    }
    var size = new THREE.Vector3();
    box.getSize(size);
    var h = size.y;
    if (!(h > 1e-4)) return root;
    // cm kits (~100–300 units); grudge6 raw often 12–22 m → residual only
    if (h > 40) {
      root.scale.multiplyScalar(0.01);
      root.updateMatrixWorld(true);
      box.setFromObject(root);
      box.getSize(size);
      h = size.y;
    }
    var s = targetH / Math.max(h, 1e-4);
    // Cap — never ×40+ on a humanoid (was ×40 → multi-storey giants)
    s = Math.min(Math.max(s, 0.02), 12);
    root.scale.multiplyScalar(s);
    root.updateMatrixWorld(true);
    box.setFromObject(root);
    box.getSize(size);
    // Post band [0.9, 2.6]
    if (size.y > 2.6 || size.y < 0.9) {
      var s2 = targetH / Math.max(size.y, 1e-4);
      s2 = Math.min(Math.max(s2, 0.02), 12);
      root.scale.multiplyScalar(s2);
      root.updateMatrixWorld(true);
      box.setFromObject(root);
      box.getSize(size);
      console.warn("[FleetHandoff] post-band re-fit h=" + size.y.toFixed(3) + "m");
    }
    root.position.y -= box.min.y;
    root.userData.targetHeight = targetH;
    root.userData.scaleFactor = root.scale.x;
    root.userData.measuredFinal = size.y;
    console.info(
      "[FleetHandoff] SI fit → " + size.y.toFixed(2) + "m scale×" + root.scale.x.toFixed(4),
    );
    return root;
  }

  async function loadGlb(url, THREE) {
    return new Promise(function (resolve, reject) {
      var loader = new THREE.GLTFLoader();
      if (global.VoxGltfConfigure) global.VoxGltfConfigure(loader);
      loader.load(url, resolve, undefined, reject);
    });
  }

  async function bindBasicAnims(root, pack, THREE) {
    // Prefer open baked loco if available; else keep embedded clips
    var mixer = new THREE.AnimationMixer(root);
    var actions = {};
    var clips = root.animations || [];
    function register(name, clip) {
      if (!clip) return;
      clip = stripPositionTracks(clip, THREE);
      try {
        actions[name] = mixer.clipAction(clip);
      } catch (e) {
        /* */
      }
    }
    // Classify embedded
    clips.forEach(function (c) {
      var n = (c.name || "").toLowerCase();
      if (/idle/.test(n)) register("idle", c);
      else if (/walk/.test(n)) register("walk", c);
      else if (/run/.test(n)) register("run", c);
      else if (/attack|slash|shoot|cast/.test(n)) register("attack", c);
    });
    // Try baked idle from Open (optional — soft fail)
    var idleUrl = ANIMS_BAKED + "/locomotion/idle.json";
    try {
      // JSON baked clips need special loader — skip if no helper
      if (global.GrudgeBakedAnim && global.GrudgeBakedAnim.loadClip) {
        var idleClip = await global.GrudgeBakedAnim.loadClip(idleUrl);
        if (idleClip) register("idle", idleClip);
      }
    } catch (e) {
      /* optional */
    }
    if (actions.idle) {
      actions.idle.reset().play();
    } else if (clips[0]) {
      register("idle", clips[0]);
      if (actions.idle) actions.idle.play();
    }
    root.userData.mixer = mixer;
    root.userData.animActions = actions;
    root.userData.playClip = function (name) {
      var a = actions[name] || actions.idle;
      if (!a) return;
      Object.keys(actions).forEach(function (k) {
        if (actions[k] !== a) actions[k].fadeOut(0.15);
      });
      a.reset().fadeIn(0.15).play();
    };
    root.userData.tickAnims = function (dt) {
      if (mixer) mixer.update(dt);
    };
    return mixer;
  }

  /**
   * Load grudge6 player mesh for a fleet character record.
   * @returns {Promise<THREE.Object3D>}
   */
  async function loadGrudge6Player(ch, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    if (!THREE) throw new Error("THREE required");
    var raceKey = resolveRaceKey(ch);
    var classKey = resolveClassKey(ch);
    var race = raceDef(raceKey);
    if (!race) throw new Error("unknown race " + raceKey);
    var pack = CLASS_TO_PACK[classKey] || race.animPack || "sword_shield";
    var targetH =
      opts.height ||
      (global.GrudgeScale && global.GrudgeScale.PLAYER_HEIGHT_M) ||
      HUMAN_HEIGHT_M;

    var gltf = await loadGlb(race.kitGlb, THREE);
    var root = gltf.scene || gltf.scenes[0];
    if (gltf.animations && gltf.animations.length) {
      root.animations = gltf.animations;
    }
    root.name = "grudge6-" + race.short;
    root.userData.assetSource = "grudge6";
    root.userData.fleetCharacter = ch;
    root.userData.raceId = race.short;
    root.userData.classId = classKey;
    root.userData.animPack = pack;
    root.userData.prefix = race.prefix;

    equipDefaultMeshes(root, race.prefix);
    await applyAtlas(root, race.atlas, THREE);
    fitHeight(root, targetH, THREE);
    // Art-forward for grudge6 GLB often already +Z; light yaw if needed
    root.rotation.x = 0;
    root.rotation.z = 0;
    await bindBasicAnims(root, pack, THREE);

    root.userData.importReport = {
      source: "grudge6",
      race: race.short,
      class: classKey,
      height: targetH,
      scale: root.scale.x,
      kit: race.kitGlb,
    };
    console.info("[FleetHandoff] grudge6 player", root.userData.importReport);
    return root;
  }

  /**
   * Full handoff: parse URL → store token → fetch character → load mesh.
   * Call before / instead of spawnTvsPlayer when characterId present.
   */
  async function bootstrapFromUrl(opts) {
    opts = opts || {};
    var hand = parseHandoff();
    if (hand.token) applyToken(hand.token);
    if (hand.characterId) {
      lsSet("mv_fleet_character_id", hand.characterId);
      lsSet("vox_character_id", hand.characterId);
    }
    var characterId = hand.characterId || lsGet("vox_character_id") || lsGet("mv_fleet_character_id");
    if (!characterId) {
      return { ok: false, reason: "no_characterId", handoff: hand };
    }

    var ch = await fetchCharacter(characterId);
    if (!ch) {
      return { ok: false, reason: "fetch_failed", characterId: characterId, handoff: hand };
    }

    // Expose for VoxCloud / UI
    if (global.VoxCloud && global.VoxCloud.getMeta) {
      try {
        var meta = global.VoxCloud.getMeta();
        meta.characterId = characterId;
      } catch (e) {
        /* */
      }
    }
    lsSet("vox_character_id", characterId);

    // Map class to game class cards when possible
    var classKey = resolveClassKey(ch);
    if (classKey && typeof global.selectClass === "function") {
      try {
        global.selectClass(classKey === "knight" ? "warrior" : classKey);
      } catch (e) {
        /* */
      }
    } else if (classKey) {
      global.playerClass = classKey === "knight" ? "warrior" : classKey;
    }

    var root = null;
    try {
      root = await loadGrudge6Player(ch, opts);
    } catch (err) {
      console.warn("[FleetHandoff] grudge6 load failed", err);
      return {
        ok: false,
        reason: "mesh_failed",
        error: String(err && err.message ? err.message : err),
        character: ch,
        characterId: characterId,
        handoff: hand,
      };
    }

    return {
      ok: true,
      characterId: characterId,
      character: ch,
      root: root,
      handoff: hand,
      autoStart: hand.open === true,
    };
  }

  /** Clean sensitive tokens from URL after consume (keep characterId optional). */
  function scrubUrlTokens() {
    try {
      var u = new URL(global.location.href);
      var dirty = false;
      ["grudge_token", "sso", "token", "sessionToken"].forEach(function (k) {
        if (u.searchParams.has(k)) {
          u.searchParams.delete(k);
          dirty = true;
        }
      });
      if (dirty) {
        global.history.replaceState({}, "", u.pathname + u.search + u.hash);
      }
    } catch (e) {
      /* */
    }
  }

  global.FleetCharacterHandoff = {
    HUMAN_HEIGHT_M: HUMAN_HEIGHT_M,
    parseHandoff: parseHandoff,
    applyToken: applyToken,
    fetchCharacter: fetchCharacter,
    loadGrudge6Player: loadGrudge6Player,
    bootstrapFromUrl: bootstrapFromUrl,
    scrubUrlTokens: scrubUrlTokens,
    resolveRaceKey: resolveRaceKey,
    resolveClassKey: resolveClassKey,
  };

  // Early token pickup (before auth UI) so /api/characters works
  try {
    var early = parseHandoff();
    if (early.token) applyToken(early.token);
    if (early.characterId) {
      lsSet("vox_character_id", early.characterId);
    }
  } catch (e) {
    /* */
  }
})(typeof window !== "undefined" ? window : globalThis);
