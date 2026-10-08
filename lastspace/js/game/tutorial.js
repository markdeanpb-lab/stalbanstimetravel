/* LAST SPACE - interactive tutorial on Dalton Street: drive, reverse, handbrake turn, shunt,
   park validly, horn and recovery. Uses the same match, physics and parking rules as the game. */
(function (LS) {
  'use strict';
  const U = LS.U;

  class Tutorial {
    constructor(match, type) {
      this.m = match; this.step = -1; this.t = 0;
      const A = match.arena, st = A.byName['Dalton Street'], p = st.line.at(40);
      const car = this.car = new LS.Car({ index: 0, type: type || 'hatch', name: 'You', short: 'You', human: true, player: 0, paint: LS.TEXT.paints[type || 'hatch'], x: p.x, y: p.y, a: p.heading });
      match.addCar(car);
      match.phase = 'free'; match.lockControls = false;
      this.steps = [
        { title: 'Drive', text: 'Hold <kbd>W</kbd> or <kbd>↑</kbd> to accelerate and steer with <kbd>A</kbd> <kbd>D</kbd> or <kbd>←</kbd> <kbd>→</kbd>. Drive up Dalton Street to the flag.', start: () => this.flagAt(st.line.at(100)), done: () => this.flag && U.dist(car.x, car.y, this.flag.x, this.flag.y) < 7 },
        { title: 'Brake and reverse', text: 'Hold <kbd>S</kbd> or <kbd>↓</kbd> to brake. Keep holding it once you have stopped and you will reverse. Reverse 8 metres.', start: () => { this.clearFlag(); this.rev = 0; this.last = [car.x, car.y]; }, tick: () => { const d = U.dist(car.x, car.y, this.last[0], this.last[1]); if (car.gear === -1 && car.forward < -0.3) this.rev += d; this.last = [car.x, car.y]; }, done: () => this.rev > 8, progress: () => this.rev / 8 },
        { title: 'Handbrake turn', text: 'Get up some speed, steer, and tap <kbd>Space</kbd> for the handbrake. The back end steps out. Junctions give you more room.', start: () => {}, done: () => car.input.handbrake && car.speed > 4 && Math.abs(car.body.w) > 0.9 },
        { title: 'Shunting', text: 'That silver hatch is in the red box. Shove it out. Heavier cars push lighter ones; hitting a corner spins them.', start: () => this.spawnDummy(), done: () => this.dummy && U.dist(this.dummy.x, this.dummy.y, this.box.x, this.box.y) > 3.2, progress: () => this.dummy ? U.dist(this.dummy.x, this.dummy.y, this.box.x, this.box.y) / 3.2 : 0 },
        { title: 'Parking', text: 'Park in the live space (blue stripes, <b>P</b>). Your whole car must be inside the lines, straight along the kerb, below walking pace for 2 seconds. Press <kbd>C</kbd> for the parking camera: it shows where your wheels will go.', start: () => this.openSpace(), done: () => car.park.parked },
        { title: 'Hold it, horn and recovery', text: 'Parked is not safe: anyone can shove you out and you lose it. Sound your horn with <kbd>H</kbd>. If you are ever overturned or wedged, hold <kbd>R</kbd> to recover (you are vulnerable while it happens, and it never drops you into a space).', start: () => {}, done: () => car.hornCount > 0 },
      ];
      // the same steps in touch-screen words
      const touchText = [
        'Press <b>GO</b> (higher up the pedal for more) and drag the <b>STEER</b> pad left or right. Drive up Dalton Street to the flag.',
        'Press <b>BRAKE</b>. Keep pressing once you have stopped and you will reverse. Reverse 8 metres.',
        'Get up some speed, steer, and press <b>HANDBRAKE</b>. The back end steps out. Junctions give you more room.',
        'That silver hatch is in the red box. Shove it out. Heavier cars push lighter ones; hitting a corner spins them.',
        'Park in the live space (blue stripes, <b>P</b>). Your whole car must be inside the lines, straight along the kerb, below walking pace for 2 seconds. Tap <b>CAM</b> for the parking camera: it shows where your wheels will go.',
        'Parked is not safe: anyone can shove you out and you lose it. Press <b>HORN</b>. If you are ever overturned or wedged, a <b>RECOVER</b> button appears: hold it (you are vulnerable while it happens, and it never drops you into a space).',
      ];
      this.steps.forEach((st, i) => { st.touchText = touchText[i]; });
      match.tutorialTitle = 'TUTORIAL';
      this.next();
    }
    flagAt(p) {
      this.flag = { x: p.x, y: p.y };
      // borrow a pool space slot visual: a tall beacon in the scene is drawn by the game
      LS.Game.tutorialMarker(p.x, p.y, 'flag');
    }
    clearFlag() { this.flag = null; LS.Game.tutorialMarker(null); }
    spawnDummy() {
      const c = this.car, A = this.m.arena;
      const pr = A.navProject(c.x, c.y), e = pr.e;
      const fwd = Math.cos(c.a) * e.line.at(pr.s).tx + Math.sin(c.a) * e.line.at(pr.s).ty >= 0 ? 1 : -1;
      let s = U.clamp(pr.s + fwd * 22, 6, e.length - 6);
      const p = e.line.at(s);
      this.box = { x: p.x, y: p.y, a: p.heading };
      const d = this.dummy = new LS.Car({ index: 6, type: 'hatch', name: 'Practice car', short: 'Practice', paint: '#b8bcc2', x: p.x, y: p.y, a: p.heading + Math.PI / 2 * 0.15 });
      d.body.setMass(900); d.noHold = true; // left in neutral, as practice cars are
      this.m.addCar(d);
      LS.Game.addCarView(d);
      LS.Game.tutorialMarker(p.x, p.y, 'box', p.heading);
    }
    openSpace() {
      LS.Game.tutorialMarker(null);
      const c = this.car, P = this.m.parking;
      let best = null, bd = 1e9;
      for (const st of P.spaces) { if (st.sp.kind === 'bay') continue; const d = U.dist(c.x, c.y, st.sp.x, st.sp.y); if (d > 15 && d < bd && P.usable(st)) { bd = d; best = st; } }
      for (const st of P.spaces) st.status = st === best ? 'active' : 'idle';
      this.space = best;
    }
    next() {
      this.step++; this.t = 0;
      if (this.step >= this.steps.length) { this.finished = true; LS.Game.tutorialDone(); return; }
      const s = this.steps[this.step];
      s.start();
      LS.Game.tutorialText(this.step, this.steps.length, s.title, LS.Touch.label(s.touchText, s.text));
      LS.Audio.beep(880, 0.15, 0.2);
    }
    update(dt) {
      if (this.finished) return;
      const s = this.steps[this.step];
      this.t += dt;
      if (s.tick) s.tick();
      if (s.done()) { this.doneT = (this.doneT || 0) + dt; if (this.doneT > (this.step === 4 ? 1.2 : 0.4)) { this.doneT = 0; this.next(); } }
      else this.doneT = 0;
      LS.Game.tutorialProgress(s.progress ? U.clamp(s.progress(), 0, 1) : null);
    }
    skip() { this.next(); }
  }
  LS.Tutorial = Tutorial;
})(window.LS);
