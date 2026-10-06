/* World: converts map data to game coordinates, resolves each building per era (style, storeys,
   shopfronts, signs), builds and switches the three era scenes, and answers spatial queries. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const W = (SA.World = { eras: {}, current: null });

  // ------------------------------------------------------------------ special buildings (OSM way ids)
  const ID = (W.ID = {
    clockTower: 43055173, townHall: 34760603, cathedral: 4099626, gateway: 145792150, peahen: 354421040,
    fleur: 163744617, christopherInn: 163983369, frenchRowTerrace: 163983371, pennick: 163982442,
    cornA: 353727733, cornB: 163744643, marketFork: 163982439, boot: 353727729, silverPalate: 163982440,
    christopherCentre: 163985255, christopherBig: 163985257, christopherNorth: 163983833,
    baptist: 164111061, solicitors: 163744641, waxArch: 164095789, teaRooms: 678106167, whiteSwan: 163983832, espresso: 353727724,
  });

  // ------------------------------------------------------------------ init
  W.init = function () {
    const M = window.SA_MAP;
    const g = (p) => [p[0], -p[1]];
    W.district = M.district.map(g);
    W.openings = M.openings.map((s) => s.map(g));
    W.roads = M.roads.map((r) => ({ n: r.n, t: r.t, ow: r.ow, p: r.p.map(g) }));
    W.areas = M.areas.map((a) => ({ k: a.k, n: a.n, p: a.p.map(g) }));
    W.features = M.features.map((f) => ({ k: f.k, n: f.n, x: f.x, z: -f.y }));
    W.rawBuildings = M.buildings.map((b) => Object.assign({}, b, { p: b.p.map(g) }));
    W.attribution = M.meta.attribution;
    SA.Terrain.init(M);
    // road segment index for nearest-road queries
    W.segs = [];
    for (const r of W.roads) {
      for (let i = 0; i < r.p.length - 1; i++) W.segs.push({ r, a: r.p[i], b: r.p[i + 1] });
    }
    W.distBounds = U.polyBounds(W.district);
    W.classify();
  };

  W.inDistrict = (x, z) => U.pointInPoly(x, z, W.district);
  W.nearestRoad = function (x, z, filter, maxD) {
    let best = null, bd = maxD || 1e9;
    for (const s of W.segs) {
      if (filter && !filter(s.r)) continue;
      const c = U.closestOnSeg(x, z, s.a[0], s.a[1], s.b[0], s.b[1]);
      const d = U.dist(x, z, c[0], c[1]);
      if (d < bd) {
        bd = d;
        best = { road: s.r, x: c[0], z: c[1], d, a: s.a, b: s.b, t: c[2] };
      }
    }
    return best;
  };
  W.inGrass = function (r) {
    const m = r.p[Math.floor(r.p.length / 2)];
    return W.areas.some((a) => a.k === 'grass' && U.pointInPoly(m[0], m[1], a.p));
  };

  // ------------------------------------------------------------------ zones
  const MAIN = ['High Street', 'George Street', 'French Row', 'Market Place', 'Chequer Street', "St Peter's Street", 'Upper Dagnall Street', 'Verulam Road',
    'Victoria Street', 'London Road', 'Holywell Hill', 'Romeland', 'Romeland Hill', 'Spencer Street', 'Waddington Road', 'Fishpool Street', 'Abbey Mill Lane', 'Christopher Place'];
  function zoneOf(b) {
    const c = U.polyCentroid(b.p);
    const nr = W.nearestRoad(c[0], c[1], (r) => MAIN.indexOf(r.n) >= 0, 45);
    if (!nr) return { zone: 'backdrop', side: 0 };
    const dx = nr.b[0] - nr.a[0], dz = nr.b[1] - nr.a[1];
    const cross = dx * (c[1] - nr.z) - dz * (c[0] - nr.x);
    const name = nr.road.n;
    const side = cross > 0 ? 1 : -1;
    let zone = 'backdrop';
    switch (name) {
      case 'George Street': zone = 'george'; break;
      case 'French Row': zone = 'frenchRow'; break;
      case 'Market Place': zone = 'market'; break;
      case 'Christopher Place': zone = 'christopher'; break;
      case 'High Street': zone = c[1] > nr.z ? 'highS' : 'highN'; break;
      case 'Chequer Street': zone = 'chequer'; break;
      case "St Peter's Street": zone = c[0] < nr.x ? 'stPetersW' : 'stPetersE'; break;
      case 'Victoria Street': zone = 'victoria'; break;
      case 'Verulam Road': zone = 'verulam'; break;
      case 'Romeland': case 'Romeland Hill': zone = 'romeland'; break;
      case 'Upper Dagnall Street': zone = 'dagnall'; break;
      case 'London Road': case 'Holywell Hill': zone = 'peahen'; break;
      default: zone = 'backdrop';
    }
    return { zone, side, road: name, dist: nr.d };
  }

  // Christopher Place block (2026 shopping centre; 1964 cleared car park; 1897 Gentle's Yard)
  W.CHRISTOPHER = [[-44, -22], [-44, -122], [60, -92], [40, -52], [20, -28], [4, -10], [-28, -10]];
  const CHRIS_IDS = new Set([ID.christopherCentre, ID.christopherBig, ID.christopherNorth]);
  // Heritage Close (1970s) on the High Street south side
  W.HERITAGE = [[-62, 18], [-20, 22], [-14, 62], [-60, 64]];

  W.classify = function () {
    const near = W.rawBuildings.filter((b) => !b.part);
    for (const b of W.rawBuildings) {
      b.z = zoneOf(b);
      b.cen = U.polyCentroid(b.p);
      b.area = Math.abs(U.polyArea(b.p));
      b.seed = (b.id % 100000) + 1;
      b.rng = U.rng(b.seed);
      b.inChris = U.pointInPoly(b.cen[0], b.cen[1], W.CHRISTOPHER) || CHRIS_IDS.has(b.id);
      b.inHeritage = U.pointInPoly(b.cen[0], b.cen[1], W.HERITAGE);
      // front / party edges
      b.fronts = [];
      b.party = {};
      const n = b.p.length;
      for (let i = 0; i < n; i++) {
        const a = b.p[i], c = b.p[(i + 1) % n];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 1.2) continue;
        const nrm = SA.Buildings.outwardNormal(b.p, i);
        const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
        // party wall: just outside is another building
        const px = mx + nrm[0] * 0.8, pz = mz + nrm[1] * 0.8;
        let party = false;
        for (const o of near) {
          if (o === b) continue;
          if (Math.abs(o.cenX - px) > 60) continue;
          if (U.pointInPoly(px, pz, o.p)) {
            party = true;
            break;
          }
        }
        if (party) {
          b.party[i] = true;
          continue;
        }
        // front: faces public space within a few metres
        const fx = mx + nrm[0] * 3.5, fz = mz + nrm[1] * 3.5;
        const inD = W.inDistrict(fx, fz);
        const rd = W.nearestRoad(fx, fz, null, 9);
        if ((inD && len > 2) || (rd && (rd.road.t !== 'service' || len > 6))) b.fronts.push(i);
      }
      b.cenX = b.cen[0];
      // best front: the longest front edge facing the main street
      b.mainFront = -1;
      let bl = 0;
      for (const i of b.fronts) {
        const a = b.p[i], c = b.p[(i + 1) % n];
        const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (l > bl) {
          bl = l;
          b.mainFront = i;
        }
      }
    }
  };

  // ------------------------------------------------------------------ plot subdivision
  // Clip polygon to the slab between two lines perpendicular to the front edge direction.
  function clipHalf(poly, nx, nz, d) {
    // keep points with (p . n) >= d
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = a[0] * nx + a[1] * nz - d, db = b[0] * nx + b[1] * nz - d;
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  function subdivide(b, plotW) {
    if (b.mainFront < 0) return [b.p];
    const n = b.p.length;
    const a = b.p[b.mainFront], c = b.p[(b.mainFront + 1) % n];
    let dx = c[0] - a[0], dz = c[1] - a[1];
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    // project all points on the front direction
    let lo = Infinity, hi = -Infinity;
    for (const p of b.p) {
      const t = p[0] * dx + p[1] * dz;
      if (t < lo) lo = t;
      if (t > hi) hi = t;
    }
    const total = hi - lo;
    const k = Math.max(1, Math.round(total / plotW));
    if (k < 2) return [b.p];
    const out = [];
    let t0 = lo;
    for (let i = 0; i < k; i++) {
      const w = total / k;
      const jitter = i < k - 1 ? (b.rng() - 0.5) * w * 0.35 : 0;
      const t1 = i === k - 1 ? hi + 0.01 : lo + w * (i + 1) + jitter;
      let q = clipHalf(b.p, dx, dz, t0);
      q = clipHalf(q, -dx, -dz, -t1);
      if (q.length >= 3 && Math.abs(U.polyArea(q)) > 8) out.push(q);
      t0 = t1;
    }
    return out.length ? out : [b.p];
  }

  // ------------------------------------------------------------------ era building specs
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function wallColor(era, kind, r) {
    const w = SA.ERAS[era].walls;
    return pick(r, w[kind] || w.brick);
  }
  const ROOF_TILE = ['#8a4a33', '#7c4130', '#94513a', '#6e3b2c', '#9a5a40'];
  const ROOF_SLATE = ['#4c5058', '#555a63', '#454950', '#5c5f66'];

  // Build a spec for one footprint in one era.
  function makeSpec(b, pts, era, sub, role) {
    const r = U.rng(b.seed * 31 + sub * 977 + era);
    const z = b.z.zone;
    const s = {
      key: b.id + ':' + sub, id: b.id, pts, seed: b.seed * 13 + sub, tag: 'building', role: role || null,
      fronts: [], party: {}, storeys: 2, gh: 3.4, sh: 2.9, extra: 0, bayW: 3.0, jetty: 0,
      wall: { type: 0, color: '#9a4b35' }, roof: { type: 'gable', mat: 0, color: pick(r, ROOF_TILE), pitch: 48, ridge: 'street' },
      upper: 'sash6', ground: 'house', door: null, signs: [], chimneys: 0, cornice: false, sideWindows: true, lit: 0.5,
    };
    // fronts: recompute for sub-polygons (edges parallel to main front & facing street)
    s.fronts = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 1.2) continue;
      const nrm = SA.Buildings.outwardNormal(pts, i);
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      const px = mx + nrm[0] * 0.8, pz = mz + nrm[1] * 0.8;
      // party with neighbours (other sub-plots or buildings)
      let party = false;
      for (const o of W.rawBuildings) {
        if (o.part || Math.abs(o.cen[0] - px) > 50 || Math.abs(o.cen[1] - pz) > 50) continue;
        if (o.id === b.id && sub >= 0 && pts !== b.p) {
          // sibling plot: inside original but not inside self
          if (U.pointInPoly(px, pz, b.p) && !U.pointInPoly(px, pz, pts)) party = true;
          continue;
        }
        if (o.id !== b.id && U.pointInPoly(px, pz, o.p)) {
          party = true;
          break;
        }
      }
      if (party) {
        s.party[i] = true;
        continue;
      }
      const fx = mx + nrm[0] * 3.5, fz = mz + nrm[1] * 3.5;
      const inD = W.inDistrict(fx, fz);
      const rd = W.nearestRoad(fx, fz, null, 9);
      if ((inD && len > 1.8) || (rd && (rd.road.t !== 'service' || len > 6))) s.fronts.push(i);
    }
    // order fronts: longest first
    s.fronts.sort((i, j) => {
      const li = Math.hypot(pts[(i + 1) % pts.length][0] - pts[i][0], pts[(i + 1) % pts.length][1] - pts[i][1]);
      const lj = Math.hypot(pts[(j + 1) % pts.length][0] - pts[j][0], pts[(j + 1) % pts.length][1] - pts[j][1]);
      return lj - li;
    });
    // heights from terrain
    let minH = Infinity;
    for (const p of pts) minH = Math.min(minH, SA.Terrain.height(p[0], p[1]));
    let fh = minH;
    if (s.fronts.length) {
      const i = s.fronts[0];
      const a = pts[i], c = pts[(i + 1) % pts.length];
      fh = SA.Terrain.height((a[0] + c[0]) / 2, (a[1] + c[1]) / 2);
    } else {
      const cc = U.polyCentroid(pts);
      fh = SA.Terrain.height(cc[0], cc[1]);
    }
    s.base = minH;
    s.floor = fh + 0.08;

    // ---------------- style by zone and era
    const old = r();
    let style = 'georgian';
    switch (z) {
      case 'george': case 'frenchRow': style = old < 0.7 ? 'medieval' : 'georgian'; break;
      case 'market': style = old < 0.45 ? 'medieval' : old < 0.75 ? 'georgian' : 'victorian'; break;
      case 'highN': case 'highS': style = old < 0.35 ? 'georgian' : old < 0.75 ? 'victorian' : 'medieval'; break;
      case 'chequer': case 'victoria': style = old < 0.7 ? 'victorian' : 'georgian'; break;
      case 'stPetersE': style = old < 0.65 ? 'georgian' : 'victorian'; break;
      case 'stPetersW': style = era === 2026 ? (old < 0.55 ? 'modern' : old < 0.8 ? 'neogeorgian' : 'victorian') : era === 1964 ? (old < 0.4 ? 'interwar' : old < 0.6 ? 'sixties' : 'georgian') : (old < 0.6 ? 'georgian' : 'victorian'); break;
      case 'verulam': case 'dagnall': case 'romeland': style = old < 0.6 ? 'georgian' : 'victorian'; break;
      case 'peahen': style = 'victorian'; break;
      case 'christopher': style = 'neomedieval'; break;
      default: style = old < 0.5 ? 'georgian' : 'victorian';
    }
    if (b.inChris && era === 2026) style = 'neomedieval';
    if (b.inHeritage) style = era === 2026 ? 'seventies' : era === 1964 ? 'edwardianStore' : 'victorian';
    if (b.id === ID.frenchRowTerrace && era !== 1897) style = 'midcentury';
    if (!b.near) style = r() < 0.6 ? 'backdrop' : 'backdropOld';
    s.style = style;

    // storeys
    let storeys = 2;
    if (z === 'highN' || z === 'highS' || z === 'chequer' || z === 'peahen') storeys = r() < 0.7 ? 3 : 2;
    else if (z === 'stPetersE' || z === 'stPetersW' || z === 'victoria') storeys = r() < 0.5 ? 3 : 2;
    else if (z === 'market' || z === 'frenchRow') storeys = r() < 0.45 ? 3 : 2;
    else if (z === 'george') storeys = r() < 0.2 ? 3 : 2;
    if (b.lv) storeys = Math.min(5, Math.max(1, b.lv));
    if (b.area < 25) storeys = Math.min(storeys, 2);
    s.storeys = storeys;

    const RF = (arr) => pick(r, arr);
    switch (style) {
      case 'medieval': {
        const timber = r() < 0.35;
        s.wall = { type: timber ? 1 : 1, color: wallColor(era, 'stucco', r) };
        if (timber) {
          s.upperWall = 1;
          s.upper = 'timberWin';
        } else s.upper = r() < 0.5 ? 'casement' : 'sash2';
        s.roof = { type: b.z.zone === 'frenchRow' || r() < 0.4 ? 'gable' : 'gable', mat: 0, color: RF(ROOF_TILE), pitch: 52 + r() * 6, ridge: r() < 0.35 ? 'gableToStreet' : 'street' };
        s.jetty = r() < 0.45 ? 0.45 : 0;
        s.sh = 2.6;
        s.gh = 3.1;
        s.chimneys = 1 + (r() < 0.5 ? 1 : 0);
        s.bayW = 2.6;
        break;
      }
      case 'georgian': {
        const stucco = r() < 0.35;
        s.wall = { type: stucco ? 1 : 0, color: stucco ? wallColor(era, 'stucco', r) : wallColor(era, 'brick', r) };
        s.upper = 'sash6';
        s.roof = r() < 0.5 ? { type: 'hip', mat: 1, color: RF(ROOF_SLATE), pitch: 34, ridge: 'street' } : { type: 'gable', mat: 0, color: RF(ROOF_TILE), pitch: 45, ridge: 'street' };
        s.cornice = true;
        s.extra = 0.6;
        s.sh = 3.0;
        s.chimneys = 2;
        s.bayW = 2.9;
        break;
      }
      case 'victorian': {
        const stock = r() < 0.25;
        s.wall = { type: stock ? 3 : 0, color: stock ? wallColor(era, 'stock', r) : wallColor(era, 'brick', r) };
        s.upper = r() < 0.7 ? 'sash2' : 'arched';
        s.roof = { type: r() < 0.6 ? 'gable' : 'hip', mat: 1, color: RF(ROOF_SLATE), pitch: 38, ridge: 'street' };
        s.cornice = r() < 0.5;
        s.corniceColor = '#d8d0bf';
        s.sh = 3.2;
        s.gh = 3.7;
        s.chimneys = 2;
        s.bayW = 3.1;
        break;
      }
      case 'neogeorgian': {
        s.wall = { type: 0, color: wallColor(era, 'brick', r) };
        s.upper = 'sash6';
        s.roof = { type: 'flat', mat: 2, color: '#666', flatColor: '#6a6660' };
        s.parapetH = 1.0;
        s.cornice = true;
        s.sh = 3.4;
        s.gh = 4.2;
        s.bayW = 3.2;
        break;
      }
      case 'modern': {
        s.wall = { type: 4, color: RF(['#d9d4c8', '#cfc6b4', '#b9b2a6', '#e4dfd3', '#a9604a']) };
        s.upper = RF(['modern', 'band60', 'modern']);
        s.roof = { type: 'flat', mat: 2, color: '#666', flatColor: '#5d5a56' };
        s.gh = 4.4;
        s.sh = 3.4;
        s.bayW = 3.6;
        s.sideWindows = false;
        break;
      }
      case 'interwar': {
        s.wall = { type: r() < 0.5 ? 0 : 4, color: r() < 0.5 ? wallColor(era, 'brick', r) : '#e2dccb' };
        s.upper = r() < 0.5 ? 'sash6' : 'modern';
        s.roof = { type: 'flat', mat: 2, color: '#666', flatColor: '#615e58' };
        s.parapetH = 0.9;
        s.cornice = true;
        s.gh = 4.2;
        s.sh = 3.3;
        s.bayW = 3.3;
        break;
      }
      case 'sixties': case 'midcentury': {
        s.wall = { type: r() < 0.5 ? 4 : 0, color: r() < 0.5 ? '#d8d2c2' : wallColor(era, 'brick', r) };
        s.upper = 'band60';
        s.roof = { type: 'flat', mat: 2, color: '#666', flatColor: '#5f5c58' };
        s.parapetH = 0.4;
        s.gh = 3.9;
        s.sh = 3.0;
        s.bayW = 3.2;
        s.sideWindows = false;
        break;
      }
      case 'seventies': {
        s.wall = { type: 0, color: '#7d4a3a' };
        s.upper = 'modern';
        s.roof = { type: 'band', mat: 1, color: '#4b4f55', pitch: 40 };
        s.gh = 3.6;
        s.sh = 2.9;
        break;
      }
      case 'edwardianStore': {
        s.wall = { type: 0, color: '#9a4f3a' };
        s.upper = 'arched';
        s.roof = { type: 'band', mat: 1, color: '#4b4f55', pitch: 38 };
        s.cornice = true;
        s.gh = 4.4;
        s.sh = 3.4;
        s.storeys = 3;
        break;
      }
      case 'neomedieval': {
        s.wall = { type: 1, color: '#efebe2' };
        s.upper = r() < 0.5 ? 'casement' : 'timberWin';
        s.upperWall = 1;
        s.roof = { type: 'band', mat: 1, color: RF(ROOF_SLATE), pitch: 45 };
        s.gh = 3.6;
        s.sh = 2.9;
        s.storeys = Math.max(2, Math.min(3, s.storeys));
        break;
      }
      case 'backdrop': case 'backdropOld': {
        const stucco = r() < 0.3;
        s.wall = { type: stucco ? 1 : 0, color: stucco ? wallColor(era, 'stucco', r) : wallColor(era, 'brick', r) };
        s.upper = style === 'backdropOld' ? 'casement' : 'sash2';
        s.roof = { type: r() < 0.7 ? 'gable' : 'hip', mat: r() < 0.5 ? 0 : 1, color: r() < 0.5 ? RF(ROOF_TILE) : RF(ROOF_SLATE), pitch: 42, ridge: 'street' };
        s.ground = 'house';
        s.chimneys = 1;
        s.sideWindows = false;
        break;
      }
    }
    // roof form fallback for irregular footprints
    const o = U.obb(pts);
    const rect = Math.abs(U.polyArea(pts)) / (o.len * o.wid);
    if ((s.roof.type === 'gable' || s.roof.type === 'hip') && rect < 0.84) s.roof.type = 'band';
    if (s.roof.type === 'gable' && Math.min(o.len, o.wid) > 16) s.roof.type = 'band';
    if (b.h) {
      // OSM height: derive storeys
      s.storeys = Math.max(1, Math.round((b.h - 2) / 3));
    }

    // ---------------- ground floor (shopfronts) by era & zone
    const commercial = ['george', 'frenchRow', 'market', 'highN', 'highS', 'chequer', 'stPetersE', 'stPetersW', 'victoria', 'peahen', 'christopher'].indexOf(z) >= 0 && b.near;
    if (commercial && s.fronts.length) {
      const kind = b.amenity === 'pub' || b.amenity === 'bar' ? 'pub' : b.amenity === 'bank' ? 'bank' : b.amenity === 'restaurant' || b.amenity === 'cafe' || b.amenity === 'fast_food' ? 'food' : 'shop';
      s.kind = kind;
      if (era === 1897) {
        s.ground = kind === 'pub' ? 'pub' : r() < 0.14 ? 'house' : RF(['shopGreen', 'shopMaroon', 'shopNavy', 'shopBlack', 'shopGreen']);
        if (z === 'stPetersE' && r() < 0.4) s.ground = r() < 0.5 ? 'doorGeorgian' : 'house';
      } else if (era === 1964) {
        s.ground = kind === 'pub' ? 'pub' : kind === 'bank' ? 'bank' : RF(['shop60a', 'shop60b', 'shop60a', 'shopGreen', 'shopMaroon', 'shopNavy']);
      } else {
        s.ground = kind === 'pub' ? 'pub' : kind === 'bank' ? 'bank' : RF(['shopMod', 'shopModB', 'shopGreen', 'shopNavy', 'shopBlack', 'shopMod', 'shopMaroon']);
      }
      if (style === 'modern' || style === 'sixties' || style === 'seventies') s.ground = era === 2026 ? RF(['shopMod', 'shopModB']) : 'shop60b';
      if (style === 'neomedieval') s.ground = RF(['shopMod', 'shopGreen', 'shopNavy', 'shopBlack']);
      // signage
      s.wantsSign = s.ground !== 'house' && s.ground !== 'doorGeorgian';
      s.signKind = kind;
    } else {
      s.ground = s.fronts.length ? (r() < 0.5 ? 'house' : 'doorGeorgian') : 'blank';
      if (style === 'modern' || style === 'sixties') s.ground = 'shutter';
      if (!b.near) s.ground = 'house';
    }
    if (s.storeys === 1) {
      s.upper = 'blank';
    }
    // 1897 shops sometimes have the family living above: more lit windows at night
    s.lit = 0.5;
    return s;
  }

  // Overrides for named/story buildings
  function applyOverrides(s, b, era, flags) {
    const id = b.id;
    if (id === ID.pennick) {
      s.ground = era === 1897 ? 'shopNavy' : era === 1964 ? 'shopMaroon' : 'shopBlack';
      s.wantsSign = true;
      s.role = 'pennick';
      s.storeys = 2;
      s.jetty = 0.4;
      s.wall = { type: 1, color: '#ece2cc' };
      s.upper = 'casement';
      // outcome variants drive the shopfront colour
      if (era !== 1897 && flags) {
        if (flags.fund_outcome === 'returned') s.ground = era === 2026 ? 'shopGreen' : 'shopGreen';
        if (flags.fund_outcome === 'dinner') s.ground = era === 2026 ? 'shopMaroon' : 'shop60a';
      }
    }
    if (id === ID.fleur) {
      s.wall = { type: 0, color: '#8e4a36' };
      s.upper = 'sash6';
      s.ground = 'pub';
      s.cornice = true;
      s.storeys = 3;
      s.signKind = 'pub';
      s.wantsSign = true;
      s.role = 'fleur';
    }
    if (id === ID.christopherInn) {
      s.wall = { type: 1, color: '#efe6d2' };
      s.upper = 'timberWin';
      s.upperWall = 1;
      s.jetty = 0.5;
      s.storeys = 3;
      s.roof.type = 'band';
    }
    if (id === ID.marketFork) {
      // "early post-medieval landmark with white plastered gables"
      s.wall = { type: 1, color: '#f4f0e6' };
      s.upper = 'casement';
      s.storeys = 3;
      s.roof = { type: 'band', mat: 0, color: '#7e432f', pitch: 55 };
      s.role = 'fork';
    }
    if (id === ID.boot) {
      s.ground = 'pub';
      s.signKind = 'pub';
      s.wantsSign = true;
      s.wall = { type: 1, color: '#efe9da' };
      s.upper = 'timberWin';
      s.upperWall = 1;
      s.jetty = 0.4;
    }
    if (id === ID.whiteSwan) {
      s.ground = 'pub';
      s.signKind = 'pub';
      s.wantsSign = true;
    }
    if (id === ID.solicitors) {
      s.role = 'solicitors';
      if (era === 2026) {
        s.ground = 'shopBlack';
        s.wantsSign = true;
      }
      if (era === 1964) {
        s.ground = 'shop60b';
        s.wantsSign = true;
      }
    }
    if (id === ID.espresso && era === 1964) {
      s.role = 'espresso';
      s.ground = 'shop60b';
      s.wantsSign = true;
    }
    if (id === ID.teaRooms && era === 1964) {
      s.role = 'tearooms';
      s.ground = 'shop60a';
      s.wantsSign = true;
    }
    if (id === ID.cornA || id === ID.cornB) s.skip = true; // built by landmarks (Corn Exchange)
    if (id === ID.peahen) {
      // the Peahen corner: old coaching inn in 1897, rebuilt in 1898 (fictional name in game)
      s.role = 'peahen';
      s.signKind = 'pub';
      s.wantsSign = true;
      s.ground = 'pub';
      if (era === 1897) {
        s.style = 'georgian';
        s.storeys = 2;
        s.wall = { type: 1, color: '#e2d8c2' };
        s.upper = 'sash6';
        s.roof = { type: 'band', mat: 0, color: '#7c4130', pitch: 42 };
        s.cornice = true;
        s.door = 'arch';
        s.doorBay = 1;
      } else {
        s.style = 'victorian';
        s.storeys = 3;
        s.wall = { type: 0, color: '#9a4b35' };
        s.upper = 'sash2';
        s.roof = { type: 'band', mat: 0, color: '#7c4130', pitch: 45 };
        s.cornice = true;
        s.corniceColor = '#efe9da';
        s.extra = 0.9;
      }
    }
  }

  // ------------------------------------------------------------------ signage text by era
  function signFor(s, b, era, atlas, used) {
    const r = U.rng(s.seed * 7 + era);
    const N = SA.SHOPNAMES[era];
    let text = null, style;
    const kind = s.signKind || 'shop';
    const pool = kind === 'pub' ? N.pub : kind === 'bank' ? N.bank : kind === 'food' ? N.food.concat(N.generic) : N.generic;
    for (let tries = 0; tries < 8; tries++) {
      const t = pool[Math.floor(r() * pool.length)];
      if (!used.has(t) || tries === 7) {
        text = t;
        break;
      }
    }
    used.add(text);
    if (era === 1897) {
      style = { bg: pick(r, ['#1d2b22', '#2a1a16', '#1c2236', '#121212', '#3a2a12']), fg: pick(r, ['#e8d39a', '#f0e6c8', '#d9b45a']), font: 'Georgia, serif', gilt: true, border: 'rgba(217,180,90,0.7)' };
    } else if (era === 1964) {
      style = { bg: pick(r, ['#c8102e', '#1d3c6e', '#f2e6c9', '#2e6b3a', '#e8b100', '#ffffff', '#1a1a1a']), fg: '#ffffff', font: '"Trebuchet MS", "Helvetica Neue", Arial, sans-serif', weight: 'bold' };
      if (style.bg === '#f2e6c9' || style.bg === '#ffffff' || style.bg === '#e8b100') style.fg = pick(r, ['#c8102e', '#1d3c6e', '#1a1a1a']);
    } else {
      style = { bg: pick(r, ['#1f2a2e', '#2d3b36', '#f2efe8', '#0f1720', '#3b2f2a', '#e9e4da', '#23324a']), fg: '#f7f5f0', font: '"Helvetica Neue", Arial, sans-serif', weight: '600', letterSpacing: '2px' };
      if (style.bg === '#f2efe8' || style.bg === '#e9e4da') style.fg = '#1f2a2e';
    }
    return { text, style };
  }

  // ------------------------------------------------------------------ build an era
  W.buildEra = function (eraId, flags, mats) {
    const era = SA.ERAS[eraId];
    const group = new THREE.Group();
    group.name = 'era-' + eraId;
    const col = new SA.Collision(8);
    const signAtlas = new SA.Tex.SignAtlas(2048, 4096);
    const ctx = { eraId, chunks: new Map(), signGB: new SA.Buildings.GB(), atlas: signAtlas, col, chimneys: [] };
    const specs = [];
    const used = new Set();
    for (const b of W.rawBuildings) {
      if (b.part) continue;
      if (b.id === ID.cathedral || b.id === ID.clockTower || b.id === ID.townHall || b.id === ID.gateway) continue;
      if (b.inChris && eraId !== 2026 && b.id !== ID.fleur && b.id !== ID.christopherInn && b.id !== ID.frenchRowTerrace) continue;
      // subdivide large footprints in older eras
      let polys = [b.p];
      if (b.near && b.mainFront >= 0) {
        const z = b.z.zone;
        const keepWhole = b.id === ID.peahen || b.id === ID.pennick || b.id === ID.christopherInn || b.id === ID.fleur;
        if (keepWhole) polys = [b.p];
        else if (eraId === 1897 && b.area > 140 && z !== 'backdrop') polys = subdivide(b, 6.5);
        else if (eraId === 1964 && b.area > 600 && (z === 'stPetersW' || z === 'highS')) polys = subdivide(b, 11);
        else if (eraId === 1964 && b.inHeritage) polys = [b.p];
      }
      polys.forEach((p, i) => {
        const s = makeSpec(b, p, eraId, i, null);
        applyOverrides(s, b, eraId, flags);
        if (s.skip) {
          // still collide
          return;
        }
        specs.push(s);
      });
    }
    // era-only additions (Gentle's Yard cottages in 1897, Christopher car park walls in 1964)
    for (const s of W.eraAdditions(eraId)) specs.push(s);

    // signs
    for (const s of specs) {
      if (!s.wantsSign || !s.fronts.length) continue;
      const b = W.rawBuildings.find((x) => x.id === s.id);
      let text, style;
      const auth = W.authoredSign(s, eraId, flags);
      if (auth) {
        text = auth.text;
        style = auth.style;
      } else {
        const sg = signFor(s, b || {}, eraId, signAtlas, used);
        text = sg.text;
        style = sg.style;
      }
      if (!text) continue;
      const uv = signAtlas.text(text, style);
      if (!uv) continue;
      s.signs.push({ edge: s.fronts[0], uv, text });
      s.signText = text;
    }
    for (const s of specs) SA.Buildings.addBuilding(ctx, s);
    // landmark colliders and meshes
    SA.Landmarks.build(eraId, group, col, signAtlas, flags, mats, ctx.signGB);
    SA.Buildings.finish(ctx, { facade: mats.facade, roof: mats.roof, sign: mats.signMat, chimney: mats.chimney }, group);
    // props, barriers, lamps
    const props = SA.Props.build(eraId, group, col, flags, mats, signAtlas);
    SA.RoadMarks && SA.RoadMarks.build(eraId, group, mats);
    // all signs are drawn: upload the (cropped) atlas
    signAtlas.finish();
    for (const k of ['signMat', 'signPlain', 'signAlpha']) {
      mats[k].map = signAtlas.texture;
      mats[k].needsUpdate = true;
    }
    return { id: eraId, group, col, specs, signAtlas, props, era, chimneys: ctx.chimneys };
  };

  // Authored sign text for story buildings
  W.authoredSign = function (s, eraId, flags) {
    const f = flags || {};
    if (s.role === 'pennick') {
      if (eraId === 1897) return { text: 'R. Twyford · Watchmaker', style: { bg: '#1c2236', fg: '#e8d39a', gilt: true, border: 'rgba(217,180,90,0.7)' } };
      if (eraId === 1964) {
        if (f.fund_outcome === 'returned') return { text: 'Pennick & Daughter · Clockmakers', style: { bg: '#1f4a35', fg: '#f2e6c4', gilt: true } };
        if (f.fund_outcome === 'dinner') return { text: 'E. Pennick · Curios & Clocks', style: { bg: '#5a1f24', fg: '#f2e6c4' } };
        return { text: 'E. Pennick · Clocks Mended · Curios', style: { bg: '#5a1f24', fg: '#f2e6c4' } };
      }
      if (f.fund_outcome === 'returned') return { text: 'Pennick & Daughters · Clockmakers since 1881', style: { bg: '#1f4a35', fg: '#e8d39a', font: 'Georgia, serif', gilt: true } };
      if (f.fund_outcome === 'dinner') return { text: 'The Jubilee Table · since 1897', style: { bg: '#5a1f24', fg: '#fff3dc', font: 'Georgia, serif', italic: true, upper: false } };
      return { text: 'PHONE FIXX · Cases · Repairs · Vapes', style: { bg: '#0b0b0b', fg: '#39ff88', font: 'Arial Black, Arial, sans-serif' } };
    }
    if (s.role === 'solicitors') {
      if (eraId === 2026) return { text: 'Lattimore & Hale · Solicitors', style: { bg: '#14202e', fg: '#e9e2cf', font: 'Georgia, serif', letterSpacing: '1px' } };
      if (eraId === 1964) return { text: 'Golding & Son · Jewellers', style: { bg: '#1d3c6e', fg: '#f2e6c9', font: 'Georgia, serif' } };
    }
    if (s.role === 'peahen') return { text: eraId === 1897 ? 'The Peacock Inn · Posting House' : 'The Peacock Hotel', style: { bg: '#1c2a20', fg: '#e8d39a', font: 'Georgia, serif', gilt: true } };
    if (s.role === 'espresso') return { text: 'The Gabriel Espresso Bar', style: { bg: '#1d1d1d', fg: '#ffcf3a', font: '"Trebuchet MS", Arial, sans-serif' } };
    if (s.role === 'tearooms') return { text: 'Copper Kettle Tea Rooms', style: { bg: '#f2e6c9', fg: '#7a3b12', font: 'Georgia, serif', italic: true, upper: false } };
    if (s.role === 'fleur') {
      return { text: eraId === 1897 ? 'The French King' : eraId === 1964 ? 'The French King · Ales' : 'The French King', style: { bg: '#2a1a12', fg: '#e8c56a', font: 'Georgia, serif', gilt: true } };
    }
    return null;
  };

  // Era-only additions
  W.eraAdditions = function (eraId) {
    const out = [];
    if (eraId === 1897) {
      // Gentle's Yard: rows of small cottages and inn-yard outbuildings in the Christopher Place block
      const rows = [
        { x0: -38, z0: -30, dx: 0, dz: -6.2, n: 7, w: 5.5, d: 4.6 },
        { x0: -18, z0: -40, dx: 0, dz: -6.2, n: 6, w: 5.0, d: 4.4 },
        { x0: 0, z0: -62, dx: 5.6, dz: -2.4, n: 4, w: 4.8, d: 4.2 },
        { x0: -30, z0: -96, dx: 6.4, dz: -1.6, n: 6, w: 5.2, d: 4.4 },
      ];
      let k = 0;
      for (const row of rows) {
        for (let i = 0; i < row.n; i++) {
          const cx = row.x0 + row.dx * i, cz = row.z0 + row.dz * i;
          const ang = Math.atan2(row.dz, row.dx) + Math.PI / 2;
          const c = Math.cos(ang), s = Math.sin(ang);
          const hw = row.d / 2, hd = (row.dx || row.dz ? Math.hypot(row.dx, row.dz) : row.w) / 2 - 0.05;
          const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map((p) => [cx + p[0] * c - p[1] * s, cz + p[0] * s + p[1] * c]);
          if (!U.pointInPoly(cx, cz, W.CHRISTOPHER)) continue;
          const r = U.rng(5000 + k);
          let minH = Infinity;
          for (const p of pts) minH = Math.min(minH, SA.Terrain.height(p[0], p[1]));
          out.push({
            key: 'gentle' + k, id: 9000000 + k, pts, seed: 5000 + k++, tag: 'building', fronts: [0, 2], party: {}, storeys: 2, gh: 2.6, sh: 2.4, extra: 0, bayW: 2.6, jetty: 0,
            wall: { type: r() < 0.5 ? 0 : 1, color: r() < 0.5 ? '#7a4632' : '#cfc2a6' }, roof: { type: 'gable', mat: r() < 0.6 ? 0 : 1, color: r() < 0.6 ? '#6e3b2c' : '#4c5058', pitch: 40, ridge: 'long' },
            upper: 'smallsq', ground: 'house', signs: [], chimneys: 1, cornice: false, sideWindows: false, base: minH, floor: minH + 0.05, lit: 0.7, style: 'cottage',
          });
        }
      }
    }
    return out;
  };

  // Surfaces
  W.roadSurface = function (eraId, r) {
    if (eraId === 1897) {
      if (r.n === 'Market Place' || r.n === 'French Row' || r.n === 'High Street') return 'setts';
      if (r.t === 'service') return 'dirt';
      return 'dirt';
    }
    if (eraId === 1964) {
      if (r.t === 'pedestrian') return r.n === 'French Row' ? 'paving' : 'paving';
      return 'asphalt';
    }
    if (r.n === 'Market Place' && r.t !== 'primary') return 'setts';
    if (r.t === 'pedestrian') return 'paving';
    return 'asphalt';
  };
  W.specialSurfaces = function (eraId) {
    const out = [];
    // Clock Tower square (Market Cross)
    const sq = [[-12, 12], [-14, -8], [8, -12], [20, -4], [12, 16]];
    if (eraId === 2026) out.push({ poly: sq, color: '#7d7a78', mat: 'rgba(0,255,0,1)' });
    if (eraId === 1897) out.push({ poly: sq, color: '#7a736c', mat: 'rgba(0,255,0,1)' });
    // Christopher block: rubble car park in 1964, yards (dirt) in 1897
    if (eraId === 1964) out.push({ poly: W.CHRISTOPHER.map((p) => [p[0] * 0.98 + 0.5, p[1] * 0.98]), color: '#6d675c', mat: 'rgba(0,0,0,0.85)' });
    if (eraId === 1897) out.push({ poly: W.CHRISTOPHER, color: '#6a5c4a', mat: 'rgba(0,0,0,1)' });
    return out;
  };
  W.footprints = function (eraId) {
    const e = W.eras[eraId];
    if (!e) return [];
    return e.specs.map((s) => s.pts);
  };

  // ------------------------------------------------------------------ doors of story buildings
  // Returns the street-side doorway of a building with a given role in an era: {x, z, nx, nz, spec}
  W.roleDoor = function (eraId, role, preferRoad) {
    const e = W.eras[eraId];
    if (!e) return null;
    const s = e.specs.find((sp) => sp.role === role);
    if (!s) return null;
    let best = null, bs = -Infinity;
    const edges = s.fronts.length ? s.fronts : s.pts.map((_, i) => i);
    for (const i of edges) {
      const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = SA.Buildings.outwardNormal(s.pts, i);
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      let score = len;
      if (preferRoad) {
        const nr = W.nearestRoad(mx + n[0] * 3, mz + n[1] * 3, (r) => r.n === preferRoad, 12);
        if (nr) score += 100 - nr.d * 5;
      }
      if (score > bs) {
        bs = score;
        best = { x: mx + n[0] * 1.1, z: mz + n[1] * 1.1, nx: n[0], nz: n[1], spec: s, edge: i };
      }
    }
    return best;
  };

  // ------------------------------------------------------------------ safe arrival search
  // Finds the nearest walkable open spot in the given era: not inside any collider, inside the district,
  // and (optionally) not on a carriageway with moving traffic.
  W.isSafe = function (eraId, x, z, opts) {
    opts = opts || {};
    const e = W.eras[eraId];
    if (!e) return false;
    if (!W.inDistrict(x, z)) return false;
    if (!e.col.isFree(x, z, opts.r || 0.5, 'walk')) return false;
    if (opts.vehicles) {
      for (const v of opts.vehicles) {
        if (U.dist(x, z, v.x, v.z) < (v.radius || 2.4) + 0.8) return false;
      }
    }
    if (opts.avoidRoad) {
      const nr = W.nearestRoad(x, z, (r) => SA.Terrain.isCarriageway(r) && r.t !== 'service', 8);
      if (nr && nr.d < SA.Terrain.roadWidth(nr.road) / 2 - 0.2) return false;
    }
    return true;
  };
  W.findSafe = function (eraId, x, z, opts) {
    if (W.isSafe(eraId, x, z, opts)) return { x, z, moved: 0 };
    for (let r = 0.8; r < 40; r += 0.8) {
      const steps = Math.max(8, Math.floor(r * 4));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (W.isSafe(eraId, px, pz, opts)) return { x: px, z: pz, moved: r };
      }
    }
    return { x: 0, z: 6, moved: 99 };
  };
})();
