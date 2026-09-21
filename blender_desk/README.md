# Holzschreibtisch mit zwei Schubladen und Messinggriffen

Ein Nussbaum-Schreibtisch, **1400 x 700 x 750 mm**, komplett per Code gebaut.
`build_model.py` baut die Szene bei jedem Lauf von Grund auf neu, rendert vier
Ansichten, exportiert `model.glb` und schreibt eine `viewer.html`, die das Modell
eingebettet enthaelt und offline laeuft.

```bash
blender --background --python build_model.py    # mit Blender-Installation
python3 build_model.py                          # mit "pip install bpy"
```

Beides funktioniert: das Skript prueft selbst, ob ein GL-Kontext vorhanden ist,
und waehlt sonst Cycles auf der CPU.

## Ergebnis des letzten Laufs

Gebaut und geprueft mit Blender 4.5.14 LTS.

| Pruefung | Ergebnis |
|---|---|
| Gesamtmass | 1,400 x 0,700 x 0,750 m |
| Ursprung | unten mittig, Unterkante auf z = 0 |
| Dreiecke | **1.832** von 10.000 |
| Non-Manifold-Kanten | 0 |
| Lose Vertices | 0 |
| Doppelte Vertices | 0 |
| Objekte mit umgestuelpten Normalen | 0 |
| GLB-Reimport in leere Szene | 22 Objekte, 1.832 Dreiecke, 1,400 x 0,700 x 0,750 m, drei Materialien |
| Maskontrolle ohne Blender | 124 Pruefungen, alle bestanden |

Dateigroessen: `model.blend` 629 kB, `model.glb` 93 kB, `viewer.html` 147 kB.

## Dateien

| Datei | Inhalt |
|---|---|
| `build_model.py` | Das Bauskript. Alle Masse als Variablen ganz oben. |
| `model.blend` | Die fertige Blender-Szene samt Licht und Kameras. |
| `model.glb` | Export fuer Web und Engines, Modifier angewendet. |
| `viewer.html` | Eine einzige Offline-Datei: Modell eingebettet, per Doppelklick zu oeffnen. |
| `report.json` | Messwerte der Selbstkontrolle. |
| `renders/1_vorne.png` u.a. | Die vier Studioansichten. |
| `artifact/schreibtisch.html` | Website-Fassung mit Stueckliste, fuer Tablet und Handy. |
| `viewer_template.html` | Geruest fuer beide Viewer; das Modell wird als base64 eingesetzt. |
| `tools/layout_check.py` | Masskontrolle ohne Blender, erzeugt zusaetzlich eine Proxy-Vorschau. |
| `tools/make_artifact.py` | Baut die Website-Fassung; Stueckliste kommt aus `build_model.py`. |
| `tools/test_light.py` | Schnelle Belichtungsprobe in kleiner Aufloesung. |
| `tools/glbwrite.py`, `tools/shoot.py`, `tools/pngcrop.py` | GLB-Schreiber und Screenshot-Werkzeuge in reinem Python. |

## Aufbau

| Bauteil | Mass in mm | Konstruktion |
|---|---|---|
| `Platte` | 1400 x 700 x 32 | Quader, Kante mit 4,5 mm Fase in 3 Segmenten |
| `Bein_vorne_links` u.a. | 68 oben, 42 am Boden, 718 hoch | bmesh-Ringe, Verjuengung ab 150 mm, 3,5 mm Fase |
| `Zarge_hinten` | 1184 x 20 x 120 | extrudiertes Sechseck-Profil mit Anlaufschraege |
| `Zarge_links`, `Zarge_rechts` | 20 x 504 x 120 | dasselbe Profil quer |
| `Frontleiste` | 1184 x 20 x 14 | flacheres Profil |
| `Mittelsteg` | 40 x 20 x 106 | Quader mit Fase |
| `Schubfront_links/rechts` | 557 x 20 x 101 | Fase, umlaufende Nut per Boolean, steht 1,5 mm vor |
| `Griff_links/rechts` | Buegel 160 breit, Stange 12 dick, 28 Abstand | berechneter Pfad als POLY-Kurve mit Bevel-Tiefe |
| `Kasten_*` | 500 tief, 12 mm Wand | vier Quader je Schubkasten |

Fugen rund um die Fronten: 2,5 mm. Kniefreiheit: 598 mm hoch, 1164 mm breit.

## Materialien

Drei Principled BSDFs mit festen Werten, keine prozeduralen Nodes - die gehen beim
GLB-Export verloren. Farben stehen als sRGB-Hex im Skript und werden linear
konvertiert.

| Material | Farbe | Rauheit | Metallic |
|---|---|---|---|
| `Holz_Nussbaum` | `#5C3E28` | 0,55 | 0 |
| `Holz_Innen` | `#B79A72` | 0,62 | 0 |
| `Messing` | `#C8A03C` | 0,24 | 1 |

## Was die Selbstkontrolle gefunden hat

Der erste Lauf mit echtem Blender hat drei Fehler aufgedeckt, die die reine
Maskontrolle nicht sehen konnte:

1. **Griffe 10,6 mm zu weit vorn.** Die Bezier-Anfasser im Modus AUTO schossen
   ueber die Eckpunkte hinaus, der Buegel ragte ueber die Plattenkante. Jetzt wird
   der Pfad mit den Eckbogen selbst berechnet und als POLY-Spline gesetzt.
2. **Offene Griffenden.** 40 Non-Manifold-Kanten je Griff, weil die Rohrenden
   nicht geschlossen waren. `clean_mesh()` verschweisst jetzt doppelte Vertices
   und fuellt offene Raender.
3. **Kaputte Nut.** Vier einzelne Cutter-Balken ueberlappten sich in den Ecken,
   der exakte Boolean-Loeser lieferte daraus 22 Non-Manifold-Kanten je Front.
   Der Cutter ist jetzt ein einziger geschlossener Rahmenkoerper.

Dazu am Licht: der erste Render war um etwa das Fuenffache ueberstrahlt, das
Nussbaum klippte zu blassem Pfirsich. Lichtleistung gesenkt, Kameras rahmen jetzt
pro Ansicht ein statt mit fester Skala, und die Welt trennt nach Strahltyp - die
Kamera sieht ein helles Neutral, die Beleuchtung bleibt gedaempft.

## Annahmen

1. **Zweck Website und Spiel**, deshalb GLB mit Dreiecksbudget statt STL. Fuer
   3D-Druck waere der Aufbau ein anderer: ein wasserdichter Koerper, Masse in
   Millimetern, Pruefung auf Ueberhaenge.
2. **Masse** 140 x 70 x 75 cm nach Vorgabe. 75 cm ist die uebliche feste
   Schreibtischhoehe; 60 cm Kniefreiheit gelten als Minimum, hier sind es 59,8 cm.
3. **Zwei Schubladen nebeneinander** in der Frontzarge, nicht uebereinander an
   einer Seite - so bleibt die Kniefreiheit durchgehend.
4. **Buegelgriff aus Rundmessing.** "Messinggriffe" liesse auch Muschel- oder
   Knopfgriffe zu.
5. **Schubkaesten sind geschlossen** modelliert, ohne Auszug und Laufschienen.
6. **Holz ist eine glatte Grundfarbe.** Eine Maserung braeuchte eine gebackene
   Textur.

## Bewusst vereinfacht

- Keine Verbindungsdetails wie Zapfen, Duebel oder Schrauben - im fertigen Moebel
  unsichtbar und nur Dreiecke.
- Keine Laufschienen, keine Rueckwandnut, keine Fussgleiter.
- Die Zargen stossen 10 mm in die Beine hinein statt echter Schlitz-und-Zapfen-
  Geometrie. Von aussen sieht man denselben Uebergang.
- Kanten sind gefast statt mehrfach verrundet, wo es die Silhouette nicht aendert.
