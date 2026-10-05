/* Navigation graphs per era: a pavement graph for pedestrians and a lane graph for traffic (UK: keep left). */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const Nav = (SA.Nav = {});

  function Graph() {
    this.nodes = [];
    this.grid = new Map();
    this.cell = 10;
  }
  Graph.prototype.key = function (x, z) {
    return Math.floor(x / this.cell) * 7919 + Math.floor(z / this.cell);
  };
  Graph.prototype.add = function (x, z, data) {
    const n = { id: this.nodes.length, x, z, nb: [], data: data || null };
    this.nodes.push(n);
    const k = this.key(x, z);
    let a = this.grid.get(k);
    if (!a) this.grid.set(k, (a = []));
    a.push(n);
    return n;
  };
  Graph.prototype.near = function (x, z, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const a = this.grid.get(i * 7919 + j);
        if (!a) continue;
        for (const n of a) if (U.dist2(n.x, n.z, x, z) <= r * r) fn(n);
      }
  };
  Graph.prototype.nearest = function (x, z, r) {
    let best = null, bd = Infinity;
    this.near(x, z, r || 30, (n) => {
      const d = U.dist2(n.x, n.z, x, z);
      if (d < bd) {
        bd = d;
        best = n;
      }
    });
    return best;
  };
  Graph.prototype.link = function (a, b) {
    if (a === b || a.nb.indexOf(b) >= 0) return;
    a.nb.push(b);
    b.nb.push(a);
  };
  Nav.Graph = Graph;

  // ------------------------------------------------------------------ pedestrians
  Nav.buildPed = function (era) {
    const W = SA.World, col = era.col;
    const g = new Graph();
    const free = (x, z) => W.inDistrict(x, z) && col.isFree(x, z, 0.55, 'walk');
    const lines = [];
    for (const r of W.roads) {
      const carr = SA.Terrain.isCarriageway(r);
      if (carr && r.t === 'service') continue;
      if (carr) {
        const off = SA.Terrain.roadWidth(r) / 2 + 1.5;
        lines.push({ p: r.p, off: off, side: 1 }, { p: r.p, off: off, side: -1 });
      } else if (r.t === 'pedestrian' || r.t === 'footway' || r.t === 'steps' || r.t === 'path') {
        if (r.n === "St Peter's Street") {
          lines.push({ p: r.p, off: 3, side: 1 }, { p: r.p, off: 3, side: -1 });
        }
        lines.push({ p: r.p, off: 0, side: 1 });
      }
    }
    for (const L of lines) {
      let prev = null;
      const pts = L.p;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const len = Math.hypot(dx, dz);
        if (len < 0.1) continue;
        const ux = dx / len, uz = dz / len;
        const nx = -uz * L.side, nz = ux * L.side;
        const steps = Math.max(1, Math.round(len / 5));
        for (let k = 0; k <= steps; k++) {
          if (k === 0 && i > 0) continue;
          const t = k / steps;
          const x = a[0] + dx * t + nx * L.off, z = a[1] + dz * t + nz * L.off;
          if (!free(x, z)) {
            prev = null;
            continue;
          }
          let n = null;
          g.near(x, z, 1.6, (m) => (n = n || m));
          if (!n) n = g.add(x, z);
          if (prev && prev !== n && col.lineOfSight(prev.x, prev.z, n.x, n.z)) g.link(prev, n);
          prev = n;
        }
      }
    }
    // stitch: connect nearby nodes (junction corners, both sides of narrow streets)
    for (const n of g.nodes) {
      g.near(n.x, n.z, 7.5, (m) => {
        if (m === n || n.nb.indexOf(m) >= 0) return;
        if (n.nb.length > 5) return;
        if (col.lineOfSight(n.x, n.z, m.x, m.z) && W.inDistrict((n.x + m.x) / 2, (n.z + m.z) / 2)) g.link(n, m);
      });
    }
    // crossings: link across roads at OSM crossings and road ends
    for (const f of W.features) {
      if (f.k !== 'highway=crossing' && f.k !== 'highway=traffic_signals') continue;
      const near = [];
      g.near(f.x, f.z, 11, (m) => near.push(m));
      for (let i = 0; i < near.length; i++)
        for (let j = i + 1; j < near.length; j++) {
          const a = near[i], b = near[j];
          if (U.dist(a.x, a.z, b.x, b.z) > 8 && col.lineOfSight(a.x, a.z, b.x, b.z)) {
            g.link(a, b);
            a.crossing = b.crossing = true;
          }
        }
    }
    // remove tiny islands
    const seen = new Uint8Array(g.nodes.length);
    let bestComp = null;
    for (const n of g.nodes) {
      if (seen[n.id]) continue;
      const comp = [];
      const st = [n];
      seen[n.id] = 1;
      while (st.length) {
        const c = st.pop();
        comp.push(c);
        for (const m of c.nb)
          if (!seen[m.id]) {
            seen[m.id] = 1;
            st.push(m);
          }
      }
      if (!bestComp || comp.length > bestComp.length) bestComp = comp;
      for (const c of comp) c.comp = comp.length;
    }
    g.main = bestComp || [];
    return g;
  };

  // ------------------------------------------------------------------ traffic lanes
  Nav.TRAFFIC_ROADS = {
    2026: ['High Street', 'Chequer Street', "St Peter's Street", 'Victoria Street', 'London Road', 'Holywell Hill', 'George Street', 'Verulam Road', 'Romeland', 'Romeland Hill', 'Upper Dagnall Street'],
    1964: ['High Street', 'Chequer Street', "St Peter's Street", 'Victoria Street', 'London Road', 'Holywell Hill', 'George Street', 'Verulam Road', 'Market Place', 'Romeland', 'Romeland Hill', 'Upper Dagnall Street'],
    1897: ['High Street', 'Chequer Street', "St Peter's Street", 'Victoria Street', 'London Road', 'Holywell Hill', 'George Street', 'Verulam Road', 'Market Place', 'Romeland', 'Romeland Hill', 'Upper Dagnall Street'],
  };
  Nav.buildLanes = function (era) {
    const W = SA.World;
    const names = Nav.TRAFFIC_ROADS[era.id];
    const g = new Graph();
    g.cell = 12;
    const getNode = (x, z) => {
      let n = null;
      g.near(x, z, 1.2, (m) => (n = n || m));
      return n || g.add(x, z);
    };
    for (const r of W.roads) {
      if (!SA.Terrain.isCarriageway(r) || r.t === 'service') continue;
      if (names.indexOf(r.n) < 0) continue;
      if (r.n === 'Market Place' && r.t === 'pedestrian') continue;
      let prev = null;
      for (let i = 0; i < r.p.length; i++) {
        const p = r.p[i];
        // resample long segments
        if (prev) {
          const len = U.dist(prev.x, prev.z, p[0], p[1]);
          const steps = Math.max(1, Math.round(len / 9));
          for (let k = 1; k <= steps; k++) {
            const t = k / steps;
            const n = getNode(prev.x + (p[0] - prev.x) * t, prev.z + (p[1] - prev.z) * t);
            if (n !== prev) {
              n.road = r;
              g.link(prev, n);
              prev = n;
            }
          }
        } else {
          prev = getNode(p[0], p[1]);
          prev.road = r;
        }
      }
    }
    // keep nodes inside (or just outside) the district only
    for (const n of g.nodes) {
      n.inside = W.inDistrict(n.x, n.z);
      n.dead = n.nb.length === 1;
    }
    return g;
  };

  Nav.buildFor = function (era) {
    era.ped = Nav.buildPed(era);
    era.lanes = Nav.buildLanes(era);
  };

  // random pavement node within radius of a point, preferring the main component
  Nav.randomPedNode = function (era, x, z, rmin, rmax, rng) {
    const g = era.ped;
    const r = rng || Math.random;
    for (let i = 0; i < 40; i++) {
      const n = g.main[Math.floor(r() * g.main.length)];
      if (!n) return null;
      const d = U.dist(n.x, n.z, x, z);
      if (d >= rmin && d <= rmax) return n;
    }
    return g.main[Math.floor(r() * g.main.length)] || null;
  };
})();
