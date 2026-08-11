/**
 * Danger Room–style AnimationMixer library for TVS / voxel explorer.
 *
 * SSOT clip map mirrors grudge-warlords-openworld ANIM_FILES (files that exist on CDN).
 * CDN: https://assets.grudge-studio.com/voxgrudge/models/anims/{file}
 *
 * Binds to unit skeleton via track-name filter (same idea as TvsUnitLoader).
 * For procedural limb races (no bones), host should keep NumberKeyframeClip mixer.
 */
(function (global) {
  "use strict";

  var CDN =
    (global.GrudgeFleet &&
      global.GrudgeFleet.endpoints &&
      global.GrudgeFleet.endpoints.assets) ||
    "https://assets.grudge-studio.com";
  var ANIM_BASE = CDN + "/voxgrudge/models/anims";

  /**
   * Role → fbx file (only CDN-verified 200 set; multi-attack falls back to sword-shield-attack).
   * Explorer combat ids map through ROLE_ALIASES.
   */
  var ANIM_FILES = {
    idle: "idle.fbx",
    "walk-fwd": "walk-forward.fbx",
    "walk-back": "walk-back.fbx",
    "walk-left": "walk-left.fbx",
    "walk-right": "walk-right.fbx",
    "run-fwd": "run-forward.fbx",
    "run-back": "run-back.fbx",
    "run-left": "run-left.fbx",
    "run-right": "run-right.fbx",
    sprint: "sprint.fbx",
    jump: "jump.fbx",
    land: "land.fbx",
    "fall-loop": "fall-loop.fbx",
    climb: "climb.fbx",
    swim: "swim.fbx",
    "tread-water": "tread-water.fbx",
    "dodge-fwd": "dodge-forward.fbx",
    "dodge-back": "dodge-back.fbx",
    "dodge-left": "dodge-left.fbx",
    "dodge-right": "dodge-right.fbx",
    death: "death-forward.fbx",
    "hit-react": "hit-react.fbx",
    hit: "Hit.fbx",
    attack: "Attack.fbx",
    "atk-sword-shield": "sword-shield-attack.fbx",
    "block-ss": "sword-shield-block.fbx",
    "atk-greatsword": "greatsword-slash.fbx",
    "atk-gs-spin": "greatsword-spin.fbx",
    "atk-bow": "bow-aim.fbx",
    "atk-magic": "magic-1h-cast.fbx",
    "atk-magic-2h": "magic-2h-attack.fbx",
    "spell-cast": "spell-cast.fbx",
    "atk-pistol": "pistol-idle.fbx",
    // Danger explorer combo stages → shared sword-shield attack (CDN lacks 2–6 variants)
    "atk-ss-1": "sword-shield-attack.fbx",
    "atk-ss-2": "sword-shield-attack.fbx",
    "atk-ss-3": "Attack.fbx",
    "atk-ss-4": "greatsword-slash.fbx",
    "atk-ss-5": "sword-shield-attack.fbx",
    "atk-ss-6": "greatsword-spin.fbx",
    "gs-slide": "greatsword-jump-attack.fbx",
    // harvest / interact reuse cast
    harvest: "magic-1h-cast.fbx",
  };

  /** Semantic gait aliases used by TvsExplorerRig */
  var ROLE_ALIASES = {
    idle: ["idle"],
    walk: ["walk-fwd", "locomotion", "walk"],
    run: ["run-fwd", "sprint", "run", "Run"],
    jump: ["jump"],
    climb: ["climb"],
    death: ["death", "Death"],
    hit: ["hit-react", "hit", "Hit"],
    attack: ["atk-ss-1", "atk-sword-shield", "attack", "Attack"],
    harvest: ["harvest", "atk-magic", "spell-cast"],
    locomotion: ["walk-fwd", "locomotion"],
  };

  /**
   * Baked packages (locomotion / traversal / equipped weapon).
   * Default CORE_LOAD flattens all three (~20 roles for maxClips parity).
   */
  var ANIM_PACKAGES = {
    locomotion: [
      "idle",
      "walk-fwd",
      "walk-back",
      "walk-left",
      "walk-right",
      "run-fwd",
      "run-back",
      "run-left",
      "run-right",
      "sprint",
    ],
    traversal: [
      "jump",
      "land",
      "fall-loop",
      "climb",
      "dodge-fwd",
      "dodge-back",
      "dodge-left",
      "dodge-right",
      "swim",
      "tread-water",
    ],
    weapon: [
      "atk-ss-1",
      "atk-ss-3",
      "atk-ss-6",
      "atk-sword-shield",
      "block-ss",
      "atk-greatsword",
      "atk-gs-spin",
      "gs-slide",
      "atk-bow",
      "atk-magic",
      "atk-magic-2h",
      "spell-cast",
      "harvest",
      "hit-react",
      "death",
      "attack",
    ],
  };

  var CORE_LOAD = []
    .concat([
      "idle",
      "walk-fwd",
      "run-fwd",
      "sprint",
      "jump",
      "climb",
      "dodge-fwd",
      "hit-react",
      "death",
      "atk-ss-1",
      "atk-ss-3",
      "atk-ss-6",
      "atk-greatsword",
      "atk-magic",
      "harvest",
      "block-ss",
      "atk-bow",
      "land",
      "dodge-back",
      "attack",
    ]);

  var clipCache = Object.create(null); // url → Promise<AnimationClip[]>

  function animUrl(file) {
    return ANIM_BASE + "/" + String(file).replace(/^\//, "");
  }

  function collectBoneNames(root) {
    var map = Object.create(null);
    var n = 0;
    root.traverse(function (o) {
      if (o.isBone || o.type === "Bone") {
        map[o.name] = true;
        n++;
        // underscore/space variants
        map[o.name.replace(/ /g, "_")] = true;
        map[o.name.replace(/_/g, " ")] = true;
      }
    });
    return { map: map, count: n };
  }

  function filterClipToSkeleton(clip, boneMap, THREE) {
    if (!clip || !clip.tracks || !THREE) return clip;
    var tracks = [];
    for (var i = 0; i < clip.tracks.length; i++) {
      var t = clip.tracks[i];
      var node = t.name.split(".")[0];
      if (!node) continue;
      if (
        boneMap[node] ||
        boneMap[node.replace(/ /g, "_")] ||
        boneMap[node.replace(/_/g, " ")]
      ) {
        // strip root position tracks for grounded SI kits
        if (/\.position$/.test(t.name) && /hips|pelvis|root|bip001/i.test(node)) continue;
        tracks.push(t);
      }
    }
    if (!tracks.length) return null;
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  function loadFbxClips(url, THREE, FBXLoader) {
    if (clipCache[url]) return clipCache[url];
    clipCache[url] = new Promise(function (resolve, reject) {
      if (!FBXLoader) {
        reject(new Error("FBXLoader missing"));
        return;
      }
      var loader = new FBXLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        url,
        function (obj) {
          resolve((obj && obj.animations) || []);
        },
        undefined,
        function (err) {
          reject(err || new Error("anim load fail " + url));
        }
      );
    });
    return clipCache[url];
  }

  /**
   * Load Danger Room pack onto root. Requires skinned bones for best results.
   * @returns {Promise<{mixer, actions, playClip, updateMixer}|null>}
   */
  async function bindDangerAnims(root, opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    var FBXLoader = opts.FBXLoader || (THREE && THREE.FBXLoader) || global.FBXLoader;
    if (!root || !THREE || !THREE.AnimationMixer) return null;

    var boneInfo = collectBoneNames(root);
    // Procedural limb races: keep existing NumberKeyframe mixer if already attached
    if (boneInfo.count < 4) {
      if (root.userData.mixer && root.userData.playClip) {
        root.userData.dangerAnim = "procedural-limbs";
        return {
          mixer: root.userData.mixer,
          actions: root.userData.animActions,
          playClip: root.userData.playClip,
          updateMixer: root.userData.updateMixer,
        };
      }
      return null;
    }

    var roles = opts.roles || CORE_LOAD;
    var mixer = root.userData.mixer || new THREE.AnimationMixer(root);
    var actions = root.userData.animActions || {};
    var clips = root.userData.animClips || {};
    var current = null;

    await Promise.all(
      roles.map(async function (role) {
        if (actions[role]) return;
        var file = ANIM_FILES[role];
        if (!file) return;
        var url = animUrl(file);
        try {
          var list = await loadFbxClips(url, THREE, FBXLoader);
          if (!list.length) return;
          var clip = null;
          for (var i = 0; i < list.length; i++) {
            var c = list[i].clone();
            c.name = role;
            clip = filterClipToSkeleton(c, boneInfo.map, THREE);
            if (clip) break;
          }
          if (!clip) {
            clip = list[0].clone();
            clip.name = role;
          }
          clips[role] = clip;
          var action = mixer.clipAction(clip);
          action.enabled = true;
          actions[role] = action;
        } catch (e) {
          console.warn("[TvsDangerAnim] fail", role, url, e && e.message);
        }
      })
    );

    // Semantic aliases → first available
    Object.keys(ROLE_ALIASES).forEach(function (sem) {
      if (actions[sem]) return;
      var list = ROLE_ALIASES[sem];
      for (var i = 0; i < list.length; i++) {
        if (actions[list[i]]) {
          actions[sem] = actions[list[i]];
          break;
        }
      }
    });

    function playClip(name, fade) {
      fade = fade == null ? 0.12 : fade;
      var action =
        actions[name] ||
        (ROLE_ALIASES[name] &&
          ROLE_ALIASES[name].map(function (a) {
            return actions[a];
          }).find(Boolean)) ||
        actions.idle ||
        actions["walk-fwd"];
      if (!action) return null;

      var oneShot = /atk|attack|jump|hit|death|dodge|harvest|block|land/i.test(String(name));
      if (current && current !== action) current.fadeOut(fade);
      action.reset();
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);
      if (oneShot) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }
      action.fadeIn(fade).play();
      current = action;
      root.userData.currentAnim = name;
      return action;
    }

    function updateMixer(dt) {
      mixer.update(dt || 0);
    }

    root.userData.mixer = mixer;
    root.userData.animActions = actions;
    root.userData.animClips = clips;
    root.userData.playClip = playClip;
    root.userData.updateMixer = updateMixer;
    root.userData.dangerAnim = "danger-room-fbx";
    root.userData.animCdnBase = ANIM_BASE;
    root.userData.ANIM_FILES = ANIM_FILES;

    if (actions.idle) playClip("idle", 0);
    else if (actions["walk-fwd"]) playClip("walk-fwd", 0);

    return { mixer: mixer, actions: actions, playClip: playClip, updateMixer: updateMixer };
  }

  /** Resolve explorer combat anim id → best loaded action name */
  function resolveCombatAnim(name, actions) {
    actions = actions || {};
    if (actions[name]) return name;
    var file = ANIM_FILES[name];
    if (file) {
      // find role with same file
      for (var k in ANIM_FILES) {
        if (ANIM_FILES[k] === file && actions[k]) return k;
      }
    }
    if (/atk|attack/i.test(name) && actions["atk-ss-1"]) return "atk-ss-1";
    if (/atk|attack/i.test(name) && actions.attack) return "attack";
    return name;
  }

  global.TvsDangerAnim = {
    ANIM_FILES: ANIM_FILES,
    ROLE_ALIASES: ROLE_ALIASES,
    ANIM_BASE: ANIM_BASE,
    ANIM_PACKAGES: ANIM_PACKAGES,
    CORE_LOAD: CORE_LOAD,
    bindDangerAnims: bindDangerAnims,
    resolveCombatAnim: resolveCombatAnim,
    animUrl: animUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
