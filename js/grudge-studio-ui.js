/**
 * Grudge Main Panel — RTS-Grudge layout + Survival Nexus stats.
 * Left: portrait & combat stats · Center: tab hub · Right: inventory grid.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'voxgrudge_studio_v2';

  var DEFAULT_BINDS = {
    moveForward: 'KeyW', moveBack: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD',
    jumpDodge: 'Space', dash: 'ShiftLeft', attack: 'MouseButton0', parry: 'MouseButton2',
    skill1: 'KeyQ', skill2: 'KeyE', skill3: 'KeyR', skill4: 'KeyF',
    item1: 'Digit1', item2: 'Digit2', item3: 'Digit3', item4: 'Digit4', item5: 'Digit5', item6: 'Digit6',
    build: 'KeyB', craft: 'KeyC', inventory: 'KeyI', equip: 'KeyG', allies: 'KeyT', interact: 'KeyX', mine: 'KeyM',
    commandCenter: 'KeyK',
  };

  var BIND_LABELS = {
    moveForward: 'Move Forward', moveBack: 'Move Back', moveLeft: 'Move Left', moveRight: 'Move Right',
    jumpDodge: 'Jump / Dodge', dash: 'Dash', attack: 'Attack', parry: 'Parry / Block',
    skill1: 'Skill Q', skill2: 'Skill E', skill3: 'Skill R', skill4: 'Skill F',
    item1: 'Hotbar 1', item2: 'Hotbar 2', item3: 'Hotbar 3', item4: 'Hotbar 4', item5: 'Hotbar 5', item6: 'Hotbar 6',
    build: 'Build Mode', craft: 'Craft', inventory: 'Inventory', equip: 'Equipment', allies: 'Allies', interact: 'Interact', mine: 'Mine',
    commandCenter: 'Command Center',
  };

  var EQUIP_SLOTS_LEFT = ['helm', 'shoulder', 'chest', 'legs', 'boots', 'belt'];
  var EQUIP_SLOTS_RIGHT = ['mainHand', 'offHand', 'gloves', 'cape', 'ring', 'necklace'];
  var SLOT_LABELS = {
    helm: 'Helm', shoulder: 'Shoulder', chest: 'Chest', legs: 'Legs', boots: 'Boots', belt: 'Belt',
    mainHand: 'Mainhand', offHand: 'Offhand', gloves: 'Gloves', cape: 'Cape', ring: 'Ring', necklace: 'Necklace',
  };
  var SLOT_ICONS = {
    helm: '⛑️', shoulder: '🦺', chest: '🛡️', legs: '👖', boots: '👢', belt: '⛓️',
    mainHand: '⚔️', offHand: '🛡️', gloves: '🧤', cape: '🧣', ring: '💍', necklace: '📿',
  };

  var MAIN_TABS = [
    { id: 'equipment', label: 'Equipment' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'skills', label: 'Class Skills' },
    { id: 'weapons', label: 'Weapon Skills' },
    { id: 'craft', label: 'Crafting' },
    { id: 'building', label: 'Building' },
    { id: 'bestiary', label: 'Bestiary' },
    { id: 'allies', label: 'Allies' },
    { id: 'hotkeys', label: 'Hotkeys' },
    { id: 'settings', label: 'Settings' },
  ];

  var NEXUS_PERK_TREES = {
    warrior: {
      name: 'Warrior', attrs: 'STR · VIT', icon: '⚔️',
      branches: [
        { id: 'warrior_core', name: 'Frontline', nodes: [
          { id: 'nw_iron', name: 'Iron Stance', desc: 'Block chance scales with missing HP', cost: 1, stat: 'ironStance', add: 1 },
          { id: 'nw_pulv', name: 'Pulverize', desc: 'Heavy hits ignore flat armor', cost: 2, stat: 'pulverize', add: 1, req: 'nw_iron' },
          { id: 'nw_grudge', name: 'Grudge', desc: 'Gateway: first hit crits if they hit you last', cost: 2, stat: 'grudge', add: 1, gateway: true, req: 'nw_pulv' },
          { id: 'nw_bulwark', name: 'Bulwark', desc: '+12% max HP, +5% block factor', cost: 3, stat: 'hpMult', add: 0.12, req: 'nw_grudge' },
        ]},
        { id: 'warrior_flow', name: 'Battle Flow', nodes: [
          { id: 'nw_step', name: 'Quick Step', desc: '-15% dodge cooldown', cost: 1, stat: 'dodgeCdMult', add: -0.15 },
          { id: 'nw_roll', name: 'Combat Roll', desc: 'Roll i-frames +0.1s', cost: 2, stat: 'rollIFrameAdd', add: 0.1, req: 'nw_step' },
        ]},
      ],
    },
    hero: {
      name: 'Hero', attrs: 'TAC · WIS', icon: '🛡️',
      branches: [
        { id: 'hero_captain', name: 'Captain', nodes: [
          { id: 'nh_bearer', name: 'Standard Bearer', desc: 'Allies in range: +accuracy, +crit', cost: 1, stat: 'standardBearer', add: 1 },
          { id: 'nh_surgeon', name: 'Field Surgeon', desc: 'Heals scrub one debuff stack', cost: 2, stat: 'fieldSurgeon', add: 1, req: 'nh_bearer' },
          { id: 'nh_stand', name: 'Last Stand', desc: 'Gateway: ally <20% HP → +attack speed 6s', cost: 2, stat: 'lastStand', add: 1, gateway: true, req: 'nh_surgeon' },
          { id: 'nh_banner', name: 'Banner of Forgotten', desc: '+10% ranged damage aura', cost: 3, stat: 'rangedMult', add: 0.1, req: 'nh_stand' },
        ]},
        { id: 'hero_mobility', name: 'Marksman', nodes: [
          { id: 'nh_aim', name: 'Steady Aim', desc: '+10% ranged damage', cost: 1, stat: 'rangedMult', add: 0.1 },
          { id: 'nh_fleet', name: 'Fleet Foot', desc: '+8% move speed', cost: 2, stat: 'speedMult', add: 0.08, req: 'nh_aim' },
        ]},
      ],
    },
    smarts: {
      name: 'Smarts', attrs: 'INT · WIS', icon: '🔮',
      branches: [
        { id: 'smarts_arcane', name: 'Arcane', nodes: [
          { id: 'ns_conduit', name: 'Conduit', desc: 'Overheal → temp mana shield', cost: 1, stat: 'conduit', add: 1 },
          { id: 'ns_seq', name: 'Sequencer', desc: 'Every 3rd cast: reduced cooldown', cost: 2, stat: 'sequencer', add: 1, req: 'ns_conduit' },
          { id: 'ns_annul', name: 'Annul', desc: 'Gateway: interrupts grant mana + spell immunity', cost: 2, stat: 'annul', add: 1, gateway: true, req: 'ns_seq' },
          { id: 'ns_black', name: 'Black Page', desc: '+12% magic damage, DoT vulnerability', cost: 3, stat: 'magicMult', add: 0.12, req: 'ns_annul' },
        ]},
        { id: 'smarts_frost', name: 'Frost Reach', nodes: [
          { id: 'ns_focus', name: 'Focus', desc: '+10% spell power', cost: 1, stat: 'magicMult', add: 0.1 },
          { id: 'ns_mana', name: 'Mana Well', desc: '-10% skill cooldowns', cost: 2, stat: 'cdr', add: 0.1, req: 'ns_focus' },
        ]},
      ],
    },
    maker: {
      name: 'Maker', attrs: 'END · DEX', icon: '🔧',
      branches: [
        { id: 'maker_craft', name: 'Scrapper', nodes: [
          { id: 'nm_scrap', name: "Scrapper's Eye", desc: 'T3+ salvage yields extra rare component', cost: 1, stat: 'scrappersEye', add: 1 },
          { id: 'nm_repair', name: 'Field Repair', desc: 'Restore 5% durability once per fight', cost: 2, stat: 'fieldRepair', add: 1, req: 'nm_scrap' },
          { id: 'nm_drone', name: 'Drone Pack', desc: 'Gateway: deploy turret-drone', cost: 2, stat: 'dronePack', add: 1, gateway: true, req: 'nm_repair' },
          { id: 'nm_workshop', name: 'Cold Workshop', desc: '+25% harvest yield', cost: 3, stat: 'resourceMult', add: 0.25, req: 'nm_drone' },
        ]},
        { id: 'maker_survival', name: 'Wildcraft', nodes: [
          { id: 'nm_harvest', name: 'Harvest', desc: '+15% resource nodes', cost: 1, stat: 'resourceMult', add: 0.15 },
          { id: 'nm_trap', name: 'Trap Sense', desc: '+20% roll distance', cost: 2, stat: 'rollDistMult', add: 0.2, req: 'nm_harvest' },
        ]},
      ],
    },
  };

  var CLASS_TO_PERK_TREE = {
    swordsman: 'warrior', paladin: 'warrior', archer: 'hero',
    mage: 'smarts', necromancer: 'smarts', druid: 'maker',
  };

  var TIER_COLORS = {
    1: { color: '#b0b0b0', label: 'Common' },
    2: { color: '#4caf50', label: 'Uncommon' },
    3: { color: '#42a5f5', label: 'Rare' },
    4: { color: '#ab47bc', label: 'Elite' },
    5: { color: '#ff9800', label: 'Boss' },
    6: { color: '#ff5722', label: 'Apex' },
    7: { color: '#e91e63', label: 'Mythic' },
  };

  var PASSIVE_LABELS = {
    meleeMult: 'Melee Damage', rangedMult: 'Ranged Damage', magicMult: 'Magic Damage', frostMult: 'Frost Damage',
    aoeMult: 'Skill AoE', executeMult: 'Execute Damage', hpMult: 'Max HP', speedMult: 'Move Speed',
    dodgeCdMult: 'Dodge Cooldown', rollIFrameAdd: 'Roll I-Frames', rollDistMult: 'Roll Distance',
    parryStun: 'Parry Stun', cdr: 'Skill CDR', pierceBonus: 'Arrow Pierce', resourceMult: 'Harvest Yield', minionMax: 'Minion Cap',
  };

  var SECONDARY_STATS = [
    ['maxHP', 'Health', '#e05555', 'int'],
    ['defense', 'Defense', '#f5e2c1', 'int'],
    ['meleeAttack', 'Melee', '#6ec96e', 'int'],
    ['rangedAttack', 'Ranged', '#6ec96e', 'int'],
    ['spellPower', 'Spell', '#6ec96e', 'int'],
    ['critChance', 'Crit %', '#ffaa33', 'pct'],
    ['blockChance', 'Block', '#8899bb', 'pct'],
    ['dodgeChance', 'Dodge', '#55ccaa', 'pct'],
    ['attackSpeed', 'Atk Spd', '#cc88ff', '2dp'],
    ['combatPower', 'Combat Power', '#d4a400', 'int'],
  ];

  var state = {
    binds: Object.assign({}, DEFAULT_BINDS),
    skillPoints: 3,
    unlocked: {},
    settings: { masterVolume: 80, cameraHeight: 1, showDamageNumbers: true, showMinimap: true },
    open: false,
    panel: 'equipment',
    listening: null,
    invSelected: null,
  };

  var initOpts = null;

  function getPerkTreeForClass(classId) {
    var treeId = CLASS_TO_PERK_TREE[classId] || 'warrior';
    return { id: treeId, tree: NEXUS_PERK_TREES[treeId] };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data.binds) state.binds = Object.assign({}, DEFAULT_BINDS, data.binds);
      if (data.unlocked) state.unlocked = data.unlocked;
      if (data.skillPoints != null) state.skillPoints = data.skillPoints;
      if (data.settings) state.settings = Object.assign(state.settings, data.settings);
    } catch (e) { /* ignore */ }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      binds: state.binds,
      unlocked: state.unlocked,
      skillPoints: state.skillPoints,
      settings: state.settings,
    }));
  }

  function codeLabel(code) {
    if (!code) return '—';
    if (code === 'MouseButton0') return 'LMB';
    if (code === 'MouseButton2') return 'RMB';
    return code.replace('Key', '').replace('Digit', '').replace('ShiftLeft', 'Shift');
  }

  function getPassiveBonuses(classId) {
    var pt = getPerkTreeForClass(classId);
    var tree = pt.tree;
    var out = {};
    if (!tree) return out;
    tree.branches.forEach(function (br) {
      br.nodes.forEach(function (n) {
        if (!state.unlocked[n.id]) return;
        if (n.stat === 'ironStance' || n.stat === 'pulverize' || n.stat === 'standardBearer') {
          out[n.stat] = 1;
        } else {
          out[n.stat] = (out[n.stat] || 0) + (n.add || 0);
        }
      });
    });
    return out;
  }

  function canUnlock(classId, node) {
    if (state.unlocked[node.id]) return false;
    if (state.skillPoints < node.cost) return false;
    if (node.req && !state.unlocked[node.req]) return false;
    return true;
  }

  function unlockNode(classId, nodeId) {
    var pt = getPerkTreeForClass(classId);
    var tree = pt.tree;
    if (!tree) return false;
    var node = null;
    tree.branches.forEach(function (br) {
      br.nodes.forEach(function (n) { if (n.id === nodeId) node = n; });
    });
    if (!node || !canUnlock(classId, node)) return false;
    state.unlocked[node.id] = true;
    state.skillPoints -= node.cost;
    save();
    return true;
  }

  function fmtStat(val, fmt) {
    if (val == null) return '—';
    if (fmt === 'pct') return (+val).toFixed(1) + '%';
    if (fmt === '2dp') return (+val).toFixed(2);
    return Math.round(val).toLocaleString();
  }

  function sectionTitle(text) {
    return '<div class="gcc-section-title"><span class="gcc-section-bar"></span>' + text + '</div>';
  }

  function renderLeftSidebar(opts) {
    var el = document.getElementById('gcc-aside-left');
    if (!el || !opts.getPlayerState) return;
    var ps = opts.getPlayerState();
    var cls = ps.classDef || {};
    var ns = ps.nexusStats || {};
    var wpn = opts.getCurrentWeapon ? opts.getCurrentWeapon() : 'sword';
    var guide = (global.NexusStats && NexusStats.STATS_GUIDE_URL) || 'https://survival.grudge-studio.com/stats-guide.html';
    var res = opts.getResources ? opts.getResources() : { wood: 0, stone: 0, ore: 0 };
    var attrRem = opts.getAttributeRemaining ? opts.getAttributeRemaining() : 0;

    el.innerHTML =
      '<div class="gcc-portrait">' +
      '<div class="gcc-portrait-icon">' + (cls.emoji || '⚔️') + '</div>' +
      '<div class="gcc-portrait-name">' + (cls.name || 'Survivor') + '</div>' +
      '<div class="gcc-portrait-sub">Lv ' + (ps.level || 1) + ' · ' + (wpn || 'unarmed') + '</div>' +
      '</div>' +
      '<p class="gcc-nexus-era">Nexus Era · <a href="' + guide + '" target="_blank" rel="noopener">Stats Guide</a></p>' +
      sectionTitle('Combat Stats') +
      '<div class="gcc-stat-list">' +
      SECONDARY_STATS.map(function (row) {
        return '<div class="gcc-stat-row"><span>' + row[1] + '</span><span style="color:' + row[2] + '">' + fmtStat(ns[row[0]], row[3]) + '</span></div>';
      }).join('') +
      '</div>' +
      sectionTitle('Progression') +
      '<div class="gcc-stat-list">' +
      '<div class="gcc-stat-row"><span>HP</span><span>' + Math.round(ps.hp) + ' / ' + Math.round(ps.maxHp) + '</span></div>' +
      '<div class="gcc-stat-row"><span>EXP</span><span>' + (ps.exp || 0).toLocaleString() + ' / ' + (ps.expToNext || 500).toLocaleString() + '</span></div>' +
      '<div class="gcc-stat-row"><span>Skill Pts</span><span class="gcc-accent">' + state.skillPoints + '</span></div>' +
      '<div class="gcc-stat-row"><span>Attr Pts</span><span class="gcc-accent">' + attrRem + '</span></div>' +
      '<div class="gcc-stat-row"><span>Score</span><span>' + (ps.score || 0).toLocaleString() + '</span></div>' +
      '</div>' +
      sectionTitle('Resources') +
      '<div class="gcc-res-row"><span>🪵 ' + res.wood + '</span><span>🪨 ' + res.stone + '</span><span>⚙️ ' + res.ore + '</span></div>';
  }

  function renderRightSidebar(opts) {
    var el = document.getElementById('gcc-aside-right');
    if (!el || !opts.getInventoryGrid) return;
    var grid = opts.getInventoryGrid();
    var sel = state.invSelected;
    var selSlot = sel != null ? grid[sel] : null;

    el.innerHTML =
      '<div class="gcc-inv-header"><h3>Inventory</h3></div>' +
      '<div class="gcc-inv-grid">' + grid.map(function (slot, i) {
        var active = sel === i ? ' sel' : '';
        return '<div class="gcc-inv-slot' + (slot ? ' filled' : '') + active + '" data-idx="' + i + '">' +
          (slot ? '<span class="gcc-inv-icon">' + (slot.icon || '📦') + '</span>' +
            (slot.count > 1 ? '<span class="gcc-inv-count">' + slot.count + '</span>' : '') : '') +
          '</div>';
      }).join('') + '</div>' +
      '<div class="gcc-inv-footer" id="gcc-inv-footer">' +
      (selSlot ? '<div class="gcc-inv-sel-name">' + selSlot.icon + ' ' + (selSlot.name || selSlot.id) + '</div>' +
        '<button type="button" class="gcc-inv-action" id="gcc-inv-action">Use / Equip</button>' : '<p class="gcc-hint">Click slot to select · double-click to use</p>') +
      '</div>';

    el.querySelectorAll('.gcc-inv-slot.filled').forEach(function (node) {
      node.addEventListener('click', function () {
        state.invSelected = +node.dataset.idx;
        renderRightSidebar(opts);
      });
      node.addEventListener('dblclick', function () {
        if (opts.onInvSlot) opts.onInvSlot(+node.dataset.idx);
        renderRightSidebar(opts);
        renderLeftSidebar(opts);
        renderPanel(state.panel, opts);
      });
    });

    var act = document.getElementById('gcc-inv-action');
    if (act) {
      act.addEventListener('click', function () {
        if (opts.onInvSlot && sel != null) opts.onInvSlot(sel);
        renderRightSidebar(opts);
        renderLeftSidebar(opts);
        renderPanel(state.panel, opts);
      });
    }

    if (opts.applyInvIcons) opts.applyInvIcons(el);
  }

  function renderEquipment(opts) {
    var eq = opts.getEquipment ? opts.getEquipment() : {};
    var ps = opts.getPlayerState ? opts.getPlayerState() : {};
    var cls = ps.classDef || {};

    function slotHtml(slot) {
      var e = eq[slot];
      return '<div class="gcc-equip-box' + (e ? ' filled' : '') + '" data-slot="' + slot + '" title="' + SLOT_LABELS[slot] + '">' +
        '<span class="gcc-equip-glyph">' + (e ? (e.icon || '✨') : SLOT_ICONS[slot]) + '</span>' +
        '<span class="gcc-equip-lbl">' + (e ? (e.id || e.name || '') : SLOT_LABELS[slot]) + '</span>' +
        (e && e.def && e.def.tier ? '<span class="gcc-equip-tier">' + e.def.tier + '</span>' : '') +
        '</div>';
    }

    return sectionTitle('Paper Doll') +
      '<div class="gcc-equip-doll">' +
      '<div class="gcc-equip-col">' + EQUIP_SLOTS_LEFT.map(slotHtml).join('') + '</div>' +
      '<div class="gcc-equip-portrait">' +
      '<div class="gcc-equip-portrait-icon">' + (cls.emoji || '⚔️') + '</div>' +
      '<div class="gcc-equip-portrait-class">' + (cls.name || '') + '</div>' +
      '</div>' +
      '<div class="gcc-equip-col">' + EQUIP_SLOTS_RIGHT.map(slotHtml).join('') + '</div>' +
      '</div>' +
      '<p class="gcc-hint">Equip gear from inventory · T1–T6 tiers per Nexus Era</p>';
  }

  function renderAttributes(opts) {
    if (!opts.getAttributes || !global.NexusStats) {
      return '<p class="gcc-hint">Attributes unavailable.</p>';
    }
    var attrs = opts.getAttributes();
    var remaining = opts.getAttributeRemaining ? opts.getAttributeRemaining() : 0;
    var keys = NexusStats.ATTR_KEYS || ['STR', 'VIT', 'END', 'INT', 'WIS', 'DEX', 'AGI', 'TAC'];
    var guide = NexusStats.STATS_GUIDE_URL || 'https://survival.grudge-studio.com/stats-guide.html';

    return '<p class="gcc-nexus-era">8 attributes · 160 pts · <a href="' + guide + '" target="_blank" rel="noopener">Survival math</a></p>' +
      '<div class="gcc-attr-header">' +
      '<span>Points remaining: <strong class="gcc-accent">' + remaining + '</strong> / 160</span>' +
      '<button type="button" class="gcc-btn-sm" id="gcc-attr-reset">Reset Class</button>' +
      '</div>' +
      '<div class="gcc-attr-grid">' + keys.map(function (k) {
        var meta = NexusStats.ATTRIBUTES[k] || { name: k, icon: '◆', color: '#888' };
        var val = attrs[k] || 0;
        return '<div class="gcc-attr-row" data-attr="' + k + '">' +
          '<span class="gcc-attr-icon" style="color:' + meta.color + '">' + meta.icon + '</span>' +
          '<div class="gcc-attr-info"><div class="gcc-attr-name">' + meta.name + '</div><div class="gcc-attr-key">' + k + '</div></div>' +
          '<button type="button" class="gcc-attr-btn" data-dir="-">−</button>' +
          '<span class="gcc-attr-val">' + val + '</span>' +
          '<button type="button" class="gcc-attr-btn" data-dir="+">+</button>' +
          '</div>';
      }).join('') + '</div>';
  }

  function renderSkills(opts) {
    var classId = opts.getPlayerState ? opts.getPlayerState().classId : 'swordsman';
    var pt = getPerkTreeForClass(classId);
    var tree = pt.tree;
    var guide = (global.NexusStats && NexusStats.STATS_GUIDE_URL) || 'https://survival.grudge-studio.com/stats-guide.html';
    return '<p class="gcc-nexus-era">Nexus perk tree · <a href="' + guide + '" target="_blank" rel="noopener">Stats Guide</a></p>' +
      '<p class="gcc-tree-meta">' + (tree.icon || '') + ' <strong>' + tree.name + '</strong> · ' + tree.attrs +
      ' · Points: <strong class="gcc-accent">' + state.skillPoints + '</strong></p>' +
      '<div class="gcc-skill-tree">' + tree.branches.map(function (br) {
        return '<div class="gcc-branch"><h4>' + br.name + '</h4>' + br.nodes.map(function (n) {
          var unlocked = !!state.unlocked[n.id];
          var can = canUnlock(classId, n);
          var gw = n.gateway ? ' <span class="gcc-gateway">gateway</span>' : '';
          return '<div class="gcc-node ' + (unlocked ? 'unlocked' : can ? '' : 'locked') + '" data-nid="' + n.id + '">' +
            '<div class="nd-icon">' + (unlocked ? '✓' : '◇') + '</div>' +
            '<div class="nd-info"><div class="nd-name">' + n.name + gw + ' (' + n.cost + 'pt)</div><div class="nd-desc">' + n.desc + '</div></div></div>';
        }).join('') + '</div>';
      }).join('') + '</div>';
  }

  function renderWeapons(opts) {
    if (!opts.weapons) return '<p class="gcc-hint">No weapons loaded.</p>';
    var cur = opts.getCurrentWeapon ? opts.getCurrentWeapon() : 'sword';
    return sectionTitle('Arsenal') +
      '<div class="gcc-weapon-grid">' + opts.weaponOrder.map(function (wid) {
        var w = opts.weapons[wid];
        if (!w) return '';
        var owned = w.owned;
        var active = wid === cur;
        return '<div class="gcc-wpn' + (owned ? ' owned' : '') + (active ? ' active' : '') + '" data-wid="' + wid + '">' +
          '<div class="wi">' + (w.emoji || '⚔️') + '</div><div class="wn">' + w.name + '</div>' +
          (w.skills ? '<div class="gcc-wpn-skills">' + w.skills.slice(0, 4).map(function (s) { return '<span class="gcc-skill-chip">' + s + '</span>'; }).join('') + '</div>' : '') +
          '</div>';
      }).join('') + '</div>';
  }

  function renderCraft(opts) {
    var preview = opts.craftPreviewUrl ? '<div class="gcc-craft-preview"><canvas id="gcc-craft-canvas" width="160" height="120"></canvas><span>Crafting Station</span></div>' : '';
    return preview +
      '<div class="gcc-craft-embed"><div class="studio-tabs" id="gcc-craft-tabs">' +
      ['consumables', 'explosives', 'gear', 'allies'].map(function (t, i) {
        return '<button class="studio-tab' + (i === 0 ? ' sel' : '') + '" data-tab="' + t + '">' + t + '</button>';
      }).join('') + '</div><div id="gcc-craft-list"></div></div>';
  }

  function fillCraftList(opts, tab) {
    var list = document.getElementById('gcc-craft-list');
    if (!list || !opts.craftRecipes) return;
    var recipes = opts.craftRecipes.filter(function (r) { return r.tab === tab; });
    list.innerHTML = recipes.length ? recipes.map(function (r) {
      var afford = opts.canAfford ? opts.canAfford(r.id) : true;
      return '<div class="craft-row' + (afford ? ' can-afford' : '') + '">' +
        '<div class="craft-icon-wrap">' + (r.emoji || '⚙️') + '</div>' +
        '<div class="craft-info"><div class="craft-name">' + r.name + '</div><div class="craft-cost">' + (r.costLabel || '') + '</div></div>' +
        '<button class="craft-btn" data-rid="' + r.id + '"' + (afford ? '' : ' disabled') + '>Forge</button></div>';
    }).join('') : '<p class="gcc-hint">No recipes in this tab.</p>';
    list.querySelectorAll('.craft-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (opts.onCraft) opts.onCraft(btn.dataset.rid);
        fillCraftList(opts, tab);
        renderLeftSidebar(opts);
      });
    });
    if (opts.applyCraftIcons) opts.applyCraftIcons(list);
  }

  function renderBuilding(opts) {
    var blocks = opts.blockDefs || {};
    var cur = opts.getBuildType ? opts.getBuildType() : 'wood';
    var buildMode = opts.isBuildMode ? opts.isBuildMode() : false;
    return sectionTitle('Survival Structures') +
      '<p class="gcc-hint" style="margin-top:0">Place blocks in build mode [B] · costs from harvested nodes</p>' +
      '<div class="gcc-build-grid">' + Object.keys(blocks).map(function (id) {
        var b = blocks[id];
        var active = cur === id;
        var cost = Object.entries(b.cost || {}).map(function (e) {
          return e[1] + ({ wood: '🪵', stone: '🪨', ore: '⚙️' }[e[0]] || e[0]);
        }).join(' ');
        return '<div class="gcc-build-card' + (active ? ' active' : '') + '" data-bid="' + id + '">' +
          '<div class="gcc-build-swatch" style="background:#' + (b.color || 0xffffff).toString(16).padStart(6, '0') + '"></div>' +
          '<div class="gcc-build-info"><div class="gcc-build-name">' + b.name + '</div>' +
          '<div class="gcc-build-cost">' + cost + '</div>' +
          (b.special ? '<div class="gcc-build-tag">' + b.special + '</div>' : '') +
          '</div></div>';
      }).join('') + '</div>' +
      '<button type="button" class="gcc-btn-primary" id="gcc-toggle-build">' + (buildMode ? 'Exit Build Mode' : 'Enter Build Mode') + '</button>';
  }

  function renderBestiary(opts) {
    var enemies = opts.enemyTypes || {};
    var list = Object.keys(enemies).map(function (id) {
      var e = enemies[id];
      return { id: id, name: e.name, tier: e.tier || 1, hp: e.hp, dmg: e.dmg, speed: e.speed, score: e.score, emoji: e.emoji, beh: e.beh };
    }).sort(function (a, b) { return a.tier - b.tier || a.name.localeCompare(b.name); });

    return sectionTitle('Combat Codex') +
      '<p class="gcc-hint" style="margin-top:0">Enemy tiers by biome distance · Nexus defense applies √ mitigation</p>' +
      '<div class="gcc-bestiary-grid">' + list.map(function (e) {
        var tc = TIER_COLORS[e.tier] || TIER_COLORS[1];
        return '<div class="gcc-bestiary-card" style="border-color:' + tc.color + '40">' +
          '<div class="gcc-bestiary-icon">' + (e.emoji || '👾') + '</div>' +
          '<div class="gcc-bestiary-body">' +
          '<div class="gcc-bestiary-name" style="color:' + tc.color + '">' + e.name + '</div>' +
          '<div class="gcc-bestiary-tier">T' + e.tier + ' · ' + (e.beh || 'chase') + '</div>' +
          '<div class="gcc-bestiary-stats">HP ' + e.hp + ' · DMG ' + e.dmg + ' · SPD ' + e.speed + '</div>' +
          '</div></div>';
      }).join('') + '</div>';
  }

  function renderAllies(opts) {
    var allies = opts.allyDefs || {};
    var active = opts.getMinionCount ? opts.getMinionCount() : 0;
    return sectionTitle('Warband') +
      '<p class="gcc-hint" style="margin-top:0">Active allies: ' + active + ' · Recruit via survivors or craft tab</p>' +
      '<div class="gcc-ally-grid">' + Object.keys(allies).map(function (id) {
        var a = allies[id];
        return '<div class="gcc-ally-card">' +
          '<div class="gcc-ally-icon">' + (a.emoji || '⚔️') + '</div>' +
          '<div class="gcc-ally-name">' + (a.name || id) + '</div>' +
          '<div class="gcc-ally-role">' + (a.role || a.beh || '') + '</div>' +
          '<div class="gcc-ally-stats">HP ' + (a.hp || '—') + ' · DMG ' + (a.dmg || '—') + '</div>' +
          '</div>';
      }).join('') + '</div>';
  }

  function renderHotkeys(opts) {
    return Object.keys(BIND_LABELS).map(function (id) {
      var listening = state.listening === id;
      return '<div class="gcc-bind-row"><label>' + BIND_LABELS[id] + '</label>' +
        '<kbd>' + (listening ? '…' : codeLabel(state.binds[id])) + '</kbd>' +
        '<button type="button" data-bid="' + id + '">' + (listening ? 'Cancel' : 'Bind') + '</button></div>';
    }).join('') + '<p class="gcc-hint">Double-tap W/A/S/D = roll · Space+move = dodge · [K] Main Panel</p>';
  }

  function renderSettings(opts) {
    var s = state.settings;
    return '<div class="gcc-setting-row"><label>Master Volume</label><input type="range" min="0" max="100" value="' + s.masterVolume + '" id="gcc-vol"></div>' +
      '<div class="gcc-setting-row"><label>Camera Height</label><input type="range" min="80" max="120" value="' + Math.round(s.cameraHeight * 100) + '" id="gcc-cam"></div>' +
      '<div class="gcc-setting-row"><label>Damage Numbers</label><input type="checkbox" id="gcc-dmg"' + (s.showDamageNumbers ? ' checked' : '') + '></div>' +
      '<div class="gcc-setting-row"><label>Minimap</label><input type="checkbox" id="gcc-mm"' + (s.showMinimap ? ' checked' : '') + '></div>' +
      '<button class="gcc-btn-sm" style="margin-top:16px" id="gcc-reset-binds">Reset Hotkeys</button>';
  }

  function wirePanelEvents(id, opts) {
    if (id === 'equipment') {
      var root = document.getElementById('gcc-tab-content');
      if (!root) return;
      if (opts.applyEquipIcons) opts.applyEquipIcons(root);
    }
    if (id === 'weapons') {
      var el = document.getElementById('gcc-tab-content');
      if (!el) return;
      el.querySelectorAll('.gcc-wpn.owned').forEach(function (node) {
        node.addEventListener('click', function () {
          if (opts.onWeaponSelect) opts.onWeaponSelect(node.dataset.wid);
          renderPanel('weapons', opts);
          renderLeftSidebar(opts);
        });
      });
      if (opts.applyWeaponIcons) opts.applyWeaponIcons(el);
    }
    if (id === 'skills') {
      var classId = opts.getPlayerState ? opts.getPlayerState().classId : 'swordsman';
      document.querySelectorAll('#gcc-tab-content .gcc-node').forEach(function (node) {
        node.addEventListener('click', function () {
          if (unlockNode(classId, node.dataset.nid)) {
            if (opts.onSkillUnlock) opts.onSkillUnlock(getPassiveBonuses(classId));
            renderPanel('skills', opts);
            renderLeftSidebar(opts);
          }
        });
      });
    }
    if (id === 'craft') {
      fillCraftList(opts, 'consumables');
      document.querySelectorAll('#gcc-craft-tabs .studio-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          document.querySelectorAll('#gcc-craft-tabs .studio-tab').forEach(function (t) { t.classList.remove('sel'); });
          tab.classList.add('sel');
          fillCraftList(opts, tab.dataset.tab);
        });
      });
      if (opts.renderCraftPreview) opts.renderCraftPreview();
    }
    if (id === 'building') {
      document.querySelectorAll('.gcc-build-card').forEach(function (card) {
        card.addEventListener('click', function () {
          if (opts.onSelectBuild) opts.onSelectBuild(card.dataset.bid);
          renderPanel('building', opts);
        });
      });
      var tb = document.getElementById('gcc-toggle-build');
      if (tb) tb.addEventListener('click', function () { if (opts.onToggleBuild) opts.onToggleBuild(); renderPanel('building', opts); });
    }
    if (id === 'attributes') {
      document.querySelectorAll('.gcc-attr-row').forEach(function (row) {
        row.querySelectorAll('.gcc-attr-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (!opts.adjustAttribute) return;
            opts.adjustAttribute(row.dataset.attr, btn.dataset.dir === '+' ? 1 : -1);
            renderPanel('attributes', opts);
            renderLeftSidebar(opts);
          });
        });
      });
      var reset = document.getElementById('gcc-attr-reset');
      if (reset) reset.addEventListener('click', function () {
        if (opts.resetAttributes) opts.resetAttributes();
        renderPanel('attributes', opts);
        renderLeftSidebar(opts);
      });
    }
    if (id === 'hotkeys') {
      document.querySelectorAll('#gcc-tab-content button[data-bid]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.listening = state.listening === btn.dataset.bid ? null : btn.dataset.bid;
          renderPanel('hotkeys', opts);
        });
      });
    }
    if (id === 'settings') {
      var s = state.settings;
      var vol = document.getElementById('gcc-vol');
      var cam = document.getElementById('gcc-cam');
      var dmg = document.getElementById('gcc-dmg');
      var mm = document.getElementById('gcc-mm');
      var rb = document.getElementById('gcc-reset-binds');
      if (vol) vol.oninput = function (e) { s.masterVolume = +e.target.value; save(); };
      if (cam) cam.oninput = function (e) { s.cameraHeight = +e.target.value / 100; save(); if (opts.onSettings) opts.onSettings(s); };
      if (dmg) dmg.onchange = function (e) { s.showDamageNumbers = e.target.checked; save(); };
      if (mm) mm.onchange = function (e) {
        s.showMinimap = e.target.checked; save();
        var minimap = document.getElementById('minimap');
        if (minimap) minimap.style.opacity = e.target.checked ? '1' : '0';
      };
      if (rb) rb.onclick = function () {
        state.binds = Object.assign({}, DEFAULT_BINDS);
        save();
        renderPanel('hotkeys', opts);
        if (opts.onBindsChanged) opts.onBindsChanged(state.binds);
      };
    }
  }

  function renderPanel(id, opts) {
    var el = document.getElementById('gcc-tab-content');
    var titleEl = document.getElementById('gcc-panel-title');
    if (!el) return;
    var tab = MAIN_TABS.find(function (t) { return t.id === id; });
    if (titleEl) titleEl.textContent = tab ? tab.label : id;

    if (id === 'equipment') el.innerHTML = renderEquipment(opts);
    else if (id === 'attributes') el.innerHTML = renderAttributes(opts);
    else if (id === 'skills') el.innerHTML = renderSkills(opts);
    else if (id === 'weapons') el.innerHTML = renderWeapons(opts);
    else if (id === 'craft') el.innerHTML = renderCraft(opts);
    else if (id === 'building') el.innerHTML = renderBuilding(opts);
    else if (id === 'bestiary') el.innerHTML = renderBestiary(opts);
    else if (id === 'allies') el.innerHTML = renderAllies(opts);
    else if (id === 'hotkeys') el.innerHTML = renderHotkeys(opts);
    else if (id === 'settings') el.innerHTML = renderSettings(opts);
    else el.innerHTML = '<p class="gcc-hint">Panel not found.</p>';

    wirePanelEvents(id, opts);
  }

  function renderTabNav() {
    var nav = document.getElementById('gcc-tab-nav');
    if (!nav) return;
    nav.innerHTML = MAIN_TABS.map(function (t) {
      return '<button type="button" class="gcc-tab-btn' + (state.panel === t.id ? ' active' : '') + '" data-panel="' + t.id + '">' + t.label + '</button>';
    }).join('');
    nav.querySelectorAll('.gcc-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.panel = btn.dataset.panel;
        renderTabNav();
        renderPanel(state.panel, initOpts);
      });
    });
  }

  function renderAll(opts) {
    renderLeftSidebar(opts);
    renderRightSidebar(opts);
    renderTabNav();
    renderPanel(state.panel, opts);
  }

  function init(opts) {
    opts = opts || {};
    initOpts = opts;
    load();
    var root = document.getElementById('grudge-command-center');
    if (!root) return;

    var fab = document.getElementById('gcc-fab');
    var closeBtn = root.querySelector('.gcc-close');

    function toggle(open) {
      state.open = open != null ? open : !state.open;
      root.classList.toggle('open', state.open);
      if (state.open) {
        renderAll(opts);
        if (opts.onOpen) opts.onOpen();
      } else if (opts.onClose) opts.onClose();
    }

    function openPanel(id) {
      if (!id) return;
      state.panel = id;
      if (!state.open) toggle(true);
      else renderAll(opts);
    }

    root.querySelector('.gcc-backdrop').addEventListener('click', function () { toggle(false); });
    if (fab) fab.addEventListener('click', function () { toggle(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { toggle(false); });

    global.GrudgeStudioUI = {
      toggle: toggle,
      openPanel: openPanel,
      isOpen: function () { return state.open; },
      getPanel: function () { return state.panel; },
      getBinds: function () { return state.binds; },
      getBind: function (id) { return state.binds[id] || DEFAULT_BINDS[id]; },
      setBind: function (id, code) { state.binds[id] = code; save(); renderPanel('hotkeys', opts); },
      getPassives: getPassiveBonuses,
      unlockNode: unlockNode,
      getSkillPoints: function () { return state.skillPoints; },
      getSettings: function () { return state.settings; },
      setSetting: function (k, v) { state.settings[k] = v; save(); },
      renderAll: function () { if (state.open) renderAll(opts); },
      handleKeyCapture: function (e) {
        if (!state.listening) return false;
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') { state.listening = null; renderPanel('hotkeys', opts); return true; }
        state.binds[state.listening] = e.code;
        state.listening = null;
        save();
        renderPanel('hotkeys', opts);
        if (opts.onBindsChanged) opts.onBindsChanged(state.binds);
        return true;
      },
      matchBind: function (bindId, code) { return state.binds[bindId] === code; },
      getPerkTreeForClass: getPerkTreeForClass,
      MAIN_TABS: MAIN_TABS,
      EQUIP_SLOTS: EQUIP_SLOTS_LEFT.concat(EQUIP_SLOTS_RIGHT),
    };
  }

  global.GrudgeStudioUI = {
    init: init,
    getPassiveBonuses: getPassiveBonuses,
    getPassives: getPassiveBonuses,
    getPerkTreeForClass: getPerkTreeForClass,
    DEFAULT_BINDS: DEFAULT_BINDS,
    NEXUS_PERK_TREES: NEXUS_PERK_TREES,
    MAIN_TABS: MAIN_TABS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
