/**
 * Voxel RPG weapon meshes — MagicaVoxel OBJ/GLB pack.
 * Roster: assets/voxels/weapon-roster.json
 */
(function (global) {
  'use strict';

  var roster = null;
  var cache = {};

  function resolve(path) {
    if (!path) return '';
    if (global.GrudgeAssets && GrudgeAssets.modelUrl) return GrudgeAssets.modelUrl(path);
    return '/' + String(path).replace(/^\//, '');
  }

  function loadRoster() {
    if (roster) return Promise.resolve(roster);
    var url = resolve('assets/voxels/weapon-roster.json');
    if (global.GrudgeAssets && GrudgeAssets.localOrR2) {
      url = GrudgeAssets.localOrR2('assets/voxels/weapon-roster.json');
    }
    return fetch(url, { cache: 'no-store' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (doc) {
        roster = doc || { weapons: [] };
        return roster;
      })
      .catch(function () {
        roster = { weapons: [] };
        return roster;
      });
  }

  function mapGameWeapon(gameId) {
    // Prefer distinct voxel meshes for arsenal slots
    var map = {
      sword: 'voxwpn_00',
      axe: 'voxwpn_01',
      bow: 'voxwpn_02',
      staff: 'voxwpn_03',
      gun: 'voxwpn_04',
      greatsword: 'voxwpn_05',
      sword_shield: 'voxwpn_06',
      hammer: 'voxwpn_07',
      mace: 'voxwpn_08',
      dagger: 'voxwpn_09',
      crossbow: 'voxwpn_10',
      spear: 'voxwpn_11',
      wand: 'voxwpn_12',
      tome: 'voxwpn_13',
    };
    return map[gameId] || null;
  }

  function findWeapon(id) {
    if (!roster || !roster.weapons) return null;
    for (var i = 0; i < roster.weapons.length; i++) {
      if (roster.weapons[i].id === id) return roster.weapons[i];
    }
    return null;
  }

  function loadGlb(THREE, gltfLoader, w) {
    var key = w.id;
    if (cache[key]) return Promise.resolve(cache[key].clone(true));
    var url = resolve(w.glb);
    return new Promise(function (resolveP, reject) {
      gltfLoader.load(
        url,
        function (gltf) {
          var root = gltf.scene || gltf.scenes[0];
          if (global.VoxAssets && VoxAssets.normalizeModelHeight) {
            VoxAssets.normalizeModelHeight(THREE, root, w.heightM || 1.1);
          }
          root.traverse(function (c) {
            if (c.isMesh) {
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
          cache[key] = root;
          resolveP(root.clone(true));
        },
        undefined,
        function () {
          // Fall back to OBJ if GLB missing
          if (w.obj && THREE.OBJLoader) {
            loadObj(THREE, w).then(resolveP).catch(reject);
          } else reject(new Error('weapon load failed ' + w.id));
        }
      );
    });
  }

  function loadObj(THREE, w) {
    var key = w.id + ':obj';
    if (cache[key]) return Promise.resolve(cache[key].clone(true));
    return new Promise(function (resolveP, reject) {
      var loader = new THREE.OBJLoader();
      var url = resolve(w.obj);
      loader.load(
        url,
        function (obj) {
          if (global.VoxAssets && VoxAssets.normalizeModelHeight) {
            VoxAssets.normalizeModelHeight(THREE, obj, w.heightM || 1.1);
          }
          obj.traverse(function (c) {
            if (c.isMesh) {
              c.castShadow = true;
              c.material = c.material || new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.35, roughness: 0.55 });
            }
          });
          cache[key] = obj;
          resolveP(obj.clone(true));
        },
        undefined,
        reject
      );
    });
  }

  function loadForGameWeapon(THREE, gltfLoader, gameWeaponId) {
    return loadRoster().then(function () {
      var vid = mapGameWeapon(gameWeaponId);
      var w = vid ? findWeapon(vid) : null;
      if (!w && roster.weapons && roster.weapons.length) {
        // Hash pick stable mesh per game id
        var h = 0;
        var s = String(gameWeaponId || 'sword');
        for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        w = roster.weapons[Math.abs(h) % roster.weapons.length];
      }
      if (!w) return null;
      if (w.glb) return loadGlb(THREE, gltfLoader, w).catch(function () {
        return w.obj ? loadObj(THREE, w) : null;
      });
      if (w.obj) return loadObj(THREE, w);
      return null;
    });
  }

  global.VoxelWeaponLoader = {
    loadRoster: loadRoster,
    loadForGameWeapon: loadForGameWeapon,
    mapGameWeapon: mapGameWeapon,
    findWeapon: findWeapon,
  };
})(typeof window !== 'undefined' ? window : globalThis);
