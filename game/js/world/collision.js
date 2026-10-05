/* 2.5D collision world: static polygons (buildings, walls, barriers) and circles (posts, trees)
   in a uniform grid; circle resolution for characters/vehicles and segment casts for the camera. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;

  function Collision(cell) {
    this.cell = cell || 8;
    this.grid = new Map();
    this.polys = [];
    this.circles = [];
    this.stamp = 0;
  }
  const P = Collision.prototype;
  P.key = function (ix, iz) {
    return ix * 73856093 ^ iz * 19349663;
  };
  P._cellsFor = function (x0, z0, x1, z1, fn) {
    const c = this.cell;
    const ix0 = Math.floor(x0 / c), ix1 = Math.floor(x1 / c), iz0 = Math.floor(z0 / c), iz1 = Math.floor(z1 / c);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) fn(this.key(ix, iz));
  };
  P._insert = function (k, item) {
    let a = this.grid.get(k);
    if (!a) this.grid.set(k, (a = []));
    a.push(item);
  };
  // pts: [[x,z],...] ; opts: {y0, y1, tag, cam (blocks camera), walk (blocks walking), veh (blocks vehicles)}
  P.addPoly = function (pts, opts) {
    opts = opts || {};
    const b = U.polyBounds(pts);
    const poly = {
      type: 'poly', pts, b, y0: opts.y0 !== undefined ? opts.y0 : -50, y1: opts.y1 !== undefined ? opts.y1 : 200,
      tag: opts.tag || '', cam: opts.cam !== false, walk: opts.walk !== false, veh: opts.veh !== false, id: this.polys.length, owner: opts.owner || null,
      _s: 0, enabled: true,
    };
    this.polys.push(poly);
    this._cellsFor(b.x0, b.z0, b.x1, b.z1, (k) => this._insert(k, poly));
    return poly;
  };
  P.addBox = function (cx, cz, hw, hd, ang, opts) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map((p) => [cx + p[0] * c - p[1] * s, cz + p[0] * s + p[1] * c]);
    return this.addPoly(pts, opts);
  };
  P.addCircle = function (x, z, r, opts) {
    opts = opts || {};
    const circ = { type: 'circle', x, z, r, y1: opts.y1 !== undefined ? opts.y1 : 3, tag: opts.tag || '', cam: !!opts.cam, walk: opts.walk !== false, veh: opts.veh !== false, _s: 0, enabled: true };
    this.circles.push(circ);
    this._cellsFor(x - r, z - r, x + r, z + r, (k) => this._insert(k, circ));
    return circ;
  };
  P.query = function (x0, z0, x1, z1, fn) {
    const s = ++this.stamp;
    this._cellsFor(x0, z0, x1, z1, (k) => {
      const a = this.grid.get(k);
      if (!a) return;
      for (const it of a) {
        if (it._s === s) continue;
        it._s = s;
        if (it.enabled) fn(it);
      }
    });
  };

  // Resolve a circle against static geometry. mode: 'walk' | 'veh'. Returns {x, z, hit, nx, nz}.
  const res = { x: 0, z: 0, hit: false, nx: 0, nz: 0 };
  P.resolve = function (x, z, r, mode, yFeet) {
    res.hit = false;
    res.nx = res.nz = 0;
    const flag = mode === 'veh' ? 'veh' : 'walk';
    const yf = yFeet === undefined ? -1e9 : yFeet;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      this.query(x - r - 0.5, z - r - 0.5, x + r + 0.5, z + r + 0.5, (it) => {
        if (!it[flag]) return;
        if (it.type === 'circle') {
          const dx = x - it.x, dz = z - it.z;
          const d = Math.hypot(dx, dz), m = r + it.r;
          if (d < m) {
            const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
            x = it.x + nx * m;
            z = it.z + nz * m;
            res.hit = true;
            res.nx = nx;
            res.nz = nz;
            moved = true;
          }
          return;
        }
        if (yf > it.y1 - 0.2 || yf + 1.6 < it.y0) return; // passing under an arch or over a low wall
        const pts = it.pts;
        if (x < it.b.x0 - r || x > it.b.x1 + r || z < it.b.z0 - r || z > it.b.z1 + r) return;
        const inside = U.pointInPoly(x, z, pts);
        let best = Infinity, bx = 0, bz = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const c = U.closestOnSeg(x, z, pts[j][0], pts[j][1], pts[i][0], pts[i][1]);
          const d2 = U.dist2(x, z, c[0], c[1]);
          if (d2 < best) {
            best = d2;
            bx = c[0];
            bz = c[1];
          }
        }
        const d = Math.sqrt(best);
        if (inside || d < r) {
          let nx = x - bx, nz = z - bz;
          let l = Math.hypot(nx, nz);
          if (l < 1e-6) {
            nx = 1;
            nz = 0;
            l = 1;
          }
          nx /= l;
          nz /= l;
          if (inside) {
            nx = -nx;
            nz = -nz;
          }
          x = bx + nx * (r + 0.001);
          z = bz + nz * (r + 0.001);
          res.hit = true;
          res.nx = nx;
          res.nz = nz;
          moved = true;
        }
      });
      if (!moved) break;
    }
    res.x = x;
    res.z = z;
    return res;
  };

  // Is a point (with radius) free of static geometry?
  P.isFree = function (x, z, r, mode) {
    const flag = mode === 'veh' ? 'veh' : 'walk';
    let free = true;
    this.query(x - r, z - r, x + r, z + r, (it) => {
      if (!free || !it[flag]) return;
      if (it.type === 'circle') {
        if (U.dist(x, z, it.x, it.z) < r + it.r) free = false;
        return;
      }
      if (x < it.b.x0 - r || x > it.b.x1 + r || z < it.b.z0 - r || z > it.b.z1 + r) return;
      if (U.pointInPoly(x, z, it.pts) || U.distToPoly(x, z, it.pts) < r) free = false;
    });
    return free;
  };
  P.polyAt = function (x, z, tagFilter) {
    let found = null;
    this.query(x, z, x, z, (it) => {
      if (found || it.type !== 'poly') return;
      if (tagFilter && it.tag !== tagFilter) return;
      if (U.pointInPoly(x, z, it.pts)) found = it;
    });
    return found;
  };

  // Segment cast for the camera: from (ax,ay,az) to (bx,by,bz). Returns fraction of first blocking hit.
  P.castCamera = function (ax, ay, az, bx, by, bz) {
    let best = 1;
    this.query(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1, (it) => {
      if (!it.cam) return;
      if (it.type === 'circle') {
        // treat as vertical cylinder
        const c = U.closestOnSeg(it.x, it.z, ax, az, bx, bz);
        if (U.dist(it.x, it.z, c[0], c[1]) < it.r && c[2] < best) {
          const y = ay + (by - ay) * c[2];
          if (y < it.y1) best = Math.max(0, c[2] - 0.05);
        }
        return;
      }
      const pts = it.pts;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const t = U.segIntersect(ax, az, bx, bz, pts[j][0], pts[j][1], pts[i][0], pts[i][1]);
        if (t >= 0 && t < best) {
          const y = ay + (by - ay) * t;
          if (y < it.y1 && y > it.y0) best = t;
        }
      }
    });
    return best;
  };
  // Line of sight for police/NPC perception (eye height ~1.6)
  P.lineOfSight = function (ax, az, bx, bz) {
    let clear = true;
    this.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), (it) => {
      if (!clear || it.type !== 'poly' || !it.cam) return;
      const pts = it.pts;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if (U.segIntersect(ax, az, bx, bz, pts[j][0], pts[j][1], pts[i][0], pts[i][1]) >= 0) {
          if (it.y1 > 2) {
            clear = false;
            return;
          }
        }
      }
    });
    return clear;
  };

  SA.Collision = Collision;
})();
