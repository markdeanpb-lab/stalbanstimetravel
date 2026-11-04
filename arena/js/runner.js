/* The runner: the Quaternius mannequin rebuilt in Blender (tools/arena/build_runner.py) and painted here.
   Clothes, the club vest lettering, the race number, the face and the hair are worked out in the
   fragment shader from each vertex's rest-pose position, so they ride along with the skinning and stay
   sharp at any distance. Rest pose: T-pose, facing +z, the runner's left hand on +x, feet at y = 0. */
(function () {
  'use strict';
  const AR = (window.AR = window.AR || {});
  AR.runnerSweat = { value: 0 }; // 0 dry .. 1 glistening under the lights

  // ------------------------------------------------------------------ painted textures
  function chestTexture() {
    // the front of the vest: club name over the chest, the race number below it
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 1024, 1024);
    // lettering (top half of the canvas): two lines, blue on the yellow vest
    g.fillStyle = '#1d3a9a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 118px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.save();
    g.translate(512, 170);
    g.scale(0.92, 1);
    g.fillText('ST ALBANS', 0, 0);
    g.restore();
    g.save();
    g.translate(512, 320);
    g.scale(0.92, 1);
    g.fillText('STRIDERS', 0, 0);
    g.restore();
    // race number (bottom half): a white bib, safety pins, black digits
    const bx = 182, by = 470, bw = 660, bh = 470;
    g.fillStyle = '#f4f2ea';
    g.beginPath();
    g.roundRect(bx, by, bw, bh, 18);
    g.fill();
    g.fillStyle = '#c9c6bb';
    g.fillRect(bx, by + bh - 22, bw, 22);
    g.fillStyle = '#d02a2a';
    g.fillRect(bx, by, bw, 46);
    g.fillStyle = '#fff';
    g.font = 'bold 34px Arial, sans-serif';
    g.fillText('HERTS ARENA 10K', 512, by + 25);
    g.fillStyle = '#111';
    g.font = '900 250px "Arial Black", Arial, sans-serif';
    g.save();
    g.translate(512, by + 250);
    g.scale(0.95, 1);
    g.fillText('1538', 0, 0);
    g.restore();
    g.fillStyle = '#9a978e';
    for (const [px, py] of [[bx + 30, by + 70], [bx + bw - 30, by + 70], [bx + 30, by + bh - 50], [bx + bw - 30, by + bh - 50]]) {
      g.beginPath();
      g.arc(px, py, 11, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  function faceTexture() {
    // projected straight onto the front of the head; alpha says where paint covers skin
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    // canvas y is flipped against v (v = 0 is the chin at the bottom)
    const X = (u) => u * S, Y = (v) => (1 - v) * S;
    // the face map covers x -0.09..0.09 m (u) and y 1.60..1.84 m (v)
    const ux = (x) => (x + 0.09) / 0.18, vy = (y) => (y - 1.6) / 0.24;
    // stubble: jaw, chin and upper lip
    let rnd = 7;
    const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
    g.save();
    g.beginPath();
    g.moveTo(X(ux(-0.088)), Y(vy(1.705)));
    g.quadraticCurveTo(X(ux(-0.07)), Y(vy(1.64)), X(ux(-0.035)), Y(vy(1.612)));
    g.quadraticCurveTo(X(ux(0)), Y(vy(1.598)), X(ux(0.035)), Y(vy(1.612)));
    g.quadraticCurveTo(X(ux(0.07)), Y(vy(1.64)), X(ux(0.088)), Y(vy(1.705)));
    g.lineTo(X(ux(0.06)), Y(vy(1.695)));
    g.quadraticCurveTo(X(ux(0.05)), Y(vy(1.682)), X(ux(0.03)), Y(vy(1.680)));
    g.quadraticCurveTo(X(ux(0)), Y(vy(1.690)), X(ux(-0.03)), Y(vy(1.680)));
    g.quadraticCurveTo(X(ux(-0.05)), Y(vy(1.682)), X(ux(-0.06)), Y(vy(1.695)));
    g.closePath();
    g.clip();
    g.filter = 'blur(3px)';
    g.fillStyle = 'rgba(40,28,22,0.55)';
    g.fillRect(0, 0, S, S);
    g.filter = 'none';
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = 'rgba(30,20,15,' + (0.25 + rand() * 0.4).toFixed(2) + ')';
      g.fillRect(rand() * S, rand() * S, 1.5, 1.5);
    }
    g.restore();
    // keep the lips clear of stubble
    g.globalCompositeOperation = 'destination-out';
    g.filter = 'blur(2px)';
    g.beginPath();
    g.ellipse(X(ux(0)), Y(vy(1.659)), 0.021 / 0.18 * S, 0.008 / 0.24 * S, 0, 0, Math.PI * 2);
    g.fill();
    g.filter = 'none';
    g.globalCompositeOperation = 'source-over';
    // lips
    g.fillStyle = 'rgba(150,80,70,0.75)';
    g.beginPath();
    g.ellipse(X(ux(0)), Y(vy(1.659)), 0.019 / 0.18 * S, 0.0055 / 0.24 * S, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(70,35,30,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(X(ux(-0.018)), Y(vy(1.660)));
    g.quadraticCurveTo(X(ux(0)), Y(vy(1.657)), X(ux(0.018)), Y(vy(1.660)));
    g.stroke();
    // eyes, set into the sockets the Blender script carved at y 1.735, x +-0.032
    for (const s of [-1, 1]) {
      const ex = X(ux(s * 0.032)), ey = Y(vy(1.733));
      const rw = (0.0125 / 0.18) * S, rh = (0.0058 / 0.24) * S;
      g.fillStyle = 'rgba(70,45,35,0.35)'; // shadowed lids
      g.beginPath();
      g.ellipse(ex, ey - 2, rw * 1.35, rh * 2.1, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ece6dc';
      g.beginPath();
      g.ellipse(ex, ey, rw, rh, 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = '#4a3423';
      g.beginPath();
      g.arc(ex + s * -1.5, ey, rh * 1.05, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0d0907';
      g.beginPath();
      g.arc(ex + s * -1.5, ey, rh * 0.5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = 'rgba(25,15,10,0.9)'; // upper lash line
      g.lineWidth = 2.5;
      g.beginPath();
      g.ellipse(ex, ey, rw, rh, 0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      // thick, straight brows angled down to the nose
      g.fillStyle = 'rgba(32,22,16,0.92)';
      g.beginPath();
      const bx0 = X(ux(s * 0.012)), bx1 = X(ux(s * 0.058));
      const by0 = Y(vy(1.748)), by1 = Y(vy(1.751));
      g.filter = 'blur(1.2px)';
      g.moveTo(bx0, by0 + 7);
      g.lineTo(bx0 + s * 4, by0 - 12);
      g.quadraticCurveTo(X(ux(s * 0.035)), Y(vy(1.757)) - 12, bx1, by1 - 7);
      g.lineTo(bx1 + s * 3, by1 + 4);
      g.quadraticCurveTo(X(ux(s * 0.035)), Y(vy(1.752)) + 4, bx0, by0 + 7);
      g.closePath();
      g.fill();
      g.filter = 'none';
    }
    // nostrils and the crease beside them
    g.fillStyle = 'rgba(60,30,25,0.6)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(X(ux(s * 0.007)), Y(vy(1.684)), 3, 2, 0, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  // ------------------------------------------------------------------ material
  function runnerMaterial() {
    const chest = chestTexture();
    const face = faceTexture();
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.tChest = { value: chest };
      sh.uniforms.tFace = { value: face };
      sh.uniforms.uSweat = AR.runnerSweat;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nvarying vec3 vRestN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;\nvRestN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vRest;
varying vec3 vRestN;
uniform sampler2D tChest;
uniform sampler2D tFace;
uniform float uSweat;
float rhash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(rhash(i), rhash(i+vec3(1,0,0)), f.x), mix(rhash(i+vec3(0,1,0)), rhash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(rhash(i+vec3(0,0,1)), rhash(i+vec3(1,0,1)), f.x), mix(rhash(i+vec3(0,1,1)), rhash(i+vec3(1,1,1)), f.x), f.y), f.z); }
float gRough = 0.55;
float gSheen = 0.0;
vec3 runnerColor(){
  vec3 p = vRest;
  float ax = abs(p.x);
  vec3 skin = vec3(0.80, 0.56, 0.44);
  skin *= 0.94 + 0.08 * rnoise(p * 60.0);
  vec3 col = skin;
  gRough = 0.5;
  // ---- head: painted face, then hair
  if (p.y > 1.585) {
    float front = smoothstep(0.02, 0.07, p.z);
    vec2 fuv = vec2((p.x + 0.09) / 0.18, (p.y - 1.6) / 0.24);
    vec4 f = texture2D(tFace, fuv);
    col = mix(col, f.rgb, f.a * front);
    float back = smoothstep(-0.02, 0.09, -p.z);
    float hairY = mix(1.776, 1.665, back);
    hairY = mix(hairY, 1.700, smoothstep(0.072, 0.082, ax) * (1.0 - smoothstep(0.0, 0.03, p.z)) * (1.0 - back)); // sideburns
    hairY += 0.003 * sin(p.x * 140.0) * front;
    float n = rnoise(p * vec3(220.0, 90.0, 220.0));
    float hair = smoothstep(hairY - 0.004, hairY + 0.004, p.y + 0.004 * n);
    float crop = smoothstep(1.62, 1.68, p.y) * back * (1.0 - hair); // shaved back and sides
    vec3 hairCol = vec3(0.055, 0.037, 0.026) * (0.7 + 0.6 * n);
    col = mix(col, mix(col, hairCol, 0.6), crop);
    col = mix(col, hairCol, hair);
    gRough = mix(gRough, 0.75, hair);
    // ears get a warmer, darker tone
    col *= 1.0 - 0.08 * smoothstep(0.08, 0.095, ax);
  }
  // ---- vest
  float torso = step(1.02, p.y) * step(p.y, 1.505);
  float armhole = 0.165 - 0.075 * smoothstep(1.30, 1.47, p.y);
  float inVest = torso * step(ax, armhole);
  float neck = step(1.40, p.y) * step(ax, 0.075 + (p.y - 1.40) * 0.25) * step(0.0, p.z); // scooped neckline
  float neckB = step(1.45, p.y) * step(ax, 0.07) * step(p.z, 0.0);
  inVest *= (1.0 - neck) * (1.0 - neckB);
  if (inVest > 0.5) {
    vec3 yellow = vec3(0.98, 0.80, 0.08);
    vec3 blue = vec3(0.07, 0.20, 0.62);
    float split = 1.205 + 0.025 * sin(p.x * 9.0);
    vec3 v = mix(blue, yellow, smoothstep(split - 0.004, split + 0.004, p.y));
    // trim around the neck and armholes
    float trim = step(armhole - 0.008, ax) + step(1.405, p.y) * step(ax, 0.075 + (p.y - 1.40) * 0.25 + 0.008) * step(0.0, p.z);
    v = mix(v, blue, clamp(trim, 0.0, 1.0));
    // the club name and race number, projected on the front
    float fr = smoothstep(0.0, 0.05, p.z);
    // canvas rows: lettering v 0.62..0.90 on the upper chest, the bib v 0.08..0.54 lower down
    float cu = (p.x + 0.13) / 0.26;
    float tv = 0.62 + (p.y - 1.30) / 0.125 * 0.28;
    vec4 txt = texture2D(tChest, vec2(cu, tv));
    float onTxt = step(0.58, tv) * step(tv, 0.95);
    v = mix(v, txt.rgb, txt.a * fr * onTxt);
    float bv = 0.082 + (p.y - 1.095) / 0.119 * 0.459;
    vec4 bib = texture2D(tChest, vec2(cu, bv));
    float onBib = step(0.06, bv) * step(bv, 0.55);
    v = mix(v, bib.rgb, bib.a * fr * onBib);
    gRough = mix(0.62, 0.8, bib.a * fr * onBib);
    v *= 0.92 + 0.12 * rnoise(p * vec3(400.0, 400.0, 400.0));
    col = v;
    gSheen = 0.3;
  }
  // ---- shorts
  if (p.y > 0.695 + 0.02 * step(0.0, -p.z) && p.y < 1.035 && ax < 0.26) {
    col = vec3(0.025, 0.025, 0.03) * (0.85 + 0.3 * rnoise(p * 300.0));
    gRough = 0.45;
    gSheen = 0.5;
    if (abs(p.y - 1.02) < 0.012) col = vec3(0.06); // waistband
  }
  // ---- watch on the left wrist
  if (p.x > 0.695 && p.x < 0.735 && abs(p.y - 1.44) < 0.06) { col = vec3(0.02); gRough = 0.3; }
  // ---- socks and trainers
  if (p.y < 0.175) {
    col = vec3(0.02, 0.02, 0.025);
    gRough = 0.8;
  }
  if (p.y < 0.118 + 0.03 * smoothstep(0.0, 0.12, p.z)) {
    vec3 neon = vec3(0.80, 0.90, 0.10);
    // two dark stripes along each side
    float side = smoothstep(0.035, 0.045, abs(ax - 0.09));
    float stripe = step(0.5, fract((p.z * 0.8 + p.y * 1.4) * 22.0)) * step(0.02, p.y) * step(p.y, 0.09) * side * step(-0.02, p.z) * step(p.z, 0.09);
    col = mix(neon, vec3(0.04, 0.05, 0.03), stripe * 0.9);
    if (p.y < 0.03) col = vec3(0.9, 0.92, 0.85); // sole
    if (p.y < 0.008) col = vec3(0.15);
    gRough = 0.45;
  }
  return col;
}`
        )
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * runnerColor(), opacity );')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(gRough, 0.28, uSweat * (1.0 - gSheen));');
    };
    m.customProgramCacheKey = () => 'runner-paint';
    return m;
  }

  // ------------------------------------------------------------------ the runner object
  function decode(b64) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  const LOOPS = { Idle_Loop: 1, Walk_Loop: 1, Jog_Fwd_Loop: 1, Sprint_Loop: 1, Jump_Loop: 1, Dance_Loop: 1, Sitting_Idle_Loop: 1, Idle_Talking_Loop: 1, Crouch_Idle_Loop: 1 };

  AR.loadRunner = function (onReady) {
    new THREE.GLTFLoader().parse(decode(window.AR_RUNNER_GLB), '', (gltf) => {
      const root = gltf.scene;
      const mat = runnerMaterial();
      let mesh = null;
      root.traverse((o) => {
        if (o.isMesh) {
          o.material = mat;
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false;
          mesh = o;
        }
      });
      const bones = {};
      root.traverse((o) => {
        if (o.isBone) bones[o.name.replace(/[^A-Za-z0-9_-]/g, '')] = o; // GLTFLoader drops the dots
      });
      const mixer = new THREE.AnimationMixer(root);
      const actions = {};
      for (const clip of gltf.animations) {
        // keep the hips' height but strip any drift so the controller owns the position
        const a = mixer.clipAction(clip);
        if (!LOOPS[clip.name]) {
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
        }
        actions[clip.name] = a;
      }
      const R = new Runner(root, mesh, mixer, actions, bones);
      onReady(R);
    }, (e) => console.error('runner load failed', e));
  };

  function Runner(root, mesh, mixer, actions, bones) {
    this.root = root; // add this to a group you move around
    this.object = new THREE.Group();
    this.object.add(root);
    this.mesh = mesh;
    this.mixer = mixer;
    this.actions = actions;
    this.bones = bones;
    this.current = null;
    this.pose = 0; // 0..1 blend of the victory pose over the animation
    this.poseTarget = 0;
    this.holding = null; // object held aloft in the right hand (the belt)
    this.play('Idle_Loop', 0);
  }

  Runner.prototype.play = function (name, fade = 0.2, speed = 1) {
    const a = this.actions[name];
    if (!a) return;
    a.timeScale = speed;
    if (this.current === a) return;
    a.reset();
    a.setEffectiveWeight(1);
    a.play();
    if (this.current) this.current.crossFadeTo(a, fade, false);
    this.current = a;
    this.currentName = name;
  };
  Runner.prototype.setSpeed = function (s) {
    if (this.current) this.current.timeScale = s;
  };
  Runner.prototype.finished = function () {
    const a = this.current;
    return a && a.loop === THREE.LoopOnce && a.time >= a.getClip().duration - 0.02;
  };

  // aim a bone so the direction to its child points along `dir` (in the runner's own frame)
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qp = new THREE.Quaternion();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
  function aim(bone, child, dir, rootQ, w) {
    bone.updateWorldMatrix(true, true);
    bone.getWorldPosition(_a);
    child.getWorldPosition(_b);
    _b.sub(_a).normalize();
    _d.copy(dir).normalize().applyQuaternion(rootQ);
    _q.setFromUnitVectors(_b, _d);
    bone.getWorldQuaternion(_q2);
    _q2.premultiply(_q);
    bone.parent.getWorldQuaternion(_qp).invert();
    _q2.premultiply(_qp);
    bone.quaternion.slerp(_q2, w);
  }
  function twist(bone, axis, ang, w) {
    _q.setFromAxisAngle(axis, ang * w);
    bone.quaternion.multiply(_q);
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const POSE = {
    upL: V(0.85, 0.45, 0.1), foreL: V(0.05, 1, 0.12),
    upR: V(-0.85, 0.45, 0.1), foreR: V(-0.05, 1, 0.12),
    // holding the belt overhead with both hands
    beltUpL: V(0.45, 0.85, 0.25), beltForeL: V(-0.55, 0.8, 0.0),
    beltUpR: V(-0.45, 0.85, 0.25), beltForeR: V(0.55, 0.8, 0.0),
  };
  const X_AXIS = V(1, 0, 0);
  const _rq = new THREE.Quaternion();

  Runner.prototype.update = function (dt) {
    this.mixer.update(dt);
    // victory pose: arms flung up in a V, fists clenched, chest out, chin up
    const k = 1 - Math.exp(-dt * 9);
    this.pose += (this.poseTarget - this.pose) * k;
    const w = this.pose;
    if (w > 0.002) {
      const B = this.bones;
      this.object.updateWorldMatrix(true, false);
      this.object.getWorldQuaternion(_rq);
      const belt = !!this.holding;
      twist(B['DEF-spine003'], X_AXIS, -0.12, w);
      twist(B['DEF-neck'], X_AXIS, -0.1, w);
      twist(B['DEF-head'], X_AXIS, -0.08, w);
      aim(B['DEF-upper_armL'], B['DEF-forearmL'], belt ? POSE.beltUpL : POSE.upL, _rq, w);
      aim(B['DEF-forearmL'], B['DEF-handL'], belt ? POSE.beltForeL : POSE.foreL, _rq, w);
      aim(B['DEF-upper_armR'], B['DEF-forearmR'], belt ? POSE.beltUpR : POSE.upR, _rq, w);
      aim(B['DEF-forearmR'], B['DEF-handR'], belt ? POSE.beltForeR : POSE.foreR, _rq, w);
      this.clench(w);
    }
  };

  // curl every finger into a fist
  const FINGERS = ['index', 'middle', 'ring', 'pinky'];
  Runner.prototype.clench = function (w) {
    const B = this.bones;
    for (const side of ['L', 'R']) {
      for (const f of FINGERS) {
        for (let i = 1; i <= 3; i++) {
          const b = B['DEF-f_' + f + '0' + i + side];
          if (b) twist(b, X_AXIS, FIST_CURL * (i === 1 ? 0.9 : 1.15), w);
        }
      }
      const t = B['DEF-thumb02' + side];
      if (t) twist(t, X_AXIS, FIST_CURL * 0.5, w);
    }
  };
  const FIST_CURL = 1.0;

  // world position of a bone (for attaching props or aiming cameras)
  Runner.prototype.bonePos = function (name, out) {
    return this.bones[name.replace(/[^A-Za-z0-9_-]/g, '')].getWorldPosition(out || new THREE.Vector3());
  };

  AR.Runner = Runner;
})();
