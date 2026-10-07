/* LAST SPACE: ST ALBANS - shared namespace and small utilities.
   Every script is a classic script that hangs off window.LS, so the game runs from file://
   and the simulation files also load in Node (tools/sim.js) with window = globalThis. */
window.LS = window.LS || {};
(function (LS) {
  'use strict';
  const U = LS.U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  U.sign = (v) => (v < 0 ? -1 : 1);
  U.wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  // difference between two headings, ignoring direction (0..PI/2)
  U.axisDiff = (a, b) => { let d = Math.abs(U.wrap(a - b)); if (d > Math.PI / 2) d = Math.PI - d; return d; };
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.approach = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

  // seeded RNG (mulberry32) so matches and tests are reproducible
  U.rng = function (seed) {
    let s = seed >>> 0;
    const f = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (a, b) => a + (b - a) * f();
    f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    return f;
  };

  // distance from point to segment, with the parameter t
  U.segDist = function (px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-9;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t, qy = ay + dy * t;
    return { d: Math.hypot(px - qx, py - qy), t, x: qx, y: qy };
  };

  // polyline helper: cumulative lengths, sampling, projection
  U.Polyline = class {
    constructor(pts) {
      this.pts = pts.map((p) => [p[0], p[1]]);
      this.cum = [0];
      for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1]));
      this.length = this.cum[this.cum.length - 1];
    }
    // position, unit tangent and left normal at arclength s
    at(s) {
      s = U.clamp(s, 0, this.length);
      let i = 1;
      while (i < this.cum.length - 1 && this.cum[i] < s) i++;
      const a = this.pts[i - 1], b = this.pts[i];
      const l = this.cum[i] - this.cum[i - 1] || 1e-9;
      const t = (s - this.cum[i - 1]) / l;
      const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx, ty, nx: -ty, ny: tx, heading: Math.atan2(ty, tx) };
    }
    // smoothed tangent (averaged over +-w metres) - used for parking-strip alignment near bends
    tangentAt(s, w) {
      const a = this.at(s - w), b = this.at(s + w);
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      return { tx: dx / l, ty: dy / l };
    }
    project(px, py) {
      let best = { d: 1e9, s: 0, x: 0, y: 0, i: 0 };
      for (let i = 0; i < this.pts.length - 1; i++) {
        const a = this.pts[i], b = this.pts[i + 1];
        const r = U.segDist(px, py, a[0], a[1], b[0], b[1]);
        if (r.d < best.d) best = { d: r.d, s: this.cum[i] + r.t * (this.cum[i + 1] - this.cum[i]), x: r.x, y: r.y, i };
      }
      // signed side: + is left of travel direction
      const a = this.pts[best.i], b = this.pts[best.i + 1];
      best.side = ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])) >= 0 ? 1 : -1;
      return best;
    }
  };

  // tiny event bus
  U.Emitter = class {
    constructor() { this.h = {}; }
    on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); return fn; }
    off(ev, fn) { const a = this.h[ev]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
    emit(ev, data) { const a = this.h[ev]; if (a) for (const fn of a.slice()) fn(data); const s = this.h['*']; if (s) for (const fn of s.slice()) fn(ev, data); }
  };

  // Okabe-Ito based colour-blind-safe palette, each paired with a shape so colour is never the only cue
  LS.IDENTITY = [
    { color: '#E69F00', shape: 'circle', glyph: '●' },
    { color: '#56B4E9', shape: 'square', glyph: '■' },
    { color: '#009E73', shape: 'triangle', glyph: '▲' },
    { color: '#F0E442', shape: 'diamond', glyph: '◆' },
    { color: '#0072B2', shape: 'star', glyph: '★' },
    { color: '#D55E00', shape: 'hexagon', glyph: '⬢' },
    { color: '#CC79A7', shape: 'cross', glyph: '✚' },
    { color: '#FFFFFF', shape: 'ring', glyph: '◎' },
  ];
})(window.LS);
