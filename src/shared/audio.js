/* ============================================================
   Claude Pets – Chiptune-Maschine
   Jeder Ton entsteht zur Laufzeit: Pulswellen mit einstellbarer
   Impulsbreite, gefiltertes Rauschen, kurze Hüllkurven. Im
   Repository liegt keine einzige Audiodatei.
   Läuft im Electron-Renderer wie im Browser (globales `Chip`).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Chip = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------
     Noten
     Namen wie "A4" oder "F#3" werden über die MIDI-Nummer in
     Frequenzen umgerechnet. "." hält den Ton bzw. schweigt.
     --------------------------------------------------------- */
  const SEMITONE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

  function freqOf(note) {
    const m = /^([A-G]#?)(\d)$/.exec(note);
    if (!m) return 0;
    const midi = (Number(m[2]) + 1) * 12 + SEMITONE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** "A4 . C5 | E5 . . ." → ["A4", ".", "C5", "E5", ".", ".", "."] */
  const steps = (line) => line.split(/\s+/).filter((t) => t && t !== '|');

  /* ---------------------------------------------------------
     Die Stücke
     Ein Schritt ist eine Achtelnote, vier Takte ergeben 32 Schritte.
     lead  – Melodie (Pulswelle)
     bass  – Bass (Dreieck, Oktavsprünge wie im Chiptune üblich)
     drums – k Bassdrum · s Snare · h Hi-Hat · . Pause
     --------------------------------------------------------- */
  const SONGS = {
    /* Actionmusik für Snack-Jagd und Pixel-Sprint */
    run: {
      bpm: 138,
      duty: 0.25,
      lead: steps(`A4 .  E5 .  A5 .  E5 G5 |
                   F5 .  C5 .  F5 .  E5 D5 |
                   C5 .  G4 .  C5 .  E5 G5 |
                   B4 .  D5 .  E5 .  D5 .`),
      bass: steps(`A2 A3 A2 A3 A2 A3 A2 A3 |
                   F2 F3 F2 F3 F2 F3 F2 F3 |
                   C3 C4 C3 C4 C3 C4 C3 C4 |
                   E2 E3 E2 E3 E2 E3 E2 E3`),
      drums: steps(`k h s h k h s h |
                    k h s h k h s h |
                    k h s h k h s h |
                    k h s h k s s s`)
    },

    /* Ruhige Begleitung für Gedanken-Paare */
    calm: {
      bpm: 100,
      duty: 0.5,
      lead: steps(`E4 .  A4 .  C5 .  B4 . |
                   A4 .  E4 .  G4 .  A4 . |
                   F4 .  C5 .  A4 .  G4 . |
                   E4 .  G4 .  A4 .  .  .`),
      bass: steps(`A2 .  .  .  A2 .  .  . |
                   E2 .  .  .  E2 .  .  . |
                   F2 .  .  .  F2 .  .  . |
                   G2 .  .  .  G2 .  .  .`),
      drums: steps(`.  .  h  .  .  .  h  . |
                    .  .  h  .  .  .  h  . |
                    .  .  h  .  .  .  h  . |
                    .  .  h  .  .  h  h  .`)
    }
  };

  /* ---------------------------------------------------------
     Audio-Kontext
     Browser erlauben Ton erst nach einer Nutzeraktion – deshalb
     wird der Kontext beim ersten Klick angelegt (`unlock`).
     --------------------------------------------------------- */
  let ctx = null;
  let master = null, musicBus = null, sfxBus = null;
  let enabled = true;
  let noiseBuf = null;
  const waves = new Map();

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try { ctx = new AC(); } catch (_) { return null; }

    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.34;
    musicBus.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.85;
    sfxBus.connect(master);

    /* Eine Sekunde weißes Rauschen als Grundlage für Schlagzeug und Treffer */
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    return ctx;
  }

  /**
   * Pulswelle mit einstellbarer Impulsbreite.
   * Die Fourier-Koeffizienten einer Rechteckschwingung mit Tastgrad d
   * sind a(n) = 2/(n·π) · sin(n·π·d) – daraus wird die Wellenform gebaut.
   */
  function pulse(duty) {
    const key = duty.toFixed(2);
    if (waves.has(key)) return waves.get(key);
    const n = 24;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    waves.set(key, wave);
    return wave;
  }

  /* ---------------------------------------------------------
     Stimmen
     --------------------------------------------------------- */
  /**
   * Eine Note.
   * @param {object} o { freq, to, dur, vol, duty, type, at, bus, attack }
   */
  function voice(o) {
    if (!ensure() || !enabled) return;
    const t0 = o.at || ctx.currentTime;
    const dur = o.dur || 0.12;
    const vol = o.vol === undefined ? 0.3 : o.vol;
    if (!o.freq) return;

    const osc = ctx.createOscillator();
    if (o.type) osc.type = o.type;
    else osc.setPeriodicWave(pulse(o.duty === undefined ? 0.5 : o.duty));

    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);

    const g = ctx.createGain();
    const atk = o.attack === undefined ? 0.006 : o.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g).connect(o.bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** Ein Rauschimpuls – für Schläge, Treffer und Hi-Hats. */
  function hiss(o) {
    if (!ensure() || !enabled) return;
    const t0 = o.at || ctx.currentTime;
    const dur = o.dur || 0.08;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = o.filter || 'highpass';
    filter.frequency.setValueAtTime(o.freq || 2000, t0);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(Math.max(60, o.to), t0 + dur);
    filter.Q.value = o.q || 0.8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, o.vol === undefined ? 0.2 : o.vol), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(g).connect(o.bus || sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ---------------------------------------------------------
     Klangeffekte
     Jeder Effekt ist eine kleine Partitur aus Stimmen.
     --------------------------------------------------------- */
  const SFX = {
    select: (t) => voice({ freq: freqOf('E5'), dur: 0.07, vol: 0.18, duty: 0.5, at: t }),

    start: (t) => {
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) =>
        voice({ freq: freqOf(n), dur: 0.14, vol: 0.24, duty: 0.25, at: t + i * 0.07 }));
    },

    jump: (t) => voice({ freq: freqOf('A4'), to: freqOf('A5'), dur: 0.16, vol: 0.22, duty: 0.25, at: t }),

    land: (t) => hiss({ freq: 900, to: 200, dur: 0.07, vol: 0.1, at: t }),

    coin: (t) => {
      voice({ freq: freqOf('E6'), dur: 0.06, vol: 0.2, duty: 0.25, at: t });
      voice({ freq: freqOf('B6'), dur: 0.12, vol: 0.18, duty: 0.25, at: t + 0.06 });
    },

    combo: (t) => {
      ['G5', 'B5', 'D6'].forEach((n, i) =>
        voice({ freq: freqOf(n), dur: 0.09, vol: 0.2, duty: 0.5, at: t + i * 0.05 }));
    },

    hit: (t) => {
      voice({ freq: 320, to: 60, dur: 0.3, vol: 0.28, type: 'sawtooth', at: t });
      hiss({ freq: 1800, to: 120, dur: 0.28, vol: 0.22, at: t });
    },

    miss: (t) => voice({ freq: freqOf('D4'), to: freqOf('A3'), dur: 0.22, vol: 0.2, duty: 0.5, at: t }),

    flip: (t) => voice({ freq: freqOf('C5'), to: freqOf('G5'), dur: 0.08, vol: 0.16, duty: 0.12, at: t }),

    match: (t) => {
      ['C5', 'G5', 'C6'].forEach((n, i) =>
        voice({ freq: freqOf(n), dur: 0.16, vol: 0.2, duty: 0.25, at: t + i * 0.06 }));
    },

    over: (t) => {
      ['C5', 'A4', 'F4', 'D4'].forEach((n, i) =>
        voice({ freq: freqOf(n), dur: 0.26, vol: 0.24, duty: 0.5, at: t + i * 0.13 }));
    },

    record: (t) => {
      ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) =>
        voice({ freq: freqOf(n), dur: 0.2, vol: 0.26, duty: 0.25, at: t + i * 0.09 }));
      hiss({ freq: 5000, dur: 0.5, vol: 0.06, at: t });
    }
  };

  function play(name) {
    if (!enabled) return;
    if (!ensure()) return;
    const fx = SFX[name];
    if (fx) fx(ctx.currentTime + 0.001);
  }

  /* ---------------------------------------------------------
     Sequenzer
     Geplant wird mit Vorlauf: ein Timer schaut regelmäßig ein
     Stück in die Zukunft und legt alle Noten fest, die bis dahin
     erklingen. So bleibt die Musik auch bei Last im Takt.
     --------------------------------------------------------- */
  const LOOKAHEAD = 0.14;
  let timer = null;
  let song = null;
  let step = 0;
  let nextAt = 0;

  function drum(sign, t) {
    if (sign === 'k') {
      voice({ freq: 140, to: 48, dur: 0.16, vol: 0.5, type: 'sine', at: t, bus: musicBus, attack: 0.002 });
    } else if (sign === 's') {
      hiss({ freq: 1400, dur: 0.14, vol: 0.22, at: t, bus: musicBus });
      voice({ freq: 190, to: 120, dur: 0.1, vol: 0.16, type: 'triangle', at: t, bus: musicBus });
    } else if (sign === 'h') {
      hiss({ freq: 7000, dur: 0.04, vol: 0.09, at: t, bus: musicBus });
    }
  }

  function tick() {
    if (!ctx || !song) return;
    const beat = 60 / song.bpm / 2; // ein Schritt = Achtelnote
    while (nextAt < ctx.currentTime + LOOKAHEAD) {
      const i = step % song.lead.length;
      const lead = song.lead[i];
      const bass = song.bass[i % song.bass.length];
      const hit = song.drums[i % song.drums.length];

      if (lead && lead !== '.') {
        voice({ freq: freqOf(lead), dur: beat * 1.6, vol: 0.2, duty: song.duty, at: nextAt, bus: musicBus });
      }
      if (bass && bass !== '.') {
        voice({ freq: freqOf(bass), dur: beat * 0.9, vol: 0.3, type: 'triangle', at: nextAt, bus: musicBus });
      }
      drum(hit, nextAt);

      nextAt += beat;
      step++;
    }
  }

  function music(id) {
    if (!enabled) return;
    if (!ensure()) return;
    const next = SONGS[id];
    if (!next || song === next) return;
    stopMusic();
    song = next;
    step = 0;
    nextAt = ctx.currentTime + 0.08;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.exponentialRampToValueAtTime(0.34, ctx.currentTime + 0.6);
    tick();
    timer = setInterval(tick, 40);
  }

  function stopMusic(fade) {
    if (timer) { clearInterval(timer); timer = null; }
    song = null;
    if (ctx && musicBus && fade) {
      const now = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(Math.max(0.0002, musicBus.gain.value), now);
      musicBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    }
  }

  return {
    /** Beim ersten Klick aufrufen – vorher erlaubt der Browser keinen Ton. */
    unlock() { ensure(); },
    setEnabled(on) {
      enabled = !!on;
      if (!enabled) stopMusic();
      else ensure();
    },
    isEnabled: () => enabled,
    isPlaying: () => !!song,
    play,
    music,
    stopMusic,
    freqOf,
    SONGS
  };
});
