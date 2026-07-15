/**
 * VoxGrudge boot orchestrator — macro best-practice entry for dependency gate,
 * UI PNG preload, CSS var bind, and start-button unlock.
 *
 *   VoxBoot.run({
 *     statusEl: '#vox-boot-status',
 *     startBtn: '#start-btn',
 *     onReady(report) {},
 *     onFail(report) {},
 *   });
 */
(function (global) {
  "use strict";

  var lastReport = null;

  function el(sel) {
    if (!sel) return null;
    if (typeof sel === "string") return document.querySelector(sel);
    return sel;
  }

  function setStatus(node, text, cls) {
    if (!node) return;
    node.textContent = text;
    node.className = cls || "";
  }

  /**
   * Full boot checklist. Safe to call multiple times.
   * @returns {Promise<{ok:boolean, deps, ui, cdn, issues:string[]}>}
   */
  async function run(opts) {
    opts = opts || {};
    var statusEl = el(opts.statusEl || "#vox-boot-status");
    var startBtn = el(opts.startBtn || "#start-btn");
    var issues = [];
    var report = {
      ok: false,
      deps: null,
      ui: null,
      cdn: null,
      stack: global.GrudgeThreeStack || null,
      issues: issues,
      at: Date.now(),
    };

    setStatus(statusEl, "Checking engine deps…", "");

    // 1) Engine deps
    var need = opts.need || {
      THREE: true,
      FBXLoader: true,
      GLTFLoader: true,
      fflate: true,
      TvsUnitLoader: true,
      TvsWorldContent: true,
      VoxUiDeps: true,
      VoxGameFlow: true,
      WebGL: true,
    };
    var deps = global.VoxGameCanvas
      ? VoxGameCanvas.checkDeps(need)
      : { ok: false, missing: ["VoxGameCanvas"] };
    report.deps = deps;
    if (!deps.ok) {
      issues.push("Missing: " + (deps.missing || []).join(", "));
    }
    if (global.GrudgeThreeStack && !GrudgeThreeStack.ok) {
      issues.push("Three stack: " + (GrudgeThreeStack.issues || []).join(" | "));
    }

    // 2) Asset config / CDN mode
    var cdnOn = !!(global.GrudgeAssets && GrudgeAssets.useR2 && GrudgeAssets.useR2());
    report.cdn = {
      useR2: cdnOn,
      origin: global.GrudgeAssets && GrudgeAssets.R2_ORIGIN,
      app: global.GrudgeAssets && GrudgeAssets.R2_APP,
    };
    if (global.GrudgeAssets && GrudgeAssets.applyHudCssVars) {
      try {
        GrudgeAssets.applyHudCssVars();
      } catch (e) {
        issues.push("HUD CSS vars: " + e.message);
      }
    }

    // 3) UI PNG preload + CSS
    setStatus(statusEl, "Loading UI PNG frames…", "");
    if (global.VoxUiDeps) {
      try {
        VoxUiDeps.refreshManifest();
        VoxUiDeps.applyCssVars();
        VoxUiDeps.patchHudCssBase();
        var ui = await VoxUiDeps.preload({
          group: "critical",
          onProgress: function (p) {
            setStatus(statusEl, "UI PNG " + p.pct + "% · " + p.id, "");
          },
        });
        report.ui = ui;
        if (ui.failed > 0) {
          issues.push("UI frames failed: " + ui.failed + "/" + ui.total);
        }
        VoxUiDeps.repairBrokenImages(document);
        VoxUiDeps.repairBackgrounds(document);
      } catch (e) {
        issues.push("UI preload: " + (e && e.message));
        report.ui = { ok: false, error: String(e) };
      }
    } else {
      issues.push("VoxUiDeps missing");
    }

    // 4) Optional kit init (carousels etc.) — caller often does VoxUiKit
    if (opts.initKit && global.VoxUiKit) {
      try {
        await VoxUiKit.init({
          onProgress: function (p) {
            setStatus(statusEl, "UI kit " + p.pct + "% · " + p.id, "");
          },
        });
      } catch (e) {
        issues.push("VoxUiKit: " + (e && e.message));
      }
    }

    // 5) Gate start button: require engine deps; UI failures are soft-warn
    var hardFail = !deps.ok;
    report.ok = !hardFail;
    lastReport = report;

    if (hardFail) {
      setStatus(statusEl, "Boot blocked — " + issues[0], "bad");
      if (startBtn) {
        startBtn.classList.add("hidden");
        startBtn.disabled = true;
        startBtn.setAttribute("aria-disabled", "true");
      }
      if (opts.onFail) opts.onFail(report);
    } else {
      var msg =
        "Ready · canvas/TVS online" +
        (cdnOn ? " · CDN" : " · local assets") +
        (report.ui && report.ui.failed ? " · UI warn " + report.ui.failed : "");
      setStatus(statusEl, msg, report.ui && report.ui.failed ? "" : "ok");
      // Do not force-show start — class select still required; only unlock attribute
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.removeAttribute("aria-disabled");
        startBtn.dataset.voxBootOk = "1";
      }
      if (opts.onReady) opts.onReady(report);
    }

    try {
      document.documentElement.dataset.voxBoot = hardFail ? "fail" : "ok";
      document.documentElement.dataset.voxCdn = cdnOn ? "1" : "0";
    } catch (e) {}

    console.info("[VoxBoot]", report.ok ? "OK" : "FAIL", report);
    return report;
  }

  function getReport() {
    return lastReport;
  }

  /** Lightweight assert before startGame — returns false if boot hard-failed. */
  function canStart() {
    if (!lastReport) return true; // not run yet — don't hard-block legacy paths
    return !!lastReport.ok;
  }

  global.VoxBoot = {
    run: run,
    getReport: getReport,
    canStart: canStart,
  };
})(typeof window !== "undefined" ? window : globalThis);
