/* ============================================================
   Claude Pets – Erfolge
   Jeder Erfolg misst einen Wert gegen ein Ziel. Dadurch gibt es
   überall automatisch einen Fortschrittsbalken, und dieselbe
   Auswertung läuft im Desktop- wie im Web-Build.
   ============================================================ */
(function (root, factory) {
  const Progression = (typeof module === 'object' && module.exports)
    ? require('./progression.js') : root.Progression;
  const api = factory(Progression);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Achievements = api;
})(typeof self !== 'undefined' ? self : this, function (Progression) {
  'use strict';

  const TIERS = {
    bronze: { label: 'Bronze', tone: 'bronze', xp: 25 },
    silver: { label: 'Silber', tone: 'silver', xp: 60 },
    gold:   { label: 'Gold',   tone: 'gold',   xp: 150 }
  };

  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const st = (ctx, key) => n(ctx.stats[key]);
  const countOfType = (ctx, type) =>
    Progression.unlocked(ctx.level).filter((r) => r.type === type).length;
  const totalOfType = (type) =>
    Progression.REWARDS.filter((r) => r.type === type).length;

  /* ---------------------------------------------------------
     Der Katalog
     --------------------------------------------------------- */
  const ACHIEVEMENTS = [
    /* — Bronze: die ersten Schritte — */
    { id: 'first-touch', tier: 'bronze', icon: 'paw', name: 'Erste Berührung',
      desc: 'Streichle dein Pet zum ersten Mal.', goal: 1, unit: '',
      value: (c) => st(c, 'pets') },

    { id: 'first-walk', tier: 'bronze', icon: 'boot', name: 'Erster Ausflug',
      desc: 'Schick dein Pet einmal über den Bildschirm.', goal: 1, unit: '',
      value: (c) => st(c, 'walks') },

    { id: 'first-snack', tier: 'bronze', icon: 'apple', name: 'Guten Appetit',
      desc: 'Füttere dein Pet zum ersten Mal.', goal: 1, unit: '',
      value: (c) => st(c, 'feeds') },

    { id: 'listener', tier: 'bronze', icon: 'bubble', name: 'Mitgedacht',
      desc: 'Lies 10 Gedanken deines Pets.', goal: 10, unit: 'Gedanken',
      value: (c) => st(c, 'thoughts') },

    { id: 'level-5', tier: 'bronze', icon: 'star', name: 'Angekommen',
      desc: 'Erreiche Level 5.', goal: 5, unit: 'Level',
      value: (c) => c.level },

    { id: 'streak-3', tier: 'bronze', icon: 'flame', name: 'Drei am Stück',
      desc: 'Schau an drei Tagen hintereinander vorbei.', goal: 3, unit: 'Tage',
      value: (c) => n(c.bestStreak) },

    { id: 'dress-up', tier: 'bronze', icon: 'bow', name: 'Neuer Look',
      desc: 'Leg deinem Pet ein Accessoire an.', goal: 1, unit: '',
      value: (c) => c.worn.length },

    { id: 'repaint', tier: 'bronze', icon: 'palette', name: 'Farbwechsel',
      desc: 'Probiere eine zweite Farbpalette aus.', goal: 2, unit: 'Farben',
      value: (c) => c.palettesTried.length },

    { id: 'carrier', tier: 'bronze', icon: 'paw', name: 'Umzugshelfer',
      desc: 'Trage dein Pet 20 Mal an eine andere Stelle.', goal: 20, unit: 'Mal',
      value: (c) => st(c, 'drags') },

    /* — Silber: dranbleiben — */
    { id: 'pets-100', tier: 'silver', icon: 'heart', name: 'Kraulmeister',
      desc: 'Streichle dein Pet 100 Mal.', goal: 100, unit: 'Mal',
      value: (c) => st(c, 'pets') },

    { id: 'walks-50', tier: 'silver', icon: 'boot', name: 'Wanderer',
      desc: 'Absolviere 50 Spaziergänge.', goal: 50, unit: 'Runden',
      value: (c) => st(c, 'walks') },

    { id: 'thoughts-100', tier: 'silver', icon: 'bubble', name: 'Guter Zuhörer',
      desc: 'Lies 100 Gedanken.', goal: 100, unit: 'Gedanken',
      value: (c) => st(c, 'thoughts') },

    { id: 'level-15', tier: 'silver', icon: 'star', name: 'Fortgeschritten',
      desc: 'Erreiche Level 15.', goal: 15, unit: 'Level',
      value: (c) => c.level },

    { id: 'streak-7', tier: 'silver', icon: 'flame', name: 'Eine ganze Woche',
      desc: 'Sieben Tage in Folge vorbeischauen.', goal: 7, unit: 'Tage',
      value: (c) => n(c.bestStreak) },

    { id: 'time-300', tier: 'silver', icon: 'clock', name: 'Fünf Stunden',
      desc: 'Verbringt 300 Minuten miteinander.', goal: 300, unit: 'Min.',
      value: (c) => st(c, 'minutes') },

    { id: 'feeds-25', tier: 'silver', icon: 'apple', name: 'Gut versorgt',
      desc: 'Gib deinem Pet 25 Snacks.', goal: 25, unit: 'Snacks',
      value: (c) => st(c, 'feeds') },

    { id: 'plays-25', tier: 'silver', icon: 'ball', name: 'Spielkamerad',
      desc: 'Spiele 25 Runden zusammen.', goal: 25, unit: 'Runden',
      value: (c) => st(c, 'plays') },

    { id: 'night-owl', tier: 'silver', icon: 'moon', name: 'Nachteule',
      desc: 'Streichle dein Pet 10 Mal zwischen 23 und 5 Uhr.', goal: 10, unit: 'Mal',
      value: (c) => st(c, 'nightPets') },

    { id: 'early-bird', tier: 'silver', icon: 'sun', name: 'Frühaufsteher',
      desc: 'Streichle dein Pet 10 Mal zwischen 5 und 8 Uhr.', goal: 10, unit: 'Mal',
      value: (c) => st(c, 'morningPets') },

    { id: 'far-walker', tier: 'silver', icon: 'boot', name: 'Weite Wege',
      desc: 'Lege insgesamt 25.000 Pixel zurück.', goal: 25000, unit: 'px',
      value: (c) => st(c, 'distance') },

    { id: 'wardrobe-3', tier: 'silver', icon: 'bow', name: 'Modebewusst',
      desc: 'Trage drei verschiedene Accessoires.', goal: 3, unit: 'Stück',
      value: (c) => c.worn.length },

    /* — Gold: die großen Ziele — */
    { id: 'all-pets', tier: 'gold', icon: 'trophy', name: 'Volles Haus',
      desc: 'Schalte alle sechs Charaktere frei.', goal: totalOfType('pet'), unit: 'Pets',
      value: (c) => countOfType(c, 'pet') },

    { id: 'all-colors', tier: 'gold', icon: 'palette', name: 'Farbenfroh',
      desc: 'Schalte alle Farbpaletten frei.', goal: totalOfType('palette'), unit: 'Farben',
      value: (c) => countOfType(c, 'palette') },

    { id: 'all-accessories', tier: 'gold', icon: 'bow', name: 'Kleiderschrank',
      desc: 'Schalte alle Accessoires frei.', goal: totalOfType('accessory'), unit: 'Stück',
      value: (c) => countOfType(c, 'accessory') },

    { id: 'level-30', tier: 'gold', icon: 'crown', name: 'Veteran',
      desc: 'Erreiche Level 30.', goal: 30, unit: 'Level',
      value: (c) => c.level },

    { id: 'streak-30', tier: 'gold', icon: 'flame', name: 'Ein ganzer Monat',
      desc: '30 Tage in Folge vorbeischauen.', goal: 30, unit: 'Tage',
      value: (c) => n(c.bestStreak) },

    { id: 'gourmet', tier: 'gold', icon: 'apple', name: 'Feinschmecker',
      desc: 'Gib deinem Pet 100 Snacks.', goal: 100, unit: 'Snacks',
      value: (c) => st(c, 'feeds') },

    { id: 'collector', tier: 'gold', icon: 'medal', name: 'Sammler',
      desc: 'Schalte jede einzelne Belohnung frei.', goal: Progression.REWARDS.length, unit: 'Belohnungen',
      value: (c) => Progression.unlocked(c.level).length },

    { id: 'legend', tier: 'gold', icon: 'trophy', name: 'Legende',
      desc: 'Erreiche das höchste Level.', goal: Progression.MAX_LEVEL, unit: 'Level',
      value: (c) => c.level }
  ];

  const byId = (id) => ACHIEVEMENTS.find((a) => a.id === id) || null;
  const xpFor = (a) => TIERS[a.tier].xp;

  /* ---------------------------------------------------------
     Auswertung
     --------------------------------------------------------- */
  function context(state, level) {
    return {
      stats: state.stats || {},
      level,
      bestStreak: state.bestStreak,
      streak: state.streak,
      worn: state.worn || [],
      petsTried: state.petsTried || [],
      palettesTried: state.palettesTried || []
    };
  }

  /** Fortschritt eines einzelnen Erfolgs. */
  function progressOf(a, state, level) {
    const ctx = context(state, level);
    const current = Math.max(0, Math.min(a.goal, a.value(ctx)));
    return {
      current,
      goal: a.goal,
      ratio: a.goal ? current / a.goal : 0,
      done: a.value(ctx) >= a.goal
    };
  }

  /**
   * Sucht neu erreichte Erfolge.
   * @returns {{ all: string[], newly: object[], xp: number }}
   */
  function evaluate(state, level) {
    const have = new Set(state.achievements || []);
    const ctx = context(state, level);
    const newly = [];

    ACHIEVEMENTS.forEach((a) => {
      if (have.has(a.id)) return;
      if (a.value(ctx) >= a.goal) { have.add(a.id); newly.push(a); }
    });

    return {
      all: ACHIEVEMENTS.filter((a) => have.has(a.id)).map((a) => a.id),
      newly,
      xp: newly.reduce((sum, a) => sum + xpFor(a), 0)
    };
  }

  function summary(state, level) {
    const have = new Set(state.achievements || []);
    const perTier = { bronze: 0, silver: 0, gold: 0 };
    ACHIEVEMENTS.forEach((a) => { if (have.has(a.id)) perTier[a.tier]++; });
    return {
      done: have.size,
      total: ACHIEVEMENTS.length,
      perTier,
      points: ACHIEVEMENTS.filter((a) => have.has(a.id)).reduce((s, a) => s + xpFor(a), 0)
    };
  }

  /** Sortierung fürs Dashboard: fast geschaffte zuerst, erledigte ans Ende. */
  function sorted(state, level) {
    const have = new Set(state.achievements || []);
    const order = { bronze: 0, silver: 1, gold: 2 };
    return ACHIEVEMENTS.slice().sort((a, b) => {
      const da = have.has(a.id), db = have.has(b.id);
      if (da !== db) return da ? 1 : -1;
      if (!da) {
        const pa = progressOf(a, state, level).ratio;
        const pb = progressOf(b, state, level).ratio;
        if (Math.abs(pa - pb) > 0.001) return pb - pa;
      }
      return order[a.tier] - order[b.tier];
    });
  }

  return { ACHIEVEMENTS, TIERS, byId, xpFor, evaluate, progressOf, summary, sorted, context };
});
