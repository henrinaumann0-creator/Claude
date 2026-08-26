/* ============================================================
   Claude Pets – Dashboard-Logik
   ============================================================ */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const P = window.Progression;

  let snap = null;
  let filter = 'all';

  /* ---------------------------------------------------------
     Hilfen
     --------------------------------------------------------- */
  function art(reward, opts = {}) {
    const eq = snap.state.equipped;
    if (reward.type === 'pet') {
      return PetArt.build({ pet: reward.id, palette: eq.palette, static: true });
    }
    if (reward.type === 'palette') {
      const c = PetArt.colorsOf(reward.id);
      return `<i class="swatch" style="background:linear-gradient(135deg, ${c[3]}, ${c[2]} 45%, ${c[4]})"></i>`;
    }
    if (reward.type === 'accessory') {
      return PetArt.build({ pet: eq.pet || 'nova', palette: eq.palette, accessory: reward.id, static: true });
    }
    return `<span>${P.TYPE_META[reward.type].icon}</span>`;
  }

  let snackTimer = null;
  function snack(text) {
    const s = $('snack');
    s.textContent = text;
    s.hidden = false;
    s.classList.remove('is-leaving');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => {
      s.classList.add('is-leaving');
      setTimeout(() => { s.hidden = true; }, 260);
    }, 2600);
  }

  function fmt(n) { return new Intl.NumberFormat('de-DE').format(Math.round(n)); }

  /* ---------------------------------------------------------
     Navigation
     --------------------------------------------------------- */
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('is-active', b === btn));
      const target = btn.dataset.view;
      document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === target));
      if (target === 'rewards') markRewardsSeen();
    });
  });

  /* ---------------------------------------------------------
     Übersicht
     --------------------------------------------------------- */
  function renderHome() {
    $('headName').textContent = snap.state.petName;
    $('streakVal').textContent = snap.state.streak || 0;

    if (document.activeElement !== $('petName')) $('petName').value = snap.state.petName;
    $('lvlNum').textContent = snap.level;
    $('sideLevel').textContent = snap.level;

    const label = snap.isMax ? 'Maximales Level erreicht' : `${fmt(snap.xpInLevel)} / ${fmt(snap.xpForNext)} XP`;
    $('xpLabel').textContent = label;
    $('sideXp').textContent = label;
    $('xpPct').textContent = Math.round(snap.progress * 100) + ' %';
    $('xpBar').style.width = (snap.progress * 100) + '%';
    $('sideBar').style.width = (snap.progress * 100) + '%';

    const next = snap.nextReward;
    $('nextHint').textContent = next
      ? `Nächste Belohnung bei Level ${next.level}: ${next.name} (${P.TYPE_META[next.type].label})`
      : 'Du hast alles freigeschaltet. Beeindruckend.';

    $('hungerVal').textContent = snap.hunger + ' %';
    $('hungerBar').style.width = snap.hunger + '%';
    $('totalXp').textContent = fmt(snap.totalXp);

    $('heroPet').innerHTML = PetArt.build({
      pet: snap.state.equipped.pet,
      palette: snap.state.equipped.palette,
      accessory: snap.state.equipped.accessory,
      static: true
    });

    $('btnFeed').disabled = !snap.canFeed;
    $('btnFeed').title = snap.canFeed ? '' : 'Dein Pet ist noch satt.';
    $('btnPlay').disabled = !snap.canPlay;
    $('btnPlay').title = snap.canPlay ? '' : `Wieder bereit in ${Math.ceil(snap.playReadyIn / 60000)} Min.`;

    const unlockedCount = snap.unlockedIds.length;
    $('homeCards').innerHTML = [
      card('Freigeschaltet', `${unlockedCount} / ${P.REWARDS.length}`, 'Belohnungen insgesamt'),
      card('Streicheleinheiten', fmt(snap.state.stats.pets), 'seit dem ersten Tag'),
      card('Spaziergänge', fmt(snap.state.stats.walks), 'quer über den Bildschirm'),
      card('Gemeinsame Zeit', `${fmt(snap.state.stats.minutes)} Min.`, 'passiv gesammelt'),
      card('Beste Serie', `${snap.state.bestStreak || 0} Tage`, 'am Stück besucht'),
      card('Level-Ups', fmt(snap.state.stats.levelUps || 0), 'bisher gefeiert')
    ].join('');

    $('toggleVisible').textContent = snap.state.settings.visible ? 'Pet verstecken' : 'Pet anzeigen';

    const unseen = snap.unlockedIds.filter((id) => !(snap.state.seenRewards || []).includes(id)).length;
    $('navBadge').hidden = unseen === 0;
    $('navBadge').textContent = unseen;
  }

  function card(label, value, note) {
    return `<div class="card">
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
      <div class="card-note">${note}</div>
    </div>`;
  }

  /* ---------------------------------------------------------
     Belohnungs-Roadmap
     --------------------------------------------------------- */
  function renderRoad() {
    const list = P.REWARDS
      .filter((r) => filter === 'all' || r.type === filter)
      .sort((a, b) => a.level - b.level || a.type.localeCompare(b.type));

    const road = $('road');
    const total = P.MAX_LEVEL;
    road.style.setProperty('--done', Math.min(100, (snap.level / total) * 100) + '%');

    road.innerHTML = list.map((r, i) => {
      const unlocked = r.level <= snap.level;
      const isNext = snap.nextReward && snap.nextReward.id === r.id;
      const equippable = ['pet', 'palette', 'accessory', 'effect'].includes(r.type);
      const slot = r.type === 'accessory' ? 'accessory' : r.type;
      const active = unlocked && equippable && snap.state.equipped[slot] === r.id;

      return `<div class="road-item ${unlocked ? 'is-unlocked' : 'is-locked'} ${isNext ? 'is-next' : ''}"
                   style="animation-delay:${Math.min(i * 22, 420)}ms">
        <div class="road-art">${art(r)}</div>
        <div class="road-main">
          <strong>${r.name}${r.sub ? ` <span class="muted">· ${r.sub}</span>` : ''}</strong>
          <small>${r.desc}</small>
          <span class="road-tag">${P.TYPE_META[r.type].icon} ${P.TYPE_META[r.type].label}</span>
        </div>
        <div class="road-side">
          <span class="road-lvl">${unlocked ? '' : '<span class="lock">🔒</span> '}Level <b>${r.level}</b></span>
          ${unlocked && equippable
            ? `<button class="mini-btn ${active ? 'is-on' : ''}" data-equip="${slot}" data-id="${r.id}">${active ? 'Aktiv' : 'Anlegen'}</button>`
            : ''}
        </div>
      </div>`;
    }).join('');
  }

  $('rewardFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filter = chip.dataset.filter;
    document.querySelectorAll('#rewardFilters .chip').forEach((c) => c.classList.toggle('is-active', c === chip));
    renderRoad();
  });

  $('road').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-equip]');
    if (!btn) return;
    const slot = btn.dataset.equip;
    const id = btn.dataset.id;
    const isActive = snap.state.equipped[slot] === id;
    snap = await window.pets.equip(slot, isActive && slot !== 'pet' && slot !== 'palette' ? null : id);
    render();
    snack(isActive && slot !== 'pet' ? 'Abgelegt.' : 'Angelegt!');
  });

  function markRewardsSeen() {
    const unseen = snap.unlockedIds.filter((id) => !(snap.state.seenRewards || []).includes(id));
    if (unseen.length) window.pets.markRewardsSeen(unseen).then((s) => { snap = s; renderHome(); });
  }

  /* ---------------------------------------------------------
     Ausstattung
     --------------------------------------------------------- */
  function renderWardrobe() {
    $('wardrobePet').innerHTML = PetArt.build({
      pet: snap.state.equipped.pet,
      palette: snap.state.equipped.palette,
      accessory: snap.state.equipped.accessory,
      static: true
    });

    slot('slotPet', 'pet', P.REWARDS.filter((r) => r.type === 'pet'), false);
    slot('slotPalette', 'palette', P.REWARDS.filter((r) => r.type === 'palette'), false);
    slot('slotAccessory', 'accessory', P.REWARDS.filter((r) => r.type === 'accessory'), true);
    slot('slotEffect', 'effect', P.REWARDS.filter((r) => r.type === 'effect'), true);
  }

  function slot(containerId, slotName, rewards, allowNone) {
    const cur = snap.state.equipped[slotName];
    let html = '';

    if (allowNone) {
      html += `<button class="opt ${!cur ? 'is-on' : ''}" data-slot="${slotName}" data-id="">
        <span class="opt-art">🚫</span><span>Ohne</span></button>`;
    }

    html += rewards.map((r) => {
      const unlocked = r.level <= snap.level;
      return `<button class="opt ${cur === r.id ? 'is-on' : ''} ${unlocked ? '' : 'is-locked'}"
              ${unlocked ? '' : 'disabled'} data-slot="${slotName}" data-id="${r.id}" title="${r.desc}">
        <span class="opt-art">${art(r)}</span>
        <span>${r.name}</span>
        ${unlocked ? '' : `<span class="opt-lock">🔒 Level ${r.level}</span>`}
      </button>`;
    }).join('');

    $(containerId).innerHTML = html;
  }

  document.querySelector('.wardrobe-panels').addEventListener('click', async (e) => {
    const btn = e.target.closest('.opt');
    if (!btn || btn.disabled) return;
    snap = await window.pets.equip(btn.dataset.slot, btn.dataset.id || null);
    render();
  });

  /* ---------------------------------------------------------
     Statistik
     --------------------------------------------------------- */
  function renderStats() {
    const s = snap.state.stats;
    $('statsGrid').innerHTML = [
      card('Gesamt-XP', fmt(snap.totalXp), `Level ${snap.level} von ${P.MAX_LEVEL}`),
      card('Streicheleinheiten', fmt(s.pets), `${fmt(s.pets * P.XP_EVENTS.pet.amount)} XP`),
      card('Spaziergänge', fmt(s.walks), `${fmt(s.walks * P.XP_EVENTS.walk.amount)} XP`),
      card('Gedanken gelesen', fmt(s.thoughts), `${fmt(s.thoughts * P.XP_EVENTS.thought.amount)} XP`),
      card('Snacks', fmt(s.feeds), `${fmt(s.feeds * P.XP_EVENTS.feed.amount)} XP`),
      card('Spielrunden', fmt(s.plays), `${fmt(s.plays * P.XP_EVENTS.play.amount)} XP`),
      card('Zeit zusammen', `${fmt(s.minutes)} Min.`, `${fmt(s.minutes * P.XP_EVENTS.idle.amount)} XP`),
      card('Level-Ups', fmt(s.levelUps || 0), `Beste Serie: ${snap.state.bestStreak || 0} Tage`)
    ].join('');

    const rows = [
      ['Streicheln', s.pets * P.XP_EVENTS.pet.amount],
      ['Spaziergänge', s.walks * P.XP_EVENTS.walk.amount],
      ['Gedanken', s.thoughts * P.XP_EVENTS.thought.amount],
      ['Snacks', s.feeds * P.XP_EVENTS.feed.amount],
      ['Spielen', s.plays * P.XP_EVENTS.play.amount],
      ['Zeit zusammen', s.minutes * P.XP_EVENTS.idle.amount]
    ].sort((a, b) => b[1] - a[1]);

    const max = Math.max(1, ...rows.map((r) => r[1]));
    $('xpSources').innerHTML = rows.map(([label, value]) => `
      <div class="xp-row">
        <span>${label}</span>
        <div class="meter"><i style="width:${(value / max) * 100}%"></i></div>
        <b>${fmt(value)} XP</b>
      </div>`).join('');
  }

  /* ---------------------------------------------------------
     Einstellungen
     --------------------------------------------------------- */
  function renderSettings() {
    const st = snap.state.settings;
    $('setVisible').checked = !!st.visible;
    $('setThoughts').checked = !!st.thoughtsEnabled;
    $('setWander').checked = !!st.wander;
    $('setAutostart').checked = !!st.launchOnStartup;
    $('setInterval').value = st.thoughtIntervalSec;
    $('intervalLabel').textContent = `alle ${st.thoughtIntervalSec} Sekunden`;
    $('setSide').value = st.side || 'right';
  }

  const bindToggle = (id, key) => $(id).addEventListener('change', async (e) => {
    snap = await window.pets.setSettings({ [key]: e.target.checked });
    render();
  });
  bindToggle('setVisible', 'visible');
  bindToggle('setThoughts', 'thoughtsEnabled');
  bindToggle('setWander', 'wander');
  bindToggle('setAutostart', 'launchOnStartup');

  $('setInterval').addEventListener('input', (e) => {
    $('intervalLabel').textContent = `alle ${e.target.value} Sekunden`;
  });
  $('setInterval').addEventListener('change', async (e) => {
    snap = await window.pets.setSettings({ thoughtIntervalSec: Number(e.target.value) });
  });
  $('setSide').addEventListener('change', async (e) => {
    snap = await window.pets.setSettings({ side: e.target.value });
    snack('Lieblingsecke geändert.');
  });

  $('btnExport').addEventListener('click', async () => {
    const code = await window.pets.exportSave();
    $('saveCode').value = code;
    $('saveCode').select();
    try {
      await navigator.clipboard.writeText(code);
      snack('Code kopiert – auf dem anderen Gerät einfügen.');
    } catch (_) {
      snack('Code erzeugt – markieren und kopieren.');
    }
  });

  $('btnImport').addEventListener('click', async () => {
    const code = $('saveCode').value.trim();
    if (!code) return snack('Bitte zuerst einen Code einfügen.');
    if (!confirm('Der eingespielte Spielstand ersetzt den aktuellen Fortschritt. Fortfahren?')) return;
    const res = await window.pets.importSave(code);
    if (res.ok) {
      snap = await window.pets.getState();
      render();
      $('saveCode').value = '';
      snack('Spielstand übernommen!');
    } else {
      snack(res.error || 'Der Code konnte nicht gelesen werden.');
    }
  });

  $('btnReset').addEventListener('click', async () => {
    if (!confirm('Wirklich den gesamten Fortschritt zurücksetzen? Level, XP und alle Belohnungen gehen verloren.')) return;
    snap = await window.pets.resetProgress();
    render();
    snack('Fortschritt zurückgesetzt.');
  });

  /* ---------------------------------------------------------
     Aktionen
     --------------------------------------------------------- */
  $('petName').addEventListener('change', async (e) => {
    snap = await window.pets.rename(e.target.value);
    render();
  });
  $('petName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  $('btnFeed').addEventListener('click', async () => {
    const res = await window.pets.feed();
    snack(res.ok ? `Mahlzeit! +${res.xp} XP` : 'Dein Pet ist noch satt.');
  });

  $('btnPlay').addEventListener('click', async () => {
    const res = await window.pets.play();
    if (res.ok) snack(`Das hat Spaß gemacht! +${res.xp} XP`);
    else snack(`Wieder bereit in ${Math.ceil(res.readyIn / 60000)} Minuten.`);
  });

  $('btnWalk').addEventListener('click', async () => {
    await window.pets.command('walk');
    snack('Los geht\u2019s!');
  });
  $('btnThought').addEventListener('click', async () => {
    await window.pets.command('thought');
  });

  $('toggleVisible').addEventListener('click', async () => {
    snap = await window.pets.setSettings({ visible: !snap.state.settings.visible });
    render();
  });

  /* ---------------------------------------------------------
     Rendern & Live-Updates
     --------------------------------------------------------- */
  function render() {
    if (!snap) return;
    renderHome();
    renderRoad();
    renderWardrobe();
    renderStats();
    renderSettings();
  }

  window.pets.onState((s) => {
    const leveled = s.levelUp;
    snap = s;
    render();
    if (leveled) {
      const list = leveled.rewards.map((r) => r.name).join(', ');
      snack(`Level ${leveled.to}!${list ? ' ' + list + ' freigeschaltet.' : ''}`);
    }
  });

  (async function init() {
    snap = await window.pets.getState();
    render();
  })();
})();
