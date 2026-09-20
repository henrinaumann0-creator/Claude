# Holzschreibtisch mit zwei Schubladen und Messinggriffen

Komplett per Code gebaut. Das Skript `build_model.py` baut die Szene bei jedem Lauf
von Grund auf neu, rendert vier Ansichten, exportiert `model.glb` und schreibt eine
Offline-`viewer.html` mit eingebettetem Modell.

```bash
blender --background --python build_model.py
```

## Wichtig: Blender lief hier nicht

In dieser Umgebung ist Blender nicht installiert und du wolltest nicht, dass ich
etwas installiere. Deshalb ist getrennt, was **geprueft** und was **ungeprueft** ist:

| geprueft | wie |
|---|---|
| Alle Masse, Fugen, Kollisionen, Kniefreiheit | `tools/layout_check.py`, 124 Einzelpruefungen |
| Silhouette und Proportionen in 4 Ansichten | Proxy-Vorschau, zwei Korrekturrunden |
| Der Offline-Viewer (glTF-Parser, WebGL, Bedienung) | im echten Chromium gerendert |
| Dreieckszahl | rechnerisch abgeschaetzt: **~3.080** von 10.000 |
| Python-Syntax des Bauskripts | `python3 -m py_compile` |

| ungeprueft, bis Blender laeuft | warum |
|---|---|
| Fasen, Beinverjuengung, Boolean-Nut, Griffkurven | brauchen bmesh/Modifier |
| Die vier Studio-Renders | brauchen die Render-Engine |
| `model.glb`, `model.blend`, die finale `viewer.html` | entstehen erst beim Lauf |
| Exakte Dreieckszahl nach den Fasen | Schaetzung, keine Messung |

Die Proxy-Vorschau (`vorschau_proxy.html`, per Doppelklick zu oeffnen) zeigt jedes
Bauteil als Quaderhuelle - richtige Lage und richtiges Mass, aber ohne Fasen,
Verjuengung und Rundungen.

## Dateien

| Datei | Inhalt |
|---|---|
| `build_model.py` | Das Bauskript. Alle Masse als Variablen ganz oben. |
| `viewer_template.html` | Viewer-Geruest; `build_model.py` setzt das Modell als base64 ein. |
| `vorschau_proxy.html` | Offline-Vorschau der Quaderhuellen, laeuft per Doppelklick. |
| `tools/layout_check.py` | Masskontrolle ohne Blender + Proxy-Export. |
| `tools/glbwrite.py` | Minimaler GLB-Schreiber in reinem Python. |
| `tools/shoot.py`, `tools/pngcrop.py` | Vier Ansichten per headless Chromium aufnehmen. |
| `renders/*_proxy.png` | vorne, seitlich, oben, schraeg - aus der Proxy-Vorschau. |
| `model.blend`, `model.glb`, `viewer.html`, `report.json` | entstehen beim Blender-Lauf. |

## Masse

Gesamt **1400 x 700 x 750 mm**, 1 Einheit = 1 Meter, Ursprung unten mittig.

| Bauteil | Mass | Konstruktion |
|---|---|---|
| `Platte` | 1400 x 700 x 32 mm | Quader, Kante mit 4,5 mm Fase (3 Segmente) |
| `Bein_vorne_links` u.a. | 68 mm oben, 42 mm am Boden, 718 mm hoch | bmesh-Ringe, Verjuengung ab 150 mm, 3,5 mm Fase |
| `Zarge_hinten`, `Zarge_links/rechts` | 120 x 20 mm | extrudiertes Sechseck-Profil mit Anlaufschraege |
| `Frontleiste` | 14 x 20 mm | gleiches Profil, flacher |
| `Mittelsteg` | 40 mm breit | Quader mit Fase |
| `Schubfront_links/rechts` | 555 x 101 x 20 mm | Fase + umlaufende Nut per Boolean, steht 1,5 mm vor |
| `Griff_links/rechts` | Buegel 160 mm, Stange 12 mm, 28 mm Abstand | Bezier-Kurve mit Bevel-Tiefe, zu Mesh konvertiert |
| `Kasten_*` (je 4 Teile) | 500 mm tief, 12 mm Wand | Quader |

Fugen rund um die Schubfronten: **2,5 mm**. Kniefreiheit: **598 mm** hoch,
**1160 mm** breit. Beinabstand innen 1160 mm.

## Materialien

Drei Principled BSDFs mit festen Werten, keine prozeduralen Nodes (die gingen beim
Export verloren). Farben sind als sRGB-Hex notiert und werden linear konvertiert.

| Material | Farbe | Rauheit | Metallic |
|---|---|---|---|
| `Holz_Nussbaum` | `#6B4526` | 0,42 | 0 |
| `Holz_Innen` | `#B79A72` | 0,62 | 0 |
| `Messing` | `#C8A03C` | 0,24 | 1 |

## Annahmen

1. **Zweck Website/Spiel**, deshalb GLB mit Dreiecksbudget statt STL. Fuer 3D-Druck
   waere der Aufbau ein anderer (ein wasserdichter Koerper, Masse in Millimetern).
2. **Masse** 140 x 70 x 75 cm nach deiner Vorlage; 75 cm ist die uebliche feste
   Schreibtischhoehe, 60 cm Kniefreiheit gelten als Minimum - hier sind es 59,8 cm.
3. **Zwei Schubladen nebeneinander** in der Frontzarge, nicht uebereinander an einer
   Seite. Das passt zum klassischen Schreibtisch mit durchgehender Kniefreiheit.
4. **Griffform**: schlichter Buegelgriff aus Rundmessing. "Messinggriffe" laesst auch
   Muschel- oder Knopfgriffe zu; der Buegel passt zur ruhigen Silhouette.
5. **Schubkaesten sind geschlossen** modelliert (kein Auszug, keine Laufschienen) -
   sichtbar nur, wenn man die Front entfernt.
6. **Holzmaserung** ist eine glatte Grundfarbe. Eine Maserung braeuchte eine gebackene
   Textur; prozedurale Nodes ueberleben den GLB-Export nicht.

## Bewusst vereinfacht

- Keine Verbindungsdetails (Zapfen, Duebel, Schrauben) - sie sind im fertigen Moebel
  unsichtbar und kosten nur Dreiecke.
- Keine Laufschienen, keine Rueckwandnut, keine Fussgleiter.
- Die Zargen stossen stumpf in die Beine hinein (10 mm Ueberdeckung), statt echter
  Schlitz-und-Zapfen-Geometrie. Nach aussen sieht man denselben Uebergang.
- Kanten sind gefast statt verrundet mit mehreren Segmenten, wo es die Silhouette
  nicht aendert.
