/**
 * Fleet game runtime (plain JS) — mirror of @workspace/grudge-runtime
 * gameLoop + inputActions. Patterns from benvanik/games-framework without Closure.
 *
 * Global: window.FleetGameRuntime = { createGameLoop, createInputActionMap, ... }
 */
(function (global) {
  "use strict";

  var DEFAULT_FIXED = 16.777 / 1000;
  var DEFAULT_MAX = 0.25;

  function FleetGameLoop(opts) {
    opts = opts || {};
    this.fixedDt = opts.fixedDt != null ? opts.fixedDt : DEFAULT_FIXED;
    this.maxFrameDt = opts.maxFrameDt != null ? opts.maxFrameDt : DEFAULT_MAX;
    this.fixedTimestep = opts.fixedTimestep !== false;
    this.pauseWhenHidden = opts.pauseWhenHidden !== false;
    this.renderWhileHidden = opts.renderWhileHidden !== false;
    this.nowFn = opts.now || function () { return performance.now() / 1000; };
    this.onUpdate = opts.onUpdate || null;
    this.onRender = opts.onRender || null;
    this.shouldUpdateFn = opts.shouldUpdate || null;
    this.running = false;
    this.raf = 0;
    this.lastWall = 0;
    this.accumulator = 0;
    this.gameTime = 0;
    this.updateFrame = 0;
    this.renderFrame = 0;
    this.focused = true;
    this._onVis = null;
    var self = this;
    this._tick = function () {
      if (!self.running) return;
      self.raf = requestAnimationFrame(self._tick);
      var wall = self.nowFn();
      var wallDt = wall - self.lastWall;
      self.lastWall = wall;
      if (wallDt > self.maxFrameDt) wallDt = self.maxFrameDt;
      if (wallDt < 0) wallDt = 0;

      var hostAllows = self.shouldUpdateFn ? !!self.shouldUpdateFn() : true;
      var tabOk = !self.pauseWhenHidden || self.focused;
      var doUpdate = hostAllows && tabOk;
      var alpha = 1;

      if (doUpdate) {
        if (self.fixedTimestep) {
          self.accumulator += wallDt;
          var step = self.fixedDt;
          var guard = 0;
          while (self.accumulator >= step && guard < 8) {
            self.gameTime += step;
            self.updateFrame++;
            if (self.onUpdate) {
              self.onUpdate({
                frame: self.updateFrame,
                time: self.gameTime,
                dt: step,
                hasFocus: self.focused,
              });
            }
            self.accumulator -= step;
            guard++;
          }
          alpha = step > 0 ? self.accumulator / step : 0;
        } else {
          self.gameTime += wallDt;
          self.updateFrame++;
          if (self.onUpdate) {
            self.onUpdate({
              frame: self.updateFrame,
              time: self.gameTime,
              dt: wallDt,
              hasFocus: self.focused,
            });
          }
        }
      }

      if ((self.focused || self.renderWhileHidden) && self.onRender) {
        self.renderFrame++;
        self.onRender({
          frame: self.renderFrame,
          time: wall,
          dt: wallDt,
          alpha: alpha,
          hasFocus: self.focused,
        });
      }
    };
  }

  FleetGameLoop.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.lastWall = this.nowFn();
    this.accumulator = 0;
    var self = this;
    if (typeof document !== "undefined") {
      this.focused = !document.hidden;
      this._onVis = function () {
        self.focused = !document.hidden;
        if (document.hidden) {
          self.accumulator = 0;
          self.lastWall = self.nowFn();
        }
      };
      document.addEventListener("visibilitychange", this._onVis);
    }
    this.raf = requestAnimationFrame(this._tick);
  };

  FleetGameLoop.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this._onVis && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this._onVis);
      this._onVis = null;
    }
  };

  FleetGameLoop.prototype.setHandlers = function (h) {
    if (h.onUpdate) this.onUpdate = h.onUpdate;
    if (h.onRender) this.onRender = h.onRender;
    if (h.shouldUpdate) this.shouldUpdateFn = h.shouldUpdate;
  };

  var FLEET_DEFAULT_BINDINGS = {
    move_forward: [{ type: "key", code: "KeyW" }, { type: "key", code: "ArrowUp" }],
    move_back: [{ type: "key", code: "KeyS" }, { type: "key", code: "ArrowDown" }],
    move_left: [{ type: "key", code: "KeyA" }, { type: "key", code: "ArrowLeft" }],
    move_right: [{ type: "key", code: "KeyD" }, { type: "key", code: "ArrowRight" }],
    jump: [{ type: "key", code: "Space" }],
    sprint: [{ type: "key", code: "ShiftLeft" }, { type: "key", code: "ShiftRight" }],
    crouch: [{ type: "key", code: "ControlLeft" }],
    interact: [{ type: "key", code: "KeyX" }],
    attack: [{ type: "mouse", button: 0 }],
    aim: [{ type: "mouse", button: 2 }],
    block: [{ type: "mouse", button: 2 }],
    skill1: [{ type: "key", code: "KeyQ" }],
    skill2: [{ type: "key", code: "KeyE" }],
    skill3: [{ type: "key", code: "KeyR" }],
    skill4: [{ type: "key", code: "KeyF" }],
    inventory: [{ type: "key", code: "KeyI" }],
    craft: [{ type: "key", code: "KeyC" }],
    build: [{ type: "key", code: "KeyB" }],
    command_center: [{ type: "key", code: "KeyK" }],
    camera_cycle: [{ type: "key", code: "KeyV" }],
    pause: [{ type: "key", code: "Escape" }],
    dodge: [{ type: "key", code: "KeyZ" }],
    reload: [{ type: "key", code: "KeyR" }],
  };

  function InputActionMap(opts) {
    opts = opts || {};
    this.keys = {};
    this.mouse = {};
    this.bindings = Object.assign({}, FLEET_DEFAULT_BINDINGS, opts.bindings || {});
    this.enabled = opts.enabled !== false;
    this.target = opts.target != null ? opts.target : (typeof window !== "undefined" ? window : null);
    this.attached = false;
    var self = this;
    this._kd = function (e) { if (self.enabled) self.keys[e.code] = true; };
    this._ku = function (e) { delete self.keys[e.code]; };
    this._md = function (e) { if (self.enabled) self.mouse[e.button] = true; };
    this._mu = function (e) { delete self.mouse[e.button]; };
    this._blur = function () { self.keys = {}; self.mouse = {}; };
    this._vis = function () {
      if (typeof document !== "undefined" && document.hidden) {
        self.keys = {};
        self.mouse = {};
      }
    };
  }

  InputActionMap.prototype.attach = function () {
    if (this.attached || !this.target) return;
    this.target.addEventListener("keydown", this._kd);
    this.target.addEventListener("keyup", this._ku);
    this.target.addEventListener("mousedown", this._md);
    this.target.addEventListener("mouseup", this._mu);
    if (typeof window !== "undefined") window.addEventListener("blur", this._blur);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", this._vis);
    this.attached = true;
  };

  InputActionMap.prototype.detach = function () {
    if (!this.attached || !this.target) return;
    this.target.removeEventListener("keydown", this._kd);
    this.target.removeEventListener("keyup", this._ku);
    this.target.removeEventListener("mousedown", this._md);
    this.target.removeEventListener("mouseup", this._mu);
    if (typeof window !== "undefined") window.removeEventListener("blur", this._blur);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this._vis);
    this.attached = false;
    this.keys = {};
    this.mouse = {};
  };

  InputActionMap.prototype.setEnabled = function (v) {
    this.enabled = !!v;
    if (!v) { this.keys = {}; this.mouse = {}; }
  };

  InputActionMap.prototype.isDown = function (action) {
    if (!this.enabled) return false;
    var list = this.bindings[action] || [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.type === "key" && this.keys[b.code]) return true;
      if (b.type === "mouse" && this.mouse[b.button]) return true;
    }
    return false;
  };

  InputActionMap.prototype.codeMatches = function (action, code) {
    var list = this.bindings[action] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].type === "key" && list[i].code === code) return true;
    }
    return false;
  };

  InputActionMap.prototype.moveAxes = function () {
    var x = 0, z = 0;
    if (this.isDown("move_forward")) z -= 1;
    if (this.isDown("move_back")) z += 1;
    if (this.isDown("move_left")) x -= 1;
    if (this.isDown("move_right")) x += 1;
    var len = Math.sqrt(x * x + z * z);
    if (len > 1e-6) { x /= len; z /= len; }
    return { x: x, z: z };
  };

  function createGameLoop(opts) { return new FleetGameLoop(opts); }
  function createInputActionMap(opts) {
    var m = new InputActionMap(opts);
    m.attach();
    return m;
  }

  function requestPointerLock(el) {
    try {
      if (el && el.requestPointerLock) el.requestPointerLock({ unadjustedMovement: true });
    } catch (e) {
      try { if (el && el.requestPointerLock) el.requestPointerLock(); } catch (e2) {}
    }
  }

  function exitPointerLock() {
    try { if (document.exitPointerLock) document.exitPointerLock(); } catch (e) {}
  }

  global.FleetGameRuntime = {
    FleetGameLoop: FleetGameLoop,
    InputActionMap: InputActionMap,
    createGameLoop: createGameLoop,
    createInputActionMap: createInputActionMap,
    FLEET_DEFAULT_BINDINGS: FLEET_DEFAULT_BINDINGS,
    requestPointerLock: requestPointerLock,
    exitPointerLock: exitPointerLock,
    version: "1.1.0",
  };
})(typeof window !== "undefined" ? window : globalThis);
