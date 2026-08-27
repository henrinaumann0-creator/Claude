<div align="center">

<img src="src/assets/icon-128.png" width="84" alt="Claude Pets" />

# Claude Pets

**Ein animierter Pixel-Begleiter mit Level-System, freischaltbaren Belohnungen und lesbaren Gedankenblasen.**

Helles Orange auf warmem Grau. Als Desktop-App für Windows, macOS und Linux –
und als Web-App (PWA) für Browser und Handy.

</div>

---

## Zwei Wege, dieselbe App

| | Desktop-App | Web-App (PWA) |
| --- | --- | --- |
| Läuft auf | Windows · macOS · Linux | jedem Browser, Handy inklusive |
| Das Pet lebt | als transparentes Overlay **über allen Fenstern** | über der App-Oberfläche |
| Bedienung | Links-/Rechtsklick, Ziehen | Tippen, Halten, Ziehen |
| Zusätzlich | Tray-Symbol, Autostart | zum Startbildschirm hinzufügbar, offline nutzbar |
| Wo das Pet läuft | über allen Fenstern | im eigenen **Spielplatz**, nie über Inhalten |
| Spielstand | lokal im Benutzerordner | lokal im Browser |

Beide Varianten teilen sich denselben Code: Charaktere, Level-Kurve, Belohnungen und
Gedanken liegen in `src/shared/` bzw. `src/renderer/` und werden für das Web nur neu
zusammengesetzt. Über einen **Spielstand-Code** (Einstellungen → *Spielstand übertragen*)
nimmst du deinen Fortschritt von einem Gerät aufs andere mit.

---

## Was die App macht

Dein Pet sitzt unten rechts – in der Desktop-App als **transparentes Overlay** über allen Fenstern, aber klick-durchlässig: Du arbeitest ganz normal weiter, bis du den Mauszeiger wirklich auf das Tier bewegst.

* **Sechs Pixel-Charaktere** – Fuchs, Katze, Blob, Roboter, Pinguin, Drache. Jeder mit eigenem
  Laufzyklus, Blinzeln, Schlaf- und Freude-Animation, weichen Konturen und Wangenrot.
* **Gedankenblasen** mit Schreibmaschinen-Effekt – über 80 Sprüche in sechs Paketen, dazu
  tages- und situationsabhängige Gedanken.
* **Level 1–50** mit sichtbarem XP-Balken. XP gibt es fürs Streicheln, Spazieren, Füttern,
  Spielen, Gedankenlesen und einfach fürs Dabeisein.
* **34 Belohnungen**, gestaffelt über die Level: neue Pets, Accessoires, Farbpaletten,
  Gedanken-Pakete, Partikel-Effekte und Fähigkeiten.
* **29 Erfolge** in Bronze, Silber und Gold – jeder mit Fortschrittsbalken und Bonus-XP.
* **Dashboard** im Claude-Look: Übersicht, Belohnungen, Erfolge, Ausstattung, Statistik,
  Einstellungen.
* **Tages-Streak** – wer täglich vorbeischaut, bekommt einen wachsenden Bonus.
* **Jedes Symbol selbst gezeichnet** – 29 Pixel-Icons aus derselben Zeichenmaschine wie die
  Charaktere. Keine Emojis, keine fremden Grafiken.

---

## Steuerung

| Aktion | Was passiert |
| --- | --- |
| **Linksklick** auf das Pet | Streicheln (+XP) – danach rennt es zu einem zufälligen Punkt auf dem Bildschirm |
| **Ziehen** mit gedrückter linker Maustaste | Pet an eine andere Stelle setzen (es lässt sich anschließend zu Boden gleiten) |
| **Rechtsklick** auf das Pet | Schnellmenü: Spazieren · Gedanke · Schlafen · Dashboard · **Pet entfernen** |
| **Tippen** (Handy) | wie Linksklick |
| **Gedrückt halten** (Handy) | öffnet das Schnellmenü |
| **Esc** | Menü und Gedankenblase schließen |
| **Tray-Symbol** (Klick) | Dashboard öffnen |
| **Tray-Symbol** (Rechtsklick) | Pet ein-/ausblenden, Level ablesen, beenden |

> Ein entferntes Pet ist nicht weg – es wird nur ausgeblendet. Über das Tray-Menü oder die Einstellungen holst du es zurück.

---

## Installation

```bash
git clone https://github.com/henrinaumann0-creator/Claude.git
cd Claude
npm install
npm start
```

Fertiges Installationspaket bauen:

```bash
npm run dist:win     # Windows  (NSIS-Installer)
npm run dist:mac     # macOS    (DMG)
npm run dist:linux   # Linux    (AppImage)
```

Die Pakete landen in `dist/`. Für die Entwicklung mit offenen DevTools: `npm run dev`.

### Web-Version

```bash
npm run build:web    # baut nach dist-web/
npm run serve:web    # baut und startet http://localhost:4173
```

`dist-web/` ist reine Statik ohne Abhängigkeiten und lässt sich überall hosten.
Die mitgelieferte `vercel.json` beschreibt den Build (`node build/build-web.js` →
`dist-web/`), sodass jeder Push automatisch neu veröffentlicht wird.

**Veröffentlicht auf GitHub Pages:**
<https://henrinaumann0-creator.github.io/Claude/>

Der Workflow `.github/workflows/web.yml` baut und veröffentlicht bei jedem Push auf
den Standard-Branch. Damit das greift, muss Pages im Repository einmalig eingeschaltet
sein: *Settings → Pages → Source: **GitHub Actions***.

Auf dem Handy: Seite im Browser öffnen → *Zum Home-Bildschirm hinzufügen*. Danach
startet Claude Pets wie eine normale App im Vollbild und läuft auch offline.

**Der Spielplatz:** Im Browser hat das Pet ein eigenes Feld auf der Übersicht und läuft
ausschließlich dort. Es verdeckt also nie Text, Karten oder Schaltflächen – auch nicht beim
Scrollen oder Drehen. Auf allen anderen Seiten blendet es sich aus.

---

## Erfolge

29 Abzeichen in drei Stufen, jedes mit sichtbarem Fortschritt und Bonus-XP:

| Stufe | Anzahl | Bonus | Beispiele |
| --- | --- | --- | --- |
| Bronze | 9 | je 25 XP | Erste Berührung · Erster Ausflug · Drei Tage am Stück · Umzugshelfer |
| Silber | 12 | je 60 XP | Kraulmeister (100×) · Nachteule · Frühaufsteher · Weite Wege (25.000 px) |
| Gold | 8 | je 150 XP | Volles Haus · Farbenfroh · Sammler · Legende (Level 50) |

Zusammen bringen alle Abzeichen **2.145 zusätzliche XP**. Erfolge prüfen sich nach jeder
Aktion selbst; neu erreichte melden sich mit einem Banner am Pet und im Dashboard.

---

## Level & Belohnungen

XP-Bedarf pro Level: `40 × Level^1.22 + 20` – der Anstieg ist spürbar, aber nie frustrierend.

| XP-Quelle | XP | Hinweis |
| --- | --- | --- |
| Streicheln | 6 | 1,5 s Abklingzeit, +50 % ab „Großes Herz" (Lvl 40) |
| Spaziergang | 12 | pro abgeschlossener Strecke |
| Gedanke gelesen | 3 | wenn die Blase fertig getippt ist |
| Zeit zusammen | 1 | pro Minute mit sichtbarem Pet |
| Snack | 45 | wenn die Sattheit unter 75 % liegt |
| Spielen | 25 | alle 30 Minuten |
| Täglicher Besuch | 60 | ×1,15 pro Streak-Tag, max. ×3 |

<details>
<summary><b>Alle 34 Belohnungen anzeigen</b></summary>

| Level | Belohnung | Typ |
| --- | --- | --- |
| 1 | Nova (Fuchs) · Amber · Alltag | Pet · Farbe · Gedanken |
| 3 | Halstuch | Accessoire |
| 4 | Miso (Katze) | Pet |
| 5 | Sunset | Farbe |
| 6 | Brille | Accessoire |
| 7 | Neugier | Gedanken |
| 8 | Mochi (Blob) | Pet |
| 9 | Funken | Effekt |
| 10 | Mint | Farbe |
| 11 | Kopfhörer | Accessoire |
| 12 | Flinke Pfoten | Fähigkeit |
| 13 | Philosophie | Gedanken |
| 14 | Pixel (Roboter) | Pet |
| 16 | Partyhut | Accessoire |
| 17 | Herzchen | Effekt |
| 18 | Lavendel | Farbe |
| 19 | Redselig | Fähigkeit |
| 20 | Motivation | Gedanken |
| 21 | Yuki (Pinguin) | Pet |
| 23 | Konfetti | Effekt |
| 25 | Krone | Accessoire |
| 26 | Nachteule | Fähigkeit |
| 27 | Mitternacht | Farbe |
| 28 | Quatsch | Gedanken |
| 30 | Ember (Drache) | Pet |
| 32 | Sternenstaub | Effekt |
| 33 | Koralle | Farbe |
| 35 | Sternenring | Accessoire |
| 38 | Code | Gedanken |
| 40 | Großes Herz | Fähigkeit |
| 44 | Polarlicht | Effekt |
| 50 | Legendär | Fähigkeit |

</details>

---

## Aufbau des Projekts

```
src/
├─ main/
│  ├─ main.js          Fenster, Tray, XP-Logik, IPC
│  ├─ preload.js       contextBridge-Brücke (contextIsolation an)
│  └─ store.js         Persistenz (atomares JSON in userData)
├─ shared/
│  ├─ theme.css        Design-Tokens (Orange/Grau)
│  ├─ pixel.js         Pixel-Zeichenmaschine (Grundlage für alle Grafiken)
│  ├─ icons.js         29 handgezeichnete Pixel-Symbole in sieben Farbtönen
│  ├─ progression.js   Level-Kurve, XP-Quellen, Belohnungs-Katalog
│  ├─ achievements.js  Erfolgs-Katalog und Auswertung
│  └─ thoughts.js      Gedanken-Pakete
├─ renderer/
│  ├─ pet/             Overlay: Pixel-Charaktere, Frame-Treiber, Verhalten
│  └─ dashboard/       Dashboard-Oberfläche
└─ assets/             App- und Tray-Icons

web/
├─ shell.html          Gerüst der Web-Version (Platzhalter für geteiltes Markup)
├─ core.js             Ersatz für die Electron-Bridge: derselbe `window.pets`,
│                      aber mit localStorage statt IPC
├─ app.js              Tab-Leiste, Laufbereich, PWA-Installation
├─ web.css             Mobiles Layout und Browser-Anpassungen
└─ sw.js               Service Worker für den Offline-Betrieb

build/
├─ make-icons.js       erzeugt alle PNG-Symbole
├─ build-web.js        setzt dist-web/ aus src/ und web/ zusammen
└─ serve-web.js        kleiner Server zum Ausprobieren
```

**Eine Quelle, zwei Ziele:** `pet.js` und `dashboard.js` laufen unverändert in beiden
Varianten. Möglich wird das durch `web/core.js`, das exakt dieselbe Schnittstelle
bereitstellt wie der Electron-Preload (`window.pets`). `build-web.js` schneidet das
Markup aus den bestehenden HTML-Dateien und setzt es in die Web-Hülle ein – es gibt
also keine doppelt gepflegten Kopien.

**Pixel-Grafik ohne Bilddateien:** `src/shared/pixel.js` ist eine kleine Zeichenmaschine –
Ellipsen, Dreiecke, Linien, Spiegelung, automatische Kontur und Schattierung auf einem
Zeichen-Raster. Charaktere entstehen darauf mit 32 × 32, Symbole mit 16 × 16. Ausgegeben wird
SVG aus Pixel-Rechtecken (`shape-rendering: crispEdges`), dadurch bleibt alles in jeder Größe
gestochen scharf und jede Farbpalette lässt sich auf jeden Charakter anwenden. Animiert wird
wie in klassischer Pixel-Kunst: echte Frame-Wechsel statt weicher Transformationen. Obere
Konturkanten werden aufgehellt (*selective outlining*), damit die Silhouetten rund wirken.

**Datenschutz:** Die App sendet nichts ins Netz. Der Spielstand liegt lokal unter `%APPDATA%/Claude Pets/pet-state.json` (Windows), `~/Library/Application Support/Claude Pets/` (macOS) bzw. `~/.config/Claude Pets/` (Linux).

---

## Bekannte Plattform-Hinweise

* **Linux:** Transparente, immer-oben liegende Fenster hängen vom Compositor ab. Unter GNOME/KDE mit aktiver Kompositierung funktioniert das Overlay; auf sehr minimalen Window-Managern kann der transparente Hintergrund schwarz erscheinen.
* **macOS:** Beim ersten Start ggf. unter *Systemeinstellungen → Datenschutz* die Bildschirmnutzung bestätigen. Das Dock-Symbol wird bewusst ausgeblendet – die App lebt im Menüleisten-Symbol.
* **Windows:** Das Overlay legt sich über normale Fenster, aber nicht über exklusive Vollbild-Spiele.

---

## Lizenz

MIT
