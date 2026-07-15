/**
 * Vox game flow state machine —
 *   boot → select → loading → playing ⇄ pause → dead | error
 *
 *   const flow = VoxGameFlow.create({
 *     onEnter(state, prev, meta) {},
 *     onLeave(state, next, meta) {},
 *     ui: { setStep, setLoading, showHud, showClassScreen, showPause, showDead, showError },
 *   });
 *   flow.goto('select');
 *   await flow.runLoadStages([{ id, label, run }]);
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
    pause: ["playing", "select", "dead", "error"],
    dead: ["select", "loading", "playing"],
    error: ["boot", "select", "loading"],
  };

  /** Map flow state → flow-rail step (hero/world/load/play). */
  var RAIL = {
    boot: "hero",
    select: "hero",
    loading: "load",
    playing: "play",
    pause: "play",
    dead: "play",
    error: "hero",
  };

  function create(opts) {
    opts = opts || {};
    var state = "boot";
    var history = ["boot"];
    var meta = {};
    var listeners = [];
    var loadToken = 0;

    function emit(event, detail) {
      listeners.forEach(function (fn) {
        try {
          fn(event, detail);
        } catch (e) {
          console.warn("[VoxGameFlow]", e);
        }
      });
      if (event === "leave" && opts.onLeave) {
        try {
          opts.onLeave(detail.state, detail.next, detail.meta);
        } catch (e) {
          console.warn("[VoxGameFlow] onLeave", e);
        }
      }
      if (event === "enter") {
        if (opts.onEnter) {
          try {
            opts.onEnter(detail.state, detail.prev, detail.meta);
          } catch (e) {
            console.warn("[VoxGameFlow] onEnter", e);
          }
        }
        applyUi(detail.state, detail.meta);
      }
    }

    function applyUi(s, m) {
      var ui = opts.ui || {};
      if (ui.setStep) ui.setStep(s, m);
      if (ui.setRail) ui.setRail(RAIL[s] || s, m);

      // Reset overlays that should only show for one state
      if (s !== "pause" && ui.showPause) ui.showPause(false);
      if (s !== "dead" && ui.showDead) ui.showDead(false);
      if (s !== "error" && ui.showError) ui.showError(false);

      if (s === "select") {
        if (ui.showClassScreen) ui.showClassScreen(true);
        if (ui.showHud) ui.showHud(false);
        if (ui.setLoading) ui.setLoading(false);
      } else if (s === "loading") {
        if (ui.showClassScreen) ui.showClassScreen(false);
        if (ui.setLoading) {
          ui.setLoading(true, (m && m.label) || "Loading…", (m && m.pct) || 0);
        }
      } else if (s === "playing") {
        if (ui.showClassScreen) ui.showClassScreen(false);
        if (ui.setLoading) ui.setLoading(false);
        if (ui.showHud) ui.showHud(true);
      } else if (s === "pause") {
        if (ui.showPause) ui.showPause(true);
      } else if (s === "dead") {
        if (ui.showDead) ui.showDead(true);
        if (ui.showHud) ui.showHud(true);
      } else if (s === "error") {
        if (ui.showError) ui.showError((m && m.message) || "Something went wrong");
        if (ui.setLoading) ui.setLoading(false);
      } else if (s === "boot") {
        if (ui.showClassScreen) ui.showClassScreen(false);
        if (ui.showHud) ui.showHud(false);
        if (ui.setLoading) ui.setLoading(true, (m && m.label) || "Booting…", 0);
      }
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
        // Re-apply loading label/pct when staying in loading
        if (next === "loading") applyUi(next, meta);
        return true;
      }
      if (!canGo(next) && !opts.forceTransitions) {
        console.warn("[VoxGameFlow] illegal", state, "→", next);
        return false;
      }
      var prev = state;
      emit("leave", { state: prev, next: next, meta: meta });
      state = next;
      meta = nextMeta || {};
      history.push(next);
      if (history.length > 48) history.shift();
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

    /**
     * Run ordered load stages with progress. Cancels prior run via token.
     * stages: [{ id?, label, run: () => Promise|void }]
     */
    function runLoadStages(stages, onProgress) {
      stages = stages || [];
      var token = ++loadToken;
      var total = stages.length;
      return (async function () {
        if (!goto("loading", { label: "Preparing…", pct: 0 })) {
          // force into loading if stuck (e.g. from dead)
          if (opts.forceTransitions || state === "dead" || state === "error" || state === "select") {
            var prevForce = opts.forceTransitions;
            opts.forceTransitions = true;
            goto("loading", { label: "Preparing…", pct: 0 });
            opts.forceTransitions = prevForce;
          }
        }
        for (var i = 0; i < total; i++) {
          if (token !== loadToken) throw new Error("load cancelled");
          var st = stages[i];
          var pct = Math.round((i / Math.max(1, total)) * 100);
          var detail = {
            stage: st.id || st.label,
            label: st.label,
            pct: pct,
            index: i,
            total: total,
          };
          if (onProgress) onProgress(detail);
          goto("loading", {
            label: st.label,
            pct: pct,
            stage: st.id || st.label,
          });
          try {
            await Promise.resolve(typeof st.run === "function" ? st.run() : null);
          } catch (err) {
            console.error("[VoxGameFlow] stage failed", st.id || st.label, err);
            goto("error", {
              message: (st.label || "Load") + " failed: " + (err && err.message ? err.message : err),
              stage: st.id,
            });
            throw err;
          }
        }
        if (token !== loadToken) throw new Error("load cancelled");
        if (onProgress) {
          onProgress({ stage: "done", label: "Ready", pct: 100, index: total, total: total });
        }
        return true;
      })();
    }

    function cancelLoad() {
      loadToken++;
    }

    return {
      STATES: STATES,
      RAIL: RAIL,
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
      cancelLoad: cancelLoad,
      isPlaying: function () {
        return state === "playing";
      },
      isPaused: function () {
        return state === "pause";
      },
      isLoading: function () {
        return state === "loading";
      },
      /** True when sim + input should run (not pause/dead/loading). */
      shouldTick: function () {
        return state === "playing";
      },
    };
  }

  global.VoxGameFlow = {
    create: create,
    STATES: STATES,
    RAIL: RAIL,
  };
})(typeof window !== "undefined" ? window : globalThis);
