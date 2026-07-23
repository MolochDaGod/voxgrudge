/**
 * LavaBiome 2D isometric pack — scatter roles for volcanic zone.
 * Source: LavaBiome.zip (PNG sprites + sheets)
 */
(function (global) {
  'use strict';

  var BASE = 'assets/lava-biome/';

  var SCATTER = {
    trees: [
      { sprite: 'Trees/LavaTree1.png', scale: 3.2 },
      { sprite: 'Trees/LavaTree2.png', scale: 3.0 },
      { sprite: 'Trees/LavaTree3.png', scale: 3.4 },
      { sprite: 'Trees/LavaTree4.png', scale: 2.8 },
    ],
    rocks: [
      { sprite: 'Rocks/VolcanicRock1.png', scale: 2.2 },
      { sprite: 'Rocks/VolcanicRock2.png', scale: 1.8 },
      { sprite: 'Rocks/VolcanicRock3.png', scale: 2.4 },
      { sprite: 'Rocks/VolcanicRock4.png', scale: 2.0 },
    ],
    plants: [
      { sprite: 'Plants/LavaPlant1.png', scale: 1.6 },
      { sprite: 'Plants/LavaPlant2.png', scale: 1.8 },
      { sprite: 'Plants/LavaPlant3.png', scale: 1.5 },
      { sprite: 'Plants/LavaPlant4.png', scale: 1.7 },
    ],
    volcanoes: [
      { sprite: 'Volcano/Volcano1.png', scale: 6.5 },
      { sprite: 'Volcano/Volcano2.png', scale: 5.5 },
      { sprite: 'Volcano/Volcano3.png', scale: 7.0 },
      { sprite: 'Volcano/Volcano4.png', scale: 6.0 },
    ],
    mounds: [
      { sprite: 'MiniVolcans/VolcanicMound1.png', scale: 3.5 },
      { sprite: 'MiniVolcans/VolcanicMound2.png', scale: 2.8 },
      { sprite: 'MiniVolcans/VolcanicMound3.png', scale: 3.0 },
      { sprite: 'MiniVolcans/VolcanicMound4.png', scale: 3.8 },
    ],
    constructions: [
      { sprite: 'Constructions/LavaForge.png', scale: 3.2 },
      { sprite: 'Constructions/LavaPortal.png', scale: 3.0 },
      { sprite: 'Constructions/LavaTotem.png', scale: 2.8 },
      { sprite: 'Constructions/LavaObelsik.png', scale: 3.4 },
      { sprite: 'Constructions/LavaAnvile.png', scale: 2.2 },
      { sprite: 'Constructions/LavaFence.png', scale: 2.0 },
    ],
    bubbles: [
      { sprite: 'Bubble/LavaBubble1.png', scale: 1.2 },
      { sprite: 'Bubble/LavaBubble2.png', scale: 1.4 },
      { sprite: 'Bubble/LavaBubble3.png', scale: 1.3 },
      { sprite: 'Bubble/LavaBubble4.png', scale: 1.5 },
    ],
  };

  var TILES = {
    top: BASE + 'Tiles/Lava_TOP_Texture.png',
    side: BASE + 'Tiles/Lava_SIDES_Texture.png',
    cube: BASE + 'Tiles/Lava1_ISO_Cube.png',
    stairs: BASE + 'Tiles/Lava_ISO_Stairs.png',
    half: BASE + 'Tiles/Lava_ISO_HalfSlab.png',
  };

  var GROUND = 0x4a1a0a;
  var FOG = 0x2a0a08;
  var AMBIENT = 0xff6622;

  global.LavaBiomManifest = {
    BASE: BASE,
    SCATTER: SCATTER,
    TILES: TILES,
    GROUND: GROUND,
    FOG: FOG,
    AMBIENT: AMBIENT,
    label: 'Lava Biome',
    name: 'LAVA CALDERA',
  };
})(typeof window !== 'undefined' ? window : globalThis);
