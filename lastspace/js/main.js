/* LAST SPACE - the game: boots the renderer, runs matches and the tutorial, routes match events
   to visuals, sound, HUD and menus, and renders one or two viewports. */
(function (LS) {
  'use strict';
  const U = LS.U;
  const DEFAULTS = { shake: true, voices: true, music: 0.6, sfx: 0.9, quality: 'high', split: 'auto', difficulty: 'normal', bighud: false, lastPicks: ['hatch', 'suv'] };

  const G = LS.Game = {
    settings: Object.assign({}, DEFAULTS),
    state: 'title', paused: false, cfg: null,
    loadSettings() { try { const s = JSON.parse(localStorage.getItem('lastspace.settings') || '{}'); Object.assign(this.settings, s); } catch (e) { /* storage blocked */ } },
    saveSettings() { try { localStorage.setItem('lastspace.settings', JSON.stringify(this.settings)); } catch (e) { /* storage blocked */ } },
    applySettings() {
      const S = this.settings, A = LS.Audio;
      A.vol.music = S.music; A.vol.sfx = S.sfx; A.voices = S.voices; A.setVolumes();
      document.body.classList.toggle('bighud', !!S.bighud);
    },

    boot() {
      this.loadSettings(); this.applySettings();
      const canvas = document.getElementById('game');
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
      catch (e) { document.getElementById('ui').innerHTML = '<div class="overlay"><div class="panel"><h2>WebGL is not available</h2><p>LAST SPACE needs a browser with WebGL 2 (recent Chrome, Edge, Firefox or Safari).</p></div></div>'; return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.autoClear = false;
      this.renderer = renderer;
      this.arena = new LS.Arena(1);
      this.hudRoot = document.getElementById('hud');
      this.tv = new LS.TVOverlay(document.getElementById('tvlayer'));
      window.addEventListener('resize', () => this.resize());
      this.resize();
      // attract mode: a bot-only match running behind the title screen
      this.startMatch({ players: [], attract: true });
      LS.Menus.title();
      this.last = performance.now();
      const loop = (t) => { requestAnimationFrame(loop); this.frame(t); };
      requestAnimationFrame(loop);
      document.addEventListener('keydown', (e) => { if (e.code === 'Tab' && this.match && this.state === 'play') { this.cycleSpectate(); e.preventDefault(); } }, true);
    },
    resize() {
      const W = window.innerWidth, H = window.innerHeight;
      this.W = W; this.H = H;
      this.renderer.setSize(W, H, false);
      document.getElementById('game').style.width = W + 'px'; document.getElementById('game').style.height = H + 'px';
    },
    world(quality) {
      if (this.w3 && this.w3q === quality) return this.w3;
      if (this.w3) { this.w3.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
      this.renderer.shadowMap.enabled = quality !== 'low';
      this.w3 = new LS.World3D(this.renderer, this.arena, quality); this.w3q = quality;
      return this.w3;
    },

    // ------------------------------------------------------------------ match lifecycle
    teardown() {
      if (!this.match) return;
      const sc = this.w3.scene;
      for (const v of this.carViews.values()) v.dispose(sc);
      for (const o of this.dyn) sc.remove(o);
      for (const v of this.views) v.dispose();
      for (const h of this.huds) h.dispose();
      if (this.fx) { sc.remove(this.fx.add.points, this.fx.soft.points, this.fx.bits.points, this.fx.skids); for (const [, g] of this.fx.debris) sc.remove(g); }
      this.tutorialMarker(null);
      LS.Audio.stopEngines(); LS.Audio.musicStop();
      this.tv.clear();
      document.body.classList.remove('freeze');
      const tp = document.getElementById('tutpanel'); if (tp) tp.remove();
      this.match = null; this.tutorial = null;
    },
    buildViews(match) {
      const w3 = this.world(this.settings.quality), sc = w3.scene;
      this.carViews = new Map(); this.dyn = [];
      const before = sc.children.length;
      this.residents = new LS.ResidentCars(sc, match.arena.parked);
      this.bins = new LS.BinsView(sc, match.arena.binBodies);
      this.spaces = new LS.SpacesView(sc, match.parking);
      this.dyn = sc.children.slice(before);
      this.fx = new LS.FX(sc);
      for (const c of match.cars) this.addCarView(c);
      const humans = match.humans;
      const focus = humans.length ? humans : [match.cars[0]];
      this.views = focus.map((c, i) => new LS.PlayerView(sc, c, i));
      if (!humans.length) this.views[0].spectate = match.cars[0];
      this.huds = humans.length ? this.views.map((v) => new LS.ViewHUD(this.hudRoot, v, match)) : [];
      this.wire(match);
    },
    addCarView(c) { const v = new LS.CarView(c, this.w3.scene); this.carViews.set(c, v); return v; },
    startMatch(cfg) {
      this.teardown();
      LS.Menus.hide();
      this.cfg = cfg;
      LS.Input.mode = cfg.players.length === 2 ? 'duo' : 'solo';
      const match = this.match = new LS.Match({ seed: (Math.random() * 1e9) | 0, arena: this.arena, players: cfg.players, difficulty: cfg.difficulty || 'normal', mode: cfg.attract ? 'test' : 'match', botCount: cfg.attract ? 8 : undefined });
      this.buildViews(match);
      this.state = cfg.attract ? 'attract' : 'play';
      this.paused = false;
      document.body.classList.toggle('attract', !!cfg.attract);
      match.start();
      if (!cfg.attract) { LS.Audio.init(); this.tv.lowerThird('LIVE FROM ST ALBANS', 'Bernard St · Grange St · Dalton St · Church St · 18:15', 5); }
    },
    restart() { if (this.cfg && !this.cfg.tutorial) this.startMatch(this.cfg); else if (this.cfg && this.cfg.tutorial) this.startTutorial(); },
    quit() { this.teardown(); this.startMatch({ players: [], attract: true }); LS.Menus.title(); },
    pause() { if (this.state !== 'play' || this.paused) return; this.paused = true; LS.Audio.stopEngines(); if (LS.Audio.ctx) LS.Audio.ctx.suspend(); LS.Menus.pause(); },
    resume() { this.paused = false; LS.Menus.hide(); if (LS.Audio.ctx) LS.Audio.ctx.resume(); },

    startTutorial() {
      this.teardown(); LS.Menus.hide(); LS.Audio.init();
      this.cfg = { tutorial: true, players: [{ type: (this.settings.lastPicks || ['hatch'])[0] }] };
      LS.Input.mode = 'solo';
      const match = this.match = new LS.Match({ seed: 4, arena: this.arena, mode: 'tutorial', players: [] });
      this.tutorialPanel();
      this.tutorial = new LS.Tutorial(match, this.cfg.players[0].type);
      this.buildViews(match);
      this.state = 'play'; this.paused = false;
      document.body.classList.remove('attract');
    },
    tutorialPanel() {
      const p = document.createElement('div'); p.id = 'tutpanel';
      p.innerHTML = '<div class="tstep"></div><h3></h3><p></p><div class="tprog"><i></i></div><div class="tbtns"><button data-act="skip">Skip step</button><button data-act="quit">Quit tutorial</button></div>';
      document.getElementById('ui').appendChild(p);
      p.querySelector('[data-act=skip]').onclick = () => this.tutorial && this.tutorial.skip();
      p.querySelector('[data-act=quit]').onclick = () => this.quit();
    },
    tutorialText(i, n, title, text) { const p = document.getElementById('tutpanel'); if (!p) return; p.querySelector('.tstep').textContent = `STEP ${i + 1} OF ${n}`; p.querySelector('h3').textContent = title; p.querySelector('p').innerHTML = text; },
    tutorialProgress(v) { const p = document.getElementById('tutpanel'); if (!p) return; const b = p.querySelector('.tprog'); b.style.display = v == null ? 'none' : 'block'; if (v != null) b.querySelector('i').style.width = Math.round(v * 100) + '%'; },
    tutorialDone() {
      const p = document.getElementById('tutpanel'); if (p) p.remove();
      LS.Menus.show(`<div class="panel"><h2>YOU'RE READY</h2><p>Nobody else on Grange Street will be this patient.</p><button data-act="solo" data-focus>SOLO MATCH</button><button data-act="title">TITLE</button></div>`);
      LS.Menus.on('[data-act=solo]', () => LS.Menus.setup(1));
      LS.Menus.on('[data-act=title]', () => this.quit());
    },
    tutorialMarker(x, y, kind, a) {
      if (this.tmark) { this.w3.scene.remove(this.tmark); this.tmark = null; }
      if (x == null) return;
      const g = new THREE.Group();
      if (kind === 'flag') {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4), new THREE.MeshStandardMaterial({ color: 0xdddddd })); pole.position.y = 2;
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ map: LS.Tex.hatch('#111111', '#ffffff'), side: THREE.DoubleSide })); flag.position.set(0.7, 3.5, 0);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 15;
        g.add(pole, flag, beam);
      } else {
        const mat = new THREE.MeshBasicMaterial({ color: 0xe8402a });
        for (const [px, pz, w, d] of [[0, 1.6, 5.4, 0.15], [0, -1.6, 5.4, 0.15], [2.7, 0, 0.15, 3.2], [-2.7, 0, 0.15, 3.2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(px, 0.03, pz); g.add(m); }
        g.rotation.y = a || 0;
      }
      g.position.set(x, 0, -y);
      this.w3.scene.add(g); this.tmark = g;
    },

    // ------------------------------------------------------------------ events
    wire(match) {
      const A = LS.Audio, tv = this.tv;
      const isPlayer = (c) => c && c.human;
      match.on('phase', (d) => {
        if (this.state === 'attract') { if (d.phase === 'results' || d.phase === 'finale') setTimeout(() => { if (this.state === 'attract' && this.match === match) { this.teardown(); this.startMatch({ players: [], attract: true }); } }, 3000); return; }
        if (d.phase === 'circulation') {
          A.musicOn();
          tv.announce(d.spaces === 1 ? 'THE FINAL' : 'ROUND ' + d.round, d.spaces === 1 ? 'Two drivers. One space.' : `${d.drivers} drivers · ${d.spaces} spaces · radio on`, 'round', 2.6);
        }
        if (d.phase === 'horn') { A.airHorn(); }
        if (d.phase === 'sudden') { tv.announce('SUDDEN DEATH', 'First to hold a space for 3 seconds wins', 'sudden', 3); A.beep(220, 0.6, 0.3); }
        if (d.phase === 'intro') tv.announce('LAST SPACE', '18:15 · St Albans · eight drivers, seven spaces', 'round', 3.5);
      });
      match.on('musicStop', () => { if (this.state === 'attract') return; A.musicStop(); tv.announce('THE MUSIC HAS STOPPED', 'Spaces are live — park!', 'stop', 2.4); for (const v of this.views) v.bump(3, this.settings); });
      match.on('horn', () => { if (this.state === 'attract') return; tv.announce('HORN!', '', 'horn', 1.6); });
      match.on('parked', (d) => { if (isPlayer(d.car)) { A.beep(988, 0.12, 0.3); setTimeout(() => A.beep(1318, 0.2, 0.3), 120); } });
      match.on('dislodged', (d) => { if (isPlayer(d.car)) A.beep(330, 0.3, 0.3); });
      match.on('eliminated', (d) => { if (this.state === 'attract') return; tv.lowerThird(d.car.name.toUpperCase() + ' — ELIMINATED', d.car.spec.name + (d.car.human ? ' · that was you' : ''), 4); });
      match.on('remark', (r) => {
        if (this.state === 'attract' && r.channel !== 'commentary') return;
        if (this.state === 'attract') return;
        tv.caption(r);
        if (this.settings.voices && r.channel !== 'commentary') A.say(r.text, r.speaker);
      });
      match.on('winner', (d) => { if (this.state === 'attract') return; this.finale = { car: d.car, t: 0 }; });
      match.on('results', (res) => { if (this.state === 'attract') return; this.state = 'results'; document.body.classList.remove('freeze'); LS.Audio.stopEngines(); LS.Menus.results(res); });
    },
    cycleSpectate() {
      const m = this.match; if (!m) return;
      for (const v of this.views) {
        if (v.car.status === 'active' && !v.spectate) continue;
        const alive = m.alive; if (!alive.length) continue;
        const i = alive.indexOf(v.spectate); v.spectate = alive[(i + 1) % alive.length];
      }
    },

    // ------------------------------------------------------------------ frame
    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      LS.Input.update(dt);
      LS.Menus.navigate();
      const m = this.match; if (!m) return;
      const t = now / 1000;
      if (this.state === 'play' && !this.paused) {
        const P0 = LS.Input.players[0].out;
        if (P0.pause) { this.pause(); }
      } else if (this.paused && LS.Input.players[0].out.pause) this.resume();
      const running = !this.paused && this.state !== 'title';
      if (running) {
        // human inputs
        m.humans.forEach((c, i) => {
          const o = LS.Input.players[c.player].out;
          if (c.status !== 'active') return;
          // the sim steers positive = left; keyboard and pad give right = +1
          Object.assign(c.input, { throttle: o.throttle, brake: o.brake, steer: -o.steer, handbrake: o.handbrake, horn: o.horn, recover: o.recover });
          if (o.camToggle) { const v = this.views[i]; v.mode = v.mode === 'park' ? 'chase' : 'park'; }
        });
        // spectate when out
        for (const v of this.views) if (v.car.status !== 'active' && (!v.spectate || v.spectate.status !== 'active')) { const a = m.alive; v.spectate = a.find((c) => c.human) || a[0] || null; }
        if (this.state === 'attract' && this.views[0].spectate && this.views[0].spectate.status !== 'active') this.views[0].spectate = m.alive[0] || this.views[0].spectate;
        m.step(dt);
        if (this.tutorial) this.tutorial.update(dt);
      }
      this.updateVisuals(dt, t, running);
      this.render(t);
    },
    updateVisuals(dt, t, running) {
      const m = this.match, A = LS.Audio, S = this.settings;
      // sim fx -> particles, sounds, panel damage
      const listeners = this.views.map((v) => v.target());
      const distTo = (x, y) => Math.min(...listeners.map((c) => U.dist(c.x, c.y, x, y)));
      for (const f of m.fxQueue) {
        if (f.type === 'impact') {
          const n = Math.min(40, Math.round(f.severity * 3));
          if (f.kind !== 'bin' && f.severity > 1.5) this.fx.sparks(f.x, f.y, 0.5, n, f.nx * 3, f.ny * 3, Math.min(2, f.severity / 5));
          if (f.severity > 5) { this.fx.smoke(f.x, f.y, 0.6, Math.round(f.severity), 1.2, 1.8, 0.75); this.fx.chunks(f.x, f.y, 0.6, Math.round(f.severity), f.cars[0] ? LS.hexRGB(f.cars[0].paint) : [0.4, 0.4, 0.4]); }
          if (f.kind === 'bin') this.fx.rubbish(f.x, f.y);
          if (this.state !== 'attract') A.crash(f.severity, distTo(f.x, f.y), f.kind);
          for (const v of this.views) if (f.cars.includes(v.target())) v.bump(f.severity, S);
        } else if (f.type === 'scrape') { this.fx.sparks(f.x, f.y, 0.4, 3, 0, 0, 0.6); if (this.state !== 'attract') A.scrape(f.slide, distTo(f.x, f.y)); }
        else if (f.type === 'dent') { const v = this.carViews.get(f.car); if (v) v.dent(f); }
        else if (f.type === 'scrapeMark') { const v = this.carViews.get(f.car); if (v) v.scrape(f); }
        else if (f.type === 'glass') { const v = this.carViews.get(f.car); const [x, y] = f.car.body.toWorld(f.lx, f.ly); this.fx.glass(x, y, 0.7, 18); if (v) for (const k of ['hl', 'hr', 'tl', 'tr']) if (!f.car.parts[k]) v.breakLight(k); if (this.state !== 'attract') A.glass(distTo(x, y)); }
        else if (f.type === 'bumper') { const v = this.carViews.get(f.car); if (v) v.detachBumper(f.end); }
        else if (f.type === 'debrisNew') this.fx.addDebris(f.body, f.car);
        else if (f.type === 'debrisGone') this.fx.removeDebris(f.body);
        else if (f.type === 'horn') { if (this.state !== 'attract') A.horn(f.car.spec.type, distTo(f.car.x, f.car.y)); }
        else if (f.type === 'overturn') { this.fx.smoke(f.car.x, f.car.y, 0.5, 14, 1.5, 2.5, 0.6); }
        else if (f.type === 'recovered') { this.fx.smoke(f.car.x, f.car.y, 0.3, 8, 1.0, 1.2, 0.9); }
      }
      m.fxQueue.length = 0;
      // cars, skids, smoke
      for (const [c, v] of this.carViews) {
        v.update(dt, t, m.arena);
        if (c.status !== 'active' || !c.body.enabled) continue;
        for (let w = 0; w < 2; w++) {
          const sk = c.skid[w]; if (sk < 0.15) continue;
          for (const side of [1, -1]) {
            const [x, y] = c.body.toWorld((w === 0 ? 1 : -1) * c.spec.wb / 2, side * c.spec.track / 2);
            this.fx.skid(c, w * 2 + (side > 0 ? 0 : 1), x, y);
            if (Math.random() < sk * 0.5 * dt * 60) this.fx.smoke(x, y, 0.2, 1, 0.7, 1.4, 0.92, c.body.vx, c.body.vy);
          }
        }
        if (c.damage.total > 0.55 && Math.random() < dt * 4) { const [x, y] = c.body.toWorld(c.spec.L * 0.4, 0); this.fx.smoke(x, y, 1.0, 1, 0.6, 1.6, 0.35); }
      }
      this.fx.update(running ? dt : 0);
      this.residents.update(false);
      this.bins.update(dt, false);
      this.spaces.update(t);
      // engines: the players' cars and the nearest few others
      if (this.state === 'play' && !this.paused) {
        const near = m.cars.filter((c) => c.status === 'active').map((c) => ({ c, d: distTo(c.x, c.y) })).sort((a, b) => a.d - b.d).slice(0, 4);
        for (const c of m.cars) A.engine(c, distTo(c.x, c.y), near.some((n) => n.c === c));
      }
      // ticking clock in the last ten seconds
      if (m.phase === 'battle' && this.state === 'play') { const s = Math.ceil(m.timeLeft); if (s !== this.lastTick && s <= 10 && s > 0) { A.beep(s <= 3 ? 1320 : 880, 0.08, 0.2); } this.lastTick = s; }
      // views and HUD
      for (const v of this.views) v.update(dt, m.arena, m.cars, this.state === 'play' ? LS.Input.players[v.idx].out : null, S);
      if (this.finale) this.finaleCam(dt);
      const rects = LS.layoutViews(this.views.length, this.W, this.H, S.split);
      this.huds.forEach((h, i) => { h.place(rects[i], this.H); h.update(dt, t, S); });
      this.tv.update(dt);
      this.w3.focus(listeners[0].x, listeners[0].y);
    },
    // final freeze-frame: the winner's battered car, perfectly parked
    finaleCam(dt) {
      const F = this.finale, c = F.car; F.t += dt;
      if (F.t > 1.6 && !F.frozen) { F.frozen = true; this.tv.big.classList.remove('show'); document.body.classList.add('freeze'); this.tv.announce(c.name.toUpperCase(), 'WINNER · LAST SPACE: ST ALBANS', 'winner', 6); }
      // orbit on the street side of the space, never through the front gardens
      const st = c.park.space, ap = st ? st.sp.access : null;
      const base = ap ? Math.atan2(ap.y - c.y, ap.x - c.x) : c.a + 2.3;
      for (const v of this.views) {
        const ang = base + Math.sin(F.t * 0.35) * 0.7;
        let R = 6.5 + c.spec.L * 0.35;
        // pull in until nothing (another car, a wall) sits between the camera and the winner
        while (R > 3 && this.match.world.raycast(c.x + Math.cos(ang) * (c.spec.L / 2 + 0.3), c.y + Math.sin(ang) * (c.spec.L / 2 + 0.3), c.x + Math.cos(ang) * R, c.y + Math.sin(ang) * R, (o) => o !== c.body && o.kind !== 'bin', true)) R -= 0.5;
        v.cam.position.set(c.x + Math.cos(ang) * R, 3.2, -(c.y + Math.sin(ang) * R));
        v.cam.lookAt(c.x, 0.7, -c.y);
      }
      if (this.state !== 'play') this.finale = null;
    },
    render() {
      const r = this.renderer, sc = this.w3.scene;
      const rects = LS.layoutViews(this.views.length, this.W, this.H, this.settings.split);
      r.setScissorTest(true);
      r.clear();
      this.views.forEach((v, i) => {
        const R = rects[i];
        v.cam.aspect = R.w / R.h; v.cam.updateProjectionMatrix();
        if (this.views.length > 1) { const tg = v.target(); this.w3.focus(tg.x, tg.y); }
        // your own badge would sit in the middle of your screen
        for (const [c, cv] of this.carViews) cv.badge.visible = c.status === 'active' && c !== v.target() && this.state !== 'attract';
        r.setViewport(R.x, R.y, R.w, R.h); r.setScissor(R.x, R.y, R.w, R.h);
        r.render(sc, v.cam);
      });
      r.setScissorTest(false);
    },
  };

  // debug / test hooks (used by tools/browser-check.js)
  LS.debug = {
    sim(seconds) { const m = G.match; const n = Math.round(seconds * 30); for (let i = 0; i < n; i++) { m.step(1 / 30); if (G.tutorial) G.tutorial.update(1 / 30); } G.updateVisuals(1 / 30, performance.now() / 1000, true); G.render(); },
    autopilot(persona) { const m = G.match; for (const c of m.humans) { const b = new LS.Bot(c, m, persona || 'nearest', LS.U.rng(5 + c.player), 'normal'); m.bots.push(b); c.bot = b; } },
    state() { const m = G.match; return m && { phase: m.phase, round: m.round, time: m.time, alive: m.alive.length, cars: m.cars.map((c) => ({ name: c.short, status: c.status, parked: c.park.parked, damage: +c.damage.total.toFixed(2) })) }; },
  };

  window.addEventListener('load', () => G.boot());
})(window.LS);
