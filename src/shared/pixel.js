/* ============================================================
   Claude Pets – Pixel-Zeichenmaschine
   Gemeinsame Grundlage für Charaktere (32x32), Symbole (16x16)
   und Abzeichen (20x20). Gezeichnet wird auf einem Zeichen-Raster,
   ausgegeben wird SVG aus Pixel-Rechtecken.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Pixel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function Canvas(w, h) {
    this.w = w;
    this.h = h || w;
    this.g = new Array(this.w * this.h).fill('.');
  }

  Canvas.prototype.at = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.g[y * this.w + x];
  };

  Canvas.prototype.set = function (x, y, ch) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !ch) return this;
    this.g[y * this.w + x] = ch;
    return this;
  };

  /** Setzt nur dort, wo schon etwas gezeichnet ist – für Details auf einer Form. */
  Canvas.prototype.over = function (x, y, ch) {
    if (this.at(Math.round(x), Math.round(y)) === '.') return this;
    return this.set(x, y, ch);
  };

  Canvas.prototype.rect = function (x, y, w, h, ch) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
    return this;
  };

  /** Rechteck mit abgerundeten Ecken (1 Pixel Radius). */
  Canvas.prototype.round = function (x, y, w, h, ch) {
    this.rect(x, y, w, h, ch);
    this.set(x, y, '.').set(x + w - 1, y, '.');
    this.set(x, y + h - 1, '.').set(x + w - 1, y + h - 1, '.');
    return this;
  };

  Canvas.prototype.ell = function (cx, cy, rx, ry, ch, onlyOver) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / (rx + 0.5);
        const dy = (y + 0.5 - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) onlyOver ? this.over(x, y, ch) : this.set(x, y, ch);
      }
    }
    return this;
  };

  Canvas.prototype.ring = function (cx, cy, rx, ry, ch) {
    const inner = new Canvas(this.w, this.h);
    inner.ell(cx, cy, rx, ry, '#');
    inner.ell(cx, cy, rx - 1, ry - 1, '.');
    for (let i = 0; i < inner.g.length; i++) if (inner.g[i] === '#') this.g[i] = ch;
    return this;
  };

  Canvas.prototype.tri = function (p1, p2, p3, ch) {
    const minX = Math.floor(Math.min(p1[0], p2[0], p3[0]));
    const maxX = Math.ceil(Math.max(p1[0], p2[0], p3[0]));
    const minY = Math.floor(Math.min(p1[1], p2[1], p3[1]));
    const maxY = Math.ceil(Math.max(p1[1], p2[1], p3[1]));
    const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    const A = area(p1, p2, p3);
    if (!A) return this;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const p = [x + 0.5, y + 0.5];
        const w1 = area(p1, p2, p) / A, w2 = area(p2, p3, p) / A, w3 = area(p3, p1, p) / A;
        if (w1 >= -0.02 && w2 >= -0.02 && w3 >= -0.02) this.set(x, y, ch);
      }
    }
    return this;
  };

  /** Gerade Linie (Bresenham). */
  Canvas.prototype.line = function (x0, y0, x1, y1, ch) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, ch);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  };

  /** Spiegelt die linke Hälfte auf die rechte – für perfekte Symmetrie. */
  Canvas.prototype.mirror = function () {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w / 2; x++)
        this.g[y * this.w + (this.w - 1 - x)] = this.g[y * this.w + x];
    return this;
  };

  /** Legt eine 1 Pixel breite Kontur nach außen um alles Gezeichnete. */
  Canvas.prototype.outline = function (ch) {
    const mark = ch || '1';
    const copy = this.g.slice();
    const filled = (x, y) => {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      return copy[y * this.w + x] !== '.';
    };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          this.g[y * this.w + x] = mark;
        }
      }
    }
    return this;
  };

  /**
   * Automatische Licht- und Schattenkanten.
   * Oben angrenzende Pixel werden aufgehellt, unten angrenzende abgedunkelt.
   */
  Canvas.prototype.shade = function (opt) {
    const o = Object.assign({ main: '2', light: '3', dark: '4', outline: '1' }, opt || {});
    const lightMaxX = o.lightMaxX !== undefined ? o.lightMaxX : this.w - this.w / 4;
    const topX = o.topX !== undefined ? o.topX : this.w * 0.625;
    const topY = o.topY !== undefined ? o.topY : this.h * 0.4375;
    const copy = this.g.slice();
    const get = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h) ? '.' : copy[y * this.w + x];

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (get(x, y) !== o.main) continue;
        const up = get(x, y - 1), up2 = get(x, y - 2), down = get(x, y + 1);
        if ((up === o.outline || up === '.') && x < lightMaxX) this.set(x, y, o.light);
        else if (up2 === o.outline && x < topX && y < topY) this.set(x, y, o.light);
        else if (down === o.outline || down === '.') this.set(x, y, o.dark);
      }
    }
    return this;
  };

  /** Verschiebt den gesamten Inhalt. */
  Canvas.prototype.shift = function (dx, dy) {
    const next = new Array(this.w * this.h).fill('.');
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = this.g[y * this.w + x];
        if (ch === '.') continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
        next[ny * this.w + nx] = ch;
      }
    }
    this.g = next;
    return this;
  };

  /* ---------------------------------------------------------
     Ausgabe: waagerechte Läufe werden zu einem Rechteck
     zusammengefasst, damit das SVG klein bleibt.
     --------------------------------------------------------- */
  function toSvg(grid, w, h, colors, cls) {
    let out = '';
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        const ch = grid[y * w + x];
        if (ch === '.') { x++; continue; }
        let len = 1;
        while (x + len < w && grid[y * w + x + len] === ch) len++;
        const fill = colors[ch];
        if (fill) out += `<rect x="${x}" y="${y}" width="${len}" height="1" fill="${fill}"/>`;
        x += len;
      }
    }
    return cls ? `<g class="${cls}">${out}</g>` : out;
  }

  function svg(inner, w, h, attrs) {
    const a = attrs || {};
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"` +
      ` shape-rendering="crispEdges" focusable="false"` +
      (a.class ? ` class="${a.class}"` : '') +
      (a.label ? ` role="img" aria-label="${a.label}"` : ' aria-hidden="true"') +
      `>${inner}</svg>`;
  }

  return { Canvas, toSvg, svg };
});
