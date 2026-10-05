/* Building geometry generator. Takes era-resolved building specs and produces merged, chunked meshes
   (walls with an atlas of windows/shopfronts, roofs, signs) plus colliders. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const B = (SA.Buildings = {});

  // ------------------------------------------------------------------ geometry builder (indexed quads)
  function GB() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.wall = [];
    this.cell = [];
    this.base = [];
    this.idx = [];
    this.n = 0;
  }
  B.GB = GB;
  // corners: 4 x [x,y,z] in order BL, BR, TR, TL (CCW seen from the outside)
  GB.prototype.quad = function (c, nrm, uvs, color, walls, cell, base) {
    const n0 = this.n;
    for (let i = 0; i < 4; i++) {
      this.pos.push(c[i][0], c[i][1], c[i][2]);
      this.nor.push(nrm[0], nrm[1], nrm[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color.r, color.g, color.b);
      this.wall.push(walls[i][0], walls[i][1], walls[i][2]);
      this.cell.push(cell[0], cell[1], cell[2]);
      this.base.push(base);
    }
    this.idx.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
    this.n += 4;
  };
  GB.prototype.tri = function (c, nrm, uvs, color, walls, cell, base) {
    const n0 = this.n;
    for (let i = 0; i < 3; i++) {
      this.pos.push(c[i][0], c[i][1], c[i][2]);
      this.nor.push(nrm[0], nrm[1], nrm[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color.r, color.g, color.b);
      this.wall.push(walls[i][0], walls[i][1], walls[i][2]);
      this.cell.push(cell[0], cell[1], cell[2]);
      this.base.push(base);
    }
    this.idx.push(n0, n0 + 1, n0 + 2);
    this.n += 3;
  };
  GB.prototype.build = function () {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aWall', new THREE.Float32BufferAttribute(this.wall, 3));
    g.setAttribute('aCell', new THREE.Float32BufferAttribute(this.cell, 3));
    g.setAttribute('aBase', new THREE.Float32BufferAttribute(this.base, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  };

  // ------------------------------------------------------------------ polygon helpers
  function signedArea(p) {
    let a = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
    return a / 2;
  }
  B.signedArea = signedArea;
  // outward normal of edge a->b for polygon p (robust for concave polygons)
  function outwardNormal(p, i) {
    const a = p[i], b = p[(i + 1) % p.length];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    let nx = dz, nz = -dx;
    const mx = (a[0] + b[0]) / 2 + nx * 0.05, mz = (a[1] + b[1]) / 2 + nz * 0.05;
    if (U.pointInPoly(mx, mz, p)) {
      nx = -nx;
      nz = -nz;
    }
    return [nx, nz];
  }
  B.outwardNormal = outwardNormal;
  // inset polygon by d (positive = inward). Returns null if it degenerates.
  function inset(p, d) {
    const A = signedArea(p);
    const ccw = A > 0;
    const n = p.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
      let d1x = b[0] - a[0], d1z = b[1] - a[1], d2x = c[0] - b[0], d2z = c[1] - b[1];
      const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1;
      d1x /= l1;
      d1z /= l1;
      d2x /= l2;
      d2z /= l2;
      // inward normals (left normal for CCW)
      let n1x = -d1z, n1z = d1x, n2x = -d2z, n2z = d2x;
      if (!ccw) {
        n1x = -n1x;
        n1z = -n1z;
        n2x = -n2x;
        n2z = -n2z;
      }
      const dot = n1x * n2x + n1z * n2z;
      let mx = (n1x + n2x) / (1 + dot), mz = (n1z + n2z) / (1 + dot);
      const ml = Math.hypot(mx, mz);
      if (ml > 2.5) {
        mx *= 2.5 / ml;
        mz *= 2.5 / ml;
      }
      out.push([b[0] + mx * d, b[1] + mz * d]);
    }
    const A2 = signedArea(out);
    if (Math.sign(A2) !== Math.sign(A) || Math.abs(A2) < Math.abs(A) * 0.12) return null;
    // self-intersection check
    for (let i = 0; i < n; i++) {
      const a = out[i], b = out[(i + 1) % n];
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const c = out[j], dd = out[(j + 1) % n];
        if (U.segIntersect(a[0], a[1], b[0], b[1], c[0], c[1], dd[0], dd[1]) >= 0) return null;
      }
    }
    return out;
  }
  B.inset = inset;

  // ------------------------------------------------------------------ cells
  const CELLS = SA.Tex.CELLS;
  function cellOf(name) {
    if (!name || name === 'blank' || !CELLS[name]) return [-1, -1];
    return CELLS[name];
  }

  // ------------------------------------------------------------------ main generator
  // ctx: {eraId, chunks: Map(key -> {walls: GB, roofs: GB}), signs: GB, atlas: SignAtlas, col: Collision, chimneys: [], interact: []}
  B.CHUNK = 110;
  function chunkOf(ctx, x, z) {
    const k = Math.floor(x / B.CHUNK) + ',' + Math.floor(z / B.CHUNK);
    let c = ctx.chunks.get(k);
    if (!c) {
      c = { walls: new GB(), roofs: new GB(), key: k };
      ctx.chunks.set(k, c);
    }
    return c;
  }

  const tmpColor = new THREE.Color();
  function colorOf(hex) {
    return new THREE.Color(hex);
  }

  // Add one wall band (a horizontal strip of a wall edge) to the builder.
  // a,b: [x,z] endpoints, n: outward normal [nx,nz], y0,y1: heights, bays: number of bays across,
  // floors: number of storeys spanned (for uv tiling), cell: atlas cell name, wt: wall type, color: THREE.Color, uOff: metres along wall
  let curSeed = 0.5;
  function band(gb, a, b, n, y0, y1, bays, floors, cellName, wt, color, uOff, vOff, base, lit) {
    if (y1 - y0 < 0.02) return;
    const right = [n[1], -n[0]];
    let L = a, R = b;
    if ((b[0] - a[0]) * right[0] + (b[1] - a[1]) * right[1] < 0) {
      L = b;
      R = a;
    }
    const len = Math.hypot(R[0] - L[0], R[1] - L[1]);
    const c = cellOf(cellName);
    gb.quad(
      [[L[0], y0, L[1]], [R[0], y0, R[1]], [R[0], y1, R[1]], [L[0], y1, L[1]]],
      [n[0], 0, n[1]],
      [[0, 0], [bays, 0], [bays, floors], [0, floors]],
      color,
      [[uOff, vOff, wt], [uOff + len, vOff, wt], [uOff + len, vOff + (y1 - y0), wt], [uOff, vOff + (y1 - y0), wt]],
      [c[0], c[1], lit === undefined ? curSeed : lit],
      base
    );
  }

  function triWall(gb, p0, p1, p2, n, wt, color, base) {
    // gable triangle; p = [x,y,z]; uv metres
    const c = [-1, -1, 0];
    const right = [n[2], -n[0]];
    const u = (p) => p[0] * right[0] + p[2] * right[1];
    let A = p0, Bp = p1;
    if (u(p1) < u(p0)) {
      A = p1;
      Bp = p0;
    }
    const u0 = u(A);
    gb.tri([A, Bp, p2], n, [[0, 0], [0, 0], [0, 0]], color,
      [[0, A[1] - base, wt], [u(Bp) - u0, Bp[1] - base, wt], [u(p2) - u0, p2[1] - base, wt]], c, base);
  }

  B.addBuilding = function (ctx, s) {
    const pts = s.pts;
    if (!pts || pts.length < 3) return;
    curSeed = U.hash((s.seed || 1) * 7919 + 13);
    const cen = U.polyCentroid(pts);
    const ch = chunkOf(ctx, cen[0], cen[1]);
    const W = ch.walls, R = ch.roofs;
    const wallColor = colorOf(s.wall.color);
    const roofColor = colorOf(s.roof.color);
    const wt = s.wall.type;
    const base = s.base;
    const floor = s.floor;
    const gh = s.gh, sh = s.sh;
    const ups = Math.max(0, s.storeys - 1);
    const eaves = floor + gh + ups * sh + (s.extra || 0);
    const fronts = new Set(s.fronts || []);
    const jetty = s.jetty || 0;

    // upper polygon (jettied front edges pushed out)
    let up = pts;
    if (jetty > 0 && fronts.size) {
      up = pts.map((p) => [p[0], p[1]]);
      for (const ei of fronts) {
        const nrm = outwardNormal(pts, ei);
        const j = (ei + 1) % pts.length;
        up[ei] = [up[ei][0] + nrm[0] * jetty, up[ei][1] + nrm[1] * jetty];
        up[j] = [up[j][0] + nrm[0] * jetty, up[j][1] + nrm[1] * jetty];
      }
    }

    // ---- walls
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.3) continue;
      const nrm = outwardNormal(pts, i);
      const isFront = fronts.has(i);
      const party = s.party && s.party[i];
      const bayW = s.bayW || 3.0;
      const bays = Math.max(1, Math.round(len / bayW));
      // plinth: from below ground to floor level
      if (!s.noPlinth) band(W, a, b, nrm, base - 1.2, floor, bays, 1, 'blank', wt, wallColor, 0, -(floor - base + 1.2), base);
      // ground floor
      let gcell = 'blank';
      if (isFront) gcell = (s.groundByEdge && s.groundByEdge[i]) || s.ground || 'blank';
      else if (!party && len > 4 && s.sideWindows) gcell = 'smallsq';
      if (isFront && s.door && bays >= 3 && gcell !== 'arch') {
        // split: door in one bay
        const db = s.doorBay !== undefined ? Math.min(bays - 1, s.doorBay) : bays - 1;
        const f0 = db / bays, f1 = (db + 1) / bays;
        const lerp = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (db > 0) band(W, a, lerp(f0), nrm, floor, floor + gh, db, 1, gcell, wt, wallColor, 0, 0, base);
        band(W, lerp(f0), lerp(f1), nrm, floor, floor + gh, 1, 1, s.door, wt, wallColor, len * f0, 0, base);
        if (db < bays - 1) band(W, lerp(f1), b, nrm, floor, floor + gh, bays - db - 1, 1, gcell, wt, wallColor, len * f1, 0, base);
      } else {
        band(W, a, b, nrm, floor, floor + gh, bays, 1, gcell, wt, wallColor, 0, 0, base);
      }
      // upper floors
      const ua = up[i], ub = up[(i + 1) % n];
      if (ups > 0) {
        let ucell = 'blank';
        if (isFront) ucell = s.upper || 'sash6';
        else if (!party && len > 3.5 && s.sideWindows) ucell = s.sideUpper || 'smallsq';
        const ubays = Math.max(1, Math.round(Math.hypot(ub[0] - ua[0], ub[1] - ua[1]) / bayW));
        const wtu = s.upperWall !== undefined && isFront ? s.upperWall : wt;
        const cu = s.upperColor && isFront ? colorOf(s.upperColor) : wallColor;
        band(W, ua, ub, nrm, floor + gh, floor + gh + ups * sh, ubays, ups, ucell, wtu, cu, 0, gh, base);
      }
      // attic / parapet strip
      if (s.extra > 0) band(W, ua, ub, nrm, floor + gh + ups * sh, eaves, 1, 1, 'blank', wt, wallColor, 0, gh + ups * sh, base);
      // jetty soffit
      if (jetty > 0 && isFront && ups > 0) {
        const y = floor + gh;
        const dk = colorOf('#3a2c22');
        const A = [a[0], y, a[1]], Bv = [b[0], y, b[1]], C = [ub[0], y, ub[1]], D = [ua[0], y, ua[1]];
        W.quad([A, D, C, Bv], [0, -1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]], dk, [[0, 0, 7], [0, 0, 7], [0, 0, 7], [0, 0, 7]], [-1, -1, 0], base);
      }
      // cornice line (thin projecting band) for Georgian / Victorian fronts
      if (s.cornice && isFront) {
        const y = eaves - 0.05;
        const o = 0.18;
        const ca = [ua[0] + nrm[0] * o, ua[1] + nrm[1] * o], cb = [ub[0] + nrm[0] * o, ub[1] + nrm[1] * o];
        const cc = colorOf(s.corniceColor || '#e8e2d4');
        band(W, ca, cb, nrm, y - 0.32, y, 1, 1, 'blank', 7, cc, 0, 0, base);
        // underside
        W.quad([[ua[0], y - 0.32, ua[1]], [ub[0], y - 0.32, ub[1]], [cb[0], y - 0.32, cb[1]], [ca[0], y - 0.32, ca[1]]], [0, -1, 0],
          [[0, 0], [0, 0], [0, 0], [0, 0]], cc, [[0, 0, 7], [0, 0, 7], [0, 0, 7], [0, 0, 7]], [-1, -1, 0], base);
      }
    }

    // ---- roof
    const rt = s.roof.mat;
    const roofType = s.roof.type;
    const pitch = ((s.roof.pitch || 45) * Math.PI) / 180;
    const rp = up;
    if (roofType === 'gable' || roofType === 'hip') {
      const o = U.obb(rp);
      const ov = 0.25;
      const c = o.c, sn = o.s;
      // axis u along length, v across
      let alongLong = true;
      if (s.roof.ridge === 'short') alongLong = false;
      if (s.roof.ridge === 'street' && s.fronts && s.fronts.length) {
        const fi = s.fronts[0];
        const fa = pts[fi], fb = pts[(fi + 1) % pts.length];
        const fdx = fb[0] - fa[0], fdz = fb[1] - fa[1];
        const ang = Math.atan2(fdz, fdx);
        alongLong = Math.abs(Math.cos(ang - o.ang)) > 0.7;
      }
      if (s.roof.ridge === 'gableToStreet' && s.fronts && s.fronts.length) {
        const fi = s.fronts[0];
        const fa = pts[fi], fb = pts[(fi + 1) % pts.length];
        const ang = Math.atan2(fb[1] - fa[1], fb[0] - fa[0]);
        alongLong = Math.abs(Math.cos(ang - o.ang)) < 0.7;
      }
      let u0 = o.u0 - ov, u1 = o.u1 + ov, v0 = o.v0 - ov, v1 = o.v1 + ov;
      // local -> world
      const W2 = (u, v, y) => (alongLong ? [u * c - v * sn, y, u * sn + v * c] : [u * c - v * sn, y, u * sn + v * c]);
      let half, L0, L1, C0, C1; // ridge runs along 'L' axis
      if (alongLong) {
        half = (v1 - v0) / 2;
        L0 = u0;
        L1 = u1;
        C0 = v0;
        C1 = v1;
      } else {
        half = (u1 - u0) / 2;
        L0 = v0;
        L1 = v1;
        C0 = u0;
        C1 = u1;
      }
      const rise = Math.min(half * Math.tan(pitch), 9);
      const ye = eaves - ov * Math.tan(pitch) * 0.5;
      const yr = eaves + rise;
      const mid = (C0 + C1) / 2;
      const P = (l, cpos, y) => (alongLong ? W2(l, cpos, y) : W2(cpos, l, y));
      const hipIn = roofType === 'hip' ? Math.min(half, (L1 - L0) / 2 - 0.2) : 0;
      // two slopes
      const s1 = [P(L0, C0, ye), P(L1, C0, ye), P(L1 - hipIn, mid, yr), P(L0 + hipIn, mid, yr)];
      const s2 = [P(L1, C1, ye), P(L0, C1, ye), P(L0 + hipIn, mid, yr), P(L1 - hipIn, mid, yr)];
      const slopeLen = Math.hypot(half, yr - ye);
      for (const sl of [s1, s2]) {
        const e1 = [sl[1][0] - sl[0][0], sl[1][1] - sl[0][1], sl[1][2] - sl[0][2]];
        const e2 = [sl[3][0] - sl[0][0], sl[3][1] - sl[0][1], sl[3][2] - sl[0][2]];
        let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        let q = sl;
        if (ny < 0) {
          q = [sl[1], sl[0], sl[3], sl[2]];
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        const len = L1 - L0;
        R.quad(q, [nx, ny, nz], [[0, 0], [0, 0], [0, 0], [0, 0]], roofColor,
          [[0, 0, rt], [len, 0, rt], [len - hipIn, slopeLen, rt], [hipIn, slopeLen, rt]], [-1, -1, 0], base);
      }
      if (roofType === 'hip') {
        // hip end triangles
        const ends = [[P(L0, C1, ye), P(L0, C0, ye), P(L0 + hipIn, mid, yr)], [P(L1, C0, ye), P(L1, C1, ye), P(L1 - hipIn, mid, yr)]];
        for (const t of ends) {
          const e1 = [t[1][0] - t[0][0], t[1][1] - t[0][1], t[1][2] - t[0][2]];
          const e2 = [t[2][0] - t[0][0], t[2][1] - t[0][1], t[2][2] - t[0][2]];
          let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
          const l = Math.hypot(nx, ny, nz) || 1;
          let tt = t;
          if (ny < 0) {
            tt = [t[1], t[0], t[2]];
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }
          const w = C1 - C0;
          R.tri(tt, [nx / l, ny / l, nz / l], [[0, 0], [0, 0], [0, 0]], roofColor, [[0, 0, rt], [w, 0, rt], [w / 2, slopeLen, rt]], [-1, -1, 0], base);
        }
      } else {
        // gable end walls (wall material), slightly inside the eaves overhang
        const gi = ov;
        const ends = [
          { l: L0 + gi, n: alongLong ? [-c, 0, -sn] : [sn, 0, -c] },
          { l: L1 - gi, n: alongLong ? [c, 0, sn] : [-sn, 0, c] },
        ];
        for (const e of ends) {
          const p0 = P(e.l, C0 + gi, eaves), p1 = P(e.l, C1 - gi, eaves), p2 = P(e.l, mid, yr - 0.1);
          // fix normal direction outward from centre
          const cx = (p0[0] + p1[0]) / 2, cz = (p0[2] + p1[2]) / 2;
          let nn = e.n;
          if ((cx - cen[0]) * nn[0] + (cz - cen[1]) * nn[2] < 0) nn = [-nn[0], 0, -nn[2]];
          triWall(W, p0, p1, p2, nn, wt, wallColor, base);
          // fill strip below gable down to eaves line where the OBB extends beyond walls
        }
        // gable fronts may carry a small window
      }
      s._ridge = { y: yr, a: P(L0 + hipIn, mid, yr), b: P(L1 - hipIn, mid, yr) };
    } else if (roofType === 'band' || roofType === 'flat') {
      const isBand = roofType === 'band';
      let inner = null, d = 0;
      if (isBand) {
        const o = U.obb(rp);
        d = Math.min(2.2, Math.max(0.8, Math.min(o.wid, o.len) * 0.32));
        inner = inset(rp, d);
        if (!inner) {
          d *= 0.5;
          inner = inset(rp, d);
        }
      }
      const topY = isBand && inner ? eaves + d * Math.tan(pitch) : eaves;
      if (isBand && inner) {
        // sloped band between outer (eaves) and inner (top)
        const m = rp.length;
        for (let i = 0; i < m; i++) {
          const j = (i + 1) % m;
          const o0 = rp[i], o1 = rp[j], i0 = inner[i], i1 = inner[j];
          const nrm = outwardNormal(rp, i);
          const q = [[o0[0], eaves, o0[1]], [o1[0], eaves, o1[1]], [i1[0], topY, i1[1]], [i0[0], topY, i0[1]]];
          // ensure CCW from outside/top: check normal
          const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]];
          const e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
          let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
          let qq = q;
          if (ny < 0) {
            qq = [q[1], q[0], q[3], q[2]];
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }
          const l = Math.hypot(nx, ny, nz) || 1;
          const elen = Math.hypot(o1[0] - o0[0], o1[1] - o0[1]);
          const sl = Math.hypot(d, topY - eaves);
          R.quad(qq, [nx / l, ny / l, nz / l], [[0, 0], [0, 0], [0, 0], [0, 0]], roofColor, [[0, 0, rt], [elen, 0, rt], [elen, sl, rt], [0, sl, rt]], [-1, -1, 0], base);
          void nrm;
        }
      }
      // flat top
      const topPoly = isBand && inner ? inner : rp;
      const contour = topPoly.map((p) => new THREE.Vector2(p[0], p[1]));
      let tris;
      try {
        tris = THREE.ShapeUtils.triangulateShape(contour, []);
      } catch (e) {
        tris = [];
      }
      const flatMat = isBand && inner ? rt : 2;
      const fcol = isBand && inner ? roofColor : colorOf(s.roof.flatColor || '#6b6863');
      for (const t of tris) {
        let p0 = topPoly[t[0]], p1 = topPoly[t[1]], p2 = topPoly[t[2]];
        // ensure upward normal: (p1-p0)x(p2-p0) y-component = dz1*dx2 - dx1*dz2 must be > 0
        const ny = (p1[1] - p0[1]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[1] - p0[1]);
        if (ny < 0) {
          const tmp = p1;
          p1 = p2;
          p2 = tmp;
        }
        R.tri([[p0[0], topY, p0[1]], [p1[0], topY, p1[1]], [p2[0], topY, p2[1]]], [0, 1, 0], [[0, 0], [0, 0], [0, 0]], fcol,
          [[p0[0], p0[1], flatMat], [p1[0], p1[1], flatMat], [p2[0], p2[1], flatMat]], [-1, -1, 0], base);
      }
      // parapet for flat roofs
      if (!isBand && s.parapet !== false) {
        const ph = s.parapetH || 0.7;
        for (let i = 0; i < rp.length; i++) {
          const a = rp[i], b = rp[(i + 1) % rp.length];
          const nrm = outwardNormal(rp, i);
          band(W, a, b, nrm, eaves, eaves + ph, 1, 1, 'blank', wt, wallColor, 0, 0, base);
          // inner face
          const ia = [a[0] - nrm[0] * 0.25, a[1] - nrm[1] * 0.25], ib = [b[0] - nrm[0] * 0.25, b[1] - nrm[1] * 0.25];
          band(W, ia, ib, [-nrm[0], -nrm[1]], eaves, eaves + ph, 1, 1, 'blank', wt, wallColor, 0, 0, base);
          // coping
          W.quad([[a[0], eaves + ph, a[1]], [ia[0], eaves + ph, ia[1]], [ib[0], eaves + ph, ib[1]], [b[0], eaves + ph, b[1]]].reverse(), [0, 1, 0],
            [[0, 0], [0, 0], [0, 0], [0, 0]], colorOf('#bdb6a8'), [[0, 0, 7], [0, 0, 7], [0, 0, 7], [0, 0, 7]], [-1, -1, 0], base);
        }
      }
      s._ridge = { y: topY, a: [cen[0], topY, cen[1]], b: [cen[0], topY, cen[1]] };
    }

    // ---- chimneys (collected for instancing)
    if (s.chimneys && s._ridge) {
      const r = U.rng(s.seed || 1);
      for (let k = 0; k < s.chimneys; k++) {
        const t = s.chimneys === 1 ? r.range(0.15, 0.85) : k / (s.chimneys - 1);
        const a = s._ridge.a, b = s._ridge.b;
        const x = a[0] + (b[0] - a[0]) * (0.08 + 0.84 * t), z = a[2] + (b[2] - a[2]) * (0.08 + 0.84 * t);
        ctx.chimneys.push({ x, z, y: s._ridge.y - 0.6, h: r.range(1.2, 2.2), w: r.range(0.6, 1.1), col: s.wall.type === 1 ? '#9c5a44' : s.wall.color, base });
      }
    }

    // ---- signs
    if (s.signs && ctx.signGB) {
      for (const sg of s.signs) {
        const ei = sg.edge;
        const a = pts[ei], b = pts[(ei + 1) % pts.length];
        if (!a || !b) continue;
        const nrm = outwardNormal(pts, ei);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const uv = sg.uv;
        if (!uv) continue;
        const w = Math.min(len - 0.4, sg.width || Math.max(2.4, len * 0.86));
        if (w < 1) continue;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
        const o = sg.offset !== undefined ? sg.offset : 0.07;
        const cx = mx + nrm[0] * o, cz = mz + nrm[1] * o;
        const y0 = floor + (sg.y !== undefined ? sg.y : gh - 0.75), y1 = y0 + (sg.h || 0.55);
        const right = [nrm[1], -nrm[0]];
        let rx = dx, rz = dz;
        if (rx * right[0] + rz * right[1] < 0) {
          rx = -rx;
          rz = -rz;
        }
        const L = [cx - rx * w / 2, cz - rz * w / 2], Rr = [cx + rx * w / 2, cz + rz * w / 2];
        const white = new THREE.Color(1, 1, 1);
        ctx.signGB.quad([[L[0], y0, L[1]], [Rr[0], y0, Rr[1]], [Rr[0], y1, Rr[1]], [L[0], y1, L[1]]], [nrm[0], 0, nrm[1]],
          [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], white, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], [0, 0, 0], base);
        // board edge (thickness) as dark strip under sign
        if (sg.board !== false) {
          const dk = colorOf(sg.boardColor || '#2a2420');
          const bo = o - 0.06;
          const bl = [cx - rx * (w / 2 + 0.06) - nrm[0] * 0.01, cz - rz * (w / 2 + 0.06) - nrm[1] * 0.01];
          const br = [cx + rx * (w / 2 + 0.06) - nrm[0] * 0.01, cz + rz * (w / 2 + 0.06) - nrm[1] * 0.01];
          void bo;
          band(W, bl, br, nrm, y0 - 0.06, y1 + 0.06, 1, 1, 'blank', 7, dk, 0, 0, base);
        }
      }
    }

    // ---- collider
    if (ctx.col && !s.noCollide) {
      ctx.col.addPoly(pts, { y0: base - 2, y1: eaves + 3, tag: s.tag || 'building', owner: s });
    }
  };

  // Build final meshes for a context
  B.finish = function (ctx, mats, group) {
    for (const ch of ctx.chunks.values()) {
      const gw = ch.walls.build();
      if (gw) {
        const m = new THREE.Mesh(gw, mats.facade);
        m.castShadow = true;
        m.receiveShadow = true;
        m.name = 'walls-' + ch.key;
        group.add(m);
      }
      const gr = ch.roofs.build();
      if (gr) {
        const m = new THREE.Mesh(gr, mats.roof);
        m.castShadow = true;
        m.name = 'roofs-' + ch.key;
        group.add(m);
      }
    }
    if (ctx.signGB) {
      const gs = ctx.signGB.build();
      if (gs) {
        const m = new THREE.Mesh(gs, mats.sign);
        m.name = 'signs';
        group.add(m);
      }
    }
    // chimneys as instances
    if (ctx.chimneys.length) {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      const inst = new THREE.InstancedMesh(geo, mats.chimney, ctx.chimneys.length);
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      ctx.chimneys.forEach((c, i) => {
        mtx.compose(new THREE.Vector3(c.x, c.y, c.z), q, new THREE.Vector3(c.w, c.h, c.w * 0.55));
        inst.setMatrixAt(i, mtx);
        inst.setColorAt(i, tmpColor.set(c.col).multiplyScalar(0.9));
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.castShadow = true;
      inst.name = 'chimneys';
      group.add(inst);
    }
  };
})();
