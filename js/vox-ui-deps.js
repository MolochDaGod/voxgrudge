/**
 * VoxGrudge UI dependency registry — R2 CDN via GrudgeAssets when live,
 * local /assets fallback, image repair chain.
 */
(function (global) {
  "use strict";

  /** Logical relative keys (resolved at runtime to CDN or local). */
  var REL = {
    "window.bg": "Window/Window_Background.png",
    "window.header": "Window/Window_Header_Background.png",
    "window.close": "Window/Window_CloseBtn_Background.png",
    "modal.bg": "Modal_Box/ModalBox_Background.png",
    "menu.bg": "Window/Menu/Window_Menu_Background.png",
    "menu.active": "Window/Menu/Window_Menu_Active.png",
    "menu.hover": "Window/Menu/Window_Menu_Hover.png",
    "notif.bg": "Notifications/Notification_Background.png",
    "tab.bg": "Spell_Book/Tabs/SpellBook_Tab_Background.png",
    "tab.active": "Spell_Book/Tabs/SpellBook_Tab_Background_Active.png",
    "tab.hover": "Spell_Book/Tabs/SpellBook_Tab_Hover.png",
    "chat.tab": "Chat/Tabs/Chat_Tab_Normal.png",
    "chat.tab.active": "Chat/Tabs/Chat_Tab_Active.png",
    "chat.tab.hover": "Chat/Tabs/Chat_Tab_Hover.png",
    "chat.tab.press": "Chat/Tabs/Chat_Tab_Press.png",
    "tooltip.anchor": "Tooltip/Tooltip_Anchor.png",
    "btn.lg": "Buttons/Rectangular/Large/Button_RL_Background.png",
    "btn.lg.yellow": "Buttons/Rectangular/Large/Button_RL_Background_Yellow.png",
    "btn.md": "Buttons/Rectangular/Medium/Button_RM_Background.png",
    "btn.sm": "Buttons/Rectangular/Small/Buttom_RS_Background.png",
    "btn.sm.red": "Buttons/Rectangular/Small/Buttom_RS_Foreground_Red.png",
    "btn.sm.green": "Buttons/Rectangular/Small/Buttom_RS_Foreground_Green.png",
    "carousel.left": "Character_Select/Buttons/CharacterSelect_Arrow_Left_Background.png",
    "carousel.left.hover": "Character_Select/Buttons/CharacterSelect_Arrow_Left_Hover.png",
    "carousel.glow": "Character_Select/CharacterSelect_Glow.png",
    "carousel.bar": "Character_Select/CharacterSelect_BottomBar_Middle.png",
    "unitFrame.bg": "Unit_Frames/Main/UnitFrame_Background.png",
    "unitFrame.elite": "Unit_Frames/Main/UnitFrame_Elite.png",
    "unitFrame.border": "Unit_Frames/Main/UnitFrame_Red_Border.png",
    "unitFrame.avatar.overlay": "Unit_Frames/Main/Avatar/UnitFrame_Avatar_Overlay.png",
    "unitFrame.avatar.example": "Unit_Frames/Main/Avatar/UnitFrame_Avatar_Example.png",
    "unitFrame.hp": "Unit_Frames/Main/Bars/UnitFrame_HP_Fill_Red.png",
    "unitFrame.mp": "Unit_Frames/Main/Bars/UnitFrame_MP_Fill_Green.png",
    "unitFrame.level": "Unit_Frames/Main/Level/UnitFrame_Level_Background.png",
    "unitFrame.role.sword": "Unit_Frames/Main/Role/UnitFrame_Role_Sword.png",
    "unitFrame.role.shield": "Unit_Frames/Main/Role/UnitFrame_Role_Shield.png",
    "unitFrame.role.magic": "Unit_Frames/Main/Role/UnitFrame_Role_Lightning.png",
    "party.bg": "Unit_Frames/Party/UnitFrame_Party_Background.png",
    "party.hp": "Unit_Frames/Party/Bars/UnitFrame_Party_HP_Fill_Red.png",
    "party.mp": "Unit_Frames/Party/Bars/UnitFrame_Party_MP_Fill_Blue.png",
    "slot.skill": "Action_Bar/Slots/ActionBar_Slot_Background.png",
    "slot.skill.hover": "Action_Bar/Slots/ActionBar_Slot_Hover.png",
    "slot.inv": "Inventory/Inventory_Slot_Background.png",
    "cast.track": "Cast_Bars/CastBar_Bar_Background.png",
    "cast.fill": "Cast_Bars/CastBar_Bar_Fill.png",
    "xp.track": "Action_Bar/XP_Bar/ActionBar_XP_Background.png",
    "xp.fill": "Action_Bar/XP_Bar/ActionBar_XP_Fill.png",
    "load.radial": "Loading/Loading_Radial_Background.png",
    "tooltip.bg": "Tooltip/Tooltip_Background.png",
  };

  var EMBLEM_IDS = { "emblem.warrior": "warrior", "emblem.ranger": "ranger", "emblem.mage": "mage", "emblem.worge": "worge" };
  var BRAND_IDS = { "brand.logo": "logo-256.png", "brand.og": "og-image.png" };

  function resolveRel(id) {
    var GA = global.GrudgeAssets;
    if (EMBLEM_IDS[id]) {
      if (GA && GA.emblemUrl) return GA.emblemUrl(EMBLEM_IDS[id]);
      return "/assets/grudge-game/class-emblems/" + EMBLEM_IDS[id] + ".webp";
    }
    if (BRAND_IDS[id]) {
      if (GA && GA.brandingUrl) return GA.brandingUrl(BRAND_IDS[id]);
      return "/branding/" + BRAND_IDS[id];
    }
    var rel = REL[id];
    if (!rel) return null;
    if (GA && GA.uiFrame) return GA.uiFrame(rel);
    return "/assets/grudge-game/ui/" + rel;
  }

  function buildManifest() {
    var m = {};
    Object.keys(REL).forEach(function (k) { m[k] = resolveRel(k); });
    Object.keys(EMBLEM_IDS).forEach(function (k) { m[k] = resolveRel(k); });
    Object.keys(BRAND_IDS).forEach(function (k) { m[k] = resolveRel(k); });
    return m;
  }

  var MANIFEST = buildManifest();
  var FALLBACK_ICON = resolveRel("brand.logo") || "/branding/logo-256.png";

  var cache = Object.create(null);
  var ready = false;

  function absUrl(path) {
    if (!path) return FALLBACK_ICON;
    if (/^https?:\/\//i.test(path) || path.indexOf("data:") === 0 || path.indexOf("blob:") === 0) return path;
    var clean = String(path).replace(/\\/g, "/").replace(/^\.?\//, "");
    while (clean.indexOf("../") === 0) clean = clean.slice(3);
    if (clean.indexOf("/") < 0 && /\.(png|webp|jpg|jpeg|gif)$/i.test(clean)) {
      var keys = Object.keys(REL);
      for (var i = 0; i < keys.length; i++) {
        if (REL[keys[i]].slice(-clean.length) === clean) {
          return resolveRel(keys[i]);
        }
      }
      if (global.GrudgeAssets && GrudgeAssets.uiFrame) return GrudgeAssets.uiFrame(clean);
      clean = "assets/grudge-game/ui/" + clean;
    }
    if (clean.charAt(0) !== "/") clean = "/" + clean;
    // Prefer CDN remap for /assets/grudge-game/* when live
    if (global.GrudgeAssets && GrudgeAssets.useR2 && GrudgeAssets.useR2()) {
      if (clean.indexOf("/assets/grudge-game/ui/") === 0) {
        return GrudgeAssets.uiFrame(clean.replace("/assets/grudge-game/ui/", ""));
      }
      if (clean.indexOf("/assets/grudge-game/class-emblems/") === 0) {
        return GrudgeAssets.emblemUrl(clean.split("/").pop().replace(/\.webp$/i, ""));
      }
      if (clean.indexOf("/branding/") === 0) {
        return GrudgeAssets.brandingUrl(clean.replace("/branding/", ""));
      }
    }
    try {
      if (typeof location !== "undefined" && location.origin && location.origin.indexOf("http") === 0) {
        return location.origin + clean;
      }
    } catch (e) { /* ignore */ }
    return clean;
  }

  function url(id) {
    // Rebuild from resolver so CDN flag stays current
    var resolved = resolveRel(id);
    return absUrl(resolved || MANIFEST[id] || FALLBACK_ICON);
  }

  function refreshManifest() {
    MANIFEST = buildManifest();
    FALLBACK_ICON = resolveRel("brand.logo") || "/branding/logo-256.png";
    return MANIFEST;
  }

  function localMirror(src) {
    // CDN miss → same-origin Vercel path
    if (!src || src.indexOf("assets.grudge-studio.com") < 0) return null;
    var m = src.match(/\/voxgrudge\/(assets\/.+|branding\/.+)$/);
    if (m) return "/" + m[1];
    m = src.match(/\/voxgrudge\/assets\/grudge-game\/ui\/(.+)$/);
    if (m) return "/assets/grudge-game/ui/" + m[1];
    return null;
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
        var alt = localMirror(src);
        if (alt && alt !== src) {
          img.onload = function () {
            cache[src] = { src: alt, ok: true, img: img, w: img.naturalWidth, h: img.naturalHeight, fallback: true };
            resolve(cache[src]);
          };
          img.onerror = function () {
            cache[src] = { src: src, ok: false };
            resolve(cache[src]);
          };
          img.src = alt;
          return;
        }
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
        "chat.tab", "chat.tab.active",
        "unitFrame.bg", "unitFrame.hp", "unitFrame.mp", "unitFrame.avatar.overlay",
        "party.bg", "party.hp", "brand.logo",
        "emblem.warrior", "emblem.ranger", "emblem.mage", "emblem.worge",
        "slot.skill", "slot.inv", "notif.bg", "tooltip.bg",
      ],
      hud: [
        "cast.track", "cast.fill", "xp.track", "xp.fill",
        "unitFrame.level", "unitFrame.role.sword", "unitFrame.border", "notif.bg", "tooltip.bg",
        "chat.tab", "chat.tab.active", "chat.tab.hover",
      ],
      optional: Object.keys(MANIFEST),
    };
  }

  async function preload(opts) {
    opts = opts || {};
    refreshManifest();
    var g = groups();
    var ids = opts.group === "all" ? g.optional : (g[opts.group] || g.critical).concat(opts.extra || []);
    var seen = {};
    var list = [];
    ids.forEach(function (id) {
      if (!seen[id] && (REL[id] || EMBLEM_IDS[id] || BRAND_IDS[id])) {
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
          return preloadOne(url(id)).then(function (r) {
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
      var src = url(id);
      var c = cache[src];
      // also accept local-mirror success under different cache key
      var ok = c && c.ok;
      if (!ok) {
        Object.keys(cache).forEach(function (k) {
          if (cache[k] && cache[k].ok && cache[k].src && String(cache[k].src).indexOf(id.split(".").pop()) >= 0) ok = true;
        });
      }
      if (!ok) missing.push(id);
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
      "--vox-png-chat-tab": "chat.tab",
      "--vox-png-chat-tab-active": "chat.tab.active",
      "--vox-png-chat-tab-hover": "chat.tab.hover",
      "--vox-png-tooltip": "tooltip.bg",
      "--vox-png-notif": "notif.bg",
    };
    Object.keys(map).forEach(function (cssVar) {
      var src = url(map[cssVar]);
      // Always quote + absolute — bare filenames 404 when resolved from /ui/hud/
      root.style.setProperty(cssVar, 'url("' + src + '")');
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
      // rewrite relative asset paths to absolute
      var src = img.getAttribute("src") || "";
      if (src && src.charAt(0) !== "/" && src.indexOf("http") !== 0 && src.indexOf("data:") !== 0 && src.indexOf("blob:") !== 0) {
        if (src.indexOf("assets/") === 0 || src.indexOf("branding/") === 0 || src.indexOf("ui/") === 0) {
          img.setAttribute("src", "/" + src.replace(/^\.?\//, ""));
        }
      }
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

  /** Rewrite relative url(...) in inline styles + known CSS vars */
  function repairBackgrounds(root) {
    root = root || document;
    var nodes = root.querySelectorAll("[style*='background']");
    nodes.forEach(function (node) {
      var bg = node.style.backgroundImage || "";
      if (!bg || bg.indexOf("url(") < 0) return;
      var m = bg.match(/url\(['"]?([^'")]+)['"]?\)/);
      if (!m) return;
      var p = m[1];
      if (p.charAt(0) === "/" || p.indexOf("http") === 0 || p.indexOf("data:") === 0) return;
      if (p.indexOf("assets/") >= 0 || p.indexOf("branding/") >= 0) {
        var abs = absUrl(p.replace(/^\.\.\//, "").replace(/^\.\//, ""));
        if (abs.indexOf("/assets") < 0 && p.indexOf("assets/") >= 0) {
          abs = "/" + p.replace(/^.*?assets\//, "assets/");
        }
        node.style.backgroundImage = "url('" + abs + "')";
      }
    });
  }

  /** Fix grudge-hud.css relative paths that break when CSS is deep-linked */
  function patchHudCssBase() {
    refreshManifest();
    var root = document.documentElement;
    var u = function (rel) {
      if (global.GrudgeAssets && GrudgeAssets.uiFrame) return GrudgeAssets.uiFrame(rel);
      return absUrl("/assets/grudge-game/ui/" + rel);
    };
    var patches = {
      "--gg-btn-lg": u("Buttons/Rectangular/Large/Button_RL_Background.png"),
      "--gg-btn-lg-yellow": u("Buttons/Rectangular/Large/Button_RL_Background_Yellow.png"),
      "--gg-btn-md": u("Buttons/Rectangular/Medium/Button_RM_Background.png"),
      "--gg-window": u("Window/Window_Background.png"),
      "--gg-window-header": u("Window/Window_Header_Background.png"),
      "--gg-modal": u("Modal_Box/ModalBox_Background.png"),
      "--gg-slot-skill": u("Action_Bar/Slots/ActionBar_Slot_Background.png"),
      "--gg-slot-inv": u("Inventory/Inventory_Slot_Background.png"),
      "--gg-unitframe": u("Unit_Frames/Main/UnitFrame_Background.png"),
      "--gg-hp-fill": u("Unit_Frames/Main/Bars/UnitFrame_HP_Fill_Red.png"),
      "--gg-mp-fill": u("Unit_Frames/Main/Bars/UnitFrame_MP_Fill_Green.png"),
      "--gg-tab": u("Spell_Book/Tabs/SpellBook_Tab_Background.png"),
      "--gg-tab-active": u("Spell_Book/Tabs/SpellBook_Tab_Background_Active.png"),
      "--gg-menu": u("Window/Menu/Window_Menu_Background.png"),
      "--gg-menu-active": u("Window/Menu/Window_Menu_Active.png"),
      "--ab-slot": u("Action_Bar/Slots/ActionBar_Slot_Background.png"),
      "--ab-main": u("Action_Bar/ActionBar_Main_Background.png"),
      "--ab-globe": u("Action_Bar/Globes/ActionBar_Globe_Background.png"),
      "--uf-main": u("Unit_Frames/Main/UnitFrame_Background.png"),
      "--uf-party": u("Unit_Frames/Party/UnitFrame_Party_Background.png"),
    };
    Object.keys(patches).forEach(function (k) {
      root.style.setProperty(k, 'url("' + patches[k] + '")');
    });
    if (global.GrudgeAssets && GrudgeAssets.applyHudCssVars) GrudgeAssets.applyHudCssVars();
  }

  global.VoxUiDeps = {
    get MANIFEST() { return MANIFEST; },
    get FALLBACK_ICON() { return FALLBACK_ICON; },
    REL: REL,
    url: url,
    absUrl: absUrl,
    resolveRel: resolveRel,
    refreshManifest: refreshManifest,
    preload: preload,
    check: check,
    groups: groups,
    applyCssVars: applyCssVars,
    setImage: setImage,
    repairBrokenImages: repairBrokenImages,
    repairBackgrounds: repairBackgrounds,
    patchHudCssBase: patchHudCssBase,
    isReady: function () { return ready; },
  };
})(typeof window !== "undefined" ? window : globalThis);
