/**
 * TVS Hero preview stage for #hero panel — same loader as in-game (scale/texture/GLB).
 *
 *   TvsHeroPreview.mount({
 *     host: document.getElementById('tvs-hero-preview'),
 *     THREE, unit, colorTint,
 *   });
 */
(function (global) {
  "use strict";

  var active = null;

  function mount(opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    var host = opts.host || document.getElementById("tvs-hero-preview");
    if (!THREE || !host) {
      console.warn("[TvsHeroPreview] THREE + host required");
      return null;
    }
    if (active) {
      try {
        active.dispose();
      } catch (e) {}
      active = null;
    }

    host.innerHTML = "";
    host.classList.add("tvs-hero-preview");
    var status = document.createElement("div");
    status.className = "tvs-hero-preview__status";
    status.textContent = "Loading hero…";
    host.appendChild(status);

    var w = host.clientWidth || 320;
    var h = Math.max(220, Math.min(360, host.clientHeight || 280));

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    if ("outputEncoding" in renderer && THREE.sRGBEncoding != null) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = h + "px";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.borderRadius = "8px";
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e14);
    var camera = new THREE.PerspectiveCamera(35, w / Math.max(1, h), 0.1, 50);
    camera.position.set(1.6, 1.4, 2.8);
    camera.lookAt(0, 1.0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    var dir = new THREE.DirectionalLight(0xffe8c0, 1.1);
    dir.position.set(3, 6, 4);
    scene.add(dir);
    var grid = new THREE.GridHelper(4, 8, 0x334455, 0x1a2230);
    grid.position.y = 0.001;
    scene.add(grid);

    // 2m reference stick
    var stick = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 2.0, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x3dd6a5 })
    );
    stick.position.set(-1.1, 1.0, 0);
    scene.add(stick);

    var root = null;
    var mixer = null;
    var disposed = false;
    var raf = 0;
    var clock = new THREE.Clock();
    var yaw = 0.4;

    function frame() {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05);
      if (root) {
        root.rotation.y = yaw;
        yaw += dt * 0.35;
      }
      if (mixer) mixer.update(dt);
      if (root && root.userData && root.userData.updateMixer) root.userData.updateMixer(dt);
      renderer.render(scene, camera);
    }
    frame();

    async function loadUnit(unit, tint) {
      if (!unit || !global.TvsUnitLoader) {
        status.textContent = "TVS loader offline";
        status.className = "tvs-hero-preview__status bad";
        return;
      }
      status.textContent = "Loading " + (unit.displayName || unit.unitId) + "…";
      status.className = "tvs-hero-preview__status";
      try {
        if (root) {
          scene.remove(root);
          root = null;
        }
        mixer = null;
        var model = await TvsUnitLoader.loadTvsUnit(unit, {
          THREE: THREE,
          FBXLoader: THREE.FBXLoader,
          GLTFLoader: THREE.GLTFLoader,
          height: (global.GrudgeScale && GrudgeScale.PLAYER_HEIGHT_M) || 2.0,
          withTexture: true,
          withAnims: true,
          loadSidecars: true,
          preferGlb: true,
          maxClips: 2,
          colorTint: tint != null && tint !== 0xffffff ? tint : null,
        });
        if (disposed) return;
        root = model;
        scene.add(root);
        if (model.userData.mixer) mixer = model.userData.mixer;
        var rep = model.userData.importReport || {};
        var h = rep.measuredHeight || rep.height || "?";
        status.textContent =
          (unit.displayName || unit.unitId) +
          " · " +
          (rep.format || "?") +
          (rep.compressed ? " compressed" : "") +
          " · h≈" +
          (typeof h === "number" ? h.toFixed(2) + "m" : h) +
          (rep.hasTexture ? " · textured" : " · NO TEX");
        status.className = "tvs-hero-preview__status " + (rep.hasTexture ? "ok" : "bad");
        if (opts.onReady) opts.onReady(rep, model);
      } catch (err) {
        console.warn("[TvsHeroPreview]", err);
        status.textContent = "Load failed: " + (err && err.message ? err.message : err);
        status.className = "tvs-hero-preview__status bad";
      }
    }

    if (opts.unit) loadUnit(opts.unit, opts.colorTint);

    var api = {
      loadUnit: loadUnit,
      dispose: function () {
        disposed = true;
        cancelAnimationFrame(raf);
        try {
          renderer.dispose();
        } catch (e) {}
        host.innerHTML = "";
        if (active === api) active = null;
      },
      getReport: function () {
        return root && root.userData ? root.userData.importReport : null;
      },
    };
    active = api;
    return api;
  }

  global.TvsHeroPreview = {
    mount: mount,
    get active() {
      return active;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
