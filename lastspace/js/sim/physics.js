/* LAST SPACE - 2D rigid-body physics (top-down plane of the road).
   Oriented boxes and circles, SAT + reference-face clipping contact manifolds (after Erin Catto's
   Box2D Lite), sequential impulses with warm starting, Coulomb friction, restitution and Baumgarte
   position correction. Mass, inertia, contact position and impact angle all fall out of the solver:
   nothing is canned. Vehicle tyres are applied by vehicles.js as impulses before each step. */
(function (LS) {
  'use strict';
  const U = LS.U;
  let NEXT_ID = 1;

  class Body {
    constructor(o) {
      this.id = NEXT_ID++;
      this.shape = o.shape || 'box';
      this.hx = o.hx || 0.5; this.hy = o.hy || 0.5; this.r = o.r || 0.5;
      this.x = o.x || 0; this.y = o.y || 0; this.a = o.a || 0;
      this.c = Math.cos(this.a); this.s = Math.sin(this.a);
      this.vx = 0; this.vy = 0; this.w = 0;
      this.kind = o.kind || 'prop';
      this.user = o.user || null;
      this.friction = o.friction != null ? o.friction : 0.4;
      this.restitution = o.restitution != null ? o.restitution : 0.1;
      this.canSleep = !!o.canSleep;
      this.awake = true; this.sleepT = 0;
      this.layer = o.layer || 1; this.mask = o.mask != null ? o.mask : 0xffff;
      this.setMass(o.isStatic ? 0 : (o.mass || 100), o.inertia);
      this.bound = this.shape === 'box' ? Math.hypot(this.hx, this.hy) : this.r;
      this.touching = 0; this.touchStatic = 0; this.touchIds = [];
      this.enabled = true;
      this.waker = !!o.waker;
    }
    setMass(m, inertia) {
      this.mass = m;
      if (m <= 0) { this.invM = 0; this.invI = 0; this.I = 0; this.isStatic = true; return; }
      this.isStatic = false;
      this.invM = 1 / m;
      const I = inertia || (this.shape === 'box' ? m * ((2 * this.hx) ** 2 + (2 * this.hy) ** 2) / 12 : 0.5 * m * this.r * this.r);
      this.I = I; this.invI = 1 / I;
    }
    setAngle(a) { this.a = a; this.c = Math.cos(a); this.s = Math.sin(a); }
    // world velocity of a world point
    velAt(px, py) { return [this.vx - this.w * (py - this.y), this.vy + this.w * (px - this.x)]; }
    applyImpulse(jx, jy, px, py) {
      if (this.invM === 0) return;
      this.vx += jx * this.invM; this.vy += jy * this.invM;
      this.w += this.invI * ((px - this.x) * jy - (py - this.y) * jx);
    }
    wake() { this.awake = true; this.sleepT = 0; }
    // local -> world
    toWorld(lx, ly) { return [this.x + this.c * lx - this.s * ly, this.y + this.s * lx + this.c * ly]; }
    toLocal(wx, wy) { const dx = wx - this.x, dy = wy - this.y; return [this.c * dx + this.s * dy, -this.s * dx + this.c * dy]; }
    corners() {
      const c = this.c, s = this.s, hx = this.hx, hy = this.hy, out = [];
      for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) out.push([this.x + c * sx * hx - s * sy * hy, this.y + s * sx * hx + c * sy * hy]);
      return out;
    }
  }

  // ------------------------------------------------------------ narrowphase
  function clipSeg(p, nx, ny, off, out) {
    // keep the part of segment p[0..1] where dot(n, v) - off <= 0
    let n = 0;
    const d0 = nx * p[0] + ny * p[1] - off, d1 = nx * p[2] + ny * p[3] - off;
    if (d0 <= 0) { out[n * 2] = p[0]; out[n * 2 + 1] = p[1]; n++; }
    if (d1 <= 0) { out[n * 2] = p[2]; out[n * 2 + 1] = p[3]; n++; }
    if (d0 * d1 < 0) {
      const t = d0 / (d0 - d1);
      out[n * 2] = p[0] + t * (p[2] - p[0]); out[n * 2 + 1] = p[1] + t * (p[3] - p[1]); n++;
    }
    return n;
  }
  const _inc = [0, 0, 0, 0], _c1 = [0, 0, 0, 0, 0, 0], _c2 = [0, 0, 0, 0, 0, 0];

  function incidentEdge(B, fnx, fny) {
    const c = B.c, s = B.s, hx = B.hx, hy = B.hy;
    const nx = -(c * fnx + s * fny), ny = -(-s * fnx + c * fny);
    let ax, ay, bx, by;
    if (Math.abs(nx) > Math.abs(ny)) {
      if (nx > 0) { ax = hx; ay = -hy; bx = hx; by = hy; } else { ax = -hx; ay = hy; bx = -hx; by = -hy; }
    } else {
      if (ny > 0) { ax = hx; ay = hy; bx = -hx; by = hy; } else { ax = -hx; ay = -hy; bx = hx; by = -hy; }
    }
    _inc[0] = B.x + c * ax - s * ay; _inc[1] = B.y + s * ax + c * ay;
    _inc[2] = B.x + c * bx - s * by; _inc[3] = B.y + s * bx + c * by;
  }

  // returns contacts [{x,y,sep}] with normal (nx,ny) from A to B, or null
  function collideBoxBox(A, B) {
    const cA = A.c, sA = A.s, cB = B.c, sB = B.s;
    const dpx = B.x - A.x, dpy = B.y - A.y;
    const dAx = cA * dpx + sA * dpy, dAy = -sA * dpx + cA * dpy;
    const dBx = cB * dpx + sB * dpy, dBy = -sB * dpx + cB * dpy;
    const cd = cA * cB + sA * sB, sd = cA * sB - sA * cB;
    const ac = Math.abs(cd) + 1e-9, as = Math.abs(sd) + 1e-9;
    const faceAx = Math.abs(dAx) - A.hx - (ac * B.hx + as * B.hy);
    const faceAy = Math.abs(dAy) - A.hy - (as * B.hx + ac * B.hy);
    if (faceAx > 0 || faceAy > 0) return null;
    const faceBx = Math.abs(dBx) - (ac * A.hx + as * A.hy) - B.hx;
    const faceBy = Math.abs(dBy) - (as * A.hx + ac * A.hy) - B.hy;
    if (faceBx > 0 || faceBy > 0) return null;

    let axis = 0, sep = faceAx;
    let nx = dAx > 0 ? cA : -cA, ny = dAx > 0 ? sA : -sA;
    const relTol = 0.95, absTol = 0.01;
    if (faceAy > relTol * sep + absTol * A.hy) { axis = 1; sep = faceAy; nx = dAy > 0 ? -sA : sA; ny = dAy > 0 ? cA : -cA; }
    if (faceBx > relTol * sep + absTol * B.hx) { axis = 2; sep = faceBx; nx = dBx > 0 ? cB : -cB; ny = dBx > 0 ? sB : -sB; }
    if (faceBy > relTol * sep + absTol * B.hy) { axis = 3; sep = faceBy; nx = dBy > 0 ? -sB : sB; ny = dBy > 0 ? cB : -cB; }

    let fnx, fny, front, snx, sny, negSide, posSide;
    if (axis === 0) {
      fnx = nx; fny = ny; front = A.x * fnx + A.y * fny + A.hx; snx = -sA; sny = cA;
      const side = A.x * snx + A.y * sny; negSide = -side + A.hy; posSide = side + A.hy; incidentEdge(B, fnx, fny);
    } else if (axis === 1) {
      fnx = nx; fny = ny; front = A.x * fnx + A.y * fny + A.hy; snx = cA; sny = sA;
      const side = A.x * snx + A.y * sny; negSide = -side + A.hx; posSide = side + A.hx; incidentEdge(B, fnx, fny);
    } else if (axis === 2) {
      fnx = -nx; fny = -ny; front = B.x * fnx + B.y * fny + B.hx; snx = -sB; sny = cB;
      const side = B.x * snx + B.y * sny; negSide = -side + B.hy; posSide = side + B.hy; incidentEdge(A, fnx, fny);
    } else {
      fnx = -nx; fny = -ny; front = B.x * fnx + B.y * fny + B.hy; snx = cB; sny = sB;
      const side = B.x * snx + B.y * sny; negSide = -side + B.hx; posSide = side + B.hx; incidentEdge(A, fnx, fny);
    }
    let n1 = clipSeg(_inc, -snx, -sny, negSide, _c1);
    if (n1 < 2) return null;
    let n2 = clipSeg(_c1, snx, sny, posSide, _c2);
    if (n2 < 2) return null;
    const out = [];
    for (let i = 0; i < 2; i++) {
      const px = _c2[i * 2], py = _c2[i * 2 + 1];
      const s = fnx * px + fny * py - front;
      if (s <= 0) out.push({ x: px - s * fnx, y: py - s * fny, sep: s, f: axis * 4 + i });
    }
    if (!out.length) return null;
    return { nx, ny, pts: out };
  }

  // box A vs circle B; normal from A to B
  function collideBoxCircle(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y;
    const lx = A.c * dx + A.s * dy, ly = -A.s * dx + A.c * dy;
    const cx = U.clamp(lx, -A.hx, A.hx), cy = U.clamp(ly, -A.hy, A.hy);
    let nlx, nly, sep, plx, ply;
    if (cx === lx && cy === ly) {
      // centre inside the box
      const px = A.hx - Math.abs(lx), py = A.hy - Math.abs(ly);
      if (px < py) { nlx = U.sign(lx); nly = 0; sep = -(px + B.r); plx = nlx * A.hx; ply = ly; }
      else { nlx = 0; nly = U.sign(ly); sep = -(py + B.r); plx = lx; ply = nly * A.hy; }
    } else {
      const ex = lx - cx, ey = ly - cy, d = Math.hypot(ex, ey);
      if (d > B.r) return null;
      nlx = ex / (d || 1); nly = ey / (d || 1); sep = d - B.r; plx = cx; ply = cy;
    }
    const nx = A.c * nlx - A.s * nly, ny = A.s * nlx + A.c * nly;
    const wx = A.x + A.c * plx - A.s * ply, wy = A.y + A.s * plx + A.c * ply;
    return { nx, ny, pts: [{ x: wx, y: wy, sep, f: 9 }] };
  }

  function collideCircleCircle(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
    if (d > A.r + B.r) return null;
    const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0;
    return { nx, ny, pts: [{ x: A.x + nx * A.r, y: A.y + ny * A.r, sep: d - A.r - B.r, f: 10 }] };
  }

  function collide(A, B) {
    if (A.shape === 'box') {
      if (B.shape === 'box') return collideBoxBox(A, B);
      return collideBoxCircle(A, B);
    }
    if (B.shape === 'box') {
      const m = collideBoxCircle(B, A);
      if (m) { m.nx = -m.nx; m.ny = -m.ny; }
      return m;
    }
    return collideCircleCircle(A, B);
  }

  // ------------------------------------------------------------ arbiter
  class Arbiter {
    constructor(A, B) { this.A = A; this.B = B; this.contacts = []; this.fresh = true; this.age = 0; this.nx = 0; this.ny = 0; }
    update(m) {
      const old = this.contacts, nc = [];
      for (const p of m.pts) {
        const c = { x: p.x, y: p.y, sep: p.sep, f: p.f, Pn: 0, Pt: 0 };
        // warm start from the closest old contact with the same feature
        for (const o of old) {
          if (o.f === p.f && Math.abs(o.x - p.x) + Math.abs(o.y - p.y) < 0.25) { c.Pn = o.Pn; c.Pt = o.Pt; break; }
        }
        nc.push(c);
      }
      this.contacts = nc; this.nx = m.nx; this.ny = m.ny;
    }
  }

  // ------------------------------------------------------------ world
  class World {
    constructor() {
      this.bodies = []; this.statics = [];
      this.sgrid = new Map(); this.SCELL = 8;
      this.DCELL = 6;
      this.arbiters = new Map();
      this.iterations = 10;
      this.events = []; // impacts generated during the last step
      this.time = 0;
    }
    add(b) { this.bodies.push(b); return b; }
    remove(b) {
      const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1);
      for (const [k, a] of this.arbiters) if (a.A === b || a.B === b) this.arbiters.delete(k);
    }
    addStatic(b) {
      b.setMass(0); this.statics.push(b);
      const r = b.bound, C = this.SCELL;
      for (let gx = Math.floor((b.x - r) / C); gx <= Math.floor((b.x + r) / C); gx++)
        for (let gy = Math.floor((b.y - r) / C); gy <= Math.floor((b.y + r) / C); gy++) {
          const k = gx * 100003 + gy; let a = this.sgrid.get(k); if (!a) this.sgrid.set(k, a = []); a.push(b);
        }
      return b;
    }
    addWallSegment(ax, ay, bx, by, thick, kind) {
      const L = Math.hypot(bx - ax, by - ay); if (L < 0.01) return null;
      return this.addStatic(new Body({ shape: 'box', x: (ax + bx) / 2, y: (ay + by) / 2, a: Math.atan2(by - ay, bx - ax), hx: L / 2 + thick * 0.15, hy: thick / 2, isStatic: true, kind: kind || 'wall', friction: 0.45, restitution: 0.08 }));
    }
    staticsNear(x, y, r, out) {
      const C = this.SCELL, seen = out._seen || (out._seen = new Set()); seen.clear(); out.length = 0;
      for (let gx = Math.floor((x - r) / C); gx <= Math.floor((x + r) / C); gx++)
        for (let gy = Math.floor((y - r) / C); gy <= Math.floor((y + r) / C); gy++) {
          const a = this.sgrid.get(gx * 100003 + gy); if (!a) continue;
          for (const b of a) if (!seen.has(b.id)) { seen.add(b.id); out.push(b); }
        }
      return out;
    }

    step(dt) {
      const inv_dt = 1 / dt;
      this.time += dt;
      this.events.length = 0;
      const bodies = this.bodies;
      // ---- broadphase: dynamic grid
      const C = this.DCELL, grid = new Map();
      for (const b of bodies) {
        if (!b.enabled) continue;
        b.touching = 0; b.touchStatic = 0; b.touchIds.length = 0;
        const r = b.bound;
        for (let gx = Math.floor((b.x - r) / C); gx <= Math.floor((b.x + r) / C); gx++)
          for (let gy = Math.floor((b.y - r) / C); gy <= Math.floor((b.y + r) / C); gy++) {
            const k = gx * 100003 + gy; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(b);
          }
      }
      const live = new Set();
      const tryPair = (A, B) => {
        if (!(A.mask & B.layer) || !(B.mask & A.layer)) return;
        const dx = A.x - B.x, dy = A.y - B.y, rr = A.bound + B.bound;
        if (dx * dx + dy * dy > rr * rr) return;
        // order so that boxes come first when mixing shapes and ids are stable
        let P = A, Q = B;
        if (P.id > Q.id) { P = B; Q = A; }
        const key = P.id * 1000003 + Q.id;
        if (live.has(key)) return;
        const m = collide(P, Q);
        if (!m) return;
        live.add(key);
        let arb = this.arbiters.get(key);
        if (!arb) { arb = new Arbiter(P, Q); this.arbiters.set(key, arb); } else { arb.fresh = false; arb.age++; }
        arb.update(m);
        // wake sleepers only for something that matters: a driven car, or a real approach speed
        const wakeBy = (S, O) => { if (!S.awake && !S.isStatic && (O.waker || O.vx * O.vx + O.vy * O.vy > 0.09 || Math.abs(O.w) > 0.3)) S.wake(); };
        wakeBy(P, Q); wakeBy(Q, P);
      };
      const sbuf = [];
      for (const A of bodies) {
        if (!A.enabled || !A.awake) continue;
        const r = A.bound;
        for (let gx = Math.floor((A.x - r) / C); gx <= Math.floor((A.x + r) / C); gx++)
          for (let gy = Math.floor((A.y - r) / C); gy <= Math.floor((A.y + r) / C); gy++) {
            const a = grid.get(gx * 100003 + gy); if (!a) continue;
            for (const B of a) if (B !== A && B.enabled && (!B.awake || A.id < B.id)) tryPair(A, B);
          }
        this.staticsNear(A.x, A.y, r, sbuf);
        for (const S of sbuf) tryPair(A, S);
      }
      for (const [k, arb] of this.arbiters) {
        if (!live.has(k)) this.arbiters.delete(k);
      }
      // ---- prestep
      const arbs = [];
      for (const arb of this.arbiters.values()) {
        const A = arb.A, B = arb.B;
        if (!(A.awake || A.isStatic) && !(B.awake || B.isStatic)) continue;
        arbs.push(arb);
        arb.mA = A.awake ? A.invM : 0; arb.iA = A.awake ? A.invI : 0;
        arb.mB = B.awake ? B.invM : 0; arb.iB = B.awake ? B.invI : 0;
        const fr = Math.sqrt(A.friction * B.friction), e = Math.max(A.restitution, B.restitution);
        arb.mu = fr;
        const nx = arb.nx, ny = arb.ny, tx = ny, ty = -nx;
        arb.approach = 0;
        for (const c of arb.contacts) {
          const r1x = c.x - A.x, r1y = c.y - A.y, r2x = c.x - B.x, r2y = c.y - B.y;
          c.r1x = r1x; c.r1y = r1y; c.r2x = r2x; c.r2y = r2y;
          const rn1 = r1x * ny - r1y * nx, rn2 = r2x * ny - r2y * nx;
          c.mN = 1 / (arb.mA + arb.mB + arb.iA * rn1 * rn1 + arb.iB * rn2 * rn2);
          const rt1 = r1x * ty - r1y * tx, rt2 = r2x * ty - r2y * tx;
          c.mT = 1 / (arb.mA + arb.mB + arb.iA * rt1 * rt1 + arb.iB * rt2 * rt2);
          const dvx = (B.vx - B.w * r2y) - (A.vx - A.w * r1y);
          const dvy = (B.vy + B.w * r2x) - (A.vy + A.w * r1x);
          const vn = dvx * nx + dvy * ny;
          if (-vn > arb.approach) arb.approach = -vn;
          c.bias = -0.2 * inv_dt * Math.min(0, c.sep + 0.015);
          if (vn < -1.2) c.bias = Math.max(c.bias, -e * vn);
          c.bias = Math.min(c.bias, 8);
          // warm start
          const Px = c.Pn * nx + c.Pt * tx, Py = c.Pn * ny + c.Pt * ty;
          A.vx -= Px * arb.mA; A.vy -= Py * arb.mA; A.w -= arb.iA * (r1x * Py - r1y * Px);
          B.vx += Px * arb.mB; B.vy += Py * arb.mB; B.w += arb.iB * (r2x * Py - r2y * Px);
        }
      }
      // ---- iterate
      for (let it = 0; it < this.iterations; it++) {
        for (const arb of arbs) {
          const A = arb.A, B = arb.B, nx = arb.nx, ny = arb.ny, tx = ny, ty = -nx;
          for (const c of arb.contacts) {
            let dvx = (B.vx - B.w * c.r2y) - (A.vx - A.w * c.r1y);
            let dvy = (B.vy + B.w * c.r2x) - (A.vy + A.w * c.r1x);
            const vn = dvx * nx + dvy * ny;
            let dPn = c.mN * (-vn + c.bias);
            const Pn0 = c.Pn; c.Pn = Math.max(Pn0 + dPn, 0); dPn = c.Pn - Pn0;
            let Px = dPn * nx, Py = dPn * ny;
            A.vx -= Px * arb.mA; A.vy -= Py * arb.mA; A.w -= arb.iA * (c.r1x * Py - c.r1y * Px);
            B.vx += Px * arb.mB; B.vy += Py * arb.mB; B.w += arb.iB * (c.r2x * Py - c.r2y * Px);
            // friction
            dvx = (B.vx - B.w * c.r2y) - (A.vx - A.w * c.r1y);
            dvy = (B.vy + B.w * c.r2x) - (A.vy + A.w * c.r1x);
            const vt = dvx * tx + dvy * ty;
            let dPt = c.mT * (-vt);
            const maxPt = arb.mu * c.Pn;
            const Pt0 = c.Pt; c.Pt = U.clamp(Pt0 + dPt, -maxPt, maxPt); dPt = c.Pt - Pt0;
            Px = dPt * tx; Py = dPt * ty;
            A.vx -= Px * arb.mA; A.vy -= Py * arb.mA; A.w -= arb.iA * (c.r1x * Py - c.r1y * Px);
            B.vx += Px * arb.mB; B.vy += Py * arb.mB; B.w += arb.iB * (c.r2x * Py - c.r2y * Px);
          }
        }
      }
      // ---- impacts (for damage, sparks, sound) and touch bookkeeping
      for (const arb of arbs) {
        const A = arb.A, B = arb.B;
        let J = 0, x = 0, y = 0, slide = 0;
        for (const c of arb.contacts) {
          J += c.Pn; x += c.x; y += c.y;
          const dvx = (B.vx - B.w * c.r2y) - (A.vx - A.w * c.r1y);
          const dvy = (B.vy + B.w * c.r2x) - (A.vy + A.w * c.r1x);
          slide = Math.max(slide, Math.abs(dvx * arb.ny - dvy * arb.nx));
        }
        const n = arb.contacts.length || 1; x /= n; y /= n;
        A.touching++; B.touching++;
        if (B.isStatic) A.touchStatic++; if (A.isStatic) B.touchStatic++;
        A.touchIds.push(B.id); B.touchIds.push(A.id);
        const dvA = J * arb.mA, dvB = J * arb.mB;
        if (dvA > 0.35 || dvB > 0.35 || (slide > 2.5 && J > 0)) {
          this.events.push({ A, B, x, y, nx: arb.nx, ny: arb.ny, J, dvA, dvB, approach: arb.approach, slide, fresh: arb.fresh });
        }
      }
      // ---- integrate
      for (const b of bodies) {
        if (!b.enabled || !b.awake || b.isStatic) continue;
        const sp2 = b.vx * b.vx + b.vy * b.vy;
        if (sp2 > 3600) { const k = 60 / Math.sqrt(sp2); b.vx *= k; b.vy *= k; }
        if (b.w > 12) b.w = 12; else if (b.w < -12) b.w = -12;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.w !== 0) b.setAngle(b.a + b.w * dt);
        if (b.canSleep) {
          if (sp2 < 0.0025 && b.w * b.w < 0.0025) { b.sleepT += dt; if (b.sleepT > 0.6) { b.awake = false; b.vx = b.vy = b.w = 0; } }
          else b.sleepT = 0;
        }
      }
    }

    // ---- queries
    // nearest hit along a segment; filter(b) -> bool. Returns {t, body} or null
    raycast(x0, y0, x1, y1, filter, includeStatics) {
      const dx = x1 - x0, dy = y1 - y0;
      let best = null, bt = 1;
      const test = (b) => {
        if (filter && !filter(b)) return;
        let t;
        if (b.shape === 'box') {
          const ox = x0 - b.x, oy = y0 - b.y;
          const lx = b.c * ox + b.s * oy, ly = -b.s * ox + b.c * oy;
          const ldx = b.c * dx + b.s * dy, ldy = -b.s * dx + b.c * dy;
          let t0 = 0, t1 = 1;
          const slab = (o, d, h) => {
            if (Math.abs(d) < 1e-9) return Math.abs(o) <= h;
            let a = (-h - o) / d, c = (h - o) / d; if (a > c) { const q = a; a = c; c = q; }
            t0 = Math.max(t0, a); t1 = Math.min(t1, c); return t0 <= t1;
          };
          if (!slab(lx, ldx, b.hx) || !slab(ly, ldy, b.hy)) return;
          t = t0;
        } else {
          const fx = x0 - b.x, fy = y0 - b.y;
          const a = dx * dx + dy * dy, bb = 2 * (fx * dx + fy * dy), cc = fx * fx + fy * fy - b.r * b.r;
          const disc = bb * bb - 4 * a * cc; if (disc < 0) return;
          t = (-bb - Math.sqrt(disc)) / (2 * a); if (t < 0) t = cc <= 0 ? 0 : 2; if (t > 1) return;
        }
        if (t < bt) { bt = t; best = b; }
      };
      const minx = Math.min(x0, x1), maxx = Math.max(x0, x1), miny = Math.min(y0, y1), maxy = Math.max(y0, y1);
      for (const b of this.bodies) {
        if (!b.enabled) continue;
        if (b.x + b.bound < minx || b.x - b.bound > maxx || b.y + b.bound < miny || b.y - b.bound > maxy) continue;
        test(b);
      }
      if (includeStatics) {
        const L = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(L / this.SCELL)), sb = [];
        const seen = new Set();
        for (let i = 0; i <= n; i++) {
          this.staticsNear(x0 + dx * i / n, y0 + dy * i / n, this.SCELL * 0.75, sb);
          for (const b of sb) if (!seen.has(b.id)) { seen.add(b.id); test(b); }
        }
      }
      return best ? { t: bt, body: best, x: x0 + dx * bt, y: y0 + dy * bt } : null;
    }
    // does an oriented box overlap anything? (spawn / recovery clearance)
    overlapsBox(x, y, a, hx, hy, filter, includeStatics) {
      const probe = new Body({ shape: 'box', x, y, a, hx, hy, isStatic: true });
      for (const b of this.bodies) {
        if (!b.enabled || (filter && !filter(b))) continue;
        if (Math.hypot(b.x - x, b.y - y) > b.bound + probe.bound) continue;
        if (collide(probe, b)) return b;
      }
      if (includeStatics) {
        const sb = [];
        this.staticsNear(x, y, probe.bound, sb);
        for (const b of sb) if (collide(probe, b)) return b;
      }
      return null;
    }
  }

  LS.Physics = { Body, World, collide, collideBoxBox };
})(window.LS);
