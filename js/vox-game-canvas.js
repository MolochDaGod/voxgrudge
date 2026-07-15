/**
 * Vox game canvas best practices — resize, DPR, visibility pause, dispose.
 *
 *   const canvasHost = VoxGameCanvas.mount({
 *     wrap: document.getElementById('game-canvas-wrap'),
 *     THREE,
 *     antialias: true,
 *     maxDpr: 2,
 *     onResize(w, h, dpr) { camera.aspect = w/h; camera.updateProjectionMatrix(); },
 *   });
 *   // canvasHost.renderer, .setAnimationLoop(fn), .dispose()
 */
(function (global) {
  "use strict";

  function mount(opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    if (!THREE) throw new Error("THREE required");
    var wrap = opts.wrap || document.getElementById("game-canvas-wrap");
    if (!wrap) throw new Error("canvas wrap element required");

    var maxDpr = opts.maxDpr != null ? opts.maxDpr : 2;
    var renderer = new THREE.WebGLRenderer({
      antialias: opts.antialias !== false,
      alpha: !!opts.alpha,
      powerPreference: opts.powerPreference || "high-performance",
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
    });
    renderer.setClearColor(opts.clearColor != null ? opts.clearColor : 0x0a0e14, 1);
    renderer.shadowMap.enabled = opts.shadows !== false;
    if (THREE.PCFSoftShadowMap) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Avoid washed-out voxels
    if ("outputEncoding" in renderer && THREE.sRGBEncoding != null) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    if ("physicallyCorrectLights" in renderer) renderer.physicallyCorrectLights = false;

    wrap.innerHTML = "";
    wrap.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.setAttribute("tabindex", "0");
    renderer.domElement.setAttribute("aria-label", opts.ariaLabel || "Game canvas");

    var paused = false;
    var loopFn = null;
    var ro = null;
    var disposed = false;

    function size() {
      var w = wrap.clientWidth || window.innerWidth || 1;
      var h = wrap.clientHeight || window.innerHeight || 1;
      var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      if (opts.onResize) opts.onResize(w, h, dpr);
      return { w: w, h: h, dpr: dpr };
    }

    function onVisibility() {
      if (document.hidden) {
        paused = true;
        if (opts.onPause) opts.onPause();
      } else {
        paused = false;
        if (opts.onResume) opts.onResume();
      }
    }

    function tick(t) {
      if (disposed) return;
      if (!paused && loopFn) {
        try {
          loopFn(t);
        } catch (err) {
          console.error("[VoxGameCanvas] frame", err);
        }
      }
      // r128: setAnimationLoop may not exist — fall back handled by setAnimationLoop
    }

    function setAnimationLoop(fn) {
      loopFn = fn;
      if (renderer.setAnimationLoop) {
        renderer.setAnimationLoop(function (t) {
          tick(t);
        });
      } else {
        (function raf() {
          if (disposed) return;
          requestAnimationFrame(raf);
          tick(performance.now());
        })();
      }
    }

    function dispose() {
      disposed = true;
      if (renderer.setAnimationLoop) renderer.setAnimationLoop(null);
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", onVisibility);
      if (ro) {
        try {
          ro.disconnect();
        } catch (e) {}
      }
      try {
        renderer.dispose();
      } catch (e) {}
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }

    window.addEventListener("resize", size, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(function () {
        size();
      });
      ro.observe(wrap);
    }

    size();
    onVisibility();

    return {
      renderer: renderer,
      wrap: wrap,
      size: size,
      setAnimationLoop: setAnimationLoop,
      isPaused: function () {
        return paused;
      },
      setPaused: function (v) {
        paused = !!v;
      },
      dispose: dispose,
    };
  }

  /** Dependency readiness checks for game boot. */
  function checkDeps(need) {
    need = need || {};
    var missing = [];
    if (need.THREE !== false && !global.THREE) missing.push("THREE");
    if (need.FBXLoader && !(global.THREE && global.THREE.FBXLoader) && !global.FBXLoader) {
      missing.push("FBXLoader");
    }
    if (need.GLTFLoader && !(global.THREE && global.THREE.GLTFLoader)) missing.push("GLTFLoader");
    if (need.TvsUnitLoader && !global.TvsUnitLoader) missing.push("TvsUnitLoader");
    if (need.TvsWorldContent && !global.TvsWorldContent) missing.push("TvsWorldContent");
    return { ok: missing.length === 0, missing: missing };
  }

  global.VoxGameCanvas = {
    mount: mount,
    checkDeps: checkDeps,
  };
})(typeof window !== "undefined" ? window : globalThis);
