/**
 * Vox game canvas best practices — resize, DPR, visibility pause, context loss,
 * color space, dispose, and a delta-clamped animation loop.
 *
 *   const host = VoxGameCanvas.mount({
 *     wrap: document.getElementById('game-canvas-wrap'),
 *     THREE,
 *     maxDpr: 2,
 *     onResize(w, h, dpr) { camera.aspect = w/h; camera.updateProjectionMatrix(); },
 *     onPause() {},
 *     onResume() {},
 *     onContextLost() {},
 *     onContextRestored() {},
 *   });
 *   host.setAnimationLoop(function (t, dt) { ... });
 *   host.dispose();
 */
(function (global) {
  "use strict";

  /** Cap frame delta so tab-resume spikes don't explode physics. */
  var DEFAULT_MAX_DT = 0.05;

  function applyColorSpace(renderer, THREE) {
    // r152+: outputColorSpace; r128: outputEncoding
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace != null) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ("outputEncoding" in renderer && THREE.sRGBEncoding != null) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    if ("physicallyCorrectLights" in renderer) renderer.physicallyCorrectLights = false;
    // Soft tone mapping optional — voxels look better without ACES wash
    if (THREE.NoToneMapping != null) renderer.toneMapping = THREE.NoToneMapping;
  }

  function mount(opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    if (!THREE) throw new Error("THREE required");
    var wrap = opts.wrap || document.getElementById("game-canvas-wrap");
    if (!wrap) throw new Error("canvas wrap element required");

    var maxDpr = opts.maxDpr != null ? opts.maxDpr : 2;
    var maxDt = opts.maxDt != null ? opts.maxDt : DEFAULT_MAX_DT;
    var renderer = new THREE.WebGLRenderer({
      antialias: opts.antialias !== false,
      alpha: !!opts.alpha,
      powerPreference: opts.powerPreference || "high-performance",
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
    });
    renderer.setClearColor(opts.clearColor != null ? opts.clearColor : 0x0a0e14, 1);
    renderer.shadowMap.enabled = opts.shadows !== false;
    if (THREE.PCFSoftShadowMap) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    applyColorSpace(renderer, THREE);

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
    var lastT = 0;
    var rafId = 0;
    var usingSetAnimLoop = false;
    var contextLost = false;

    function size() {
      if (disposed) return { w: 1, h: 1, dpr: 1 };
      var w = wrap.clientWidth || window.innerWidth || 1;
      var h = wrap.clientHeight || window.innerHeight || 1;
      var dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      try {
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
      } catch (e) {
        console.warn("[VoxGameCanvas] size", e);
      }
      if (opts.onResize) opts.onResize(w, h, dpr);
      return { w: w, h: h, dpr: dpr };
    }

    function onVisibility() {
      if (document.hidden) {
        paused = true;
        if (opts.onPause) opts.onPause("visibility");
      } else {
        // Reset delta clock so resume doesn't dump a huge dt
        lastT = 0;
        paused = false;
        if (opts.onResume) opts.onResume("visibility");
      }
    }

    function onContextLost(e) {
      e.preventDefault();
      contextLost = true;
      paused = true;
      console.error("[VoxGameCanvas] WebGL context lost");
      if (opts.onContextLost) opts.onContextLost(e);
    }

    function onContextRestored() {
      contextLost = false;
      lastT = 0;
      applyColorSpace(renderer, THREE);
      size();
      paused = document.hidden;
      console.info("[VoxGameCanvas] WebGL context restored");
      if (opts.onContextRestored) opts.onContextRestored();
    }

    function tick(t) {
      if (disposed || contextLost) return;
      if (paused || !loopFn) return;
      var now = typeof t === "number" ? t : performance.now();
      var dt = lastT ? (now - lastT) / 1000 : 1 / 60;
      lastT = now;
      if (dt > maxDt) dt = maxDt;
      if (dt < 0) dt = 0;
      try {
        loopFn(now, dt);
      } catch (err) {
        console.error("[VoxGameCanvas] frame", err);
        if (opts.onFrameError) opts.onFrameError(err);
      }
    }

    function setAnimationLoop(fn) {
      loopFn = fn;
      lastT = 0;
      if (renderer.setAnimationLoop) {
        usingSetAnimLoop = true;
        renderer.setAnimationLoop(function (t) {
          tick(t);
        });
      } else if (!rafId) {
        usingSetAnimLoop = false;
        (function raf(t) {
          if (disposed) return;
          rafId = requestAnimationFrame(raf);
          tick(t);
        })(performance.now());
      }
    }

    function dispose() {
      disposed = true;
      loopFn = null;
      if (renderer.setAnimationLoop) renderer.setAnimationLoop(null);
      if (rafId) {
        try {
          cancelAnimationFrame(rafId);
        } catch (e) {}
        rafId = 0;
      }
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", onVisibility);
      if (renderer.domElement) {
        renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
        renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      }
      if (ro) {
        try {
          ro.disconnect();
        } catch (e) {}
        ro = null;
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
    renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored, false);

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
      isContextLost: function () {
        return contextLost;
      },
      setPaused: function (v) {
        paused = !!v;
        if (!paused) lastT = 0;
      },
      /** Soft pause (e.g. modal) without treating as visibility. */
      pause: function () {
        paused = true;
        if (opts.onPause) opts.onPause("manual");
      },
      resume: function () {
        lastT = 0;
        paused = false;
        if (opts.onResume) opts.onResume("manual");
      },
      dispose: dispose,
    };
  }

  /**
   * Dependency readiness for game boot.
   * need: { THREE, FBXLoader, GLTFLoader, fflate, TvsUnitLoader, TvsWorldContent, VoxUiDeps, WebGL }
   */
  function checkDeps(need) {
    need = need || {};
    var missing = [];
    if (need.THREE !== false && !global.THREE) missing.push("THREE");
    if (need.fflate && typeof global.fflate === "undefined") missing.push("fflate");
    if (need.FBXLoader && !(global.THREE && global.THREE.FBXLoader) && !global.FBXLoader) {
      missing.push("FBXLoader");
    }
    if (need.GLTFLoader && !(global.THREE && global.THREE.GLTFLoader)) missing.push("GLTFLoader");
    if (need.TvsUnitLoader && !global.TvsUnitLoader) missing.push("TvsUnitLoader");
    if (need.TvsWorldContent && !global.TvsWorldContent) missing.push("TvsWorldContent");
    if (need.VoxUiDeps && !global.VoxUiDeps) missing.push("VoxUiDeps");
    if (need.VoxGameFlow && !global.VoxGameFlow) missing.push("VoxGameFlow");
    if (need.WebGL !== false) {
      try {
        var c = document.createElement("canvas");
        var gl = c.getContext("webgl2") || c.getContext("webgl");
        if (!gl) missing.push("WebGL");
      } catch (e) {
        missing.push("WebGL");
      }
    }
    if (need.GrudgeThreeStack && global.GrudgeThreeStack && !global.GrudgeThreeStack.ok) {
      (global.GrudgeThreeStack.issues || []).forEach(function (iss) {
        missing.push("stack:" + iss);
      });
    }
    return { ok: missing.length === 0, missing: missing };
  }

  /** Configure a GLTFLoader with Meshopt + DRACO when VoxGltfConfigure exists. */
  function configureGltfLoader(loader) {
    if (global.VoxGltfConfigure) return global.VoxGltfConfigure(loader);
    return loader;
  }

  global.VoxGameCanvas = {
    mount: mount,
    checkDeps: checkDeps,
    configureGltfLoader: configureGltfLoader,
    applyColorSpace: applyColorSpace,
  };
})(typeof window !== "undefined" ? window : globalThis);
