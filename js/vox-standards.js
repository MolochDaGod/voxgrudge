/**
 * VoxGrudge voxel / world standards — single source of truth for units,
 * scales, camera defaults, AI ranges, and asset conventions.
 *
 * Conventions (genre-standard open-world voxel RPG):
 *   1 world unit ≈ 1 meter
 *   Player height ≈ 1.8 m, eye ≈ 1.55 m
 *   Chunk = 96 m (Albion-style zone tile)
 *   Heightmap sample grid matches terrain segments
 */
(function (global) {
  'use strict';

  var UNIT_M = 1;

  var SCALE = {
    UNIT_M: UNIT_M,
    BLOCK: 1,
    HALF_BLOCK: 0.5,
    CHUNK: 96,
    LOAD_RADIUS_CHUNKS: 3,
    WORLD_SCALE: 10,
    // Character
    PLAYER_HEIGHT_M: 1.8,
    PLAYER_EYE_M: 1.55,
    PLAYER_RADIUS: 0.45,
    PLAYER_FOLLOW_HEIGHT: 1.45,
    PLAYER_LOOK_HEIGHT: 1.35,
    // Combat / AI
    AGGRO_RADIUS: 32,
    LEASH_RADIUS: 90,
    PATROL_RADIUS: 14,
    ALERT_RADIUS: 42,
    HEARING_RADIUS: 18,
    FLEE_HP_PCT: 0.18,
    // Terrain
    TERRAIN_SEGMENTS: 160,
    TERRAIN_WATER_Y: -1.2,
    HEIGHT_SAMPLE_EPS: 1.2,
    // Assets
    KENNEY_TEX_SIZE: 128,
    PROP_SNAP_EPS: 0.02,
  };

  var CAMERA = {
    modes: ['tps', 'iso', 'fps'],
    tps: {
      distance: 12,
      minDist: 3.5,
      maxDist: 30,
      minPitch: 0.1,
      maxPitch: 1.35,
      shoulder: 0.55,
      collisionPad: 0.45,
      combatZoom: 0.82,
      smooth: 11,
      fov: 58,
    },
    iso: {
      height: 36,
      back: 30,
      pitchHint: 0.95,
      smooth: 8,
      fov: 50,
    },
    fps: {
      eyeOffset: 0.38,
      adsFovMult: 0.78,
      bobAmp: 0.028,
      bobFreq: 9.5,
      smooth: 16,
      fov: 72,
    },
  };

  var VOXEL = {
    /** Standard block palette ids used by build mode / props */
    BLOCKS: {
      air: 0,
      grass: 1,
      dirt: 2,
      stone: 3,
      wood: 4,
      sand: 5,
      snow: 6,
      water: 7,
      ore: 8,
      brick: 9,
      darkstone: 10,
    },
    /** Prefer power-of-two atlas cells for terrain splat */
    ATLAS_CELL: 128,
    MAX_MESH_TRIS_PER_CHUNK: 120000,
  };

  var ASSET = {
    /** Prefer same-origin bundle; CDN only with ?cdn=1 (see grudge-asset-config). */
    preferLocal: true,
    kenneyBodies: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    kenneyTextures: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r'],
    creatureFolders: ['models/creatures', 'models/fantasy', 'models/kenney'],
    /** LOD distances for GLB props / units */
    lodNear: 48,
    lodFar: 110,
    unload: 160,
  };

  var FLOW = {
    MENU: 'menu',
    CLASS_SELECT: 'class_select',
    LOADING: 'loading',
    PLAYING: 'playing',
    PAUSED: 'paused',
    NIGHT_RAID: 'night_raid',
    DEATH: 'death',
    RESPAWN: 'respawn',
  };

  var AI = {
    STATES: {
      IDLE: 'idle',
      PATROL: 'patrol',
      ALERT: 'alert',
      CHASE: 'chase',
      COMBAT: 'combat',
      KITE: 'kite',
      FLANK: 'flank',
      RETREAT: 'retreat',
      LEASH: 'leash',
      STUNNED: 'stunned',
    },
    MEMORY_SEC: 4.5,
    ALERT_HOLD: 1.6,
    FLANK_CHANCE: 0.28,
    CALL_HELP_RADIUS: 22,
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  /** Map def.sc / heightM into world meters using roster standards. */
  function unitHeightM(def, fallback) {
    if (def && def.heightM != null) return clamp(def.heightM, 0.5, 6);
    var sc = def && def.sc != null ? def.sc : 1;
    return clamp((fallback || SCALE.PLAYER_HEIGHT_M) * sc, 0.5, 6);
  }

  function worldRadius() {
    return 130 * SCALE.WORLD_SCALE;
  }

  global.VoxStandards = {
    UNIT_M: UNIT_M,
    SCALE: SCALE,
    CAMERA: CAMERA,
    VOXEL: VOXEL,
    ASSET: ASSET,
    FLOW: FLOW,
    AI: AI,
    clamp: clamp,
    unitHeightM: unitHeightM,
    worldRadius: worldRadius,
  };
})(typeof window !== 'undefined' ? window : globalThis);
