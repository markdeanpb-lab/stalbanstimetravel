/* Renderer, sky, image-based lighting and post-processing.
   Quality tiers:
     low    forward rendering, AgX tone mapping in the materials, no post (phones)
     medium post: bloom, colour grade (exposure, AgX, lift/gamma/gain, split toning, vignette, grain), SMAA
     high   + N8AO ambient occlusion at half resolution, 2K shadow map that follows the camera
     ultra  + full-resolution AO, 4K shadows, higher pixel ratio
   Dynamic resolution keeps the frame rate near the tier's target (off under automation).
   Looks (sky, light, fog, grade) are plain objects so the time wave can blend two eras. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const R = (SA.Render = {});

  R.TIERS = {
    low: { post: false, ao: 0, shadow: 0, maxPR: 1, minScale: 0.7, target: 30, env: 64, boost: 1.4 },
    medium: { post: true, ao: 0, shadow: 1024, maxPR: 1.25, minScale: 0.65, target: 60, env: 128, boost: 2.6 },
    high: { post: true, ao: 1, shadow: 2048, maxPR: 1.5, minScale: 0.6, target: 60, env: 128, boost: 2.6 },
    ultra: { post: true, ao: 2, shadow: 4096, maxPR: 2, minScale: 0.75, target: 60, env: 256, boost: 2.6 },
  };
  R.QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];
  R.time = { value: 0 }; // shared shader clock (wind, flicker)

  // ------------------------------------------------------------------ sky (three's Preetham sky + twilight, stars, horizon fog)
  function makeSky() {
    const sky = new THREE.Sky();
    const m = sky.material;
    const u = m.uniforms;
    u.uSkyGain = { value: 1 };
    u.uTwilight = { value: 0 };
    u.uStars = { value: 0 };
    u.uTime2 = { value: 0 };
    u.uFogColor = { value: new THREE.Color(0.8, 0.8, 0.8) };
    u.uHorizon = { value: 0.12 };
    m.fragmentShader = m.fragmentShader
      .replace('uniform float time;', `uniform float time;
        uniform float uSkyGain, uTwilight, uStars, uTime2, uHorizon; uniform vec3 uFogColor;
        float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }`)
      .replace('gl_FragColor = vec4( texColor, 1.0 );', `
        vec3 skyc = texColor * uSkyGain;
        // twilight: the sun just below the horizon leaves a warm band towards it under a deep blue dome
        float hgt = max(direction.y, 0.0);
        vec2 sxz = normalize(vSunDirection.xz + vec2(1e-5));
        float toSun = dot(normalize(direction.xz + vec2(1e-5)), sxz);
        vec3 tw = mix(vec3(0.004, 0.009, 0.030), vec3(0.020, 0.034, 0.085), exp(-hgt * 2.5));
        tw += vec3(0.75, 0.30, 0.09) * pow(max(toSun, 0.0), 3.0) * exp(-hgt * 7.0) * 0.55;
        tw += vec3(0.28, 0.12, 0.20) * pow(max(toSun * 0.5 + 0.5, 0.0), 2.0) * exp(-hgt * 3.5) * 0.18;
        skyc += tw * uTwilight;
        // stars: points on a lattice around the sky, twinkling, fading into the horizon haze
        if (uStars > 0.0 && direction.y > 0.0) {
          vec3 sd = direction * 260.0;
          vec3 cell = floor(sd);
          float h = hash13(cell);
          if (h > 0.986) {
            vec3 c = cell + 0.5 + (vec3(hash13(cell + 7.1), hash13(cell + 3.7), hash13(cell + 1.3)) - 0.5) * 0.6;
            float d = length(sd - c);
            float tw2 = 0.7 + 0.3 * sin(uTime2 * (1.5 + h * 6.0) + h * 91.0);
            float mag = (h - 0.986) / 0.014;
            skyc += mix(vec3(1.0, 0.86, 0.72), vec3(0.78, 0.86, 1.0), hash13(cell + 5.5)) * smoothstep(0.32, 0.0, d) * tw2 * (0.25 + mag * mag * 2.6) * uStars * smoothstep(0.02, 0.3, direction.y);
          }
        }
        // the horizon melts into the fog colour so the town's silhouette meets the sky cleanly
        skyc = mix(uFogColor, skyc, smoothstep(-0.03, uHorizon, direction.y));
        gl_FragColor = vec4( skyc, 1.0 );`);
    sky.scale.setScalar(800);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    sky.name = 'sky';
    return sky;
  }

  // ------------------------------------------------------------------ colour grade effect (pmndrs postprocessing)
  const GRADE_FRAG = `
    uniform float uExposure, uSat, uContrast, uVignette, uGrain, uTime, uSplit;
    uniform vec3 uLift, uGamma, uGain, uShadowTint, uHighTint;
    const mat3 REC2020_TO_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
    const mat3 SRGB_TO_REC2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
    vec3 agxContrast(vec3 x){ vec3 x2 = x * x; vec3 x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
    vec3 agx(vec3 color){
      const mat3 inset = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
      const mat3 outset = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
      color = inset * (SRGB_TO_REC2020 * color);
      color = clamp((log2(max(color, 1e-10)) + 12.47393) / 16.499999, 0.0, 1.0);
      color = outset * agxContrast(color);
      color = pow(max(vec3(0.0), color), vec3(2.2));
      return clamp(REC2020_TO_SRGB * color, 0.0, 1.0);
    }
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      vec3 c = agx(inputColor.rgb * uExposure);
      // grade in a perceptual (gamma) space
      vec3 g = pow(c, vec3(1.0 / 2.2));
      g = uGain * (g + uLift * (1.0 - g));
      g = pow(max(g, 0.0), 1.0 / uGamma);
      float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
      g = mix(g * uShadowTint * 2.0, g * uHighTint * 2.0, smoothstep(0.15, 0.85, l)) * uSplit + g * (1.0 - uSplit);
      g = (g - 0.5) * uContrast + 0.5;
      l = dot(g, vec3(0.2126, 0.7152, 0.0722));
      g = mix(vec3(l), g, uSat);
      vec2 d = uv - 0.5;
      g *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(d * vec2(1.15, 1.0)));
      g += (rnd(uv * 811.0 + fract(uTime * 7.31)) - 0.5) * uGrain * (0.35 + 0.65 * (1.0 - l));
      outputColor = vec4(pow(clamp(g, 0.0, 1.0), vec3(2.2)), inputColor.a);
    }`;
  let GradeEffect = null;
  function gradeEffectClass() {
    if (GradeEffect) return GradeEffect;
    const PP = THREE.PP;
    GradeEffect = class extends PP.Effect {
      constructor() {
        const V3 = (x, y, z) => new THREE.Uniform(new THREE.Vector3(x, y, z));
        super('GradeEffect', GRADE_FRAG, {
          blendFunction: PP.BlendFunction.SRC,
          uniforms: new Map([
            ['uExposure', new THREE.Uniform(1)], ['uSat', new THREE.Uniform(1)], ['uContrast', new THREE.Uniform(1)],
            ['uVignette', new THREE.Uniform(0.3)], ['uGrain', new THREE.Uniform(0)], ['uTime', new THREE.Uniform(0)], ['uSplit', new THREE.Uniform(0)],
            ['uLift', V3(0, 0, 0)], ['uGamma', V3(1, 1, 1)], ['uGain', V3(1, 1, 1)], ['uShadowTint', V3(0.5, 0.5, 0.5)], ['uHighTint', V3(0.5, 0.5, 0.5)],
          ]),
        });
      }
      update(renderer, inputBuffer, dt) {
        this.uniforms.get('uTime').value += dt || 0.016;
      }
    };
    return GradeEffect;
  }

  // ------------------------------------------------------------------ height-aware fog
  // Fog thins with height above the viewer, so towers and rooftops stand out of the street haze.
  // Replaces three's fog chunks for every material (including the particle shaders).
  function patchFog() {
    const C = THREE.ShaderChunk;
    if (C.__saFog) return;
    C.__saFog = true;
    C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogH;\n#endif';
    // world height from the view-space position (the view matrix is a rigid transform)
    C.fog_vertex = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogH = ( vec4( mvPosition.xyz - viewMatrix[ 3 ].xyz, 0.0 ) * viewMatrix ).y;\n#endif';
    C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth;\n\tvarying float vFogH;');
    C.fog_fragment = C.fog_fragment.replace('gl_FragColor.rgb = mix(', 'fogFactor *= mix( 1.0, 0.5, smoothstep( cameraPosition.y + 4.0, cameraPosition.y + 55.0, vFogH ) );\n\tgl_FragColor.rgb = mix(');
  }

  // ------------------------------------------------------------------ setup
  R.setup = function (canvas, quality) {
    patchFog();
    const tier = (R.tier = R.TIERS[quality] || R.TIERS.high);
    R.quality = R.TIERS[quality] ? quality : 'high';
    // antialiasing: SMAA in the post chain; the plain forward path gets none on phones
    const renderer = (R.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    R.basePR = Math.min(window.devicePixelRatio || 1, tier.maxPR);
    R.scale = 1;
    renderer.setPixelRatio(R.basePR);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = tier.post ? THREE.NoToneMapping : THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.info.autoReset = false;
    renderer.shadowMap.enabled = tier.shadow > 0;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = (R.scene = new THREE.Scene());
    const camera = (R.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 900));
    R.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    R.hemiScale = 0.5;
    scene.add(R.hemi);
    const sun = (R.sun = new THREE.DirectionalLight(0xffffff, 2));
    sun.castShadow = tier.shadow > 0;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(tier.shadow, tier.shadow);
      const s = sun.shadow.camera;
      R.shadowHalf = tier.shadow >= 4096 ? 70 : 58;
      s.left = -R.shadowHalf;
      s.right = R.shadowHalf;
      s.top = R.shadowHalf;
      s.bottom = -R.shadowHalf;
      s.near = 1;
      s.far = 420;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.035;
      sun.shadow.radius = 2;
    }
    scene.add(sun);
    scene.add(sun.target);
    scene.fog = new THREE.Fog(0xcccccc, 100, 400);
    R.sky = makeSky();
    scene.add(R.sky);
    R.pmrem = new THREE.PMREMGenerator(renderer);
    R.envCache = {};
    R.skyScene = new THREE.Scene();
    // post-processing chain
    R.composer = null;
    if (tier.post && THREE.PP) {
      try {
        const PP = THREE.PP;
        const composer = new PP.EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
        composer.addPass(new PP.RenderPass(scene, camera));
        if (tier.ao && THREE.N8AOPostPass) {
          const ao = new THREE.N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
          const c = ao.configuration;
          c.aoRadius = 3.0;
          c.distanceFalloff = 1.0;
          c.intensity = 3.4;
          c.halfRes = tier.ao === 1;
          c.gammaCorrection = false;
          c.transparencyAware = false;
          c.color = new THREE.Color(0, 0, 0);
          if (ao.setQualityMode) ao.setQualityMode(tier.ao === 1 ? 'Medium' : 'High');
          composer.addPass(ao);
          R.ao = ao;
        }
        // depth of field for conversations (off until a scene asks for it)
        if (PP.DepthOfFieldEffect) {
          R.dof = new PP.DepthOfFieldEffect(camera, { worldFocusDistance: 3, worldFocusRange: 2.2, bokehScale: 3.2, resolutionScale: 0.5 });
          R.dofPass = new PP.EffectPass(camera, R.dof);
          R.dofPass.enabled = false;
          composer.addPass(R.dofPass);
        }
        R.bloom = new PP.BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.9, luminanceSmoothing: 0.3, intensity: 0.5, radius: 0.72 });
        const G = gradeEffectClass();
        R.grade = new G();
        composer.addPass(new PP.EffectPass(camera, R.bloom, R.grade));
        R.smaa = new PP.SMAAEffect({ preset: PP.SMAAPreset.HIGH });
        composer.addPass(new PP.EffectPass(camera, R.smaa));
        R.composer = composer;
      } catch (e) {
        console.warn('[SA] post-processing unavailable, using the plain renderer', e);
        R.composer = null;
        renderer.toneMapping = THREE.AgXToneMapping;
      }
    }
    R.dynamic = !navigator.webdriver; // keep screenshots under automation at full size
    R.ft = 0;
    R.adaptT = 0;
    window.addEventListener('resize', R.resize);
    return R;
  };
  R.resize = function () {
    if (!R.renderer) return;
    R.renderer.setPixelRatio(R.basePR * R.scale);
    if (R.composer) R.composer.setSize(window.innerWidth, window.innerHeight, false);
    else R.renderer.setSize(window.innerWidth, window.innerHeight, false);
    R.camera.aspect = window.innerWidth / window.innerHeight;
    R.camera.updateProjectionMatrix();
    SA.emit('resize');
  };
  function setScale(s) {
    s = U.clamp(s, R.tier.minScale, 1);
    if (Math.abs(s - R.scale) < 0.02) return;
    R.scale = s;
    R.resize();
  }

  // ------------------------------------------------------------------ looks
  const C = (v) => new THREE.Color(v);
  const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  function dirFrom(azDeg, elDeg) {
    const A = (azDeg * Math.PI) / 180, E = (elDeg * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(A) * Math.cos(E), Math.sin(E), -Math.cos(A) * Math.cos(E));
  }
  // resolve an era definition into numbers and colours the renderer applies
  R.eraLook = function (E) {
    const L = E.look || {};
    const sky = L.sky || {};
    const gr = L.grade || {};
    return {
      lightDir: V(E.sun.dir).normalize(),
      skySun: sky.sun ? dirFrom(sky.sun[0], sky.sun[1]) : V(E.sun.dir).normalize(),
      sunColor: C(E.sun.color), sunIntensity: E.sun.intensity,
      hemiSky: C(E.hemi.sky), hemiGround: C(E.hemi.ground), hemiIntensity: E.hemi.intensity,
      fogColor: C(E.fog.color), fogNear: E.fog.near, fogFar: E.fog.far,
      turbidity: sky.turbidity !== undefined ? sky.turbidity : 3, rayleigh: sky.rayleigh !== undefined ? sky.rayleigh : 1.2,
      mie: sky.mie !== undefined ? sky.mie : 0.005, mieG: sky.mieG !== undefined ? sky.mieG : 0.8,
      clouds: sky.clouds !== undefined ? sky.clouds : 0.35, cloudDensity: sky.cloudDensity !== undefined ? sky.cloudDensity : 0.45,
      skyGain: sky.gain !== undefined ? sky.gain : 1, twilight: sky.twilight || 0, stars: sky.stars || 0, horizon: sky.horizon !== undefined ? sky.horizon : 0.12,
      exposure: L.exposure !== undefined ? L.exposure : 1, env: L.env !== undefined ? L.env : 0.6,
      bloom: (L.bloom && L.bloom.intensity) || 0.4, bloomThreshold: (L.bloom && L.bloom.threshold) || 0.9,
      lift: V(gr.lift || [0, 0, 0]), gamma: V(gr.gamma || [1, 1, 1]), gain: V(gr.gain || [1, 1, 1]),
      sat: gr.sat !== undefined ? gr.sat : 1, contrast: gr.contrast !== undefined ? gr.contrast : 1,
      vignette: gr.vignette !== undefined ? gr.vignette : 0.3, grain: gr.grain || 0,
      split: gr.split || 0, shadowTint: C(gr.shadowTint || '#808080'), highTint: C(gr.highTint || '#808080'),
      night: E.night || 0, eraId: E.id,
    };
  };
  R.lerpLook = function (a, b, t) {
    const o = {};
    for (const k in a) {
      const x = a[k], y = b[k];
      if (x && x.isColor) o[k] = x.clone().lerp(y, t);
      else if (x && x.isVector3) o[k] = x.clone().lerp(y, t);
      else if (typeof x === 'number') o[k] = x + (y - x) * t;
      else o[k] = t < 0.5 ? x : y;
    }
    o.lightDir.normalize();
    o.skySun.normalize();
    return o;
  };
  R.applyLook = function (L) {
    R.look = L;
    const sc = R.scene;
    R.hemi.color.copy(L.hemiSky);
    R.hemi.groundColor.copy(L.hemiGround);
    // the sky's own light reaches every material through the environment map; the hemisphere
    // light only adds a little bounce from the ground on top
    R.hemi.intensity = L.hemiIntensity * R.hemiScale;
    R.sun.color.copy(L.sunColor);
    R.sun.intensity = L.sunIntensity;
    sc.fog.color.copy(L.fogColor);
    const farMul = R.quality === 'low' ? 0.8 : R.quality === 'ultra' ? 1.15 : 1;
    sc.fog.near = L.fogNear;
    sc.fog.far = L.fogFar * farMul;
    R.camera.far = Math.min(1100, L.fogFar * farMul + 60);
    R.camera.updateProjectionMatrix();
    const u = R.sky.material.uniforms;
    u.turbidity.value = L.turbidity;
    u.rayleigh.value = L.rayleigh;
    u.mieCoefficient.value = L.mie;
    u.mieDirectionalG.value = L.mieG;
    u.sunPosition.value.copy(L.skySun).multiplyScalar(450000);
    if (u.cloudCoverage) {
      u.cloudCoverage.value = L.clouds;
      u.cloudDensity.value = L.cloudDensity;
      u.cloudElevation.value = 0.55;
      if (u.cloudScale) u.cloudScale.value = 0.00034;
    }
    u.uSkyGain.value = L.skyGain;
    u.uTwilight.value = L.twilight;
    u.uStars.value = L.stars;
    u.uHorizon.value = L.horizon;
    u.uFogColor.value.copy(L.fogColor);
    sc.environmentIntensity = L.env;
    if (R.composer) {
      const g = R.grade.uniforms;
      g.get('uExposure').value = L.exposure;
      g.get('uSat').value = L.sat;
      g.get('uContrast').value = L.contrast;
      g.get('uVignette').value = L.vignette;
      g.get('uGrain').value = L.grain;
      g.get('uSplit').value = L.split;
      g.get('uLift').value.copy(L.lift);
      g.get('uGamma').value.copy(L.gamma);
      g.get('uGain').value.copy(L.gain);
      g.get('uShadowTint').value.set(L.shadowTint.r, L.shadowTint.g, L.shadowTint.b);
      g.get('uHighTint').value.set(L.highTint.r, L.highTint.g, L.highTint.b);
      R.bloom.intensity = L.bloom;
      if (R.bloom.luminanceMaterial) R.bloom.luminanceMaterial.threshold = L.bloomThreshold;
    } else {
      R.renderer.toneMappingExposure = L.exposure;
    }
  };

  // image-based lighting from the era's own sky (cached per era; the time wave swaps it half way)
  R.envFor = function (eraId, look) {
    if (R.envCache[eraId]) return R.envCache[eraId];
    const sky = R.sky;
    const parent = sky.parent;
    const s0 = sky.scale.x;
    const p0 = sky.position.clone();
    const prev = R.look;
    R.applyLook(look);
    sky.scale.setScalar(50);
    sky.position.set(0, 0, 0);
    sky.material.uniforms.uStars.value = 0;
    // the sun itself is the directional light; leaving its disc in the map would light everything twice
    const disc = sky.material.uniforms.showSunDisc;
    if (disc) disc.value = 0;
    R.skyScene.add(sky);
    let rt = null;
    try {
      rt = R.pmrem.fromScene(R.skyScene, 0.02, 0.1, 200);
    } catch (e) {
      console.warn('[SA] environment map failed', e);
    }
    R.skyScene.remove(sky);
    if (disc) disc.value = 1;
    if (parent) parent.add(sky);
    sky.scale.setScalar(s0);
    sky.position.copy(p0);
    if (prev) R.applyLook(prev);
    R.envCache[eraId] = rt ? rt.texture : null;
    return R.envCache[eraId];
  };
  R.useEnv = function (eraId, look) {
    R.scene.environment = R.envFor(eraId, look);
  };
  R.clearEnvCache = function () {
    for (const k in R.envCache) if (R.envCache[k]) R.envCache[k].dispose();
    R.envCache = {};
  };

  // ------------------------------------------------------------------ per frame
  const _v = new THREE.Vector3(), _f = new THREE.Vector3();
  R.update = function (dt, target) {
    const L = R.look;
    if (!L) return;
    const cam = R.camera;
    R.sky.position.copy(cam.position);
    const u = R.sky.material.uniforms;
    R.time.value += dt;
    if (u.time) u.time.value += dt;
    u.uTime2.value += dt;
    // the shadow box sits a little ahead of the camera and snaps to its own texels (no shimmer)
    const sun = R.sun;
    cam.getWorldDirection(_f);
    _f.y = 0;
    if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1);
    _f.normalize();
    const ahead = R.shadowHalf ? R.shadowHalf * 0.45 : 0;
    const cx = target.x + _f.x * ahead, cy = target.y, cz = target.z + _f.z * ahead;
    if (sun.castShadow) {
      const texel = (R.shadowHalf * 2) / sun.shadow.mapSize.x;
      // snap in the light's own horizontal frame
      const ld = L.lightDir;
      const rx = -ld.z, rz = ld.x;
      const rl = Math.hypot(rx, rz) || 1;
      const ux = rx / rl, uz = rz / rl;
      const a = Math.round((cx * ux + cz * uz) / texel) * texel;
      const b = Math.round((cx * -uz + cz * ux) / texel) * texel;
      _v.set(a * ux - b * uz, cy, a * uz + b * ux);
    } else _v.set(cx, cy, cz);
    sun.position.set(_v.x + L.lightDir.x * 160, _v.y + L.lightDir.y * 160, _v.z + L.lightDir.z * 160);
    sun.target.position.copy(_v);
    sun.target.updateMatrixWorld();
  };
  R.render = function (dt) {
    const r = R.renderer;
    r.info.reset();
    if (R.composer) R.composer.render(dt);
    else r.render(R.scene, R.camera);
    // dynamic resolution
    if (R.dynamic && dt > 0 && dt < 0.5) {
      R.ft = R.ft ? R.ft * 0.94 + dt * 0.06 : dt;
      R.adaptT += dt;
      if (R.adaptT > 1.2) {
        R.adaptT = 0;
        const target = 1 / R.tier.target;
        if (R.ft > target * 1.15) setScale(R.scale * 0.9);
        else if (R.ft < target * 0.82 && R.scale < 1) setScale(R.scale * 1.05);
      }
    }
  };
  // keep a world point in focus (conversations), or null for everything sharp
  R.setFocus = function (target) {
    if (!R.dofPass) return;
    if (target) {
      R.dof.target = R.dof.target || new THREE.Vector3();
      R.dof.target.copy(target);
      R.dofPass.enabled = true;
    } else R.dofPass.enabled = false;
  };
  R.info = function () {
    const i = R.renderer.info;
    return { calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, scale: +R.scale.toFixed(2), quality: R.quality, post: !!R.composer };
  };
})();
