/* ============================================================
   Claude Pets – Level- & Belohnungssystem
   Läuft sowohl im Electron-Main (CommonJS) als auch im Renderer
   (globales `Progression`-Objekt).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Progression = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_LEVEL = 50;

  /** XP, die von `level` auf `level + 1` nötig sind. */
  function xpForLevel(level) {
    if (level >= MAX_LEVEL) return Infinity;
    return Math.round(40 * Math.pow(level, 1.22) + 20);
  }

  /** Gesamt-XP, die bis zum Erreichen von `level` gesammelt wurden. */
  function totalXpForLevel(level) {
    let sum = 0;
    for (let i = 1; i < level; i++) sum += xpForLevel(i);
    return sum;
  }

  /** Rechnet Gesamt-XP in Level + Fortschritt um. */
  function levelFromTotalXp(totalXp) {
    let level = 1;
    let rest = Math.max(0, Math.floor(totalXp));
    while (level < MAX_LEVEL && rest >= xpForLevel(level)) {
      rest -= xpForLevel(level);
      level++;
    }
    const need = xpForLevel(level);
    return {
      level,
      xpInLevel: level >= MAX_LEVEL ? 0 : rest,
      xpForNext: level >= MAX_LEVEL ? 0 : need,
      progress: level >= MAX_LEVEL ? 1 : Math.min(1, rest / need),
      isMax: level >= MAX_LEVEL
    };
  }

  /* ---------------------------------------------------------
     XP-Quellen
     --------------------------------------------------------- */
  const XP_EVENTS = {
    pet:        { amount: 6,  label: 'Gestreichelt',        cooldownMs: 1500 },
    walk:       { amount: 12, label: 'Spaziergang',         cooldownMs: 0 },
    thought:    { amount: 3,  label: 'Gedanke gelesen',     cooldownMs: 0 },
    idle:       { amount: 1,  label: 'Zeit zusammen',       cooldownMs: 0 },
    feed:       { amount: 45, label: 'Snack gefüttert',     cooldownMs: 0 },
    play:       { amount: 25, label: 'Gespielt',            cooldownMs: 0 },
    dailyBonus: { amount: 60, label: 'Täglicher Besuch',    cooldownMs: 0 }
  };

  /* ---------------------------------------------------------
     Belohnungs-Katalog
     type: pet | accessory | palette | thoughts | effect | perk
     --------------------------------------------------------- */
  const REWARDS = [
    // — Pets —
    { id: 'nova',   type: 'pet', level: 1,  name: 'Nova',   sub: 'Fuchs',    desc: 'Dein erster Begleiter. Neugierig, warm, immer da.' },
    { id: 'miso',   type: 'pet', level: 4,  name: 'Miso',   sub: 'Katze',    desc: 'Elegant und ein bisschen dramatisch.' },
    { id: 'mochi',  type: 'pet', level: 8,  name: 'Mochi',  sub: 'Blob',     desc: 'Weich, wabbelig, unerschütterlich gut gelaunt.' },
    { id: 'pixel',  type: 'pet', level: 14, name: 'Pixel',  sub: 'Roboter',  desc: 'Rechnet gern nach, wie viel Spaß gerade passiert.' },
    { id: 'yuki',   type: 'pet', level: 21, name: 'Yuki',   sub: 'Pinguin',  desc: 'Watschelt mit maximaler Würde über den Bildschirm.' },
    { id: 'ember',  type: 'pet', level: 30, name: 'Ember',  sub: 'Drache',   desc: 'Klein, glühend, überraschend kuschelig.' },

    // — Accessoires —
    { id: 'scarf',      type: 'accessory', level: 3,  name: 'Halstuch',     desc: 'Ein warmes Tuch in Claude-Orange.' },
    { id: 'glasses',    type: 'accessory', level: 6,  name: 'Brille',       desc: 'Sieht sofort 40 % klüger aus.' },
    { id: 'headphones', type: 'accessory', level: 11, name: 'Kopfhörer',    desc: 'Lo-fi Beats zum Chillen am Bildschirmrand.' },
    { id: 'partyhat',   type: 'accessory', level: 16, name: 'Partyhut',     desc: 'Für Tage, an denen alles kompiliert.' },
    { id: 'crown',      type: 'accessory', level: 25, name: 'Krone',        desc: 'Verdient. Jeder Pixel davon.' },
    { id: 'halo',       type: 'accessory', level: 35, name: 'Sternenring',  desc: 'Ein leuchtender Ring, der leise mitschwebt.' },

    // — Farbpaletten —
    { id: 'amber',    type: 'palette', level: 1,  name: 'Amber',      desc: 'Der Claude-Klassiker: helles Orange auf warmem Grau.' },
    { id: 'sunset',   type: 'palette', level: 5,  name: 'Sunset',     desc: 'Tiefes Abendrot mit goldenem Rand.' },
    { id: 'mint',     type: 'palette', level: 10, name: 'Mint',       desc: 'Kühl, ruhig, konzentriert.' },
    { id: 'lavender', type: 'palette', level: 18, name: 'Lavendel',   desc: 'Sanftes Violett für lange Abende.' },
    { id: 'midnight', type: 'palette', level: 27, name: 'Mitternacht',desc: 'Dunkelblau mit Sternenglanz.' },
    { id: 'coral',    type: 'palette', level: 33, name: 'Koralle',    desc: 'Leuchtendes Pink-Orange, unübersehbar.' },

    // — Gedanken-Pakete —
    { id: 'alltag',      type: 'thoughts', level: 1,  name: 'Alltag',      desc: 'Kleine Beobachtungen aus dem Bildschirmrand-Leben.' },
    { id: 'neugier',     type: 'thoughts', level: 7,  name: 'Neugier',     desc: 'Fragen, auf die niemand eine Antwort erwartet.' },
    { id: 'philosophie', type: 'thoughts', level: 13, name: 'Philosophie', desc: 'Tiefgründig. Manchmal versehentlich.' },
    { id: 'motivation',  type: 'thoughts', level: 20, name: 'Motivation',  desc: 'Aufmunterung ohne Kalenderspruch-Kitsch.' },
    { id: 'quatsch',     type: 'thoughts', level: 28, name: 'Quatsch',     desc: 'Reiner Unsinn. Wissenschaftlich geprüft.' },
    { id: 'coding',      type: 'thoughts', level: 38, name: 'Code',        desc: 'Für alle, die zu viel Zeit im Terminal verbringen.' },

    // — Effekte —
    { id: 'sparkles', type: 'effect', level: 9,  name: 'Funken',       desc: 'Kleine Funken beim Losrennen.' },
    { id: 'hearts',   type: 'effect', level: 17, name: 'Herzchen',     desc: 'Steigen beim Streicheln auf.' },
    { id: 'confetti', type: 'effect', level: 23, name: 'Konfetti',     desc: 'Konfetti bei jedem Level-Up.' },
    { id: 'stardust', type: 'effect', level: 32, name: 'Sternenstaub', desc: 'Eine leuchtende Spur beim Laufen.' },
    { id: 'aurora',   type: 'effect', level: 44, name: 'Polarlicht',   desc: 'Ein schimmernder Schleier hinter dem Pet.' },

    // — Fähigkeiten (Perks) —
    { id: 'fast-feet',   type: 'perk', level: 12, name: 'Flinke Pfoten',   desc: 'Dein Pet sprintet spürbar schneller.' },
    { id: 'chatty',      type: 'perk', level: 19, name: 'Redselig',        desc: 'Gedankenblasen erscheinen doppelt so oft.' },
    { id: 'night-owl',   type: 'perk', level: 26, name: 'Nachteule',       desc: 'Nachts gibt es besondere Gedanken.' },
    { id: 'big-heart',   type: 'perk', level: 40, name: 'Großes Herz',     desc: '+50 % XP fürs Streicheln.' },
    { id: 'legend',      type: 'perk', level: 50, name: 'Legendär',        desc: 'Maximales Level. Dein Pet trägt einen Sternenmantel.' }
  ];

  const TYPE_META = {
    pet:       { label: 'Pet',        icon: '🐾' },
    accessory: { label: 'Accessoire', icon: '🎀' },
    palette:   { label: 'Farbe',      icon: '🎨' },
    thoughts:  { label: 'Gedanken',   icon: '💭' },
    effect:    { label: 'Effekt',     icon: '✨' },
    perk:      { label: 'Fähigkeit',  icon: '⭐' }
  };

  const byId = (id) => REWARDS.find((r) => r.id === id) || null;
  const unlocked = (level) => REWARDS.filter((r) => r.level <= level);
  const unlockedIds = (level) => unlocked(level).map((r) => r.id);
  const isUnlocked = (id, level) => { const r = byId(id); return !!r && r.level <= level; };
  const unlockedOfType = (type, level) => unlocked(level).filter((r) => r.type === type);
  const rewardsAtLevel = (level) => REWARDS.filter((r) => r.level === level);
  const nextReward = (level) =>
    REWARDS.filter((r) => r.level > level).sort((a, b) => a.level - b.level)[0] || null;

  return {
    MAX_LEVEL, xpForLevel, totalXpForLevel, levelFromTotalXp,
    XP_EVENTS, REWARDS, TYPE_META,
    byId, unlocked, unlockedIds, isUnlocked, unlockedOfType,
    rewardsAtLevel, nextReward
  };
});
