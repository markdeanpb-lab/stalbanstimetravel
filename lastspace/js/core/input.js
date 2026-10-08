/* LAST SPACE - input: keyboard (one or two players) and standard gamepads. */
(function (LS) {
  'use strict';
  const U = LS.U;
  const down = new Set(), pressed = new Set();
  window.addEventListener('keydown', (e) => {
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
    if (LS.Input.capture && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Slash', 'Quote'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  const MAPS = {
    solo: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], hand: ['Space'], horn: ['KeyH', 'KeyQ'], cam: ['KeyC', 'KeyE'], recover: ['KeyR'], look: ['KeyF', 'KeyB'] },
    p1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], hand: ['Space'], horn: ['KeyQ'], cam: ['KeyE'], recover: ['KeyR'], look: ['KeyF'] },
    p2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], hand: ['Slash', 'Numpad0', 'ControlRight'], horn: ['Period', 'NumpadEnter', 'Enter'], cam: ['Comma', 'Numpad1'], recover: ['KeyL', 'Numpad2'], look: ['KeyK', 'Numpad3'] },
  };
  const any = (codes) => codes.some((c) => down.has(c));
  const anyPressed = (codes) => codes.some((c) => pressed.has(c));

  class PlayerInput {
    constructor(idx) { this.idx = idx; this.steer = 0; this.thr = 0; this.brk = 0; this.out = { throttle: 0, brake: 0, steer: 0, handbrake: 0, horn: 0, recover: 0, look: 0, camToggle: false, pause: false }; this.prevPad = {}; }
  }

  LS.Input = {
    capture: true,
    players: [new PlayerInput(0), new PlayerInput(1)],
    mode: 'solo',
    pads() { const ps = (navigator.getGamepads ? navigator.getGamepads() : []) || []; return Array.from(ps).filter((p) => p && p.connected); },
    // which pad drives which player
    padFor(i) {
      const pads = this.pads();
      if (this.mode === 'solo') return i === 0 ? pads[0] || null : null;
      if (pads.length >= 2) return pads[i];
      if (pads.length === 1) return i === 1 ? pads[0] : null; // one pad: player 2 gets it, player 1 uses WASD
      return null;
    },
    update(dt) {
      const pads = this.pads();
      for (let i = 0; i < 2; i++) {
        const P = this.players[i], o = P.out;
        const map = this.mode === 'solo' ? (i === 0 ? MAPS.solo : null) : (i === 0 ? MAPS.p1 : MAPS.p2);
        let thr = 0, brk = 0, steerT = 0, hand = 0, horn = 0, rec = 0, look = 0, cam = false, pause = false;
        if (map) {
          thr = any(map.up) ? 1 : 0; brk = any(map.down) ? 1 : 0;
          steerT = (any(map.right) ? 1 : 0) - (any(map.left) ? 1 : 0);
          hand = any(map.hand) ? 1 : 0; horn = any(map.horn) ? 1 : 0; rec = any(map.recover) ? 1 : 0; look = any(map.look) ? 1 : 0;
          cam = anyPressed(map.cam);
        }
        if (i === 0 && (pressed.has('Escape') || pressed.has('KeyP'))) pause = true;
        // keyboard steering ramps so small taps give small corrections
        const kb = steerT;
        if (kb !== 0) P.steer = U.approach(P.steer, kb, dt * (Math.sign(kb) !== Math.sign(P.steer) ? 6 : 3.2));
        else P.steer = U.approach(P.steer, 0, dt * 5);
        let steer = P.steer;
        const pad = this.padFor(i);
        if (pad) {
          const ax = pad.axes[0] || 0, dz = Math.abs(ax) < 0.12 ? 0 : (ax - Math.sign(ax) * 0.12) / 0.88;
          const b = (k) => (pad.buttons[k] ? pad.buttons[k].value || (pad.buttons[k].pressed ? 1 : 0) : 0);
          const was = (k) => !!P.prevPad[k], is = (k) => !!(pad.buttons[k] && pad.buttons[k].pressed);
          if (Math.abs(dz) > Math.abs(steer)) steer = Math.sign(dz) * Math.pow(Math.abs(dz), 1.4);
          thr = Math.max(thr, b(7)); brk = Math.max(brk, b(6));
          hand = Math.max(hand, b(0)); horn = Math.max(horn, b(1)); rec = Math.max(rec, b(2)); look = Math.max(look, b(5));
          if (is(3) && !was(3)) cam = true;
          if (is(9) && !was(9)) pause = true;
          for (let k = 0; k < 16; k++) P.prevPad[k] = is(k);
        }
        o.throttle = thr; o.brake = brk; o.steer = U.clamp(steer, -1, 1); o.handbrake = hand; o.horn = horn; o.recover = rec; o.look = look; o.camToggle = cam; o.pause = pause;
        if (i === 0 && LS.Touch) LS.Touch.apply(o);
      }
      // menu navigation from any pad
      this.menu = { up: false, down: false, left: false, right: false, ok: false, back: false };
      for (const pad of pads) {
        const st = this._menuPrev || (this._menuPrev = {});
        const k = (n) => !!(pad.buttons[n] && pad.buttons[n].pressed);
        const edges = { up: k(12) || pad.axes[1] < -0.6, down: k(13) || pad.axes[1] > 0.6, left: k(14) || pad.axes[0] < -0.6, right: k(15) || pad.axes[0] > 0.6, ok: k(0), back: k(1) || k(9) };
        for (const e in edges) { if (edges[e] && !st[pad.index + e]) this.menu[e] = true; st[pad.index + e] = edges[e]; }
      }
      pressed.clear();
    },
    isDown: (code) => down.has(code),
  };
})(window.LS);
