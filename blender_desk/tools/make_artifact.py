"""Baut die Website-Fassung: eine einzige HTML-Datei mit eingebettetem Modell.

Nimmt die im Viewer erprobte Renderer-Logik unveraendert und setzt sie in eine
Seitenhuelle mit Stueckliste. Stueckliste und Materialtabelle kommen direkt aus
build_model.py, koennen also nicht auseinanderlaufen.

    python3 tools/make_artifact.py [model.glb] [artifact/schreibtisch.html]
"""

import base64
import html
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import layout_check

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def viewer_script():
    """Den getesteten Renderer aus viewer_template.html herausloesen."""
    with open(os.path.join(HERE, "viewer_template.html"), "r", encoding="utf-8") as fh:
        src = fh.read()
    start = src.index('<script>\n"use strict";')
    return src[start + len("<script>\n"):src.index("</script>", start)]


def mm(value):
    return "%d" % round(value * 1000)


def part_rows(ns):
    """Stueckliste: gleiche Teile zusammenfassen, Masse in Millimetern."""
    groups, order = {}, []
    for part in ns["PARTS"]:
        base = part["name"].split("_")[0]
        if base in ("Kasten",):
            label, size = "Schubkasten, 4-teilig", None
        elif base == "Zarge":
            label = ("Zarge, hinten" if part["name"].endswith("hinten")
                     else "Zarge, seitlich")
            box = layout_check.part_bbox(part)
            size = tuple(round(box[i + 3] - box[i], 4) for i in range(3))
        else:
            label = {"Platte": "Tischplatte", "Bein": "Bein, konisch",
                     "Frontleiste": "Frontleiste", "Mittelsteg": "Mittelsteg",
                     "Schubfront": "Schubladenfront",
                     "Griff": "Griffbügel, Messing"}.get(base, base)
            box = layout_check.part_bbox(part)
            size = tuple(round(box[i + 3] - box[i], 4) for i in range(3))
        key = (label, size)
        if key not in groups:
            groups[key] = 0
            order.append(key)
        groups[key] += 1

    rows = []
    for label, size in order:
        count = groups[(label, size)]
        if label.startswith("Schubkasten"):
            count //= 4
        name = ("%d x %s" % (count, label)) if count > 1 else label
        if size is None:
            dims = "%s tief" % mm(0.500)
        else:
            dims = " x ".join(mm(v) for v in size)
        rows.append("<tr><td>%s</td><td class=\"num\">%s</td></tr>"
                    % (html.escape(name), dims))
    return "\n        ".join(rows)


def swatch_rows(ns):
    rows = []
    for spec in (ns["MAT_WOOD"], ns["MAT_WOOD_INNER"], ns["MAT_BRASS"]):
        name, hexcol, rough, metal = spec
        note = "metallisch" if metal else "Rauheit %.2f" % rough
        rows.append(
            '<li><span class="chip" style="background:%s"></span>'
            '<span>%s</span><span class="val">%s</span></li>'
            % (hexcol, html.escape(name.replace("_", " ")), note))
    return "\n        ".join(rows)


def build(glb_path, out_path):
    with open(os.path.join(HERE, "tools", "artifact_shell.html"),
              "r", encoding="utf-8") as fh:
        shell = fh.read()
    with open(glb_path, "rb") as fh:
        blob = fh.read()

    ns = layout_check.load_pure_section()
    tris = None
    report = os.path.join(HERE, "report.json")
    if os.path.exists(report):
        with open(report, "r", encoding="utf-8") as fh:
            tris = json.load(fh).get("triangles")

    meta = dict(name="Nussbaum-Schreibtisch",
                size_m=[ns["DESK_WIDTH"], ns["DESK_DEPTH"], ns["DESK_HEIGHT"]],
                triangles=tris, parts=len(ns["PARTS"]))
    tri_text = format(tris, ",").replace(",", ".") if tris else "-"
    footer = ("%d Bauteile, %s Dreiecke, %.0f kB Modell. Gebaut mit Blender 4.5 LTS "
              "aus build_model.py." % (len(ns["PARTS"]), tri_text,
                                       len(blob) / 1024.0))

    # Reihenfolge zaehlt: erst das Skript einsetzen, dann dessen Platzhalter
    knee = "%s × %s mm" % (mm(ns["DIMS"]["knee_height"]),
                           mm(ns["DIMS"]["knee_width"]))
    reveal = ("%.1f mm" % (ns["DRAWER_REVEAL"] * 1000)).replace(".", ",")
    page = (shell.replace("__KNEE__", knee)
                 .replace("__REVEAL__", reveal)
                 .replace("__PARTS_ROWS__", part_rows(ns))
                 .replace("__SWATCH_ROWS__", swatch_rows(ns))
                 .replace("__FOOTER__", html.escape(footer))
                 .replace("__VIEWER_JS__", viewer_script())
                 .replace("__MODEL_META__", json.dumps(meta, ensure_ascii=False))
                 .replace("__MODEL_B64__", base64.b64encode(blob).decode("ascii")))
    for leftover in ("__MODEL_META__", "__MODEL_B64__", "__VIEWER_JS__"):
        assert leftover not in page, "Platzhalter %s nicht ersetzt" % leftover
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(page)
    print("%s - %.0f kB" % (out_path, os.path.getsize(out_path) / 1024.0))
    return out_path


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "model.glb"),
          sys.argv[2] if len(sys.argv) > 2 else
          os.path.join(HERE, "artifact", "schreibtisch.html"))
