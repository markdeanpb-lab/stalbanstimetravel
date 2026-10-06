/* Trees: branching trunks and crowns built from alpha-tested leaf cards, a few variants per era,
   each drawn as instanced meshes. Leaves flutter and branches sway in the wind, and because the
   cards are cut out by their texture the trees cast dappled shadows. Leaf normals point out from
   the crown, so a crown lights like a soft volume rather than a scatter of flat cards. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const Trees = (SA.Trees = {});

  // 2 x 2 atlas of leafy sprays painted on a transparent canvas
  function leafAtlas() {
    const S = 512, C = S / 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, S, S);
    for (let cell = 0; cell < 4; cell++) {
      const ox = (cell % 2) * C, oy = Math.floor(cell / 2) * C;
      const rnd = U.rng(cell * 97 + 3);
      const cx = ox + C / 2, cy = oy + C / 2;
      // twigs from the middle outwards
      g.strokeStyle = 'rgb(74,58,40)';
      g.lineCap = 'round';
      const tips = [];
      for (let t = 0; t < 5; t++) {
        const a = (t / 5) * Math.PI * 2 + rnd() * 0.8;
        const len = C * (0.3 + rnd() * 0.12);
        const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cx, cy);
        g.quadraticCurveTo(cx + Math.cos(a + 0.4) * len * 0.5, cy + Math.sin(a + 0.4) * len * 0.5, ex, ey);
        g.stroke();
        tips.push([ex, ey, a]);
      }
      // leaves, darkest first so the sunlit ones sit on top
      const leaves = [];
      for (let i = 0; i < 95; i++) {
        let x, y;
        if (i < 50) {
          const tp = tips[i % tips.length];
          const k = 0.25 + rnd() * 0.8;
          x = cx + (tp[0] - cx) * k + (rnd() - 0.5) * C * 0.12;
          y = cy + (tp[1] - cy) * k + (rnd() - 0.5) * C * 0.12;
        } else {
          const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * C * 0.4;
          x = cx + Math.cos(a) * rr;
          y = cy + Math.sin(a) * rr;
        }
        const r2 = Math.hypot(x - cx, y - cy) / (C * 0.45);
        leaves.push({ x, y, ang: rnd() * Math.PI * 2, len: C * (0.075 + rnd() * 0.05), shade: 0.55 + rnd() * 0.35 + r2 * 0.2, hue: rnd() });
      }
      leaves.sort((a, b) => a.shade - b.shade);
      for (const l of leaves) {
        const s = l.shade;
        const r = Math.round((70 + 30 * l.hue) * s), gg = Math.round((108 + 22 * (1 - l.hue)) * s), b = Math.round(46 * s);
        g.fillStyle = `rgb(${r},${gg},${b})`;
        const wid = l.len * 0.62;
        g.save();
        g.translate(l.x, l.y);
        g.rotate(l.ang);
        g.beginPath();
        g.moveTo(0, -l.len / 2);
        g.bezierCurveTo(wid / 2, -l.len / 4, wid / 2, l.len / 4, 0, l.len / 2);
        g.bezierCurveTo(-wid / 2, l.len / 4, -wid / 2, -l.len / 4, 0, -l.len / 2);
        g.fill();
        g.strokeStyle = `rgba(${Math.round(r * 0.7)},${Math.round(gg * 0.75)},${Math.round(b * 0.7)},0.8)`;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(0, -l.len / 2);
        g.lineTo(0, l.len / 2);
        g.stroke();
        g.restore();
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 4;
    return t;
  }

  const SPECIES = {
    // lime: a lifted, rounded crown on a straight trunk (St Peter's Street, planted 1881)
    lime: { trunk: 3.1, r0: 0.2, main: 4, sub: 3, depth: 2, spread: [0.62, 0.55, 0.6], lenK: [2.4, 0.62, 0.6], rK: 0.55, leafR: 1.25, cards: 9, card: 1.35, up: 0.18 },
    // plane: taller and looser, with big leaves
    plane: { trunk: 3.4, r0: 0.22, main: 3, sub: 3, depth: 2, spread: [0.5, 0.65, 0.6], lenK: [2.9, 0.66, 0.6], rK: 0.55, leafR: 1.45, cards: 10, card: 1.55, up: 0.12 },
    // churchyard: broad and spreading
    broad: { trunk: 2.4, r0: 0.26, main: 5, sub: 3, depth: 2, spread: [0.85, 0.6, 0.6], lenK: [2.6, 0.6, 0.55], rK: 0.55, leafR: 1.4, cards: 9, card: 1.45, up: 0.08 },
  };

  function norm(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  // tilt direction d by angle t towards azimuth az
  function tilt(d, t, az) {
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const a = norm(cross(d, ref)), b = cross(d, a);
    const o = [a[0] * Math.cos(az) + b[0] * Math.sin(az), a[1] * Math.cos(az) + b[1] * Math.sin(az), a[2] * Math.cos(az) + b[2] * Math.sin(az)];
    return norm([d[0] * Math.cos(t) + o[0] * Math.sin(t), d[1] * Math.cos(t) + o[1] * Math.sin(t), d[2] * Math.cos(t) + o[2] * Math.sin(t)]);
  }

  function build(species, seed, hi) {
    const sp = SPECIES[species];
    const rng = U.rng(seed);
    const B = { p: [], n: [], c: [], i: [], v: 0 };
    const clusters = [];
    const seg = hi ? 7 : 5;
    // a tapered tube along a polyline
    function tube(pts, r0, r1) {
      const base = B.v;
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k];
        const d = norm(k < pts.length - 1 ? [pts[k + 1][0] - p[0], pts[k + 1][1] - p[1], pts[k + 1][2] - p[2]] : [p[0] - pts[k - 1][0], p[1] - pts[k - 1][1], p[2] - pts[k - 1][2]]);
        const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        const a = norm(cross(d, ref)), b = cross(d, a);
        const r = r0 + ((r1 - r0) * k) / (pts.length - 1);
        for (let j = 0; j < seg; j++) {
          const t = (j / seg) * Math.PI * 2;
          const o = [a[0] * Math.cos(t) + b[0] * Math.sin(t), a[1] * Math.cos(t) + b[1] * Math.sin(t), a[2] * Math.cos(t) + b[2] * Math.sin(t)];
          // bark: furrowed, darker near the ground and on the shaded underside
          const furrow = 0.9 + 0.1 * Math.sin(t * 5 + p[1] * 3);
          const shade = (0.62 + 0.38 * U.clamp(p[1] / 3, 0, 1)) * furrow * (0.85 + 0.15 * (o[1] * 0.5 + 0.5));
          B.p.push(p[0] + o[0] * r, p[1] + o[1] * r, p[2] + o[2] * r);
          B.n.push(o[0], o[1], o[2]);
          B.c.push(0.085 * shade, 0.07 * shade, 0.055 * shade);
        }
      }
      for (let k = 0; k < pts.length - 1; k++) {
        for (let j = 0; j < seg; j++) {
          const a = base + k * seg + j, b = base + k * seg + ((j + 1) % seg), c = base + (k + 1) * seg + ((j + 1) % seg), d = base + (k + 1) * seg + j;
          B.i.push(a, b, c, a, c, d);
        }
      }
      B.v += pts.length * seg;
    }
    function grow(p, dir, len, r, depth) {
      const pts = [p];
      let cur = p, d = dir;
      const steps = depth === 0 ? 4 : 3;
      for (let i = 0; i < steps; i++) {
        d = norm([d[0] + (rng() - 0.5) * 0.22, d[1] + (rng() - 0.5) * 0.22 + sp.up * 0.15, d[2] + (rng() - 0.5) * 0.22]);
        cur = [cur[0] + (d[0] * len) / steps, cur[1] + (d[1] * len) / steps, cur[2] + (d[2] * len) / steps];
        pts.push(cur);
      }
      const rEnd = r * (depth === 0 ? 0.62 : 0.4);
      tube(pts, r, rEnd);
      if (depth >= sp.depth) {
        clusters.push({ c: cur, r: sp.leafR * (0.8 + 0.4 * rng()) });
        return;
      }
      const n = depth === 0 ? sp.main : sp.sub;
      for (let k = 0; k < n; k++) {
        const t = depth === 0 ? 0.82 + 0.18 * rng() : 0.45 + 0.55 * rng();
        const idx = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
        const f = t * (pts.length - 1) - idx;
        const a = pts[idx], b = pts[idx + 1];
        const start = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        const az = (k / n) * Math.PI * 2 + rng() * 0.9;
        const nd = tilt(d, sp.spread[depth] * (0.75 + 0.5 * rng()), az);
        grow(start, nd, len * sp.lenK[depth + 1] * (0.8 + 0.4 * rng()) * (depth === 0 ? 1.25 : 1), Math.max(0.025, rEnd * 0.8), depth + 1);
      }
      if (depth >= 1) {
        const m = pts[Math.floor(pts.length * 0.6)];
        clusters.push({ c: m, r: sp.leafR * 0.75 });
      }
    }
    grow([0, 0, 0], [0, 1, 0], sp.trunk, sp.r0, 0);
    // leaf cards around the clusters
    const L = { p: [], n: [], c: [], uv: [], i: [], v: 0 };
    let cx = 0, cy = 0, cz = 0;
    for (const c of clusters) {
      cx += c.c[0];
      cy += c.c[1];
      cz += c.c[2];
    }
    cx /= clusters.length;
    cy /= clusters.length;
    cz /= clusters.length;
    let crownR = 0;
    for (const c of clusters) crownR = Math.max(crownR, Math.hypot(c.c[0] - cx, c.c[1] - cy, c.c[2] - cz) + c.r);
    const cards = hi ? sp.cards : Math.ceil(sp.cards * 0.55);
    for (const cl of clusters) {
      for (let i = 0; i < cards; i++) {
        // a point in the cluster, a random facing, a random spray from the atlas
        let ox, oy, oz;
        do {
          ox = rng() * 2 - 1;
          oy = rng() * 2 - 1;
          oz = rng() * 2 - 1;
        } while (ox * ox + oy * oy + oz * oz > 1);
        const q = [cl.c[0] + ox * cl.r * 0.75, cl.c[1] + oy * cl.r * 0.6, cl.c[2] + oz * cl.r * 0.75];
        const fn = norm([rng() - 0.5, rng() * 0.8 - 0.2, rng() - 0.5]);
        const ref = Math.abs(fn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        const ua = norm(cross(fn, ref)), va = cross(fn, ua);
        const size = sp.card * (0.75 + 0.5 * rng());
        const cell = Math.floor(rng() * 4);
        const u0 = (cell % 2) * 0.5, v0 = Math.floor(cell / 2) * 0.5;
        // shading normal: out from the crown, so the crown lights as one soft volume
        const out = norm([q[0] - cx, (q[1] - cy) * 0.8 + 0.25 * crownR, q[2] - cz]);
        const sn = norm([out[0] * 0.8 + fn[0] * 0.2, out[1] * 0.8 + fn[1] * 0.2, out[2] * 0.8 + fn[2] * 0.2]);
        // inner leaves are shaded by the outer ones
        const depthIn = U.clamp(Math.hypot(q[0] - cx, q[1] - cy, q[2] - cz) / crownR, 0, 1);
        const ao = (0.45 + 0.55 * depthIn) * (0.85 + 0.15 * U.clamp((q[1] - cy) / crownR + 0.5, 0, 1)) * (0.85 + rng() * 0.3);
        const base = L.v;
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          L.p.push(q[0] + (ua[0] * su + va[0] * sv) * size * 0.5, q[1] + (ua[1] * su + va[1] * sv) * size * 0.5, q[2] + (ua[2] * su + va[2] * sv) * size * 0.5);
          L.n.push(sn[0], sn[1], sn[2]);
          L.c.push(ao, ao, ao);
          L.uv.push(u0 + (su > 0 ? 0.5 : 0), v0 + (sv > 0 ? 0.5 : 0));
        }
        L.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
        L.v += 4;
      }
    }
    const geo = (o, uv) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
      g.setIndex(o.i);
      g.computeBoundingSphere();
      return g;
    };
    return { bark: geo(B, false), leaves: geo(L, true), height: cy + crownR };
  }

  // leaves: alpha-tested cards, lit with the crown normals, swaying in the wind
  Trees.leafMaterial = function (eraUniforms, tint) {
    Trees.tex = Trees.tex || leafAtlas();
    const m = new THREE.MeshStandardMaterial({ map: Trees.tex, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, color: tint, roughness: 0.78, metalness: 0 });
    SA.Tex.patchInstancedWave(m, eraUniforms);
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = function (sh) {
      prev(sh);
      sh.uniforms.uTime = SA.Render.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 wpos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          float hk = max(0.0, transformed.y - 2.0) * 0.06;
          float gust = 0.6 + 0.4 * sin(uTime * 0.37 + wpos.x * 0.02);
          transformed.x += (sin(uTime * 1.3 + wpos.x * 0.21 + wpos.z * 0.13) * hk + sin(uTime * 6.7 + dot(wpos, vec3(3.1, 1.7, 2.3))) * 0.028) * gust;
          transformed.z += (cos(uTime * 1.1 + wpos.z * 0.19) * hk + cos(uTime * 5.9 + dot(wpos, vec3(1.3, 2.9, 1.1))) * 0.028) * gust;
          transformed.y += sin(uTime * 7.3 + dot(wpos, vec3(2.1, 1.1, 3.7))) * 0.018 * gust;
        }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <alphatest_fragment>', `
          // keep cut-out leaves solid in the distance: lower mips average their alpha away
          vec2 lduv = vMapUv * 512.0;
          float lmip = max(0.0, 0.5 * log2(max(dot(dFdx(lduv), dFdx(lduv)), dot(dFdy(lduv), dFdy(lduv)))));
          diffuseColor.a *= 1.0 + lmip * 0.28;
          #include <alphatest_fragment>`)
        .replace('#include <normal_fragment_maps>', 'normal = normalize(vNormal);');
    };
    m.customProgramCacheKey = () => 'tree-leaves';
    return m;
  };
  Trees.barkMaterial = function (eraUniforms) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    SA.Tex.patchInstancedWave(m, eraUniforms);
    return m;
  };

  // geometry per species and variant, shared by every era
  const cache = {};
  Trees.variants = function (species, hi) {
    const key = species + (hi ? 'h' : 'l');
    if (!cache[key]) cache[key] = [0, 1, 2].map((i) => build(species, 1000 + i * 7919 + species.length * 31, hi));
    return cache[key];
  };
})();
