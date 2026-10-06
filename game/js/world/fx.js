/* Living details: chimney smoke, falling leaves, the Jubilee fireworks over 1897 (each burst lights
   the street for a moment and its bang arrives late, at the speed of sound) and pigeons that scatter
   when you run at them. Smoke, leaves and sparks move in closed form on the GPU from the shared
   clock, so they cost no CPU time per frame; only the pigeons and the firework launcher run here. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const FX = (SA.FX = { eras: {}, scaleU: { value: 600 } });

  // round soft sprites placed by the vertex shader (body sets pos, size in metres, col)
  function pointsMaterial(body, opts) {
    opts = opts || {};
    const uniforms = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { uTime: SA.Render.time, uScale: FX.scaleU }, opts.uniforms || {});
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform float uTime; uniform float uScale;
        ${opts.head || ''}
        varying vec4 vCol;
        #include <fog_pars_vertex>
        void main() {
          vec3 pos = vec3(0.0); float size = 0.0; vec4 col = vec4(0.0);
          ${body}
          vCol = col;
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = size <= 0.0 ? 0.0 : clamp(size * uScale / max(0.2, -mvPosition.z), 1.0, 256.0);
          #include <fog_vertex>
        }`,
      fragmentShader: `
        varying vec4 vCol;
        #include <fog_pars_fragment>
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, ${opts.hard ? '0.25' : '0.0'}, d) * vCol.a;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vCol.rgb, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          ${opts.noFog ? '' : '#include <fog_fragment>'}
        }`,
      transparent: true,
      depthWrite: false,
      fog: !opts.noFog,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
  }
  function pointsGeo(n, attrs) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (const k in attrs) g.setAttribute(k, new THREE.BufferAttribute(attrs[k].array, attrs[k].size));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return g;
  }
  const hash = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // ---------------------------------------------------------------- per-era effects
  FX.buildEra = function (e) {
    const out = { group: new THREE.Group(), eraId: e.id };
    out.group.name = 'fx-' + e.id;
    // chimney smoke: coal fires on Jubilee night and in 1964, none in 2026
    const rate = e.id === 1897 ? 0.4 : e.id === 1964 ? 0.28 : 0;
    const smokers = (e.chimneys || []).filter((c, i) => hash(i + e.id) < rate);
    if (smokers.length) {
      const per = 10, n = smokers.length * per;
      const org = new Float32Array(n * 3), seed = new Float32Array(n * 4);
      smokers.forEach((c, i) => {
        for (let k = 0; k < per; k++) {
          const j = i * per + k;
          org[j * 3] = c.x;
          org[j * 3 + 1] = c.y + c.h + 0.1;
          org[j * 3 + 2] = c.z;
          seed[j * 4] = k / per + hash(i) * 0.1;
          seed[j * 4 + 1] = hash(j * 3 + 1);
          seed[j * 4 + 2] = hash(j * 3 + 2);
          seed[j * 4 + 3] = 0.7 + hash(j * 3 + 3) * 0.6;
        }
      });
      const m = pointsMaterial(`
        float t = fract(uTime / 10.0 + aSeed.x);
        float rise = t * 7.0;
        pos = aOrigin + vec3(uWind.x * rise + (aSeed.y - 0.5) * t * 2.0, rise, uWind.y * rise + (aSeed.z - 0.5) * t * 2.0);
        size = (0.5 + t * 3.8) * aSeed.w;
        col = vec4(uSmoke * (0.85 + 0.3 * aSeed.y), (1.0 - t) * smoothstep(0.0, 0.1, t) * uSmokeA);`,
      { head: 'attribute vec3 aOrigin; attribute vec4 aSeed; uniform vec2 uWind; uniform vec3 uSmoke; uniform float uSmokeA;', uniforms: { uWind: { value: new THREE.Vector2(0.55, 0.22) }, uSmoke: { value: new THREE.Color(e.id === 1897 ? 0x2a2e3a : 0x5e5a55) }, uSmokeA: { value: e.id === 1897 ? 0.5 : 0.42 } } });
      const pts = new THREE.Points(pointsGeo(n, { aOrigin: { array: org, size: 3 }, aSeed: { array: seed, size: 4 } }), m);
      pts.frustumCulled = false;
      pts.renderOrder = 5;
      pts.name = 'fx-smoke';
      out.group.add(pts);
    }
    // October leaves drifting down from the street trees
    const trees = (e.props && e.props.trees) || [];
    if (e.id !== 1897 && trees.length) {
      const per = 8, n = trees.length * per;
      const org = new Float32Array(n * 4), seed = new Float32Array(n * 4);
      trees.forEach((tr, i) => {
        const y = SA.Terrain.height(tr.x, tr.z);
        for (let k = 0; k < per; k++) {
          const j = i * per + k;
          org[j * 4] = tr.x;
          org[j * 4 + 1] = y;
          org[j * 4 + 2] = tr.z;
          org[j * 4 + 3] = tr.s;
          seed[j * 4] = hash(j * 7 + 1);
          seed[j * 4 + 1] = hash(j * 7 + 2);
          seed[j * 4 + 2] = hash(j * 7 + 3);
          seed[j * 4 + 3] = hash(j * 7 + 4);
        }
      });
      const m = pointsMaterial(`
        float t = fract(uTime / 9.0 + aSeed.x);
        float h0 = (4.5 + aSeed.y * 3.5) * aOrigin.w;
        float a = aSeed.z * 6.2832;
        float r = (0.6 + aSeed.w * 2.2) * aOrigin.w;
        float flutter = sin(uTime * (2.0 + aSeed.y * 2.0) + aSeed.z * 30.0);
        pos = aOrigin.xyz + vec3(cos(a) * r + t * 3.0 + flutter * 0.35 * t, h0 * (1.0 - t) + 0.05, sin(a) * r + t * 1.2 + cos(uTime * 1.7 + aSeed.w * 20.0) * 0.3 * t);
        size = 0.075;
        vec3 c = mix(vec3(0.55, 0.32, 0.06), vec3(0.62, 0.5, 0.12), aSeed.w);
        col = vec4(c * (0.55 + 0.45 * abs(sin(uTime * 6.0 + aSeed.y * 40.0))), smoothstep(1.0, 0.9, t) * smoothstep(0.0, 0.04, t));`,
      { head: 'attribute vec4 aOrigin; attribute vec4 aSeed;', hard: true });
      const pts = new THREE.Points(pointsGeo(n, { aOrigin: { array: org, size: 4 }, aSeed: { array: seed, size: 4 } }), m);
      pts.frustumCulled = false;
      pts.name = 'fx-leaves';
      out.group.add(pts);
    }
    e.group.add(out.group);
    FX.eras[e.id] = out;
    return out;
  };

  // ---------------------------------------------------------------- fireworks (1897)
  const G = -3.6; // effective gravity on sparks (with air drag)
  function fireworks(scene) {
    const F = { rockets: [], bursts: [], t: 6, scene };
    for (let i = 0; i < 3; i++) {
      const n = 16;
      const k = new Float32Array(n);
      for (let j = 0; j < n; j++) k[j] = j;
      const m = pointsMaterial(`
        float a = uTime - uStart - aK * 0.035;
        if (uStart > 0.0 && a > 0.0 && uTime - uStart < uFuse) {
          pos = uLaunch + uVel * a + vec3(0.0, -2.0 * a * a, 0.0);
          size = aK < 0.5 ? 0.9 : 0.55 * (1.0 - aK / 16.0);
          col = vec4(vec3(1.0, 0.75, 0.4) * (aK < 0.5 ? 6.0 : 2.5 * (1.0 - aK / 16.0)), 1.0);
        }`, { head: 'attribute float aK; uniform float uStart; uniform float uFuse; uniform vec3 uLaunch; uniform vec3 uVel;', uniforms: { uStart: { value: -1 }, uFuse: { value: 1 }, uLaunch: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3() } }, additive: true, noFog: true });
      const pts = new THREE.Points(pointsGeo(n, { aK: { array: k, size: 1 } }), m);
      pts.frustumCulled = false;
      pts.renderOrder = 6;
      pts.visible = false;
      scene.add(pts);
      F.rockets.push({ pts, m, busy: false });
    }
    for (let i = 0; i < 3; i++) {
      const n = 220;
      const dir = new Float32Array(n * 4);
      for (let j = 0; j < n; j++) {
        // a shell of stars, a few slower ones inside
        let x, y, z;
        do {
          x = Math.random() * 2 - 1;
          y = Math.random() * 2 - 1;
          z = Math.random() * 2 - 1;
        } while (x * x + y * y + z * z > 1 || x * x + y * y + z * z < 0.05);
        const l = Math.hypot(x, y, z);
        const shell = Math.random() < 0.8 ? 1 : 0.4 + Math.random() * 0.4;
        dir[j * 4] = (x / l) * shell;
        dir[j * 4 + 1] = (y / l) * shell;
        dir[j * 4 + 2] = (z / l) * shell;
        dir[j * 4 + 3] = Math.random();
      }
      const m = pointsMaterial(`
        float a = uTime - uStart;
        if (uStart > 0.0 && a > 0.0 && a < uLife) {
          vec3 v = aDir.xyz * uSpeed * (0.9 + 0.2 * aDir.w);
          vec3 d = v * (1.0 - exp(-1.3 * a)) / 1.3;
          pos = uOrigin + d + vec3(0.0, ${G.toFixed(2)} * 0.5 * a * a, 0.0);
          float life = a / (uLife * (0.75 + 0.25 * aDir.w));
          float tw = aDir.w > 0.6 ? step(0.45, fract(sin(aDir.w * 91.0 + floor(uTime * 22.0)) * 43758.5)) : 1.0;
          vec3 c = mix(uCol1, uCol2, smoothstep(0.2, 0.8, life));
          float fade = pow(max(0.0, 1.0 - life), 1.6);
          size = (1.6 - life) * 1.4;
          col = vec4(c * (4.0 + 6.0 * exp(-a * 4.0)) * fade * tw, 1.0);
        }`, { head: 'attribute vec4 aDir; uniform float uStart; uniform float uLife; uniform float uSpeed; uniform vec3 uOrigin; uniform vec3 uCol1; uniform vec3 uCol2;', uniforms: { uStart: { value: -1 }, uLife: { value: 2.6 }, uSpeed: { value: 16 }, uOrigin: { value: new THREE.Vector3() }, uCol1: { value: new THREE.Color() }, uCol2: { value: new THREE.Color() } }, additive: true, noFog: true });
      const pts = new THREE.Points(pointsGeo(n, { aDir: { array: dir, size: 4 } }), m);
      pts.frustumCulled = false;
      pts.renderOrder = 6;
      pts.visible = false;
      scene.add(pts);
      F.bursts.push({ pts, m, busy: false, t: 0 });
    }
    // one light, always in the scene (so the shaders never recompile), dark until a shell bursts
    F.light = new THREE.PointLight(0xffffff, 0, 0, 2);
    F.light.castShadow = false;
    scene.add(F.light);
    F.flash = 0;
    return F;
  }
  const PALETTE = [[0xff3a2a, 0xffd27a], [0x3a7bff, 0xffffff], [0xfff4d0, 0xffb040], [0x5aff7a, 0xfff0a0], [0xff6ad0, 0xffe0f0], [0xffc040, 0xff5020]];
  // the display site: the open ground of Bernards Heath, north of the town
  const SITE = { x: 120, z: -360 };
  function launch(F, now) {
    const r = F.rockets.find((x) => !x.busy);
    if (!r) return;
    const cam = SA.Game.camera().position;
    // mostly from the display, sometimes a rocket from someone's yard nearer by
    const near = Math.random() < 0.25;
    const ang = Math.random() * Math.PI * 2;
    const x = near ? cam.x + Math.cos(ang) * (70 + Math.random() * 60) : SITE.x + (Math.random() - 0.5) * 60;
    const z = near ? cam.z + Math.sin(ang) * (70 + Math.random() * 60) : SITE.z + (Math.random() - 0.5) * 60;
    const y = SA.Terrain.height(U.clamp(x, -400, 400), U.clamp(z, -400, 400));
    const fuse = 1.5 + Math.random() * 0.6;
    const vy = 30 + Math.random() * 8;
    r.busy = true;
    r.m.uniforms.uStart.value = now;
    r.m.uniforms.uFuse.value = fuse;
    r.m.uniforms.uLaunch.value.set(x, y + 2, z);
    r.m.uniforms.uVel.value.set((Math.random() - 0.5) * 4, vy, (Math.random() - 0.5) * 4);
    r.pts.visible = true;
    const d = Math.hypot(x - cam.x, z - cam.z);
    SA.after(d / 343, () => SA.Audio && SA.Audio.sfx('fwLaunch', x, z, 4));
    // where the shell will be when its fuse burns down
    r.end = now + fuse;
    r.at = [x + r.m.uniforms.uVel.value.x * fuse, y + 2 + vy * fuse - 2 * fuse * fuse, z + r.m.uniforms.uVel.value.z * fuse];
  }
  function burst(F, x, y, z) {
    const b = F.bursts.find((q) => !q.busy) || F.bursts[0];
    const now = SA.Render.time.value;
    const pal = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    b.busy = true;
    b.t = 0;
    const u = b.m.uniforms;
    u.uStart.value = now;
    u.uLife.value = 2.2 + Math.random() * 1.2;
    u.uSpeed.value = 13 + Math.random() * 9;
    u.uOrigin.value.set(x, y, z);
    u.uCol1.value.set(pal[0]);
    u.uCol2.value.set(pal[1]);
    b.pts.visible = true;
    F.light.position.set(x, y, z);
    F.light.color.set(pal[0]).lerp(new THREE.Color(1, 1, 1), 0.4);
    F.flash = 1;
    const cam = SA.Game.camera().position;
    const d = Math.hypot(x - cam.x, z - cam.z, y - cam.y);
    SA.after(d / 343, () => SA.Audio && SA.Audio.sfx('fwBoom', x, z, 9));
    SA.after(d / 343 + 0.5, () => SA.Audio && SA.Audio.sfx('fwCrackle', x, z, 5));
    b.end = now + u.uLife.value + 0.3;
  }
  function updateFireworks(F, dt) {
    const now = SA.Render.time.value;
    for (const r of F.rockets) {
      if (r.busy && now >= r.end) {
        r.busy = false;
        r.pts.visible = false;
        if (SA.Game.era === 1897) burst(F, r.at[0], r.at[1], r.at[2]);
      }
    }
    for (const b of F.bursts) {
      if (b.busy && now >= b.end) {
        b.busy = false;
        b.pts.visible = false;
      }
    }
    const on = SA.Game.era === 1897 && SA.Game.state === 'play' && !(SA.TimeKey && SA.TimeKey.trans);
    if (on) {
      F.t -= dt;
      if (F.t <= 0) {
        // shells go up in little volleys
        launch(F, SA.Render.time.value);
        F.t = Math.random() < 0.35 ? 0.6 + Math.random() * 0.8 : 5 + Math.random() * 7;
      }
    }
    F.flash = Math.max(0, F.flash - dt * 2.2);
    F.light.intensity = SA.Game.era === 1897 ? F.flash * F.flash * 26000 : 0;
  }
  FX.burst = (x, y, z) => FX.fw && burst(FX.fw, x, y, z);

  // ---------------------------------------------------------------- pigeons
  const FLOCKS = [{ n: 9, at: 'clocktower', dx: 8, dz: 6 }, { n: 8, x: -12, z: 18 }, { n: 7, x: 60, z: -40 }];
  function pigeons(scene) {
    const P = { list: [] };
    const body = THREE.BufferGeometryUtils.mergeGeometries([
      new THREE.SphereGeometry(0.1, 10, 7).scale(0.85, 0.82, 1.55).translate(0, 0.11, 0),
      new THREE.SphereGeometry(0.052, 8, 6).translate(0, 0.21, 0.14),
      new THREE.ConeGeometry(0.012, 0.035, 5).rotateX(Math.PI / 2).translate(0, 0.205, 0.198),
      new THREE.BoxGeometry(0.1, 0.012, 0.12).translate(0, 0.1, -0.2),
      new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4).translate(0.03, 0.035, 0),
      new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4).translate(-0.03, 0.035, 0),
    ].map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      return g;
    }));
    const wing = new THREE.BoxGeometry(0.24, 0.012, 0.13).translate(0.12, 0, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f7682, roughness: 0.8, metalness: 0 });
    P.body = new THREE.InstancedMesh(body, mat, 40);
    P.wings = new THREE.InstancedMesh(wing, mat, 80);
    for (const m of [P.body, P.wings]) {
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    }
    P.reset = function () {
      P.list = [];
      const ct = SA.Landmarks.clockTowerInfo;
      for (const f of FLOCKS) {
        const hx = f.at === 'clocktower' ? ct.x + f.dx : f.x, hz = f.at === 'clocktower' ? ct.z + f.dz : f.z;
        for (let i = 0; i < f.n; i++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 2.5;
          const p = { hx, hz, x: hx + Math.cos(a) * r, z: hz + Math.sin(a) * r, y: 0, yaw: Math.random() * 6.28, mode: 'ground', t: Math.random() * 5, vx: 0, vy: 0, vz: 0, flap: 0, peck: Math.random() * 3 };
          p.y = SA.Terrain.height(p.x, p.z);
          if (!SA.World.current || SA.World.current.col.isFree(p.x, p.z, 0.2, 'walk')) P.list.push(p);
        }
      }
    };
    const M = new THREE.Matrix4(), W = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V3 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
    P.update = function (dt) {
      const pl = SA.Player.pos();
      const ps = SA.Player.vehicle ? Math.abs(SA.Player.vehicle.speed) : SA.Player.ch.speedNow || 0;
      let bi = 0, wi = 0;
      let scared = 0;
      for (const p of P.list) {
        p.t += dt;
        const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz);
        if (p.mode === 'ground') {
          // peck and shuffle about; take off if someone comes at them quickly
          p.peck -= dt;
          if (p.peck < 0) {
            p.peck = 1 + Math.random() * 3;
            p.yaw += (Math.random() - 0.5) * 2;
          }
          const step = Math.sin(p.t * 3) > 0.6 ? 0.12 : 0;
          p.x += Math.sin(p.yaw) * step * dt;
          p.z += Math.cos(p.yaw) * step * dt;
          if (Math.hypot(p.x - p.hx, p.z - p.hz) > 3.5) p.yaw = Math.atan2(p.hx - p.x, p.hz - p.z);
          p.y = SA.Terrain.height(p.x, p.z);
          if (d < (ps > 2.4 ? 5 : 1.6) && (ps > 2.4 || d < 1.6)) {
            p.mode = 'fly';
            p.t = 0;
            const l = d || 1;
            p.vx = (dx / l) * (3 + Math.random() * 2) + (Math.random() - 0.5) * 2;
            p.vz = (dz / l) * (3 + Math.random() * 2) + (Math.random() - 0.5) * 2;
            p.vy = 3.5 + Math.random() * 1.5;
            scared++;
          }
        } else if (p.mode === 'fly') {
          // climb away, circle the square, then glide back down to it
          const k = p.t;
          if (k < 2) {
            p.vy = Math.max(p.vy - dt * 1.2, 1.2);
          } else {
            const ox = p.x - p.hx, oz = p.z - p.hz;
            const ang = Math.atan2(oz, ox) + dt * 0.45;
            const R = 11;
            const tx = p.hx + Math.cos(ang) * R, tz = p.hz + Math.sin(ang) * R;
            const ground = SA.Terrain.height(p.hx, p.hz);
            const ty = k > 10 ? ground : ground + 9 + Math.sin(k) * 1.5;
            p.vx += (tx - p.x) * dt * 1.2 - p.vx * dt * 0.8;
            p.vz += (tz - p.z) * dt * 1.2 - p.vz * dt * 0.8;
            p.vy += (ty - p.y) * dt * 1.0 - p.vy * dt * 1.2;
            if (k > 10 && Math.hypot(p.x - p.hx, p.z - p.hz) < R + 2) {
              p.vx += (p.hx - p.x) * dt * 0.8;
              p.vz += (p.hz - p.z) * dt * 0.8;
            }
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.yaw = Math.atan2(p.vx, p.vz);
          const g = SA.Terrain.height(p.x, p.z);
          if (p.t > 10 && p.y <= g + 0.05) {
            p.y = g;
            p.mode = 'ground';
            p.t = 0;
          }
          if (p.y < g) p.y = g;
          if (p.t > 30) {
            p.x = p.hx + (Math.random() - 0.5) * 3;
            p.z = p.hz + (Math.random() - 0.5) * 3;
            p.y = SA.Terrain.height(p.x, p.z);
            p.mode = 'ground';
            p.t = 0;
          }
        }
        // draw
        const flying = p.mode === 'fly';
        const bob = flying ? 0 : Math.max(0, Math.sin(p.t * 7 + p.hx)) * (p.peck < 0.5 ? 0.35 : 0);
        E.set(flying ? -U.clamp(p.vy * 0.08, -0.4, 0.5) : bob, p.yaw, 0, 'YXZ');
        Q.setFromEuler(E);
        M.compose(V3.set(p.x, p.y, p.z), Q, S1);
        if (bi < 40) P.body.setMatrixAt(bi++, M);
        const flap = flying ? Math.sin(p.t * (p.t < 2 ? 26 : 14)) * 0.9 + 0.2 : -1.35;
        for (const side of [1, -1]) {
          if (wi >= 80) break;
          E.set(0, 0, side * flap, 'XYZ');
          Q.setFromEuler(E);
          W.compose(V3.set(side * 0.06, 0.15, 0.0), Q, V3.clone().set(side, 1, 1));
          W.premultiply(M);
          P.wings.setMatrixAt(wi++, W);
        }
      }
      P.body.count = bi;
      P.wings.count = wi;
      P.body.instanceMatrix.needsUpdate = true;
      P.wings.instanceMatrix.needsUpdate = true;
      if (scared && SA.Audio) SA.Audio.sfx('flutter', pl.x, pl.z, 0.8);
    };
    return P;
  }

  // ---------------------------------------------------------------- lifecycle
  FX.init = function (scene) {
    FX.fw = fireworks(scene);
    FX.pigeons = pigeons(scene);
    FX.pigeons.reset();
    SA.on('era', () => FX.pigeons.reset());
  };
  FX.update = function (dt) {
    const R = SA.Render;
    const cam = R.camera;
    FX.scaleU.value = R.renderer.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    for (const k in FX.eras) FX.eras[k].group.visible = +k === SA.Game.era || !!(SA.TimeKey && SA.TimeKey.trans);
    if (FX.fw) updateFireworks(FX.fw, dt);
    if (FX.pigeons && SA.Game.state !== 'loading') FX.pigeons.update(dt);
  };
})();
