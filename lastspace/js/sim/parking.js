/* LAST SPACE - parking spaces: which ones are possible, which go live, and whether a car is
   validly parked. A park is valid when the car's whole footprint (its physics box, the same one that
   collides) is inside the marked rectangle, it faces along the space within 15 degrees, it is upright,
   and it stays below walking speed for the hold time. Occupancy is decided from geometry every tick,
   never from who touched the space first. */
(function (LS) {
  'use strict';
  const U = LS.U;
  const WALKING = 1.5;          // m/s (about 3.4 mph)
  const ALIGN = 15 * Math.PI / 180;
  const EDGE_TOL = 0.06;        // paint is 10 cm wide; a wheel on the line still counts

  class Parking {
    constructor(arena, rand) {
      this.arena = arena; this.rand = rand;
      this.spaces = arena.spaces.map((sp) => ({ sp, status: 'idle', owner: null, contenders: 0, activeT: 0 }));
      this.hold = 2.0;
    }
    get active() { return this.spaces.filter((s) => s.status === 'active'); }

    // where is the car relative to a space? returns {inside, out, align, lx, ly}
    measure(car, sp) {
      const b = car.body;
      let out = 0;
      for (const [x, y] of b.corners()) {
        const [lx, ly] = this.arena.spaceLocal(sp, x, y);
        out = Math.max(out, Math.abs(lx) - sp.hl, Math.abs(ly) - sp.hw);
      }
      const align = U.axisDiff(b.a, sp.a);
      const [lx, ly] = this.arena.spaceLocal(sp, b.x, b.y);
      return { inside: out <= EDGE_TOL, out: Math.max(0, out), align, lx, ly };
    }

    // a space is usable if no resident's car or debris has been shunted into it
    usable(st) {
      const sp = st.sp, w = this.arena.world;
      if (!w) return true;
      const probe = { x: sp.x, y: sp.y, c: sp.c, s: sp.s_, hx: sp.hl - 0.15, hy: sp.hw - 0.1 };
      for (const b of w.bodies) {
        if (!b.enabled || b.kind !== 'parked') continue;
        if (Math.abs(b.x - sp.x) + Math.abs(b.y - sp.y) > 14) continue;
        if (LS.Physics.collideBoxBox(probe, b)) return false;
      }
      return true;
    }

    // before the music stops: reveal some possible locations (more than will go live)
    setCandidates(n, cars, preferStreet) {
      for (const s of this.spaces) { s.status = 'idle'; s.owner = null; }
      const pool = this.rand.shuffle(this.spaces.filter((s) => this.usable(s)));
      const chosen = [];
      const streets = {};
      if (preferStreet) { const p = pool.find((s) => s.sp.street === preferStreet); if (p) { chosen.push(p); streets[p.sp.street] = 1; } }
      for (const pass of [0, 1, 2]) {
        for (const s of pool) {
          if (chosen.length >= n) break;
          if (chosen.includes(s)) continue;
          const near = chosen.some((c) => U.dist(c.sp.x, c.sp.y, s.sp.x, s.sp.y) < (pass === 0 ? 40 : pass === 1 ? 18 : 0));
          const crowd = (streets[s.sp.street] || 0) >= (pass === 0 ? 2 : 99);
          if (near || crowd) continue;
          chosen.push(s); streets[s.sp.street] = (streets[s.sp.street] || 0) + 1;
        }
      }
      for (const s of chosen) s.status = 'candidate';
      return chosen;
    }

    // the music stops: k candidates go live, chosen away from where the cars are right now
    activate(k, cars, preferStreet) {
      let cands = this.spaces.filter((s) => s.status === 'candidate' && this.usable(s));
      if (cands.length < k) cands = cands.concat(this.spaces.filter((s) => s.status === 'idle' && this.usable(s)));
      const chosen = [];
      const live = cars.filter((c) => c.status === 'active');
      while (chosen.length < k && cands.length) {
        const ws = cands.map((s) => {
          let dmin = 1e9;
          for (const c of live) dmin = Math.min(dmin, U.dist(c.x, c.y, s.sp.x, s.sp.y));
          let w = Math.pow(U.clamp((dmin - 6) / 20, 0.03, 1), 2);
          if (preferStreet && s.sp.street === preferStreet) w *= 5;
          return w;
        });
        let tot = ws.reduce((a, b) => a + b, 0), u = this.rand() * tot, i = 0;
        for (; i < ws.length - 1; i++) { u -= ws[i]; if (u <= 0) break; }
        chosen.push(cands[i]); cands.splice(i, 1);
      }
      for (const s of this.spaces) {
        if (chosen.includes(s)) { s.status = 'active'; s.owner = null; s.activeT = 0; }
        else if (s.status === 'candidate') s.status = 'suspended';
      }
      return chosen;
    }
    addActive(cars) {
      const idle = this.spaces.filter((s) => (s.status === 'idle' || s.status === 'suspended') && this.usable(s));
      if (!idle.length) return null;
      let best = null, bd = -1;
      for (const s of idle) { let dmin = 1e9; for (const c of cars) if (c.status === 'active') dmin = Math.min(dmin, U.dist(c.x, c.y, s.sp.x, s.sp.y)); dmin += this.rand() * 25; if (dmin > bd) { bd = dmin; best = s; } }
      best.status = 'active'; best.owner = null; best.activeT = 0;
      return best;
    }
    clear() { for (const s of this.spaces) { s.status = 'idle'; s.owner = null; } }

    // every tick during a battle: progress, parked status and occupancy
    update(dt, cars, onEvent) {
      const act = this.active;
      for (const s of act) { s.contenders = 0; s.activeT += dt; }
      for (const car of cars) {
        const P = car.park;
        if (car.status !== 'active') { P.space = null; P.progress = 0; P.parked = false; continue; }
        // find the live space the car is in or nearest to
        let st = null, m = null, bestOut = 1e9;
        for (const s of act) {
          if (Math.abs(car.x - s.sp.x) + Math.abs(car.y - s.sp.y) > 14) continue;
          const mm = this.measure(car, s.sp);
          if (Math.abs(mm.lx) > s.sp.hl + car.spec.L * 0.5 + 0.5 || Math.abs(mm.ly) > s.sp.hw + car.spec.W * 0.5 + 0.4) continue;
          if (mm.out < bestOut) { bestOut = mm.out; st = s; m = mm; }
        }
        const wasParked = P.parked, wasSpace = P.space;
        P.hint = null; P.near = st; P.measure = m;
        if (!st) {
          if (wasParked) { P.parked = false; if (wasSpace && wasSpace.owner === car) wasSpace.owner = null; onEvent('dislodged', { car, space: wasSpace, by: this.blame(car) }); }
          P.space = null; P.progress = 0;
          continue;
        }
        st.contenders++;
        const upright = !car.overturned && !car.recovering;
        const placed = m.inside && m.align <= ALIGN && upright;
        const slow = car.speed < WALKING;
        // only one car can hold a space: if someone else is parked and still validly placed, no progress
        const taken = st.owner && st.owner !== car && st.owner.park.parked && st.owner.park.space === st;
        if (wasParked && (st !== wasSpace || !placed)) {
          P.parked = false; if (wasSpace && wasSpace.owner === car) wasSpace.owner = null;
          car.stats.dislodged++;
          onEvent('dislodged', { car, space: wasSpace, by: this.blame(car) });
        }
        P.space = st;
        if (placed && !taken) {
          if (P.parked) { P.progress = 1; car.stats.parkedTime += dt; }
          else if (slow) {
            P.progress = Math.min(1, P.progress + dt / this.hold);
            if (P.progress >= 1) {
              P.parked = true; st.owner = car; car.stats.parks++;
              if (car.stats.firstPark == null) car.stats.firstPark = st.activeT;
              onEvent('parked', { car, space: st });
            }
          } else { P.progress = Math.max(0, P.progress - dt * 1.5); P.hint = 'slow'; }
        } else {
          P.progress = Math.max(0, P.progress - dt * 3);
          P.hint = taken ? 'taken' : !upright ? 'upright' : !m.inside ? 'lines' : 'align';
        }
        P.best = Math.max(P.best, P.progress);
      }
    }
    blame(car) {
      return car.lastHitBy && (this.time || 0) - car.lastHitT < 3 ? car.lastHitBy : null;
    }
  }
  Parking.WALKING = WALKING; Parking.ALIGN = ALIGN; Parking.EDGE_TOL = EDGE_TOL;
  LS.Parking = Parking;
})(window.LS);
