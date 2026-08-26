/* ============================================================
   Baut die Web-Version aus den geteilten Quellen.
   Es gibt keine Code-Kopien im Repository: Markup und Skripte
   werden hier aus src/ entnommen und nach dist-web/ gelegt.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist-web');
const rel = (...p) => path.join(ROOT, ...p);

/** Holt alles zwischen <body> und dem ersten <script>. */
function bodyMarkup(file) {
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('<body>') + '<body>'.length;
  const end = html.indexOf('<script', start);
  if (start < 6 || end < 0) throw new Error('Kein verwertbarer Body in ' + file);
  return html.slice(start, end).trim();
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/* Zielordner frisch anlegen */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'lib'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });

/* Geteilte Skripte und Stile */
const LIB = [
  ['src/shared/theme.css', 'lib/theme.css'],
  ['src/shared/progression.js', 'lib/progression.js'],
  ['src/shared/thoughts.js', 'lib/thoughts.js'],
  ['src/renderer/pet/pets.js', 'lib/pets.js'],
  ['src/renderer/pet/pet.js', 'lib/pet.js'],
  ['src/renderer/pet/pet.css', 'lib/pet.css'],
  ['src/renderer/dashboard/dashboard.js', 'lib/dashboard.js'],
  ['src/renderer/dashboard/dashboard.css', 'lib/dashboard.css']
];
LIB.forEach(([from, to]) => copy(rel(from), path.join(OUT, to)));

/* Web-eigene Dateien */
['core.js', 'app.js', 'web.css', 'sw.js', 'manifest.webmanifest']
  .forEach((f) => copy(rel('web', f), path.join(OUT, f)));

/* Symbole */
[64, 180, 192, 512].forEach((s) =>
  copy(rel('src/assets', `icon-${s}.png`), path.join(OUT, 'icons', `icon-${s}.png`)));

/* index.html aus Hülle + geteiltem Markup zusammensetzen */
let shell = fs.readFileSync(rel('web/shell.html'), 'utf8');

let dashboard = bodyMarkup(rel('src/renderer/dashboard/index.html'));
let stage = bodyMarkup(rel('src/renderer/pet/index.html'));

// Im Web zeigen Symbole in der Seitenleiste auf den kopierten Ordner
dashboard = dashboard.replace(/\.\.\/\.\.\/assets\//g, 'icons/');

shell = shell.replace('<!--#DASHBOARD#-->', dashboard)
             .replace('<!--#STAGE#-->', stage);

fs.writeFileSync(path.join(OUT, 'index.html'), shell, 'utf8');

/* GitHub Pages soll die Dateien unveraendert ausliefern (kein Jekyll) */
fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p) : files.push(path.relative(OUT, p));
  }
})(OUT);

console.log(`Web-Version gebaut → dist-web/ (${files.length} Dateien)`);
files.sort().forEach((f) => console.log('  ' + f));
