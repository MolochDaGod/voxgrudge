/**
 * GrudgeInstancedPool — frustum-culled InstancedMesh with per-instance visibility.
 * Works with Three.js r128+ (global THREE).
 */
(function (global) {
  class GrudgeInstancedPool {
    constructor({ scene, geometry, material, maxCount, renderOrder = 0 }) {
      this.scene = scene;
      this.maxCount = maxCount;
      this.count = 0;
      this.mesh = new THREE.InstancedMesh(geometry, material, maxCount);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = renderOrder;
      scene.add(this.mesh);

      this.visibility = new Float32Array(maxCount);
      this.boundingSpheres = [];
      this.geom = geometry;
      geometry.setAttribute(
        'visibility',
        new THREE.InstancedBufferAttribute(this.visibility, 1)
      );

      this._tmp = new THREE.Object3D();
      this._frustum = new THREE.Frustum();
      this._proj = new THREE.Matrix4();
      this._lastPos = new THREE.Vector3();
      this._lastQuat = new THREE.Quaternion();
      this._moveThresh = 0.5;
      this._rotThresh = 0.01;
    }

    setInstances(list) {
      this.count = Math.min(list.length, this.maxCount);
      this.mesh.count = this.count;
      this.boundingSpheres.length = 0;

      for (let i = 0; i < this.count; i++) {
        const p = list[i];
        const s = p.scale != null ? p.scale : 1;
        const x = p.x;
        const y = p.y != null ? p.y : 0;
        const z = p.z;

        this._tmp.position.set(x, y, z);
        this._tmp.scale.setScalar(s);
        this._tmp.updateMatrix();
        this.mesh.setMatrixAt(i, this._tmp.matrix);
        this.visibility[i] = 1;

        const r = p.radius != null ? p.radius : s * 0.75;
        this.boundingSpheres.push(new THREE.Sphere(new THREE.Vector3(x, y, z), r));
      }

      this.mesh.instanceMatrix.needsUpdate = true;
      const vis = this.geom.attributes.visibility;
      if (vis) vis.needsUpdate = true;
    }

    updateFrustumCull(camera, force) {
      if (!this.count) return 0;
      const moved = camera.position.distanceTo(this._lastPos) > this._moveThresh;
      const rotated = camera.quaternion.angleTo(this._lastQuat) > this._rotThresh;
      if (!force && !moved && !rotated) return -1;

      this._proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._proj);

      const vis = this.geom.attributes.visibility;
      let visible = 0;
      for (let i = 0; i < this.count; i++) {
        const v = this._frustum.intersectsSphere(this.boundingSpheres[i]) ? 1 : 0;
        vis.array[i] = v;
        if (v) visible++;
      }
      vis.needsUpdate = true;
      this._lastPos.copy(camera.position);
      this._lastQuat.copy(camera.quaternion);
      return visible;
    }

    dispose() {
      this.scene.remove(this.mesh);
      this.geom.dispose();
      if (this.mesh.material.dispose) this.mesh.material.dispose();
    }
  }

  global.GrudgeInstancedPool = GrudgeInstancedPool;
})(typeof window !== 'undefined' ? window : globalThis);
