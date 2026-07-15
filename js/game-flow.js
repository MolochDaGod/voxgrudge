/**
 * VoxGrudge game flow — explicit high-level states for menu → load → play → death.
 * Keeps HUD / loading / pause transitions consistent and queryable.
 */
(function (global) {
  'use strict';

  var FLOW = (global.VoxStandards && global.VoxStandards.FLOW) || {
    MENU: 'menu',
    CLASS_SELECT: 'class_select',
    LOADING: 'loading',
    PLAYING: 'playing',
    PAUSED: 'paused',
    NIGHT_RAID: 'night_raid',
    DEATH: 'death',
    RESPAWN: 'respawn',
  };

  var state = FLOW.CLASS_SELECT;
  var prev = null;
  var listeners = [];
  var meta = {
    dayNumber: 1,
    isNight: false,
    raidActive: false,
    loadProgress: 0,
    loadLabel: '',
  };

  function get() {
    return state;
  }

  function getMeta() {
    return meta;
  }

  function canPlay() {
    return state === FLOW.PLAYING || state === FLOW.NIGHT_RAID;
  }

  function isPaused() {
    return state === FLOW.PAUSED;
  }

  function isLoading() {
    return state === FLOW.LOADING;
  }

  function isDead() {
    return state === FLOW.DEATH || state === FLOW.RESPAWN;
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function off() {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  }

  function emit(from, to, reason) {
    listeners.forEach(function (fn) {
      try {
        fn({ from: from, to: to, reason: reason || '', meta: meta });
      } catch (e) {
        console.warn('[GameFlow] listener', e);
      }
    });
  }

  function set(next, reason) {
    if (!next || next === state) return state;
    // Basic legal transitions
    var ok = true;
    if (state === FLOW.DEATH && next === FLOW.PLAYING) ok = true; // respawn path
    if (state === FLOW.LOADING && next !== FLOW.PLAYING && next !== FLOW.CLASS_SELECT) {
      // allow stay / cancel to class
    }
    prev = state;
    state = next;
    emit(prev, state, reason);
    syncDom();
    return state;
  }

  function syncDom() {
    try {
      var body = global.document && global.document.body;
      if (!body) return;
      body.dataset.gameFlow = state;
      body.classList.toggle('is-world-loading', state === FLOW.LOADING);
      body.classList.toggle('is-paused-flow', state === FLOW.PAUSED);
      body.classList.toggle('is-night-raid', state === FLOW.NIGHT_RAID || meta.raidActive);
      body.classList.toggle('is-dead-flow', state === FLOW.DEATH);
    } catch (e) {}
  }

  function enterClassSelect() {
    meta.raidActive = false;
    meta.loadProgress = 0;
    return set(FLOW.CLASS_SELECT, 'class_select');
  }

  function enterLoading(label) {
    meta.loadLabel = label || 'Loading world…';
    meta.loadProgress = 0;
    return set(FLOW.LOADING, 'load_start');
  }

  function setLoadProgress(p, label) {
    meta.loadProgress = Math.max(0, Math.min(1, p || 0));
    if (label) meta.loadLabel = label;
  }

  function enterPlaying(reason) {
    meta.raidActive = false;
    return set(FLOW.PLAYING, reason || 'enter_surface');
  }

  function enterPaused() {
    if (!canPlay() && state !== FLOW.NIGHT_RAID) return state;
    return set(FLOW.PAUSED, 'pause');
  }

  function resume() {
    if (state !== FLOW.PAUSED) return state;
    return set(meta.raidActive ? FLOW.NIGHT_RAID : FLOW.PLAYING, 'resume');
  }

  function enterNightRaid(dayNumber) {
    meta.isNight = true;
    meta.raidActive = true;
    if (dayNumber != null) meta.dayNumber = dayNumber;
    if (state === FLOW.PLAYING || state === FLOW.NIGHT_RAID) {
      return set(FLOW.NIGHT_RAID, 'night_raid');
    }
    return state;
  }

  function endNightRaid() {
    meta.raidActive = false;
    if (state === FLOW.NIGHT_RAID) return set(FLOW.PLAYING, 'dawn');
    return state;
  }

  function enterDeath() {
    meta.raidActive = false;
    return set(FLOW.DEATH, 'fallen');
  }

  function enterRespawn() {
    return set(FLOW.RESPAWN, 'respawn');
  }

  function updateDayNight(dayNumber, isNight) {
    meta.dayNumber = dayNumber;
    meta.isNight = !!isNight;
    if (!isNight && state === FLOW.NIGHT_RAID) endNightRaid();
  }

  global.GameFlow = {
    FLOW: FLOW,
    get: get,
    getMeta: getMeta,
    canPlay: canPlay,
    isPaused: isPaused,
    isLoading: isLoading,
    isDead: isDead,
    onChange: onChange,
    set: set,
    enterClassSelect: enterClassSelect,
    enterLoading: enterLoading,
    setLoadProgress: setLoadProgress,
    enterPlaying: enterPlaying,
    enterPaused: enterPaused,
    resume: resume,
    enterNightRaid: enterNightRaid,
    endNightRaid: endNightRaid,
    enterDeath: enterDeath,
    enterRespawn: enterRespawn,
    updateDayNight: updateDayNight,
    syncDom: syncDom,
  };
})(typeof window !== 'undefined' ? window : globalThis);
