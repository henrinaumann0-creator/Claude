/* ============================================================
   Claude Pets – Arcade
   Drei Minispiele auf einer 320x180-Pixelbühne. Gezeichnet wird
   mit denselben Rastern wie überall sonst: die Charaktere kommen
   aus pets.js, die Gegenstände aus icons.js, der Rest entsteht
   hier mit der Zeichenmaschine aus pixel.js.
   Der Held ist immer das Pet, das gerade angelegt ist.
   ============================================================ */
(function (root, factory) {
  root.Arcade = factory(root.Pixel, root.PetArt, root.Icons, root.Chip);
})(typeof self !== 'undefined' ? self : this, function (Pixel, PetArt, Icons, Chip) {
  'use strict';

  const VW = 320, VH = 180;          // Bühnenmaß in Pixeln
  const GROUND = 150;                // Oberkante des Bodens

  const COLORS = {
    skyTop: '#FCEDE3', skyBot: '#FAF9F5',
    hillFar: '#F0DBCD', hillNear: '#E6C7B4',
    ground: '#E3D4C0', groundDark: '#CDB99F', groundLine: '#BFA98D',
    ink: '#2E2E2B', ink2: '#56564F', cream: '#FBEFE6',
    orange: '#D97757', orangeDeep: '#BF5C3C', gold: '#E8B44A'
  };

  /* ---------------------------------------------------------
     Eigene Sprites
     Alles handgezeichnet auf 16x16 – Zeichen wie in icons.js:
     1 Kontur · 2 Haupt · 3 hell · 4 dunkel · 5 creme · 6 Gold
     --------------------------------------------------------- */
  const SPRITE_TONES = {
    1: '#3A3A36', 2: '#56564F', 3: '#86867C', 4: '#2E2E2B',
    5: '#FBEFE6', 6: '#E8B44A', 7: '#D97757', 8: '#FFFFFF', 9: '#7C9A8E'
  };

  const SPRITES = {
    /* Bombe mit brennender Lunte */
    bomb(c) {
      c.ell(8, 10, 5, 5, '2');
      c.ell(6.5, 8.5, 2, 1.5, '3');
      c.rect(9, 3, 2, 2, '4');
      c.line(10, 3, 13, 1, '7');
      c.set(13, 0, '6'); c.set(14, 1, '6'); c.set(13, 1, '8');
      c.ell(8, 13, 4, 2, '1', true);
    },
    /* Felsblock */
    rock(c) {
      c.ell(8, 11, 6, 4, '3');
      c.ell(6, 9, 3.5, 3, '3');
      c.ell(10.5, 9.5, 3, 2.5, '3');
      c.ell(6, 8.5, 2, 1.5, '5', true);
      c.rect(2, 14, 12, 1, '2');
    },
    /* Kaktus */
    cactus(c) {
      c.rect(7, 2, 3, 13, '9');
      c.rect(4, 6, 2, 5, '9'); c.rect(6, 6, 1, 1, '9');
      c.rect(11, 8, 2, 4, '9'); c.rect(10, 8, 1, 1, '9');
      c.set(8, 4, '5'); c.set(8, 8, '5'); c.set(5, 8, '5');
    },
    /* Wolke – ohne harte Kontur, nur ein weicher Schatten unten */
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
     Jedes Sprite wird einmal in 1:1-Größe vorgerendert und danach
     nur noch kopiert. Das hält auch 60 Bilder je Sekunde ruhig.
     --------------------------------------------------------- */
  const cache = new Map();

  function raster(key, w, h, grid, colors) {
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
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

  /** Ein Frame des angelegten Pets. */
  function petSprite(look, state, index) {
    const poses = PetArt.POSES[state] || PetArt.POSES.idle;
    const pose = poses[index % poses.length];
    const key = `pet:${look.pet}:${look.palette}:${look.accessory || '-'}:${state}:${index % poses.length}`;
    if (cache.has(key)) return cache.get(key);
    const colors = PetArt.colorsOf(look.palette);
    return raster(key, PetArt.W, PetArt.H,
      PetArt.frame(look.pet, pose, colors, look.accessory), colors);
  }

  /** Ein Symbol aus der Bibliothek. */
  function iconSprite(name, tone) {
    return raster(`icon:${name}:${tone}`, Icons.SIZE, Icons.SIZE,
      Icons.grid(name), Icons.TONES[tone] || Icons.TONES.brand);
  }

  /** Eines der hier gezeichneten Sprites. */
  function ownSprite(name) {
    const key = 'own:' + name;
    if (cache.has(key)) return cache.get(key);
    const c = new Pixel.Canvas(16, 16);
    SPRITES[name](c);
    if (name !== 'back' && name !== 'cloud') c.outline('1');
    return raster(key, 16, 16, c.g, SPRITE_TONES);
  }

  /* ---------------------------------------------------------
     Gemeinsame Zeichenhelfer
     --------------------------------------------------------- */
  function blit(g, img, x, y, flip) {
    x = Math.round(x); y = Math.round(y);
    if (!flip) { g.drawImage(img, x, y); return; }
    g.save();
    g.translate(x + img.width, y);
    g.scale(-1, 1);
    g.drawImage(img, 0, 0);
    g.restore();
  }

  /** Weicher Schatten unter einer Figur. */
  function shadow(g, x, y, w) {
    g.fillStyle = 'rgba(46,46,43,.13)';
    g.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 2);
    g.fillStyle = 'rgba(46,46,43,.08)';
    g.fillRect(Math.round(x - w / 2) + 2, Math.round(y) - 1, Math.round(w) - 4, 1);
  }

  function text(g, str, x, y, o) {
    const opt = o || {};
    g.font = `${opt.weight || 700} ${opt.size || 10}px "Inter", "Segoe UI", sans-serif`;
    g.textAlign = opt.align || 'center';
    g.textBaseline = opt.baseline || 'middle';
    if (opt.shadow !== false) {
      g.fillStyle = 'rgba(46,46,43,.22)';
      g.fillText(str, x, y + 1);
    }
    g.fillStyle = opt.color || COLORS.ink;
    g.fillText(str, x, y);
  }

  /* ---------------------------------------------------------
     Die Bühne
     Hält Zeit, Partikel, Zahlenflug und Bildschirmruckeln – alles,
     was sich alle drei Spiele teilen.
     --------------------------------------------------------- */
  function Stage(ctx, look) {
    this.g = ctx;
    this.look = look;
    this.t = 0;
    this.score = 0;
    this.status = '';
    this.done = false;
    this.particles = [];
    this.floats = [];
    this.shake = 0;
    this.rnd = Math.random;
  }

  Stage.prototype.burst = function (x, y, color, count, power) {
    for (let i = 0; i < (count || 8); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (power || 60) * (0.35 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
        life: 0.45 + Math.random() * 0.4, age: 0,
        size: Math.random() < 0.3 ? 2 : 1, color
      });
    }
  };

  Stage.prototype.float = function (x, y, str, color) {
    this.floats.push({ x, y, str, color: color || COLORS.orangeDeep, age: 0, life: 0.9 });
  };

  Stage.prototype.tickEffects = function (dt) {
    this.particles = this.particles.filter((p) => {
      p.age += dt;
      p.vy += 220 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.age < p.life;
    });
    this.floats = this.floats.filter((f) => {
      f.age += dt;
      f.y -= 22 * dt;
      return f.age < f.life;
    });
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.2);
  };

  Stage.prototype.drawEffects = function () {
    const g = this.g;
    this.particles.forEach((p) => {
      g.globalAlpha = Math.max(0, 1 - p.age / p.life);
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    });
    this.floats.forEach((f) => {
      g.globalAlpha = Math.max(0, 1 - Math.pow(f.age / f.life, 2));
      text(g, f.str, f.x, f.y, { size: 11, color: f.color });
    });
    g.globalAlpha = 1;
  };

  /* ---------------------------------------------------------
     Hintergründe
     --------------------------------------------------------- */
  function sky(g) {
    const grd = g.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, COLORS.skyTop);
    grd.addColorStop(1, COLORS.skyBot);
    g.fillStyle = grd;
    g.fillRect(0, 0, VW, VH);
  }

  function hills(g, offset) {
    const draw = (color, amp, base, speed, step) => {
      g.fillStyle = color;
      for (let x = -32; x < VW + 32; x += step) {
        const h = base + Math.sin((x + offset * speed) * 0.018) * amp;
        g.fillRect(x, VH - h, step, h);
      }
    };
    draw(COLORS.hillFar, 9, 62, 0.35, 8);
    draw(COLORS.hillNear, 7, 44, 0.6, 6);
  }

  function clouds(g, offset) {
    const img = ownSprite('cloud');
    [[0, 26, 0.18, 2], [120, 16, 0.12, 3], [232, 34, 0.24, 2]].forEach(([x, y, s, scale]) => {
      const px = ((x - offset * s) % (VW + 64) + VW + 64) % (VW + 64) - 32;
      g.save();
      g.globalAlpha = 0.85;
      g.translate(Math.round(px), y);
      g.scale(scale, scale);
      g.drawImage(img, 0, 0);
      g.restore();
    });
    g.globalAlpha = 1;
  }

  function floor(g, offset) {
    g.fillStyle = COLORS.ground;
    g.fillRect(0, GROUND, VW, VH - GROUND);
    g.fillStyle = COLORS.groundLine;
    g.fillRect(0, GROUND, VW, 1);
    g.fillStyle = COLORS.groundDark;
    for (let i = 0; i < 26; i++) {
      const x = ((i * 26 - offset) % (VW + 26) + VW + 26) % (VW + 26) - 13;
      g.fillRect(Math.round(x), GROUND + 6 + (i % 3) * 7, 5, 1);
      g.fillRect(Math.round(x) + 9, GROUND + 14 + (i % 2) * 6, 3, 1);
    }
  }

  /* =========================================================
     Spiel 1 · Snack-Jagd
     ========================================================= */
  const CatchGame = {
    id: 'catch',
    music: 'run',
    hint: 'Pfeiltasten · A/D · ziehen',

    init(s) {
      s.px = VW / 2;
      s.pv = 0;
      s.target = null;
      s.items = [];
      s.spawn = 0.7;
      s.lives = 3;
      s.combo = 0;
      s.best = 0;
      s.caught = 0;
      s.face = 'idle';
      s.faceTimer = 0;
      s.dir = 1;
      this.status(s);
    },

    status(s) {
      s.status = s.combo > 1 ? `Serie ×${s.combo}` : '';
    },

    /** Was fällt: gute Sachen und Bomben, mit der Zeit immer schneller. */
    spawnItem(s) {
      const hard = Math.min(1, s.t / 75);
      const bomb = Math.random() < 0.16 + hard * 0.18;
      const kinds = ['apple', 'egg', 'heart', 'star', 'medal'];
      s.items.push({
        x: 16 + Math.random() * (VW - 32),
        y: -16,
        vy: 52 + hard * 78 + Math.random() * 18,
        spin: (Math.random() - 0.5) * 2,
        bomb,
        name: bomb ? 'bomb' : kinds[(Math.random() * kinds.length) | 0]
      });
    },

    update(s, dt, keys) {
      const hard = Math.min(1, s.t / 75);
      const speed = 168;

      let move = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) move -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) move += 1;

      if (s.target !== null) {
        const diff = s.target - s.px;
        s.px += Math.max(-speed * 1.6 * dt, Math.min(speed * 1.6 * dt, diff));
        if (Math.abs(diff) > 1) s.dir = diff > 0 ? 1 : -1;
      } else if (move) {
        s.px += move * speed * dt;
        s.dir = move;
      }
      s.px = Math.max(16, Math.min(VW - 16, s.px));
      s.moving = move !== 0 || (s.target !== null && Math.abs(s.target - s.px) > 1.5);

      s.spawn -= dt;
      if (s.spawn <= 0) {
        this.spawnItem(s);
        s.spawn = 0.82 - hard * 0.48 + Math.random() * 0.2;
      }

      const petTop = GROUND - 30;
      s.items = s.items.filter((it) => {
        it.y += it.vy * dt;
        const hit = it.y + 14 > petTop && it.y < petTop + 24 && Math.abs(it.x + 8 - s.px) < 17;
        if (hit) {
          if (it.bomb) {
            s.lives--;
            s.combo = 0;
            s.shake = 1;
            s.burst(it.x + 8, it.y + 8, COLORS.ink2, 16, 90);
            Chip.play('hit');
            s.face = 'blink'; s.faceTimer = 0.6;
            if (s.lives <= 0) s.done = true;
          } else {
            s.combo++;
            s.caught++;
            let gain = 1;
            if (s.combo % 5 === 0) {
              gain += 3;
              s.float(it.x + 8, it.y, `Serie ×${s.combo}!`, COLORS.gold);
              Chip.play('combo');
            } else {
              Chip.play('coin');
            }
            s.score += gain;
            s.burst(it.x + 8, it.y + 8, COLORS.orange, 8, 60);
            s.float(it.x + 8, it.y - 4, '+' + gain);
            s.face = 'happy'; s.faceTimer = 0.45;
          }
          this.status(s);
          return false;
        }
        if (it.y > GROUND - 8) {
          s.burst(it.x + 8, GROUND, it.bomb ? COLORS.ink2 : COLORS.groundDark, it.bomb ? 10 : 5, 45);
          if (!it.bomb) {
            s.combo = 0;
            this.status(s);
            Chip.play('miss');
          }
          return false;
        }
        return true;
      });

      if (s.faceTimer > 0) {
        s.faceTimer -= dt;
        if (s.faceTimer <= 0) s.face = 'idle';
      }
    },

    draw(s) {
      const g = s.g;
      sky(g);
      hills(g, s.t * 6);
      clouds(g, s.t * 10);
      floor(g, 0);

      s.items.forEach((it) => {
        const img = it.bomb ? ownSprite('bomb') : iconSprite(it.name, it.bomb ? 'ink' : 'brand');
        g.save();
        g.translate(Math.round(it.x) + 8, Math.round(it.y) + 8);
        g.rotate(Math.sin(s.t * 3 + it.spin * 6) * 0.14);
        g.drawImage(img, -8, -8);
        g.restore();
      });

      const state = s.face === 'happy' ? 'happy' : (s.face === 'blink' ? 'blink' : (s.moving ? 'walk' : 'idle'));
      const frame = Math.floor(s.t * (s.moving ? 9 : 3));
      shadow(g, s.px, GROUND, 20);
      blit(g, petSprite(s.look, state, frame), s.px - 16, GROUND - 30, s.dir < 0);

      /* Leben als Pixel-Herzen, oben links */
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = i < s.lives ? 1 : 0.22;
        blit(g, iconSprite('heart', i < s.lives ? 'brand' : 'muted'), 6 + i * 15, 6);
      }
      g.globalAlpha = 1;
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
    hint: 'Leertaste · tippen zum Springen',

    init(s) {
      s.px = 48;
      s.py = GROUND - 30;
      s.vy = 0;
      s.onGround = true;
      s.hold = 0;
      s.speed = 82;
      s.dist = 0;
      s.coins = 0;
      s.obstacles = [];
      s.stars = [];
      s.nextGap = 120;
      s.dead = 0;
      s.status = '0 m';
    },

    jump(s) {
      if (!s.onGround || s.done) return;
      s.vy = -196;
      s.onGround = false;
      s.hold = 0.2;
      s.burst(s.px, GROUND, COLORS.groundDark, 6, 40);
      Chip.play('jump');
    },

    update(s, dt, keys) {
      if (s.dead) {
        // Ausrutscher: kurz hochschnellen, dann liegen bleiben – im Bild.
        s.dead += dt;
        s.vy += 620 * dt;
        s.py = Math.min(GROUND - 22, s.py + s.vy * dt);
        if (s.dead > 1.1) s.done = true;
        return;
      }

      s.speed = Math.min(178, 82 + s.t * 1.6);
      s.dist += s.speed * dt;
      s.score = Math.floor(s.dist / 10) + s.coins * 10;
      s.status = `${Math.floor(s.dist / 10)} m   ·   ${s.coins} Sterne`;

      /* Sprung: länger gedrückt heißt höher */
      const held = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW') || s.pointerDown;
      if (held && s.hold > 0 && s.vy < 0) {
        s.vy -= 460 * dt;
        s.hold -= dt;
      } else s.hold = 0;

      s.vy += 620 * dt;
      s.py += s.vy * dt;
      if (s.py >= GROUND - 30) {
        if (!s.onGround) { Chip.play('land'); s.burst(s.px, GROUND, COLORS.groundDark, 5, 34); }
        s.py = GROUND - 30;
        s.vy = 0;
        s.onGround = true;
      }

      /* Nachschub: der Abstand richtet sich nach dem Tempo,
         damit jede Lücke auch wirklich zu schaffen ist. */
      s.nextGap -= s.speed * dt;
      if (s.nextGap <= 0) {
        const kind = Math.random() < 0.5 ? 'rock' : 'cactus';
        s.obstacles.push({ x: VW + 8, kind });
        if (Math.random() < 0.65) {
          const high = Math.random() < 0.5;
          const n = 1 + ((Math.random() * 3) | 0);
          for (let i = 0; i < n; i++) {
            s.stars.push({ x: VW + 40 + i * 18, y: high ? GROUND - 62 : GROUND - 34, got: false });
          }
        }
        s.nextGap = s.speed * (0.95 + Math.random() * 0.75);
      }

      const dx = s.speed * dt;
      s.obstacles = s.obstacles.filter((o) => {
        o.x -= dx;
        const top = GROUND - 15;
        if (o.x < s.px + 10 && o.x + 14 > s.px - 10 && s.py + 30 > top + 3) {
          s.dead = 0.001;
          s.vy = -150;
          s.shake = 1;
          s.burst(s.px, s.py + 16, COLORS.orangeDeep, 18, 100);
          Chip.play('hit');
        }
        return o.x > -20;
      });

      s.stars = s.stars.filter((c) => {
        c.x -= dx;
        if (!c.got && Math.abs(c.x + 8 - s.px) < 16 && Math.abs(c.y + 8 - (s.py + 16)) < 18) {
          c.got = true;
          s.coins++;
          s.burst(c.x + 8, c.y + 8, COLORS.gold, 9, 70);
          s.float(c.x + 8, c.y, '+10', COLORS.gold);
          Chip.play('coin');
        }
        return c.x > -20 && !c.got;
      });
    },

    draw(s) {
      const g = s.g;
      sky(g);
      hills(g, s.dist * 0.5);
      clouds(g, s.dist * 0.35);
      floor(g, s.dist);

      s.stars.forEach((c) => {
        const bob = Math.sin(s.t * 4 + c.x * 0.05) * 2;
        blit(g, iconSprite('star', 'gold'), c.x, c.y + bob);
      });
      s.obstacles.forEach((o) => blit(g, ownSprite(o.kind), o.x, GROUND - 15));

      const state = s.dead ? 'blink' : (s.onGround ? 'walk' : 'happy');
      const frame = Math.floor(s.t * 11);
      if (!s.dead) {
        const height = Math.max(0, (GROUND - 30 - s.py) / 34);
        g.globalAlpha = 1 - height * 0.6;
        shadow(g, s.px, GROUND, 20 - height * 5);
        g.globalAlpha = 1;
      }
      g.save();
      if (s.dead) {
        g.translate(s.px, s.py + 16);
        g.rotate(Math.min(1.9, s.dead * 3.2));
        g.translate(-s.px, -(s.py + 16));
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
  const MemoryGame = {
    id: 'memory',
    music: 'calm',
    intro: 1.2,
    hint: 'Karte antippen',

    init(s) {
      const pool = ['apple', 'heart', 'star', 'moon', 'sun', 'flame', 'egg', 'bow', 'crown', 'medal', 'sparkles', 'ball'];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const picks = pool.slice(0, 6);
      const deck = picks.concat(picks);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      // Das Raster bleibt links, rechts sitzt das Pet und schaut zu.
      const cw = 54, ch = 38, gapX = 7, gapY = 7;
      const x0 = 8;
      const y0 = 14;
      s.cards = deck.map((name, i) => ({
        name,
        x: x0 + (i % 4) * (cw + gapX),
        y: y0 + Math.floor(i / 4) * (ch + gapY),
        w: cw, h: ch,
        open: 1, matched: false, flip: 1, wobble: 0
      }));
      s.open = [];
      s.moves = 0;
      s.pairs = 0;
      s.lock = 1.9;          // Einprägen: kurz liegen alle offen
      s.elapsed = 0;
      s.score = 0;
      s.status = 'Einprägen …';
    },

    /** Punkte: Grundwert minus Zeit und Züge, nie unter null. */
    points(s) {
      return Math.max(0, Math.round(900 - s.elapsed * 7 - s.moves * 10));
    },

    update(s, dt) {
      if (s.lock > 0) {
        s.lock -= dt;
        if (s.lock <= 0 && s.pairs === 0 && s.moves === 0) {
          s.cards.forEach((c) => { c.open = 0; });
          s.status = '0 Züge';
          Chip.play('flip');
        }
        if (s.lock <= 0 && (s.pairs || s.moves)) {
          s.cards.forEach((c) => { if (!c.matched) c.open = 0; });
          s.open = [];
        }
      } else {
        s.elapsed += dt;
        s.score = this.points(s);
        s.status = `${s.moves} Züge   ·   ${s.pairs}/6 Paare`;
      }

      s.cards.forEach((c) => {
        c.flip += ((c.open ? 1 : 0) - c.flip) * Math.min(1, dt * 12);
        if (c.wobble > 0) c.wobble = Math.max(0, c.wobble - dt * 2.4);
      });

      if (s.pairs === 6 && !s.done) {
        s.score = this.points(s);
        s.done = true;
      }
    },

    draw(s) {
      const g = s.g;
      sky(g);
      hills(g, s.t * 3);
      clouds(g, s.t * 6);
      floor(g, 0);

      /* Das Pet schaut von unten zu und feuert an. */
      const bob = Math.sin(s.t * 2.2) * 1.5;
      shadow(g, VW - 46, GROUND, 20);
      blit(g, petSprite(s.look, s.pairs === 6 ? 'happy' : 'idle', Math.floor(s.t * 2.5)),
        VW - 62, GROUND - 30 + bob);

      s.cards.forEach((c) => {
        const open = c.flip;
        const w = Math.max(2, c.w * Math.abs(open * 2 - 1));
        const cx = c.x + c.w / 2;
        const lift = c.wobble * 2;

        g.save();
        g.translate(Math.round(cx), Math.round(c.y + c.h / 2 - lift));
        g.fillStyle = 'rgba(46,46,43,.12)';
        g.fillRect(-w / 2 + 1, c.h / 2 - 1, w, 3);

        if (open > 0.5) {
          g.fillStyle = c.matched ? '#FDF3EC' : COLORS.cream;
          g.fillRect(-w / 2, -c.h / 2, w, c.h);
          g.strokeStyle = c.matched ? COLORS.orange : '#E7E4DA';
          g.lineWidth = 1;
          g.strokeRect(-w / 2 + 0.5, -c.h / 2 + 0.5, w - 1, c.h - 1);
          if (w > 26) {
            const img = iconSprite(c.name, c.matched ? 'gold' : 'brand');
            g.save();
            g.translate(-12, -12);
            g.scale(1.5, 1.5);
            g.drawImage(img, 0, 0);
            g.restore();
          }
        } else {
          g.fillStyle = COLORS.orange;
          g.fillRect(-w / 2, -c.h / 2, w, c.h);
          g.fillStyle = COLORS.orangeDeep;
          g.fillRect(-w / 2, c.h / 2 - 3, w, 3);
          if (w > 22) {
            g.globalAlpha = 0.9;
            g.drawImage(ownSprite('back'), -8, -8);
            g.globalAlpha = 1;
          }
          g.strokeStyle = COLORS.orangeDeep;
          g.lineWidth = 1;
          g.strokeRect(-w / 2 + 0.5, -c.h / 2 + 0.5, w - 1, c.h - 1);
        }
        g.restore();
      });

      if (s.lock > 0 && s.moves === 0 && s.pairs === 0) {
        text(g, 'Gut merken!', VW / 2 - 24, VH - 14, { size: 11, color: COLORS.orangeDeep });
      }
    },

    pointer(s, p) {
      if (p.type !== 'down' || s.lock > 0 || s.done) return;
      const card = s.cards.find((c) =>
        p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h);
      if (!card || card.matched || card.open) return;

      card.open = 1;
      card.wobble = 1;
      Chip.play('flip');
      s.open.push(card);

      if (s.open.length === 2) {
        s.moves++;
        const [a, b] = s.open;
        if (a.name === b.name) {
          a.matched = b.matched = true;
          s.pairs++;
          s.open = [];
          s.burst(a.x + a.w / 2, a.y + a.h / 2, COLORS.gold, 10, 70);
          s.burst(b.x + b.w / 2, b.y + b.h / 2, COLORS.gold, 10, 70);
          s.float((a.x + b.x) / 2 + a.w / 2, (a.y + b.y) / 2, 'Paar!', COLORS.orangeDeep);
          Chip.play('match');
        } else {
          s.lock = 0.75;
          Chip.play('miss');
        }
      }
    }
  };

  const GAMES = { catch: CatchGame, runner: RunnerGame, memory: MemoryGame };

  /* =========================================================
     Steuerung der Bühne
     ========================================================= */
  function create(opts) {
    const canvas = opts.canvas;
    const g = canvas.getContext('2d');
    const keys = new Set();

    let look = { pet: 'nova', palette: 'amber', accessory: null };
    let game = null;
    let stage = null;
    let raf = null;
    let last = 0;
    let intro = 0;
    let paused = false;
    let scale = 1;

    /* --- Auflösung: ganzzahlig skalieren, damit Pixel Pixel bleiben --- */
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width || canvas.clientWidth || VW;
      scale = Math.max(1, Math.min(4, Math.round((width * dpr) / VW)));
      canvas.width = VW * scale;
      canvas.height = VH * scale;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.imageSmoothingEnabled = false;
    }

    /* --- Ruhebild: das Pet wartet auf der leeren Bühne --- */
    function idleFrame(t) {
      g.save();
      sky(g); hills(g, t * 4); clouds(g, t * 8); floor(g, 0);
      const bob = Math.sin(t * 2) * 1.5;
      blit(g, petSprite(look, 'idle', Math.floor(t * 2.5)), VW / 2 - 16, GROUND - 30 + bob);
      g.restore();
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;

      if (!stage) { idleFrame(now / 1000); return; }
      if (paused) return;

      stage.t += dt;

      if (intro > 0) {
        intro -= dt;
        game.draw(stage);
        const left = Math.ceil(intro);
        g.fillStyle = 'rgba(250,249,245,.45)';
        g.fillRect(0, 0, VW, VH);
        text(g, left > 0 ? String(left) : 'Los!', VW / 2, VH / 2 - 6,
          { size: left > 0 ? 40 : 30, color: COLORS.orangeDeep });
        text(g, game.hint, VW / 2, VH / 2 + 26, { size: 10, color: COLORS.ink2 });
        if (intro <= 0) Chip.play('start');
        return;
      }

      if (!stage.done) game.update(stage, dt, keys);
      stage.tickEffects(dt);

      g.save();
      if (stage.shake > 0) {
        g.translate((Math.random() - 0.5) * stage.shake * 5, (Math.random() - 0.5) * stage.shake * 5);
      }
      game.draw(stage);
      stage.drawEffects();
      g.restore();

      if (opts.onTick) opts.onTick(stage.score, stage.status);

      if (stage.done) {
        const score = Math.max(0, Math.round(stage.score));
        const id = game.id;
        stage = null;
        Chip.stopMusic(true);
        Chip.play('over');
        if (opts.onEnd) opts.onEnd(id, score);
      }
    }

    /* --- Eingaben --- */
    function onKey(e) {
      const relevant = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW'];
      if (!relevant.includes(e.code)) return;
      if (!stage) return;
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
      if (e.type === 'pointerdown') {
        canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      }
      if (e.type !== 'pointerup' && e.buttons === 0 && e.type === 'pointermove') return;
      const p = toStage(e);
      p.type = e.type === 'pointerdown' ? 'down' : (e.type === 'pointerup' ? 'up' : 'move');
      if (p.type === 'down') e.preventDefault();
      game.pointer(stage, p);
    }

    canvas.addEventListener('pointerdown', onPointer);
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerup', onPointer);
    canvas.addEventListener('pointercancel', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('resize', resize);

    resize();
    raf = requestAnimationFrame(frame);

    return {
      setLook(next) {
        look = Object.assign({ pet: 'nova', palette: 'amber', accessory: null }, next || {});
      },
      start(id) {
        const chosen = GAMES[id];
        if (!chosen) return false;
        resize();
        game = chosen;
        stage = new Stage(g, look);
        keys.clear();
        game.init(stage);
        intro = game.intro === undefined ? 2.4 : game.intro;
        paused = false;
        Chip.unlock();
        Chip.music(game.music);
        return true;
      },
      stop() {
        stage = null;
        keys.clear();
        Chip.stopMusic(true);
      },
      pause() { paused = true; Chip.stopMusic(true); },
      resume() {
        paused = false;
        last = performance.now();
        if (stage) Chip.music(game.music);
      },
      isRunning: () => !!stage,
      resize,
      destroy() {
        cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', onPointer);
        canvas.removeEventListener('pointermove', onPointer);
        canvas.removeEventListener('pointerup', onPointer);
        canvas.removeEventListener('pointercancel', onPointer);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKey);
        window.removeEventListener('resize', resize);
        Chip.stopMusic();
      }
    };
  }

  return { create, GAMES: Object.keys(GAMES), VW, VH };
});
