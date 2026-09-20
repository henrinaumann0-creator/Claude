"""Vier Ansichten der Vorschau aus dem Offline-Viewer aufnehmen (headless Chromium)."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
CHROME_UI_HEIGHT = 87          # Headless-Fenster liefert 87 px weniger Viewport
VIEWS = (("front", "1_vorne"), ("side", "2_seite"),
         ("top", "3_oben"), ("iso", "4_schraeg"))


def shoot(page, out_dir, size=820, tag=""):
    page = os.path.abspath(page)
    os.makedirs(out_dir, exist_ok=True)
    made = []
    for view, label in VIEWS:
        out = os.path.join(out_dir, "%s%s.png" % (label, tag))
        subprocess.run([
            CHROME, "--headless=new", "--no-sandbox", "--disable-gpu",
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
            "--hide-scrollbars", "--force-color-profile=srgb",
            "--window-size=%d,%d" % (size, size + CHROME_UI_HEIGHT),
            "--virtual-time-budget=5000", "--screenshot=" + out,
            "file://%s?view=%s&bare=1" % (page, view),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        crop(out, size, size)
        made.append(out)
    return made


def crop(path, w, h):
    import pngcrop
    pngcrop.crop(path, w, h)


if __name__ == "__main__":
    page = sys.argv[1] if len(sys.argv) > 1 else \
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                     "renders", "preview.html")
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(page)
    for p in shoot(page, out, tag=sys.argv[3] if len(sys.argv) > 3 else ""):
        print(p)
