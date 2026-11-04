/* Striders Slam: the game loop, controls, camera, interactions and the crowd-energy objective. */
(function () {
  'use strict';
  const AR = window.AR;
  const $ = (id) => document.getElementById(id);
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const D = AR.DIM;

  // ------------------------------------------------------------------ quality
  const params = new URLSearchParams(location.search);
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  let quality = +(params.get('q') || (isTouch ? 1 : 3));
  if (isTouch) document.body.classList.add('touch');

  // ------------------------------------------------------------------ renderer and scene
  const canvas = $('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 1, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality > 2 ? 2 : quality > 1 ? 1.5 : 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = quality > 1;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050608);
  scene.fog = new THREE.FogExp2(0x07080d, 0.011);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 220);
  {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.18;
  }

  let composer = null, bloom = null;
  const PP = THREE.PP;
  if (quality > 1 && PP) {
    try {
      composer = new PP.EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: quality > 2 ? 4 : 0 });
      composer.addPass(new PP.RenderPass(scene, camera));
      bloom = new PP.BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.95, luminanceSmoothing: 0.2, intensity: 0.9, radius: 0.75 });
      const vignette = new PP.VignetteEffect({ offset: 0.3, darkness: 0.55 });
      const tone = new PP.ToneMappingEffect({ mode: PP.ToneMappingMode.ACES_FILMIC });
      composer.addPass(new PP.EffectPass(camera, bloom, vignette, tone));
      composer.setSize(window.innerWidth, window.innerHeight, false);
    } catch (e) {
      console.warn('post-processing unavailable', e);
      composer = null;
    }
  }
  if (!composer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h, false);
    if (arena) arena.flashMat.uniforms.uScale.value = h;
    if (sparks) sparks.mat.uniforms.uScale.value = h;
  }
  window.addEventListener('resize', resize);

  // ------------------------------------------------------------------ world
  let arena = null, runner = null, sparks = null, confetti = null, belt = null;
  const player = {
    pos: V3(0, D.RING_H, D.STAGE_Z - 3.5),
    vy: 0,
    yaw: 0, // facing +z (towards the ring)
    speed: 0,
    grounded: true,
    mode: 'free', // free | script | turnbuckle | busy
    script: null,
    airFrom: 0,
    stride: 0,
    landT: 0,
    busyT: 0,
    busyAnim: null,
    corner: null,
    poseT: 0,
    holding: false,
  };
  const cam = { yaw: Math.PI, pitch: 0.18, dist: 3.6, hero: 0, pos: V3(), look: V3(), lastInput: -10, fov: 55 };

  // ------------------------------------------------------------------ crowd energy and the list of crowd pleasers
  const GOALS = [
    { id: 'entrance', label: 'Make your entrance', v: 0.14 },
    { id: 'ring', label: 'Climb into the ring', v: 0.08 },
    { id: 'pose', label: 'Victory pose in the ring', v: 0.12 },
    { id: 'buckle', label: 'Pose on a turnbuckle', v: 0.1 },
    { id: 'leap', label: 'Leap off the top rope', v: 0.12 },
    { id: 'bell', label: 'Ring the timekeeper\'s bell', v: 0.08 },
    { id: 'promo', label: 'Cut a promo on the mic', v: 0.12 },
    { id: 'fives', label: 'High-five 3 sections of fans', v: 0.12, need: 3 },
    { id: 'table', label: 'Pose on the announce table', v: 0.12 },
  ];
  const done = {};
  let fives = new Set();
  let energy = 0, energyShown = 0;
  let pop = 0; // a burst of noise and movement that fades
  let stage = 0; // story beat: 0 entrance, 1 ring, 2 pose, 3 frenzy, 4 belt down, 5 hold it high, 6 champion
  let beltState = 'none'; // none | lowering | waiting | held
  const beltPos = V3(0, 12, 0);
  let flash = 0;

  function buildList() {
    const ul = $('list-items');
    ul.innerHTML = '';
    for (const g of GOALS) {
      const li = document.createElement('li');
      li.id = 'goal-' + g.id;
      li.textContent = g.label + (g.need ? ` (${Math.min(fives.size, g.need)}/${g.need})` : '');
      if (done[g.id]) li.className = 'done';
      ul.appendChild(li);
    }
  }
  function achieve(id, text) {
    if (done[id]) return false;
    const g = GOALS.find((q) => q.id === id);
    done[id] = true;
    energy = Math.min(1, energy + g.v);
    buildList();
    toast(text || g.label, 'Crowd energy ' + Math.round(energy * 100) + '%');
    return true;
  }
  function excite(amount, flashes) {
    pop = Math.min(1.4, pop + amount);
    if (flashes) flash = Math.max(flash, flashes);
    AR.sound.cheer(Math.min(1, amount + 0.2));
  }

  // ------------------------------------------------------------------ HUD helpers
  let toastT = 0, subT = 0;
  function toast(text, small) {
    const t = $('toast');
    t.innerHTML = '';
    t.appendChild(document.createTextNode(text));
    if (small) {
      const s = document.createElement('small');
      s.textContent = small;
      t.appendChild(s);
    }
    t.classList.remove('hidden');
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    toastT = 2.6;
  }
  function subtitle(who, text, dur) {
    const s = $('subtitle');
    s.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = who + ': ';
    s.appendChild(b);
    s.appendChild(document.createTextNode(text));
    s.classList.remove('hidden');
    subT = dur;
  }
  function objective(text) {
    $('obj-text').textContent = text;
  }
  function setStage(s) {
    stage = s;
    const txt = [
      'Make your entrance: walk to the front of the stage and press E',
      'Head down the ramp and climb into the ring',
      'Strike the victory pose in the ring: press V',
      'Get the crowd to fever pitch: work through the crowd pleasers',
      'The title belt is coming down. Grab it in the middle of the ring!',
      'Hold the belt high: press V',
      'Champion! Soak it up. Pose anywhere, the crowd will love it',
    ][s];
    objective(txt);
  }

  // ------------------------------------------------------------------ the big screen graphics
  function screenGfx(kind, line2) {
    const c = arena.screen.gfx.canvas, g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    if (kind === 'title' || kind === 'champion') {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, kind === 'champion' ? '#5a3c00' : '#0b1d5c');
      gr.addColorStop(1, '#05060a');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ffcf1a';
      g.font = '900 54px "Arial Black", Arial, sans-serif';
      g.fillText(kind === 'champion' ? 'AND THE NEW' : 'LIVE FROM THE HERTS ARENA', W / 2, H * 0.24);
      g.fillStyle = '#ffffff';
      g.font = '900 150px "Arial Black", Arial, sans-serif';
      g.save();
      g.translate(W / 2, H * 0.52);
      g.scale(0.82, 1);
      g.fillText(kind === 'champion' ? 'CHAMPION' : 'STRIDERS SLAM', 0, 0);
      g.restore();
      g.fillStyle = '#ffcf1a';
      g.font = 'bold 44px Arial, sans-serif';
      g.fillText(line2 || '#1538 · THE ST ALBANS STRIDER', W / 2, H * 0.78);
    } else {
      // lower third over the live picture
      g.fillStyle = 'rgba(5,6,10,0.85)';
      g.fillRect(40, H - 150, W * 0.62, 104);
      g.fillStyle = '#ffcf1a';
      g.fillRect(40, H - 150, 12, 104);
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillStyle = '#ffffff';
      g.font = '900 46px "Arial Black", Arial, sans-serif';
      g.fillText('THE ST ALBANS STRIDER', 72, H - 116);
      g.fillStyle = '#ffcf1a';
      g.font = 'bold 30px Arial, sans-serif';
      g.fillText(line2 || '#1538 · STRIDERS SLAM', 72, H - 72);
      g.fillStyle = '#d4202a';
      g.fillRect(W - 170, 40, 130, 46);
      g.fillStyle = '#fff';
      g.font = 'bold 30px Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText('● LIVE', W - 105, 64);
    }
    arena.screen.gfx.needsUpdate = true;
  }

  // ------------------------------------------------------------------ input
  const keys = {};
  const pressed = {};
  const look = { dx: 0, dy: 0 };
  const stick = { x: 0, y: 0, active: false };
  let started = false;
  window.addEventListener('keydown', (e) => {
    if (!started) return;
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });
  canvas.addEventListener('click', () => {
    if (started && !isTouch && document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      try {
        const r = canvas.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      } catch (e) {
        /* not available (e.g. in an iframe without permission): drag to look instead */
      }
    }
  });
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      look.dx += e.movementX;
      look.dy += e.movementY;
    } else if (dragging) {
      look.dx += (e.clientX - lastX) * 1.5;
      look.dy += (e.clientY - lastY) * 1.5;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  canvas.addEventListener('wheel', (e) => {
    cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 0.35, 2.0, 8);
  }, { passive: true });

  // touch: a floating stick on the left, look on the right, buttons
  function setupTouch() {
    $('touch').classList.remove('hidden');
    const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob');
    let sid = null, sx = 0, sy = 0;
    zone.addEventListener('pointerdown', (e) => {
      sid = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      base.style.display = 'block';
      base.style.left = sx + 'px';
      base.style.top = sy + 'px';
      zone.setPointerCapture(sid);
      stick.active = true;
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - sx, dy = e.clientY - sy;
      const l = Math.hypot(dx, dy), m = 50;
      if (l > m) {
        dx *= m / l;
        dy *= m / l;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      stick.x = dx / m;
      stick.y = dy / m;
    });
    const end = (e) => {
      if (e.pointerId !== sid) return;
      sid = null;
      stick.x = stick.y = 0;
      stick.active = false;
      base.style.display = 'none';
      knob.style.transform = '';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    const lz = $('look-zone');
    let lid = null, lx = 0, ly = 0;
    lz.addEventListener('pointerdown', (e) => {
      lid = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      lz.setPointerCapture(lid);
    });
    lz.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      look.dx += (e.clientX - lx) * 2.2;
      look.dy += (e.clientY - ly) * 2.2;
      lx = e.clientX;
      ly = e.clientY;
    });
    lz.addEventListener('pointerup', () => (lid = null));
    for (const b of document.querySelectorAll('.tbtn')) {
      const k = b.dataset.k, hold = b.dataset.hold;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (hold) {
          keys[k] = !keys[k];
          b.classList.toggle('on', keys[k]);
        } else {
          pressed[k] = true;
          keys[k] = true;
          setTimeout(() => (keys[k] = false), 120);
        }
      });
    }
  }
  function gamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      const gp = { x: dz(p.axes[0]), y: dz(p.axes[1]) };
      look.dx += dz(p.axes[2]) * 14;
      look.dy += dz(p.axes[3]) * 10;
      const btn = (i) => p.buttons[i] && p.buttons[i].pressed;
      const map = [[0, 'Space'], [2, 'KeyE'], [3, 'KeyV'], [1, 'KeyF'], [4, 'KeyB']];
      for (const [i, k] of map) {
        const b = btn(i);
        if (b && !gamepad[k]) pressed[k] = true;
        gamepad[k] = b;
      }
      keys.PadRun = btn(5) || btn(7);
      return gp;
    }
    return null;
  }
  const consume = (k) => {
    const v = pressed[k];
    pressed[k] = false;
    return v;
  };

  // ------------------------------------------------------------------ collision
  const STEP = 0.45, RADIUS = 0.28, HEIGHT = 1.75;
  const WALLS = { barricade: 1, rail: 1, wall: 1, crowd: 1, rope: 1, post: 1 };
  function blocked(x, z, y) {
    for (const s of arena.solids) {
      if (x > s.minX - RADIUS && x < s.maxX + RADIUS && z > s.minZ - RADIUS && z < s.maxZ + RADIUS) {
        if (WALLS[s.tag]) {
          if (s.bottom < y + HEIGHT && s.top > y + 0.05) return s;
        } else if (s.bottom < y + HEIGHT && s.top > y + STEP) return s;
      }
    }
    return null;
  }
  function groundAt(x, z, y) {
    let g = arena.heightAt(x, z);
    let tag = 'floor';
    if (g > 0) tag = 'ramp';
    const m = 0.12;
    for (const s of arena.solids) {
      if (WALLS[s.tag]) continue;
      if (x > s.minX - m && x < s.maxX + m && z > s.minZ - m && z < s.maxZ + m && s.top <= y + STEP + 0.01 && s.top > g) {
        g = s.top;
        tag = s.tag;
      }
    }
    return { y: g, tag };
  }
  function surfaceSound(tag) {
    return tag === 'ring' ? 'mat' : tag === 'step' || tag === 'ramp' || tag === 'stage' ? 'metal' : 'floor';
  }
  const inRing = () => Math.abs(player.pos.x) < arena.ropeInner && Math.abs(player.pos.z) < arena.ropeInner && player.pos.y > D.RING_H - 0.1;
  const onApron = () => player.pos.y > D.RING_H - 0.1 && !inRing() && Math.abs(player.pos.x) < D.PLAT + 0.15 && Math.abs(player.pos.z) < D.PLAT + 0.15;

  // ------------------------------------------------------------------ scripted moves (climbing through ropes, turnbuckles, leaps)
  function runScript(steps, done) {
    player.mode = 'script';
    player.script = { steps, i: -1, t: 0, from: V3(), done };
    nextStep();
  }
  function nextStep() {
    const S = player.script;
    S.i++;
    if (S.i >= S.steps.length) {
      const d = S.done;
      player.script = null;
      player.mode = 'free';
      player.vy = 0;
      if (d) d();
      return;
    }
    const st = S.steps[S.i];
    S.t = 0;
    S.from.copy(player.pos);
    S.yaw0 = player.yaw;
    if (st.anim) runner.play(st.anim, st.fade || 0.15, st.speed || 1);
    if (st.sound) st.sound();
  }
  function updateScript(dt) {
    const S = player.script;
    const st = S.steps[S.i];
    S.t += dt;
    const k = clamp(S.t / st.dur, 0, 1);
    const e = st.linear ? k : k * k * (3 - 2 * k);
    if (st.to) {
      player.pos.lerpVectors(S.from, st.to, e);
      if (st.arc) player.pos.y += Math.sin(Math.PI * k) * st.arc;
    }
    if (st.face !== undefined) player.yaw = S.yaw0 + angDiff(S.yaw0, st.face) * Math.min(1, e * 1.5);
    if (st.each) st.each(k, dt);
    if (k >= 1) {
      if (st.end) st.end();
      nextStep();
    }
  }
  const faceTo = (x, z) => Math.atan2(x - player.pos.x, z - player.pos.z);

  // nearest point on the apron to the player, and the matching point just inside the ropes
  function ringEntry() {
    const p = player.pos;
    const ax = Math.abs(p.x), az = Math.abs(p.z);
    let n; // outward normal of the nearest side
    if (ax > az) n = V3(Math.sign(p.x), 0, 0);
    else n = V3(0, 0, Math.sign(p.z));
    const along = n.x ? clamp(p.z, -2.4, 2.4) : clamp(p.x, -2.4, 2.4);
    const at = (d, y) => (n.x ? V3(n.x * d, y, along) : V3(along, y, n.z * d));
    return { n, apron: at(D.PLAT - 0.16, D.RING_H), inside: at(arena.ropeInner - 0.55, D.RING_H), floor: at(D.PLAT + 0.75, 0) };
  }
  function climbIn(fromApron) {
    const r = ringEntry();
    const steps = [];
    if (!fromApron) {
      steps.push({ to: player.pos.clone(), dur: 0.18, anim: 'Jump_Start', face: Math.atan2(-r.n.x, -r.n.z), speed: 2.2 });
      steps.push({ to: r.apron, dur: 0.5, arc: 0.45, anim: 'Jump_Loop', sound: () => AR.sound.whoosh(), end: () => AR.sound.thud(false) });
    }
    steps.push({ to: r.apron.clone().addScaledVector(r.n, -0.05), dur: 0.25, anim: 'Crouch_Idle_Loop', face: Math.atan2(-r.n.x, -r.n.z) });
    steps.push({ to: r.inside, dur: 0.7, anim: 'Crouch_Idle_Loop', each: (k) => (player.pos.y = D.RING_H - 0.0) });
    steps.push({ dur: 0.25, anim: 'Idle_Loop', fade: 0.3 });
    runScript(steps, () => {
      if (achieve('ring', 'In the ring!')) {
        excite(0.7, 0.6);
        if (stage < 2) setStage(2);
      } else excite(0.3);
    });
  }
  function climbOut() {
    const r = ringEntry();
    const out = Math.atan2(r.n.x, r.n.z);
    runScript([
      { to: r.inside.clone().addScaledVector(r.n, 0.3), dur: 0.25, anim: 'Crouch_Idle_Loop', face: out },
      { to: r.apron, dur: 0.6, anim: 'Crouch_Idle_Loop' },
      { to: r.floor, dur: 0.55, arc: 0.3, anim: 'Jump_Loop', sound: () => AR.sound.whoosh() },
      { dur: 0.3, anim: 'Jump_Land', speed: 1.6, sound: () => AR.sound.thud(true) },
    ]);
  }
  function nearestCorner() {
    let best = null, bd = 1e9;
    for (const c of arena.corners) {
      const ri = arena.ropeInner - 0.4;
      const d = Math.hypot(player.pos.x - c.sx * ri, player.pos.z - c.sz * ri);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return { c: best, d: bd };
  }
  function climbBuckle(c) {
    const ri = arena.ropeInner;
    const base = V3(c.sx * (ri - 0.45), D.RING_H, c.sz * (ri - 0.45));
    const top = V3(c.sx * (ri - 0.2), D.RING_H + D.ROPE_Y[1] - 0.03, c.sz * (ri - 0.2));
    const outward = Math.atan2(c.sx, c.sz);
    runScript([
      { to: base, dur: 0.3, anim: 'Walk_Loop', face: outward },
      { to: V3(base.x * 0.5 + top.x * 0.5, D.RING_H + D.ROPE_Y[0] - 0.03, base.z * 0.5 + top.z * 0.5), dur: 0.35, anim: 'Jump_Start', speed: 2, sound: () => AR.sound.step('metal') },
      { to: top, dur: 0.35, anim: 'Jump_Land', speed: 1.4, sound: () => AR.sound.step('metal') },
      { dur: 0.2, anim: 'Idle_Loop' },
    ], () => {
      player.mode = 'turnbuckle';
      player.corner = c;
      excite(0.5, 0.4);
      toast('Up top!', 'V to pose · Space to leap · E to climb down');
    });
  }
  function leap() {
    const c = player.corner;
    const inward = Math.atan2(-c.sx, -c.sz);
    const land = V3(-c.sx * 0.2, D.RING_H, -c.sz * 0.2);
    player.corner = null;
    runScript([
      { to: player.pos.clone(), dur: 0.3, anim: 'Jump_Start', face: inward, speed: 2.6 },
      { to: land, dur: 0.85, arc: 1.4, anim: 'Jump_Loop', linear: true, sound: () => AR.sound.whoosh() },
      { to: land.clone().add(V3(-c.sx * 0.5, 0, -c.sz * 0.5)), dur: 1.0, anim: 'Roll', speed: 1.45, sound: () => {
        AR.sound.thud(true);
        shake = 0.35;
      } },
      { dur: 0.25, anim: 'Idle_Loop' },
    ], () => {
      if (achieve('leap', 'High flyer!')) excite(1.0, 1);
      else excite(0.6, 0.6);
    });
  }
  function climbDown() {
    const c = player.corner;
    const ri = arena.ropeInner;
    player.corner = null;
    runScript([
      { to: V3(c.sx * (ri - 0.7), D.RING_H, c.sz * (ri - 0.7)), dur: 0.5, arc: 0.15, anim: 'Jump_Loop', face: Math.atan2(-c.sx, -c.sz) },
      { dur: 0.25, anim: 'Jump_Land', speed: 1.6, sound: () => AR.sound.thud(false) },
    ]);
  }

  // ------------------------------------------------------------------ actions
  function startPose() {
    if (!player.grounded && player.mode !== 'turnbuckle') return;
    player.poseT = 3.6;
    runner.poseTarget = 1;
    runner.play('Idle_Loop', 0.25);
    cam.hero = 1;
    let where = 'floor';
    if (player.mode === 'turnbuckle') where = 'buckle';
    else if (inRing()) where = 'ring';
    else if (groundAt(player.pos.x, player.pos.z, player.pos.y).tag === 'table') where = 'table';
    if (player.holding) {
      if (stage === 5) champion();
      else excite(1.0, 1);
      return;
    }
    if (where === 'ring') {
      if (achieve('pose', 'What a pose!')) {
        excite(1.1, 1);
        if (stage < 3) setStage(3);
      } else excite(0.7, 0.8);
    } else if (where === 'buckle') {
      if (achieve('buckle', 'King of the corner!')) excite(1.1, 1);
      else excite(0.7, 0.8);
    } else if (where === 'table') {
      if (achieve('table', 'On the announce table!')) excite(1.0, 1);
      else excite(0.6, 0.7);
    } else excite(0.35, 0.4);
  }
  function startBusy(anim, dur, speed) {
    player.mode = 'busy';
    player.busyT = dur;
    runner.play(anim, 0.2, speed || 1);
  }
  const PROMO = [
    'St Albans! I have run up Holywell Hill in January. I am not scared of anybody in this building.',
    'They said a club runner could never main-event. Well, they never saw my negative split.',
    'Number fifteen thirty-eight is here, fully hydrated, and going home with that gold!',
  ];
  let promoI = 0;
  function promo() {
    startBusy('Idle_Talking_Loop', 4.6);
    AR.sound.mic();
    subtitle('The Strider', PROMO[promoI++ % PROMO.length], 4.6);
    setTimeout(() => {
      AR.sound.chant();
      excite(0.8, 0.5);
      if (achieve('promo', 'Mic skills!')) excite(0.3);
    }, 2600);
  }
  function entrance() {
    entranceDone = true;
    for (const p of arena.pyroSpots) sparks.fountain(p, 2.2, [1, 0.75, 0.25], 1.2);
    AR.sound.boom();
    AR.sound.theme(6);
    screenGfx('title');
    screenMode = 'title';
    screenModeT = 4.5;
    flash = 1;
    startPose();
    cam.hero = 0;
    cam.cine = { t0: t, dur: 4.2 }; // a wide shot from down the ramp: the runner, the pyro and the screen
    cam.yaw = Math.PI;
    excite(1.2, 1);
    achieve('entrance', 'Here comes #1538!');
    setStage(1);
  }
  function champion() {
    setStage(6);
    for (const c of arena.corners) sparks.fountain(V3(c.x, D.RING_H + 1.7, c.z), 2.5, [1, 0.85, 0.3], 0.8);
    for (const p of arena.pyroSpots) sparks.fountain(p, 3, [1, 0.8, 0.3], 1.3);
    confetti.drop(0, 0, 9, 14);
    AR.sound.boom();
    AR.sound.theme(8);
    AR.sound.bell(3);
    screenGfx('champion');
    screenMode = 'title';
    screenModeT = 12;
    excite(1.4, 1);
    toast('And the new champion!', '#1538 · The St Albans Strider');
  }

  // ------------------------------------------------------------------ interaction prompts
  let entranceDone = false;
  let bellCD = 0, fiveCD = 0;
  function currentInteraction() {
    const p = player.pos;
    if (player.mode === 'turnbuckle') return { label: 'Climb down', act: climbDown };
    if (player.mode !== 'free' || !player.grounded) return null;
    // the belt
    if (beltState === 'waiting' && inRing() && Math.hypot(p.x - beltPos.x, p.z - beltPos.z) < 1.3) {
      return {
        label: 'Grab the championship belt',
        act: () => {
          beltState = 'held';
          player.holding = true;
          runner.holding = belt;
          AR.sound.slap();
          excite(0.9, 1);
          setStage(5);
        },
      };
    }
    // entrance
    if (!entranceDone && p.z < D.STAGE_Z + 0.2 && p.z > D.STAGE_Z - 4.5 && Math.abs(p.x) < 3.5 && p.y > D.RING_H - 0.1) return { label: 'Make your entrance', act: entrance };
    if (inRing()) {
      const nc = nearestCorner();
      if (nc.d < 0.9) return { label: 'Climb the turnbuckle', act: () => climbBuckle(nc.c) };
      const ri = arena.ropeInner;
      if (Math.max(Math.abs(p.x), Math.abs(p.z)) > ri - 0.75) return { label: 'Leave the ring', act: climbOut };
      return null;
    }
    if (onApron()) return { label: 'Step through the ropes', act: () => climbIn(true) };
    // beside the ring on the floor
    if (p.y < 0.3) {
      const ax = Math.abs(p.x), az = Math.abs(p.z);
      if (Math.max(ax, az) < D.PLAT + 1.2 && Math.min(ax, az) < 2.6) return { label: 'Climb into the ring', act: () => climbIn(false) };
      if (p.distanceTo(arena.bell.pos) < 1.4 && bellCD <= 0) {
        return {
          label: 'Ring the bell',
          act: () => {
            player.yaw = faceTo(arena.bell.pos.x, arena.bell.pos.z);
            startBusy('Punch_Jab', 0.8, 1.2);
            setTimeout(() => AR.sound.bell(3), 250);
            bellCD = 3;
            setTimeout(() => {
              if (!achieve('bell', 'Ding ding ding!')) excite(0.3);
              else excite(0.6, 0.3);
            }, 600);
          },
        };
      }
      const tb = arena.table.pos;
      if (Math.abs(p.z - tb.z) < 2.3 && p.x > tb.x - 1.4 && p.x < tb.x) {
        return {
          label: 'Grab a mic and cut a promo',
          act: () => {
            player.yaw = -Math.PI / 2;
            promo();
          },
        };
      }
      for (const s of arena.barricadeSpots) {
        if (Math.hypot(p.x - s.x, p.z - s.z) < 1.2 && fiveCD <= 0) {
          return {
            label: 'High-five the front row',
            act: () => {
              player.yaw = s.face;
              startBusy('Interact', 1.1, 1.6);
              setTimeout(() => AR.sound.slap(), 350);
              fiveCD = 1.2;
              const key = Math.round(s.x / 4) + ',' + Math.round(s.z / 4);
              const fresh = !fives.has(key);
              fives.add(key);
              buildList();
              if (fresh && fives.size >= 3) {
                if (achieve('fives', 'Hero of the people!')) excite(0.6, 0.4);
              } else excite(fresh ? 0.45 : 0.2);
            },
          };
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ update
  let screenMode = 'title', screenModeT = 8, screenFrame = 0;
  let shake = 0;
  let t = 0;
  const tmp = V3(), tmp2 = V3();
  let lastInteraction = null;

  function update(dt) {
    t += dt;
    const gp = gamepad();
    // ---- intent
    let ix = 0, iz = 0;
    if (keys.KeyW || keys.ArrowUp) iz += 1;
    if (keys.KeyS || keys.ArrowDown) iz -= 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    let mag = Math.min(1, Math.hypot(ix, iz));
    if (stick.active && Math.hypot(stick.x, stick.y) > 0.12) {
      ix = stick.x;
      iz = -stick.y;
      mag = Math.min(1, Math.hypot(ix, iz));
    }
    if (gp && Math.hypot(gp.x, gp.y) > 0.1) {
      ix = gp.x;
      iz = -gp.y;
      mag = Math.min(1, Math.hypot(ix, iz));
    }
    const sprint = keys.ShiftLeft || keys.ShiftRight || keys.PadRun;
    // ---- camera look
    if (look.dx || look.dy) cam.lastInput = t;
    cam.yaw -= look.dx * 0.0032;
    cam.pitch = clamp(cam.pitch + look.dy * 0.0025, -0.35, 1.1);
    look.dx = look.dy = 0;

    // ---- actions
    const inter = currentInteraction();
    if (consume('KeyE') && inter) inter.act();
    if (consume('KeyV')) {
      if (player.mode === 'free' || player.mode === 'turnbuckle') startPose();
    }
    if (consume('KeyB') && player.mode === 'free' && player.grounded) {
      startBusy('Dance_Loop', 3.0);
      excite(0.3, 0.2);
    }
    if (consume('KeyF') && player.mode === 'free' && player.grounded) {
      startBusy(Math.random() < 0.5 ? 'Punch_Jab' : 'Punch_Cross', 0.75, 1.1);
      AR.sound.whoosh();
    }
    const jump = consume('Space');
    if (jump && player.mode === 'turnbuckle') leap();
    if (consume('KeyM')) toggleMute();
    if (consume('KeyH')) $('help').classList.toggle('hidden');
    if (consume('KeyJ')) $('list').classList.toggle('collapsed');
    if (consume('KeyQ')) {
      // reset if stuck
      player.mode = 'free';
      player.script = null;
      player.pos.set(0, 0, -6.5);
    }

    // ---- movement
    const camF = V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); // camera looks along this (flattened)
    const camR = V3(-camF.z, 0, camF.x);
    if (player.mode === 'script') {
      updateScript(dt);
    } else if (player.mode === 'busy') {
      player.busyT -= dt;
      if (player.busyT <= 0 || (mag > 0.3 && player.busyT < 0.6)) player.mode = 'free';
    } else if (player.mode === 'turnbuckle') {
      // standing up top; the pose is handled below
    } else {
      const want = V3().addScaledVector(camF, iz).addScaledVector(camR, ix);
      if (want.lengthSq() > 1e-4) want.normalize();
      const maxSpeed = mag < 0.55 && (stick.active || gp) ? 1.5 : sprint ? 6.2 : 3.4;
      const target = mag > 0.05 ? maxSpeed * Math.max(mag, 0.35) : 0;
      player.speed = damp(player.speed, target, player.grounded ? 10 : 2, dt);
      if (mag > 0.05) {
        const yaw = Math.atan2(want.x, want.z);
        player.yaw += angDiff(player.yaw, yaw) * (1 - Math.exp(-dt * 12));
        if (player.poseT > 0 && player.poseT < 3.3) endPose();
      }
      const dir = V3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const step = player.speed * dt;
      const nx = player.pos.x + dir.x * step, nz = player.pos.z + dir.z * step;
      if (!blocked(nx, player.pos.z, player.pos.y)) player.pos.x = nx;
      else player.speed *= 0.9;
      if (!blocked(player.pos.x, nz, player.pos.y)) player.pos.z = nz;
      else player.speed *= 0.9;
      // vertical
      const gr = groundAt(player.pos.x, player.pos.z, player.pos.y);
      if (jump && player.grounded && player.poseT <= 0) {
        player.vy = 4.7;
        player.grounded = false;
        player.airFrom = player.pos.y;
        runner.play('Jump_Loop', 0.12);
        AR.sound.whoosh();
      }
      if (player.grounded) {
        if (gr.y < player.pos.y - 0.3) {
          player.grounded = false; // walked off an edge
          player.airFrom = player.pos.y;
          player.vy = 0;
        } else player.pos.y = damp(player.pos.y, gr.y, 30, dt);
      } else {
        player.vy -= 13.5 * dt;
        player.pos.y += player.vy * dt;
        if (player.pos.y <= gr.y && player.vy <= 0) {
          player.pos.y = gr.y;
          player.grounded = true;
          const fall = player.airFrom - gr.y;
          player.landT = 0.32;
          runner.play('Jump_Land', 0.08, 1.8);
          AR.sound.thud(fall > 0.6);
          if (fall > 0.9) shake = 0.25;
        }
      }
      // footsteps
      if (player.grounded && player.speed > 0.5) {
        player.stride += step;
        const len = player.speed > 4.5 ? 1.6 : player.speed > 2 ? 1.2 : 0.75;
        if (player.stride > len) {
          player.stride = 0;
          AR.sound.step(surfaceSound(gr.tag));
        }
      }
      player.surface = gr.tag;
      // locomotion animation
      if (player.poseT <= 0) {
        if (!player.grounded) runner.play('Jump_Loop', 0.15);
        else if (player.landT > 0) player.landT -= dt;
        else if (player.speed < 0.25) runner.play('Idle_Loop', 0.3);
        else if (player.speed < 2.0) {
          runner.play('Walk_Loop', 0.25);
          runner.setSpeed(player.speed / 1.35);
        } else if (player.speed < 4.6) {
          runner.play('Jog_Fwd_Loop', 0.25);
          runner.setSpeed(player.speed / 3.4);
        } else {
          runner.play('Sprint_Loop', 0.25);
          runner.setSpeed(player.speed / 6.0);
        }
      }
    }
    if (player.poseT > 0) {
      player.poseT -= dt;
      if (player.poseT <= 0) endPose();
    }
    bellCD -= dt;
    fiveCD -= dt;

    // ---- runner object
    runner.object.position.copy(player.pos);
    runner.object.rotation.y = player.yaw;
    AR.runnerSweat.value = damp(AR.runnerSweat.value, Math.min(1, energy * 0.6 + (player.speed > 4 ? 0.3 : 0)), 0.3, dt);
    runner.update(dt);

    // ---- belt
    if (beltState === 'lowering') {
      beltPos.y = Math.max(D.RING_H + 1.55, beltPos.y - dt * 1.6);
      belt.position.copy(beltPos);
      belt.rotation.y = t * 0.6;
      beltCable.scale.y = 30 - beltPos.y;
      beltCable.position.set(0, beltPos.y + 0.2, 0);
      if (beltPos.y <= D.RING_H + 1.551) beltState = 'waiting';
    } else if (beltState === 'waiting') {
      belt.position.set(0, D.RING_H + 1.55 + Math.sin(t * 2) * 0.03, 0);
      belt.rotation.y = t * 0.6;
    } else if (beltState === 'held') {
      beltCable.visible = false;
      const q = runner.object.quaternion;
      if (runner.pose > 0.5) {
        const a = runner.bonePos('DEF-hand.L', tmp), b = runner.bonePos('DEF-hand.R', tmp2);
        belt.position.copy(a).add(b).multiplyScalar(0.5);
        belt.position.y += 0.06;
        belt.quaternion.copy(q);
      } else {
        // slung over the left shoulder like a sash
        runner.bonePos('DEF-spine.003', belt.position);
        belt.position.add(V3(0.0, 0.02, 0.15).applyQuaternion(q));
        belt.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0, 0.75)));
      }
    }

    // ---- crowd energy, story beats
    energyShown = damp(energyShown, energy, 3, dt);
    pop = Math.max(0, pop - dt * 0.28);
    flash = Math.max(0, flash - dt * 0.35);
    const hype = clamp(0.18 + energy * 0.7, 0, 1);
    arena.U.uHype.value = hype;
    arena.U.uPop.value = Math.min(1, pop);
    arena.U.uFlash.value = flash;
    AR.sound.setHype(Math.min(1, hype * 0.7 + pop * 0.4));
    if (stage === 3 && energy >= 0.999) beltDown();
    if (stage === 0 && Math.hypot(player.pos.x, player.pos.z + 4) < 7 && player.pos.y < 0.5) setStage(1);
    if (stage === 3) objective(`Get the crowd to fever pitch: work through the crowd pleasers (${Math.round(energy * 100)}%)`);
    // ambient chants now and then when the crowd is hot
    chantT -= dt;
    if (chantT < 0) {
      chantT = 14 + Math.random() * 12;
      if (energy > 0.35 && started) AR.sound.chant();
    }

    // ---- arena, fx
    arena.update(t, dt, tmp.copy(player.pos).setY(player.pos.y + 1.5), hype);
    arena.follow.target.position.copy(player.pos);
    arena.follow.position.set(player.pos.x * 0.3, 16, 26);
    sparks.update(dt);
    confetti.update(t, dt);

    // ---- HUD
    $('energy-fill').style.width = Math.round(energyShown * 100) + '%';
    $('energy-pct').textContent = Math.round(energy * 100) + '%';
    const pr = $('prompt');
    if (inter && !(player.mode === 'turnbuckle' && player.poseT > 0)) {
      $('prompt-key').textContent = isTouch ? '✋' : 'E';
      $('prompt-text').textContent = inter.label;
      pr.classList.remove('hidden');
    } else pr.classList.add('hidden');
    lastInteraction = inter;
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) $('toast').classList.add('hidden');
    }
    if (subT > 0) {
      subT -= dt;
      if (subT <= 0) $('subtitle').classList.add('hidden');
    }
    if (screenModeT > 0) {
      screenModeT -= dt;
      if (screenModeT <= 0) {
        screenMode = 'live';
        screenGfx('live', stage >= 6 ? 'CHAMPION · #1538' : null);
      }
    }
  }
  let chantT = 20;
  function endPose() {
    player.poseT = 0;
    runner.poseTarget = 0;
    cam.hero = 0;
  }
  let beltCable = null;
  function beltDown() {
    setStage(4);
    beltState = 'lowering';
    belt.visible = true;
    beltCable.visible = true;
    AR.sound.theme(4);
    excite(1.2, 1);
    toast('The title is on the line!', 'The belt is coming down');
  }

  // ------------------------------------------------------------------ camera
  function updateCamera(dt) {
    const p = player.pos;
    const target = tmp.set(p.x, p.y + 1.45, p.z);
    // drift behind the runner when moving and nobody is steering the camera
    if (t - cam.lastInput > 1.6 && player.speed > 1 && player.mode === 'free') {
      const behind = player.yaw + Math.PI;
      cam.yaw += angDiff(cam.yaw, behind) * (1 - Math.exp(-dt * 1.2));
    }
    let pos, lookAt, fov;
    const sx = Math.sin(cam.yaw) * Math.cos(cam.pitch), sz = Math.cos(cam.yaw) * Math.cos(cam.pitch), sy = Math.sin(cam.pitch);
    const orbit = V3(target.x + sx * cam.dist, target.y + sy * cam.dist, target.z + sz * cam.dist);
    orbit.y = Math.max(orbit.y, 0.35);
    pos = orbit;
    lookAt = target.clone();
    fov = 55;
    if (cam.cine && t - cam.cine.t0 < cam.cine.dur) {
      const k = (t - cam.cine.t0) / cam.cine.dur;
      pos = V3(-1.2 + k * 1.6, 2.2 + k * 0.4, -9.5 - k * 2.5);
      lookAt = V3(0, 3.4 - k * 0.6, -19.5);
      fov = 50;
    } else if (cam.hero > 0) {
      // the low hero shot: in front of the runner, looking up past the ropes
      const f = V3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const side = V3(f.z, 0, -f.x);
      const k = clamp((3.6 - player.poseT) / 3.6, 0, 1);
      const dist = 4.6 - k * 0.6;
      const hero = V3(p.x + f.x * dist + side.x * 0.1, p.y + 0.55, p.z + f.z * dist + side.z * 0.1);
      if (player.mode === 'turnbuckle') hero.y = Math.max(D.RING_H + 0.3, p.y - 0.4);
      hero.y = Math.max(hero.y, 0.4);
      pos = hero;
      lookAt = V3(p.x, p.y + 1.25, p.z);
      fov = 42;
    }
    // keep the camera out of walls, tables, the stands and the ring apron
    pos = unblockCamera(lookAt, pos);
    const k = 1 - Math.exp(-dt * (cam.hero ? 3 : 10));
    cam.pos.lerp(pos, cam.hero || cam.wasHero ? 1 - Math.exp(-dt * 3.5) : k);
    cam.look.lerp(lookAt, 1 - Math.exp(-dt * 8));
    cam.wasHero = cam.hero ? 1 : Math.max(0, (cam.wasHero || 0) - dt * 2);
    cam.fov = damp(cam.fov, fov, 4, dt);
    camera.position.copy(cam.pos);
    if (shake > 0) {
      shake = Math.max(0, shake - dt);
      camera.position.x += (Math.random() - 0.5) * shake * 0.3;
      camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    }
    camera.lookAt(cam.look);
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
  }

  const CAM_SKIP = { rope: 1, post: 1, rail: 1 };
  function camInside(x, y, z) {
    for (const s of arena.solids) {
      if (CAM_SKIP[s.tag]) continue;
      const m = 0.18;
      if (x > s.minX - m && x < s.maxX + m && z > s.minZ - m && z < s.maxZ + m && y > s.bottom - 0.1 && y < s.top + 0.15) return true;
    }
    return false;
  }
  function unblockCamera(from, to) {
    const d = to.clone().sub(from);
    const len = d.length();
    d.divideScalar(len);
    let ok = len;
    for (let s = 0.4; s <= len; s += 0.15) {
      if (camInside(from.x + d.x * s, from.y + d.y * s, from.z + d.z * s)) {
        ok = Math.max(0.4, s - 0.2);
        break;
      }
    }
    return from.clone().addScaledVector(d, ok);
  }

  // the big screen's camera: a hard cam in the south stands, zoomed onto the runner
  function renderScreen() {
    const S = arena.screen;
    const c = S.cam;
    const p = player.pos;
    c.position.set(p.x * 0.4, 7, 21);
    const tgt = V3(p.x, p.y + 1.2, p.z);
    c.lookAt(tgt);
    const d = c.position.distanceTo(tgt);
    c.fov = THREE.MathUtils.radToDeg(2 * Math.atan(1.6 / d));
    c.updateProjectionMatrix();
    S.mesh.visible = false;
    renderer.setRenderTarget(S.live);
    renderer.render(scene, c);
    renderer.setRenderTarget(null);
    S.mesh.visible = true;
  }

  function render() {
    screenFrame++;
    // the big screen's live picture costs a second render, so refresh it every few frames
    if (screenMode === 'live' && screenFrame % (quality > 2 ? 2 : 4) === 0) renderScreen();
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  // ------------------------------------------------------------------ loop
  let last = performance.now();
  let fpsAcc = 0, fpsN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (AR.debug.paused) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    updateCamera(dt);
    render();
    // drop the resolution a notch if the frame rate sags
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc > 3) {
      const fps = fpsN / fpsAcc;
      if (fps < 35 && renderer.getPixelRatio() > 0.8) {
        renderer.setPixelRatio(renderer.getPixelRatio() * 0.85);
        resize();
      }
      fpsAcc = 0;
      fpsN = 0;
    }
  }

  function toggleMute() {
    const m = !AR.sound.muted;
    AR.sound.setMuted(m);
    $('mute').textContent = m ? '🔇' : '🔊';
  }
  $('mute').addEventListener('click', toggleMute);

  // ------------------------------------------------------------------ boot
  arena = AR.buildArena(scene, { quality });
  sparks = new AR.Sparks(scene, 3000);
  confetti = new AR.Confetti(scene, quality > 1 ? 1600 : 700);
  belt = AR.makeBelt();
  belt.visible = false;
  belt.position.copy(beltPos);
  scene.add(belt);
  beltCable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), new THREE.MeshBasicMaterial({ color: 0x888888 }));
  beltCable.geometry.translate(0, 0.5, 0);
  beltCable.visible = false;
  scene.add(beltCable);
  screenGfx('title');
  buildList();
  setStage(0);
  AR.loadRunner((R) => {
    runner = R;
    scene.add(R.object);
    R.object.position.copy(player.pos);
    cam.pos.set(player.pos.x, player.pos.y + 2.2, player.pos.z - 3.6);
    cam.look.copy(player.pos);
    update(0.016);
    updateCamera(1);
    // compile shaders before the first frame is shown
    try {
      renderer.compile(scene, camera);
    } catch (e) {
      /* ignore */
    }
    render();
    $('loading').classList.add('hidden');
    $('start').classList.remove('hidden');
    requestAnimationFrame(frame);
    AR.ready = true;
  });
  $('start').addEventListener('click', () => {
    started = true;
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    AR.sound.start();
    AR.sound.cheer(0.6);
    if (isTouch) {
      setupTouch();
      $('list').classList.add('collapsed');
      $('list').querySelector('.label').addEventListener('pointerdown', () => $('list').classList.toggle('collapsed'));
    }
    else canvas.click();
    setTimeout(() => $('help').style.opacity = '0.65', 15000);
  });

  // ------------------------------------------------------------------ hooks for automated checks and screenshots
  AR.debug = {
    paused: params.has('auto'), // automation drives the game with sim() instead of the frame loop
    start() {
      $('start').click();
    },
    sim(seconds, step = 1 / 30) {
      for (let s = 0; s < seconds; s += step) {
        update(step);
        updateCamera(step);
      }
      render();
    },
    key(code, down = true) {
      if (down && !keys[code]) pressed[code] = true;
      keys[code] = down;
    },
    tap(code) {
      pressed[code] = true;
    },
    place(x, y, z, yaw) {
      player.pos.set(x, y, z);
      player.yaw = yaw || 0;
      player.mode = 'free';
      player.grounded = true;
      player.vy = 0;
    },
    setCam(yaw, pitch, dist) {
      cam.yaw = yaw;
      cam.pitch = pitch;
      if (dist) cam.dist = dist;
      cam.lastInput = t;
    },
    state() {
      return {
        pos: player.pos.toArray().map((v) => +v.toFixed(2)),
        yaw: +player.yaw.toFixed(2),
        mode: player.mode,
        grounded: player.grounded,
        anim: runner && runner.currentName,
        energy: +energy.toFixed(2),
        stage,
        belt: beltState,
        inRing: inRing(),
        prompt: lastInteraction && lastInteraction.label,
        done: Object.keys(done),
        crowd: arena.crowdCount,
        calls: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
      };
    },
    energy(v) {
      energy = v;
    },
    reEntrance() {
      entranceDone = false;
    },
  };
})();
