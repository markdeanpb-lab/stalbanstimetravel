/* LAST SPACE - touch controls for phones and tablets (player 1).
   Left thumb: a steering pad (drag left/right; how far you drag is how much lock you get).
   Right thumb: GO and BRAKE / REVERSE pedals (press higher up the pedal for more), with a
   handbrake button above them. Small buttons for horn, parking camera, look behind, recover, pause.
   Every control tracks its own pointer, so steering and pedals work at the same time. */
(function (LS) {
  'use strict';
  const U = LS.U;
  const T = LS.Touch = {
    state: { steer: 0, throttle: 0, brake: 0, handbrake: 0, horn: 0, recover: 0, look: 0, cam: false, pause: false },
    active: false, built: false, used: false,
    // auto: on for coarse pointers (phones/tablets) or as soon as someone touches the screen
    wanted() {
      const s = LS.Game && LS.Game.settings ? LS.Game.settings.touch : 'auto';
      if (s === 'on') return true;
      if (s === 'off') return false;
      return T.used || (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    },
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
          <button class="t-btn t-small" id="t-pause" aria-label="Pause">❚❚</button>
        </div>
        <div class="t-side">
          <button class="t-btn t-small" id="t-horn" aria-label="Horn">HORN</button>
          <button class="t-btn t-small" id="t-cam" aria-label="Parking camera">CAM</button>
          <button class="t-btn t-small" id="t-look" aria-label="Look behind">LOOK<br>BACK</button>
          <button class="t-btn t-small t-recover" id="t-recover" aria-label="Recover the car">HOLD TO<br>RECOVER</button>
        </div>`;
      document.getElementById('ui').appendChild(root);
      const S = T.state;
      // steering pad: relative drag from where the thumb lands
      const pad = root.querySelector('#t-steer'), knob = pad.querySelector('.t-knob');
      let sp = null;
      const steerFrom = (e) => {
        const w = Math.max(60, pad.clientWidth * 0.32);
        const v = U.clamp((e.clientX - sp.x0) / w, -1, 1);
        S.steer = Math.sign(v) * Math.pow(Math.abs(v), 1.25);
        knob.style.transform = `translateX(${v * w}px)`;
      };
      pad.addEventListener('pointerdown', (e) => { e.preventDefault(); pad.setPointerCapture(e.pointerId); sp = { id: e.pointerId, x0: e.clientX }; pad.classList.add('on'); steerFrom(e); LS.Audio.init(); });
      pad.addEventListener('pointermove', (e) => { if (sp && e.pointerId === sp.id) steerFrom(e); });
      const steerEnd = (e) => { if (!sp || e.pointerId !== sp.id) return; sp = null; S.steer = 0; knob.style.transform = ''; pad.classList.remove('on'); };
      pad.addEventListener('pointerup', steerEnd); pad.addEventListener('pointercancel', steerEnd);
      // pedals: analogue by height
      const pedal = (id, key) => {
        const el = root.querySelector(id), fill = el.querySelector('.t-fill');
        let pid = null;
        const val = (e) => { const r = el.getBoundingClientRect(); const v = U.clamp(0.35 + 0.65 * (1 - (e.clientY - r.top) / r.height), 0.35, 1); S[key] = v; fill.style.height = Math.round(v * 100) + '%'; };
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); pid = e.pointerId; el.classList.add('on'); val(e); LS.Audio.init(); });
        el.addEventListener('pointermove', (e) => { if (e.pointerId === pid) val(e); });
        const end = (e) => { if (e.pointerId !== pid) return; pid = null; S[key] = 0; fill.style.height = '0'; el.classList.remove('on'); };
        el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      };
      pedal('#t-go', 'throttle'); pedal('#t-brake', 'brake');
      // hold buttons and tap buttons
      const hold = (id, key) => {
        const el = root.querySelector(id); let pid = null;
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); pid = e.pointerId; S[key] = 1; el.classList.add('on'); LS.Audio.init(); });
        const end = (e) => { if (e.pointerId !== pid) return; pid = null; S[key] = 0; el.classList.remove('on'); };
        el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      };
      hold('#t-hand', 'handbrake'); hold('#t-horn', 'horn'); hold('#t-look', 'look'); hold('#t-recover', 'recover');
      const tap = (id, key) => root.querySelector(id).addEventListener('pointerdown', (e) => { e.preventDefault(); S[key] = true; LS.Audio.init(); });
      tap('#t-cam', 'cam'); tap('#t-pause', 'pause');
      root.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    // called every frame by the game
    update(show, car) {
      if (show && !T.built) T.build();
      if (!T.built) return;
      T.active = !!show;
      document.body.classList.toggle('touch-play', T.active);
      if (!T.active) { for (const k in T.state) T.state[k] = typeof T.state[k] === 'boolean' ? false : 0; return; }
      T.root.querySelector('#t-recover').classList.toggle('show', !!(car && (car.canRecover || car.recovering)));
      T.root.querySelector('#t-cam').classList.toggle('on', !!(LS.Game.views && LS.Game.views[0] && LS.Game.views[0].mode === 'park'));
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
      if (S.pause) { o.pause = true; S.pause = false; }
    },
  };
  window.addEventListener('touchstart', () => { T.used = true; document.body.classList.add('is-touch'); }, { passive: true, once: true });
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.addEventListener('DOMContentLoaded', () => document.body.classList.add('is-touch'));
})(window.LS);
