/**
 * Grudge Scale — meters-based sizing for voxgrudge open world.
 * Player = 1.8 m (fleet SI yardstick · Multiverse/DRC/Open). Largest bosses cap at 4m.
 */
(function (global) {
  const PLAYER_HEIGHT_M = 1.8;
  const BOSS_MAX_HEIGHT_M = 4.0;
  const KENNEY_NATIVE_H = 1.9;
  const VOX_NATIVE_H = 2.8;
  /**
   * Assumed native mesh height BEFORE fitEnemyMeshHeight remeasure.
   * Skeleton-warrior.glb ships near human scale (~1.9–2.1 m bind pose). If a
   * prior scale map treated it as cm (190 units × 1.6) it read ~100× tall —
   * always re-fit with measured Box3 after spawn (fitEnemyMeshHeight).
   */
  const CREATURE_NATIVE_H = {
    cheetah: 1.4, owl: 0.9, crocodile: 1.2, rhinoceros: 2.0, werewolf: 1.8,
    'skeleton-warrior': 1.95, 'iron-golem': 2.8, 'mini-dragon': 1.6, drake: 3.2,
    'ender-dragon': 4.5, 'karate-boss': 2.2,
    minecraft_spider: 1.1, voxel_snake: 1.0, crow: 0.7, giganto: 3.5, demise: 2.4,
    cannon: 1.35,
  };

  const TIER_HEIGHT_M = {
    1: { min: 0.7, max: 1.4, humanoid: 1.8 },
    2: { min: 1.2, max: 2.0, humanoid: 1.8 },
    3: { min: 1.6, max: 2.4, humanoid: 1.8 },
    4: { min: 2.0, max: 2.8, humanoid: 1.8 },
    5: { min: 2.4, max: 3.2, humanoid: 1.8 },
    6: { min: 3.0, max: 3.6, humanoid: 1.8 },
    7: { min: 3.5, max: BOSS_MAX_HEIGHT_M, humanoid: 1.8 },
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
    // Cap first-pass scale so a bad native guess can't 100× a creature before
    // fitEnemyMeshHeight remeasures. Real size is corrected by measured Box3.
    const s = scaleForHeight(heightM, native);
    return clamp(s, 0.02, 8);
  }

  /**
   * Decade unit fix when measured height is absurd (cm vs m exports).
   * Prefer this when Box3 height is outside [0.05, 50] meters.
   */
  function unitFixToward(targetM, measuredH) {
    if (!(targetM > 0) || !(measuredH > 0)) return 1;
    if (measuredH >= 0.05 && measuredH <= 50) return 1;
    return Math.pow(10, Math.round(Math.log10(targetM / measuredH)));
  }

  function scaleToHeightSafe(measuredHeight, targetM) {
    const t = targetM || PLAYER_HEIGHT_M;
    let h = measuredHeight || 1;
    const uf = unitFixToward(t, h);
    h *= uf;
    let s = (t / h) * uf;
    if (!Number.isFinite(s) || s <= 0) s = 1;
    // Never allow ~100× humanoid scales from bad measures
    return clamp(s, 0.02, 12);
  }

  /**
   * After any player load: if world height is outside band, return true so caller re-fits.
   */
  function playerHeightOutOfBand(measuredH) {
    const h = measuredH || 0;
    return h > 2.6 || h < 0.9 || h > PLAYER_HEIGHT_M * 1.5 || h < PLAYER_HEIGHT_M * 0.55;
  }

  function fantasyScale(fantasyKey, heightM) {
    const native = CREATURE_NATIVE_H[fantasyKey] || 1.5;
    return scaleForHeight(heightM, native);
  }

  /**
   * Uniform scale factor so an object of measuredHeight becomes targetM tall.
   * Caller measures mesh height (Box3) then applies scale.
   */
  function scaleToHeight(measuredHeight, targetM) {
    return scaleToHeightSafe(measuredHeight, targetM);
  }

  global.GrudgeScale = {
    PLAYER_HEIGHT_M,
    BOSS_MAX_HEIGHT_M,
    KENNEY_NATIVE_H,
    heightForEnemy,
    playerScale,
    kenneyScale,
    voxScale,
    playerHeightOutOfBand,
    creatureScale,
    fantasyScale,
    scaleForHeight,
    scaleToHeight,
    scaleToHeightSafe,
    unitFixToward,
    ENEMY_HEIGHT_OVERRIDES,
    CREATURE_NATIVE_H,
  };
})(typeof window !== 'undefined' ? window : globalThis);