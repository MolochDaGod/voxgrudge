/**
 * Hero preview stage for #hero panel.
 *
 * Primary: Avatar Explorer races (TvsVoxelRaceDefaults) — player body + procedural clips.
 * Legacy: TVS pack unit via TvsUnitLoader (NPC fallback only).
 *
 *   TvsHeroPreview.mount({
 *     host: document.getElementById('race-hero-preview'),
 *     THREE, race | unit, colorTint,
 *   });
 */
(function (global) {
  "use strict";

  var active = null;

  function mount(opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    var host =
      opts.host ||
      document.getElementById("race-hero-preview") ||
      document.getElementById("tvs-hero-preview");
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

    // Panel may be display:none (#hero inactive) — never use 0×0 canvas
    function measure() {
      var cw = host.clientWidth;
      var ch = host.clientHeight;
      var w = cw > 40 ? cw : 320;
      var h = ch > 80 ? ch : 300;
      h = Math.max(240, Math.min(360, h));
      return { w: w, h: h };
    }
    var sz = measure();
    var w = sz.w;
    var h = sz.h;

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

    function clearRoot() {
      if (root) {
        scene.remove(root);
        root = null;
      }
      mixer = null;
    }

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

    function frameCameraOn(model) {
      if (!model) return;
      model.updateMatrixWorld(true);
      var box = new THREE.Box3().setFromObject(model);
      var size = new THREE.Vector3();
      var center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      var hgt = size.y > 0.01 ? size.y : 1.8;
      var lookY = Math.max(0.9, center.y);
      camera.position.set(1.5, lookY + 0.35, Math.max(2.6, hgt * 1.55 + 0.8));
      camera.lookAt(0, lookY, 0);
    }

    /** Avatar Explorer race (player SSOT). */
    async function loadRace(race, tint) {
      if (!race) {
        status.textContent = "No race selected";
        status.className = "tvs-hero-preview__status bad";
        return;
      }
      if (!global.TvsVoxelRaceDefaults) {
        status.textContent = "Race module offline";
        status.className = "tvs-hero-preview__status bad";
        return;
      }
      var label = race.label || race.id || "race";
      status.textContent = "Loading " + label + "…";
      status.className = "tvs-hero-preview__status";
      try {
        clearRoot();
        var model = await TvsVoxelRaceDefaults.loadRace(race, {
          THREE: THREE,
          manifest: opts.manifest,
        });
        if (disposed) return;
        if (tint != null && tint !== 0xffffff && model.userData && model.userData.setColorTint) {
          model.userData.setColorTint(tint);
        }
        root = model;
        scene.add(root);
        if (model.userData.mixer) mixer = model.userData.mixer;
        if (model.userData.playClip) {
          try {
            model.userData.playClip("idle", 0);
          } catch (eIdle) {}
        }
        frameCameraOn(model);
        var h =
          model.userData.nativeHeight ||
          model.userData.targetHeight ||
          (race && race.heightM) ||
          "?";
        status.textContent =
          label +
          " · explorer · h≈" +
          (typeof h === "number" ? h.toFixed(2) + "m" : h) +
          " · idle/walk";
        status.className = "tvs-hero-preview__status ok";
        if (opts.onReady) opts.onReady({ kind: "voxel-avatar-race", height: h }, model);
      } catch (err) {
        console.warn("[TvsHeroPreview] race", err);
        status.textContent = "Race load failed: " + (err && err.message ? err.message : err);
        status.className = "tvs-hero-preview__status bad";
      }
    }

    /** Legacy TVS pack unit (NPC only — not play default). */
    async function loadUnit(unit, tint) {
      if (!unit || !global.TvsUnitLoader) {
        status.textContent = "TVS loader offline";
        status.className = "tvs-hero-preview__status bad";
        return;
      }
      status.textContent = "Loading " + (unit.displayName || unit.unitId) + "…";
      status.className = "tvs-hero-preview__status";
      try {
        clearRoot();
        var model = await TvsUnitLoader.loadTvsUnit(unit, {
          THREE: THREE,
          FBXLoader: THREE.FBXLoader,
          GLTFLoader: THREE.GLTFLoader,
          height: (global.GrudgeScale && GrudgeScale.PLAYER_HEIGHT_M) || 2.0,
          withTexture: true,
          withAnims: true,
          loadSidecars: true,
          preferGlb: true,
          maxClips: 20,
          colorTint: tint != null && tint !== 0xffffff ? tint : null,
        });
        if (disposed) return;
        root = model;
        scene.add(root);
        if (model.userData.mixer) mixer = model.userData.mixer;
        frameCameraOn(model);
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

    if (opts.race) loadRace(opts.race, opts.colorTint);
    else if (opts.unit) loadUnit(opts.unit, opts.colorTint);

    function resize() {
      var m = measure();
      w = m.w;
      h = m.h;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.domElement.style.height = h + "px";
    }

    var api = {
      loadRace: loadRace,
      loadUnit: loadUnit,
      resize: resize,
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
        return root && root.userData ? root.userData.importReport || root.userData : null;
      },
    };
    active = api;
    // If mounted while hidden, resize once after layout
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        if (!disposed) resize();
      });
    }
    return api;
  }

  global.TvsHeroPreview = {
    mount: mount,
    get active() {
      return active;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
