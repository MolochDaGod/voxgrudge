/**
 * VoxGrudge UI dependency registry — always absolute /assets paths.
 * Preloads CraftPix kit + class emblems; repairs broken <img> with fallbacks.
 */
(function (global) {
  "use strict";

  var UI = "/assets/grudge-game/ui/";
  var EMBLEM = "/assets/grudge-game/class-emblems/";
  var BRAND = "/branding/";
  var FALLBACK_ICON = BRAND + "logo-256.png";

  var MANIFEST = {
    "window.bg": UI + "Window/Window_Background.png",
    "window.header": UI + "Window/Window_Header_Background.png",
    "window.close": UI + "Window/Window_CloseBtn_Background.png",
    "modal.bg": UI + "Modal_Box/ModalBox_Background.png",
    "menu.bg": UI + "Window/Menu/Window_Menu_Background.png",
    "menu.active": UI + "Window/Menu/Window_Menu_Active.png",
    "menu.hover": UI + "Window/Menu/Window_Menu_Hover.png",
    "notif.bg": UI + "Notifications/Notification_Background.png",
    "tab.bg": UI + "Spell_Book/Tabs/SpellBook_Tab_Background.png",
    "tab.active": UI + "Spell_Book/Tabs/SpellBook_Tab_Background_Active.png",
    "tab.hover": UI + "Spell_Book/Tabs/SpellBook_Tab_Hover.png",

    "btn.lg": UI + "Buttons/Rectangular/Large/Button_RL_Background.png",
    "btn.lg.yellow": UI + "Buttons/Rectangular/Large/Button_RL_Background_Yellow.png",
    "btn.md": UI + "Buttons/Rectangular/Medium/Button_RM_Background.png",
    "btn.sm": UI + "Buttons/Rectangular/Small/Buttom_RS_Background.png",
    "btn.sm.red": UI + "Buttons/Rectangular/Small/Buttom_RS_Foreground_Red.png",
    "btn.sm.green": UI + "Buttons/Rectangular/Small/Buttom_RS_Foreground_Green.png",

    "carousel.left": UI + "Character_Select/Buttons/CharacterSelect_Arrow_Left_Background.png",
    "carousel.left.hover": UI + "Character_Select/Buttons/CharacterSelect_Arrow_Left_Hover.png",
    "carousel.glow": UI + "Character_Select/CharacterSelect_Glow.png",
    "carousel.bar": UI + "Character_Select/CharacterSelect_BottomBar_Middle.png",

    "unitFrame.bg": UI + "Unit_Frames/Main/UnitFrame_Background.png",
    "unitFrame.elite": UI + "Unit_Frames/Main/UnitFrame_Elite.png",
    "unitFrame.border": UI + "Unit_Frames/Main/UnitFrame_Red_Border.png",
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

    "slot.skill": UI + "Action_Bar/Slots/ActionBar_Slot_Background.png",
    "slot.skill.hover": UI + "Action_Bar/Slots/ActionBar_Slot_Hover.png",
    "slot.inv": UI + "Inventory/Inventory_Slot_Background.png",
    "cast.track": UI + "Cast_Bars/CastBar_Bar_Background.png",
    "cast.fill": UI + "Cast_Bars/CastBar_Bar_Fill.png",
    "xp.track": UI + "Action_Bar/XP_Bar/ActionBar_XP_Background.png",
    "xp.fill": UI + "Action_Bar/XP_Bar/ActionBar_XP_Fill.png",
    "load.radial": UI + "Loading/Loading_Radial_Background.png",
    "tooltip.bg": UI + "Tooltip/Tooltip_Background.png",

    "emblem.warrior": EMBLEM + "warrior.webp",
    "emblem.ranger": EMBLEM + "ranger.webp",
    "emblem.mage": EMBLEM + "mage.webp",
    "emblem.worge": EMBLEM + "worge.webp",

    "brand.logo": BRAND + "logo-256.png",
    "brand.og": BRAND + "og-image.png",
  };

  var cache = Object.create(null);
  var ready = false;

  function absUrl(path) {
    if (!path) return FALLBACK_ICON;
    if (/^https?:\/\//i.test(path) || path.indexOf("data:") === 0) return path;
    if (path.charAt(0) === "/") return path;
    return "/" + path.replace(/^\.?\//, "");
  }

  function url(id) {
    return absUrl(MANIFEST[id] || FALLBACK_ICON);
  }

  function preloadOne(src) {
    src = absUrl(src);
    return new Promise(function (resolve) {
      if (cache[src] && cache[src].ok) return resolve(cache[src]);
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

  function groups() {
    return {
      critical: [
        "window.bg", "window.header", "modal.bg", "btn.lg", "btn.lg.yellow", "btn.md",
        "carousel.left", "carousel.glow", "tab.bg", "tab.active", "menu.bg", "menu.active",
        "unitFrame.bg", "unitFrame.hp", "unitFrame.mp", "unitFrame.avatar.overlay",
        "party.bg", "party.hp", "brand.logo",
        "emblem.warrior", "emblem.ranger", "emblem.mage", "emblem.worge",
        "slot.skill", "slot.inv",
      ],
      hud: [
        "cast.track", "cast.fill", "xp.track", "xp.fill",
        "unitFrame.level", "unitFrame.role.sword", "unitFrame.border", "notif.bg", "tooltip.bg",
      ],
      optional: Object.keys(MANIFEST),
    };
  }

  async function preload(opts) {
    opts = opts || {};
    var g = groups();
    var ids = opts.group === "all" ? g.optional : (g[opts.group] || g.critical).concat(opts.extra || []);
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
    // Parallel batches of 8
    for (var i = 0; i < list.length; i += 8) {
      var batch = list.slice(i, i + 8);
      var part = await Promise.all(
        batch.map(function (id) {
          return preloadOne(MANIFEST[id]).then(function (r) {
            done++;
            if (opts.onProgress) {
              opts.onProgress({
                pct: Math.round((done / list.length) * 100),
                id: id,
                ok: r.ok,
                done: done,
                total: list.length,
              });
            }
            return r;
          });
        })
      );
      results = results.concat(part);
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
    groups().critical.forEach(function (id) {
      var src = absUrl(MANIFEST[id]);
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
      "--vox-png-tab": "tab.bg",
      "--vox-png-tab-active": "tab.active",
      "--vox-png-menu": "menu.bg",
      "--vox-png-menu-active": "menu.active",
    };
    Object.keys(map).forEach(function (cssVar) {
      root.style.setProperty(cssVar, "url('" + url(map[cssVar]) + "')");
    });
  }

  /** Safe image apply for elements — never leaves broken icons */
  function setImage(el, src, fallback) {
    if (!el) return;
    var primary = absUrl(src || fallback || FALLBACK_ICON);
    var fb = absUrl(fallback || FALLBACK_ICON);
    if (el.tagName === "IMG") {
      el.onerror = function () {
        if (el.src.indexOf(fb) >= 0) return;
        el.onerror = null;
        el.src = fb;
      };
      el.src = primary;
      el.loading = "lazy";
      el.decoding = "async";
    } else {
      el.style.backgroundImage = "url('" + primary + "')";
      // probe
      preloadOne(primary).then(function (r) {
        if (!r.ok) el.style.backgroundImage = "url('" + fb + "')";
      });
    }
  }

  /** Patch all broken images under root */
  function repairBrokenImages(root) {
    root = root || document;
    var imgs = root.querySelectorAll("img");
    imgs.forEach(function (img) {
      if (img.dataset.voxRepaired) return;
      img.dataset.voxRepaired = "1";
      img.addEventListener("error", function onErr() {
        img.removeEventListener("error", onErr);
        if (img.src.indexOf("logo-256") >= 0) return;
        img.src = FALLBACK_ICON;
        img.style.objectFit = "contain";
        img.style.opacity = "0.85";
      });
      // already broken naturalWidth 0 after load
      if (img.complete && img.naturalWidth === 0 && img.src) {
        img.src = FALLBACK_ICON;
      }
    });
  }

  /** Fix grudge-hud.css relative paths that break when CSS is deep-linked */
  function patchHudCssBase() {
    // Force absolute CSS custom properties used by grudge-hud.css if present
    var root = document.documentElement;
    var patches = {
      "--gg-btn-lg": UI + "Buttons/Rectangular/Large/Button_RL_Background.png",
      "--gg-btn-lg-yellow": UI + "Buttons/Rectangular/Large/Button_RL_Background_Yellow.png",
      "--gg-btn-md": UI + "Buttons/Rectangular/Medium/Button_RM_Background.png",
      "--gg-window": UI + "Window/Window_Background.png",
      "--gg-window-header": UI + "Window/Window_Header_Background.png",
      "--gg-modal": UI + "Modal_Box/ModalBox_Background.png",
      "--gg-slot-skill": UI + "Action_Bar/Slots/ActionBar_Slot_Background.png",
      "--gg-slot-inv": UI + "Inventory/Inventory_Slot_Background.png",
      "--gg-unitframe": UI + "Unit_Frames/Main/UnitFrame_Background.png",
      "--gg-hp-fill": UI + "Unit_Frames/Main/Bars/UnitFrame_HP_Fill_Red.png",
      "--gg-mp-fill": UI + "Unit_Frames/Main/Bars/UnitFrame_MP_Fill_Green.png",
      "--gg-tab": UI + "Spell_Book/Tabs/SpellBook_Tab_Background.png",
      "--gg-tab-active": UI + "Spell_Book/Tabs/SpellBook_Tab_Background_Active.png",
      "--gg-menu": UI + "Window/Menu/Window_Menu_Background.png",
      "--gg-menu-active": UI + "Window/Menu/Window_Menu_Active.png",
    };
    Object.keys(patches).forEach(function (k) {
      root.style.setProperty(k, "url('" + patches[k] + "')");
    });
  }

  global.VoxUiDeps = {
    MANIFEST: MANIFEST,
    FALLBACK_ICON: FALLBACK_ICON,
    url: url,
    absUrl: absUrl,
    preload: preload,
    check: check,
    groups: groups,
    applyCssVars: applyCssVars,
    setImage: setImage,
    repairBrokenImages: repairBrokenImages,
    patchHudCssBase: patchHudCssBase,
    isReady: function () { return ready; },
  };
})(typeof window !== "undefined" ? window : globalThis);
