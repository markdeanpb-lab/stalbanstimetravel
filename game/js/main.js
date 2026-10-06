/* Bootstrap, renderer, era scenes, third-person camera, game state machine and main loop. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;

  const Game = (SA.Game = {
    state: 'loading',
    era: 2026,
    time: 0,
    flags: {},
    settings: {},
    inputLocked: false,
    paused: false,
    playTime: 0,
    fps: 0,
  });

  const DEFAULT_SETTINGS = { quality: U.isTouch() ? 'low' : 'high', subtitleSize: 'medium', sensitivity: 1, invertY: false, volume: 0.8, music: 0.5, touch: 'auto', showFps: false, cameraShake: true, reduceFlashes: false };

  // ------------------------------------------------------------------ renderer & scene
  let renderer, scene, camera, hemi, sun, sky, ground, groundMat;
  const eraMats = {};
  function setupRenderer() {
    // renderer, lights, sky and post-processing live in core/render.js
    const R = SA.Render.setup(document.getElementById('game'), Game.settings.quality);
    renderer = R.renderer;
    scene = R.scene;
    camera = R.camera;
    hemi = R.hemi;
    sun = R.sun;
    sky = R.sky;
  }

  function makeEraMaterials(eraId, atlas) {
    const uniforms = { uWaveMode: { value: 0 }, uNight: { value: SA.ERAS[eraId].night }, uLitFrac: { value: eraId === 1897 ? 0.55 : eraId === 1964 ? 0.1 : 0.25 }, uEra: { value: eraId }, uBoost: { value: SA.Render.tier.boost } };
    const facade = SA.Tex.facadeMaterial(atlas, uniforms);
    facade.emissiveIntensity = SA.Render.tier.boost; // lit windows read as light sources (bloom on post tiers)
    const roof = SA.Tex.roofMaterial(uniforms);
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));
    const signMat = std({ map: null, roughness: 0.7 });
    const signMatW = SA.Tex.waveMaterial(uniforms, { map: null, roughness: 0.7 });
    const signPlain = std({ map: null, side: THREE.DoubleSide, roughness: 0.7 });
    const chimney = std({ color: 0xffffff, roughness: 0.9 });
    const prop = std({ vertexColors: true, roughness: 0.72 });
    const propGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
    propGlow.color.setScalar(SA.Render.tier.boost); // lamp glass brighter than white, so it blooms
    const foliage = std({ vertexColors: true, color: eraId === 2026 ? 0xd9c08a : eraId === 1964 ? 0xffffff : 0xcfe0b0, roughness: 0.95 });
    const bunting = std({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    const signAlpha = std({ map: null, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
    SA.Tex.patchInstancedWave(chimney, uniforms);
    SA.Tex.patchInstancedWave(prop, uniforms);
    SA.Tex.patchInstancedWave(propGlow, uniforms);
    SA.Tex.patchInstancedWave(foliage, uniforms);
    // trees: October colour in 2026 and 1964, June green in 1897
    const leaves = SA.Trees.leafMaterial(uniforms, eraId === 2026 ? 0xe6c886 : eraId === 1964 ? 0xd8d49a : 0xc4dca8);
    const bark = SA.Trees.barkMaterial(uniforms);
    return { uniforms, facade, roof, signMat: signMatW, signMatPlainBase: signMat, signPlain, signAlpha, chimney, prop, propGlow, foliage, bunting, passage: facade, leaves, bark };
  }

  // ------------------------------------------------------------------ era application (lighting etc.)
  Game.applyEraLook = function (eraId) {
    const E = SA.ERAS[eraId];
    const look = SA.Render.eraLook(E);
    SA.Render.applyLook(look);
    SA.Render.useEnv(eraId, look);
    Game.sunDir = look.lightDir.clone();
    // the CSS grade overlay only stands in for the post-processing grade on the plain renderer
    const gr = document.getElementById('grade');
    const post = !!SA.Render.composer;
    gr.style.setProperty('--tint', post ? 'transparent' : E.grade.color);
    gr.style.setProperty('--vig', post ? 0 : E.grade.vignette);
    gr.style.setProperty('--grain', post || Game.settings.quality === 'low' ? 0 : E.grade.grain);
    document.body.dataset.era = eraId;
  };

  Game.showEra = function (eraId) {
    for (const k in SA.World.eras) SA.World.eras[k].group.visible = +k === eraId;
    SA.World.current = SA.World.eras[eraId];
    Game.era = eraId;
    // ground textures
    const gu = groundMat.userData.uniforms;
    const gt = SA.World.eras[eraId].groundTex;
    gu.tColA.value = gt.col;
    gu.tMatA.value = gt.mat;
    gu.uWaveMode.value = 0;
    Game.applyEraLook(eraId);
    SA.emit('era', eraId);
  };
  Game.groundMat = () => groundMat;
  Game.scene = () => scene;
  Game.camera = () => camera;
  Game.renderer = () => renderer;
  Game.sun = () => sun;
  Game.sky = () => sky;
  Game.hemi = () => hemi;

  // Rebuild an era (after a consequence flag changes its variants)
  Game.rebuildEra = function (eraId) {
    const old = SA.World.eras[eraId];
    if (old) {
      scene.remove(old.group);
      old.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      if (old.signAtlas && old.signAtlas.texture) old.signAtlas.texture.dispose();
    }
    buildOneEra(eraId);
    if (Game.era === eraId) Game.showEra(eraId);
    else SA.World.eras[eraId].group.visible = false;
    SA.emit('era-rebuilt', eraId);
  };

  let facadeAtlas = null;
  function buildOneEra(eraId) {
    const mats = eraMats[eraId] || (eraMats[eraId] = makeEraMaterials(eraId, facadeAtlas));
    const e = SA.World.buildEra(eraId, Game.flags, mats);
    e.mats = mats;
    SA.World.eras[eraId] = e;
    const pair = SA.Terrain.paint(eraId, SA.World);
    e.groundTex = SA.Terrain.canvasToTextures(pair);
    scene.add(e.group);
    e.group.visible = false;
    SA.Nav && SA.Nav.buildFor && SA.Nav.buildFor(e);
    return e;
  }

  // ------------------------------------------------------------------ camera controller
  const Cam = (Game.cam = { yaw: Math.PI, pitch: 0.28, dist: 4.6, curDist: 4.6, tightYaw: 0, tightPitch: 0, tightGoal: -1, target: new THREE.Vector3(), lastInput: 0, shake: 0, fovKick: 0, override: null });
  // [yaw offset, pitch offset] candidates for the tight-street camera, in order of preference
  const TIGHT_TRIES = [[0, 0.45], [0, 0.85], [0.55, 0.3], [-0.55, 0.3], [1.0, 0.35], [-1.0, 0.35]];
  function updateCamera(dt) {
    const I = SA.Input;
    const sens = 0.0042 * (Game.settings.sensitivity || 1);
    let dyaw = -I.look.dx * sens, dpitch = I.look.dy * sens * (Game.settings.invertY ? -1 : 1);
    dyaw -= I.lookStick.x * 2.4 * dt;
    dpitch += I.lookStick.y * 1.8 * dt * (Game.settings.invertY ? -1 : 1);
    if (Math.abs(dyaw) + Math.abs(dpitch) > 1e-5) Cam.lastInput = Game.time;
    Cam.yaw += dyaw;
    Cam.pitch = U.clamp(Cam.pitch + dpitch, -0.35, 1.25);
    const P = SA.Player;
    const v = P.vehicle;
    const px = v ? v.x : P.ch.x, pz = v ? v.z : P.ch.z, py = (v ? v.y : P.ch.y) + (v ? v.def.camHeight || 1.6 : 1.55);
    // auto-recentre behind movement after a pause in camera input
    const moving = v ? Math.abs(v.speed) > 1.5 : P.ch.speedNow > 1.0 && Math.abs(I.move.y) > 0.3;
    if (moving && Game.time - Cam.lastInput > (v ? 0.8 : 2.0)) {
      const heading = v ? v.yaw + (v.speed < 0 ? Math.PI : 0) : P.ch.yaw;
      // camera forward (-sin yaw, -cos yaw) should match the heading (sin h, cos h): yaw = h + PI
      Cam.yaw = U.dampAngle(Cam.yaw, heading + Math.PI, v ? 3.0 : 1.2, dt);
      if (v) Cam.pitch = U.damp(Cam.pitch, 0.2, 1.5, dt);
    }
    if (I.pressed('camreset')) {
      Cam.yaw = (v ? v.yaw : P.ch.yaw) + Math.PI;
      Cam.lastInput = Game.time;
    }
    Cam.dist = v ? v.def.camDist || 7.5 : 4.6;
    // target smoothing
    Cam.target.x = U.damp(Cam.target.x, px, 14, dt);
    Cam.target.y = U.damp(Cam.target.y, py, 10, dt);
    Cam.target.z = U.damp(Cam.target.z, pz, 14, dt);
    if (Cam.override) {
      const o = Cam.override;
      camera.position.lerp(o.pos, 1 - Math.exp(-o.speed * dt));
      Cam.lookAt = Cam.lookAt || new THREE.Vector3();
      Cam.lookAt.lerp(o.look, 1 - Math.exp(-o.speed * dt));
      camera.lookAt(Cam.lookAt);
      return;
    }
    // desired position: behind (yaw) & above (pitch); yaw = direction the camera looks along (forward)
    const tx = Cam.target.x, ty = Cam.target.y, tz = Cam.target.z;
    const want = Cam.dist;
    const col = SA.World.current.col;
    // anti-clip against buildings: cast from target to desired camera position
    const reach = (yaw, pitch) => {
      const cp = Math.cos(pitch);
      const dx = Math.sin(yaw) * cp, dz = Math.cos(yaw) * cp, dy = Math.sin(pitch);
      const frac = col ? castCam(col, tx, ty, tz, tx + dx * want, ty + dy * want, tz + dz * want) : 1;
      return Math.max(0.6, want * frac - 0.35);
    };
    // tight streets: when the wall behind is close, crane up over the shoulder, then try
    // swinging a little to either side. The player's own yaw/pitch are left untouched;
    // the offsets ease back to zero once there is room again.
    let goalPitch = 0, goalYaw = 0, goal = -1;
    const base = reach(Cam.yaw, Cam.pitch);
    if (base < 2.6) {
      let best = base + 0.4; // hysteresis: only move for a clear gain, and favour the current choice
      TIGHT_TRIES.forEach(([ay, ap], i) => {
        // while moving, only crane up: swinging sideways would turn the camera-relative controls
        if (ay !== 0 && moving) return;
        const r = reach(Cam.yaw + ay, Math.min(1.3, Cam.pitch + ap)) + (i === Cam.tightGoal ? 0.3 : 0);
        if (r > best) { best = r; goal = i; goalYaw = ay; goalPitch = Math.min(1.3, Cam.pitch + ap) - Cam.pitch; }
      });
    }
    Cam.tightGoal = goal;
    Cam.tightYaw = U.damp(Cam.tightYaw, goalYaw, 3, dt);
    Cam.tightPitch = U.damp(Cam.tightPitch, goalPitch, 3, dt);
    const pitch = Cam.pitch + Cam.tightPitch, yaw = Cam.yaw + Cam.tightYaw;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const dx = Math.sin(yaw) * cp, dz = Math.cos(yaw) * cp, dy = sp;
    const d = reach(yaw, pitch);
    // also keep the camera above ground
    // smooth: pull in fast, ease out slowly
    Cam.curDist = d < Cam.curDist ? U.damp(Cam.curDist, d, 30, dt) : U.damp(Cam.curDist, d, 3.5, dt);
    let cx = tx + dx * Cam.curDist, cy = ty + dy * Cam.curDist, cz = tz + dz * Cam.curDist;
    const gh = SA.Terrain.height(cx, cz) + 0.35;
    if (cy < gh) cy = gh;
    // close to the player in tight spaces: raise the camera a little for a better view
    if (Cam.curDist < 2.2) cy += (2.2 - Cam.curDist) * 0.25;
    if (Cam.shake > 0 && Game.settings.cameraShake) {
      cx += (Math.random() - 0.5) * Cam.shake;
      cy += (Math.random() - 0.5) * Cam.shake;
      cz += (Math.random() - 0.5) * Cam.shake;
      Cam.shake = Math.max(0, Cam.shake - dt * 2);
    }
    camera.position.set(cx, cy, cz);
    camera.lookAt(tx, ty + 0.15, tz);
    const fov = 62 + Cam.fovKick + (v ? U.clamp(Math.abs(v.speed) * 0.35, 0, 10) : 0);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = U.damp(camera.fov, fov, 4, dt);
      camera.updateProjectionMatrix();
    }
    // hide the player if the camera is inside them
    SA.Player.ch.camNear = Cam.curDist < 0.9;
  }
  function castCam(col, ax, ay, az, bx, by, bz) {
    // ignore passage buildings when the target stands in a passage
    const pas = col.passages && SA.Landmarks.inPassage(ax, az, col.passages);
    if (pas) {
      const off = [];
      col.query(ax - 6, az - 6, ax + 6, az + 6, (it) => {
        if (it.type === 'poly' && it.owner && it.owner.id === pas.bid) {
          it.enabled = false;
          off.push(it);
        }
      });
      const f = col.castCamera(ax, ay, az, bx, by, bz);
      for (const it of off) it.enabled = true;
      return f;
    }
    return col.castCamera(ax, ay, az, bx, by, bz);
  }

  // ------------------------------------------------------------------ loading
  function setLoad(p, msg) {
    const b = document.getElementById('load-bar');
    if (b) b.style.width = Math.round(p * 100) + '%';
    if (msg) document.getElementById('load-msg').textContent = msg;
  }
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  async function load() {
    Game.settings = Object.assign({}, DEFAULT_SETTINGS, SA.Save.loadSettings());
    SA.Input.sensitivity = Game.settings.sensitivity;
    setupRenderer();
    // scanned brick, stone, slate and paving (falls back to the painted materials if they fail)
    setLoad(0.02, 'Laying the bricks…');
    await nextFrame();
    try {
      await SA.PBR.load(renderer, Game.settings.quality === 'low' ? 256 : 512, (f) => setLoad(0.02 + f * 0.06));
    } catch (e) {
      console.warn('[SA] scanned textures unavailable, using painted ones', e);
    }
    setLoad(0.08, 'Reading the map…');
    await nextFrame();
    SA.World.init();
    facadeAtlas = SA.Tex.makeFacadeAtlas(Game.settings.quality === 'low' ? 128 : 256);
    // ground paint resolution (two canvases per era): 1.2 m per pixel on Low, 0.6 m otherwise
    SA.Terrain.SPLAT = Game.settings.quality === 'low' ? 512 : 1024;
    groundMat = SA.Terrain.makeMaterial();
    ground = SA.Terrain.buildMesh(groundMat, Game.settings.quality === 'low' ? 8 : 6);
    scene.add(ground);
    const save = SA.Save.read();
    Game.flags = (save && save.flags) || {};
    const msgs = { 2026: 'Building 2026…', 1964: 'Winding back to 1964…', 1897: 'Lighting the gas lamps of 1897…' };
    let i = 0;
    for (const e of [2026, 1964, 1897]) {
      setLoad(0.1 + i * 0.27, msgs[e]);
      await nextFrame();
      buildOneEra(e);
      i++;
    }
    setLoad(0.92, 'Waking the townsfolk…');
    await nextFrame();
    const pool = (Game.pool = new SA.CharPool(scene));
    SA.Player.init(pool);
    SA.Vehicles && SA.Vehicles.init(scene);
    SA.NPCs && SA.NPCs.init(pool);
    SA.Traffic && SA.Traffic.init();
    SA.Police && SA.Police.init(pool);
    SA.Audio && SA.Audio.init(Game.settings);
    SA.HUD && SA.HUD.init();
    SA.Menus && SA.Menus.init();
    SA.TimeKey && SA.TimeKey.init();
    SA.Mission && SA.Mission.init();
    SA.Discoveries && SA.Discoveries.init();
    Game.showEra(2026);
    SA.Player.teleport(150, -150, Math.PI);
    setLoad(1, 'Ready.');
    await nextFrame();
    Game.state = 'title';
    SA.emit('loaded');
    if (SA.Menus) {
      SA.Menus.showTitle();
      // a game in progress when the page was republished carries on where it was
      if (SA.hotResume) {
        const d = SA.hotResume;
        SA.hotResume = null;
        SA.Menus.resume(d);
      }
    } else Game.start(null);
  }

  // ------------------------------------------------------------------ game start / serialise
  // forget pending timed events and police memory from any earlier game in this tab
  function resetSession() {
    SA.clearTimers();
    if (SA.Police) {
      SA.Police.clear();
      SA.Police.perEra = {};
    }
  }
  Game.newGame = function () {
    resetSession();
    Game.flags = {};
    for (const e of [1964, 2026]) Game.rebuildEra(e);
    SA.Player.inventory = [];
    SA.Player.setOutfit('modern');
    Game.playTime = 0;
    SA.Mission && SA.Mission.reset();
    SA.TimeKey && SA.TimeKey.reset();
    SA.Discoveries && SA.Discoveries.reset();
    Game.switchEraInstant(2026);
    const sp = SA.Mission ? SA.Mission.startPos() : { x: 150, z: -150, yaw: Math.PI };
    SA.Player.teleport(sp.x, sp.z, sp.yaw);
    Cam.yaw = sp.camYaw !== undefined ? sp.camYaw : sp.yaw + Math.PI;
    Game.start();
    SA.Mission && SA.Mission.begin();
  };
  Game.serialize = function () {
    const p = SA.Player.pos();
    return {
      v: 1,
      t: Date.now(),
      era: Game.era,
      pos: [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10],
      yaw: Math.round(SA.Player.ch.yaw * 100) / 100,
      flags: Game.flags,
      inv: SA.Player.inventory.slice(),
      outfit: SA.Player.outfit,
      mission: SA.Mission ? SA.Mission.serialize() : null,
      key: SA.TimeKey ? SA.TimeKey.serialize() : null,
      disc: SA.Discoveries ? SA.Discoveries.serialize() : null,
      play: Math.round(Game.playTime),
    };
  };
  Game.load = function (d) {
    if (!d) return false;
    resetSession();
    Game.flags = d.flags || {};
    for (const e of [2026, 1964, 1897]) Game.rebuildEra(e);
    SA.Player.inventory = (d.inv || []).slice();
    SA.Player.setOutfit(d.outfit || 'modern');
    Game.playTime = d.play || 0;
    SA.Mission && SA.Mission.deserialize(d.mission);
    SA.TimeKey && SA.TimeKey.deserialize(d.key);
    SA.Discoveries && SA.Discoveries.deserialize(d.disc);
    Game.switchEraInstant(d.era || 2026);
    const pos = d.pos || [150, -150];
    const safe = SA.World.findSafe(Game.era, pos[0], pos[1], { avoidRoad: false });
    SA.Player.teleport(safe.x, safe.z, d.yaw || 0);
    Cam.yaw = (d.yaw || 0) + Math.PI;
    Game.start();
    SA.emit('game-loaded');
    return true;
  };
  Game.save = function (quiet) {
    const data = Game.serialize();
    const ok = SA.Save.write(data);
    if (!quiet && SA.HUD) SA.HUD.toast(ok ? 'Game saved' : 'Saved for this session only (browser storage unavailable). Use a save code to keep progress.');
    return ok;
  };
  Game.setFlag = function (k, v) {
    Game.flags[k] = v;
    SA.emit('flag', k, v);
  };
  Game.switchEraInstant = function (eraId) {
    SA.NPCs && SA.NPCs.clearEra();
    SA.Traffic && SA.Traffic.clearEra();
    SA.Police && SA.Police.clearEra();
    Game.showEra(eraId);
    SA.NPCs && SA.NPCs.spawnEra(eraId);
    SA.Traffic && SA.Traffic.spawnEra(eraId);
    SA.Vehicles && SA.Vehicles.spawnParked(eraId);
  };
  Game.start = function () {
    Game.state = 'play';
    SA.emit('play');
  };
  Game.pause = function (on) {
    if (Game.state === 'loading' || Game.state === 'title') return;
    Game.state = on ? 'pause' : 'play';
    if (on && document.exitPointerLock && SA.Input.pointerLocked) document.exitPointerLock();
    SA.emit('pause', on);
  };

  // ------------------------------------------------------------------ main loop
  let last = performance.now(), fpsAcc = 0, fpsN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 0.001;
    fpsAcc += dt;
    fpsN++;
    if (fpsAcc > 0.5) {
      Game.fps = fpsN / fpsAcc;
      fpsAcc = 0;
      fpsN = 0;
    }
    SA.Input.update();
    if (Game.state === 'play' || Game.state === 'cutscene') step(dt);
    else if (Game.state === 'title' || Game.state === 'pause' || Game.state === 'menu') idle(dt);
    if (renderer && Game.state !== 'loading' && !(SA.debug && SA.debug.noRender)) {
      SA.Render.render(dt);
      Game.drawCalls = renderer.info.render.calls;
      Game.tris = renderer.info.render.triangles;
    }
    SA.Input.endFrame();
  }
  function step(dt) {
    Game.time += dt;
    Game.playTime += dt;
    SA.runTimers(dt);
    const I = SA.Input;
    if (I.pressed('pause')) {
      SA.Menus ? SA.Menus.openPause() : Game.pause(true);
      return;
    }
    if (I.pressed('map') && SA.Menus) {
      SA.Menus.openMap();
      return;
    }
    if (I.pressed('journal') && SA.Menus) {
      SA.Menus.openJournal();
      return;
    }
    const Cy = Cam.yaw;
    SA.Player.update(dt, Cy + Cam.tightYaw);
    SA.Vehicles && SA.Vehicles.update(dt);
    SA.NPCs && SA.NPCs.update(dt);
    SA.Traffic && SA.Traffic.update(dt);
    SA.Police && SA.Police.update(dt);
    SA.TimeKey && SA.TimeKey.update(dt);
    SA.Mission && SA.Mission.update(dt);
    SA.Discoveries && SA.Discoveries.update(dt);
    SA.Interact && SA.Interact.update(dt);
    updateCamera(dt);
    updateSun(dt);
    Game.pool.update(dt, camera.position);
    SA.Audio && SA.Audio.update(dt);
    SA.HUD && SA.HUD.update(dt);
    updateClockDial();
  }
  function idle(dt) {
    Game.time += dt;
    // slow orbit around the Clock Tower on the title screen
    if (Game.state === 'title') {
      const ct = SA.Landmarks.clockTowerInfo;
      const a = Game.time * 0.05;
      camera.position.set(ct.x + Math.sin(a) * 38, ct.base + 16, ct.z + Math.cos(a) * 38);
      camera.lookAt(ct.x, ct.base + 10, ct.z);
      SA.NPCs && SA.NPCs.update(dt);
      SA.Traffic && SA.Traffic.update(dt);
      Game.pool.update(dt, camera.position);
      SA.Render.update(dt, { x: ct.x, y: ct.base, z: ct.z });
    } else updateSun(dt);
    SA.Audio && SA.Audio.update(dt);
  }
  function updateSun(dt) {
    SA.Render.update(dt || 0, Cam.target);
  }
  // Clock dial hands show the era's time (and stop at 9.14 in 1897 once the key has been used there)
  function updateClockDial() {
    const e = SA.World.current;
    if (!e) return;
    const dial = e.group.getObjectByName('clockdial');
    if (!dial) return;
    const E = SA.ERAS[Game.era];
    let mins = E.clock.h * 60 + E.clock.m + (Game.flags.clockStopped1897 && Game.era === 1897 ? 1 : Game.playTime / 60);
    if (Game.era === 1897 && Game.flags.clockStopped1897) mins = 21 * 60 + 14;
    const hh = (mins / 60) % 12, mm = mins % 60;
    dial.userData.hourHand.rotation.z = -(hh / 12) * Math.PI * 2;
    dial.userData.minHand.rotation.z = -(mm / 60) * Math.PI * 2;
  }

  // ------------------------------------------------------------------ debug / test API
  SA.debug = {
    state: () => {
      const p = SA.Player.pos();
      return {
        state: Game.state, era: Game.era, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(2), yaw: +SA.Player.ch.yaw.toFixed(2),
        vehicle: SA.Player.vehicle ? SA.Player.vehicle.def.id : null, fps: Math.round(Game.fps), calls: Game.drawCalls, tris: Game.tris,
        flags: Object.assign({}, Game.flags), mission: SA.Mission ? SA.Mission.debugState() : null, wanted: SA.Police ? SA.Police.level : 0,
        key: SA.TimeKey ? SA.TimeKey.debugState() : null, inv: SA.Player.inventory.slice(), outfit: SA.Player.outfit,
        cam: { x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2), z: +camera.position.z.toFixed(2), dist: +Cam.curDist.toFixed(2) },
        npcs: SA.NPCs ? SA.NPCs.count() : 0, traffic: SA.Traffic ? SA.Traffic.count() : 0, error: SA.lastError || null,
      };
    },
    teleport: (x, z, yaw) => {
      if (SA.Player.vehicle) SA.Vehicles.exit(true);
      SA.Player.teleport(x, z, yaw);
      Cam.target.set(x, SA.Terrain.height(x, z) + 1.5, z);
      if (yaw !== undefined) Cam.yaw = yaw + Math.PI;
    },
    setCam: (yaw, pitch) => {
      Cam.yaw = yaw;
      if (pitch !== undefined) Cam.pitch = pitch;
      Cam.lastInput = Game.time + 1000;
    },
    era: (e) => Game.switchEraInstant(e),
    look: (x, y, z, tx, ty, tz) => {
      Cam.override = { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(tx, ty, tz), speed: 1000 };
    },
    freeCam: () => (Cam.override = null),
    renderInfo: () => SA.Render.info(),
    // render one frame now through the full pipeline and report what it cost
    renderOnce: () => {
      SA.Render.render(0);
      return SA.Render.info();
    },
    flags: (f) => Object.assign(Game.flags, f),
    rebuild: (e) => Game.rebuildEra(e),
    // advance the simulation without rendering (deterministic tests on slow software GPUs)
    sim: (seconds, dt) => {
      dt = dt || 1 / 30;
      const n = Math.round(seconds / dt);
      for (let i = 0; i < n; i++) {
        SA.Input.update();
        if (Game.state === 'play' || Game.state === 'cutscene') step(dt);
        SA.Input.endFrame();
      }
      return SA.debug.state();
    },
    breakdown: () => {
      const out = {};
      let calls = 0;
      scene.traverseVisible((o) => {
        if (!o.isMesh && !o.isPoints) return;
        const g = o.geometry;
        let tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        if (o.isInstancedMesh) {
          if (o.count === 0) return;
          tris *= o.count;
        }
        const k = (o.name || o.type).replace(/-[-0-9,]+$/, '');
        out[k] = out[k] || { n: 0, tris: 0 };
        out[k].n++;
        out[k].tris += Math.round(tris);
        calls++;
      });
      return { calls, items: Object.entries(out).sort((a, b) => b[1].tris - a[1].tris).slice(0, 30) };
    },
  };

  // ------------------------------------------------------------------ boot
  window.addEventListener('DOMContentLoaded', () => {
    SA.emit('boot');
    try {
      if (!window.THREE) throw new Error('three.js failed to load (vendor/three.min.js missing?)');
      const test = document.createElement('canvas');
      if (!(test.getContext('webgl2') || test.getContext('webgl'))) throw new Error('WebGL is not available in this browser.');
      // When the page runs in Claude's artifact viewer, window.claude.hot lets a game in
      // progress survive a republish: the viewer keeps the snapshot and hands it back on
      // reload. Anywhere else (file://, a local server) window.claude is absent.
      const hot = window.claude && window.claude.hot;
      let started = false;
      const start = (data) => {
        if (started) return;
        started = true;
        SA.hotResume = data && data.save ? data.save : null;
        load().catch((e) => {
          console.error(e);
          const el = document.getElementById('err');
          el.textContent = 'Could not start: ' + e.message;
          el.classList.remove('hidden');
          SA.lastError = e.message + '\n' + (e.stack || '');
        });
        requestAnimationFrame(frame);
      };
      if (hot && typeof hot.snapshot === 'function') {
        try {
          hot.snapshot(() => (SA.Mission && ['play', 'cutscene', 'pause', 'menu'].indexOf(Game.state) >= 0 ? { save: Game.serialize() } : {}));
        } catch (e) {
          /* optional */
        }
      }
      if (hot && typeof hot.ready === 'function') {
        try {
          hot.ready(start);
        } catch (e) {
          start({});
        }
        setTimeout(() => start(hot.data || {}), 3000); // never wait on the viewer for long
      } else start((hot && hot.data) || {});
    } catch (e) {
      const el = document.getElementById('err');
      el.textContent = e.message;
      el.classList.remove('hidden');
      SA.lastError = e.message;
    }
  });
})();
