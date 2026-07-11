/**
 * ColdBiomStandard asset roles — enemies, allies, props, scatter.
 */
(function (global) {
  'use strict';

  var BASE = 'models/cold-biom/';

  var UNITS = {
    viking_raider: {
      id: 'viking_raider', label: 'Frost Raider', role: 'enemy',
      glb: BASE + 'Viking/VikingAnimated.glb',
      scale: 1.4, tier: 5, heightM: 2.2,
    },
    viking_brute: {
      id: 'viking_brute', label: 'Viking Brute', role: 'enemy',
      obj: BASE + 'Viking/Viking.obj', mtl: BASE + 'Viking/Viking.mtl',
      scale: 0.018, tier: 6, heightM: 2.4,
    },
    ice_wolf: {
      id: 'ice_wolf', label: 'Ice Stalker', role: 'enemy',
      obj: BASE + 'Icycles/IcycleDarkSnowy.obj', mtl: BASE + 'Icycles/IcycleDarkSnowy.mtl',
      scale: 0.012, tier: 4, heightM: 1.6,
    },
    snow_golem: {
      id: 'snow_golem', label: 'Snow Golem', role: 'enemy',
      obj: BASE + 'Snowman/Snowman.obj', mtl: BASE + 'Snowman/Snowman.mtl',
      scale: 0.02, tier: 3, heightM: 1.8,
    },
    frost_wyrm_cold: {
      id: 'frost_wyrm_cold', label: 'Glacier Wyrm', role: 'enemy',
      obj: BASE + 'Icycles/IcycleDarkIce2.obj', mtl: BASE + 'Icycles/IcycleDarkIce2.mtl',
      scale: 0.025, tier: 7, heightM: 3.2,
    },
    viking_ally: {
      id: 'viking_ally', label: 'Shield-Brother', role: 'ally',
      obj: BASE + 'Viking/Viking.obj', mtl: BASE + 'Viking/Viking.mtl',
      scale: 0.016, heightM: 2.0,
    },
    snowman_friend: {
      id: 'snowman_friend', label: 'Snowman Scout', role: 'ally',
      obj: BASE + 'Snowman/Snowman.obj', mtl: BASE + 'Snowman/Snowman.mtl',
      scale: 0.014, heightM: 1.5,
    },
    viking_vendor: {
      id: 'viking_vendor', label: 'Viking Quartermaster', role: 'vendor',
      obj: BASE + 'Viking/Viking.obj', mtl: BASE + 'Viking/Viking.mtl',
      scale: 0.016, heightM: 2.0,
    },
    frost_guide: {
      id: 'frost_guide', label: 'Frost Guide', role: 'npc',
      obj: BASE + 'Snowman/Snowman.obj', mtl: BASE + 'Snowman/Snowman.mtl',
      scale: 0.013, heightM: 1.4,
    },
  };

  var SCATTER = {
    trees: [
      { trunk: 'Trunks/Trunk1', crown: 'Crowns/TreeCrown2Snow', scale: 0.014 },
      { trunk: 'Trunks/Trunk2', crown: 'Crowns/TreeCrownSnowy', scale: 0.015 },
      { trunk: 'Trunks/Trunk3', crown: 'Crowns/TreeCrown2Snowy', scale: 0.013 },
      { trunk: 'Trunks/Trunk1', crown: 'Crowns/TreeCrownSnow', scale: 0.014 },
      { trunk: 'Trunks/Trunk2', crown: 'Crowns/TreeCrown2Snowy', scale: 0.015 },
    ],
    rocks: [
      { obj: 'Stones/MediumStoneSnow', scale: 0.012 },
      { obj: 'Stones/SmallStoneSnow', scale: 0.01 },
      { obj: 'Stones/RuneStone1', scale: 0.011 },
      { obj: 'Stones/DecoratedStone2', scale: 0.012 },
      { obj: 'Stones/MediumStone', scale: 0.013 },
      { obj: 'Blocks/groundIceShattered', scale: 0.009 },
    ],
    props: [
      { obj: 'Icycles/IcycleSnowy', scale: 0.01 },
      { obj: 'Icycles/Icycle2', scale: 0.011 },
      { obj: 'Icycles/IcycleDarkSnowy', scale: 0.011 },
      { obj: 'Icycles/IcycleDarkIce2', scale: 0.012 },
      { obj: 'Bushes/DeadBush', scale: 0.012 },
      { obj: 'Bushes/BerryBush', scale: 0.011 },
      { obj: 'Bushes/AliveBush', scale: 0.011 },
      { obj: 'Accessories/Lantern1', scale: 0.008 },
      { obj: 'Accessories/Lantern2', scale: 0.008 },
      { obj: 'Accessories/Chair', scale: 0.009 },
      { obj: 'Accessories/TableSmall', scale: 0.01 },
      { obj: 'Accessories/MugFullBeer', scale: 0.006 },
      { obj: 'Snowman/Snowman', scale: 0.009, friendly: true },
    ],
    buildings: [
      { wall: 'House/Wall', floor: 'House/Floor', roof: 'House/RoofFullFilledSnowed', scale: 0.012 },
      { wall: 'House/Stone/WallStone', floor: 'House/Stone/FloorStone', roof: 'House/Stone/RoofHalfFilledSnowedStone', scale: 0.012 },
    ],
    ground: ['Blocks/groundFlakes', 'Blocks/groundIce', 'Blocks/groundBase'],
  };

  var ENEMY_MAP = {
    frost_raider: 'viking_raider',
    viking_brute: 'viking_brute',
    ice_stalker: 'ice_wolf',
    snow_golem: 'snow_golem',
    glacier_wyrm: 'frost_wyrm_cold',
  };

  global.ColdBiomManifest = {
    BASE: BASE,
    UNITS: UNITS,
    SCATTER: SCATTER,
    ENEMY_MAP: ENEMY_MAP,
    unitForEnemy: function (typeId) {
      return ENEMY_MAP[typeId] || null;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
