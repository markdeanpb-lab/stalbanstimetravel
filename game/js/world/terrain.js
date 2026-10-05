/* Terrain: height sampling from the DEM grid, the ground mesh and era-specific ground paint (splat maps). */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const T = (SA.Terrain = {});

  // Ground extent covered by the mesh (game coords x, z; z = -north)
  T.X0 = -420;
  T.X1 = 380;
  T.Z0 = -400;
  T.Z1 = 300;
  // Splat (paint) extent — the district plus margin
  T.SX0 = -330;
  T.SX1 = 270;
  T.SZ0 = -300;
  T.SZ1 = 300;
  T.SPLAT = 1024;

  let grid = null;
  T.init = function (map) {
    const t = map.terrain;
    grid = { x0: t.x0, y0: t.y0, step: t.step, nx: t.nx, ny: t.ny, h: t.h, base: t.base };
    // Re-centre so the Clock Tower base sits at y = 0 (keeps numbers small)
    T.offset = T.rawHeight(0, 0);
  };
  // raw height in metres above (base) from map coords (x east, y north)
  T.rawHeight = function (x, y) {
    const g = grid;
    let fx = (x - g.x0) / g.step, fy = (y - g.y0) / g.step;
    fx = U.clamp(fx, 0, g.nx - 1.001);
    fy = U.clamp(fy, 0, g.ny - 1.001);
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    // smooth (cubic Hermite) weights for gentler slopes between samples
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const wx = U.lerp(tx, sx, 0.5), wy = U.lerp(ty, sy, 0.5);
    const i = iy * g.nx + ix;
    const h00 = g.h[i], h10 = g.h[i + 1], h01 = g.h[i + g.nx], h11 = g.h[i + g.nx + 1];
    return U.lerp(U.lerp(h00, h10, wx), U.lerp(h01, h11, wx), wy);
  };
  // height in game coords
  T.height = function (x, z) {
    return T.rawHeight(x, -z) - T.offset;
  };
  T.normal = function (x, z, out) {
    const e = 1.5;
    const hx = T.height(x + e, z) - T.height(x - e, z);
    const hz = T.height(x, z + e) - T.height(x, z - e);
    out = out || new THREE.Vector3();
    out.set(-hx, 2 * e, -hz).normalize();
    return out;
  };
  // Real-world altitude for HUD/debug (metres above sea level)
  T.altitude = function (x, z) {
    return T.rawHeight(x, -z) + grid.base;
  };

  // ------------------------------------------------------------------ ground mesh
  T.buildMesh = function (material, step) {
    step = step || 4;
    const nx = Math.ceil((T.X1 - T.X0) / step) + 1, nz = Math.ceil((T.Z1 - T.Z0) / step) + 1;
    const pos = new Float32Array(nx * nz * 3);
    const idx = [];
    let k = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = T.X0 + i * step, z = T.Z0 + j * step;
        pos[k++] = x;
        pos[k++] = T.height(x, z);
        pos[k++] = z;
      }
    }
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    mesh.name = 'ground';
    mesh.receiveShadow = true;
    return mesh;
  };

  // ------------------------------------------------------------------ road widths and surfaces
  const WIDTH = {
    'High Street': 8.6, 'Chequer Street': 7.6, "St Peter's Street": 8.2, 'London Road': 9.0, 'Holywell Hill': 8.4,
    'Verulam Road': 8.6, 'Victoria Street': 7.0, 'George Street': 5.6, 'Market Place': 5.2, 'Upper Dagnall Street': 5.2,
    'Romeland': 6.0, 'Romeland Hill': 5.2, 'Abbey Mill Lane': 4.6, 'Spencer Street': 5.0, 'Fishpool Street': 5.0,
  };
  T.roadWidth = function (r) {
    if (r.t === 'pedestrian') return r.n === "St Peter's Street" ? 0 : r.n === 'French Row' ? 4.6 : 4;
    if (r.t === 'footway' || r.t === 'steps') return 2.2;
    if (r.t === 'path') return 1.8;
    if (WIDTH[r.n]) return WIDTH[r.n];
    if (r.t === 'primary') return 8.4;
    if (r.t === 'secondary') return 7;
    if (r.t === 'service') return 3.6;
    return 5;
  };
  T.isCarriageway = function (r) {
    return ['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'living_street'].indexOf(r.t) >= 0;
  };

  // ------------------------------------------------------------------ splat painting
  // Produces two canvases: colour (albedo) and material weights (R asphalt, G setts, B grass, A dirt; rest = paving)
  T.paint = function (eraId, world) {
    const S = T.SPLAT;
    const era = SA.ERAS[eraId];
    const col = document.createElement('canvas');
    col.width = col.height = S;
    const mat = document.createElement('canvas');
    mat.width = mat.height = S;
    const c = col.getContext('2d'), m = mat.getContext('2d');
    const sx = S / (T.SX1 - T.SX0), sz = S / (T.SZ1 - T.SZ0);
    const P = (x, z) => [(x - T.SX0) * sx, (z - T.SZ0) * sz];
    const G = era.ground;
    // base: paving everywhere
    c.fillStyle = G.pave;
    c.fillRect(0, 0, S, S);
    m.fillStyle = 'rgba(0,0,0,0)';
    m.clearRect(0, 0, S, S);
    function poly(ctx, pts, fill) {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = P(p[0], p[1]);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    function line(ctx, pts, w, stroke, cap) {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = P(p[0], p[1]);
        if (i === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      });
      ctx.lineWidth = w * sx;
      ctx.lineCap = cap || 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
    // areas: grass and parking
    for (const a of world.areas) {
      if (a.k === 'grass') {
        poly(c, a.p, G.grass);
        poly(m, a.p, 'rgba(0,0,255,1)');
      }
    }
    // outside-district backdrop yards: slightly darker paving with dirt
    // roads
    const surf = (r) => world.roadSurface(eraId, r); // 'asphalt' | 'setts' | 'dirt' | 'paving' | 'gravel'
    const SURF = {
      asphalt: { c: G.road, m: 'rgba(255,0,0,1)' },
      setts: { c: G.setts, m: 'rgba(0,255,0,1)' },
      dirt: { c: era.id === 1897 ? '#7a6a55' : '#6f6455', m: 'rgba(0,0,0,1)' },
      gravel: { c: '#9a8e78', m: 'rgba(0,0,0,0.7)' },
      paving: null,
    };
    // first pass: footpaths in parks (gravel)
    for (const r of world.roads) {
      if (r.t === 'path' || (r.t === 'footway' && world.inGrass(r))) line(c, r.p, 2.0, '#a39782'), line(m, r.p, 2.0, 'rgba(0,0,0,0.8)');
    }
    // second pass: carriageways
    const order = world.roads.filter((r) => T.isCarriageway(r)).sort((a, b) => T.roadWidth(a) - T.roadWidth(b));
    for (const r of order) {
      const s = SURF[surf(r)];
      if (!s) continue;
      const w = T.roadWidth(r);
      line(c, r.p, w, s.c, 'butt');
      line(m, r.p, w, s.m, 'butt');
      // round joints at ends that meet other roads
      line(c, r.p, w * 0.98, s.c);
      line(m, r.p, w * 0.98, s.m);
    }
    // special paved areas by era (Clock Tower square setts, St Peter's market)
    for (const sp of world.specialSurfaces(eraId)) {
      if (sp.poly) {
        poly(c, sp.poly, sp.color);
        poly(m, sp.poly, sp.mat);
      } else if (sp.line) {
        line(c, sp.line, sp.w, sp.color);
        line(m, sp.line, sp.w, sp.mat);
      }
    }
    // grime noise for variety
    const rng = U.rng(eraId);
    const px = S / 1024; // dab sizes and strokes were tuned at 1024 px
    c.globalAlpha = 0.06;
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = rng() < 0.5 ? '#000' : '#fff';
      const x = rng() * S, y = rng() * S, r = (2 + rng() * 10) * px;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // building footprints: dark (contact shadow under walls)
    c.fillStyle = 'rgba(30,26,22,0.55)';
    for (const b of world.footprints(eraId)) {
      c.beginPath();
      b.forEach((p, i) => {
        const q = P(p[0], p[1]);
        if (i === 0) c.moveTo(q[0], q[1]);
        else c.lineTo(q[0], q[1]);
      });
      c.closePath();
      c.lineWidth = Math.max(1, 2.2 * px);
      c.strokeStyle = 'rgba(30,26,22,0.35)';
      c.stroke();
    }
    return { col, mat };
  };

  // ------------------------------------------------------------------ ground material (splat + procedural detail)
  T.makeMaterial = function () {
    const blank = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    blank.needsUpdate = true;
    const uniforms = {
      tColA: { value: blank }, tMatA: { value: blank }, tColB: { value: blank }, tMatB: { value: blank },
      uSplat: { value: new THREE.Vector4(T.SX0, T.SZ0, 1 / (T.SX1 - T.SX0), 1 / (T.SZ1 - T.SZ0)) },
      uWaveMode: { value: 0 }, uWaveCenter: SA.Tex.wave.uWaveCenter, uWaveRadius: SA.Tex.wave.uWaveRadius,
      uOutside: { value: new THREE.Color(0x777168) },
      uEraA: { value: 2026 }, uEraB: { value: 2026 },
    };
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    m.userData.uniforms = uniforms;
    m.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWorldP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWorldP;
          uniform sampler2D tColA, tMatA, tColB, tMatB; uniform vec4 uSplat;
          uniform float uWaveMode; uniform vec2 uWaveCenter; uniform float uWaveRadius; uniform vec3 uOutside;
          uniform float uEraA, uEraB;
          ${SA.Tex.GLSL.NOISE}
          vec3 detail(vec3 base, vec4 w, vec2 p, float era){
            float aa = clamp(1.0 - length(fwidth(p))*5.0, 0.0, 1.0);
            float pave = clamp(1.0 - (w.r + w.g + w.b + w.a), 0.0, 1.0);
            // paving slabs (York stone in 1897, concrete later)
            float row = floor(p.y/0.6); vec2 sp = vec2(p.x + mod(row,2.0)*0.45, p.y);
            vec2 f = fract(sp/vec2(0.9,0.6));
            float joint = 1.0 - smoothstep(0.0,0.035,f.x)*smoothstep(1.0,0.965,f.x)*smoothstep(0.0,0.05,f.y)*smoothstep(1.0,0.95,f.y);
            float slab = 0.9 + 0.16*h21(floor(sp/vec2(0.9,0.6)));
            float pv = mix(1.0, slab*(1.0 - joint*0.35), aa);
            // asphalt
            float as = 0.9 + 0.12*vnoise(p*3.0) + 0.06*vnoise(p*17.0);
            // setts
            float srow = floor(p.y/0.12); vec2 ss = vec2(p.x + mod(srow,2.0)*0.1, p.y);
            vec2 sf = fract(ss/vec2(0.2,0.12));
            float sj = 1.0 - smoothstep(0.0,0.12,sf.x)*smoothstep(1.0,0.88,sf.x)*smoothstep(0.0,0.16,sf.y)*smoothstep(1.0,0.84,sf.y);
            float st = mix(1.0, (0.82 + 0.3*h21(floor(ss/vec2(0.2,0.12))))*(1.0 - sj*0.45), aa);
            // grass
            float gr = 0.8 + 0.3*vnoise(p*1.7) + 0.15*vnoise(p*8.0);
            // dirt / macadam with ruts
            float dt = 0.85 + 0.2*vnoise(p*2.0) + 0.1*vnoise(p*11.0);
            float k = pv*pave + as*w.r + st*w.g + gr*w.b + dt*w.a;
            return base * k;
          }
          vec4 groundColor(vec2 p, sampler2D tc, sampler2D tm, float era){
            vec2 uv = vec2((p.x - uSplat.x)*uSplat.z, (p.y - uSplat.y)*uSplat.w);
            if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(uOutside * (0.9 + 0.15*vnoise(p*0.3)), 1.0);
            vec3 base = texture2D(tc, vec2(uv.x, 1.0 - uv.y)).rgb;
            vec4 w = texture2D(tm, vec2(uv.x, 1.0 - uv.y));
            return vec4(detail(base, w, p, era), 1.0);
          }
        `)
        .replace('#include <map_fragment>', `
          vec2 gp = vWorldP.xz;
          vec4 gA = groundColor(gp, tColA, tMatA, uEraA);
          if (uWaveMode > 0.5) {
            vec4 gB = groundColor(gp, tColB, tMatB, uEraB);
            float d = distance(gp, uWaveCenter);
            float inside = 1.0 - smoothstep(uWaveRadius - 6.0, uWaveRadius, d);
            gA = mix(gA, gB, inside);
            // glowing rim
            float rim = smoothstep(uWaveRadius - 3.0, uWaveRadius, d) * (1.0 - smoothstep(uWaveRadius, uWaveRadius + 1.5, d));
            gA.rgb += vec3(1.0,0.8,0.45)*rim*0.9;
          }
          diffuseColor.rgb *= gA.rgb;
        `);
    };
    m.customProgramCacheKey = () => 'ground';
    return m;
  };
  T.canvasToTextures = function (pair) {
    const tc = new THREE.CanvasTexture(pair.col);
    tc.colorSpace = THREE.SRGBColorSpace;
    tc.anisotropy = 4;
    const tm = new THREE.CanvasTexture(pair.mat);
    tm.anisotropy = 4;
    return { col: tc, mat: tm };
  };
})();
