/* Road markings and kerbs, laid on the ground as thin strips that follow the terrain: granite kerbs
   with a gutter along every carriageway (all three years), white centre dashes (1964, 2026),
   yellow waiting lines along the kerbs (a single line in 1964, double in 2026) and zebra crossings
   at the Belisha beacons. Pieces that would cross another carriageway at a junction are left out. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const RM = (SA.RoadMarks = {});

  // segment grid for "is this point on another carriageway?"
  function segGrid(roads) {
    const cell = 20, grid = new Map();
    for (const r of roads) {
      const hw = SA.Terrain.roadWidth(r) / 2;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1];
        const s = { r, a, b, hw };
        const x0 = Math.floor((Math.min(a[0], b[0]) - hw) / cell), x1 = Math.floor((Math.max(a[0], b[0]) + hw) / cell);
        const z0 = Math.floor((Math.min(a[1], b[1]) - hw) / cell), z1 = Math.floor((Math.max(a[1], b[1]) + hw) / cell);
        for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
          const k = gx + ',' + gz;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(s);
        }
      }
    }
    return {
      // inside a carriageway other than `self` (with a small margin)
      onOther(x, z, self, margin) {
        const list = grid.get(Math.floor(x / cell) + ',' + Math.floor(z / cell));
        if (!list) return false;
        for (const s of list) {
          if (s.r === self) continue;
          const d = Math.sqrt(U.distToSeg2 ? U.distToSeg2(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) : segDist2(x, z, s.a, s.b));
          if (d < s.hw - (margin || 0)) return true;
        }
        return false;
      },
    };
  }
  function segDist2(x, z, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1;
    const t = U.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1);
    const px = a[0] + dx * t - x, pz = a[1] + dz * t - z;
    return px * px + pz * pz;
  }

  RM.build = function (eraId, group, mats) {
    const W = SA.World, T = SA.Terrain;
    const roads = W.roads.filter((r) => T.isCarriageway(r));
    const grid = segGrid(roads);
    const pos = [], nor = [], col = [], base = [];
    const tmp = new THREE.Color();
    // a strip from p0 to p1 (ground x,z), offset sideways from the line by o0..o1 metres
    function strip(p0, p1, o0, o1, lift, hex, self, keepJunction) {
      const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.05) return;
      const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
      const n = Math.max(1, Math.ceil(len / 1.5));
      tmp.set(hex);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const ax = p0[0] + dx * t0, az = p0[1] + dz * t0, bx = p0[0] + dx * t1, bz = p0[1] + dz * t1;
        const mx = (ax + bx) / 2 + nx * (o0 + o1) / 2, mz = (az + bz) / 2 + nz * (o0 + o1) / 2;
        if (!keepJunction && grid.onOther(mx, mz, self, 0.3)) continue;
        const q = [[ax + nx * o0, az + nz * o0], [bx + nx * o0, bz + nz * o0], [bx + nx * o1, bz + nz * o1], [ax + nx * o1, az + nz * o1]];
        const ys = q.map((p) => T.height(p[0], p[1]));
        // two triangles, facing up
        for (const k of [0, 1, 2, 0, 2, 3]) {
          pos.push(q[k][0], ys[k] + lift, q[k][1]);
          nor.push(0, 1, 0);
          col.push(tmp.r, tmp.g, tmp.b);
          base.push(ys[k]);
        }
      }
    }
    // the polyline from distance s0 to s1 along r, as a list of points
    function along(r, s0, s1, cb) {
      let acc = 0;
      for (let i = 0; i < r.p.length - 1; i++) {
        const a = r.p[i], b = r.p[i + 1];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const lo = Math.max(s0, acc), hi = Math.min(s1, acc + l);
        if (hi > lo) {
          const f0 = (lo - acc) / l, f1 = (hi - acc) / l;
          cb([a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0], [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1]);
        }
        acc += l;
        if (acc > s1) break;
      }
    }
    const length = (r) => {
      let l = 0;
      for (let i = 0; i < r.p.length - 1; i++) l += Math.hypot(r.p[i + 1][0] - r.p[i][0], r.p[i + 1][1] - r.p[i][1]);
      return l;
    };
    for (const r of roads) {
      const surf = W.roadSurface(eraId, r);
      if (surf === 'paving') continue;
      const hw = T.roadWidth(r) / 2;
      const L = length(r);
      // kerbs: granite edging and a dark gutter, on metalled roads in every year
      if (surf !== 'dirt' || eraId !== 1897 || r.t !== 'service') {
        for (const side of [1, -1]) {
          along(r, 0, L, (a, b) => {
            strip(a, b, side * (hw - 0.3), side * (hw - 0.04), 0.012, eraId === 1897 ? '#3a3631' : '#3c3c3b', r);
            strip(a, b, side * (hw - 0.04), side * (hw + 0.24), 0.03, eraId === 1897 ? '#8d877c' : '#9a9893', r);
          });
        }
      }
      if (surf !== 'asphalt' || eraId === 1897) continue;
      // centre dashes on two-way roads wide enough to have them
      if (hw * 2 >= 6 && !r.ow && L > 12) {
        for (let s = 4; s < L - 4; s += 9) along(r, s, Math.min(s + 3, L - 4), (a, b) => strip(a, b, -0.05, 0.05, 0.02, '#e8e6df', r));
      }
      // yellow lines along the kerbs (no waiting): single in 1964, double in 2026
      if (r.t !== 'service') {
        for (const side of [1, -1]) {
          along(r, 2, L - 2, (a, b) => {
            strip(a, b, side * (hw - 0.42), side * (hw - 0.34), 0.02, '#e2b324', r);
            if (eraId === 2026) strip(a, b, side * (hw - 0.6), side * (hw - 0.52), 0.02, '#e2b324', r);
          });
        }
      }
    }
    // zebra crossings at the Belisha beacons
    for (const f of W.features) {
      if (f.k !== 'highway=crossing' || eraId === 1897) continue;
      const nr = W.nearestRoad(f.x, f.z, (rd) => T.isCarriageway(rd) && rd.t !== 'service', 6);
      if (!nr || W.roadSurface(eraId, nr.road) !== 'asphalt') continue;
      const hw = T.roadWidth(nr.road) / 2;
      const dx = nr.b[0] - nr.a[0], dz = nr.b[1] - nr.a[1];
      const l = Math.hypot(dx, dz) || 1;
      const ux = dx / l, uz = dz / l;
      for (let k = -3; k <= 3; k++) {
        const cx = nr.x + ux * k * 1.0, cz = nr.z + uz * k * 1.0;
        // a stripe across the road, half a metre wide
        strip([cx + uz * hw * 0.92, cz - ux * hw * 0.92], [cx - uz * hw * 0.92, cz + ux * hw * 0.92], -0.25, 0.25, 0.024, '#efede6', nr.road, true);
      }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aBase', new THREE.Float32BufferAttribute(base, 1));
    g.computeBoundingSphere();
    const m = SA.Tex.waveMaterial(mats.uniforms, { vertexColors: true, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.name = 'road-markings';
    group.add(mesh);
    return mesh;
  };
})();
