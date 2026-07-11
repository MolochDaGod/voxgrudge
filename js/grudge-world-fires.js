/**
 * Syncs instanced volumetric camp fires from VoxWorld camps (dynamic LOD).
 */
(function (global) {
  class GrudgeWorldFires {
    constructor(scene, opts) {
      this.scene = scene;
      this.worldEngine = opts && opts.worldEngine;
      this.maxCount = (opts && opts.maxCount) || 96;
      this.syncRadius = (opts && opts.syncRadius) || 95;
      this._fire = null;
      this._accum = 0;
      this._spawnFire = { x: 0, z: 0, scale: 0.9, seed: 0.2 };
    }

    _ensureFire() {
      if (this._fire || !global.GrudgeInstancedFire) return this._fire;
      this._fire = new GrudgeInstancedFire({
        scene: this.scene,
        maxCount: this.maxCount,
        intensity: 0.7,
        color: new THREE.Color(1, 0.32, 0.06),
      });
      return this._fire;
    }

    setSpawnBonfire(x, z) {
      this._spawnFire.x = x;
      this._spawnFire.z = z;
    }

    syncNear(px, pz) {
      const fire = this._ensureFire();
      if (!fire) return;
      const list = [{ x: this._spawnFire.x, z: this._spawnFire.z, y: 0.55, scale: 0.95, seed: 0.11 }];
      if (this.worldEngine && this.worldEngine.getCampsNear) {
        this.worldEngine.getCampsNear(px, pz, this.syncRadius).forEach((c, i) => {
          list.push({
            x: c.x,
            z: c.z,
            y: 0.5,
            scale: 0.65 + (c.tier || 1) * 0.08,
            seed: (i % 17) * 0.07,
          });
        });
      }
      fire.setInstances(list.slice(0, this.maxCount));
    }

    update(camera, elapsed, px, pz) {
      const fire = this._ensureFire();
      if (!fire) return;
      this._accum += 0.016;
      if (this._accum > 1.8) {
        this._accum = 0;
        if (px != null && pz != null) this.syncNear(px, pz);
      }
      fire.update(camera, elapsed);
    }

    dispose() {
      if (this._fire) this._fire.dispose();
      this._fire = null;
    }
  }

  global.GrudgeWorldFires = GrudgeWorldFires;
})(typeof window !== 'undefined' ? window : globalThis);
