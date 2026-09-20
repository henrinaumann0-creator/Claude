"""Minimaler glTF-2.0/GLB-Schreiber in reinem Python (nur fuer die Proxy-Vorschau).

Erzeugt dieselbe Struktur wie der Blender-Export: Y-up, flache Normalen,
pbrMetallicRoughness mit festen Faktoren, ein Primitive je Bauteil.
"""

import json
import struct

FLOAT, USHORT = 5126, 5123
ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963


def blender_to_gltf(x, y, z):
    """Blender Z-up -> glTF Y-up (identisch zu export_yup=True)."""
    return (x, z, -y)


class GLB(object):
    def __init__(self):
        self.materials = []
        self._mat_index = {}
        self.meshes = []
        self.nodes = []
        self.accessors = []
        self.views = []
        self.blob = bytearray()

    # -- Materialien --------------------------------------------------------
    def material(self, name, rgb, roughness, metallic):
        if name in self._mat_index:
            return self._mat_index[name]
        self.materials.append(dict(
            name=name, doubleSided=False,
            pbrMetallicRoughness=dict(
                baseColorFactor=[rgb[0], rgb[1], rgb[2], 1.0],
                metallicFactor=metallic, roughnessFactor=roughness)))
        self._mat_index[name] = len(self.materials) - 1
        return self._mat_index[name]

    # -- Puffer -------------------------------------------------------------
    def _view(self, data, target):
        while len(self.blob) % 4:
            self.blob.append(0)
        offset = len(self.blob)
        self.blob.extend(data)
        self.views.append(dict(buffer=0, byteOffset=offset,
                               byteLength=len(data), target=target))
        return len(self.views) - 1

    def _vec3(self, values, with_range):
        data = struct.pack("<%df" % (len(values) * 3),
                           *[c for v in values for c in v])
        acc = dict(bufferView=self._view(data, ARRAY_BUFFER),
                   componentType=FLOAT, count=len(values), type="VEC3")
        if with_range:
            acc["min"] = [min(v[i] for v in values) for i in range(3)]
            acc["max"] = [max(v[i] for v in values) for i in range(3)]
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def _indices(self, idx):
        data = struct.pack("<%dH" % len(idx), *idx)
        self.accessors.append(dict(
            bufferView=self._view(data, ELEMENT_ARRAY_BUFFER),
            componentType=USHORT, count=len(idx), type="SCALAR"))
        return len(self.accessors) - 1

    # -- Geometrie ----------------------------------------------------------
    def add_mesh(self, name, positions, normals, indices, material):
        self.meshes.append(dict(name=name, primitives=[dict(
            attributes=dict(POSITION=self._vec3(positions, True),
                            NORMAL=self._vec3(normals, False)),
            indices=self._indices(indices), mode=4, material=material)]))
        self.nodes.append(dict(name=name, mesh=len(self.meshes) - 1))

    def add_box(self, name, center, size, material):
        cx, cy, cz = center
        hx, hy, hz = (s / 2.0 for s in size)
        corners = [(cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz),
                   (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
                   (cx - hx, cy - hy, cz + hz), (cx + hx, cy - hy, cz + hz),
                   (cx + hx, cy + hy, cz + hz), (cx - hx, cy + hy, cz + hz)]
        faces = [((0, 3, 2, 1), (0, 0, -1)), ((4, 5, 6, 7), (0, 0, 1)),
                 ((0, 1, 5, 4), (0, -1, 0)), ((2, 3, 7, 6), (0, 1, 0)),
                 ((1, 2, 6, 5), (1, 0, 0)), ((3, 0, 4, 7), (-1, 0, 0))]
        positions, normals, indices = [], [], []
        for quad, normal in faces:
            base = len(positions)
            for i in quad:
                positions.append(blender_to_gltf(*corners[i]))
                normals.append(blender_to_gltf(*normal))
            indices.extend([base, base + 1, base + 2,
                            base, base + 2, base + 3])
        self.add_mesh(name, positions, normals, indices, material)

    # -- Datei --------------------------------------------------------------
    def save(self, path):
        doc = dict(asset=dict(version="2.0", generator="layout_check"),
                   scene=0, scenes=[dict(nodes=list(range(len(self.nodes))))],
                   nodes=self.nodes, meshes=self.meshes,
                   materials=self.materials, accessors=self.accessors,
                   bufferViews=self.views,
                   buffers=[dict(byteLength=len(self.blob))])
        js = json.dumps(doc, separators=(",", ":")).encode("utf-8")
        js += b" " * ((4 - len(js) % 4) % 4)
        bin_ = bytes(self.blob) + b"\0" * ((4 - len(self.blob) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(bin_)
        with open(path, "wb") as fh:
            fh.write(struct.pack("<III", 0x46546C67, 2, total))
            fh.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
            fh.write(struct.pack("<II", len(bin_), 0x004E4942) + bin_)
        return total
