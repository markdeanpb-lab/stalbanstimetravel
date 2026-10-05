#!/usr/bin/env python3
"""
Build-time map pipeline (developer only): converts the cached OpenStreetMap
extract (tools/data/district.osm.gz, (c) OpenStreetMap contributors, ODbL 1.0)
and the terrain sample grid (tools/data/elev_grid.json, derived from the
Mapzen/AWS "Terrarium" terrain tiles) into game/js/data/mapdata.js.

Local coordinates: metres, origin at the Clock Tower, x = east, y = north.
The game maps (x, y) -> three.js (x, height, -y).

Requires: python3, shapely, numpy, (matplotlib for the debug plot).
"""
import gzip, json, math, os, sys
import xml.etree.ElementTree as ET
from shapely.geometry import Polygon, LineString, Point, MultiPolygon
from shapely.ops import unary_union
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'game', 'js', 'data', 'mapdata.js')

LAT0, LON0 = 51.7513076, -0.3404883  # The Clock Tower (OSM way 43055173)


def xy(lat, lon):
    return ((lon - LON0) * 111320 * math.cos(math.radians(LAT0)), (lat - LAT0) * 110540)


# ---------------------------------------------------------------- parse OSM
root = ET.parse(gzip.open(os.path.join(HERE, 'data', 'district.osm.gz'))).getroot()
nodes, ntags = {}, {}
for n in root.findall('node'):
    nodes[n.get('id')] = xy(float(n.get('lat')), float(n.get('lon')))
    tg = {c.get('k'): c.get('v') for c in n.findall('tag')}
    if tg:
        ntags[n.get('id')] = tg
ways = {}
for w in root.findall('way'):
    nds = [nd.get('ref') for nd in w.findall('nd')]
    tg = {c.get('k'): c.get('v') for c in w.findall('tag')}
    ways[w.get('id')] = (nds, tg)


def way_pts(wid):
    nds, _ = ways[wid]
    return [nodes[i] for i in nds if i in nodes]


# ---------------------------------------------------------------- district definition
# Streets that make up the playable district: (name, half-width to frontage, clip polygon or None)
# Half-widths deliberately reach the building frontages; buildings are solid anyway.
STREETS = {
    'High Street': 8.0, 'George Street': 6.5, 'French Row': 3.5, 'Market Place': 6.5,
    'Chequer Street': 8.0, "St Peter's Street": 26.0, 'Upper Dagnall Street': 5.0,
    'Romeland': 9.0, 'Romeland Hill': 7.0, 'Waxhouse Gate': 3.0, 'Boot Alley': 1.6,
    'Pudding Lane': 1.6, 'Lamb Alley': 1.6, 'Christopher Place': 5.0, 'Half Moon Yard': 2.0,
    'Verulam Road': 8.0, 'Victoria Street': 6.5, 'London Road': 8.5, 'Holywell Hill': 8.5,
    'Abbey Mill Lane': 6.0, 'Heritage Close': 3.0, 'Village Arcade': 2.0,
}
# Clip box per street (xmin, ymin, xmax, ymax) to stop corridors at the district edge
CLIP = {
    "St Peter's Street": (60, 90, 260, 262),
    'Verulam Road': (-80, -5, -20, 132),
    'Victoria Street': (100, 60, 172, 120),
    'London Road': (40, -80, 96, -40),
    'Holywell Hill': (10, -96, 60, -40),
    'Abbey Mill Lane': (-300, -62, -200, 0),
    'Romeland Hill': (-262, 20, -150, 60),
    'Half Moon Yard': (60, -20, 100, 20),
    'Waxhouse Gate': (-80, -160, 0, -20),
    'Market Place': (-10, -30, 140, 140),
    'Heritage Close': (-60, -60, -20, -10),
}
# Extra open areas (hand-traced from the OSM plot): Cathedral west/north precinct, Market Cross,
# Christopher Place block (2026 shopping centre / 1964 car park / 1897 yards), Town Hall square.
AREAS = {
    'cathedral_precinct': [(-292, -18), (-252, 6), (-200, 8), (-168, 28), (-120, 22), (-70, -8), (-40, -30),
                           (-20, -45), (-18, -70), (-40, -100), (-62, -150), (-75, -158), (-95, -150), (-150, -125),
                           (-200, -100), (-240, -86), (-275, -70), (-298, -50)],
    'christopher_block': [(-44, 22), (-44, 122), (60, 92), (40, 52), (20, 28), (0, 6), (-30, 10)],
    'market_cross': [(-12, -12), (-14, 8), (8, 12), (20, 4), (12, -16)],
    'town_hall_square': [(70, 85), (95, 125), (150, 125), (140, 92), (115, 85)],
}

# ---------------------------------------------------------------- highways
roads = []
for wid, (nds, tg) in ways.items():
    if 'highway' not in tg:
        continue
    pts = way_pts(wid)
    if len(pts) < 2:
        continue
    roads.append({'id': wid, 'name': tg.get('name', ''), 'type': tg['highway'], 'pts': pts,
                  'oneway': tg.get('oneway', 'no'), 'tags': tg})

corridors = []
for r in roads:
    if r['name'] in STREETS:
        ls = LineString(r['pts'])
        if r['name'] in CLIP:
            x0, y0, x1, y1 = CLIP[r['name']]
            ls = ls.intersection(Polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]))
            if ls.is_empty:
                continue
        corridors.append(ls.buffer(STREETS[r['name']], cap_style=2, join_style=1))
for name, pts in AREAS.items():
    corridors.append(Polygon(pts))
district = unary_union(corridors).buffer(1.0).buffer(-1.0)
if isinstance(district, MultiPolygon):
    district = max(district.geoms, key=lambda g: g.area)
district = Polygon(district.exterior).simplify(0.6)
print('district area m2', round(district.area), 'bounds', [round(v) for v in district.bounds])

# ---------------------------------------------------------------- buildings
VIEW = district.buffer(110)  # render buildings within 110 m of the district (backdrop)
buildings = []
for wid, (nds, tg) in ways.items():
    if 'building' not in tg and 'building:part' not in tg:
        continue
    if tg.get('building') in ('roof',) or tg.get('building') == 'no':
        continue
    pts = way_pts(wid)
    if len(pts) < 4:
        continue
    poly = Polygon(pts)
    if not poly.is_valid:
        poly = poly.buffer(0)
        if isinstance(poly, MultiPolygon):
            poly = max(poly.geoms, key=lambda g: g.area)
    if poly.area < 6:
        continue
    if not VIEW.intersects(poly):
        continue
    poly = poly.simplify(0.25)
    if poly.exterior.is_ccw is False:
        poly = Polygon(list(poly.exterior.coords)[::-1])
    coords = [(round(x, 2), round(y, 2)) for x, y in list(poly.exterior.coords)[:-1]]
    is_part = 'building:part' in tg and 'building' not in tg
    inside = district.buffer(25).intersects(poly)
    b = {
        'id': int(wid), 'p': coords, 'part': 1 if is_part else 0,
        'h': float(tg['height']) if 'height' in tg else None,
        'lv': int(float(tg['building:levels'])) if 'building:levels' in tg else None,
        'roof': tg.get('roof:shape'), 'kind': tg.get('building') or tg.get('building:part'),
        'near': 1 if inside else 0,
    }
    if 'name' in tg:
        b['name'] = tg['name']
    for k in ('amenity', 'shop', 'historic'):
        if k in tg:
            b[k] = tg[k]
    if 'addr:street' in tg:
        b['street'] = tg['addr:street']
    if 'addr:housenumber' in tg:
        b['no'] = tg['addr:housenumber']
    buildings.append(b)
print('buildings', len(buildings), 'near', sum(b['near'] for b in buildings))

# Building union for openings / collision checks
bpolys = [Polygon(b['p']) for b in buildings if not b['part']]
bunion = unary_union([p.buffer(0.3) for p in bpolys])

# Grow the district so street corridors reach the building frontages (up to 8 m), keeping only
# the free-space component that contains the Clock Tower square.
grown = district.union(district.buffer(8.0, join_style=2).difference(bunion))
grown = grown.buffer(0.5).buffer(-0.5)
if isinstance(grown, MultiPolygon):
    grown = max(grown.geoms, key=lambda g: g.area)
district = Polygon(grown.exterior).simplify(0.5)
print('grown district area m2', round(district.area))

# ---------------------------------------------------------------- openings (where barriers go)
edge = district.exterior
openings = edge.difference(bunion.buffer(0.6))
segs = []
geoms = getattr(openings, 'geoms', [openings])
for g in geoms:
    if g.length < 1.2:
        continue
    cs = list(g.coords)
    segs.append([(round(x, 2), round(y, 2)) for x, y in cs])
print('opening segments', len(segs), 'total length', round(sum(LineString(s).length for s in segs)))

# ---------------------------------------------------------------- roads for the game
KEEP_TYPES = {'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'pedestrian',
              'footway', 'steps', 'path', 'living_street'}
game_roads = []
for r in roads:
    if r['type'] not in KEEP_TYPES:
        continue
    ls = LineString(r['pts'])
    if not VIEW.intersects(ls):
        continue
    ls2 = ls.intersection(district.buffer(140))
    for g in getattr(ls2, 'geoms', [ls2]):
        if g.is_empty or g.length < 2 or g.geom_type != 'LineString':
            continue
        g = g.simplify(0.3)
        game_roads.append({'n': r['name'], 't': r['type'], 'ow': 1 if r['oneway'] == 'yes' else 0,
                           'p': [(round(x, 2), round(y, 2)) for x, y in g.coords]})
print('roads', len(game_roads))

# ---------------------------------------------------------------- point features (for reference/props)
feats = []
for nid, tg in ntags.items():
    if nid not in nodes:
        continue
    x, y = nodes[nid]
    if not district.buffer(15).contains(Point(x, y)):
        continue
    kind = None
    for k in ('highway', 'amenity', 'historic', 'man_made', 'natural', 'barrier', 'tourism'):
        if k in tg:
            kind = k + '=' + tg[k]
            break
    if kind and kind.split('=')[1] in ('street_lamp', 'bench', 'post_box', 'telephone', 'waste_basket', 'tree',
                                        'bollard', 'crossing', 'traffic_signals', 'bus_stop', 'drinking_water',
                                        'memorial', 'bicycle_parking', 'clock', 'fountain', 'information',
                                        'give_way', 'stop'):
        feats.append({'k': kind, 'x': round(x, 2), 'y': round(y, 2), 'n': tg.get('name', '')})
print('features', len(feats))

# ---------------------------------------------------------------- green / special areas
areas = []
for wid, (nds, tg) in ways.items():
    if 'building' in tg:
        continue
    kind = None
    if tg.get('leisure') in ('park', 'garden') or tg.get('landuse') in ('grass', 'recreation_ground') \
            or tg.get('natural') in ('grassland',) or tg.get('amenity') == 'grave_yard':
        kind = 'grass'
    elif tg.get('amenity') == 'parking':
        kind = 'parking'
    if not kind:
        continue
    pts = way_pts(wid)
    if len(pts) < 4:
        continue
    poly = Polygon(pts)
    if not poly.is_valid:
        poly = poly.buffer(0)
    if not VIEW.intersects(poly):
        continue
    poly = poly.intersection(district.buffer(140))
    for g in getattr(poly, 'geoms', [poly]):
        if g.is_empty or g.geom_type != 'Polygon' or g.area < 20:
            continue
        g = g.simplify(0.5)
        areas.append({'k': kind, 'n': tg.get('name', ''),
                      'p': [(round(x, 1), round(y, 1)) for x, y in list(g.exterior.coords)[:-1]]})
print('areas', len(areas))

# ---------------------------------------------------------------- terrain
eg = json.load(open(os.path.join(HERE, 'data', 'elev_grid.json')))
H = np.array(eg['h'], dtype=float)
# light smoothing (3x3 binomial) to remove tile quantisation noise
k = np.array([[1, 2, 1], [2, 4, 2], [1, 2, 1]], dtype=float) / 16
Hp = np.pad(H, 1, mode='edge')
Hs = sum(k[i, j] * Hp[i:i + H.shape[0], j:j + H.shape[1]] for i in range(3) for j in range(3))
terrain = {'x0': eg['x0'], 'y0': eg['y0'], 'step': eg['step'], 'nx': eg['nx'], 'ny': eg['ny'],
           'base': 100.0, 'h': [round(v - 100.0, 2) for row in Hs for v in row]}

# ---------------------------------------------------------------- write
data = {
    'meta': {
        'origin': {'lat': LAT0, 'lon': LON0, 'what': 'The Clock Tower, St Albans'},
        'attribution': 'Street and building data (c) OpenStreetMap contributors, ODbL 1.0 '
                       '(https://www.openstreetmap.org/copyright). Terrain from Mapzen/AWS Terrain Tiles '
                       '(includes UK Environment Agency LIDAR, OGL; SRTM).',
        'units': 'metres; x east, y north',
    },
    'district': [(round(x, 2), round(y, 2)) for x, y in list(district.exterior.coords)[:-1]],
    'openings': segs,
    'roads': game_roads,
    'buildings': buildings,
    'areas': areas,
    'features': feats,
    'terrain': terrain,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    f.write('/* Generated by tools/build_map.py. Map data (c) OpenStreetMap contributors, ODbL 1.0. */\n')
    f.write('window.SA_MAP = ')
    json.dump(data, f, separators=(',', ':'))
    f.write(';\n')
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')

# ---------------------------------------------------------------- debug plot
if '--plot' in sys.argv:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as MPoly
    fig, ax = plt.subplots(figsize=(18, 18))
    for a in areas:
        ax.add_patch(MPoly(a['p'], closed=True, fc='#bfb' if a['k'] == 'grass' else '#ddd', ec='none'))
    ax.add_patch(MPoly(list(district.exterior.coords), closed=True, fc='#ffe9c0', ec='#c80', lw=1.5, alpha=0.6))
    for b in buildings:
        ax.add_patch(MPoly(b['p'], closed=True, fc='#c49a6c' if b['near'] else '#ddd', ec='#553', lw=0.4))
    for r in game_roads:
        xs = [p[0] for p in r['p']]; ys = [p[1] for p in r['p']]
        ax.plot(xs, ys, color='#d33' if r['t'] in ('primary', 'secondary') else '#555', lw=1)
    for s in segs:
        ax.plot([p[0] for p in s], [p[1] for p in s], color='#00f', lw=3)
    for ft in feats:
        ax.plot(ft['x'], ft['y'], 'k.', ms=2)
    ax.set_xlim(-340, 300); ax.set_ylim(-220, 320); ax.set_aspect('equal'); ax.grid(True, lw=0.3)
    plt.savefig(sys.argv[sys.argv.index('--plot') + 1], dpi=80, bbox_inches='tight')
    print('plot written')
