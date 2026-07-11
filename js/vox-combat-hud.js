/**
 * VoxGrudge combat HUD — action bar (6+6), unit frames, overhead HP bars.
 * Hooks globals from grudge-warlords-openworld.html (hp, enemies, minions, camera…).
 */
(function (global) {
  'use strict';

  var combatTarget = null;
  var ohPool = [];
  var _v = null;
  var _tmp = null;

  function el(id) {
    return document.getElementById(id);
  }

  function ensureVec() {
    if (!_v && global.THREE) {
      _v = new THREE.Vector3();
      _tmp = new THREE.Vector3();
    }
  }

  function init() {
    var hud = el('game-hud');
    if (hud) hud.classList.add('combat-hud-live');
    ensureVec();
    wireClicks();
    refreshParty();
    updatePlayerFrame();
    clearTarget();
  }

  function wireClicks() {
    ['q', 'e', 'r', 'f', 'v', 'z'].forEach(function (s, i) {
      var node = el('skill-' + s);
      if (!node || node.dataset.combatWired) return;
      node.dataset.combatWired = '1';
      node.addEventListener('mousedown', function (e) {
        e.stopPropagation();
      });
      node.addEventListener('click', function (e) {
        e.stopPropagation();
        if (i < 4 && typeof global.activateSkill === 'function') global.activateSkill(i);
        else if (i === 4 && typeof global.tryDash === 'function') global.tryDash();
        else if (i === 5) {
          global.isBlocking = true;
          setTimeout(function () {
            global.isBlocking = false;
          }, 400);
        }
      });
    });
    for (var i = 1; i <= 6; i++) {
      (function (idx) {
        var node = el('isl-' + idx);
        if (!node || node.dataset.combatWired) return;
        node.dataset.combatWired = '1';
        node.addEventListener('mousedown', function (e) {
          e.stopPropagation();
        });
        node.addEventListener('click', function (e) {
          e.stopPropagation();
          if (typeof global.useItem === 'function') global.useItem(idx - 1);
        });
      })(i);
    }
  }

  function setBar(fillEl, textEl, cur, max) {
    max = max || 1;
    var pct = Math.max(0, Math.min(100, (cur / max) * 100));
    if (fillEl) {
      if (fillEl.tagName === 'I' && fillEl.parentElement && fillEl.parentElement.classList.contains('ab-globe-fill')) {
        fillEl.style.height = pct + '%';
      } else {
        fillEl.style.width = pct + '%';
      }
    }
    if (textEl) textEl.textContent = Math.ceil(cur) + '/' + Math.ceil(max);
  }

  function updatePlayerFrame() {
    var hp = global.hp;
    var maxHp = global.maxHp || 1;
    var energy = global.cubeEnergy || 0;
    var maxEnergy = global.maxCubeEnergy || 100;
    var level = global.level || 1;
    var cls = global.CLASSES && global.playerClass ? global.CLASSES[global.playerClass] : null;
    var name = cls && cls.name ? cls.name.toUpperCase() : 'WARLORD';

    setBar(el('uf-player-hp'), el('uf-player-hp-text'), hp, maxHp);
    setBar(el('uf-player-mp'), el('uf-player-mp-text'), energy, maxEnergy);
    setBar(el('ab-hp-fill'), null, hp, maxHp);
    setBar(el('ab-mp-fill'), null, energy, maxEnergy);
    if (el('ab-hp-val')) el('ab-hp-val').textContent = Math.ceil(hp);
    if (el('ab-mp-val')) el('ab-mp-val').textContent = Math.ceil(energy);
    if (el('uf-player-name')) el('uf-player-name').textContent = name;
    if (el('uf-player-level')) el('uf-player-level').textContent = String(level);
    if (el('uf-player-avatar') && cls && cls.emoji) {
      var av = el('uf-player-avatar');
      if (!av.querySelector('img')) av.textContent = cls.emoji;
    }

    var exp = global.exp || 0;
    var expToNext = global.expToNext || 1;
    var xpPct = Math.max(0, Math.min(100, (exp / expToNext) * 100));
    if (el('ab-xp-fill')) el('ab-xp-fill').style.width = xpPct + '%';
    if (el('ab-xp-label')) el('ab-xp-label').textContent = 'Lv.' + level + ' · ' + exp + '/' + expToNext;

    // Utility slots CD visual (dash / block)
    var dashCd = global.dashCd || 0;
    var DASH_CD = global.DASH_CD || 1.5;
    var sv = el('skill-v');
    var svCd = el('sv-cd');
    if (sv) {
      if (dashCd > 0) {
        sv.classList.add('on-cd');
        sv.classList.remove('off-cd');
        if (svCd) {
          svCd.classList.remove('hidden');
          svCd.textContent = Math.ceil(dashCd);
        }
      } else {
        sv.classList.remove('on-cd');
        sv.classList.add('off-cd');
        if (svCd) svCd.classList.add('hidden');
      }
    }
    var sz = el('skill-z');
    if (sz) {
      if (global.isBlocking) sz.classList.add('on-cd');
      else {
        sz.classList.remove('on-cd');
        sz.classList.add('off-cd');
      }
    }
  }

  function clearTarget() {
    combatTarget = null;
    var box = el('uf-target');
    if (box) box.classList.add('hidden');
  }

  function setTarget(ent) {
    if (!ent || !ent.alive) {
      clearTarget();
      return;
    }
    combatTarget = ent;
    var box = el('uf-target');
    if (box) {
      box.classList.remove('hidden');
      box.classList.add('is-hostile');
    }
    updateTargetFrame();
  }

  function updateTargetFrame() {
    var t = combatTarget;
    if (!t || t.alive === false) {
      clearTarget();
      return;
    }
    var name = t.name || t.typeId || t.kind || 'Enemy';
    if (el('uf-target-name')) el('uf-target-name').textContent = String(name).toUpperCase();
    setBar(el('uf-target-hp'), el('uf-target-hp-text'), t.hp || 0, t.maxHp || 1);
    if (el('uf-target-mp')) el('uf-target-mp').style.width = '0%';
    if (el('uf-target-mp-text')) el('uf-target-mp-text').textContent = '';
    if (el('uf-target-level')) el('uf-target-level').textContent = String(t.tier || t.level || '!');
    if (el('uf-target-avatar')) el('uf-target-avatar').textContent = t.emoji || '💀';
  }

  function cycleTarget() {
    var list = (global.enemies || []).filter(function (e) {
      return e && e.alive && e.mesh;
    });
    if (!list.length) {
      clearTarget();
      return;
    }
    var pp = global.playerMesh && global.playerMesh.position;
    list.sort(function (a, b) {
      if (!pp) return 0;
      return a.mesh.position.distanceTo(pp) - b.mesh.position.distanceTo(pp);
    });
    var idx = 0;
    if (combatTarget) {
      var cur = list.indexOf(combatTarget);
      idx = cur >= 0 ? (cur + 1) % list.length : 0;
    }
    setTarget(list[idx]);
  }

  function tryPickTargetFromClick() {
    if (!global.raycaster || !global.mouse || !global.camera || !global.THREE) return false;
    var meshes = [];
    (global.enemies || []).forEach(function (e) {
      if (e && e.alive && e.mesh) meshes.push(e.mesh);
    });
    if (!meshes.length) return false;
    global.raycaster.setFromCamera(global.mouse, global.camera);
    var hits = global.raycaster.intersectObjects(meshes, true);
    if (!hits.length) return false;
    var obj = hits[0].object;
    while (obj && !meshes.includes(obj)) obj = obj.parent;
    var ent = (global.enemies || []).find(function (e) {
      return e.mesh === obj || (e.mesh && e.mesh.children && e.mesh.getObjectById && obj && e.mesh.getObjectById(obj.id));
    });
    // Fallback: walk up and match root mesh
    if (!ent) {
      var root = hits[0].object;
      while (root.parent && root.parent.type !== 'Scene') root = root.parent;
      ent = (global.enemies || []).find(function (e) {
        return e.mesh === root || (e.mesh && e.mesh.uuid === root.uuid);
      });
      if (!ent) {
        ent = (global.enemies || []).find(function (e) {
          var found = false;
          if (!e.mesh) return false;
          e.mesh.traverse(function (c) {
            if (c === hits[0].object) found = true;
          });
          return found;
        });
      }
    }
    if (ent) {
      setTarget(ent);
      return true;
    }
    return false;
  }

  function refreshParty() {
    var root = el('uf-party');
    if (!root) return;
    root.innerHTML = '';
    var minions = global.minions || [];
    if (!minions.length) {
      var empty = document.createElement('div');
      empty.className = 'uf-party-empty';
      empty.textContent = 'No allies · [T] summon';
      root.appendChild(empty);
      return;
    }
    minions.forEach(function (m, i) {
      if (!m) return;
      var card = document.createElement('div');
      card.className = 'uf-party-card';
      var pct = Math.max(0, Math.min(100, ((m.hp || 0) / (m.maxHp || 1)) * 100));
      card.innerHTML =
        '<div class="uf-avatar">' +
        (m.emoji || '🛡') +
        '</div><div class="uf-party-meta"><div class="uf-name">' +
        (m.name || 'Ally') +
        '</div><div class="uf-bar uf-bar--hp"><i style="width:' +
        pct +
        '%"></i></div></div>';
      card.onclick = function () {
        if (m.mesh && global.camera) global.camera.lookAt(m.mesh.position);
      };
      root.appendChild(card);
    });
  }

  function acquireOh(i) {
    while (ohPool.length <= i) {
      var d = document.createElement('div');
      d.className = 'oh-bar';
      d.innerHTML = '<span class="oh-name"></span><i></i>';
      d.style.display = 'none';
      var root = el('overhead-bars');
      if (root) root.appendChild(d);
      ohPool.push(d);
    }
    return ohPool[i];
  }

  function updateOverheadBars() {
    ensureVec();
    var cam = global.camera;
    var root = el('overhead-bars');
    if (!cam || !root || !_v) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var idx = 0;

    function place(ent, isAlly, isElite) {
      if (!ent || !ent.mesh || ent.alive === false) return;
      var mesh = ent.mesh;
      _v.set(0, 0, 0);
      try {
        var box = new THREE.Box3().setFromObject(mesh);
        if (isFinite(box.max.y)) _v.set((box.min.x + box.max.x) / 2, box.max.y + 0.25, (box.min.z + box.max.z) / 2);
        else mesh.getWorldPosition(_v);
      } catch (err) {
        mesh.getWorldPosition(_v);
      }
      _v.project(cam);
      if (_v.z > 1 || _v.z < -1) return;
      var x = (_v.x * 0.5 + 0.5) * w;
      var y = (-_v.y * 0.5 + 0.5) * h;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) return;

      var bar = acquireOh(idx++);
      bar.style.display = 'block';
      bar.style.left = x + 'px';
      bar.style.top = y + 'px';
      bar.className = 'oh-bar' + (isAlly ? ' oh-ally' : '') + (isElite ? ' oh-elite' : '') + (ent === combatTarget ? ' oh-target' : '');
      var pct = Math.max(0, Math.min(100, ((ent.hp || 0) / (ent.maxHp || 1)) * 100));
      var fill = bar.querySelector('i');
      if (fill) fill.style.width = pct + '%';
      var nm = bar.querySelector('.oh-name');
      if (nm) {
        var showName = isElite || ent === combatTarget || isAlly;
        nm.textContent = showName ? ent.name || ent.typeId || ent.kind || '' : '';
        nm.style.display = showName && nm.textContent ? 'block' : 'none';
      }
    }

    (global.enemies || []).forEach(function (e) {
      if (!e || !e.alive) return;
      var dist = 999;
      if (global.playerMesh) dist = e.mesh.position.distanceTo(global.playerMesh.position);
      if (dist > 55 && e !== combatTarget) return;
      place(e, false, !!(e.isRaid || e.tier >= 5 || e.isBoss));
    });
    (global.minions || []).forEach(function (m) {
      if (!m || !m.mesh) return;
      if (m.hp != null && m.hp <= 0) return;
      place(m, true, false);
    });

    for (var j = idx; j < ohPool.length; j++) ohPool[j].style.display = 'none';
  }

  function tick() {
    updatePlayerFrame();
    updateTargetFrame();
    if (combatTarget && combatTarget.alive === false) clearTarget();
    // party bars refresh every tick is cheap for few allies
    var party = el('uf-party');
    if (party && (global.minions || []).length) {
      var cards = party.querySelectorAll('.uf-party-card');
      (global.minions || []).forEach(function (m, i) {
        var card = cards[i];
        if (!card || !m) return;
        var fill = card.querySelector('.uf-bar--hp i');
        if (fill) fill.style.width = Math.max(0, Math.min(100, ((m.hp || 0) / (m.maxHp || 1)) * 100)) + '%';
      });
    }
    updateOverheadBars();
  }

  global.VoxCombatHud = {
    init: init,
    tick: tick,
    setTarget: setTarget,
    clearTarget: clearTarget,
    cycleTarget: cycleTarget,
    tryPickTargetFromClick: tryPickTargetFromClick,
    refreshParty: refreshParty,
    getTarget: function () {
      return combatTarget;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
