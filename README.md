<div align="center">

<img src="src/assets/icon-128.png" width="84" alt="Claude Pets" />

# Claude Pets

**Ein animierter Pixel-Begleiter für deinen Desktop – mit Level-System, freischaltbaren Belohnungen und lesbaren Gedankenblasen.**

Helles Orange auf warmem Grau. Läuft auf Windows, macOS und Linux.

</div>

---

## Was die App macht

Dein Pet sitzt als **transparentes Overlay** unten rechts auf dem Bildschirm – über allen Fenstern, aber klick-durchlässig: Du arbeitest ganz normal weiter, bis du den Mauszeiger wirklich auf das Tier bewegst.

* 🐾 **Sechs Pixel-Charaktere** – Fuchs, Katze, Blob, Roboter, Pinguin, Drache. Jeder mit eigenem Laufzyklus, Blinzeln, Schlaf- und Freude-Animation.
* 💭 **Gedankenblasen** mit Schreibmaschinen-Effekt – über 80 Sprüche in sechs Paketen, dazu tages- und situationsabhängige Gedanken.
* ⭐ **Level 1–50** mit sichtbarem XP-Balken. XP gibt es fürs Streicheln, Spazieren, Füttern, Spielen, Gedankenlesen und einfach fürs Dabeisein.
* 🎁 **34 Belohnungen**, gestaffelt über die Level: neue Pets, Accessoires, Farbpaletten, Gedanken-Pakete, Partikel-Effekte und Fähigkeiten.
* 📊 **Dashboard** im Claude-Look: Übersicht, Belohnungs-Roadmap, Ausstattung, Statistik, Einstellungen.
* 🔥 **Tages-Streak** – wer täglich vorbeischaut, bekommt einen wachsenden Bonus.

---

## Steuerung

| Aktion | Was passiert |
| --- | --- |
| **Linksklick** auf das Pet | Streicheln (+XP) – danach rennt es zu einem zufälligen Punkt auf dem Bildschirm |
| **Ziehen** mit gedrückter linker Maustaste | Pet an eine andere Stelle setzen (es lässt sich anschließend zu Boden gleiten) |
| **Rechtsklick** auf das Pet | Schnellmenü: Spazieren · Gedanke · Schlafen · Dashboard · **Pet entfernen** |
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
│  ├─ progression.js   Level-Kurve, XP-Quellen, Belohnungs-Katalog
│  └─ thoughts.js      Gedanken-Pakete
├─ renderer/
│  ├─ pet/             Overlay: Pixel-Charaktere, Frame-Treiber, Verhalten
│  └─ dashboard/       Dashboard-Oberfläche
└─ assets/             App- und Tray-Icons
```

**Pixel-Grafik ohne Bilddateien:** Jeder Charakter wird zur Laufzeit auf einem 32 × 32-Raster aus geometrischen Grundformen gezeichnet, automatisch umrandet und schattiert und dann als SVG aus Pixel-Rechtecken ausgegeben (`shape-rendering: crispEdges`). Dadurch lässt sich jede Farbpalette auf jeden Charakter anwenden, und die Sprites bleiben in jeder Größe gestochen scharf. Animiert wird wie in klassischer Pixel-Kunst: echte Frame-Wechsel statt weicher Transformationen.

**Datenschutz:** Die App sendet nichts ins Netz. Der Spielstand liegt lokal unter `%APPDATA%/Claude Pets/pet-state.json` (Windows), `~/Library/Application Support/Claude Pets/` (macOS) bzw. `~/.config/Claude Pets/` (Linux).

---

## Bekannte Plattform-Hinweise

* **Linux:** Transparente, immer-oben liegende Fenster hängen vom Compositor ab. Unter GNOME/KDE mit aktiver Kompositierung funktioniert das Overlay; auf sehr minimalen Window-Managern kann der transparente Hintergrund schwarz erscheinen.
* **macOS:** Beim ersten Start ggf. unter *Systemeinstellungen → Datenschutz* die Bildschirmnutzung bestätigen. Das Dock-Symbol wird bewusst ausgeblendet – die App lebt im Menüleisten-Symbol.
* **Windows:** Das Overlay legt sich über normale Fenster, aber nicht über exklusive Vollbild-Spiele.

---

## Lizenz

MIT
