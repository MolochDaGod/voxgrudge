/**
 * VoxelForge icons — fleet game usage API
 *
 * CDN: https://assets.grudge-studio.com/ui/voxel-icons/
 * Local: ui/voxel-icons/
 *
 * Surfaces: inventory · equipment · vendor · command dock · craft · build · loot
 *
 *   VoxelIcons.commandAction('attack')
 *   VoxelIcons.inventoryIcon('fantasy-epic', 'magma-helm')
 *   VoxelIcons.vendorTab('gear')           // async → icon defs
 *   VoxelIcons.applyToImg(el, 'command-actions/attack')
 *   await VoxelIcons.loadCatalog()
 */
(function (g) {
  'use strict';

  var CDN = 'https://assets.grudge-studio.com';
  var PREFIX = 'ui/voxel-icons';
  var LOCAL_PREFIX = 'ui/voxel-icons';
  var preferLocal = false;
  var catalog = null; // usage-catalog.json
  var loadPromise = null;

  var PACKS = [
    'command-actions',
    'crafting-stations',
    'fantasy-common',
    'fantasy-epic',
    'fantasy-legendary',
    'fantasy-rare',
    'heavy-gear',
    'industrial-gear',
    'mining-blocks',
    'mining-gear',
    'mining-ops',
    'ops-tier-1',
    'ops-tier-2',
    'ops-tier-3',
    'ops-tier-4',
    'ops-tier-5',
    'ops-tier-6',
    'projectiles-fx',
    'tactical-common',
    'tactical-epic',
    'tactical-legendary',
    'tactical-rare',
  ];

  /** Ordered command dock (RTS / action bar) */
  var COMMAND_DOCK = [
    'attack',
    'move',
    'stop',
    'hold',
    'patrol',
    'guard',
    'defend',
    'charge',
    'retreat',
    'ambush',
    'siege',
    'rally',
    'scout',
    'explore',
    'harvest',
    'build',
    'repair',
    'trade',
    'inventory',
    'equip',
    'unequip',
    'loot',
    'disband',
    'rest',
    'pray',
  ];

  function baseUrl() {
    if (preferLocal) {
      var b =
        (g.GrudgeAssets && g.GrudgeAssets.bundleBase && g.GrudgeAssets.bundleBase()) ||
        (g.location && g.location.pathname && g.location.pathname.indexOf('/voxgrudge') >= 0
          ? '/voxgrudge/'
          : '/');
      return (b.endsWith('/') ? b : b + '/') + LOCAL_PREFIX;
    }
    return CDN + '/' + PREFIX;
  }

  function iconUrl(pack, slug) {
    if (!pack) return '';
    // allow "pack/slug" as first arg
    if (!slug && String(pack).indexOf('/') >= 0) {
      var parts = String(pack).split('/');
      pack = parts[0];
      slug = parts.slice(1).join('/');
    }
    slug = String(slug || '');
    if (!slug.endsWith('.png')) slug += '.png';
    return baseUrl() + '/' + pack + '/' + slug;
  }

  function commandAction(slug) {
    return iconUrl('command-actions', slug);
  }

  function inventoryIcon(pack, slug) {
    return iconUrl(pack, slug);
  }

  function resolveCatalogUrl() {
    if (preferLocal) return baseUrl() + '/usage-catalog.json';
    return CDN + '/' + PREFIX + '/usage-catalog.json';
  }

  function loadCatalog(force) {
    if (catalog && !force) return Promise.resolve(catalog);
    if (loadPromise && !force) return loadPromise;
    var urls = [resolveCatalogUrl()];
    if (!preferLocal) {
      var b =
        (g.GrudgeAssets && g.GrudgeAssets.bundleBase && g.GrudgeAssets.bundleBase()) || '';
      urls.push((b.endsWith('/') ? b : b + '/') + LOCAL_PREFIX + '/usage-catalog.json');
      urls.push('/' + LOCAL_PREFIX + '/usage-catalog.json');
    }
    loadPromise = (function tryFetch(i) {
      if (i >= urls.length) {
        return Promise.reject(new Error('VoxelIcons: usage-catalog.json not found'));
      }
      return fetch(urls[i], { cache: 'force-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.json();
        })
        .then(function (j) {
          catalog = j;
          return catalog;
        })
        .catch(function () {
          return tryFetch(i + 1);
        });
    })(0);
    return loadPromise;
  }

  function getById(id) {
    if (!catalog || !catalog.icons) return null;
    for (var i = 0; i < catalog.icons.length; i++) {
      if (catalog.icons[i].id === id) return catalog.icons[i];
    }
    return null;
  }

  function listByUse(use) {
    if (!catalog || !catalog.byUse) return [];
    var ids = catalog.byUse[use] || [];
    return ids.map(getById).filter(Boolean);
  }

  function listBySurface(surface) {
    if (!catalog || !catalog.bySurface) return [];
    var ids = catalog.bySurface[surface] || [];
    return ids.map(getById).filter(Boolean);
  }

  function vendorTab(tab) {
    return loadCatalog().then(function () {
      if (!catalog.byVendorTab) return [];
      var ids = catalog.byVendorTab[tab] || [];
      return ids.map(getById).filter(Boolean);
    });
  }

  function inventoryItems(filter) {
    return loadCatalog().then(function () {
      var list = listByUse('inventory');
      if (!filter) return list;
      return list.filter(function (ic) {
        if (filter.pack && ic.pack !== filter.pack) return false;
        if (filter.equipable != null && ic.equipable !== filter.equipable) return false;
        if (filter.stackable != null && ic.stackable !== filter.stackable) return false;
        if (filter.slot && ic.equipSlot !== filter.slot) return false;
        if (filter.tier && ic.tier !== filter.tier) return false;
        if (filter.use && ic.uses.indexOf(filter.use) < 0) return false;
        return true;
      });
    });
  }

  function equipSlotIcons(slot) {
    return loadCatalog().then(function () {
      if (!catalog.byEquipSlot) return [];
      return (catalog.byEquipSlot[slot] || []).map(getById).filter(Boolean);
    });
  }

  function commandDock() {
    return COMMAND_DOCK.map(function (slug) {
      var id = 'command-actions/' + slug;
      var def = catalog ? getById(id) : null;
      return {
        id: id,
        slug: slug,
        name: def ? def.name : slug,
        url: commandAction(slug),
        blurb: def ? def.blurb : '',
        uses: def ? def.uses : ['command', 'action_bar'],
      };
    });
  }

  /**
   * Build a bag item payload for inventory systems.
   * { id, name, icon, qty, maxStack, equipable, equipSlot, vendorBuy, vendorSell, uses }
   */
  function asInventoryItem(packOrId, slug, qty) {
    var id = slug ? packOrId + '/' + slug : packOrId;
    var parts = id.split('/');
    var pack = parts[0];
    var s = parts[1];
    var def = catalog ? getById(id) : null;
    return {
      id: id,
      name: def ? def.name : s,
      icon: iconUrl(pack, s),
      qty: qty != null ? qty : 1,
      maxStack: def ? def.maxStack : 1,
      stackable: def ? !!def.stackable : false,
      equipable: def ? !!def.equipable : false,
      equipSlot: def ? def.equipSlot : null,
      vendorBuy: def ? def.vendorBuy : 0,
      vendorSell: def ? def.vendorSell : 0,
      uses: def ? def.uses : ['inventory'],
      category: def ? def.category : '',
      tier: def ? def.tier : null,
      blurb: def ? def.blurb : '',
    };
  }

  /**
   * Vendor shop rows for a tab: gear | goods | stations | combat | build | general
   */
  function asVendorStock(tab, limit) {
    return vendorTab(tab || 'goods').then(function (list) {
      var n = limit != null ? limit : list.length;
      return list.slice(0, n).map(function (ic) {
        return {
          id: ic.id,
          name: ic.name,
          icon: ic.url || iconUrl(ic.pack, ic.slug),
          buy: ic.vendorBuy || 0,
          sell: ic.vendorSell || 0,
          stackable: !!ic.stackable,
          maxStack: ic.maxStack || 1,
          equipable: !!ic.equipable,
          equipSlot: ic.equipSlot,
          blurb: ic.blurb || ic.use || '',
          tabs: ic.vendorTabs || [tab],
        };
      });
    });
  }

  function applyToImg(el, packOrId, slug) {
    if (!el) return null;
    var url = slug ? iconUrl(packOrId, slug) : iconUrl(packOrId);
    if (el.tagName === 'IMG') {
      el.src = url;
      el.loading = el.loading || 'lazy';
      el.decoding = 'async';
      el.alt = el.alt || String(packOrId);
    } else {
      el.style.backgroundImage = 'url("' + url + '")';
      el.style.backgroundSize = el.style.backgroundSize || 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
    }
    el.setAttribute('data-voxel-icon', slug ? packOrId + '/' + slug : packOrId);
    return el;
  }

  /** Fill a container with command dock buttons (HTML string or DOM append) */
  function renderCommandDock(container, onClick) {
    if (!container) return;
    container.innerHTML = '';
    commandDock().forEach(function (cmd) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'voxel-icon-cmd';
      btn.title = cmd.name + (cmd.blurb ? ' — ' + cmd.blurb : '');
      btn.setAttribute('data-cmd', cmd.slug);
      btn.setAttribute('aria-label', cmd.name);
      var img = document.createElement('img');
      img.src = cmd.url;
      img.alt = '';
      img.width = 40;
      img.height = 40;
      img.draggable = false;
      btn.appendChild(img);
      if (typeof onClick === 'function') {
        btn.addEventListener('click', function (e) {
          onClick(cmd, e);
        });
      }
      container.appendChild(btn);
    });
  }

  /** Inventory slot HTML helper */
  function renderInventorySlot(container, item, opts) {
    opts = opts || {};
    if (!container || !item) return;
    var cell = document.createElement('div');
    cell.className = 'voxel-inv-slot' + (item.equipable ? ' equipable' : '');
    cell.title = item.name + (item.blurb ? '\n' + item.blurb : '');
    cell.setAttribute('data-item-id', item.id);
    var img = document.createElement('img');
    img.src = item.icon;
    img.alt = item.name;
    img.width = opts.size || 48;
    img.height = opts.size || 48;
    cell.appendChild(img);
    if (item.qty > 1 || item.stackable) {
      var q = document.createElement('span');
      q.className = 'voxel-inv-qty';
      q.textContent = String(item.qty || 1);
      cell.appendChild(q);
    }
    container.appendChild(cell);
    return cell;
  }

  function setPreferLocal(on) {
    preferLocal = !!on;
  }

  g.VoxelIcons = {
    CDN: CDN,
    PREFIX: PREFIX,
    LOCAL_PREFIX: LOCAL_PREFIX,
    packs: PACKS,
    COMMAND_DOCK: COMMAND_DOCK,
    catalogUrl: CDN + '/' + PREFIX + '/usage-catalog.json',
    usageCatalogUrl: CDN + '/' + PREFIX + '/usage-catalog.json',
    setPreferLocal: setPreferLocal,
    iconUrl: iconUrl,
    commandAction: commandAction,
    inventoryIcon: inventoryIcon,
    loadCatalog: loadCatalog,
    getById: getById,
    listByUse: listByUse,
    listBySurface: listBySurface,
    vendorTab: vendorTab,
    inventoryItems: inventoryItems,
    equipSlotIcons: equipSlotIcons,
    commandDock: commandDock,
    asInventoryItem: asInventoryItem,
    asVendorStock: asVendorStock,
    applyToImg: applyToImg,
    renderCommandDock: renderCommandDock,
    renderInventorySlot: renderInventorySlot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
