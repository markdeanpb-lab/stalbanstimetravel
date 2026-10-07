#!/usr/bin/env python3
"""
LAST SPACE: ST ALBANS - map pipeline (developer only, no third-party packages).

Reads the cached OpenStreetMap extract tools/data/stalbans_grange.osm.gz
((c) OpenStreetMap contributors, ODbL 1.0; fetched 2026-10-07 from
api.openstreetmap.org, bbox -0.3440,51.7540,-0.3330,51.7600) and writes
js/data/mapdata.js: street centrelines, junctions and traffic-calming points
in local metres.

Local coordinates: metres, x = east, y = north, origin at 51.7568 N, 0.3375 W
(roughly the middle of the Bernard Street / Grange Street block).
The game maps (x, y) -> three.js (x, height, -y).
"""
import gzip, json, math, os
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'js', 'data', 'mapdata.js')
LAT0, LON0 = 51.7568, -0.3375


def xy(lat, lon):
    return ((lon - LON0) * 111320 * math.cos(math.radians(LAT0)), (lat - LAT0) * 110540)


root = ET.parse(gzip.open(os.path.join(HERE, 'data', 'stalbans_grange.osm.gz'))).getroot()
nodes, ntags = {}, {}
for n in root.findall('node'):
    nodes[n.get('id')] = xy(float(n.get('lat')), float(n.get('lon')))
    tg = {c.get('k'): c.get('v') for c in n.findall('tag')}
    if tg:
        ntags[n.get('id')] = tg
ways = {}
for w in root.findall('way'):
    ways[w.get('id')] = ([nd.get('ref') for nd in w.findall('nd')], {c.get('k'): c.get('v') for c in w.findall('tag')})


def chain(ids):
    """Concatenate ways (in the given order, reversing where needed) into one node list."""
    out = []
    for wid in ids:
        nds = list(ways[wid][0])
        if out:
            if nds[-1] == out[-1]:
                nds.reverse()
            elif nds[0] != out[-1]:
                if nds[0] == out[0] or nds[-1] == out[0]:
                    out.reverse()
                    if nds[-1] == out[-1]:
                        nds.reverse()
            assert nds[0] == out[-1], (wid, 'does not join')
            nds = nds[1:]
        out += nds
    return out


def pts(nds):
    return [nodes[i] for i in nds]


def clip_by_length(p, start, end):
    """Clip a polyline to arclength [start, end] (negative end counts from the far end)."""
    seg = [math.dist(p[i], p[i + 1]) for i in range(len(p) - 1)]
    L = sum(seg)
    if end is None:
        end = L
    if end < 0:
        end = L + end
    out, s = [], 0.0
    for i in range(len(p) - 1):
        a, b, l = p[i], p[i + 1], seg[i]
        for t in (start, end):
            pass
        if s + l >= start and s <= end:
            t0 = max(0.0, (start - s) / l)
            t1 = min(1.0, (end - s) / l)
            pa = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            pb = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            if not out or math.dist(out[-1], pa) > 0.05:
                out.append(pa)
            out.append(pb)
        s += l
    return out, L


def extend(p, metres, at_start):
    """Extend a polyline straight past one end (for road-closed stubs)."""
    if at_start:
        a, b = p[0], p[1]
    else:
        a, b = p[-1], p[-2]
    d = math.dist(a, b)
    ux, uy = (a[0] - b[0]) / d, (a[1] - b[1]) / d
    q = (a[0] + ux * metres, a[1] + uy * metres)
    return [q] + p if at_start else p + [q]


def simplify(p, tol=0.4):
    """Douglas-Peucker."""
    if len(p) < 3:
        return p
    a, b = p[0], p[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-9
    best, bi = -1, 0
    for i in range(1, len(p) - 1):
        d = abs((p[i][0] - a[0]) * dy - (p[i][1] - a[1]) * dx) / L
        if d > best:
            best, bi = d, i
    if best < tol:
        return [a, b]
    return simplify(p[:bi + 1], tol)[:-1] + simplify(p[bi:], tol)


# ------------------------------------------------------------------ streets
# OSM way ids (checked against tags: name, highway, oneway; see README / docs/GEOGRAPHY.md)
DALTON = ['151687980']                                   # Catherine St -> Grange St, two-way
BERNARD = ['1230246222', '1230246221', '151687985']      # Catherine St -> Grange St, one-way northbound above Church St
CHURCH = ['151687982', '1230246220']                    # Grange St -> foot of Bernard St, one-way that way
GRANGE = ['151687981']                                   # St Peter's St (SE) -> NW past Dalton St
CATHERINE = ['944862658', '3997174']                     # west -> east (primary road)

for group in (DALTON, BERNARD, CHURCH, GRANGE, CATHERINE):
    for wid in group:
        assert wid in ways, wid

streets = {}
streets['Dalton Street'] = dict(osm=DALTON, oneway=None, pts=pts(chain(DALTON)))
streets['Bernard Street'] = dict(osm=BERNARD, oneway='north from Church Street', pts=pts(chain(BERNARD)))
streets['Church Street'] = dict(osm=CHURCH, oneway='west from Grange Street', pts=pts(chain(CHURCH)))

g = pts(chain(GRANGE))  # from St Peter's Street (SE end) to the NW
# keep from ~95 m before Church Street junction... the stub towards St Peter's Street is closed for works in game
g_clip, gL = clip_by_length(g, 55.0, None)
streets['Grange Street'] = dict(osm=GRANGE, oneway=None, pts=g_clip)

c = pts(chain(CATHERINE))
# Catherine Street: keep the stretch between ~35 m west of Dalton Street and ~40 m east of Bernard Street
cL = sum(math.dist(c[i], c[i + 1]) for i in range(len(c) - 1))
# find arclength of Dalton & Bernard junctions on Catherine
def arclen_of(p, q):
    s, best, bs = 0, 1e9, 0
    for i in range(len(p) - 1):
        a, b = p[i], p[i + 1]
        l = math.dist(a, b)
        dx, dy = b[0] - a[0], b[1] - a[1]
        t = max(0, min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (l * l)))
        pp = (a[0] + dx * t, a[1] + dy * t)
        d = math.dist(pp, q)
        if d < best:
            best, bs = d, s + t * l
        s += l
    return bs, best
sD, eD = arclen_of(c, streets['Dalton Street']['pts'][0])
sB, eB = arclen_of(c, streets['Bernard Street']['pts'][0])
assert eD < 1.0 and eB < 1.0, (eD, eB)
c_clip, _ = clip_by_length(c, sD - 34.0, sB + 30.0)
streets['Catherine Street'] = dict(osm=CATHERINE, oneway=None, pts=c_clip)

# road-closed stubs get a few metres of straight extension beyond the barrier so the
# corridor does not end in a rounded cap right at the barrier
streets['Grange Street']['pts'] = extend(streets['Grange Street']['pts'], 6.0, True)
streets['Grange Street']['pts'] = extend(streets['Grange Street']['pts'], 6.0, False)
streets['Catherine Street']['pts'] = extend(streets['Catherine Street']['pts'], 6.0, True)
streets['Catherine Street']['pts'] = extend(streets['Catherine Street']['pts'], 6.0, False)

for k, s in streets.items():
    s['pts'] = [(round(x, 2), round(y, 2)) for x, y in simplify(s['pts'], 0.35)]

# ------------------------------------------------------------------ junctions (shared OSM nodes)
def node_of(wid_list, first):
    nds = chain(wid_list)
    return nds[0] if first else nds[-1]

junctions = []
def junction(name, a, b, nid):
    x, y = nodes[nid]
    junctions.append(dict(name=name, streets=[a, b], osmNode=nid, x=round(x, 2), y=round(y, 2)))

junction('Dalton/Catherine', 'Dalton Street', 'Catherine Street', node_of(DALTON, True))
junction('Dalton/Grange', 'Dalton Street', 'Grange Street', node_of(DALTON, False))
junction('Bernard/Catherine', 'Bernard Street', 'Catherine Street', node_of(BERNARD, True))
junction('Bernard/Grange', 'Bernard Street', 'Grange Street', node_of(BERNARD, False))
junction('Church/Grange', 'Church Street', 'Grange Street', node_of(CHURCH, True))
junction('Church/Bernard', 'Church Street', 'Bernard Street', node_of(CHURCH, False))
for j in junctions:
    for s in j['streets']:
        assert j['osmNode'] in chain({'Dalton Street': DALTON, 'Bernard Street': BERNARD, 'Church Street': CHURCH,
                                      'Grange Street': GRANGE, 'Catherine Street': CATHERINE}[s]), (j['name'], s)

# ------------------------------------------------------------------ points of interest
pois = []
for nid, t in ntags.items():
    x, y = nodes[nid]
    if not (-170 < x < 190 and -110 < y < 240):
        continue
    if t.get('traffic_calming'):
        pois.append(dict(kind=t['traffic_calming'], osmNode=nid, x=round(x, 2), y=round(y, 2)))
    elif t.get('amenity') == 'post_box':
        pois.append(dict(kind='post_box', osmNode=nid, x=round(x, 2), y=round(y, 2), ref=t.get('ref')))
    elif t.get('highway') == 'give_way':
        pois.append(dict(kind='give_way', osmNode=nid, x=round(x, 2), y=round(y, 2)))

# residents' car park in the Bernard/Grange/Church block (OSM way 167866271) and its driveway (167866262)
carpark = [(round(x, 2), round(y, 2)) for x, y in pts(ways['167866271'][0])][:-1]
drive = [(round(x, 2), round(y, 2)) for x, y in pts(ways['167866262'][0])]

# named buildings used for landmarks
landmarks = []
for wid, (nds, t) in ways.items():
    if 'building' in t and t.get('name') in ('Jubilee Centre',):
        p = pts(nds)
        landmarks.append(dict(name=t['name'], osmWay=wid, poly=[(round(x, 2), round(y, 2)) for x, y in p[:-1]]))

data = dict(
    source='OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright). Extract fetched 2026-10-07.',
    origin=dict(lat=LAT0, lon=LON0),
    streets=[dict(name=k, **v) for k, v in streets.items()],
    junctions=junctions, pois=pois, carpark=carpark, carparkDrive=drive, landmarks=landmarks,
)
with open(OUT, 'w') as f:
    f.write('/* Generated by tools/build_map.py from OpenStreetMap data (c) OpenStreetMap contributors, ODbL 1.0. Do not edit by hand. */\n')
    f.write('window.LS = window.LS || {};\nLS.MAPDATA = ')
    json.dump(data, f, separators=(',', ':'))
    f.write(';\n')
print('wrote', OUT)
for s in data['streets']:
    L = sum(math.dist(s['pts'][i], s['pts'][i + 1]) for i in range(len(s['pts']) - 1))
    print('%-17s %3d pts  %5.1f m  %s -> %s' % (s['name'], len(s['pts']), L, s['pts'][0], s['pts'][-1]))
for j in junctions:
    print(j['name'], j['x'], j['y'])
for p in pois:
    print(p)
print('carpark', carpark, 'drive', drive)
