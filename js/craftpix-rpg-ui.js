/**
 * Craftpix RPG UI runtime — dependency graph, slot states, preload, tooltips.
 * Pack: ui/craftpix-rpg (craftpix-896711-rpg-game-ui, 50% slices)
 */
(function (global) {
  'use strict';

  var BASE = 'ui/craftpix-rpg/';
  function resolveBase() {
    var path = (global.location && global.location.pathname) || '';
    if (path.indexOf('/voxgrudge') >= 0) return '/voxgrudge/' + BASE;
    return BASE;
  }

  var graph = null;
  var ready = false;
  var tipEl = null;

  function assetUrl(rel) {
    return resolveBase() + String(rel || '').replace(/^\//, '');
  }

  function loadManifest() {
    return fetch(assetUrl('manifest.json'), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /** Topological expand of composition → ordered node ids */
  function expandComposition(name) {
    if (!graph || !graph.compositions || !graph.compositions[name]) return [];
    var nodes = graph.nodes || {};
    var seen = {};
    var out = [];
    function visit(id) {
      if (seen[id]) return;
      seen[id] = true;
      var n = nodes[id];
      if (n && n.deps) n.deps.forEach(visit);
      out.push(id);
    }
    graph.compositions[name].forEach(visit);
    return out;
  }

  function collectAssets(nodeIds) {
    var nodes = (graph && graph.nodes) || {};
    var urls = [];
    var seen = {};
    (nodeIds || Object.keys(nodes)).forEach(function (id) {
      var n = nodes[id];
      if (!n || !n.asset) return;
      var u = assetUrl(n.asset);
      if (!seen[u]) { seen[u] = true; urls.push(u); }
    });
    return urls;
  }

  function preloadImages(urls, onProgress) {
    var total = urls.length || 1;
    var done = 0;
    return Promise.all(
      urls.map(function (u) {
        return new Promise(function (resolve) {
          var img = new Image();
          img.onload = img.onerror = function () {
            done++;
            if (onProgress) onProgress(done, total, u);
            resolve(u);
          };
          img.src = u;
        });
      }),
    );
  }

  function applyTheme() {
    var root = document.documentElement;
    root.classList.add('cpx-theme');
    // Ensure CSS vars point at absolute base for edge / nested paths
    var b = resolveBase();
    root.style.setProperty('--cpx-resolved-base', b);
  }

  function ensureTooltip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'cpx-tooltip cpx-pixel';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function bindTooltips(selector) {
    var tip = ensureTooltip();
    var nodes = document.querySelectorAll(selector || '[data-tip-title],[data-tip]');
    nodes.forEach(function (el) {
      if (el._cpxTipBound) return;
      el._cpxTipBound = true;
      function show(ev) {
        var title = el.getAttribute('data-tip-title') || el.getAttribute('data-tip') || '';
        var body = el.getAttribute('data-tip-body') || '';
        if (!title && !body) return;
        tip.innerHTML =
          (title ? '<strong>' + title + '</strong>' : '') +
          (body ? '<span>' + body + '</span>' : '');
        tip.classList.add('is-on');
        move(ev);
      }
      function move(ev) {
        var x = (ev.clientX || 0) + 14;
        var y = (ev.clientY || 0) + 16;
        var rect = tip.getBoundingClientRect();
        if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
        if (y + rect.height > window.innerHeight - 8) y = (ev.clientY || 0) - rect.height - 10;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
      }
      function hide() {
        tip.classList.remove('is-on');
      }
      el.addEventListener('pointerenter', show);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', hide);
    });
  }

  /** Mark weapon/build slots with craftpix states */
  function decorateSlots(root) {
    var host = root || document;
    host.querySelectorAll('.kpx-slot, .cpx-slot').forEach(function (el) {
      el.classList.add('cpx-slot', 'cpx-pixel');
      if (el.classList.contains('active')) el.classList.add('active');
    });
  }

  function decoratePanels(root) {
    var host = root || document;
    host.querySelectorAll('.kpx-panel').forEach(function (el) {
      el.classList.add('cpx-panel', 'cpx-pixel');
    });
    host.querySelectorAll('.kpx-btn').forEach(function (el) {
      el.classList.add('cpx-btn', 'cpx-pixel');
    });
    host.querySelectorAll('.kpx-bar').forEach(function (el) {
      el.classList.add('cpx-bar', 'cpx-pixel');
    });
    host.querySelectorAll('.kpx-res').forEach(function (el) {
      el.classList.add('cpx-res');
      var id = el.id || '';
      if (id === 'r-wood') el.classList.add('cpx-res--wood');
      if (id === 'r-food') el.classList.add('cpx-res--food');
      if (id === 'r-water') el.classList.add('cpx-res--water');
      if (id === 'r-med') el.classList.add('cpx-res--med');
      if (id === 'r-scrap') el.classList.add('cpx-res--scrap');
    });
  }

  function setBar(elOrId, pct, kind) {
    var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    var fill = el.querySelector('i') || el.querySelector('.cpx-bar-fill');
    if (!fill) return;
    var p = Math.max(0, Math.min(100, pct));
    fill.style.width = p + '%';
    el.classList.remove('cpx-bar--warn', 'cpx-bar--crit', 'kpx-bar--warn');
    if (kind === 'hp') {
      el.classList.add('cpx-bar--hp');
      if (p <= 30) el.classList.add('cpx-bar--crit');
      else if (p <= 55) el.classList.add('cpx-bar--warn');
    }
  }

  function boot(opts) {
    opts = opts || {};
    applyTheme();
    return loadManifest().then(function (man) {
      graph = man && man.graph ? man.graph : null;
      var comps = opts.compositions || [
        'hudVitals',
        'hudStockpile',
        'hudPhase',
        'hudDock',
        'menuShell',
        'weaponSlots',
      ];
      var ids = [];
      comps.forEach(function (c) {
        expandComposition(c).forEach(function (id) {
          if (ids.indexOf(id) < 0) ids.push(id);
        });
      });
      // If no manifest, preload core CSS-linked paths via composition fallback list
      var urls = collectAssets(ids);
      if (!urls.length) {
        urls = [
          'windows/c_full.png',
          'frames/uf2_frame.png',
          'frames/tgb_frame.png',
          'bars/ab1_main_frame.png',
          'bars/bb_bar.png',
          'slots/item_slot.png',
          'slots/spell_overlay.png',
          'login/login_big_btn.png',
          'controller/frame.png',
          'controller/inner.png',
        ].map(assetUrl);
      }
      return preloadImages(urls, opts.onProgress).then(function () {
        ready = true;
        decoratePanels(document);
        decorateSlots(document);
        bindTooltips();
        if (opts.onReady) opts.onReady({ graph: graph, urls: urls });
        return { graph: graph, urls: urls };
      });
    });
  }

  function refreshTooltips() {
    bindTooltips();
    decorateSlots(document);
    decoratePanels(document);
  }

  /** Debug: mermaid-ish text of composition graph */
  function graphDot() {
    if (!graph) return 'digraph G {}';
    var lines = ['digraph CraftpixUI {'];
    (graph.edges || []).forEach(function (e) {
      lines.push('  "' + e[0] + '" -> "' + e[1] + '";');
    });
    lines.push('}');
    return lines.join('\n');
  }

  global.CraftpixRpgUI = {
    boot: boot,
    applyTheme: applyTheme,
    bindTooltips: bindTooltips,
    refreshTooltips: refreshTooltips,
    decorateSlots: decorateSlots,
    decoratePanels: decoratePanels,
    setBar: setBar,
    expandComposition: expandComposition,
    assetUrl: assetUrl,
    graphDot: graphDot,
    get ready() { return ready; },
    get graph() { return graph; },
  };

  // Bridge KenneyPixelUI calls used by z-brawl
  if (!global.KenneyPixelUI) {
    global.KenneyPixelUI = {
      applyTheme: applyTheme,
      refreshTooltips: refreshTooltips,
      bindTooltips: bindTooltips,
    };
  } else {
    var k = global.KenneyPixelUI;
    var prevRefresh = k.refreshTooltips ? k.refreshTooltips.bind(k) : null;
    k.refreshTooltips = function () {
      if (prevRefresh) prevRefresh();
      refreshTooltips();
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
