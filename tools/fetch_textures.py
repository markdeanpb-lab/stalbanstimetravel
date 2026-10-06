#!/usr/bin/env python3
"""Download the CC0 surface textures the game uses and pack them into game/js/data/pbr_textures.js.

Usage: python3 -I tools/fetch_textures.py [--cache DIR] [--size 512] [--preview FILE]

Sources are Poly Haven scans (CC0, https://polyhaven.com/license). Knapped flint has no suitable
free scan, so it is generated here from a seeded random pattern.

Each layer becomes two WebP data URIs, so the game runs from file:// without fetching anything:
  c  albedo, sRGB
  d  a greyscale strip of square tiles named in the layer's "t" list: "nx" and "ny" (the scan's
     own normal map, OpenGL convention) and "h" (height). Fine-grained surfaces (asphalt, gravel,
     grass, render) ship height only and the game derives their normals, which keeps the file
     small. Roughness and ambient occlusion are derived from height in the game too.
Rows are stored bottom-up, so texture v = 0 is the first row and the game uploads the pixels
without flipping. Each layer also records its real-world size in metres, its mean albedo (linear),
which the shaders use to recolour a texture to each building's own paint or brick, and the
parameters the game uses to derive the missing maps.
Downloaded files are only read as images, never executed.
"""
import argparse
import base64
import io
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'game', 'js', 'data', 'pbr_textures.js')

# key, Poly Haven id (None = generated here), kind, tile size override in metres, options:
#   nrm    'map' ships the scan's normal map; a number derives normals from height with that relief (m)
#   rough  (roughness in hollows, roughness on high spots, height where the change starts, ends)
#   ao     strength of the cavity occlusion derived from height
#   ns     normal strength in the shader;  k  how far the shader recolours it to the surface's own colour
LAYERS = [
    ('brick', 'large_red_bricks', 'wall', None, dict(nrm='map', rough=(0.95, 0.84, 0.25, 0.6), ao=2.4, ns=1.0, k=1.0)),
    ('brick_dark', 'red_brick_03', 'wall', None, dict(nrm='map', rough=(0.95, 0.8, 0.25, 0.6), ao=2.4, ns=1.0, k=0.75)),
    ('stock_brick', 'yellow_brick', 'wall', None, dict(nrm='map', rough=(0.95, 0.86, 0.25, 0.6), ao=2.4, ns=1.0, k=1.0)),
    ('stucco', 'painted_plaster_wall', 'wall', None, dict(nrm=0.004, rough=(0.9, 0.78, 0.3, 0.7), ao=1.2, ns=1.0, k=1.0)),
    ('render', 'rough_concrete', 'wall', None, dict(nrm=0.006, rough=(0.97, 0.9, 0.3, 0.7), ao=1.6, ns=1.0, k=1.0)),
    ('flint', None, 'wall', (1.2, 1.2), dict(nrm=0.02, rough=(0.93, 0.3, 0.3, 0.5), ao=2.6, ns=1.0, k=0.0)),
    ('clay_tile', 'clay_roof_tiles_03', 'roof', None, dict(nrm='map', rough=(0.92, 0.78, 0.3, 0.7), ao=2.6, ns=1.0, k=0.85)),
    ('slate', 'grey_roof_01', 'roof', (5.0, 5.0), dict(nrm='map', rough=(0.85, 0.55, 0.3, 0.7), ao=2.4, ns=1.0, k=0.85)),
    ('felt', 'tarred_gravel', 'roof', None, dict(nrm=0.008, rough=(0.95, 0.85, 0.3, 0.7), ao=1.6, ns=1.0, k=1.0)),
    ('lead', 'metal_plate_02', 'roof', None, dict(nrm='map', rough=(0.7, 0.5, 0.3, 0.7), ao=1.6, ns=1.0, k=0.6)),
    ('concrete_slabs', 'concrete_pavement', 'ground', None, dict(nrm='map', rough=(0.95, 0.82, 0.2, 0.5), ao=2.2, ns=1.0, k=1.0)),
    ('york_flags', 'red_sandstone_pavement', 'ground', None, dict(nrm='map', rough=(0.95, 0.72, 0.2, 0.5), ao=2.2, ns=1.0, k=1.0)),
    ('asphalt', 'worn_asphalt', 'ground', None, dict(nrm=0.006, rough=(0.95, 0.72, 0.3, 0.8), ao=1.4, ns=1.0, k=1.0)),
    ('setts', 'cobblestone_square', 'ground', None, dict(nrm='map', rough=(0.97, 0.5, 0.3, 0.7), ao=2.8, ns=1.0, k=0.9)),
    ('grass', 'sparse_grass', 'ground', None, dict(nrm=0.012, rough=(0.97, 0.88, 0.3, 0.7), ao=1.8, ns=1.0, k=1.0)),
    ('dirt', 'dirt', 'ground', None, dict(nrm=0.012, rough=(0.97, 0.85, 0.3, 0.7), ao=1.8, ns=1.0, k=1.0)),
    ('gravel', 'gravel_floor', 'ground', None, dict(nrm=0.01, rough=(0.97, 0.8, 0.3, 0.7), ao=2.0, ns=1.0, k=1.0)),
]
MAPS = {'diff': 'Diffuse', 'nor_gl': 'nor_gl', 'arm': 'arm', 'disp': 'Displacement'}


def curl(url, dest):
    tmp = dest + '.part'
    for attempt in range(4):
        r = subprocess.run(['curl', '-sS', '-f', '-L', '--max-time', '120', '-o', tmp, url])
        if r.returncode == 0 and os.path.getsize(tmp) > 0:
            os.replace(tmp, dest)
            return
    raise RuntimeError('download failed: ' + url)


def get_json(url, dest):
    if not os.path.exists(dest):
        curl(url, dest)
    with open(dest, encoding='utf-8') as f:
        return json.load(f)


def fetch_layer(pid, cache):
    d = os.path.join(cache, pid)
    os.makedirs(d, exist_ok=True)
    info = get_json('https://api.polyhaven.com/info/' + pid, os.path.join(d, 'info.json'))
    files = get_json('https://api.polyhaven.com/files/' + pid, os.path.join(d, 'files.json'))
    paths = {}
    for short, key in MAPS.items():
        entry = files.get(key, {}).get('1k', {}).get('jpg')
        if not entry and short == 'arm':
            entry = None
        if not entry:
            paths[short] = None
            continue
        p = os.path.join(d, short + '.jpg')
        if not os.path.exists(p):
            curl(entry['url'], p)
        paths[short] = p
    if not paths['arm']:
        # fall back to separate AO and roughness maps
        for short, key in (('ao', 'AO'), ('rough', 'Rough')):
            entry = files.get(key, {}).get('1k', {}).get('jpg')
            if entry:
                p = os.path.join(d, short + '.jpg')
                if not os.path.exists(p):
                    curl(entry['url'], p)
                paths[short] = p
    return info, paths


def load(path, size, mode):
    im = Image.open(path)
    im.load()
    return im.convert(mode).resize((size, size), Image.LANCZOS)


def srgb_to_linear(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def stretch(a, lo=1.0, hi=99.0):
    p0, p1 = np.percentile(a, lo), np.percentile(a, hi)
    if p1 - p0 < 1e-3:
        return np.full_like(a, 0.5)
    return np.clip((a - p0) / (p1 - p0), 0.0, 1.0)


# ------------------------------------------------------------------ generated flint (knapped flint in lime mortar)
def gen_flint(size, seed=1897):
    """Knapped flint nodules packed in lime mortar, tileable. Returns albedo (RGB uint8) and
    float maps in 0..1 (normal x, normal y, roughness, ao, height), all size x size."""
    rng = np.random.default_rng(seed)
    S = size * 2  # work at twice the size, then downsample
    tile_m = 1.2
    # rough courses of nodules: jittered points, about 10 cm apart
    pts = []
    rows = 13
    for r in range(rows):
        y = (r + 0.5) / rows
        n = 12 + rng.integers(-1, 3)
        off = rng.random()
        for i in range(n):
            x = (i + off + rng.uniform(-0.3, 0.3)) / n
            pts.append((x % 1.0, (y + rng.uniform(-0.3, 0.3) / rows) % 1.0, rng.uniform(0.65, 1.35)))
    pts = np.array(pts)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    d1 = np.full((S, S), 9.0, np.float32)
    d2 = np.full((S, S), 9.0, np.float32)
    idx = np.zeros((S, S), np.int32)
    # warp the lookup slightly so the cells read as rounded nodules, not polygons
    wx = xx + 0.008 * np.sin(yy * 2 * np.pi * 7 + 1.3) + 0.005 * np.sin(xx * 2 * np.pi * 13) + 0.003 * np.sin((xx + yy) * 2 * np.pi * 23)
    wy = yy + 0.008 * np.sin(xx * 2 * np.pi * 6 + 0.4) + 0.005 * np.sin(yy * 2 * np.pi * 11) + 0.003 * np.sin((xx - yy) * 2 * np.pi * 19)
    for k, (px, py, sc) in enumerate(pts):
        dx = np.abs(wx - px)
        dx = np.minimum(dx, 1.0 - dx)
        dy = np.abs(wy - py)
        dy = np.minimum(dy, 1.0 - dy)
        d = np.sqrt(dx * dx * 1.0 + dy * dy * 1.25) / sc
        closer = d < d1
        d2 = np.where(closer, d1, np.minimum(d2, d))
        idx = np.where(closer, k, idx)
        d1 = np.where(closer, d, d1)
    edge = (d2 - d1) * tile_m  # metres to the nearest neighbour boundary (approx)
    gap = 0.0055  # half the mortar joint, metres
    nod = np.clip((edge - gap) / 0.012, 0.0, 1.0)
    nod = nod * nod * (3 - 2 * nod)
    # dome per nodule
    dome = np.clip(edge / 0.04, 0.0, 1.0) ** 0.8

    def fbm(octaves, base):
        out = np.zeros((S, S), np.float32)
        amp = 1.0
        for o in range(octaves):
            f = base * (2 ** o)
            g = rng.standard_normal((f, f)).astype(np.float32)
            im = Image.fromarray(g, mode='F').resize((S, S), Image.BICUBIC)
            out += np.asarray(im) * amp
            amp *= 0.5
        return out / 2.0

    n1 = fbm(5, 8)
    n2 = fbm(4, 32)
    hv = rng.random(len(pts))[idx]
    hv2 = rng.random(len(pts))[idx]
    # flint colours: black and blue-grey knapped faces, some brown-stained, some showing white cortex
    # knapped faces: mostly near-black, some smoky blue-grey, a few stained brown
    v = hv * hv
    dark = np.stack([0.025 + 0.11 * v, 0.028 + 0.115 * v, 0.034 + 0.13 * v], -1)
    brown = np.array([0.20, 0.13, 0.075])
    face = np.where((hv2 > 0.86)[..., None], dark * 0.45 + brown * 0.55, dark)
    # the chalky white rind shows on part of the edge of some flints
    cortex = np.array([0.70, 0.67, 0.58])
    side = np.clip(n1 * 1.6 + 0.2, 0.0, 1.0)
    rim = np.clip(1.0 - (edge - gap) / 0.014, 0.0, 1.0) * (hv2 < 0.5) * side
    face = face * (1 - rim[..., None] * 0.8) + cortex * rim[..., None] * 0.8
    # conchoidal ripples on the knapped faces
    rip = 0.5 + 0.5 * np.sin((d1 * 90.0 + n2 * 2.0))
    face = face * (0.85 + 0.3 * rip[..., None]) * (1.0 + 0.15 * n2[..., None])
    mortar = np.array([0.60, 0.565, 0.49]) * (0.9 + 0.14 * n1[..., None] + 0.08 * n2[..., None])
    alb = face * nod[..., None] + mortar * (1 - nod[..., None])
    alb = np.clip(alb, 0, 1)
    height = nod * (0.55 + 0.45 * dome) + 0.04 * n2 + 0.03 * n1
    height = (height - height.min()) / (height.max() - height.min())
    rough = np.clip(nod * (0.32 + 0.12 * n2 + rim * 0.45) + (1 - nod) * 0.93, 0.05, 1.0)
    # occlusion: how far a pixel sits below its blurred surroundings
    hb = np.asarray(Image.fromarray(height.astype(np.float32), mode='F').resize((S // 16, S // 16), Image.BILINEAR).resize((S, S), Image.BICUBIC))
    ao = np.clip(1.0 - (hb - height) * 2.4, 0.25, 1.0)
    # normal from height (wrapping), strength in metres of relief
    relief = 0.025
    px_m = tile_m / S
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * relief / (2 * px_m)
    gy = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) * relief / (2 * px_m)  # image rows run downwards
    nz = 1.0 / np.sqrt(gx * gx + gy * gy + 1.0)
    nx, ny = -gx * nz, -gy * nz

    def down(a):
        return np.asarray(Image.fromarray(a.astype(np.float32), mode='F').resize((size, size), Image.LANCZOS))

    alb8 = np.clip(np.stack([down(alb[..., c] ** (1 / 2.2)) for c in range(3)], -1) * 255 + 0.5, 0, 255).astype(np.uint8)
    return alb8, [np.clip(down(nx) * 0.5 + 0.5, 0, 1), np.clip(down(ny) * 0.5 + 0.5, 0, 1), np.clip(down(rough), 0, 1), np.clip(down(ao), 0, 1), np.clip(down(height), 0, 1)]


def webp_uri(im, q):
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii'), len(buf.getvalue())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'sa_pbr_cache'))
    ap.add_argument('--size', type=int, default=512)
    ap.add_argument('--preview', default=None, help='write a contact sheet of every layer here')
    args = ap.parse_args()
    S = args.size
    os.makedirs(args.cache, exist_ok=True)
    out_layers, credits, previews = [], [], []
    total = 0
    for key, pid, kind, tile, opt in LAYERS:
        if pid:
            info, p = fetch_layer(pid, args.cache)
            alb = load(p['diff'], S, 'RGB')
            nrm = np.asarray(load(p['nor_gl'], S, 'RGB'), np.float32) / 255.0
            if p.get('arm'):
                arm = np.asarray(load(p['arm'], S, 'RGB'), np.float32) / 255.0
                ao, rough = arm[..., 0], arm[..., 1]
            else:
                ao = np.asarray(load(p['ao'], S, 'L'), np.float32) / 255.0 if p.get('ao') else np.ones((S, S), np.float32)
                rough = np.asarray(load(p['rough'], S, 'L'), np.float32) / 255.0 if p.get('rough') else np.full((S, S), 0.8, np.float32)
            height = stretch(np.asarray(load(p['disp'], S, 'L'), np.float32) / 255.0) if p.get('disp') else 1.0 - stretch(1.0 - ao)
            dims = info.get('dimensions') or [2000, 2000]
            size_m = tile or (round(dims[0] / 1000.0, 3), round(dims[1] / 1000.0, 3))
            authors = ', '.join(sorted((info.get('authors') or {}).keys()))
            credits.append({'layer': key, 'source': 'Poly Haven', 'id': pid, 'name': info.get('name', pid), 'authors': authors,
                            'url': 'https://polyhaven.com/a/' + pid, 'license': 'CC0 1.0'})
            alb8 = np.asarray(alb, np.uint8)
            maps = [nrm[..., 0], nrm[..., 1], rough, ao, height]
        else:
            alb8, maps = gen_flint(S)
            size_m = tile
            credits.append({'layer': key, 'source': 'generated by tools/fetch_textures.py', 'id': key, 'name': 'Knapped flint in lime mortar',
                            'authors': 'this project', 'url': '', 'license': 'CC0 1.0'})
        # mean albedo in linear light, for recolouring
        mean = srgb_to_linear(alb8.reshape(-1, 3).astype(np.float64)).mean(0)
        # store bottom-up: texture row 0 is the image's bottom row
        alb_img = Image.fromarray(np.ascontiguousarray(alb8[::-1]), 'RGB')
        named = {'nx': maps[0], 'ny': maps[1], 'h': maps[4]}
        tiles = ['nx', 'ny', 'h'] if opt['nrm'] == 'map' else ['h']
        strip = np.concatenate([np.clip(named[t][::-1] * 255 + 0.5, 0, 255).astype(np.uint8) for t in tiles], 1)
        strip_img = Image.fromarray(np.ascontiguousarray(strip), 'L').convert('RGB')
        c_uri, c_n = webp_uri(alb_img, 80)
        d_uri, d_n = webp_uri(strip_img, 74)
        total += c_n + d_n
        out_layers.append({'key': key, 'kind': kind, 'size': [float(size_m[0]), float(size_m[1])], 'mean': [round(float(v), 4) for v in mean],
                           't': tiles, 'relief': opt['nrm'] if opt['nrm'] != 'map' else 0, 'rough': list(opt['rough']), 'ao': opt['ao'],
                           'ns': opt['ns'], 'k': opt['k'], 'c': c_uri, 'd': d_uri})
        print(f'{key:15s} {str(pid):24s} {size_m[0]:.2f} x {size_m[1]:.2f} m  albedo {c_n // 1024} KB  data {d_n // 1024} KB', flush=True)
        if args.preview:
            tile_img = Image.new('RGB', (S * 6, S))
            tile_img.paste(alb_img.transpose(Image.FLIP_TOP_BOTTOM), (0, 0))
            for i in range(len(tiles)):
                tile_img.paste(Image.fromarray(strip[:, i * S:(i + 1) * S][::-1], 'L').convert('RGB'), (S * (i + 1), 0))
            previews.append(tile_img.resize((S * 6 // 4, S // 4)))
    js = ('/* Surface textures: CC0 scans from Poly Haven plus generated flint. Built by tools/fetch_textures.py;\n'
          '   do not edit by hand. Credits and licences: docs/ASSETS.md. */\n'
          'window.SA_PBR = ' + json.dumps({'size': S, 'layers': out_layers, 'credits': credits}, separators=(',', ':')) + ';\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    print(f'wrote {os.path.relpath(OUT)}: {len(out_layers)} layers, images {total / 1048576:.2f} MB, file {len(js) / 1048576:.2f} MB')
    if args.preview and previews:
        sheet = Image.new('RGB', (previews[0].width, previews[0].height * len(previews)))
        for i, p in enumerate(previews):
            sheet.paste(p, (0, i * p.height))
        sheet.save(args.preview, quality=88)


if __name__ == '__main__':
    sys.exit(main())
