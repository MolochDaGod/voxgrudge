/**
 * Building interiors + multi-floor stairs for VoxGrudge / Z-Brawl.
 *
 * UX (E interact):
 *  - Outside door → enter floor 0
 *  - Near stairs → go up one floor
 *  - Near down-stairs / hole → go down
 *  - Floor 0 door → exit building
 *
 * Visual language from vendor/voxel-city-generator (window floors, district
 * palettes, lit windows). Interiors are procedural rooms with loot nodes.
 */
(function (global) {
  "use strict";

  var DISTRICT = [
    [0xd0d6e0, 0x6a7a90, 0x4a5a70, 0x2a3545], // steel
    [0xf0d0b0, 0xc48a55, 0xa06a40, 0x6a4528], // brick
    [0xd0e8d0, 0x7aaa7a, 0x4a7a4a, 0x2a4a2a], // verdigris
    [0xe0d8f0, 0x9080b8, 0x605088, 0x3a3058], // violet
    [0xf0ebe0, 0xc8b898, 0x908060, 0x504830], // limestone
  ];

  var LOOT_TABLE = {
    health: [
      { id: "medkit", label: "Medkit", kind: "health", amount: 35, color: 0xff4466 },
      { id: "bandage", label: "Bandage", kind: "health", amount: 15, color: 0xff8899 },
    ],
    armor: [
      { id: "leather_vest", label: "Leather Vest", kind: "armor", armor: 12, color: 0x8b5a2b },
      { id: "iron_plate", label: "Iron Plate", kind: "armor", armor: 22, color: 0x8a8f99 },
      { id: "gold_plate", label: "Gold Plate", kind: "armor", armor: 18, color: 0xc9a13b },
    ],
    weapon: [
      { id: "sword", label: "1H Sword", kind: "weapon", weapon: "sword", color: 0xcfd6e0 },
      { id: "axe", label: "Hand Axe", kind: "weapon", weapon: "axe", color: 0xb0b8c0 },
      { id: "greatsword", label: "2H Greatsword", kind: "weapon", weapon: "greatsword", color: 0xa8b0c0 },
      { id: "shield", label: "Shield", kind: "weapon", weapon: "shield", color: 0x6a7280 },
    ],
    upgrade: [
      { id: "dmg_up", label: "Damage Chip", kind: "upgrade", upgrade: "damage", amount: 0.08, color: 0xff8844 },
      { id: "armor_up", label: "Armor Chip", kind: "upgrade", upgrade: "armor", amount: 0.1, color: 0x44aaff },
      { id: "speed_up", label: "Speed Chip", kind: "upgrade", upgrade: "speed", amount: 0.06, color: 0x44ff88 },
    ],
  };

  function hash2(x, z) {
    var n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function paletteFor(x, z) {
    var i = Math.floor(hash2(x, z) * DISTRICT.length) % DISTRICT.length;
    return DISTRICT[i];
  }

  function mat(THREE, color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: opts.roughness != null ? opts.roughness : 0.85,
      metalness: opts.metalness != null ? opts.metalness : 0.05,
      flatShading: true,
      transparent: !!opts.transparent,
      opacity: opts.opacity != null ? opts.opacity : 1,
      side: opts.side || THREE.FrontSide,
    });
  }

  function box(THREE, w, h, d, m, x, y, z) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Improve exterior house look: window band + door frame (city-gen vibe).
   */
  function dressExterior(THREE, root, x, z) {
    var pal = paletteFor(x, z);
    var foot = (root.userData && root.userData.foot) || 8;
    var w = foot * 0.9;
    var h = foot * 0.85;
    var d = foot * 0.7;
    // If already has complex GLB meshes, only add window lights
    var hasGlb = false;
    root.traverse(function (o) {
      if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position && o.geometry.attributes.position.count > 24)
        hasGlb = true;
    });
    var g = new THREE.Group();
    g.name = "city-dress";
    var wall = mat(THREE, pal[2], { roughness: 0.9 });
    var trim = mat(THREE, pal[3], { roughness: 0.8, metalness: 0.1 });
    var winLit = mat(THREE, 0xf5e6a0, { roughness: 0.4, metalness: 0.05, emissive: 0xf5e6a0, emissiveIntensity: 0.35 });
    if (!hasGlb) {
      g.add(box(THREE, w, h, d, wall, 0, h / 2, 0));
      // roof
      g.add(box(THREE, w * 1.08, 0.35, d * 1.08, trim, 0, h + 0.15, 0));
    }
    // Window strip (always — readable facade)
    var floors = 2 + Math.floor(hash2(x + 1, z) * 2);
    for (var f = 0; f < floors; f++) {
      var wy = 1.2 + f * 2.0;
      for (var s = -1; s <= 1; s += 2) {
        var wx = s * (w * 0.38);
        var lit = hash2(x + f, z + s) > 0.55;
        var wm = lit ? winLit : mat(THREE, 0x1a2230, { roughness: 0.5 });
        g.add(box(THREE, 0.7, 0.9, 0.12, wm, wx, wy, d * 0.51 * (hasGlb ? 0.6 : 1)));
      }
    }
    // Door marker
    var door = box(THREE, 1.1, 2.0, 0.15, mat(THREE, 0x3a2a1a, { roughness: 0.95 }), 0, 1.0, d * 0.52);
    door.name = "door-marker";
    g.add(door);
    root.add(g);
    root.userData.cityDress = g;
    root.userData.floors = floors;
    root.userData.palette = pal;
    return g;
  }

  /**
   * Build interior for a home: multi-floor room + staircase + loot.
   */
  function buildInterior(THREE, home, floorIndex) {
    var pal = home.userData.palette || DISTRICT[0];
    var floors = home.userData.floors || 2;
    var floorH = 3.2;
    var roomW = 7.5;
    var roomD = 6.5;
    var g = new THREE.Group();
    g.name = "building-interior";
    g.userData.floorIndex = floorIndex;
    g.userData.maxFloor = floors - 1;

    var wallM = mat(THREE, pal[2], { roughness: 0.92, side: THREE.DoubleSide });
    var floorM = mat(THREE, pal[1], { roughness: 0.95 });
    var ceilM = mat(THREE, pal[3], { roughness: 0.9 });
    var wood = mat(THREE, 0x6b4a2a, { roughness: 0.9 });
    var trim = mat(THREE, pal[0], { roughness: 0.7 });

    // Floor + ceiling
    g.add(box(THREE, roomW, 0.15, roomD, floorM, 0, 0.05, 0));
    g.add(box(THREE, roomW, 0.12, roomD, ceilM, 0, floorH, 0));
    // Walls
    g.add(box(THREE, roomW, floorH, 0.2, wallM, 0, floorH / 2, -roomD / 2));
    g.add(box(THREE, roomW, floorH, 0.2, wallM, 0, floorH / 2, roomD / 2));
    g.add(box(THREE, 0.2, floorH, roomD, wallM, -roomW / 2, floorH / 2, 0));
    g.add(box(THREE, 0.2, floorH, roomD, wallM, roomW / 2, floorH / 2, 0));

    // Door opening on +Z wall (matches exterior door)
    if (floorIndex === 0) {
      var doorFrame = box(THREE, 1.4, 2.2, 0.25, wood, 0, 1.1, roomD / 2);
      doorFrame.userData.isExitDoor = true;
      doorFrame.name = "exit-door";
      g.add(doorFrame);
      // invisible interact marker at door
      var exitMark = new THREE.Object3D();
      exitMark.position.set(0, 0, roomD / 2 - 0.4);
      exitMark.userData.isExitDoor = true;
      g.add(exitMark);
      g.userData.exitPos = exitMark.position.clone();
    }

    // Staircase (right side) — up if not top floor
    var stairRoot = new THREE.Group();
    stairRoot.position.set(roomW / 2 - 1.4, 0, -roomD / 2 + 1.8);
    stairRoot.userData.isStairs = true;
    stairRoot.name = "stairs-up";
    var steps = 8;
    for (var i = 0; i < steps; i++) {
      var sy = (i + 1) * (floorH / steps);
      var sz = i * 0.32;
      stairRoot.add(box(THREE, 1.2, 0.18, 0.35, wood, 0, sy, sz));
    }
    // rail
    stairRoot.add(box(THREE, 0.08, floorH * 0.9, 0.08, trim, 0.55, floorH * 0.45, steps * 0.16));
    g.add(stairRoot);
    g.userData.stairsUpPos = new THREE.Vector3(
      stairRoot.position.x,
      0,
      stairRoot.position.z + steps * 0.16
    );
    g.userData.canGoUp = floorIndex < floors - 1;
    g.userData.canGoDown = floorIndex > 0;

    // Down marker near stairs when on upper floors
    if (floorIndex > 0) {
      var downMark = new THREE.Object3D();
      downMark.position.copy(g.userData.stairsUpPos);
      downMark.userData.isStairsDown = true;
      g.add(downMark);
      g.userData.stairsDownPos = downMark.position.clone();
    }

    // Ambient interior light
    var lamp = new THREE.PointLight(0xffe8c0, 1.1, 14);
    lamp.position.set(0, floorH - 0.4, 0);
    g.add(lamp);

    // Furniture
    g.add(box(THREE, 1.6, 0.7, 0.7, wood, -2.2, 0.35, -1.5));
    g.add(box(THREE, 0.9, 1.4, 0.4, wallM, 2.0, 0.7, -2.2));

    // Loot nodes for this floor
    var loot = spawnLoot(THREE, g, home, floorIndex, roomW, roomD);
    g.userData.loot = loot;

    return g;
  }

  function pickLoot(floorIndex, rng) {
    var roll = rng();
    var pool;
    if (floorIndex === 0) {
      pool = roll < 0.35 ? LOOT_TABLE.health : roll < 0.6 ? LOOT_TABLE.armor : roll < 0.85 ? LOOT_TABLE.weapon : LOOT_TABLE.upgrade;
    } else {
      pool = roll < 0.25 ? LOOT_TABLE.health : roll < 0.5 ? LOOT_TABLE.weapon : roll < 0.75 ? LOOT_TABLE.armor : LOOT_TABLE.upgrade;
    }
    return Object.assign({}, pool[Math.floor(rng() * pool.length)]);
  }

  function spawnLoot(THREE, interior, home, floorIndex, roomW, roomD) {
    var hx = home.position.x;
    var hz = home.position.z;
    var rng = function () {
      return hash2(hx + floorIndex * 17, hz + interior.children.length);
    };
    var items = [];
    var count = 2 + Math.floor(hash2(hx, hz + floorIndex) * 3);
    for (var i = 0; i < count; i++) {
      var def = pickLoot(floorIndex, function () {
        return hash2(hx + i * 3.1 + floorIndex, hz + i * 7.7);
      });
      var lx = (hash2(hx + i, hz) - 0.5) * (roomW - 2.5);
      var lz = (hash2(hx, hz + i + 2) - 0.5) * (roomD - 2.5);
      // keep clear of stairs (positive x / negative z corner)
      if (lx > 1.5 && lz < -1.0) lx = -1.5;
      var mesh = box(THREE, 0.55, 0.45, 0.55, mat(THREE, def.color, { metalness: 0.25, roughness: 0.55 }), lx, 0.35, lz);
      mesh.userData.isLoot = true;
      mesh.userData.loot = def;
      mesh.userData.taken = false;
      // glow
      var gl = new THREE.PointLight(def.color, 0.55, 3.5);
      gl.position.set(0, 0.4, 0);
      mesh.add(gl);
      interior.add(mesh);
      items.push(mesh);
    }
    return items;
  }

  /**
   * Session manager for one player entering buildings.
   */
  function createSession(opts) {
    opts = opts || {};
    var THREE = opts.THREE || global.THREE;
    var scene = opts.scene;
    var state = {
      inside: false,
      home: null,
      floor: 0,
      interior: null,
      exteriorHidden: false,
    };

    function hideExterior(home, hide) {
      home.traverse(function (c) {
        if (!c.isMesh || !c.material) return;
        if (c.parent && c.parent.name === "building-interior") return;
        var ms = Array.isArray(c.material) ? c.material : [c.material];
        ms.forEach(function (m) {
          if (hide) {
            if (m.userData._op == null) m.userData._op = m.opacity != null ? m.opacity : 1;
            m.transparent = true;
            m.opacity = 0.12;
            m.depthWrite = false;
          } else {
            m.opacity = m.userData._op != null ? m.userData._op : 1;
            m.transparent = m.opacity < 0.99;
            m.depthWrite = true;
          }
        });
      });
    }

    function clearInterior() {
      if (state.interior && state.interior.parent) state.interior.parent.remove(state.interior);
      state.interior = null;
    }

    function showFloor(floorIndex) {
      if (!state.home) return;
      clearInterior();
      state.floor = floorIndex;
      state.interior = buildInterior(THREE, state.home, floorIndex);
      state.interior.position.copy(state.home.position);
      state.interior.position.y = 0.02;
      state.interior.rotation.y = state.home.rotation.y || 0;
      scene.add(state.interior);
      // place player on floor
      var p = opts.getPlayer && opts.getPlayer();
      if (p) {
        var local = new THREE.Vector3(0, 0, state.floor === 0 ? 1.5 : 0);
        local.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.home.rotation.y || 0);
        p.position.set(
          state.home.position.x + local.x,
          floorIndex * 0.02,
          state.home.position.z + local.z
        );
      }
      if (opts.onFloorChange) opts.onFloorChange(state);
    }

    function enter(home) {
      if (!home) return;
      state.inside = true;
      state.home = home;
      hideExterior(home, true);
      showFloor(0);
      if (opts.onEnter) opts.onEnter(state);
    }

    function exit() {
      if (!state.home) return;
      var home = state.home;
      hideExterior(home, false);
      clearInterior();
      var p = opts.getPlayer && opts.getPlayer();
      if (p && home.userData.door) {
        p.position.set(home.userData.door.x, 0, home.userData.door.z);
      }
      state.inside = false;
      state.home = null;
      state.floor = 0;
      if (opts.onExit) opts.onExit();
    }

    function goUp() {
      if (!state.inside || !state.interior) return false;
      if (!state.interior.userData.canGoUp) return false;
      showFloor(state.floor + 1);
      if (opts.onFeed) opts.onFeed("Floors " + (state.floor + 1) + " — search for loot");
      return true;
    }

    function goDown() {
      if (!state.inside || !state.interior) return false;
      if (!state.interior.userData.canGoDown) return false;
      showFloor(state.floor - 1);
      if (opts.onFeed) opts.onFeed("Floors " + (state.floor + 1));
      return true;
    }

    function nearestInteract(playerPos) {
      if (!state.inside || !state.interior) return null;
      var best = null;
      var bestD = 2.2;
      // exit door floor 0
      if (state.floor === 0 && state.interior.userData.exitPos) {
        var ep = state.interior.userData.exitPos.clone();
        ep.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.home.rotation.y || 0);
        ep.add(state.home.position);
        var de = playerPos.distanceTo(ep);
        if (de < bestD) {
          bestD = de;
          best = { type: "exit", dist: de, world: ep };
        }
      }
      // stairs up
      if (state.interior.userData.canGoUp && state.interior.userData.stairsUpPos) {
        var sp = state.interior.userData.stairsUpPos.clone();
        sp.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.home.rotation.y || 0);
        sp.add(state.home.position);
        var ds = playerPos.distanceTo(sp);
        if (ds < bestD) {
          bestD = ds;
          best = { type: "stairs-up", dist: ds, world: sp };
        }
      }
      // stairs down
      if (state.interior.userData.canGoDown && state.interior.userData.stairsDownPos) {
        var dp = state.interior.userData.stairsDownPos.clone();
        dp.applyAxisAngle(new THREE.Vector3(0, 1, 0), state.home.rotation.y || 0);
        dp.add(state.home.position);
        var dd = playerPos.distanceTo(dp);
        if (dd < bestD) {
          bestD = dd;
          best = { type: "stairs-down", dist: dd, world: dp };
        }
      }
      // loot
      (state.interior.userData.loot || []).forEach(function (mesh) {
        if (mesh.userData.taken) return;
        var wp = new THREE.Vector3();
        mesh.getWorldPosition(wp);
        var d = playerPos.distanceTo(wp);
        if (d < bestD) {
          bestD = d;
          best = { type: "loot", dist: d, mesh: mesh, loot: mesh.userData.loot };
        }
      });
      return best;
    }

    function tryInteract(playerPos) {
      if (!state.inside) return null;
      var hit = nearestInteract(playerPos);
      if (!hit) return { type: "none" };
      if (hit.type === "exit") {
        exit();
        return { type: "exit" };
      }
      if (hit.type === "stairs-up") {
        goUp();
        return { type: "stairs-up", floor: state.floor };
      }
      if (hit.type === "stairs-down") {
        goDown();
        return { type: "stairs-down", floor: state.floor };
      }
      if (hit.type === "loot" && hit.mesh && !hit.mesh.userData.taken) {
        hit.mesh.userData.taken = true;
        hit.mesh.visible = false;
        return { type: "loot", loot: hit.loot };
      }
      return hit;
    }

    function promptText(playerPos) {
      if (!state.inside) return null;
      var hit = nearestInteract(playerPos);
      if (!hit) {
        return "[E] Inside · floor " + (state.floor + 1) + "/" + ((state.home && state.home.userData.floors) || 1);
      }
      if (hit.type === "exit") return "[E] Leave building";
      if (hit.type === "stairs-up") return "[E] Go upstairs";
      if (hit.type === "stairs-down") return "[E] Go downstairs";
      if (hit.type === "loot") return "[E] Take " + (hit.loot && hit.loot.label ? hit.loot.label : "item");
      return null;
    }

    return {
      get state() {
        return state;
      },
      enter: enter,
      exit: exit,
      goUp: goUp,
      goDown: goDown,
      tryInteract: tryInteract,
      promptText: promptText,
      dressExterior: function (home) {
        return dressExterior(THREE, home, home.position.x, home.position.z);
      },
      isInside: function () {
        return state.inside;
      },
    };
  }

  global.BuildingInterior = {
    DISTRICT: DISTRICT,
    LOOT_TABLE: LOOT_TABLE,
    dressExterior: dressExterior,
    buildInterior: buildInterior,
    createSession: createSession,
  };
})(typeof window !== "undefined" ? window : globalThis);
