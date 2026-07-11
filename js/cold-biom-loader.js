/**
 * Load ColdBiom OBJ/MTL and GLB assets with caching.
 */
(function (global) {
  'use strict';

  var cache = {};
  var loading = {};

  function create(opts) {
    var THREE = opts.THREE;
    var objLoader = opts.objLoader;
    var mtlLoader = opts.mtlLoader;
    var gltfLoader = opts.gltfLoader;
    var basePath = (opts.basePath || 'models/cold-biom/').replace(/\/?$/, '/');

    function resolvePath(rel) {
      if (!rel) return '';
      if (rel.indexOf('models/') === 0) return rel;
      return basePath + rel.replace(/^\//, '');
    }

    function prepMesh(root, scale) {
      root.traverse(function (c) {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      if (scale) root.scale.setScalar(scale);
      return root;
    }

    function loadObjMtl(objRel, mtlRel, scale) {
      var key = objRel + '|' + (mtlRel || '');
      if (cache[key]) return Promise.resolve(cache[key].clone(true));
      if (loading[key]) return loading[key];

      var objPath = resolvePath(objRel);
      var dir = objPath.substring(0, objPath.lastIndexOf('/') + 1);
      var file = objPath.substring(objPath.lastIndexOf('/') + 1);

      loading[key] = new Promise(function (resolve, reject) {
        function loadObj(materials) {
          if (materials) objLoader.setMaterials(materials);
          objLoader.load(file, function (obj) {
            var g = prepMesh(obj, scale);
            cache[key] = g;
            delete loading[key];
            resolve(g.clone(true));
          }, undefined, reject);
        }
        if (mtlRel && mtlLoader) {
          var mtlFile = resolvePath(mtlRel).substring(resolvePath(mtlRel).lastIndexOf('/') + 1);
          mtlLoader.setPath(dir);
          mtlLoader.load(mtlFile, function (mtl) {
            mtl.preload();
            loadObj(mtl);
          }, undefined, function () { loadObj(null); });
        } else {
          objLoader.setPath(dir);
          loadObj(null);
        }
      });
      return loading[key];
    }

    function loadGlb(glbRel, scale) {
      var key = 'glb:' + glbRel;
      if (cache[key]) return Promise.resolve(cache[key].clone(true));
      if (loading[key]) return loading[key];
      loading[key] = new Promise(function (resolve, reject) {
        gltfLoader.load(resolvePath(glbRel), function (gltf) {
          var g = prepMesh(gltf.scene, scale);
          cache[key] = g;
          delete loading[key];
          resolve(g.clone(true));
        }, undefined, reject);
      });
      return loading[key];
    }

    function loadUnit(unitId) {
      var unit = global.ColdBiomManifest && global.ColdBiomManifest.UNITS[unitId];
      if (!unit) return Promise.resolve(null);
      if (unit.glb) return loadGlb(unit.glb, unit.scale);
      if (unit.obj) return loadObjMtl(unit.obj, unit.mtl, unit.scale);
      return Promise.resolve(null);
    }

    function loadScatter(entry) {
      if (entry.trunk && entry.crown) {
        return Promise.all([
          loadObjMtl(entry.trunk + '.obj', entry.trunk + '.mtl', entry.scale),
          loadObjMtl(entry.crown + '.obj', entry.crown + '.mtl', entry.scale),
        ]).then(function (parts) {
          var g = new THREE.Group();
          if (parts[0]) {
            parts[0].position.y = 0;
            g.add(parts[0]);
          }
          if (parts[1]) {
            parts[1].position.y = 2.2 * (entry.scale || 0.014) * 80;
            g.add(parts[1]);
          }
          return g;
        });
      }
      var rel = entry.obj || entry;
      if (typeof rel === 'string') {
        return loadObjMtl(rel + '.obj', rel + '.mtl', entry.scale || 0.01);
      }
      return Promise.resolve(null);
    }

    function preloadEssentials() {
      var ids = Object.keys(global.ColdBiomManifest ? global.ColdBiomManifest.UNITS : {});
      return Promise.all(ids.map(function (id) {
        return loadUnit(id).catch(function () { return null; });
      }));
    }

    return {
      loadUnit: loadUnit,
      loadScatter: loadScatter,
      loadObjMtl: loadObjMtl,
      loadGlb: loadGlb,
      preloadEssentials: preloadEssentials,
      getCache: function () { return cache; },
    };
  }

  global.ColdBiomLoader = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
