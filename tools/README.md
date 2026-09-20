# Werkzeuge zu swingby.html

Alle Skripte laden den Simulationskern direkt aus `swingby.html` (Block
zwischen `/*<<CORE>>*/` und `/*<</CORE>>*/`), damit Spiel, Löser und Test
garantiert denselben Code rechnen.

| Datei | Zweck |
|---|---|
| `core.js` | lädt den Kern nach Node |
| `solve.js` | sucht je Level eine 3-Sterne-Referenzlösung mit passendem Bahncharakter und legt die Messpunkte auf die Bahn |
| `tsolve.js` | dasselbe für die Treibstoff-Level (Abschuss + ein Burn) |
| `pocket.js` | prüft, welche Zielpositionen ballistisch überhaupt erreichbar sind |
| `merge.js` | schreibt die gefundenen Lösungen in den `SOLS`-Block von `swingby.html` |
| `test.js` | Selbsttest im Browser (Chromium, headless) |

## Selbsttest

```
npm install playwright-core
node tools/test.js            # Bilder landen in $SHOT (Vorgabe /tmp/shots)
```

## Lösung für ein Level neu suchen

```
node tools/solve.js  3 /tmp/k3.json     # ballistisch
node tools/tsolve.js 4 /tmp/k4.json     # mit Schub
node tools/merge.js  /tmp               # schreibt SOLS zurück
```
