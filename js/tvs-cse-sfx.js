/**
 * CSE combat SFX (mattflat — CC BY-ND 3.0, unmodified WAVs).
 *
 * CDN: https://assets.grudge-studio.com/audio/cse/sfx/
 * Catalog: …/catalog.json
 *
 * Best game usage (roles):
 *   combat_hit / combat_hit_light / combat_hit_heavy  — melee land
 *   ranged_fire / ranged_light / ranged_heavy         — bow/gun/bolt
 *   explosion                                         — AOE / barrel
 *   ui_misc                                           — rare interact ping
 *
 * Pair with Kenney for footsteps / harvest / UI clicks (kenney-audio skill).
 * Do not re-encode these files.
 */
(function (global) {
  "use strict";

  var CDN =
    (global.GrudgeFleet &&
      global.GrudgeFleet.endpoints &&
      global.GrudgeFleet.endpoints.assets) ||
    "https://assets.grudge-studio.com";
  var BASE = CDN + "/audio/cse/sfx";
  var CATALOG_URL = BASE + "/catalog.json";

  var FALLBACK_ROLES = {
    combat_hit: {
      files: ["hit_1.wav", "hit_2.wav", "hit_3.wav", "hit_4.wav", "hit_5.wav"],
      pick: "random",
      volume: 0.55,
    },
    combat_hit_light: { files: ["hit_4.wav", "hit_5.wav"], pick: "random", volume: 0.4 },
    combat_hit_heavy: {
      files: ["hit_1.wav", "hit_2.wav", "hit_3.wav"],
      pick: "random",
      volume: 0.7,
    },
    ranged_fire: {
      files: ["shot_2.wav", "shot_7.wav", "shot_10.wav"],
      pick: "random",
      volume: 0.5,
    },
    ranged_light: { files: ["shot_2.wav"], pick: "first", volume: 0.45 },
    ranged_heavy: { files: ["shot_7.wav", "shot_10.wav"], pick: "random", volume: 0.6 },
    explosion: { files: ["explosion_4.wav"], pick: "first", volume: 0.65 },
    ui_misc: { files: ["misc_2.wav"], pick: "first", volume: 0.35 },
  };

  /** Map anim / intent names → SFX roles for AI / player one-shots. */
  var ANIM_TO_ROLE = {
    attack: "combat_hit",
    slash: "combat_hit",
    hit: "combat_hit",
    dig: "combat_hit_light",
    command: "ui_misc",
    aim: null,
    cast: "ranged_heavy",
    fire: "ranged_fire",
    shoot: "ranged_fire",
    explosion: "explosion",
    death: "combat_hit_heavy",
  };

  var catalog = null;
  var catalogPromise = null;
  var buffers = Object.create(null); // file → AudioBuffer | HTMLAudioElement cache
  var ctx = null;
  var masterGain = null;
  var muted = false;
  var masterVol = 1;

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = masterVol;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    var c = ensureCtx();
    if (c && c.state === "suspended") return c.resume();
    return Promise.resolve();
  }

  function loadCatalog() {
    if (catalog) return Promise.resolve(catalog);
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch(CATALOG_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("catalog " + r.status);
        return r.json();
      })
      .then(function (j) {
        catalog = j;
        return j;
      })
      .catch(function () {
        catalog = {
          roles: FALLBACK_ROLES,
          attribution: "Sound effects by Mattis Flettner (mattflat) — CC BY-ND 3.0",
          cdnBase: BASE,
        };
        return catalog;
      });
    return catalogPromise;
  }

  function roles() {
    return (catalog && catalog.roles) || FALLBACK_ROLES;
  }

  function pickFile(roleDef) {
    if (!roleDef || !roleDef.files || !roleDef.files.length) return null;
    if (roleDef.pick === "first") return roleDef.files[0];
    var i = Math.floor(Math.random() * roleDef.files.length);
    return roleDef.files[i];
  }

  function loadBuffer(file) {
    if (buffers[file]) return Promise.resolve(buffers[file]);
    var url = BASE + "/" + file;
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error(file + " " + r.status);
        return r.arrayBuffer();
      })
      .then(function (ab) {
        var c = ensureCtx();
        if (!c) return null;
        return new Promise(function (resolve, reject) {
          c.decodeAudioData(
            ab.slice(0),
            function (buf) {
              buffers[file] = buf;
              resolve(buf);
            },
            reject
          );
        });
      })
      .catch(function (e) {
        console.warn("[TvsCseSfx] load fail", file, e && e.message);
        return null;
      });
  }

  /**
   * Play a role. opts: { volume, rate }
   * Returns Promise<boolean>
   */
  function play(role, opts) {
    opts = opts || {};
    if (muted) return Promise.resolve(false);
    return resume()
      .then(function () {
        return loadCatalog();
      })
      .then(function () {
        var def = roles()[role];
        if (!def) {
          console.warn("[TvsCseSfx] unknown role", role);
          return false;
        }
        var file = pickFile(def);
        if (!file) return false;
        return loadBuffer(file).then(function (buf) {
          if (!buf || !ctx || !masterGain) {
            // HTMLAudio fallback
            try {
              var a = new Audio(BASE + "/" + file);
              a.volume = Math.min(
                1,
                (opts.volume != null ? opts.volume : def.volume || 0.5) * masterVol
              );
              a.play().catch(function () {});
              return true;
            } catch (e) {
              return false;
            }
          }
          var src = ctx.createBufferSource();
          src.buffer = buf;
          if (opts.rate) src.playbackRate.value = opts.rate;
          var g = ctx.createGain();
          var vol = (opts.volume != null ? opts.volume : def.volume != null ? def.volume : 0.5);
          g.gain.value = Math.max(0, Math.min(1, vol));
          src.connect(g);
          g.connect(masterGain);
          src.start(0);
          return true;
        });
      });
  }

  /** Play SFX matching an anim / intent name (attack → combat_hit, …). */
  function playForAnim(animName, opts) {
    var key = String(animName || "")
      .toLowerCase()
      .replace(/^atk-/, "attack");
    var role = ANIM_TO_ROLE[key];
    if (!role) {
      // substring match
      if (/attack|slash|strike|hit|dig/.test(key)) role = "combat_hit";
      else if (/cast|spell/.test(key)) role = "ranged_heavy";
      else if (/shoot|fire|bow|aim/.test(key) && /fire|shoot/.test(key)) role = "ranged_fire";
      else if (/explod|boom/.test(key)) role = "explosion";
      else return Promise.resolve(false);
    }
    return play(role, opts);
  }

  /** Prefetch common combat buffers. */
  function warm(rolesList) {
    rolesList = rolesList || ["combat_hit", "ranged_fire", "explosion"];
    return loadCatalog().then(function () {
      var files = {};
      rolesList.forEach(function (r) {
        var def = roles()[r];
        if (!def) return;
        (def.files || []).forEach(function (f) {
          files[f] = true;
        });
      });
      return Promise.all(Object.keys(files).map(loadBuffer));
    });
  }

  function setMasterVolume(v) {
    masterVol = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = masterVol;
  }

  function setMuted(m) {
    muted = !!m;
  }

  function attribution() {
    return (
      (catalog && catalog.attribution) ||
      "Sound effects by Mattis Flettner (mattflat) — CC BY-ND 3.0"
    );
  }

  var api = {
    BASE: BASE,
    CATALOG_URL: CATALOG_URL,
    FALLBACK_ROLES: FALLBACK_ROLES,
    ANIM_TO_ROLE: ANIM_TO_ROLE,
    loadCatalog: loadCatalog,
    play: play,
    playForAnim: playForAnim,
    warm: warm,
    resume: resume,
    setMasterVolume: setMasterVolume,
    setMuted: setMuted,
    attribution: attribution,
    roles: roles,
  };

  global.TvsCseSfx = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
