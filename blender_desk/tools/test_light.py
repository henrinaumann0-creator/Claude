"""Schnelle Belichtungsprobe: eine Ansicht, kleine Aufloesung."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import build_model as bm

SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 420
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/licht.png"

scene = bm.reset_scene()
objects = bm.build_desk(scene)
bm.pick_engine(scene)
helper = bm.setup_studio(scene)
bm.RENDER_RES = SIZE
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.cycles.samples = 24
bm.RENDER_DIR = os.path.dirname(OUT)
paths = bm.render_views(scene, objects, helper)
print("fertig:", paths[-1])
