/**
 * VoxGrudge cloud identity + save — REUSES fleet systems (do not invent new ones).
 *
 * Auth (SSOT for login):
 *   - GrudgeAuth from grudge-game-bootstrap.js → id.grudge-studio.com
 *   - Token keys: grudge_auth_token / grudge_session_token / sso_token
 *
 * Saves (user-pays cloud):
 *   - puter.kv  (js.puter.com/v2) — primary durable save when Puter session exists
 *   - localStorage mirror for guest / offline (same payload shape)
 *
 * Optional roster:
 *   - GET /api/characters (Railway via Vercel rewrite) — display only; game run is account-scoped
 *
 * Key conventions (aligned with grudge-sdk + puter skill):
 *   puter.kv:  grudge:voxgrudge:autosave  OR  grudge:{grudgeId}:voxgrudge:autosave
 *   local:     grudge_voxgrudge_autosave
 *
 * @version 1.0.0
 */
(function (global) {
  'use strict';

  var SAVE_SCHEMA = 1;
  var GAME_ID = 'voxgrudge';
  var LS_KEY = 'grudge_voxgrudge_autosave';
  var KV_BASE = 'grudge:voxgrudge:autosave';
  var AUTOSAVE_MS = 45000;
  var GAME_DATA = 'https://grudge-api-production-0d46.up.railway.app';

  var _meta = { grudgeId: null, username: null, characters: [], characterId: null };
  var _timer = null;
  var _hooks = null;
  var _pendingApply = null;

  function lsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* quota */ }
  }

  function grudgeId() {
    return (
      _meta.grudgeId ||
      lsGet('grudge_id') ||
      lsGet('grudge_account_id') ||
      lsGet('grudge_user_id') ||
      null
    );
  }

  function authHeaders() {
    if (global.GrudgeAuth && typeof global.GrudgeAuth.authHeaders === 'function') {
      return global.GrudgeAuth.authHeaders();
    }
    var t =
      lsGet('grudge_auth_token') ||
      lsGet('grudge_session_token') ||
      lsGet('sso_token') ||
      lsGet('grudge.token');
    var h = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (t) {
      h.Authorization = 'Bearer ' + t;
      h['X-Session-Token'] = t;
    }
    return h;
  }

  function isGrudgeAuthed() {
    if (global.GrudgeAuth && typeof global.GrudgeAuth.isAuthenticated === 'function') {
      return global.GrudgeAuth.isAuthenticated();
    }
    return !!(
      lsGet('grudge_auth_token') ||
      lsGet('grudge_session_token') ||
      lsGet('sso_token')
    );
  }

  function puterReady() {
    try {
      return !!(global.puter && global.puter.kv && global.puter.auth && global.puter.auth.isSignedIn());
    } catch (e) {
      return false;
    }
  }

  function kvKeys() {
    var gid = grudgeId();
    var keys = [KV_BASE];
    if (gid) keys.unshift('grudge:' + gid + ':voxgrudge:autosave');
    return keys;
  }

  function parseMaybe(v) {
    if (v == null) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (e) { return null; }
  }

  async function puterGet() {
    if (!puterReady()) return null;
    var keys = kvKeys();
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = await global.puter.kv.get(keys[i]);
        var data = parseMaybe(raw);
        if (data && data.schema === SAVE_SCHEMA) return data;
      } catch (e) { /* try next */ }
    }
    return null;
  }

  async function puterSet(payload) {
    if (!puterReady()) return false;
    var keys = kvKeys();
    var body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    var ok = false;
    for (var i = 0; i < keys.length; i++) {
      try {
        await global.puter.kv.set(keys[i], body);
        ok = true;
      } catch (e) {
        console.warn('[VoxCloud] puter.kv.set', keys[i], e);
      }
    }
    return ok;
  }

  function localGet() {
    try {
      return parseMaybe(lsGet(LS_KEY));
    } catch (e) {
      return null;
    }
  }

  function localSet(payload) {
    try {
      lsSet(LS_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Collect run state via hooks registered by the game shell. */
  function collectPayload() {
    if (!_hooks || typeof _hooks.collect !== 'function') return null;
    var run = _hooks.collect();
    if (!run) return null;
    return {
      schema: SAVE_SCHEMA,
      game: GAME_ID,
      savedAt: Date.now(),
      grudgeId: grudgeId(),
      characterId: _meta.characterId || run.characterId || null,
      run: run,
    };
  }

  async function saveNow(reason) {
    var payload = collectPayload();
    if (!payload) return { ok: false, reason: 'no-run' };
    localSet(payload);
    var cloud = await puterSet(payload);
    dispatch('grudge:vox:saved', { reason: reason || 'manual', cloud: cloud, at: payload.savedAt });
    updateAccountBar();
    return { ok: true, cloud: cloud };
  }

  async function loadBest() {
    var cloud = await puterGet();
    var local = localGet();
    if (cloud && local) {
      return (cloud.savedAt || 0) >= (local.savedAt || 0) ? cloud : local;
    }
    return cloud || local || null;
  }

  async function ensurePuterSession(interactive) {
    if (!global.puter || !global.puter.auth) return false;
    try {
      if (global.puter.auth.isSignedIn()) return true;
      if (!interactive) return false;
      await global.puter.auth.signIn();
      return !!global.puter.auth.isSignedIn();
    } catch (e) {
      console.warn('[VoxCloud] puter sign-in', e);
      return false;
    }
  }

  /**
   * Link Puter UUID → Grudge session when user only has Puter cloud.
   * Uses existing Railway route POST /api/auth/puter (same as fleet).
   */
  async function bridgePuterToGrudge() {
    if (!puterReady()) return false;
    try {
      var pu = await global.puter.auth.getUser();
      if (!pu || !pu.uuid) return false;
      var bases = ['', GAME_DATA, 'https://id.grudge-studio.com'];
      for (var i = 0; i < bases.length; i++) {
        try {
          var res = await fetch(bases[i] + '/api/auth/puter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              puterUuid: pu.uuid,
              puterUsername: pu.username || '',
              email: pu.email || undefined,
            }),
            credentials: bases[i] === '' ? 'include' : 'omit',
          });
          if (!res.ok) continue;
          var data = await res.json();
          var t = data.sessionToken || data.token;
          if (t && global.GrudgeAuth && global.GrudgeAuth.storeToken) {
            global.GrudgeAuth.storeToken(
              t,
              data.grudgeId || (data.user && data.user.grudgeId) || '',
              data.username || (data.user && data.user.username) || pu.username || '',
            );
            _meta.grudgeId = data.grudgeId || lsGet('grudge_id');
            _meta.username = data.username || lsGet('grudge_username') || pu.username;
            dispatch('grudge:auth:ready', { token: t, puterBridge: true });
            return true;
          }
        } catch (e) { /* try next base */ }
      }
    } catch (e) {
      console.warn('[VoxCloud] puter bridge', e);
    }
    return false;
  }

  async function refreshRoster() {
    if (!isGrudgeAuthed()) {
      _meta.characters = [];
      return [];
    }
    try {
      var res = await fetch('/api/characters?era=nexus', { headers: authHeaders() });
      if (!res.ok) {
        res = await fetch('/api/characters', { headers: authHeaders() });
      }
      if (!res.ok) return [];
      var data = await res.json();
      var list = Array.isArray(data) ? data : data.characters || data.items || [];
      _meta.characters = list;
      if (!_meta.characterId && list[0]) {
        _meta.characterId = list[0].id || list[0].characterId || null;
      }
      updateAccountBar();
      return list;
    } catch (e) {
      return [];
    }
  }

  function loginGrudgeId() {
    var ret = global.location.origin + global.location.pathname + (global.location.search || '');
    // Prefer loginForce → /login?redirect_uri= (never drop return URL).
    // loginPage uses sso-check which is fine when cookie works, but force is safer.
    if (global.GrudgeAuth && typeof global.GrudgeAuth.loginForce === 'function') {
      global.GrudgeAuth.loginForce(ret);
      return;
    }
    if (global.GrudgeAuth && typeof global.GrudgeAuth.loginPage === 'function') {
      global.GrudgeAuth.loginPage(ret);
      return;
    }
    global.location.href =
      'https://id.grudge-studio.com/login?redirect_uri=' +
      encodeURIComponent(ret) +
      '&redirect=' +
      encodeURIComponent(ret);
  }

  function logout() {
    if (global.GrudgeAuth && global.GrudgeAuth.logout) global.GrudgeAuth.logout();
    try {
      if (global.puter && global.puter.auth && global.puter.auth.isSignedIn()) {
        global.puter.auth.signOut();
      }
    } catch (e) { /* ignore */ }
    _meta.grudgeId = null;
    _meta.username = null;
    _meta.characters = [];
    updateAccountBar();
  }

  function dispatch(name, detail) {
    try {
      global.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (e) { /* ignore */ }
  }

  function formatSaveHint(save) {
    if (!save || !save.run) return 'No cloud save';
    var r = save.run;
    var cls = r.playerClass || '?';
    var lv = r.level != null ? r.level : 1;
    var seed = r.worldSeed != null ? r.worldSeed : '—';
    var when = save.savedAt ? new Date(save.savedAt).toLocaleString() : '';
    return cls + ' · Lv' + lv + ' · seed ' + seed + (when ? ' · ' + when : '');
  }

  function updateAccountBar() {
    var el = document.getElementById('vox-account-bar');
    if (!el) return;
    var gid = grudgeId();
    var name = _meta.username || lsGet('grudge_username') || '';
    var authed = isGrudgeAuthed();
    var puter = puterReady();
    var status = el.querySelector('[data-vox-status]');
    var saveHint = el.querySelector('[data-vox-save-hint]');
    var btnLogin = el.querySelector('[data-vox-login]');
    var btnPuter = el.querySelector('[data-vox-puter]');
    var btnLogout = el.querySelector('[data-vox-logout]');
    var btnContinue = el.querySelector('[data-vox-continue]');
    var btnSave = el.querySelector('[data-vox-save]');

    if (status) {
      if (authed) {
        status.textContent = (name || 'Grudge ID') + (gid ? ' · ' + gid : '');
        status.className = 'vox-acc-status on';
      } else if (puter) {
        status.textContent = 'Puter cloud (link Grudge ID for fleet roster)';
        status.className = 'vox-acc-status puter';
      } else {
        status.textContent = 'Guest · local only';
        status.className = 'vox-acc-status';
      }
    }

    if (btnLogin) btnLogin.style.display = authed ? 'none' : '';
    if (btnLogout) btnLogout.style.display = authed || puter ? '' : 'none';
    if (btnPuter) btnPuter.style.display = puter ? 'none' : '';
    if (btnSave) btnSave.style.display = (_hooks && global.gameStarted) ? '' : 'none';

    // save hint filled async by refreshSaveHint
    if (saveHint && !saveHint.dataset.loading) {
      saveHint.dataset.loading = '1';
      loadBest().then(function (s) {
        saveHint.dataset.loading = '';
        saveHint.textContent = formatSaveHint(s);
        if (btnContinue) {
          btnContinue.style.display = s && s.run ? '' : 'none';
          btnContinue.dataset.hasSave = s && s.run ? '1' : '0';
        }
      });
    }
  }

  function ensureAccountBar() {
    if (document.getElementById('vox-account-bar')) {
      updateAccountBar();
      return;
    }
    var screen = document.getElementById('class-screen');
    if (!screen) return;
    var bar = document.createElement('div');
    bar.id = 'vox-account-bar';
    bar.innerHTML =
      '<div class="vox-acc-row">' +
      '<span data-vox-status class="vox-acc-status">Checking identity…</span>' +
      '<div class="vox-acc-actions">' +
      '<button type="button" class="hud-action-btn" data-vox-login style="pointer-events:auto">Grudge ID</button>' +
      '<button type="button" class="hud-action-btn" data-vox-puter style="pointer-events:auto">Puter Cloud</button>' +
      '<button type="button" class="hud-action-btn" data-vox-continue style="display:none;pointer-events:auto">Continue</button>' +
      '<button type="button" class="hud-action-btn" data-vox-save style="display:none;pointer-events:auto">Save</button>' +
      '<button type="button" class="hud-action-btn" data-vox-logout style="display:none;pointer-events:auto">Sign out</button>' +
      '</div></div>' +
      '<div data-vox-save-hint class="vox-acc-hint">—</div>' +
      '<div data-vox-chars class="vox-acc-chars"></div>';
    var brand = screen.querySelector('.gw-brand') || screen.firstElementChild;
    if (brand && brand.nextSibling) screen.insertBefore(bar, brand.nextSibling);
    else screen.insertBefore(bar, screen.firstChild);

    bar.querySelector('[data-vox-login]').addEventListener('click', function () {
      loginGrudgeId();
    });
    bar.querySelector('[data-vox-puter]').addEventListener('click', function () {
      ensurePuterSession(true).then(function (ok) {
        if (!ok) return;
        return bridgePuterToGrudge().then(function () {
          return refreshRoster();
        }).then(function () {
          updateAccountBar();
        });
      });
    });
    bar.querySelector('[data-vox-logout]').addEventListener('click', logout);
    bar.querySelector('[data-vox-save]').addEventListener('click', function () {
      saveNow('manual').then(function (r) {
        if (r.ok) flash('Saved' + (r.cloud ? ' to Puter cloud' : ' locally'));
        else flash('Nothing to save yet');
      });
    });
    bar.querySelector('[data-vox-continue]').addEventListener('click', function () {
      continueFromCloud();
    });

    // inject minimal styles once
    if (!document.getElementById('vox-cloud-css')) {
      var st = document.createElement('style');
      st.id = 'vox-cloud-css';
      st.textContent =
        '#vox-account-bar{position:relative;z-index:3;width:min(92vw,720px);margin:0 auto 12px;padding:10px 12px;' +
        'background:rgba(6,10,18,0.9);border:1px solid #2a3550;border-radius:8px;pointer-events:auto;text-align:left}' +
        '#vox-account-bar .vox-acc-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}' +
        '#vox-account-bar .vox-acc-status{font-size:11px;color:#889;letter-spacing:0.5px}' +
        '#vox-account-bar .vox-acc-status.on{color:#8fd}' +
        '#vox-account-bar .vox-acc-status.puter{color:#e8a86e}' +
        '#vox-account-bar .vox-acc-actions{display:flex;flex-wrap:wrap;gap:6px}' +
        '#vox-account-bar .vox-acc-hint{font-size:10px;color:#556;margin-top:6px;letter-spacing:0.5px}' +
        '#vox-account-bar .vox-acc-chars{font-size:10px;color:#6a7;margin-top:4px}';
      document.head.appendChild(st);
    }
    updateAccountBar();
  }

  function flash(msg) {
    if (typeof global.showFlash === 'function') global.showFlash(msg);
    else console.log('[VoxCloud]', msg);
  }

  async function continueFromCloud() {
    var save = await loadBest();
    if (!save || !save.run) {
      flash('No save found');
      return;
    }
    _pendingApply = save;
    if (typeof global.startGameFromSave === 'function') {
      global.startGameFromSave(save);
    } else if (typeof global.startGame === 'function') {
      // Pre-select class + seed then start; apply after world loads
      if (save.run.playerClass) {
        try {
          if (typeof global.selectClass === 'function') global.selectClass(save.run.playerClass);
          else {
            global.playerClass = save.run.playerClass;
            var cards = document.querySelectorAll('.class-card');
            cards.forEach(function (c) {
              c.classList.toggle('sel', c.dataset.class === save.run.playerClass);
            });
            var btn = document.getElementById('start-btn');
            if (btn) btn.classList.remove('hidden');
          }
        } catch (e) { /* */ }
      }
      var seedInp = document.getElementById('world-seed-input');
      if (seedInp && save.run.worldSeed != null) seedInp.value = String(save.run.worldSeed);
      if (save.run.playerSkinBody) global.playerSkinBody = save.run.playerSkinBody;
      if (save.run.playerSkinTexture) global.playerSkinTexture = save.run.playerSkinTexture;
      global.startGame();
      // apply after a short delay once init may have run
      setTimeout(function () {
        applyPending();
      }, 2500);
    }
  }

  function applyPending() {
    if (!_pendingApply || !_hooks || typeof _hooks.apply !== 'function') return;
    try {
      _hooks.apply(_pendingApply.run);
      flash('Cloud save restored');
    } catch (e) {
      console.warn('[VoxCloud] apply', e);
    }
    _pendingApply = null;
    startAutosave();
    updateAccountBar();
  }

  function startAutosave() {
    stopAutosave();
    _timer = setInterval(function () {
      if (global.gameStarted && !global.isGameOver) saveNow('autosave');
    }, AUTOSAVE_MS);
    try {
      global.addEventListener('beforeunload', function () {
        if (global.gameStarted) {
          var p = collectPayload();
          if (p) localSet(p);
        }
      });
    } catch (e) { /* */ }
  }

  function stopAutosave() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  /**
   * Game shell registers collect/apply hooks after its globals exist.
   * collect() → plain object; apply(run) → mutates live game state.
   */
  function registerHooks(hooks) {
    _hooks = hooks || null;
  }

  async function init() {
    ensureAccountBar();
    _meta.grudgeId = lsGet('grudge_id');
    _meta.username = lsGet('grudge_username');

    if (global.GrudgeAuth && typeof global.GrudgeAuth.pickup === 'function') {
      try { await global.GrudgeAuth.pickup(); } catch (e) { /* */ }
    }

    // Silent Puter session (no popup) if already signed in
    await ensurePuterSession(false);
    if (puterReady() && !isGrudgeAuthed()) {
      await bridgePuterToGrudge();
    }

    await refreshRoster();
    updateAccountBar();

    // Re-render chars strip
    var charsEl = document.querySelector('#vox-account-bar [data-vox-chars]');
    if (charsEl && _meta.characters.length) {
      charsEl.textContent =
        'Heroes: ' +
        _meta.characters
          .slice(0, 4)
          .map(function (c) {
            return c.name || c.displayName || c.raceId || c.id;
          })
          .join(' · ');
    }

    global.addEventListener('grudge:auth:ready', function () {
      _meta.grudgeId = lsGet('grudge_id');
      _meta.username = lsGet('grudge_username');
      refreshRoster().then(updateAccountBar);
    });

    dispatch('grudge:vox:cloud-ready', { authed: isGrudgeAuthed(), puter: puterReady() });
  }

  global.VoxCloud = {
    init: init,
    registerHooks: registerHooks,
    saveNow: saveNow,
    loadBest: loadBest,
    continueFromCloud: continueFromCloud,
    applyPending: applyPending,
    startAutosave: startAutosave,
    stopAutosave: stopAutosave,
    loginGrudgeId: loginGrudgeId,
    logout: logout,
    ensurePuterSession: ensurePuterSession,
    isGrudgeAuthed: isGrudgeAuthed,
    puterReady: puterReady,
    grudgeId: grudgeId,
    authHeaders: authHeaders,
    getMeta: function () { return Object.assign({}, _meta); },
    updateAccountBar: updateAccountBar,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    setTimeout(init, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
