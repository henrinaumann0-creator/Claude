/* ============================================================
   Claude Pets – Web-Kern
   Bildet dieselbe Schnittstelle nach, die im Desktop-Build der
   Electron-Preload bereitstellt (window.pets), speichert den
   Spielstand aber im localStorage des Browsers.
   Dadurch laufen pet.js und dashboard.js unverändert im Web.
   ============================================================ */
'use strict';

(() => {
  const P = window.Progression;

  // Auf schmalen Bildschirmen ist ein kleineres Pet angenehmer.
  window.__petSize = window.innerWidth < 560 ? 104 : 132;
  const KEY = 'claude-pets:state:v1';

  const HUNGER_FULL_MS = 12 * 60 * 60 * 1000;
  const PLAY_COOLDOWN_MS = 30 * 60 * 1000;

  /* ---------------------------------------------------------
     Zustand
     --------------------------------------------------------- */
  function defaultState() {
    return {
      version: 1,
      createdAt: Date.now(),
      totalXp: 0,
      petName: 'Nova',
      lastSeenDay: null,
      streak: 0,
      bestStreak: 0,
      lastFedAt: 0,
      lastPlayedAt: 0,
      stats: { pets: 0, walks: 0, thoughts: 0, minutes: 0, feeds: 0, plays: 0, levelUps: 0 },
      equipped: { pet: 'nova', accessory: null, palette: 'amber', effect: null },
      seenRewards: ['nova', 'amber', 'alltag'],
      settings: {
        visible: true,
        thoughtsEnabled: true,
        thoughtIntervalSec: 45,
        scale: 1,
        wander: true,
        launchOnStartup: false,
        side: 'right'
      }
    };
  }

  function merge(base, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return patch === undefined ? base : patch;
    }
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (const k of Object.keys(patch)) {
      const b = out[k], p = patch[k];
      out[k] = (b && typeof b === 'object' && !Array.isArray(b) && p && typeof p === 'object' && !Array.isArray(p))
        ? merge(b, p) : p;
    }
    return out;
  }

  let state = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = merge(defaultState(), JSON.parse(raw));
  } catch (err) {
    console.warn('[pets] Spielstand nicht lesbar, starte neu.', err);
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (err) { console.warn('[pets] Speichern fehlgeschlagen', err); }
    }, 250);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  }
  function update(patch) { state = merge(state, patch); save(); return state; }

  /* ---------------------------------------------------------
     Abgeleiteter Zustand
     --------------------------------------------------------- */
  function hungerOf() {
    const since = Date.now() - (state.lastFedAt || state.createdAt || Date.now());
    return Math.max(0, Math.min(100, Math.round(100 - (since / HUNGER_FULL_MS) * 100)));
  }

  function snapshot() {
    const prog = P.levelFromTotalXp(state.totalXp);
    const unlocked = P.unlocked(prog.level);
    const hunger = hungerOf();
    return {
      state,
      level: prog.level,
      xpInLevel: prog.xpInLevel,
      xpForNext: prog.xpForNext,
      progress: prog.progress,
      isMax: prog.isMax,
      totalXp: state.totalXp,
      hunger,
      canFeed: hunger <= 75,
      canPlay: Date.now() - (state.lastPlayedAt || 0) > PLAY_COOLDOWN_MS,
      playReadyIn: Math.max(0, PLAY_COOLDOWN_MS - (Date.now() - (state.lastPlayedAt || 0))),
      unlockedIds: unlocked.map((r) => r.id),
      nextReward: P.nextReward(prog.level),
      thoughtPacks: unlocked.filter((r) => r.type === 'thoughts').map((r) => r.id),
      perks: unlocked.filter((r) => r.type === 'perk').map((r) => r.id)
    };
  }

  /* ---------------------------------------------------------
     Ereignis-Verteilung
     --------------------------------------------------------- */
  const stateListeners = new Set();
  const commandListeners = new Set();
  const resizeListeners = new Set();

  function broadcast(extra) {
    const payload = Object.assign(snapshot(), extra || {});
    stateListeners.forEach((cb) => { try { cb(payload); } catch (e) { console.error(e); } });
  }
  function sendCommand(cmd) {
    commandListeners.forEach((cb) => { try { cb(cmd); } catch (e) { console.error(e); } });
  }

  /* ---------------------------------------------------------
     XP
     --------------------------------------------------------- */
  const lastEventAt = Object.create(null);

  function addXp(kind, multiplier = 1) {
    const def = P.XP_EVENTS[kind];
    if (!def) return null;

    const now = Date.now();
    if (def.cooldownMs && now - (lastEventAt[kind] || 0) < def.cooldownMs) {
      return { gained: 0, throttled: true };
    }
    lastEventAt[kind] = now;

    const before = P.levelFromTotalXp(state.totalXp).level;
    let amount = def.amount * multiplier;
    if (kind === 'pet' && P.isUnlocked('big-heart', before)) amount *= 1.5;
    amount = Math.max(1, Math.round(amount));

    const totalXp = state.totalXp + amount;
    const after = P.levelFromTotalXp(totalXp).level;

    const statKey = { pet: 'pets', walk: 'walks', thought: 'thoughts', feed: 'feeds', play: 'plays', idle: 'minutes' }[kind];
    const patch = { totalXp };
    if (statKey) patch.stats = { [statKey]: (state.stats[statKey] || 0) + 1 };
    if (after > before) {
      patch.stats = Object.assign(patch.stats || {}, { levelUps: (state.stats.levelUps || 0) + (after - before) });
    }
    update(patch);

    const leveledUp = after > before;
    const rewards = [];
    if (leveledUp) for (let l = before + 1; l <= after; l++) rewards.push(...P.rewardsAtLevel(l));

    broadcast(leveledUp ? { levelUp: { from: before, to: after, rewards } } : null);
    return { gained: amount, leveledUp, level: after, rewards };
  }

  /* ---------------------------------------------------------
     Täglicher Bonus
     --------------------------------------------------------- */
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function checkDailyBonus() {
    const today = dayKey();
    if (state.lastSeenDay === today) return;
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    const streak = state.lastSeenDay === yesterday ? (state.streak || 0) + 1 : 1;
    update({ lastSeenDay: today, streak, bestStreak: Math.max(state.bestStreak || 0, streak) });

    const res = addXp('dailyBonus', Math.min(3, 1 + (streak - 1) * 0.15));
    if (res && res.gained) {
      setTimeout(() => sendCommand({ type: 'celebrate', text: `Tag ${streak} in Folge! +${res.gained} XP` }), 2200);
    }
  }

  /* ---------------------------------------------------------
     Passive XP – nur wenn der Tab sichtbar ist
     --------------------------------------------------------- */
  setInterval(() => {
    if (document.hidden || !state.settings.visible) return;
    addXp('idle');
  }, 60 * 1000);

  setInterval(() => broadcast(), 30 * 1000);
  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  /* ---------------------------------------------------------
     Öffentliche Schnittstelle (identisch zum Electron-Preload)
     --------------------------------------------------------- */
  window.pets = {
    getState: async () => snapshot(),

    onState(cb) { stateListeners.add(cb); return () => stateListeners.delete(cb); },
    onCommand(cb) { commandListeners.add(cb); return () => commandListeners.delete(cb); },
    onResized(cb) { resizeListeners.add(cb); return () => resizeListeners.delete(cb); },

    addXp: async (kind, multiplier) => addXp(kind, multiplier || 1),

    async equip(slot, id) {
      if (!['pet', 'accessory', 'palette', 'effect'].includes(slot)) return snapshot();
      const level = P.levelFromTotalXp(state.totalXp).level;
      if (id !== null && !P.isUnlocked(id, level)) return snapshot();
      update({ equipped: { [slot]: id } });
      if (slot === 'pet' && id) {
        const reward = P.byId(id);
        if (reward) update({ petName: reward.name });
      }
      broadcast({ equipChanged: slot });
      return snapshot();
    },

    async rename(name) {
      const clean = String(name || '').trim().slice(0, 18);
      if (clean) update({ petName: clean });
      broadcast();
      return snapshot();
    },

    async feed() {
      if (hungerOf() > 75) return { ok: false, reason: 'not-hungry' };
      update({ lastFedAt: Date.now() });
      const res = addXp('feed');
      sendCommand({ type: 'eat' });
      return { ok: true, xp: res && res.gained };
    },

    async play() {
      const snap = snapshot();
      if (!snap.canPlay) return { ok: false, reason: 'cooldown', readyIn: snap.playReadyIn };
      update({ lastPlayedAt: Date.now() });
      const res = addXp('play');
      sendCommand({ type: 'play' });
      return { ok: true, xp: res && res.gained };
    },

    async setSettings(patch) {
      update({ settings: patch || {} });
      broadcast();
      return snapshot();
    },

    async markRewardsSeen(ids) {
      const set = new Set(state.seenRewards || []);
      (Array.isArray(ids) ? ids : [ids]).forEach((id) => id && set.add(id));
      update({ seenRewards: Array.from(set) });
      return snapshot();
    },

    async resetProgress() {
      state = defaultState();
      saveNow();
      broadcast({ reset: true });
      return snapshot();
    },

    async command(type) { sendCommand({ type }); return true; },

    /* Spielstand zwischen Handy und Desktop übertragen */
    async exportSave() {
      saveNow();
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    },
    async importSave(code) {
      try {
        const json = decodeURIComponent(escape(atob(String(code || '').trim())));
        const parsed = JSON.parse(json);
        if (typeof parsed !== 'object' || typeof parsed.totalXp !== 'number') throw new Error('Ungültig');
        state = merge(defaultState(), parsed);
        saveNow();
        broadcast({ reset: true });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: 'Der Code konnte nicht gelesen werden.' };
      }
    },

    /* Im Web ohne Funktion bzw. lokal umgesetzt */
    openDashboard: async () => { window.__pets_openView && window.__pets_openView('home'); return true; },
    hidePet: async () => { await window.pets.setSettings({ visible: false }); return true; },
    quit: async () => false,
    setInteractive() {},
    minimizeWindow() {},
    closeWindow() {},
    platform: 'web',

    /* Interna für app.js */
    _emitResize: (bounds) => resizeListeners.forEach((cb) => cb(bounds)),
    _checkDailyBonus: checkDailyBonus,
    _broadcast: broadcast
  };
})();
