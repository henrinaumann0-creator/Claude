# Sunset Ocean

Ein Meer bei Sonnenuntergang mit three.js (Aufgabe `s1-sunset-ocean`, BridgeBench 3.0).
Zwei Regler: **Sea State** (Seegang, 0–1) und **Sun Elevation** (Sonnenhöhe, 1–12°).

## Starten

Die Seite lädt three.js über den absoluten Pfad `/vendor/...`. Deshalb muss dieser
Ordner das Wurzelverzeichnis des Servers sein:

```bash
cd sunset-ocean
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

`vendor/three@0.182.0/` enthält die unveränderten Dateien aus dem npm-Paket `three@0.182.0` (MIT-Lizenz).
