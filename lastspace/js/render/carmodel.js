/* LAST SPACE - procedural car models. Contestant cars are individual, deformable meshes (dents,
   scrapes, detached bumpers, broken lights); residents' parked cars are instanced.
   Car-local axes in three.js: +X forward, +Y up, +Z to the car's right. */
(function (LS) {
  'use strict';
  const U = LS.U;

  // shape profiles: fractions of length/height
  const PROFILES = {
    hatch: { clear: 0.17, belt: 0.86, roof: 1.46, hood: 0.27, cabEnd: 0.97, rakeF: 0.5, rakeR: 0.22, roofIn: 0.12, hoodDrop: 0.1, wheelR: 0.31, bumper: 'body' },
    estate: { clear: 0.17, belt: 0.88, roof: 1.5, hood: 0.27, cabEnd: 0.985, rakeF: 0.55, rakeR: 0.1, roofIn: 0.12, hoodDrop: 0.12, wheelR: 0.32, bumper: 'body' },
    saloon: { clear: 0.16, belt: 0.86, roof: 1.44, hood: 0.27, cabEnd: 0.78, rakeF: 0.55, rakeR: 0.38, roofIn: 0.13, hoodDrop: 0.1, wheelR: 0.32, bumper: 'body' },
    suv: { clear: 0.26, belt: 1.12, roof: 1.84, hood: 0.25, cabEnd: 0.97, rakeF: 0.45, rakeR: 0.12, roofIn: 0.1, hoodDrop: 0.08, wheelR: 0.38, bumper: 'dark' },
    mega: { clear: 0.28, belt: 1.18, roof: 1.92, hood: 0.27, cabEnd: 0.97, rakeF: 0.4, rakeR: 0.1, roofIn: 0.08, hoodDrop: 0.06, wheelR: 0.4, bumper: 'chrome' },
    van: { clear: 0.22, belt: 1.15, roof: 2.25, hood: 0.15, cabEnd: 1.0, rakeF: 0.55, rakeR: 0.0, roofIn: 0.04, hoodDrop: 0.18, wheelR: 0.34, bumper: 'dark', van: true },
  };
  const GLASS = [0.07, 0.09, 0.12], TYRE = [0.06, 0.06, 0.07], DARK = [0.13, 0.13, 0.14], CHROME = [0.75, 0.76, 0.78];

  function setColors(geo, rgb) {
    const n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = rgb[0]; a[i * 3 + 1] = rgb[1]; a[i * 3 + 2] = rgb[2]; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  }
  function roundBox(geo, hx, hy, hz, r) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const qx = U.clamp(x, -hx + r, hx - r), qy = U.clamp(y, -hy + r * 0.6, hy - r * 0.6), qz = U.clamp(z, -hz + r, hz - r);
      const dx = x - qx, dy = y - qy, dz = z - qz, l = Math.hypot(dx, dy, dz);
      if (l > 1e-6) { const k = Math.min(1, r / l); p.setXYZ(i, qx + dx * k, qy + dy * k, qz + dz * k); }
    }
    geo.computeVertexNormals();
    return geo;
  }

  // parts: { paint: [geos], glass: [geos], dark: [geos], bumperF, bumperR, wheels: [{x,z,r,w}], lights: {...}, plates }
  function buildParts(type, spec, paintRGB) {
    const P = PROFILES[type] || PROFILES.estate;
    const L = spec.L, W = spec.W, H = spec.H || P.roof;
    const scaleH = H / P.roof;
    const clear = P.clear, belt = P.belt * scaleH, roof = H;
    const hl = L / 2, hw = W / 2;
    const out = { paint: [], glass: [], dark: [], chrome: [], wheels: [], P };

    // lower body
    const bh = belt - clear;
    const body = new THREE.BoxGeometry(L, bh, W, 14, 4, 6);
    roundBox(body, hl, bh / 2, hw, Math.min(0.3, bh * 0.45));
    body.translate(0, clear + bh / 2, 0);
    // bonnet slopes down towards the nose; boot drops a little
    { const p = body.attributes.position; const x0 = hl - L * P.hood;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); if (y > clear + bh * 0.55) { if (x > x0) p.setY(i, y - P.hoodDrop * U.smooth((x - x0) / (hl - x0))); if (x < -hl + 0.5 && !P.van) p.setY(i, y - 0.04 * U.smooth((-hl + 0.5 - x) / 0.5)); } }
      body.computeVertexNormals(); }
    setColors(body, paintRGB);
    out.body = body;

    // cabin / greenhouse
    const cabF = hl - L * P.hood, cabR = -hl + L * (1 - P.cabEnd);
    const cabLen = cabF - cabR, cabH = roof - belt;
    const cab = new THREE.BoxGeometry(cabLen, cabH, W * 0.96, 8, 2, 4);
    { const p = cab.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const t = (y + cabH / 2) / cabH; // 0 bottom .. 1 top
        if (x > 0) x -= P.rakeF * t * (x / (cabLen / 2)); else x += P.rakeR * t * (-x / (cabLen / 2));
        z *= 1 - P.roofIn * t;
        p.setXYZ(i, x, y, z);
      }
    }
    cab.translate((cabF + cabR) / 2, belt + cabH / 2, 0);
    cab.computeVertexNormals();
    // colour: roof and pillars paint, the rest glass
    { const p = cab.attributes.position, n = cab.attributes.normal, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), x = p.getX(i), ny = n.getY(i);
        const isRoof = ny > 0.75 || y > roof - 0.05;
        const isPillar = (Math.abs(x - cabF + P.rakeF * 0.5) < 0.08) || (Math.abs(x - cabR) < 0.06) || (y < belt + 0.04);
        const c = (isRoof || isPillar || (P.van && x < cabF - 1.2)) ? paintRGB : GLASS;
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      }
      cab.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    out.cab = cab;

    // bumpers
    const bumpCol = P.bumper === 'body' ? paintRGB.map((v) => v * 0.92) : P.bumper === 'chrome' ? CHROME : DARK;
    const mkBump = (end) => { const g = new THREE.BoxGeometry(0.24, 0.3, W + 0.04, 2, 2, 6); roundBox(g, 0.12, 0.15, W / 2 + 0.02, 0.1); g.translate(end * (hl + 0.04), clear + 0.2, 0); return setColors(g, bumpCol); };
    out.bumperF = mkBump(1); out.bumperR = mkBump(-1);

    // wheels
    const wr = P.wheelR * Math.max(0.9, scaleH * 0.95), wb = spec.wb, tr = spec.track || W - 0.25;
    for (const [sx, sz] of [[1, -1], [1, 1], [-1, -1], [-1, 1]]) out.wheels.push({ x: sx * wb / 2, z: sz * tr / 2, r: wr, w: 0.24, front: sx > 0 });
    // wheel arches (dark) to read the stance
    for (const w of out.wheels) { const g = new THREE.BoxGeometry(wr * 2.3, 0.12, 0.08); g.translate(w.x, wr * 2 + 0.02, w.z + Math.sign(w.z) * (W / 2 - w.z * Math.sign(w.z) + 0.01)); out.dark.push(setColors(g, DARK)); }

    // lights
    out.lights = {
      hl: { x: hl - 0.05, y: clear + bh * 0.72, z: -hw + 0.32, w: 0.12, h: 0.12, d: 0.42 },
      hr: { x: hl - 0.05, y: clear + bh * 0.72, z: hw - 0.32, w: 0.12, h: 0.12, d: 0.42 },
      tl: { x: -hl + 0.04, y: clear + bh * 0.78, z: -hw + 0.22, w: 0.1, h: 0.16, d: 0.32 },
      tr: { x: -hl + 0.04, y: clear + bh * 0.78, z: hw - 0.22, w: 0.1, h: 0.16, d: 0.32 },
    };
    // mirrors
    for (const sz of [-1, 1]) { const g = new THREE.BoxGeometry(0.2, 0.14, 0.18); g.translate(cabF - 0.25, belt + 0.12, sz * (hw + 0.08)); out.paint.push(setColors(g, paintRGB)); }
    // grille
    { const g = new THREE.BoxGeometry(0.04, bh * 0.35, W * 0.45); g.translate(hl + 0.01, clear + bh * 0.45, 0); out.dark.push(setColors(g, P.bumper === 'chrome' ? CHROME : DARK)); }
    if (type === 'suv' || type === 'mega') for (const sz of [-1, 1]) { const g = new THREE.BoxGeometry(cabLen * 0.75, 0.05, 0.05); g.translate((cabF + cabR) / 2 - 0.2, roof + 0.04, sz * hw * 0.78); out.chrome.push(setColors(g, CHROME)); }
    if (P.van) { const g = new THREE.BoxGeometry(cabLen * 0.6, 0.06, W * 0.8); g.translate(cabR + cabLen * 0.35, roof + 0.12, 0); out.chrome.push(setColors(g, CHROME)); for (const k of [-1, 0, 1]) { const q = new THREE.BoxGeometry(0.05, 0.12, W * 0.8); q.translate(cabR + cabLen * 0.35 + k * cabLen * 0.25, roof + 0.06, 0); out.chrome.push(setColors(q, CHROME)); } }
    return out;
  }

  // ------------------------------------------------------------------ contestant car (deformable)
  const SHARED = {};
  function sharedMats() {
    if (SHARED.paint) return SHARED;
    SHARED.paint = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.38 });
    SHARED.trim = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.6 });
    SHARED.chrome = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.9, roughness: 0.2 });
    SHARED.tyre = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.9 });
    SHARED.hub = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.7, roughness: 0.35 });
    SHARED.dead = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    SHARED.wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 18); SHARED.wheelGeo.rotateX(Math.PI / 2);
    SHARED.hubGeo = new THREE.CylinderGeometry(0.62, 0.62, 1.04, 10); SHARED.hubGeo.rotateX(Math.PI / 2);
    SHARED.shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
    return SHARED;
  }

  class CarView {
    constructor(car, scene) {
      const M = sharedMats();
      this.car = car; const spec = car.spec;
      this.paint = LS.hexRGB(car.paint);
      const parts = buildParts(spec.type, spec, this.paint);
      this.group = new THREE.Group();
      this.bodyGroup = new THREE.Group(); this.group.add(this.bodyGroup);
      this.bodyMesh = new THREE.Mesh(parts.body, M.paint); this.bodyMesh.castShadow = true;
      this.cabMesh = new THREE.Mesh(parts.cab, M.paint); this.cabMesh.castShadow = true;
      this.bodyGroup.add(this.bodyMesh, this.cabMesh);
      const merge = (arr, mat) => { if (!arr.length) return null; const g = THREE.BufferGeometryUtils.mergeGeometries(arr, false); const m = new THREE.Mesh(g, mat); this.bodyGroup.add(m); return m; };
      this.extras = [merge(parts.paint, M.paint), merge(parts.dark, M.trim), merge(parts.chrome, M.chrome)].filter(Boolean);
      this.bumperF = new THREE.Mesh(parts.bumperF, M.trim); this.bumperR = new THREE.Mesh(parts.bumperR, M.trim);
      this.bodyGroup.add(this.bumperF, this.bumperR);
      this.deformables = [this.bodyMesh, this.cabMesh, this.bumperF, this.bumperR];
      for (const m of this.deformables) m.userData.orig = Float32Array.from(m.geometry.attributes.position.array);
      // lights: own materials so they can break and flash
      this.lightMat = {};
      this.lightMesh = {};
      for (const k of ['hl', 'hr', 'tl', 'tr']) {
        const d = parts.lights[k];
        const mat = new THREE.MeshStandardMaterial({ color: k[0] === 'h' ? 0xfff6dd : 0x8a0b0b, emissive: k[0] === 'h' ? 0xfff2cc : 0xff1a10, emissiveIntensity: k[0] === 'h' ? 2.2 : 0.9, roughness: 0.3 });
        const g = new THREE.BoxGeometry(d.w, d.h, d.d);
        const m = new THREE.Mesh(g, mat); m.position.set(d.x, d.y, d.z);
        this.bodyGroup.add(m); this.lightMat[k] = mat; this.lightMesh[k] = m;
      }
      // reversing light and indicators (hazards when recovering)
      this.revMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0 });
      this.indMat = new THREE.MeshStandardMaterial({ color: 0x9a5a00, emissive: 0xffa000, emissiveIntensity: 0 });
      for (const sz of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), this.revMat); r.position.set(-spec.L / 2 + 0.03, parts.lights.tl.y - 0.13, sz * (spec.W / 2 - 0.45)); this.bodyGroup.add(r);
        for (const sx of [-1, 1]) { const q = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.1), this.indMat); q.position.set(sx * (spec.L / 2 - 0.02), parts.lights.hl.y - 0.12, sz * (spec.W / 2 - 0.12)); this.bodyGroup.add(q); }
      }
      // plates
      const plate = car.plate || ('L' + 'S' + (26 + car.index) + ' ' + 'PRK'.split('').sort(() => 0.5 - ((car.index * 7) % 3) / 3).join(''));
      for (const end of [1, -1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), new THREE.MeshStandardMaterial({ map: LS.Tex.plate(plate, end < 0), roughness: 0.5 }));
        m.rotation.y = end > 0 ? Math.PI / 2 : -Math.PI / 2; m.position.set(end * (spec.L / 2 + 0.17), parts.P.clear + 0.2, 0);
        (end > 0 ? this.bumperF : this.bumperR).add(m);
      }
      if (car.livery && spec.type === 'van') {
        const tex = LS.Tex.livery(car.livery);
        for (const sz of [-1, 1]) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(spec.L * 0.62, 0.85), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }));
          m.position.set(-0.45, parts.P.belt * (spec.H / parts.P.roof) + 0.45, sz * (spec.W / 2 + 0.012)); m.rotation.y = sz > 0 ? 0 : Math.PI;
          this.bodyGroup.add(m);
        }
      }
      // wheels
      this.wheels = [];
      for (const w of parts.wheels) {
        const pivot = new THREE.Group(); pivot.position.set(w.x, w.r, w.z);
        const spin = new THREE.Group(); pivot.add(spin);
        const t = new THREE.Mesh(M.wheelGeo, M.tyre); t.scale.set(w.r, w.r, w.w); t.castShadow = true;
        const h = new THREE.Mesh(M.hubGeo, M.hub); h.scale.set(w.r, w.r, w.w);
        spin.add(t, h);
        this.group.add(pivot); this.wheels.push({ pivot, spin, front: w.front, r: w.r });
      }
      // soft contact shadow
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(spec.L * 1.25, spec.W * 1.45), new THREE.MeshBasicMaterial({ map: M.shadowTex, transparent: true, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.renderOrder = 1;
      this.group.add(sh); this.shadow = sh;
      // headlight pool on the road
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({ map: LS.Tex.glow(), color: 0xffe9b0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(spec.L / 2 + 4.2, 0.03, 0); this.group.add(pool); this.pool = pool;
      // identity marker
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: LS.Tex.badge(car.identity, car.human ? 'P' + (car.player + 1) : String(car.index + 1)), depthTest: false, transparent: true }));
      badge.scale.set(1.3, 1.3, 1); badge.position.y = (spec.H || 1.5) + 1.3; badge.renderOrder = 10;
      this.group.add(badge); this.badge = badge;
      scene.add(this.group);
      this.dentCount = 0; this.fade = 1;
    }
    // push panels in around a hit (local sim coords lx, ly; direction nx, ny into the car)
    dent(d) {
      const px = d.lx, pz = -d.ly, dx = d.nx, dz = -d.ny, R = 0.85;
      for (const m of this.deformables) {
        if (!m.visible) continue;
        const p = m.geometry.attributes.position, o = m.userData.orig, col = m.geometry.attributes.color;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const dist = Math.hypot(x - px, z - pz) + Math.max(0, Math.abs(y - 0.55) - 0.5) * 0.6;
          if (dist > R) continue;
          const f = d.depth * (1 - dist / R) * (1 - dist / R);
          let nx = x + dx * f, nz = z + dz * f, ny = y - f * 0.25;
          // never more than 0.42 m from the factory shape
          const ox = o[i * 3], oy = o[i * 3 + 1], oz = o[i * 3 + 2];
          const off = Math.hypot(nx - ox, ny - oy, nz - oz);
          if (off > 0.42) { const k = 0.42 / off; nx = ox + (nx - ox) * k; ny = oy + (ny - oy) * k; nz = oz + (nz - oz) * k; }
          p.setXYZ(i, nx, ny, nz);
          if (col && f > 0.02) { col.setXYZ(i, col.getX(i) * (1 - f * 0.6), col.getY(i) * (1 - f * 0.6), col.getZ(i) * (1 - f * 0.6)); }
        }
        p.needsUpdate = true; if (col) col.needsUpdate = true;
        m.geometry.computeVertexNormals();
      }
      this.dentCount++;
    }
    // scraped paint: blend towards bare metal near the scrape
    scrape(d) {
      const px = d.lx, pz = -d.ly, R = 0.35 + d.len * 0.5;
      for (const m of [this.bodyMesh, this.bumperF, this.bumperR]) {
        const p = m.geometry.attributes.position, col = m.geometry.attributes.color;
        for (let i = 0; i < p.count; i++) {
          const dist = Math.hypot(p.getX(i) - px, p.getZ(i) - pz);
          if (dist > R || p.getY(i) > 1.2) continue;
          const k = 0.55 * (1 - dist / R);
          col.setXYZ(i, U.lerp(col.getX(i), 0.72, k), U.lerp(col.getY(i), 0.72, k), U.lerp(col.getZ(i), 0.74, k));
        }
        col.needsUpdate = true;
      }
    }
    breakLight(k) { const m = this.lightMat[k]; if (!m) return; m.emissiveIntensity = 0; m.color.setHex(0x222222); this.lightMesh[k].scale.set(0.8, 0.6, 0.7); }
    detachBumper(end) { (end > 0 ? this.bumperF : this.bumperR).visible = false; }
    update(dt, t, arena) {
      const c = this.car, b = c.body;
      if (c.status !== 'active' && b.enabled === false) { this.fade = Math.max(0, this.fade - dt * 0.8); }
      const g = this.group;
      // average kerb height under the wheels
      const wh = c.wheelH, h = (wh[0] + wh[1] + wh[2] + wh[3]) / 4;
      g.position.set(b.x, h + (c.status === 'eliminated' ? (1 - this.fade) * 6 : 0), -b.y);
      g.rotation.set(0, b.a, 0);
      if (c.overturned) {
        const side = c.tipSide || 1;
        this.bodyGroup.rotation.set(side * Math.PI / 2 * Math.min(1, c.overT * 3), 0, 0);
        this.bodyGroup.position.set(0, c.spec.W / 2 * Math.min(1, c.overT * 3) - 0.1, 0);
        for (const w of this.wheels) w.pivot.visible = false;
      } else {
        const roll = U.clamp(c.roll + (wh[1] + wh[3] - wh[0] - wh[2]) * 0.6, -0.25, 0.25);
        const pitch = U.clamp(c.pitch + (wh[0] + wh[1] - wh[2] - wh[3]) * 0.25 + Math.sin(t * 40) * c.kerbBump * 0.01, -0.12, 0.12);
        this.bodyGroup.rotation.set(roll, 0, -pitch);
        this.bodyGroup.position.set(0, c.heave || 0, 0);
        for (const w of this.wheels) w.pivot.visible = true;
      }
      for (let i = 0; i < this.wheels.length; i++) {
        const w = this.wheels[i];
        if (w.front) w.pivot.rotation.y = c.steerAngle;
        w.spin.rotation.z = -c.wheelSpin * 0.33 / w.r;
      }
      // lights
      const braking = (c.gear === 1 && c.input.brake > 0.1) || (c.gear === -1 && c.input.throttle > 0.1);
      for (const k of ['tl', 'tr']) if (c.parts[k]) this.lightMat[k].emissiveIntensity = braking ? 3.2 : 0.9;
      this.revMat.emissiveIntensity = c.gear === -1 ? 2.5 : 0;
      this.indMat.emissiveIntensity = (c.recovering || c.overturned || c.canRecover) && Math.sin(t * 9) > 0 ? 3 : 0;
      this.pool.material.opacity = (c.parts.hl ? 0.11 : 0) + (c.parts.hr ? 0.11 : 0);
      this.pool.visible = !c.overturned;
      this.shadow.visible = !c.overturned;
      if (this.fade < 1) { g.visible = this.fade > 0.02; }
      this.badge.visible = c.status === 'active';
    }
    setOpacity(o) {
      if (this._op === o) return; this._op = o;
      g_traverseMats(this.group, (m) => { if (m === SHARED.paint || m === SHARED.trim || m === SHARED.chrome || m === SHARED.tyre || m === SHARED.hub) return; });
      // shared materials can't fade per car; fade by hiding the cabin instead (keeps the player visible)
      this.cabMesh.visible = o > 0.6; this.extras.forEach((m) => { m.visible = o > 0.6; });
    }
    dispose(scene) { scene.remove(this.group); }
  }
  function g_traverseMats(o, fn) { o.traverse((n) => { if (n.material) fn(n.material); }); }

  // ------------------------------------------------------------------ residents' parked cars, instanced
  class ResidentCars {
    constructor(scene, bodies) {
      const M = sharedMats();
      this.bodies = bodies; this.byModel = new Map();
      const r = LS.U.rng(99);
      const paints = ['#d9d9d6', '#202124', '#5b6670', '#8b1d1d', '#e8e6df', '#1f3a5f', '#7a7f85', '#2f4f3e', '#b8b3a6', '#3a3a3c', '#9c2f22', '#c9c4b8'];
      for (const b of bodies) { const k = b.user.slot.model; if (!this.byModel.has(k)) this.byModel.set(k, []); this.byModel.get(k).push(b); }
      this.meshes = [];
      for (const [model, list] of this.byModel) {
        const spec = { L: list[0].hx * 2, W: list[0].hy * 2, H: PROFILES[model].roof, wb: list[0].hx * 2 * 0.6, track: list[0].hy * 2 - 0.25, type: model };
        const parts = buildParts(model, spec, [1, 1, 1]);
        const paintGeo = THREE.BufferGeometryUtils.mergeGeometries([parts.body, parts.cab, parts.bumperF, parts.bumperR, ...parts.paint].map((g) => { g = g.clone(); if (g.index) g = g.toNonIndexed(); return g; }), false);
        // fixed parts: wheels (as boxes, cheap), lights, trim
        const fixed = [];
        for (const w of parts.wheels) { const g = new THREE.CylinderGeometry(w.r, w.r, w.w, 12); g.rotateX(Math.PI / 2); g.translate(w.x, w.r, w.z); fixed.push(setColors(g, TYRE)); }
        for (const k of ['hl', 'hr', 'tl', 'tr']) { const d = parts.lights[k]; const g = new THREE.BoxGeometry(d.w, d.h, d.d); g.translate(d.x, d.y, d.z); fixed.push(setColors(g, k[0] === 'h' ? [0.9, 0.9, 0.8] : [0.5, 0.05, 0.05])); }
        for (const g of parts.dark.concat(parts.chrome)) fixed.push(g);
        const fixedGeo = THREE.BufferGeometryUtils.mergeGeometries(fixed.map((g) => (g.index ? g.toNonIndexed() : g)), false);
        const pm = new THREE.InstancedMesh(paintGeo, M.paint, list.length);
        const fm = new THREE.InstancedMesh(fixedGeo, M.trim, list.length);
        pm.castShadow = true;
        const col = new THREE.Color();
        list.forEach((b, i) => { col.set(paints[Math.floor(r() * paints.length)]); col.convertSRGBToLinear(); pm.setColorAt(i, col); });
        pm.instanceColor.needsUpdate = true;
        scene.add(pm, fm);
        this.meshes.push({ list, pm, fm });
      }
      this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1); this.ax = new THREE.Vector3(0, 1, 0);
      this.update(true);
    }
    update(all) {
      for (const { list, pm, fm } of this.meshes) {
        let dirty = false;
        list.forEach((b, i) => {
          if (!all && !b.awake) return;
          this.v.set(b.x, b.user.slot.pavement ? 0.06 : 0, -b.y); this.q.setFromAxisAngle(this.ax, b.a);
          if (b.user.slot.pavement) { const e = new THREE.Euler(0, b.a, (b.user.slot.side || 1) * 0.04, 'YXZ'); this.q.setFromEuler(e); }
          this.m4.compose(this.v, this.q, this.s); pm.setMatrixAt(i, this.m4); fm.setMatrixAt(i, this.m4); dirty = true;
        });
        if (dirty) { pm.instanceMatrix.needsUpdate = true; fm.instanceMatrix.needsUpdate = true; pm.computeBoundingSphere(); fm.computeBoundingSphere(); }
      }
    }
  }

  LS.CarView = CarView;
  LS.ResidentCars = ResidentCars;
  LS.buildCarParts = buildParts;
})(window.LS);
