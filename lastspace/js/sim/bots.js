/* LAST SPACE - the residents. Bots drive the same Car with the same inputs a human has (throttle,
   brake/reverse, steering, handbrake, horn, recover) and obey the same parking rules. They only see
   what players see: "?" candidates while the music plays, live spaces once it stops.
   Personalities:
     nearest   - goes for the closest live space
     bully     - looks for vulnerable parked cars to shove out, then takes the space
     quiet     - avoids fights, prefers spaces on empty streets
     confident - drives a luxury SUV with unjustified confidence; barges through */
(function (LS) {
  'use strict';
  const U = LS.U;

  const PERSONAS = {
    nearest: { label: 'Goes for the nearest space', contest: 2.5, speed: 1.0, cautious: 0.7, ram: 0.2, attackBias: 0.0 },
    bully: { label: 'Targets vulnerable parked cars', contest: 1.0, speed: 1.0, cautious: 0.3, ram: 0.8, attackBias: 1.0 },
    quiet: { label: 'Avoids fights, looks for quiet streets', contest: 6, speed: 0.92, cautious: 1.0, ram: 0.0, attackBias: -1 },
    confident: { label: 'Unjustified confidence', contest: 0.0, speed: 1.12, cautious: 0.0, ram: 1.0, attackBias: 0.3 },
  };

  function bezier(p0, h0, p1, h1, k0, k1, n) {
    const c0 = [p0[0] + Math.cos(h0) * k0, p0[1] + Math.sin(h0) * k0];
    const c1 = [p1[0] - Math.cos(h1) * k1, p1[1] - Math.sin(h1) * k1];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push([u * u * u * p0[0] + 3 * u * u * t * c0[0] + 3 * u * t * t * c1[0] + t * t * t * p1[0], u * u * u * p0[1] + 3 * u * u * t * c0[1] + 3 * u * t * t * c1[1] + t * t * t * p1[1]]);
    }
    return pts;
  }

  class Bot {
    constructor(car, match, persona, rand, difficulty) {
      this.car = car; this.m = match; this.rand = rand;
      this.kind = persona; this.p = PERSONAS[persona];
      const diff = { easy: 0.86, normal: 1.0, hard: 1.08 }[difficulty || 'normal'];
      this.speedMul = this.p.speed * diff * (0.95 + rand() * 0.08);
      this.reaction = (difficulty === 'easy' ? 1.2 : difficulty === 'hard' ? 0.25 : 0.6) + rand() * 0.5;
      this.state = 'cruise'; this.path = null; this.pathS = 0; this.reverse = false;
      this.target = null; this.plan = null; this.thinkT = 0; this.stateT = 0;
      this.stuckT = 0; this.unstickT = 0; this.unsticks = []; this.blacklist = new Map();
      this.cruiseGoal = null; this.edgePenalty = new Map();
      this.noticeT = 0; this.lastPhase = null;
      this.attack = null; this.hornCool = 0;
    }

    // ------------------------------------------------------------------ helpers
    setPath(pts, reverse) {
      if (!pts || pts.length < 2) { this.path = null; return; }
      this.path = new U.Polyline(pts); this.pathS = 0; this.reverse = !!reverse; this.turn = null; this.revLeg = null;
    }
    navTo(x, y) {
      const c = this.car;
      const pen = (e) => (this.edgePenalty.get(e.id) || 0);
      const tp = { hatch: 110, estate: 140, suv: 170, van: 190 }[c.spec.type]; // reversing back to a junction is slow; big cars more so
      const r = this.m.arena.navPath(c.x, c.y, x, y, { penalty: pen, heading: c.gear === -1 && c.forward < -1 ? c.a + Math.PI : c.a, turnPenalty: tp });
      const pts = r.pts.slice();
      pts.push([x, y]);
      return { pts, length: r.length + U.dist(r.pts[r.pts.length - 1][0], r.pts[r.pts.length - 1][1], x, y) };
    }
    // drive toward a signed speed using the same pedals a player has
    drive(want) {
      const c = this.car, v = c.forward, inp = c.input;
      inp.throttle = 0; inp.brake = 0;
      if (want >= 0) {
        if (c.gear === -1 && v < 0.3) { inp.throttle = want > 0.05 ? 1 : 0; if (v < -0.3) inp.throttle = 1; return; }
        if (v < want - 0.15) inp.throttle = U.clamp(0.3 + (want - v) * 0.4, 0, 1);
        else if (v > want + 0.5) inp.brake = U.clamp((v - want) * 0.3, 0.12, 1);
        else inp.throttle = want > 0.2 ? 0.12 : 0;
      } else {
        if (c.gear === 1) { inp.brake = 1; return; }
        if (v > want + 0.15) inp.brake = U.clamp(0.35 + (v - want) * 0.45, 0, 1);
        else if (v < want - 0.5) inp.throttle = U.clamp((want - v) * 0.3, 0.12, 1);
        else inp.brake = 0.15;
      }
    }
    // pure pursuit on the current path; returns remaining distance
    follow(speed, opts) {
      const c = this.car, b = c.body, P = this.path;
      if (!P) { this.drive(0); return 0; }
      if (this.turn) return this.doTurn(), P.length - this.pathS;
      const rev = this.reverse || !!this.revLeg;
      const wb = c.spec.wb;
      // reference: rear axle (the point with no sideways slip)
      const rx = b.x - b.c * wb / 2, ry = b.y - b.s * wb / 2;
      // advance progress (search forward a little)
      let best = this.pathS, bd = 1e9;
      for (let s = Math.max(0, this.pathS - 2); s <= Math.min(P.length, this.pathS + 12); s += 0.5) {
        const q = P.at(s), d = (q.x - rx) ** 2 + (q.y - ry) ** 2;
        if (d < bd) { bd = d; best = s; }
      }
      this.pathS = best;
      const remain = P.length - best;
      const spd = Math.abs(c.forward);
      const Ld = U.clamp((opts && opts.look) || (rev ? 2.6 : 3.2 + spd * 0.55), 2.2, 13);
      const tq = P.at(Math.min(P.length, best + Ld));
      let tx = tq.x, ty = tq.y;
      // extend past the end so we drive onto the final point and stay straight
      if (best + Ld > P.length) { const e = P.at(P.length); const over = best + Ld - P.length; tx = e.x + e.tx * over; ty = e.y + e.ty * over; }
      if (opts && opts.offset) { tx += tq.nx * opts.offset; ty += tq.ny * opts.offset; }
      const head = rev ? b.a + Math.PI : b.a;
      if (this.revLeg && best >= this.revLeg.until) { this.revLeg = null; return remain; }
      // path runs the other way: reverse back to the next junction and drive out of it, like a person would
      if (!rev && !(opts && opts.noTurn) && remain > 6) {
        const pd = P.at(Math.min(P.length, best + 4)).heading;
        if (Math.abs(U.wrap(pd - b.a)) > 1.95 && Math.abs(c.forward) < 4) {
          const back = b.a + Math.PI;
          let sTurn = null;
          for (let q = best + 2; q < Math.min(P.length, best + 45); q += 1) if (Math.abs(U.wrap(P.at(q).heading - back)) > 0.9) { sTurn = q; break; }
          const nearJ = this.m.arena.junctions.some((j) => U.dist(j.x, j.y, c.x, c.y) < 16);
          if (sTurn != null) this.revLeg = { until: sTurn + c.spec.L * 0.55 + 1.5 };
          else if (nearJ || this.m.arena.streetAt(c.x, c.y) === this.m.arena.byName['Grange Court']) { this.turn = { why: 'junction', head: pd, t: 0, dir: 1, legT: 0, side: 0 }; return remain; }
          else this.revLeg = { until: Math.min(P.length, best + 30) };
          return remain;
        }
      }
      const dx = tx - rx, dy = ty - ry;
      const lx = Math.cos(head) * dx + Math.sin(head) * dy, ly = -Math.sin(head) * dx + Math.cos(head) * dy;
      const alpha = Math.atan2(ly, lx), L2 = Math.max(1, Math.hypot(lx, ly));
      let delta = Math.atan(2 * wb * Math.sin(alpha) / L2);
      if (rev) delta = -delta;
      c.input.steer = U.clamp(delta / c.spec.maxSteer, -1, 1);
      // speed: slow for bends ahead and for the end of the path
      let v = speed;
      if (!rev) {
        const a0 = P.at(best).heading;
        for (const ahead of [6, 12, 20]) {
          if (best + ahead > P.length) break;
          const turn = Math.abs(U.wrap(P.at(best + ahead).heading - a0));
          v = Math.min(v, U.lerp(speed, 4.0, U.clamp(turn / 1.3, 0, 1)) + ahead * 0.12);
        }
        if (Math.abs(alpha) > 0.9) v = Math.min(v, 3.5);
      }
      if (opts && opts.stopAtEnd) v = Math.min(v, Math.max(0.6, Math.sqrt(2 * 2.2 * Math.max(0, remain - 0.3))));
      if (this.revLeg) v = Math.min(v, c.spec.vrev * 0.75, Math.max(1.2, Math.sqrt(2 * 2 * Math.max(0, this.revLeg.until - best))));
      this.drive(rev ? -v : v);
      return remain;
    }
    // multi-point turn towards heading this.turn.head (dead ends, car park)
    doTurn() {
      const c = this.car, T = this.turn, dt = 1 / 60, A = this.m.arena, b = c.body;
      T.t += dt; T.legT += dt;
      const err = U.wrap(T.head - c.a);
      if (Math.abs(err) < 0.55 || T.t > 20) { this.turn = null; if (T.t > 20) this.replan = true; return; }
      if (!T.side) T.side = err > 0 ? 1 : -1;
      // probe the corners in the direction of travel for walls and cars
      const L = c.spec.L / 2 + 0.7, W = c.spec.W / 2;
      let blocked = false;
      for (const sy of [-W, 0, W]) {
        const [px, py] = b.toWorld(T.dir * L, sy);
        if (A.wall(px, py) > -0.5) blocked = true;
      }
      if (this.clearance(1.0, T.dir < 0) < 0.45) blocked = true;
      if ((blocked && T.legT > 0.4) || T.legT > 3.5) { T.dir = -T.dir; T.legT = 0; }
      c.input.steer = T.side * T.dir;
      this.drive(T.dir * 2.0);
    }

    // distance to the first obstacle straight ahead (or behind when reversing)
    clearance(maxD, rev) {
      const c = this.car, b = c.body, dir = rev ? -1 : 1;
      let best = maxD;
      const hx = c.spec.L / 2, hw = c.spec.W / 2 - 0.15;
      const st = c.steerAngle * 0.6 * dir;
      const ca = Math.cos(b.a + st), sa = Math.sin(b.a + st);
      for (const off of [-hw, 0, hw]) {
        const x0 = b.x + b.c * hx * dir - b.s * off, y0 = b.y + b.s * hx * dir + b.c * off;
        const hit = this.m.world.raycast(x0, y0, x0 + ca * maxD * dir, y0 + sa * maxD * dir, (o) => o !== b && o.kind !== 'bin' && o.kind !== 'debris', true);
        if (hit) best = Math.min(best, hit.t * maxD);
      }
      return best;
    }

    // ------------------------------------------------------------------ main
    update(dt) {
      const c = this.car, M = this.m;
      c.input.handbrake = 0; c.input.horn = 0; c.input.recover = 0;
      if (c.status !== 'active') { this.drive(0); c.input.steer = 0; return; }
      this.hornCool -= dt; this.stateT += dt;
      // recovery when tipped over or properly wedged
      if (c.overturned || (c.canRecover && c.stuckT > 4.5)) { c.input.recover = 1; this.drive(0); return; }
      if (c.recovering) { c.input.recover = 1; return; }
      const phase = M.phase;
      if (phase !== this.lastPhase) { this.onPhase(phase); this.lastPhase = phase; }
      if (phase === 'horn' || phase === 'intro' || phase === 'finale' || phase === 'results') { this.drive(0); c.input.steer = 0; return; }
      // unstick manoeuvre in progress
      if (this.unstickT > 0) {
        this.unstickT -= dt;
        this.drive(this.unstickDir * 3.0); c.input.steer = this.unstickSteer;
        if (this.unstickT <= 0) this.replan = true;
        return;
      }
      this.thinkT -= dt;
      if (this.thinkT <= 0) { this.think(); this.thinkT = 0.25 + this.rand() * 0.1; }
      this.act(dt);
      this.watchStuck(dt);
    }

    onPhase(phase) {
      this.noticeT = this.reaction;
      if (phase === 'circulation') { this.state = 'cruise'; this.target = null; this.plan = null; this.cruiseGoal = null; this.attack = null; }
      if (phase === 'battle' || phase === 'sudden') { this.state = 'choose'; this.target = null; this.plan = null; this.attack = null; }
    }

    watchStuck(dt) {
      const c = this.car, inp = c.input;
      const wants = inp.throttle > 0.3 || inp.brake > 0.3;
      if (this.state === 'hold') { this.stuckT = 0; return; }
      if (wants && c.speed < 0.35 && c.gearTimer === 0) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
      if (this.stuckT > (this.state === 'maneuver' || this.state === 'settle' ? 1.6 : 1.1)) {
        this.stuckT = 0;
        const now = this.m.time;
        this.unsticks = this.unsticks.filter((t) => now - t < 15); this.unsticks.push(now);
        // back away from whatever we hit, steering the other way
        const goingBack = c.gear === -1;
        this.unstickDir = goingBack ? 1 : -1;
        this.unstickSteer = -U.sign(inp.steer || (this.rand() - 0.5)) * (0.6 + this.rand() * 0.4);
        this.unstickT = 0.9 + this.rand() * 0.8;
        if (this.unsticks.length >= 3 && this.path) {
          // the route is blocked: penalise the edge we are on and re-route
          const pr = this.m.arena.navProject(c.x, c.y);
          this.edgePenalty.set(pr.e.id, (this.edgePenalty.get(pr.e.id) || 0) + 160);
          this.unsticks.length = 0;
          if (this.state === 'maneuver' || this.state === 'settle') this.abandon(8);
        }
        if (!goingBack && this.p.ram > 0.5 && this.hornCool <= 0) { c.input.horn = 1; this.hornCool = 4; }
      }
    }

    // ------------------------------------------------------------------ deciding
    think() {
      const M = this.m, c = this.car;
      if (M.phase === 'circulation') return this.thinkCruise();
      if (M.phase !== 'battle' && M.phase !== 'sudden') return;
      if (this.noticeT > 0) { this.noticeT -= 0.3; if (this.state === 'choose') { this.thinkCruise(); return; } }
      // parked: hold. If dislodged, try again.
      if (this.state === 'hold') {
        if (c.park.parked) return;
        if (c.park.space && c.park.space === this.target && this.stateT > 0.6) { this.beginSettle(); return; }
        if (!c.park.parked && this.stateT > 1.0) this.state = 'choose';
      }
      const act = M.parking.active;
      // current target still worth it?
      if (this.target) {
        const own = this.target.owner;
        const takenByOther = own && own !== c && own.park.parked && own.park.space === this.target;
        if (takenByOther && this.state !== 'attack') {
          if (this.wantAttack(own)) { this.startAttack(own, this.target); return; }
          this.blacklist.set(this.target, M.time + 6); this.target = null; this.state = 'choose';
        }
        if (this.state === 'attack' && this.attack && !this.attack.car.park.parked) {
          // victim is out: take the space
          this.target = this.attack.space; this.attack = null; this.beginApproach(this.target); return;
        }
      }
      // someone else is clearly winning the race for our space: give way (or, if you are that sort, barge)
      if (this.target && (this.state === 'goto' || this.state === 'maneuver') && this.stateT > 1.0) {
        const sp = this.target.sp, myD = U.dist(c.x, c.y, sp.x, sp.y);
        for (const o of M.cars) {
          if (o === c || o.status !== 'active') continue;
          const od = U.dist(o.x, o.y, sp.x, sp.y);
          const theirs = o.bot ? o.bot.target === this.target && (o.bot.state === 'maneuver' || o.bot.state === 'settle' || o.bot.state === 'hold') : od < 7 && o.speed < 3;
          if (theirs && od < myD - 1 && od < 12) {
            if (this.p.ram >= 1 && c.spec.mass > o.spec.mass * 0.9 && myD < 25) { this.startAttack(o, this.target); return; }
            this.abandon(10); return;
          }
        }
      }
      // two drivers fiddling about beside the same space: after a while one of them gives up and goes elsewhere
      if (this.target && (this.state === 'goto' || this.state === 'maneuver' || this.state === 'settle')) {
        const sp = this.target.sp, myD = U.dist(c.x, c.y, sp.x, sp.y);
        this.nearT = myD < 12 ? (this.nearT || 0) + 0.3 : 0;
        if (this.nearT > 5) {
          for (const o of M.cars) {
            if (o === c || o.status !== 'active' || (o.park.parked && o.park.space !== this.target)) continue;
            const od = U.dist(o.x, o.y, sp.x, sp.y);
            if (od > 9) continue;
            const rival = o.bot ? o.bot.target === this.target && (o.bot.nearT || 0) > 2 : o.speed < 3;
            if (!rival) continue;
            // the one further from the space backs off (ties: the later car on the grid); a human is
            // given way to after a longer stand-off unless you are that sort of driver
            const yieldIt = o.bot ? myD > od + 0.6 || (Math.abs(myD - od) <= 0.6 && M.cars.indexOf(c) > M.cars.indexOf(o))
              : this.nearT > 9 && this.p.ram < 1;
            if (yieldIt) { this.nearT = 0; this.abandon(14); return; }
          }
        }
      } else this.nearT = 0;
      if (this.state === 'choose' || (this.state === 'goto' && this.stateT > 12 && this.stateT % 6 < 0.4) || this.replan) {
        this.replan = false;
        const best = this.pickSpace(act);
        if (best && best.attack) { this.startAttack(best.attack, best.st); return; }
        if (best && (best.st !== this.target || this.state === 'choose')) this.beginApproach(best.st);
        else if (!best && this.state === 'choose') this.thinkCruise();
      }
    }
    wantAttack(victim) {
      const c = this.car;
      if (this.p.attackBias < 0) return false;
      const ratio = c.spec.mass / victim.spec.mass;
      const late = this.m.timeLeft < 22;
      const free = this.m.parking.active.filter((s) => !(s.owner && s.owner.park.parked)).length;
      const d = U.dist(c.x, c.y, victim.x, victim.y);
      if (free === 0) return this.p.attackBias >= 0 && d < 120; // nothing else to do: everyone becomes a bully
      if (d > 70) return false;
      // the bully prefers a vulnerable parked car to a free space once spaces are scarce or time is short
      const scarce = free <= 1 || this.m.timeLeft < 26;
      return (this.p.attackBias >= 1 && ratio > 0.85 && scarce) || (this.p.ram >= 1 && ratio > 1.2 && scarce) || (late && ratio > 1.4 && this.p.attackBias > 0);
    }
    pickSpace(act, anyway) {
      const c = this.car, M = this.m, now = M.time;
      let best = null, bestCost = 1e9;
      for (const st of act) {
        if (!anyway && (this.blacklist.get(st) || 0) > now) continue;
        const own = st.owner;
        const occupied = own && own !== c && own.park.parked && own.park.space === st;
        const d = U.dist(c.x, c.y, st.sp.x, st.sp.y);
        const tp = { hatch: 110, estate: 140, suv: 170, van: 190 }[c.spec.type];
        const route = this.m.arena.navPath(c.x, c.y, st.sp.access.x, st.sp.access.y, { heading: c.a, turnPenalty: tp, penalty: (e) => this.edgePenalty.get(e.id) || 0 }).length;
        let cost = route / (9 * this.speedMul);
        // can we even get there before the horn? (narrow streets: about 6 m/s door to door, plus parking)
        const eta = route / (6 * this.speedMul) + 6;
        if (M.phase === 'battle' && eta > M.timeLeft) cost += 25 + (eta - M.timeLeft);
        // entry difficulty for this vehicle
        const slack = (st.sp.hl * 2 - c.spec.L);
        cost += slack < 0.8 ? 6 : slack < 1.6 ? 3 : 0;
        if (st.sp.kind === 'wide' && this.kind === 'confident') cost -= 3;
        if (st.sp.kind === 'bay') cost += c.spec.type === 'hatch' ? 2 : 7;
        // others closer to it
        for (const o of M.cars) {
          if (o === c || o.status !== 'active') continue;
          const od = U.dist(o.x, o.y, st.sp.x, st.sp.y);
          if (od < d) cost += this.p.contest * (od < 15 ? 1.5 : 0.6);
          if (o.bot && o.bot.target === st && o.bot !== this) {
            // already claimed; someone halfway into it has as good as got it
            if (od < 14 && (o.bot.state === 'maneuver' || o.bot.state === 'settle' || o.bot.state === 'hold')) cost += 45;
            else cost += od < d + 10 ? 16 + this.p.contest * 0.6 : 4;
          } else if (!o.bot && od < 9 && o.speed < 3 && od < d) cost += 20; // a player lining up for it
          if (this.kind === 'quiet' && od < 30) cost += 6;
        }
        if (occupied) {
          if (!this.wantAttack(own)) continue;
          cost += 6 - (c.spec.mass / own.spec.mass) * 2 + own.damage.total * -4;
          if (this.p.attackBias >= 1) cost -= 4;
        }
        if (st === this.target) { cost *= 0.6; cost -= 3; this.curCost = cost; } // commitment
        if (cost < bestCost) { bestCost = cost; best = occupied ? { st, attack: own } : { st }; }
      }
      // nothing else left: go back and try again rather than give up on the last space in the street
      if (!best && !anyway && act.some((st) => (this.blacklist.get(st) || 0) > now)) return this.pickSpace(act, true);
      return best;
    }

    // cruising while the radio plays: scout the "?" spaces your personality likes
    thinkCruise() {
      const M = this.m, c = this.car;
      if (this.state !== 'cruise' && this.state !== 'choose') return;
      if (this.cruiseGoal && U.dist(c.x, c.y, this.cruiseGoal.x, this.cruiseGoal.y) > 12 && this.path && this.stateT < 25) return;
      const cands = M.parking.spaces.filter((s) => s.status === 'candidate' || (M.phase !== 'circulation' && s.status === 'active'));
      let goal = null;
      if (cands.length) {
        const score = (s) => {
          const d = U.dist(c.x, c.y, s.sp.x, s.sp.y);
          let v = 0;
          if (d < 15) v += 100; // move on from where we are
          for (const o of M.bots) if (o !== this && o.cruiseGoal && U.dist(o.cruiseGoal.x, o.cruiseGoal.y, s.sp.access.x, s.sp.access.y) < 25) v += 70; // spread out
          if (this.kind === 'nearest') v += d;
          else if (this.kind === 'quiet') { v += d * 0.4; for (const o of M.cars) if (o !== c && o.status === 'active' && U.dist(o.x, o.y, s.sp.x, s.sp.y) < 35) v += 40; }
          else if (this.kind === 'confident') v += Math.abs(d - 90) + this.rand() * 60;
          else v += d * 0.7 + this.rand() * 50;
          return v;
        };
        cands.sort((a, b) => score(a) - score(b));
        const s = cands[0];
        // aim for the lane beside the space, slightly past it
        goal = { x: s.sp.access.x, y: s.sp.access.y };
      } else {
        const e = this.rand.pick(M.arena.nav.edges.filter((e) => e.street !== 'Grange Court'));
        const p = e.line.at(e.length / 2); goal = { x: p.x, y: p.y };
      }
      // bully tails someone during the music
      if (this.kind === 'bully' && M.phase === 'circulation' && this.rand() < 0.5) {
        const vic = M.cars.filter((o) => o !== c && o.status === 'active').sort((a, b) => U.dist(c.x, c.y, a.x, a.y) - U.dist(c.x, c.y, b.x, b.y))[0];
        if (vic) goal = { x: vic.x, y: vic.y };
      }
      this.cruiseGoal = goal;
      const r = this.navTo(goal.x, goal.y);
      this.setPath(r.pts, false); this.stateT = 0;
    }

    abandon(sec) {
      if (this.target) this.blacklist.set(this.target, this.m.time + (sec || 8));
      this.target = null; this.plan = null; this.state = 'choose'; this.stateT = 0; this.replan = true;
    }

    // ------------------------------------------------------------------ parking plans
    makePlan(st, arrive, local) {
      const c = this.car, sp = st.sp, A = this.m.arena;
      const ax = Math.cos(sp.a), ay = Math.sin(sp.a);
      // which way is the lane? (from the space towards the street centreline)
      let nx = sp.access.x - sp.x, ny = sp.access.y - sp.y; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const L = c.spec.L;
      if (sp.kind === 'bay') {
        // perpendicular bay off the car-park aisle. o = from the bay out into the aisle
        const cp = A.carpark;
        let ox = Math.cos(sp.a), oy = Math.sin(sp.a);
        if (ox * (cp.x - sp.x) + oy * (cp.y - sp.y) < 0) { ox = -ox; oy = -oy; }
        const ax0 = Math.cos(cp.a), ay0 = Math.sin(cp.a);
        const side = (c.x - sp.x) * ax0 + (c.y - sp.y) * ay0 >= 0 ? 1 : -1;
        const tx = -side * ax0, ty = -side * ay0; // travel direction along the aisle, past the bay
        const wb = c.spec.wb / 2;
        const aisleOff = Math.abs((cp.x - sp.x) * ox + (cp.y - sp.y) * oy) + 1.0;
        if (!this.bayReverse) {
          // nose in: from before the bay, swing in from the far side of the aisle
          const lead = 2.6 + c.spec.wb * 0.75;
          const start = [sp.x + ox * aisleOff - tx * lead, sp.y + oy * aisleOff - ty * lead];
          const r0 = [start[0] - tx * wb, start[1] - ty * wb], r1 = [sp.x + ox * (wb - 0.2), sp.y + oy * (wb - 0.2)];
          return { start, startHead: Math.atan2(ty, tx), pts: bezier(r0, Math.atan2(ty, tx), r1, Math.atan2(-oy, -ox), lead * 0.55, aisleOff * 0.5, 24), reverse: false, endPose: { x: r1[0], y: r1[1], h: Math.atan2(-oy, -ox) }, loose: true };
        }
        // reverse in: drive past the bay, stop, reverse in
        const start = [sp.x + ox * aisleOff + tx * (4.0 + c.spec.wb * 0.4), sp.y + oy * aisleOff + ty * (4.0 + c.spec.wb * 0.4)];
        const r0 = [start[0] - tx * wb, start[1] - ty * wb], r1 = [sp.x - ox * (wb - 0.15), sp.y - oy * (wb - 0.15)];
        return { start, startHead: Math.atan2(ty, tx), pts: bezier(r0, Math.atan2(-ty, -tx), r1, Math.atan2(-oy, -ox), 2.4, 2.8, 24), reverse: true };
      }
      // parallel spaces. Travel direction: whichever way along the kerb we are coming from
      const d = arrive ? (arrive[0] * ax + arrive[1] * ay >= 0 ? 1 : -1) : ((c.x - sp.x) * ax + (c.y - sp.y) * ay >= 0 ? -1 : 1);
      const dx = ax * d, dy = ay * d, hd = Math.atan2(dy, dx);
      // nose-in only when we are coming at it from behind with room to line up
      const behindOk = !local || local.along * d < -(sp.hl + 12);
      if (behindOk && (sp.kind === 'wide' || (sp.openEnd && sp.openEnd === -d) || (sp.hl * 2 - L > 2.6))) {
        // nose in forwards, from the near (open) end
        const back = sp.hl + 6.5 + L * 0.3;
        const start = [sp.x - dx * back + nx * (sp.hw + 1.3), sp.y - dy * back + ny * (sp.hw + 1.3)];
        const end = [sp.x + dx * (sp.hl - L / 2 - 0.25) * 0.4, sp.y + dy * (sp.hl - L / 2 - 0.25) * 0.4];
        return { start, startHead: hd, pts: bezier(start, hd, end, hd, back * 0.42, back * 0.4, 28), reverse: false, finish: { dx, dy } };
      }
      if (sp.openEnd && sp.openEnd === d) {
        // open end is ahead of us: drive past and reverse straight-ish in from the open end
      }
      // classic reverse parallel park: pull up alongside the car in front, reverse in
      const ahead = sp.hl + L * 0.5 + 1.6 + (c.spec.wb > 2.9 ? 0.9 : 0.3);
      const lat = sp.hw + c.spec.W / 2 + 0.75;
      const start = [sp.x + dx * ahead + nx * lat, sp.y + dy * ahead + ny * lat];
      // rear axle target: centre of the space minus half a wheelbase towards the back
      const end = [sp.x - dx * (c.spec.wb / 2 - 0.15), sp.y - dy * (c.spec.wb / 2 - 0.15)];
      const rs = [start[0] - dx * c.spec.wb / 2, start[1] - dy * c.spec.wb / 2];
      const len = Math.hypot(end[0] - rs[0], end[1] - rs[1]);
      return { start, startHead: hd, pts: bezier(rs, hd + Math.PI, end, hd + Math.PI, len * 0.45, len * 0.5, 30), reverse: true, rearPath: true, finish: { dx, dy } };
    }
    beginApproach(st) {
      if (this.target !== st) this.bayReverse = this.car.spec.type === 'van' && this.rand() < 0.5;
      else if (st.sp.kind === 'bay') this.bayReverse = !this.bayReverse; // try the other way in
      this.target = st;
      const c = this.car, sp = st.sp, A = this.m.arena;
      let arrive = null, local = null;
      if (sp.kind !== 'bay') {
        const ax = Math.cos(sp.a), ay = Math.sin(sp.a);
        const along = (c.x - sp.x) * ax + (c.y - sp.y) * ay;
        const lat = Math.abs(-(c.x - sp.x) * ay + (c.y - sp.y) * ax);
        const myStreet = A.streetAt(c.x, c.y);
        if (myStreet && myStreet.name === sp.street && Math.abs(along) < 80 && lat < 9 && Math.abs(Math.cos(c.a) * ax + Math.sin(c.a) * ay) > 0.6) {
          // already on the same street: keep facing the way we face, reverse to the start if needed
          arrive = [Math.cos(c.a), Math.sin(c.a)];
          local = { along };
        } else {
          const r0 = this.navTo(sp.access.x, sp.access.y);
          const P = r0.pts;
          for (let i = P.length - 2; i >= 0; i--) {
            const dx = P[P.length - 1][0] - P[i][0], dy = P[P.length - 1][1] - P[i][1], l = Math.hypot(dx, dy);
            if (l > 3) { arrive = [dx / l, dy / l]; break; }
          }
          if (!arrive) arrive = [Math.cos(c.a), Math.sin(c.a)];
        }
      }
      this.plan = this.makePlan(st, arrive, local);
      this.state = 'goto'; this.stateT = 0;
      const s = this.plan.start;
      const hx = Math.cos(this.plan.startHead), hy = Math.sin(this.plan.startHead);
      if (local) {
        const ahead = (s[0] - c.x) * Math.cos(c.a) + (s[1] - c.y) * Math.sin(c.a);
        if (ahead > 0.5) this.setPath([[c.x, c.y], [s[0], s[1]], [s[0] + hx, s[1] + hy]], false);
        else {
          // reverse back down the street to the start pose (rear axle leads)
          const wb = c.spec.wb / 2;
          this.setPath([[c.x - Math.cos(c.a) * wb, c.y - Math.sin(c.a) * wb], [s[0] - hx * wb, s[1] - hy * wb], [s[0] - hx * (wb + 1), s[1] - hy * (wb + 1)]], true);
        }
        return;
      }
      if (sp.kind === 'bay') {
        // car park: head for the aisle near the bay, line up loosely
        const r = this.navTo(s[0], s[1]);
        this.setPath(r.pts.concat([[s[0] + hx, s[1] + hy]]), false);
        return;
      }
      const pre = [s[0] - hx * 7, s[1] - hy * 7];
      const r = this.navTo(pre[0], pre[1]);
      const pts = r.pts.concat([[s[0], s[1]], [s[0] + hx * 1.0, s[1] + hy * 1.0]]);
      this.setPath(pts, false);
    }
    beginManeuver() {
      this.state = 'maneuver'; this.stateT = 0;
      const P = this.plan, c = this.car;
      if (!P.reverse && P.endPose) {
        // forward entries are re-drawn from where we actually are
        const wb = c.spec.wb / 2, r0 = [c.x - Math.cos(c.a) * wb, c.y - Math.sin(c.a) * wb];
        const e = P.endPose, d = Math.hypot(e.x - r0[0], e.y - r0[1]);
        this.setPath(bezier(r0, c.a, [e.x, e.y], e.h, d * 0.5, d * 0.45, 24), false);
      } else this.setPath(P.pts, P.reverse);
    }
    beginSettle() { this.state = 'settle'; this.stateT = 0; this.shuffles = 0; this.shuffleDir = 0; }

    startAttack(victim, st) {
      this.attack = { car: victim, space: st, phase: 'runup', t: 0 }; this.target = st; this.state = 'attack'; this.stateT = 0;
      if (this.hornCool <= 0) { this.car.input.horn = 1; this.hornCool = 3; }
    }

    // ------------------------------------------------------------------ acting
    act(dt) {
      const c = this.car, M = this.m;
      const cruise = 13.5 * this.speedMul;
      // oncoming traffic: keep left (it is Britain)
      let offset = 0, slow = 99;
      for (const o of M.cars) {
        if (o === c || o.status !== 'active') continue;
        const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
        if (d > 22) continue;
        const ahead = (dx * c.body.c + dy * c.body.s) / d;
        const facing = Math.cos(o.a - c.a);
        if (ahead > 0.7 && facing < -0.5) { offset = 0.9; slow = Math.min(slow, 3 + d * 0.25 + 4 * (1 - this.p.cautious)); }
      }
      if (this.state === 'cruise' || this.state === 'choose') {
        if (!this.path) { this.thinkCruise(); }
        const rem = this.follow(Math.min(cruise * 0.85, slow + 2), { offset: offset + (this.lastAvoid || 0) });
        this.avoid(cruise);
        if (this.state !== 'cruise' && this.state !== 'choose') return;
        if (rem < 4) this.cruiseGoal = null, this.thinkCruise();
        return;
      }
      if (this.state === 'goto') {
        const s = this.plan.start;
        const dist = U.dist(c.x, c.y, s[0], s[1]);
        const near = dist < 9;
        const rem = this.reverse ? this.follow(Math.min(4.2, 1.2 + dist * 0.4), { stopAtEnd: true, look: 3.2 })
          : this.follow(near ? Math.min(4.5, 1.6 + dist * 0.35) : Math.min(cruise, slow + 3), { offset: near ? 0 : offset + (this.lastAvoid || 0), stopAtEnd: near });
        if (!near && !this.reverse) this.avoid(cruise);
        if (this.state !== 'goto' || !this.plan) return;
        const hd = Math.abs(U.wrap(c.a - this.plan.startHead));
        if ((dist < 2.2 && hd < 0.45) || (rem < 0.8 && dist < 3.0 && hd < 0.55)) { this.beginManeuver(); return; }
        if (this.plan.loose && dist < 5.5 && hd < 1.3 && !this.reverse) { this.beginManeuver(); return; }
        if (dist < 4 && hd > 1.2 && c.speed < 2 && !this.turn) { this.turn = { why: 'start', head: this.plan.startHead, t: 0, dir: 1, legT: 0, side: 0 }; }
        if (rem < 0.5 && dist > 2.6) { this.goes = (this.goes || 0) + 1; if (this.goes > 4) { this.goes = 0; this.abandon(10); } else this.beginApproach(this.target); }
        // give up only if the drive is not getting anywhere, not just because it is a long way
        if (this.stateT > 8) {
          const tg = this.path ? this.path.length - this.pathS : U.dist(c.x, c.y, this.target.sp.x, this.target.sp.y);
          if (this.progT == null || this.stateT < this.progT || this.turn) { this.progT = this.stateT; this.progD = tg; } // a K-turn is progress of a sort
          else if (this.stateT - this.progT > 10) {
            if (this.progD - tg < 15) {
              this.progT = null;
              const pr = M.arena.navProject(c.x, c.y);
              this.edgePenalty.set(pr.e.id, (this.edgePenalty.get(pr.e.id) || 0) + 80);
              if (M.parking.active.length > 1) { this.abandon(10); return; }
              this.beginApproach(this.target); return; // the only space left: find another way to it
            }
            this.progT = this.stateT; this.progD = tg;
          }
        }
        if (this.stateT > 70) this.abandon(10);
        return;
      }
      if (this.state === 'maneuver') {
        const sp = this.target.sp;
        const rem = this.follow(this.plan.reverse ? 2.1 : 2.5, { stopAtEnd: true, look: this.plan.reverse ? 2.4 : 2.8, noTurn: true });
        // a wall or car right behind/in front: stop the manoeuvre and settle from here
        const m = M.parking.measure(c, sp);
        if (rem < 0.35 || (m.inside && m.align < 0.2) || this.stateT > 14) { this.beginSettle(); return; }
        const clr = this.clearance(1.0, this.plan.reverse);
        if (clr < 0.25 && c.speed < 0.6 && this.stateT > 1) this.beginSettle();
        return;
      }
      if (this.state === 'settle') return this.settle(dt);
      if (this.state === 'hold') {
        this.drive(0); c.input.steer = 0;
        const m = M.parking.measure(c, this.target.sp);
        if (!c.park.parked && (!m.inside || m.align > LS.Parking.ALIGN) && this.stateT > 0.8) this.beginSettle();
        return;
      }
      if (this.state === 'attack') return this.doAttack(dt);
    }

    // what is in our way along the path ahead? Shift within the lane to squeeze past things that
    // stick out (badly parked SUVs, oncoming cars); returns the distance to anything we cannot pass.
    pathObstacle(maxD, ignoreCars) {
      const c = this.car, P = this.path;
      this.avoidOffset = 0; this.blockCar = null;
      if (!P) return maxD;
      const hw = c.spec.W / 2 + 0.18, s0 = this.pathS;
      const obs = [];
      for (const B of this.m.world.bodies) {
        if (!B.enabled || B === c.body) continue;
        if (B.kind !== 'car' && B.kind !== 'parked') continue;
        if (ignoreCars && B.kind === 'car') continue;
        const dx = B.x - c.x, dy = B.y - c.y;
        if (dx * dx + dy * dy > (maxD + 6) * (maxD + 6)) continue;
        let bl = 1e9, bs = 0, bh = 0;
        for (let q = s0; q <= Math.min(P.length + 6, s0 + maxD + 4); q += 2) {
          const p = q <= P.length ? P.at(q) : (() => { const e = P.at(P.length); return { x: e.x + e.tx * (q - P.length), y: e.y + e.ty * (q - P.length), heading: e.heading, tx: e.tx, ty: e.ty }; })();
          const lx = (B.x - p.x) * p.tx + (B.y - p.y) * p.ty, ly = -(B.x - p.x) * p.ty + (B.y - p.y) * p.tx;
          if (Math.abs(lx) <= 1.2 && Math.abs(ly) < Math.abs(bl)) { bl = ly; bs = q + lx; bh = p.heading; }
        }
        if (bl === 1e9) continue;
        const phi = B.a - bh;
        const ext = Math.abs(Math.sin(phi)) * B.hx + Math.abs(Math.cos(phi)) * B.hy;
        const extL = Math.abs(Math.cos(phi)) * B.hx + Math.abs(Math.sin(phi)) * B.hy;
        const d = bs - s0 - c.spec.L / 2 - extL;
        if (d < -1) continue;
        const inner = Math.abs(bl) - ext; // gap between the path and the obstacle's near side
        if (inner > hw + 1.4) continue;
        obs.push({ side: Math.sign(bl), inner, d: Math.max(0, d), moving: B.kind === 'car' && Math.hypot(B.vx, B.vy) > 1.5, car: B.kind === 'car' ? B.user.car : null });
      }
      // shift away from intrusions on one side, as long as the other side leaves room
      let left = 0, right = 0;
      for (const o of obs) { const need = hw - o.inner; if (need <= 0) continue; if (o.side < 0) left = Math.max(left, need); else right = Math.max(right, need); }
      let offset = U.clamp(left - right, -1.6, 1.6);
      let best = maxD;
      for (const o of obs) {
        // distance from our shifted corridor to the obstacle
        const gap = o.side > 0 ? o.inner - offset : o.inner + offset;
        if (gap < hw - 0.05 && o.d < best) { best = o.d; this.blockCar = o.car; }
      }
      // a kerb or wall is just as solid: don't shift beyond the carriageway
      const pt = P.at(Math.min(P.length, s0 + 4));
      if (this.m.arena.kerb(pt.x + pt.nx * (offset + Math.sign(offset) * hw), pt.y + pt.ny * (offset + Math.sign(offset) * hw)) > 0.2) offset *= 0.5;
      this.avoidOffset = offset;
      return best;
    }
    // slow down for anything actually in our lane
    avoid(cruise) {
      const c = this.car;
      if (c.gear === -1) return;
      if (this.pushT > 0) { this.pushT -= 1 / 60; c.input.throttle = 1; c.input.brake = 0; return; }
      const barge = this.kind === 'confident' && this.m.phase !== 'circulation';
      const look = Math.max(6, c.speed * 1.6 + 4);
      const d = this.obsD = this.pathObstacle(look, barge);
      this.lastAvoid = U.approach(this.lastAvoid || 0, this.avoidOffset, 0.05);
      // stuck in a queue behind something that is not moving: shove it, or find another way round
      if (d < 2.2 && c.speed < 0.6) this.blockedT = (this.blockedT || 0) + 1 / 60; else this.blockedT = Math.max(0, (this.blockedT || 0) - 1 / 30);
      if (this.blockedT > 2.2) {
        this.blockedT = 0;
        const other = this.blockCar;
        if (this.p.ram >= 0.8 || (this.p.ram > 0 && this.rand() < 0.5) || (other && other.spec.mass < c.spec.mass * 0.7)) { this.pushT = 1.8; if (this.hornCool <= 0) { c.input.horn = 1; this.hornCool = 3; } return; }
        if (other && other.status === 'active') {
          // stand-off with another driver: one of you has to back up (the one who is not "confident" does)
          if (!(other.bot && other.bot.unstickT > 0)) { this.unstickDir = -1; this.unstickSteer = (this.rand() < 0.5 ? 1 : -1) * 0.7; this.unstickT = 1.4 + this.rand(); if (this.hornCool <= 0) { c.input.horn = 1; this.hornCool = 4; } }
          return;
        }
        if (this.target && U.dist(c.x, c.y, this.target.sp.x, this.target.sp.y) < 18 && this.state === 'goto') { this.abandon(8); return; }
        const pr = this.m.arena.navProject(c.x, c.y);
        this.edgePenalty.set(pr.e.id, (this.edgePenalty.get(pr.e.id) || 0) + 140);
        if (this.hornCool <= 0) { c.input.horn = 1; this.hornCool = 4; }
        if (this.state === 'goto' && this.target) this.beginApproach(this.target); else { this.cruiseGoal = null; this.thinkCruise(); }
        return;
      }
      if (d < look) {
        const want = Math.sqrt(2 * 4.0 * Math.max(0, d - 1.2));
        if (c.forward > want + 0.3) { c.input.throttle = 0; c.input.brake = U.clamp((c.forward - want) * 0.3, 0.2, 1); }
        else if (c.input.throttle > 0 && want < 1) c.input.throttle = Math.min(c.input.throttle, 0.25);
      }
    }

    // final adjustments inside the space: shuffle forwards/backwards along the space's centre line
    settle(dt) {
      const c = this.car, sp = this.target.sp, M = this.m;
      const m = M.parking.measure(c, sp);
      const ok = m.inside && m.align <= LS.Parking.ALIGN * 0.85;
      if (ok) { this.drive(0); c.input.steer = 0; if (c.speed < 0.3) { this.state = 'hold'; this.stateT = 0; } return; }
      if (Math.abs(m.lx) > sp.hl + 2.5 || Math.abs(m.ly) > sp.hw + 1.6 || m.align > 0.75) {
        // nowhere near: line up again rather than shuffle
        this.tries = (this.tries || 0) + 1;
        if (this.tries > 3) { this.tries = 0; this.abandon(12); } else this.beginApproach(this.target);
        return;
      }
      if (this.stateT > 16 || this.shuffles > 8) {
        this.tries = (this.tries || 0) + 1;
        if (this.tries > 2) { this.tries = 0; this.abandon(12); }
        else this.beginApproach(this.target);
        return;
      }
      const ax = Math.cos(sp.a), ay = Math.sin(sp.a);
      const nose = Math.cos(c.a) * ax + Math.sin(c.a) * ay >= 0 ? 1 : -1;
      if (!this.shuffleDir || this.shuffleT <= 0) {
        const want = -m.lx; // + : centre should move towards +axis
        let dir = Math.abs(want) > 0.3 ? U.sign(want) * nose : (this.shuffleDir ? -this.shuffleDir : 1);
        if (this.clearance(1.2, dir < 0) < 0.35) dir = -dir;
        this.shuffleDir = dir; this.shuffleT = 2.2; this.shuffles++;
        const move = nose * dir;
        const rearOff = -nose * c.spec.wb / 2;
        const travel = Math.abs(want) > 0.3 ? Math.min(2.5, Math.abs(want)) : 1.2;
        const s0 = m.lx + rearOff - move * 1.0, s1 = m.lx + rearOff + move * (travel + 1.5);
        this.setPath([[sp.x + ax * s0, sp.y + ay * s0], [sp.x + ax * s1, sp.y + ay * s1]], dir < 0);
      }
      this.shuffleT -= dt;
      const rem = this.follow(1.1, { stopAtEnd: true, look: 1.8, noTurn: true });
      const clr = this.clearance(0.7, this.shuffleDir < 0);
      if (rem < 1.55 || clr < 0.2) { this.shuffleT = 0; this.drive(0); }
    }

    doAttack(dt) {
      const c = this.car, A = this.attack, M = this.m;
      if (!A || A.car.status !== 'active') { this.abandon(2); return; }
      A.t += dt;
      const v = A.car;
      if (!v.park.parked && (A.t > 2.5 || U.dist(v.x, v.y, A.space.sp.x, A.space.sp.y) > 9 || A.phase === 'backoff')) { this.target = A.space; this.attack = null; this.beginApproach(this.target); return; }
      const d = U.dist(c.x, c.y, v.x, v.y);
      if (A.phase === 'runup') {
        // aim at a rear/front corner on the lane side so the victim spins out of the box
        const ends = [1, -1].map((e) => { const [x, y] = v.body.toWorld(e * v.spec.L * 0.42, 0); return { x, y, e }; });
        ends.sort((p, q) => U.dist(c.x, c.y, p.x, p.y) - U.dist(c.x, c.y, q.x, q.y));
        const tgt = ends[0];
        if (!this.path || A.t > 0.8) {
          if (d > 16) { const r = this.navTo(tgt.x, tgt.y); this.setPath(r.pts, false); }
          else this.setPath([[c.x, c.y], [tgt.x, tgt.y], [tgt.x + (tgt.x - c.x) * 0.3, tgt.y + (tgt.y - c.y) * 0.3]], false);
          A.t = 0;
        }
        this.follow(d < 16 ? 14 : 10 * this.speedMul, {});
        if (d < 14 && this.hornCool <= 0) { c.input.horn = 1; this.hornCool = 2.5; }
        if (c.body.touchIds.includes(v.body.id)) { A.phase = 'backoff'; A.t = 0; }
        if (A.t > 6 && d < 6) { A.phase = 'backoff'; A.t = 0; }
      } else {
        this.drive(-3.5); c.input.steer = U.clamp(-c.steerAngle * 2, -1, 1) * 0.3;
        if (A.t > 1.3 || this.clearance(1.0, true) < 0.4) { A.phase = 'runup'; A.t = 0; this.path = null; }
      }
      if (this.stateT > 25) this.abandon(6);
    }
  }
  Bot.PERSONAS = PERSONAS;
  LS.Bot = Bot;
})(window.LS);
