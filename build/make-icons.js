/* Erzeugt die App-/Tray-Icons als echte PNGs (ohne externe Abhängigkeiten). */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ORANGE = [217, 119, 87];
const CREAM  = [250, 249, 245];
const DEEP   = [191, 92, 60];

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunks = [];
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

/* --- Mini-Rasterizer mit 4x Supersampling --- */
function draw(size, shapes) {
  const SS = 4;
  const W = size * SS;
  const acc = new Float32Array(size * size * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (const s of shapes) {
        if (!s.hit(x / SS, y / SS, size)) continue;
        const [sr, sg, sb] = s.color;
        const sa = s.alpha === undefined ? 1 : s.alpha;
        r = sr * sa + r * (1 - sa);
        g = sg * sa + g * (1 - sa);
        b = sb * sa + b * (1 - sa);
        a = sa + a * (1 - sa);
      }
      const i = (Math.floor(y / SS) * size + Math.floor(x / SS)) * 4;
      acc[i] += r; acc[i + 1] += g; acc[i + 2] += b; acc[i + 3] += a;
    }
  }
  const out = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let i = 0; i < size * size * 4; i += 4) {
    out[i] = Math.round(acc[i] / n);
    out[i + 1] = Math.round(acc[i + 1] / n);
    out[i + 2] = Math.round(acc[i + 2] / n);
    out[i + 3] = Math.round((acc[i + 3] / n) * 255);
  }
  return out;
}

const roundedRect = (x, y, w, h, r, color) => ({
  color,
  hit(px, py) {
    if (px < x || py < y || px > x + w || py > y + h) return false;
    const cx = Math.min(Math.max(px, x + r), x + w - r);
    const cy = Math.min(Math.max(py, y + r), y + h - r);
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
  }
});

const ellipse = (cx, cy, rx, ry, color, alpha) => ({
  color, alpha,
  hit(px, py) { return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1; }
});

function pawIcon(size) {
  const s = (v) => v * size;
  const shapes = [
    roundedRect(0, 0, size, size, s(0.24), ORANGE),
    // Ballen
    ellipse(s(0.5), s(0.665), s(0.215), s(0.185), CREAM),
    // Zehen
    ellipse(s(0.255), s(0.44), s(0.088), s(0.105), CREAM),
    ellipse(s(0.425), s(0.335), s(0.088), s(0.108), CREAM),
    ellipse(s(0.598), s(0.335), s(0.088), s(0.108), CREAM),
    ellipse(s(0.762), s(0.44), s(0.088), s(0.105), CREAM)
  ];
  return draw(size, shapes);
}

const outDir = path.join(__dirname, '..', 'src', 'assets');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 22, 32, 64, 128, 180, 192, 256, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), encodePNG(size, size, pawIcon(size)));
}
fs.copyFileSync(path.join(outDir, 'icon-32.png'), path.join(outDir, 'tray.png'));
fs.copyFileSync(path.join(outDir, 'icon-512.png'), path.join(__dirname, 'icon.png'));
console.log('Icons erzeugt in', outDir);
