/* LAST SPACE - builds the visible neighbourhood from the Arena: road, pavements and kerbs from the
   distance fields, garden walls, terraces, street furniture, markings, sky and 6.15 pm light.
   Sim (x, y) -> three.js (x, height, -y). */
(function (LS) {
  'use strict';
  const U = LS.U;
  const PAVE_H = 0.12;

  class World3D {
    constructor(renderer, arena, quality) {
      this.arena = arena; this.quality = quality || 'high';
      const scene = this.scene = new THREE.Scene();
      this.buildSky();
      this.buildLights();
      this.buildGround();
      this.buildMarkings();
      this.buildWalls();
      this.buildHouses();
      this.buildProps();
      this.buildEnv(renderer);
    }

    // ---------------------------------------------------------------- sky, fog, light (18:15, early October, sun low in the WSW)
    buildSky() {
      const geo = new THREE.SphereGeometry(900, 32, 16);
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { sunDir: { value: new THREE.Vector3() } },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
        fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
          void main(){
            float h = clamp(vDir.y, -0.2, 1.0);
            vec3 zen = vec3(0.16,0.22,0.42), mid = vec3(0.55,0.52,0.66), hor = vec3(1.0,0.62,0.38);
            vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, zen, smoothstep(0.18, 0.75, h));
            float s = max(dot(normalize(vDir), sunDir), 0.0);
            c += vec3(1.0,0.55,0.25) * pow(s, 18.0) * 0.6 + vec3(1.0,0.85,0.6) * pow(s, 900.0) * 6.0;
            c = mix(c, vec3(0.32,0.28,0.30), smoothstep(0.0, -0.15, h));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      });
      this.sky = new THREE.Mesh(geo, mat); this.sky.renderOrder = -10;
      this.scene.add(this.sky);
      this.scene.fog = new THREE.Fog(0xb59a8c, 90, 420);
      this.scene.background = new THREE.Color(0x8f86a0);
    }
    buildLights() {
      const az = (250 - 90) * Math.PI / 180, el = 11 * Math.PI / 180; // compass 250 deg (WSW), 11 deg up
      // sim: x east, y north. compass az measured from north clockwise
      const cAz = 250 * Math.PI / 180;
      const dx = Math.sin(cAz) * Math.cos(el), dy = Math.cos(cAz) * Math.cos(el), dz = Math.sin(el);
      this.sunDir = new THREE.Vector3(dx, dz, -dy).normalize();
      this.sky.material.uniforms.sunDir.value.copy(this.sunDir);
      const hemi = new THREE.HemisphereLight(0x9fb3d8, 0x4a3a2e, 1.35);
      this.scene.add(hemi);
      const sun = this.sun = new THREE.DirectionalLight(0xffb27a, 2.4);
      sun.castShadow = this.quality !== 'low';
      sun.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
      const S = 55; Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 400 });
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
      this.scene.add(sun, sun.target);
      this.scene.add(new THREE.AmbientLight(0x50586a, 0.35));
    }
    focus(x, y) {
      // keep the shadow frustum on the action
      const p = new THREE.Vector3(x, 0, -y);
      this.sun.target.position.copy(p);
      this.sun.position.copy(p).addScaledVector(this.sunDir, 200);
      this.sun.target.updateMatrixWorld();
    }
    buildEnv(renderer) {
      // a soft environment for car paint reflections
      const pm = new THREE.PMREMGenerator(renderer);
      const s = new THREE.Scene(); s.add(this.sky.clone());
      s.children[0].material = this.sky.material;
      const rt = pm.fromScene(s, 0.04);
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = 0.55;
      pm.dispose();
    }

    // ---------------------------------------------------------------- ground surfaces by marching squares
    fillRegion(value, y, uvScale, col) {
      const A = this.arena, W = A.gw, H = A.gh, R = A.gres, x0 = A.gx0, y0 = A.gy0;
      const B = new LS.GeoBuilder();
      const pt = (x, yy) => [x, y, -yy];
      const uv = (x, yy) => [x / uvScale, yy / uvScale];
      const V = new Float32Array(W * H);
      for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) V[iy * W + ix] = value(iy * W + ix);
      for (let iy = 0; iy < H - 1; iy++) {
        let run = -1;
        const flush = (endIx) => {
          if (run < 0) return;
          const xa = x0 + run * R, xb = x0 + endIx * R, ya = y0 + iy * R, yb = ya + R;
          B.quad(pt(xa, ya), pt(xb, ya), pt(xb, yb), pt(xa, yb), col, [uv(xa, ya), uv(xb, ya), uv(xb, yb), uv(xa, yb)]);
          run = -1;
        };
        for (let ix = 0; ix < W - 1; ix++) {
          const v0 = V[iy * W + ix], v1 = V[iy * W + ix + 1], v2 = V[(iy + 1) * W + ix + 1], v3 = V[(iy + 1) * W + ix];
          const inside = (v0 < 0) + (v1 < 0) + (v2 < 0) + (v3 < 0);
          if (inside === 4) { if (run < 0) run = ix; continue; }
          flush(ix);
          if (inside === 0) continue;
          // partial cell: walk the perimeter
          const cx = [x0 + ix * R, x0 + (ix + 1) * R, x0 + (ix + 1) * R, x0 + ix * R], cy = [y0 + iy * R, y0 + iy * R, y0 + (iy + 1) * R, y0 + (iy + 1) * R];
          const vv = [v0, v1, v2, v3], poly = [];
          for (let k = 0; k < 4; k++) {
            const k2 = (k + 1) % 4;
            if (vv[k] < 0) poly.push([cx[k], cy[k]]);
            if ((vv[k] < 0) !== (vv[k2] < 0)) { const t = vv[k] / (vv[k] - vv[k2]); poly.push([cx[k] + (cx[k2] - cx[k]) * t, cy[k] + (cy[k2] - cy[k]) * t]); }
          }
          if (poly.length < 3) continue;
          for (let k = 1; k < poly.length - 1; k++) B.tri(pt(poly[0][0], poly[0][1]), pt(poly[k][0], poly[k][1]), pt(poly[k + 1][0], poly[k + 1][1]), col, [uv(poly[0][0], poly[0][1]), uv(poly[k][0], poly[k][1]), uv(poly[k + 1][0], poly[k + 1][1])]);
        }
        flush(W - 1);
      }
      return B.geometry();
    }
    buildGround() {
      const A = this.arena, G = A.G, F = A.F;
      const base = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: 0x4f5a3a, roughness: 1 }));
      base.rotation.x = -Math.PI / 2; base.position.y = -0.04; base.receiveShadow = true;
      this.scene.add(base);
      // front and back gardens: grass where it is not corridor
      const garden = this.fillRegion((i) => -(F[i] - 0.05), 0.02, 3, [1, 1, 1]);
      const gm = new THREE.Mesh(garden, new THREE.MeshStandardMaterial({ map: LS.Tex.garden(), vertexColors: true, roughness: 0.95 }));
      gm.receiveShadow = true; this.scene.add(gm);
      const road = this.fillRegion((i) => G[i], 0, 4, [1, 1, 1]);
      const rm = new THREE.Mesh(road, new THREE.MeshStandardMaterial({ map: LS.Tex.asphalt(), vertexColors: true, roughness: 0.92 }));
      rm.receiveShadow = true; this.scene.add(rm);
      const pave = this.fillRegion((i) => Math.max(-G[i] + 0.12, F[i] - 0.3), PAVE_H, 2.4, [1, 1, 1]);
      const pm = new THREE.Mesh(pave, new THREE.MeshStandardMaterial({ map: LS.Tex.paving(), vertexColors: true, roughness: 0.9 }));
      pm.receiveShadow = true; this.scene.add(pm);
      // kerb stones along the kerb lines
      const K = new LS.GeoBuilder(), kc = [1, 1, 1];
      for (const line of A.kerbLines) {
        for (let i = 0; i < line.length - 1; i++) {
          const [ax, ay] = line[i], [bx, by] = line[i + 1];
          const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy); if (l < 0.01) continue;
          // the road is on the left of the contour direction; pavement on the right
          const nx = dy / l, ny = -dx / l, w = 0.16;
          const p0 = [ax, 0, -ay], p1 = [bx, 0, -by];
          const t0 = [ax, PAVE_H + 0.01, -ay], t1 = [bx, PAVE_H + 0.01, -by];
          const q0 = [ax + nx * w, PAVE_H + 0.01, -(ay + ny * w)], q1 = [bx + nx * w, PAVE_H + 0.01, -(by + ny * w)];
          K.quad(p1, p0, t0, t1, kc, [[l / 2, 0], [0, 0], [0, 0.25], [l / 2, 0.25]]);
          K.quad(t1, t0, q0, q1, kc, [[l / 2, 0.25], [0, 0.25], [0, 1], [l / 2, 1]]);
        }
      }
      const km = new THREE.Mesh(K.geometry(), new THREE.MeshStandardMaterial({ map: LS.Tex.kerb(), vertexColors: true, roughness: 0.8 }));
      km.receiveShadow = true; this.scene.add(km);
    }

    // ---------------------------------------------------------------- road markings
    buildMarkings() {
      const A = this.arena;
      const white = new LS.GeoBuilder(), yellow = new LS.GeoBuilder(), red = new LS.GeoBuilder();
      const Y = 0.012, wc = [1, 1, 1];
      const strip = (B, ax, ay, bx, by, w, y) => { const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; B.quad([ax - nx, y || Y, -(ay - ny)], [bx - nx, y || Y, -(by - ny)], [bx + nx, y || Y, -(by + ny)], [ax + nx, y || Y, -(ay + ny)], wc); };
      const near = (x, y, st, d) => A.streets.some((o) => o !== st && (() => { const pr = o.line.project(x, y); return pr.d - o.hcAt(pr.s) < d; })());
      for (const st of A.streets) {
        if (st.cfg.drive) continue;
        const L = st.line.length;
        for (const side of [1, -1]) {
          // double yellow lines near junctions; bay line along the parking strips elsewhere
          for (let s = 0; s < L - 1; s += 1) {
            const p = st.line.at(s), q = st.line.at(s + 1);
            const hc0 = st.hcAt(s), hc1 = st.hcAt(s + 1);
            const ox = (k) => [p.x + p.nx * side * (hc0 - k), p.y + p.ny * side * (hc0 - k)], oy = (k) => [q.x + q.nx * side * (hc1 - k), q.y + q.ny * side * (hc1 - k)];
            const junction = near(p.x, p.y, st, 9) || st.cfg.mainRoad;
            if (A.kerb(...ox(0.3)) > -0.05) continue;
            if (junction) {
              for (const k of [0.22, 0.42]) { const a = ox(k), b = oy(k); strip(yellow, a[0], a[1], b[0], b[1], 0.1); }
            } else if (st.cfg.park[side > 0 ? 0 : 1]) {
              const a = ox(2.3), b = oy(2.3); if (Math.floor(s) % 6 !== 5) strip(white, a[0], a[1], b[0], b[1], 0.1);
            }
          }
        }
        if (st.cfg.mainRoad) for (let s = 2; s < L - 2; s += 9) { const p = st.line.at(s), q = st.line.at(s + 4); strip(white, p.x, p.y, q.x, q.y, 0.12); }
      }
      // give-way lines where the side streets meet Catherine Street and Grange Street
      for (const j of A.junctions) {
        const [a, b] = j.streets.map((n) => A.byName[n]);
        const minor = a.cfg.hc <= b.cfg.hc ? a : b, major = minor === a ? b : a;
        if (minor.cfg.drive) continue;
        const pr = minor.line.project(j.x, j.y), dir = pr.s < minor.line.length / 2 ? 1 : -1;
        const s0 = pr.s + dir * (major.cfg.hc + 0.6);
        const p = minor.line.at(s0), hc = minor.hcAt(s0);
        for (const k of [0, 0.45]) {
          const q = minor.line.at(s0 + dir * k);
          for (let u = -hc + 0.3; u < hc - 0.3; u += 0.9) strip(white, q.x + q.nx * u, q.y + q.ny * u, q.x + q.nx * (u + 0.6), q.y + q.ny * (u + 0.6), 0.2, Y + 0.002);
        }
        // "20" roundel on the way in (20 mph per OpenStreetMap)
        this.roundel(minor, s0 + dir * 9, dir);
      }
      for (const d of A.dropKerbs) {
        const c = Math.cos(d.a), s = Math.sin(d.a);
        strip(white, d.x - c * d.len / 2, d.y - s * d.len / 2, d.x + c * d.len / 2, d.y + s * d.len / 2, 0.1);
      }
      for (const [B, color] of [[white, 0xf2f2ee], [yellow, 0xf2c200]]) {
        const m = new THREE.Mesh(B.geometry(), new THREE.MeshStandardMaterial({ color, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
        m.receiveShadow = true; this.scene.add(m);
      }
    }
    roundel(st, s, dir) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      g.strokeStyle = '#d42a1e'; g.lineWidth = 26; g.beginPath(); g.arc(128, 128, 104, 0, 7); g.stroke();
      g.fillStyle = '#f2f2ee'; g.font = 'bold 120px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('20', 128, 134);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshStandardMaterial({ map: t, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
      const p = st.line.at(s);
      m.rotation.set(-Math.PI / 2, 0, p.heading + (dir > 0 ? -Math.PI / 2 : Math.PI / 2), 'YXZ');
      m.rotation.order = 'YXZ'; m.rotation.y = p.heading + (dir > 0 ? Math.PI : 0) - Math.PI / 2; m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, 0.014, -p.y); m.receiveShadow = true;
      this.scene.add(m);
    }

    // ---------------------------------------------------------------- garden walls and hedges
    buildWalls() {
      const A = this.arena, r = U.rng(5);
      const brick = new LS.GeoBuilder(), hedge = new LS.GeoBuilder(), coping = new LS.GeoBuilder();
      for (const line of A.wallCentre) {
        let acc = 0, isHedge = r() < 0.25, tint = r();
        for (let i = 0; i < line.length - 1; i++) {
          const [ax, ay] = line[i], [bx, by] = line[i + 1];
          const l = Math.hypot(bx - ax, by - ay); if (l < 0.05) continue;
          acc += l; if (acc > 14) { acc = 0; isHedge = r() < 0.28; tint = r(); }
          const cx = (ax + bx) / 2, cy = (ay + by) / 2, rot = Math.atan2(by - ay, bx - ax);
          if (isHedge) hedge.box(cx, 0.65, -cy, l + 0.1, 1.3, 0.55, rot, [0.85 + tint * 0.3, 0.9 + tint * 0.2, 0.8], 1.5);
          else {
            const col = tint < 0.6 ? [0.78, 0.44, 0.34] : tint < 0.85 ? [0.86, 0.74, 0.56] : [0.92, 0.9, 0.86];
            brick.box(cx, 0.45, -cy, l + 0.04, 0.9, 0.3, rot, col, 1.8);
            coping.box(cx, 0.94, -cy, l + 0.06, 0.08, 0.38, rot, [0.8, 0.79, 0.75], 1);
          }
        }
      }
      const add = (B, mat) => { const m = new THREE.Mesh(B.geometry(), mat); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); };
      add(brick, new THREE.MeshStandardMaterial({ map: LS.Tex.brick(), vertexColors: true, roughness: 0.9 }));
      add(hedge, new THREE.MeshStandardMaterial({ map: LS.Tex.hedge(), vertexColors: true, roughness: 1 }));
      add(coping, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    }

    // ---------------------------------------------------------------- terraced houses
    buildHouses() {
      const A = this.arena, r = U.rng(21);
      const brick = new LS.GeoBuilder(), render = new LS.GeoBuilder(), roof = new LS.GeoBuilder(), trim = new LS.GeoBuilder(), lit = new LS.GeoBuilder(), dark = new LS.GeoBuilder(), garden = new LS.GeoBuilder();
      const doors = ['#7d1a1a', '#1f3b5c', '#24452e', '#111111', '#e0b13a', '#5d2a5c', '#3f6f82', '#a63d2a', '#e6e2d6'];
      const terraceTint = new Map();
      for (const h of A.houses) {
        if (!terraceTint.has(h.terrace)) terraceTint.set(h.terrace, r());
        const tt = terraceTint.get(h.terrace);
        const style = h.style;
        const wallB = style === 'render' ? render : brick;
        const wcol = style === 'red' ? [0.72 + tt * 0.1, 0.4 + tt * 0.06, 0.32] : style === 'stock' ? [0.86, 0.74 + tt * 0.06, 0.55] : [[0.93, 0.91, 0.86], [0.86, 0.9, 0.93], [0.95, 0.88, 0.78], [0.84, 0.9, 0.84]][Math.floor(tt * 4)];
        const c = Math.cos(h.a), s = Math.sin(h.a);
        // local (u along frontage, v away from street) -> sim
        const P = (u, v) => [h.x + c * u - s * v, h.y + s * u + c * v];
        const H = 5.9 + tt * 0.5, D = h.d, Wd = h.w;
        const [mx, my] = P(0, D / 2);
        wallB.box(mx, H / 2, -my, Wd, H, D, h.a, wcol, 1.8);
        // string course, sills and lintels
        trim.box(...xyz(P(0, -0.03), 2.75), Wd, 0.12, 0.08, h.a, [0.85, 0.83, 0.78], 1);
        const doorLeft = (h.n % 2 === 0) !== (h.side > 0);
        const du = doorLeft ? -Wd / 2 + 0.75 : Wd / 2 - 0.75, bu = doorLeft ? 0.6 : -0.6;
        // door with fanlight and step
        const dc = LS.hexRGB(doors[Math.floor(r() * doors.length)]);
        trim.box(...xyz(P(du, -0.04), 1.05), 0.95, 2.1, 0.08, h.a, dc, 1);
        trim.box(...xyz(P(du, -0.05), 2.3), 1.05, 0.12, 0.1, h.a, [0.9, 0.89, 0.85], 1);
        (r() < 0.6 ? lit : dark).box(...xyz(P(du, -0.05), 2.2), 0.8, 0.22, 0.06, h.a, [1, 1, 1], 1);
        trim.box(...xyz(P(du, -0.35), 0.08), 1.2, 0.16, 0.6, h.a, [0.7, 0.7, 0.68], 1);
        // ground-floor bay window
        const bw = 2.2, bd = 0.65, bh = 2.6;
        wallB.box(...xyz(P(bu, -bd / 2), 0.45), bw, 0.9, bd, h.a, wcol, 1.8);
        trim.box(...xyz(P(bu, -bd / 2), 2.7), bw + 0.1, 0.2, bd + 0.1, h.a, [0.9, 0.9, 0.86], 1);
        roof.box(...xyz(P(bu, -bd / 2 + 0.05), 2.88), bw + 0.2, 0.18, bd + 0.25, h.a, [0.9, 0.9, 0.95], 1);
        const litG = r() < 0.55;
        (litG ? lit : dark).box(...xyz(P(bu, -bd - 0.01), 1.65), bw - 0.25, 1.4, 0.04, h.a, [1, 1, 1], 1);
        trim.box(...xyz(P(bu, -bd - 0.02), 1.65), 0.08, 1.4, 0.05, h.a, [0.95, 0.95, 0.92], 1);
        // first-floor windows
        for (const wu of [-Wd / 4 - 0.1, Wd / 4 + 0.1]) {
          const lf = r() < 0.35;
          trim.box(...xyz(P(wu, -0.03), 3.55), 1.05, 1.5, 0.06, h.a, [0.95, 0.95, 0.92], 1);
          (lf ? lit : dark).box(...xyz(P(wu, -0.06), 3.55), 0.85, 1.3, 0.04, h.a, [1, 1, 1], 1);
          trim.box(...xyz(P(wu, -0.08), 2.78), 1.15, 0.08, 0.14, h.a, [0.85, 0.83, 0.78], 1);
        }
        // pitched roof, ridge parallel to the street
        const rh = 2.4, [f0x, f0y] = P(-Wd / 2, -0.25), [f1x, f1y] = P(Wd / 2, -0.25), [r0x, r0y] = P(-Wd / 2, D / 2), [r1x, r1y] = P(Wd / 2, D / 2), [b0x, b0y] = P(-Wd / 2, D + 0.25), [b1x, b1y] = P(Wd / 2, D + 0.25);
        const rc = [0.9 + tt * 0.1, 0.9 + tt * 0.1, 0.95];
        roof.quad([f0x, H, -f0y], [f1x, H, -f1y], [r1x, H + rh, -r1y], [r0x, H + rh, -r0y], rc, [[0, 0], [Wd / 2, 0], [Wd / 2, 1.6], [0, 1.6]]);
        roof.quad([b1x, H, -b1y], [b0x, H, -b0y], [r0x, H + rh, -r0y], [r1x, H + rh, -r1y], rc, [[0, 0], [Wd / 2, 0], [Wd / 2, 1.6], [0, 1.6]]);
        const [g0x, g0y] = P(-Wd / 2, 0), [g1x, g1y] = P(-Wd / 2, D);
        wallB.tri([g0x, H, -g0y], [g1x, H, -g1y], [r0x, H + rh, -r0y], wcol);
        const [g2x, g2y] = P(Wd / 2, 0), [g3x, g3y] = P(Wd / 2, D);
        wallB.tri([g3x, H, -g3y], [g2x, H, -g2y], [r1x, H + rh, -r1y], wcol);
        // chimney stack on the party wall
        if (h.n % 2 === 0) {
          brick.box(...xyz(P(-Wd / 2, D / 2), H + rh + 0.5), 0.7, 1.4, 1.0, h.a, [0.7, 0.4, 0.32], 1.8);
          for (const k of [-0.25, 0.25]) trim.box(...xyz(P(-Wd / 2, D / 2 + k), H + rh + 1.35), 0.22, 0.35, 0.22, h.a, [0.72, 0.38, 0.22], 1);
        }
        // front garden: path to the door, a shrub or two
        const g0 = -h.garden;
        garden.box(...xyz(P(du, g0 / 2), 0.06), 0.9, 0.06, h.garden, h.a, [0.62, 0.6, 0.57], 1);
        if (r() < 0.7) garden.box(...xyz(P(bu, g0 / 2 - 0.2), 0.45), 1.2 + r() * 0.8, 0.9, 0.9, h.a + r(), [0.25, 0.42 + r() * 0.15, 0.2], 1);
      }
      const add = (B, mat, shadow) => { const m = new THREE.Mesh(B.geometry(), mat); m.castShadow = !!shadow; m.receiveShadow = true; this.scene.add(m); return m; };
      add(brick, new THREE.MeshStandardMaterial({ map: LS.Tex.brick(), vertexColors: true, roughness: 0.92 }), true);
      add(render, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), true);
      add(roof, new THREE.MeshStandardMaterial({ map: LS.Tex.slate(), vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }), true);
      add(trim, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), false);
      add(lit, new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb35c, emissiveIntensity: 1.1, roughness: 0.3 }), false);
      add(dark, new THREE.MeshStandardMaterial({ color: 0x1b2533, roughness: 0.1, metalness: 0.6 }), false);
      add(garden, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), true);
      // the Jubilee Centre (OSM way 164349081), the community centre on Church Street
      for (const lm of LS.MAPDATA.landmarks) {
        const shape = new THREE.Shape(lm.poly.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ExtrudeGeometry(shape, { depth: 4.6, bevelEnabled: false });
        g.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc9b9a4, roughness: 0.9 }));
        m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshBasicMaterial({ map: LS.Tex.textPanel('jubilee', [{ t: 'JUBILEE CENTRE', font: 'bold 70px Arial', y: 64 }], { w: 640, h: 128, bg: '#f4efe4', fg: '#2a3a6a' }) }));
        const p = lm.poly[0]; sign.position.set(p[0] + 1.5, 3.6, -p[1] - 0.05); this.scene.add(sign);
      }
      function xyz(p, y) { return [p[0], y, -p[1]]; }
    }

    // ---------------------------------------------------------------- street furniture
    buildProps() {
      const A = this.arena;
      const metal = new LS.GeoBuilder();
      const lampHeads = [];
      for (const l of A.lamps) {
        metal.box(l.x, 3.0, -l.y, 0.14, 6.0, 0.14, 0, [0.35, 0.37, 0.38], 1);
        // bracket over the road
        const st = A.byName[l.street], pr = st.line.project(l.x, l.y), dx = pr.x - l.x, dy = pr.y - l.y, d = Math.hypot(dx, dy) || 1;
        const hx = l.x + dx / d * 0.9, hy = l.y + dy / d * 0.9;
        metal.box((l.x + hx) / 2, 5.95, -(l.y + hy) / 2, 0.08, 0.08, 1.0, Math.atan2(dy, dx) + Math.PI / 2, [0.35, 0.37, 0.38], 1);
        lampHeads.push([hx, hy]);
      }
      // permit signs on posts
      for (const p of A.permitSigns) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshStandardMaterial({ map: LS.Tex.permitSign(), side: THREE.DoubleSide }));
        m.position.set(p.x, 2.4, -p.y); m.rotation.y = p.a + Math.PI / 2; this.scene.add(m);
      }
      const mm = new THREE.Mesh(metal.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 }));
      mm.castShadow = true; this.scene.add(mm);
      // lamp heads glowing + pools of light (the lamps have just come on)
      const headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.3);
      const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd9a0, emissiveIntensity: 2.0 }), lampHeads.length);
      const poolGeo = new THREE.PlaneGeometry(8, 8); poolGeo.rotateX(-Math.PI / 2);
      const pools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({ map: LS.Tex.glow(), color: 0xffcf8a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), lampHeads.length);
      const m4 = new THREE.Matrix4();
      lampHeads.forEach(([x, y], i) => { m4.makeTranslation(x, 5.85, -y); heads.setMatrixAt(i, m4); m4.makeTranslation(x, 0.04, -y); pools.setMatrixAt(i, m4); });
      this.scene.add(heads, pools);
      // street-name signs: bigger than life so you can read them at speed
      for (const sg of A.signs) {
        const g = new THREE.Group();
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshStandardMaterial({ map: LS.Tex.streetSign(sg.text, sg.sub), roughness: 0.6 }));
        const back = panel.clone(); back.rotation.y = Math.PI;
        panel.position.y = back.position.y = 1.55;
        g.add(panel, back);
        for (const k of [-1.35, 1.35]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.85, 0.08), new THREE.MeshStandardMaterial({ color: 0x222222 })); post.position.set(k, 0.92, 0); g.add(post); }
        g.position.set(sg.x, PAVE_H, -sg.y); g.rotation.y = sg.a - Math.PI / 2;
        this.scene.add(g);
      }
      // no-entry signs at the wrong ends of the one-way streets
      const noEntry = (stName, s, dir) => {
        const st = A.byName[stName], p = st.line.at(s);
        for (const sd of [1, -1]) {
          const q = { x: p.x + p.nx * sd * (st.hcAt(s) + 0.4), y: p.y + p.ny * sd * (st.hcAt(s) + 0.4) };
          const c = document.createElement('canvas'); c.width = c.height = 128; const gg = c.getContext('2d');
          gg.fillStyle = '#d42a1e'; gg.beginPath(); gg.arc(64, 64, 60, 0, 7); gg.fill(); gg.fillStyle = '#fff'; gg.fillRect(18, 52, 92, 24);
          const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
          const m = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), new THREE.MeshStandardMaterial({ map: t }));
          m.position.set(q.x, 2.2, -q.y); m.rotation.y = p.heading + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.0, 0.07), new THREE.MeshStandardMaterial({ color: 0x777777 })); post.position.set(q.x, 1.0, -q.y);
          this.scene.add(m, post);
        }
      };
      noEntry('Church Street', A.byName['Church Street'].line.length - 13, -1);
      noEntry('Bernard Street', A.byName['Bernard Street'].line.length - 9, -1);
      // road-closed barriers (the physics boxes are in map.js)
      for (const b of A.barriers) {
        const g = new THREE.Group();
        const bar = new THREE.Mesh(new THREE.BoxGeometry(b.half * 2, 0.5, 0.15), new THREE.MeshStandardMaterial({ map: LS.Tex.hatch('#d42a1e', '#ffffff'), roughness: 0.6 }));
        bar.position.y = 0.75; g.add(bar);
        for (let k = -b.half + 0.3; k <= b.half; k += 2.4) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.6), new THREE.MeshStandardMaterial({ color: 0xdddddd })); leg.position.set(k, 0.5, 0); g.add(leg); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xffa000, emissiveIntensity: 3 })); lamp.position.set(k, 1.12, 0); g.add(lamp); }
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({ map: LS.Tex.roadClosed(b.label), side: THREE.DoubleSide }));
        sign.position.set(0, 1.9, 0); g.add(sign);
        g.position.set(b.x, 0, -b.y); g.rotation.y = b.a;
        this.scene.add(g);
      }
      // speed cushions (OpenStreetMap traffic_calming=cushion)
      for (const c of A.cushions) {
        const g = new THREE.BoxGeometry(3.0, 0.08, 1.9, 4, 1, 4); const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { const k = Math.min(1, (1.5 - Math.abs(p.getX(i))) / 0.6) * Math.min(1, (0.95 - Math.abs(p.getZ(i))) / 0.4); p.setY(i, 0.04 + 0.04 * k); }
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8a3b2c, roughness: 0.9 }));
        m.position.set(c.x, 0.02, -c.y); m.rotation.y = c.a; m.receiveShadow = true; this.scene.add(m);
      }
      // the pillar box on the corner of Dalton Street (OSM node 20959945, ref AL3 25)
      for (const p of A.pois) if (p.kind === 'post_box') {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.3, 16), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4 })); body.position.y = 0.65;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 8, 0, 7, 0, 1.2), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.4 })); cap.position.y = 1.3;
        g.add(body, cap); g.position.set(p.x, PAVE_H, -p.y); this.scene.add(g);
      }
      // trees in the gardens and at the car park
      const r = U.rng(31), treePts = [];
      for (const h of A.houses) if (r() < 0.07) { const c = Math.cos(h.a), s = Math.sin(h.a); treePts.push([h.x - s * (h.d + 4), h.y + c * (h.d + 4)]); }
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 4, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a2c }), treePts.length);
      const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.6, 1), new THREE.MeshStandardMaterial({ color: 0x5b6e2f, roughness: 1, flatShading: true }), treePts.length);
      treePts.forEach(([x, y], i) => { const sc = 0.8 + r() * 0.6; m4.makeScale(sc, sc, sc); m4.setPosition(x, 2 * sc, -y); trunk.setMatrixAt(i, m4); m4.makeScale(sc * 1.1, sc * (0.9 + r() * 0.4), sc * 1.1); m4.setPosition(x, 5.2 * sc, -y); crown.setMatrixAt(i, m4); });
      crown.castShadow = true; this.scene.add(trunk, crown);
    }
  }

  // ---------------------------------------------------------------- wheelie bins (instanced, follow the physics)
  class BinsView {
    constructor(scene, bodies) {
      this.bodies = bodies;
      const cols = { black: 0x1c1d1f, blue: 0x1d4f9c, green: 0x2c6b35, brown: 0x6b4423 };
      const geo = (() => {
        const parts = [];
        const b = new THREE.BoxGeometry(0.72, 0.98, 0.58); b.translate(0, 0.53, 0); parts.push(b);
        const lid = new THREE.BoxGeometry(0.78, 0.06, 0.66); lid.translate(0.02, 1.05, 0); parts.push(lid);
        for (const z of [-0.24, 0.24]) { const w = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 8); w.rotateX(Math.PI / 2); w.translate(-0.3, 0.1, z); parts.push(w); }
        return THREE.BufferGeometryUtils.mergeGeometries(parts.map((g) => g.toNonIndexed()), false);
      })();
      this.meshes = {};
      for (const [k, c] of Object.entries(cols)) {
        const list = bodies.filter((b) => b.user.bin.color === k);
        const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }), Math.max(1, list.length));
        m.castShadow = true; scene.add(m);
        this.meshes[k] = { m, list };
      }
      this.m4 = new THREE.Matrix4(); this.e = new THREE.Euler(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
      this.update(0, true);
    }
    update(dt, all) {
      for (const k in this.meshes) {
        const { m, list } = this.meshes[k]; let dirty = false;
        list.forEach((b, i) => {
          const u = b.user;
          if (u.fallen) u.tip = Math.min(1, (u.tip || 0) + dt * 4);
          if (!all && !b.awake && !(u.fallen && u.tip < 1)) return;
          const tip = (u.tip || 0) * Math.PI / 2;
          this.e.set(0, b.a, -tip, 'YXZ'); this.q.setFromEuler(this.e);
          this.v.set(b.x, 0.12 + (u.tip || 0) * 0.15, -b.y);
          this.m4.compose(this.v, this.q, this.s); m.setMatrixAt(i, this.m4); dirty = true;
        });
        if (dirty) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
      }
    }
  }

  // ---------------------------------------------------------------- scoring-space markings, icons and beacons
  class SpacesView {
    constructor(scene, parking) {
      this.parking = parking; this.items = [];
      for (const st of parking.spaces) {
        const sp = st.sp, g = new THREE.Group();
        g.position.set(sp.x, 0.02, -sp.y); g.rotation.y = sp.a;
        const L = sp.hl * 2, W = sp.hw * 2;
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
        const lines = new THREE.Group();
        for (const [x, z, w, d] of [[0, W / 2, L, 0.14], [0, -W / 2, L, 0.14], [L / 2, 0, 0.14, W], [-L / 2, 0, 0.14, W]]) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); lines.add(m);
        }
        g.add(lines);
        const fillMat = new THREE.MeshBasicMaterial({ map: LS.Tex.hatch('rgba(255,255,255,0.9)'), transparent: true, opacity: 0.5, depthWrite: false });
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.2, W - 0.2), fillMat); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.004;
        fillMat.map = fillMat.map.clone(); fillMat.map.repeat.set(L / 1.2, W / 1.2); fillMat.map.needsUpdate = true;
        g.add(fill);
        // painted label at the lane end
        const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: LS.Tex.textPanel('lab' + sp.label, [{ t: sp.label, font: 'bold 92px Arial', y: 64 }], { w: 512, h: 128, bg: 'rgba(0,0,0,0)', fg: '#ffffff' }), transparent: true, depthWrite: false }));
        lab.rotation.x = -Math.PI / 2; lab.rotation.z = Math.PI / 2; lab.position.set(L / 2 - 0.6, 0.008, 0);
        g.add(lab);
        // beacon (live spaces) - a tall soft column you can see over the rooftops
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beacon.position.y = 13; g.add(beacon);
        const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: LS.Tex.spaceIcon('candidate', sp.label), transparent: true, depthWrite: false }));
        icon.scale.set(2.2, 2.75, 1); icon.position.y = 3.6; icon.renderOrder = 5;
        g.add(icon);
        const owner = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        owner.scale.set(1.6, 1.6, 1); owner.position.y = 6.2; g.add(owner);
        scene.add(g);
        this.items.push({ st, g, lines, lineMat, fill, fillMat, beacon, icon, owner, lab, state: null, ownerKey: null });
      }
    }
    update(t) {
      for (const it of this.items) {
        const st = it.st, s = st.status;
        const parked = st.owner && st.owner.park.parked && st.owner.park.space === st;
        const key = s + (parked ? ':' + st.owner.index : '');
        if (it.state !== key) {
          it.state = key;
          it.g.visible = s !== 'idle';
          if (s === 'candidate') { it.icon.material.map = LS.Tex.spaceIcon('candidate', st.sp.label); it.lineMat.color.set(0xffd400); it.fillMat.map.image = LS.Tex.hatch('rgba(255,212,0,0.8)').image; it.fillMat.opacity = 0.25; it.beacon.visible = false; }
          if (s === 'active') { it.icon.material.map = LS.Tex.spaceIcon('active', st.sp.label); it.lineMat.color.set(0xffffff); it.fillMat.map.image = LS.Tex.hatch('rgba(80,170,255,0.9)').image; it.fillMat.opacity = 0.55; it.beacon.visible = true; }
          if (s === 'suspended') { it.icon.material.map = LS.Tex.spaceIcon('suspended', 'SUSPENDED'); it.lineMat.color.set(0xe8402a); it.fillMat.map.image = LS.Tex.hatch('rgba(232,64,42,0.8)').image; it.fillMat.opacity = 0.35; it.beacon.visible = false; }
          it.icon.material.needsUpdate = true; it.fillMat.map.needsUpdate = true;
          if (parked) {
            const o = st.owner; it.owner.material.map = LS.Tex.badge(o.identity, o.human ? 'P' + (o.player + 1) : String(o.index + 1)); it.owner.material.needsUpdate = true; it.owner.visible = true;
            it.beacon.material.color.set(o.identity.color); it.fillMat.opacity = 0.75;
          } else { it.owner.visible = false; it.beacon.material.color.set(0x6fb8ff); }
        }
        if (s === 'active') { it.beacon.material.opacity = parked ? 0.1 : 0.14 + Math.sin(t * 4) * 0.05; it.icon.position.y = 3.6 + Math.sin(t * 3 + st.sp.id) * 0.15; }
        if (s === 'candidate') it.icon.position.y = 3.4 + Math.sin(t * 2 + st.sp.id) * 0.2;
      }
    }
  }

  LS.World3D = World3D; LS.BinsView = BinsView; LS.SpacesView = SpacesView;
})(window.LS);
