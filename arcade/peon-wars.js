/**
 * TVS Peon Wars — WC3 Peon Wars–style RTS using The Voxel Store production GLBs.
 * CDN: assets.grudge-studio.com/models/voxels/tvs/
 *
 * Controls: LMB select / box select · RMB move/attack/gather · B build menu · 1–3 train
 */
(function (global) {
  "use strict";

  var CDN = "https://assets.grudge-studio.com/models/voxels/tvs";
  var MAP = 140;
  var HALF = MAP / 2;

  var ASSETS = {
    peon: CDN + "/voxel-farm/characters/voxel-farm-farm-hand.glb",
    footman: CDN + "/voxel-knights/characters/voxel-knights-knight.glb",
    archer: CDN + "/voxel-knights/characters/voxel-knights-archer.glb",
    hall: CDN + "/voxel-farm/environment/voxel-farm-farm-house.glb",
    barracks: CDN + "/voxel-knights/environment/voxel-knights-keep.glb",
    farm: CDN + "/voxel-farm/environment/voxel-farm-barn.glb",
    tree: CDN + "/voxel-farm/environment/voxel-farm-tree.glb",
    mine: CDN + "/voxel-village/environment/voxel-village-crate.glb",
  };

  var UNIT_DEFS = {
    peon: { hp: 60, speed: 7, range: 1.2, costG: 50, costL: 0, food: 1, gather: 8, attack: 5, role: "worker" },
    footman: { hp: 120, speed: 6.2, range: 1.8, costG: 120, costL: 0, food: 2, attack: 14, role: "melee" },
    archer: { hp: 80, speed: 6.5, range: 12, costG: 100, costL: 40, food: 2, attack: 11, role: "ranged" },
  };

  var BUILD_DEFS = {
    hall: { hp: 900, costG: 350, costL: 200, foodProv: 10, trains: ["peon"], w: 6, label: "Town Hall" },
    barracks: { hp: 650, costG: 180, costL: 80, foodProv: 0, trains: ["footman", "archer"], w: 5, label: "Barracks" },
    farm: { hp: 280, costG: 80, costL: 40, foodProv: 6, trains: [], w: 3.5, label: "Farm" },
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function distXZ(a, b) {
    var dx = a.x - b.x;
    var dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function teamColor(team) {
    return team === "blue" ? 0x3b82f6 : 0xef4444;
  }

  function PeonWars(container, opts) {
    opts = opts || {};
    this.container = container;
    this.onHud = opts.onHud || function () {};
    this.disposed = false;
    this.running = false;
    this.clock = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = null;
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hit = new THREE.Vector3();
    this.units = [];
    this.buildings = [];
    this.resources = [];
    this.selected = [];
    this.team = "blue";
    this.aiTeam = "red";
    this.gold = { blue: 400, red: 400 };
    this.lumber = { blue: 200, red: 200 };
    this.foodUsed = { blue: 0, red: 0 };
    this.foodCap = { blue: 10, red: 10 };
    this.uid = 1;
    this.mode = "play"; // play | place-hall | place-barracks | place-farm
    this.placeGhost = null;
    this.boxStart = null;
    this.boxEl = null;
    this.cam = { yaw: 0.85, pitch: 0.95, dist: 70, tx: 0, tz: 0 };
    this.keys = {};
    this.models = {};
    this.aiTimer = 0;
    this.winner = null;
    this.msg = "Gather gold & lumber. Build. Crush the enemy Town Hall.";
    this._bind = {};
  }

  PeonWars.prototype.start = async function () {
    var self = this;
    this.initThree();
    this.bindInput();
    this.buildTerrain();
    this.setMsg("Loading TVS models…");
    await this.loadModels();
    this.spawnBases();
    this.spawnWorldResources();
    this.running = true;
    this.clock = new THREE.Clock();
    this.setMsg("Peon Wars ready — select peons, right-click gold/trees, B to build.");
    this.loop();
    this.emitHud();
  };

  PeonWars.prototype.initThree = function () {
    var w = this.container.clientWidth || window.innerWidth;
    var h = this.container.clientHeight || window.innerHeight;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b7e0);
    this.scene.fog = new THREE.Fog(0x87b7e0, 80, 220);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.5, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    var hemi = new THREE.HemisphereLight(0xddeeff, 0x445533, 0.75);
    this.scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff2d0, 0.95);
    sun.position.set(40, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -80;
    sun.shadow.camera.right = sun.shadow.camera.top = 80;
    this.scene.add(sun);

    this.raycaster = new THREE.Raycaster();
    this.updateCamera();
  };

  PeonWars.prototype.buildTerrain = function () {
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP + 20, MAP + 20),
      new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.92, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "ground";
    this.scene.add(ground);
    this.ground = ground;

    // Water ring outside map (island vibe for waters route)
    var water = new THREE.Mesh(
      new THREE.RingGeometry(HALF + 2, HALF + 40, 64),
      new THREE.MeshStandardMaterial({ color: 0x2a6a9a, metalness: 0.2, roughness: 0.35, transparent: true, opacity: 0.92 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.2;
    this.scene.add(water);

    // Soft shore
    var shore = new THREE.Mesh(
      new THREE.RingGeometry(HALF - 1, HALF + 2.5, 64),
      new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 1 })
    );
    shore.rotation.x = -Math.PI / 2;
    shore.position.y = 0.02;
    this.scene.add(shore);
  };

  PeonWars.prototype.loadModels = async function () {
    var self = this;
    var loader = new THREE.GLTFLoader();
    var keys = Object.keys(ASSETS);
    await Promise.all(
      keys.map(function (k) {
        return new Promise(function (resolve) {
          loader.load(
            ASSETS[k],
            function (gltf) {
              var root = gltf.scene || gltf.scenes[0];
              root.traverse(function (o) {
                if (o.isMesh) {
                  o.castShadow = true;
                  o.receiveShadow = true;
                  if (o.material) {
                    var mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(function (m) {
                      if (m.map) {
                        m.map.magFilter = THREE.NearestFilter;
                        m.map.minFilter = THREE.NearestFilter;
                        m.map.generateMipmaps = false;
                      }
                      m.metalness = 0;
                      m.flatShading = true;
                    });
                  }
                }
              });
              // Normalize height-ish
              var box = new THREE.Box3().setFromObject(root);
              var size = new THREE.Vector3();
              box.getSize(size);
              if (size.y > 0.01) {
                var target = k === "peon" || k === "footman" || k === "archer" ? 2.0 : k === "tree" ? 5 : 4.5;
                var s = target / size.y;
                root.scale.setScalar(s);
                root.updateMatrixWorld(true);
                box.setFromObject(root);
                root.position.y -= box.min.y;
              }
              self.models[k] = root;
              resolve();
            },
            undefined,
            function () {
              console.warn("[peon-wars] model fail", k);
              self.models[k] = null;
              resolve();
            }
          );
        });
      })
    );
  };

  PeonWars.prototype.cloneModel = function (key, tintTeam) {
    var src = this.models[key];
    var g;
    if (src) {
      g = src.clone(true);
    } else {
      g = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 1.1, 4, 8),
        new THREE.MeshStandardMaterial({ color: teamColor(tintTeam || "blue") })
      );
      g.position.y = 0.9;
    }
    if (tintTeam) {
      g.traverse(function (o) {
        if (o.isMesh && o.material && o.material.color) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(teamColor(tintTeam));
          o.material.emissiveIntensity = 0.12;
        }
      });
    }
    return g;
  };

  PeonWars.prototype.spawnBases = function () {
    this.addBuilding("blue", "hall", -HALF + 22, -HALF + 22);
    this.addBuilding("red", "hall", HALF - 22, HALF - 22);
    for (var i = 0; i < 4; i++) {
      this.addUnit("blue", "peon", -HALF + 18 + i * 2.2, -HALF + 16);
      this.addUnit("red", "peon", HALF - 18 - i * 2.2, HALF - 16);
    }
    this.addUnit("blue", "footman", -HALF + 26, -HALF + 18);
    this.addUnit("red", "footman", HALF - 26, HALF - 18);
    this.recalcFood();
  };

  PeonWars.prototype.spawnWorldResources = function () {
    var i, a, r, x, z;
    // Gold mines near each base + mid
    this.addResource("gold", -HALF + 32, -HALF + 14, 2500);
    this.addResource("gold", HALF - 32, HALF - 14, 2500);
    this.addResource("gold", 0, 0, 1800);
    // Trees
    for (i = 0; i < 48; i++) {
      a = Math.random() * Math.PI * 2;
      r = 18 + Math.random() * (HALF - 28);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
      this.addResource("tree", x, z, 180 + Math.random() * 120);
    }
  };

  PeonWars.prototype.addResource = function (kind, x, z, amount) {
    var mesh =
      kind === "gold"
        ? this.cloneModel("mine")
        : this.cloneModel("tree");
    if (kind === "gold") {
      mesh.traverse(function (o) {
        if (o.isMesh && o.material) {
          o.material = o.material.clone();
          o.material.color = new THREE.Color(0xe8c84a);
          o.material.emissive = new THREE.Color(0x886600);
          o.material.emissiveIntensity = 0.25;
        }
      });
    }
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    var res = {
      id: this.uid++,
      kind: kind,
      amount: amount,
      max: amount,
      mesh: mesh,
      pos: new THREE.Vector3(x, 0, z),
    };
    this.resources.push(res);
    return res;
  };

  PeonWars.prototype.addBuilding = function (team, type, x, z) {
    var def = BUILD_DEFS[type];
    var mesh = this.cloneModel(type, team);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(def.w * 0.55, def.w * 0.65, 24),
      new THREE.MeshBasicMaterial({ color: teamColor(team), transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    mesh.add(ring);
    var b = {
      id: this.uid++,
      team: team,
      type: type,
      def: def,
      hp: def.hp,
      maxHp: def.hp,
      mesh: mesh,
      pos: new THREE.Vector3(x, 0, z),
      trainQueue: [],
      trainT: 0,
      alive: true,
    };
    this.buildings.push(b);
    this.foodCap[team] += def.foodProv;
    return b;
  };

  PeonWars.prototype.addUnit = function (team, type, x, z) {
    var def = UNIT_DEFS[type];
    var mesh = this.cloneModel(type, team);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    var u = {
      id: this.uid++,
      team: team,
      type: type,
      def: def,
      hp: def.hp,
      maxHp: def.hp,
      mesh: mesh,
      pos: new THREE.Vector3(x, 0, z),
      vel: new THREE.Vector3(),
      target: null,
      task: null, // { type: 'move'|'attack'|'gather', ... }
      gatherCarry: 0,
      gatherKind: null,
      attackCd: 0,
      alive: true,
      selected: false,
    };
    this.units.push(u);
    this.foodUsed[team] += def.food;
    return u;
  };

  PeonWars.prototype.recalcFood = function () {
    var t;
    this.foodUsed.blue = this.foodUsed.red = 0;
    this.foodCap.blue = this.foodCap.red = 0;
    for (t = 0; t < this.buildings.length; t++) {
      var b = this.buildings[t];
      if (!b.alive) continue;
      this.foodCap[b.team] += b.def.foodProv;
    }
    // base hall already counted via buildings
    for (t = 0; t < this.units.length; t++) {
      var u = this.units[t];
      if (u.alive) this.foodUsed[u.team] += u.def.food;
    }
  };

  PeonWars.prototype.canAfford = function (team, g, l, food) {
    if (this.gold[team] < g || this.lumber[team] < l) return false;
    if (food && this.foodUsed[team] + food > this.foodCap[team]) return false;
    return true;
  };

  PeonWars.prototype.spend = function (team, g, l) {
    this.gold[team] -= g;
    this.lumber[team] -= l;
  };

  PeonWars.prototype.bindInput = function () {
    var self = this;
    var el = this.renderer.domElement;
    this.boxEl = document.createElement("div");
    this.boxEl.className = "pw-box";
    this.boxEl.style.cssText =
      "position:fixed;border:1px solid #d4af37;background:rgba(212,175,55,0.12);pointer-events:none;display:none;z-index:20;";
    document.body.appendChild(this.boxEl);

    this._bind.onDown = function (e) {
      if (self.winner || e.button !== 0) return;
      self.pointerFromEvent(e);
      if (self.mode.indexOf("place-") === 0) {
        self.tryPlaceBuilding(e);
        return;
      }
      self.boxStart = { x: e.clientX, y: e.clientY };
    };
    this._bind.onMove = function (e) {
      if (!self.boxStart) return;
      var x1 = Math.min(self.boxStart.x, e.clientX);
      var y1 = Math.min(self.boxStart.y, e.clientY);
      var x2 = Math.max(self.boxStart.x, e.clientX);
      var y2 = Math.max(self.boxStart.y, e.clientY);
      if (x2 - x1 > 4 || y2 - y1 > 4) {
        self.boxEl.style.display = "block";
        self.boxEl.style.left = x1 + "px";
        self.boxEl.style.top = y1 + "px";
        self.boxEl.style.width = x2 - x1 + "px";
        self.boxEl.style.height = y2 - y1 + "px";
      }
    };
    this._bind.onUp = function (e) {
      if (e.button !== 0 || !self.boxStart) return;
      var dx = Math.abs(e.clientX - self.boxStart.x);
      var dy = Math.abs(e.clientY - self.boxStart.y);
      self.boxEl.style.display = "none";
      if (dx < 5 && dy < 5) self.clickSelect(e, e.shiftKey);
      else self.boxSelect(self.boxStart.x, self.boxStart.y, e.clientX, e.clientY, e.shiftKey);
      self.boxStart = null;
      self.emitHud();
    };
    this._bind.onContext = function (e) {
      e.preventDefault();
      if (self.winner) return;
      self.orderSelected(e);
      self.emitHud();
    };
    this._bind.onWheel = function (e) {
      e.preventDefault();
      self.cam.dist = clamp(self.cam.dist + e.deltaY * 0.04, 25, 140);
    };
    this._bind.onKey = function (e) {
      self.keys[e.code] = e.type === "keydown";
      if (e.type !== "keydown" || self.winner) return;
      if (e.code === "KeyB") {
        self.mode = self.mode === "play" ? "place-hall" : "play";
        self.setMsg(self.mode === "play" ? "Select / command units." : "Place Town Hall (350g 200l) — click ground. Keys: B cycle hall/barracks/farm.");
        if (self.mode === "place-hall") self.mode = "place-hall";
      }
      if (e.code === "Digit1") self.queueTrain("peon");
      if (e.code === "Digit2") self.queueTrain("footman");
      if (e.code === "Digit3") self.queueTrain("archer");
      if (e.code === "KeyH") self.mode = "place-hall";
      if (e.code === "KeyR") self.mode = "place-barracks";
      if (e.code === "KeyF") self.mode = "place-farm";
      if (e.code === "Escape") {
        self.mode = "play";
        self.clearSelection();
      }
      self.emitHud();
    };
    this._bind.onResize = function () {
      var w = self.container.clientWidth || window.innerWidth;
      var h = self.container.clientHeight || window.innerHeight;
      self.camera.aspect = w / h;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(w, h);
    };

    el.addEventListener("mousedown", this._bind.onDown);
    window.addEventListener("mousemove", this._bind.onMove);
    window.addEventListener("mouseup", this._bind.onUp);
    el.addEventListener("contextmenu", this._bind.onContext);
    el.addEventListener("wheel", this._bind.onWheel, { passive: false });
    window.addEventListener("keydown", this._bind.onKey);
    window.addEventListener("keyup", this._bind.onKey);
    window.addEventListener("resize", this._bind.onResize);
  };

  PeonWars.prototype.pointerFromEvent = function (e) {
    var rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };

  PeonWars.prototype.groundPoint = function (e) {
    this.pointerFromEvent(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    var hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return hit;
    return null;
  };

  PeonWars.prototype.clearSelection = function () {
    this.selected.forEach(function (u) {
      u.selected = false;
    });
    this.selected = [];
  };

  PeonWars.prototype.clickSelect = function (e, add) {
    this.pointerFromEvent(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    var meshes = [];
    this.units.forEach(function (u) {
      if (u.alive && u.team === "blue") meshes.push(u.mesh);
    });
    this.buildings.forEach(function (b) {
      if (b.alive && b.team === "blue") meshes.push(b.mesh);
    });
    var hits = this.raycaster.intersectObjects(meshes, true);
    if (!hits.length) {
      if (!add) this.clearSelection();
      return;
    }
    var obj = hits[0].object;
    while (obj && !obj.parent) break;
    var found = null;
    var root = hits[0].object;
    while (root.parent && root.parent !== this.scene) root = root.parent;
    this.units.forEach(function (u) {
      if (u.mesh === root || u.mesh.children.indexOf(hits[0].object) >= 0) found = u;
      if (!found && u.mesh.getObjectById && u.mesh.getObjectById(hits[0].object.id)) found = u;
    });
    // fallback walk
    if (!found) {
      this.units.forEach(function (u) {
        var hit = false;
        u.mesh.traverse(function (o) {
          if (o === hits[0].object) hit = true;
        });
        if (hit) found = u;
      });
    }
    if (!found) {
      this.buildings.forEach(function (b) {
        var hit = false;
        b.mesh.traverse(function (o) {
          if (o === hits[0].object) hit = true;
        });
        if (hit) found = b;
      });
      if (found && found.trains) {
        // building selected — store as selectedBuilding
        this.selectedBuilding = found;
        if (!add) this.clearSelection();
        this.setMsg(found.def.label + " selected. 1 peon · 2 footman · 3 archer (if barracks).");
        return;
      }
    }
    if (!found || found.team !== "blue") {
      if (!add) this.clearSelection();
      return;
    }
    if (!add) this.clearSelection();
    if (found.def && found.def.role) {
      found.selected = true;
      this.selected.push(found);
      this.selectedBuilding = null;
    }
  };

  PeonWars.prototype.boxSelect = function (x0, y0, x1, y1, add) {
    var self = this;
    if (!add) this.clearSelection();
    var minX = Math.min(x0, x1);
    var maxX = Math.max(x0, x1);
    var minY = Math.min(y0, y1);
    var maxY = Math.max(y0, y1);
    var rect = this.renderer.domElement.getBoundingClientRect();
    this.units.forEach(function (u) {
      if (!u.alive || u.team !== "blue") return;
      var v = u.pos.clone().project(self.camera);
      var sx = (v.x * 0.5 + 0.5) * rect.width + rect.left;
      var sy = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        u.selected = true;
        self.selected.push(u);
      }
    });
  };

  PeonWars.prototype.orderSelected = function (e) {
    if (!this.selected.length) return;
    var gp = this.groundPoint(e);
    if (!gp) return;

    // Prefer attack unit / building / gather resource under cursor
    this.pointerFromEvent(e);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    var targets = [];
    this.units.forEach(function (u) {
      if (u.alive) targets.push(u.mesh);
    });
    this.buildings.forEach(function (b) {
      if (b.alive) targets.push(b.mesh);
    });
    this.resources.forEach(function (r) {
      if (r.amount > 0) targets.push(r.mesh);
    });
    var hits = this.raycaster.intersectObjects(targets, true);
    var attackTarget = null;
    var gatherTarget = null;
    if (hits.length) {
      var obj = hits[0].object;
      this.units.forEach(function (u) {
        var hit = false;
        u.mesh.traverse(function (o) {
          if (o === obj) hit = true;
        });
        if (hit && u.team === "red") attackTarget = u;
      });
      this.buildings.forEach(function (b) {
        var hit = false;
        b.mesh.traverse(function (o) {
          if (o === obj) hit = true;
        });
        if (hit && b.team === "red") attackTarget = b;
      });
      this.resources.forEach(function (r) {
        var hit = false;
        r.mesh.traverse(function (o) {
          if (o === obj) hit = true;
        });
        if (hit && r.amount > 0) gatherTarget = r;
      });
    }

    var self = this;
    this.selected.forEach(function (u, i) {
      if (!u.alive) return;
      if (attackTarget && u.def.role !== "worker") {
        u.task = { type: "attack", target: attackTarget };
      } else if (gatherTarget && u.def.role === "worker") {
        u.task = { type: "gather", res: gatherTarget, phase: "toRes" };
      } else if (attackTarget && u.def.role === "worker") {
        // peons can light-attack
        u.task = { type: "attack", target: attackTarget };
      } else {
        var ox = ((i % 3) - 1) * 1.4;
        var oz = (Math.floor(i / 3) - 1) * 1.4;
        u.task = {
          type: "move",
          x: clamp(gp.x + ox, -HALF + 2, HALF - 2),
          z: clamp(gp.z + oz, -HALF + 2, HALF - 2),
        };
      }
    });
    this.setMsg(attackTarget ? "Attack!" : gatherTarget ? "Gather!" : "Moving.");
  };

  PeonWars.prototype.tryPlaceBuilding = function (e) {
    var type = this.mode.replace("place-", "");
    var def = BUILD_DEFS[type];
    if (!def) return;
    if (!this.canAfford("blue", def.costG, def.costL, 0)) {
      this.setMsg("Need " + def.costG + "g " + def.costL + "l for " + def.label);
      return;
    }
    var gp = this.groundPoint(e);
    if (!gp) return;
    if (Math.abs(gp.x) > HALF - 4 || Math.abs(gp.z) > HALF - 4) {
      this.setMsg("Too close to water.");
      return;
    }
    this.spend("blue", def.costG, def.costL);
    this.addBuilding("blue", type, gp.x, gp.z);
    this.mode = "play";
    this.setMsg(def.label + " built.");
    this.emitHud();
  };

  PeonWars.prototype.queueTrain = function (unitType) {
    var def = UNIT_DEFS[unitType];
    if (!def) return;
    var b = this.selectedBuilding;
    if (!b || !b.alive || b.team !== "blue") {
      // auto-pick hall or barracks
      var need = unitType === "peon" ? "hall" : "barracks";
      b = null;
      for (var i = 0; i < this.buildings.length; i++) {
        if (this.buildings[i].alive && this.buildings[i].team === "blue" && this.buildings[i].type === need) {
          b = this.buildings[i];
          break;
        }
      }
    }
    if (!b || b.def.trains.indexOf(unitType) < 0) {
      this.setMsg("No " + (unitType === "peon" ? "Town Hall" : "Barracks") + " to train " + unitType);
      return;
    }
    if (!this.canAfford("blue", def.costG, def.costL, def.food)) {
      this.setMsg("Need gold/lumber/food for " + unitType);
      return;
    }
    this.spend("blue", def.costG, def.costL);
    b.trainQueue.push(unitType);
    this.setMsg("Training " + unitType + "…");
    this.emitHud();
  };

  PeonWars.prototype.updateUnit = function (u, dt) {
    if (!u.alive) return;
    u.attackCd = Math.max(0, u.attackCd - dt);
    var task = u.task;
    if (!task) {
      // idle aggro for military
      if (u.def.role !== "worker") {
        var foe = this.nearestEnemy(u, 14);
        if (foe) u.task = { type: "attack", target: foe };
      }
      return;
    }
    if (task.type === "move") {
      if (this.steerTo(u, task.x, task.z, dt, 0.6)) u.task = null;
    } else if (task.type === "attack") {
      var t = task.target;
      if (!t || !t.alive) {
        u.task = null;
        return;
      }
      var d = distXZ(u.pos, t.pos);
      if (d > u.def.range) this.steerTo(u, t.pos.x, t.pos.z, dt, u.def.range * 0.85);
      else if (u.attackCd <= 0) {
        t.hp -= u.def.attack;
        u.attackCd = u.def.role === "ranged" ? 1.1 : 0.85;
        this.flash(t);
        if (t.hp <= 0) this.kill(t);
      }
    } else if (task.type === "gather") {
      this.updateGather(u, task, dt);
    }
    u.mesh.position.x = u.pos.x;
    u.mesh.position.z = u.pos.z;
  };

  PeonWars.prototype.updateGather = function (u, task, dt) {
    var res = task.res;
    if (!res || res.amount <= 0) {
      // find another
      res = this.nearestResource(u, task.res && task.res.kind);
      task.res = res;
      if (!res) {
        u.task = null;
        return;
      }
      task.phase = "toRes";
    }
    var hall = this.nearestHall(u.team);
    if (task.phase === "toRes") {
      if (this.steerTo(u, res.pos.x, res.pos.z, dt, 1.5)) {
        // mine
        var take = Math.min(u.def.gather, res.amount);
        res.amount -= take;
        u.gatherCarry = take;
        u.gatherKind = res.kind;
        task.phase = "toHall";
        if (res.amount <= 0) {
          this.scene.remove(res.mesh);
        } else if (res.kind === "tree") {
          res.mesh.scale.multiplyScalar(0.97);
        }
      }
    } else if (task.phase === "toHall") {
      if (!hall) {
        u.task = null;
        return;
      }
      if (this.steerTo(u, hall.pos.x, hall.pos.z, dt, 2.5)) {
        if (u.gatherKind === "gold") this.gold[u.team] += u.gatherCarry;
        else this.lumber[u.team] += u.gatherCarry;
        u.gatherCarry = 0;
        task.phase = "toRes";
      }
    }
  };

  PeonWars.prototype.steerTo = function (u, x, z, dt, stopDist) {
    var dx = x - u.pos.x;
    var dz = z - u.pos.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d <= stopDist) return true;
    var sp = u.def.speed * dt;
    u.pos.x += (dx / d) * Math.min(sp, d);
    u.pos.z += (dz / d) * Math.min(sp, d);
    u.mesh.rotation.y = Math.atan2(dx, dz);
    return false;
  };

  PeonWars.prototype.nearestEnemy = function (u, radius) {
    var best = null;
    var bd = radius;
    var list = this.units.concat(this.buildings);
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o.alive || o.team === u.team) continue;
      var d = distXZ(u.pos, o.pos);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  };

  PeonWars.prototype.nearestResource = function (u, kind) {
    var best = null;
    var bd = 1e9;
    for (var i = 0; i < this.resources.length; i++) {
      var r = this.resources[i];
      if (r.amount <= 0) continue;
      if (kind && r.kind !== kind) continue;
      var d = distXZ(u.pos, r.pos);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    return best;
  };

  PeonWars.prototype.nearestHall = function (team) {
    var best = null;
    var bd = 1e9;
    for (var i = 0; i < this.buildings.length; i++) {
      var b = this.buildings[i];
      if (!b.alive || b.team !== team || b.type !== "hall") continue;
      // any building for drop-off is fine if no hall? use hall only
      best = b;
      break;
    }
    // fallback any friendly building
    if (!best) {
      for (i = 0; i < this.buildings.length; i++) {
        if (this.buildings[i].alive && this.buildings[i].team === team) return this.buildings[i];
      }
    }
    return best;
  };

  PeonWars.prototype.flash = function (t) {
    if (!t.mesh) return;
    t.mesh.traverse(function (o) {
      if (o.isMesh && o.material && o.material.emissive) {
        o.material.emissiveIntensity = 0.8;
      }
    });
    setTimeout(function () {
      t.mesh &&
        t.mesh.traverse(function (o) {
          if (o.isMesh && o.material && o.material.emissive) o.material.emissiveIntensity = 0.12;
        });
    }, 80);
  };

  PeonWars.prototype.kill = function (t) {
    if (!t.alive) return;
    t.alive = false;
    t.hp = 0;
    if (t.mesh) this.scene.remove(t.mesh);
    if (t.def && t.def.food) this.foodUsed[t.team] = Math.max(0, this.foodUsed[t.team] - t.def.food);
    if (t.type === "hall") {
      this.winner = t.team === "blue" ? "red" : "blue";
      this.setMsg(this.winner === "blue" ? "Victory! Enemy Town Hall destroyed." : "Defeat — your Town Hall fell.");
    }
  };

  PeonWars.prototype.updateBuildings = function (dt) {
    for (var i = 0; i < this.buildings.length; i++) {
      var b = this.buildings[i];
      if (!b.alive || !b.trainQueue.length) continue;
      b.trainT += dt;
      var need = 4.5;
      if (b.trainT >= need) {
        b.trainT = 0;
        var ut = b.trainQueue.shift();
        var def = UNIT_DEFS[ut];
        if (def && this.foodUsed[b.team] + def.food <= this.foodCap[b.team]) {
          var ang = Math.random() * Math.PI * 2;
          this.addUnit(b.team, ut, b.pos.x + Math.cos(ang) * 4, b.pos.z + Math.sin(ang) * 4);
        } else {
          // refund soft
          this.gold[b.team] += def.costG * 0.5;
        }
      }
    }
  };

  PeonWars.prototype.updateAI = function (dt) {
    this.aiTimer += dt;
    if (this.aiTimer < 2.5) return;
    this.aiTimer = 0;
    var team = "red";
    // train peons if low
    var peons = this.units.filter(function (u) {
      return u.alive && u.team === team && u.type === "peon";
    }).length;
    var hall = this.buildings.find(function (b) {
      return b.alive && b.team === team && b.type === "hall";
    });
    var rax = this.buildings.find(function (b) {
      return b.alive && b.team === team && b.type === "barracks";
    });
    if (hall && peons < 6 && this.canAfford(team, 50, 0, 1)) {
      this.spend(team, 50, 0);
      hall.trainQueue.push("peon");
    }
    if (!rax && this.canAfford(team, 180, 80, 0) && hall) {
      this.spend(team, 180, 80);
      this.addBuilding(team, "barracks", hall.pos.x - 10, hall.pos.z + 8);
    }
    if (rax && this.canAfford(team, 120, 0, 2)) {
      this.spend(team, 120, 0);
      rax.trainQueue.push("footman");
    }
    // peons gather
    this.units.forEach(
      function (u) {
        if (!u.alive || u.team !== team) return;
        if (u.type === "peon" && !u.task) {
          var r = this.nearestResource(u, Math.random() > 0.4 ? "gold" : "tree");
          if (r) u.task = { type: "gather", res: r, phase: "toRes" };
        }
        if (u.def.role !== "worker" && !u.task) {
          var enemyHall = this.buildings.find(function (b) {
            return b.alive && b.team === "blue" && b.type === "hall";
          });
          if (enemyHall && this.gold[team] > 200) u.task = { type: "attack", target: enemyHall };
          else {
            var foe = this.nearestEnemy(u, 40);
            if (foe) u.task = { type: "attack", target: foe };
          }
        }
      }.bind(this)
    );
  };

  PeonWars.prototype.updateCamera = function (dt) {
    dt = dt || 0.016;
    var sp = 28 * dt;
    var yaw = this.cam.yaw;
    var fx = Math.sin(yaw);
    var fz = Math.cos(yaw);
    if (this.keys.KeyW || this.keys.ArrowUp) {
      this.cam.tx += fx * sp;
      this.cam.tz += fz * sp;
    }
    if (this.keys.KeyS || this.keys.ArrowDown) {
      this.cam.tx -= fx * sp;
      this.cam.tz -= fz * sp;
    }
    if (this.keys.KeyA || this.keys.ArrowLeft) {
      this.cam.tx += fz * sp;
      this.cam.tz -= fx * sp;
    }
    if (this.keys.KeyD || this.keys.ArrowRight) {
      this.cam.tx -= fz * sp;
      this.cam.tz += fx * sp;
    }
    if (this.keys.KeyQ) this.cam.yaw += 1.1 * dt;
    if (this.keys.KeyE) this.cam.yaw -= 1.1 * dt;
    this.cam.tx = clamp(this.cam.tx, -HALF, HALF);
    this.cam.tz = clamp(this.cam.tz, -HALF, HALF);

    var cp = Math.cos(this.cam.pitch);
    var spn = Math.sin(this.cam.pitch);
    var x = this.cam.tx - Math.sin(this.cam.yaw) * this.cam.dist * cp;
    var y = this.cam.dist * spn;
    var z = this.cam.tz - Math.cos(this.cam.yaw) * this.cam.dist * cp;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cam.tx, 0, this.cam.tz);
  };

  PeonWars.prototype.loop = function () {
    if (this.disposed) return;
    var self = this;
    this._raf = requestAnimationFrame(function () {
      self.loop();
    });
    if (!this.running) return;
    var dt = Math.min(0.05, this.clock.getDelta());
    if (!this.winner) {
      for (var i = 0; i < this.units.length; i++) this.updateUnit(this.units[i], dt);
      this.updateBuildings(dt);
      this.updateAI(dt);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    if ((this._hudAcc = (this._hudAcc || 0) + dt) > 0.15) {
      this._hudAcc = 0;
      this.emitHud();
    }
  };

  PeonWars.prototype.setMsg = function (m) {
    this.msg = m;
  };

  PeonWars.prototype.emitHud = function () {
    this.onHud({
      gold: this.gold.blue | 0,
      lumber: this.lumber.blue | 0,
      foodUsed: this.foodUsed.blue | 0,
      foodCap: this.foodCap.blue | 0,
      selected: this.selected.length,
      mode: this.mode,
      msg: this.msg,
      winner: this.winner,
      enemyGold: this.gold.red | 0,
    });
  };

  PeonWars.prototype.dispose = function () {
    this.disposed = true;
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    var el = this.renderer && this.renderer.domElement;
    if (el) {
      el.removeEventListener("mousedown", this._bind.onDown);
      el.removeEventListener("contextmenu", this._bind.onContext);
      el.removeEventListener("wheel", this._bind.onWheel);
    }
    window.removeEventListener("mousemove", this._bind.onMove);
    window.removeEventListener("mouseup", this._bind.onUp);
    window.removeEventListener("keydown", this._bind.onKey);
    window.removeEventListener("keyup", this._bind.onKey);
    window.removeEventListener("resize", this._bind.onResize);
    if (this.boxEl && this.boxEl.parentNode) this.boxEl.parentNode.removeChild(this.boxEl);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  };

  global.PeonWars = PeonWars;
})(typeof window !== "undefined" ? window : globalThis);
