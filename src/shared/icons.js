/* ============================================================
   Claude Pets – Symbol-Bibliothek
   Jedes Symbol ist handgezeichnete Pixel-Grafik auf 16x16,
   gezeichnet mit denselben Werkzeugen wie die Charaktere.
   Keine Emojis, keine externen Grafiken.
   ============================================================ */
(function (root, factory) {
  const Pixel = (typeof module === 'object' && module.exports)
    ? require('./pixel.js') : root.Pixel;
  const api = factory(Pixel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Icons = api;
})(typeof self !== 'undefined' ? self : this, function (Pixel) {
  'use strict';

  const S = 16;

  /* ---------------------------------------------------------
     Farbtöne
     1 Kontur · 2 Haupt · 3 hell · 4 dunkel · 5 creme
     6 Gold · 7 Tinte · 8 Weiß · 9 Grau
     --------------------------------------------------------- */
  const TONES = {
    brand:  { 1:'#8A4A31', 2:'#D97757', 3:'#EFA47F', 4:'#B25A3D', 5:'#FBEFE6', 6:'#E8B44A', 7:'#3D3A34', 8:'#FFFFFF', 9:'#B4AFA2' },
    muted:  { 1:'#9A968B', 2:'#BDB8AB', 3:'#D3CFC4', 4:'#A6A296', 5:'#F2F0E9', 6:'#C9C3B2', 7:'#6E6B63', 8:'#FFFFFF', 9:'#BDB8AB' },
    gold:   { 1:'#8A6413', 2:'#E8B44A', 3:'#F6D488', 4:'#C0902B', 5:'#FFF6E2', 6:'#D97757', 7:'#4A3A18', 8:'#FFFFFF', 9:'#C9C3B2' },
    silver: { 1:'#6E7480', 2:'#B9C0C9', 3:'#DDE2E8', 4:'#8D949E', 5:'#F5F7F9', 6:'#D97757', 7:'#3F444C', 8:'#FFFFFF', 9:'#AEB4BC' },
    bronze: { 1:'#7A4A24', 2:'#C08048', 3:'#DDA878', 4:'#966132', 5:'#F8ECDF', 6:'#D97757', 7:'#4A3018', 8:'#FFFFFF', 9:'#BFA48C' },
    ink:    { 1:'#2E2E2B', 2:'#56564F', 3:'#86867C', 4:'#3D3D3A', 5:'#F2F0E9', 6:'#D97757', 7:'#2E2E2B', 8:'#FFFFFF', 9:'#A8A89C' },
    cream:  { 1:'#B25A3D', 2:'#FBEFE6', 3:'#FFFFFF', 4:'#F0C8B0', 5:'#D97757', 6:'#E8B44A', 7:'#8A4A31', 8:'#FFFFFF', 9:'#E0DCD2' }
  };

  /** Zeichnet ein handgezeichnetes Raster an eine Position. */
  function paint(c, rows, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch !== '.' && ch !== ' ') c.set(ox + x, oy + y, ch);
      }
    });
  }

  /* ---------------------------------------------------------
     Die Symbole
     --------------------------------------------------------- */
  const ICONS = {

    /* — Navigation — */
    home: {
      outline: true, shade: true,
      draw(c) {
        c.tri([8, 1.5], [1.5, 8], [14.5, 8], '2');
        c.rect(3, 8, 10, 6, '2');
        c.rect(6, 10, 4, 4, '5');
        c.rect(11, 3, 2, 3, '4');
      }
    },

    gift: {
      outline: true, shade: true,
      draw(c) {
        c.rect(3, 7, 10, 7, '2');
        c.rect(2, 5, 12, 3, '3');
        c.rect(7, 5, 2, 9, '6');
        c.ell(4.5, 3.5, 2, 1.5, '6');
        c.ell(11.5, 3.5, 2, 1.5, '6');
        c.set(4, 3, '.'); c.set(12, 3, '.');
      }
    },

    wardrobe: {
      outline: false, shade: false,
      draw(c) {
        // Großer Vier-Zack-Stern
        c.tri([7.5, 0.5], [5, 7.5], [10, 7.5], '2');
        c.tri([7.5, 14.5], [5, 7.5], [10, 7.5], '2');
        c.tri([0.5, 7.5], [7.5, 5], [7.5, 10], '2');
        c.tri([14.5, 7.5], [7.5, 5], [7.5, 10], '2');
        c.ell(7.5, 7.5, 2, 2, '3');
        c.set(7, 6, '8'); c.set(8, 6, '8');
        // Kleiner Funke
        c.set(13, 2, '6'); c.set(12, 3, '6'); c.set(14, 3, '6'); c.set(13, 4, '6'); c.set(13, 3, '3');
      }
    },

    chart: {
      outline: true, shade: true,
      draw(c) {
        c.rect(2, 10, 3, 4, '4');
        c.rect(6, 6, 3, 8, '2');
        c.rect(10, 3, 3, 11, '3');
      }
    },

    gear: {
      outline: true, shade: false,
      draw(c) {
        c.rect(6, 1, 4, 14, '2');
        c.rect(1, 6, 14, 4, '2');
        c.ell(8, 8, 5.5, 5.5, '2');
        c.ell(8, 8, 2.2, 2.2, '.');
        c.rect(6, 1, 2, 3, '3');
        c.rect(1, 6, 3, 2, '3');
      }
    },

    trophy: {
      outline: true, shade: true,
      draw(c) {
        c.ell(3, 5, 2.6, 2.6, '2'); c.ell(3, 5, 1, 1.2, '.');
        c.ell(13, 5, 2.6, 2.6, '2'); c.ell(13, 5, 1, 1.2, '.');
        c.rect(4, 2, 8, 4, '2');
        c.ell(8, 6, 4, 3.2, '2');
        c.rect(7, 9, 2, 3, '4');
        c.rect(4, 12, 8, 2, '4');
        c.rect(5, 3, 1, 4, '3');
      }
    },

    /* — Aktionen — */
    paw: {
      outline: true, shade: true,
      draw(c) {
        c.ell(8, 12.5, 4, 3, '2');
        c.ell(2.8, 5.6, 1.7, 2, '2');
        c.ell(6.3, 3.2, 1.7, 2, '2');
        c.ell(9.7, 3.2, 1.7, 2, '2');
        c.ell(13.2, 5.6, 1.7, 2, '2');
      }
    },

    bubble: {
      outline: true, shade: false,
      draw(c) {
        c.round(2, 2, 12, 8, '5');
        c.set(5, 6, '2'); c.set(8, 6, '2'); c.set(11, 6, '2');
        c.ell(5, 11.5, 1.5, 1, '5');
        c.set(3, 13, '5'); c.set(2, 14, '5');
      }
    },

    apple: {
      outline: true, shade: true,
      draw(c) {
        c.ell(5.6, 10, 3.6, 4.2, '2');
        c.ell(10.4, 10, 3.6, 4.2, '2');
        c.rect(6, 7, 4, 5, '2');
        c.rect(7, 5, 2, 2, '.');
        c.rect(8, 3, 1, 4, '4');
        c.ell(11, 3.6, 2.4, 1.4, '3');
        c.ell(5.2, 8.4, 1.2, 1.6, '3');
      }
    },

    ball: {
      outline: true, shade: false,
      draw(c) {
        c.ell(8, 8, 5.5, 5.5, '2');
        c.rect(2, 7, 12, 2, '5');
        c.ell(8, 8, 5.5, 5.5, '.', false) && 0;
        c.ell(8, 8, 5.5, 5.5, '#');
        // Streifen nur innerhalb des Balls behalten
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          if (c.at(x, y) === '#') c.set(x, y, (y === 7 || y === 8) ? '5' : '2');
        }
        c.ell(5.6, 5.2, 1.6, 1.2, '3');
        c.set(5, 8, '2'); c.set(11, 7, '2');
      }
    },

    moon: {
      outline: true, shade: false,
      draw(c) {
        c.ell(7.5, 8, 5.5, 5.5, '6');
        c.ell(11, 5, 5, 5, '.');
        c.set(13, 11, '6'); c.set(12, 12, '3'); c.set(14, 12, '3');
      }
    },

    sun: {
      outline: true, shade: false,
      draw(c) {
        c.ell(8, 8, 3.5, 3.5, '6');
        c.rect(7, 0, 2, 2, '6'); c.rect(7, 14, 2, 2, '6');
        c.rect(0, 7, 2, 2, '6'); c.rect(14, 7, 2, 2, '6');
        c.set(3, 3, '6'); c.set(2, 2, '6');
        c.set(12, 3, '6'); c.set(13, 2, '6');
        c.set(3, 12, '6'); c.set(2, 13, '6');
        c.set(12, 12, '6'); c.set(13, 13, '6');
        c.ell(7, 7, 1.5, 1.5, '3');
      }
    },

    close: {
      outline: false, shade: false,
      draw(c) {
        for (let i = 0; i < 8; i++) {
          c.rect(4 + i, 4 + i, 2, 2, '2');
          c.rect(11 - i, 4 + i, 2, 2, '2');
        }
      }
    },

    check: {
      outline: false, shade: false,
      draw(c) {
        c.line(3, 8, 6, 12, '2'); c.line(4, 8, 7, 12, '2');
        c.line(3, 9, 6, 13, '2');
        c.line(6, 12, 13, 4, '2'); c.line(7, 12, 14, 4, '2');
        c.line(6, 13, 13, 5, '2');
      }
    },

    ban: {
      outline: false, shade: false,
      draw(c) {
        c.ring(8, 8, 6, 6, '9');
        c.ring(8, 8, 5.2, 5.2, '9');
        c.line(4, 12, 12, 4, '9'); c.line(4, 11, 11, 4, '9');
      }
    },

    lock: {
      outline: true, shade: true,
      draw(c) {
        c.ring(8, 6, 3.5, 3.5, '9');
        c.rect(3, 7, 10, 4, '.');
        c.rect(3, 8, 10, 7, '6');
        c.rect(7, 10, 2, 3, '4');
      }
    },

    flame: {
      outline: true, shade: false,
      draw(c) {
        c.tri([8, 1], [4, 9], [12, 9], '2');
        c.ell(8, 10, 4, 4, '2');
        c.tri([8, 5], [6, 10], [10, 10], '6');
        c.ell(8, 11, 2.5, 2.5, '6');
        c.ell(8, 12, 1.5, 1.5, '3');
      }
    },

    heart: {
      outline: true, shade: true,
      draw(c) {
        c.ell(5, 6, 3, 3, '2');
        c.ell(11, 6, 3, 3, '2');
        c.tri([1.5, 7], [14.5, 7], [8, 14.5], '2');
      }
    },

    star: {
      outline: true, shade: true,
      draw(c) {
        paint(c, [
          '.......22.......',
          '......2222......',
          '......2222......',
          '.....222222.....',
          '2222222222222222',
          '.22222222222222.',
          '..222222222222..',
          '...2222222222...',
          '...2222222222...',
          '..222222222222..',
          '..22222..22222..',
          '.2222......2222.',
          '.222........222.',
          '.22..........22.'
        ], 0, 1);
      }
    },

    palette: {
      outline: true, shade: false,
      draw(c) {
        c.ell(8, 8, 6, 5.5, '5');
        c.ell(10.5, 10.5, 1.5, 1.5, '.');
        c.ell(4.5, 6, 1.2, 1.2, '2');
        c.ell(7.5, 4.5, 1.2, 1.2, '6');
        c.ell(11, 6, 1.2, 1.2, '3');
        c.ell(4.5, 10, 1.2, 1.2, '4');
      }
    },

    bow: {
      outline: true, shade: true,
      draw(c) {
        c.tri([7, 7], [1, 3], [1, 11], '2');
        c.tri([9, 7], [15, 3], [15, 11], '2');
        c.ell(3.5, 7, 2, 2.4, '3');
        c.ell(12.5, 7, 2, 2.4, '3');
        c.rect(7, 5, 2, 5, '4');
        c.rect(6, 11, 2, 4, '2');
        c.rect(8, 11, 2, 4, '2');
        c.set(6, 14, '.'); c.set(9, 14, '.');
      }
    },

    crown: {
      outline: true, shade: true,
      draw(c) {
        c.rect(2, 8, 12, 4, '6');
        c.tri([2, 9], [2, 3], [5, 8], '6');
        c.tri([8, 9], [8, 1], [5, 8], '6');
        c.tri([8, 9], [8, 1], [11, 8], '6');
        c.tri([14, 9], [14, 3], [11, 8], '6');
        c.rect(2, 12, 12, 2, '4');
        c.set(7, 9, '2'); c.set(8, 9, '2');
        c.set(4, 10, '5'); c.set(11, 10, '5');
      }
    },

    boot: {
      outline: true, shade: true,
      draw(c) {
        c.rect(4, 2, 5, 8, '2');
        c.rect(4, 9, 9, 4, '2');
        c.ell(11, 10.5, 2.5, 2.5, '2');
        c.rect(3, 13, 11, 2, '4');
        c.rect(5, 4, 3, 1, '5');
      }
    },

    clock: {
      outline: true, shade: false,
      draw(c) {
        c.ell(8, 8, 6, 6, '5');
        c.ring(8, 8, 6, 6, '2');
        c.rect(7, 4, 2, 5, '4');
        c.rect(8, 8, 4, 2, '4');
        c.set(8, 8, '2');
      }
    },

    upload: {
      outline: true, shade: true,
      draw(c) {
        c.rect(2, 10, 12, 4, '2');
        c.tri([8, 1.5], [3, 7], [13, 7], '6');
        c.rect(6, 6, 4, 4, '6');
        c.rect(6, 11, 4, 2, '5');
      }
    },

    download: {
      outline: true, shade: true,
      draw(c) {
        c.rect(2, 10, 12, 4, '2');
        c.tri([8, 9.5], [3, 4], [13, 4], '6');
        c.rect(6, 1, 4, 4, '6');
        c.rect(6, 11, 4, 2, '5');
      }
    },

    medal: {
      outline: true, shade: true,
      draw(c) {
        c.rect(4, 0, 3, 7, '2');
        c.rect(9, 0, 3, 7, '4');
        c.ell(8, 10, 5, 5, '6');
        c.ell(8, 10, 2.6, 2.6, '3');
        c.set(7, 9, '8');
      }
    },

    egg: {
      outline: true, shade: false,
      draw(c) {
        c.ell(8, 9.5, 5, 5.5, '5');
        c.ell(8, 6, 3.6, 3.6, '5');
        c.line(3, 9, 5, 7, '4'); c.line(5, 7, 7, 10, '4');
        c.line(7, 10, 9, 7, '4'); c.line(9, 7, 11, 10, '4');
        c.line(11, 10, 13, 8, '4');
        c.ell(6, 5, 1.4, 1.2, '3');
      }
    },

    sparkles: {
      outline: false, shade: false,
      draw(c) {
        c.tri([5, 1], [3, 6], [7, 6], '6');
        c.tri([5, 11], [3, 6], [7, 6], '6');
        c.tri([1, 6], [5, 4], [5, 8], '6');
        c.tri([9, 6], [5, 4], [5, 8], '6');
        c.tri([11, 7], [9.5, 10.5], [12.5, 10.5], '2');
        c.tri([11, 14], [9.5, 10.5], [12.5, 10.5], '2');
        c.tri([8, 10.5], [11, 9], [11, 12], '2');
        c.tri([14, 10.5], [11, 9], [11, 12], '2');
        c.set(4, 5, '3'); c.set(5, 5, '3');
      }
    }
  };

  /* ---------------------------------------------------------
     Aufbau
     --------------------------------------------------------- */
  const cache = new Map();

  function grid(name) {
    if (cache.has(name)) return cache.get(name);
    const def = ICONS[name] || ICONS.paw;
    const c = new Pixel.Canvas(S, S);
    def.draw(c);
    if (def.outline !== false) c.outline('1');
    if (def.shade) c.shade({ lightMaxX: S, topX: S, topY: S });
    cache.set(name, c.g);
    return c.g;
  }

  /**
   * Liefert ein Symbol als SVG.
   * @param {string} name  Symbolname
   * @param {object} opt   { tone, size, className, label }
   */
  function build(name, opt = {}) {
    const colors = TONES[opt.tone] || TONES.brand;
    const inner = Pixel.toSvg(grid(name), S, S, colors);
    const cls = 'pxi' + (opt.className ? ' ' + opt.className : '');
    const size = opt.size ? ` width="${opt.size}" height="${opt.size}"` : '';
    return `<svg class="${cls}" viewBox="0 0 ${S} ${S}"${size}` +
      ` xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"` +
      (opt.label ? ` role="img" aria-label="${opt.label}"` : ' aria-hidden="true"') +
      ` focusable="false">${inner}</svg>`;
  }

  /**
   * Ersetzt alle Platzhalter `[data-icon]` unterhalb von `root`
   * durch das jeweilige Symbol. `data-tone` waehlt den Farbton.
   */
  function hydrate(root) {
    const scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-icon]').forEach((node) => {
      const name = node.getAttribute('data-icon');
      if (!name || node.dataset.iconDone === name) return;
      node.innerHTML = build(name, { tone: node.getAttribute('data-tone') || 'brand' });
      node.dataset.iconDone = name;
    });
  }

  return { build, hydrate, TONES, NAMES: Object.keys(ICONS), SIZE: S };
});
