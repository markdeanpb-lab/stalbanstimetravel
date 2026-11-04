/* Effects: pyro sparks, confetti and the championship belt. */
(function () {
  'use strict';
  const AR = (window.AR = window.AR || {});

  // ------------------------------------------------------------------ sparks (pyro fountains and bursts)
  AR.Sparks = function (scene, max) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aAge = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('color', this.aCol);
    g.setAttribute('aFade', this.aAge);
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: window.innerHeight } },
      vertexShader: `attribute vec3 color; attribute float aFade; uniform float uScale; varying vec3 vC; varying float vF;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vC = color; vF = aFade;
          gl_PointSize = uScale * 0.07 * (0.4 + aFade) / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vF; void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 14.0) * vF;
          gl_FragColor = vec4(vC * a * 5.0, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.mat = m;
    this.emitters = [];
  };
  AR.Sparks.prototype.spawn = function (p, v, life, c) {
    let i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.life[i] = life;
    this.age[i] = 0;
    this.col.set(c, i * 3);
  };
  // a fountain that keeps spraying for `dur` seconds
  AR.Sparks.prototype.fountain = function (p, dur, color, power = 1) {
    this.emitters.push({ p: p.clone(), t: 0, dur, color, power, kind: 'fountain' });
  };
  AR.Sparks.prototype.burst = function (p, n, color, speed = 6) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.6));
      this.spawn(p, v, 0.9 + Math.random() * 0.8, color);
    }
  };
  AR.Sparks.prototype.update = function (dt) {
    const v = new THREE.Vector3();
    for (let k = this.emitters.length - 1; k >= 0; k--) {
      const e = this.emitters[k];
      e.t += dt;
      const n = Math.floor(dt * 260 * e.power) + 1;
      for (let i = 0; i < n; i++) {
        v.set((Math.random() - 0.5) * 1.6, 7 + Math.random() * 4 * e.power, (Math.random() - 0.5) * 1.6);
        const c = Math.random() < 0.3 ? [1, 1, 0.9] : e.color;
        this.spawn(e.p, v, 0.8 + Math.random() * 0.7, c);
      }
      if (e.t > e.dur) this.emitters.splice(k, 1);
    }
    const P = this.pos, V = this.vel, fade = this.aAge.array;
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) {
        fade[i] = 0;
        continue;
      }
      this.age[i] += dt;
      V[i * 3 + 1] -= 9.8 * dt;
      V[i * 3] *= 1 - dt * 0.6;
      V[i * 3 + 2] *= 1 - dt * 0.6;
      P[i * 3] += V[i * 3] * dt;
      P[i * 3 + 1] += V[i * 3 + 1] * dt;
      P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (P[i * 3 + 1] < 0.02) {
        P[i * 3 + 1] = 0.02;
        V[i * 3 + 1] *= -0.3;
      }
      const f = 1 - this.age[i] / this.life[i];
      fade[i] = f * (0.7 + 0.3 * Math.sin(this.age[i] * 40 + i));
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aAge.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.n);
  };

  // ------------------------------------------------------------------ confetti
  AR.Confetti = function (scene, n) {
    const g = new THREE.PlaneGeometry(0.05, 0.08);
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, metalness: 0.3, emissive: 0x222222 });
    this.mesh = new THREE.InstancedMesh(g, m, n);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.n = n;
    this.p = [];
    const cols = [0xffcf1a, 0x1d4ad0, 0xffffff, 0xffcf1a, 0xd8a634];
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.p.push({ x: 0, y: -10, z: 0, vy: 0, ph: Math.random() * 10, sp: 1 + Math.random() * 2, ax: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize() });
      this.mesh.setColorAt(i, c.setHex(cols[i % cols.length]));
    }
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
  };
  AR.Confetti.prototype.drop = function (cx, cz, r, h) {
    this.mesh.visible = true;
    for (const q of this.p) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      q.x = cx + Math.cos(a) * d;
      q.z = cz + Math.sin(a) * d;
      q.y = h + Math.random() * 6;
      q.vy = -(0.6 + Math.random() * 0.6);
    }
    this.active = 30;
  };
  AR.Confetti.prototype.update = function (t, dt) {
    if (!this.mesh.visible) return;
    this.active -= dt;
    for (let i = 0; i < this.n; i++) {
      const q = this.p[i];
      if (q.y > 0.01) {
        q.y += q.vy * dt;
        q.x += Math.sin(t * q.sp + q.ph) * 0.5 * dt;
        q.z += Math.cos(t * q.sp * 0.8 + q.ph) * 0.5 * dt;
      }
      this._q.setFromAxisAngle(q.ax, q.y > 0.02 ? t * q.sp * 3 + q.ph : q.ph);
      this._v.set(q.x, Math.max(q.y, 0.015), q.z);
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.active < 0) this.mesh.visible = false;
  };

  // ------------------------------------------------------------------ the championship belt
  AR.makeBelt = function () {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xe0b042, roughness: 0.22, metalness: 1 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55 });
    const jewel = new THREE.MeshStandardMaterial({ color: 0x1d4ad0, roughness: 0.1, metalness: 0.3, emissive: 0x0a1a60 });
    // the strap, gently curved
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.11, 32, 1, true, -1.25, 2.5), leather);
    strap.scale.set(1.9, 1, 1); // an arc behind the plate, wrapping back towards the wearer
    strap.material.side = THREE.DoubleSide;
    strap.position.z = -0.17;
    g.add(strap);
    // centre plate: an extruded shield with a raised rim
    const sh = new THREE.Shape();
    sh.moveTo(-0.15, 0.1);
    sh.quadraticCurveTo(0, 0.17, 0.15, 0.1);
    sh.lineTo(0.17, -0.04);
    sh.quadraticCurveTo(0, -0.17, -0.17, -0.04);
    sh.closePath();
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }), gold);
    plate.position.z = 0.03;
    g.add(plate);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 8), jewel);
    gem.scale.z = 0.4;
    gem.position.set(0, 0.02, 0.055);
    g.add(gem);
    // a canvas face for the plate: the word CHAMPION
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#7a5410';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '900 40px "Arial Black", Arial, sans-serif';
    x.fillText('CHAMPION', 128, 96);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.3, metalness: 0.8 }));
    label.position.set(0, -0.02, 0.05);
    g.add(label);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 16), gold);
      side.rotation.x = Math.PI / 2;
      side.position.set(s * 0.26, 0, 0.0);
      g.add(side);
    }
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return g;
  };
})();
