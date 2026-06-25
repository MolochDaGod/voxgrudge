/**
 * Grudge Scale — meters-based sizing for voxgrudge open world.
 * Player = 2m tall. Largest bosses cap at 4m.
 */
(function (global) {
  const PLAYER_HEIGHT_M = 2.0;
  const BOSS_MAX_HEIGHT_M = 4.0;
  const KENNEY_NATIVE_H = 1.9;
  const VOX_NATIVE_H = 2.8;
  const CREATURE_NATIVE_H = {
    cheetah: 1.4, owl: 0.9, crocodile: 1.2, rhinoceros: 2.0, werewolf: 1.8,
    'skeleton-warrior': 1.9, 'iron-golem': 2.8, 'mini-dragon': 1.6, drake: 3.2,
    'ender-dragon': 4.5, 'karate-boss': 2.2,
    minecraft_spider: 1.1, voxel_snake: 1.0, crow: 0.7, giganto: 3.5, demise: 2.4,
  };

  const TIER_HEIGHT_M = {
    1: { min: 0.7, max: 1.4, humanoid: 2.0 },
    2: { min: 1.2, max: 2.0, humanoid: 2.0 },
    3: { min: 1.6, max: 2.4, humanoid: 2.0 },
    4: { min: 2.0, max: 2.8, humanoid: 2.0 },
    5: { min: 2.4, max: 3.2, humanoid: 2.0 },
    6: { min: 3.0, max: 3.6, humanoid: 2.0 },
    7: { min: 3.5, max: BOSS_MAX_HEIGHT_M, humanoid: 2.0 },
  };

  const ENEMY_HEIGHT_OVERRIDES = {
    cave_bat: 0.8, green_spider: 1.0, voxel_spider: 1.2, doom_crow: 0.9,
    sand_serpent: 1.4, dire_wolf: 1.3, velociraptor: 1.6,
    cave_troll: 2.8, minotaur_guard: 3.2, rhino_charger: 2.6,
    fire_drake: 3.4, frost_wyrm: 3.6, shadow_dragon: 4.0,
    juggernaut: 3.8, creature_titan: 4.0, giganto_beast: 4.0, demise_revenant: 3.6,
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function heightForEnemy(def, typeId) {
    if (ENEMY_HEIGHT_OVERRIDES[typeId] != null) return ENEMY_HEIGHT_OVERRIDES[typeId];
    const tier = def.tier || 1;
    const band = TIER_HEIGHT_M[tier] || TIER_HEIGHT_M[1];
    if (def.beh === 'titan' || typeId.includes('dragon') || typeId.includes('titan')) return BOSS_MAX_HEIGHT_M;
    if (def.fantasy === 'giganto' || def.fantasy === 'demise') return clamp(band.max, 3.2, BOSS_MAX_HEIGHT_M);
    const humanoid = def.beh === 'chase' || def.beh === 'heavy' || def.beh === 'berserker' || def.beh === 'tank';
    if (humanoid) return band.humanoid;
    const t = (def.sc || 1) - 0.5;
    return clamp(band.min + t * (band.max - band.min), band.min, band.max);
  }

  function scaleForHeight(targetM, nativeH) {
    return targetM / (nativeH || KENNEY_NATIVE_H);
  }

  function playerScale() {
    return scaleForHeight(PLAYER_HEIGHT_M, KENNEY_NATIVE_H);
  }

  function kenneyScale(heightM) {
    return scaleForHeight(heightM, KENNEY_NATIVE_H);
  }

  function voxScale(heightM) {
    return scaleForHeight(heightM, VOX_NATIVE_H);
  }

  function creatureScale(creatureName, heightM) {
    const native = CREATURE_NATIVE_H[creatureName] || 1.8;
    return scaleForHeight(heightM, native);
  }

  function fantasyScale(fantasyKey, heightM) {
    const native = CREATURE_NATIVE_H[fantasyKey] || 1.5;
    return scaleForHeight(heightM, native);
  }

  global.GrudgeScale = {
    PLAYER_HEIGHT_M,
    BOSS_MAX_HEIGHT_M,
    KENNEY_NATIVE_H,
    heightForEnemy,
    playerScale,
    kenneyScale,
    voxScale,
    creatureScale,
    fantasyScale,
    scaleForHeight,
  };
})(typeof window !== 'undefined' ? window : globalThis);