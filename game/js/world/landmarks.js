/* Hand-built landmarks: Clock Tower, Town Hall, Corn Exchange, Cathedral, Abbey Gateway,
   Worley fountain (1897), Baptist church spire, passages (Waxhouse Gate, Christopher arch). */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const L = (SA.Landmarks = {});
  const GB = () => new SA.Buildings.GB();
  const C = (h) => new THREE.Color(h);
  const CELLS = SA.Tex.CELLS;
  const cellOf = (n) => (n && CELLS[n] ? CELLS[n] : [-1, -1]);

  // ------------------------------------------------------------------ kit
  // oriented box walls. faces: {n,e,s,w} cell names or single name; local frame: u along ang, v perpendicular
  function boxWalls(gb, cx, cz, hu, hv, ang, y0, y1, cells, wt, color, base, bayW, floors) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = (u, v) => [cx + u * c - v * s, cz + u * s + v * c];
    const corners = [P(-hu, -hv), P(hu, -hv), P(hu, hv), P(-hu, hv)];
    const faces = [[0, 1, [s, -c]], [1, 2, [c, s]], [2, 3, [-s, c]], [3, 0, [-c, -s]]];
    faces.forEach((f, i) => {
      const a = corners[f[0]], b = corners[f[1]];
      const n = f[2];
      const cellName = Array.isArray(cells) ? cells[i] : cells;
      wallQuad(gb, a, b, n, y0, y1, cellName, wt, color, base, bayW, floors);
    });
    return corners;
  }
  function wallQuad(gb, a, b, n, y0, y1, cellName, wt, color, base, bayW, floors) {
    const right = [n[1], -n[0]];
    let A = a, Bp = b;
    if ((b[0] - a[0]) * right[0] + (b[1] - a[1]) * right[1] < 0) {
      A = b;
      Bp = a;
    }
    const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]);
    const bays = Math.max(1, Math.round(len / (bayW || 3)));
    const fl = floors || 1;
    const cc = cellOf(cellName);
    gb.quad([[A[0], y0, A[1]], [Bp[0], y0, Bp[1]], [Bp[0], y1, Bp[1]], [A[0], y1, A[1]]], [n[0], 0, n[1]],
      [[0, 0], [bays, 0], [bays, fl], [0, fl]], color,
      [[0, y0 - base, wt], [len, y0 - base, wt], [len, y1 - base, wt], [0, y1 - base, wt]], [cc[0], cc[1], 0.4], base);
  }
  function topQuad(gb, corners, y, color, rt, base) {
    // corners in CCW/CW order; ensure upward normal
    const q = corners.map((p) => [p[0], y, p[1]]);
    const e1 = [q[1][0] - q[0][0], q[1][2] - q[0][2]], e2 = [q[3][0] - q[0][0], q[3][2] - q[0][2]];
    const ny = e1[1] * e2[0] - e1[0] * e2[1];
    const qq = ny < 0 ? [q[1], q[0], q[3], q[2]] : q;
    gb.quad(qq, [0, 1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]], color, qq.map((p) => [p[0], p[2], rt]), [-1, -1, 0], base);
  }
  function pyramid(gb, cx, cz, hu, hv, ang, y0, h, color, rt, base) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = (u, v) => [cx + u * c - v * s, y0, cz + u * s + v * c];
    const cs = [P(-hu, -hv), P(hu, -hv), P(hu, hv), P(-hu, hv)];
    const top = [cx, y0 + h, cz];
    for (let i = 0; i < 4; i++) {
      const a = cs[i], b = cs[(i + 1) % 4];
      let t = [a, b, top];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [top[0] - a[0], top[1] - a[1], top[2] - a[2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
      if (ny < 0) {
        t = [b, a, top];
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      const w = Math.hypot(b[0] - a[0], b[2] - a[2]);
      gb.tri(t, [nx / l, ny / l, nz / l], [[0, 0], [0, 0], [0, 0]], color, [[0, 0, rt], [w, 0, rt], [w / 2, h, rt]], [-1, -1, 0], base);
    }
  }
  function cylinder(gb, x, y0, z, r, h, seg, wt, color, base, capColor, coneH, rt) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
      const am = (a0 + a1) / 2;
      wallQuad(gb.walls || gb, p0, p1, [Math.cos(am), Math.sin(am)], y0, y0 + h, 'blank', wt, color, base, 3, 1);
    }
    if (coneH && gb.roofs) {
      const top = [x, y0 + h + coneH, z];
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const p0 = [x + Math.cos(a0) * r * 1.08, y0 + h, z + Math.sin(a0) * r * 1.08], p1 = [x + Math.cos(a1) * r * 1.08, y0 + h, z + Math.sin(a1) * r * 1.08];
        const am = (a0 + a1) / 2;
        const ny = r / Math.hypot(r, coneH);
        gb.roofs.tri([p1, p0, top], [Math.cos(am) * 0.8, ny, Math.sin(am) * 0.8], [[0, 0], [0, 0], [0, 0]], capColor, [[0, 0, rt], [1, 0, rt], [0.5, coneH, rt]], [-1, -1, 0], base);
      }
    }
  }
  // generic solid box (all faces, vertex-coloured, wave aware) for small details; uses facade 'blank'
  function solidBox(gb, cx, y0, cz, sx, sy, sz, ang, color, wt, base) {
    const corners = boxWalls(gb, cx, cz, sx / 2, sz / 2, ang, y0, y0 + sy, 'blank', wt === undefined ? 7 : wt, color, base, 3, 1);
    topQuad(gb, corners, y0 + sy, color, wt === undefined ? 7 : wt, base);
  }
  L.kit = { boxWalls, wallQuad, topQuad, pyramid, cylinder, solidBox };

  function findB(id) {
    return SA.World.rawBuildings.find((b) => b.id === id);
  }
  function meshes(group, gw, gr, mats, name) {
    if (L._gw) {
      // merged into the era's shared landmark buffers (2 draw calls for all landmarks)
      L._gw.append(gw);
      L._gr.append(gr);
      return;
    }
    const w = gw.build();
    if (w) {
      const m = new THREE.Mesh(w, mats.facade);
      m.name = name + '-walls';
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
    const r = gr.build();
    if (r) {
      const m = new THREE.Mesh(r, mats.roof);
      m.name = name + '-roofs';
      m.castShadow = true;
      group.add(m);
    }
  }

  // ------------------------------------------------------------------ Clock Tower
  L.clockTower = function (eraId, group, col, atlas, flags, mats) {
    const b = findB(SA.World.ID.clockTower);
    const o = U.obb(b.p);
    const cx = o.cx, cz = o.cz, ang = o.ang;
    const base = SA.Terrain.height(cx, cz);
    L.clockTowerInfo = { x: cx, z: cz, ang, base, hu: o.len / 2, hv: o.wid / 2 };
    const gw = GB(), gr = GB();
    const flint = C(eraId === 1897 ? '#7d7a72' : '#86837b');
    const stone = C('#d8ceb6');
    const hu0 = o.len / 2, hv0 = o.wid / 2;
    // five stages, each narrowing; string courses between
    const stages = [
      { h: 4.2, inset: 0, cell: 'arched' },
      { h: 3.6, inset: 0.18, cell: 'lancet' },
      { h: 3.6, inset: 0.32, cell: 'smallsq' },
      { h: 3.6, inset: 0.44, cell: 'towerWin' },
      { h: 3.2, inset: 0.54, cell: 'towerWin' },
    ];
    let y = base - 1;
    const bayW = o.len;
    stages.forEach((st, i) => {
      const hu = hu0 - st.inset, hv = hv0 - st.inset;
      const y0 = i === 0 ? base - 1 : y, y1 = (i === 0 ? base : y) + st.h;
      boxWalls(gw, cx, cz, hu, hv, ang, y0, y1, st.cell, 2, flint, base, bayW, 1);
      // quoins: stone strips at the corners
      const c = Math.cos(ang), s = Math.sin(ang);
      for (const [u, v] of [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]]) {
        const px = cx + u * c - v * s, pz = cz + u * s + v * c;
        solidBox(gw, px, y0, pz, 0.42, y1 - y0, 0.42, ang, stone, 5, base);
      }
      // string course
      if (i < stages.length) {
        boxWalls(gw, cx, cz, hu + 0.12, hv + 0.12, ang, y1 - 0.2, y1, 'blank', 5, stone, base, 3, 1);
        topQuad(gw, [[cx + (-hu - 0.12) * c - (-hv - 0.12) * s, cz + (-hu - 0.12) * s + (-hv - 0.12) * c], [cx + (hu + 0.12) * c - (-hv - 0.12) * s, cz + (hu + 0.12) * s + (-hv - 0.12) * c], [cx + (hu + 0.12) * c - (hv + 0.12) * s, cz + (hu + 0.12) * s + (hv + 0.12) * c], [cx + (-hu - 0.12) * c - (hv + 0.12) * s, cz + (-hu - 0.12) * s + (hv + 0.12) * c]], y1, stone, 5, base);
      }
      y = y1;
    });
    const topY = y;
    // battlemented parapet
    const hu = hu0 - 0.54, hv = hv0 - 0.54;
    boxWalls(gw, cx, cz, hu, hv, ang, topY, topY + 0.7, 'blank', 5, stone, base, 3, 1);
    const c = Math.cos(ang), s = Math.sin(ang);
    const merlon = (u, v) => solidBox(gw, cx + u * c - v * s, topY + 0.7, cz + u * s + v * c, 0.55, 0.6, 0.55, ang, stone, 5, base);
    for (let k = -2; k <= 2; k++) {
      merlon((k * hu) / 2.2, -hv);
      merlon((k * hu) / 2.2, hv);
      merlon(-hu, (k * hv) / 2.2);
      merlon(hu, (k * hv) / 2.2);
    }
    // roof deck
    topQuad(gr, [[cx + -hu * c - -hv * s, cz + -hu * s + -hv * c], [cx + hu * c - -hv * s, cz + hu * s + -hv * c], [cx + hu * c - hv * s, cz + hu * s + hv * c], [cx + -hu * c - hv * s, cz + -hu * s + hv * c]], topY + 0.05, C('#6b6964'), 3, base);
    // stair turret at one corner, with conical cap and weathervane (Scott, 1866)
    const tu = hu - 0.6, tv = -hv + 0.6;
    const tx = cx + tu * c - tv * s, tz = cz + tu * s + tv * c;
    cylinder({ walls: gw, roofs: gr }, tx, topY - 3, tz, 1.05, 5.0, 8, 2, flint, base, C('#5a5f62'), 2.6, 3);
    L.clockTowerTop = topY;
    L.weathervane = [tx, topY + 2 + 2.6 + 0.4, tz];
    // clock face on the south face (3rd stage): disc on the side facing south (+z)
    const faces = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([u, v]) => [u * c - v * s, u * s + v * c]);
    let south = faces[0], si = 0;
    faces.forEach((f, i) => {
      if (f[1] > south[1]) {
        south = f;
        si = i;
      }
    });
    const halfDepth = si % 2 === 0 ? hv0 - 0.32 : hu0 - 0.32;
    const clockY = base + 4.2 + 3.6 + 1.9;
    L.clockFace = { x: cx + south[0] * (halfDepth + 0.06), y: clockY, z: cz + south[1] * (halfDepth + 0.06), nx: south[0], nz: south[1] };
    meshes(group, gw, gr, mats, 'clocktower');
    // clock face mesh (dial + hands), updated per frame by the game for the era time
    const dial = new THREE.Group();
    const r = eraId === 1897 ? 0.95 : 1.15;
    const faceMat = new THREE.MeshLambertMaterial({ color: eraId === 1897 ? 0x1c1c1c : 0x2f5c4c, emissive: eraId === 1897 ? 0x000000 : 0x000000 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 32), faceMat);
    dial.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.86, r, 32), new THREE.MeshLambertMaterial({ color: 0xd6b25a }));
    ring.position.z = 0.01;
    dial.add(ring);
    const ticks = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tg = new THREE.PlaneGeometry(0.06, 0.18);
      tg.rotateZ(-a);
      tg.translate(Math.sin(a) * r * 0.72, Math.cos(a) * r * 0.72, 0.012);
      ticks.push(tg);
    }
    dial.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeGeometries(ticks), new THREE.MeshLambertMaterial({ color: 0xe8cf7a })));
    const handMat = new THREE.MeshLambertMaterial({ color: 0xe8cf7a });
    const hourHand = new THREE.Mesh(new THREE.PlaneGeometry(0.09, r * 0.5), handMat);
    hourHand.geometry.translate(0, r * 0.22, 0);
    hourHand.position.z = 0.02;
    const minHand = new THREE.Mesh(new THREE.PlaneGeometry(0.06, r * 0.75), handMat);
    minHand.geometry.translate(0, r * 0.35, 0);
    minHand.position.z = 0.025;
    dial.add(hourHand, minHand);
    dial.position.set(L.clockFace.x, L.clockFace.y, L.clockFace.z);
    dial.lookAt(L.clockFace.x + south[0], L.clockFace.y, L.clockFace.z + south[1]);
    dial.name = 'clockdial';
    dial.userData = { hourHand, minHand };
    group.add(dial);
    // collider
    col.addPoly(b.p, { y0: base - 2, y1: topY + 6, tag: 'clocktower' });
    // 1897: saddler's shop at the base: hanging sign and harnesses; railings around the base (1866)
    if (eraId === 1897) {
      const sg = atlas.text('W. Ashby · Saddler & Harness Maker', { bg: '#2b2016', fg: '#e8d39a', gilt: true, border: 'rgba(217,180,90,0.6)' }, 512, 64);
      L.addSignQuad(group, mats, cx + south[0] * (halfDepth + 0.45), base + 3.3, cz + south[1] * (halfDepth + 0.45), south, 4.6, 0.6, sg);
    }
    return { topY };
  };

  // Adds a free-standing sign quad (in the era group) using the era sign material
  L.addSignQuad = function (group, mats, x, y, z, n, w, h, uv, name, opts) {
    if (!uv) return null;
    if (L._signGB && !(opts && opts.alpha)) {
      // merged into the era's sign mesh (wave-aware material)
      const nx = n[0], nz = n[1];
      const rx = nz, rz = -nx; // right vector seen from the front
      const hw = w / 2, hh = h / 2;
      const base = SA.Terrain.height(x, z);
      const white = new THREE.Color(1, 1, 1);
      L._signGB.quad([[x - rx * hw, y - hh, z - rz * hw], [x + rx * hw, y - hh, z + rz * hw], [x + rx * hw, y + hh, z + rz * hw], [x - rx * hw, y + hh, z - rz * hw]], [nx, 0, nz],
        [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]], white, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], [0, 0, 0], base);
      return { position: new THREE.Vector3(x, y, z), userData: {}, merged: true };
    }
    const g = new THREE.PlaneGeometry(w, h);
    const a = g.attributes.uv;
    a.setXY(0, uv[0], uv[3]);
    a.setXY(1, uv[2], uv[3]);
    a.setXY(2, uv[0], uv[1]);
    a.setXY(3, uv[2], uv[1]);
    const m = new THREE.Mesh(g, mats.signPlain);
    m.position.set(x, y, z);
    m.lookAt(x + n[0], y, z + n[1]);
    m.name = name || 'sign';
    m.userData.waveCPU = true;
    group.add(m);
    return m;
  };

  // ------------------------------------------------------------------ Town Hall (1826-31, George Smith)
  L.townHall = function (eraId, group, col, atlas, flags, mats) {
    const b = findB(SA.World.ID.townHall);
    const pts = b.p;
    let base = Infinity;
    for (const p of pts) base = Math.min(base, SA.Terrain.height(p[0], p[1]));
    // find the north-facing edge (portico) — outward normal with most negative z
    let best = -1, bz = 1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 6) continue;
      const n = SA.Buildings.outwardNormal(pts, i);
      if (n[1] < bz) {
        bz = n[1];
        best = i;
      }
    }
    const fa = pts[best], fb = pts[(best + 1) % pts.length];
    const fn = SA.Buildings.outwardNormal(pts, best);
    const floor = SA.Terrain.height((fa[0] + fb[0]) / 2 + fn[0] * 3, (fa[1] + fb[1]) / 2 + fn[1] * 3) + 0.6;
    const spec = {
      key: 'townhall', id: b.id, pts, seed: 4242, tag: 'townhall', fronts: [], party: {}, storeys: 2, gh: 6.2, sh: 6.0, extra: 1.4, bayW: 3.6, jetty: 0,
      wall: { type: 1, color: eraId === 1897 ? '#e2d8c2' : '#eee9dc' }, roof: { type: 'band', mat: 1, color: '#55595f', pitch: 22 },
      upper: 'sash6', ground: 'sash6', signs: [], chimneys: 0, cornice: true, corniceColor: '#f4f0e6', sideWindows: true, sideUpper: 'sash6', base, floor, lit: 0.7,
    };
    // every edge is a front for a civic building
    for (let i = 0; i < pts.length; i++) spec.fronts.push(i);
    const ctx = { chunks: new Map(), col, chimneys: [], signGB: null };
    SA.Buildings.addBuilding(ctx, spec);
    for (const ch of ctx.chunks.values()) meshes(group, ch.walls, ch.roofs, mats, 'townhall');
    // portico: podium, steps, four Ionic columns, entablature, pediment
    const gw = GB(), gr = GB();
    const mx = (fa[0] + fb[0]) / 2, mz = (fa[1] + fb[1]) / 2;
    const ang = Math.atan2(fb[1] - fa[1], fb[0] - fa[0]);
    // the OSM outline already includes the projecting portico front (about 7 m), so span most of it
    const pw = Math.min(13, Math.hypot(fb[0] - fa[0], fb[1] - fa[1]) * 0.95), pd = 3.4;
    const pc = [mx + fn[0] * (pd / 2), mz + fn[1] * (pd / 2)];
    const white = C(eraId === 1897 ? '#e6dcc6' : '#f2eee4');
    solidBox(gw, pc[0], base - 0.5, pc[1], pw + 0.6, floor - base + 0.5, pd, ang, white, 5, base);
    // steps
    for (let k = 0; k < 3; k++) {
      const off = pd / 2 + 0.35 + k * 0.35;
      solidBox(gw, mx + fn[0] * off + fn[0] * pd / 2 - fn[0] * pd / 2, base - 0.5, mz + fn[1] * off, pw + 0.6, floor - base + 0.5 - (k + 1) * ((floor - base + 0.5) / 4), 0.36, ang, C('#cfc8b8'), 5, base);
    }
    const colH = 9.0;
    for (let k = 0; k < 4; k++) {
      const t = -1 + (2 * k) / 3;
      const px = pc[0] + Math.cos(ang) * t * (pw / 2 - 0.7) + fn[0] * (pd / 2 - 0.55), pz = pc[1] + Math.sin(ang) * t * (pw / 2 - 0.7) + fn[1] * (pd / 2 - 0.55);
      cylinder({ walls: gw, roofs: gr }, px, floor, pz, 0.42, colH, 10, 5, white, base, white, 0, 3);
      solidBox(gw, px, floor + colH, pz, 1.1, 0.35, 1.1, ang, white, 5, base); // Ionic capital (simplified)
      col.addCircle(px, pz, 0.45, { y1: floor + colH, cam: false });
    }
    // entablature
    solidBox(gw, pc[0], floor + colH + 0.35, pc[1], pw + 0.4, 1.3, pd + 0.2, ang, white, 5, base);
    // pediment (triangular prism)
    const py0 = floor + colH + 1.65, ph = 2.2;
    const c = Math.cos(ang), s = Math.sin(ang);
    const front = [pc[0] + fn[0] * (pd / 2 + 0.1), pc[1] + fn[1] * (pd / 2 + 0.1)];
    const back = [pc[0] - fn[0] * (pd / 2 + 0.1), pc[1] - fn[1] * (pd / 2 + 0.1)];
    const half = pw / 2 + 0.2;
    const tri = (o) => [[o[0] - c * half, py0, o[1] - s * half], [o[0] + c * half, py0, o[1] + s * half], [o[0], py0 + ph, o[1]]];
    const tf = tri(front);
    SA.Landmarks._triFace(gw, tf, [fn[0], 0, fn[1]], white, base);
    // pediment roof slopes
    const tb = tri(back);
    const roofC = C('#56595e');
    gr.quad([tf[0], tb[0], tb[2], tf[2]].map((p) => p), [-c * 0.5, 0.85, -s * 0.5], [[0, 0], [0, 0], [0, 0], [0, 0]], roofC, [[0, 0, 1], [3, 0, 1], [3, 3, 1], [0, 3, 1]], [-1, -1, 0], base);
    gr.quad([tb[1], tf[1], tf[2], tb[2]], [c * 0.5, 0.85, s * 0.5], [[0, 0], [0, 0], [0, 0], [0, 0]], roofC, [[0, 0, 1], [3, 0, 1], [3, 3, 1], [0, 3, 1]], [-1, -1, 0], base);
    meshes(group, gw, gr, mats, 'portico');
    col.addPoly(pts, { y0: base - 2, y1: floor + 20, tag: 'townhall' });
    // podium collider (steps walkable up to the columns)
    L.townHallInfo = { x: mx + fn[0] * 6, z: mz + fn[1] * 6, nx: fn[0], nz: fn[1], floor, base, door: [mx + fn[0] * 0.3, mz + fn[1] * 0.3] };
    // era details on the pediment / frieze
    let txt = null, style = null;
    if (eraId === 1897) {
      txt = 'V R  1837 · 1897';
      style = { bg: '#2a1c10', fg: '#ffd27a', gilt: true, font: 'Georgia, serif' };
    } else if (eraId === 1964) {
      txt = 'City of St Albans · Town Hall';
      style = { bg: '#efe9dc', fg: '#2a2a2a', font: 'Georgia, serif' };
    } else {
      txt = 'St Albans Museum + Gallery';
      style = { bg: '#efe9dc', fg: '#1f2a2e', font: '"Helvetica Neue", Arial, sans-serif', weight: '600' };
    }
    const uv = atlas.text(txt, style, 512, 64);
    L.addSignQuad(group, mats, pc[0] + fn[0] * (pd / 2 + 0.12), floor + colH + 1.0, pc[1] + fn[1] * (pd / 2 + 0.12), fn, pw * 0.8, 0.9, uv, 'townhall-frieze');
    if (eraId === 1897) {
      // gas illumination star (emissive)
      const star = new THREE.Mesh(new THREE.CircleGeometry(0.9, 5), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
      star.position.set(pc[0] + fn[0] * (pd / 2 + 0.15), py0 + 1.0, pc[1] + fn[1] * (pd / 2 + 0.15));
      star.lookAt(star.position.x + fn[0], star.position.y, star.position.z + fn[1]);
      star.rotation.z += Math.PI / 2;
      group.add(star);
    }
    // 2026: museum banners on the columns
    return L.townHallInfo;
  };
  L._triFace = function (gb, t, n, color, base) {
    // ensure CCW w.r.t. normal
    const e1 = [t[1][0] - t[0][0], t[1][1] - t[0][1], t[1][2] - t[0][2]], e2 = [t[2][0] - t[0][0], t[2][1] - t[0][1], t[2][2] - t[0][2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cz = e1[0] * e2[1] - e1[1] * e2[0];
    let tt = t;
    if (cx * n[0] + cz * n[2] < 0) tt = [t[1], t[0], t[2]];
    gb.tri(tt, n, [[0, 0], [0, 0], [0, 0]], color, [[0, 0, 1], [3, 0, 1], [1.5, 2, 1]], [-1, -1, 0], base);
  };

  // ------------------------------------------------------------------ Corn Exchange (1857)
  L.cornExchange = function (eraId, group, col, atlas, flags, mats) {
    const a = findB(SA.World.ID.cornA), b = findB(SA.World.ID.cornB);
    if (!a || !b) return;
    // union approximated by the OBB of both footprints
    const pts = a.p.concat(b.p);
    const o = U.obb(pts);
    const c = Math.cos(o.ang), s = Math.sin(o.ang);
    const P = (u, v) => [o.cx + u * c - v * s, o.cz + u * s + v * c];
    const poly = [P(-o.len / 2, -o.wid / 2), P(o.len / 2, -o.wid / 2), P(o.len / 2, o.wid / 2), P(-o.len / 2, o.wid / 2)];
    let base = Infinity;
    for (const p of poly) base = Math.min(base, SA.Terrain.height(p[0], p[1]));
    // front = edge facing Market Place (west-ish, toward the Clock Tower side)
    let best = 0, bd = Infinity;
    for (let i = 0; i < 4; i++) {
      const m = [(poly[i][0] + poly[(i + 1) % 4][0]) / 2, (poly[i][1] + poly[(i + 1) % 4][1]) / 2];
      const nr = SA.World.nearestRoad(m[0], m[1], (r) => r.n === 'Market Place', 30);
      if (nr && nr.d < bd) {
        bd = nr.d;
        best = i;
      }
    }
    const fa = poly[best], fb = poly[(best + 1) % 4];
    const fn = SA.Buildings.outwardNormal(poly, best);
    const floor = SA.Terrain.height((fa[0] + fb[0]) / 2 + fn[0] * 2, (fa[1] + fb[1]) / 2 + fn[1] * 2) + 0.1;
    const lit = eraId === 1897 && flags && flags.fund_outcome === 'dinner' ? 1.0 : 0.5;
    const spec = {
      key: 'corn', id: 777, pts: poly, seed: 1857, tag: 'cornexchange', fronts: [best], party: {}, storeys: 1, gh: 6.5, sh: 3, extra: 1.0, bayW: 3.4,
      wall: { type: 3, color: '#d6c7a1' }, roof: { type: 'band', mat: 1, color: '#50545a', pitch: 25 },
      ground: eraId === 2026 ? 'shopModB' : 'bank', upper: 'blank', signs: [], chimneys: 0, cornice: true, corniceColor: '#efe8d8', sideWindows: false, base, floor, lit,
    };
    const ctx = { chunks: new Map(), col, chimneys: [], signGB: null };
    SA.Buildings.addBuilding(ctx, spec);
    for (const ch of ctx.chunks.values()) meshes(group, ch.walls, ch.roofs, mats, 'corn');
    // pediment over the centre
    const gw = GB();
    const mx = (fa[0] + fb[0]) / 2 + fn[0] * 0.15, mz = (fa[1] + fb[1]) / 2 + fn[1] * 0.15;
    const ang = Math.atan2(fb[1] - fa[1], fb[0] - fa[0]);
    const cc = Math.cos(ang), ss = Math.sin(ang);
    const y0 = floor + 7.5, hw = 4.5;
    SA.Landmarks._triFace(gw, [[mx - cc * hw, y0, mz - ss * hw], [mx + cc * hw, y0, mz + ss * hw], [mx, y0 + 2.0, mz]], [fn[0], 0, fn[1]], C('#efe8d8'), base);
    meshes(group, gw, GB(), mats, 'corn-ped');
    const label = eraId === 2026 ? 'Corn Exchange 1857' : 'Corn Exchange';
    const uv = atlas.text(label, { bg: '#efe8d8', fg: '#3a3226', font: 'Georgia, serif' }, 384, 48);
    L.addSignQuad(group, mats, mx + fn[0] * 0.05, floor + 6.95, mz + fn[1] * 0.05, fn, 5.2, 0.62, uv, 'corn-sign');
    L.cornInfo = { x: mx + fn[0] * 3, z: mz + fn[1] * 3, door: [mx + fn[0] * 0.5, mz + fn[1] * 0.5], nx: fn[0], nz: fn[1], floor };
    col.addPoly(poly, { y0: base - 2, y1: floor + 12, tag: 'cornexchange' });
  };

  // ------------------------------------------------------------------ Cathedral from OSM building:parts
  // Massing: the full outline as the aisles (12 m), then nave/presbytery/transept clerestories with steep
  // lead roofs (Grimthorpe), the Norman crossing tower in Roman brick, west turrets, porches and west window.
  L.cathedral = function (eraId, group, col, atlas, flags, mats) {
    const main = findB(SA.World.ID.cathedral);
    const parts = SA.World.rawBuildings.filter((b) => b.part && b.h && U.pointInPoly(b.cen[0], b.cen[1], main.p));
    const gw = GB(), gr = GB();
    let g0 = Infinity;
    for (const p of main.p) g0 = Math.min(g0, SA.Terrain.height(p[0], p[1]));
    const AISLE = 12;
    const flint = C('#a0968a'), brick = C('#ad6a4c'), stone = C('#d3cab6'), lead = C('#6d7175');
    const addGen = (spec) => {
      const c2 = { chunks: new Map(), col: null, chimneys: [], signGB: null };
      SA.Buildings.addBuilding(c2, spec);
      for (const ch of c2.chunks.values()) meshes(group, ch.walls, ch.roofs, mats, 'cathedral');
    };
    // aisles / base mass
    const fr = [];
    for (let i = 0; i < main.p.length; i++) fr.push(i);
    addGen({
      key: 'cathedral', id: main.id, pts: main.p, seed: 793, tag: 'cathedral', fronts: fr, party: {}, storeys: 2, gh: 6.0, sh: 6.0, extra: 0, bayW: 4.4,
      wall: { type: 2, color: '#a39886' }, roof: { type: 'flat', mat: 3, color: '#6d7175', flatColor: '#70747a' }, parapet: true, parapetH: 0.9,
      ground: 'lancet', upper: 'lancet', signs: [], chimneys: 0, sideWindows: true, sideUpper: 'lancet', base: g0, floor: g0 + 0.2, lit: 0.4,
    });
    // clerestory parts (raised, no plinth so they never overlap the aisle walls)
    const clerestory = (pts, h, key) => {
      const o = U.obb(pts);
      const wallTop = h - Math.min(o.wid, o.len) * 0.5 * Math.tan((52 * Math.PI) / 180);
      const fl = g0 + AISLE - 0.1;
      const all = [];
      for (let i = 0; i < pts.length; i++) all.push(i);
      addGen({
        key, id: 1, pts, seed: 31 + key.length, tag: 'cathedral', fronts: all, party: {}, storeys: 1, gh: Math.max(3, g0 + wallTop - fl), sh: 3, extra: 0, bayW: 4.4,
        wall: { type: 2, color: '#a89d8f' }, roof: { type: 'gable', mat: 3, color: '#6b6f74', pitch: 52, ridge: 'long' },
        ground: 'lancet', upper: 'blank', signs: [], sideWindows: true, base: fl - 0.1, floor: fl, noPlinth: true, lit: 0.3,
      });
    };
    for (const p of parts) {
      if (p.roof === 'gabled' && p.h >= 20) clerestory(p.p, p.h, 'cp' + p.id);
    }
    // synthetic transept from the four transept turrets
    const tur = parts.filter((p) => p.h === 34 && p.roof === 'pyramidal').map((p) => p.cen);
    if (tur.length === 4) {
      // order around centroid
      const cx = tur.reduce((a, p) => a + p[0], 0) / 4, cz = tur.reduce((a, p) => a + p[1], 0) / 4;
      tur.sort((a, b) => Math.atan2(a[1] - cz, a[0] - cx) - Math.atan2(b[1] - cz, b[0] - cx));
      clerestory(tur, 28, 'transept');
    }
    // tower, turrets
    for (const p of parts) {
      const o = U.obb(p.p);
      const hu = o.len / 2, hv = o.wid / 2;
      const c = Math.cos(o.ang), s = Math.sin(o.ang);
      if (p.h >= 40 && p.roof !== 'pyramidal') {
        // Norman crossing tower (Roman brick)
        boxWalls(gw, o.cx, o.cz, hu, hv, o.ang, g0 + AISLE - 0.2, g0 + p.h, ['towerWin', 'towerWin', 'towerWin', 'towerWin'], 0, brick, g0, 3.6, 4);
        topQuad(gr, [[o.cx - hu * c + hv * s, o.cz - hu * s - hv * c], [o.cx + hu * c + hv * s, o.cz + hu * s - hv * c], [o.cx + hu * c - hv * s, o.cz + hu * s + hv * c], [o.cx - hu * c - hv * s, o.cz - hu * s + hv * c]], g0 + p.h, lead, 3, g0);
        for (let k = -3; k <= 3; k++) {
          for (const [u, v] of [[(k * hu) / 3.3, -hv], [(k * hu) / 3.3, hv], [-hu, (k * hv) / 3.3], [hu, (k * hv) / 3.3]]) {
            solidBox(gw, o.cx + u * c - v * s, g0 + p.h, o.cz + u * s + v * c, 0.9, 1.0, 0.9, o.ang, brick, 0, g0);
          }
        }
        // corner turrets of the tower
        for (const [u, v] of [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]]) solidBox(gw, o.cx + u * c - v * s, g0 + p.h - 4, o.cz + u * s + v * c, 1.6, 6.2, 1.6, o.ang, brick, 0, g0);
        L.cathedralTower = { x: o.cx, z: o.cz, top: g0 + p.h };
      } else if (p.roof === 'pyramidal' && o.len < 5) {
        // small round west turrets
        cylinder({ walls: gw, roofs: gr }, o.cx, g0 - 0.5, o.cz, Math.max(1.0, hu), p.h - 5, 8, 5, stone, g0, lead, 5, 3);
      } else if (p.roof === 'pyramidal' && p.h === 34) {
        boxWalls(gw, o.cx, o.cz, hu, hv, o.ang, g0 + AISLE - 0.2, g0 + p.h - 3.5, 'blank', 2, flint, g0, 3, 1);
        pyramid(gr, o.cx, o.cz, hu + 0.1, hv + 0.1, o.ang, g0 + p.h - 3.5, 3.5, lead, 3, g0);
      }
    }
    meshes(group, gw, gr, mats, 'cathedral-tower');
    col.addPoly(main.p, { y0: g0 - 2, y1: g0 + 46, tag: 'cathedral' });
    // West front: outline edge with smallest x midpoint
    let wi = 0, wx = Infinity;
    for (let i = 0; i < main.p.length; i++) {
      const a = main.p[i], b = main.p[(i + 1) % main.p.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mx = (a[0] + b[0]) / 2;
      if (len > 12 && mx < wx) {
        wx = mx;
        wi = i;
      }
    }
    const wa = main.p[wi], wb = main.p[(wi + 1) % main.p.length];
    const wn = SA.Buildings.outwardNormal(main.p, wi);
    const wm = [(wa[0] + wb[0]) / 2, (wa[1] + wb[1]) / 2];
    const wlen = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
    const td = [(wb[0] - wa[0]) / wlen, (wb[1] - wa[1]) / wlen];
    L.westFront = { x: wm[0] + wn[0] * 14, z: wm[1] + wn[1] * 14, nx: wn[0], nz: wn[1] };
    // Victorian west front (Grimthorpe): pale stone screen over the base mass, gable, great window
    const fx = wm[0] + wn[0] * 0.25, fz = wm[1] + wn[1] * 0.25;
    const gws = GB();
    wallQuad(gws, [fx - td[0] * wlen * 0.5, fz - td[1] * wlen * 0.5], [fx + td[0] * wlen * 0.5, fz + td[1] * wlen * 0.5], wn, g0 - 1, g0 + 22, 'blank', 5, stone, g0, 3, 1);
    SA.Landmarks._triFace(gws, [[fx - td[0] * 6.5, g0 + 22, fz - td[1] * 6.5], [fx + td[0] * 6.5, g0 + 22, fz + td[1] * 6.5], [fx, g0 + 29, fz]], [wn[0], 0, wn[1]], stone, g0);
    meshes(group, gws, GB(), mats, 'westfront');
    const uv = atlas.square((ctx2, w, h) => {
      ctx2.fillStyle = '#d3cab6';
      ctx2.fillRect(0, 0, w, h);
      ctx2.fillStyle = '#2a3046';
      ctx2.beginPath();
      ctx2.moveTo(w * 0.16, h * 0.97);
      ctx2.lineTo(w * 0.16, h * 0.42);
      ctx2.quadraticCurveTo(w * 0.5, h * -0.02, w * 0.84, h * 0.42);
      ctx2.lineTo(w * 0.84, h * 0.97);
      ctx2.closePath();
      ctx2.fill();
      ctx2.strokeStyle = '#d3cab6';
      ctx2.lineWidth = w * 0.022;
      for (let i = 1; i < 6; i++) {
        ctx2.beginPath();
        ctx2.moveTo(w * (0.16 + i * 0.113), h * 0.97);
        ctx2.lineTo(w * (0.16 + i * 0.113), h * 0.4);
        ctx2.stroke();
      }
      ctx2.beginPath();
      ctx2.moveTo(w * 0.16, h * 0.64);
      ctx2.lineTo(w * 0.84, h * 0.64);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.arc(w * 0.5, h * 0.38, w * 0.15, 0, Math.PI * 2);
      ctx2.stroke();
    }, 256, 256);
    const ww = L.addSignQuad(group, mats, fx + wn[0] * 0.05, g0 + 15.5, fz + wn[1] * 0.05, wn, 9.5, 12, uv, 'westwindow');
    if (ww) ww.userData.waveCPU = true;
    // three porches (central larger)
    const doorUv = atlas.square((c2, w, h) => {
      c2.fillStyle = '#d3cab6';
      c2.fillRect(0, 0, w, h);
      c2.fillStyle = '#1d1712';
      c2.beginPath();
      c2.moveTo(w * 0.2, h);
      c2.lineTo(w * 0.2, h * 0.45);
      c2.quadraticCurveTo(w * 0.5, h * 0.02, w * 0.8, h * 0.45);
      c2.lineTo(w * 0.8, h);
      c2.fill();
      c2.strokeStyle = '#b9ae98';
      c2.lineWidth = 4;
      c2.stroke();
    }, 128, 128);
    for (const k of [-1, 0, 1]) {
      const big = k === 0;
      const pw2 = big ? 5.2 : 3.6, ph2 = big ? 8.5 : 6.5, pd2 = 3.0;
      const off = k * (wlen * 0.33);
      const px = fx + td[0] * off + wn[0] * (pd2 / 2), pz = fz + td[1] * off + wn[1] * (pd2 / 2);
      const pang = Math.atan2(td[1], td[0]);
      const g2 = GB();
      solidBox(g2, px, g0 - 0.5, pz, pw2, ph2, pd2, pang, stone, 5, g0);
      SA.Landmarks._triFace(g2, [[px + wn[0] * (pd2 / 2) - td[0] * pw2 / 2, g0 - 0.5 + ph2, pz + wn[1] * (pd2 / 2) - td[1] * pw2 / 2], [px + wn[0] * (pd2 / 2) + td[0] * pw2 / 2, g0 - 0.5 + ph2, pz + wn[1] * (pd2 / 2) + td[1] * pw2 / 2], [px + wn[0] * (pd2 / 2), g0 + ph2 + 2.2, pz + wn[1] * (pd2 / 2)]], [wn[0], 0, wn[1]], stone, g0);
      meshes(group, g2, GB(), mats, 'porch');
      const dq = L.addSignQuad(group, mats, px + wn[0] * (pd2 / 2 + 0.03), g0 + (big ? 3.4 : 2.7), pz + wn[1] * (pd2 / 2 + 0.03), wn, pw2 * 0.7, big ? 6.4 : 5.0, doorUv, 'porchdoor');
      if (dq) dq.userData.waveCPU = true;
      col.addBox(px, pz, pw2 / 2, pd2 / 2, pang, { y0: g0 - 1, y1: g0 + ph2 + 2, tag: 'cathedral' });
    }
    L.westDoor = { x: fx + wn[0] * 3.6, z: fz + wn[1] * 3.6 };
  };

  // ------------------------------------------------------------------ Abbey Gateway (1365) with passage
  L.gateway = function (eraId, group, col, atlas, flags, mats) {
    const b = findB(SA.World.ID.gateway);
    const o = U.obb(b.p);
    let base = Infinity;
    for (const p of b.p) base = Math.min(base, SA.Terrain.height(p[0], p[1]));
    // passage axis: Abbey Mill Lane direction through the gateway
    const lane = SA.World.nearestRoad(o.cx, o.cz, (r) => r.n === 'Abbey Mill Lane', 20);
    let pdx = 0, pdz = 1;
    if (lane) {
      pdx = lane.b[0] - lane.a[0];
      pdz = lane.b[1] - lane.a[1];
      const l = Math.hypot(pdx, pdz);
      pdx /= l;
      pdz /= l;
    }
    // choose OBB axis closest to the lane direction as the passage axis
    const c = Math.cos(o.ang), s = Math.sin(o.ang);
    const alongU = Math.abs(c * pdx + s * pdz) > Math.abs(-s * pdx + c * pdz);
    const hu = o.len / 2, hv = o.wid / 2;
    // split into two side blocks either side of a 4.4 m passage
    const pw = 2.2;
    const gw = GB(), gr = GB();
    const flint = C('#8f8a80'), stone = C('#d2c8b2');
    const blocks = alongU ? [[-hv, -pw], [pw, hv]] : [[-hu, -pw], [pw, hu]];
    const H = 13.5;
    for (const [a0, a1] of blocks) {
      const mid = (a0 + a1) / 2, half = (a1 - a0) / 2;
      let bx, bz, bu, bvv;
      if (alongU) {
        bx = o.cx + -mid * s;
        bz = o.cz + mid * c;
        bu = hu;
        bvv = half;
      } else {
        bx = o.cx + mid * c;
        bz = o.cz + mid * s;
        bu = half;
        bvv = hv;
      }
      boxWalls(gw, bx, bz, bu, bvv, o.ang, base - 1, base + H, ['casement', 'arched', 'casement', 'arched'], 2, flint, base, 3.2, 3);
      const cs = [[bx - bu * c + bvv * s, bz - bu * s - bvv * c], [bx + bu * c + bvv * s, bz + bu * s - bvv * c], [bx + bu * c - bvv * s, bz + bu * s + bvv * c], [bx - bu * c - bvv * s, bz - bu * s + bvv * c]];
      topQuad(gr, cs, base + H, C('#6a6a66'), 3, base);
      const poly = cs.map((p) => [p[0], p[1]]);
      col.addPoly(poly, { y0: base - 2, y1: base + H + 2, tag: 'gateway' });
      // battlements
      for (let k = -2; k <= 2; k++) {
        for (const [u, v] of [[(k * bu) / 2.3, -bvv], [(k * bu) / 2.3, bvv]]) solidBox(gw, bx + u * c - v * s, base + H, bz + u * s + v * c, 0.7, 0.8, 0.7, o.ang, stone, 5, base);
      }
    }
    // bridge over the passage (from 4.6 m up)
    if (alongU) {
      boxWalls(gw, o.cx, o.cz, hu, pw, o.ang, base + 4.6, base + H, ['arched', 'blank', 'arched', 'blank'], 2, flint, base, 4.4, 2);
    } else {
      boxWalls(gw, o.cx, o.cz, pw, hv, o.ang, base + 4.6, base + H, ['blank', 'arched', 'blank', 'arched'], 2, flint, base, 4.4, 2);
    }
    // passage soffit (ceiling) and inner walls
    const ceil = alongU
      ? [[o.cx - hu * c + pw * s, o.cz - hu * s - pw * c], [o.cx + hu * c + pw * s, o.cz + hu * s - pw * c], [o.cx + hu * c - pw * s, o.cz + hu * s + pw * c], [o.cx - hu * c - pw * s, o.cz - hu * s + pw * c]]
      : [[o.cx - pw * c + hv * s, o.cz - pw * s - hv * c], [o.cx + pw * c + hv * s, o.cz + pw * s - hv * c], [o.cx + pw * c - hv * s, o.cz + pw * s + hv * c], [o.cx - pw * c - hv * s, o.cz - pw * s + hv * c]];
    const q = ceil.map((p) => [p[0], base + 4.6, p[1]]);
    gw.quad([q[3], q[2], q[1], q[0]], [0, -1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]], C('#3a352e'), [[0, 0, 2], [1, 0, 2], [1, 1, 2], [0, 1, 2]], [-1, -1, 0], base);
    meshes(group, gw, gr, mats, 'gateway');
    L.gatewayInfo = { x: o.cx, z: o.cz, base };
  };

  // ------------------------------------------------------------------ Worley drinking fountain (1874, Gilbert Scott) — 1897 only
  L.fountain = function (eraId, group, col, atlas, flags, mats) {
    if (eraId !== 1897) return;
    const ct = L.clockTowerInfo;
    // in front of the tower, towards the High Street (south)
    const fx = ct.x + 2.5, fz = ct.z + 9.5;
    const y = SA.Terrain.height(fx, fz);
    const gw = GB(), gr = GB();
    const granite = C('#8f8d8a'), pink = C('#a88a80');
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      cylinder({ walls: gw, roofs: gr }, fx + dx * 0.75, y - 0.3, fz + dz * 0.75, 0.95, 1.0, 10, 5, granite, y, granite, 0, 3);
    }
    cylinder({ walls: gw, roofs: gr }, fx, y, fz, 0.42, 3.0, 8, 5, pink, y, granite, 0.9, 3);
    solidBox(gw, fx, y + 1.0, fz, 1.6, 0.25, 1.6, 0.5, granite, 5, y);
    meshes(group, gw, gr, mats, 'fountain');
    col.addCircle(fx, fz, 1.7, { y1: 4, cam: false });
    L.fountainInfo = { x: fx, z: fz };
  };

  // ------------------------------------------------------------------ Baptist church spire (skyline backdrop)
  L.baptist = function (eraId, group, col, atlas, flags, mats) {
    const b = findB(SA.World.ID.baptist);
    if (!b) return;
    const o = U.obb(b.p);
    const base = SA.Terrain.height(o.cx, o.cz);
    const gw = GB(), gr = GB();
    const spec = {
      key: 'baptist', id: b.id, pts: b.p, seed: 1885, tag: 'church', fronts: [0, 1, 2, 3, 4, 5], party: {}, storeys: 1, gh: 8.5, sh: 3, extra: 0, bayW: 3.6,
      wall: { type: 0, color: '#8e4a36' }, roof: { type: 'band', mat: 1, color: '#4f535a', pitch: 55 }, ground: 'lancet', upper: 'blank', signs: [], sideWindows: true, base, floor: base + 0.2,
    };
    const ctx = { chunks: new Map(), col, chimneys: [], signGB: null };
    SA.Buildings.addBuilding(ctx, spec);
    for (const ch of ctx.chunks.values()) meshes(group, ch.walls, ch.roofs, mats, 'baptist');
    // tower + spire at one corner
    const c = Math.cos(o.ang), s = Math.sin(o.ang);
    const tx = o.cx + (o.len / 2 - 2.5) * c, tz = o.cz + (o.len / 2 - 2.5) * s;
    boxWalls(gw, tx, tz, 2.2, 2.2, o.ang, base - 1, base + 15, 'lancet', 0, C('#8e4a36'), base, 2.2, 2);
    pyramid(gr, tx, tz, 2.4, 2.4, o.ang + Math.PI / 4, base + 15, 16, C('#55595f'), 1, base);
    meshes(group, gw, gr, mats, 'baptist-spire');
  };

  // ------------------------------------------------------------------ passages (arches through buildings)
  L.passages = function (eraId, group, col, atlas, flags, mats) {
    const list = [
      { road: 'Waxhouse Gate', bid: SA.World.ID.solicitorsArch || 164095789, w: 2.6, h: 3.4, memorial: eraId !== 1897 },
      { road: 'Christopher Place', bid: SA.World.ID.christopherInn, w: 3.2, h: 4.0 },
      { road: null, roadType: 'pedestrian', bid: 163741709, w: 2.8, h: 3.6, name: 'Half Moon Yard' },
    ];
    for (const ps of list) {
      const b = findB(ps.bid);
      if (!b) continue;
      // find the road polyline crossing this building
      let seg = null;
      for (const r of SA.World.roads) {
        if (ps.road && r.n !== ps.road) continue;
        if (!ps.road && ps.name && r.n !== ps.name) continue;
        // intersection points with polygon edges
        const hits = [];
        for (let i = 0; i < r.p.length - 1; i++) {
          const a = r.p[i], c2 = r.p[i + 1];
          for (let j = 0, k = b.p.length - 1; j < b.p.length; k = j++) {
            const t = U.segIntersect(a[0], a[1], c2[0], c2[1], b.p[k][0], b.p[k][1], b.p[j][0], b.p[j][1]);
            if (t >= 0) hits.push([a[0] + (c2[0] - a[0]) * t, a[1] + (c2[1] - a[1]) * t]);
          }
        }
        if (hits.length >= 2) {
          // farthest pair
          let best = null, bd = 0;
          for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
            const d = U.dist(hits[i][0], hits[i][1], hits[j][0], hits[j][1]);
            if (d > bd) {
              bd = d;
              best = [hits[i], hits[j]];
            }
          }
          seg = best;
          break;
        }
      }
      if (!seg) continue;
      L.addPassage(eraId, group, col, mats, b, seg[0], seg[1], ps.w, ps.h, ps);
    }
  };
  L.passageList = [];
  L.addPassage = function (eraId, group, col, mats, b, a, c, w, h, opts) {
    let dx = c[0] - a[0], dz = c[1] - a[1];
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    // extend a little beyond the walls
    const A = [a[0] - dx * 0.6, a[1] - dz * 0.6], Cc = [c[0] + dx * 0.6, c[1] + dz * 0.6];
    const L2 = len + 1.2;
    const nx = -dz, nz = dx;
    const gw = GB();
    const ya = SA.Terrain.height(A[0], A[1]), yc = SA.Terrain.height(Cc[0], Cc[1]);
    const base = Math.min(ya, yc);
    const dark = C('#4a4038');
    const hw = w / 2;
    // inner side walls (face inward)
    const l1 = [A[0] + nx * hw, A[1] + nz * hw], l2 = [Cc[0] + nx * hw, Cc[1] + nz * hw];
    const r1 = [A[0] - nx * hw, A[1] - nz * hw], r2 = [Cc[0] - nx * hw, Cc[1] - nz * hw];
    const top = Math.max(ya, yc) + h;
    wallQuad(gw, l1, l2, [-nx, -nz], base - 1, top, 'blank', 0, C('#7a5a48'), base, 3, 1);
    wallQuad(gw, r1, r2, [nx, nz], base - 1, top, 'blank', 0, C('#7a5a48'), base, 3, 1);
    // ceiling (faces down)
    const q = [[l1[0], ya + h, l1[1]], [l2[0], yc + h, l2[1]], [r2[0], yc + h, r2[1]], [r1[0], ya + h, r1[1]]];
    gw.quad(q, [0, -1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]], dark, [[0, 0, 7], [1, 0, 7], [1, 1, 7], [0, 1, 7]], [-1, -1, 0], base);
    gw.quad([q[3], q[2], q[1], q[0]], [0, -1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]], dark, [[0, 0, 7], [1, 0, 7], [1, 1, 7], [0, 1, 7]], [-1, -1, 0], base);
    // arch portals on both faces (dark arch cell drawn on a quad slightly proud of the wall)
    for (const [P, sgn] of [[A, -1], [Cc, 1]]) {
      const y = SA.Terrain.height(P[0], P[1]);
      const pa = [P[0] + nx * (hw + 0.5) + dx * sgn * 0.02, P[1] + nz * (hw + 0.5) + dz * sgn * 0.02], pb = [P[0] - nx * (hw + 0.5) + dx * sgn * 0.02, P[1] - nz * (hw + 0.5) + dz * sgn * 0.02];
      // only the frame: use arch cell
      const n = [dx * sgn, dz * sgn];
      const right = [n[1], -n[0]];
      let La = pa, Rb = pb;
      if ((pb[0] - pa[0]) * right[0] + (pb[1] - pa[1]) * right[1] < 0) {
        La = pb;
        Rb = pa;
      }
      const cc = CELLS.arch;
      gw.quad([[La[0], y - 0.3, La[1]], [Rb[0], y - 0.3, Rb[1]], [Rb[0], y + h + 0.4, Rb[1]], [La[0], y + h + 0.4, La[1]]], [n[0], 0, n[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], C('#d9cfbd'), [[0, 0, 1], [w, 0, 1], [w, h, 1], [0, h, 1]], [cc[0], cc[1], 0.1], base);
    }
    if (L._gw) L._gw.append(gw);
    else {
      const g = gw.build();
      const m = new THREE.Mesh(g, mats.passage);
      m.name = 'passage';
      group.add(m);
    }
    // collision: passage corridor lets walkers through the building; side walls keep them in
    const ang = Math.atan2(dz, dx);
    const mid = [(A[0] + Cc[0]) / 2, (A[1] + Cc[1]) / 2];
    col.addBox(mid[0] + nx * (hw + 0.25), mid[1] + nz * (hw + 0.25), L2 / 2 - 0.4, 0.25, ang, { y0: base - 2, y1: top + 5, tag: 'tunnelwall' });
    col.addBox(mid[0] - nx * (hw + 0.25), mid[1] - nz * (hw + 0.25), L2 / 2 - 0.4, 0.25, ang, { y0: base - 2, y1: top + 5, tag: 'tunnelwall' });
    const rect = { cx: mid[0], cz: mid[1], hu: L2 / 2 + 0.3, hv: hw - 0.05, ang, bid: b.id, top };
    L.passageList.push(rect);
    col.passages = col.passages || [];
    col.passages.push(rect);
    // memorial plaque on the Waxhouse Gate arch (street memorials date from after 1918)
    if (opts && opts.memorial) {
      const P = A;
      const y = SA.Terrain.height(P[0], P[1]);
      const uv = SA.World.eras._signAtlas ? null : null;
      void uv;
      void y;
    }
  };
  // query: is (x,z) inside a passage rectangle? returns rect
  L.inPassage = function (x, z, list) {
    for (const r of list || L.passageList) {
      const dx = x - r.cx, dz = z - r.cz;
      const c = Math.cos(r.ang), s = Math.sin(r.ang);
      const u = dx * c + dz * s, v = -dx * s + dz * c;
      if (Math.abs(u) <= r.hu && Math.abs(v) <= r.hv) return r;
    }
    return null;
  };

  // ------------------------------------------------------------------ consequences (flag-driven variants)
  L.consequences = function (eraId, group, col, atlas, flags, mats) {
    const f = flags || {};
    L.consequenceInfo = {};
    const ct = L.clockTowerInfo, cf = L.clockFace;
    const plaque = (lines, bg, fg, rim) =>
      atlas.square((c, w, h) => {
        c.fillStyle = 'rgba(0,0,0,0)';
        c.clearRect(0, 0, w, h);
        c.beginPath();
        c.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2);
        c.fillStyle = bg;
        c.fill();
        c.lineWidth = w * 0.03;
        c.strokeStyle = rim || '#ffffff';
        c.stroke();
        c.fillStyle = fg;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const n = lines.length;
        lines.forEach((t, i) => {
          const fs = i === 0 ? w * 0.1 : w * 0.075;
          c.font = 'bold ' + fs + 'px Georgia, serif';
          c.fillText(t, w / 2, h * (0.5 + (i - (n - 1) / 2) * 0.14));
        });
      }, 192, 192);
    if (f.fund_outcome === 'returned' && eraId !== 1897) {
      // blue plaque on the Clock Tower's south face
      const uv = plaque(['JOSIAH PENNICK', 'KEEPER OF', 'THIS CLOCK', '1881 - 1919'], '#1d4f9e', '#ffffff');
      // on the ground stage, whose face stands 0.32 m proud of the clock stage the dial is on
      const m = L.addSignQuad(group, mats, cf.x + cf.nx * 0.36 + cf.nz * 1.6, ct.base + 2.6, cf.z + cf.nz * 0.36 - cf.nx * 1.6, [cf.nx, cf.nz], 0.9, 0.9, uv, 'plaque-josiah', { alpha: true });
      if (m) m.material = mats.signAlpha;
      L.consequenceInfo.plaque = { x: cf.x + cf.nx * 1.5, z: cf.z + cf.nz * 1.5 };
      // the gilded Jubilee Lamp the Committee wanted, by the Town Hall steps
      const th = L.townHallInfo;
      if (th) {
        const lx = th.x + th.nz * 6.5 + th.nx * -1.5, lz = th.z - th.nx * 6.5 + th.nz * -1.5;
        const ly = SA.Terrain.height(lx, lz);
        const P = SA.Props;
        const geo = P.merge([
          P.part(new THREE.CylinderGeometry(0.55, 0.7, 0.6, 8), '#1d2a22', 0, 0.3, 0),
          P.part(new THREE.CylinderGeometry(0.16, 0.24, 4.2, 8), '#1d2a22', 0, 2.6, 0),
          P.part(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 8), '#d4a83a', 0, 1.2, 0),
          P.part(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8), '#d4a83a', 0, 4.2, 0),
          P.part(new THREE.BoxGeometry(1.6, 0.08, 0.08), '#d4a83a', 0, 4.5, 0),
          P.part(new THREE.BoxGeometry(0.08, 0.08, 1.6), '#d4a83a', 0, 4.5, 0),
          P.part(new THREE.SphereGeometry(0.12, 8, 6), '#d4a83a', 0, 5.0, 0),
        ]);
        const lamp = new THREE.Mesh(geo, mats.prop);
        lamp.position.set(lx, ly, lz);
        lamp.name = 'jubilee-lamp';
        lamp.userData.waveCPU = true;
        group.add(lamp);
        const glass = SA.Props.merge([0.75, -0.75].flatMap((o) => [SA.Props.part(new THREE.SphereGeometry(0.22, 8, 6), '#fff2c0', o, 4.75, 0), SA.Props.part(new THREE.SphereGeometry(0.22, 8, 6), '#fff2c0', 0, 4.75, o)]));
        const lg = new THREE.Mesh(glass, mats.propGlow);
        lg.position.set(lx, ly, lz);
        lg.userData.waveCPU = true;
        group.add(lg);
        col.addCircle(lx, lz, 0.6, { y1: 5 });
        const uv2 = atlas.text('JUBILEE 1897 · erected by the Committee', { bg: '#1d2a22', fg: '#d4a83a', font: 'Georgia, serif' }, 384, 40);
        const pl = L.addSignQuad(group, mats, lx + th.nx * 0.72, ly + 0.35, lz + th.nz * 0.72, [th.nx, th.nz], 0.9, 0.12, uv2, 'lamp-plate');
        void pl;
        L.consequenceInfo.lamp = { x: lx, z: lz };
      }
    }
    if (f.fund_outcome === 'dinner' && eraId !== 1897 && L.cornInfo) {
      const ci = L.cornInfo;
      const uv = plaque(['ON JUBILEE NIGHT 1897', 'AN UNKNOWN FRIEND', 'FED 300 OF', "THIS CITY'S POOR"], '#5a1f24', '#f4e6c4', '#d9b45a');
      const m = L.addSignQuad(group, mats, ci.door[0] + ci.nx * 0.12 + ci.nz * 3.2, ci.floor + 2.3, ci.door[1] + ci.nz * 0.12 - ci.nx * 3.2, [ci.nx, ci.nz], 1.0, 1.0, uv, 'plaque-dinner', { alpha: true });
      if (m) m.material = mats.signAlpha;
      L.consequenceInfo.plaque = { x: ci.door[0] + ci.nx * 2 + ci.nz * 3.2, z: ci.door[1] + ci.nz * 2 - ci.nx * 3.2 };
    }
    // newspaper A-board outside the newsagent near the Town Hall
    if (eraId !== 1897) {
      const th = L.townHallInfo;
      if (th) {
        const bx = th.x + th.nz * -9 + th.nx * 3, bz = th.z - th.nx * -9 + th.nz * 3;
        const head = eraId === 1964
          ? (f.fund_outcome === 'returned' ? 'PENNICK CLOCKS FOR NEW CITY HALL' : f.fund_outcome === 'dinner' ? 'JUBILEE DINNER REMEMBERED' : 'TOWN DECIDES ON THURSDAY')
          : f.fund_outcome === 'returned' ? 'CLOCKMAKERS MARK 145 YEARS ON FRENCH ROW' : f.fund_outcome === 'dinner' ? "JUBILEE TABLE'S 129TH BIRTHDAY FEAST" : 'PARKING: TRADERS FURY';
        const paper = eraId === 1964 ? 'ST ALBANS CHRONICLE' : 'ST ALBANS CHRONICLE';
        const uv = atlas.square((c, w, h) => {
          c.fillStyle = '#f4f1e8';
          c.fillRect(0, 0, w, h);
          c.fillStyle = eraId === 1964 ? '#1a1a1a' : '#a8141c';
          c.fillRect(0, 0, w, h * 0.2);
          c.fillStyle = '#ffffff';
          c.font = 'bold ' + w * 0.085 + 'px Georgia, serif';
          c.textAlign = 'center';
          c.fillText(paper, w / 2, h * 0.14);
          c.fillStyle = '#111';
          const words = head.split(' ');
          let line = '', y = h * 0.36;
          c.font = 'bold ' + w * 0.12 + 'px "Arial Black", Arial, sans-serif';
          for (const wd of words) {
            const t = line ? line + ' ' + wd : wd;
            if (c.measureText(t).width > w * 0.9) {
              c.fillText(line, w / 2, y);
              y += h * 0.15;
              line = wd;
            } else line = t;
          }
          c.fillText(line, w / 2, y);
        }, 160, 200);
        const by = SA.Terrain.height(bx, bz);
        const geo = SA.Props.MODELS.adBoard;
        if (geo) {
          const ab = new THREE.Mesh(geo, mats.prop);
          ab.position.set(bx, by, bz);
          ab.rotation.y = Math.atan2(th.nx, th.nz);
          ab.userData.waveCPU = true;
          group.add(ab);
        }
        const q = L.addSignQuad(group, mats, bx + th.nx * 0.2, by + 0.58, bz + th.nz * 0.2, [th.nx, th.nz], 0.55, 0.7, uv, 'newsboard');
        void q;
        col.addCircle(bx, bz, 0.4, { y1: 1.2 });
        L.consequenceInfo.newsboard = { x: bx + th.nx * 1.2, z: bz + th.nz * 1.2, head };
      }
    }
  };

  // ------------------------------------------------------------------ build all for an era
  L.build = function (eraId, group, col, atlas, flags, mats, signGB) {
    L.passageList = [];
    L._gw = GB();
    L._gr = GB();
    L._signGB = signGB || null;
    L.clockTower(eraId, group, col, atlas, flags, mats);
    L.townHall(eraId, group, col, atlas, flags, mats);
    L.cornExchange(eraId, group, col, atlas, flags, mats);
    L.cathedral(eraId, group, col, atlas, flags, mats);
    L.gateway(eraId, group, col, atlas, flags, mats);
    L.fountain(eraId, group, col, atlas, flags, mats);
    L.baptist(eraId, group, col, atlas, flags, mats);
    L.passages(eraId, group, col, atlas, flags, mats);
    L.consequences(eraId, group, col, atlas, flags, mats);
    const gw = L._gw, gr = L._gr;
    L._gw = L._gr = null;
    L._signGB = null;
    meshes(group, gw, gr, mats, 'landmarks');
  };
})();
