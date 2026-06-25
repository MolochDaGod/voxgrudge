/**
 * Voxgrudge collision layers — bitmask roles for terrain, entities, interactables.
 */
(function (global) {
  'use strict';

  var LAYERS = {
    TERRAIN: 1,
    WATER: 2,
    NODE: 4,
    BUILDING: 8,
    WALL: 16,
    INTERACTABLE: 32,
    ITEM: 64,
    NPC: 128,
    ALLY: 256,
    ENEMY: 512,
    MONSTER: 1024,
    BOSS: 2048,
    PLAYER: 4096,
    PROJECTILE: 8192,
    SAFE_ZONE: 16384,
    VENDOR: 32768,
    BLOCK: 65536,
  };

  var MASKS = {
    PLAYER_MOVE: LAYERS.TERRAIN | LAYERS.BUILDING | LAYERS.WALL | LAYERS.BLOCK | LAYERS.NODE,
    PLAYER_GROUND: LAYERS.TERRAIN,
    PROJECTILE_HIT: LAYERS.TERRAIN | LAYERS.BUILDING | LAYERS.WALL | LAYERS.BLOCK
      | LAYERS.ENEMY | LAYERS.MONSTER | LAYERS.BOSS | LAYERS.NPC,
    HARVEST: LAYERS.NODE,
    INTERACT: LAYERS.INTERACTABLE | LAYERS.NPC | LAYERS.VENDOR | LAYERS.ITEM,
    AGGRO_BLOCK: LAYERS.SAFE_ZONE,
  };

  function layerForEnemy(def) {
    if (!def) return LAYERS.ENEMY;
    if (def.tier >= 6 || def.beh === 'titan') return LAYERS.BOSS;
    if (def.tier >= 3) return LAYERS.MONSTER;
    return LAYERS.ENEMY;
  }

  function layerForKind(kind, def) {
    switch (kind) {
      case 'terrain': return LAYERS.TERRAIN;
      case 'water': return LAYERS.WATER;
      case 'node': return LAYERS.NODE;
      case 'building': return LAYERS.BUILDING;
      case 'wall': return LAYERS.WALL;
      case 'chest':
      case 'interactable': return LAYERS.INTERACTABLE;
      case 'item': return LAYERS.ITEM;
      case 'npc':
      case 'survivor': return LAYERS.NPC;
      case 'ally':
      case 'minion': return LAYERS.ALLY;
      case 'vendor': return LAYERS.VENDOR;
      case 'block': return LAYERS.BLOCK;
      case 'safe_zone': return LAYERS.SAFE_ZONE;
      case 'enemy': return layerForEnemy(def);
      default: return LAYERS.INTERACTABLE;
    }
  }

  global.VoxLayers = {
    LAYERS: LAYERS,
    MASKS: MASKS,
    layerForKind: layerForKind,
    layerForEnemy: layerForEnemy,
  };
})(typeof window !== 'undefined' ? window : globalThis);