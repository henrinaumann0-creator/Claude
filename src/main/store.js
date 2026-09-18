/* ============================================================
   Claude Pets – Persistenter Zustand
   Speichert nach app.getPath('userData')/pet-state.json
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    createdAt: Date.now(),
    totalXp: 0,
    petName: 'Nova',
    lastSeenDay: null,
    streak: 0,
    bestStreak: 0,
    hunger: 100,
    lastFedAt: 0,
    lastPlayedAt: 0,
    stats: {
      pets: 0, walks: 0, thoughts: 0, minutes: 0, feeds: 0, plays: 0, levelUps: 0,
      drags: 0, distance: 0, nightPets: 0, morningPets: 0,
      arcadeRuns: 0, arcadeScore: 0
    },
    arcade: { best: {} },
    achievements: [],
    worn: [],
    petsTried: ['nova'],
    palettesTried: ['amber'],
    equipped: { pet: 'nova', accessory: null, palette: 'amber', effect: null },
    thoughtPacks: ['alltag'],
    seenRewards: ['nova', 'amber', 'alltag'],
    settings: {
      visible: true,
      thoughtsEnabled: true,
      thoughtIntervalSec: 45,
      scale: 1,
      wander: true,
      launchOnStartup: false,
      side: 'right',
      sound: true
    },
    xpLog: []
  };
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  for (const key of Object.keys(patch)) {
    const b = out[key];
    const p = patch[key];
    out[key] = (b && typeof b === 'object' && !Array.isArray(b) && p && typeof p === 'object' && !Array.isArray(p))
      ? deepMerge(b, p)
      : p;
  }
  return out;
}

class Store {
  constructor(filePath) {
    this.file = filePath;
    this.tmp = filePath + '.tmp';
    this.state = defaultState();
    this._timer = null;
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = deepMerge(defaultState(), parsed);
      this.state.version = SCHEMA_VERSION;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('[store] Zustand nicht lesbar, starte neu:', err.message);
        try { fs.copyFileSync(this.file, this.file + '.corrupt-' + Date.now()); } catch (_) {}
      }
      this.state = defaultState();
      this.flush();
    }
  }

  get() { return this.state; }

  /** Flacher/tiefer Patch + verzögertes Speichern. */
  update(patch) {
    this.state = deepMerge(this.state, patch);
    this.save();
    return this.state;
  }

  set(fn) {
    const next = fn(this.state);
    if (next) this.state = next;
    this.save();
    return this.state;
  }

  save() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this.flush(); }, 400);
  }

  flush() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(this.tmp, this.file);
    } catch (err) {
      console.error('[store] Speichern fehlgeschlagen:', err.message);
    }
  }

  reset() {
    this.state = defaultState();
    this.flush();
    return this.state;
  }
}

module.exports = { Store, defaultState, SCHEMA_VERSION };
