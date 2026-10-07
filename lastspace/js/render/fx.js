/* LAST SPACE - effects: sparks, tyre and crash smoke, glass, debris bits, skid marks, detached bumpers. */
(function (LS) {
  'use strict';
  const U = LS.U;

  class Particles {
    constructor(scene, cap, additive, tex) {
      this.cap = cap; this.n = 0; this.head = 0;
      this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
      this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.age = new Float32Array(cap); this.grav = new Float32Array(cap); this.grow = new Float32Array(cap); this.drag = new Float32Array(cap); this.a0 = new Float32Array(cap);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: tex }, scale: { value: 600 } },
        vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); if (gl_FragColor.a < 0.01) discard; }',
        transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; this.points.renderOrder = 4;
      scene.add(this.points);
      this.geo = g;
    }
    emit(x, y, z, vx, vy, vz, r, gC, b, size, life, grav, grow, drag, alpha) {
      const i = this.head; this.head = (this.head + 1) % this.cap; this.n = Math.min(this.cap, this.n + 1);
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.col[i * 3] = r; this.col[i * 3 + 1] = gC; this.col[i * 3 + 2] = b;
      this.size[i] = size; this.life[i] = life; this.age[i] = 0; this.grav[i] = grav; this.grow[i] = grow || 0; this.drag[i] = drag || 0; this.a0[i] = alpha == null ? 1 : alpha; this.alpha[i] = this.a0[i];
    }
    update(dt) {
      for (let i = 0; i < this.cap; i++) {
        if (this.life[i] <= 0) continue;
        this.age[i] += dt;
        if (this.age[i] >= this.life[i]) { this.life[i] = 0; this.alpha[i] = 0; this.size[i] = 0; continue; }
        const k = 1 - this.drag[i] * dt;
        this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
        this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
        if (this.pos[i * 3 + 1] < 0.03 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.03; this.vel[i * 3 + 1] *= -0.3; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; }
        this.size[i] += this.grow[i] * dt;
        const f = this.age[i] / this.life[i];
        this.alpha[i] = this.a0[i] * (f < 0.1 ? f / 0.1 : 1 - (f - 0.1) / 0.9);
      }
      for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
    }
  }

  class FX {
    constructor(scene) {
      this.scene = scene;
      this.add = new Particles(scene, 900, true, LS.Tex.glow());
      this.soft = new Particles(scene, 1400, false, LS.Tex.smoke());
      this.bits = new Particles(scene, 900, false, LS.Tex.glow());
      // skid marks: ring buffer of instanced quads
      const N = 1400; this.skidN = N; this.skidHead = 0;
      const g = new THREE.PlaneGeometry(1, 0.22); g.rotateX(-Math.PI / 2);
      this.skids = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), N);
      this.skids.frustumCulled = false; this.skids.renderOrder = 2;
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < N; i++) this.skids.setMatrixAt(i, zero);
      scene.add(this.skids);
      this.lastSkid = new Map();
      this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
      this.debris = new Map();
      this.r = U.rng(77);
    }
    sparks(x, y, h, n, vx, vy, power) {
      const r = this.r;
      for (let i = 0; i < n; i++) {
        const sp = 2 + r() * 6 * power;
        this.add.emit(x, h + r() * 0.4, -y, vx * 0.4 + (r() - 0.5) * sp, 1 + r() * 3 * power, -(vy * 0.4) + (r() - 0.5) * sp, 1, 0.65 + r() * 0.3, 0.25, 0.08 + r() * 0.06, 0.25 + r() * 0.45, 9.8, 0, 1.5);
      }
    }
    smoke(x, y, h, n, size, life, shade, vx, vy) {
      const r = this.r;
      for (let i = 0; i < n; i++) {
        const s = shade * (0.85 + r() * 0.3);
        this.soft.emit(x + (r() - 0.5) * 0.5, h + r() * 0.3, -y + (r() - 0.5) * 0.5, (vx || 0) * 0.3 + (r() - 0.5) * 1.2, 0.4 + r() * 0.9, -(vy || 0) * 0.3 + (r() - 0.5) * 1.2, s, s, s * 1.02, size * (0.7 + r() * 0.6), life * (0.7 + r() * 0.6), -0.15, size * 0.9, 0.8, 0.55);
      }
    }
    glass(x, y, h, n) {
      const r = this.r;
      for (let i = 0; i < n; i++) this.bits.emit(x, h, -y, (r() - 0.5) * 4, 1 + r() * 2.5, (r() - 0.5) * 4, 0.8, 0.9, 1, 0.05 + r() * 0.04, 2.5 + r() * 2, 9.8, 0, 0.5, 0.9);
    }
    chunks(x, y, h, n, rgb) {
      const r = this.r;
      for (let i = 0; i < n; i++) this.bits.emit(x, h, -y, (r() - 0.5) * 5, 1 + r() * 3, (r() - 0.5) * 5, rgb[0], rgb[1], rgb[2], 0.07 + r() * 0.07, 4 + r() * 4, 9.8, 0, 0.4, 1);
    }
    rubbish(x, y) {
      const r = this.r;
      for (let i = 0; i < 14; i++) { const c = [[0.9, 0.9, 0.85], [0.3, 0.6, 0.9], [0.8, 0.2, 0.2], [0.2, 0.6, 0.3]][i % 4]; this.bits.emit(x, 0.6, -y, (r() - 0.5) * 3, 1 + r() * 2, (r() - 0.5) * 3, c[0], c[1], c[2], 0.08, 6, 9.8, 0, 0.6, 1); }
    }
    skid(car, idx, x, y, a) {
      const key = car.index * 4 + idx;
      const last = this.lastSkid.get(key);
      this.lastSkid.set(key, { x, y, t: performance.now() });
      if (!last || performance.now() - last.t > 120) return;
      const dx = x - last.x, dy = y - last.y, l = Math.hypot(dx, dy);
      if (l < 0.05 || l > 3) return;
      this.e.set(0, Math.atan2(dy, dx), 0); this.q.setFromEuler(this.e);
      this.m4.compose(new THREE.Vector3((x + last.x) / 2, 0.015 + (car.wheelH[idx] || 0), -(y + last.y) / 2), this.q, new THREE.Vector3(l, 1, 1));
      this.skids.setMatrixAt(this.skidHead, this.m4); this.skidHead = (this.skidHead + 1) % this.skidN;
      this.skids.instanceMatrix.needsUpdate = true;
    }
    // bumper debris bodies from the sim
    addDebris(body, car) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(body.hy * 2, 0.28, body.hx * 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(car.paint).multiplyScalar(0.9), roughness: 0.5 }));
      g.castShadow = true; this.scene.add(g); this.debris.set(body, g);
    }
    removeDebris(body) { const g = this.debris.get(body); if (g) { this.scene.remove(g); this.debris.delete(body); } }
    update(dt) {
      this.add.update(dt); this.soft.update(dt); this.bits.update(dt);
      for (const [b, g] of this.debris) { g.position.set(b.x, 0.16, -b.y); g.rotation.set(0, b.a + Math.PI / 2, 0.25); }
    }
  }
  LS.FX = FX;
})(window.LS);
