/* Scanned surface materials (walls, roofs, ground). The layers in data/pbr_textures.js (built by
   tools/fetch_textures.py; credits in docs/ASSETS.md) are decoded at load time into two texture
   arrays shared by the facade, roof and ground shaders:
     tPbrA  albedo (sRGB), ambient occlusion in alpha
     tPbrB  normal x, normal y (OpenGL convention), roughness, height
   Layers that ship height only get their normals from it. Roughness and occlusion always come from
   height, using each layer's own parameters. Each layer also carries its size in metres and its
   mean albedo, so a shader can recolour a scan to a building's own brick or paint. */
(function () {
  'use strict';
  const SA = window.SA;
  const P = (SA.PBR = { ready: false, index: {}, count: 0, uniforms: null, glsl: '' });

  function decode(uri) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('could not decode a surface texture'));
      img.src = uri;
    });
  }

  // separable box blur with wrap-around (the textures tile)
  function boxBlur(src, S, r) {
    const tmp = new Float32Array(S * S), out = new Float32Array(S * S);
    const k = 1 / (2 * r + 1);
    for (let y = 0; y < S; y++) {
      const row = y * S;
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[row + ((i + S) % S)];
      for (let x = 0; x < S; x++) {
        tmp[row + x] = acc * k;
        acc += src[row + ((x + r + 1) % S)] - src[row + ((x - r + S) % S)];
      }
    }
    for (let x = 0; x < S; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += tmp[((i + S) % S) * S + x];
      for (let y = 0; y < S; y++) {
        out[y * S + x] = acc * k;
        acc += tmp[((y + r + 1) % S) * S + x] - tmp[((y - r + S) % S) * S + x];
      }
    }
    return out;
  }

  function buildLayer(lay, ci, di, S, A, B, off, ctx, cv) {
    cv.width = S;
    cv.height = S;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ci, 0, 0, S, S);
    const col = ctx.getImageData(0, 0, S, S).data;
    const tiles = {};
    const nt = lay.t.length, tw = di.width / nt;
    for (let t = 0; t < nt; t++) {
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(di, t * tw, 0, tw, di.height, 0, 0, S, S);
      const d = ctx.getImageData(0, 0, S, S).data;
      const ch = new Float32Array(S * S);
      for (let p = 0; p < S * S; p++) ch[p] = d[p * 4] / 255;
      tiles[lay.t[t]] = ch;
    }
    const h = tiles.h;
    let nx = tiles.nx, ny = tiles.ny;
    if (!nx) {
      // normals from height: rows run up the texture (v), so dh/dv is the next row minus the previous
      nx = new Float32Array(S * S);
      ny = new Float32Array(S * S);
      const ku = lay.relief / (2 * (lay.size[0] / S)), kv = lay.relief / (2 * (lay.size[1] / S));
      for (let y = 0; y < S; y++) {
        const yu = ((y + 1) % S) * S, yd = ((y - 1 + S) % S) * S, row = y * S;
        for (let x = 0; x < S; x++) {
          const gx = (h[row + ((x + 1) % S)] - h[row + ((x - 1 + S) % S)]) * ku;
          const gy = (h[yu + x] - h[yd + x]) * kv;
          const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
          nx[row + x] = -gx * inv * 0.5 + 0.5;
          ny[row + x] = -gy * inv * 0.5 + 0.5;
        }
      }
    }
    // occlusion from cavities: how far each texel sits below its blurred neighbourhood
    const blur = boxBlur(boxBlur(h, S, Math.max(2, S >> 6)), S, Math.max(1, S >> 7));
    const [r0, r1, h0, h1] = lay.rough;
    for (let p = 0; p < S * S; p++) {
      const o = off + p * 4;
      A[o] = col[p * 4];
      A[o + 1] = col[p * 4 + 1];
      A[o + 2] = col[p * 4 + 2];
      const cav = Math.max(0, blur[p] - h[p]);
      A[o + 3] = Math.round(255 * (1 - Math.min(0.75, cav * lay.ao)));
      B[o] = Math.round(nx[p] * 255);
      B[o + 1] = Math.round(ny[p] * 255);
      let s = (h[p] - h0) / (h1 - h0);
      s = s < 0 ? 0 : s > 1 ? 1 : s;
      s = s * s * (3 - 2 * s);
      B[o + 2] = Math.round(255 * (r0 + (r1 - r0) * s));
      B[o + 3] = Math.round(h[p] * 255);
    }
  }

  function arrayTexture(data, S, n, srgb, aniso) {
    const t = new THREE.DataArrayTexture(data, S, S, n);
    t.format = THREE.RGBAFormat;
    t.type = THREE.UnsignedByteType;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = aniso;
    t.needsUpdate = true;
    // the pixels live on the GPU once uploaded; drop the copy in memory
    t.onUpdate = () => {
      t.image.data = null;
    };
    return t;
  }

  // size: texels per layer side (512 shipped; 256 halves memory twice over on phones)
  P.load = async function (renderer, size, onProgress) {
    const D = window.SA_PBR;
    if (!D || !D.layers || !D.layers.length || !THREE.DataArrayTexture) return false;
    const L = D.layers, n = L.length, S = size || D.size;
    const A = new Uint8Array(S * S * 4 * n), B = new Uint8Array(S * S * 4 * n);
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    for (let i = 0; i < n; i++) {
      const [ci, di] = await Promise.all([decode(L[i].c), decode(L[i].d)]);
      buildLayer(L[i], ci, di, S, A, B, i * S * S * 4, ctx, cv);
      P.index[L[i].key] = i;
      if (onProgress) onProgress((i + 1) / n);
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
    }
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    P.count = n;
    P.size = S;
    P.layers = L.map((l) => ({ key: l.key, kind: l.kind, size: l.size }));
    P.uniforms = {
      tPbrA: { value: arrayTexture(A, S, n, true, aniso) },
      tPbrB: { value: arrayTexture(B, S, n, false, aniso) },
      uPbrTile: { value: L.map((l) => new THREE.Vector4(1 / l.size[0], 1 / l.size[1], l.ns, l.k)) },
      uPbrMean: { value: L.map((l) => new THREE.Vector3(l.mean[0], l.mean[1], l.mean[2])) },
    };
    const defs = L.map((l, i) => `#define L_${l.key.toUpperCase()} ${i}.0`).join('\n');
    P.glsl = `
      ${defs}
      #define PBR_N ${n}
      uniform highp sampler2DArray tPbrA;
      uniform highp sampler2DArray tPbrB;
      uniform vec4 uPbrTile[PBR_N];
      uniform vec3 uPbrMean[PBR_N];
      vec3 pbrUV(vec2 metres, float L) { return vec3(metres * uPbrTile[int(L)].xy, L); }
      // recolour a scan towards a surface's own colour, keeping the scan's variation
      vec3 pbrRecolour(vec3 tex, vec3 tint, float L) {
        vec4 t = uPbrTile[int(L)];
        return tex * mix(vec3(1.0), tint / max(uPbrMean[int(L)], vec3(0.004)), t.w);
      }
      // tangent-space normal from the data texture, scaled by the layer's strength
      vec3 pbrTangentNormal(vec4 b, float L, float k) {
        vec2 xy = b.xy * 2.0 - 1.0;
        float z = sqrt(max(1.0 - dot(xy, xy), 0.0));
        return normalize(vec3(xy * uPbrTile[int(L)].z * k, max(z, 0.08)));
      }
      // tangent frame from screen-space derivatives (as three.js does without tangents)
      mat3 pbrTBN(vec3 eyePos, vec3 N, vec2 uv) {
        vec3 q0 = dFdx(eyePos), q1 = dFdy(eyePos);
        vec2 st0 = dFdx(uv), st1 = dFdy(uv);
        vec3 q1perp = cross(q1, N), q0perp = cross(N, q0);
        vec3 T = q1perp * st0.x + q0perp * st1.x;
        vec3 Bt = q1perp * st0.y + q0perp * st1.y;
        float det = max(dot(T, T), dot(Bt, Bt));
        float sc = det == 0.0 ? 0.0 : inversesqrt(det);
        return mat3(T * sc, Bt * sc, N);
      }
      // blend weight of b over a by height, so stones poke through dirt instead of fading
      float pbrHeightBlend(float ha, float wa, float hb, float wb) {
        float ma = max(ha + wa, hb + wb) - 0.18;
        float ba = max(ha + wa - ma, 0.0), bb = max(hb + wb - ma, 0.0);
        return bb / max(ba + bb, 1e-4);
      }
    `;
    P.ready = true;
    return true;
  };
})();
