/* Street furniture and era props, mostly instanced: lamps, bollards, trees, benches, bins, phone boxes,
   pillar boxes, Belisha beacons, market stalls, bunting, boundary barriers. Also lamp glow pools. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const P = (SA.Props = {});

  // ---- small helpers to build vertex-coloured merged prop geometries
  function colored(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (geo.index) geo = geo.toNonIndexed();
    return geo;
  }
  function part(geo, hex, x, y, z, rx, ry, rz) {
    const g = geo.clone();
    if (rx || ry || rz) g.rotateX(rx || 0), g.rotateY(ry || 0), g.rotateZ(rz || 0);
    g.translate(x || 0, y || 0, z || 0);
    return colored(g.index ? g.toNonIndexed() : g, hex);
  }
  function merge(parts) {
    const clean = parts.map((g) => {
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
      return g;
    });
    const m = THREE.BufferGeometryUtils.mergeGeometries(clean, false);
    m.computeBoundingSphere();
    return m;
  }
  P.merge = merge;
  P.part = part;
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s) => new THREE.CylinderGeometry(r1, r2, h, s || 8);
  const sph = (r, w, h) => new THREE.SphereGeometry(r, w || 8, h || 6);

  // ---- prop models (origin at ground)
  const MODELS = {};
  P.MODELS = MODELS;
  function defineModels() {
    // lamps by era
    MODELS.lampGas = merge([
      part(cyl(0.09, 0.13, 3.2, 8), '#1f2622', 0, 1.6, 0),
      part(cyl(0.2, 0.22, 0.25, 8), '#1f2622', 0, 0.12, 0),
      part(box(0.7, 0.05, 0.05), '#1f2622', 0, 2.95, 0),
      part(cyl(0.22, 0.12, 0.55, 4), '#2a2f2a', 0, 3.45, 0, 0, Math.PI / 4),
      part(cyl(0.05, 0.2, 0.22, 4), '#1f2622', 0, 3.84, 0, 0, Math.PI / 4),
    ]);
    MODELS.lampGasGlass = merge([part(cyl(0.19, 0.11, 0.45, 4), '#ffd27a', 0, 3.45, 0, 0, Math.PI / 4)]);
    MODELS.lamp60 = merge([
      part(cyl(0.11, 0.16, 7.5, 8), '#b8b4aa', 0, 3.75, 0),
      part(box(0.18, 0.18, 1.6), '#b8b4aa', 0, 7.45, 0.7),
      part(box(0.45, 0.18, 0.9), '#8d8a84', 0, 7.38, 1.4),
    ]);
    MODELS.lamp60Glass = merge([part(box(0.36, 0.06, 0.8), '#fff3c8', 0, 7.27, 1.4)]);
    MODELS.lampLED = merge([
      part(cyl(0.08, 0.12, 6.0, 8), '#2b2e33', 0, 3.0, 0),
      part(box(0.12, 0.12, 1.2), '#2b2e33', 0, 5.95, 0.55),
      part(box(0.32, 0.1, 0.6), '#2b2e33', 0, 5.9, 1.1),
    ]);
    MODELS.lampLEDGlass = merge([part(box(0.26, 0.04, 0.5), '#f4f7ff', 0, 5.84, 1.1)]);
    MODELS.bollard = merge([part(cyl(0.11, 0.13, 0.95, 8), '#202020', 0, 0.47, 0), part(cyl(0.13, 0.13, 0.06, 8), '#c9a54a', 0, 0.8, 0)]);
    MODELS.bollardCast = merge([part(cyl(0.12, 0.16, 0.9, 8), '#2a2a2a', 0, 0.45, 0), part(sph(0.13), '#2a2a2a', 0, 0.95, 0)]);
    MODELS.bench = merge([
      part(box(1.8, 0.06, 0.45), '#7a5a3a', 0, 0.45, 0),
      part(box(1.8, 0.4, 0.05), '#7a5a3a', 0, 0.75, -0.2),
      part(box(0.06, 0.45, 0.45), '#2a2a2a', -0.8, 0.22, 0),
      part(box(0.06, 0.45, 0.45), '#2a2a2a', 0.8, 0.22, 0),
    ]);
    MODELS.bin = merge([part(cyl(0.25, 0.22, 0.95, 10), '#1f2a24', 0, 0.48, 0), part(cyl(0.27, 0.27, 0.06, 10), '#c9a54a', 0, 0.9, 0)]);
    MODELS.k6 = merge([
      part(box(0.92, 2.5, 0.92), '#c8102e', 0, 1.25, 0),
      part(box(0.98, 0.15, 0.98), '#c8102e', 0, 2.55, 0),
      part(cyl(0.5, 0.5, 0.2, 4, 1), '#c8102e', 0, 2.7, 0, 0, Math.PI / 4),
      part(box(0.94, 0.22, 0.94), '#f0eee8', 0, 2.3, 0),
      part(box(0.7, 1.4, 0.95), '#3a4650', 0, 1.35, 0),
    ]);
    MODELS.pillarbox = merge([part(cyl(0.3, 0.3, 1.4, 12), '#c8102e', 0, 0.7, 0), part(cyl(0.33, 0.3, 0.12, 12), '#c8102e', 0, 1.46, 0), part(box(0.25, 0.05, 0.05), '#111', 0, 1.1, 0.3)]);
    MODELS.penfold = merge([part(cyl(0.32, 0.32, 1.35, 6), '#c8102e', 0, 0.68, 0), part(cyl(0.12, 0.38, 0.25, 6), '#c8102e', 0, 1.47, 0), part(sph(0.08), '#c8102e', 0, 1.65, 0)]);
    MODELS.belisha = merge([part(cyl(0.06, 0.06, 2.4, 8), '#111', 0, 1.2, 0), part(cyl(0.065, 0.065, 0.3, 8), '#f0f0f0', 0, 0.6, 0), part(cyl(0.065, 0.065, 0.3, 8), '#f0f0f0', 0, 1.2, 0), part(cyl(0.065, 0.065, 0.3, 8), '#f0f0f0', 0, 1.8, 0)]);
    MODELS.belishaGlobe = merge([part(sph(0.22, 10, 8), '#ffae1a', 0, 2.55, 0)]);
    MODELS.treeTrunk = merge([part(cyl(0.18, 0.28, 3.4, 5), '#5a4a3a', 0, 1.7, 0)]);
    const ico = (r, d) => new THREE.IcosahedronGeometry(r, d || 0);
    MODELS.treeCrown = merge([
      part(ico(2.0, 1), '#4f6f34', 0, 4.8, 0),
      part(ico(1.5), '#5d7d3c', 1.1, 5.5, 0.4),
      part(ico(1.4), '#486a30', -1.0, 5.3, -0.5),
      part(ico(1.2), '#5a7a3a', 0.2, 6.3, 0.2),
    ]);
    MODELS.stall = merge([
      part(box(2.8, 0.08, 1.4), '#7a5a3a', 0, 0.85, 0),
      part(box(0.05, 2.2, 0.05), '#555', -1.35, 1.1, -0.65),
      part(box(0.05, 2.2, 0.05), '#555', 1.35, 1.1, -0.65),
      part(box(0.05, 2.2, 0.05), '#555', -1.35, 1.1, 0.65),
      part(box(0.05, 2.2, 0.05), '#555', 1.35, 1.1, 0.65),
      part(box(2.9, 0.06, 1.6), '#2a5fae', 0, 2.25, 0, 0.12),
      part(box(2.6, 0.25, 1.2), '#c86b3c', 0, 1.0, 0),
      part(box(2.6, 0.12, 1.1), '#7aa040', 0, 1.18, 0.05),
    ]);
    MODELS.stall60 = merge([
      part(box(2.8, 0.08, 1.4), '#8a6a4a', 0, 0.85, 0),
      part(box(0.05, 2.2, 0.05), '#555', -1.35, 1.1, -0.65),
      part(box(0.05, 2.2, 0.05), '#555', 1.35, 1.1, -0.65),
      part(box(2.9, 0.06, 1.6), '#e8e2cf', 0, 2.25, 0, 0.12),
      part(box(2.9, 0.07, 1.62), '#2e6b3a', 0, 2.29, 0.1, 0.12),
      part(box(2.6, 0.3, 1.2), '#d9a441', 0, 1.02, 0),
    ]);
    MODELS.barrier26 = merge([
      part(box(2.0, 0.2, 0.07), '#d12a2a', 0, 1.25, 0),
      part(box(2.0, 0.2, 0.07), '#f2f2f2', 0, 1.05, 0),
      part(box(2.0, 0.2, 0.07), '#d12a2a', 0, 0.85, 0),
      part(box(0.06, 1.35, 0.5), '#3a3a3a', -0.95, 0.67, 0),
      part(box(0.06, 1.35, 0.5), '#3a3a3a', 0.95, 0.67, 0),
    ]);
    MODELS.fence26 = merge([part(box(2.4, 0.08, 0.06), '#5c6670', 0, 1.0, 0), part(box(2.4, 0.08, 0.06), '#5c6670', 0, 0.5, 0), part(box(0.07, 1.1, 0.07), '#4a525a', -1.2, 0.55, 0)]);
    MODELS.fence60 = merge([part(box(2.4, 0.07, 0.06), '#3a3a30', 0, 0.95, 0), part(box(2.4, 0.07, 0.06), '#3a3a30', 0, 0.5, 0), part(box(0.07, 1.05, 0.07), '#2a2a24', -1.2, 0.52, 0)]);
    MODELS.fence97 = merge([part(box(2.4, 0.06, 0.05), '#1d201d', 0, 1.0, 0), part(box(2.4, 0.06, 0.05), '#1d201d', 0, 0.2, 0), part(box(0.05, 1.1, 0.05), '#1d201d', -1.2, 0.55, 0), part(box(0.05, 1.1, 0.05), '#1d201d', -0.6, 0.55, 0), part(box(0.05, 1.1, 0.05), '#1d201d', 0, 0.55, 0), part(box(0.05, 1.1, 0.05), '#1d201d', 0.6, 0.55, 0)]);
    MODELS.heras = merge([
      part(box(2.4, 2.0, 0.03), '#9aa0a6', 0, 1.0, 0),
      part(box(0.06, 2.0, 0.06), '#888', -1.2, 1.0, 0),
      part(box(0.06, 2.0, 0.06), '#888', 1.2, 1.0, 0),
      part(box(0.6, 0.15, 0.25), '#2a2a2a', -1.2, 0.07, 0),
    ]);
    MODELS.cone = merge([part(cyl(0.03, 0.22, 0.75, 6), '#ff6a13', 0, 0.37, 0), part(cyl(0.12, 0.17, 0.12, 6), '#f4f4f4', 0, 0.42, 0)]);
    MODELS.trestle60 = merge([
      part(box(2.2, 0.22, 0.05), '#f2f2f2', 0, 0.85, 0),
      part(box(0.44, 0.23, 0.06), '#d12a2a', -0.88, 0.85, 0),
      part(box(0.44, 0.23, 0.06), '#d12a2a', 0, 0.85, 0),
      part(box(0.44, 0.23, 0.06), '#d12a2a', 0.88, 0.85, 0),
      part(box(0.06, 0.95, 0.5), '#6a5a48', -1.0, 0.47, 0),
      part(box(0.06, 0.95, 0.5), '#6a5a48', 1.0, 0.47, 0),
    ]);
    MODELS.paraffin = merge([part(cyl(0.09, 0.11, 0.25, 8), '#1d1d1d', 0, 1.1, 0)]);
    MODELS.paraffinGlass = merge([part(sph(0.1, 8, 6), '#ff3a22', 0, 1.28, 0)]);
    MODELS.hoarding = merge([part(box(3.0, 2.4, 0.08), '#556b4a', 0, 1.2, 0), part(box(0.1, 2.5, 0.1), '#4a3a2a', -1.5, 1.25, 0.06), part(box(0.1, 2.5, 0.1), '#4a3a2a', 1.5, 1.25, 0.06)]);
    MODELS.hurdle = merge([
      part(box(2.2, 0.08, 0.05), '#8a6a40', 0, 0.35, 0),
      part(box(2.2, 0.08, 0.05), '#8a6a40', 0, 0.7, 0),
      part(box(2.2, 0.08, 0.05), '#8a6a40', 0, 1.05, 0),
      part(box(0.07, 1.25, 0.07), '#7a5a35', -1.05, 0.62, 0),
      part(box(0.07, 1.25, 0.07), '#7a5a35', 1.05, 0.62, 0),
      part(box(0.07, 1.25, 0.07), '#7a5a35', 0, 0.62, 0),
    ]);
    MODELS.dray = merge([
      part(box(1.9, 0.12, 3.6), '#6a4a2a', 0, 0.95, 0),
      part(box(1.9, 0.6, 0.08), '#6a4a2a', 0, 1.3, 1.78),
      part(box(1.9, 0.6, 0.08), '#6a4a2a', 0, 1.3, -1.78),
      part(cyl(0.6, 0.6, 0.1, 12), '#3a2a1a', 1.0, 0.6, 1.0, 0, 0, Math.PI / 2),
      part(cyl(0.6, 0.6, 0.1, 12), '#3a2a1a', -1.0, 0.6, 1.0, 0, 0, Math.PI / 2),
      part(cyl(0.6, 0.6, 0.1, 12), '#3a2a1a', 1.0, 0.6, -1.0, 0, 0, Math.PI / 2),
      part(cyl(0.6, 0.6, 0.1, 12), '#3a2a1a', -1.0, 0.6, -1.0, 0, 0, Math.PI / 2),
      part(cyl(0.38, 0.38, 0.8, 10), '#7a5030', 0.45, 1.4, 0.6, 0, 0, Math.PI / 2),
      part(cyl(0.38, 0.38, 0.8, 10), '#7a5030', -0.45, 1.4, -0.6, 0, 0, Math.PI / 2),
    ]);
    MODELS.railing = merge([
      part(box(2.0, 0.05, 0.05), '#1a1d1a', 0, 1.0, 0),
      part(box(2.0, 0.05, 0.05), '#1a1d1a', 0, 0.15, 0),
      ...[...Array(9).keys()].map((i) => part(box(0.03, 1.05, 0.03), '#1a1d1a', -0.9 + i * 0.225, 0.55, 0)),
    ]);
    MODELS.crowdBarrier = merge([part(box(2.0, 0.06, 0.06), '#f2efe4', 0, 1.0, 0), part(box(2.0, 0.06, 0.06), '#8a1f24', 0, 0.6, 0), part(box(0.07, 1.05, 0.07), '#5a4030', -1.0, 0.52, 0), part(box(0.07, 1.05, 0.07), '#5a4030', 1.0, 0.52, 0)]);
    MODELS.planter = merge([part(box(1.2, 0.6, 1.2), '#3a3a3a', 0, 0.3, 0), part(sph(0.6, 8, 6), '#4f7a34', 0, 0.85, 0)]);
    MODELS.busstop = merge([part(box(0.08, 2.6, 0.08), '#222', 0, 1.3, 0), part(box(0.5, 0.5, 0.04), '#e3e3e3', 0, 2.55, 0), part(box(0.3, 0.6, 0.06), '#2a5fae', 0, 1.8, 0)]);
    MODELS.signpost = merge([part(box(0.08, 2.3, 0.08), '#333', 0, 1.15, 0), part(box(0.7, 0.45, 0.04), '#1d3c6e', 0, 2.2, 0)]);
    MODELS.cycleRack = merge([part(box(0.05, 0.7, 0.8), '#555', 0, 0.35, 0), part(box(0.05, 0.05, 0.8), '#555', 0, 0.7, 0)]);
    MODELS.rubble = merge([
      part(new THREE.DodecahedronGeometry(1.0, 0), '#7a6a5a', 0, 0.3, 0),
      part(new THREE.DodecahedronGeometry(0.7, 0), '#8a7a66', 0.9, 0.2, 0.4),
      part(new THREE.DodecahedronGeometry(0.5, 0), '#6a5a4a', -0.7, 0.15, -0.6),
    ]);
    MODELS.handcart = merge([part(box(1.2, 0.1, 2.0), '#7a5a3a', 0, 0.75, 0), part(box(1.2, 0.35, 0.05), '#7a5a3a', 0, 0.95, 0.98), part(cyl(0.45, 0.45, 0.08, 10), '#3a2a1a', 0.62, 0.45, 0.2, 0, 0, Math.PI / 2), part(cyl(0.45, 0.45, 0.08, 10), '#3a2a1a', -0.62, 0.45, 0.2, 0, 0, Math.PI / 2), part(box(0.05, 0.05, 1.2), '#7a5a3a', 0.4, 0.75, -1.5), part(box(0.05, 0.05, 1.2), '#7a5a3a', -0.4, 0.75, -1.5)]);
    MODELS.adBoard = merge([part(box(0.6, 0.9, 0.04), '#f3eee2', 0, 0.55, 0.12, -0.25), part(box(0.6, 0.9, 0.04), '#f3eee2', 0, 0.55, -0.12, 0.25)]);
  }

  // ---- placements per era
  // Returns list of {model, x, z, rot, s}
  function along(polyline, spacing, offset, fn) {
    let acc = spacing * 0.5;
    for (let i = 0; i < polyline.length - 1; i++) {
      const a = polyline[i], b = polyline[i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const ux = dx / len, uz = dz / len;
      while (acc < len) {
        const x = a[0] + ux * acc, z = a[1] + uz * acc;
        for (const side of [-1, 1]) fn(x + -uz * offset * side, z + ux * offset * side, Math.atan2(ux, uz), side);
        acc += spacing;
      }
      acc -= len;
    }
  }

  P.build = function (eraId, group, col, flags, mats, atlas) {
    if (!MODELS.lampGas) defineModels();
    const W = SA.World;
    const place = {};
    const add = (model, x, z, rot, s, opts) => {
      (place[model] = place[model] || []).push({ x, z, rot: rot || 0, s: s || 1, y: opts && opts.y !== undefined ? opts.y : null, sp: opts && opts.sp });
    };
    // box collider standing on the ground: heights are relative to the terrain at its centre
    const propBox = (x, z, hw, hd, ang, h, opts) => {
      const g = SA.Terrain.height(x, z);
      return col.addBox(x, z, hw, hd, ang, Object.assign({ y0: g - 1, y1: g + h }, opts));
    };
    const lamps = [];
    const glows = [];
    const r = U.rng(eraId * 17 + 3);
    // free spot test: inside district, not in a building, not on a carriageway
    const okSpot = (x, z, rad) => W.inDistrict(x, z) && col.isFree(x, z, rad || 0.6, 'walk');
    const onRoad = (x, z) => {
      const nr = W.nearestRoad(x, z, (rr) => SA.Terrain.isCarriageway(rr), 12);
      return nr && nr.d < SA.Terrain.roadWidth(nr.road) / 2 + 0.3;
    };

    // street lamps along main streets, at the kerb
    const lampModel = eraId === 1897 ? 'lampGas' : eraId === 1964 ? 'lamp60' : 'lampLED';
    const spacing = eraId === 1897 ? 26 : eraId === 1964 ? 32 : 28;
    for (const rd of W.roads) {
      if (!SA.Terrain.isCarriageway(rd) || rd.t === 'service') continue;
      const off = SA.Terrain.roadWidth(rd) / 2 + 0.55;
      along(rd.p, spacing, off, (x, z, rot, side) => {
        if (side > 0 && r() < 0.5) return; // staggered
        if (!okSpot(x, z, 0.8) || onRoad(x, z)) return;
        for (const l of lamps) if (U.dist(l.x, l.z, x, z) < spacing * 0.6) return;
        const toRoad = rot + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        add(lampModel, x, z, toRoad);
        lamps.push({ x, z });
        col.addCircle(x, z, 0.2, { y1: 4, cam: false });
      });
    }
    // pedestrian streets: lamps at intervals (French Row bracket lamps simplified as posts)
    for (const rd of W.roads) {
      if (rd.t !== 'pedestrian' && rd.t !== 'footway') continue;
      if (rd.n !== 'French Row' && rd.n !== "St Peter's Street" && rd.n !== 'Christopher Place') continue;
      along(rd.p, 20, rd.n === "St Peter's Street" ? 8 : 0, (x, z, rot, side) => {
        if (side > 0) return;
        if (!okSpot(x, z, 0.9)) return;
        for (const l of lamps) if (U.dist(l.x, l.z, x, z) < 14) return;
        add(lampModel, x, z, rot);
        lamps.push({ x, z });
        col.addCircle(x, z, 0.2, { y1: 4, cam: false });
      });
    }
    P.lamps = lamps;

    // St Peter's Street trees: limes planted 1881 (young in 1897, mature 1964), planes from 1999 (2026)
    const sp = W.roads.filter((rd) => rd.n === "St Peter's Street" && rd.t === 'primary');
    for (const rd of sp) {
      along(rd.p, 11, SA.Terrain.roadWidth(rd) / 2 + 2.2, (x, z) => {
        if (!okSpot(x, z, 1.2) || onRoad(x, z)) return;
        const size = eraId === 1897 ? 0.62 : eraId === 1964 ? 1.25 : 0.95;
        add('tree', x, z, r() * 6, size * (0.9 + r() * 0.2), { sp: eraId === 2026 ? 'plane' : 'lime' });
        col.addCircle(x, z, 0.35 * size, { y1: 5, cam: false });
      });
    }
    // churchyard / green trees
    for (const a of W.areas) {
      if (a.k !== 'grass') continue;
      const b = U.polyBounds(a.p);
      const n = Math.min(14, Math.floor(Math.abs(U.polyArea(a.p)) / 250));
      for (let i = 0; i < n; i++) {
        const x = U.lerp(b.x0, b.x1, r()), z = U.lerp(b.z0, b.z1, r());
        if (!U.pointInPoly(x, z, a.p) || !col.isFree(x, z, 2.5, 'walk')) continue;
        add('tree', x, z, r() * 6, 0.95 + r() * 0.4, { sp: 'broad' });
        col.addCircle(x, z, 0.4, { y1: 5, cam: false });
      }
    }
    // benches, bins, bollards by era near the Clock Tower and St Peter's St
    const ct = SA.Landmarks.clockTowerInfo;
    if (eraId === 2026) {
      add('bench', ct.x - 6, ct.z + 5, 0.3);
      add('bench', ct.x + 7, ct.z + 7, -0.4);
      add('bin', ct.x - 5, ct.z + 9, 0);
      add('planter', 140, -170, 0);
      add('planter', 160, -200, 0);
      add('k6', 32, 4, Math.PI / 2); // K6 kiosk in Boot Alley (listed)
      propBox(32, 4, 0.5, 0.5, 0, 2.8, { tag: 'k6' });
      add('cycleRack', 128, -128, 0.4);
      add('cycleRack', 129, -126, 0.4);
    }
    if (eraId === 1964) {
      add('bench', ct.x - 6, ct.z + 5, 0.3);
      add('k6', 32, 4, Math.PI / 2);
      propBox(32, 4, 0.5, 0.5, 0, 2.8, { tag: 'k6' });
      add('k6', 150, -150, 0.5);
      propBox(150, -150, 0.5, 0.5, 0.5, 2.8, { tag: 'k6' });
      add('pillarbox', 100, -82, 0);
      col.addCircle(100, -82, 0.35, { y1: 1.6 });
    }
    if (eraId === 1897) {
      add('penfold', 100, -82, 0);
      col.addCircle(100, -82, 0.35, { y1: 1.6 });
      // railings around the Clock Tower base (1866 restoration)
      const t = ct;
      const c = Math.cos(t.ang), s = Math.sin(t.ang);
      for (const [u, v, rr] of [[0, -t.hv - 0.9, 0], [0, t.hv + 0.9, 0], [-t.hu - 0.9, 0, Math.PI / 2], [t.hu + 0.9, 0, Math.PI / 2]]) {
        for (const k of [-1, 0, 1]) {
          const uu = rr ? u : u + k * 2.0, vv = rr ? v + k * 2.0 : v;
          const x = t.x + uu * c - vv * s, z = t.z + uu * s + vv * c;
          if (rr === 0 && v > 0 && k === 0) continue; // gap for the shop door on the south side
          add('railing', x, z, -(t.ang + rr));
        }
      }
    }
    // Belisha beacons at zebra crossings (1964/2026) from OSM crossing nodes on main roads
    if (eraId !== 1897) {
      for (const f of W.features) {
        if (f.k !== 'highway=crossing') continue;
        const nr = W.nearestRoad(f.x, f.z, (rd) => SA.Terrain.isCarriageway(rd) && rd.t !== 'service', 6);
        if (!nr) continue;
        const w = SA.Terrain.roadWidth(nr.road) / 2 + 0.6;
        const dx = nr.b[0] - nr.a[0], dz = nr.b[1] - nr.a[1];
        const l = Math.hypot(dx, dz);
        for (const sgn of [-1, 1]) {
          const x = nr.x - (dz / l) * w * sgn, z = nr.z + (dx / l) * w * sgn;
          if (!okSpot(x, z, 0.3)) continue;
          add('belisha', x, z, 0);
          (place.belishaGlobe = place.belishaGlobe || []).push({ x, z, rot: 0, s: 1 });
          col.addCircle(x, z, 0.12, { y1: 2.5, cam: false });
        }
      }
    }
    // market: 1964 Saturday market stalls along St Peter's Street (west side pedestrian area)
    if (eraId === 1964) {
      for (const rd of W.roads) {
        if (rd.n !== "St Peter's Street" || rd.t !== 'pedestrian') continue;
        along(rd.p, 4.2, 0, (x, z, rot, side) => {
          if (side > 0) return;
          if (!okSpot(x, z, 1.6)) return;
          add('stall60', x, z, rot + Math.PI / 2);
          propBox(x, z, 1.45, 0.75, -(rot + Math.PI / 2), 2.4, { tag: 'stall', cam: false });
        });
      }
      // rubble car park on the Christopher site: rubble heaps and a tin shed
      for (let i = 0; i < 9; i++) {
        const x = -30 + r() * 60, z = -40 - r() * 70;
        if (!U.pointInPoly(x, z, W.CHRISTOPHER) || !col.isFree(x, z, 2, 'walk')) continue;
        add('rubble', x, z, r() * 6, 0.8 + r() * 0.8);
        col.addCircle(x, z, 1.1, { y1: 1.2, cam: false });
      }
    }
    // 1897 Jubilee: bunting across streets, crowd barriers, drays and handcarts
    const bunting = [];
    if (eraId === 1897) {
      for (const rd of W.roads) {
        if (!['High Street', 'Market Place', "St Peter's Street", 'Chequer Street', 'George Street', 'French Row'].includes(rd.n)) continue;
        along(rd.p, 14, 0, (x, z, rot, side) => {
          if (side > 0) return;
          bunting.push({ x, z, rot, w: rd.n === "St Peter's Street" ? 34 : rd.n === 'French Row' ? 6 : 14 });
        });
      }
      add('handcart', 120, -150, 0.6);
      propBox(120, -150, 0.7, 1.1, -0.6, 1.2, {});
      add('dray', 70, -112, 0.4);
      propBox(70, -112, 1.0, 1.9, -0.4, 2, {});
    }
    // boundaries: barriers along openings (era appropriate)
    const barrierModel = eraId === 1897 ? 'hurdle' : eraId === 1964 ? 'trestle60' : 'barrier26';
    for (const seg of W.openings) {
      for (let i = 0; i < seg.length - 1; i++) {
        const a = seg[i], b = seg[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        // is this opening across a street (barrier) or along a park/yard edge (plain fence)?
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        const street = !!W.nearestRoad(mx, mz, (rr) => SA.Terrain.isCarriageway(rr) || rr.t === 'pedestrian', 7);
        const long = len > 14 && !street;
        const spacing = long ? 2.4 : 2.1;
        const n = Math.max(1, Math.round(len / spacing));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
          let model = long ? (eraId === 1897 ? 'fence97' : eraId === 1964 ? 'fence60' : 'fence26') : barrierModel;
          if (!long && eraId === 2026 && len > 12 && k % 3 === 1) model = 'heras';
          if (!long && eraId === 1897 && len > 8 && k % 3 === 1) model = 'crowdBarrier';
          add(model, x, z, -ang);
          if (!long && eraId === 1964 && k % 2 === 0) {
            (place.paraffin = place.paraffin || []).push({ x, z, rot: -ang, s: 1 });
            glows.push({ x, z, y: 1.3, color: 0xff3a22, size: 0.9 });
          }
          if (!long && eraId === 2026 && k % 3 === 0) add('cone', x + Math.sin(ang) * 0.9, z - Math.cos(ang) * 0.9, 0);
        }
        col.addBox((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, len / 2 + 0.3, 0.35, ang, { y0: -50, y1: 300, tag: 'barrier', cam: false });
      }
    }

    // ---- build instanced meshes
    const out = { lamps, glows, bunting, instanced: [] };
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const mk = (modelName, list, mat) => {
      let geo = MODELS[modelName];
      if (modelName === 'tree') return;
      if (!geo || !list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => {
        const y = p.y !== null && p.y !== undefined ? p.y : SA.Terrain.height(p.x, p.z);
        pos.set(p.x, y, p.z);
        q.setFromAxisAngle(up, p.rot);
        sc.set(p.s, p.s, p.s);
        mtx.compose(pos, q, sc);
        im.setMatrixAt(i, mtx);
      });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      im.name = 'props-' + modelName;
      im.computeBoundingSphere();
      group.add(im);
      out.instanced.push(im);
      return im;
    };
    for (const k in place) {
      if (k === 'tree') continue;
      const glassy = /Glass|Globe/.test(k);
      mk(k, place[k], glassy ? mats.propGlow : mats.prop);
      if (MODELS[k + 'Glass']) mk(k + 'Glass', place[k], mats.propGlow);
    }
    if (place.tree) {
      // trees: three variants per species, each an instanced trunk and an instanced crown
      const hi = SA.Game.settings.quality !== 'low';
      const groups = {};
      place.tree.forEach((p, i) => {
        const key = (p.sp || 'lime') + ':' + (i % 3);
        (groups[key] = groups[key] || []).push(p);
      });
      for (const key in groups) {
        const [sp, vi] = key.split(':');
        const v = SA.Trees.variants(sp, hi)[+vi];
        MODELS['treeBark_' + key] = v.bark;
        MODELS['treeLeaves_' + key] = v.leaves;
        mk('treeBark_' + key, groups[key], mats.bark);
        const im = mk('treeLeaves_' + key, groups[key], mats.leaves);
        if (im) im.receiveShadow = true;
      }
    }
    // lamp glows (sprites) for the dusk era and Belisha globes
    if (eraId === 1897 || eraId === 1964) {
      for (const l of lamps) {
        if (eraId === 1897) glows.push({ x: l.x, z: l.z, y: 3.45, color: 0xffc46a, size: 3.2, pool: true });
      }
    }
    if (place.belishaGlobe) for (const p of place.belishaGlobe) glows.push({ x: p.x, z: p.z, y: 2.55, color: 0xffae1a, size: 0.9 });
    if (glows.length) {
      const gt = P.glowTex || (P.glowTex = SA.Tex.glowTexture());
      const pts = new Float32Array(glows.length * 3), cols = new Float32Array(glows.length * 3), sizes = [];
      glows.forEach((g, i) => {
        pts[i * 3] = g.x;
        pts[i * 3 + 1] = SA.Terrain.height(g.x, g.z) + g.y;
        pts[i * 3 + 2] = g.z;
        const c = new THREE.Color(g.color);
        cols[i * 3] = c.r;
        cols[i * 3 + 1] = c.g;
        cols[i * 3 + 2] = c.b;
        sizes.push(g.size);
      });
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      gg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const pm = new THREE.PointsMaterial({ size: eraId === 1897 ? 2.6 : 1.0, map: gt, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, opacity: 0.9 });
      const ps = new THREE.Points(gg, pm);
      ps.name = 'glows';
      group.add(ps);
      // ground light pools under gas lamps
      if (eraId === 1897) {
        const pools = glows.filter((g) => g.pool);
        const pg = new THREE.PlaneGeometry(1, 1);
        pg.rotateX(-Math.PI / 2);
        const pmat = new THREE.MeshBasicMaterial({ map: gt, color: 0xffb060, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });
        const im = new THREE.InstancedMesh(pg, pmat, pools.length);
        pools.forEach((g, i) => {
          pos.set(g.x, SA.Terrain.height(g.x, g.z) + 0.06, g.z);
          q.identity();
          sc.set(9, 1, 9);
          mtx.compose(pos, q, sc);
          im.setMatrixAt(i, mtx);
        });
        im.name = 'lamp-pools';
        group.add(im);
      }
    }
    // bunting (1897): catenary lines of small flags
    if (bunting.length) {
      const flagGeo = new THREE.BufferGeometry();
      const fp = [], fc = [];
      const colors = [new THREE.Color('#c8102e'), new THREE.Color('#f2f2f2'), new THREE.Color('#1d3c8e')];
      for (const b of bunting) {
        const dx = Math.cos(b.rot), dz = -Math.sin(b.rot); // across street (perpendicular to road dir)
        const half = b.w / 2;
        const y0 = SA.Terrain.height(b.x, b.z) + 6.2;
        const n = Math.floor(b.w / 0.7);
        for (let i = 0; i < n; i++) {
          const t = i / n, t1 = (i + 0.6) / n;
          const sag = (u) => -1.4 * 4 * u * (1 - u);
          const p0 = [b.x + dx * (t - 0.5) * 2 * half, y0 + sag(t), b.z + dz * (t - 0.5) * 2 * half];
          const p1 = [b.x + dx * (t1 - 0.5) * 2 * half, y0 + sag(t1), b.z + dz * (t1 - 0.5) * 2 * half];
          const pm = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.45, (p0[2] + p1[2]) / 2];
          fp.push(...p0, ...p1, ...pm, ...p1, ...p0, ...pm);
          const c = colors[i % 3];
          for (let k = 0; k < 6; k++) fc.push(c.r, c.g, c.b);
        }
      }
      flagGeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
      flagGeo.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
      flagGeo.computeVertexNormals();
      const bm = new THREE.Mesh(flagGeo, mats.bunting);
      bm.name = 'bunting';
      group.add(bm);
    }
    return out;
  };
})();
