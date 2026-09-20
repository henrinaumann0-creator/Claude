"""Masskontrolle ohne Blender.

Liest den reinen Python-Teil von build_model.py (alles vor PURE_SECTION_END),
prueft die Konstruktion rechnerisch und schreibt eine Proxy-Vorschau
(preview.glb + preview.html), mit der sich die Proportionen ansehen lassen.

    python3 tools/layout_check.py
"""

import base64
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glbwrite

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPS = 1e-9


def load_pure_section():
    with open(os.path.join(HERE, "build_model.py"), "r", encoding="utf-8") as fh:
        src = fh.read()
    src = src[:src.index("# === PURE_SECTION_END ===")]
    ns = {"__name__": "layout"}
    exec(compile(src, "build_model.py", "exec"), ns)
    return ns


# ---------------------------------------------------------------------------
#  Bauteile auf Quader-Huellen abbilden
# ---------------------------------------------------------------------------


def part_bbox(part):
    cx, cy, cz = part["center"] if "center" in part else (0, 0, 0)
    if part["kind"] in ("box", "taper"):
        sx, sy, sz = part["size"]
        return (cx - sx / 2, cy - sy / 2, cz - sz / 2,
                cx + sx / 2, cy + sy / 2, cz + sz / 2)
    if part["kind"] == "profile":
        us = [u for u, _ in part["section"]]
        vs = [v for _, v in part["section"]]
        half = part["length"] / 2.0
        if part["axis"] == "x":
            return (cx - half, cy + min(us), cz + min(vs),
                    cx + half, cy + max(us), cz + max(vs))
        return (cx + min(us), cy - half, cz + min(vs),
                cx + max(us), cy + half, cz + max(vs))
    if part["kind"] == "curve":
        r = part["radius"]
        xs = [p[0] for p in part["points"]]
        ys = [p[1] for p in part["points"]]
        zs = [p[2] for p in part["points"]]
        return (min(xs) - r, min(ys) - r, min(zs) - r,
                max(xs) + r, max(ys) + r, max(zs) + r)
    raise ValueError(part["kind"])


def overlap(a, b):
    """Ueberlappungsmasse je Achse (negativ = Abstand)."""
    return [min(a[i + 3], b[i + 3]) - max(a[i], b[i]) for i in range(3)]


def volume_overlap(a, b):
    ov = overlap(a, b)
    return ov[0] * ov[1] * ov[2] if all(v > EPS for v in ov) else 0.0


# ---------------------------------------------------------------------------
#  Pruefungen
# ---------------------------------------------------------------------------


def run_checks(ns):
    parts, dims = ns["PARTS"], ns["DIMS"]
    boxes = {p["name"]: part_bbox(p) for p in parts}
    fails, notes = [], []

    def check(ok, message):
        (notes if ok else fails).append(("OK  " if ok else "FEHLER ") + message)

    # 1 - Gesamtmasse und Ursprung
    lo = [min(b[i] for b in boxes.values()) for i in range(3)]
    hi = [max(b[i + 3] for b in boxes.values()) for i in range(3)]
    size = [hi[i] - lo[i] for i in range(3)]
    for axis, got, want in (("Breite", size[0], ns["DESK_WIDTH"]),
                            ("Tiefe", size[1], ns["DESK_DEPTH"]),
                            ("Hoehe", size[2], ns["DESK_HEIGHT"])):
        check(abs(got - want) < 1e-6, "%s %.1f mm" % (axis, got * 1000))
    check(abs(lo[2]) < 1e-9, "Unterkante auf z = %.4f" % lo[2])
    check(abs(lo[0] + hi[0]) < 1e-9, "in X mittig (%.5f)" % ((lo[0] + hi[0]) / 2))

    # 2 - nichts unter dem Boden, nichts ueber der Platte
    for name, b in boxes.items():
        if b[2] < -EPS:
            fails.append("FEHLER %s ragt unter den Boden (z=%.4f)" % (name, b[2]))
        if b[5] > ns["DESK_HEIGHT"] + EPS:
            fails.append("FEHLER %s ragt ueber die Platte" % name)

    # 3 - Fugen der Schubfronten: exakt DRAWER_REVEAL rundherum
    reveal = ns["DRAWER_REVEAL"]
    for name in [n for n in boxes if n.startswith("Schubfront_")]:
        b = boxes[name]
        gaps = dict(unten=b[2] - dims["opening_z0"],
                    oben=dims["opening_z0"] + dims["opening_h"] - b[5])
        for side, gap in gaps.items():
            check(abs(gap - reveal) < 1e-9,
                  "%s Fuge %s = %.1f mm" % (name, side, gap * 1000))
    fronts = sorted([n for n in boxes if n.startswith("Schubfront_")],
                    key=lambda n: boxes[n][0])
    if len(fronts) == 2:
        mid_gap_l = boxes["Mittelsteg"][0] - boxes[fronts[0]][3]
        mid_gap_r = boxes[fronts[1]][0] - boxes["Mittelsteg"][3]
        check(abs(mid_gap_l - reveal) < 1e-9 and abs(mid_gap_r - reveal) < 1e-9,
              "Fugen am Mittelsteg %.1f / %.1f mm"
              % (mid_gap_l * 1000, mid_gap_r * 1000))
        outer_l = boxes[fronts[0]][0] - (-dims["inner_span"] / 2)
        outer_r = dims["inner_span"] / 2 - boxes[fronts[1]][3]
        check(abs(outer_l - reveal) < 1e-9 and abs(outer_r - reveal) < 1e-9,
              "Fugen zu den Beinen %.1f / %.1f mm"
              % (outer_l * 1000, outer_r * 1000))

    # 4 - Schubfronten duerfen Rahmenteile nicht durchdringen
    frame = ["Mittelsteg", "Frontleiste", "Zarge_links", "Zarge_rechts"] + \
            [n for n in boxes if n.startswith("Bein_")]
    for front in fronts:
        for other in frame:
            v = volume_overlap(boxes[front], boxes[other])
            check(v == 0.0, "%s kollidiert nicht mit %s" % (front, other))

    # 5 - Schubkasten: sitzt an der Front, passt durch die Oeffnung,
    #     stoesst nicht an die hintere Zarge und laeuft frei an der Frontleiste
    front_back = {n: boxes[n][4] for n in boxes if n.startswith("Schubfront_")}
    rear_limit = (dims["frame_y"] + dims["frame_d"] / 2
                  - ns["APRON_SETBACK"] - ns["APRON_THICKNESS"])
    for name in [n for n in boxes if n.startswith("Kasten_")]:
        b = boxes[name]
        side = name.split("_")[1]
        front = boxes["Schubfront_" + side]
        check(b[1] >= front_back["Schubfront_" + side] - 1e-9,
              "%s steht nicht vor der Front" % name)
        check(b[4] <= rear_limit + 1e-9, "%s stoesst nicht an die hintere Zarge" % name)
        check(b[0] >= front[0] and b[3] <= front[3],
              "%s laeuft durch die Oeffnung" % name)
        check(b[2] >= dims["opening_z0"] - 1e-9,
              "%s liegt ueber der Frontleiste" % name)
        for blocker in ["Mittelsteg", "Frontleiste"] + \
                [n for n in boxes if n.startswith("Bein_")]:
            check(volume_overlap(b, boxes[blocker]) == 0.0,
                  "%s kollidiert nicht mit %s" % (name, blocker))

    # 6 - Zargen und Beine muessen sich beruehren (keine sichtbaren Luecken)
    for apron, legs in (("Zarge_hinten", ("Bein_hinten_links", "Bein_hinten_rechts")),
                        ("Zarge_links", ("Bein_vorne_links", "Bein_hinten_links")),
                        ("Zarge_rechts", ("Bein_vorne_rechts", "Bein_hinten_rechts")),
                        ("Frontleiste", ("Bein_vorne_links", "Bein_vorne_rechts"))):
        for leg in legs:
            ov = overlap(boxes[apron], boxes[leg])
            check(min(ov) > 0.0, "%s greift in %s (Ueberdeckung %.1f mm)"
                  % (apron, leg, min(ov) * 1000))

    # 7 - Z-Fighting: gleich liegende, sich ueberlappende Flaechen
    names = sorted(boxes)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            ov = overlap(boxes[a], boxes[b])
            for axis in range(3):
                others = [ov[k] for k in range(3) if k != axis]
                if min(others) > 1e-5 and -1e-5 < ov[axis] < 1e-5:
                    coplanar = any(abs(boxes[a][axis + p] - boxes[b][axis + q]) < 1e-9
                                   for p, q in ((0, 3), (3, 0)))
                    if coplanar:
                        continue                 # buendiges Anstossen ist gewollt
                    fails.append("FEHLER Z-Fighting-Risiko %s / %s" % (a, b))

    # 8 - Ergonomie
    check(dims["knee_height"] >= 0.58,
          "Kniefreiheit Hoehe %.0f mm (>= 580)" % (dims["knee_height"] * 1000))
    check(dims["knee_width"] >= 0.60,
          "Kniefreiheit Breite %.0f mm (>= 600)" % (dims["knee_width"] * 1000))
    check(ns["DESK_HEIGHT"] - ns["TOP_THICKNESS"] - ns["APRON_HEIGHT"] >= 0.58,
          "Oberschenkelfreiheit %.0f mm"
          % ((ns["DESK_HEIGHT"] - ns["TOP_THICKNESS"] - ns["APRON_HEIGHT"]) * 1000))

    # 9 - Griffe sitzen auf der Front und stehen nicht ueber
    for name in [n for n in boxes if n.startswith("Griff_")]:
        side = name.split("_", 1)[1]
        front = boxes["Schubfront_" + side]
        g = boxes[name]
        check(g[0] > front[0] and g[3] < front[3],
              "%s liegt innerhalb der Front" % name)
        check(g[2] > front[2] and g[5] < front[5],
              "%s bleibt in der Fronthoehe" % name)
        check(g[1] > -ns["DESK_DEPTH"] / 2,
              "%s steht nicht ueber die Plattenkante (%.1f mm Luft)"
              % (name, (g[1] + ns["DESK_DEPTH"] / 2) * 1000))

    return boxes, dims, fails, notes, size


# ---------------------------------------------------------------------------
#  Proxy-Vorschau
# ---------------------------------------------------------------------------


def write_preview(ns, boxes):
    glb = glbwrite.GLB()
    mats = {}
    for spec in (ns["MAT_WOOD"], ns["MAT_WOOD_INNER"], ns["MAT_BRASS"]):
        rgba = ns["srgb_to_linear"](spec[1])
        mats[spec[0]] = glb.material(spec[0], rgba, spec[2], spec[3])
    for part in ns["PARTS"]:
        b = boxes[part["name"]]
        centre = [(b[i] + b[i + 3]) / 2 for i in range(3)]
        size = [b[i + 3] - b[i] for i in range(3)]
        glb.add_box(part["name"], centre, size, mats[part["material"][0]])
    path = os.path.join(HERE, "renders", "preview.glb")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    glb.save(path)
    return path


def write_preview_html(glb_path, meta):
    import json
    with open(os.path.join(HERE, "viewer_template.html"), "r", encoding="utf-8") as fh:
        html = fh.read()
    with open(glb_path, "rb") as fh:
        payload = base64.b64encode(fh.read()).decode("ascii")
    out = os.path.join(HERE, "renders", "preview.html")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(html.replace("__MODEL_B64__", payload)
                     .replace("__MODEL_META__", json.dumps(meta, ensure_ascii=False)))
    return out


def estimate_triangles(ns):
    """Abschaetzung der Dreieckszahl des echten Blender-Modells."""
    def beveled_box(segs):
        return 12 + 12 * segs * 2 + 8 * max(segs * segs, 1) * 2

    total, rows = 0, []
    for part in ns["PARTS"]:
        k = part["kind"]
        if k == "box":
            n = beveled_box(part.get("segs", 2)) if part.get("bevel") else 12
            if part.get("groove"):
                n += 4 * 12 + 40          # Boolean-Nut: vier Balken plus Schnittkanten
        elif k == "taper":
            n = 8 * 2 + 4 + beveled_box(part.get("segs", 2)) - 12
        elif k == "profile":
            n = len(part["section"]) * 2 + (len(part["section"]) - 2) * 2
        elif k == "curve":
            ring = 4 * (part.get("res_ring", 3) + 1)
            spans = (len(part["points"]) - 1) * part.get("res_u", 8)
            n = spans * ring * 2 + ring * 2
        total += n
        rows.append((part["name"], n))
    return total, rows


def main():
    ns = load_pure_section()
    boxes, dims, fails, notes, size = run_checks(ns)
    for line in notes:
        print(line)
    print("-" * 64)
    for line in fails:
        print(line)
    print("Bauteile: %d | Masse: %s mm"
          % (len(boxes), " x ".join("%.0f" % (v * 1000) for v in size)))
    tris, rows = estimate_triangles(ns)
    print("Dreiecke (Schaetzung fuer das Blender-Modell): %d von %d"
          % (tris, ns["TRI_BUDGET"]))
    for name, n in sorted(rows, key=lambda r: -r[1])[:4]:
        print("   groesste Teile: %-22s %5d" % (name, n))
    glb = write_preview(ns, boxes)
    if os.path.exists(os.path.join(HERE, "viewer_template.html")):
        html = write_preview_html(glb, dict(
            name="Proxy-Vorschau (Quaderhuellen, ohne Fasen/Kurven)",
            size_m=[round(v, 4) for v in size], triangles=len(boxes) * 12,
            parts=len(boxes)))
        print("Vorschau: %s" % html)
    print("ERGEBNIS: %s" % ("alles in Ordnung" if not fails
                            else "%d Problem(e)" % len(fails)))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
