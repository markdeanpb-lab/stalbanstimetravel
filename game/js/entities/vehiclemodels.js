/* Vehicle bodies built from a few parametric shapes: rounded panels, glazed cabins, tyres on rims,
   bumpers, lamps, grilles, number plates and mirrors, spoked wheels for the horse-drawn traffic.
   Each model is two lists of parts: "paint" takes the vehicle's own colour (glossy enamel), and
   "trim" keeps its own colour and surface (glass, chrome, rubber, lamp lenses, wood, leather),
   carried per vertex as roughness, metalness and glow. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const VM = (SA.VehicleModels = { models: {} });

  // surfaces: [roughness, metalness, glow]
  const S = {
    paint: [0.3, 0, 0], plastic: [0.62, 0, 0], rubber: [0.92, 0, 0], tyre: [0.85, 0, 0], glass: [0.04, 0, 0], chrome: [0.16, 1, 0], metal: [0.38, 1, 0],
    lamp: [0.08, 0, 0.1], tail: [0.2, 0, 0.12], amber: [0.2, 0, 0.08], wood: [0.72, 0, 0], leather: [0.5, 0, 0], plate: [0.45, 0, 0], sign: [0.5, 0, 0.45],
  };
  VM.S = S;
  function finish(g, hex, surf) {
    if (g.index) g = g.toNonIndexed();
    const n = g.attributes.position.count;
    const c = new THREE.Color(hex);
    const col = new Float32Array(n * 3), sf = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      sf[i * 3] = surf[0];
      sf[i * 3 + 1] = surf[1];
      sf[i * 3 + 2] = surf[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSurf', new THREE.BufferAttribute(sf, 3));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'aSurf') g.deleteAttribute(k);
    return g;
  }
  function at(g, x, y, z, rx, ry, rz) {
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x || 0, y || 0, z || 0);
    return g;
  }
  VM.merge = function (parts) {
    const m = THREE.BufferGeometryUtils.mergeGeometries(parts, false);
    m.computeBoundingSphere();
    return m;
  };

  // Rounded box: every edge rounded with radius r (up to three bands of vertices per edge; small
  // radii get fewer, as the extra bands can't be seen on lamps and handles).
  // fn(x, y, z) optionally deforms it (tapers, sloping bonnets); normals are then recomputed.
  // Only a deformed box needs rows across its flat faces.
  function rbox(w, h, d, r, fn) {
    const H = [w / 2, h / 2, d / 2];
    r = Math.max(0.001, Math.min(r, H[0] * 0.98, H[1] * 0.98, H[2] * 0.98));
    const bands = r >= 0.03 ? [0.3, 0.7] : r >= 0.012 ? [0.5] : [];
    const vals = (hh) => {
      const inner = [];
      const n = fn ? Math.max(1, Math.round((2 * (hh - r)) / 0.6)) : 1;
      for (let i = 0; i <= n; i++) inner.push(-(hh - r) + (2 * (hh - r) * i) / n);
      return [-hh, ...bands.map((f) => -hh + r * f), ...inner, ...bands.map((f) => hh - r * f).reverse(), hh];
    };
    const pos = [], nor = [], idx = [];
    for (let a = 0; a < 3; a++) {
      const b = (a + 1) % 3, c = (a + 2) % 3;
      const vb = vals(H[b]), vc = vals(H[c]);
      for (const sg of [-1, 1]) {
        const base = pos.length / 3;
        for (let i = 0; i < vb.length; i++) {
          for (let j = 0; j < vc.length; j++) {
            const raw = [0, 0, 0];
            raw[a] = sg * H[a];
            raw[b] = vb[i];
            raw[c] = vc[j];
            const cl = raw.map((v, k) => U.clamp(v, -(H[k] - r), H[k] - r));
            let ox = raw[0] - cl[0], oy = raw[1] - cl[1], oz = raw[2] - cl[2];
            const l = Math.hypot(ox, oy, oz) || 1;
            ox /= l;
            oy /= l;
            oz /= l;
            pos.push(cl[0] + ox * r, cl[1] + oy * r, cl[2] + oz * r);
            nor.push(ox, oy, oz);
          }
        }
        const nc = vc.length;
        for (let i = 0; i < vb.length - 1; i++) {
          for (let j = 0; j < nc - 1; j++) {
            const p0 = base + i * nc + j, p1 = base + (i + 1) * nc + j, p2 = base + (i + 1) * nc + j + 1, p3 = base + i * nc + j + 1;
            // wind so the face looks outwards
            const e1 = [pos[p1 * 3] - pos[p0 * 3], pos[p1 * 3 + 1] - pos[p0 * 3 + 1], pos[p1 * 3 + 2] - pos[p0 * 3 + 2]];
            const e2 = [pos[p3 * 3] - pos[p0 * 3], pos[p3 * 3 + 1] - pos[p0 * 3 + 1], pos[p3 * 3 + 2] - pos[p0 * 3 + 2]];
            const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
            const out = cr[a] * sg >= 0;
            if (out) idx.push(p0, p1, p2, p0, p2, p3);
            else idx.push(p0, p2, p1, p0, p3, p2);
          }
        }
      }
    }
    let g = new THREE.BufferGeometry();
    if (fn) {
      for (let i = 0; i < pos.length; i += 3) {
        const q = fn(pos[i], pos[i + 1], pos[i + 2], H);
        pos[i] = q[0];
        pos[i + 1] = q[1];
        pos[i + 2] = q[2];
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g = THREE.BufferGeometryUtils.mergeVertices(g, 1e-4);
      g.computeVertexNormals();
    } else {
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setIndex(idx);
    }
    return g;
  }
  VM.rbox = rbox;
  // a box whose top is narrower (tx), shorter (tz) and shifted along z (sz): cabins, glasshouses
  const taper = (tx, tz, sz) => (x, y, z, H) => {
    const t = (y + H[1]) / (2 * H[1]);
    return [x * (1 + (tx - 1) * t), y, z * (1 + (tz - 1) * t) + sz * t];
  };
  const cyl = (r1, r2, h, s) => new THREE.CylinderGeometry(r1, r2, h, s || 16);
  // tyre with rounded shoulders and a rim (axis along x)
  function wheel(T, x, y, z, r, w, style) {
    const rin = r * 0.6;
    const prof = [[rin, -w / 2], [r - 0.035, -w / 2], [r - 0.008, -w / 2 + 0.03], [r, -w / 2 + 0.06], [r, w / 2 - 0.06], [r - 0.008, w / 2 - 0.03], [r - 0.035, w / 2], [rin, w / 2]].map((p) => new THREE.Vector2(p[0], p[1]));
    T.push(finish(at(new THREE.LatheGeometry(prof, 22), x, y, z, 0, 0, Math.PI / 2), '#141414', S.tyre));
    const side = Math.sign(x) || 1;
    if (style === 'chromeCap') {
      T.push(finish(at(cyl(rin, rin, w * 0.9, 18), x, y, z, 0, 0, Math.PI / 2), '#cfcfcf', S.metal));
      T.push(finish(at(new THREE.SphereGeometry(rin * 0.75, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1), x + side * w * 0.45, y, z, 0, 0, -side * Math.PI / 2), '#e8e8e8', S.chrome));
    } else if (style === 'steel') {
      T.push(finish(at(cyl(rin, rin, w * 0.9, 18), x, y, z, 0, 0, Math.PI / 2), '#2a2a2a', S.metal));
      T.push(finish(at(cyl(rin * 0.4, rin * 0.4, w * 0.95, 10), x, y, z, 0, 0, Math.PI / 2), '#bdbdbd', S.chrome));
    } else {
      // alloy: rim with five spokes
      T.push(finish(at(cyl(rin, rin, w * 0.86, 20), x, y, z, 0, 0, Math.PI / 2), '#9aa0a6', S.metal));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        T.push(finish(at(new THREE.BoxGeometry(0.03, rin * 1.7, 0.07), x + side * w * 0.44, y, z, a), '#c4c8cc', S.metal));
      }
      T.push(finish(at(cyl(0.06, 0.06, w * 0.9, 10), x, y, z, 0, 0, Math.PI / 2), '#5a5e62', S.metal));
    }
  }
  // spoked carriage wheel (axis along x)
  function spokedWheel(T, x, y, z, r, color) {
    T.push(finish(at(new THREE.TorusGeometry(r - 0.025, 0.035, 6, 28), x, y, z, 0, Math.PI / 2), color || '#2a1e14', S.wood));
    T.push(finish(at(new THREE.TorusGeometry(r, 0.012, 4, 28), x, y, z, 0, Math.PI / 2), '#2a2a2a', S.metal));
    T.push(finish(at(cyl(0.07, 0.07, 0.16, 10), x, y, z, 0, 0, Math.PI / 2), color || '#2a1e14', S.wood));
    for (let i = 0; i < 12; i++) T.push(finish(at(new THREE.BoxGeometry(0.025, r - 0.05, 0.025).translate(0, (r - 0.05) / 2, 0), x, y, z, (i / 12) * Math.PI * 2), color || '#2a1e14', S.wood));
  }
  VM.spokedWheel = spokedWheel;

  // a motor car from a handful of measurements
  function car(o) {
    const P = [], T = [];
    const L = o.L, W = o.W, h0 = o.clear, hb = o.belt, hr = o.roof;
    const bodyH = hb - h0;
    // lower body: bonnet and boot slope down towards the ends
    const body = rbox(W, bodyH, L, o.r, (x, y, z, H) => {
      const up = (y + H[1]) / (2 * H[1]);
      let dy = 0;
      if (o.bonnet) dy += o.bonnet[1] * U.clamp((z - (H[2] - o.bonnet[0])) / o.bonnet[0], 0, 1) * up;
      if (o.boot) dy += o.boot[1] * U.clamp((-z - (H[2] - o.boot[0])) / o.boot[0], 0, 1) * up;
      // tumblehome: the sides lean in a little towards the top
      return [x * (1 - 0.04 * up), y - dy, z];
    });
    P.push(finish(at(body, 0, h0 + bodyH / 2, 0), '#fff', S.paint));
    // glasshouse
    const [c0, c1] = o.cabin, [t0, t1] = o.top;
    const cw = W * (1 - 0.04) - 0.06, ch = hr - hb + 0.02;
    const cab = rbox(cw, ch, c1 - c0, 0.06, taper(o.roofW / cw, (t1 - t0) / (c1 - c0), (t0 + t1) / 2 - (c0 + c1) / 2));
    T.push(finish(at(cab, 0, hb - 0.01 + ch / 2, (c0 + c1) / 2), '#121820', S.glass));
    // roof and pillars in body colour
    P.push(finish(at(rbox(o.roofW + 0.03, 0.06, t1 - t0 + 0.04, 0.025), 0, hr + 0.01, (t0 + t1) / 2), '#fff', S.paint));
    const pillar = (zb, zt, wdt) => {
      const g = rbox(cw + 0.014, ch, wdt, 0.012, (x, y, z, H) => {
        const t = (y + H[1]) / (2 * H[1]);
        return [x * (1 + ((o.roofW + 0.014) / (cw + 0.014) - 1) * t), y, z + (zt - zb) * t];
      });
      P.push(finish(at(g, 0, hb - 0.01 + ch / 2, zb), '#fff', S.paint));
    };
    pillar(c1 - 0.04, t1 - 0.03, 0.07); // A
    pillar(c0 + 0.04, t0 + 0.03, o.cPillar || 0.12); // C
    if (o.bPillar !== false) pillar((c0 + c1) / 2 + (o.bShift || 0), (t0 + t1) / 2 + (o.bShift || 0), 0.08); // B
    // wheel arches (dark openings) and wheels
    for (const wz of o.wheels) {
      T.push(finish(at(cyl(o.wr + 0.06, o.wr + 0.06, W + 0.005, 22), 0, o.wr, wz, 0, 0, Math.PI / 2), '#0b0b0b', S.rubber));
      for (const sx of [-1, 1]) wheel(T, sx * (W / 2 - 0.11), o.wr, wz, o.wr, o.ww || 0.2, o.rim);
    }
    // bumpers
    const chromeB = o.bumper === 'chrome';
    for (const sz of [1, -1]) {
      T.push(finish(at(rbox(W + 0.03, chromeB ? 0.09 : 0.2, 0.14, chromeB ? 0.04 : 0.06), 0, h0 + (chromeB ? 0.17 : 0.14), sz * (L / 2 - 0.03)), chromeB ? '#d8d8d8' : '#1d1f22', chromeB ? S.chrome : S.plastic));
    }
    // grille
    if (o.grille === 'chrome') {
      T.push(finish(at(rbox(W * 0.42, 0.2, 0.05, 0.03), 0, h0 + bodyH * 0.55, L / 2 + 0.005), '#cfcfcf', S.chrome));
      for (let i = 0; i < 5; i++) T.push(finish(at(new THREE.BoxGeometry(W * 0.4, 0.012, 0.03), 0, h0 + bodyH * 0.55 - 0.08 + i * 0.04, L / 2 + 0.025), '#2a2a2a', S.metal));
    } else T.push(finish(at(rbox(W * 0.5, 0.16, 0.05, 0.03), 0, h0 + 0.3, L / 2 + 0.01), '#0e0f10', S.plastic));
    // lamps
    const ly = h0 + bodyH * 0.62 - (o.bonnet ? o.bonnet[1] * 0.4 : 0);
    for (const sx of [-1, 1]) {
      if (o.lamps === 'round') {
        T.push(finish(at(cyl(0.085, 0.085, 0.06, 16), sx * (W / 2 - 0.2), ly, L / 2 - 0.005, Math.PI / 2), '#d8d8d8', S.chrome));
        T.push(finish(at(new THREE.SphereGeometry(0.075, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1), sx * (W / 2 - 0.2), ly, L / 2 + 0.025, Math.PI / 2), '#fffbe6', S.lamp));
      } else T.push(finish(at(rbox(0.38, 0.11, 0.06, 0.03), sx * (W / 2 - 0.24), ly, L / 2 - 0.02), '#f4f6f8', S.lamp));
      T.push(finish(at(rbox(o.lamps === 'round' ? 0.1 : 0.14, o.lamps === 'round' ? 0.14 : 0.24, 0.05, 0.02), sx * (W / 2 - 0.1), h0 + bodyH * 0.7, -L / 2 + 0.01), '#b0141a', S.tail));
      T.push(finish(at(rbox(0.07, 0.05, 0.05, 0.015), sx * (W / 2 - 0.08), ly - 0.07, L / 2 - 0.02), '#f0a020', S.amber));
    }
    // plates: white at the front, yellow at the back
    T.push(finish(at(new THREE.BoxGeometry(0.52, 0.11, 0.015), 0, h0 + 0.2, L / 2 + 0.06), o.era === 1964 ? '#141414' : '#f2f2ee', S.plate));
    T.push(finish(at(new THREE.BoxGeometry(0.52, 0.11, 0.015), 0, h0 + 0.36, -L / 2 - 0.01), o.era === 1964 ? '#141414' : '#f2c21a', S.plate));
    // mirrors
    for (const sx of [-1, 1]) {
      T.push(finish(at(rbox(0.12, 0.09, 0.07, 0.03), sx * (W / 2 + 0.06), hb + 0.06, c1 - 0.12), o.era === 1964 ? '#d8d8d8' : '#1d1f22', o.era === 1964 ? S.chrome : S.plastic));
    }
    // door shut lines and handles
    for (const sx of [-1, 1]) {
      for (const dz of o.doors || []) T.push(finish(at(new THREE.BoxGeometry(0.004, bodyH * 0.72, 0.008), sx * (W / 2 * 0.985 + 0.002), h0 + bodyH * 0.55, dz), '#101010', S.rubber));
      for (const dz of o.handles || []) T.push(finish(at(rbox(0.012, 0.03, 0.14, 0.006), sx * (W / 2 * 0.975 + 0.008), hb - 0.1, dz), o.era === 1964 ? '#e0e0e0' : '#2a2a2a', o.era === 1964 ? S.chrome : S.plastic));
    }
    if (o.extra) o.extra(P, T);
    return { paint: P, trim: T };
  }

  const M = VM.models;
  // ---------------------------------------------------------------- 2026
  M.hatch = () => car({ L: 4.0, W: 1.76, clear: 0.16, belt: 0.98, roof: 1.47, r: 0.16, cabin: [-1.78, 0.55], top: [-1.58, -0.08], roofW: 1.3, bonnet: [1.3, 0.2], wheels: [1.3, -1.28], wr: 0.33, rim: 'alloy', bumper: 'plastic', lamps: 'rect', grille: 'plastic', doors: [0.42, -0.62], handles: [0.05, -0.95], era: 2026, cPillar: 0.2 });
  M.estate = () => car({ L: 4.6, W: 1.8, clear: 0.17, belt: 1.0, roof: 1.5, r: 0.16, cabin: [-2.2, 0.75], top: [-2.12, 0.08], roofW: 1.36, bonnet: [1.3, 0.2], boot: [0.3, 0.05], wheels: [1.48, -1.45], wr: 0.34, rim: 'alloy', bumper: 'plastic', lamps: 'rect', grille: 'plastic', doors: [0.55, -0.55], handles: [0.2, -0.85], era: 2026 });
  M.suv = () => car({ L: 4.7, W: 1.95, clear: 0.26, belt: 1.18, roof: 1.8, r: 0.18, cabin: [-2.2, 0.75], top: [-2.12, 0.05], roofW: 1.55, bonnet: [1.25, 0.16], wheels: [1.52, -1.5], wr: 0.41, ww: 0.26, rim: 'alloy', bumper: 'plastic', lamps: 'rect', grille: 'plastic', doors: [0.6, -0.6], handles: [0.25, -0.9], era: 2026 });
  M.cab = () => car({ L: 4.6, W: 1.85, clear: 0.2, belt: 1.05, roof: 1.78, r: 0.18, cabin: [-1.95, 0.6], top: [-1.75, 0.05], roofW: 1.45, bonnet: [1.25, 0.14], boot: [0.4, 0.12], wheels: [1.45, -1.45], wr: 0.36, rim: 'steel', bumper: 'plastic', lamps: 'round', grille: 'chrome', doors: [0.4, -0.6], handles: [0.05, -1.0], era: 2026,
    extra: (P, T) => T.push(finish(at(rbox(0.5, 0.16, 0.24, 0.04), 0, 1.86, 0.15), '#f2c94c', S.sign)) });
  M.police2026 = () => car({ L: 4.6, W: 1.85, clear: 0.17, belt: 1.0, roof: 1.5, r: 0.16, cabin: [-2.2, 0.75], top: [-2.12, 0.08], roofW: 1.4, bonnet: [1.3, 0.2], boot: [0.3, 0.05], wheels: [1.48, -1.45], wr: 0.34, rim: 'alloy', bumper: 'plastic', lamps: 'rect', grille: 'plastic', doors: [0.55, -0.55], handles: [0.2, -0.85], era: 2026,
    extra: (P, T) => {
      // Battenburg livery and a roof light bar
      for (let i = 0; i < 6; i++) {
        const z = -2.0 + i * 0.8;
        for (const sx of [-1, 1]) for (const row of [0, 1]) T.push(finish(at(new THREE.BoxGeometry(0.01, 0.2, 0.78), sx * 0.915, 0.52 + row * 0.2, z + 0.4), (i + row) % 2 ? '#1d3fb3' : '#e7ff1c', S.paint));
      }
      T.push(finish(at(rbox(1.15, 0.12, 0.3, 0.05), 0, 1.6, -0.25), '#20242a', S.plastic));
      for (const sx of [-1, 1]) T.push(finish(at(rbox(0.5, 0.1, 0.26, 0.04), sx * 0.3, 1.63, -0.25), sx < 0 ? '#2457d6' : '#2457d6', S.amber));
    } });
  M.van = () => {
    const P = [], T = [];
    const body = rbox(2.0, 2.15, 5.4, 0.18, (x, y, z, H) => {
      // the bonnet and windscreen slope down over the front 1.6 m
      const up = (y + H[1]) / (2 * H[1]);
      const f = U.clamp((z - 1.1) / 1.6, 0, 1);
      return [x * (1 - 0.03 * up), y - f * f * 1.15 * up, z];
    });
    P.push(finish(at(body, 0, 0.25 + 1.075, 0), '#fff', S.paint));
    T.push(finish(at(rbox(1.84, 0.62, 0.05, 0.03), 0, 1.6, 1.55, -0.62), '#121820', S.glass));
    for (const sx of [-1, 1]) T.push(finish(at(new THREE.BoxGeometry(0.01, 0.48, 0.8), sx * 0.985, 1.62, 1.0), '#121820', S.glass));
    for (const wz of [1.85, -1.8]) {
      T.push(finish(at(cyl(0.44, 0.44, 2.005, 22), 0, 0.38, wz, 0, 0, Math.PI / 2), '#0b0b0b', S.rubber));
      for (const sx of [-1, 1]) wheel(T, sx * 0.89, 0.38, wz, 0.38, 0.24, 'steel');
    }
    for (const sz of [1, -1]) T.push(finish(at(rbox(2.04, 0.22, 0.14, 0.06), 0, 0.4, sz * 2.69), '#1d1f22', S.plastic));
    for (const sx of [-1, 1]) {
      T.push(finish(at(rbox(0.32, 0.14, 0.06, 0.03), sx * 0.7, 0.92, 2.66), '#f4f6f8', S.lamp));
      T.push(finish(at(rbox(0.12, 0.34, 0.05, 0.02), sx * 0.92, 0.9, -2.7), '#b0141a', S.tail));
      T.push(finish(at(rbox(0.14, 0.12, 0.08, 0.03), sx * 1.07, 1.75, 1.15), '#1d1f22', S.plastic));
    }
    T.push(finish(at(new THREE.BoxGeometry(0.52, 0.11, 0.015), 0, 0.62, 2.73), '#f2f2ee', S.plate));
    T.push(finish(at(new THREE.BoxGeometry(0.52, 0.11, 0.015), 0, 0.62, -2.71), '#f2c21a', S.plate));
    T.push(finish(at(new THREE.BoxGeometry(0.004, 1.7, 0.01), 0, 1.3, -2.705), '#101010', S.rubber));
    return { paint: P, trim: T };
  };
  M.bus2026 = () => {
    const P = [], T = [];
    P.push(finish(at(rbox(2.5, 2.95, 11, 0.22), 0, 0.3 + 1.475, 0), '#fff', S.paint));
    T.push(finish(at(rbox(2.52, 1.0, 9.4, 0.04), 0, 2.2, -0.6), '#121820', S.glass));
    T.push(finish(at(rbox(2.3, 1.55, 0.06, 0.04), 0, 1.95, 5.49, 0.06), '#121820', S.glass));
    T.push(finish(at(new THREE.BoxGeometry(1.5, 0.24, 0.04), 0, 2.98, 5.5), '#ff9a1a', S.sign));
    T.push(finish(at(rbox(2.52, 0.34, 10.8, 0.08), 0, 0.42, 0), '#1d1f22', S.plastic));
    for (const wz of [3.6, -3.4]) {
      T.push(finish(at(cyl(0.56, 0.56, 2.51, 22), 0, 0.5, wz, 0, 0, Math.PI / 2), '#0b0b0b', S.rubber));
      for (const sx of [-1, 1]) wheel(T, sx * 1.1, 0.5, wz, 0.5, 0.3, 'steel');
    }
    for (const sx of [-1, 1]) {
      T.push(finish(at(rbox(0.3, 0.14, 0.06, 0.03), sx * 0.95, 0.75, 5.5), '#f4f6f8', S.lamp));
      T.push(finish(at(rbox(0.14, 0.4, 0.05, 0.02), sx * 1.15, 1.0, -5.5), '#b0141a', S.tail));
    }
    // doors
    for (const dz of [4.6, 0.6]) T.push(finish(at(new THREE.BoxGeometry(0.01, 2.4, 1.1), 1.255, 1.6, dz), '#121820', S.glass));
    return { paint: P, trim: T };
  };
  // ---------------------------------------------------------------- 1964
  M.saloon60 = () => car({ L: 3.9, W: 1.55, clear: 0.2, belt: 0.92, roof: 1.42, r: 0.2, cabin: [-0.95, 0.5], top: [-0.72, 0.18], roofW: 1.18, bonnet: [1.1, 0.12], boot: [0.9, 0.12], wheels: [1.22, -1.18], wr: 0.31, ww: 0.17, rim: 'chromeCap', bumper: 'chrome', lamps: 'round', grille: 'chrome', doors: [0.5, -0.45], handles: [0.15, -0.8], era: 1964, cPillar: 0.1 });
  M.small60 = () => car({ L: 3.05, W: 1.4, clear: 0.16, belt: 0.86, roof: 1.33, r: 0.24, cabin: [-1.28, 0.45], top: [-1.16, 0.26], roofW: 1.18, bonnet: [0.6, 0.08], wheels: [1.02, -1.0], wr: 0.25, ww: 0.15, rim: 'chromeCap', bumper: 'chrome', lamps: 'round', grille: 'chrome', doors: [0.4], handles: [0.05], era: 1964, bPillar: false, cPillar: 0.08 });
  M.police1964 = () => car({ L: 4.6, W: 1.7, clear: 0.2, belt: 0.98, roof: 1.5, r: 0.2, cabin: [-1.2, 0.55], top: [-0.95, 0.22], roofW: 1.3, bonnet: [1.3, 0.12], boot: [1.0, 0.12], wheels: [1.45, -1.42], wr: 0.34, ww: 0.18, rim: 'chromeCap', bumper: 'chrome', lamps: 'round', grille: 'chrome', doors: [0.55, -0.5], handles: [0.2, -0.85], era: 1964,
    extra: (P, T) => {
      T.push(finish(at(rbox(0.8, 0.2, 0.22, 0.04), 0, 1.62, -0.35), '#f2f2f2', S.sign));
      T.push(finish(at(cyl(0.11, 0.07, 0.14, 12), 0.45, 0.62, 2.36, Math.PI / 2), '#d9b45a', S.chrome));
    } });
  M.van60 = () => {
    const P = [], T = [];
    P.push(finish(at(rbox(1.7, 1.6, 3.0, 0.28), 0, 0.22 + 0.8, -0.6), '#fff', S.paint));
    P.push(finish(at(rbox(1.6, 1.3, 1.5, 0.32, (x, y, z, H) => {
      const up = (y + H[1]) / (2 * H[1]);
      return [x, y - U.clamp((z + 0.1) / 0.85, 0, 1) * 0.35 * up, z];
    }), 0, 0.22 + 0.65, 1.4), '#fff', S.paint));
    T.push(finish(at(rbox(1.36, 0.42, 0.05, 0.05), 0, 1.4, 1.62, -0.35), '#121820', S.glass));
    T.push(finish(at(new THREE.BoxGeometry(0.03, 0.42, 0.05), 0, 1.4, 1.65, -0.35), '#d8d8d8', S.chrome));
    for (const sx of [-1, 1]) T.push(finish(at(new THREE.BoxGeometry(0.01, 0.4, 0.55), sx * 0.81, 1.38, 1.1), '#121820', S.glass));
    T.push(finish(at(rbox(1.72, 0.3, 2.3, 0.08), 0, 1.66, -0.6), '#8a3a2a', S.paint));
    for (const wz of [1.4, -1.4]) {
      T.push(finish(at(cyl(0.38, 0.38, 1.705, 22), 0, 0.32, wz, 0, 0, Math.PI / 2), '#0b0b0b', S.rubber));
      for (const sx of [-1, 1]) wheel(T, sx * 0.76, 0.32, wz, 0.32, 0.18, 'chromeCap');
    }
    for (const sx of [-1, 1]) {
      T.push(finish(at(cyl(0.09, 0.09, 0.06, 16), sx * 0.55, 0.85, 2.13, Math.PI / 2), '#d8d8d8', S.chrome));
      T.push(finish(at(new THREE.SphereGeometry(0.08, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1), sx * 0.55, 0.85, 2.16, Math.PI / 2), '#fffbe6', S.lamp));
    }
    for (const sz of [1, -1]) T.push(finish(at(rbox(1.74, 0.09, 0.12, 0.04), 0, 0.38, sz * (sz > 0 ? 2.15 : 2.1)), '#d8d8d8', S.chrome));
    return { paint: P, trim: T };
  };
  M.bus1964 = () => {
    const P = [], T = [];
    P.push(finish(at(rbox(2.4, 4.0, 8.4, 0.38), 0, 0.3 + 2.0, 0), '#fff', S.paint));
    T.push(finish(at(rbox(2.42, 0.8, 7.6, 0.06), 0, 1.85, 0.1), '#121820', S.glass));
    T.push(finish(at(rbox(2.42, 0.8, 7.9, 0.06), 0, 3.5, 0), '#121820', S.glass));
    T.push(finish(at(rbox(2.43, 0.24, 8.3, 0.08), 0, 2.62, 0), '#e8dcb0', S.paint));
    T.push(finish(at(new THREE.BoxGeometry(1.2, 0.22, 0.04), 0, 4.05, 4.21), '#f0e6c0', S.sign));
    for (const wz of [2.8, -2.6]) {
      T.push(finish(at(cyl(0.58, 0.58, 2.41, 22), 0, 0.52, wz, 0, 0, Math.PI / 2), '#0b0b0b', S.rubber));
      for (const sx of [-1, 1]) wheel(T, sx * 1.05, 0.5, wz, 0.5, 0.3, 'steel');
    }
    for (const sx of [-1, 1]) T.push(finish(at(cyl(0.12, 0.12, 0.06, 16), sx * 0.85, 1.0, 4.22, Math.PI / 2), '#fffbe6', S.lamp));
    T.push(finish(at(rbox(1.4, 0.45, 0.05, 0.04), 0, 0.85, 4.22), '#cfcfcf', S.chrome));
    return { paint: P, trim: T };
  };
  // scooters: a rounded rear shell, a leg shield, a floorboard, a headset with a round lamp
  function scooter(police) {
    const P = [], T = [];
    P.push(finish(at(rbox(0.58, 0.46, 0.92, 0.2, (x, y, z, H) => {
      const up = (y + H[1]) / (2 * H[1]);
      return [x * (1 - 0.25 * Math.abs(z) / H[2]), y, z * (1 - 0.15 * up)];
    }), 0, 0.5, -0.36), '#fff', S.paint));
    P.push(finish(at(rbox(0.52, 0.78, 0.07, 0.05, (x, y, z, H) => [x * (1 - 0.25 * (y + H[1]) / (2 * H[1])), y, z + 0.06 * Math.pow(x / H[0], 2)]), 0, 0.72, 0.42, -0.12), '#fff', S.paint));
    P.push(finish(at(rbox(0.36, 0.06, 0.55, 0.03), 0, 0.27, 0.15), '#fff', S.paint));
    P.push(finish(at(rbox(0.16, 0.12, 0.42, 0.06), 0, 0.42, 0.62), '#fff', S.paint));
    P.push(finish(at(rbox(0.2, 0.16, 0.22, 0.07), 0, 1.04, 0.5), '#fff', S.paint));
    T.push(finish(at(rbox(0.34, 0.1, 0.6, 0.05), 0, 0.78, -0.28), police ? '#1d1d1d' : '#2a2420', S.leather));
    T.push(finish(at(cyl(0.018, 0.018, 0.62, 8), 0, 1.06, 0.5, 0, 0, Math.PI / 2), '#cfcfcf', S.chrome));
    T.push(finish(at(cyl(0.025, 0.025, 0.55, 8), 0, 0.75, 0.55, -0.12), '#cfcfcf', S.chrome));
    T.push(finish(at(cyl(0.065, 0.065, 0.05, 16), 0, 1.08, 0.62, Math.PI / 2), '#d8d8d8', S.chrome));
    T.push(finish(at(new THREE.SphereGeometry(0.055, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1), 0, 1.08, 0.645, Math.PI / 2), '#fffbe6', S.lamp));
    for (const sx of [-1, 1]) {
      T.push(finish(at(cyl(0.055, 0.055, 0.02, 12), sx * 0.3, 1.33, 0.48, Math.PI / 2), '#e0e0e0', S.chrome));
      T.push(finish(at(cyl(0.01, 0.01, 0.3, 5), sx * 0.3, 1.18, 0.48), '#cfcfcf', S.chrome));
    }
    for (const wz of [0.62, -0.62]) {
      wheel(T, 0, 0.2, wz, 0.2, 0.1, 'chromeCap');
    }
    T.push(finish(at(rbox(0.08, 0.06, 0.04, 0.02), 0, 0.6, -0.84), '#b0141a', S.tail));
    if (police) T.push(finish(at(rbox(0.44, 0.08, 0.3, 0.03), 0, 0.98, 0.43), '#f2f2f2', S.sign));
    return { paint: P, trim: T };
  }
  M.scooter = () => scooter(false);
  M.noddy = () => scooter(true);
  // ---------------------------------------------------------------- 1897
  M.bicycle = () => {
    const P = [], T = [];
    const tube = (a, b, r) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      const g = cyl(r, r, len, 8);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len)));
      return at(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    };
    const bb = [0, 0.32, 0], seat = [0, 0.9, -0.25], head = [0, 0.95, 0.38], rear = [0, 0.35, -0.55], front = [0, 0.35, 0.55];
    for (const [a, b] of [[bb, seat], [seat, head], [bb, head], [bb, rear], [seat, rear], [head, front]]) P.push(finish(tube(a, b, 0.016), '#fff', S.paint));
    for (const wz of [0.55, -0.55]) {
      T.push(finish(at(new THREE.TorusGeometry(0.34, 0.022, 6, 28), 0, 0.35, wz, 0, Math.PI / 2), '#141414', S.tyre));
      T.push(finish(at(new THREE.TorusGeometry(0.31, 0.008, 4, 28), 0, 0.35, wz, 0, Math.PI / 2), '#b8b8b8', S.chrome));
      for (let i = 0; i < 16; i++) T.push(finish(at(new THREE.BoxGeometry(0.004, 0.31, 0.004).translate(0, 0.155, 0), 0, 0.35, wz, (i / 16) * Math.PI * 2), '#cfcfcf', S.chrome));
    }
    T.push(finish(at(rbox(0.16, 0.06, 0.26, 0.03), 0, 0.93, -0.27), '#3a2618', S.leather));
    T.push(finish(at(cyl(0.012, 0.012, 0.52, 6), 0, 1.02, 0.42, 0, 0, Math.PI / 2), '#cfcfcf', S.chrome));
    T.push(finish(at(new THREE.TorusGeometry(0.09, 0.006, 4, 16), 0.04, 0.32, 0, 0, Math.PI / 2), '#cfcfcf', S.chrome));
    return { paint: P, trim: T };
  };
  M.sergeantBike = M.bicycle;
  M.cart = () => {
    const P = [], T = [];
    // a baker's van body on two big wheels, with a curved roof
    P.push(finish(at(rbox(1.5, 1.15, 2.2, 0.05), 0, 1.38, -1.2), '#fff', S.paint));
    P.push(finish(at(rbox(1.6, 0.16, 2.35, 0.08, (x, y, z, H) => [x, y + 0.12 * (1 - Math.pow(x / H[0], 2)), z]), 0, 2.02, -1.2), '#fff', S.paint));
    T.push(finish(at(new THREE.BoxGeometry(1.52, 0.08, 2.24), 0, 1.6, -1.2), '#e8dcb0', S.paint));
    T.push(finish(at(rbox(1.5, 0.08, 1.0, 0.02), 0, 0.85, 0.3), '#5a4030', S.wood));
    T.push(finish(at(rbox(0.6, 0.3, 0.42, 0.05), 0, 1.1, 0.25), '#4a3424', S.leather));
    for (const sx of [-1, 1]) {
      spokedWheel(T, sx * 0.82, 0.58, -1.0, 0.58, '#3a2a1a');
      T.push(finish(at(rbox(0.06, 0.06, 2.1, 0.02), sx * 0.45, 0.95, 1.4), '#5a4030', S.wood));
      T.push(finish(at(cyl(0.04, 0.05, 0.12, 10), sx * 0.8, 1.7, 0.0, Math.PI / 2), '#d9b45a', S.chrome));
    }
    return { paint: P, trim: T };
  };
  M.hansom = () => {
    const P = [], T = [];
    P.push(finish(at(rbox(1.36, 1.5, 1.4, 0.18, (x, y, z, H) => [x, y, z + 0.18 * Math.pow((y + H[1]) / (2 * H[1]), 2)]), 0, 1.55, -0.95), '#fff', S.paint));
    T.push(finish(at(rbox(0.95, 0.65, 0.04, 0.04), 0, 1.8, -0.18), '#121820', S.glass));
    T.push(finish(at(rbox(0.55, 0.1, 0.5, 0.03), 0, 2.48, -1.82), '#2a1e14', S.leather));
    for (const sx of [-1, 1]) {
      spokedWheel(T, sx * 0.8, 0.74, -0.95, 0.74, '#1a1410');
      T.push(finish(at(rbox(0.05, 0.05, 2.2, 0.02), sx * 0.45, 1.0, 1.0), '#3a2a1a', S.wood));
      T.push(finish(at(cyl(0.05, 0.06, 0.14, 10), sx * 0.72, 2.0, -0.25, Math.PI / 2), '#d9b45a', S.chrome));
    }
    return { paint: P, trim: T };
  };
  M.dray = () => {
    const P = [], T = [];
    P.push(finish(at(rbox(1.9, 0.14, 3.6, 0.03), 0, 1.0, -1.3), '#fff', S.paint));
    for (const sz of [0.48, -3.1]) P.push(finish(at(rbox(1.9, 0.5, 0.08, 0.02), 0, 1.3, sz), '#fff', S.paint));
    for (const [x, z] of [[0.45, -0.6], [-0.45, -1.4], [0.45, -2.2], [-0.45, -0.6], [0.45, -1.4]]) {
      T.push(finish(at(new THREE.LatheGeometry([[0, -0.42], [0.33, -0.42], [0.38, -0.2], [0.4, 0], [0.38, 0.2], [0.33, 0.42], [0, 0.42]].map((p) => new THREE.Vector2(p[0], p[1])), 14), x, 1.45, z, 0, 0, Math.PI / 2), '#7a5030', S.wood));
      for (const hx of [-0.3, 0.3]) T.push(finish(at(new THREE.TorusGeometry(0.38, 0.012, 4, 16), x + hx, 1.45, z, 0, Math.PI / 2), '#3a3a3a', S.metal));
    }
    for (const sx of [-1, 1]) {
      spokedWheel(T, sx * 1.0, 0.6, 0.1, 0.6, '#3a2a1a');
      spokedWheel(T, sx * 1.0, 0.6, -2.6, 0.6, '#3a2a1a');
      T.push(finish(at(rbox(0.05, 0.05, 2.2, 0.02), sx * 0.45, 1.0, 1.6), '#3a2a1a', S.wood));
    }
    return { paint: P, trim: T };
  };
})();
