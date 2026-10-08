/* LAST SPACE - touch controls for phones and tablets (player 1).
   Left thumb: a steering pad (drag left/right; how far you drag is how much lock you get).
   Right thumb: GO and BRAKE / REVERSE pedals (press higher up the pedal for more), with a
   handbrake button above them. Small buttons for horn, parking camera, look behind, recover, pause.
   Every control tracks its own pointer, so steering and pedals work at the same time. */
(function (LS) {
  'use strict';
  const U = LS.U;
  const COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const T = LS.Touch = {
    state: { steer: 0, throttle: 0, brake: 0, handbrake: 0, horn: 0, recover: 0, look: 0, cam: false, pause: false },
    mode: 'off', built: false, used: false, coarse: COARSE, resets: [],
    get active() { return T.mode === 'play'; },
    // auto: on for phones and tablets (coarse pointer), or once someone actually touches the screen.
    // A touchscreen laptop stays on keyboard controls until it is touched, and back again on a key press.
    wanted() {
      const s = LS.Game && LS.Game.settings ? LS.Game.settings.touch : 'auto';
      if (s === 'on') return true;
      if (s === 'off') return false;
      return T.used || COARSE;
    },
    // one place to choose wording for touch or keys
    label(touchText, keyText) { return T.wanted() ? touchText : keyText; },
    build() {
      if (T.built) return;
      T.built = true;
      const root = T.root = document.createElement('div');
      root.id = 'touch';
      root.innerHTML = `
        <div class="t-steer" id="t-steer" aria-label="Steering pad: drag left or right"><div class="t-track"><i class="t-l">◀</i><i class="t-r">▶</i></div><div class="t-knob"></div><span class="t-cap">STEER</span></div>
        <div class="t-pedals">
          <button class="t-btn t-hand" id="t-hand" aria-label="Handbrake">HANDBRAKE</button>
          <div class="t-row">
            <div class="t-pedal t-brake" id="t-brake" aria-label="Brake, hold to reverse"><b>BRAKE</b><small>hold to reverse</small><span class="t-fill"></span></div>
            <div class="t-pedal t-go" id="t-go" aria-label="Accelerate"><b>GO</b><small>press higher for more</small><span class="t-fill"></span></div>
          </div>
        </div>
        <div class="t-top">
          <button class="t-btn t-small t-next" id="t-next" aria-label="Watch the next driver">NEXT ▶</button>
          <button class="t-btn t-small" id="t-pause" aria-label="Pause">❚❚</button>
        </div>
        <div class="t-side">
          <button class="t-btn t-small" id="t-horn" aria-label="Horn">HORN</button>
          <button class="t-btn t-small" id="t-cam" aria-label="Parking camera">CAM</button>
          <button class="t-btn t-small" id="t-look" aria-label="Look behind">LOOK<br>BACK</button>
          <button class="t-btn t-small t-recover" id="t-recover" aria-label="Recover the car">HOLD TO<br>RECOVER</button>
        </div>`;
      document.getElementById('ui').appendChild(root);
      T.el = { recover: root.querySelector('#t-recover'), cam: root.querySelector('#t-cam') };
      const S = T.state;
      // every control releases on up, cancel and lost capture, and can be reset when the overlay hides
      const track = (el, down, move, up) => {
        let pid = null;
        const end = (e) => { if (e && e.pointerId !== pid) return; pid = null; el.classList.remove('on'); up(); };
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* synthetic */ } pid = e.pointerId; el.classList.add('on'); LS.Audio.init(); down(e); });
        if (move) el.addEventListener('pointermove', (e) => { if (e.pointerId === pid) move(e); });
        el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
        T.resets.push(() => { if (pid !== null) end(null); pid = null; el.classList.remove('on'); up(); });
      };
      // steering pad: relative drag from where the thumb lands
      const pad = root.querySelector('#t-steer'), knob = pad.querySelector('.t-knob');
      let x0 = 0;
      const steerFrom = (e) => {
        const w = Math.max(60, pad.clientWidth * 0.32);
        const v = U.clamp((e.clientX - x0) / w, -1, 1);
        S.steer = Math.sign(v) * Math.pow(Math.abs(v), 1.25);
        knob.style.transform = `translateX(${v * w}px)`;
      };
      track(pad, (e) => { x0 = e.clientX; steerFrom(e); }, steerFrom, () => { S.steer = 0; knob.style.transform = ''; });
      // pedals: analogue by height
      for (const [id, key] of [['#t-go', 'throttle'], ['#t-brake', 'brake']]) {
        const el = root.querySelector(id), fill = el.querySelector('.t-fill');
        const val = (e) => { const r = el.getBoundingClientRect(); const v = U.clamp(0.35 + 0.65 * (1 - (e.clientY - r.top) / r.height), 0.35, 1); S[key] = v; fill.style.height = Math.round(v * 100) + '%'; };
        track(el, val, val, () => { S[key] = 0; fill.style.height = '0'; });
      }
      for (const [id, key] of [['#t-hand', 'handbrake'], ['#t-horn', 'horn'], ['#t-look', 'look'], ['#t-recover', 'recover']]) {
        track(root.querySelector(id), () => { S[key] = 1; }, null, () => { S[key] = 0; });
      }
      const tap = (id, fn) => root.querySelector(id).addEventListener('pointerdown', (e) => { e.preventDefault(); LS.Audio.init(); fn(); });
      tap('#t-cam', () => { S.cam = true; });
      tap('#t-pause', () => { if (LS.Game.paused) LS.Game.resume(); else LS.Game.pause(); });
      tap('#t-next', () => LS.Game.cycleSpectate());
      root.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    releaseAll() { for (const r of T.resets) r(); for (const k in T.state) T.state[k] = typeof T.state[k] === 'boolean' ? false : 0; },
    // called every frame by the game: mode is 'play' (driving), 'spectate' (out: pause and next only) or 'off'
    update(mode, car) {
      if (mode !== 'off' && !T.built) T.build();
      if (!T.built) return;
      if (mode !== T.mode) {
        if (T.mode === 'play') T.releaseAll();
        T.mode = mode;
        document.body.classList.toggle('touch-play', mode === 'play');
        document.body.classList.toggle('touch-spectate', mode === 'spectate');
        document.body.classList.toggle('touch-ui', mode !== 'off'); // compact phone HUD whether driving or watching
      }
      if (mode !== 'play') return;
      const rec = !!(car && (car.canRecover || car.recovering));
      if (rec !== T._rec) { T._rec = rec; T.el.recover.classList.toggle('show', rec); }
      const cam = !!(LS.Game.views && LS.Game.views[0] && LS.Game.views[0].mode === 'park');
      if (cam !== T._cam) { T._cam = cam; T.el.cam.classList.toggle('on', cam); }
    },
    // merge into player 1's input; one-shot buttons are consumed here
    apply(o) {
      if (!T.active) return;
      const S = T.state;
      if (S.steer !== 0) o.steer = S.steer;
      o.throttle = Math.max(o.throttle, S.throttle); o.brake = Math.max(o.brake, S.brake);
      o.handbrake = Math.max(o.handbrake, S.handbrake); o.horn = Math.max(o.horn, S.horn);
      o.recover = Math.max(o.recover, S.recover); o.look = Math.max(o.look, S.look);
      if (S.cam) { o.camToggle = true; S.cam = false; }
    },
  };
  // the first real touch switches wording and controls to touch; a key press on a hybrid laptop switches back
  window.addEventListener('touchstart', () => { if (!T.used) { T.used = true; if (LS.Menus && LS.Menus.refresh) LS.Menus.refresh(); } }, { passive: true });
  window.addEventListener('keydown', () => { if (T.used && !COARSE) { T.used = false; if (LS.Menus && LS.Menus.refresh) LS.Menus.refresh(); } });
})(window.LS);
