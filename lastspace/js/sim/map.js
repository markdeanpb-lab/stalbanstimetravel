/* LAST SPACE - the arena: builds the neighbourhood from the OpenStreetMap centrelines in LS.MAPDATA.
   Produces distance fields (kerb and garden-wall lines with rounded junction corners), the wall
   colliders, parking strips filled with residents' cars, the pool of possible scoring spaces,
   lamp posts, bins, signs, house plots and the navigation graph the bots drive on.
   Pure data + physics bodies: no three.js here, so it also runs in Node for tests. */
(function (LS) {
  'use strict';
  const U = LS.U, Body = LS.Physics.Body;

  // Game-side street configuration. hc = half carriageway (kerb to centre), pave = pavement width.
  // Real carriageways here are roughly 7-8 m; widened slightly so eight cars can actually fight.
  const STREET_CFG = {
    'Dalton Street': { hc: 4.35, pave: 1.9, park: [1, 1], zone: 'Dalton' },
    'Bernard Street': { hc: 4.35, pave: 1.9, park: [1, 1], zone: 'Bernard' },
    'Church Street': { hc: 4.15, pave: 1.8, park: [1, 1], zone: 'Church' },
    'Grange Street': { hc: 4.7, pave: 2.1, park: [1, 1], zone: 'Grange' },
    'Catherine Street': { hc: 5.0, pave: 2.4, park: [0, 0], zone: 'Catherine', mainRoad: true },
    'Grange Court': { hc: 3.0, pave: 1.0, park: [0, 0], zone: 'Bernard', drive: true },
  };
  const KERB_ROUND = 4.5, WALL_ROUND = 3.5;
  const PARK_STRIP = 2.3;

  // ---------------------------------------------------------------- vehicle sizes used for slots
  // (the contestants' specs live in vehicles.js; parked residents' cars use these footprints)
  const RESIDENT_TYPES = [
    { model: 'suv', L: 5.0, W: 2.0, m: 2400, p: 0.22 },
    { model: 'mega', L: 5.35, W: 2.12, m: 2700, p: 0.16 },
    { model: 'estate', L: 4.75, W: 1.85, m: 1550, p: 0.22 },
    { model: 'hatch', L: 3.95, W: 1.75, m: 1100, p: 0.18 },
    { model: 'van', L: 5.2, W: 2.0, m: 2300, p: 0.08 },
    { model: 'saloon', L: 4.6, W: 1.82, m: 1450, p: 0.14 },
  ];

  // ---------------------------------------------------------------- the pool of possible scoring spaces
  // street, s = metres along the centreline from its first point, side +1 = left of the line's direction.
  // kinds: tight (parallel, cars at both ends), wide (big gap that draws a crowd), junction (awkward,
  // near a corner), small (favours small cars; one end left open so a van can still nose in), bay
  // (perpendicular car-park bay - reverse in or nose in).
  const SPACE_KINDS = {
    tight: { L: 6.55, W: 2.55 },
    wide: { L: 7.7, W: 3.0 },
    junction: { L: 6.8, W: 2.6 },
    small: { L: 5.9, W: 2.45 },
    bay: { L: 5.9, W: 2.95 },
  };

  class Arena {
    constructor(seed) {
      this.rand = U.rng(seed || 1);
      this.streets = [];
      this.byName = {};
      const D = LS.MAPDATA;
      for (const s of D.streets) this.addStreet(s.name, s.pts, s);
      // Grange Court: the residents' car park off Bernard Street (OSM way 167866271, drive 167866262)
      const dr = D.carparkDrive;
      const drivePts = [dr[6], dr[5], [-6.6, 63.6]];
      this.addStreet('Grange Court', drivePts, { oneway: null, osm: ['167866262'] });
      const cp = D.carpark; // diamond: corners
      const cx = (cp[0][0] + cp[1][0] + cp[2][0] + cp[3][0]) / 4, cy = (cp[0][1] + cp[1][1] + cp[2][1] + cp[3][1]) / 4;
      const ax = cp[2][0] - cp[1][0], ay = cp[2][1] - cp[1][1];
      this.carpark = { x: cx, y: cy, a: Math.atan2(ay, ax), hx: 9.2, hy: 9.6 }; // a little roomier than the real one so an SUV can use it
      this.junctions = D.junctions.map((j) => ({ ...j }));
      this.junctions.push({ name: 'GrangeCourt/Bernard', streets: ['Grange Court', 'Bernard Street'], x: drivePts[0][0], y: drivePts[0][1] });
      this.pois = D.pois;
      this.buildFields();
      this.buildContours();
      this.defineBarriers();
      this.buildNav();
      this.defineSpaces();
      this.defineSlots();
      this.defineProps();
      this.defineHouses();
    }

    addStreet(name, pts, src) {
      const cfg = STREET_CFG[name];
      const st = { name, cfg, line: new U.Polyline(pts), oneway: src.oneway, osm: src.osm, chokers: [] };
      st.hcAt = (s) => {
        let h = cfg.hc;
        for (const c of st.chokers) { const d = Math.abs(s - c.s); if (d < c.len) h = Math.min(h, U.lerp(c.hc, cfg.hc, U.smooth((d - c.len * 0.4) / (c.len * 0.6)))); }
        return h;
      };
      this.streets.push(st); this.byName[name] = st;
      return st;
    }

    // ---------------------------------------------------------------- distance fields
    buildFields() {
      // traffic-calming choker on Church Street (OSM node 1645283873): kerbs pinch in
      for (const p of this.pois) {
        if (p.kind === 'choker') {
          for (const st of this.streets) {
            const pr = st.line.project(p.x, p.y);
            if (pr.d < 3 && !st.cfg.mainRoad) st.chokers.push({ s: pr.s, hc: 2.45, len: 6 });
          }
        }
      }
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (const st of this.streets) for (const p of st.line.pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
      const pad = 30, R = 0.5;
      this.gx0 = Math.floor(minx - pad); this.gy0 = Math.floor(miny - pad);
      this.gw = Math.ceil((maxx - minx + 2 * pad) / R) + 1; this.gh = Math.ceil((maxy - miny + 2 * pad) / R) + 1;
      this.gres = R;
      const N = this.gw * this.gh;
      this.G = new Float32Array(N); // kerb field: < 0 on carriageway
      this.F = new Float32Array(N); // wall field: < 0 inside the street corridor (road + pavement)
      this.SID = new Uint8Array(N); // nearest street index
      const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
      const segs = [];
      this.streets.forEach((st, i) => {
        const P = st.line.pts;
        for (let k = 0; k < P.length - 1; k++) segs.push({ i, ax: P[k][0], ay: P[k][1], bx: P[k + 1][0], by: P[k + 1][1], s0: st.line.cum[k], s1: st.line.cum[k + 1] });
      });
      const cpk = this.carpark;
      const nS = this.streets.length;
      const dmin = new Float32Array(nS), smid = new Float32Array(nS);
      for (let gy = 0; gy < this.gh; gy++) {
        const y = this.gy0 + gy * R;
        for (let gx = 0; gx < this.gw; gx++) {
          const x = this.gx0 + gx * R;
          dmin.fill(1e9);
          for (const sg of segs) {
            const dx = sg.bx - sg.ax, dy = sg.by - sg.ay, l2 = dx * dx + dy * dy;
            let t = ((x - sg.ax) * dx + (y - sg.ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = sg.ax + dx * t - x, qy = sg.ay + dy * t - y, d = Math.sqrt(qx * qx + qy * qy);
            if (d < dmin[sg.i]) { dmin[sg.i] = d; smid[sg.i] = sg.s0 + t * (sg.s1 - sg.s0); }
          }
          let g = 1e9, f = 1e9, best = 0, bd = 1e9;
          for (let i = 0; i < nS; i++) {
            const st = this.streets[i];
            const gi = dmin[i] - st.hcAt(smid[i]);
            const fi = dmin[i] - st.cfg.hc - st.cfg.pave;
            g = smin(g, gi, KERB_ROUND); f = smin(f, fi, WALL_ROUND);
            if (gi < bd) { bd = gi; best = i; }
          }
          // car park box
          const lx0 = x - cpk.x, ly0 = y - cpk.y, ca = Math.cos(cpk.a), sa = Math.sin(cpk.a);
          const lx = Math.abs(ca * lx0 + sa * ly0) - cpk.hx, ly = Math.abs(-sa * lx0 + ca * ly0) - cpk.hy;
          const db = Math.hypot(Math.max(lx, 0), Math.max(ly, 0)) + Math.min(Math.max(lx, ly), 0);
          g = smin(g, db, 2.0); f = smin(f, db - 1.0, 2.0);
          if (db < bd) best = 255;
          const idx = gy * this.gw + gx;
          this.G[idx] = g; this.F[idx] = f; this.SID[idx] = best;
        }
      }
    }
    _sample(A, x, y) {
      const R = this.gres;
      let fx = (x - this.gx0) / R, fy = (y - this.gy0) / R;
      if (fx < 0 || fy < 0 || fx >= this.gw - 1 || fy >= this.gh - 1) return 50;
      const ix = fx | 0, iy = fy | 0; fx -= ix; fy -= iy;
      const i = iy * this.gw + ix, W = this.gw;
      return (A[i] * (1 - fx) + A[i + 1] * fx) * (1 - fy) + (A[i + W] * (1 - fx) + A[i + W + 1] * fx) * fy;
    }
    kerb(x, y) { return this._sample(this.G, x, y); }
    wall(x, y) { return this._sample(this.F, x, y); }
    kerbGrad(x, y) {
      const e = 0.25, gx = this.kerb(x + e, y) - this.kerb(x - e, y), gy = this.kerb(x, y + e) - this.kerb(x, y - e);
      const l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l];
    }
    streetAt(x, y) {
      const R = this.gres, ix = Math.round((x - this.gx0) / R), iy = Math.round((y - this.gy0) / R);
      if (ix < 0 || iy < 0 || ix >= this.gw || iy >= this.gh) return null;
      const s = this.SID[iy * this.gw + ix]; return s === 255 ? this.byName['Grange Court'] : this.streets[s];
    }

    // ---------------------------------------------------------------- marching squares
    contours(A, iso) {
      const W = this.gw, H = this.gh, R = this.gres, x0 = this.gx0, y0 = this.gy0;
      const segs = new Map(); // key of start edge point -> [end key, coords]
      const pts = new Map();
      const ekey = (ix, iy, dir) => (iy * W + ix) * 2 + dir; // dir 0: horizontal edge to the right, 1: vertical edge up
      const epos = (ix, iy, dir) => {
        const k = ekey(ix, iy, dir);
        if (!pts.has(k)) {
          const a = A[iy * W + ix] - iso, b = dir === 0 ? A[iy * W + ix + 1] - iso : A[(iy + 1) * W + ix] - iso;
          const t = a / (a - b);
          pts.set(k, dir === 0 ? [x0 + (ix + t) * R, y0 + iy * R] : [x0 + ix * R, y0 + (iy + t) * R]);
        }
        return k;
      };
      const next = new Map();
      for (let iy = 0; iy < H - 1; iy++) for (let ix = 0; ix < W - 1; ix++) {
        const v0 = A[iy * W + ix] - iso, v1 = A[iy * W + ix + 1] - iso, v2 = A[(iy + 1) * W + ix + 1] - iso, v3 = A[(iy + 1) * W + ix] - iso;
        const c = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0);
        if (c === 0 || c === 15) continue;
        const eB = () => epos(ix, iy, 0), eR = () => epos(ix + 1, iy, 1), eT = () => epos(ix, iy + 1, 0), eL = () => epos(ix, iy, 1);
        // orient so that the negative (inside) region is on the left of each segment
        const add = (a, b) => next.set(a, b);
        switch (c) {
          case 1: add(eL(), eB()); break;
          case 2: add(eB(), eR()); break;
          case 3: add(eL(), eR()); break;
          case 4: add(eR(), eT()); break;
          case 5: { const m = (v0 + v1 + v2 + v3) / 4; if (m < 0) { add(eL(), eT()); add(eR(), eB()); } else { add(eL(), eB()); add(eR(), eT()); } break; }
          case 6: add(eB(), eT()); break;
          case 7: add(eL(), eT()); break;
          case 8: add(eT(), eL()); break;
          case 9: add(eT(), eB()); break;
          case 10: { const m = (v0 + v1 + v2 + v3) / 4; if (m < 0) { add(eB(), eL()); add(eT(), eR()); } else { add(eB(), eR()); add(eT(), eL()); } break; }
          case 11: add(eT(), eR()); break;
          case 12: add(eR(), eL()); break;
          case 13: add(eR(), eB()); break;
          case 14: add(eB(), eL()); break;
        }
      }
      const lines = [], used = new Set();
      // chain: start from keys that are not anyone's successor (open lines) then closed loops
      const preds = new Set(next.values());
      const walk = (start) => {
        const line = [pts.get(start)]; used.add(start);
        let k = next.get(start);
        while (k !== undefined && !used.has(k)) { line.push(pts.get(k)); used.add(k); k = next.get(k); }
        if (k === start) line.push(pts.get(start));
        return line;
      };
      for (const k of next.keys()) if (!preds.has(k) && !used.has(k)) lines.push(walk(k));
      for (const k of next.keys()) if (!used.has(k)) lines.push(walk(k));
      return lines.map((l) => simplify(l, 0.06)).filter((l) => l.length > 1);
    }

    buildContours() {
      this.kerbLines = this.contours(this.G, 0);
      this.wallLines = this.contours(this.F, 0);
      this.wallCentre = this.contours(this.F, 0.22);
    }

    // ---------------------------------------------------------------- road-closed barriers at the stub ends
    defineBarriers() {
      this.barriers = [];
      const add = (name, s, label) => {
        const st = this.byName[name], p = st.line.at(s);
        const half = st.cfg.hc + st.cfg.pave + 0.6;
        this.barriers.push({ street: name, s, x: p.x, y: p.y, a: p.heading + Math.PI / 2, half, label });
      };
      const g = this.byName['Grange Street'].line, c = this.byName['Catherine Street'].line;
      add('Grange Street', 13, 'ROAD CLOSED - GAS MAIN WORKS');
      add('Grange Street', g.length - 12, 'ROAD CLOSED');
      add('Catherine Street', 12, 'ROAD CLOSED - RESURFACING');
      add('Catherine Street', c.length - 12, 'ROAD CLOSED');
    }

    // ---------------------------------------------------------------- navigation graph
    buildNav() {
      const nodes = [], edges = [];
      const nodeAt = (x, y, name) => {
        for (const n of nodes) if (Math.hypot(n.x - x, n.y - y) < 2.5) return n;
        const n = { id: nodes.length, x, y, name, edges: [] }; nodes.push(n); return n;
      };
      // cut points per street
      const cuts = new Map();
      for (const st of this.streets) cuts.set(st.name, []);
      for (const j of this.junctions) {
        const n = nodeAt(j.x, j.y, j.name);
        for (const sn of j.streets) {
          const st = this.byName[sn]; const pr = st.line.project(j.x, j.y);
          cuts.get(sn).push({ s: pr.s, node: n });
        }
      }
      for (const b of this.barriers) {
        const st = this.byName[b.street];
        const s = b.s + (b.s < st.line.length / 2 ? 4 : -4);
        const p = st.line.at(s);
        cuts.get(b.street).push({ s, node: nodeAt(p.x, p.y, 'end ' + b.street), end: true });
      }
      // Grange Court ends inside the car park
      {
        const st = this.byName['Grange Court'], p = st.line.at(st.line.length);
        cuts.get('Grange Court').push({ s: st.line.length, node: nodeAt(this.carpark.x, this.carpark.y, 'Grange Court car park'), end: true });
      }
      for (const st of this.streets) {
        const cs = cuts.get(st.name).sort((a, b) => a.s - b.s);
        for (let i = 0; i < cs.length - 1; i++) {
          const a = cs[i], b = cs[i + 1];
          if (b.s - a.s < 1) continue;
          const pts = [[a.node.x, a.node.y]];
          for (let k = 0; k < st.line.pts.length; k++) if (st.line.cum[k] > a.s + 0.5 && st.line.cum[k] < b.s - 0.5) pts.push(st.line.pts[k]);
          pts.push([b.node.x, b.node.y]);
          const e = { id: edges.length, a: a.node.id, b: b.node.id, street: st.name, s0: a.s, s1: b.s, line: new U.Polyline(pts), penalty: 0 };
          e.length = e.line.length;
          edges.push(e); a.node.edges.push(e); b.node.edges.push(e);
        }
      }
      this.nav = { nodes, edges };
    }
    // nearest point on the nav graph
    navProject(x, y) {
      let best = null;
      for (const e of this.nav.edges) {
        const p = e.line.project(x, y);
        if (!best || p.d < best.d) best = { d: p.d, e, s: p.s, x: p.x, y: p.y };
      }
      return best;
    }
    // shortest path between two projections; returns a polyline of points
    navPath(fromX, fromY, toX, toY, opts) {
      opts = opts || {};
      const A = this.navProject(fromX, fromY), B = this.navProject(toX, toY);
      const nodes = this.nav.nodes;
      const P = opts.penalty || (() => 0);
      const pen = (e) => e.length + P(e) + (e.street === 'Grange Court' ? 25 : 0);
      // which way along A's edge is "ahead" of the car? turning round costs extra
      let costToA = A.s, costToB = A.e.length - A.s, turnA = 0, turnB = 0;
      if (opts.heading != null) {
        const t = A.e.line.at(A.s);
        const fwd = Math.cos(opts.heading) * t.tx + Math.sin(opts.heading) * t.ty; // >0: heading towards b
        const tp = opts.turnPenalty != null ? opts.turnPenalty : 40;
        // turning round = reversing back to the junction behind (slow) plus the turn itself
        if (fwd > 0.2) turnA = tp + A.s * 1.6; else if (fwd < -0.2) turnB = tp + (A.e.length - A.s) * 1.6;
      }
      let direct = null;
      if (A.e === B.e) {
        const back = B.s < A.s; // travelling towards a
        direct = Math.abs(B.s - A.s) + (back ? turnA : turnB);
      }
      // dijkstra seeded from both ends of A's edge
      const dist = new Float64Array(nodes.length).fill(1e12), prev = new Array(nodes.length).fill(null), done = new Uint8Array(nodes.length);
      dist[A.e.a] = costToA + turnA + P(A.e) * A.s / A.e.length;
      dist[A.e.b] = costToB + turnB + P(A.e) * (1 - A.s / A.e.length);
      for (;;) {
        let u = -1, bd = 1e12;
        for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
        if (u < 0) break;
        done[u] = 1;
        for (const e of nodes[u].edges) {
          if (e === A.e) continue;
          const v = e.a === u ? e.b : e.a, nd = dist[u] + pen(e);
          if (nd < dist[v]) { dist[v] = nd; prev[v] = e; }
        }
      }
      // arriving at B along its edge from a or from b (coming straight back down the edge we started on = U-turn)
      let viaA = dist[B.e.a] + B.s, viaB = dist[B.e.b] + (B.e.length - B.s);
      if (A.e === B.e) {
        const tp = opts.turnPenalty != null ? opts.turnPenalty : 40;
        if (!prev[B.e.a] && opts.heading != null) viaA += tp;
        if (!prev[B.e.b] && opts.heading != null) viaB += tp;
      }
      if (direct != null && direct <= Math.min(viaA, viaB) + 1e-6) {
        return { pts: sliceLine(A.e.line, A.s, B.s), length: direct, edges: [A.e], turn: B.s < A.s ? turnA > 0 : turnB > 0 };
      }
      const endNode = viaA <= viaB ? B.e.a : B.e.b;
      const chain = [];
      let n = endNode;
      while (prev[n]) { const e = prev[n]; chain.unshift({ e, from: e.a === n ? e.b : e.a, to: n }); n = chain[0].from; }
      const startNode = n;
      let pts = sliceLine(A.e.line, A.s, startNode === A.e.a ? 0 : A.e.length);
      const edges = [A.e];
      for (const c of chain) {
        const seg = c.from === c.e.a ? sliceLine(c.e.line, 0, c.e.length) : sliceLine(c.e.line, c.e.length, 0);
        pts = pts.concat(seg.slice(1)); edges.push(c.e);
      }
      const last = endNode === B.e.a ? sliceLine(B.e.line, 0, B.s) : sliceLine(B.e.line, B.e.length, B.s);
      pts = pts.concat(last.slice(1)); edges.push(B.e);
      if (A.e === B.e && pts.length < 2) pts = sliceLine(A.e.line, A.s, B.s);
      return { pts: dedupe(pts), length: Math.min(viaA, viaB), edges, turn: startNode === A.e.a ? turnA > 0 : turnB > 0 };
    }

    // ---------------------------------------------------------------- scoring spaces (the pool)
    defineSpaces() {
      const defs = LS.SPACE_POOL;
      this.spaces = [];
      for (const d of defs) {
        const k = SPACE_KINDS[d.kind];
        let sp;
        if (d.kind === 'bay') {
          const cp = this.carpark, ca = Math.cos(cp.a), sa = Math.sin(cp.a);
          // bays along the two long sides of the car park; d.slot 0..5, d.side +-1
          const lx = -cp.hx + k.W / 2 + 0.25 + d.slot * (k.W + 0.0), ly = d.side * (cp.hy - k.L / 2 - 0.1);
          const x = cp.x + ca * lx - sa * ly, y = cp.y + sa * lx + ca * ly;
          sp = { x, y, a: cp.a + Math.PI / 2, hl: k.L / 2, hw: k.W / 2, street: 'Grange Court', kind: 'bay', side: d.side, slot: d.slot };
        } else {
          const st = this.byName[d.street];
          const p = st.line.at(d.s), t = st.line.tangentAt(d.s, 4);
          const nx = -t.ty, ny = t.tx;
          const hc = st.hcAt(d.s);
          const off = d.side * (hc - k.W / 2 - 0.05);
          sp = { x: p.x + nx * off, y: p.y + ny * off, a: Math.atan2(t.ty, t.tx), hl: k.L / 2, hw: k.W / 2, street: d.street, kind: d.kind, side: d.side, s: d.s, openEnd: d.openEnd || 0 };
        }
        sp.id = this.spaces.length;
        sp.label = d.label || (sp.street.replace(' Street', '').toUpperCase() + ' ' + (this.spaces.filter((q) => q.street === sp.street).length + 1));
        sp.name = d.name || null;
        sp.c = Math.cos(sp.a); sp.s_ = Math.sin(sp.a);
        sp.corners = [];
        for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) sp.corners.push([sp.x + sp.c * sx * sp.hl - sp.s_ * sy * sp.hw, sp.y + sp.s_ * sx * sp.hl + sp.c * sy * sp.hw]);
        // access point on the lane next to the space, used by bots
        const ap = this.navProject(sp.x, sp.y);
        sp.access = { x: ap.x, y: ap.y, edge: ap.e, s: ap.s };
        this.spaces.push(sp);
      }
    }
    spaceLocal(sp, x, y) { const dx = x - sp.x, dy = y - sp.y; return [sp.c * dx + sp.s_ * dy, -sp.s_ * dx + sp.c * dy]; }

    // ---------------------------------------------------------------- residents' parked cars
    defineSlots() {
      const r = this.rand;
      this.slots = [];
      this.dropKerbs = []; // passing places / driveways kept clear, painted with white H-bar
      const otherClear = (st, x, y) => {
        // distance to any other street's carriageway
        for (const o of this.streets) {
          if (o === st) continue;
          const pr = o.line.project(x, y);
          if (pr.d - o.hcAt(pr.s) < (o.cfg.drive ? 4.5 : 8.5)) return false;
        }
        const cp = this.carpark, ca = Math.cos(cp.a), sa = Math.sin(cp.a);
        const lx = Math.abs(ca * (x - cp.x) + sa * (y - cp.y)), ly = Math.abs(-sa * (x - cp.x) + ca * (y - cp.y));
        if (lx < cp.hx + 4 && ly < cp.hy + 4) return false;
        return true;
      };
      const spaceBlock = (x, y, a, hl, hw) => {
        for (const sp of this.spaces) {
          if (Math.hypot(sp.x - x, sp.y - y) > sp.hl + hl + 3) continue;
          const [lx, ly] = this.spaceLocal(sp, x, y);
          const extra = sp.openEnd && Math.sign(lx) === sp.openEnd ? 6.5 : 0.35;
          if (Math.abs(lx) < sp.hl + hl + extra && Math.abs(ly) < sp.hw + hw + 0.2) return true;
        }
        return false;
      };
      const pickType = () => { let u = r(), acc = 0; for (const t of RESIDENT_TYPES) { acc += t.p; if (u < acc) return t; } return RESIDENT_TYPES[0]; };
      for (const st of this.streets) {
        for (const side of [1, -1]) {
          if (!st.cfg.park[side > 0 ? 0 : 1]) continue;
          let s = 8, sinceGap = 0;
          const bar = this.barriers.filter((b) => b.street === st.name);
          while (s < st.line.length - 6) {
            const t = pickType();
            const len = t.L, gap = 0.55 + r() * 0.9;
            const sc = s + len / 2;
            // keep away from the road-closed barriers
            if (bar.some((b) => Math.abs(b.s - sc) < len / 2 + 3 || (b.s < st.line.length / 2 ? sc < b.s : sc > b.s))) { s += 1; continue; }
            const p = st.line.at(sc), tg = st.line.tangentAt(sc, 3);
            const nx = -tg.ty, ny = tg.tx, hc = st.hcAt(sc);
            // usual position: kerb-side wheels 0.2 m off the kerb; some are half on the pavement, some sticking out
            let inset = 0.2 + r() * 0.15, ang = (r() - 0.5) * 0.03;
            const style = r();
            let pavement = false;
            if (style < 0.14 && (t.model === 'suv' || t.model === 'mega' || t.model === 'van')) { inset = -0.55; pavement = true; }
            else if (style > 0.9) { inset = 0.55 + r() * 0.35; ang = side * (0.03 + r() * 0.04) * (r() < 0.5 ? 1 : -1); }
            const off = side * (hc - t.W / 2 - inset);
            const x = p.x + nx * off, y = p.y + ny * off, a = Math.atan2(tg.ty, tg.tx) + ang + (r() < 0.5 ? Math.PI : 0);
            // checks: must lie on the carriageway (or half on the pavement), clear of junction mouths and spaces
            const ca = Math.cos(a), sa = Math.sin(a);
            let ok = otherClear(st, x, y) && otherClear(st, x + ca * len / 2, y + sa * len / 2) && otherClear(st, x - ca * len / 2, y - sa * len / 2);
            if (ok) {
              for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
                const cx = x + ca * sx * len / 2 - sa * sy * t.W / 2, cy = y + sa * sx * len / 2 + ca * sy * t.W / 2;
                if (this.wall(cx, cy) > -0.35) { ok = false; break; }
                if (!pavement && this.kerb(cx, cy) > -0.02) { ok = false; break; }
              }
            }
            if (ok && spaceBlock(x, y, a, len / 2, t.W / 2)) ok = false;
            // a dropped kerb / passing place every so often
            if (ok && sinceGap > 45 && r() < 0.06) { this.dropKerbs.push({ x, y, a, len: 5.5, street: st.name, side }); s += 6; sinceGap = 0; continue; }
            if (!ok) { s += 1.0; continue; }
            this.slots.push({ x, y, a, L: len, W: t.W, model: t.model, mass: t.m, street: st.name, side, pavement });
            s += len + gap; sinceGap += len + gap;
          }
        }
      }
      // car park: bays not in the pool get residents' cars
      const cp = this.carpark, ca = Math.cos(cp.a), sa = Math.sin(cp.a), k = SPACE_KINDS.bay;
      const ent = this.byName['Grange Court'].line.at(this.byName['Grange Court'].line.length);
      for (const side of [1, -1]) for (let slot = 0; slot < 5; slot++) {
        if (this.spaces.some((sp) => sp.kind === 'bay' && sp.side === side && sp.slot === slot)) continue;
        { const lx = -cp.hx + k.W / 2 + 0.25 + slot * k.W, ly = side * (cp.hy - k.L / 2); if (Math.hypot(cp.x + ca * lx - sa * ly - ent.x, cp.y + sa * lx + ca * ly - ent.y) < 7.5) continue; }
        const t = r() < 0.5 ? RESIDENT_TYPES[0] : pickType();
        const lx = -cp.hx + k.W / 2 + 0.25 + slot * k.W, ly = side * (cp.hy - t.L / 2 - 0.35);
        this.slots.push({ x: cp.x + ca * lx - sa * ly, y: cp.y + sa * lx + ca * ly, a: cp.a + Math.PI / 2 + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.06, L: t.L, W: t.W, model: t.model, mass: t.m, street: 'Grange Court', side, pavement: false });
      }
    }

    // ---------------------------------------------------------------- lamp posts, bins, signs, speed cushions
    defineProps() {
      const r = this.rand;
      this.lamps = []; this.bins = []; this.signs = []; this.cushions = []; this.permitSigns = [];
      const pave = (st, s, side, inset) => {
        const p = st.line.at(s), t = st.line.tangentAt(s, 3), nx = -t.ty, ny = t.tx;
        const off = side * (st.hcAt(s) + inset);
        return { x: p.x + nx * off, y: p.y + ny * off, a: Math.atan2(t.ty, t.tx), nx: nx * side, ny: ny * side };
      };
      for (const st of this.streets) {
        if (st.cfg.drive) continue;
        // lamp posts, alternating sides
        let side = 1;
        for (let s = 14; s < st.line.length - 10; s += 31 + r() * 6) {
          const q = pave(st, s, side, 0.45);
          if (this.wall(q.x, q.y) < -0.6 && this.kerb(q.x, q.y) > 0.25) {
            this.lamps.push({ x: q.x, y: q.y, a: q.a, side, street: st.name });
            if (!st.cfg.mainRoad && r() < 0.6) this.permitSigns.push({ x: q.x, y: q.y, a: q.a, nx: q.nx, ny: q.ny });
          }
          side = -side;
        }
        // wheelie bins: it is the night before collection, so they are out on the pavement
        for (const sd of [1, -1]) {
          for (let s = 6 + r() * 14; s < st.line.length - 6; s += 16 + r() * 22) {
            const n = 1 + (r() < 0.55 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
            const kerbSide = r() < 0.35;
            for (let i = 0; i < n; i++) {
              const q = pave(st, s + i * 0.75, sd, kerbSide ? 0.55 : st.cfg.pave - 0.5);
              if (this.wall(q.x, q.y) < -0.35 && this.kerb(q.x, q.y) > 0.3) {
                const u = r();
                this.bins.push({ x: q.x, y: q.y, a: q.a + (r() - 0.5) * 0.4 + Math.PI / 2 * sd, color: u < 0.45 ? 'black' : u < 0.75 ? 'blue' : u < 0.9 ? 'green' : 'brown' });
              }
            }
          }
        }
      }
      // big street-name signs at each junction mouth, plus at the stub barriers
      for (const j of this.junctions) {
        for (const sn of j.streets) {
          const st = this.byName[sn]; if (st.cfg.drive) continue;
          const other = this.byName[j.streets[0] === sn ? j.streets[1] : j.streets[0]];
          const pr = st.line.project(j.x, j.y);
          const dir = pr.s < st.line.length / 2 ? 1 : -1;
          const back = other.cfg.hc + other.cfg.pave + 2.0;
          for (const sd of [1, -1]) {
            const q = pave(st, pr.s + dir * back, sd, st.cfg.pave - 0.25);
            if (this.wall(q.x, q.y) > -0.05) continue;
            // face out of the side street, turned toward the main road
            const facing = Math.atan2(-dir * Math.sin(q.a), -dir * Math.cos(q.a));
            this.signs.push({ x: q.x, y: q.y, a: facing + sd * dir * 0.6, text: sn.toUpperCase(), sub: 'AL3', street: sn, oneway: st.oneway });
            break;
          }
        }
      }
      for (const p of this.pois) {
        if (p.kind === 'cushion') {
          const st = this.streetAt(p.x, p.y); if (!st) continue;
          const pr = st.line.project(p.x, p.y), q = st.line.at(pr.s);
          this.cushions.push({ x: q.x, y: q.y, a: q.heading, street: st.name });
        }
      }
    }

    // ---------------------------------------------------------------- house plots behind the garden walls
    defineHouses() {
      const r = this.rand;
      this.houses = [];
      const placed = [];
      const overlaps = (cx, cy, a, hw, hd) => {
        const P = { x: cx, y: cy, c: Math.cos(a), s: Math.sin(a), hx: hw, hy: hd };
        for (const q of placed) {
          if (Math.abs(q.x - cx) + Math.abs(q.y - cy) > 20) continue;
          if (LS.Physics.collideBoxBox(P, q)) return true;
        }
        return false;
      };
      const styles = ['red', 'red', 'red', 'stock', 'stock', 'render', 'red'];
      for (const st of this.streets) {
        if (st.cfg.drive) continue;
        for (const side of [1, -1]) {
          let s = 2, terrace = 0, style = r.pick(styles), run = 0;
          const garden = 2.4 + r() * 0.8, depth = 8.8 + r() * 1.2;
          while (s < st.line.length - 2) {
            const w = 4.7 + r() * 0.7;
            const sc = s + w / 2;
            const p = st.line.at(sc), t = st.line.tangentAt(sc, 2.5), nx = -t.ty * side, ny = t.tx * side;
            const front = st.cfg.hc + st.cfg.pave + garden;
            const fx = p.x + nx * front, fy = p.y + ny * front;
            // the house faces the street: local +v points away from the street
            const a = Math.atan2(ny, nx) - Math.PI / 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            const probe = [];
            for (const [u, v] of [[-w / 2, 0], [w / 2, 0], [-w / 2, depth], [w / 2, depth], [0, depth / 2], [-w / 2, depth / 2], [w / 2, depth / 2]]) probe.push([fx + ca * u - sa * v, fy + sa * u + ca * v]);
            const cx = fx - sa * depth / 2, cy = fy + ca * depth / 2;
            const ok = probe.every(([x, y]) => this.wall(x, y) > 1.0 && !this.inLandmark(x, y)) && !overlaps(cx, cy, a, w / 2 - 0.15, depth / 2 - 0.15) && !this.isBarrierZone(fx, fy);
            if (ok) {
              if (run === 0 || r() < 0.07) { style = r.pick(styles); terrace++; }
              this.houses.push({ x: fx, y: fy, a, w, d: depth, garden, style, terrace, street: st.name, side, n: run, num: 0 });
              placed.push({ x: cx, y: cy, c: ca, s: sa, hx: w / 2, hy: depth / 2 });
              run++;
            } else run = 0;
            s += w;
          }
        }
      }
      // number the houses along each street (odd on one side, even on the other)
      for (const st of this.streets) {
        for (const side of [1, -1]) {
          let n = side > 0 ? 1 : 2;
          for (const h of this.houses) if (h.street === st.name && h.side === side) { h.num = n; n += 2; }
        }
      }
    }
    inLandmark(x, y) {
      for (const lm of LS.MAPDATA.landmarks) {
        const P = lm.poly; let inside = false;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) inside = !inside;
        }
        if (inside) return true;
      }
      return false;
    }
    isBarrierZone(x, y) {
      for (const b of this.barriers) {
        const st = this.byName[b.street], pr = st.line.project(x, y);
        if (b.s < st.line.length / 2 ? pr.s < b.s - 2 : pr.s > b.s + 2) { if (pr.d < 30) return true; }
      }
      return false;
    }

    // ---------------------------------------------------------------- physics bodies
    populate(world) {
      this.world = world;
      for (const line of this.wallCentre) for (let i = 0; i < line.length - 1; i++) world.addWallSegment(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1], 0.44, 'wall');
      for (const b of this.barriers) {
        world.addStatic(new Body({ shape: 'box', x: b.x, y: b.y, a: b.a, hx: b.half, hy: 0.3, isStatic: true, kind: 'barrier', friction: 0.5 }));
      }
      for (const l of this.lamps) world.addStatic(new Body({ shape: 'circle', x: l.x, y: l.y, r: 0.13, isStatic: true, kind: 'post' }));
      this.parked = [];
      for (const s of this.slots) {
        const b = new Body({ shape: 'box', x: s.x, y: s.y, a: s.a, hx: s.L / 2, hy: s.W / 2, mass: s.mass, kind: 'parked', canSleep: true, friction: 0.35, restitution: 0.12 });
        b.user = { slot: s, resident: true };
        b.awake = false;
        world.add(b); this.parked.push(b);
      }
      this.binBodies = [];
      for (const bn of this.bins) {
        const b = new Body({ shape: 'box', x: bn.x, y: bn.y, a: bn.a, hx: 0.36, hy: 0.29, mass: 14, kind: 'bin', canSleep: true, friction: 0.5, restitution: 0.25 });
        b.user = { bin: bn, fallen: false, tip: 0 };
        b.awake = false;
        world.add(b); this.binBodies.push(b);
      }
    }
  }

  function simplify(p, tol) {
    if (p.length < 3) return p;
    const keep = new Uint8Array(p.length); keep[0] = keep[p.length - 1] = 1;
    const stack = [[0, p.length - 1]];
    while (stack.length) {
      const [i0, i1] = stack.pop();
      const a = p[i0], b = p[i1];
      let best = -1, bi = -1;
      for (let i = i0 + 1; i < i1; i++) { const d = U.segDist(p[i][0], p[i][1], a[0], a[1], b[0], b[1]).d; if (d > best) { best = d; bi = i; } }
      if (best > tol) { keep[bi] = 1; stack.push([i0, bi], [bi, i1]); }
    }
    return p.filter((_, i) => keep[i]);
  }
  function sliceLine(line, s0, s1) {
    const out = [];
    const n = Math.max(2, Math.ceil(Math.abs(s1 - s0) / 3) + 1);
    // keep original vertices so corners stay sharp enough for the bots to read
    const dir = s1 >= s0 ? 1 : -1;
    out.push([line.at(s0).x, line.at(s0).y]);
    const inner = [];
    for (let k = 0; k < line.pts.length; k++) { const c = line.cum[k]; if ((c - s0) * dir > 0.3 && (s1 - c) * dir > 0.3) inner.push(c); }
    if (dir < 0) inner.reverse();
    for (const c of inner) out.push([line.at(c).x, line.at(c).y]);
    out.push([line.at(s1).x, line.at(s1).y]);
    return out;
  }
  function dedupe(pts) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - out[out.length - 1][0], pts[i][1] - out[out.length - 1][1]) > 0.3) out.push(pts[i]);
    return out;
  }

  LS.Arena = Arena;
  LS.SPACE_KINDS = SPACE_KINDS;
  LS.RESIDENT_TYPES = RESIDENT_TYPES;
  LS.STREET_CFG = STREET_CFG;
})(window.LS);
