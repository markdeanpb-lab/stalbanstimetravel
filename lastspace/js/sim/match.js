/* LAST SPACE - the match: eight drivers, one fewer space than drivers, elimination rounds.
   intro -> circulation (radio, 20-35 s, unpredictable) -> battle (45 s) -> horn -> ... -> finale -> results
   If nobody is parked at the horn: sudden death (first valid 3-second park wins).
   Runs on a fixed 120 Hz step, identically in the browser and in Node tests. */
(function (LS) {
  'use strict';
  const U = LS.U;
  const H = 1 / 120;

  class Match extends U.Emitter {
    // opts: { seed, players: [{type, name}], difficulty, mode: 'match'|'tutorial'|'test', arena, botCount, circulation:[min,max], battle }
    constructor(opts) {
      super();
      this.opts = opts = opts || {};
      this.seed = opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;
      this.rand = U.rng(this.seed);
      this.mode = opts.mode || 'match';
      this.arena = opts.arena || new LS.Arena(1);
      this.world = new LS.Physics.World();
      this.arena.populate(this.world);
      this.parking = new LS.Parking(this.arena, this.rand);
      this.cars = []; this.bots = []; this.debris = [];
      this.phase = 'boot'; this.phaseT = 0; this.phaseLen = 0; this.round = 0; this.time = 0; this.timeLeft = 0;
      this.acc = 0; this.stepN = 0;
      this.eliminatedOrder = []; this.winner = null; this.fxQueue = []; this.timers = [];
      this.pairCool = new Map();
      this.circ = opts.circulation || [20, 35];
      this.battleLen = opts.battle || 45;
      this.lockControls = false;
      this.remarks = new LS.Remarks(this, U.rng(this.seed + 7));
      if (this.mode !== 'tutorial') this.setupCars();
    }

    // ------------------------------------------------------------------ setup
    spawnPoints(n) {
      const A = this.arena, pts = [];
      const edges = A.nav.edges.filter((e) => e.street !== 'Grange Court' && e.length > 30);
      const cands = [];
      for (const e of edges) for (let s = 12; s < e.length - 12; s += 9) {
        const p = e.line.at(s);
        // not on top of a possible space
        if (A.spaces.some((sp) => U.dist(sp.x, sp.y, p.x, p.y) < 12)) continue;
        cands.push({ p, e, r: this.rand() });
      }
      cands.sort((a, b) => a.r - b.r);
      for (const minD of [45, 30, 18, 10]) {
        for (const c of cands) {
          if (pts.length >= n) break;
          if (pts.some((q) => U.dist(q.x, q.y, c.p.x, c.p.y) < minD)) continue;
          const a = c.p.heading + (this.rand() < 0.5 ? Math.PI : 0);
          if (this.world.overlapsBox(c.p.x, c.p.y, a, 2.8, 1.2, null, true)) continue;
          pts.push({ x: c.p.x, y: c.p.y, a });
        }
      }
      return pts;
    }
    setupCars() {
      const players = this.opts.players || [];
      const total = this.opts.botCount != null ? players.length + this.opts.botCount : 8;
      const sp = this.spawnPoints(total);
      const T = LS.TEXT;
      const houses = this.rand.shuffle(this.arena.houses.slice());
      let i = 0;
      players.forEach((p, k) => {
        const car = new LS.Car({ index: i, type: p.type, name: p.name || T.playerNames[k], short: p.name || T.playerNames[k], human: true, player: k, paint: p.paint || T.paints[p.type], x: sp[i].x, y: sp[i].y, a: sp[i].a, home: houses[i] });
        this.addCar(car); i++;
      });
      // bots: keep the four signature personalities, fill the rest
      const roster = T.drivers.slice(0, total - players.length);
      const order = ['confident', 'bully', 'nearest', 'quiet'];
      roster.sort((a, b) => (order.indexOf(a.persona) < 0 ? 9 : 0) - (order.indexOf(b.persona) < 0 ? 9 : 0));
      for (const d of roster) {
        if (i >= sp.length) break;
        const car = new LS.Car({ index: i, type: d.vehicle, name: d.name, short: d.short, paint: d.paint, x: sp[i].x, y: sp[i].y, a: sp[i].a, home: houses[i] });
        car.livery = d.livery || null; car.bio = d.bio;
        this.addCar(car);
        const bot = new LS.Bot(car, this, d.persona, U.rng(this.seed * 31 + i), this.opts.difficulty);
        car.bot = bot; this.bots.push(bot);
        i++;
      }
    }
    addCar(car) {
      this.cars.push(car); this.world.add(car.body);
      return car;
    }
    get alive() { return this.cars.filter((c) => c.status === 'active'); }
    get humans() { return this.cars.filter((c) => c.human); }

    // ------------------------------------------------------------------ phases
    start() { this.setPhase('intro', this.mode === 'match' ? 4.5 : 0.5); }
    setPhase(p, len) {
      this.phase = p; this.phaseT = 0; this.phaseLen = len || 0;
      const alive = this.alive.length;
      const d = { phase: p, round: this.round, drivers: alive, spaces: Math.max(1, alive - 1) };
      if (p === 'circulation') {
        this.round++; d.round = this.round;
        const k = Math.max(1, alive - 1);
        this.spacesThisRound = k;
        const n = Math.min(this.arena.spaces.length, k + 3 + Math.floor(k / 2));
        this.parking.setCandidates(n, this.cars, k === 1 ? 'Grange Street' : null);
        for (const c of this.cars) { c.park.space = null; c.park.progress = 0; c.park.parked = false; c.park.best = 0; }
        this.lockControls = false;
        d.spaces = k;
      }
      if (p === 'battle') {
        this.parking.hold = 2.0;
        const chosen = this.parking.activate(this.spacesThisRound, this.cars, this.spacesThisRound === 1 ? 'Grange Street' : null);
        this.timeLeft = this.battleLen;
        this.emit('musicStop', { spaces: chosen });
      }
      if (p === 'sudden') { this.parking.hold = 3.0; this.timeLeft = 0; this.extraT = 0; this.lockControls = false; }
      if (p === 'horn') { this.lockControls = true; }
      if (p === 'intro') this.lockControls = true;
      if (p === 'finale') this.lockControls = true;
      this.emit('phase', d);
    }

    hornNow() {
      this.emit('horn', {});
      const alive = this.alive;
      const parked = alive.filter((c) => {
        const st = c.park.space;
        return c.park.parked && st && st.status === 'active' && this.parking.measure(c, st.sp).inside && !c.overturned;
      });
      this.lastHorn = { parked, out: [] };
      if (parked.length === 0) {
        this.sudden = true;
        this.setPhase('horn', 3.0);
        return;
      }
      const out = alive.filter((c) => !parked.includes(c));
      this.lastHorn.out = out;
      for (const c of out) this.eliminate(c);
      if (parked.length === 1) { this.declareWinner(parked[0]); return; }
      this.setPhase('horn', 4.0);
    }
    eliminate(c) {
      c.status = 'eliminated'; c.elimRound = this.round; c.elimT = this.time;
      c.place = this.alive.length + 1;
      this.eliminatedOrder.push(c);
      c.park.parked = false;
      this.after(1.2, () => { c.body.enabled = false; c.body.vx = c.body.vy = c.body.w = 0; });
      this.emit('eliminated', { car: c });
    }
    declareWinner(c) {
      this.winner = c; c.place = 1;
      for (const o of this.alive) if (o !== c) this.eliminate(o);
      this.parking.spaces.forEach((s) => { if (s.owner !== c) s.status = s.status === 'active' ? 'idle' : s.status; });
      this.setPhase('finale', 7.0);
      this.emit('winner', { car: c });
    }
    after(t, fn) { this.timers.push({ t: this.time + t, fn }); }

    // ------------------------------------------------------------------ main loop
    step(dt) {
      this.acc += Math.min(dt, 0.1);
      let n = 0;
      while (this.acc >= H && n < 16) { this.substep(H); this.acc -= H; n++; }
    }
    substep(h) {
      this.time += h; this.phaseT += h; this.stepN++;
      // timers
      if (this.timers.length) {
        const due = this.timers.filter((t) => t.t <= this.time);
        if (due.length) { this.timers = this.timers.filter((t) => t.t > this.time); for (const t of due) t.fn(); }
      }
      this.phaseLogic(h);
      // controllers
      if (this.stepN % 2 === 0) for (const b of this.bots) b.update(h * 2);
      for (const c of this.cars) {
        if (c.status !== 'active') { c.input.throttle = 0; c.input.brake = 0; c.input.steer = 0; }
        if (this.lockControls && (this.phase === 'intro' || this.phase === 'horn' || this.phase === 'finale')) {
          // everyone stops for the horn / countdown
          c.input.throttle = 0; c.input.brake = c.forward > 0.3 ? 1 : 0; c.input.handbrake = 0;
          if (c.gear === -1 && c.forward < -0.3) { c.input.throttle = 1; c.input.brake = 0; }
        }
        if (!c.body.enabled) continue;
        c.step(h, this.arena, this.time);
        const placed = c.updateRecovery(h, this.arena, this.world, c.input.recover > 0 && !this.lockControls);
        if (placed) this.emit('recovered', { car: c });
      }
      for (const b of this.arena.parked) LS.residentFriction(b, h);
      for (const b of this.arena.binBodies) LS.groundFriction(b, b.user.fallen ? 1.1 : 0.55, h);
      for (const d of this.debris) LS.groundFriction(d, 0.9, h);
      this.world.step(h);
      this.handleImpacts();
      this.drainFx();
      if (this.phase === 'battle' || this.phase === 'sudden' || this.phase === 'free') {
        this.parking.time = this.time;
        this.parking.update(h, this.cars, (ev, d) => this.emit(ev, d));
      }
    }

    phaseLogic(h) {
      const P = this.phase;
      if (P === 'intro' && this.phaseT >= this.phaseLen) this.setPhase('circulation', U.lerp(this.circ[0], this.circ[1], this.rand()));
      else if (P === 'circulation' && this.phaseT >= this.phaseLen) this.setPhase('battle', this.battleLen);
      else if (P === 'battle') {
        this.timeLeft = Math.max(0, this.battleLen - this.phaseT);
        if (this.timeLeft <= 0) this.hornNow();
      } else if (P === 'horn' && this.phaseT >= this.phaseLen) {
        if (this.sudden) { this.sudden = false; this.setPhase('sudden', 0); }
        else { this.parking.clear(); this.setPhase('circulation', U.lerp(this.circ[0], this.circ[1], this.rand())); }
      } else if (P === 'sudden') {
        this.timeLeft = this.phaseT;
        this.extraT += h;
        if (this.extraT > 20) { this.extraT = 0; if (this.parking.addActive(this.cars)) this.emit('extraSpace', {}); }
        const done = this.alive.find((c) => c.park.parked);
        if (done) this.declareWinner(done);
        else if (this.phaseT > 100) {
          // stalemate guard: whoever came closest wins on a technicality
          const best = this.alive.slice().sort((a, b) => b.park.best - a.park.best || a.damage.total - b.damage.total)[0];
          this.technicality = true;
          this.declareWinner(best);
        }
      } else if (P === 'finale' && this.phaseT >= this.phaseLen) {
        this.setPhase('results', 0);
        this.emit('results', this.results());
      }
    }

    // ------------------------------------------------------------------ collisions -> damage, debris, sounds, remarks
    handleImpacts() {
      for (const ev of this.world.events) {
        const A = ev.A, B = ev.B;
        const ca = A.user && A.user.car, cb = B.user && B.user.car;
        // severity is what a car felt (a 14 kg bin flying off at 20 m/s is not a 20 m/s crash)
        const sev = Math.max(ca ? ev.dvA : 0, cb ? ev.dvB : 0, (!ca && !cb) ? Math.max(ev.dvA, ev.dvB) : 0);
        if (ca) ca.takeHit(ev, ev.dvA, -ev.nx, -ev.ny, cb || null, this.time);
        if (cb) cb.takeHit(ev, ev.dvB, ev.nx, ev.ny, ca || null, this.time);
        if (ca && cb) {
          const agg = Math.hypot(A.vx, A.vy) > Math.hypot(B.vx, B.vy) ? ca : cb;
          const vic = agg === ca ? cb : ca;
          agg.stats.dealt += Math.max(ev.dvA, ev.dvB);
          if (sev > 1.2) this.emitImpact(ev, sev, 'car', agg, vic);
        } else if (ca || cb) {
          const car = ca || cb, other = ca ? B : A, dvO = ca ? ev.dvB : ev.dvA;
          if (other.kind === 'bin') {
            if (!other.user.fallen && dvO > 1.8) { other.user.fallen = true; other.user.fallT = this.time; car.stats.bins++; this.emit('bin', { car, bin: other }); }
            if (dvO > 1.0) this.emitImpact(ev, Math.min(sev + dvO * 0.3, 6), 'bin', car, null);
          } else if (other.kind === 'parked') {
            if (dvO > 0.6 || sev > 1.4) {
              const k = 'r' + car.index + ':' + other.id;
              if ((this.pairCool.get(k) || -9) < this.time - 4) { this.pairCool.set(k, this.time); car.stats.residents++; this.emit('resident', { car, body: other }); }
              this.emitImpact(ev, sev, 'resident', car, null);
            }
          } else if (other.kind === 'debris') {
            if (sev > 0.8) this.emitImpact(ev, sev * 0.5, 'debris', car, null);
          } else if (sev > 1.2 || ev.slide > 3) this.emitImpact(ev, sev, other.kind, car, null);
        } else if ((A.kind === 'bin' || B.kind === 'bin') && sev > 1.5) {
          const bin = A.kind === 'bin' ? A : B; if (!bin.user.fallen && sev > 2.5) { bin.user.fallen = true; bin.user.fallT = this.time; }
        }
      }
    }
    emitImpact(ev, sev, kind, aggressor, victim) {
      const key = ev.A.id + ':' + ev.B.id;
      const last = this.pairCool.get(key) || -9;
      if (this.time - last < 0.12 && sev < 5) {
        // still scraping: report sliding for sparks/sound, without re-triggering the crunch
        if (ev.slide > 2.5) this.fxQueue.push({ type: 'scrape', x: ev.x, y: ev.y, slide: ev.slide, kind });
        return;
      }
      this.pairCool.set(key, this.time);
      const d = { x: ev.x, y: ev.y, nx: ev.nx, ny: ev.ny, severity: sev, slide: ev.slide, kind, aggressor, victim, cars: [ev.A.user && ev.A.user.car, ev.B.user && ev.B.user.car].filter(Boolean) };
      this.fxQueue.push({ type: 'impact', ...d });
      this.emit('impact', d);
    }
    drainFx() {
      for (const c of this.cars) {
        if (c.fx.length) {
          for (const f of c.fx) {
            f.car = c;
            if (f.type === 'bumper') this.spawnBumper(c, f.end);
            if (f.type === 'overturn') this.emit('overturn', { car: c });
            if (f.type === 'horn') this.emit('hornUse', { car: c });
            if (f.type === 'recovered') this.emit('recovered', { car: c });
            this.fxQueue.push(f);
          }
          c.fx.length = 0;
        }
        if (c.dents.length) { for (const d of c.dents) this.fxQueue.push({ type: 'dent', car: c, ...d }); c.dents.length = 0; }
        if (c.scrapes.length) { for (const d of c.scrapes) this.fxQueue.push({ type: 'scrapeMark', car: c, ...d }); c.scrapes.length = 0; }
        if (c.stats.pavement > 2.5 && !c._paveTold) { c._paveTold = true; this.emit('pavement', { car: c }); }
      }
      if (this.fxQueue.length > 600) this.fxQueue.splice(0, this.fxQueue.length - 600);
    }
    spawnBumper(c, end) {
      const b = c.body;
      const [x, y] = b.toWorld(end * (c.spec.L / 2 + 0.15), 0);
      const d = new LS.Physics.Body({ shape: 'box', x, y, a: b.a + Math.PI / 2 + (this.rand() - 0.5) * 0.5, hx: c.spec.W * 0.46, hy: 0.12, mass: 9, kind: 'debris', canSleep: true, friction: 0.6, restitution: 0.3 });
      d.vx = b.vx * 0.6 + (this.rand() - 0.5) * 2; d.vy = b.vy * 0.6 + (this.rand() - 0.5) * 2; d.w = (this.rand() - 0.5) * 6;
      d.user = { debris: 'bumper', owner: c, end, born: this.time };
      this.world.add(d); this.debris.push(d);
      if (this.debris.length > 20) { const old = this.debris.shift(); this.world.remove(old); this.fxQueue.push({ type: 'debrisGone', body: old }); }
      this.fxQueue.push({ type: 'debrisNew', body: d, car: c });
    }

    // ------------------------------------------------------------------ results, awards, tickets
    results() {
      const T = LS.TEXT, r = U.rng(this.seed + 99);
      const order = [this.winner].concat(this.eliminatedOrder.slice().reverse()).filter(Boolean);
      const seen = new Set(), standings = [];
      for (const c of order) if (!seen.has(c)) { seen.add(c); standings.push(c); }
      for (const c of this.cars) if (!seen.has(c)) standings.push(c);
      const awards = [];
      const top = (f, min) => { let best = null, bv = min; for (const c of this.cars) { const v = f(c); if (v > bv) { bv = v; best = c; } } return best ? { car: best, v: bv } : null; };
      const add = (key, res, fmt) => { if (!res) return; const [title, line] = T.awards[key]; awards.push({ key, title, car: res.car, text: line.replace('{n}', fmt ? fmt(res.v) : Math.round(res.v)) }); };
      add('bins', top((c) => c.stats.bins, 1));
      add('damage', top((c) => c.damage.total, 0.15));
      add('shunt', top((c) => c.stats.biggest, 4), (v) => Math.round(v * 2.237));
      add('residents', top((c) => c.stats.residents, 2));
      add('gears', top((c) => c.stats.gearChanges, 12));
      add('horn', top((c) => c.stats.horn, 4));
      add('pavement', top((c) => c.stats.pavement, 6));
      add('fastest', top((c) => (c.stats.firstPark != null ? 100 - c.stats.firstPark : -1), 0), (v) => Math.round(100 - v));
      add('recoveries', top((c) => c.stats.recoveries, 1));
      add('restraint', top((c) => -c.stats.hits, -1e9));
      // everyone gets a ticket
      const tickets = this.rand.shuffle(T.tickets.slice());
      const ticketFor = standings.map((c, i) => ({ car: c, code: tickets[i % tickets.length][0], offence: tickets[i % tickets.length][1], fine: T.fines[Math.floor(r() * T.fines.length)], pcn: 'AL3 ' + String(100000 + Math.floor(r() * 899999)) }));
      return { winner: this.winner, standings, awards: awards.slice(0, 6), tickets: ticketFor, rounds: this.round, duration: this.time, technicality: !!this.technicality };
    }
  }
  LS.Match = Match;
})(window.LS);
