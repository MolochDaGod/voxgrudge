/**
 * Collidion voxel roll/dodge clips — load from models/collidion/collidion.glb (CC-BY-4.0 kingillager).
 * Rig: collidion_17 → body_11, head_3, hands_8, shell_10, feet_16
 * Clips: walking | roll up | rolling | roll out | push away
 */
(function (global) {
  'use strict';

  var CLIP = {
    WALK: 'walking',
    ROLL_UP: 'roll up',
    ROLLING: 'rolling',
    ROLL_OUT: 'roll out',
    PUSH: 'push away',
  };

  var BONE_MAP = {
    root: 'collidion_17',
    body: 'body_11',
    head: 'head_3',
    shell: 'shell_10',
    handL: 'lefthand_5',
    handR: 'righthand_7',
    footL: 'leftfoot_13',
    footR: 'rightfoot_15',
  };

  function create(opts) {
    var THREE = opts.THREE;
    var loader = opts.loader;
    var url = opts.url || 'models/collidion/collidion.glb';
    var clips = {};
    var template = null;
    var ready = false;
    var pending = [];

    function onReady() {
      ready = true;
      pending.splice(0).forEach(function (fn) { fn(); });
    }

    function load(cb) {
      loader.load(url, function (gltf) {
        template = gltf.scene;
        (gltf.animations || []).forEach(function (clip) {
          clips[clip.name] = clip;
        });
        onReady();
        if (cb) cb(clips);
      }, undefined, function (err) {
        console.warn('[VoxRollAnim] load failed', err);
        if (cb) cb(null);
      });
    }

    function whenReady(fn) {
      if (ready) fn();
      else pending.push(fn);
    }

    /** Build voxel rig matching collidion bone names; meshes use caller materials/textures. */
    function buildRig(materials) {
      if (!template) return null;
      var root = template.clone(true);
      root.traverse(function (c) {
        if (!c.isMesh) return;
        if (materials && materials.replace) {
          c.material = materials.replace(c, c.material);
        } else if (materials && materials.body && (c.name || '').indexOf('Object_22') >= 0) {
          c.material = materials.shell;
        }
      });
      var mixer = new THREE.AnimationMixer(root);
      root.userData._voxRollMixer = mixer;
      return root;
    }

    function playDodge(mixer, phase, fade) {
      fade = fade || 0.08;
      var name = phase === 'up' ? CLIP.ROLL_UP
        : phase === 'loop' ? CLIP.ROLLING
        : phase === 'out' ? CLIP.ROLL_OUT
        : CLIP.PUSH;
      var clip = clips[name];
      if (!mixer || !clip) return null;
      var action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(phase === 'loop' ? THREE.LoopRepeat : THREE.LoopOnce, phase === 'loop' ? Infinity : 1);
      action.clampWhenFinished = phase !== 'loop';
      var prev = mixer._activeRoll;
      if (prev && prev !== action) prev.crossFadeTo(action, fade, false);
      else action.play();
      mixer._activeRoll = action;
      return action;
    }

    function playWalk(mixer, fade) {
      var clip = clips[CLIP.WALK];
      if (!mixer || !clip) return null;
      var action = mixer.clipAction(clip);
      action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      if (mixer._activeRoll) mixer._activeRoll.crossFadeTo(action, fade || 0.2, false);
      mixer._activeRoll = null;
      return action;
    }

    function update(mixer, dt) {
      if (mixer) mixer.update(dt);
    }

    return {
      CLIP: CLIP,
      BONE_MAP: BONE_MAP,
      load: load,
      whenReady: whenReady,
      buildRig: buildRig,
      playDodge: playDodge,
      playWalk: playWalk,
      update: update,
      getClips: function () { return clips; },
      isReady: function () { return ready; },
    };
  }

  global.VoxRollAnim = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);