/**
 * Grudge Nexus Era — canonical stats & 8-step combat pipeline.
 * Source: survival.grudge-studio.com/stats-guide.html + StatsEngine (GrudgeBuilder)
 */
(function (global) {
  'use strict';

  var STATS_GUIDE_URL = 'https://survival.grudge-studio.com/stats-guide.html';
  var NEXUS_ERA = {
    name: 'Nexus Era',
    tagline: 'Earth is poisoned. The colonies watch. What you build, you defend.',
    factions: ['Keepers', 'Tech-Scavengers', 'Hollow Lords', 'Network', 'Forgotten'],
  };

  var ATTRIBUTES = {
    STR: { name: 'Strength', color: '#ef4444', icon: '⚔️' },
    VIT: { name: 'Vitality', color: '#22c55e', icon: '❤️' },
    END: { name: 'Endurance', color: '#14b8a6', icon: '🛡️' },
    INT: { name: 'Intellect', color: '#8b5cf6', icon: '🔮' },
    WIS: { name: 'Wisdom', color: '#3b82f6', icon: '📖' },
    DEX: { name: 'Dexterity', color: '#f97316', icon: '🏹' },
    AGI: { name: 'Agility', color: '#eab308', icon: '💨' },
    TAC: { name: 'Tactics', color: '#ec4899', icon: '🎯' },
  };
  var ATTR_KEYS = ['STR', 'VIT', 'END', 'INT', 'WIS', 'DEX', 'AGI', 'TAC'];

  var GEAR_TIERS = {
    T1: { id: 'T1', name: 'Scrap', affixes: 2, mult: 1.0, color: '#9ca3af', desc: 'Surface salvage — bent rebar, charred plate.' },
    T2: { id: 'T2', name: 'Salvaged', affixes: 3, mult: 1.15, color: '#22c55e', desc: 'Workshop-grade re-shafted gear.' },
    T3: { id: 'T3', name: 'Refined', affixes: 4, mult: 1.35, color: '#3b82f6', desc: 'Faction quartermaster standard-issue.' },
    T4: { id: 'T4', name: 'Forged', affixes: 5, mult: 1.6, color: '#a855f7', desc: 'Master-crafted with guaranteed prefix.' },
    T5: { id: 'T5', name: 'Relic', affixes: 6, mult: 2.0, color: '#f97316', desc: 'Pre-collapse tech — find only.' },
    T6: { id: 'T6', name: 'Ascendant', affixes: 7, mult: 2.5, color: '#ec4899', desc: 'Rift-bound apex gear.' },
  };

  var CLASS_ATTRS = {
    swordsman: { STR: 38, VIT: 28, END: 28, INT: 5, WIS: 10, DEX: 22, AGI: 14, TAC: 15 },
    archer:    { STR: 12, VIT: 16, END: 14, INT: 8, WIS: 14, DEX: 42, AGI: 38, TAC: 16 },
    mage:      { STR: 6, VIT: 14, END: 10, INT: 44, WIS: 32, DEX: 14, AGI: 12, TAC: 18 },
    druid:     { STR: 14, VIT: 22, END: 28, INT: 18, WIS: 26, DEX: 18, AGI: 16, TAC: 18 },
    paladin:   { STR: 32, VIT: 34, END: 30, INT: 10, WIS: 22, DEX: 12, AGI: 10, TAC: 12 },
    necromancer:{ STR: 8, VIT: 18, END: 12, INT: 40, WIS: 28, DEX: 10, AGI: 10, TAC: 24 },
  };

  var CLASS_PERK_TREE = {
    swordsman: 'warrior', archer: 'hero', mage: 'smarts', druid: 'maker',
    paladin: 'warrior', necromancer: 'smarts',
  };

  function effectivePoints(raw) {
    if (raw <= 25) return raw;
    if (raw <= 50) return 25 + (raw - 25) * 0.5;
    return 37.5 + (raw - 50) * 0.25;
  }

  function scaleAttrs(attrs, level) {
    var lv = Math.max(1, level || 1);
    var scale = 0.55 + lv * 0.045;
    var out = {};
    ATTR_KEYS.forEach(function (k) {
      out[k] = Math.max(4, Math.round((attrs[k] || 10) * scale));
    });
    return out;
  }

  function calculateDerivedStats(attrs, level) {
    var e = {};
    ATTR_KEYS.forEach(function (k) { e[k] = effectivePoints(attrs[k] || 0); });
    var lv = Math.max(1, level || 1);
    var s = {};

    s.meleeAttack = Math.floor(lv * 2 + e.STR * 3 + e.DEX * 3 + e.AGI * 3 + e.VIT * 2 + e.TAC * 3 +
      20 * (e.STR * 0.02 + e.DEX * 0.018 + e.AGI * 0.016 + e.VIT * 0.001 + e.TAC * 0.002));
    s.rangedAttack = Math.floor(lv * 2 + e.DEX * 4 + e.AGI * 2 + e.TAC * 1.5);
    s.spellPower = Math.floor(lv * 2 + e.INT * 4 + e.WIS * 2 + 20 * (e.INT * 0.025 + e.WIS * 0.015));
    s.attackSpeed = Math.min(2.5, 1.0 + e.DEX * 0.015 + e.AGI * 0.005);
    s.critChance = Math.min(75, 5 + e.DEX * 0.5 + e.AGI * 0.42 + e.STR * 0.32 + e.TAC * 0.02);
    s.critDamage = 150 + e.STR * 1.1 + e.DEX * 0.2 + 150 * (e.STR * 0.015);
    s.defenseBreak = e.TAC * 0.1 + e.STR * 0.3;

    s.maxHP = Math.floor(100 + lv * 10 + e.STR * 26 + e.VIT * 25 + e.END * 10 + e.WIS * 10 + e.AGI * 2 + e.TAC * 10);
    s.maxMana = Math.floor(50 + lv * 5 + e.INT * 5 + e.VIT * 2 + e.WIS * 20);
    s.maxStamina = Math.floor(100 + e.VIT * 5 + e.END * 1 + e.AGI * 5 + e.TAC * 1);
    s.defense = Math.floor(10 + lv + e.STR * 12 + e.VIT * 12 + e.END * 12 + e.INT * 2 + e.WIS * 2 + e.DEX * 10 + e.AGI * 5 + e.TAC * 5);
    s.magicResist = Math.floor(e.INT * 0.38 + e.VIT * 0.5 + e.END * 0.46 + e.WIS * 0.5 + 10 * (e.INT * 0.17));
    s.blockChance = Math.min(75, e.STR * 0.5 + e.END * 0.11 + e.DEX * 0.41 + e.TAC * 0.27 +
      5 * (e.STR * 0.05 + e.END * 0.735 + e.DEX * 0.01 + e.TAC * 0.008));
    s.blockFactor = Math.min(80, 20 + e.STR * 0.5 + e.VIT * 0.3);
    s.dodgeChance = Math.min(50, e.DEX * 0.125 + e.AGI * 0.225);
    s.critEvasion = Math.min(50, e.AGI * 0.25 + e.WIS * 0.2);

    s.hpRegen = +(1 + e.VIT * 0.06 + e.END * 0.02 + e.STR * 0.02).toFixed(1);
    s.drainHealth = Math.min(50, e.STR * 0.075 + e.VIT * 0.1);
    s.reflectDamage = Math.min(50, e.STR * 0.15 + e.VIT * 0.1);
    s.absorbFactor = Math.min(50, e.VIT * 0.2 + e.END * 0.1);
    s.armorPenetration = Math.min(75, e.TAC * 0.2);
    s.blockPenetration = Math.min(75, e.TAC * 0.175);
    s.accuracy = Math.min(100, e.INT * 0.12 + e.DEX * 0.7 + 50 * (e.INT * 0.338 + e.DEX * 0.015));
    s.cooldownReduction = Math.min(40, e.INT * 0.075 + e.TAC * 0.05 + e.WIS * 0.3);
    s.moveSpeed = +(5 + e.AGI * 0.15).toFixed(2);

    var physDps = s.meleeAttack * (1 + (s.critChance / 100) * (s.critDamage / 100));
    var ehp = s.maxHP * (1 + s.defense / 1000);
    s.combatPower = Math.floor(ehp * 0.4 + physDps * 2.5 + s.moveSpeed * 10);
    return s;
  }

  function tierAffixBonus(tierId) {
    var t = GEAR_TIERS[tierId] || GEAR_TIERS.T1;
    return {
      defense: Math.floor(8 * t.mult),
      meleeAttack: Math.floor(4 * t.mult),
      blockChance: Math.min(12, 2 * t.mult),
      drainHealth: Math.min(8, t.mult),
    };
  }

  function applyEquipment(stats, equipment) {
    if (!equipment) return stats;
    var s = Object.assign({}, stats);
    Object.keys(equipment).forEach(function (slot) {
      var eq = equipment[slot];
      if (!eq || !eq.def) return;
      var tier = eq.def.tier || 'T1';
      var bonus = tierAffixBonus(tier);
      s.defense += bonus.defense + (eq.def.armor || 0) * 2;
      s.meleeAttack += bonus.meleeAttack;
      s.blockChance = Math.min(75, s.blockChance + bonus.blockChance);
      if (eq.def.dmg) s.meleeAttack = Math.floor(s.meleeAttack * eq.def.dmg);
    });
    return s;
  }

  function applyPerkMods(stats, perks, ctx) {
    ctx = ctx || {};
    var s = Object.assign({}, stats);
    if (!perks) return s;

    if (perks.defenseBreak) s.defenseBreak += perks.defenseBreak;
    if (perks.critChance) s.critChance = Math.min(75, s.critChance + perks.critChance);
    if (perks.blockChance) s.blockChance = Math.min(75, s.blockChance + perks.blockChance);
    if (perks.drainHealth) s.drainHealth = Math.min(50, s.drainHealth + perks.drainHealth);
    if (perks.hpMult) s.maxHP = Math.floor(s.maxHP * (1 + perks.hpMult));
    if (perks.meleeMult) s.meleeAttack = Math.floor(s.meleeAttack * (1 + perks.meleeMult));
    if (perks.rangedMult) s.rangedAttack = Math.floor(s.rangedAttack * (1 + perks.rangedMult));
    if (perks.magicMult) s.spellPower = Math.floor(s.spellPower * (1 + perks.magicMult));
    if (perks.cdr) s.cooldownReduction = Math.min(40, s.cooldownReduction + perks.cdr * 100);

    if (perks.ironStance && ctx.hpRatio != null) {
      var missing = 1 - ctx.hpRatio;
      s.blockChance = Math.min(75, s.blockChance + missing * 25);
    }
    if (perks.pulverize) s.defenseBreak += 15;
    if (perks.standardBearer && ctx.alliesNearby) {
      s.critChance = Math.min(75, s.critChance + 5);
      s.accuracy = Math.min(100, s.accuracy + 8);
    }
    return s;
  }

  function enemyAttrsFor(def) {
    var tier = def.tier || 1;
    var beh = def.beh || 'chase';
    var base = 8 + tier * 3;
    var attrs = { STR: base, VIT: base, END: base, INT: base, WIS: base, DEX: base, AGI: base, TAC: base };
    if (beh === 'tank' || beh === 'heavy') { attrs.VIT += tier * 4; attrs.END += tier * 3; attrs.STR += tier * 2; }
    else if (beh === 'spitter' || beh === 'poison') { attrs.INT += tier * 4; attrs.WIS += tier * 2; }
    else if (beh === 'chase' || beh === 'berserker') { attrs.STR += tier * 3; attrs.AGI += tier * 2; }
    else if (beh === 'ghost_leap' || beh === 'swoop') { attrs.AGI += tier * 5; attrs.DEX += tier * 3; }
    else { attrs.DEX += tier * 2; attrs.AGI += tier * 2; }
    if (def.coldUnit) { attrs.VIT += 2; attrs.END += 2; }
    return attrs;
  }

  function buildPlayerCombatant(opts) {
    opts = opts || {};
    var classId = opts.classId || 'swordsman';
    var level = opts.level || 1;
    var rawAttrs = opts.attributes || CLASS_ATTRS[classId] || CLASS_ATTRS.swordsman;
    var base = scaleAttrs(rawAttrs, level);
    var stats = calculateDerivedStats(base, level);
    stats = applyEquipment(stats, opts.equipment);
    stats = applyPerkMods(stats, opts.perks, {
      hpRatio: opts.hpRatio,
      alliesNearby: opts.alliesNearby,
    });
    return {
      id: 'player', classId: classId, level: level, attrs: base, stats: stats,
      perkTree: CLASS_PERK_TREE[classId] || 'warrior',
      fightState: opts.fightState || {},
    };
  }

  function buildEnemyCombatant(def, typeId, entity) {
    var level = Math.max(1, (def.tier || 1) * 2);
    var attrs = enemyAttrsFor(def);
    var stats = calculateDerivedStats(attrs, level);
    stats.meleeAttack = Math.max(stats.meleeAttack, def.dmg || 12);
    stats.maxHP = Math.max(stats.maxHP, def.hp || 100);
    var tierKey = 'T' + Math.min(6, Math.max(1, def.tier || 1));
    var tierMult = (GEAR_TIERS[tierKey] || GEAR_TIERS.T1).mult;
    stats.defense = Math.floor(stats.defense * (0.85 + tierMult * 0.12));
    return {
      id: typeId, name: def.name, level: level, attrs: attrs, stats: stats,
      tier: tierKey, beh: def.beh, fightState: entity && entity.fightState ? entity.fightState : {},
    };
  }

  /**
   * 8-step combat pipeline (survival.grudge-studio.com/stats-guide.html)
   */
  function resolveHit(attacker, defender, opts) {
    opts = opts || {};
    var aStats = attacker.stats || {};
    var dStats = defender.stats || {};
    var isSpell = !!opts.isSpell;

    var baseDmg = opts.baseDamage != null ? opts.baseDamage :
      (isSpell ? aStats.spellPower : (opts.ranged ? aStats.rangedAttack : aStats.meleeAttack));
    baseDmg = Math.max(1, baseDmg);

    var pen = Math.min(75, aStats.armorPenetration || 0);
    var effectiveDefense = Math.max(0, (dStats.defense || 0) * (1 - pen / 100) - (aStats.defenseBreak || 0));
    var mitigation = Math.min(90, Math.sqrt(effectiveDefense));
    var damage = baseDmg * (100 - mitigation) / 100;

    if (opts.variance !== false) {
      damage *= 0.75 + Math.random() * 0.5;
    }

    var blocked = false;
    var blockPen = aStats.blockPenetration || 0;
    var blockBreak = (aStats.defenseBreak || 0) * 0.5;
    var effBlock = Math.max(0, (dStats.blockChance || 0) - blockBreak - blockPen * 0.5);
    if (!opts.ignoreBlock && Math.random() * 100 < effBlock) {
      blocked = true;
      damage *= (1 - (dStats.blockFactor || 20) / 100);
    }

    var critical = false;
    if (!blocked) {
      var effCrit = Math.max(0, (aStats.critChance || 0) - (dStats.critEvasion || 0));
      if (opts.forceCrit || Math.random() * 100 < effCrit) {
        critical = true;
        damage *= (aStats.critDamage || 150) / 100;
      }
    }

    damage = Math.max(1, Math.floor(damage));
    var effects = { healthDrained: 0, reflected: 0, absorbed: 0 };

    if (aStats.drainHealth > 0) {
      effects.healthDrained = Math.floor(damage * Math.min(50, aStats.drainHealth) / 100);
    }
    if (!blocked && dStats.reflectDamage > 0) {
      effects.reflected = Math.floor(damage * Math.min(50, dStats.reflectDamage) / 100);
    }
    if (dStats.absorbFactor > 0) {
      effects.absorbed = Math.floor(damage * Math.min(50, dStats.absorbFactor) / 100);
      damage = Math.max(1, damage - effects.absorbed);
    }

    return { damage: damage, blocked: blocked, critical: critical, effects: effects, baseDmg: baseDmg, mitigation: mitigation };
  }

  global.NexusStats = {
    STATS_GUIDE_URL: STATS_GUIDE_URL,
    NEXUS_ERA: NEXUS_ERA,
    ATTRIBUTES: ATTRIBUTES,
    ATTR_KEYS: ATTR_KEYS,
    GEAR_TIERS: GEAR_TIERS,
    CLASS_ATTRS: CLASS_ATTRS,
    CLASS_PERK_TREE: CLASS_PERK_TREE,
    effectivePoints: effectivePoints,
    calculateDerivedStats: calculateDerivedStats,
    buildPlayerCombatant: buildPlayerCombatant,
    buildEnemyCombatant: buildEnemyCombatant,
    resolveHit: resolveHit,
    applyPerkMods: applyPerkMods,
    tierAffixBonus: tierAffixBonus,
  };
})(typeof window !== 'undefined' ? window : globalThis);
