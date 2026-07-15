/**
 * VoxGrudge UI dependency registry — PNG frames, containers, carousels, AI unit frames.
 * Preloads CraftPix / grudge-game kit so class screen + HUD never flash unstyled.
 *
 *   await VoxUiDeps.preload({ onProgress });
 *   VoxUiDeps.url('unitFrame.bg')
 *   VoxUiDeps.check()
 */
(function (global) {
  "use strict";

  var UI = "assets/grudge-game/ui/";
  var EMBLEM = "assets/grudge-game/class-emblems/";
  var BRAND = "branding/";

  /** Logical id → relative PNG path (same-origin). */
  var MANIFEST = {
    // Containers / windows
    "window.bg": UI + "Window/Window_Background.png",
    "window.header": UI + "Window/Window_Header_Background.png",
    "window.close": UI + "Window/Window_CloseBtn_Background.png",
    "modal.bg": UI + "Modal_Box/ModalBox_Background.png",
    "menu.bg": UI + "Window/Menu/Window_Menu_Background.png",
    "menu.active": UI + "Window/Menu/Window_Menu_Active.png",
    "notif.bg": UI + "Notifications/Notification_Background.png",

    // Buttons
    "btn.lg": UI + "Buttons/Rectangular/Large/Button_RL_Background.png",
    "btn.lg.yellow": UI + "Buttons/Rectangular/Large/Button_RL_Background_Yellow.png",
    "btn.md": UI + "Buttons/Rectangular/Medium/Button_RM_Background.png",
    "btn.sm": UI + "Buttons/Rectangular/Small/Buttom_RS_Background.png",
    "btn.sm.red": UI + "Buttons/Rectangular/Small/Buttom_RS_Foreground_Red.png",
    "btn.sm.green": UI + "Buttons/Rectangular/Small/Buttom_RS_Foreground_Green.png",

    // Carousel arrows (character select)
    "carousel.left": UI + "Character_Select/Buttons/CharacterSelect_Arrow_Left_Background.png",
    "carousel.left.hover": UI + "Character_Select/Buttons/CharacterSelect_Arrow_Left_Hover.png",
    "carousel.glow": UI + "Character_Select/CharacterSelect_Glow.png",
    "carousel.bar": UI + "Character_Select/CharacterSelect_BottomBar_Middle.png",

    // Unit frames (player XY + AI/party frames)
    "unitFrame.bg": UI + "Unit_Frames/Main/UnitFrame_Background.png",
    "unitFrame.elite": UI + "Unit_Frames/Main/UnitFrame_Elite.png",
    "unitFrame.border": UI + "Unit_Frames/Main/UnitFrame_Red_Border.png",
    "unitFrame.avatar.mask": UI + "Unit_Frames/Main/Avatar/UnitFrame_Avatar_Mask.png",
    "unitFrame.avatar.overlay": UI + "Unit_Frames/Main/Avatar/UnitFrame_Avatar_Overlay.png",
    "unitFrame.avatar.example": UI + "Unit_Frames/Main/Avatar/UnitFrame_Avatar_Example.png",
    "unitFrame.hp": UI + "Unit_Frames/Main/Bars/UnitFrame_HP_Fill_Red.png",
    "unitFrame.mp": UI + "Unit_Frames/Main/Bars/UnitFrame_MP_Fill_Green.png",
    "unitFrame.level": UI + "Unit_Frames/Main/Level/UnitFrame_Level_Background.png",
    "unitFrame.role.sword": UI + "Unit_Frames/Main/Role/UnitFrame_Role_Sword.png",
    "unitFrame.role.shield": UI + "Unit_Frames/Main/Role/UnitFrame_Role_Shield.png",
    "unitFrame.role.magic": UI + "Unit_Frames/Main/Role/UnitFrame_Role_Lightning.png",
    "party.bg": UI + "Unit_Frames/Party/UnitFrame_Party_Background.png",
    "party.hp": UI + "Unit_Frames/Party/Bars/UnitFrame_Party_HP_Fill_Red.png",
    "party.mp": UI + "Unit_Frames/Party/Bars/UnitFrame_Party_MP_Fill_Blue.png",
    "party.avatar.overlay": UI + "Unit_Frames/Party/Avatar/UnitFrame_Party_Avatar_Overlay.png",

    // Slots / bars
    "slot.skill": UI + "Action_Bar/Slots/ActionBar_Slot_Background.png",
    "slot.inv": UI + "Inventory/Inventory_Slot_Background.png",
    "cast.track": UI + "Cast_Bars/CastBar_Bar_Background.png",
    "cast.fill": UI + "Cast_Bars/CastBar_Bar_Fill.png",
    "xp.track": UI + "Action_Bar/XP_Bar/ActionBar_XP_Background.png",
    "xp.fill": UI + "Action_Bar/XP_Bar/ActionBar_XP_Fill.png",

    // Loading
    "load.radial": UI + "Loading/Loading_Radial_Background.png",

    // Class emblems
    "emblem.warrior": EMBLEM + "warrior.webp",
    "emblem.ranger": EMBLEM + "ranger.webp",
    "emblem.mage": EMBLEM + "mage.webp",
    "emblem.worge": EMBLEM + "worge.webp",

    // Branding
    "brand.logo": BRAND + "logo-256.png",
    "brand.og": BRAND + "og-image.png",
  };

  var cache = Object.create(null);
  var ready = false;

  function url(id) {
    return MANIFEST[id] || "";
  }

  function preloadOne(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve({ src: src, ok: false });
      if (cache[src]) return resolve(cache[src]);
      var img = new Image();
      img.decoding = "async";
      img.onload = function () {
        cache[src] = { src: src, ok: true, img: img, w: img.naturalWidth, h: img.naturalHeight };
        resolve(cache[src]);
      };
      img.onerror = function () {
        cache[src] = { src: src, ok: false };
        resolve(cache[src]);
      };
      img.src = src;
    });
  }

  /**
   * Preload priority groups for staged boot.
   * critical → class screen / carousel / unit frames
   * hud → in-game bars
   * optional → rest
   */
  function groups() {
    return {
      critical: [
        "window.bg", "window.header", "modal.bg", "btn.lg", "btn.lg.yellow", "btn.md",
        "carousel.left", "carousel.glow", "carousel.bar",
        "unitFrame.bg", "unitFrame.hp", "unitFrame.mp", "unitFrame.avatar.overlay",
        "party.bg", "party.hp", "brand.logo",
        "emblem.warrior", "emblem.ranger", "emblem.mage",
      ],
      hud: [
        "slot.skill", "slot.inv", "cast.track", "cast.fill", "xp.track", "xp.fill",
        "unitFrame.level", "unitFrame.role.sword", "unitFrame.border", "notif.bg",
      ],
      optional: Object.keys(MANIFEST),
    };
  }

  async function preload(opts) {
    opts = opts || {};
    var g = groups();
    var ids = opts.group === "all"
      ? g.optional
      : (g[opts.group] || g.critical).concat(opts.extra || []);
    // unique
    var seen = {};
    var list = [];
    ids.forEach(function (id) {
      if (!seen[id] && MANIFEST[id]) {
        seen[id] = 1;
        list.push(id);
      }
    });
    var done = 0;
    var results = [];
    for (var i = 0; i < list.length; i++) {
      var r = await preloadOne(MANIFEST[list[i]]);
      results.push(r);
      done++;
      if (opts.onProgress) {
        opts.onProgress({
          pct: Math.round((done / list.length) * 100),
          id: list[i],
          ok: r.ok,
          done: done,
          total: list.length,
        });
      }
    }
    ready = true;
    return {
      ok: results.every(function (x) { return x.ok; }),
      loaded: results.filter(function (x) { return x.ok; }).length,
      failed: results.filter(function (x) { return !x.ok; }).length,
      total: results.length,
    };
  }

  function check() {
    var missing = [];
    var critical = groups().critical;
    critical.forEach(function (id) {
      var src = MANIFEST[id];
      var c = cache[src];
      if (!c || !c.ok) missing.push(id);
    });
    return { ok: missing.length === 0, missing: missing, ready: ready };
  }

  function applyCssVars(root) {
    root = root || document.documentElement;
    var map = {
      "--vox-png-window": "window.bg",
      "--vox-png-header": "window.header",
      "--vox-png-modal": "modal.bg",
      "--vox-png-btn-lg": "btn.lg",
      "--vox-png-btn-lg-yellow": "btn.lg.yellow",
      "--vox-png-btn-md": "btn.md",
      "--vox-png-carousel-left": "carousel.left",
      "--vox-png-carousel-glow": "carousel.glow",
      "--vox-png-unit": "unitFrame.bg",
      "--vox-png-unit-hp": "unitFrame.hp",
      "--vox-png-unit-mp": "unitFrame.mp",
      "--vox-png-party": "party.bg",
      "--vox-png-party-hp": "party.hp",
      "--vox-png-slot": "slot.skill",
      "--vox-png-xp-track": "xp.track",
      "--vox-png-xp-fill": "xp.fill",
    };
    Object.keys(map).forEach(function (cssVar) {
      var u = url(map[cssVar]);
      if (u) root.style.setProperty(cssVar, "url('" + u + "')");
    });
  }

  global.VoxUiDeps = {
    MANIFEST: MANIFEST,
    url: url,
    preload: preload,
    check: check,
    groups: groups,
    applyCssVars: applyCssVars,
    isReady: function () { return ready; },
  };
})(typeof window !== "undefined" ? window : globalThis);
