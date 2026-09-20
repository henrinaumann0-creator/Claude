"""
Holzschreibtisch mit zwei Schubladen und Messinggriffen - komplett per Code.

Ausfuehren:
    blender --background --python build_model.py

Ergebnis (neben diesem Skript):
    model.blend        Blender-Szene
    model.glb          Export fuer Web/Engine (Modifier angewendet)
    viewer.html        eine einzige Offline-Datei mit eingebettetem Modell
    renders/*.png      vier Ansichten: vorne, seitlich, oben, schraeg
    report.json        Selbstkontrolle (Masse, Dreiecke, Non-Manifold, ...)

Konvention: 1 Blender-Einheit = 1 Meter. Ursprung unten mittig.
X = Breite (rechts +), Y = Tiefe (hinten +, vorne -), Z = Hoehe.
"""

# ===========================================================================
#  MASSE - hier nachjustieren. Alles in Metern.
# ===========================================================================

# --- Gesamtmasse -----------------------------------------------------------
DESK_WIDTH        = 1.400   # Gesamtbreite ueber die Platte
DESK_DEPTH        = 0.700   # Gesamttiefe ueber die Platte
DESK_HEIGHT       = 0.750   # Oberkante Platte ueber Boden

# --- Tischplatte -----------------------------------------------------------
TOP_THICKNESS     = 0.032   # Plattenstaerke
TOP_EDGE_BEVEL    = 0.0045  # Fase/Rundung der Plattenkante
TOP_BEVEL_SEGS    = 3       # Segmente der Plattenkante (Silhouette)
TOP_OVERHANG_SIDE = 0.050   # Ueberstand links/rechts ueber das Gestell
TOP_OVERHANG_FRNT = 0.050   # Ueberstand vorne
TOP_OVERHANG_BACK = 0.030   # Ueberstand hinten

# --- Beine -----------------------------------------------------------------
LEG_TOP           = 0.068   # Beinquerschnitt oben (quadratisch)
LEG_BOTTOM        = 0.042   # Beinquerschnitt am Boden (konisch verjuengt)
LEG_TAPER_START   = 0.150   # ab dieser Hoehe ueber Boden beginnt die Verjuengung
LEG_CHAMFER       = 0.0035  # Kantenfase der Beine

# --- Zargen (Rahmen unter der Platte) --------------------------------------
APRON_HEIGHT      = 0.120   # Zargenhoehe
APRON_THICKNESS   = 0.020   # Zargenstaerke
APRON_SETBACK     = 0.008   # Zarge steht gegenueber Beinvorderkante zurueck
APRON_CHAMFER     = 0.006   # Anlaufschraege an der Zargenunterkante

# --- Schubladen ------------------------------------------------------------
DRAWER_COUNT      = 2
STILE_WIDTH       = 0.040   # Mittelsteg zwischen den Schubladen
BOTTOM_RAIL_H     = 0.014   # Frontleiste unter den Schubladen
DRAWER_REVEAL     = 0.0025  # Fugenmass rund um die Front
DRAWER_FRONT_TH   = 0.020   # Frontstaerke
FRONT_BEVEL       = 0.0030  # Kantenfase der Front
FRONT_PROUD       = 0.0015  # Front steht vor der Zarge (Schattenfuge)
FRONT_GROOVE_IN   = 0.022   # Abstand der umlaufenden Nut vom Frontrand
FRONT_GROOVE_W    = 0.006   # Nutbreite
FRONT_GROOVE_D    = 0.0030  # Nuttiefe (Boolean)

DRAWER_BOX_DEPTH  = 0.500   # Laenge des Schubkastens
DRAWER_BOX_TH     = 0.012   # Wandstaerke Schubkasten
DRAWER_BOT_TH     = 0.006   # Boden Schubkasten
DRAWER_SIDE_CLEAR = 0.010   # Luft je Seite zwischen Kasten und Oeffnung
DRAWER_BOX_DROP   = 0.004   # Kasten sitzt so weit unter der Frontoberkante

# --- Messinggriffe ---------------------------------------------------------
HANDLE_WIDTH      = 0.160   # Achsmass der Griffbuegel
HANDLE_STANDOFF   = 0.028   # Abstand Griffstange zur Front
HANDLE_RADIUS     = 0.0060  # Stangenradius
HANDLE_RES_U      = 8       # Aufloesung entlang der Kurve
HANDLE_RES_RING   = 3       # Bevel-Aufloesung (Ring = 4*(n+1) Segmente)

# --- Materialien (sRGB-Hex, wird linear konvertiert) -----------------------
MAT_WOOD          = ("Holz_Nussbaum", "#6B4526", 0.42, 0.0)   # Name, Farbe, Rauheit, Metallic
MAT_WOOD_INNER    = ("Holz_Innen",    "#B79A72", 0.62, 0.0)
MAT_BRASS         = ("Messing",       "#C8A03C", 0.24, 1.0)

# --- Rendering -------------------------------------------------------------
RENDER_RES        = 1100    # Kantenlaenge der Renderbilder (quadratisch)
RENDER_SAMPLES    = 64
BACKDROP_GREY     = 0.62    # neutraler Hintergrund
TRI_BUDGET        = 10000   # Obergrenze fuer den GLB-Export

# ===========================================================================
#  LAYOUT - reine Python-Rechnung, noch ohne Blender.
#  Alles unterhalb bis zum Marker laeuft auch ohne bpy (tools/layout_check.py).
# ===========================================================================


def srgb_to_linear(hex_color):
    """'#RRGGBB' -> lineares RGBA-Tupel fuer den Principled BSDF."""
    h = hex_color.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


def build_layout():
    """Liefert (parts, dims). parts = Liste von Bauteil-Beschreibungen."""
    parts = []

    def box(name, material, center, size, bevel=0.0, segs=2, **extra):
        p = dict(kind="box", name=name, material=material,
                 center=tuple(center), size=tuple(size),
                 bevel=bevel, segs=segs)
        p.update(extra)
        parts.append(p)
        return p

    # --- abgeleitete Hauptmasse -------------------------------------------
    frame_w = DESK_WIDTH - 2 * TOP_OVERHANG_SIDE            # Gestellbreite
    frame_d = DESK_DEPTH - TOP_OVERHANG_FRNT - TOP_OVERHANG_BACK
    frame_y = (TOP_OVERHANG_FRNT - TOP_OVERHANG_BACK) / 2.0 # Gestellmitte in Y
    top_z0 = DESK_HEIGHT - TOP_THICKNESS                    # Unterkante Platte
    leg_h = top_z0                                          # Beine bis unter die Platte
    apron_z0 = top_z0 - APRON_HEIGHT

    # --- Platte ------------------------------------------------------------
    box("Platte", MAT_WOOD,
        (0.0, 0.0, top_z0 + TOP_THICKNESS / 2.0),
        (DESK_WIDTH, DESK_DEPTH, TOP_THICKNESS),
        bevel=TOP_EDGE_BEVEL, segs=TOP_BEVEL_SEGS)

    # --- Beine (konisch) ---------------------------------------------------
    leg_x = frame_w / 2.0 - LEG_TOP / 2.0
    leg_y = frame_d / 2.0 - LEG_TOP / 2.0
    for sx, nx in ((-1, "links"), (1, "rechts")):
        for sy, ny in ((-1, "vorne"), (1, "hinten")):
            parts.append(dict(
                kind="taper", name="Bein_%s_%s" % (ny, nx), material=MAT_WOOD,
                center=(sx * leg_x, frame_y + sy * leg_y, leg_h / 2.0),
                size=(LEG_TOP, LEG_TOP, leg_h),
                bottom_size=(LEG_BOTTOM, LEG_BOTTOM),
                taper_start=LEG_TAPER_START, bevel=LEG_CHAMFER, segs=2))

    # --- Zargen: extrudiertes Profil mit Anlaufschraege --------------------
    # Querschnitt in (u = Dicke, v = Hoehe), Nullpunkt = Profilmitte.
    t, h, c = APRON_THICKNESS, APRON_HEIGHT, APRON_CHAMFER
    apron_section = [
        (-t / 2.0,  h / 2.0),
        ( t / 2.0,  h / 2.0),
        ( t / 2.0, -h / 2.0 + c * 1.6),
        ( t / 2.0 - c, -h / 2.0),
        (-t / 2.0 + c, -h / 2.0),
        (-t / 2.0, -h / 2.0 + c * 1.6),
    ]
    apron_cz = apron_z0 + h / 2.0
    inner_span = frame_w - 2 * LEG_TOP          # lichte Weite zwischen den Beinen
    side_span = frame_d - 2 * LEG_TOP
    apron_face_y = frame_d / 2.0 - APRON_SETBACK - APRON_THICKNESS / 2.0
    apron_face_x = frame_w / 2.0 - APRON_SETBACK - APRON_THICKNESS / 2.0

    parts.append(dict(kind="profile", name="Zarge_hinten", material=MAT_WOOD,
                      axis="x", length=inner_span + 2 * 0.010,
                      center=(0.0, frame_y + apron_face_y, apron_cz),
                      section=apron_section))
    for sx, nx in ((-1, "links"), (1, "rechts")):
        parts.append(dict(kind="profile", name="Zarge_%s" % nx, material=MAT_WOOD,
                          axis="y", length=side_span + 2 * 0.010,
                          center=(sx * apron_face_x, frame_y, apron_cz),
                          section=apron_section))

    # --- Front: Frontleiste + Mittelsteg + zwei Oeffnungen -----------------
    front_y = frame_y - apron_face_y            # Frontebene (negatives Y)
    rail_section = [
        (-APRON_THICKNESS / 2.0,  BOTTOM_RAIL_H / 2.0),
        ( APRON_THICKNESS / 2.0,  BOTTOM_RAIL_H / 2.0),
        ( APRON_THICKNESS / 2.0, -BOTTOM_RAIL_H / 2.0 + c),
        ( APRON_THICKNESS / 2.0 - c, -BOTTOM_RAIL_H / 2.0),
        (-APRON_THICKNESS / 2.0 + c, -BOTTOM_RAIL_H / 2.0),
        (-APRON_THICKNESS / 2.0, -BOTTOM_RAIL_H / 2.0 + c),
    ]
    parts.append(dict(kind="profile", name="Frontleiste", material=MAT_WOOD,
                      axis="x", length=inner_span + 2 * 0.010,
                      center=(0.0, front_y, apron_z0 + BOTTOM_RAIL_H / 2.0),
                      section=rail_section))

    opening_h = APRON_HEIGHT - BOTTOM_RAIL_H
    opening_z0 = apron_z0 + BOTTOM_RAIL_H
    opening_w = (inner_span - STILE_WIDTH * (DRAWER_COUNT - 1)) / DRAWER_COUNT

    box("Mittelsteg", MAT_WOOD,
        (0.0, front_y, opening_z0 + opening_h / 2.0),
        (STILE_WIDTH, APRON_THICKNESS, opening_h),
        bevel=0.0015, segs=2)

    # --- Schubladen --------------------------------------------------------
    front_w = opening_w - 2 * DRAWER_REVEAL
    front_h = opening_h - 2 * DRAWER_REVEAL
    front_cz = opening_z0 + opening_h / 2.0
    front_cy = (front_y - APRON_THICKNESS / 2.0 + DRAWER_FRONT_TH / 2.0
                - FRONT_PROUD)
    names = ("links", "rechts") if DRAWER_COUNT == 2 else \
            tuple("%d" % (i + 1) for i in range(DRAWER_COUNT))
    first_cx = -(inner_span - opening_w) / 2.0
    step = opening_w + STILE_WIDTH

    for i, nm in enumerate(names):
        cx = first_cx + i * step
        box("Schubfront_%s" % nm, MAT_WOOD,
            (cx, front_cy, front_cz), (front_w, DRAWER_FRONT_TH, front_h),
            bevel=FRONT_BEVEL, segs=2,
            groove=dict(inset=FRONT_GROOVE_IN, width=FRONT_GROOVE_W,
                        depth=FRONT_GROOVE_D))

        # Griffbuegel als Kurve: zwei Pfosten + gerundete Stange.
        hy_front = front_cy - DRAWER_FRONT_TH / 2.0
        hy_bar = hy_front - HANDLE_STANDOFF
        hx = HANDLE_WIDTH / 2.0
        parts.append(dict(
            kind="curve", name="Griff_%s" % nm, material=MAT_BRASS,
            radius=HANDLE_RADIUS, res_u=HANDLE_RES_U, res_ring=HANDLE_RES_RING,
            points=[(cx - hx, hy_front + 0.004, front_cz),
                    (cx - hx, hy_bar, front_cz),
                    (cx + hx, hy_bar, front_cz),
                    (cx + hx, hy_front + 0.004, front_cz)]))

        # Schubkasten hinter der Front.
        bw = front_w - 2 * DRAWER_SIDE_CLEAR
        bh = front_h - DRAWER_BOX_DROP - 0.006
        bz0 = front_cz - front_h / 2.0 + 0.003
        by1 = front_cy + DRAWER_FRONT_TH / 2.0              # sitzt an der Frontrueckseite
        by0 = by1 + DRAWER_BOX_DEPTH
        bcy = (by0 + by1) / 2.0
        for sx2, sn in ((-1, "links"), (1, "rechts")):
            box("Kasten_%s_Seite_%s" % (nm, sn), MAT_WOOD_INNER,
                (cx + sx2 * (bw / 2.0 - DRAWER_BOX_TH / 2.0), bcy, bz0 + bh / 2.0),
                (DRAWER_BOX_TH, DRAWER_BOX_DEPTH, bh))
        box("Kasten_%s_Rueckwand" % nm, MAT_WOOD_INNER,
            (cx, by0 - DRAWER_BOX_TH / 2.0, bz0 + bh / 2.0),
            (bw - 2 * DRAWER_BOX_TH, DRAWER_BOX_TH, bh))
        box("Kasten_%s_Boden" % nm, MAT_WOOD_INNER,
            (cx, bcy, bz0 + DRAWER_BOT_TH / 2.0),
            (bw - 2 * DRAWER_BOX_TH, DRAWER_BOX_DEPTH - DRAWER_BOX_TH, DRAWER_BOT_TH))

    dims = dict(
        width=DESK_WIDTH, depth=DESK_DEPTH, height=DESK_HEIGHT,
        frame_w=frame_w, frame_d=frame_d, frame_y=frame_y,
        top_z0=top_z0, apron_z0=apron_z0, opening_w=opening_w,
        opening_h=opening_h, opening_z0=opening_z0,
        front_w=front_w, front_h=front_h, front_y=front_y,
        knee_height=apron_z0, knee_width=inner_span,
        inner_span=inner_span, leg_h=leg_h)
    return parts, dims


PARTS, DIMS = build_layout()

# === PURE_SECTION_END ===  (ab hier wird Blender gebraucht)

import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:                      # z.B. beim Einfuegen in die Blender-Konsole
    HERE = os.getcwd()
RENDER_DIR = os.path.join(HERE, "renders")

# ---------------------------------------------------------------------------
#  Kleine Helfer
# ---------------------------------------------------------------------------


def log(msg):
    print("[desk] %s" % msg)


def reset_scene():
    """Szene bei jedem Lauf komplett neu aufbauen."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.objects, bpy.data.materials,
                  bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = 1.0
    return scene


MATERIAL_CACHE = {}


def get_material(spec):
    """Principled BSDF mit festen Werten - keine prozeduralen Nodes."""
    name, hex_color, roughness, metallic = spec
    if name in MATERIAL_CACHE:
        return MATERIAL_CACHE[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        out = mat.node_tree.nodes.get("Material Output") or \
            mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
        mat.node_tree.links.new(bsdf.outputs[0], out.inputs[0])
    rgba = srgb_to_linear(hex_color)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    for key, value in (("IOR", 1.45), ("Specular IOR Level", 0.5)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    mat.diffuse_color = rgba                    # Viewport-Farbe
    mat.roughness = roughness
    mat.metallic = metallic
    MATERIAL_CACHE[name] = mat
    return mat


def set_shading(mesh, smooth):
    """shade_flat()/shade_smooth() auf dem Mesh gibt es erst ab Blender 4.1."""
    for poly in mesh.polygons:
        poly.use_smooth = smooth


def new_object(name, mesh_data, material_spec, collection):
    obj = bpy.data.objects.new(name, mesh_data)
    obj.data.materials.append(get_material(material_spec))
    collection.objects.link(obj)
    return obj


def bm_to_object(bm, name, material_spec, collection):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)      # Normalen nach aussen
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    set_shading(mesh, smooth=False)
    return new_object(name, mesh, material_spec, collection)


def add_bevel(obj, width, segments=2, angle_deg=35.0):
    if width <= 0.0:
        return
    mod = obj.modifiers.new("Fase", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle_deg)
    mod.miter_outer = "MITER_ARC"
    if hasattr(mod, "harden_normals"):
        mod.harden_normals = False


def apply_modifiers(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        try:
            if hasattr(bpy.context, "temp_override"):       # Blender >= 3.2
                with bpy.context.temp_override(
                        object=obj, active_object=obj, selected_objects=[obj],
                        selected_editable_objects=[obj]):
                    bpy.ops.object.modifier_apply(modifier=mod.name)
            else:
                bpy.ops.object.modifier_apply(modifier=mod.name)
        except RuntimeError as exc:
            log("Modifier %s auf %s nicht anwendbar: %s" % (mod.name, obj.name, exc))
            obj.modifiers.remove(mod)
    obj.select_set(False)


def apply_transforms(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.select_all(action="DESELECT")


# ---------------------------------------------------------------------------
#  Bauteil-Generatoren
# ---------------------------------------------------------------------------


def make_box(part, collection):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = part["size"]
    bmesh.ops.scale(bm, vec=Vector((sx, sy, sz)), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(part["center"]), verts=bm.verts)
    obj = bm_to_object(bm, part["name"], part["material"], collection)
    add_bevel(obj, part.get("bevel", 0.0), part.get("segs", 2))
    return obj


def make_taper(part, collection):
    """Bein: unten verjuengt, Verjuengung beginnt erst ab taper_start."""
    sx, sy, sz = part["size"]
    bx, by = part["bottom_size"]
    cx, cy, cz = part["center"]
    z0, z1 = cz - sz / 2.0, cz + sz / 2.0
    zk = z0 + part.get("taper_start", 0.0)      # Knick
    rings = [(z0, bx, by), (zk, sx, sy), (z1, sx, sy)]

    bm = bmesh.new()
    ring_verts = []
    for z, w, d in rings:
        ring_verts.append([
            bm.verts.new((cx - w / 2.0, cy - d / 2.0, z)),
            bm.verts.new((cx + w / 2.0, cy - d / 2.0, z)),
            bm.verts.new((cx + w / 2.0, cy + d / 2.0, z)),
            bm.verts.new((cx - w / 2.0, cy + d / 2.0, z)),
        ])
    for lower, upper in zip(ring_verts, ring_verts[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((lower[i], lower[j], upper[j], upper[i]))
    bm.faces.new(tuple(reversed(ring_verts[0])))            # Standflaeche
    bm.faces.new(tuple(ring_verts[-1]))                     # Oberseite
    obj = bm_to_object(bm, part["name"], part["material"], collection)
    add_bevel(obj, part.get("bevel", 0.0), part.get("segs", 2), angle_deg=25.0)
    return obj


def make_profile(part, collection):
    """2D-Querschnitt entlang einer Achse extrudieren."""
    section = part["section"]
    length = part["length"]
    cx, cy, cz = part["center"]
    axis = part["axis"]
    half = length / 2.0

    def place(u, v, w):
        # u = Profilbreite, v = Profilhoehe, w = Extrusionsrichtung
        if axis == "x":
            return (cx + w, cy + u, cz + v)
        return (cx + u, cy + w, cz + v)

    bm = bmesh.new()
    rings = []
    for w in (-half, half):
        rings.append([bm.verts.new(place(u, v, w)) for u, v in section])
    n = len(section)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
    bm.faces.new(tuple(rings[0]))
    bm.faces.new(tuple(reversed(rings[1])))
    return bm_to_object(bm, part["name"], part["material"], collection)


def make_curve(part, collection):
    """Messinggriff: Bezier-Kurve mit Bevel-Tiefe, danach zu Mesh konvertiert."""
    curve = bpy.data.curves.new(part["name"], "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = part.get("res_u", 8)
    curve.bevel_depth = part["radius"]
    curve.bevel_resolution = part.get("res_ring", 3)
    curve.fill_mode = "FULL"
    curve.use_fill_caps = True

    spline = curve.splines.new("BEZIER")
    pts = part["points"]
    spline.bezier_points.add(len(pts) - 1)
    for bp, co in zip(spline.bezier_points, pts):
        bp.co = Vector(co)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"

    obj = bpy.data.objects.new(part["name"], curve)
    collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    obj.name = part["name"]
    obj.data.name = part["name"]
    obj.data.materials.clear()
    obj.data.materials.append(get_material(part["material"]))
    set_shading(obj.data, smooth=True)
    if hasattr(obj.data, "use_auto_smooth"):                # Blender < 4.1
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = math.radians(40.0)
    bpy.ops.object.select_all(action="DESELECT")
    return obj


def cut_groove(obj, part, collection):
    """Umlaufende Nut in der Schubfront - per Boolean-Differenz."""
    groove = part["groove"]
    inset, width, depth = groove["inset"], groove["width"], groove["depth"]
    cx, cy, cz = part["center"]
    sx, sy, sz = part["size"]
    ow, oh = sx - 2 * inset, sz - 2 * inset          # Aussenmass der Nut
    front_y = cy - sy / 2.0                          # Vorderflaeche der Front

    bm = bmesh.new()

    def add_bar(w, h, ox, oz):
        res = bmesh.ops.create_cube(bm, size=1.0)
        verts = res["verts"]
        bmesh.ops.scale(bm, vec=Vector((w, depth * 2.0, h)), verts=verts)
        bmesh.ops.translate(
            bm, vec=Vector((cx + ox, front_y + depth, cz + oz)), verts=verts)

    add_bar(ow, width, 0.0, oh / 2.0 - width / 2.0)                # oben
    add_bar(ow, width, 0.0, -oh / 2.0 + width / 2.0)               # unten
    add_bar(width, oh - 2 * width, -ow / 2.0 + width / 2.0, 0.0)   # links
    add_bar(width, oh - 2 * width, ow / 2.0 - width / 2.0, 0.0)    # rechts

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cutter_mesh = bpy.data.meshes.new(part["name"] + "_Nut")
    bm.to_mesh(cutter_mesh)
    bm.free()
    cutter = bpy.data.objects.new(part["name"] + "_Nut", cutter_mesh)
    collection.objects.link(cutter)
    cutter.hide_render = True

    mod = obj.modifiers.new("Nut", "BOOLEAN")      # laeuft nach der Fase
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    if hasattr(mod, "solver"):
        mod.solver = "EXACT"
    return cutter


# ---------------------------------------------------------------------------
#  Szene zusammenbauen
# ---------------------------------------------------------------------------

BUILDERS = {"box": make_box, "taper": make_taper,
            "profile": make_profile, "curve": make_curve}


def build_desk(scene):
    coll = bpy.data.collections.new("Schreibtisch")
    scene.collection.children.link(coll)

    objects, cutters = [], []
    for part in PARTS:
        obj = BUILDERS[part["kind"]](part, coll)
        if part.get("groove"):
            cutters.append(cut_groove(obj, part, coll))
        objects.append(obj)

    for obj in objects:
        apply_modifiers(obj)
    for cutter in cutters:                       # Hilfsgeometrie wieder entfernen
        bpy.data.objects.remove(cutter, do_unlink=True)

    apply_transforms(objects)
    for obj in objects:                          # Ursprung bleibt unten mittig
        obj.location = (0.0, 0.0, 0.0)
    log("%d Bauteile erzeugt" % len(objects))
    return coll, objects


def setup_studio(scene, objects):
    """Neutraler Hintergrund + schlichtes Studiolicht (nur fuer die Renders)."""
    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.5, 0.5, 0.52, 1.0)
    bg.inputs[1].default_value = 0.6
    scene.world = world

    helper = bpy.data.collections.new("Studio")
    scene.collection.children.link(helper)

    # Hintergrund: grosse, leicht gewoelbte Flaeche hinter und unter dem Modell
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12.0)
    mesh = bpy.data.meshes.new("Hintergrund")
    bm.to_mesh(mesh)
    bm.free()
    floor = bpy.data.objects.new("Hintergrund", mesh)
    helper.objects.link(floor)
    mat = bpy.data.materials.new("Hintergrund_Neutral")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (BACKDROP_GREY,) * 3 + (1.0,)
    bsdf.inputs["Roughness"].default_value = 0.9
    floor.data.materials.append(mat)

    def add_area(name, location, rotation, size, energy):
        data = bpy.data.lights.new(name, "AREA")
        data.shape = "RECTANGLE"
        data.size, data.size_y = size
        data.energy = energy
        data.color = (1.0, 0.98, 0.95)
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        obj.rotation_euler = [math.radians(a) for a in rotation]
        helper.objects.link(obj)

    add_area("Licht_Key",  (-1.6, -1.9, 2.5), (48, 0, -40), (2.4, 2.0), 900)
    add_area("Licht_Fill", ( 2.1, -1.5, 1.5), (68, 0,  55), (2.6, 2.2), 320)
    add_area("Licht_Rim",  ( 0.4,  2.4, 2.2), (-60, 0,  0), (2.4, 1.4), 420)
    return helper


def pick_engine(scene):
    avail = {item.identifier for item in
             bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    for candidate in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if candidate in avail:
            scene.render.engine = candidate
            break
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = RENDER_SAMPLES
    else:
        eevee = scene.eevee
        for attr, value in (("taa_render_samples", RENDER_SAMPLES),
                            ("use_gtao", True), ("use_shadows", True),
                            ("use_raytracing", True)):
            if hasattr(eevee, attr):
                setattr(eevee, attr, value)
    log("Render-Engine: %s" % scene.render.engine)
    return scene.render.engine


def scene_bounds(objects):
    lo = [1e9, 1e9, 1e9]
    hi = [-1e9, -1e9, -1e9]
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], world[i])
                hi[i] = max(hi[i], world[i])
    return Vector(lo), Vector(hi)


def render_views(scene, objects, helper_coll, tag=""):
    lo, hi = scene_bounds(objects)
    centre = (lo + hi) / 2.0
    span = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)

    scene.render.resolution_x = RENDER_RES
    scene.render.resolution_y = RENDER_RES
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    try:                                   # neutrale Farbwiedergabe
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
    except TypeError:
        pass
    views = [
        ("1_vorne",   "ORTHO", (centre.x, centre.y - 6.0, centre.z), (90, 0, 0)),
        ("2_seite",   "ORTHO", (centre.x + 6.0, centre.y, centre.z), (90, 0, 90)),
        ("3_oben",    "ORTHO", (centre.x, centre.y, centre.z + 6.0), (0, 0, 0)),
        ("4_schraeg", "PERSP", (centre.x - 1.85, centre.y - 2.25, centre.z + 1.65), None),
    ]
    os.makedirs(RENDER_DIR, exist_ok=True)
    written = []
    for name, kind, location, rotation in views:
        data = bpy.data.cameras.new("Kamera_" + name)
        data.type = kind
        if kind == "ORTHO":
            data.ortho_scale = span * 1.18
        else:
            data.lens = 52.0
        cam = bpy.data.objects.new("Kamera_" + name, data)
        cam.location = location
        if rotation is None:                      # schraeg: auf die Mitte ausrichten
            direction = centre - Vector(location) + Vector((0, 0, -0.06))
            cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        else:
            cam.rotation_euler = [math.radians(a) for a in rotation]
        helper_coll.objects.link(cam)
        scene.camera = cam
        path = os.path.join(RENDER_DIR, "%s%s.png" % (name, tag))
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        written.append(path)
        log("gerendert: %s" % os.path.basename(path))
    return written


# ---------------------------------------------------------------------------
#  Selbstkontrolle
# ---------------------------------------------------------------------------


def mesh_stats(objects):
    """Dreiecke, Non-Manifold-Kanten, lose Vertices, doppelte Vertices."""
    tris = 0
    non_manifold = 0
    loose_verts = 0
    doubles = 0
    flipped = 0
    per_object = {}
    for obj in objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        obj_tris = len(mesh.loop_triangles)
        tris += obj_tris

        bm = bmesh.new()
        bm.from_mesh(mesh)
        nm = sum(1 for e in bm.edges if len(e.link_faces) != 2)
        lv = sum(1 for v in bm.verts if not v.link_edges)
        found = bmesh.ops.find_doubles(bm, verts=list(bm.verts), dist=1e-6)
        dbl = len(found["targetmap"])
        # Normalenrichtung: vorzeichenbehaftetes Volumen (Divergenzsatz).
        # Negativ = Normalen zeigen nach innen. Nur bei geschlossenen Koerpern.
        volume = sum(f.calc_area() * f.calc_center_median().dot(f.normal) / 3.0
                     for f in bm.faces)
        bad = 1 if (nm == 0 and volume < 0) else 0
        bm.free()
        non_manifold += nm
        loose_verts += lv
        doubles += dbl
        flipped += bad
        per_object[obj.name] = dict(tris=obj_tris, non_manifold=nm, loose=lv,
                                    doubles=dbl, volume=round(volume, 9),
                                    normals_inverted=bool(bad))
    return dict(triangles=tris, non_manifold_edges=non_manifold,
                loose_vertices=loose_verts, duplicate_vertices=doubles,
                objects_with_inverted_normals=flipped, parts=per_object)


def check_model(objects):
    lo, hi = scene_bounds(objects)
    stats = mesh_stats(objects)
    size = hi - lo
    problems = []
    for axis, got, want in (("Breite", size.x, DESK_WIDTH),
                            ("Tiefe", size.y, DESK_DEPTH),
                            ("Hoehe", size.z, DESK_HEIGHT)):
        if abs(got - want) > 0.0015:
            problems.append("%s %.4f m statt %.4f m" % (axis, got, want))
    if abs(lo.z) > 1e-4:
        problems.append("Unterkante liegt bei z=%.4f statt 0" % lo.z)
    if abs((lo.x + hi.x) / 2.0) > 1e-4:
        problems.append("nicht mittig in X (%.4f)" % ((lo.x + hi.x) / 2.0))
    if stats["loose_vertices"]:
        problems.append("%d lose Vertices" % stats["loose_vertices"])
    if stats["duplicate_vertices"]:
        problems.append("%d doppelte Vertices" % stats["duplicate_vertices"])
    if stats["objects_with_inverted_normals"]:
        problems.append("%d Objekte mit nach innen zeigenden Normalen"
                        % stats["objects_with_inverted_normals"])
    if stats["non_manifold_edges"]:
        problems.append("%d Non-Manifold-Kanten" % stats["non_manifold_edges"])
    if stats["triangles"] > TRI_BUDGET:
        problems.append("%d Dreiecke ueber Budget %d"
                        % (stats["triangles"], TRI_BUDGET))
    report = dict(bbox_min=list(lo), bbox_max=list(hi), size=list(size),
                  object_count=len(objects), problems=problems, **stats)
    return report


# ---------------------------------------------------------------------------
#  Export
# ---------------------------------------------------------------------------


def export_glb(objects, path):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    kwargs = dict(filepath=path, export_format="GLB", use_selection=True)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    for key, value in (("export_apply", True), ("export_yup", True),
                       ("export_materials", "EXPORT"), ("export_cameras", False),
                       ("export_lights", False), ("export_animations", False),
                       ("export_extras", False)):
        if key in props:
            kwargs[key] = value
    bpy.ops.export_scene.gltf(**kwargs)
    bpy.ops.object.select_all(action="DESELECT")
    log("GLB geschrieben: %.1f kB" % (os.path.getsize(path) / 1024.0))
    return path


def write_viewer(glb_path, out_path, meta):
    """viewer.html: eine einzige Offline-Datei, Modell als base64 eingebettet."""
    import base64
    template_path = os.path.join(HERE, "viewer_template.html")
    with open(template_path, "r", encoding="utf-8") as fh:
        html = fh.read()
    with open(glb_path, "rb") as fh:
        payload = base64.b64encode(fh.read()).decode("ascii")
    html = html.replace("__MODEL_B64__", payload)
    html = html.replace("__MODEL_META__", json.dumps(meta, ensure_ascii=False))
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    log("viewer.html geschrieben: %.1f kB" % (os.path.getsize(out_path) / 1024.0))
    return out_path


def verify_glb(path):
    """GLB in eine leere Szene laden und Masse, Material und Dreiecke pruefen."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    lo, hi = scene_bounds(objects)
    tris = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        tris += len(obj.data.loop_triangles)
    materials = sorted({m.name for o in objects for m in o.data.materials if m})
    result = dict(objects=len(objects), triangles=tris,
                  size=[round(v, 4) for v in (hi - lo)],
                  bbox_min=[round(v, 4) for v in lo],
                  materials=materials,
                  within_budget=tris <= TRI_BUDGET,
                  size_ok=all(abs(a - b) < 0.0015 for a, b in
                              zip((hi - lo), (DESK_WIDTH, DESK_DEPTH, DESK_HEIGHT))))
    log("GLB-Reimport: %d Objekte, %d Dreiecke, %s, Materialien: %s"
        % (result["objects"], tris,
           " x ".join("%.3f" % v for v in result["size"]),
           ", ".join(materials)))
    return result


# ---------------------------------------------------------------------------
#  Hauptablauf
# ---------------------------------------------------------------------------


def main():
    scene = reset_scene()
    coll, objects = build_desk(scene)
    pick_engine(scene)
    helper = setup_studio(scene, objects)

    report = check_model(objects)
    log("Masse: %s m" % " x ".join("%.3f" % v for v in report["size"]))
    log("Dreiecke: %d (Budget %d)" % (report["triangles"], TRI_BUDGET))
    log("Non-Manifold-Kanten: %d | lose Vertices: %d | doppelte Vertices: %d"
        % (report["non_manifold_edges"], report["loose_vertices"],
           report["duplicate_vertices"]))
    for problem in report["problems"]:
        log("PROBLEM: %s" % problem)

    blend_path = os.path.join(HERE, "model.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    log("model.blend gespeichert")

    render_views(scene, objects, helper)

    glb_path = os.path.join(HERE, "model.glb")
    export_glb(objects, glb_path)

    meta = dict(name="Holzschreibtisch mit zwei Schubladen",
                size_m=[round(v, 4) for v in report["size"]],
                triangles=report["triangles"],
                parts=report["object_count"])
    write_viewer(glb_path, os.path.join(HERE, "viewer.html"), meta)

    report["glb"] = verify_glb(glb_path)          # laedt eine neue, leere Szene
    report["files"] = dict(
        blend=os.path.getsize(blend_path),
        glb=os.path.getsize(glb_path),
        viewer=os.path.getsize(os.path.join(HERE, "viewer.html")))
    with open(os.path.join(HERE, "report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    log("report.json geschrieben - fertig.")
    return 0 if not report["problems"] else 1


if __name__ == "__main__":
    sys.exit(main())
