/**
 * Vox game flow state machine — boot → select → loading → playing → pause → dead.
 *
 *   const flow = VoxGameFlow.create({
 *     onEnter(state, prev, meta) { ... },
 *     ui: { setStep, setLoading, showHud, showClassScreen },
 *   });
 *   flow.goto('select');
 *   flow.goto('loading', { label: 'World' });
 *   flow.goto('playing');
 */
(function (global) {
  "use strict";

  var STATES = ["boot", "select", "loading", "playing", "pause", "dead", "error"];

  var TRANSITIONS = {
    boot: ["select", "loading", "error"],
    select: ["loading", "boot", "error"],
    loading: ["playing", "select", "error"],
    playing: ["pause", "dead", "select", "loading", "error"],
    pause: ["playing", "select", "dead"],
    dead: ["select", "loading", "playing"],
    error: ["boot", "select"],
  };

  function create(opts) {
    opts = opts || {};
    var state = "boot";
    var history = ["boot"];
    var meta = {};
    var listeners = [];

    function emit(event, detail) {
      listeners.forEach(function (fn) {
        try {
          fn(event, detail);
        } catch (e) {
          console.warn("[VoxGameFlow]", e);
        }
      });
      if (opts.onEnter && event === "enter") opts.onEnter(detail.state, detail.prev, detail.meta);
      if (opts.ui) applyUi(detail.state, detail.meta);
    }

    function applyUi(s, m) {
      var ui = opts.ui || {};
      if (ui.setStep) ui.setStep(s, m);
      if (s === "select") {
        if (ui.showClassScreen) ui.showClassScreen(true);
        if (ui.showHud) ui.showHud(false);
        if (ui.setLoading) ui.setLoading(false);
      } else if (s === "loading") {
        if (ui.showClassScreen) ui.showClassScreen(false);
        if (ui.setLoading) ui.setLoading(true, (m && m.label) || "Loading…");
      } else if (s === "playing") {
        if (ui.showClassScreen) ui.showClassScreen(false);
        if (ui.setLoading) ui.setLoading(false);
        if (ui.showHud) ui.showHud(true);
      } else if (s === "pause") {
        if (ui.showPause) ui.showPause(true);
      } else if (s === "dead") {
        if (ui.showDead) ui.showDead(true);
      } else if (s === "error") {
        if (ui.showError) ui.showError((m && m.message) || "Error");
      }
      if (s !== "pause" && ui.showPause) ui.showPause(false);
    }

    function canGo(next) {
      var allowed = TRANSITIONS[state] || [];
      return allowed.indexOf(next) >= 0;
    }

    function goto(next, nextMeta) {
      if (STATES.indexOf(next) < 0) {
        console.warn("[VoxGameFlow] unknown state", next);
        return false;
      }
      if (next === state) {
        meta = Object.assign({}, meta, nextMeta || {});
        return true;
      }
      if (!canGo(next) && !(opts.forceTransitions)) {
        console.warn("[VoxGameFlow] illegal", state, "→", next);
        return false;
      }
      var prev = state;
      state = next;
      meta = nextMeta || {};
      history.push(next);
      if (history.length > 32) history.shift();
      emit("enter", { state: state, prev: prev, meta: meta });
      return true;
    }

    function on(fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (x) {
          return x !== fn;
        });
      };
    }

    /** Structured load stages for progress UI */
    function runLoadStages(stages, onProgress) {
      stages = stages || [];
      var i = 0;
      var total = stages.length;
      return (async function () {
        goto("loading", { label: "Preparing…", pct: 0 });
        for (; i < total; i++) {
          var st = stages[i];
          var pct = Math.round((i / total) * 100);
          if (onProgress) onProgress({ stage: st.id || st.label, label: st.label, pct: pct, index: i, total: total });
          goto("loading", { label: st.label, pct: pct, stage: st.id });
          await Promise.resolve(st.run());
        }
        if (onProgress) onProgress({ stage: "done", label: "Ready", pct: 100, index: total, total: total });
        return true;
      })();
    }

    return {
      STATES: STATES,
      get state() {
        return state;
      },
      get meta() {
        return meta;
      },
      history: function () {
        return history.slice();
      },
      canGo: canGo,
      goto: goto,
      on: on,
      runLoadStages: runLoadStages,
      isPlaying: function () {
        return state === "playing";
      },
      isPaused: function () {
        return state === "pause";
      },
    };
  }

  global.VoxGameFlow = {
    create: create,
    STATES: STATES,
  };
})(typeof window !== "undefined" ? window : globalThis);
