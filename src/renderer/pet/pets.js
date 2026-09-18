/* ============================================================
   Claude Pets – Pixel-Art-Charaktere
   Jedes Tier wird auf einem 32x32-Raster gezeichnet und als
   SVG aus einzelnen Pixel-Rechtecken ausgegeben (crispEdges).
   Animationen laufen als echte Frame-Wechsel (steps()).
   ============================================================ */
(function (root, factory) {
  const Pixel = (typeof module === 'object' && module.exports)
    ? require('../../shared/pixel.js')
    : root.Pixel;
  const api = factory(Pixel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PetArt = api;
})(typeof self !== 'undefined' ? self : this, function (Pixel) {
  'use strict';

  const W = 32, H = 32;

  /* ---------------------------------------------------------
     Farbpaletten – Zeichen-Codes:
     1 Kontur · 2 Fell · 3 Fell hell · 4 Fell dunkel · 5 Bauch
     6 Innenfarbe · 7 Auge · 8 Weiß · 9 Akzent · 0 Metall
     --------------------------------------------------------- */
  const PALETTES = {
    amber:    { name: 'Amber',       1:'#7A3A25', A:'#99492F', 2:'#D97757', 3:'#EFA47F', 4:'#B25A3D', 5:'#F7E6D9', 6:'#F3BBA2', 7:'#2E211B', 8:'#FFFFFF', 9:'#F0A93C', 0:'#C9C3B6' },
    sunset:   { name: 'Sunset',      1:'#6B2A1D', A:'#7E3325', 2:'#C4553F', 3:'#E4805F', 4:'#8C3728', 5:'#F7DDCC', 6:'#EDA88F', 7:'#2A1712', 8:'#FFFFFF', 9:'#F2C14E', 0:'#C4B7A6' },
    mint:     { name: 'Mint',        1:'#33564A', A:'#446B5B', 2:'#7FB09B', 3:'#A9CFBC', 4:'#537F6D', 5:'#E9F3EE', 6:'#BFE2D0', 7:'#20302A', 8:'#FFFFFF', 9:'#EFC169', 0:'#C2CBC6' },
    lavender: { name: 'Lavendel',    1:'#463A63', A:'#5A4C7C', 2:'#9A8BC0', 3:'#BEB1DC', 4:'#6D5F93', 5:'#EFEAF8', 6:'#CFC2E8', 7:'#28213A', 8:'#FFFFFF', 9:'#F0BE63', 0:'#C5C1CF' },
    midnight: { name: 'Mitternacht', 1:'#1B2138', A:'#23293F', 2:'#46527A', 3:'#6F7EAC', 4:'#2B3352', 5:'#DBE1F1', 6:'#8493C4', 7:'#12162A', 8:'#FFFFFF', 9:'#F2CE72', 0:'#AEB6C9' },
    coral:    { name: 'Koralle',     1:'#8A3A32', A:'#A5453A', 2:'#EA7A6D', 3:'#F9A597', 4:'#C0544A', 5:'#FCE5E0', 6:'#F9B8AB', 7:'#3A211E', 8:'#FFFFFF', 9:'#F6C05C', 0:'#D2C6C3' }
  };

  /* ---------------------------------------------------------
     Leinwand aus dem gemeinsamen Pixel-Modul
     --------------------------------------------------------- */
  const Canvas = Pixel.Canvas;

  /**
   * Oben liegende Konturpixel werden aufgehellt. Das ist der klassische
   * Pixel-Art-Kniff "selective outlining": Licht faellt von oben ein,
   * die Silhouette wirkt dadurch runder statt wie ausgeschnitten.
   */
  function softenOutline(c) {
    const copy = c.g.slice();
    const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '.' : copy[y * W + x];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (get(x, y) !== '1') continue;
        const above = get(x, y - 1);
        const below = get(x, y + 1);
        if (above === '.' && below !== '.' && below !== '1') c.set(x, y, 'A');
      }
    }
  }

  /** Augen inkl. Lidschluss und Freude-Bogen. */
  function drawEyes(c, p, pose) {
    const { lx, y, w = 2, h = 3 } = p;
    const rx = W - lx - w;
    if (pose.eyes === 'closed') {
      for (let i = -1; i <= w; i++) {
        c.over(lx + i, y + 1, '1');
        c.over(rx + i, y + 1, '1');
      }
      return;
    }
    if (pose.eyes === 'happy') {
      c.over(lx, y + 1, '1'); c.over(lx + 1, y, '1'); c.over(lx + 2, y + 1, '1');
      c.over(rx - 1, y + 1, '1'); c.over(rx, y, '1'); c.over(rx + 1, y + 1, '1');
      return;
    }
    c.rect(lx, y, w, h, '7');
    c.rect(rx, y, w, h, '7');
    c.set(lx, y, '8');
    c.set(rx, y, '8');
    // Unterer Rand etwas heller – gibt dem Auge Tiefe
    c.set(lx + w - 1, y + h - 1, '6');
    c.set(rx + w - 1, y + h - 1, '6');
  }

  /* ---------------------------------------------------------
     Charaktere – silhouette() zeichnet den Umriss in '2',
     details() malt Gesicht, Bauch und Extras darüber.
     --------------------------------------------------------- */
  const PETS = {

    /* ===== Nova · Fuchs ===== */
    nova: {
      name: 'Nova',
      silhouette(c, p) {
        const b = p.bob;
        // Buschiger Schwanz, geschwungen nach oben rechts
        c.ell(24, 26 + b, 2.5, 2, '2');
        c.ell(27, 23 + b, 3, 2.5, '2');
        c.ell(29, 19 + b, 2.5, 2.5, '2');
        c.ell(29, 15 + b, 2, 2, '2');
        // Ohren
        c.tri([8, 1 + b], [6, 10 + b], [15, 8 + b], '2');
        c.tri([23, 1 + b], [25, 10 + b], [16, 8 + b], '2');
        // Kopf & Körper
        c.ell(15.5, 11 + b, 7.5, 6.5, '2');
        c.ell(15.5, 22 + b, 7, 5.5, '2');
        // Beine
        legsQuad(c, p);
      },
      details(c, p) {
        const b = p.bob;
        c.ell(9.5, 5 + b, 2, 2.5, '6', true);
        c.ell(21.5, 5 + b, 2, 2.5, '6', true);
        c.ell(15.5, 24 + b, 4, 3.5, '5', true);   // Bauch
        c.ell(15.5, 15 + b, 4, 2, '5', true);     // Schnauze
        drawEyes(c, { lx: 10, y: 10 + b }, p);
        blush(c, 13 + b, 8);
        c.over(15, 14 + b, '1'); c.over(16, 14 + b, '1');
        c.over(15, 15 + b, '1'); c.over(16, 15 + b, '1');
        c.over(14, 16 + b, '1'); c.over(17, 16 + b, '1');
        // Helle Schwanzspitze
        c.ell(29, 14.5 + b, 2, 2.5, '5', true);
      }
    },

    /* ===== Miso · Katze ===== */
    miso: {
      name: 'Miso',
      silhouette(c, p) {
        const b = p.bob;
        c.rect(21, 23 + b, 3, 2, '2');
        c.rect(23, 19 + b, 2, 5, '2');
        c.rect(24, 15 + b, 2, 5, '2');
        c.rect(25, 12 + b, 2, 4, '2');
        c.ell(26.5, 11 + b, 1.5, 1.5, '2');
        c.tri([9, 2 + b], [8, 10 + b], [15, 8 + b], '2');
        c.tri([22, 2 + b], [23, 10 + b], [16, 8 + b], '2');
        c.ell(15.5, 11 + b, 7.5, 6.5, '2');
        c.ell(15.5, 22 + b, 6.5, 5.5, '2');
        legsQuad(c, p);
      },
      details(c, p) {
        const b = p.bob;
        c.ell(10.5, 6 + b, 1.5, 2, '6', true);
        c.ell(20.5, 6 + b, 1.5, 2, '6', true);
        c.ell(15.5, 24 + b, 3.5, 3.5, '5', true);
        c.ell(15.5, 15 + b, 4.5, 2, '5', true);
        drawEyes(c, { lx: 10, y: 10 + b }, p);
        blush(c, 13 + b, 8);
        c.over(15, 14 + b, '9'); c.over(16, 14 + b, '9');
        c.over(15, 15 + b, '1'); c.over(16, 15 + b, '1');
        c.over(13, 16 + b, '1'); c.over(18, 16 + b, '1');
        // Schnurrhaare (liegen an der Wange an)
        c.rect(5, 14 + b, 3, 1, '1'); c.rect(5, 17 + b, 3, 1, '1');
        c.rect(24, 14 + b, 3, 1, '1'); c.rect(24, 17 + b, 3, 1, '1');
        c.over(26, 10 + b, '5'); c.over(27, 11 + b, '5');
      }
    },

    /* ===== Mochi · Blob ===== */
    mochi: {
      name: 'Mochi',
      silhouette(c, p) {
        const b = p.bob;
        c.rect(15, 1 + b, 2, 4, '2');
        c.ell(15.5, 1 + b, 2, 2, '2');
        c.ell(15.5, 17 + b, 11, 10.5, '2');
        c.ell(15.5, 24 + b, 12, 4.5, '2');
        c.ell(9, 27, 3.5, 1.5, '2');
        c.ell(22, 27, 3.5, 1.5, '2');
      },
      details(c, p) {
        const b = p.bob;
        c.ell(15.5, 22 + b, 7.5, 5, '5', true);
        drawEyes(c, { lx: 10, y: 15 + b, w: 3, h: 4 }, p);
        blush(c, 20 + b, 6);
        c.over(14, 21 + b, '1'); c.over(15, 22 + b, '1');
        c.over(16, 22 + b, '1'); c.over(17, 21 + b, '1');
        c.ell(7.5, 19 + b, 1.5, 1, '6', true);
        c.ell(23.5, 19 + b, 1.5, 1, '6', true);
        c.set(15, 0 + b, '9'); c.set(16, 0 + b, '9');
        c.over(11, 10 + b, '3'); c.over(12, 9 + b, '3'); c.over(10, 11 + b, '3');
      }
    },

    /* ===== Pixel · Roboter ===== */
    pixel: {
      name: 'Pixel',
      silhouette(c, p) {
        const b = p.bob;
        c.rect(15, 1 + b, 2, 4, '2');
        c.rect(14, 0 + b, 4, 2, '2');
        c.rect(7, 5 + b, 18, 13, '2');
        c.rect(9, 18 + b, 14, 10, '2');
        c.rect(3, 19 + b, 5, 4, '2');
        c.rect(24, 19 + b, 5, 4, '2');
        c.rect(10, 27, 4, 3, '2');
        c.rect(18, 27, 4, 3, '2');
        if (p.legs === 1) { c.rect(10, 26, 4, 3, '2'); }
        if (p.legs === 3) { c.rect(18, 26, 4, 3, '2'); }
      },
      details(c, p) {
        const b = p.bob;
        c.rect(9, 8 + b, 14, 7, '7');
        if (p.eyes === 'closed') {
          c.rect(11, 11 + b, 3, 1, '9'); c.rect(18, 11 + b, 3, 1, '9');
        } else if (p.eyes === 'happy') {
          c.rect(11, 11 + b, 3, 1, '9'); c.set(12, 10 + b, '9');
          c.rect(18, 11 + b, 3, 1, '9'); c.set(19, 10 + b, '9');
        } else {
          c.rect(11, 10 + b, 3, 3, '9'); c.rect(18, 10 + b, 3, 3, '9');
          c.set(11, 10 + b, '8'); c.set(18, 10 + b, '8');
        }
        c.rect(13, 16 + b, 6, 1, '0');
        c.rect(12, 21 + b, 8, 5, '5');
        c.set(14, 23 + b, '9'); c.set(16, 23 + b, '4'); c.set(18, 23 + b, '4');
        c.rect(3, 20 + b, 2, 2, '0'); c.rect(27, 20 + b, 2, 2, '0');
        c.rect(10, 29, 4, 1, '0'); c.rect(18, 29, 4, 1, '0');
      }
    },

    /* ===== Yuki · Pinguin ===== */
    yuki: {
      name: 'Yuki',
      silhouette(c, p) {
        const b = p.bob;
        c.rect(15, 1 + b, 2, 3, '2');
        c.ell(15.5, 15 + b, 9.5, 12, '2');
        c.ell(5.5, 18 + b, 2.5, 5, '2');
        c.ell(25.5, 18 + b, 2.5, 5, '2');
        const off = p.legs === 1 ? -1 : 0, off2 = p.legs === 3 ? -1 : 0;
        c.ell(11, 27 + off, 3, 1.5, '2');
        c.ell(20, 27 + off2, 3, 1.5, '2');
      },
      details(c, p) {
        const b = p.bob;
        c.ell(15.5, 18 + b, 6.5, 8.5, '5', true);
        drawEyes(c, { lx: 11, y: 11 + b }, p);
        blush(c, 14 + b, 9);
        c.rect(14, 15 + b, 4, 2, '9');
        c.rect(15, 17 + b, 2, 1, '9');
        c.ell(11, 27, 3, 1.5, '9', true);
        c.ell(20, 27, 3, 1.5, '9', true);
        c.ell(8, 14 + b, 1.5, 1, '6', true);
        c.ell(23, 14 + b, 1.5, 1, '6', true);
      }
    },

    /* ===== Ember · Drache ===== */
    ember: {
      name: 'Ember',
      silhouette(c, p) {
        const b = p.bob;
        c.rect(24, 20 + b, 3, 2, '2');
        c.rect(26, 17 + b, 2, 4, '2');
        c.tri([27, 13 + b], [30, 17 + b], [26, 17 + b], '2');
        c.tri([1, 7 + b], [12, 16 + b], [4, 22 + b], '2');
        c.tri([30, 7 + b], [19, 16 + b], [27, 22 + b], '2');
        c.tri([9, 1 + b], [8, 7 + b], [13, 6 + b], '2');
        c.tri([22, 1 + b], [23, 7 + b], [18, 6 + b], '2');
        c.ell(15.5, 11 + b, 7.5, 6.5, '2');
        c.ell(15.5, 22 + b, 7, 5.5, '2');
        legsQuad(c, p);
      },
      details(c, p) {
        const b = p.bob;
        c.ell(15.5, 24 + b, 4.5, 3.5, '5', true);
        c.rect(14, 20 + b, 4, 1, '5'); c.rect(13, 22 + b, 6, 1, '5');
        c.ell(15.5, 15 + b, 4.5, 2, '5', true);
        drawEyes(c, { lx: 10, y: 10 + b }, p);
        blush(c, 13 + b, 8);
        c.over(14, 14 + b, '1'); c.over(17, 14 + b, '1');
        c.over(13, 16 + b, '1'); c.over(14, 17 + b, '1');
        c.over(17, 17 + b, '1'); c.over(18, 16 + b, '1');
        c.over(13, 17 + b, '8'); c.over(18, 17 + b, '8');
        c.over(9, 3 + b, '3'); c.over(22, 3 + b, '3');
        c.over(28, 14 + b, '9'); c.over(27, 15 + b, '9');
        // Flügelhäute
        c.tri([3, 10 + b], [10, 16 + b], [5, 20 + b], '6');
        c.tri([28, 10 + b], [21, 16 + b], [26, 20 + b], '6');
        c.rect(4, 15 + b, 5, 1, '4'); c.rect(23, 15 + b, 5, 1, '4');
        c.set(1, 7 + b, '8'); c.set(30, 7 + b, '8');
      }
    }
  };

  /** Zarte Wangen links und rechts vom Gesicht. */
  function blush(c, y, inset) {
    const x = inset === undefined ? 8 : inset;
    c.over(x, y, '6'); c.over(x + 1, y, '6');
    c.over(W - x - 2, y, '6'); c.over(W - x - 1, y, '6');
    c.over(x, y + 1, '6');
    c.over(W - x - 1, y + 1, '6');
  }

  /** Vier Beine im Laufzyklus (Frames 0-3). */
  function legsQuad(c, p) {
    const f = p.legs | 0;
    const lift = [[0, 0], [-1, 0], [0, 0], [0, -1]][f] || [0, 0];
    c.rect(9, 26 + lift[0], 4, 4 - lift[0], '2');
    c.rect(19, 26 + lift[1], 4, 4 - lift[1], '2');
    c.rect(13, 27, 3, 3, '4');
    c.rect(16, 27, 3, 3, '4');
  }

  /* ---------------------------------------------------------
     Accessoires – Pixelaufsätze, gezeichnet nach der Kontur
     --------------------------------------------------------- */
  const ACC_OFFSET = { mochi: 8, pixel: -1, yuki: 1, ember: 0, nova: 0, miso: 0 };

  const ACCESSORIES = {
    scarf: {
      name: 'Halstuch',
      draw(c, p, o) {
        const y = 17 + o + p.bob;
        c.rect(9, y, 14, 2, '9');
        c.rect(10, y + 2, 12, 1, '4');
        c.rect(19, y + 2, 2, 4, '9');
        c.rect(19, y + 6, 2, 1, '4');
      }
    },
    glasses: {
      name: 'Brille',
      draw(c, p, o) {
        const y = 9 + o + p.bob;
        c.rect(8, y, 6, 5, '1'); c.rect(18, y, 6, 5, '1');
        c.rect(9, y + 1, 4, 3, '8'); c.rect(19, y + 1, 4, 3, '8');
        c.rect(14, y + 2, 4, 1, '1');
        c.rect(6, y + 1, 2, 1, '1'); c.rect(24, y + 1, 2, 1, '1');
        c.set(9, y + 1, '0'); c.set(19, y + 1, '0');
      }
    },
    headphones: {
      name: 'Kopfhörer',
      draw(c, p, o) {
        const y = 2 + o + p.bob;
        c.rect(9, y, 14, 1, '1');
        c.rect(7, y + 1, 2, 1, '1'); c.rect(23, y + 1, 2, 1, '1');
        c.rect(5, y + 2, 3, 6, '1'); c.rect(24, y + 2, 3, 6, '1');
        c.rect(6, y + 3, 1, 4, '9'); c.rect(25, y + 3, 1, 4, '9');
        c.rect(11, y - 1, 10, 1, '0');
      }
    },
    partyhat: {
      name: 'Partyhut',
      draw(c, p, o) {
        const y = 0 + o + p.bob;
        c.tri([15.5, y - 1], [11, y + 7], [20, y + 7], '9');
        c.rect(11, y + 7, 9, 1, '4');
        c.rect(13, y + 4, 5, 1, '8');
        c.set(15, y - 2, '8'); c.set(16, y - 2, '8');
      }
    },
    crown: {
      name: 'Krone',
      draw(c, p, o) {
        const y = 1 + o + p.bob;
        c.rect(9, y + 3, 14, 3, '9');
        c.rect(9, y, 2, 4, '9'); c.rect(15, y - 1, 2, 5, '9'); c.rect(21, y, 2, 4, '9');
        c.rect(9, y + 6, 14, 1, '4');
        c.set(15, y + 4, '8'); c.set(16, y + 4, '8');
        c.set(11, y + 4, '2'); c.set(20, y + 4, '2');
      }
    },
    halo: {
      name: 'Sternenring',
      draw(c, p, o) {
        const y = -1 + o + p.bob;
        c.rect(10, y + 1, 12, 1, '9');
        c.set(9, y + 2, '9'); c.set(22, y + 2, '9');
        c.rect(10, y + 3, 12, 1, '9');
        c.set(12, y + 2, '8'); c.set(19, y + 2, '8');
      }
    }
  };

  const toSvg = (grid, colors, cls) => Pixel.toSvg(grid, W, H, colors, cls);

  /** Einen kompletten Frame rendern. */
  function frame(petId, pose, colors, accessory) {
    const pet = PETS[petId];
    const c = new Canvas(W, H);
    pet.silhouette(c, pose);
    c.outline();
    softenOutline(c);
    c.shade();
    pet.details(c, pose);
    if (accessory && ACCESSORIES[accessory]) {
      ACCESSORIES[accessory].draw(c, pose, ACC_OFFSET[petId] || 0);
    }
    return c.g;
  }

  /* Frame-Definitionen je Zustand */
  const POSES = {
    idle:  [{ bob: 0, legs: 0, eyes: 'open' }, { bob: 1, legs: 0, eyes: 'open' }],
    blink: [{ bob: 0, legs: 0, eyes: 'closed' }],
    walk:  [{ bob: 0, legs: 0, eyes: 'open' }, { bob: 1, legs: 1, eyes: 'open' },
            { bob: 0, legs: 2, eyes: 'open' }, { bob: 1, legs: 3, eyes: 'open' }],
    sleep: [{ bob: 1, legs: 0, eyes: 'closed' }, { bob: 2, legs: 0, eyes: 'closed' }],
    happy: [{ bob: 0, legs: 1, eyes: 'happy' }, { bob: 2, legs: 3, eyes: 'happy' }]
  };

  /**
   * Baut das Pet-SVG.
   * @param {object} o { pet, palette, accessory, static }
   */
  function build(o = {}) {
    const petId = PETS[o.pet] ? o.pet : 'nova';
    const paletteId = PALETTES[o.palette] ? o.palette : 'amber';
    const colors = PALETTES[paletteId];
    const acc = o.accessory && ACCESSORIES[o.accessory] ? o.accessory : null;

    const shadowRect = `<g class="px-shadow"><rect x="7" y="30" width="18" height="2" fill="#2E2E2B" opacity=".18"/><rect x="9" y="29" width="14" height="1" fill="#2E2E2B" opacity=".10"/></g>`;

    if (o.static) {
      return svgWrap(petId,
        shadowRect + toSvg(frame(petId, POSES.idle[0], colors, acc), colors, 'px-f px-idle-0'));
    }

    let body = shadowRect;
    Object.keys(POSES).forEach((state) => {
      POSES[state].forEach((pose, i) => {
        body += toSvg(frame(petId, pose, colors, acc), colors, `px-f px-${state}-${i}`);
      });
    });
    return svgWrap(petId, body);
  }

  function svgWrap(petId, inner) {
    return `<svg class="pet-svg pet-svg--${petId}" viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"
      role="img" aria-label="${PETS[petId].name}" focusable="false">${inner}</svg>`;
  }

  return {
    build,
    /** Roh-Raster eines Frames – die Arcade malt es direkt auf die Leinwand. */
    frame,
    POSES,
    W, H,
    PALETTES,
    PET_IDS: Object.keys(PETS),
    PETS,
    ACCESSORIES,
    colorsOf: (id) => PALETTES[id] || PALETTES.amber
  };
});
