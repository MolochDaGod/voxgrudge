/**
 * TVS asset categories + SI scale SSOT for game usage.
 *
 * Yardstick: CHARACTER_HEIGHT_M = 2.0 (TVS / voxel play kits).
 * Fleet human reference: HUMAN_HEIGHT_M = 1.8 (Grudge world scale).
 *
 * Rules:
 *   - 1 unit = 1 metre
 *   - Scale by **uniform grow** of the whole asset (root scalar only)
 *   - Never stretch bones/meshes non-uniformly
 *   - Never fit weapons/buildings to character *height* blindly —
 *     use category fitAxis (height | max) and targetM relative to 2 m heroes
 *
 * Used by: TvsVoxelAssets · TvsUnitLoader · TvsProductionPipeline · showcase
 */
(function (global) {
  "use strict";

  /** Play-kit character height (TVS production bake). */
  var CHARACTER_HEIGHT_M = 2.0;
  /** Adult human reference (fleet / props relative when not TVS kit). */
  var HUMAN_HEIGHT_M = 1.8;

  /**
   * Category definitions.
   * targetM — desired measure after load (metres)
   * fitAxis — "y" (height) | "max" (longest AABB edge) | "xz" (footprint max)
   * relativeToChar — targetM / CHARACTER_HEIGHT_M (documentation + tools)
   * maxDimM — decade-guard ceiling after author-scale collapse
   * usage — short game-usage note
   */
  var CATEGORIES = {
    character: {
      id: "character",
      label: "Characters",
      group: "characters",
      targetM: CHARACTER_HEIGHT_M,
      fitAxis: "y",
      relativeToChar: 1.0,
      maxDimM: 12,
      usage: "Playable / NPC humanoids — feet ground, ~2 m tall",
    },
    weapon_1h: {
      id: "weapon_1h",
      label: "Weapons · 1H",
      group: "weapons",
      // Realistic arming sword / hand axe longest edge ~0.7–0.9 m for 2 m hero
      targetM: 0.85,
      fitAxis: "max",
      relativeToChar: 0.425,
      maxDimM: 2.5,
      usage: "One-hand sword/axe/mace — longest edge ~0.85 m (not character height)",
    },
    weapon_2h: {
      id: "weapon_2h",
      label: "Weapons · 2H",
      group: "weapons",
      targetM: 1.2,
      fitAxis: "max",
      relativeToChar: 0.6,
      maxDimM: 3.5,
      usage: "Two-hand / great weapons — longest edge ~1.2 m",
    },
    weapon_staff: {
      id: "weapon_staff",
      label: "Weapons · staff",
      group: "weapons",
      targetM: 1.55,
      fitAxis: "y",
      relativeToChar: 0.775,
      maxDimM: 3.5,
      usage: "Staff / polearm height ~ shoulder–ground for 2 m hero",
    },
    weapon_bow: {
      id: "weapon_bow",
      label: "Weapons · bow",
      group: "weapons",
      targetM: 1.0,
      fitAxis: "max",
      relativeToChar: 0.5,
      maxDimM: 2.5,
      usage: "Bow / crossbow — ~1.0 m longest edge (not 2 m)",
    },
    /** Arrows / bolts / thrown — NEVER fit to character height. */
    projectile: {
      id: "projectile",
      label: "Projectiles",
      group: "weapons",
      targetM: 0.72,
      fitAxis: "max",
      relativeToChar: 0.36,
      maxDimM: 1.2,
      usage: "Arrow / bolt / javelin shaft ~0.7 m — hand-held ammo scale",
    },
    shield: {
      id: "shield",
      label: "Shields",
      group: "weapons",
      targetM: 0.85,
      fitAxis: "max",
      relativeToChar: 0.425,
      maxDimM: 2.0,
      usage: "Shield face ~ torso width of 2 m character",
    },
    /** Hammers, pickaxes, repair tools — not 2 m poles. */
    tool: {
      id: "tool",
      label: "Tools",
      group: "items",
      targetM: 0.7,
      fitAxis: "max",
      relativeToChar: 0.35,
      maxDimM: 1.8,
      usage: "Pickaxe / hammer / shovel / repair tool ~0.7 m",
    },
    item_small: {
      id: "item_small",
      label: "Items · small",
      group: "items",
      targetM: 0.22,
      fitAxis: "max",
      relativeToChar: 0.11,
      maxDimM: 0.8,
      usage: "Coins, keys, gems, potions, food — hand / bag scale",
    },
    item_medium: {
      id: "item_medium",
      label: "Items · medium",
      group: "items",
      targetM: 0.55,
      fitAxis: "max",
      relativeToChar: 0.275,
      maxDimM: 1.5,
      usage: "Books, bags — inventory / table scale (not tools — see tool)",
    },
    prop_crate: {
      id: "prop_crate",
      label: "Props · crate/barrel",
      group: "props",
      targetM: 0.95,
      fitAxis: "y",
      relativeToChar: 0.475,
      maxDimM: 12,
      usage: "Crates/barrels ~ waist–chest of 2 m character",
    },
    prop_furniture: {
      id: "prop_furniture",
      label: "Props · furniture",
      group: "props",
      targetM: 1.15,
      fitAxis: "y",
      relativeToChar: 0.575,
      maxDimM: 15,
      usage: "Tables, benches, chairs, beds — room interaction",
    },
    prop_generic: {
      id: "prop_generic",
      label: "Props · generic",
      group: "props",
      targetM: 1.0,
      fitAxis: "y",
      relativeToChar: 0.5,
      maxDimM: 15,
      usage: "Misc props — default half-character height",
    },
    nature_tree: {
      id: "nature_tree",
      label: "Nature · tree",
      group: "nature",
      targetM: 6.0,
      fitAxis: "y",
      relativeToChar: 3.0,
      maxDimM: 40,
      usage: "Trees ~ 3× character for canopy over heroes",
    },
    nature_bush: {
      id: "nature_bush",
      label: "Nature · bush",
      group: "nature",
      targetM: 1.2,
      fitAxis: "y",
      relativeToChar: 0.6,
      maxDimM: 12,
      usage: "Bushes/plants — cover up to chest",
    },
    nature_rock: {
      id: "nature_rock",
      label: "Nature · rock",
      group: "nature",
      targetM: 1.1,
      fitAxis: "max",
      relativeToChar: 0.55,
      maxDimM: 20,
      usage: "Rocks/boulders — cover & path block",
    },
    fence: {
      id: "fence",
      label: "Fence / post",
      group: "buildings",
      targetM: 1.4,
      fitAxis: "y",
      relativeToChar: 0.7,
      maxDimM: 12,
      usage: "Fence/post ~ chest height on 2 m hero",
    },
    building_house: {
      id: "building_house",
      label: "Buildings · house",
      group: "buildings",
      targetM: 8.0,
      fitAxis: "y",
      relativeToChar: 4.0,
      maxDimM: 60,
      usage: "Houses/shops/barns ~ 4× character (door/window usable)",
    },
    building_tower: {
      id: "building_tower",
      label: "Buildings · tower",
      group: "buildings",
      targetM: 12.0,
      fitAxis: "y",
      relativeToChar: 6.0,
      maxDimM: 80,
      usage: "Towers ~ 6× character",
    },
    building_landmark: {
      id: "building_landmark",
      label: "Buildings · landmark",
      group: "buildings",
      targetM: 16.0,
      fitAxis: "y",
      relativeToChar: 8.0,
      maxDimM: 100,
      usage: "Cathedral/castle/keep/palace — skyline landmarks",
    },
    building_wall: {
      id: "building_wall",
      label: "Buildings · wall/gate",
      group: "buildings",
      targetM: 5.5,
      fitAxis: "y",
      relativeToChar: 2.75,
      maxDimM: 60,
      usage: "Walls/gates/bridges — hero-readable fortification",
    },
    building_generic: {
      id: "building_generic",
      label: "Buildings · other",
      group: "buildings",
      targetM: 6.0,
      fitAxis: "y",
      relativeToChar: 3.0,
      maxDimM: 60,
      usage: "Other environment structures",
    },
    animal_small: {
      id: "animal_small",
      label: "Animals · small",
      group: "animals",
      targetM: 0.75,
      fitAxis: "y",
      relativeToChar: 0.375,
      maxDimM: 10,
      usage: "Chicken, duck, corgi, owl — small critters",
    },
    animal_medium: {
      id: "animal_medium",
      label: "Animals · medium",
      group: "animals",
      targetM: 1.35,
      fitAxis: "y",
      relativeToChar: 0.675,
      maxDimM: 12,
      usage: "Sheep, pig, goat, dog — mid wildlife",
    },
    animal_large: {
      id: "animal_large",
      label: "Animals · large",
      group: "animals",
      targetM: 1.9,
      fitAxis: "y",
      relativeToChar: 0.95,
      maxDimM: 16,
      usage: "Cow, bull — near character height",
    },
    animal_mount: {
      id: "animal_mount",
      label: "Animals · mount",
      group: "animals",
      targetM: 2.2,
      fitAxis: "y",
      relativeToChar: 1.1,
      maxDimM: 16,
      usage: "Horse / mount — slightly taller than 2 m rider at withers",
    },
    animation: {
      id: "animation",
      label: "Animations",
      group: "meta",
      targetM: 0,
      fitAxis: "y",
      relativeToChar: 0,
      maxDimM: 0,
      usage: "Clip packs — not scaled as world meshes",
    },
    texture: {
      id: "texture",
      label: "Textures",
      group: "meta",
      targetM: 0,
      fitAxis: "y",
      relativeToChar: 0,
      maxDimM: 0,
      usage: "Atlases — not meshes",
    },
  };

  /** Showcase / game browse groups */
  var GROUPS = {
    characters: { id: "characters", label: "Characters", modes: ["units", "races", "characters"] },
    weapons: { id: "weapons", label: "Weapons & shields", modes: ["weapons"] },
    items: { id: "items", label: "Items", modes: ["items"] },
    props: { id: "props", label: "Props", modes: ["props"] },
    nature: { id: "nature", label: "Nature", modes: ["nature"] },
    buildings: { id: "buildings", label: "Buildings / env", modes: ["buildings"] },
    animals: { id: "animals", label: "Animals", modes: ["animals"] },
    meta: { id: "meta", label: "Meta", modes: [] },
  };

  function slugOf(asset) {
    if (!asset) return "";
    return String(asset.slug || asset.name || asset.unitId || asset.id || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function roleOf(asset) {
    return String((asset && (asset.role || asset.kind || asset.classHint)) || "").toLowerCase();
  }

  /**
   * Classify a catalog row / unit into a category id.
   */
  function classify(asset) {
    var role = roleOf(asset);
    var slug = slugOf(asset);
    var tags = ((asset && asset.tags) || []).map(function (t) {
      return String(t).toLowerCase();
    });
    var blob = slug + " " + role + " " + tags.join(" ");

    // Exact role checks first (never substring: "anim" ⊂ "animals")
    if (role === "animations" || role === "animation") {
      return CATEGORIES.animation;
    }
    if (role === "textures" || role === "texture") {
      return CATEGORIES.texture;
    }
    if (/\.png|\.webp|(^|[-_])texture([-_]|$)|atlas/.test(slug)) {
      return CATEGORIES.texture;
    }

    // Animals before characters (role animals, or animal token in slug)
    var animalToken =
      /(^|[-_])(horse|mount|steed|cow|bull|ox|pig|sheep|chicken|duck|owl|corgi|goat|dog|cat|wolf|bird)([-_]|$)/.test(
        slug
      );
    if (role === "animals" || role === "animal" || animalToken) {
      if (/(^|[-_])(horse|mount|steed)([-_]|$)/.test(slug)) return CATEGORIES.animal_mount;
      if (/(^|[-_])(cow|bull|ox)([-_]|$)/.test(slug)) return CATEGORIES.animal_large;
      if (/(^|[-_])(pig|sheep|goat|dog|wolf)([-_]|$)/.test(slug)) return CATEGORIES.animal_medium;
      if (/(^|[-_])(chicken|duck|owl|corgi|cat|bird)([-_]|$)/.test(slug)) {
        return CATEGORIES.animal_small;
      }
      return CATEGORIES.animal_medium;
    }

    // Characters (skinned play units / catalog heroes / roster units)
    if (
      role === "characters" ||
      role === "character" ||
      role === "melee" ||
      role === "ranged" ||
      role === "magic" ||
      role === "civilian" ||
      (asset && asset.classHint) ||
      (asset && asset.unitId) ||
      (asset && asset.brainUrl)
    ) {
      return CATEGORIES.character;
    }

    // Projectiles FIRST — arrows must never fall through to character/weapon_2h
    if (
      /(^|[-_])(arrow|arrows|bolt|bolts|quiver|dart|javelin|projectile)([-_]|$)/.test(slug) ||
      /arrow|bolt|javelin|projectile/.test(blob)
    ) {
      if (/quiver/.test(blob)) return CATEGORIES.item_medium;
      return CATEGORIES.projectile;
    }

    // Tools (pick / repair hammer / shovel) before generic "hammer" → 1H weapon
    if (
      /pickaxe|pick-axe|shovel|spade|hoe|wrench|screwdriver|repair|tongs|anvil-hammer|sledge/.test(
        blob
      ) ||
      (/(^|[-_])(tool|tools)([-_]|$)/.test(slug) && !/weapon/.test(blob))
    ) {
      return CATEGORIES.tool;
    }
    // "hammer" without war-weapon context → tool (pack names like voxel-knights-hammer OK)
    if (
      /(^|[-_])hammer([-_]|$)/.test(slug) &&
      !/warhammer|war-hammer|battleaxe|battle-hammer/.test(blob)
    ) {
      return CATEGORIES.tool;
    }

    // Weapons / equipment
    if (
      /shield|buckler/.test(blob) ||
      (role === "props" && /shield/.test(slug))
    ) {
      return CATEGORIES.shield;
    }
    if (/staff|pole|spear|lance|halberd|pike/.test(blob)) return CATEGORIES.weapon_staff;
    if (/bow|crossbow|longbow/.test(blob)) return CATEGORIES.weapon_bow;
    if (/greatsword|claymore|battleaxe|warhammer|zwei|2h|two[-_]?hand/.test(blob)) {
      return CATEGORIES.weapon_2h;
    }
    if (
      /sword|axe|mace|dagger|knife|club|blade|scimitar|weapon|armour|armor|helm|helmet|warhammer|battleaxe/.test(
        blob
      ) ||
      role === "weapon" ||
      role === "equipment"
    ) {
      if (/helm|helmet|armor|armour|boots|gloves|chest|legs/.test(blob) && !/weapon|sword|axe/.test(blob)) {
        return CATEGORIES.item_medium;
      }
      // war hammer as 2H-ish
      if (/warhammer|battleaxe|war-hammer/.test(blob)) return CATEGORIES.weapon_2h;
      return CATEGORIES.weapon_1h;
    }

    // Small items (no arrows — handled above)
    if (
      /coin|key|gem|potion|food|herb|ore|ingot|bullet|bottle|cup|plate|book|scroll|bag|pouch|ring|amulet|necklace|grail|chalice|idol|relic/.test(
        blob
      ) ||
      role === "item" ||
      role === "items"
    ) {
      if (/bag|pouch|book|scroll|bottle|chalice|grail|idol|relic/.test(blob)) {
        return CATEGORIES.item_medium;
      }
      return CATEGORIES.item_small;
    }

    // Nature
    if (/tree|pine|oak|fir|birch/.test(blob)) return CATEGORIES.nature_tree;
    if (/bush|plant|flower|grass|weed|mushroom|herb|crop|hay/.test(blob)) {
      return CATEGORIES.nature_bush;
    }
    if (/rock|stone|boulder|cliff|ore-node/.test(blob)) return CATEGORIES.nature_rock;

    // Fence
    if (/fence|post|rail|palisade/.test(blob)) return CATEGORIES.fence;

    // Buildings
    var isEnv = role === "environment" || role === "building" || role === "env";
    if (
      isEnv ||
      /(^|[-_])(inn|house|barn|keep|tower|palace|cathedral|windmill|gate|wall|bridge|shop|church|mill|stable|blacksmith|tavern|hut|cabin|fort|castle|well|market|stall|tent)([-_]|$)/.test(
        slug
      )
    ) {
      if (/(^|[-_])(keep|palace|cathedral|castle|fort|windmill)([-_]|$)/.test(slug)) {
        return CATEGORIES.building_landmark;
      }
      if (/(^|[-_])(tower)([-_]|$)/.test(slug)) return CATEGORIES.building_tower;
      if (/(^|[-_])(wall|gate|bridge)([-_]|$)/.test(slug)) return CATEGORIES.building_wall;
      if (
        /(^|[-_])(inn|shop|barn|house|stable|blacksmith|tavern|hut|cabin|church|mill|well|market)([-_]|$)/.test(
          slug
        )
      ) {
        return CATEGORIES.building_house;
      }
      if (/fence|post|lamp|banner|statue|tent|stall|sign|flag|torch|lantern/.test(blob)) {
        if (/fence|post/.test(blob)) return CATEGORIES.fence;
        if (/statue/.test(blob)) return CATEGORIES.prop_furniture;
        return CATEGORIES.prop_generic;
      }
      if (isEnv) return CATEGORIES.building_generic;
    }

    // Props
    if (role === "props" || role === "prop") {
      if (/crate|barrel|chest|box|cask/.test(blob)) return CATEGORIES.prop_crate;
      if (/table|chair|bench|stool|bed|desk|shelf|cabinet|throne/.test(blob)) {
        return CATEGORIES.prop_furniture;
      }
      return CATEGORIES.prop_generic;
    }

    return CATEGORIES.prop_generic;
  }

  /**
   * Enrich asset record with category + SI targets for games.
   * Does not mutate role/CDN urls — additive fields only.
   */
  function defineAsset(asset) {
    if (!asset) return null;
    var cat = classify(asset);
    var out = Object.assign({}, asset);
    out.category = cat.id;
    out.categoryLabel = cat.label;
    out.categoryGroup = cat.group;
    out.targetHeightM = cat.targetM;
    out.targetM = cat.targetM;
    out.fitAxis = cat.fitAxis;
    out.relativeToCharacter = cat.relativeToChar;
    out.characterHeightM = CHARACTER_HEIGHT_M;
    out.maxDimM = cat.maxDimM;
    out.gameUsage = cat.usage;
    out.siScaleDef = {
      characterYardstickM: CHARACTER_HEIGHT_M,
      humanYardstickM: HUMAN_HEIGHT_M,
      category: cat.id,
      targetM: cat.targetM,
      fitAxis: cat.fitAxis,
      relativeToChar: cat.relativeToChar,
      maxDimM: cat.maxDimM,
      usage: cat.usage,
    };
    return out;
  }

  function enrichCatalog(catalog) {
    if (!catalog || !catalog.assets) return catalog;
    var assets = catalog.assets.map(function (a) {
      return defineAsset(a);
    });
    var byCategory = {};
    var byGroup = {};
    assets.forEach(function (a) {
      if (!a || !a.category) return;
      if (!byCategory[a.category]) byCategory[a.category] = [];
      byCategory[a.category].push(a);
      var g = a.categoryGroup || "props";
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(a);
    });
    return Object.assign({}, catalog, {
      assets: assets,
      byCategory: byCategory,
      byGroup: byGroup,
      scaleSsot: {
        characterHeightM: CHARACTER_HEIGHT_M,
        humanHeightM: HUMAN_HEIGHT_M,
        categories: Object.keys(CATEGORIES),
        note: "All targets relative to 2.0 m TVS character; uniform grow only",
      },
    });
  }

  function listByCategory(catalog, categoryId) {
    if (!catalog) return [];
    var id = String(categoryId || "").toLowerCase();
    if (catalog.byCategory && catalog.byCategory[id]) return catalog.byCategory[id].slice();
    return (catalog.assets || []).filter(function (a) {
      return a && a.category === id;
    });
  }

  function listByGroup(catalog, groupId) {
    if (!catalog) return [];
    var g = String(groupId || "").toLowerCase();
    if (catalog.byGroup && catalog.byGroup[g]) return catalog.byGroup[g].slice();
    return (catalog.assets || []).filter(function (a) {
      return a && a.categoryGroup === g;
    });
  }

  /** Mesh-only rows for a group (skip textures/anims). */
  function listMeshGroup(catalog, groupId, dedupeFn) {
    var rows = listByGroup(catalog, groupId).filter(function (a) {
      if (!a) return false;
      if (a.category === "animation" || a.category === "texture") return false;
      var f = String(a.format || "").toLowerCase();
      if (f === "png" || f === "jpg" || f === "webp" || f === "mtl" || f === "json") return false;
      return true;
    });
    if (typeof dedupeFn === "function") return dedupeFn(rows);
    // Prefer glb
    var best = {};
    var rank = function (a) {
      var f = String((a && a.format) || "").toLowerCase();
      if (f === "glb" || f === "gltf") return 3;
      if (f === "fbx") return 2;
      return 1;
    };
    rows.forEach(function (a) {
      var k = a.slug || a.id;
      if (!k) return;
      if (!best[k] || rank(a) > rank(best[k])) best[k] = a;
    });
    return Object.keys(best)
      .sort()
      .map(function (k) {
        return best[k];
      });
  }

  function scaleOptsForAsset(asset, overrides) {
    var def = defineAsset(asset);
    var o = overrides || {};
    return {
      targetHeight: o.targetHeight != null ? o.targetHeight : def.targetM,
      targetM: o.targetM != null ? o.targetM : def.targetM,
      fitHeight: o.fitHeight !== false && def.targetM > 0,
      fitAxis: o.fitAxis || def.fitAxis || "y",
      maxDimM: o.maxDimM != null ? o.maxDimM : def.maxDimM || 40,
      category: def.category,
      relativeToCharacter: def.relativeToCharacter,
      characterHeightM: CHARACTER_HEIGHT_M,
    };
  }

  /** Matrix for docs / UI */
  function categoryMatrix() {
    return Object.keys(CATEGORIES).map(function (id) {
      var c = CATEGORIES[id];
      return {
        id: c.id,
        label: c.label,
        group: c.group,
        targetM: c.targetM,
        fitAxis: c.fitAxis,
        xCharacter: c.relativeToChar,
        maxDimM: c.maxDimM,
        usage: c.usage,
      };
    });
  }

  var api = {
    CHARACTER_HEIGHT_M: CHARACTER_HEIGHT_M,
    HUMAN_HEIGHT_M: HUMAN_HEIGHT_M,
    CATEGORIES: CATEGORIES,
    GROUPS: GROUPS,
    classify: classify,
    defineAsset: defineAsset,
    enrichCatalog: enrichCatalog,
    listByCategory: listByCategory,
    listByGroup: listByGroup,
    listMeshGroup: listMeshGroup,
    scaleOptsForAsset: scaleOptsForAsset,
    categoryMatrix: categoryMatrix,
    defaultHeightForAsset: function (asset) {
      return defineAsset(asset).targetM;
    },
  };

  global.TvsAssetCategories = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
