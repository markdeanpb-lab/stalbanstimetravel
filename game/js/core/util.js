/* Core utilities and the SA namespace. Classic script: everything hangs off window.SA. */
(function () {
  'use strict';
  const SA = (window.SA = window.SA || {});
  SA.VERSION = '0.1.0-m1';

  const U = (SA.U = {});

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.smoothstep = (a, b, v) => U.smooth(U.clamp((v - a) / (b - a), 0, 1));
  // frame-rate independent exponential approach
  U.damp = (a, b, lambda, dt) => b + (a - b) * Math.exp(-lambda * dt);
  U.wrapAngle = (a) => {
    a = (a + Math.PI) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a - Math.PI;
  };
  U.dampAngle = (a, b, lambda, dt) => a + U.wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
  U.dist2 = (ax, az, bx, bz) => {
    const dx = ax - bx, dz = az - bz;
    return dx * dx + dz * dz;
  };
  U.dist = (ax, az, bx, bz) => Math.sqrt(U.dist2(ax, az, bx, bz));
  U.len = (x, z) => Math.sqrt(x * x + z * z);

  // Deterministic RNG (mulberry32)
  U.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    return f;
  };
  U.hash = function (n) {
    // integer hash -> [0,1)
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  };
  U.hashStr = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // ---------------------------------------------------------------- 2D geometry on the ground plane (x, z)
  U.polyArea = function (p) {
    let a = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] * p[i][1] - p[i][0] * p[j][1]);
    return a / 2;
  };
  U.polyCentroid = function (p) {
    let x = 0, z = 0, a = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
      x += (p[j][0] + p[i][0]) * f;
      z += (p[j][1] + p[i][1]) * f;
      a += f;
    }
    if (Math.abs(a) < 1e-9) {
      let sx = 0, sz = 0;
      for (const q of p) { sx += q[0]; sz += q[1]; }
      return [sx / p.length, sz / p.length];
    }
    return [x / (3 * a), z / (3 * a)];
  };
  U.pointInPoly = function (x, z, p) {
    let inside = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  // closest point on segment a-b to p; returns [x, z, t]
  U.closestOnSeg = function (px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return [ax + dx * t, az + dz * t, t];
  };
  // segment-segment intersection param along first segment, or -1
  U.segIntersect = function (ax, az, bx, bz, cx, cz, dx, dz) {
    const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz;
    const den = rx * sz - rz * sx;
    if (Math.abs(den) < 1e-12) return -1;
    const qx = cx - ax, qz = cz - az;
    const t = (qx * sz - qz * sx) / den;
    const u = (qx * rz - qz * rx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
    return -1;
  };
  U.polyBounds = function (p) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const q of p) {
      if (q[0] < x0) x0 = q[0];
      if (q[0] > x1) x1 = q[0];
      if (q[1] < z0) z0 = q[1];
      if (q[1] > z1) z1 = q[1];
    }
    return { x0, z0, x1, z1 };
  };
  // minimum-area oriented bounding rectangle of a polygon (rotating calipers over edges)
  U.obb = function (p) {
    let best = null;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const c = Math.cos(ang), s = Math.sin(ang);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const q of p) {
        const u = q[0] * c + q[1] * s, v = -q[0] * s + q[1] * c;
        if (u < u0) u0 = u;
        if (u > u1) u1 = u;
        if (v < v0) v0 = v;
        if (v > v1) v1 = v;
      }
      const area = (u1 - u0) * (v1 - v0);
      if (!best || area < best.area) best = { area, ang, c, s, u0, u1, v0, v1 };
    }
    const cu = (best.u0 + best.u1) / 2, cv = (best.v0 + best.v1) / 2;
    best.cx = cu * best.c - cv * best.s;
    best.cz = cu * best.s + cv * best.c;
    best.len = best.u1 - best.u0;
    best.wid = best.v1 - best.v0;
    return best;
  };
  // distance from point to polygon boundary
  U.distToPoly = function (x, z, p) {
    let best = Infinity;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const c = U.closestOnSeg(x, z, p[j][0], p[j][1], p[i][0], p[i][1]);
      const d = U.dist2(x, z, c[0], c[1]);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  // ---------------------------------------------------------------- tiny event bus
  const listeners = {};
  SA.on = function (ev, fn) {
    (listeners[ev] = listeners[ev] || []).push(fn);
    return () => SA.off(ev, fn);
  };
  SA.off = function (ev, fn) {
    const l = listeners[ev];
    if (!l) return;
    const i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  };
  SA.emit = function (ev, a, b, c) {
    const l = listeners[ev];
    if (!l) return;
    for (const fn of l.slice()) {
      try {
        fn(a, b, c);
      } catch (e) {
        console.error('[SA] listener error for', ev, e);
      }
    }
  };

  // ---------------------------------------------------------------- DOM helpers
  U.$ = (id) => document.getElementById(id);
  U.show = (el, on) => {
    if (typeof el === 'string') el = U.$(el);
    if (el) el.classList.toggle('hidden', !on);
  };
  U.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Formatting
  U.fmtTime = (s) => {
    s = Math.max(0, Math.ceil(s));
    return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + 's';
  };

  // Detect touch-first devices (coarse pointer) for default control scheme
  U.isTouch = () => (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

  // Errors to screen (helps on phones without devtools)
  window.addEventListener('error', function (e) {
    const el = document.getElementById('err');
    if (!el) return;
    el.textContent = 'Error: ' + (e.message || e.error) + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : '');
    el.classList.remove('hidden');
    SA.lastError = el.textContent;
  });
})();
