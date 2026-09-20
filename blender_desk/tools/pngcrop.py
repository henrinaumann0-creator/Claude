"""PNG oben links zuschneiden - reines Python, ohne Pillow."""

import struct
import zlib

_FILTER = {0: lambda x, a, b, c: x,
           1: lambda x, a, b, c: (x + a) & 255,
           2: lambda x, a, b, c: (x + b) & 255,
           3: lambda x, a, b, c: (x + (a + b) // 2) & 255}


def _paeth(x, a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    return (x + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255


_FILTER[4] = _paeth


def crop(path, width, height, out=None):
    with open(path, "rb") as fh:
        data = fh.read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "keine PNG-Datei"
    pos, idat, head = 8, bytearray(), None
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + length]
        if kind == b"IHDR":
            head = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat += body
        pos += 12 + length
    w, h, depth, color, comp, filt, interlace = head
    assert depth == 8 and interlace == 0, "nur 8 Bit, nicht interlaced"
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    if (w, h) == (width, height):
        return path

    raw = zlib.decompress(bytes(idat))
    stride = w * channels
    rows, prev = [], bytearray(stride)
    at = 0
    for _ in range(h):
        ftype = raw[at]
        line = bytearray(raw[at + 1:at + 1 + stride])
        at += 1 + stride
        fn = _FILTER[ftype]
        for i in range(stride):
            a = line[i - channels] if i >= channels else 0
            b = prev[i]
            c = prev[i - channels] if i >= channels else 0
            line[i] = fn(line[i], a, b, c)
        rows.append(line)
        prev = line

    out_rows = bytearray()
    for line in rows[:height]:
        out_rows.append(0)                       # Filter 0 = None
        out_rows += line[:width * channels]

    def chunk(kind, body):
        return (struct.pack(">I", len(body)) + kind + body
                + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, color, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(out_rows), 9))
    png += chunk(b"IEND", b"")
    with open(out or path, "wb") as fh:
        fh.write(png)
    return out or path
