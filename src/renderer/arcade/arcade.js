/* ============================================================
   Claude Pets – Arcade
   Drei Minispiele auf einer 320x180-Pixelbühne.

   Drei Grundsätze halten das Bild sauber:
   1. Alles liegt auf ganzen Pixeln. Keine halben Rechtecke, keine
      freien Drehungen – gedreht wird höchstens in Vierteln.
   2. Hintergründe entstehen einmal vorab als fertige Streifen und
      werden danach nur noch versetzt kopiert.
   3. Die Physik läuft in festen Schritten (60/s), unabhängig von
      der Bildrate des Geräts. Dadurch fühlt sich ein Sprung auf
      jedem Bildschirm gleich an.

   Der Held ist immer das Pet, das gerade angelegt ist.
   ============================================================ */
(function (root, factory) {
  root.Arcade = factory(root.Pixel, root.PetArt, root.Icons, root.Chip);
})(typeof self !== 'undefined' ? self : this, function (Pixel, PetArt, Icons, Chip) {
  'use strict';

  const VW = 320, VH = 180;      // Bühnenmaß in Pixeln
  const GROUND = 150;            // Oberkante des Bodens
  const STEP = 1 / 60;           // fester Simulationsschritt
  const TAU = Math.PI * 2;

  /* Farben – abgestimmte Pixel-Rampen statt beliebiger Verläufe */
  const C = {
    sky1: '#FDF2EA', sky2: '#FBE8DC', sky3: '#F8DDCE',
    hillFar: '#F1D9CA', hillFarEdge: '#E9CBB7',
    hillNear: '#E7C7B1', hillNearEdge: '#DCB59C',
    ground: '#E3D3BD', groundTop: '#D3BFA4', groundDot: '#C9B294',
    ink: '#2E2E2B', ink2: '#56564F', ink3: '#86867C',
    cream: '#FBEFE6', paper: '#FDF7F2',
    orange: '#D97757', orangeDeep: '#BF5C3C', orangeSoft: '#EFA47F',
    gold: '#E8B44A', goldDeep: '#C0902B', white: '#FFFFFF'
  };

  /* ---------------------------------------------------------
     Posen
     PetArt.frame() nimmt jede Pose entgegen – die Arcade bringt
     deshalb ihre eigenen mit: Sprung, Fall, Landung, Aua.
     bob verschiebt den Körper, die Beine bleiben stehen; genau
     daraus entsteht das Stauchen und Strecken, ganz ohne das
     Sprite zu verzerren.
     --------------------------------------------------------- */
  const POSE = {
    idle:   [{ bob: 0, legs: 0, eyes: 'open' }, { bob: 1, legs: 0, eyes: 'open' }],
    blink:  [{ bob: 0, legs: 0, eyes: 'closed' }],
    walk:   [{ bob: 0, legs: 0, eyes: 'open' }, { bob: 1, legs: 1, eyes: 'open' },
             { bob: 0, legs: 2, eyes: 'open' }, { bob: 1, legs: 3, eyes: 'open' }],
    run:    [{ bob: 0, legs: 1, eyes: 'open' }, { bob: 1, legs: 2, eyes: 'open' },
             { bob: 0, legs: 3, eyes: 'open' }, { bob: 1, legs: 0, eyes: 'open' }],
    jump:   [{ bob: 0, legs: 1, eyes: 'open' }],
    fall:   [{ bob: 1, legs: 3, eyes: 'open' }],
    land:   [{ bob: 2, legs: 0, eyes: 'closed' }],
    hurt:   [{ bob: 2, legs: 2, eyes: 'closed' }],
    happy:  [{ bob: 0, legs: 1, eyes: 'happy' }, { bob: 2, legs: 3, eyes: 'happy' }],
    cheer:  [{ bob: 0, legs: 1, eyes: 'happy' }, { bob: 1, legs: 3, eyes: 'happy' }]
  };

  /* Wie schnell ein Zustand durchläuft (Bilder je Sekunde) */
  const POSE_FPS = { idle: 2.5, walk: 8, run: 12, happy: 6, cheer: 5, blink: 1, jump: 1, fall: 1, land: 1, hurt: 1 };

  /* ---------------------------------------------------------
     Eigene Sprites (16x16)
     1 Kontur · 2 Haupt · 3 hell · 4 dunkel · 5 creme
     6 Gold · 7 Orange · 8 Weiß · 9 Grün
     --------------------------------------------------------- */
  const TONES = {
    1: '#3A3A36', 2: '#56564F', 3: '#86867C', 4: '#2E2E2B',
    5: '#FBEFE6', 6: '#E8B44A', 7: '#D97757', 8: '#FFFFFF', 9: '#7C9A8E'
  };

  const SPRITES = {
    bomb(c) {
      c.ell(8, 10, 5, 5, '2');
      c.ell(6.5, 8.5, 2, 1.5, '3');
      c.rect(9, 3, 2, 2, '4');
      c.line(10, 3, 13, 1, '7');
      c.set(13, 0, '6'); c.set(14, 1, '6'); c.set(13, 1, '8');
      c.ell(8, 13, 4, 2, '1', true);
    },
    rock(c) {
      c.ell(8, 11, 6, 4, '3');
      c.ell(6, 9, 3.5, 3, '3');
      c.ell(10.5, 9.5, 3, 2.5, '3');
      c.ell(6, 8.5, 2, 1.5, '5', true);
      c.rect(2, 14, 12, 1, '2');
    },
    stone(c) {
      c.ell(8, 12, 4, 2.5, '3');
      c.ell(6.5, 11, 2, 1.5, '5', true);
      c.rect(4, 14, 9, 1, '2');
    },
    cactus(c) {
      c.rect(7, 2, 3, 13, '9');
      c.rect(4, 6, 2, 5, '9'); c.rect(6, 6, 1, 1, '9');
      c.rect(11, 8, 2, 4, '9'); c.rect(10, 8, 1, 1, '9');
      c.set(8, 4, '5'); c.set(8, 8, '5'); c.set(5, 8, '5');
    },
    cloud(c) {
      c.ell(6, 9, 4, 2.5, '8');
      c.ell(10, 8, 3.5, 3, '8');
      c.ell(12, 10, 3, 2, '8');
      c.ell(6, 10.5, 4, 1, '5', true);
      c.ell(11, 10.5, 4, 1.5, '5', true);
    },
    /* Emblem auf dem Kartenrücken */
    back(c) {
      c.ell(8, 8, 5, 5, '5');
      c.ell(8, 8, 3, 3, '7');
      c.ell(8, 7, 1.5, 1.5, '5');
      c.set(3, 3, '5'); c.set(12, 3, '5'); c.set(3, 12, '5'); c.set(12, 12, '5');
    }
  };

  /* ---------------------------------------------------------
     Raster → Leinwand
     Jedes Sprite wird einmal in Originalgröße vorgerendert und
     danach nur noch kopiert.
     --------------------------------------------------------- */
  const cache = new Map();

  function surface(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { cv, g };
  }

  function raster(key, w, h, grid, colors) {
    if (cache.has(key)) return cache.get(key);
    const { cv, g } = surface(w, h);
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const ch = grid[y * w + x];
        if (ch === '.') { x++; continue; }
        let len = 1;
        while (x + len < w && grid[y * w + x + len] === ch) len++;
        const fill = colors[ch];
        if (fill) { g.fillStyle = fill; g.fillRect(x, y, len, 1); }
        x += len;
      }
    }
    cache.set(key, cv);
    return cv;
  }

  /** Ein Frame des angelegten Pets in einer beliebigen Pose. */
  function petSprite(look, state, index) {
    const poses = POSE[state] || POSE.idle;
    const i = ((index % poses.length) + poses.length) % poses.length;
    const key = `pet:${look.pet}:${look.palette}:${look.accessory || '-'}:${state}:${i}`;
    if (cache.has(key)) return cache.get(key);
    const colors = PetArt.colorsOf(look.palette);
    return raster(key, PetArt.W, PetArt.H,
      PetArt.frame(look.pet, poses[i], colors, look.accessory), colors);
  }

  const iconSprite = (name, tone) =>
    raster(`icon:${name}:${tone}`, Icons.SIZE, Icons.SIZE,
      Icons.grid(name), Icons.TONES[tone] || Icons.TONES.brand);

  function ownSprite(name) {
    const key = 'own:' + name;
    if (cache.has(key)) return cache.get(key);
    const c = new Pixel.Canvas(16, 16);
    SPRITES[name](c);
    if (name !== 'back' && name !== 'cloud') c.outline('1');
    return raster(key, 16, 16, c.g, TONES);
  }

  /** Vergrößert ein Sprite um einen ganzzahligen Faktor – bleibt scharf. */
  function upscale(img, k) {
    const { cv, g } = surface(img.width * k, img.height * k);
    g.drawImage(img, 0, 0, img.width * k, img.height * k);
    return cv;
  }

  /* ---------------------------------------------------------
     Zeichenhelfer – alle mit ganzen Zahlen
     --------------------------------------------------------- */
  const px = Math.round;

  function blit(g, img, x, y, flip) {
    x = px(x); y = px(y);
    if (!flip) { g.drawImage(img, x, y); return; }
    g.save();
    g.translate(x + img.width, y);
    g.scale(-1, 1);
    g.drawImage(img, 0, 0);
    g.restore();
  }

  function fill(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(px(x), px(y), px(w), px(h));
  }

  /** Weicher Schatten unter einer Figur – zwei Streifen, ganze Pixel. */
  function shadow(g, cx, y, w, alpha) {
    const a = alpha === undefined ? 1 : alpha;
    if (a <= 0.02) return;
    const half = Math.max(2, px(w / 2));
    g.globalAlpha = 0.14 * a;
    fill(g, cx - half, y, half * 2, 2, C.ink);
    g.globalAlpha = 0.09 * a;
    fill(g, cx - half + 2, y - 1, half * 2 - 4, 1, C.ink);
    g.globalAlpha = 1;
  }

  function text(g, str, x, y, o) {
    const opt = o || {};
    g.font = `${opt.weight || 700} ${opt.size || 10}px "Inter", "Segoe UI", sans-serif`;
    g.textAlign = opt.align || 'center';
    g.textBaseline = opt.baseline || 'middle';
    if (opt.shadow !== false) {
      g.fillStyle = 'rgba(46,46,43,.20)';
      g.fillText(str, px(x), px(y) + 1);
    }
    g.fillStyle = opt.color || C.ink;
    g.fillText(str, px(x), px(y));
  }

  /* ---------------------------------------------------------
     Kulisse
     Himmel, Hügel und Boden entstehen einmal als fertige Streifen.
     Gezeichnet wird danach nur noch versetztes Kopieren – das ist
     schnell und bleibt pixelgenau.
     --------------------------------------------------------- */
  const BAND = 640;            // Breite der Streifen (2x Bühne, nahtlos)
  const layer = {};

  /** Deterministischer Zufall – gleiche Kulisse bei jedem Start. */
  function rnd(seed) {
    let s = seed;
    return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  }

  function makeSky() {
    const { cv, g } = surface(VW, VH);
    g.fillStyle = C.sky1; g.fillRect(0, 0, VW, 64);
    g.fillStyle = C.sky2; g.fillRect(0, 64, VW, 44);
    g.fillStyle = C.sky3; g.fillRect(0, 108, VW, VH - 108);
    // Zwei Dither-Reihen je Übergang – der klassische Verlauf in Pixelkunst
    const dither = (y, color, odd) => {
      g.fillStyle = color;
      for (let x = odd; x < VW; x += 2) g.fillRect(x, y, 1, 1);
    };
    dither(62, C.sky2, 0); dither(63, C.sky2, 1);
    dither(106, C.sky3, 0); dither(107, C.sky3, 1);
    return cv;
  }

  function makeHills(o) {
    const { cv, g } = surface(BAND, o.h);
    for (let x = 0; x < BAND; x++) {
      const h = Math.round(
        o.base +
        Math.sin((x / BAND) * TAU * o.k1) * o.amp +
        Math.sin((x / BAND) * TAU * o.k2 + 1.4) * o.amp * 0.45
      );
      const top = o.h - h;
      g.fillStyle = o.fill;
      g.fillRect(x, top, 1, h);
      // Eine saubere Kante auf der Kuppe – gepunktet wirkt sie nur unruhig.
      g.fillStyle = o.edge;
      g.fillRect(x, top, 1, 1);
    }
    return cv;
  }

  function makeGround() {
    const h = VH - GROUND;
    const { cv, g } = surface(BAND, h);
    g.fillStyle = C.ground; g.fillRect(0, 0, BAND, h);
    g.fillStyle = C.groundTop; g.fillRect(0, 0, BAND, 1);
    const r = rnd(7311);
    g.fillStyle = C.groundDot;
    for (let i = 0; i < 150; i++) {
      const x = Math.floor(r() * (BAND - 6));
      const y = 4 + Math.floor(r() * (h - 7));
      g.fillRect(x, y, 2 + Math.floor(r() * 3), 1);
    }
    return cv;
  }

  function buildLayers() {
    if (layer.sky) return;
    layer.sky = makeSky();
    layer.hillFar = makeHills({ h: 58, base: 30, amp: 8, k1: 3, k2: 7, fill: C.hillFar, edge: C.hillFarEdge });
    layer.hillNear = makeHills({ h: 40, base: 22, amp: 6, k1: 5, k2: 11, fill: C.hillNear, edge: C.hillNearEdge });
    layer.ground = makeGround();
    layer.cloud2 = upscale(ownSprite('cloud'), 2);
    layer.cloud3 = upscale(ownSprite('cloud'), 3);
  }

  /** Kopiert einen Streifen nahtlos an die Position x. */
  function band(g, img, x, y) {
    const off = ((px(x) % img.width) + img.width) % img.width;
    g.drawImage(img, -off, y);
    if (img.width - off < VW) g.drawImage(img, img.width - off, y);
  }

  const CLOUDS = [[20, 22, 0.16, 'cloud3'], [140, 36, 0.10, 'cloud2'], [246, 16, 0.22, 'cloud2']];

  function clouds(g, x) {
    CLOUDS.forEach(([start, y, speed, kind]) => {
      const img = layer[kind];
      const span = VW + img.width;
      const pos = ((start - x * speed) % span + span) % span - img.width;
      g.drawImage(img, px(pos), y);
    });
  }

  /** Die komplette Kulisse für einen Bildaufbau. */
  function backdrop(g, scroll) {
    g.drawImage(layer.sky, 0, 0);
    clouds(g, scroll);
    band(g, layer.hillFar, scroll * 0.30, GROUND - layer.hillFar.height);
    band(g, layer.hillNear, scroll * 0.55, GROUND - layer.hillNear.height);
    band(g, layer.ground, scroll, GROUND);
  }

  /* ---------------------------------------------------------
     Die Bühne
     Zeit, Partikel, Zahlenflug und Bildruckeln – alles, was sich
     die drei Spiele teilen.
     --------------------------------------------------------- */
  function Stage(ctx, look) {
    this.g = ctx;
    this.look = look;
    this.t = 0;
    this.score = 0;
    this.status = '';
    this.done = false;
    this.parts = [];
    this.floats = [];
    this.shake = 0;
    this.flash = 0;
    this.blinkAt = 2 + Math.random() * 3;
    this.blink = 0;
  }

  /** Staub, Funken, Krümel – immer auf ganzen Pixeln. */
  Stage.prototype.burst = function (x, y, o) {
    const opt = o || {};
    const n = opt.count || 8;
    for (let i = 0; i < n; i++) {
      const a = opt.up ? -Math.PI / 2 + (Math.random() - 0.5) * (opt.spread || 2.4)
                       : Math.random() * TAU;
      const v = (opt.power || 55) * (0.35 + Math.random() * 0.75);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opt.lift || 14),
        life: (opt.life || 0.5) * (0.7 + Math.random() * 0.6), age: 0,
        size: Math.random() < 0.28 ? 2 : 1,
        gravity: opt.gravity === undefined ? 220 : opt.gravity,
        color: opt.color || C.ink3
      });
    }
  };

  Stage.prototype.float = function (x, y, str, color) {
    this.floats.push({ x, y, str, color: color || C.orangeDeep, age: 0, life: 0.85 });
  };

  /** Blinzeln: alle paar Sekunden für einen Moment die Augen zu. */
  Stage.prototype.tickBlink = function (dt) {
    if (this.blink > 0) {
      this.blink -= dt;
      if (this.blink <= 0) this.blinkAt = 2.5 + Math.random() * 3.5;
    } else {
      this.blinkAt -= dt;
      if (this.blinkAt <= 0) this.blink = 0.12;
    }
  };

  Stage.prototype.tickEffects = function (dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= p.life) this.parts.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.age += dt;
      f.y -= 20 * dt;
      if (f.age >= f.life) this.floats.splice(i, 1);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.4);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 5);
    this.tickBlink(dt);
  };

  Stage.prototype.drawEffects = function () {
    const g = this.g;
    this.parts.forEach((p) => {
      const left = 1 - p.age / p.life;
      g.globalAlpha = left > 0.55 ? 1 : Math.max(0, left / 0.55);
      fill(g, p.x, p.y, p.size, p.size, p.color);
    });
    g.globalAlpha = 1;
    this.floats.forEach((f) => {
      const k = f.age / f.life;
      g.globalAlpha = k < 0.15 ? k / 0.15 : Math.max(0, 1 - Math.pow((k - 0.15) / 0.85, 2));
      text(g, f.str, f.x, f.y, { size: 11, color: f.color });
    });
    g.globalAlpha = 1;
  };

  /** Zustand des Pets inklusive Blinzeln. */
  Stage.prototype.petState = function (base) {
    if (this.blink > 0 && (base === 'idle' || base === 'walk')) return 'blink';
    return base;
  };

  /** Bildnummer für einen Zustand. */
  Stage.prototype.poseFrame = function (state, speedFactor) {
    const fps = (POSE_FPS[state] || 4) * (speedFactor || 1);
    return Math.floor(this.t * fps);
  };

  /* =========================================================
     Spiel 1 · Snack-Jagd
     ========================================================= */
  const CatchGame = {
    id: 'catch',
    music: 'run',
    intro: 2.2,
    hint: 'Pfeiltasten · A/D · ziehen',

    init(s) {
      s.px = VW / 2;
      s.vx = 0;
      s.target = null;
      s.dir = 1;
      s.items = [];
      s.spawn = 0.6;
      s.lives = 3;
      s.lifePop = 0;
      s.combo = 0;
      s.face = 'idle';
      s.faceTimer = 0;
      s.scroll = 0;
      this.label(s);
    },

    label(s) {
      s.status = s.combo > 1 ? `Serie ×${s.combo}` : '';
    },

    spawnItem(s) {
      const hard = Math.min(1, s.t / 75);
      const bomb = Math.random() < 0.16 + hard * 0.17;
      const kinds = ['apple', 'egg', 'heart', 'star', 'medal'];
      s.items.push({
        x: 16 + Math.random() * (VW - 32),
        y: -16,
        vy: 54 + hard * 74 + Math.random() * 16,
        phase: Math.random() * TAU,
        bomb,
        name: bomb ? 'bomb' : kinds[(Math.random() * kinds.length) | 0]
      });
    },

    update(s, dt, keys) {
      const hard = Math.min(1, s.t / 75);
      s.scroll += 16 * dt;

      /* Bewegung mit Beschleunigung – das läuft runder als ein harter Sprung */
      const top = 172;
      let wish = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) wish -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) wish += 1;

      if (s.target !== null) {
        const diff = s.target - s.px;
        wish = Math.abs(diff) < 1.5 ? 0 : Math.sign(diff);
        if (Math.abs(diff) < 12) wish *= Math.abs(diff) / 12;
      }

      const want = wish * top;
      const accel = (wish ? 1100 : 1500) * dt;
      s.vx += Math.max(-accel, Math.min(accel, want - s.vx));
      s.px = Math.max(16, Math.min(VW - 16, s.px + s.vx * dt));
      if (Math.abs(s.vx) > 8) s.dir = s.vx > 0 ? 1 : -1;
      s.moving = Math.abs(s.vx) > 12;

      /* Nachschub */
      s.spawn -= dt;
      if (s.spawn <= 0) {
        this.spawnItem(s);
        s.spawn = 0.8 - hard * 0.46 + Math.random() * 0.18;
      }

      const petTop = GROUND - 30;
      for (let i = s.items.length - 1; i >= 0; i--) {
        const it = s.items[i];
        it.y += it.vy * dt;

        const caught = it.y + 13 > petTop && it.y < petTop + 22 && Math.abs(it.x + 8 - s.px) < 17;
        if (caught) {
          s.items.splice(i, 1);
          if (it.bomb) {
            s.lives--;
            s.lifePop = 1;
            s.combo = 0;
            s.shake = 1;
            s.flash = 1;
            s.burst(it.x + 8, it.y + 8, { count: 18, power: 95, color: C.ink2, life: 0.55 });
            s.burst(it.x + 8, it.y + 8, { count: 6, power: 60, color: C.orangeDeep });
            Chip.play('hit');
            s.face = 'hurt'; s.faceTimer = 0.7;
            if (s.lives <= 0) s.done = true;
          } else {
            s.combo++;
            let gain = 1;
            if (s.combo % 5 === 0) {
              gain += 3;
              s.float(it.x + 8, it.y - 6, `Serie ×${s.combo}!`, C.goldDeep);
              s.burst(it.x + 8, it.y + 8, { count: 14, power: 80, color: C.gold, up: true });
              Chip.play('combo');
            } else {
              s.burst(it.x + 8, it.y + 8, { count: 7, power: 52, color: C.orangeSoft, up: true });
              Chip.play('coin');
            }
            s.score += gain;
            s.float(it.x + 8, it.y - 2, '+' + gain);
            s.face = 'happy'; s.faceTimer = 0.4;
          }
          this.label(s);
          continue;
        }

        if (it.y > GROUND - 10) {
          s.items.splice(i, 1);
          s.burst(it.x + 8, GROUND - 1, {
            count: it.bomb ? 12 : 5, power: it.bomb ? 70 : 38,
            color: it.bomb ? C.ink2 : C.groundDot, up: true, spread: 1.6, life: 0.4
          });
          if (!it.bomb) {
            if (s.combo > 2) s.float(it.x + 8, GROUND - 22, 'Serie weg', C.ink3);
            s.combo = 0;
            this.label(s);
            Chip.play('miss');
          }
        }
      }

      if (s.faceTimer > 0) {
        s.faceTimer -= dt;
        if (s.faceTimer <= 0) s.face = 'idle';
      }
      if (s.lifePop > 0) s.lifePop = Math.max(0, s.lifePop - dt * 2.2);
    },

    draw(s) {
      const g = s.g;
      backdrop(g, s.scroll);

      /* Zielmarken: kurz bevor etwas ankommt, zeigt der Boden wo */
      s.items.forEach((it) => {
        const left = (GROUND - 10 - it.y) / it.vy;
        if (left > 0 && left < 0.9) {
          g.globalAlpha = 0.10 + (1 - left / 0.9) * 0.16;
          fill(g, it.x + 2, GROUND - 2, 12, 2, C.ink);
          g.globalAlpha = 1;
        }
      });

      /* Fallende Sachen wippen in ganzen Pixeln statt sich zu drehen */
      s.items.forEach((it) => {
        const wobble = Math.round(Math.sin(s.t * 6 + it.phase));
        const img = it.bomb ? ownSprite('bomb') : iconSprite(it.name, 'brand');
        blit(g, img, it.x + wobble, it.y, it.bomb ? false : wobble > 0);
      });

      /* Das Pet */
      const base = s.face === 'happy' ? 'happy'
        : s.face === 'hurt' ? 'hurt'
        : (s.moving ? 'walk' : 'idle');
      const state = s.petState(base);
      const rate = base === 'walk' ? Math.min(1.6, 0.6 + Math.abs(s.vx) / 150) : 1;
      shadow(g, s.px, GROUND, 20);
      blit(g, petSprite(s.look, state, s.poseFrame(state, rate)), s.px - 16, GROUND - 30, s.dir < 0);

      /* Leben oben links, das verlorene Herz zuckt kurz nach */
      for (let i = 0; i < 3; i++) {
        const lost = i >= s.lives;
        const pop = (i === s.lives && s.lifePop > 0) ? Math.round(Math.sin(s.lifePop * 22) * 2) : 0;
        g.globalAlpha = lost ? 0.25 : 1;
        blit(g, iconSprite('heart', lost ? 'muted' : 'brand'), 6 + i * 15 + pop, 6);
        g.globalAlpha = 1;
      }

      /* Serie als kleine Fahne über dem Pet */
      if (s.combo > 1) {
        const y = GROUND - 44 + Math.round(Math.sin(s.t * 5) * 1);
        text(g, `×${s.combo}`, s.px, y, { size: 11, color: C.orangeDeep });
      }
    },

    pointer(s, p) {
      if (p.type === 'up') s.target = null;
      else s.target = Math.max(16, Math.min(VW - 16, p.x));
    }
  };

  /* =========================================================
     Spiel 2 · Pixel-Sprint
     ========================================================= */
  const RunnerGame = {
    id: 'runner',
    music: 'run',
    intro: 2.2,
    hint: 'Leertaste · tippen zum Springen',

    init(s) {
      s.px = 52;
      s.py = GROUND - 30;
      s.vy = 0;
      s.onGround = true;
      s.hold = 0;
      s.buffer = 0;       // gepufferter Sprung kurz vor der Landung
      s.landing = 0;      // Stauchen nach dem Aufkommen
      s.speed = 84;
      s.dist = 0;
      s.coins = 0;
      s.obstacles = [];
      s.stars = [];
      s.nextGap = 150;
      s.dead = 0;
      s.status = '0 m';
    },

    jump(s) {
      if (s.done || s.dead) return;
      if (!s.onGround) { s.buffer = 0.14; return; }
      s.vy = -198;
      s.onGround = false;
      s.hold = 0.2;
      s.buffer = 0;
      s.burst(s.px, GROUND - 1, { count: 7, power: 42, color: C.groundDot, up: true, spread: 2.2, life: 0.35 });
      Chip.play('jump');
    },

    update(s, dt, keys) {
      if (s.dead) {
        s.dead += dt;
        s.vy += 620 * dt;
        s.py = Math.min(GROUND - 24, s.py + s.vy * dt);
        if (s.dead > 1.15) s.done = true;
        return;
      }

      s.speed = Math.min(180, 84 + s.t * 1.7);
      s.dist += s.speed * dt;
      s.score = Math.floor(s.dist / 10) + s.coins * 10;
      s.status = `${Math.floor(s.dist / 10)} m   ·   ${s.coins} ${s.coins === 1 ? 'Stern' : 'Sterne'}`;

      /* Sprung: länger gedrückt heißt höher */
      const held = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW') || s.pointerDown;
      if (held && s.hold > 0 && s.vy < 0) {
        s.vy -= 470 * dt;
        s.hold -= dt;
      } else s.hold = 0;

      s.vy += 620 * dt;
      s.py += s.vy * dt;

      if (s.py >= GROUND - 30) {
        if (!s.onGround) {
          s.landing = 0.16;
          s.burst(s.px, GROUND - 1, { count: 6, power: 34, color: C.groundDot, up: true, spread: 2.6, life: 0.3 });
          Chip.play('land');
        }
        s.py = GROUND - 30;
        s.vy = 0;
        s.onGround = true;
        if (s.buffer > 0) { s.buffer = 0; this.jump(s); }
      }
      if (s.buffer > 0) s.buffer -= dt;
      if (s.landing > 0) s.landing -= dt;

      /* Nachschub: der Abstand richtet sich nach dem Tempo,
         damit jede Lücke auch wirklich zu schaffen ist. */
      s.nextGap -= s.speed * dt;
      if (s.nextGap <= 0) {
        const roll = Math.random();
        s.obstacles.push({ x: VW + 8, kind: roll < 0.4 ? 'rock' : roll < 0.7 ? 'stone' : 'cactus' });
        if (Math.random() < 0.7) {
          const high = Math.random() < 0.5;
          const n = 1 + ((Math.random() * 3) | 0);
          for (let i = 0; i < n; i++) {
            s.stars.push({ x: VW + 44 + i * 17, y: high ? GROUND - 62 : GROUND - 34, phase: i * 0.6 });
          }
        }
        s.nextGap = s.speed * (0.95 + Math.random() * 0.7);
      }

      const dx = s.speed * dt;
      for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const o = s.obstacles[i];
        o.x -= dx;
        const low = o.kind === 'stone';
        const top = GROUND - (low ? 7 : 15);
        if (o.x < s.px + 9 && o.x + 13 > s.px - 9 && s.py + 30 > top + 3) {
          s.dead = 0.001;
          s.vy = -145;
          s.shake = 1;
          s.flash = 1;
          s.burst(s.px, s.py + 18, { count: 18, power: 95, color: C.orangeDeep });
          Chip.play('hit');
        }
        if (o.x < -20) s.obstacles.splice(i, 1);
      }

      for (let i = s.stars.length - 1; i >= 0; i--) {
        const c = s.stars[i];
        c.x -= dx;
        if (Math.abs(c.x + 8 - s.px) < 15 && Math.abs(c.y + 8 - (s.py + 16)) < 17) {
          s.coins++;
          s.burst(c.x + 8, c.y + 8, { count: 10, power: 65, color: C.gold, up: true });
          s.float(c.x + 8, c.y - 2, '+10', C.goldDeep);
          Chip.play('coin');
          s.stars.splice(i, 1);
          continue;
        }
        if (c.x < -20) s.stars.splice(i, 1);
      }
    },

    draw(s) {
      const g = s.g;
      backdrop(g, s.dist);

      s.stars.forEach((c) => {
        const bob = Math.round(Math.sin(s.t * 3.4 + c.phase) * 2);
        blit(g, iconSprite('star', 'gold'), c.x, c.y + bob);
      });

      s.obstacles.forEach((o) => {
        const img = ownSprite(o.kind);
        blit(g, img, o.x, GROUND - 15);
      });

      /* Schatten schrumpft mit der Höhe – verrät, wo das Pet landet */
      const height = Math.max(0, (GROUND - 30 - s.py) / 40);
      if (!s.dead) shadow(g, s.px, GROUND, 20 - height * 7, 1 - height * 0.55);

      let state, frame;
      if (s.dead) {
        state = 'hurt'; frame = 0;
      } else if (!s.onGround) {
        state = s.vy < -20 ? 'jump' : 'fall'; frame = 0;
      } else if (s.landing > 0) {
        state = 'land'; frame = 0;
      } else {
        state = s.petState('run');
        frame = s.poseFrame('run', Math.min(1.5, 0.7 + s.speed / 220));
      }

      g.save();
      if (s.dead) {
        /* Eine Vierteldrehung, mehr nicht: pixelgenau und lesbar */
        const quarter = Math.min(1, Math.floor(s.dead * 5));
        g.translate(px(s.px), px(s.py + 16));
        g.rotate((quarter * Math.PI) / 2);
        g.translate(-px(s.px), -px(s.py + 16));
      }
      blit(g, petSprite(s.look, state, frame), s.px - 16, s.py);
      g.restore();
    },

    key(s, code, down) {
      if (down && (code === 'Space' || code === 'ArrowUp' || code === 'KeyW')) this.jump(s);
    },

    pointer(s, p) {
      if (p.type === 'down') { s.pointerDown = true; this.jump(s); }
      if (p.type === 'up') s.pointerDown = false;
    }
  };

  /* =========================================================
     Spiel 3 · Gedanken-Paare
     ========================================================= */
  const CARD_W = 54, CARD_H = 38, CARD_GAP_X = 7, CARD_GAP_Y = 7, CARD_X = 8, CARD_Y = 14;

  const MemoryGame = {
    id: 'memory',
    music: 'calm',
    intro: 1.2,
    hint: 'Karte antippen',

    init(s) {
      const pool = ['apple', 'heart', 'star', 'moon', 'sun', 'flame', 'egg', 'bow', 'crown', 'medal', 'sparkles', 'ball'];
      const shuffle = (a) => {
        for (let i = a.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };
      const picks = shuffle(pool.slice()).slice(0, 6);
      const deck = shuffle(picks.concat(picks));

      s.cards = deck.map((name, i) => ({
        name,
        x: CARD_X + (i % 4) * (CARD_W + CARD_GAP_X),
        y: CARD_Y + Math.floor(i / 4) * (CARD_H + CARD_GAP_Y),
        open: 1, matched: false, flip: 1, pop: 0, sink: 0
      }));
      s.open = [];
      s.moves = 0;
      s.pairs = 0;
      s.lock = 1.9;          // Einprägen: kurz liegen alle offen
      s.started = false;
      s.elapsed = 0;
      s.cheer = 0;
      s.scroll = 0;
      s.score = this.points(s);
      s.status = 'Einprägen …';
    },

    /** Punkte: Grundwert minus Zeit und Züge, nie unter null. */
    points(s) {
      return Math.max(0, Math.round(900 - (s.elapsed || 0) * 7 - (s.moves || 0) * 10));
    },

    update(s, dt) {
      s.scroll += 8 * dt;

      if (s.lock > 0) {
        s.lock -= dt;
        if (s.lock <= 0) {
          s.cards.forEach((c) => { if (!c.matched) c.open = 0; });
          s.open = [];
          if (!s.started) {
            s.started = true;
            s.status = '0 Züge   ·   0/6 Paare';
            Chip.play('flip');
          }
        }
      } else if (!s.done) {
        s.elapsed += dt;
        s.score = this.points(s);
        s.status = `${s.moves} ${s.moves === 1 ? 'Zug' : 'Züge'}   ·   ${s.pairs}/6 Paare`;
      }

      s.cards.forEach((c) => {
        /* Weiches Ankommen statt linearem Umklappen */
        const want = c.open ? 1 : 0;
        c.flip += (want - c.flip) * Math.min(1, dt * 13);
        if (Math.abs(want - c.flip) < 0.004) c.flip = want;
        if (c.pop > 0) c.pop = Math.max(0, c.pop - dt * 3);
        if (c.matched && c.sink < 1) c.sink = Math.min(1, c.sink + dt * 4);
      });

      if (s.cheer > 0) s.cheer -= dt;

      if (s.pairs === 6 && !s.done) {
        s.score = this.points(s);
        s.done = true;
      }
    },

    draw(s) {
      const g = s.g;
      backdrop(g, s.scroll);

      /* Das Pet schaut von rechts zu */
      const cheering = s.cheer > 0 || s.pairs === 6;
      const base = cheering ? 'cheer' : 'idle';
      const state = s.petState(base);
      const bob = Math.round(Math.sin(s.t * 2.2));
      shadow(g, VW - 46, GROUND, 20);
      blit(g, petSprite(s.look, state, s.poseFrame(state)), VW - 62, GROUND - 30 + bob);

      s.cards.forEach((c) => {
        const open = c.flip;
        const w = Math.max(2, px(CARD_W * Math.abs(open * 2 - 1)));
        const cx = px(c.x + CARD_W / 2);
        const lift = px(c.pop * 2);
        const y = px(c.y - lift + c.sink * 1);
        const x = px(cx - w / 2);

        /* Schatten */
        g.globalAlpha = c.matched ? 0.10 : 0.16;
        fill(g, x + 1, y + CARD_H - 1, w, 3, C.ink);
        g.globalAlpha = 1;

        if (open > 0.5) {
          fill(g, x, y, w, CARD_H, c.matched ? C.paper : C.cream);
          /* Rahmen */
          const edge = c.matched ? C.gold : '#E7E4DA';
          fill(g, x, y, w, 1, edge);
          fill(g, x, y + CARD_H - 1, w, 1, edge);
          fill(g, x, y, 1, CARD_H, edge);
          fill(g, x + w - 1, y, 1, CARD_H, edge);
          if (w > 28) {
            // Zweifach vergrößertes Symbol – ganzzahlig, also scharf
            const big = upscaleCached(c.name, c.matched ? 'gold' : 'brand', 2);
            g.drawImage(big, px(cx - big.width / 2), px(y + CARD_H / 2 - big.height / 2));
          }
        } else {
          fill(g, x, y, w, CARD_H, C.orange);
          fill(g, x, y + CARD_H - 3, w, 3, C.orangeDeep);
          fill(g, x, y, w, 1, C.orangeSoft);
          if (w > 22) blit(g, ownSprite('back'), cx - 8, y + CARD_H / 2 - 8);
          fill(g, x, y, 1, CARD_H, C.orangeDeep);
          fill(g, x + w - 1, y, 1, CARD_H, C.orangeDeep);
        }
      });

      if (s.lock > 0 && !s.started) {
        const a = Math.min(1, s.lock * 2);
        g.globalAlpha = a;
        text(g, 'Gut merken!', VW / 2 - 20, VH - 15, { size: 11, color: C.orangeDeep });
        g.globalAlpha = 1;
      }
    },

    pointer(s, p) {
      if (p.type !== 'down' || s.lock > 0 || s.done) return;
      const card = s.cards.find((c) =>
        p.x >= c.x && p.x <= c.x + CARD_W && p.y >= c.y && p.y <= c.y + CARD_H);
      if (!card || card.matched || card.open) return;

      card.open = 1;
      card.pop = 1;
      Chip.play('flip');
      s.open.push(card);

      if (s.open.length === 2) {
        s.moves++;
        const [a, b] = s.open;
        if (a.name === b.name) {
          a.matched = b.matched = true;
          a.pop = b.pop = 1;
          s.pairs++;
          s.open = [];
          s.cheer = 1.2;
          [a, b].forEach((c) => s.burst(c.x + CARD_W / 2, c.y + CARD_H / 2,
            { count: 12, power: 70, color: C.gold, up: true, spread: 2.6 }));
          s.float((a.x + b.x) / 2 + CARD_W / 2, (a.y + b.y) / 2, 'Paar!', C.orangeDeep);
          Chip.play('match');
        } else {
          s.lock = 0.72;
          Chip.play('miss');
        }
      }
    }
  };

  /** Symbol in ganzzahliger Vergrößerung – einmal bauen, dann kopieren. */
  function upscaleCached(name, tone, k) {
    const key = `big:${name}:${tone}:${k}`;
    if (cache.has(key)) return cache.get(key);
    const big = upscale(iconSprite(name, tone), k);
    cache.set(key, big);
    return big;
  }

  const GAMES = { catch: CatchGame, runner: RunnerGame, memory: MemoryGame };

  /* =========================================================
     Steuerung der Bühne
     ========================================================= */
  function create(opts) {
    const canvas = opts.canvas;
    const g = canvas.getContext('2d', { alpha: false });
    const keys = new Set();

    let look = { pet: 'nova', palette: 'amber', accessory: null };
    let game = null;
    let stage = null;
    let raf = null;
    let last = 0;
    let carry = 0;          // Restzeit für den festen Schritt
    let intro = 0;
    let fade = 0;           // Aufblende beim Start
    let paused = false;
    let idleT = 0;

    buildLayers();

    /* --- Auflösung: immer ein ganzzahliges Vielfaches der Bühne ---
       Gemessen wird der Platz im Gehäuse; der Schirm legt sich danach
       genau um die Leinwand. So ist jedes Pixel gleich groß. */
    const FRAME = 12;                    // Rahmenbreite des Schirms (2 x 6)

    function fit() {
      const host = (canvas.closest && canvas.closest('.cabinet')) || canvas.parentElement;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      let availW = VW, availH = VH;
      if (host) {
        const cs = getComputedStyle(host);
        const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        availW = Math.max(160, host.clientWidth - padX - FRAME);
      }
      availH = Math.max(90, Math.min(window.innerHeight * 0.62, 620) - FRAME);
      const k = Math.max(1, Math.min(8, Math.floor(Math.min(availW * dpr / VW, availH * dpr / VH))));
      if (canvas.width !== VW * k) {
        canvas.width = VW * k;
        canvas.height = VH * k;
      }
      canvas.style.width = (VW * k / dpr) + 'px';
      canvas.style.height = (VH * k / dpr) + 'px';
      g.setTransform(k, 0, 0, k, 0, 0);
      g.imageSmoothingEnabled = false;
    }

    /* --- Ruhebild: das Pet wartet auf der leeren Bühne --- */
    function idleFrame(dt) {
      idleT += dt;
      backdrop(g, idleT * 10);
      const bob = Math.round(Math.sin(idleT * 2) * 1.5);
      const blink = (idleT % 4) > 3.86;
      const state = blink ? 'blink' : 'idle';
      shadow(g, VW / 2, GROUND, 20);
      blit(g, petSprite(look, state, Math.floor(idleT * POSE_FPS.idle)), VW / 2 - 16, GROUND - 30 + bob);
    }

    function drawCountdown() {
      const left = Math.ceil(intro - 0.4);
      const phase = 1 - ((intro - 0.4) % 1);
      g.fillStyle = 'rgba(251,239,230,.58)';
      g.fillRect(0, 0, VW, VH);

      g.save();
      g.translate(VW / 2, VH / 2 - 8);
      if (left > 0) {
        const grow = 0.75 + Math.min(1, phase * 2.4) * 0.35;
        g.globalAlpha = Math.min(1, (1 - phase) * 3 + 0.25);
        g.scale(grow, grow);
        text(g, String(left), 0, 0, { size: 44, color: C.orangeDeep });
      } else {
        text(g, 'Los!', 0, 0, { size: 34, color: C.orangeDeep });
      }
      g.restore();
      text(g, game.hint, VW / 2, VH / 2 + 30, { size: 10, color: C.ink2 });
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000 || 0);
      last = now;

      if (!stage) { idleFrame(dt); return; }
      if (paused) return;

      /* Feste Schritte – gleiche Physik auf 60 wie auf 144 Hz */
      carry = Math.min(carry + dt, 0.25);
      let steps = 0;
      while (carry >= STEP && steps < 6) {
        carry -= STEP;
        steps++;
        stage.t += STEP;
        if (intro > 0) {
          intro -= STEP;
          if (intro <= 0) { Chip.play('start'); fade = 0.35; }
        } else if (!stage.done) {
          game.update(stage, STEP, keys);
          stage.tickEffects(STEP);
        }
      }

      /* Zeichnen: einmal je Bild */
      g.save();
      if (stage.shake > 0) {
        const amp = stage.shake * 4;
        g.translate(px((Math.random() - 0.5) * amp), px((Math.random() - 0.5) * amp));
      }
      game.draw(stage);
      stage.drawEffects();
      g.restore();

      if (stage.flash > 0) {
        g.globalAlpha = stage.flash * 0.5;
        g.fillStyle = C.white;
        g.fillRect(0, 0, VW, VH);
        g.globalAlpha = 1;
      }
      if (intro > 0) drawCountdown();
      else if (fade > 0) {
        fade = Math.max(0, fade - dt);
        g.globalAlpha = fade / 0.35;
        g.fillStyle = C.cream;
        g.fillRect(0, 0, VW, VH);
        g.globalAlpha = 1;
      }

      if (opts.onTick) opts.onTick(Math.max(0, Math.round(stage.score)), stage.status);

      if (stage.done) {
        const score = Math.max(0, Math.round(stage.score));
        const id = game.id;
        stage = null;
        idleT = 0;
        Chip.stopMusic(true);
        Chip.play('over');
        if (opts.onEnd) opts.onEnd(id, score);
      }
    }

    /* --- Eingaben --- */
    const WATCHED = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW'];

    function onKey(e) {
      if (!stage || !WATCHED.includes(e.code)) return;
      if (e.type === 'keydown') {
        if (e.code === 'Space') e.preventDefault();
        if (!keys.has(e.code) && game.key) game.key(stage, e.code, true);
        keys.add(e.code);
      } else {
        keys.delete(e.code);
        if (game.key) game.key(stage, e.code, false);
      }
    }

    function toStage(e) {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * VW,
        y: ((e.clientY - r.top) / r.height) * VH
      };
    }

    function onPointer(e) {
      Chip.unlock();
      if (!stage || !game.pointer) return;
      if (e.type === 'pointermove' && e.buttons === 0) return;
      const p = toStage(e);
      p.type = e.type === 'pointerdown' ? 'down' : (e.type === 'pointermove' ? 'move' : 'up');
      if (p.type === 'down') {
        e.preventDefault();
        if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
      }
      game.pointer(stage, p);
    }

    canvas.addEventListener('pointerdown', onPointer);
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerup', onPointer);
    canvas.addEventListener('pointercancel', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('resize', fit);

    let observer = null;
    const watched = (canvas.closest && canvas.closest('.cabinet')) || canvas.parentElement;
    if (typeof ResizeObserver !== 'undefined' && watched) {
      observer = new ResizeObserver(() => fit());
      observer.observe(watched);
    }

    fit();
    last = performance.now();
    raf = requestAnimationFrame(frame);

    return {
      setLook(next) {
        look = Object.assign({ pet: 'nova', palette: 'amber', accessory: null }, next || {});
      },
      start(id) {
        const chosen = GAMES[id];
        if (!chosen) return false;
        fit();
        game = chosen;
        stage = new Stage(g, look);
        keys.clear();
        game.init(stage);
        intro = game.intro === undefined ? 2.2 : game.intro;
        carry = 0;
        fade = 0;
        last = performance.now();
        paused = false;
        Chip.unlock();
        Chip.music(game.music);
        return true;
      },
      stop() {
        stage = null;
        idleT = 0;
        keys.clear();
        Chip.stopMusic(true);
      },
      pause() { paused = true; Chip.stopMusic(true); },
      resume() {
        paused = false;
        last = performance.now();
        carry = 0;
        if (stage) Chip.music(game.music);
      },
      isRunning: () => !!stage,
      resize: fit,
      destroy() {
        cancelAnimationFrame(raf);
        if (observer) observer.disconnect();
        canvas.removeEventListener('pointerdown', onPointer);
        canvas.removeEventListener('pointermove', onPointer);
        canvas.removeEventListener('pointerup', onPointer);
        canvas.removeEventListener('pointercancel', onPointer);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        window.removeEventListener('resize', fit);
        Chip.stopMusic();
      }
    };
  }

  return { create, GAMES: Object.keys(GAMES), VW, VH };
});
