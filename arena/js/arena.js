/* The arena: ring, ringside, barricades, entrance stage with a big screen, ramp, lighting rig and a
   bowl of a few thousand cheering fans. Everything is generated here at load time.
   Layout (metres): the ring is centred on the origin, the mat 1.2 m up; the entrance stage is to the
   north (-z) and the ramp runs from it down to the ringside floor. */
(function () {
  'use strict';
  const AR = (window.AR = window.AR || {});

  const RING_H = 1.2; // mat height
  const PLAT = 3.6; // half-size of the ring platform
  const POST = 3.3; // corner posts
  const ROPE_Y = [0.5, 0.95, 1.4]; // above the mat
  const BAR = 7.8; // barricade half-size
  const AISLE = 2.3; // half-width of the ramp aisle
  const STAGE_Z = -16; // front edge of the stage
  const STAGE_BACK = -22;
  const STAGE_HW = 10;
  const STAND0 = 14; // front wall of the raised stands
  const ROWS = 18;
  AR.DIM = { RING_H, PLAT, POST, ROPE_Y, BAR, AISLE, STAGE_Z, STAGE_BACK };

  // ------------------------------------------------------------------ helpers
  function canvasTex(w, h, draw, opts = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (opts.repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    t.canvas = c;
    return t;
  }
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function wideText(g, text, x, y, sx) {
    g.save();
    g.translate(x, y);
    g.scale(sx, 1);
    g.fillText(text, 0, 0);
    g.restore();
  }

  // ------------------------------------------------------------------ textures
  function matTexture() {
    return canvasTex(1024, 1024, (g, W, H) => {
      g.fillStyle = '#b9bab8';
      g.fillRect(0, 0, W, H);
      // canvas weave and wear
      for (let i = 0; i < 26000; i++) {
        const v = 160 + rnd() * 50;
        g.fillStyle = `rgba(${v},${v},${v - 4},0.25)`;
        g.fillRect(rnd() * W, rnd() * H, 2, 2);
      }
      for (let i = 0; i < 60; i++) {
        const x = rnd() * W, y = rnd() * H, r = 10 + rnd() * 50;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(90,90,95,0.10)');
        gr.addColorStop(1, 'rgba(90,90,95,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // centre logo, faded into the canvas
      g.save();
      g.translate(W / 2, H / 2);
      g.globalAlpha = 0.5;
      g.strokeStyle = '#2a4aa8';
      g.lineWidth = 14;
      g.beginPath();
      g.arc(0, 0, 200, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#2a4aa8';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '900 120px "Arial Black", Arial, sans-serif';
      wideText(g, 'SS', 0, -10, 1.1);
      g.font = 'bold 40px Arial, sans-serif';
      g.fillText('STRIDERS SLAM', 0, 110);
      g.restore();
      // the apron beyond the ropes: a darker band at the edge
      const band = (W * 0.3) / 7.2;
      g.fillStyle = '#3a3c42';
      g.fillRect(0, 0, W, band * 0.5);
      g.fillRect(0, H - band * 0.5, W, band * 0.5);
      g.fillRect(0, 0, band * 0.5, H);
      g.fillRect(W - band * 0.5, 0, band * 0.5, H);
    });
  }
  function apronTexture() {
    return canvasTex(2048, 320, (g, W, H) => {
      g.fillStyle = '#0b0b0e';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffcf1a';
      g.fillRect(0, 0, W, 10);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '900 150px "Arial Black", Arial, sans-serif';
      const gr = g.createLinearGradient(0, 80, 0, 240);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(1, '#9aa6c8');
      g.fillStyle = gr;
      wideText(g, 'STRIDERS  SLAM', W / 2, H / 2 + 6, 1.15);
      g.fillStyle = '#ffcf1a';
      for (const x of [140, W - 140]) {
        star(g, x, H / 2, 60, 26);
      }
    });
  }
  function star(g, x, y, R, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r : R;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }
  function padTexture() {
    return canvasTex(256, 128, (g, W, H) => {
      g.fillStyle = '#0d0d10';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#d4202a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'italic 900 64px "Arial Black", Arial, sans-serif';
      wideText(g, 'STRIDE', W / 2, H / 2 + 4, 0.8);
    });
  }
  function floorTexture() {
    return canvasTex(512, 512, (g, W, H) => {
      g.fillStyle = '#17171a';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 9000; i++) {
        const v = 15 + rnd() * 25;
        g.fillStyle = `rgba(${v},${v},${v + 3},0.6)`;
        g.fillRect(rnd() * W, rnd() * H, 2, 2);
      }
    }, { repeat: [40, 40] });
  }
  function ledTexture() {
    // scrolled along the stands' front wall
    return canvasTex(2048, 64, (g, W, H) => {
      g.fillStyle = '#05060a';
      g.fillRect(0, 0, W, H);
      g.textBaseline = 'middle';
      g.font = '900 44px "Arial Black", Arial, sans-serif';
      const items = [['ST ALBANS STRIDERS', '#ffcf1a'], ['★', '#ffffff'], ['STRIDERS SLAM', '#4f8bff'], ['★', '#ffffff'], ['#1538', '#ffcf1a'], ['★', '#ffffff'], ['HERTS ARENA', '#ff4d5e'], ['★', '#ffffff']];
      let x = 20;
      while (x < W) {
        for (const [t, c] of items) {
          g.fillStyle = c;
          g.fillText(t, x, H / 2 + 2);
          x += g.measureText(t).width + 40;
          if (x > W) break;
        }
      }
    }, { repeat: [1, 1] });
  }
  function tableTexture() {
    return canvasTex(1024, 256, (g, W, H) => {
      g.fillStyle = '#0c0c10';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffcf1a';
      g.fillRect(0, H - 14, W, 14);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.font = '900 86px "Arial Black", Arial, sans-serif';
      wideText(g, 'STRIDERS SLAM', W / 2, H / 2, 1);
    });
  }

  // ------------------------------------------------------------------ crowd
  function crowdGeometry() {
    // one fan, facing +z, standing on y = 0. aPart: 0 legs, 1 torso, 2 skin, 3 sleeve, 4 hair; aArm: -1/1 for arms
    const parts = [];
    function add(geo, part, arm, ty) {
      geo = geo.toNonIndexed();
      geo.deleteAttribute('uv');
      const n = geo.attributes.position.count;
      geo.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
      geo.setAttribute('aArm', new THREE.Float32BufferAttribute(new Float32Array(n).fill(arm), 1));
      if (ty !== undefined) {
        // sleeves on the upper arm, skin below
        const a = geo.attributes.aPart.array, p = geo.attributes.position.array;
        for (let i = 0; i < n; i++) a[i] = p[i * 3 + 1] > ty ? 3 : 2;
      }
      parts.push(geo);
    }
    const legs = new THREE.CylinderGeometry(0.16, 0.13, 0.86, 7, 1);
    legs.scale(1, 1, 0.7);
    legs.translate(0, 0.43, 0);
    add(legs, 0, 0);
    const torso = new THREE.CylinderGeometry(0.2, 0.17, 0.62, 8, 1);
    torso.scale(1, 1, 0.62);
    torso.translate(0, 1.16, 0);
    add(torso, 1, 0);
    const sh = new THREE.SphereGeometry(0.2, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    sh.scale(1, 0.35, 0.62);
    sh.translate(0, 1.47, 0);
    add(sh, 1, 0);
    const head = new THREE.SphereGeometry(0.105, 8, 6);
    head.scale(0.92, 1.1, 1);
    head.translate(0, 1.64, 0);
    add(head, 2, 0);
    const hair = new THREE.SphereGeometry(0.112, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55);
    hair.scale(0.93, 1.05, 1.02);
    hair.translate(0, 1.655, -0.008);
    add(hair, 4, 0);
    for (const s of [-1, 1]) {
      const arm = new THREE.CylinderGeometry(0.05, 0.042, 0.62, 6, 2);
      arm.translate(0, -0.31, 0); // pivot at the shoulder
      arm.translate(s * 0.235, 1.45, 0);
      add(arm, 2, s, 1.30);
    }
    const g = THREE.BufferGeometryUtils.mergeGeometries(parts);
    g.computeVertexNormals();
    return g;
  }

  function crowdMaterial(U) {
    const m = std({ color: 0xffffff, roughness: 0.85, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aPart; attribute float aArm;
attribute vec3 iShirt; attribute vec4 iMisc; // skin tone, hair shade, phase, calm (0 = excitable)
uniform float uTime, uHype, uPop; uniform vec3 uFocus;
varying vec3 vCrowd;
mat3 rotX(float a){ float c = cos(a), s = sin(a); return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c); }
mat3 rotY(float a){ float c = cos(a), s = sin(a); return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c); }`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `vec3 objectNormal = vec3( normal );
vec3 transformed = position;
float phase = iMisc.z * 6.2831;
float calm = iMisc.w;
float stand = smoothstep(calm - 0.08, calm + 0.08, uHype * 0.85 + uPop * 0.9);
float pump = 0.5 + 0.5 * sin(uTime * (6.0 + calm * 4.0) + phase);
// arms: from resting by the sides to thrown overhead, then pumping
if (aArm != 0.0) {
  // three kinds of fan: both arms up, one fist pumping, or clapping
  float style = fract(iMisc.z * 13.0);
  float raise = clamp(stand * (uPop * 1.3 + uHype * 0.45) - calm * 0.35, 0.0, 1.0);
  float a = -raise * (2.5 + 0.35 * pump * stand) - 0.12;
  float splay = aArm * raise * (0.25 + 0.15 * sin(phase * 3.0));
  float yawA = 0.0;
  if (style > 0.45 && style < 0.75 && aArm < 0.0) { a = -0.12 - 0.15 * raise; splay = 0.0; }
  if (style >= 0.75) {
    float clap = 0.5 + 0.5 * sin(uTime * 11.0 + phase);
    float k = clamp(raise * 1.5, 0.0, 1.0);
    a = -0.12 - k * 1.25;
    splay = 0.0;
    yawA = -aArm * k * (0.25 + 0.3 * clap);
  }
  vec3 piv = vec3(aArm * 0.235, 1.45, 0.0);
  vec3 q = transformed - piv;
  float cs = cos(splay), sn = sin(splay);
  q = rotX(a) * q;
  q.xy = mat2(cs, sn, -sn, cs) * q.xy;
  float cy = cos(yawA), sy = sin(yawA);
  q.xz = mat2(cy, -sy, sy, cy) * q.xz;
  transformed = piv + q;
  objectNormal = rotX(a) * objectNormal;
}
// heads follow the runner
if (aPart >= 2.0 && aArm == 0.0 && transformed.y > 1.5) {
  vec3 wp = (modelMatrix * instanceMatrix * vec4(0.0, 1.6, 0.0, 1.0)).xyz;
  vec3 fw = normalize((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  vec3 to = uFocus - wp; to.y = 0.0;
  float ang = atan(fw.x * to.z - fw.z * to.x, dot(fw.xz, to.xz));
  ang = clamp(-ang, -0.9, 0.9);
  vec3 hp = vec3(0.0, 1.55, 0.0);
  transformed = hp + rotY(ang) * (transformed - hp);
}
// seated fans sink into their seats; the excited ones bounce
transformed.y += (stand - 1.0) * 0.42 + stand * (0.03 + 0.06 * uPop) * pump;
float tone = iMisc.x;
vec3 skin = mix(vec3(0.95, 0.72, 0.58), vec3(0.32, 0.2, 0.13), tone);
vec3 hairc = mix(vec3(0.05, 0.035, 0.03), vec3(0.55, 0.38, 0.2), iMisc.y * iMisc.y);
vec3 legs = mix(vec3(0.06, 0.07, 0.1), vec3(0.18, 0.24, 0.38), fract(iMisc.z * 7.0));
vCrowd = aPart < 0.5 ? legs : aPart < 1.5 ? iShirt : aPart < 2.5 ? skin : aPart < 3.5 ? iShirt : hairc;`
        );
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCrowd;')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vCrowd, opacity );');
    };
    m.customProgramCacheKey = () => 'crowd';
    return m;
  }

  const SHIRTS = [
    [0.98, 0.8, 0.1], [0.07, 0.2, 0.62], [0.08, 0.08, 0.09], [0.9, 0.9, 0.88], [0.7, 0.08, 0.1], [0.12, 0.35, 0.18],
    [0.35, 0.35, 0.38], [0.98, 0.8, 0.1], [0.07, 0.2, 0.62], [0.55, 0.2, 0.5], [0.85, 0.45, 0.12], [0.1, 0.1, 0.12],
  ];

  function buildCrowd(scene, seats, U, quality) {
    const geo = crowdGeometry();
    const n = seats.length;
    const mesh = new THREE.InstancedMesh(geo, crowdMaterial(U), n);
    const shirt = new Float32Array(n * 3), misc = new Float32Array(n * 4);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const s = seats[i];
      const sc = 0.9 + rnd() * 0.2;
      S.set(sc, sc * (0.93 + rnd() * 0.12), sc);
      Q.setFromAxisAngle(Y, s.yaw + (rnd() - 0.5) * 0.3);
      P.set(s.x, s.y, s.z);
      M.compose(P, Q, S);
      mesh.setMatrixAt(i, M);
      const c = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
      const dark = rnd() < 0.3;
      const k = dark ? 0.12 + rnd() * 0.1 : 0.45 + rnd() * 0.3;
      shirt.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
      misc.set([Math.pow(rnd(), 1.6), rnd(), rnd(), s.floor ? rnd() * 0.35 : 0.1 + rnd() * 0.85], i * 4);
    }
    geo.setAttribute('iShirt', new THREE.InstancedBufferAttribute(shirt, 3));
    geo.setAttribute('iMisc', new THREE.InstancedBufferAttribute(misc, 4));
    mesh.castShadow = false;
    mesh.receiveShadow = quality > 1;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  // ------------------------------------------------------------------ phone flashes in the crowd
  function buildFlashes(scene, seats, U) {
    const n = Math.min(900, seats.length);
    const pos = new Float32Array(n * 3), rr = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = seats[Math.floor(rnd() * seats.length)];
      pos.set([s.x + (rnd() - 0.5) * 0.3, s.y + 1.75 + rnd() * 0.3, s.z + (rnd() - 0.5) * 0.3], i * 3);
      rr[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aR', new THREE.BufferAttribute(rr, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uFlash: U.uFlash, uScale: { value: window.innerHeight } },
      vertexShader: `attribute float aR; uniform float uTime, uFlash, uScale; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float t = fract(uTime * (0.6 + aR * 0.9) + aR * 17.0);
          vA = uFlash * step(t, 0.05) * (1.0 - t / 0.05) + 0.12 * step(0.6, aR) * step(0.35, uFlash);
          gl_PointSize = (vA > 0.01 ? 1.0 : 0.0) * uScale * (0.06 + 0.1 * vA) / -mv.z;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d);
          float a = exp(-r * 18.0) * vA; gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * a * 6.0, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    scene.add(pts);
    return m;
  }

  // ------------------------------------------------------------------ light beams (haze)
  function beamMaterial(color, strength) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ float edge = abs(dot(normalize(vN), normalize(vV))); float a = pow(edge, 1.6) * pow(vY, 1.3) * uStrength;
          gl_FragColor = vec4(uColor * a, a); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }
  function beam(scene, from, to, radius, mat) {
    const len = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(0.12, radius, len, 24, 1, true);
    g.translate(0, -len / 2, 0); // uv.y: 1 at the lamp, 0 at the far end
    const m = new THREE.Mesh(g, mat);
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
    m.renderOrder = 5;
    scene.add(m);
    return m;
  }

  // ------------------------------------------------------------------ build
  AR.buildArena = function (scene, opts) {
    const quality = opts.quality; // 1 low, 2 medium, 3 high
    const A = { solids: [], interact: [], update: null };
    const U = {
      uTime: { value: 0 },
      uHype: { value: 0.25 },
      uPop: { value: 0 },
      uFlash: { value: 0 },
      uFocus: { value: new THREE.Vector3(0, 1.5, -18) },
    };
    A.U = U;
    function solid(minX, maxX, minZ, maxZ, bottom, top, tag) {
      const s = { minX, maxX, minZ, maxZ, bottom, top, tag };
      A.solids.push(s);
      return s;
    }

    // ---- floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), std({ map: floorTexture(), roughness: 0.55, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // ringside protective mats
    const mats = new THREE.Mesh(new THREE.PlaneGeometry(BAR * 2 - 0.4, BAR * 2 - 0.4), std({ color: 0x1d2b4a, roughness: 0.8 }));
    mats.rotation.x = -Math.PI / 2;
    mats.position.y = 0.012;
    mats.receiveShadow = true;
    scene.add(mats);

    // ---- the ring
    const ring = new THREE.Group();
    scene.add(ring);
    const matTex = matTexture();
    const top = new THREE.Mesh(new THREE.PlaneGeometry(PLAT * 2, PLAT * 2), std({ map: matTex, roughness: 0.9 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = RING_H;
    top.receiveShadow = true;
    ring.add(top);
    // a padded rim around the mat
    const rimMat = std({ color: 0x2c2e34, roughness: 0.7 });
    for (const s of [-1, 1]) {
      box(PLAT * 2 + 0.08, 0.08, 0.08, rimMat, 0, RING_H - 0.02, s * PLAT, ring);
      box(0.08, 0.08, PLAT * 2 + 0.08, rimMat, s * PLAT, RING_H - 0.02, 0, ring);
    }
    // apron skirt on all four sides
    const apronTex = apronTexture();
    const skirt = std({ map: apronTex, roughness: 0.75 });
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(PLAT * 2, RING_H - 0.04), skirt);
      const a = (i * Math.PI) / 2;
      p.position.set(Math.sin(a) * (PLAT + 0.01), (RING_H - 0.04) / 2, Math.cos(a) * (PLAT + 0.01));
      p.rotation.y = a;
      p.receiveShadow = true;
      ring.add(p);
    }
    solid(-PLAT, PLAT, -PLAT, PLAT, 0, RING_H, 'ring');

    // posts, pads and ropes
    const steel = std({ color: 0x2a2c31, roughness: 0.35, metalness: 0.8 });
    const padMat = std({ color: 0x0f0f12, roughness: 0.6 });
    const padTex = padTexture();
    const padFace = std({ map: padTex, roughness: 0.55 });
    const ropeMat = std({ color: 0xe8e8ea, roughness: 0.45 });
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    A.corners = [];
    for (const [sx, sz] of corners) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, RING_H + 1.65, 12), steel);
      post.position.set(sx * POST, (RING_H + 1.65) / 2, sz * POST);
      post.castShadow = true;
      ring.add(post);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), steel);
      cap.position.set(sx * POST, RING_H + 1.65, sz * POST);
      ring.add(cap);
      solid(sx * POST - 0.12, sx * POST + 0.12, sz * POST - 0.12, sz * POST + 0.12, RING_H, RING_H + 1.7, 'post');
      // turnbuckle pads, facing into the ring
      for (const ry of ROPE_Y) {
        const pad = new THREE.Group();
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.16), [padMat, padMat, padMat, padMat, padFace, padMat]);
        b.castShadow = true;
        b.position.z = 0.08;
        pad.add(b);
        pad.position.set(sx * (POST - 0.11), RING_H + ry, sz * (POST - 0.11));
        pad.lookAt(0, RING_H + ry, 0);
        ring.add(pad);
      }
      A.corners.push({ x: sx * POST, z: sz * POST, sx, sz });
    }
    // ropes: three per side, joined by ties at the middle
    const tieMat = std({ color: 0x8a1a22, roughness: 0.7 });
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      for (const ry of ROPE_Y) {
        const a = new THREE.Vector3(ax * (POST - 0.18), RING_H + ry, az * (POST - 0.18));
        const b = new THREE.Vector3(bx * (POST - 0.18), RING_H + ry, bz * (POST - 0.18));
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y -= 0.03; // a little sag
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.026, 8, false), ropeMat);
        rope.castShadow = true;
        ring.add(rope);
      }
      const mx = ((ax + bx) / 2) * (POST - 0.18), mz = ((az + bz) / 2) * (POST - 0.18);
      for (const t of [-1.1, 1.1]) {
        const tx = mx + (az === bz ? t : 0), tz = mz + (ax === bx ? t : 0);
        box(0.03, ROPE_Y[2] - ROPE_Y[0] + 0.05, 0.03, tieMat, tx, RING_H + (ROPE_Y[0] + ROPE_Y[2]) / 2, tz, ring);
      }
    }
    // the ropes stop you walking off the mat (and climbing in from the apron) except by interaction
    const RI = POST - 0.18;
    solid(-RI - 0.12, -RI + 0.04, -RI, RI, RING_H + 0.2, RING_H + 1.6, 'rope');
    solid(RI - 0.04, RI + 0.12, -RI, RI, RING_H + 0.2, RING_H + 1.6, 'rope');
    solid(-RI, RI, -RI - 0.12, -RI + 0.04, RING_H + 0.2, RING_H + 1.6, 'rope');
    solid(-RI, RI, RI - 0.04, RI + 0.12, RING_H + 0.2, RING_H + 1.6, 'rope');
    A.ropeInner = RI;

    // steel steps at two corners
    const stepMat = std({ color: 0x55585f, roughness: 0.4, metalness: 0.7 });
    A.steps = [];
    for (const [sx, sz] of [[1, 1], [-1, -1]]) {
      const g = new THREE.Group();
      const n = 3, depth = 0.42, w = 1.0;
      for (let k = 0; k < n; k++) {
        const h = ((k + 1) * RING_H) / n;
        const d = depth * (n - k);
        const m = box(w, h, d, stepMat, 0, h / 2, -(depth * n - d / 2), g);
        m.castShadow = true;
      }
      // steps run from the floor up to the apron corner, along the diagonal
      const cx = sx * (PLAT + 0.95), cz = sz * (PLAT + 0.95);
      g.position.set(cx, 0, cz);
      g.lookAt(0, 0, 0);
      g.rotateY(Math.PI);
      ring.add(g);
      // collision: approximate the diagonal flight with small boxes per step
      const dir = new THREE.Vector3(-sx, 0, -sz).normalize(); // towards the ring
      for (let k = 0; k < n; k++) {
        const h = ((k + 1) * RING_H) / n;
        const c = new THREE.Vector3(cx, 0, cz).addScaledVector(dir, (k + 0.5) * depth);
        const half = 0.36;
        const t = solid(c.x - half, c.x + half, c.z - half, c.z + half, 0, h, 'step');
        A.steps.push(t);
      }
      A.steps.push({ x: cx, z: cz, sx, sz });
    }

    // ---- barricades
    const barMat = std({ color: 0x101114, roughness: 0.5, metalness: 0.4 });
    const barTop = std({ color: 0xffcf1a, roughness: 0.6 });
    function barricade(x0, z0, x1, z1) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.Group();
      box(len, 1.1, 0.12, barMat, 0, 0.55, 0, g);
      box(len, 0.06, 0.2, barTop, 0, 1.12, 0, g);
      g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      scene.add(g);
      solid(Math.min(x0, x1) - 0.12, Math.max(x0, x1) + 0.12, Math.min(z0, z1) - 0.12, Math.max(z0, z1) + 0.12, 0, 1.15, 'barricade');
    }
    barricade(-BAR, BAR, BAR, BAR);
    barricade(BAR, -BAR, BAR, BAR);
    barricade(-BAR, -BAR, -BAR, BAR);
    barricade(-BAR, -BAR, -AISLE, -BAR);
    barricade(AISLE, -BAR, BAR, -BAR);
    barricade(-AISLE, -BAR, -AISLE, STAGE_Z + 0.1);
    barricade(AISLE, -BAR, AISLE, STAGE_Z + 0.1);
    A.barricadeSpots = [];
    for (let i = -6; i <= 6; i += 2) {
      A.barricadeSpots.push({ x: i, z: BAR - 0.5, face: 0 });
      A.barricadeSpots.push({ x: BAR - 0.5, z: i, face: Math.PI / 2 });
      A.barricadeSpots.push({ x: -BAR + 0.5, z: i, face: -Math.PI / 2 });
    }

    // ---- ramp and stage
    const rampMat = std({ color: 0x15161b, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
    const r0 = STAGE_Z, r1 = -BAR - 0.8; // the ramp falls from the stage (r0) to the floor (r1)
    const rampShape = new THREE.Shape([new THREE.Vector2(r0, 0), new THREE.Vector2(r1, 0), new THREE.Vector2(r0, RING_H)]);
    const rampGeo = new THREE.ExtrudeGeometry(rampShape, { depth: AISLE * 2 - 0.4, bevelEnabled: false });
    rampGeo.rotateY(-Math.PI / 2);
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.x = AISLE - 0.2;
    ramp.receiveShadow = ramp.castShadow = true;
    scene.add(ramp);
    // edge lights along the ramp
    const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.75, 0.1).multiplyScalar(3) });
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(s * (AISLE - 0.22), 0.02, r1), b = new THREE.Vector3(s * (AISLE - 0.22), RING_H + 0.02, r0);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, a.distanceTo(b), 6), edgeMat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      scene.add(m);
    }
    A.ramp = { minX: -AISLE + 0.2, maxX: AISLE - 0.2, z0: r1, z1: r0, h: RING_H };
    // stage
    const stageMat = std({ color: 0x0d0e12, roughness: 0.35, metalness: 0.2 });
    box(STAGE_HW * 2, RING_H, STAGE_Z - STAGE_BACK, stageMat, 0, RING_H / 2, (STAGE_Z + STAGE_BACK) / 2, scene);
    solid(-STAGE_HW, STAGE_HW, STAGE_BACK, STAGE_Z, 0, RING_H, 'stage');
    // stage front LED lip
    const lipTex = ledTexture();
    lipTex.repeat.set(2, 1);
    const lip = new THREE.Mesh(new THREE.PlaneGeometry(STAGE_HW * 2, 0.5), new THREE.MeshBasicMaterial({ map: lipTex, color: new THREE.Color(1.6, 1.6, 1.6) }));
    lip.position.set(0, RING_H - 0.3, STAGE_Z + 0.01);
    scene.add(lip);
    // invisible rails stop the runner stepping off the stage into the floor crowd
    solid(-STAGE_HW, -AISLE + 0.2, STAGE_Z - 0.2, STAGE_Z + 0.4, RING_H - 0.1, RING_H + 2, 'rail');
    solid(AISLE - 0.2, STAGE_HW, STAGE_Z - 0.2, STAGE_Z + 0.4, RING_H - 0.1, RING_H + 2, 'rail');
    solid(-STAGE_HW - 1, -STAGE_HW, STAGE_BACK, STAGE_Z + 0.4, 0, 6, 'wall');
    solid(STAGE_HW, STAGE_HW + 1, STAGE_BACK, STAGE_Z + 0.4, 0, 6, 'wall');
    solid(-STAGE_HW, STAGE_HW, STAGE_BACK - 1, STAGE_BACK + 0.6, 0, 12, 'wall');
    // the set: dark truss legs either side of the screen
    const setMat = std({ color: 0x1a1b20, roughness: 0.5, metalness: 0.6 });
    for (const s of [-1, 1]) {
      box(0.5, 11, 0.5, setMat, s * 7.6, 5.5 + RING_H, STAGE_BACK + 0.5, scene);
      // LED pillars
      const pil = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      pil.position.set(s * 9.0, RING_H + 4.6, STAGE_BACK + 0.62);
      scene.add(pil);
      A.pillars = A.pillars || [];
      A.pillars.push(pil);
    }
    box(16, 0.5, 0.5, setMat, 0, 11.5 + RING_H, STAGE_BACK + 0.5, scene);
    // curtain behind
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), std({ color: 0x07070a, roughness: 1 }));
    curtain.position.set(0, 10, STAGE_BACK - 0.5);
    scene.add(curtain);
    // pyro emitters at the stage front and on the ring posts
    A.pyroSpots = [];
    for (const x of [-8, -4.5, 4.5, 8]) {
      box(0.4, 0.15, 0.4, steel, x, RING_H + 0.075, STAGE_Z - 0.4, scene);
      A.pyroSpots.push(new THREE.Vector3(x, RING_H + 0.2, STAGE_Z - 0.4));
    }

    // ---- the big screen
    const screenW = 12.8, screenH = 7.2;
    const live = new THREE.WebGLRenderTarget(quality > 1 ? 640 : 384, quality > 1 ? 360 : 216, { samples: quality > 2 ? 4 : 0 });
    live.texture.colorSpace = THREE.SRGBColorSpace;
    const gfx = canvasTex(1024, 576, () => {});
    const screenMat = new THREE.ShaderMaterial({
      uniforms: { tLive: { value: live.texture }, tGfx: { value: gfx }, uGfx: { value: 1 }, uBright: { value: 1.6 }, uTime: U.uTime },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tLive, tGfx; uniform float uGfx, uBright, uTime; varying vec2 vUv;
        void main(){
          vec3 l = texture2D(tLive, vUv).rgb;
          vec4 g = texture2D(tGfx, vUv);
          vec3 c = mix(l, g.rgb, g.a * uGfx);
          vec2 px = fract(vUv * vec2(320.0, 180.0));
          float grid = smoothstep(0.0, 0.15, px.x) * smoothstep(0.0, 0.15, px.y) * smoothstep(1.0, 0.85, px.x) * smoothstep(1.0, 0.85, px.y);
          c *= 0.75 + 0.25 * grid;
          gl_FragColor = vec4(c * uBright, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
    screen.position.set(0, RING_H + 3.0 + screenH / 2, STAGE_BACK + 0.65);
    scene.add(screen);
    const frame = box(screenW + 0.3, screenH + 0.3, 0.2, setMat, 0, screen.position.y, STAGE_BACK + 0.5, scene);
    frame.castShadow = false;
    A.screen = { mesh: screen, mat: screenMat, live, gfx, cam: new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 200) };

    // ---- announce table and timekeeper, on the east side
    const tableTex = tableTexture();
    const tbl = new THREE.Group();
    box(1.0, 0.76, 4.4, [std({ color: 0x0c0c10 }), std({ color: 0x0c0c10 }), std({ color: 0x18191d, roughness: 0.5 }), std({ color: 0x0c0c10 }), std({ color: 0x0c0c10 }), std({ color: 0x0c0c10 })].map((m) => m), 0, 0.38, 0, tbl);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.7), std({ map: tableTex, roughness: 0.6 }));
    front.position.set(-0.51, 0.38, 0);
    front.rotation.y = -Math.PI / 2;
    tbl.add(front);
    const monMat = std({ color: 0x0a0a0c, roughness: 0.3, metalness: 0.5 });
    const monScr = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.45, 0.9) });
    for (const z of [-1.4, 0, 1.4]) {
      const mon = box(0.06, 0.32, 0.5, monMat, 0.1, 0.95, z, tbl);
      mon.rotation.z = -0.1;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), monScr);
      s.position.set(0.064, 0.95, z);
      s.rotation.y = Math.PI / 2;
      s.rotation.x = 0;
      tbl.add(s);
      // headset mic
      const mic = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 16, Math.PI), monMat);
      mic.position.set(-0.2, 0.79, z + 0.5);
      mic.rotation.x = Math.PI / 2;
      tbl.add(mic);
    }
    // chairs behind the table
    const chairMat = std({ color: 0x202228, roughness: 0.5, metalness: 0.5 });
    for (const z of [-1.4, 0, 1.4]) {
      const c = new THREE.Group();
      box(0.45, 0.05, 0.45, chairMat, 0, 0.46, 0, c);
      box(0.05, 0.5, 0.45, chairMat, 0.22, 0.72, 0, c);
      for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(0.03, 0.46, 0.03, chairMat, lx, 0.23, lz, c);
      c.position.set(0.95, 0, z);
      tbl.add(c);
    }
    tbl.position.set(6.4, 0, -0.6);
    scene.add(tbl);
    solid(5.85, 6.95, -2.85, 1.65, 0, 0.78, 'table');
    // timekeeper's bell on its own small table
    const tk = new THREE.Group();
    box(0.7, 0.76, 0.9, std({ color: 0x0c0c10 }), 0, 0.38, 0, tk);
    const gold = std({ color: 0xd8a634, roughness: 0.25, metalness: 1 });
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    bell.position.set(0, 0.79, 0);
    tk.add(bell);
    const hammer = box(0.03, 0.03, 0.3, std({ color: 0x6b4a2a }), 0.15, 0.8, 0.2, tk);
    hammer.rotation.y = 0.4;
    tk.position.set(6.4, 0, 2.6);
    scene.add(tk);
    solid(6.05, 6.75, 2.15, 3.05, 0, 0.78, 'bell');
    A.bell = { pos: new THREE.Vector3(6.4, 0.85, 2.6), mesh: bell };
    A.table = { pos: new THREE.Vector3(6.4, 0, -0.6) };

    // ---- stands and floor seats
    const seats = [];
    const riserMat = std({ color: 0x1b1c22, roughness: 0.9 });
    const risers = [];
    function addRiser(cx, cz, w, d, h, rotY) {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(0, h / 2, 0);
      g.rotateY(rotY);
      g.translate(cx, 0, cz);
      risers.push(g);
    }
    const sides = [
      { yaw: Math.PI, ax: 'z', sign: 1 }, // south stands, fans face -z
      { yaw: -Math.PI / 2, ax: 'x', sign: 1 }, // east, face -x
      { yaw: Math.PI / 2, ax: 'x', sign: -1 }, // west, face +x
    ];
    const ROW_D = 0.9, ROW_H = 0.45, WALL = 1.6;
    for (const sd of sides) {
      for (let r = 0; r < ROWS; r++) {
        const d = STAND0 + 0.45 + r * ROW_D;
        const y = WALL + r * ROW_H;
        // south rows span the full width; east and west rows run from the south corner to beside the stage
        const lo = sd.ax === 'z' ? -d : STAGE_BACK - 4, hi = sd.ax === 'z' ? d : d - 0.6;
        const len = hi - lo, mid = (hi + lo) / 2;
        if (sd.ax === 'z') addRiser(mid, sd.sign * d, len + ROW_D, ROW_D, y, 0);
        else addRiser(sd.sign * d, mid, len + ROW_D, ROW_D, y, Math.PI / 2);
        const step = 0.62;
        for (let t = lo + 0.3; t < hi - 0.3; t += step) {
          if (rnd() < 0.05) continue;
          const j = (rnd() - 0.5) * 0.08;
          if (sd.ax === 'z') seats.push({ x: t + j, y, z: sd.sign * d, yaw: sd.yaw });
          else seats.push({ x: sd.sign * d, y, z: t + j, yaw: sd.yaw });
        }
      }
    }
    // the front walls of the stands, with LED ribbons
    const led = ledTexture();
    led.wrapS = THREE.RepeatWrapping;
    led.repeat.set(3, 1);
    const ledMat = new THREE.MeshBasicMaterial({ map: led, color: new THREE.Color(1.8, 1.8, 1.8) });
    A.led = led;
    const wallMat = std({ color: 0x0b0b0e, roughness: 0.8 });
    {
      const lenS = STAND0 * 2, lenEW = STAND0 - (STAGE_BACK - 4);
      box(lenS, WALL, 0.3, wallMat, 0, WALL / 2, STAND0, scene);
      const r1 = new THREE.Mesh(new THREE.PlaneGeometry(lenS, 0.7), ledMat);
      r1.position.set(0, WALL - 0.45, STAND0 - 0.16);
      r1.rotation.y = Math.PI;
      scene.add(r1);
      for (const s of [-1, 1]) {
        const midz = (STAND0 + STAGE_BACK - 4) / 2;
        box(0.3, WALL, lenEW, wallMat, s * STAND0, WALL / 2, midz, scene);
        const r = new THREE.Mesh(new THREE.PlaneGeometry(lenEW, 0.7), ledMat);
        r.position.set(s * (STAND0 - 0.16), WALL - 0.45, midz);
        r.rotation.y = -s * Math.PI / 2;
        scene.add(r);
      }
    }
    // back walls, high above the last row
    const backD = STAND0 + 0.45 + ROWS * ROW_D + 0.5;
    const backH = WALL + ROWS * ROW_H + 8;
    box(backD * 2, backH, 0.5, wallMat, 0, backH / 2, backD, scene);
    box(0.5, backH, backD + 30, wallMat, backD, backH / 2, (backD - 30) / 2, scene);
    box(0.5, backH, backD + 30, wallMat, -backD, backH / 2, (backD - 30) / 2, scene);
    const rg = THREE.BufferGeometryUtils.mergeGeometries(risers);
    const riserMesh = new THREE.Mesh(rg, riserMat);
    riserMesh.receiveShadow = true;
    scene.add(riserMesh);
    // floor seats behind the barricades
    const floorRows = 5;
    for (let r = 0; r < floorRows; r++) {
      const d = BAR + 0.75 + r * 0.95;
      for (let t = -STAND0 + 1.0; t < STAND0 - 1.0; t += 0.62) {
        const j = (rnd() - 0.5) * 0.1;
        if (rnd() < 0.04) continue;
        seats.push({ x: t + j, y: 0, z: d, yaw: Math.PI, floor: 1 });
        seats.push({ x: d, y: 0, z: t + j, yaw: -Math.PI / 2, floor: 1 });
        seats.push({ x: -d, y: 0, z: t + j, yaw: Math.PI / 2, floor: 1 });
      }
      // beside the ramp aisle, facing the ring (and the ramp)
      for (let t = AISLE + 0.7; t < STAND0 - 1.2; t += 0.62) {
        for (const s of [-1, 1]) {
          const z = -BAR - 0.75 - r * 0.95;
          if (z < STAGE_Z + 1) continue;
          seats.push({ x: s * t, y: 0, z, yaw: Math.atan2(-s * t, -z) * 0.5, floor: 1 });
        }
      }
    }
    for (let k = seats.length - 1; k >= 0; k--) {
      // keep the corners of the floor clear of overlaps
      const s = seats[k];
      if (s.floor && Math.abs(s.x) > BAR + 0.5 && Math.abs(s.z) > BAR + 0.5) seats.splice(k, 1);
    }
    let crowdSeats = seats;
    if (quality === 1) crowdSeats = seats.filter((s, i) => s.floor || i % 2 === 0);
    A.crowd = buildCrowd(scene, crowdSeats, U, quality);
    A.flashMat = buildFlashes(scene, crowdSeats, U);
    A.crowdCount = crowdSeats.length;
    // keep the runner out of the crowd
    solid(-BAR - 6, -BAR - 0.12, -40, 40, 0, 10, 'crowd');
    solid(BAR + 0.12, BAR + 6, -40, 40, 0, 10, 'crowd');
    solid(-40, 40, BAR + 0.12, BAR + 6, 0, 10, 'crowd');
    solid(-40, -AISLE - 0.12, STAGE_Z + 0.2, -BAR - 0.12, 0, 10, 'crowd');
    solid(AISLE + 0.12, 40, STAGE_Z + 0.2, -BAR - 0.12, 0, 10, 'crowd');

    // ---- lighting rig over the ring
    const rig = new THREE.Group();
    const trussMat = std({ color: 0x24252b, roughness: 0.5, metalness: 0.7 });
    const RIG_Y = 10.5, RIG_S = 5.2;
    for (const s of [-1, 1]) {
      box(RIG_S * 2 + 0.5, 0.45, 0.45, trussMat, 0, RIG_Y, s * RIG_S, rig);
      box(0.45, 0.45, RIG_S * 2 + 0.5, trussMat, s * RIG_S, RIG_Y, 0, rig);
    }
    box(RIG_S * 2, 0.3, 0.3, trussMat, 0, RIG_Y, 0, rig);
    // chains to the roof
    for (const [sx, sz] of corners) box(0.05, 14, 0.05, trussMat, sx * RIG_S, RIG_Y + 7, sz * RIG_S, rig);
    scene.add(rig);
    // lamps: dark cans with glowing lenses, pointed down at the ring
    const canGeo = new THREE.CylinderGeometry(0.17, 0.14, 0.4, 12);
    const lensGeo = new THREE.CircleGeometry(0.15, 16);
    const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(14) });
    const lamps = [];
    for (const s of [-1, 1]) {
      for (let i = -4; i <= 4; i++) {
        lamps.push(new THREE.Vector3(i * 1.15, RIG_Y - 0.35, s * (RIG_S - 0.05)));
        if (Math.abs(i) < 4) lamps.push(new THREE.Vector3(s * (RIG_S - 0.05), RIG_Y - 0.35, i * 1.15));
      }
    }
    const cans = new THREE.InstancedMesh(canGeo, trussMat, lamps.length);
    const lenses = new THREE.InstancedMesh(lensGeo, lensMat, lamps.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    lamps.forEach((p, i) => {
      const aim = new THREE.Vector3(p.x * 0.35, RING_H, p.z * 0.35).sub(p).normalize();
      Q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim);
      M.compose(p, Q, new THREE.Vector3(1, 1, 1));
      cans.setMatrixAt(i, M);
      const lp = p.clone().addScaledVector(aim, 0.205);
      const Q2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), aim);
      M.compose(lp, Q2, new THREE.Vector3(1, 1, 1));
      lenses.setMatrixAt(i, M);
    });
    scene.add(cans, lenses);
    // haze beams from a few of the lamps
    if (quality > 1) {
      const bm = beamMaterial(0xfff1d8, 0.05);
      lamps.forEach((p, i) => {
        if (i % 2) return;
        const to = new THREE.Vector3(p.x * 0.35, RING_H, p.z * 0.35);
        beam(scene, p, to, 1.1, bm);
      });
    }
    // the real lights
    scene.add(new THREE.HemisphereLight(0x3a4466, 0x0a0a0c, 0.55));
    const ringSpot = new THREE.SpotLight(0xfff2e2, 420, 30, 0.62, 0.55, 2);
    ringSpot.position.set(0, RIG_Y + 1.5, 0.3);
    ringSpot.target.position.set(0, RING_H, 0);
    ringSpot.castShadow = quality > 1;
    ringSpot.shadow.mapSize.set(quality > 2 ? 2048 : 1024, quality > 2 ? 2048 : 1024);
    ringSpot.shadow.camera.near = 4;
    ringSpot.shadow.camera.far = 16;
    ringSpot.shadow.bias = -0.0004;
    ringSpot.shadow.normalBias = 0.03;
    scene.add(ringSpot, ringSpot.target);
    // a follow spot from high in the south stands
    const follow = new THREE.SpotLight(0xfff6ea, 700, 60, 0.07, 0.6, 2);
    follow.position.set(0, 16, 26);
    scene.add(follow, follow.target);
    A.follow = follow;
    // washes over the crowd, which sweep and change colour with the hype
    A.washes = [];
    const washCols = [0x4f6bff, 0xffb21a, 0xff3a6a, 0x3ad0ff];
    for (let i = 0; i < 4; i++) {
      const w = new THREE.SpotLight(washCols[i], 600, 70, 0.45, 0.8, 1.6);
      w.position.set(0, RIG_Y + 1, 0);
      scene.add(w, w.target);
      A.washes.push(w);
    }
    // stage key light
    const stageSpot = new THREE.SpotLight(0xdfe6ff, 450, 40, 0.5, 0.6, 2);
    stageSpot.position.set(0, 12, -6);
    stageSpot.target.position.set(0, RING_H, STAGE_Z - 2.5);
    scene.add(stageSpot, stageSpot.target);
    // a dim fill under the rig so the ringside is readable
    const fill = new THREE.PointLight(0x8090c0, 120, 30, 2);
    fill.position.set(0, 6, 0);
    scene.add(fill);

    // ---- ceiling: a dark grid and a few house lights
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), std({ color: 0x050507, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 26;
    scene.add(ceil);
    const houseGeo = new THREE.CircleGeometry(0.35, 12);
    const houseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.92, 0.8).multiplyScalar(5) });
    const house = new THREE.InstancedMesh(houseGeo, houseMat, 48);
    let hi = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 6; j++) {
        M.compose(new THREE.Vector3(-21 + i * 6, 25.9, -15 + j * 6 + 3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1));
        house.setMatrixAt(hi++, M);
      }
    }
    scene.add(house);

    // ---- interactions are registered by main.js using these anchors
    A.heightAt = function (x, z) {
      // height of the walkable surface under a point (ignores walls)
      let h = 0;
      const R = A.ramp;
      if (x > R.minX && x < R.maxX && z < R.z0 && z > R.z1) h = Math.max(h, ((R.z0 - z) / (R.z0 - R.z1)) * R.h);
      return h;
    };
    A.update = function (t, dt, focus, hype) {
      U.uTime.value = t;
      U.uFocus.value.copy(focus);
      led.offset.x = (t * 0.03) % 1;
      lipTex.offset.x = (-t * 0.05) % 1;
      // washes sweep the stands, faster when the crowd is hot
      for (let i = 0; i < A.washes.length; i++) {
        const w = A.washes[i];
        const a = t * (0.15 + hype * 0.35) + (i * Math.PI) / 2;
        w.target.position.set(Math.cos(a) * 20, 3 + Math.sin(t * 0.7 + i) * 2, Math.sin(a) * 16 + 4);
        w.intensity = 120 + hype * 420;
      }
      if (A.pillars) {
        for (let i = 0; i < A.pillars.length; i++) {
          const k = 0.5 + 0.5 * Math.sin(t * (1.5 + hype * 4) + i * Math.PI);
          A.pillars[i].material.color.setRGB(1.0 * (0.4 + k * 1.2), 0.75 * (0.4 + k * 1.2), 0.1 + 0.2 * k);
        }
      }
    };
    return A;
  };
})();
