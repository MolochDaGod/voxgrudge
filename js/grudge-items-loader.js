/**
 * Load Grudge Warlords item definitions — local JSON + optional API merge.
 */
(function (global) {
  async function loadGrudgeItems(baseItemDefs, hudIconUrl) {
    const merged = { ...baseItemDefs };
    let manifest = null;
    try {
      const res = await fetch('data/grudge-items.json');
      if (res.ok) manifest = await res.json();
    } catch (_) {}

    if (manifest && manifest.items) {
      manifest.items.forEach(it => {
        const icon = it.hudPack && it.hudNum && hudIconUrl
          ? null
          : it.icon;
        merged[it.id] = {
          name: it.name,
          icon: it.icon,
          color: it.color || 0xaa8844,
          effect: it.effect,
          healAmt: it.healAmt,
          duration: it.duration,
          mult: it.mult,
          slot: it.slot,
          armor: it.armor,
          speed: it.speed,
          dmg: it.dmg,
          sellValue: it.sellValue,
          grudgeType: it.type,
          hudPack: it.hudPack,
          hudNum: it.hudNum,
        };
      });
    }

    try {
      const apiRes = await fetch('https://api.grudge-studio.com/api/game/items?tier=0', { mode: 'cors' });
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        const list = Array.isArray(apiData) ? apiData : (apiData.items || []);
        list.forEach(it => {
          if (!it.id || merged[it.id]) return;
          merged[it.id] = {
            name: it.name || it.id,
            icon: it.icon || '📦',
            color: 0x888899,
            effect: mapApiEffect(it),
            grudgeType: it.type,
            sellValue: it.sellValue || 1,
          };
        });
      }
    } catch (_) {}

    return { items: merged, chestLoot: manifest ? manifest.chestLoot : {} };
  }

  function mapApiEffect(it) {
    const e = (it.effect || '').toLowerCase();
    if (e.includes('heal') || e.includes('hp')) return 'heal';
    if (e.includes('mana')) return 'speed';
    if (e.includes('speed')) return 'speed';
    if (it.type === 'equipment' || it.type === 'weapon') return 'equip';
    return it.effect || 'material';
  }

  function rollChestLoot(chestLoot, tier, rand) {
    const pool = chestLoot[String(tier)] || chestLoot['1'] || [];
    if (!pool.length) return null;
    return pool[Math.floor(rand() * pool.length)];
  }

  global.GrudgeItems = { loadGrudgeItems, rollChestLoot };
})(typeof window !== 'undefined' ? window : globalThis);