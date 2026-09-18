/* ============================================================
   Claude Pets – Dashboard-Logik
   ============================================================ */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const P = window.Progression;
  const A = window.Achievements;
  const I = window.Icons;

  let snap = null;
  let filter = 'all';
  let achFilter = 'all';

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
    return `<span class="type-ico">${I.build(P.TYPE_META[reward.type].icon, { size: 30 })}</span>`;
  }

  const typeTag = (type) => {
    const meta = P.TYPE_META[type];
    return `<span class="road-tag">${I.build(meta.icon, { size: 11 })}${meta.label}</span>`;
  };

  let snackTimer = null;
  function snack(text, icon, tone) {
    const s = $('snack');
    s.innerHTML = (icon ? `<span class="snack-ico">${I.build(icon, { tone: tone || 'gold', size: 18 })}</span>` : '')
      + `<span>${text}</span>`;
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
      if (target === 'achievements') markAchievementsSeen();
      if (target === 'arcade') enterArcade();
      else leaveArcade();
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
      card('Level-Ups', fmt(snap.state.stats.levelUps || 0), 'bisher gefeiert'),
      card('Erfolge', `${snap.achievements.done} / ${snap.achievements.total}`, `${fmt(snap.achievements.points)} Bonus-XP`)
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
          ${typeTag(r.type)}
        </div>
        <div class="road-side">
          <span class="road-lvl">${unlocked ? '' : `<span class="lock">${I.build('lock', { tone: 'muted', size: 12 })}</span>`}Level <b>${r.level}</b></span>
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

  function markAchievementsSeen() {
    const unseen = (snap.state.achievements || [])
      .map((id) => 'ach:' + id)
      .filter((id) => !(snap.state.seenRewards || []).includes(id));
    if (unseen.length) window.pets.markRewardsSeen(unseen).then((s) => { snap = s; render(); });
  }

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
        <span class="opt-art">${I.build('ban', { size: 40 })}</span><span>Ohne</span></button>`;
    }

    html += rewards.map((r) => {
      const unlocked = r.level <= snap.level;
      return `<button class="opt ${cur === r.id ? 'is-on' : ''} ${unlocked ? '' : 'is-locked'}"
              ${unlocked ? '' : 'disabled'} data-slot="${slotName}" data-id="${r.id}" title="${r.desc}">
        <span class="opt-art">${art(r)}</span>
        <span>${r.name}</span>
        ${unlocked ? '' : `<span class="opt-lock">${I.build('lock', { tone: 'muted', size: 10 })} Level ${r.level}</span>`}
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
     Erfolge
     --------------------------------------------------------- */
  function renderAchievements() {
    const sum = snap.achievements;
    const have = new Set(snap.state.achievements || []);

    $('achSub').textContent =
      `${sum.done} von ${sum.total} Abzeichen · ${fmt(sum.points)} Bonus-XP gesammelt.`;
    $('achMini').textContent = `${sum.done} / ${sum.total}`;
    $('achBar').style.width = (sum.total ? (sum.done / sum.total) * 100 : 0) + '%';

    $('tierRow').innerHTML = ['bronze', 'silver', 'gold'].map((tier) => {
      const meta = A.TIERS[tier];
      const total = A.ACHIEVEMENTS.filter((a) => a.tier === tier).length;
      const done = sum.perTier[tier];
      return `<div class="tier-card tier-card--${tier}">
        <span class="tier-ico">${I.build('medal', { tone: meta.tone, size: 34 })}</span>
        <span class="tier-body">
          <strong>${meta.label}</strong>
          <small>${done} / ${total} · je ${meta.xp} XP</small>
        </span>
        <span class="tier-ring" style="--p:${total ? (done / total) * 100 : 0}%"></span>
      </div>`;
    }).join('');

    const list = A.sorted(snap.state, snap.level).filter((a) => {
      const done = have.has(a.id);
      if (achFilter === 'open') return !done;
      if (achFilter === 'done') return done;
      if (['bronze', 'silver', 'gold'].includes(achFilter)) return a.tier === achFilter;
      return true;
    });

    $('achGrid').innerHTML = list.map((a, i) => {
      const done = have.has(a.id);
      const pr = A.progressOf(a, snap.state, snap.level);
      const meta = A.TIERS[a.tier];
      const pct = Math.round(pr.ratio * 100);
      return `<article class="ach ${done ? 'is-done' : ''} ach--${a.tier}"
                       style="animation-delay:${Math.min(i * 20, 380)}ms">
        <div class="ach-badge">
          ${I.build(a.icon, { tone: done ? meta.tone : 'muted', size: 38 })}
          ${done ? `<span class="ach-check">${I.build('check', { tone: 'cream', size: 12 })}</span>` : ''}
        </div>
        <div class="ach-main">
          <strong>${a.name}</strong>
          <small>${a.desc}</small>
          <div class="ach-progress">
            <div class="meter meter--sm"><i class="bar--${a.tier}" style="width:${pct}%"></i></div>
            <span class="ach-count">${fmt(pr.current)} / ${fmt(pr.goal)}${a.unit ? ' ' + a.unit : ''}</span>
          </div>
        </div>
        <div class="ach-side">
          <span class="ach-tier">${meta.label}</span>
          <span class="ach-xp">+${meta.xp} XP</span>
        </div>
      </article>`;
    }).join('') || '<p class="empty">Hier ist gerade nichts – probier einen anderen Filter.</p>';
  }

  $('achFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    achFilter = chip.dataset.filter;
    document.querySelectorAll('#achFilters .chip').forEach((c) => c.classList.toggle('is-active', c === chip));
    renderAchievements();
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
      card('Level-Ups', fmt(s.levelUps || 0), `Beste Serie: ${snap.state.bestStreak || 0} Tage`),
      card('Getragen', fmt(s.drags || 0), 'an eine andere Stelle gesetzt'),
      card('Laufstrecke', `${fmt(Math.round((s.distance || 0) / 1000))} k`, 'Pixel zurückgelegt'),
      card('Abzeichen', `${snap.achievements.done} / ${snap.achievements.total}`, `${fmt(snap.achievements.points)} Bonus-XP`)
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
    $('setSound').checked = st.sound !== false;
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
  $('setSound').addEventListener('change', (e) => setSound(e.target.checked));

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
     Arcade
     Die Spiele selbst stecken in arcade.js – hier hängt nur der
     Automat drumherum: Auswahl, Anzeige, Ergebnis und XP.
     --------------------------------------------------------- */
  const hasArcade = typeof window.Arcade !== 'undefined';
  const Sound = window.Chip || { setEnabled() {}, play() {}, unlock() {}, stopMusic() {} };

  let arcade = null;
  let gameId = 'catch';
  let mode = 'ready';        // ready · playing · paused · result
  let lastRun = null;
  let lastScore = 0;

  function bumpScore() {
    const pill = $('cabScore');
    pill.classList.remove('is-bump');
    void pill.offsetWidth;     // Animation neu starten
    pill.classList.add('is-bump');
  }

  const gameById = (id) => P.arcadeGame(id) || P.ARCADE_GAMES[0];
  const bestOf = (id) => ((snap.state.arcade && snap.state.arcade.best) || {})[id] || 0;
  const lookOf = () => ({
    pet: snap.state.equipped.pet,
    palette: snap.state.equipped.palette,
    accessory: snap.state.equipped.accessory
  });

  function ensureArcade() {
    if (arcade || !hasArcade) return arcade;
    arcade = window.Arcade.create({
      canvas: $('arcadeScreen'),
      onTick(score, status) {
        const box = $('cabScore');
        const shown = fmt(score);
        if (box.textContent !== shown) {
          box.textContent = shown;
          const unit = box.nextElementSibling;
          if (unit) unit.textContent = score === 1 ? 'Punkt' : 'Punkte';
          // Ein kurzer Stups, wenn es wirklich etwas zu feiern gibt.
          // Beim Sprint zählen die Meter laufend hoch – da wäre er Zappeln.
          if (score - lastScore >= (gameId === 'runner' ? 5 : 1)) bumpScore();
          lastScore = score;
        }
        const line = $('cabStatus');
        const next = status || '';
        if (line.textContent !== next) line.textContent = next;
      },
      onEnd(id, score) { finishRun(id, score); }
    });
    arcade.setLook(lookOf());
    return arcade;
  }

  function enterArcade() {
    if (!ensureArcade()) return;
    arcade.resize();
    arcade.setLook(lookOf());
    renderArcade();
  }

  /** Beim Verlassen der Ansicht läuft nichts weiter – die Runde wartet. */
  function leaveArcade() {
    if (!arcade || mode !== 'playing') return;
    arcade.pause();
    mode = 'paused';
    renderArcade();
  }

  function selectGame(id) {
    if (mode === 'playing') return;
    gameId = id;
    mode = 'ready';
    lastRun = null;
    Sound.play('select');
    renderArcade();
  }

  function startRun() {
    if (!ensureArcade()) return;
    arcade.setLook(lookOf());
    if (!arcade.start(gameId)) return;
    mode = 'playing';
    lastRun = null;
    lastScore = 0;
    $('cabScore').textContent = '0';
    $('cabScore').classList.remove('is-bump');
    $('cabStatus').textContent = '';
    renderArcade();
  }

  function resumeRun() {
    if (!arcade) return;
    arcade.resume();
    mode = 'playing';
    renderArcade();
  }

  function quitRun() {
    if (arcade) arcade.stop();
    mode = 'ready';
    $('cabStatus').textContent = '';
    renderArcade();
  }

  async function finishRun(id, score) {
    mode = 'result';
    lastRun = { id, score, xp: 0, best: bestOf(id), record: false };
    renderArcade();

    if (window.pets.arcadeResult) {
      const res = await window.pets.arcadeResult(id, score);
      if (res && res.ok) {
        lastRun = { id, score, xp: res.xp || 0, best: res.best || score, record: !!res.record };
        snap = await window.pets.getState();
        render();
        if (res.record) Sound.play('record');
      }
    }
    renderArcade();
  }

  /* --- Anzeige --- */
  function renderArcade() {
    if (!document.getElementById('gameList')) return;
    const game = gameById(gameId);

    $('cabIco').innerHTML = I.build(game.icon, { size: 17 });
    $('cabTitle').textContent = game.name;
    $('cabPar').textContent = `Richtwert: ${fmt(game.par)} Punkte`;
    $('cabKeys').innerHTML = keyHint(game.id);

    $('gameList').innerHTML = P.ARCADE_GAMES.map((g) => {
      const best = bestOf(g.id);
      const ratio = Math.min(1, best / g.par);
      return `
      <button class="game-card ${g.id === gameId ? 'is-on' : ''}" data-game="${g.id}">
        <span class="game-card-art">${I.build(g.icon, { size: 26 })}</span>
        <span class="game-card-main">
          <strong>${g.name}</strong>
          <small>${g.desc}</small>
          <span class="game-card-meta">
            <span class="game-tag">${g.tag}</span>
            <span class="game-best">Best: <b>${fmt(best)}</b></span>
          </span>
          <span class="game-meter" title="Richtwert ${fmt(g.par)}">
            <i class="${ratio >= 1 ? 'is-full' : ''}" style="width:${Math.round(ratio * 100)}%"></i>
          </span>
        </span>
      </button>`;
    }).join('');

    $('parList').innerHTML = P.ARCADE_GAMES.map((g) => {
      const best = bestOf(g.id);
      const done = best >= g.par;
      return `<div class="par-row">
        <span class="par-name">${I.build(g.icon, { size: 15, tone: done ? 'gold' : 'brand' })}${g.name}</span>
        <span class="par-val ${done ? 'par-done' : ''}"><b>${fmt(best)}</b> / ${fmt(g.par)}</span>
      </div>`;
    }).join('');

    renderVeil(game);
    renderSoundChip();
  }

  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function keyHint(id) {
    if (coarse) {
      return '<span>' + ({
        catch: 'Finger über das Spielfeld ziehen',
        runner: 'Tippen springt – halten springt höher',
        memory: 'Karte antippen'
      }[id] || 'Tippen') + '</span>';
    }
    const keys = {
      catch: ['←', '→', 'A', 'D'],
      runner: ['Leertaste', '↑'],
      memory: ['Klick']
    }[id] || [];
    return keys.map((k) => `<span class="key">${k}</span>`).join('')
      + '<span>oder tippen</span>';
  }

  function renderVeil(game) {
    const veil = $('arcadeVeil');
    const card = $('veilCard');

    if (mode === 'playing') { veil.hidden = true; return; }
    veil.hidden = false;

    if (mode === 'paused') {
      card.innerHTML = `
        <span class="veil-eyebrow">Angehalten</span>
        <h2>${game.name}</h2>
        <p>Die Runde wartet auf dich.</p>
        <div class="veil-actions">
          <button class="btn btn--primary" data-act="resume">Weiter</button>
          <button class="btn" data-act="quit">Beenden</button>
        </div>`;
      return;
    }

    if (mode === 'result' && lastRun) {
      const g = gameById(lastRun.id);
      const next = P.ARCADE_GAMES[(P.ARCADE_GAMES.indexOf(g) + 1) % P.ARCADE_GAMES.length];
      card.innerHTML = `
        <span class="veil-eyebrow">Runde vorbei</span>
        <h2>${g.name}</h2>
        ${lastRun.record
          ? `<div class="result-record">${I.build('medal', { tone: 'gold', size: 14 })} Neuer Bestwert!</div>`
          : ''}
        <div class="result">
          <div><div class="result-val">${fmt(lastRun.score)}</div><div class="result-lbl">Punkte</div></div>
          <div><div class="result-val result-val--muted">${fmt(Math.max(lastRun.best, lastRun.score))}</div><div class="result-lbl">Bestwert</div></div>
        </div>
        <p><span class="result-xp">${I.build('star', { tone: 'cream', size: 14 })} +${fmt(lastRun.xp)} XP</span></p>
        <div class="veil-actions">
          <button class="btn btn--primary" data-act="start">Nochmal</button>
          <button class="btn" data-act="switch" data-game="${next.id}">${next.name}</button>
        </div>`;
      return;
    }

    card.innerHTML = `
      <span class="veil-eyebrow">${game.tag}</span>
      <h2>${game.name}</h2>
      <p>${game.desc}<br /><small>${game.how}</small></p>
      <div class="veil-actions">
        <button class="btn btn--primary" data-act="start">${I.build('joystick', { tone: 'cream', size: 15 })} Start</button>
      </div>`;
  }

  function renderSoundChip() {
    const on = snap.state.settings.sound !== false;
    const chip = $('soundChip');
    if (!chip) return;
    chip.classList.toggle('is-active', on);
    $('soundIco').innerHTML = I.build(on ? 'sound' : 'mute', { tone: on ? 'cream' : 'muted', size: 15 });
    $('soundLabel').textContent = on ? 'Ton an' : 'Ton aus';
  }

  async function setSound(on) {
    Sound.setEnabled(on);
    if (on) Sound.unlock();
    snap = await window.pets.setSettings({ sound: !!on });
    render();
  }

  if (hasArcade) {
    $('gameList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-game]');
      if (btn) selectGame(btn.dataset.game);
    });

    $('arcadeVeil').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      Sound.unlock();
      const act = btn.dataset.act;
      if (act === 'start') startRun();
      else if (act === 'resume') resumeRun();
      else if (act === 'quit') quitRun();
      else if (act === 'switch') { selectGame(btn.dataset.game); startRun(); }
    });

    $('soundChip').addEventListener('click', () => setSound(snap.state.settings.sound === false));

    // Weggeklickt heißt Pause – niemand verliert eine Runde an einen Tabwechsel.
    document.addEventListener('visibilitychange', () => { if (document.hidden) leaveArcade(); });
  }

  /* ---------------------------------------------------------
     Rendern & Live-Updates
     --------------------------------------------------------- */
  function render() {
    if (!snap) return;
    Sound.setEnabled(snap.state.settings.sound !== false);
    if (arcade) arcade.setLook(lookOf());
    renderHome();
    renderRoad();
    renderAchievements();
    renderWardrobe();
    renderStats();
    renderSettings();
    if (mode !== 'playing') renderArcade();
    I.hydrate(document);

    const unseenAch = (snap.state.achievements || [])
      .filter((id) => !(snap.state.seenRewards || []).includes('ach:' + id)).length;
    $('achBadge').hidden = unseenAch === 0;
    $('achBadge').textContent = unseenAch;
  }

  window.pets.onState((s) => {
    const leveled = s.levelUp;
    const earned = s.achievementsUnlocked;
    snap = s;
    render();
    if (leveled) {
      const list = leveled.rewards.map((r) => r.name).join(', ');
      snack(`Level ${leveled.to}!${list ? ' ' + list + ' freigeschaltet.' : ''}`);
    }
    if (earned && earned.length) {
      const names = earned.map((a) => a.name).join(', ');
      snack(`Erfolg freigeschaltet: ${names}`, earned[0].icon, A.TIERS[earned[0].tier].tone);
    }
  });

  (async function init() {
    snap = await window.pets.getState();
    render();
  })();
})();
