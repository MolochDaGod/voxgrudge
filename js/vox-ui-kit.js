/**
 * VoxGrudge UI kit — carousels, PNG containers, player + AI unit frames.
 *
 *   VoxUiKit.init()
 *   VoxUiKit.carousel(el, { items, onSelect, renderCard })
 *   VoxUiKit.mountUnitFrames()
 *   VoxUiKit.setPlayerFrame({ name, hp, maxHp, mp, maxMp, level, avatarUrl })
 *   VoxUiKit.setAiFrame(slot, { name, hp, maxHp, kind: 'enemy'|'ally' })
 */
(function (global) {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  // ── Carousel ───────────────────────────────────────────────────────────────

  function carousel(host, opts) {
    opts = opts || {};
    if (!host) return null;
    var items = opts.items || [];
    var index = Math.max(0, opts.startIndex || 0);
    var visible = opts.visible || 4;
    var onSelect = opts.onSelect || function () {};
    var renderCard = opts.renderCard || defaultCard;

    host.classList.add("vox-carousel");
    host.innerHTML = "";
    var glow = el("div", "vox-carousel__glow");
    var left = el("button", "vox-carousel__arrow");
    left.type = "button";
    left.setAttribute("aria-label", "Previous");
    var wrap = el("div", "vox-carousel__track-wrap");
    var track = el("div", "vox-carousel__track");
    var right = el("button", "vox-carousel__arrow vox-carousel__arrow--right");
    right.type = "button";
    right.setAttribute("aria-label", "Next");
    var dots = el("div", "vox-carousel__dots");
    wrap.appendChild(track);
    wrap.appendChild(dots);
    host.appendChild(glow);
    host.appendChild(left);
    host.appendChild(wrap);
    host.appendChild(right);

    var selectedId = opts.selectedId || null;
    var cards = [];

    function defaultCard(item) {
      var card = el("button", "vox-card");
      card.type = "button";
      card.dataset.id = item.id;
      if (item.badge) {
        var b = el("span", "vox-card__badge", item.badge);
        card.appendChild(b);
      }
      var icon = el("div", "vox-card__icon");
      var iconUrl = item.iconUrl;
      if (iconUrl && global.VoxUiDeps && VoxUiDeps.absUrl) iconUrl = VoxUiDeps.absUrl(iconUrl);
      if (iconUrl && global.VoxUiDeps && VoxUiDeps.setImage) {
        VoxUiDeps.setImage(icon, iconUrl, item.fallbackUrl || (global.VoxUiDeps && VoxUiDeps.FALLBACK_ICON));
      } else if (iconUrl) {
        icon.style.backgroundImage = "url('" + iconUrl + "')";
      } else if (item.color) {
        icon.style.background = item.color;
        icon.style.borderRadius = "8px";
      }
      icon.style.backgroundSize = "cover";
      icon.style.backgroundPosition = "center";
      card.appendChild(icon);
      card.appendChild(el("div", "vox-card__title", item.title || item.id));
      if (item.meta) card.appendChild(el("div", "vox-card__meta", item.meta));
      return card;
    }

    function rebuild() {
      track.innerHTML = "";
      dots.innerHTML = "";
      cards = [];
      items.forEach(function (item, i) {
        var card = renderCard(item, i);
        card.classList.add("vox-card");
        if (selectedId != null && String(item.id) === String(selectedId)) card.classList.add("sel");
        card.addEventListener("click", function () {
          selectedId = item.id;
          cards.forEach(function (c) { c.classList.remove("sel"); });
          card.classList.add("sel");
          onSelect(item, i);
        });
        track.appendChild(card);
        cards.push(card);

        var d = el("button", "vox-carousel__dot" + (i === index ? " on" : ""));
        d.type = "button";
        d.setAttribute("aria-label", "Slide " + (i + 1));
        d.addEventListener("click", function () {
          index = i;
          layout();
        });
        dots.appendChild(d);
      });
      layout();
    }

    function cardWidth() {
      var c = cards[0];
      if (!c) return 140;
      var rect = c.getBoundingClientRect();
      var style = getComputedStyle(track);
      var gap = parseFloat(style.gap || style.columnGap || "10") || 10;
      return rect.width + gap;
    }

    function layout() {
      var max = Math.max(0, items.length - visible);
      if (index > max) index = max;
      if (index < 0) index = 0;
      var w = cardWidth();
      track.style.transform = "translateX(" + (-index * w) + "px)";
      Array.prototype.forEach.call(dots.children, function (d, i) {
        d.classList.toggle("on", i === index);
      });
    }

    left.addEventListener("click", function () {
      index = Math.max(0, index - 1);
      layout();
    });
    right.addEventListener("click", function () {
      index = Math.min(Math.max(0, items.length - 1), index + 1);
      layout();
    });

    // Touch swipe
    var sx = 0;
    wrap.addEventListener(
      "pointerdown",
      function (e) {
        sx = e.clientX;
      },
      { passive: true }
    );
    wrap.addEventListener(
      "pointerup",
      function (e) {
        var dx = e.clientX - sx;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) index = Math.min(items.length - 1, index + 1);
        else index = Math.max(0, index - 1);
        layout();
      },
      { passive: true }
    );

    window.addEventListener("resize", layout);

    rebuild();

    return {
      setItems: function (next, sel) {
        items = next || [];
        if (sel != null) selectedId = sel;
        index = 0;
        rebuild();
      },
      select: function (id) {
        selectedId = id;
        cards.forEach(function (c) {
          c.classList.toggle("sel", c.dataset.id === String(id));
        });
      },
      layout: layout,
      el: host,
    };
  }

  // ── Unit frames ────────────────────────────────────────────────────────────

  var playerFrame = null;
  var aiFrames = [];

  function mountUnitFrames() {
    var host = document.getElementById("vox-unit-frames");
    if (!host) {
      host = el("div", "pre-game-hidden");
      host.id = "vox-unit-frames";
      document.body.appendChild(host);
    }
    host.innerHTML = "";
    playerFrame = buildFrame("player");
    host.appendChild(playerFrame.root);

    var aiHost = document.getElementById("vox-ai-frames");
    if (!aiHost) {
      aiHost = el("div", "pre-game-hidden");
      aiHost.id = "vox-ai-frames";
      document.body.appendChild(aiHost);
    }
    aiHost.innerHTML = "";
    aiFrames = [buildFrame("ai", 0), buildFrame("ai", 1), buildFrame("ai", 2)];
    aiFrames.forEach(function (f) {
      f.root.style.display = "none";
      aiHost.appendChild(f.root);
    });

    var xp = document.getElementById("vox-xp-strip");
    if (!xp) {
      xp = el("div", "pre-game-hidden");
      xp.id = "vox-xp-strip";
      xp.innerHTML = '<div class="fill" id="vox-xp-fill"></div>';
      document.body.appendChild(xp);
    }

    return { player: playerFrame, ai: aiFrames, xp: xp };
  }

  function buildFrame(kind, slot) {
    var root = el(
      "div",
      "vox-unit-frame" + (kind === "ai" ? " vox-unit-frame--ai" : kind === "party" ? " vox-unit-frame--party" : "")
    );
    if (slot != null) root.dataset.slot = String(slot);
    var avatar = el("div", "vox-unit-frame__avatar");
    var name = el("div", "vox-unit-frame__name", kind === "ai" ? "Target" : "Hero");
    var tag = el("div", "vox-unit-frame__tag", kind === "ai" ? "AI" : "YOU");
    var bars = el("div", "vox-unit-frame__bars");
    var hpBar = el("div", "vox-unit-frame__bar");
    var hpFill = el("div", "vox-unit-frame__fill vox-unit-frame__fill--hp");
    hpBar.appendChild(hpFill);
    var mpBar = el("div", "vox-unit-frame__bar vox-unit-frame__bar--mp");
    var mpFill = el("div", "vox-unit-frame__fill vox-unit-frame__fill--mp");
    mpBar.appendChild(mpFill);
    bars.appendChild(hpBar);
    bars.appendChild(mpBar);
    var level = el("div", "vox-unit-frame__level", "1");
    root.appendChild(avatar);
    root.appendChild(name);
    root.appendChild(tag);
    root.appendChild(bars);
    root.appendChild(level);
    return {
      root: root,
      avatar: avatar,
      name: name,
      tag: tag,
      hpFill: hpFill,
      mpFill: mpFill,
      level: level,
    };
  }

  function setBar(fillEl, cur, max) {
    if (!fillEl) return;
    var m = max > 0 ? max : 1;
    var pct = Math.max(0, Math.min(100, Math.round((cur / m) * 100)));
    fillEl.style.width = pct + "%";
  }

  function setPlayerFrame(data) {
    data = data || {};
    if (!playerFrame) mountUnitFrames();
    if (!playerFrame) return;
    if (data.name != null) playerFrame.name.textContent = data.name;
    if (data.level != null) playerFrame.level.textContent = String(data.level);
    if (data.avatarUrl) playerFrame.avatar.style.backgroundImage = "url('" + data.avatarUrl + "')";
    if (data.tag) playerFrame.tag.textContent = data.tag;
    if (data.hp != null) setBar(playerFrame.hpFill, data.hp, data.maxHp != null ? data.maxHp : 100);
    if (data.mp != null) setBar(playerFrame.mpFill, data.mp, data.maxMp != null ? data.maxMp : 100);
    playerFrame.root.parentElement && playerFrame.root.parentElement.classList.remove("pre-game-hidden");
  }

  function setAiFrame(slot, data) {
    if (!aiFrames.length) mountUnitFrames();
    var f = aiFrames[slot];
    if (!f) return;
    data = data || {};
    if (data.hide || data.hp <= 0) {
      f.root.style.display = "none";
      return;
    }
    f.root.style.display = "";
    f.name.textContent = data.name || "Target";
    f.tag.textContent = data.kind === "ally" ? "ALLY" : data.kind === "npc" ? "NPC" : "AI";
    f.root.classList.toggle("vox-unit-frame--party", data.kind === "ally" || data.kind === "npc");
    f.root.classList.toggle("vox-unit-frame--ai", data.kind !== "ally" && data.kind !== "npc");
    if (data.avatarUrl) f.avatar.style.backgroundImage = "url('" + data.avatarUrl + "')";
    if (data.level != null) f.level.textContent = String(data.level);
    setBar(f.hpFill, data.hp != null ? data.hp : 100, data.maxHp != null ? data.maxHp : 100);
    if (data.mp != null) setBar(f.mpFill, data.mp, data.maxMp != null ? data.maxMp : 100);
    var host = document.getElementById("vox-ai-frames");
    if (host) host.classList.remove("pre-game-hidden");
  }

  function clearAiFrames() {
    aiFrames.forEach(function (f) {
      f.root.style.display = "none";
    });
  }

  function setXp(pct) {
    var fill = document.getElementById("vox-xp-fill");
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    var strip = document.getElementById("vox-xp-strip");
    if (strip) strip.classList.remove("pre-game-hidden");
  }

  function showGameChrome(show) {
    ["vox-unit-frames", "vox-ai-frames", "vox-xp-strip"].forEach(function (id) {
      var n = document.getElementById(id);
      if (!n) return;
      if (show) n.classList.remove("pre-game-hidden");
      else n.classList.add("pre-game-hidden");
    });
  }

  // ── Class / hero carousel helpers ──────────────────────────────────────────

  function classItemsFromDefs(CLASSES, emblemMap) {
    emblemMap = emblemMap || {
      swordsman: "warrior",
      archer: "ranger",
      mage: "mage",
      druid: "ranger",
      paladin: "warrior",
      necromancer: "mage",
    };
    return Object.keys(CLASSES).map(function (cid) {
      var c = CLASSES[cid];
      var emb = emblemMap[cid] || "warrior";
      var icon =
        (global.VoxUiDeps && VoxUiDeps.url("emblem." + emb)) ||
        "/assets/grudge-game/class-emblems/" + emb + ".webp";
      return {
        id: cid,
        title: c.name,
        meta: (c.role || "") + " · " + (c.desc || "").slice(0, 48),
        iconUrl: icon,
        fallbackUrl: "/branding/logo-256.png",
        color: c.color,
        badge: "CLASS",
        raw: c,
      };
    });
  }

  function settlementItems(types) {
    return (types || []).map(function (t) {
      return {
        id: t.id,
        title: t.title || t.id,
        meta: t.theme || t.pack || "",
        badge: "WORLD",
        color: "linear-gradient(135deg,#1a2438,#3a2010)",
      };
    });
  }

  // ── Toast / tooltip UI systems ─────────────────────────────────────────────

  var toastHost = null;

  function ensureToastHost() {
    if (toastHost && toastHost.isConnected) return toastHost;
    toastHost = document.getElementById("vox-toast-host");
    if (!toastHost) {
      toastHost = el("div", "vox-toast-host");
      toastHost.id = "vox-toast-host";
      document.body.appendChild(toastHost);
    }
    return toastHost;
  }

  function toast(message, opts) {
    opts = opts || {};
    var host = ensureToastHost();
    var n = el("div", "vox-toast" + (opts.kind ? " vox-toast--" + opts.kind : ""));
    n.setAttribute("role", "status");
    n.textContent = message || "";
    host.appendChild(n);
    requestAnimationFrame(function () {
      n.classList.add("on");
    });
    var ms = opts.ms != null ? opts.ms : 2800;
    setTimeout(function () {
      n.classList.remove("on");
      setTimeout(function () {
        if (n.parentNode) n.parentNode.removeChild(n);
      }, 220);
    }, ms);
    return n;
  }

  var tipEl = null;
  function ensureTip() {
    if (tipEl && tipEl.isConnected) return tipEl;
    tipEl = document.getElementById("vox-tooltip");
    if (!tipEl) {
      tipEl = el("div", "vox-tooltip");
      tipEl.id = "vox-tooltip";
      tipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function showTooltip(target, html) {
    if (!target) return;
    var tip = ensureTip();
    tip.innerHTML = html || target.getAttribute("data-tip") || target.getAttribute("title") || "";
    tip.classList.add("on");
    var r = target.getBoundingClientRect();
    var tw = tip.offsetWidth || 160;
    var th = tip.offsetHeight || 40;
    var left = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2));
    var top = r.top - th - 10;
    if (top < 8) top = r.bottom + 10;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function hideTooltip() {
    if (tipEl) tipEl.classList.remove("on");
  }

  function bindTooltips(root) {
    root = root || document;
    root.querySelectorAll("[data-tip], [title]").forEach(function (node) {
      if (node.dataset.voxTipBound) return;
      node.dataset.voxTipBound = "1";
      // Prefer data-tip; keep title for a11y but suppress native delay tooltip via empty title on hover
      node.addEventListener("mouseenter", function () {
        var t = node.getAttribute("data-tip") || node.getAttribute("title");
        if (!t) return;
        if (node.getAttribute("title")) {
          node.dataset.nativeTitle = node.getAttribute("title");
          node.removeAttribute("title");
        }
        showTooltip(node, t);
      });
      node.addEventListener("mouseleave", function () {
        hideTooltip();
        if (node.dataset.nativeTitle) {
          node.setAttribute("title", node.dataset.nativeTitle);
        }
      });
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  async function init(opts) {
    opts = opts || {};
    if (global.VoxUiDeps) {
      VoxUiDeps.patchHudCssBase();
      VoxUiDeps.applyCssVars();
      var report = await VoxUiDeps.preload({
        group: "critical",
        onProgress: opts.onProgress,
      });
      VoxUiDeps.preload({ group: "hud" }).catch(function () {});
      VoxUiDeps.repairBrokenImages(document);
      if (VoxUiDeps.repairBackgrounds) VoxUiDeps.repairBackgrounds(document);
      var boot = document.getElementById("vox-boot-status");
      if (boot) {
        var chk = VoxUiDeps.check();
        if (chk.ok) {
          boot.textContent =
            "UI ready · " + report.loaded + "/" + report.total + " PNGs · smart tabs · carousels · frames · icons";
          boot.className = "ok";
        } else {
          boot.textContent =
            "UI " + report.loaded + "/" + report.total + " · missing " + (chk.missing.slice(0, 3).join(", ") || "none");
          boot.className = report.loaded > 8 ? "ok" : "bad";
        }
      }
    }
    var cs = document.getElementById("class-screen");
    if (cs) cs.classList.add("vox-ui-ready");
    mountUnitFrames();
    initSectionTabs();
    ensureToastHost();
    bindTooltips(document);
    return true;
  }

  /**
   * Class-screen section tabs: Class | Hero | World
   * Keyboard 1/2/3, hash deep-link, flow-rail sync, PNG chat-tab chrome.
   */
  function initSectionTabs() {
    var bar = document.getElementById("vox-section-tabs");
    if (!bar) return;
    bar.classList.add("vox-section-tabs--smart");
    var order = ["class", "hero", "world"];
    var panels = {
      class: document.getElementById("vox-panel-class"),
      hero: document.getElementById("vox-panel-hero"),
      world: document.getElementById("vox-panel-world"),
    };
    var current = "class";

    function syncFlow(id) {
      var rail = document.getElementById("vox-flow-rail");
      if (!rail) return;
      var map = { class: "select", hero: "select", world: "world" };
      var step = map[id] || "select";
      rail.querySelectorAll(".step").forEach(function (s) {
        s.classList.toggle("on", s.dataset.step === step);
      });
    }

    function show(id) {
      if (!panels[id] && id !== "class") id = "class";
      current = id;
      bar.querySelectorAll("button").forEach(function (b) {
        var on = b.dataset.section === id;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      Object.keys(panels).forEach(function (k) {
        if (panels[k]) panels[k].classList.toggle("active", k === id);
      });
      syncFlow(id);
      try {
        if (history.replaceState) {
          var hash = id === "class" ? "" : "#" + id;
          history.replaceState(null, "", hash || location.pathname + location.search);
        }
      } catch (e) { /* ignore */ }
      if (global.requestAnimationFrame) {
        requestAnimationFrame(function () {
          window.dispatchEvent(new Event("resize"));
        });
      }
    }

    // Enrich buttons with hotkey badges + tips
    bar.querySelectorAll("button").forEach(function (btn, i) {
      if (!btn.querySelector(".vox-tab-hot")) {
        var hot = el("span", "vox-tab-hot", String(i + 1));
        btn.appendChild(hot);
      }
      btn.setAttribute("role", "tab");
      btn.setAttribute("data-tip", (btn.textContent || "").trim() + " · press " + (i + 1));
      btn.addEventListener("click", function () {
        show(btn.dataset.section);
      });
    });
    bar.setAttribute("role", "tablist");

    // Keyboard 1/2/3 on class screen
    if (!bar._voxKeyWired) {
      bar._voxKeyWired = true;
      document.addEventListener("keydown", function (e) {
        var cs = document.getElementById("class-screen");
        if (!cs || cs.style.display === "none" || cs.classList.contains("hidden")) return;
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        if (e.code === "Digit1") {
          e.preventDefault();
          show("class");
        } else if (e.code === "Digit2") {
          e.preventDefault();
          show("hero");
        } else if (e.code === "Digit3") {
          e.preventDefault();
          show("world");
        } else if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
          var idx = order.indexOf(current);
          if (idx < 0) idx = 0;
          idx = e.code === "ArrowLeft" ? (idx - 1 + order.length) % order.length : (idx + 1) % order.length;
          e.preventDefault();
          show(order[idx]);
        }
      });
    }

    // Hash deep-link (#hero / #world / #class) + live hashchange
    function applyHash() {
      var hash = (location.hash || "").replace(/^#/, "").toLowerCase();
      if (hash === "hero" || hash === "world" || hash === "class") show(hash);
      else if (!hash) show(current || "class");
    }
    applyHash();
    if (!bar._voxHashWired) {
      bar._voxHashWired = true;
      window.addEventListener("hashchange", applyHash);
    }

    global.VoxUiKit._sectionShow = show;
  }

  global.VoxUiKit = {
    init: init,
    carousel: carousel,
    mountUnitFrames: mountUnitFrames,
    setPlayerFrame: setPlayerFrame,
    setAiFrame: setAiFrame,
    clearAiFrames: clearAiFrames,
    setXp: setXp,
    showGameChrome: showGameChrome,
    classItemsFromDefs: classItemsFromDefs,
    settlementItems: settlementItems,
    toast: toast,
    showTooltip: showTooltip,
    hideTooltip: hideTooltip,
    bindTooltips: bindTooltips,
    showSection: function (id) {
      if (global.VoxUiKit._sectionShow) global.VoxUiKit._sectionShow(id);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
