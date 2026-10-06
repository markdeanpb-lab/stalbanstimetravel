/* People: smooth procedural humans, skinned on the GPU and drawn in instanced batches.
   One body mesh (two levels of detail, with a female shape blended in per person) is skinned to an
   18-bone skeleton in the vertex shader. Each frame, every visible person's skeleton is posed on the
   CPU from blended procedural animations (idle, walk, run, sitting, cycling, gestures) and written to
   one float texture, a row per person, which the vertex shader reads. The same row carries the
   person's clothing colours, so clothes are coloured by body region, and the face comes from a
   small painted atlas. Hair, hats and props are rigid instanced parts that follow the head and hand
   bones. The whole crowd costs about twenty draw calls. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;

  const MAX = 140; // people drawn at once
  const ROW = 64; // texels per person in the bone texture (18 bones x 3, then colours)
  const LOD_DIST = 24; // metres: beyond this the low-detail body is used
  // bones: name, parent, rest position (metres; the person faces +z and +x is their left)
  const BONES = [
    ['root', -1, 0, 0, 0],
    ['hips', 0, 0, 0.95, 0],
    ['spine', 1, 0, 1.08, -0.005],
    ['chest', 2, 0, 1.28, 0],
    ['neck', 3, 0, 1.52, -0.005],
    ['head', 4, 0, 1.62, 0.01],
    ['upperArmL', 3, 0.185, 1.465, -0.01],
    ['foreArmL', 6, 0.205, 1.18, -0.02],
    ['handL', 7, 0.215, 0.93, 0],
    ['upperArmR', 3, -0.185, 1.465, -0.01],
    ['foreArmR', 9, -0.205, 1.18, -0.02],
    ['handR', 10, -0.215, 0.93, 0],
    ['thighL', 1, 0.095, 0.92, 0],
    ['shinL', 12, 0.091, 0.5, 0.005],
    ['footL', 13, 0.089, 0.085, -0.01],
    ['thighR', 1, -0.095, 0.92, 0],
    ['shinR', 15, -0.091, 0.5, 0.005],
    ['footR', 16, -0.089, 0.085, -0.01],
  ];
  const NB = BONES.length;
  const BI = {};
  BONES.forEach((b, i) => (BI[b[0]] = i));
  const PARENT = BONES.map((b) => b[1]);
  const REST = BONES.map((b) => [b[2], b[3], b[4]]);
  const OFF = REST.map((r, i) => (PARENT[i] < 0 ? r.slice() : [r[0] - REST[PARENT[i]][0], r[1] - REST[PARENT[i]][1], r[2] - REST[PARENT[i]][2]]));
  const ROOT = 0, HIPS = 1, SPINE = 2, CHEST = 3, NECK = 4, HEAD = 5, UAL = 6, FAL = 7, HDL = 8, UAR = 9, FAR = 10, HDR = 11, THL = 12, SHL = 13, FTL = 14, THR = 15, SHR = 16, FTR = 17;
  // clothing regions, and the texel in a person's row that holds each region's colour
  const REG = { skin: 0, top: 1, legs: 2, shoes: 3, face: 4, skirt: 5, sleeves: 6, hair: 7 };
  const T_SKIN = NB * 3, T_TOP = T_SKIN + 1, T_SLEEVE = T_SKIN + 2, T_LEGS = T_SKIN + 3, T_SHOES = T_SKIN + 4, T_SKIRT = T_SKIN + 5, T_HAIR = T_SKIN + 6;

  // ------------------------------------------------------------------ geometry
  function Geo() {
    this.p = [];
    this.fd = [];
    this.uv = [];
    this.reg = [];
    this.si = [];
    this.sw = [];
    this.idx = [];
    this.n = 0;
  }
  // p: male position, f: female position, w: [[bone, weight], ...] (up to four)
  Geo.prototype.v = function (p, f, uv, reg, w) {
    this.p.push(p[0], p[1], p[2]);
    this.fd.push(f[0] - p[0], f[1] - p[1], f[2] - p[2]);
    this.uv.push(uv[0], uv[1]);
    this.reg.push(reg);
    let tot = 0;
    for (let i = 0; i < 4; i++) tot += w[i] ? w[i][1] : 0;
    for (let i = 0; i < 4; i++) {
      this.si.push(w[i] ? w[i][0] : 0);
      this.sw.push(w[i] ? w[i][1] / (tot || 1) : 0);
    }
    return this.n++;
  };
  // add a triangle, flipped if needed so its normal points along the hint
  Geo.prototype.tri = function (a, b, c, hint) {
    const P = this.p;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) this.idx.push(a, c, b);
    else this.idx.push(a, b, c);
  };
  Geo.prototype.build = function (skinned) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (skinned) {
      g.setAttribute('aFem', new THREE.Float32BufferAttribute(this.fd, 3));
      g.setAttribute('aReg', new THREE.Float32BufferAttribute(this.reg, 1));
      g.setAttribute('aSkinIdx', new THREE.Float32BufferAttribute(this.si, 4));
      g.setAttribute('aSkinW', new THREE.Float32BufferAttribute(this.sw, 4));
    }
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  // Loft a tube through rings. Ring: { c: centre, f: female centre, r: [radius along ax, along az],
  // fr: female radii, w: weights (or function), reg: region (or function), e: superellipse exponent }.
  // opts: t0/t1 for an open arc (radians from ax towards az), capStart/capEnd.
  function loft(G, rings, ax, az, N, opts) {
    opts = opts || {};
    const full = opts.t0 === undefined;
    const t0 = full ? 0 : opts.t0, t1 = full ? Math.PI * 2 : opts.t1;
    const cols = full ? N : N + 1;
    const ids = [];
    const pt = (c, r, cx, cz) => [c[0] + ax[0] * cx * r[0] + az[0] * cz * r[1], c[1] + ax[1] * cx * r[0] + az[1] * cz * r[1], c[2] + ax[2] * cx * r[0] + az[2] * cz * r[1]];
    for (const R of rings) {
      const row = [];
      const e = R.e || 2;
      for (let k = 0; k < cols; k++) {
        const t = t0 + ((t1 - t0) * k) / N;
        const ct = Math.cos(t), st = Math.sin(t);
        const cx = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / e), cz = Math.sign(st) * Math.pow(Math.abs(st), 2 / e);
        const p = pt(R.c, R.r, cx, cz);
        const f = pt(R.f || R.c, R.fr || R.r, cx, cz);
        const w = typeof R.w === 'function' ? R.w(p, cx, cz) : R.w;
        const reg = typeof R.reg === 'function' ? R.reg(p, cx, cz) : R.reg;
        row.push(G.v(p, f, R.uv ? R.uv(p) : [0, 0], reg, w));
      }
      ids.push(row);
    }
    for (let i = 0; i < rings.length - 1; i++) {
      for (let k = 0; k < N; k++) {
        const k2 = full ? (k + 1) % N : k + 1;
        const a = ids[i][k], b = ids[i][k2], c = ids[i + 1][k2], d = ids[i + 1][k];
        const hint = sub(G.p.slice(a * 3, a * 3 + 3), rings[i].c);
        G.tri(a, d, b, hint);
        G.tri(b, d, c, hint);
      }
    }
    const cap = (i, j) => {
      const R = rings[i];
      const ctr = G.v(R.c, R.f || R.c, R.uv ? R.uv(R.c) : [0, 0], typeof R.reg === 'function' ? R.reg(R.c, 0, 0) : R.reg, typeof R.w === 'function' ? R.w(R.c, 0, 0) : R.w);
      const hint = sub(R.c, rings[j].c);
      for (let k = 0; k < (full ? N : N); k++) G.tri(ctr, ids[i][k], ids[i][full ? (k + 1) % N : k + 1], hint);
    };
    if (opts.capStart) cap(0, 1);
    if (opts.capEnd) cap(rings.length - 1, rings.length - 2);
    return ids;
  }
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const gauss = (x, m, s) => Math.exp(-((x - m) * (x - m)) / (s * s));
  const sstep = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  // the head: an egg with jaw, chin, nose, brow, eye sockets, cheekbones and ears
  const HC = [0, 1.716, 0.012], HR = [0.083, 0.118, 0.101];
  function headPoint(th, ph, fem) {
    let x = Math.sin(th) * Math.cos(ph), y = Math.sin(ph), z = Math.cos(th) * Math.cos(ph);
    const front = Math.max(0, Math.cos(th)), back = Math.max(0, -Math.cos(th));
    const low = sstep(-0.15, -1.15, ph);
    x *= 1 - (fem ? 0.27 : 0.2) * low;
    z *= 1 - 0.38 * low * back - 0.08 * low;
    z += (fem ? 0.06 : 0.1) * front * front * gauss(ph, -0.85, 0.22);
    z += (fem ? 0.2 : 0.24) * gauss(th, 0, 0.12) * gauss(ph, -0.12, 0.14);
    z += (fem ? 0.025 : 0.05) * gauss(th, 0, 0.55) * gauss(ph, 0.21, 0.08);
    z -= 0.04 * (gauss(th, 0.36, 0.13) + gauss(th, -0.36, 0.13)) * gauss(ph, 0.07, 0.08);
    const sx = Math.sign(Math.sin(th)) || 1;
    x += sx * 0.13 * gauss(Math.abs(th), Math.PI / 2 + 0.05, 0.14) * gauss(ph, 0.02, 0.17);
    x += sx * 0.03 * gauss(Math.abs(th), 0.75, 0.25) * gauss(ph, -0.12, 0.2);
    const s = fem ? [0.95, 0.96, 0.95] : [1, 1, 1];
    return [HC[0] + x * HR[0] * s[0], HC[1] + y * HR[1] * s[1] - (fem ? 0.004 : 0), HC[2] + z * HR[2] * s[2]];
  }
  function faceUV(p) {
    if (p[2] - HC[2] < 0.005) return [0.5, -0.6];
    return [0.5 + ((p[0] - HC[0]) / (2 * HR[0])) * 0.95, (p[1] - (HC[1] - HR[1])) / (2 * HR[1])];
  }
  function buildHead(G, nLon, nLat) {
    const w = [[HEAD, 1]];
    const rows = [];
    for (let i = 1; i < nLat; i++) {
      const ph = -Math.PI / 2 + (Math.PI * i) / nLat;
      const row = [];
      for (let k = 0; k < nLon; k++) {
        const th = (Math.PI * 2 * k) / nLon;
        const p = headPoint(th, ph, false), f = headPoint(th, ph, true);
        row.push(G.v(p, f, faceUV(p), REG.face, ph < -0.95 ? [[HEAD, 0.7], [NECK, 0.3]] : w));
      }
      rows.push(row);
    }
    const hint = (a) => sub(G.p.slice(a * 3, a * 3 + 3), HC);
    for (let i = 0; i < rows.length - 1; i++) {
      for (let k = 0; k < nLon; k++) {
        const k2 = (k + 1) % nLon;
        const a = rows[i][k], b = rows[i][k2], c = rows[i + 1][k2], d = rows[i + 1][k];
        G.tri(a, b, d, hint(a));
        G.tri(b, c, d, hint(a));
      }
    }
    const top = G.v(headPoint(0, Math.PI / 2, false), headPoint(0, Math.PI / 2, true), [0.5, -0.6], REG.face, w);
    const bot = G.v(headPoint(0, -Math.PI / 2, false), headPoint(0, -Math.PI / 2, true), [0.5, -0.6], REG.face, [[HEAD, 0.6], [NECK, 0.4]]);
    const last = rows[rows.length - 1], first = rows[0];
    for (let k = 0; k < nLon; k++) {
      const k2 = (k + 1) % nLon;
      G.tri(top, last[k], last[k2], [0, 1, 0]);
      G.tri(bot, first[k2], first[k], [0, -1, 0]);
    }
  }
  const ring = (c, r, w, reg, f, fr, e) => ({ c, r, w, reg, f, fr, e });
  function buildBody(hi) {
    const G = new Geo();
    const NL = hi ? 10 : 6, NT = hi ? 16 : 8;
    const b = (name, side) => BI[name + side];
    // legs
    for (const sx of [1, -1]) {
      const S = sx > 0 ? 'L' : 'R';
      const th = b('thigh', S), sh = b('shin', S), ft = b('foot', S);
      const L = [
        [0.99, 0.09, 0.005, 0.095, 0.1, [[HIPS, 0.7], [th, 0.3]], 1.07],
        [0.93, 0.093, 0, 0.088, 0.095, [[HIPS, 0.35], [th, 0.65]], 1.07],
        [0.86, 0.094, 0, 0.083, 0.088, [[th, 1]], 1.03],
        [0.76, 0.094, 0.002, 0.074, 0.078, [[th, 1]], 0.98],
        [0.66, 0.093, 0.004, 0.064, 0.068, [[th, 1]], 0.95],
        [0.57, 0.092, 0.008, 0.055, 0.058, [[th, 0.85], [sh, 0.15]], 0.93],
        [0.5, 0.091, 0.012, 0.051, 0.054, [[th, 0.5], [sh, 0.5]], 0.92],
        [0.44, 0.091, 0.004, 0.05, 0.054, [[sh, 0.85], [th, 0.15]], 0.92],
        [0.36, 0.091, -0.006, 0.052, 0.058, [[sh, 1]], 0.93],
        [0.27, 0.09, -0.004, 0.045, 0.048, [[sh, 1]], 0.92],
        [0.18, 0.089, 0, 0.036, 0.038, [[sh, 1]], 0.9],
        [0.115, 0.089, 0, 0.032, 0.034, [[sh, 0.75], [ft, 0.25]], 0.9],
        [0.075, 0.089, 0, 0.031, 0.034, [[ft, 1]], 0.9],
      ].map(([y, cx, cz, rx, rz, w, fs], i, arr) => ring([cx * sx, y, cz], [rx, rz], w, i === arr.length - 1 ? REG.shoes : REG.legs, [(cx + (y > 0.85 ? 0.006 : 0)) * sx, y, cz], [rx * fs, rz * fs]));
      loft(G, L, X, Z, NL, { capEnd: true });
      // foot (shoe), from heel to toe
      const F = [
        [-0.065, 0.045, 0.03, 0.04],
        [-0.04, 0.05, 0.04, 0.05],
        [0, 0.052, 0.044, 0.052],
        [0.06, 0.04, 0.047, 0.04],
        [0.12, 0.03, 0.047, 0.03],
        [0.165, 0.025, 0.042, 0.024],
        [0.195, 0.022, 0.03, 0.017],
      ].map(([z, y, rx, ry]) => ring([0.089 * sx, y, z - 0.01], [rx, ry], [[ft, 1]], REG.shoes, [0.089 * sx, y * 0.95, (z - 0.01) * 0.92], [rx * 0.88, ry * 0.9], 2.6));
      loft(G, F, X, Y, hi ? 8 : 6, { capStart: true, capEnd: true });
    }
    // pelvis and torso
    const tw = (y) => (y < 1.0 ? [[HIPS, 1]] : y < 1.06 ? [[HIPS, 0.6], [SPINE, 0.4]] : y < 1.12 ? [[SPINE, 1]] : y < 1.2 ? [[SPINE, 0.7], [CHEST, 0.3]] : y < 1.28 ? [[CHEST, 0.7], [SPINE, 0.3]] : y < 1.48 ? [[CHEST, 1]] : y < 1.52 ? [[CHEST, 0.7], [NECK, 0.3]] : [[NECK, 0.6], [CHEST, 0.4]]);
    const T = [
      [0.845, -0.005, 0.125, 0.082, 0.135, 0.086, -0.005],
      [0.9, -0.01, 0.172, 0.105, 0.182, 0.11, -0.012],
      [0.97, -0.014, 0.178, 0.112, 0.192, 0.12, -0.018],
      [1.03, -0.006, 0.168, 0.104, 0.17, 0.104, -0.008],
      [1.09, 0, 0.158, 0.1, 0.135, 0.092, 0],
      [1.16, 0.004, 0.162, 0.104, 0.142, 0.096, 0.004],
      [1.24, 0.008, 0.172, 0.112, 0.158, 0.122, 0.02],
      [1.32, 0.01, 0.178, 0.116, 0.164, 0.118, 0.016],
      [1.39, 0.005, 0.18, 0.111, 0.164, 0.105, 0.006],
      [1.445, -0.003, 0.174, 0.1, 0.158, 0.095, -0.002],
      [1.485, -0.008, 0.158, 0.088, 0.142, 0.082, -0.006],
      [1.515, -0.01, 0.118, 0.077, 0.104, 0.07, -0.008],
      [1.54, -0.01, 0.084, 0.07, 0.074, 0.064, -0.01],
      [1.558, -0.01, 0.07, 0.066, 0.062, 0.059, -0.01],
    ].map(([y, cz, rx, rz, frx, frz, fcz]) => ring([0, y, cz], [rx, rz], tw(y), y < 1.06 ? REG.legs : REG.top, [0, y, fcz], [frx, frz], y > 1.36 ? 2.0 : 2.3));
    loft(G, T, X, Z, NT, { capStart: true });
    // neck
    const Nk = [
      [1.5, -0.008, 0.06, 0.062, [[CHEST, 0.5], [NECK, 0.5]]],
      [1.56, -0.006, 0.057, 0.06, [[NECK, 1]]],
      [1.615, 0, 0.056, 0.058, [[NECK, 0.6], [HEAD, 0.4]]],
      [1.66, 0.006, 0.052, 0.054, [[HEAD, 1]]],
    ].map(([y, cz, rx, rz, w]) => ring([0, y, cz], [rx, rz], w, REG.skin, [0, y, cz], [rx * 0.88, rz * 0.88]));
    loft(G, Nk, X, Z, NL);
    // arms and hands
    for (const sx of [1, -1]) {
      const S = sx > 0 ? 'L' : 'R';
      const ua = b('upperArm', S), fa = b('foreArm', S), hd = b('hand', S);
      const A = [
        [0.172, 1.48, -0.01, 0.022, 0.03, [[CHEST, 0.6], [ua, 0.4]], REG.sleeves, -0.012],
        [0.178, 1.463, -0.01, 0.045, 0.052, [[ua, 0.6], [CHEST, 0.4]], REG.sleeves, -0.012],
        [0.186, 1.425, -0.012, 0.057, 0.061, [[ua, 0.9], [CHEST, 0.1]], REG.sleeves, -0.012],
        [0.194, 1.35, -0.014, 0.055, 0.058, [[ua, 1]], REG.sleeves, -0.008],
        [0.2, 1.27, -0.016, 0.05, 0.053, [[ua, 1]], REG.sleeves, -0.008],
        [0.204, 1.19, -0.019, 0.046, 0.048, [[ua, 0.5], [fa, 0.5]], REG.sleeves, -0.008],
        [0.207, 1.13, -0.016, 0.046, 0.047, [[fa, 0.85], [ua, 0.15]], REG.sleeves, -0.008],
        [0.21, 1.05, -0.01, 0.041, 0.042, [[fa, 1]], REG.sleeves, -0.008],
        [0.213, 0.975, -0.004, 0.035, 0.036, [[fa, 1]], REG.sleeves, -0.008],
        [0.215, 0.945, 0, 0.026, 0.03, [[fa, 0.5], [hd, 0.5]], REG.skin, -0.008],
      ].map(([x, y, z, rx, rz, w, reg, fx]) => ring([x * sx, y, z], [rx, rz], w, reg, [(x + fx) * sx, y, z], [rx * 0.86, rz * 0.86]));
      loft(G, A, X, Z, NL, { capStart: true });
      const H = [
        [0.215, 0.94, 0, 0.022, 0.03],
        [0.217, 0.905, 0.003, 0.019, 0.04],
        [0.218, 0.865, 0.006, 0.017, 0.042],
        [0.218, 0.83, 0.008, 0.015, 0.038],
        [0.217, 0.8, 0.008, 0.012, 0.03],
        [0.215, 0.78, 0.006, 0.008, 0.016],
      ].map(([x, y, z, rx, rz]) => ring([x * sx, y, z], [rx, rz], [[hd, 1]], REG.skin, [(x - 0.008) * sx, y + 0.01, z], [rx * 0.9, rz * 0.9]));
      loft(G, H, X, Z, hi ? 8 : 5, { capEnd: true });
    }
    buildHead(G, hi ? 18 : 10, hi ? 12 : 7);
    return G.build(true);
  }
  // skirts and coat tails, skinned to the hips and swinging with the thighs
  function buildSkirt(kind) {
    const G = new Geo();
    const D = {
      long: { rings: [[1.07, 0.155, 0.104], [0.99, 0.19, 0.128], [0.88, 0.205, 0.146], [0.7, 0.226, 0.17], [0.5, 0.25, 0.195], [0.3, 0.276, 0.22], [0.1, 0.3, 0.242]], follow: 0.55 },
      knee: { rings: [[1.07, 0.155, 0.104], [0.99, 0.19, 0.128], [0.86, 0.2, 0.14], [0.68, 0.21, 0.152], [0.47, 0.222, 0.165]], follow: 0.8 },
      coat: { rings: [[1.07, 0.175, 0.112], [0.99, 0.19, 0.122], [0.86, 0.196, 0.13], [0.7, 0.2, 0.138], [0.52, 0.204, 0.146]], follow: 0.75, open: true },
    }[kind];
    const top = D.rings[0][0], hem = D.rings[D.rings.length - 1][0];
    const R = D.rings.map(([y, rx, rz]) => {
      const k = (top - y) / (top - hem);
      const f = D.follow * k * k * (3 - 2 * k);
      return ring([0, y, -0.008], [rx, rz], (p) => {
        const s = U.clamp(p[0] / 0.16, -1, 1);
        return [[HIPS, 1 - f], [THL, f * (0.5 + 0.5 * s)], [THR, f * (0.5 - 0.5 * s)]];
      }, REG.skirt, null, null, 2.2);
    });
    if (D.open) loft(G, R, X, Z, 14, { t0: Math.PI / 2 + 0.42, t1: Math.PI / 2 + Math.PI * 2 - 0.42 });
    else loft(G, R, X, Z, 16);
    return G.build(true);
  }
  // hair: a cap over the skull (hairline at the brow, down to the nape) and, for long styles, a
  // fall behind the head; rigid, following the head bone
  function hairPoint(th, ph, grow) {
    const back = Math.max(0, -Math.cos(th));
    const low = sstep(-0.15, -1.1, ph);
    const x = Math.sin(th) * Math.cos(ph) * (1 - 0.15 * low), y = Math.sin(ph), z = Math.cos(th) * Math.cos(ph) * (1 - 0.3 * low * back);
    return [HC[0] + x * (HR[0] + grow), HC[1] + y * (HR[1] + grow * 0.8) + grow * 0.3, HC[2] + z * (HR[2] + grow) - 0.004];
  }
  function buildHair(style) {
    const G = new Geo();
    const nLon = 18, nLat = 7;
    const cut = (th) => {
      const c = Math.cos(th);
      return 0.3 * Math.max(0, c) + 0.12 * (1 - Math.abs(c)) - (style === 'short' ? 0.62 : 0.8) * Math.max(0, -c);
    };
    const grow = style === 'short' ? 0.009 : 0.013;
    const cols = [];
    for (let k = 0; k <= nLon; k++) {
      const th = (Math.PI * 2 * k) / nLon;
      const ph0 = cut(th);
      const col = [];
      for (let i = 0; i <= nLat; i++) {
        const ph = ph0 + ((Math.PI / 2 - 0.02 - ph0) * i) / nLat;
        const p = hairPoint(th, ph, grow);
        col.push(G.v(p, p, [0, 0], REG.hair, [[HEAD, 1]]));
      }
      cols.push(col);
    }
    for (let k = 0; k < nLon; k++) {
      for (let i = 0; i < nLat; i++) {
        const a = cols[k][i], b = cols[k + 1][i], c = cols[k + 1][i + 1], d = cols[k][i + 1];
        const hint = sub(G.p.slice(a * 3, a * 3 + 3), HC);
        G.tri(a, b, c, hint);
        G.tri(a, c, d, hint);
      }
    }
    const crown = G.v(hairPoint(0, Math.PI / 2, grow), hairPoint(0, Math.PI / 2, grow), [0, 0], REG.hair, [[HEAD, 1]]);
    for (let k = 0; k < nLon; k++) G.tri(crown, cols[k][nLat], cols[k + 1][nLat], [0, 1, 0]);
    if (style === 'long' || style === 'bob') {
      const bottom = style === 'long' ? 1.47 : 1.6;
      const F = [];
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const y = 1.72 - ((1.72 - bottom) * i) / steps;
        const k = i / steps;
        F.push(ring([0, y, -0.018 - 0.02 * k], [0.092 + 0.014 * k, 0.095 - 0.012 * k], [[HEAD, 1]], REG.hair, null, null, 2));
      }
      loft(G, F, X, Z, 14, { t0: Math.PI / 2 + 0.95, t1: Math.PI / 2 + Math.PI * 2 - 0.95 });
    }
    return G.build(false);
  }

  // ------------------------------------------------------------------ faces
  // 4 x 4 painted masks: red = hair-coloured (brows, moustaches, beards), green = lips,
  // blue = eye whites (full) and dark lines (half: irises, lashes, the line of the mouth)
  function makeFaceAtlas() {
    const S = 512, C = S / 4;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 16; i++) {
      const ox = (i % 4) * C, oy = Math.floor(i / 4) * C;
      const P = (u, v) => [ox + u * C, oy + (1 - v) * C];
      const fem = i < 6;
      const rnd = U.rng(i * 31 + 7);
      const ey = 0.54, ew = 0.068 + rnd() * 0.012, eh = 0.026 + rnd() * 0.008;
      for (const ex of [0.335, 0.665]) {
        const [cx, cy] = P(ex, ey);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = 'rgb(0,0,255)';
        g.beginPath();
        g.ellipse(cx, cy, ew * C, eh * C, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgb(0,0,128)';
        g.beginPath();
        g.arc(cx, cy + 0.003 * C, 0.026 * C, 0, Math.PI * 2);
        g.fill();
        // upper lid and lashes
        g.strokeStyle = 'rgb(0,0,128)';
        g.lineWidth = (fem ? 0.022 : 0.014) * C;
        g.beginPath();
        g.ellipse(cx, cy + 0.004 * C, ew * C * 1.05, eh * C * 1.1, 0, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
        // brows
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = 'rgb(' + (fem ? 170 : 235) + ',0,0)';
        g.lineWidth = (fem ? 0.02 : 0.034 + rnd() * 0.012) * C;
        g.lineCap = 'round';
        const dir = ex < 0.5 ? -1 : 1;
        const by = 0.62 + rnd() * 0.02, arch = 0.012 + rnd() * 0.018;
        const [b0x, b0y] = P(ex - dir * 0.075, by - 0.006);
        const [b1x, b1y] = P(ex, by + arch);
        const [b2x, b2y] = P(ex + dir * 0.085, by - 0.012);
        g.beginPath();
        g.moveTo(b0x, b0y);
        g.quadraticCurveTo(b1x, b1y, b2x, b2y);
        g.stroke();
      }
      // nostrils
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgb(0,0,90)';
      for (const nx of [0.465, 0.535]) {
        const [x, y] = P(nx, 0.41);
        g.beginPath();
        g.ellipse(x, y, 0.014 * C, 0.008 * C, 0, 0, Math.PI * 2);
        g.fill();
      }
      // lips
      const mw = 0.1 + rnd() * 0.03;
      g.fillStyle = 'rgb(0,' + (fem ? 255 : 150) + ',0)';
      const [mx, my] = P(0.5, 0.3);
      g.beginPath();
      g.ellipse(mx, my - 0.012 * C, mw * C, (fem ? 0.022 : 0.016) * C, 0, Math.PI, Math.PI * 2);
      g.ellipse(mx, my + 0.004 * C, mw * C * 0.9, (fem ? 0.03 : 0.022) * C, 0, 0, Math.PI);
      g.fill();
      g.strokeStyle = 'rgb(0,0,128)';
      g.lineWidth = 0.012 * C;
      g.beginPath();
      g.moveTo(...P(0.5 - mw * 0.95, 0.302));
      g.quadraticCurveTo(...P(0.5, 0.296), ...P(0.5 + mw * 0.95, 0.302));
      g.stroke();
      // facial hair: 10-12 moustaches, 13-15 full beards, 6-9 clean-shaven or stubble
      g.fillStyle = 'rgb(255,0,0)';
      if (i >= 10) {
        g.beginPath();
        const [ax, ay] = P(0.5, 0.36);
        g.moveTo(ax, ay);
        g.bezierCurveTo(...P(0.42, 0.37), ...P(0.33, 0.35), ...P(0.3 - (i === 11 ? 0.05 : 0), 0.3 + (i === 11 ? 0.04 : 0)));
        g.bezierCurveTo(...P(0.36, 0.32), ...P(0.44, 0.335), ...P(0.5, 0.335));
        g.bezierCurveTo(...P(0.56, 0.335), ...P(0.64, 0.32), ...P(0.7 + (i === 11 ? 0.05 : 0), 0.3 + (i === 11 ? 0.04 : 0)));
        g.bezierCurveTo(...P(0.67, 0.35), ...P(0.58, 0.37), ax, ay);
        g.fill();
      }
      if (i >= 13) {
        g.beginPath();
        g.moveTo(...P(0.2, 0.42));
        g.bezierCurveTo(...P(0.2, 0.12), ...P(0.36, 0.02), ...P(0.5, 0.02));
        g.bezierCurveTo(...P(0.64, 0.02), ...P(0.8, 0.12), ...P(0.8, 0.42));
        g.lineTo(...P(0.72, 0.42));
        g.bezierCurveTo(...P(0.7, 0.3), ...P(0.62, 0.24), ...P(0.5, 0.24));
        g.bezierCurveTo(...P(0.38, 0.24), ...P(0.3, 0.3), ...P(0.28, 0.42));
        g.closePath();
        g.fill();
      } else if (i === 8 || i === 9) {
        // stubble
        g.fillStyle = 'rgb(70,0,0)';
        g.beginPath();
        g.moveTo(...P(0.22, 0.4));
        g.bezierCurveTo(...P(0.22, 0.1), ...P(0.4, 0.03), ...P(0.5, 0.03));
        g.bezierCurveTo(...P(0.6, 0.03), ...P(0.78, 0.1), ...P(0.78, 0.4));
        g.closePath();
        g.fill();
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 4;
    return t;
  }

  // ------------------------------------------------------------------ materials
  const SKIN_VERT = `
    attribute vec3 aFem; attribute float aReg; attribute vec4 aSkinIdx; attribute vec4 aSkinW; attribute float aRow;
    uniform highp sampler2D tBones;
    varying vec4 vRegA; varying vec4 vRegB; flat varying float vRow; varying vec3 vObj;
    mat4 boneMat(int row, int b) {
      vec4 r0 = texelFetch(tBones, ivec2(b * 3, row), 0);
      vec4 r1 = texelFetch(tBones, ivec2(b * 3 + 1, row), 0);
      vec4 r2 = texelFetch(tBones, ivec2(b * 3 + 2, row), 0);
      return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
    }
    mat4 skinMat() {
      int row = int(aRow + 0.5);
      ivec4 bi = ivec4(aSkinIdx + 0.5);
      mat4 m = boneMat(row, bi.x) * aSkinW.x + boneMat(row, bi.y) * aSkinW.y;
      if (aSkinW.z > 0.0) m += boneMat(row, bi.z) * aSkinW.z;
      if (aSkinW.w > 0.0) m += boneMat(row, bi.w) * aSkinW.w;
      return m;
    }
    mat4 skinM;
    bool skinSet = false;
    float femK() { return texelFetch(tBones, ivec2(${T_SKIN}, int(aRow + 0.5)), 0).w; }
  `;
  function patchSkinVertex(sh) {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SKIN_VERT)
      .replace('#include <beginnormal_vertex>', `
        skinM = skinMat(); skinSet = true;
        vec3 objectNormal = normalize(mat3(skinM) * normal);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif
      `)
      .replace('#include <begin_vertex>', `
        if (!skinSet) skinM = skinMat();
        vec3 restP = position + aFem * femK();
        vec3 transformed = (skinM * vec4(restP, 1.0)).xyz;
        // one-hot region weights: a boundary between two regions blends only those two
        float rr = floor(aReg + 0.5);
        vRegA = vec4(equal(vec4(rr), vec4(0.0, 1.0, 2.0, 3.0)));
        vRegB = vec4(equal(vec4(rr), vec4(4.0, 5.0, 6.0, 7.0)));
        vRow = aRow; vObj = restP;
      `);
  }
  const SKIN_FRAG = `
    uniform highp sampler2D tBones;
    uniform sampler2D tFace;
    varying vec4 vRegA; varying vec4 vRegB; flat varying float vRow; varying vec3 vObj;
    float region() {
      float r = 0.0, b = vRegA.x;
      if (vRegA.y > b) { b = vRegA.y; r = 1.0; }
      if (vRegA.z > b) { b = vRegA.z; r = 2.0; }
      if (vRegA.w > b) { b = vRegA.w; r = 3.0; }
      if (vRegB.x > b) { b = vRegB.x; r = 4.0; }
      if (vRegB.y > b) { b = vRegB.y; r = 5.0; }
      if (vRegB.z > b) { b = vRegB.z; r = 6.0; }
      if (vRegB.w > b) { b = vRegB.w; r = 7.0; }
      return r;
    }
    float chash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float cnoise(vec3 x) {
      vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(chash(i), chash(i + vec3(1,0,0)), f.x), mix(chash(i + vec3(0,1,0)), chash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(chash(i + vec3(0,0,1)), chash(i + vec3(1,0,1)), f.x), mix(chash(i + vec3(0,1,1)), chash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
  `;
  function personMaterial(faceTex, boneTex) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.tBones = { value: boneTex };
      sh.uniforms.tFace = { value: faceTex };
      patchSkinVertex(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vFaceUv = uv;').replace('#include <common>', '#include <common>\nvarying vec2 vFaceUv;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vFaceUv;\n' + SKIN_FRAG)
        .replace('#include <color_fragment>', `
          int prow = int(vRow + 0.5);
          float rg = region();
          int ct = rg < 0.5 ? ${T_SKIN} : rg < 1.5 ? ${T_TOP} : rg < 2.5 ? ${T_LEGS} : rg < 3.5 ? ${T_SHOES} : rg < 4.5 ? ${T_SKIN} : rg < 5.5 ? ${T_SKIRT} : rg < 6.5 ? ${T_SLEEVE} : ${T_HAIR};
          vec4 cdat = texelFetch(tBones, ivec2(ct, prow), 0);
          vec3 pc = cdat.rgb;
          float prough = 0.82;
          vec4 misc = texelFetch(tBones, ivec2(${T_TOP}, prow), 0);
          if (rg < 0.5 || (rg > 3.5 && rg < 4.5)) {
            prough = 0.55;
            pc *= 0.97 + 0.05 * cnoise(vObj * 160.0);
          } else if (rg > 2.5 && rg < 3.5) {
            prough = 0.32;
          } else {
            // woven cloth: a fine irregular texture, folds at the joints darkened a little
            pc *= 0.9 + 0.1 * cnoise(vObj * vec3(220.0, 260.0, 220.0)) + 0.06 * cnoise(vObj * 24.0);
          }
          // jackets (1897 and 1964): lapels, a shirt and tie at the neck, buttons
          if (rg > 0.5 && rg < 1.5 && misc.w > 0.5 && vObj.z > 0.02) {
            float ax = abs(vObj.x);
            float lap = (vObj.y - 1.27) * 0.3;
            if (vObj.y > 1.29 && ax < lap) {
              vec3 shirt = vec3(0.88, 0.86, 0.8);
              pc = ax < 0.012 && vObj.y < 1.47 ? pc * 0.45 + vec3(0.08, 0.04, 0.05) : shirt;
              prough = 0.7;
            } else if (abs(ax - lap) < 0.0035 && vObj.y > 1.27) pc *= 0.6;
            else if (ax < 0.006 && vObj.y < 1.24 && vObj.y > 1.05 && fract(vObj.y / 0.07) < 0.25) pc = vec3(0.12, 0.1, 0.08);
          }
          // a belt at the waist of trousers
          if (rg > 1.5 && rg < 2.5 && abs(vObj.y - 1.035) < 0.012) pc *= 0.4;
          if (rg > 3.5 && rg < 4.5 && vFaceUv.y > -0.1) {
            float fv = texelFetch(tBones, ivec2(${T_SLEEVE}, prow), 0).w;
            vec2 cell = vec2(mod(fv, 4.0), floor(fv / 4.0));
            vec2 fuv = clamp(vFaceUv, 0.01, 0.99);
            vec4 f = texture2D(tFace, vec2((cell.x + fuv.x) / 4.0, (3.0 - cell.y + fuv.y) / 4.0));
            vec3 hairc = texelFetch(tBones, ivec2(${T_HAIR}, prow), 0).rgb;
            float white = smoothstep(0.62, 0.9, f.b);
            float dark = smoothstep(0.12, 0.42, f.b) * (1.0 - white);
            pc = mix(pc, pc * vec3(0.82, 0.48, 0.46), f.g * 0.85);
            pc = mix(pc, hairc * 0.7, f.r * 0.92);
            pc = mix(pc, vec3(0.8, 0.78, 0.74), white);
            pc = mix(pc, vec3(0.045, 0.032, 0.026), dark);
            prough = mix(prough, 0.25, white);
          }
          if (rg > 6.5) prough = 0.5;
          diffuseColor.rgb = pc;
        `)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = prough;');
    };
    m.customProgramCacheKey = () => 'person-skinned';
    return m;
  }
  function personDepthMaterial(boneTex) {
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.tBones = { value: boneTex };
      patchSkinVertex(sh);
    };
    m.customProgramCacheKey = () => 'person-depth';
    return m;
  }

  // ------------------------------------------------------------------ rigid parts (hats, props)
  const PARTS = {};
  function strip(geo) {
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    return geo.index ? geo.toNonIndexed() : geo;
  }
  function defineParts() {
    const M = (list) => THREE.BufferGeometryUtils.mergeGeometries(list.map(strip));
    PARTS.hat_bowler = M([new THREE.SphereGeometry(0.12, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 0.03, 0), new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16).translate(0, 0.03, 0)]);
    PARTS.hat_tophat = M([new THREE.CylinderGeometry(0.11, 0.105, 0.2, 14).translate(0, 0.12, 0), new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16).translate(0, 0.025, 0)]);
    PARTS.hat_flatcap = M([new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(1, 0.55, 1.08).translate(0, 0.0, 0.01), new THREE.BoxGeometry(0.16, 0.012, 0.08).translate(0, 0.0, 0.14)]);
    PARTS.hat_boater = M([new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14).translate(0, 0.05, 0), new THREE.CylinderGeometry(0.19, 0.19, 0.012, 18).translate(0, 0.02, 0)]);
    PARTS.hat_ladyhat = M([new THREE.CylinderGeometry(0.09, 0.11, 0.08, 12).translate(0, 0.06, 0), new THREE.CylinderGeometry(0.24, 0.24, 0.012, 18).translate(0, 0.025, 0), new THREE.SphereGeometry(0.05, 8, 5).translate(0.06, 0.11, 0.02)]);
    PARTS.hat_helmet = M([new THREE.SphereGeometry(0.135, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1, 1.75, 1.05).translate(0, -0.02, 0), new THREE.SphereGeometry(0.03, 6, 4).translate(0, 0.21, 0), new THREE.CylinderGeometry(0.15, 0.15, 0.015, 14).translate(0, -0.03, 0)]);
    PARTS.hat_peaked = M([new THREE.CylinderGeometry(0.14, 0.12, 0.08, 14).translate(0, 0.02, 0), new THREE.BoxGeometry(0.2, 0.012, 0.09).translate(0, -0.01, 0.12)]);
    PARTS.hat_beanie = strip(new THREE.SphereGeometry(0.128, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.15, 1).translate(0, -0.005, 0));
    PARTS.hat_cap = PARTS.hat_peaked;
    PARTS.hat_headscarf = strip(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.7).scale(1.02, 1.0, 1.05).translate(0, -0.02, -0.005));
    PARTS.hat_beehive = strip(new THREE.SphereGeometry(0.11, 12, 9).scale(1, 1.6, 1).translate(0, 0.08, -0.01));
    PARTS.hat_bonnet = strip(new THREE.SphereGeometry(0.14, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1.0, 0.9, 1.15).translate(0, -0.01, -0.02));
    PARTS.hat_bun = strip(new THREE.SphereGeometry(0.06, 8, 6).translate(0, 0.03, -0.09));
    PARTS.hat_hood = strip(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1.05, 1.0, 1.08).translate(0, -0.03, -0.02));
    PARTS.hat_trilby = PARTS.hat_boater;
    PARTS.hat_parka = PARTS.hat_hood;
    PARTS.prop_phone = strip(new THREE.BoxGeometry(0.07, 0.14, 0.012));
    PARTS.prop_bag = strip(new THREE.BoxGeometry(0.1, 0.24, 0.3).translate(0, -0.14, 0));
    PARTS.prop_basket = M([new THREE.CylinderGeometry(0.16, 0.12, 0.16, 10, 1, true).translate(0, -0.12, 0), new THREE.TorusGeometry(0.1, 0.008, 4, 10, Math.PI).rotateY(Math.PI / 2).translate(0, -0.04, 0)]);
    PARTS.prop_paper = strip(new THREE.BoxGeometry(0.02, 0.3, 0.24).translate(0, -0.08, 0.06));
    PARTS.prop_coffee = strip(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 10).translate(0, -0.03, 0.03));
    PARTS.prop_flag = M([new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5).translate(0, 0.12, 0.03), new THREE.BoxGeometry(0.004, 0.14, 0.22).translate(0, 0.3, 0.14)]);
    PARTS.prop_cane = strip(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5).translate(0, -0.42, 0.04));
    PARTS.prop_carpetbag = strip(new THREE.BoxGeometry(0.16, 0.28, 0.36).translate(0, -0.18, 0));
    PARTS.prop_key = strip(new THREE.BoxGeometry(0.03, 0.16, 0.03).translate(0, -0.03, 0.04));
    PARTS.blob = new THREE.CircleGeometry(0.42, 14).rotateX(-Math.PI / 2);
  }
  const HAT_TYPES = ['bowler', 'tophat', 'flatcap', 'boater', 'ladyhat', 'helmet', 'peaked', 'beanie', 'cap', 'headscarf', 'beehive', 'bonnet', 'bun', 'hood', 'trilby', 'parka'];
  const PROP_TYPES = ['phone', 'bag', 'basket', 'paper', 'coffee', 'flag', 'cane', 'carpetbag', 'key'];
  // hats that cover the crown (no hair cap underneath)
  const COVERING = { helmet: 1, tophat: 1, hood: 1, parka: 1, headscarf: 1, bonnet: 1, beanie: 1, bowler: 1, flatcap: 1, boater: 1, ladyhat: 1, peaked: 1, cap: 1, trilby: 1 };

  // ------------------------------------------------------------------ poses
  // A pose is an Euler angle triple (x, y, z, applied as Ry Rx Rz) per bone, plus a root offset.
  // Limbs hang down, so a negative x swings a thigh or arm forwards; positive x bends a knee;
  // negative x bends an elbow; positive x leans the spine or nods the head forwards.
  const PL = NB * 3 + 3, RO = NB * 3;
  const set = (a, b, x, y, z) => {
    a[b * 3] = x;
    a[b * 3 + 1] = y;
    a[b * 3 + 2] = z;
  };
  function poseIdle(a, t, s) {
    a.fill(0);
    const br = Math.sin(t * 1.7 + s * 6), sh = Math.sin(t * 0.42 + s * 9);
    set(a, SPINE, 0.012, 0, 0);
    set(a, CHEST, 0.012 * br, 0, 0);
    set(a, HIPS, 0, 0.03 * sh, 0.022 * sh);
    set(a, NECK, -0.01, 0, 0);
    const look = Math.sin(t * 0.19 + s * 13) * Math.sin(t * 0.07 + s * 5);
    set(a, HEAD, 0.03 * Math.sin(t * 0.3 + s), 0.45 * look, 0);
    set(a, UAL, 0.04, 0, 0.07);
    set(a, FAL, -0.16 - 0.04 * br, 0, 0);
    set(a, HDL, -0.08, 0, 0);
    set(a, UAR, 0.04, 0, -0.07);
    set(a, FAR, -0.16 - 0.04 * br, 0, 0);
    set(a, HDR, -0.08, 0, 0);
    set(a, THL, -0.02, 0, -0.022 * sh);
    set(a, SHL, 0.05 + 0.06 * Math.max(0, sh), 0, 0);
    set(a, THR, -0.02, 0, -0.022 * sh);
    set(a, SHR, 0.05 + 0.06 * Math.max(0, -sh), 0, 0);
    set(a, FTL, -0.03 - 0.03 * Math.max(0, sh), 0, 0);
    set(a, FTR, -0.03 - 0.03 * Math.max(0, -sh), 0, 0);
    a[RO] = 0.01 * sh;
    a[RO + 1] = -0.004;
  }
  function poseWalk(a, ph, k) {
    a.fill(0);
    const s = Math.sin(ph), c = Math.cos(ph);
    for (const [th, sh, ft, p] of [[THL, SHL, FTL, ph], [THR, SHR, FTR, ph + Math.PI]]) {
      const sp = Math.sin(p);
      const thigh = -0.4 * k * sp;
      const knee = k * (0.95 * Math.pow(Math.max(0, Math.cos(p + 0.35)), 2) + 0.12 * Math.max(0, Math.sin(p - 1.9))) + 0.05;
      set(a, th, thigh, 0, 0);
      set(a, sh, knee, 0, 0);
      set(a, ft, -(thigh + knee) * 0.85 + 0.45 * k * Math.pow(Math.max(0, -Math.sin(p - 0.2)), 3) - 0.12 * k * Math.pow(Math.max(0, Math.sin(p - 0.1)), 4), 0, 0);
    }
    set(a, HIPS, 0, -0.09 * k * s, 0.03 * k * c);
    set(a, SPINE, 0.04 * k, 0, 0);
    set(a, CHEST, 0, 0.12 * k * s, -0.02 * k * c);
    set(a, NECK, -0.02 * k, -0.03 * k * s, 0);
    set(a, HEAD, 0, -0.03 * k * s, 0);
    set(a, UAL, 0.32 * k * s, 0, 0.07);
    set(a, FAL, -(0.18 + 0.25 * k * Math.max(0, -s)), 0, 0);
    set(a, UAR, -0.32 * k * s, 0, -0.07);
    set(a, FAR, -(0.18 + 0.25 * k * Math.max(0, s)), 0, 0);
    set(a, HDL, -0.1, 0, 0);
    set(a, HDR, -0.1, 0, 0);
    a[RO] = -0.018 * k * c;
    a[RO + 1] = 0.022 * k * Math.cos(2 * ph) - 0.012 * k;
  }
  function poseRun(a, ph, k) {
    a.fill(0);
    const s = Math.sin(ph);
    for (const [th, sh, ft, p] of [[THL, SHL, FTL, ph], [THR, SHR, FTR, ph + Math.PI]]) {
      const sp = Math.sin(p);
      const thigh = -0.6 * k * sp - 0.12;
      const knee = 0.25 + 1.5 * k * Math.pow(Math.max(0, Math.cos(p + 0.5)), 1.5);
      set(a, th, thigh, 0, 0);
      set(a, sh, knee, 0, 0);
      set(a, ft, -(thigh + knee) * 0.7 + 0.3 * k * Math.pow(Math.max(0, -Math.sin(p - 0.3)), 2), 0, 0);
    }
    set(a, HIPS, 0, -0.12 * k * s, 0);
    set(a, SPINE, 0.16, 0, 0);
    set(a, CHEST, 0.06, 0.16 * k * s, 0);
    set(a, NECK, -0.08, -0.06 * k * s, 0);
    set(a, HEAD, -0.06, -0.04 * k * s, 0);
    set(a, UAL, 0.55 * k * s - 0.1, 0, 0.12);
    set(a, FAL, -1.45 - 0.2 * s, 0, 0);
    set(a, UAR, -0.55 * k * s - 0.1, 0, -0.12);
    set(a, FAR, -1.45 + 0.2 * s, 0, 0);
    set(a, HDL, -0.2, 0, 0);
    set(a, HDR, -0.2, 0, 0);
    a[RO + 1] = 0.045 * k * Math.abs(Math.sin(ph)) - 0.035;
  }
  function poseSeated(a, steering) {
    set(a, THL, -1.45, 0, 0.06);
    set(a, THR, -1.45, 0, -0.06);
    set(a, SHL, 1.45, 0, 0);
    set(a, SHR, 1.45, 0, 0);
    set(a, FTL, 0, 0, 0);
    set(a, FTR, 0, 0, 0);
    set(a, SPINE, -0.04, 0, 0);
    if (steering) {
      set(a, UAL, -0.75, 0, 0.12);
      set(a, UAR, -0.75, 0, -0.12);
      set(a, FAL, -0.55, 0, 0);
      set(a, FAR, -0.55, 0, 0);
    } else {
      set(a, UAL, -0.3, 0, 0.1);
      set(a, UAR, -0.3, 0, -0.1);
      set(a, FAL, -0.9, 0, 0);
      set(a, FAR, -0.9, 0, 0);
    }
  }
  function poseBicycle(a, ph) {
    const s = Math.sin(ph);
    set(a, THL, -1.05 + 0.45 * s, 0, 0.04);
    set(a, SHL, 1.25 - 0.6 * s, 0, 0);
    set(a, THR, -1.05 - 0.45 * s, 0, -0.04);
    set(a, SHR, 1.25 + 0.6 * s, 0, 0);
    set(a, FTL, -0.2 + 0.25 * s, 0, 0);
    set(a, FTR, -0.2 - 0.25 * s, 0, 0);
    set(a, SPINE, 0.2, 0, 0);
    set(a, CHEST, 0.15, 0, 0);
    set(a, NECK, -0.15, 0, 0);
    set(a, HEAD, -0.15, 0, 0);
    set(a, UAL, -0.85, 0, 0.1);
    set(a, UAR, -0.85, 0, -0.1);
    set(a, FAL, -0.35, 0, 0);
    set(a, FAR, -0.35, 0, 0);
  }
  // gestures: [pose writer, bones it drives]
  const ARMS = [UAL, FAL, HDL, UAR, FAR, HDR];
  const ACTIONS = {
    cower: {
      bones: [SPINE, CHEST, NECK, HEAD, UAL, FAL, HDL, UAR, FAR, HDR, THL, SHL, FTL, THR, SHR, FTR, ROOT],
      pose(a) {
        set(a, SPINE, 0.3, 0, 0);
        set(a, CHEST, 0.15, 0, 0);
        set(a, NECK, 0.15, 0, 0);
        set(a, HEAD, 0.3, 0, 0);
        set(a, UAL, -2.5, 0, 0.35);
        set(a, UAR, -2.5, 0, -0.35);
        set(a, FAL, -1.9, 0, 0);
        set(a, FAR, -1.9, 0, 0);
        set(a, THL, -0.55, 0, 0.1);
        set(a, THR, -0.55, 0, -0.1);
        set(a, SHL, 1.0, 0, 0);
        set(a, SHR, 1.0, 0, 0);
        set(a, FTL, -0.45, 0, 0);
        set(a, FTR, -0.45, 0, 0);
        a[RO + 1] = -0.16;
      },
    },
    wave: {
      bones: [UAR, FAR, HDR, HEAD],
      pose(a, t) {
        set(a, UAR, -0.2, 0, -2.45);
        set(a, FAR, -0.35, 0, 0.45 * Math.sin(t * 9));
        set(a, HDR, 0, 0, 0);
      },
    },
    point: {
      bones: [UAR, FAR, HDR],
      pose(a) {
        set(a, UAR, -1.45, 0, -0.12);
        set(a, FAR, -0.06, 0, 0);
        set(a, HDR, 0.1, 0, 0);
      },
    },
    wind: {
      bones: ARMS,
      pose(a, t) {
        set(a, UAL, -0.75, 0, -0.22);
        set(a, FAL, -1.55, 0, 0);
        set(a, UAR, -0.8, 0, 0.22);
        set(a, FAR, -1.5 + 0.15 * Math.sin(t * 14), 0, 0);
        set(a, HDR, 0, 0, 0.6 * Math.sin(t * 14));
        set(a, HDL, 0, 0, 0);
      },
    },
    phone: {
      bones: [UAR, FAR, HDR],
      pose(a) {
        set(a, UAR, -0.55, 0, -0.5);
        set(a, FAR, -2.35, 0, 0);
        set(a, HDR, 0.2, 0, 0);
      },
    },
    carry: {
      bones: [UAR, FAR, HDR],
      pose(a) {
        set(a, UAR, -0.15, 0, -0.06);
        set(a, FAR, -0.55, 0, 0);
        set(a, HDR, 0, 0, 0);
      },
    },
  };

  // ------------------------------------------------------------------ pool
  function Pool(scene) {
    if (!PARTS.blob) defineParts();
    this.scene = scene;
    this.list = [];
    this.data = new Float32Array(ROW * MAX * 4);
    const bt = (this.boneTex = new THREE.DataTexture(this.data, ROW, MAX, THREE.RGBAFormat, THREE.FloatType));
    bt.magFilter = bt.minFilter = THREE.NearestFilter;
    bt.generateMipmaps = false;
    bt.needsUpdate = true;
    this.faceTex = makeFaceAtlas();
    const mat = (this.mat = personMaterial(this.faceTex, bt));
    const depth = personDepthMaterial(bt);
    const shadows = SA.Render && SA.Render.tier && SA.Render.tier.shadow > 0;
    const skinned = (name, geo) => {
      geo.setAttribute('aRow', new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage));
      const m = new THREE.InstancedMesh(geo, mat, MAX);
      m.customDepthMaterial = depth;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = 'people-' + name;
      scene.add(m);
      return m;
    };
    this.skinned = {
      bodyHi: skinned('body', buildBody(true)),
      bodyLo: skinned('body-far', buildBody(false)),
      long: skinned('dress', buildSkirt('long')),
      knee: skinned('skirt', buildSkirt('knee')),
      coat: skinned('coat', buildSkirt('coat')),
    };
    this.meshes = {};
    const rigidMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 });
    const mk = (name, geo, count, material) => {
      const m = new THREE.InstancedMesh(geo, material || rigidMat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      m.name = 'people-' + name;
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      scene.add(m);
      this.meshes[name] = m;
      return m;
    };
    for (const st of ['short', 'long', 'bob']) mk('hair_' + st, buildHair(st), MAX, hairMat);
    for (const h of HAT_TYPES) if (!this.meshes['hat_' + h]) mk('hat_' + h, PARTS['hat_' + h], h === 'helmet' || h === 'bowler' || h === 'flatcap' ? MAX : 60);
    for (const p of PROP_TYPES) mk('prop_' + p, PARTS['prop_' + p], 50);
    // contact shadows (the only shadow on Low, a soft footprint under real shadows elsewhere)
    const bm = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: shadows ? 0.16 : 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.blobs = new THREE.InstancedMesh(PARTS.blob, bm, MAX);
    this.blobs.count = 0;
    this.blobs.frustumCulled = false;
    this.blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.blobs);
    this.pose = new Float32Array(PL);
    this.tmpA = new Float32Array(PL);
    this.tmpB = new Float32Array(PL);
    this.tmpC = new Float32Array(PL);
    this.W = new Float32Array(NB * 12);
    this._m = new THREE.Matrix4();
    this._root = new THREE.Matrix4();
    this._bone = new THREE.Matrix4();
    this._loc = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._e = new THREE.Euler();
  }
  Pool.prototype.add = function (ch) {
    this.list.push(ch);
    return ch;
  };
  Pool.prototype.remove = function (ch) {
    const i = this.list.indexOf(ch);
    if (i >= 0) this.list.splice(i, 1);
  };
  Pool.prototype.clear = function (filter) {
    this.list = filter ? this.list.filter((c) => !filter(c)) : [];
  };

  // blend the person's animations into this.pose
  Pool.prototype._animate = function (ch, dt) {
    const st = ch._anim || (ch._anim = { g: 0, r: 0, act: null, k: 0, look: 0, lookN: 0, seed: ch.seed !== undefined ? ch.seed : Math.random() });
    const P = this.pose, A = this.tmpA, B = this.tmpB;
    const moving = ch.anim === 'walk' || ch.anim === 'run';
    const ease = (v, target, rate) => v + (target - v) * Math.min(1, dt * rate);
    st.g = ease(st.g, moving ? 1 : 0, 8);
    st.r = ease(st.r, ch.anim === 'run' ? 1 : 0, 5);
    const sp = ch.moveSpeed || (ch.anim === 'run' ? 5 : 1.4);
    const longSkirt = ch.look.skirt === 2;
    poseIdle(P, ch.t, st.seed);
    if (st.g > 0.01 && !ch.seated && !ch.ride) {
      poseWalk(A, ch.phase, U.clamp(sp / 1.35, 0.35, 1.25) * (longSkirt ? 0.72 : 1));
      if (st.r > 0.01) {
        poseRun(B, ch.phase, U.clamp(sp / 5, 0.6, 1.3));
        for (let i = 0; i < PL; i++) A[i] += (B[i] - A[i]) * st.r;
      }
      for (let i = 0; i < PL; i++) P[i] += (A[i] - P[i]) * st.g;
    }
    if (ch.ride === 'bicycle') poseBicycle(P, ch.phase);
    else if (ch.seated) poseSeated(P, true);
    // gestures blend in and out over a quarter of a second
    let act = null;
    if (ch.anim === 'cower' || ch.anim === 'wave' || ch.anim === 'point' || ch.anim === 'wind') act = ch.anim;
    else if (ch.prop === 'phone' && ch.anim !== 'run' && !ch.seated && !ch.ride) act = 'phone';
    else if ((ch.prop === 'basket' || ch.prop === 'coffee' || ch.prop === 'paper') && !ch.ride) act = 'carry';
    if (act) st.act = act;
    st.k = ease(st.k, act ? 1 : 0, 7);
    if (st.act && st.k > 0.01) {
      const def = ACTIONS[st.act];
      const C = this.tmpC;
      C.set(P);
      def.pose(C, ch.t);
      for (const b of def.bones) {
        if (b === ROOT) {
          for (let j = 0; j < 3; j++) P[RO + j] += (C[RO + j] - P[RO + j]) * st.k;
          continue;
        }
        for (let j = 0; j < 3; j++) P[b * 3 + j] += (C[b * 3 + j] - P[b * 3 + j]) * st.k;
      }
    } else if (st.k <= 0.01) st.act = null;
    // people near the player turn their heads to look at them
    const pl = SA.Player && SA.Player.ch;
    let lookT = 0;
    if (pl && ch !== pl && st.g < 0.5 && !ch.seated && ch.anim !== 'down' && ch.anim !== 'cower') {
      const dx = pl.x - ch.x, dz = pl.z - ch.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 30) {
        let rel = Math.atan2(dx, dz) - ch.yaw;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) < 2.0) lookT = U.clamp(rel, -1.15, 1.15);
      }
    }
    st.look = ease(st.look, lookT, 3);
    if (Math.abs(st.look) > 0.01) {
      P[HEAD * 3 + 1] = P[HEAD * 3 + 1] * 0.3 + st.look * 0.6;
      P[NECK * 3 + 1] += st.look * 0.4;
    }
    if (ch.anim === 'down') {
      const k = Math.min(1, (ch.downT || 0) * 3);
      P[ROOT * 3] = -(Math.PI / 2 - 0.12) * k;
      P[RO + 1] += 0.14 * k;
      P[UAL * 3 + 2] += 0.5 * k;
      P[UAR * 3 + 2] -= 0.5 * k;
    }
    if (ch.seated && ch.seatY) P[RO + 1] += ch.seatY;
  };
  // pose -> skin matrices in the person's texture row
  Pool.prototype._bones = function (row) {
    const a = this.pose, W = this.W, D = this.data;
    for (let i = 0; i < NB; i++) {
      const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
      const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
      const r00 = cy * cz + sy * sx * sz, r01 = -cy * sz + sy * sx * cz, r02 = sy * cx;
      const r10 = cx * sz, r11 = cx * cz, r12 = -sx;
      const r20 = -sy * cz + cy * sx * sz, r21 = sy * sz + cy * sx * cz, r22 = cy * cx;
      let tx = OFF[i][0], ty = OFF[i][1], tz = OFF[i][2];
      if (i === 0) {
        tx += a[RO];
        ty += a[RO + 1];
        tz += a[RO + 2];
      }
      const o = i * 12, p = PARENT[i];
      if (p < 0) {
        W[o] = r00; W[o + 1] = r01; W[o + 2] = r02; W[o + 3] = tx;
        W[o + 4] = r10; W[o + 5] = r11; W[o + 6] = r12; W[o + 7] = ty;
        W[o + 8] = r20; W[o + 9] = r21; W[o + 10] = r22; W[o + 11] = tz;
      } else {
        const q = p * 12;
        for (let r = 0; r < 3; r++) {
          const a0 = W[q + r * 4], a1 = W[q + r * 4 + 1], a2 = W[q + r * 4 + 2], a3 = W[q + r * 4 + 3];
          W[o + r * 4] = a0 * r00 + a1 * r10 + a2 * r20;
          W[o + r * 4 + 1] = a0 * r01 + a1 * r11 + a2 * r21;
          W[o + r * 4 + 2] = a0 * r02 + a1 * r12 + a2 * r22;
          W[o + r * 4 + 3] = a0 * tx + a1 * ty + a2 * tz + a3;
        }
      }
      // skin matrix = W * T(-rest): the translation column moves by -R * rest
      const base = (row * ROW + i * 3) * 4, rx = REST[i][0], ry = REST[i][1], rz = REST[i][2];
      for (let r = 0; r < 3; r++) {
        const m0 = W[o + r * 4], m1 = W[o + r * 4 + 1], m2 = W[o + r * 4 + 2];
        D[base + r * 4] = m0;
        D[base + r * 4 + 1] = m1;
        D[base + r * 4 + 2] = m2;
        D[base + r * 4 + 3] = W[o + r * 4 + 3] - (m0 * rx + m1 * ry + m2 * rz);
      }
    }
  };
  // the skin matrix of bone i in this.data as a Matrix4
  Pool.prototype._boneMatrix = function (row, i, out) {
    const D = this.data, b = (row * ROW + i * 3) * 4;
    out.set(D[b], D[b + 1], D[b + 2], D[b + 3], D[b + 4], D[b + 5], D[b + 6], D[b + 7], D[b + 8], D[b + 9], D[b + 10], D[b + 11], 0, 0, 0, 1);
    return out;
  };
  const tmpCol = new THREE.Color();
  function putColor(D, i, hex, w) {
    tmpCol.set(hex || '#808080');
    D[i] = tmpCol.r;
    D[i + 1] = tmpCol.g;
    D[i + 2] = tmpCol.b;
    D[i + 3] = w || 0;
  }
  // per-person details that the look does not specify, fixed by the person's own seed
  function details(ch) {
    if (ch._det) return ch._det;
    const lk = ch.look;
    const s = ch._anim ? ch._anim.seed : Math.random();
    const r = U.rng(Math.floor(s * 1e6) + 1);
    const fem = !!(lk.fem || lk.skirt);
    const era = ch.era || 2026;
    let face;
    if (fem) face = Math.floor(r() * 6);
    else {
      const x = r();
      if (era === 1897) face = x < 0.32 ? 10 + Math.floor(r() * 3) : x < 0.55 ? 13 + Math.floor(r() * 3) : 6 + Math.floor(r() * 4);
      else if (era === 1964) face = x < 0.14 ? 10 + Math.floor(r() * 3) : 6 + Math.floor(r() * 2);
      else face = x < 0.25 ? 8 + Math.floor(r() * 2) : x < 0.35 ? 13 + Math.floor(r() * 3) : 6 + Math.floor(r() * 2);
    }
    if (lk.face !== undefined) face = lk.face;
    const police = ch.role === 'police';
    const suit = lk.suit !== undefined ? lk.suit : !fem && (police || (era === 1897 ? r() < 0.8 : era === 1964 ? r() < 0.5 : r() < 0.08));
    const coat = lk.coat !== undefined ? lk.coat : !fem && !lk.skirt && ((police && era === 1897) || (era === 1897 && r() < 0.35));
    const hair = lk.hairStyle || (fem ? (r() < 0.7 ? 'long' : 'bob') : r() < 0.92 ? 'short' : 'none');
    ch._det = { fem, face, suit, coat, hair };
    return ch._det;
  }

  Pool.prototype.update = function (dt, camPos) {
    for (const k in this.meshes) this.meshes[k].count = 0;
    for (const k in this.skinned) this.skinned[k].count = 0;
    this.blobs.count = 0;
    const D = this.data;
    const pl = SA.Player && SA.Player.ch;
    let row = 0;
    for (const ch of this.list) {
      if (!ch.visible || ch.camNear) continue;
      let d2 = 0;
      if (camPos) {
        d2 = U.dist2(ch.x, ch.z, camPos.x, camPos.z);
        if (d2 > 160 * 160) continue;
      }
      if (row >= MAX) break;
      this._animate(ch, dt);
      this._bones(row);
      const lk = ch.look, det = details(ch);
      const base = (row * ROW + NB * 3) * 4;
      // colours by region; the spare w components carry the female shape weight (skin),
      // the jacket flag (top) and the face variant (sleeves)
      putColor(D, base, lk.skin, det.fem ? 1 : 0);
      putColor(D, base + 4, lk.top, det.suit ? 1 : 0);
      putColor(D, base + 8, lk.sleeves || lk.top, det.face);
      putColor(D, base + 12, lk.legs, 0);
      putColor(D, base + 16, lk.shoes || '#1e1a17', 0);
      putColor(D, base + 20, lk.skirt ? lk.skirtColor || lk.legs : lk.top, 0);
      putColor(D, base + 24, lk.hair || '#2a1d14', 0);
      // root transform
      const h = lk.height || 1, w = lk.build || 1;
      this._q.setFromAxisAngle(this._v.set(0, 1, 0), ch.yaw);
      this._root.compose(this._v.set(ch.x, ch.y, ch.z), this._q, this._s.set(h * w, h, h * w));
      const near = !camPos || d2 < LOD_DIST * LOD_DIST || ch === pl;
      this._putSkinned(near ? 'bodyHi' : 'bodyLo', row);
      if (lk.skirt === 2) this._putSkinned('long', row);
      else if (lk.skirt === 1) this._putSkinned('knee', row);
      else if (det.coat) this._putSkinned('coat', row);
      // hair and hat follow the head
      const head = this._boneMatrix(row, HEAD, this._bone);
      const hat = lk.hat && lk.hat !== 'none' ? lk.hat : null;
      if (det.hair !== 'none' && lk.hair) {
        if (!hat || !COVERING[hat]) this._putRigid('hair_' + det.hair, head, null, lk.hair);
        else if (det.hair === 'long' && hat !== 'hood' && hat !== 'parka' && hat !== 'headscarf') this._putRigid('hair_long', head, null, lk.hair);
      }
      if (hat && this.meshes['hat_' + hat]) {
        const low = hat === 'headscarf' || hat === 'hood' || hat === 'parka' || hat === 'bonnet';
        const hy = low ? 1.716 : hat === 'beehive' || hat === 'bun' ? 1.74 : 1.784;
        this._loc.compose(this._v.set(0, hy, low ? 0.006 : 0.01), this._q.identity(), this._s.set(0.95, 0.97, 0.95));
        this._putRigid('hat_' + hat, head, this._loc, lk.hatColor || '#222');
      }
      // held prop in the right hand
      if (ch.prop && this.meshes['prop_' + ch.prop]) {
        const pr = ch.prop;
        const hand = this._boneMatrix(row, HDR, this._bone);
        this._loc.makeTranslation(REST[HDR][0] - 0.005, REST[HDR][1] - 0.075, REST[HDR][2] + 0.01);
        this._putRigid('prop_' + pr, hand, this._loc, ch.propColor || (pr === 'phone' ? '#111' : pr === 'carpetbag' ? '#7a3b2a' : pr === 'basket' ? '#a87a3a' : pr === 'paper' ? '#e9e4d6' : pr === 'coffee' ? '#f2f2f2' : pr === 'key' ? '#3a3a3a' : pr === 'flag' ? '#c8102e' : '#4a3a2a'));
      }
      // contact shadow
      const bi = this.blobs.count;
      if (bi < MAX) {
        this._m.compose(this._v.set(ch.x, ch.groundY !== undefined ? ch.groundY + 0.03 : ch.y + 0.03, ch.z), this._q.identity(), this._s.set(1, 1, 1));
        this.blobs.setMatrixAt(bi, this._m);
        this.blobs.count = bi + 1;
      }
      row++;
    }
    for (const k in this.skinned) {
      const m = this.skinned[k];
      m.visible = m.count > 0;
      if (!m.visible) continue;
      m.instanceMatrix.needsUpdate = true;
      m.geometry.attributes.aRow.needsUpdate = true;
    }
    for (const k in this.meshes) {
      const m = this.meshes[k];
      m.visible = m.count > 0;
      if (!m.visible) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.blobs.visible = this.blobs.count > 0;
    this.blobs.instanceMatrix.needsUpdate = true;
    if (row > 0) this.boneTex.needsUpdate = true;
    return row;
  };
  Pool.prototype._putSkinned = function (name, row) {
    const m = this.skinned[name];
    const i = m.count;
    if (i >= MAX) return;
    m.setMatrixAt(i, this._root);
    m.geometry.attributes.aRow.array[i] = row;
    m.count = i + 1;
  };
  // a rigid part placed by a bone's skin matrix (parts are modelled in the rest pose)
  Pool.prototype._putRigid = function (name, bone, local, color) {
    const m = this.meshes[name];
    const i = m.count;
    if (i >= m.instanceMatrix.count) return;
    this._m.multiplyMatrices(this._root, bone);
    if (local) this._m.multiply(local);
    m.setMatrixAt(i, this._m);
    m.setColorAt(i, this._c.set(color));
    m.count = i + 1;
  };

  // ------------------------------------------------------------------ character state object
  function Character(opts) {
    Object.assign(this, {
      x: 0, y: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, phase: 0, t: 0, anim: 'idle', visible: true,
      look: { skin: '#e0ac85', top: '#333', legs: '#223', hair: '#2a1d14', hat: 'none', hatColor: '#222', skirt: 0, build: 1, height: 1 },
      prop: null, radius: 0.32, era: 2026, downT: 0, role: 'npc', seated: false, moveSpeed: 0,
    }, opts || {});
    if (this.seed === undefined) this.seed = Math.random();
  }
  Character.prototype.animate = function (dt, moveSpeed) {
    this.t += dt;
    if (this.anim === 'down') {
      this.downT += dt;
      return;
    }
    this.moveSpeed = moveSpeed;
    if (moveSpeed > 0.15) {
      this.anim = moveSpeed > 3.2 ? 'run' : 'walk';
      // one stride (two steps) per cycle: about 1.5 m walking, 2.6 m running
      this.phase += dt * (moveSpeed > 3.2 ? (Math.PI * 2 * moveSpeed) / 2.6 : (Math.PI * 2 * moveSpeed) / 1.45);
    } else if (this.anim === 'walk' || this.anim === 'run') {
      this.anim = 'idle';
    }
  };
  // a new look invalidates the details chosen for the old one
  Object.defineProperty(Character.prototype, 'look', {
    get() {
      return this._look;
    },
    set(v) {
      this._look = v;
      this._det = null;
    },
  });

  // ------------------------------------------------------------------ era looks
  function pickWeighted(r, obj) {
    let t = 0;
    for (const k in obj) t += obj[k];
    let x = r() * t;
    for (const k in obj) {
      x -= obj[k];
      if (x <= 0) return k;
    }
    return Object.keys(obj)[0];
  }
  SA.randomLook = function (eraId, r, opts) {
    const E = SA.ERAS[eraId].npc;
    const P = E.palette;
    const pick = (a) => a[Math.floor(r() * a.length)];
    const fem = r() < 0.5;
    let hat = pickWeighted(r, E.hats);
    let skirt = 0;
    if (fem && r() < E.skirts * 2) skirt = eraId === 1897 ? 2 : r() < 0.7 ? 1 : 2;
    if (eraId === 1897 && fem) skirt = 2;
    // gendered hats by era
    if (eraId === 1897) {
      if (fem && ['bowler', 'flatcap', 'tophat', 'boater'].includes(hat)) hat = r() < 0.7 ? 'ladyhat' : 'bonnet';
      if (!fem && ['ladyhat', 'bonnet'].includes(hat)) hat = r() < 0.5 ? 'bowler' : 'flatcap';
    }
    if (eraId === 1964) {
      if (fem && ['trilby', 'flatcap'].includes(hat)) hat = 'headscarf';
      if (!fem && ['headscarf', 'beehive'].includes(hat)) hat = r() < 0.5 ? 'trilby' : 'none';
    }
    if (!fem && (hat === 'bun' || hat === 'beehive')) hat = 'none';
    const look = {
      skin: pick(P.skin), hair: pick(P.hair), top: pick(P.top), legs: pick(P.legs), shoes: eraId === 2026 && r() < 0.5 ? '#f2f2f2' : '#1e1a17',
      hat, hatColor: hat === 'boater' ? '#e8d9a8' : hat === 'tophat' ? '#151515' : hat === 'headscarf' ? pick(['#c8102e', '#e8b100', '#7aa6b8', '#f2efe4', '#9b6b9f']) : hat === 'beehive' || hat === 'bun' ? null : pick(['#222', '#3a2f28', '#4a4038', '#2b3245', '#5a2a2a', '#ccc5b3']),
      skirt, skirtColor: null, build: 0.92 + r() * 0.2 + (fem ? -0.05 : 0.04), height: 0.94 + r() * 0.1 + (fem ? -0.03 : 0.02), fem,
    };
    if (hat === 'beehive' || hat === 'bun') look.hatColor = look.hair;
    if (skirt) look.skirtColor = pick(eraId === 1897 ? ['#2b2b38', '#3a2a40', '#4a2a2a', '#22303a', '#3a3a2a', '#5a4a3a'] : ['#c8102e', '#1d3c6e', '#e8b100', '#2e6b3a', '#9b6b9f', '#2b2b2b', '#d46a3a']);
    if (eraId === 1897 && fem) look.top = pick(['#f0ebdf', '#e8dcc8', '#2b3245', '#5a2a2a', '#3a2f28', '#d9c8b0']);
    // stockings under skirts
    if (skirt) look.legs = pick(['#2a2622', '#3a3430', '#1e1e22', '#8a7a6a']);
    let prop = null;
    for (const k in E.props) if (r() < E.props[k]) prop = k;
    return { look, prop };
  };
  // outfits for the player
  SA.OUTFITS = {
    modern: { label: '2026 clothes', era: 2026, look: { top: '#2f4858', legs: '#2b3f63', shoes: '#e9e9e9', hat: 'none', hair: '#3a2618', skin: '#d9a07a', skirt: 0, build: 1, height: 1, sleeves: '#2f4858', face: 6, suit: false, coat: false, hairStyle: 'short' } },
    mod1964: { label: '1964 mod jacket', era: 1964, look: { top: '#4b5320', legs: '#3a3a40', shoes: '#1e1a17', hat: 'none', hair: '#3a2618', skin: '#d9a07a', skirt: 0, build: 1, height: 1, sleeves: '#4b5320', face: 6, suit: true, coat: false, hairStyle: 'short' } },
    victorian: { label: '1897 coat and cap', era: 1897, look: { top: '#2c2620', legs: '#3a342e', shoes: '#1e1a17', hat: 'flatcap', hatColor: '#4a4038', hair: '#3a2618', skin: '#d9a07a', skirt: 0, build: 1.04, height: 1, sleeves: '#2c2620', face: 6, suit: true, coat: true, hairStyle: 'short' } },
  };

  SA.CharPool = Pool;
  SA.Character = Character;
})();
