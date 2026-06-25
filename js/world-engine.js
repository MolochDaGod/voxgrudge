/**
 * Voxgrudge World Engine — 10× Albion-style chunked zones with seeded generation.
 */
(function (global) {
  const WORLD_SCALE = 10;
  const CHUNK_SIZE = 96;
  const LOAD_RADIUS = 3;
  const AGGRO_RADIUS = 32;
  const LEASH_RADIUS = 90;
  const PATROL_RADIUS = 14;

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function chunkKey(cx, cz) { return cx + ',' + cz; }

  function worldToChunk(x, z) {
    return {
      cx: Math.floor(x / CHUNK_SIZE),
      cz: Math.floor(z / CHUNK_SIZE),
    };
  }

  function scaleBiomes(biomes) {
    return biomes.map((b, i, arr) => ({
      ...b,
      minD: b.minD * WORLD_SCALE,
      maxD: b.maxD >= 999 ? 999 * WORLD_SCALE : b.maxD * WORLD_SCALE,
      zoneId: i,
    }));
  }

  function getBiomeAt(x, z, biomes) {
    const d = Math.sqrt(x * x + z * z);
    for (let i = biomes.length - 1; i >= 0; i--) {
      if (d >= biomes[i].minD) return biomes[i];
    }
    return biomes[0];
  }

  function createWorldEngine(opts) {
    const biomes = scaleBiomes(opts.biomes || []);
    const tierPools = opts.tierPools || {};
    let seed = opts.seed || Date.now() % 1000000000;
    const loaded = new Map();
    const props = [];
    const camps = [];
    let scene = null;
    let onChestOpen = null;
    let onSurvivorTalk = null;
    let onVendorTalk = null;

    function rngForChunk(cx, cz) {
      const h = ((cx * 73856093) ^ (cz * 19349663) ^ seed) >>> 0;
      return mulberry32(h);
    }

    function chunkCenter(cx, cz) {
      return { x: cx * CHUNK_SIZE + CHUNK_SIZE * 0.5, z: cz * CHUNK_SIZE + CHUNK_SIZE * 0.5 };
    }

    function genChunk(cx, cz) {
      const key = chunkKey(cx, cz);
      if (loaded.has(key)) return loaded.get(key);
      const rand = rngForChunk(cx, cz);
      const center = chunkCenter(cx, cz);
      const biome = getBiomeAt(center.x, center.z, biomes);
      const chunk = {
        cx, cz, biome, loaded: false,
        nodes: [], chests: [], buildings: [], walls: [], survivors: [], camps: [],
      };

      const nodeCount = 2 + Math.floor(rand() * 4);
      for (let i = 0; i < nodeCount; i++) {
        const types = ['tree', 'tree', 'rock', 'ore'];
        const type = types[Math.floor(rand() * types.length)];
        if (type === 'ore' && biome.zoneId < 2 && rand() < 0.6) continue;
        chunk.nodes.push({
          type,
          x: cx * CHUNK_SIZE + 8 + rand() * (CHUNK_SIZE - 16),
          z: cz * CHUNK_SIZE + 8 + rand() * (CHUNK_SIZE - 16),
        });
      }

      if (rand() < 0.22) {
        chunk.chests.push({
          id: 'chest_' + key + '_' + chunk.chests.length,
          x: cx * CHUNK_SIZE + 12 + rand() * (CHUNK_SIZE - 24),
          z: cz * CHUNK_SIZE + 12 + rand() * (CHUNK_SIZE - 24),
          tier: biome.tiers[Math.floor(rand() * biome.tiers.length)],
          opened: false,
        });
      }

      if (rand() < 0.18) {
        const bType = biome.zoneId >= 3 ? 'ruin' : biome.zoneId >= 1 ? 'shack' : 'camp';
        chunk.buildings.push({
          type: bType,
          x: cx * CHUNK_SIZE + CHUNK_SIZE * 0.5,
          z: cz * CHUNK_SIZE + CHUNK_SIZE * 0.5,
          rot: rand() * Math.PI * 2,
        });
      }

      if (biome.zoneId >= 2 && rand() < 0.35) {
        const segs = 4 + Math.floor(rand() * 5);
        const wx = cx * CHUNK_SIZE + CHUNK_SIZE * 0.5;
        const wz = cz * CHUNK_SIZE + CHUNK_SIZE * 0.5;
        for (let s = 0; s < segs; s++) {
          chunk.walls.push({
            x: wx + (rand() - 0.5) * 40,
            z: wz + (rand() - 0.5) * 40,
            w: 3 + rand() * 2,
            h: 2.5 + rand() * 1.5,
            d: 0.6 + rand() * 0.4,
            rot: rand() * Math.PI,
          });
        }
      }

      if (biome.zoneId === 0 && rand() < 0.12) {
        chunk.survivors.push({
          name: ['Mara', 'Torvin', 'Elira', 'Grudge Scout'][Math.floor(rand() * 4)],
          role: 'npc',
          x: cx * CHUNK_SIZE + 20 + rand() * (CHUNK_SIZE - 40),
          z: cz * CHUNK_SIZE + 20 + rand() * (CHUNK_SIZE - 40),
        });
      }
      if (biome.zoneId <= 1 && rand() < 0.06) {
        chunk.survivors.push({
          name: ['Trader Kael', 'Scrap Vendor', 'Island Quartermaster'][Math.floor(rand() * 3)],
          role: 'vendor',
          stock: ['t0_bandage', 't0_torch', 't0_ration'],
          x: cx * CHUNK_SIZE + 24 + rand() * (CHUNK_SIZE - 48),
          z: cz * CHUNK_SIZE + 24 + rand() * (CHUNK_SIZE - 48),
        });
      }

      const campChance = biome.zoneId === 0 ? 0.15 : 0.35 + biome.zoneId * 0.05;
      if (rand() < campChance) {
        const tier = biome.tiers[Math.floor(rand() * biome.tiers.length)];
        const pool = tierPools[tier] || tierPools[1] || [];
        if (pool.length) {
          const camp = {
            id: 'camp_' + key,
            x: cx * CHUNK_SIZE + 16 + rand() * (CHUNK_SIZE - 32),
            z: cz * CHUNK_SIZE + 16 + rand() * (CHUNK_SIZE - 32),
            tier,
            enemies: [],
            aggro: false,
          };
          const count = 1 + Math.floor(rand() * (1 + tier));
          for (let e = 0; e < count; e++) {
            camp.enemies.push({
              typeId: pool[Math.floor(rand() * pool.length)],
              ox: (rand() - 0.5) * PATROL_RADIUS,
              oz: (rand() - 0.5) * PATROL_RADIUS,
              patrolAngle: rand() * Math.PI * 2,
            });
          }
          chunk.camps.push(camp);
          camps.push(camp);
        }
      }

      loaded.set(key, chunk);
      return chunk;
    }

    function ensureChunksAround(px, pz) {
      const { cx, cz } = worldToChunk(px, pz);
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
          genChunk(cx + dx, cz + dz);
        }
      }
    }

    function buildGround(sceneRef, genProcTexture, THREE) {
      scene = sceneRef;
      const biomeTexTypes = ['grass', 'swamp', 'ruins', 'wasteland', 'dark'];
      const coll = global.VoxCollision && global._collisionWorld;
      const worldR = getWorldRadius();

      if (global.VoxTerrain) {
        const terrain = global.VoxTerrain.build({
          THREE: THREE,
          scene: sceneRef,
          seed: seed,
          size: worldR * 2.15,
          segments: 128,
          getBiomeAt: function (x, z) { return getBiomeAt(x, z, biomes); },
          genProcTexture: genProcTexture,
          biomeTexTypes: biomeTexTypes,
        });
        global._terrainHandle = terrain;
        if (coll) coll.registerTerrain(terrain);
        if (coll && biomes[0]) {
          coll.registerSafeZone(0, 0, (biomes[0].maxD || 28 * WORLD_SCALE) * 0.95, {
            label: biomes[0].label || 'Starter Island',
            noAggro: true,
          });
        }
      } else {
        biomes.forEach(function (biome, bi) {
          const r = (biome.maxD < 999 * WORLD_SCALE ? biome.maxD : 130 * WORLD_SCALE) * 2;
          const prevR = biome.minD * 2;
          const tex = genProcTexture(biomeTexTypes[bi] || 'grass');
          tex.repeat.set(r / 16, r / 16);
          if (bi === 0) {
            const geo = new THREE.CircleGeometry(r, 96);
            const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.05 });
            const m = new THREE.Mesh(geo, mat);
            m.rotation.x = -Math.PI / 2;
            m.receiveShadow = true;
            scene.add(m);
          } else {
            const geo = new THREE.RingGeometry(prevR, r, 96);
            const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide });
            const m = new THREE.Mesh(geo, mat);
            m.rotation.x = -Math.PI / 2;
            m.receiveShadow = true;
            scene.add(m);
          }
        });
      }

      const waterSize = 300 * WORLD_SCALE;
      const waterGeo = new THREE.PlaneGeometry(waterSize, waterSize, 48, 48);
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x2266aa, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.4 });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.y = -1.2;
      water.receiveShadow = true;
      water.name = 'vox-water';
      scene.add(water);
      if (coll && global.VoxLayers) {
        coll.register({
          id: 'world_water',
          kind: 'water',
          layer: global.VoxLayers.LAYERS.WATER,
          mesh: water,
          solid: false,
          trigger: true,
        });
      }
      return water;
    }

    function registerPropCollider(prop) {
      const coll = global._collisionWorld;
      const Layers = global.VoxLayers;
      if (!coll || !Layers || !prop || !prop.mesh) return;
      const kind = prop.kind;
      const isVendor = kind === 'survivor' && prop.data && prop.data.role === 'vendor';
      const regKind = isVendor ? 'vendor' : (kind === 'survivor' ? 'npc' : kind);
      const layer = Layers.layerForKind(regKind, prop.data);
      coll.register({
        id: 'prop_' + regKind + '_' + (prop.data && (prop.data.name || prop.data.id || prop.data.type) || Math.random().toString(36).slice(2, 8)),
        kind: regKind,
        layer: layer,
        mesh: prop.mesh,
        solid: kind === 'wall' || kind === 'building',
        trigger: kind === 'chest' || kind === 'survivor',
        data: prop.data,
      });
    }

    function spawnPropMeshes(THREE, helpers) {
      props.forEach(p => { if (p.mesh) scene.remove(p.mesh); });
      props.length = 0;

      loaded.forEach(chunk => {
        if (chunk.meshesBuilt) return;
        chunk.meshesBuilt = true;

        chunk.nodes.forEach(n => {
          if (helpers.spawnResourceNode) helpers.spawnResourceNode(n.type, n.x, n.z);
        });

        chunk.chests.forEach(c => {
          const g = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 1.0, 1.0),
            new THREE.MeshStandardMaterial({ color: 0x6a4a20, metalness: 0.3, roughness: 0.7 })
          );
          body.position.y = 0.5;
          body.castShadow = true;
          const lid = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.25, 1.1),
            new THREE.MeshStandardMaterial({ color: 0x8b6914, emissive: 0x332200, emissiveIntensity: c.opened ? 0 : 0.3 })
          );
          lid.position.y = 1.1;
          g.add(body, lid);
          g.position.set(c.x, 0, c.z);
          scene.add(g);
          const prop = { kind: 'chest', data: c, mesh: g };
          props.push(prop);
          c.mesh = g;
          registerPropCollider(prop);
          if (global._collisionWorld) global._collisionWorld.snapObject(g, 0);
        });

        chunk.buildings.forEach(b => {
          const g = new THREE.Group();
          const col = b.type === 'ruin' ? 0x554444 : b.type === 'shack' ? 0x6a5030 : 0x3a5a2a;
          const base = new THREE.Mesh(
            new THREE.BoxGeometry(6, 3, 5),
            new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })
          );
          base.position.y = 1.5;
          base.castShadow = true;
          g.add(base);
          if (b.type === 'ruin') {
            const rubble = new THREE.Mesh(
              new THREE.BoxGeometry(2, 1, 2),
              new THREE.MeshStandardMaterial({ color: 0x443333 })
            );
            rubble.position.set(2, 0.5, 1);
            g.add(rubble);
          }
          g.position.set(b.x, 0, b.z);
          g.rotation.y = b.rot;
          scene.add(g);
          const bProp = { kind: 'building', data: b, mesh: g };
          props.push(bProp);
          registerPropCollider(bProp);
          if (global._collisionWorld) global._collisionWorld.snapObject(g, 0);
        });

        chunk.walls.forEach(w => {
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(w.w, w.h, w.d),
            new THREE.MeshStandardMaterial({ color: 0x3a3540, roughness: 0.9 })
          );
          m.position.set(w.x, w.h * 0.5, w.z);
          m.rotation.y = w.rot;
          m.castShadow = true;
          m.receiveShadow = true;
          scene.add(m);
          const wProp = { kind: 'wall', data: w, mesh: m };
          props.push(wProp);
          registerPropCollider(wProp);
          if (global._collisionWorld) global._collisionWorld.snapObject(m, 0);
        });

        chunk.survivors.forEach(s => {
          const g = helpers.buildSurvivor ? helpers.buildSurvivor(s) : null;
          if (!g) return;
          g.position.set(s.x, 0, s.z);
          scene.add(g);
          const sProp = { kind: 'survivor', data: s, mesh: g };
          props.push(sProp);
          registerPropCollider(sProp);
          if (global._collisionWorld) global._collisionWorld.snapObject(g, 0);
        });
      });
    }

    function updateChunks(px, pz, THREE, helpers) {
      ensureChunksAround(px, pz);
      spawnPropMeshes(THREE, helpers);
    }

    function tryOpenChest(px, pz) {
      let best = null, bestD = 3.5;
      loaded.forEach(chunk => {
        chunk.chests.forEach(c => {
          if (c.opened) return;
          const d = Math.hypot(px - c.x, pz - c.z);
          if (d < bestD) { bestD = d; best = c; }
        });
      });
      if (best && onChestOpen) {
        best.opened = true;
        if (best.mesh) best.mesh.traverse(ch => {
          if (ch.isMesh && ch.material) ch.material.emissiveIntensity = 0;
        });
        onChestOpen(best);
        return true;
      }
      return false;
    }

    function tryTalkSurvivor(px, pz) {
      let best = null, bestD = 4;
      props.forEach(p => {
        if (p.kind !== 'survivor') return;
        const d = Math.hypot(px - p.mesh.position.x, pz - p.mesh.position.z);
        if (d < bestD) { bestD = d; best = p; }
      });
      if (!best) return false;
      if (best.data && best.data.role === 'vendor' && onVendorTalk) {
        onVendorTalk(best.data);
        return true;
      }
      if (onSurvivorTalk) { onSurvivorTalk(best.data); return true; }
      return false;
    }

    function getPendingCampSpawns(px, pz, existingEnemies) {
      const out = [];
      const existing = new Set(existingEnemies.map(e => e.campId + ':' + e.campSlot));
      camps.forEach(camp => {
        const d = Math.hypot(px - camp.x, pz - camp.z);
        if (d > CHUNK_SIZE * (LOAD_RADIUS + 1)) return;
        camp.enemies.forEach((slot, idx) => {
          const tag = camp.id + ':' + idx;
          if (existing.has(tag)) return;
          if (d < CHUNK_SIZE * LOAD_RADIUS) {
            out.push({
              campId: camp.id,
              campSlot: idx,
              typeId: slot.typeId,
              x: camp.x + slot.ox,
              z: camp.z + slot.oz,
              homeX: camp.x + slot.ox,
              homeZ: camp.z + slot.oz,
              camp,
            });
          }
        });
      });
      return out;
    }

    function updateCampAggro(px, pz, enemies) {
      const inSafe = global._collisionWorld && global._collisionWorld.isInSafeZone
        ? global._collisionWorld.isInSafeZone(px, pz)
        : false;
      camps.forEach(camp => {
        const d = Math.hypot(px - camp.x, pz - camp.z);
        camp.aggro = !inSafe && d < AGGRO_RADIUS * 1.5;
      });
      enemies.forEach(e => {
        if (!e.campId) return;
        const distHome = Math.hypot(e.mesh.position.x - e.homeX, e.mesh.position.z - e.homeZ);
        const distPlayer = Math.hypot(e.mesh.position.x - px, e.mesh.position.z - pz);
        e.aggro = distPlayer < AGGRO_RADIUS;
        e.leashed = distHome > LEASH_RADIUS;
      });
    }

    function getInteractHint(px, pz) {
      let chestD = 99, survD = 99;
      loaded.forEach(chunk => {
        chunk.chests.forEach(c => {
          if (!c.opened) chestD = Math.min(chestD, Math.hypot(px - c.x, pz - c.z));
        });
      });
      props.forEach(p => {
        if (p.kind === 'survivor') {
          survD = Math.min(survD, Math.hypot(px - p.mesh.position.x, pz - p.mesh.position.z));
        }
      });
      if (chestD < 3.5) return { type: 'chest', dist: chestD };
      if (survD < 4) {
        let near = null;
        props.forEach(p => {
          if (p.kind !== 'survivor') return;
          const d = Math.hypot(px - p.mesh.position.x, pz - p.mesh.position.z);
          if (d < 4) near = p;
        });
        if (near && near.data && near.data.role === 'vendor') return { type: 'vendor', dist: survD, name: near.data.name };
        return { type: 'survivor', dist: survD };
      }
      return null;
    }

    function setSeed(s) { seed = (s >>> 0) || 1; loaded.clear(); camps.length = 0; props.forEach(p => { if (p.mesh && scene) scene.remove(p.mesh); }); props.length = 0; }
    function getSeed() { return seed; }
    function getBiomes() { return biomes; }
    function getWorldRadius() { return 130 * WORLD_SCALE; }

    return {
      WORLD_SCALE, CHUNK_SIZE, LOAD_RADIUS, AGGRO_RADIUS, LEASH_RADIUS, PATROL_RADIUS,
      setSeed, getSeed, getBiomes, getWorldRadius, getBiomeAt: (x, z) => getBiomeAt(x, z, biomes),
      buildGround, updateChunks, tryOpenChest, tryTalkSurvivor,
      getPendingCampSpawns, updateCampAggro, ensureChunksAround,
      setChestHandler(fn) { onChestOpen = fn; },
      setSurvivorHandler(fn) { onSurvivorTalk = fn; },
      setVendorHandler(fn) { onVendorTalk = fn; },
      getInteractHint,
      resetChunkMeshes() {
        loaded.forEach(c => { c.meshesBuilt = false; });
      },
    };
  }

  global.VoxWorld = { createWorldEngine, WORLD_SCALE, CHUNK_SIZE };
})(typeof window !== 'undefined' ? window : globalThis);