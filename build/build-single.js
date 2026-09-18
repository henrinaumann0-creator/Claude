/* ============================================================
   Baut die Web-Version zu einer einzigen HTML-Datei zusammen.
   Stile, Skripte und Symbole wandern direkt ins Dokument – die
   Datei läuft danach per Doppelklick, ohne Server und ohne Netz.
   Voraussetzung: build-web.js lief vorher (dist-web/).
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'dist-web');
const OUT = path.join(ROOT, 'dist-single');
const NAME = 'claude-pets.html';

/* Frischer Web-Build, damit nichts Altes mitkommt */
execFileSync(process.execPath, [path.join(__dirname, 'build-web.js')], { stdio: 'ignore' });

const read = (p) => fs.readFileSync(path.join(WEB, p), 'utf8');
const readBin = (p) => fs.readFileSync(path.join(WEB, p));

/** `</script>` in eingebettetem Code würde das Dokument zerreißen. */
const guard = (code) => code.replace(/<\/(script)/gi, '<\\/$1');

const dataUri = (p) => 'data:image/png;base64,' + readBin(p).toString('base64');

let html = read('index.html');

/* Stile einbetten */
html = html.replace(/[ \t]*<link rel="stylesheet" href="([^"]+)" \/>\n?/g, (_m, href) =>
  `  <style>\n/* ${href} */\n${read(href)}\n  </style>\n`);

/* Skripte einbetten */
html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>\n?/g, (_m, src) =>
  `  <script>\n/* ${src} */\n${guard(read(src))}\n  </script>\n`);

/* Symbole direkt ins Dokument – keine Nachbardateien mehr nötig */
html = html.replace(/(src|href)="(icons\/icon-\d+\.png)"/g, (_m, attr, file) =>
  `${attr}="${dataUri(file)}"`);

/* Ohne Nachbardateien gibt es auch kein Manifest */
html = html.replace(/[ \t]*<link rel="manifest"[^>]*>\n?/g, '');

/* Kopfzeile mit Hinweis */
html = html.replace('<head>', `<head>
  <!--
    Claude Pets – komplette App in einer Datei.
    Erzeugt mit "npm run build:single" aus dem Quellcode unter
    https://github.com/henrinaumann0-creator/Claude
    Einfach im Browser öffnen. Der Spielstand liegt im Browser
    dieses Geräts; über Einstellungen → Spielstand übertragen
    lässt er sich mit einem Code mitnehmen.
  -->`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, NAME), html, 'utf8');

const kb = (fs.statSync(path.join(OUT, NAME)).size / 1024).toFixed(0);
const rest = (html.match(/<(link|script)[^>]*(href|src)="(?!data:)[^"]+"/g) || []);
console.log(`Einzeldatei gebaut → dist-single/${NAME} (${kb} KB)`);
console.log(rest.length ? 'ACHTUNG, noch externe Verweise: ' + rest.join(', ')
                        : 'Keine externen Verweise – die Datei ist eigenständig.');
