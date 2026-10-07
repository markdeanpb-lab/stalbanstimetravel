/* LAST SPACE - vehicles: the four fictional contestant types, the tyre model, damage, kerbs,
   overturning and the recovery action. Cars are physics boxes; tyres act as impulses at each axle
   that cancel sideways slip up to the grip limit (so heavier cars resist shoving and handbrake turns
   let the rear slide). Collisions come from the rigid-body solver; this file only reads them. */
(function (LS) {
  'use strict';
  const U = LS.U, G = 9.81;

  // L, W, H metres; mass kg; wb wheelbase; maxSteer rad; steerRate rad/s; F0 launch force N;
  // P power W; vmax/vrev m/s; brakeF N; grip mu; durability (damage divisor); gearDelay s
  LS.VEHICLES = {
    hatch: {
      type: 'hatch', name: 'Pemberton Nippa', class: 'Small hatchback',
      blurb: 'Quick off the line and parks on a sixpence. Gets bullied by everything with a tow bar.',
      L: 3.95, W: 1.75, H: 1.46, mass: 1100, wb: 2.45, track: 1.5, cog: 0.52,
      maxSteer: 0.68, steerRate: 4.6, F0: 6400, P: 78000, vmax: 21.5, vrev: 7.5, brakeF: 12500,
      grip: 1.0, durability: 0.8, gearDelay: 0.1, tipDV: 10.5, rearView: 1,
      stats: { accel: 5, ram: 1, handling: 5, parking: 5, durability: 2 },
    },
    estate: {
      type: 'estate', name: 'Hartley Voyager Estate', class: 'Family estate',
      blurb: 'Balanced, sensible, and about a foot longer than any space you will ever want.',
      L: 4.82, W: 1.85, H: 1.5, mass: 1580, wb: 2.86, track: 1.58, cog: 0.55,
      maxSteer: 0.6, steerRate: 3.8, F0: 8200, P: 100000, vmax: 22.5, vrev: 6.5, brakeF: 16000,
      grip: 1.0, durability: 1.0, gearDelay: 0.18, tipDV: 10.5, rearView: 1,
      stats: { accel: 4, ram: 3, handling: 3, parking: 3, durability: 3 },
    },
    suv: {
      type: 'suv', name: 'Montague Excess', class: 'Luxury SUV',
      blurb: 'Rams like a removal lorry. Turns like one too, and the sensors scream at every kerb.',
      L: 5.05, W: 2.0, H: 1.84, mass: 2450, wb: 3.0, track: 1.7, cog: 0.78,
      maxSteer: 0.5, steerRate: 2.8, F0: 12800, P: 135000, vmax: 23, vrev: 6, brakeF: 23000,
      grip: 0.95, durability: 1.25, gearDelay: 0.28, tipDV: 9.4, rearView: 0.7,
      stats: { accel: 3, ram: 5, handling: 2, parking: 1, durability: 4 },
    },
    van: {
      type: 'van', name: 'Brunswick Workhorse', class: "Tradesperson's van",
      blurb: 'Heavy, durable and no rear window. Reversing is slow and changing your mind is slower.',
      L: 5.2, W: 2.0, H: 2.25, mass: 2300, wb: 3.3, track: 1.72, cog: 0.92,
      maxSteer: 0.56, steerRate: 2.5, F0: 11200, P: 88000, vmax: 20, vrev: 4.6, brakeF: 20000,
      grip: 0.92, durability: 1.65, gearDelay: 0.55, tipDV: 8.8, rearView: 0,
      stats: { accel: 2, ram: 4, handling: 2, parking: 2, durability: 5 },
    },
  };
  LS.VEHICLE_ORDER = ['hatch', 'estate', 'suv', 'van'];

  // impulse-based tyre at a world point: cancel velocity along dir up to maxJ (N s)
  function axleImpulse(b, px, py, dx, dy, maxJ) {
    const rx = px - b.x, ry = py - b.y;
    const vx = b.vx - b.w * ry, vy = b.vy + b.w * rx;
    const u = vx * dx + vy * dy;
    const rn = rx * dy - ry * dx;
    const k = b.invM + b.invI * rn * rn;
    let J = -u / k;
    let sat = false;
    if (J > maxJ) { J = maxJ; sat = true; } else if (J < -maxJ) { J = -maxJ; sat = true; }
    b.vx += J * dx * b.invM; b.vy += J * dy * b.invM; b.w += b.invI * rn * J;
    return { J, u, sat };
  }
  LS.axleImpulse = axleImpulse;

  // residents' parked cars: handbrake on, wheels straight
  LS.residentFriction = function (b, dt) {
    if (!b.awake) return;
    const c = b.c, s = b.s, a = b.hx * 0.62, N = b.mass * G * 0.5;
    for (const sgn of [1, -1]) {
      const px = b.x + c * a * sgn, py = b.y + s * a * sgn;
      axleImpulse(b, px, py, -s, c, 0.9 * N * dt);
      axleImpulse(b, px, py, c, s, (sgn < 0 ? 0.85 : 0.08) * N * dt);
    }
  };
  // bins, cones and debris: plain ground friction
  LS.groundFriction = function (b, mu, dt) {
    if (!b.awake) return;
    const sp = Math.hypot(b.vx, b.vy), dv = mu * G * dt;
    if (sp <= dv) { b.vx = 0; b.vy = 0; } else { b.vx -= b.vx / sp * dv; b.vy -= b.vy / sp * dv; }
    const dw = mu * 12 * dt;
    b.w = Math.abs(b.w) <= dw ? 0 : b.w - Math.sign(b.w) * dw;
  };

  class Car {
    constructor(o) {
      const sp = this.spec = LS.VEHICLES[o.type];
      this.index = o.index; this.name = o.name; this.short = o.short || o.name.split(' ')[0];
      this.identity = LS.IDENTITY[o.index % LS.IDENTITY.length];
      this.human = !!o.human; this.player = o.player != null ? o.player : -1;
      this.paint = o.paint || '#888';
      this.home = o.home || null;
      this.body = new LS.Physics.Body({ shape: 'box', x: o.x, y: o.y, a: o.a, hx: sp.L / 2, hy: sp.W / 2, mass: sp.mass, inertia: sp.mass * (sp.L * sp.L + sp.W * sp.W) / 12 * 1.15, kind: 'car', friction: 0.32, restitution: 0.14, waker: true });
      this.body.user = { car: this };
      this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0, horn: 0, recover: 0 };
      this.steerAngle = 0; this.gear = 1; this.gearTimer = 0;
      this.damage = { front: 0, rear: 0, left: 0, right: 0, total: 0 };
      this.parts = { bumperF: true, bumperR: true, hl: true, hr: true, tl: true, tr: true };
      this.dents = []; this.scrapes = []; this.fx = []; // queues for renderer/audio
      this.overturned = false; this.overT = 0;
      this.roll = 0; this.rollV = 0; this.pitch = 0; this.pitchV = 0; this.heave = 0;
      this.wheelSpin = 0; this.skid = [0, 0]; this.smoke = 0;
      this.stuckT = 0; this.recoverHold = 0; this.recovering = false; this.canRecover = false;
      this.status = 'active';
      this.hornT = 0; this.hornCount = 0;
      this.lastHitBy = null; this.lastHitT = -99;
      this.wheelH = [0, 0, 0, 0];
      this.kerbBump = 0;
      this.stats = { hits: 0, bins: 0, biggest: 0, dealt: 0, taken: 0, horn: 0, gearChanges: 0, parkedTime: 0, parks: 0, dislodged: 0, dislodgedOthers: 0, recoveries: 0, residents: 0, pavement: 0, firstPark: null };
      this.park = { space: null, progress: 0, parked: false, best: 0 };
    }
    get x() { return this.body.x; } get y() { return this.body.y; } get a() { return this.body.a; }
    get speed() { return Math.hypot(this.body.vx, this.body.vy); }
    get forward() { return this.body.vx * this.body.c + this.body.vy * this.body.s; }

    step(dt, arena, time) {
      const b = this.body, sp = this.spec, inp = this.input;
      if (!b.enabled) return;
      const c = b.c, s = b.s;
      const vF = b.vx * c + b.vy * s;
      const speed = Math.hypot(b.vx, b.vy);
      const dmg = this.damage;
      let thr = U.clamp(inp.throttle, 0, 1), brk = U.clamp(inp.brake, 0, 1), st = U.clamp(inp.steer, -1, 1), hb = inp.handbrake ? 1 : 0;
      if (this.overturned || this.recovering) { thr = 0; brk = 0; st = 0; hb = 0; }

      // ---- gearbox: brake to a stop then keep holding to reverse
      if (this.gear === 1) {
        if (brk > 0.1 && thr < 0.1 && vF < 0.5) { this.gearTimer += dt; if (this.gearTimer > sp.gearDelay) { this.gear = -1; this.gearTimer = 0; this.stats.gearChanges++; } }
        else this.gearTimer = 0;
      } else {
        if (thr > 0.1 && brk < 0.1 && vF > -0.5) { this.gearTimer += dt; if (this.gearTimer > sp.gearDelay) { this.gear = 1; this.gearTimer = 0; this.stats.gearChanges++; } }
        else this.gearTimer = 0;
      }
      let drive = 0, brake = 0;
      if (this.gear === 1) { drive = thr; brake = brk; } else { drive = -brk; brake = thr; }

      // ---- steering (speed-sensitive, damaged front pulls to one side)
      const frontD = dmg.front, sideBias = (dmg.left - dmg.right);
      const lock = sp.maxSteer * (1 - 0.18 * frontD) * (1 - 0.6 * U.clamp(speed / 22, 0, 1));
      const pull = sideBias * frontD * 0.08 + sideBias * 0.02;
      const target = st * lock + (speed > 1 ? pull : 0);
      this.steerAngle = U.approach(this.steerAngle, target, sp.steerRate * dt * (Math.abs(target) < Math.abs(this.steerAngle) ? 1.6 : 1));

      // ---- surface under each wheel (kerb field): wheels up on the pavement sit 12 cm higher
      const ha = sp.wb / 2, ht = sp.track / 2;
      let onPave = 0;
      const wp = [[ha, ht], [ha, -ht], [-ha, ht], [-ha, -ht]];
      for (let i = 0; i < 4; i++) {
        const wx = b.x + c * wp[i][0] - s * wp[i][1], wy = b.y + s * wp[i][0] + c * wp[i][1];
        const g = arena.kerb(wx, wy);
        const h = g > 0.08 ? 0.12 : g > -0.05 ? 0.12 * (g + 0.05) / 0.13 : 0;
        if (h > 0.06) onPave++;
        if (Math.abs(h - this.wheelH[i]) > 0.06) this.kerbBump = Math.max(this.kerbBump, Math.min(1, speed / 8));
        this.wheelH[i] = h;
        // kerb lip resists slow sideways shoves (cars get pinned against it); fast or square-on, you mount it
        if (g > -0.15 && g < 0.4 && !this.overturned) {
          const [gx, gy] = arena.kerbGrad(wx, wy);
          const vx = b.vx - b.w * (wy - b.y), vy = b.vy + b.w * (wx - b.x);
          const vn = vx * gx + vy * gy;
          const headOn = Math.abs(c * gx + s * gy);
          if (vn > 0 && vn < 3.4 && headOn < 0.75) {
            axleImpulse(b, wx, wy, gx, gy, 0.22 * sp.mass * G * dt);
          }
          // tripped over the kerb sideways at speed
          if (vn > 8.5 && headOn < 0.4 && !this.overturned) this.tip(time, 'kerb');
        }
      }
      if (onPave >= 2) this.stats.pavement += dt;
      const surfaceGrip = onPave >= 3 ? 0.9 : 1;

      // ---- drive
      const N = sp.mass * G * 0.5;
      const powerK = (1 - 0.28 * U.clamp(dmg.total * 1.3, 0, 1));
      const vmax = (this.gear === 1 ? sp.vmax : sp.vrev) * (1 - 0.15 * dmg.total);
      const vAbs = Math.abs(vF);
      let F = Math.min(sp.F0, sp.P / Math.max(vAbs, 0.5)) * powerK;
      if (this.gear === -1) F *= 0.75;
      F *= U.clamp(1 - Math.pow(vAbs / vmax, 4), 0, 1);
      if ((drive > 0 && vF < -0.5) || (drive < 0 && vF > 0.5)) F = 0; // gearbox will handle it
      F = Math.min(F, sp.grip * N * 1.6);
      if (!this.overturned) {
        const Fx = c * F * drive, Fy = s * F * drive;
        b.vx += Fx * b.invM * dt; b.vy += Fy * b.invM * dt;
      }

      // ---- tyres
      const hold = Math.abs(drive) < 0.05 && brake < 0.05 && speed < 0.7 && !this.overturned && !this.noHold; // auto handbrake when stopped
      const fd = this.steerAngle, cf = Math.cos(b.a + fd), sf = Math.sin(b.a + fd);
      const fx = b.x + c * ha, fy = b.y + s * ha, rx = b.x - c * ha, ry = b.y - s * ha;
      const mu = sp.grip * surfaceGrip;
      if (this.overturned) {
        // sliding on its side: just heavy friction
        LS.groundFriction(b, 0.55, dt);
        this.skid[0] = this.skid[1] = 0;
      } else {
        // longitudinal: brakes, handbrake, rolling resistance
        const roll = (onPave >= 2 ? 0.05 : 0.015) * N * dt;
        const brF = brake * sp.brakeF * dt;
        const rearLock = hb || hold;
        const lf = axleImpulse(b, fx, fy, cf, sf, Math.min(mu * N * dt, brF * 0.55 + roll + (hold ? mu * N * dt : 0)));
        const lr = axleImpulse(b, rx, ry, c, s, Math.min(mu * N * dt, brF * 0.45 + roll + (rearLock ? mu * N * dt * 0.95 : 0)));
        // lateral grip: friction circle shares grip with braking
        const usedF = Math.abs(lf.J) / (mu * N * dt + 1e-9), usedR = Math.abs(lr.J) / (mu * N * dt + 1e-9);
        const latF = mu * N * dt * Math.sqrt(Math.max(0.05, 1 - usedF * usedF * 0.7));
        let latR = mu * N * dt * Math.sqrt(Math.max(0.05, 1 - usedR * usedR * 0.7));
        if (hb && speed > 2) {
          latR *= 0.2;
          // arcade kick: a handbrake with lock on swings the tail out properly
          b.w += Math.sign(this.steerAngle) * Math.min(1, Math.abs(this.steerAngle) / 0.3) * 3.2 * dt * Math.min(1, speed / 9) * Math.sign(vF || 1);
        }
        const tf = axleImpulse(b, fx, fy, -sf, cf, latF);
        const tr = axleImpulse(b, rx, ry, -s, c, latR);
        this.skid[0] = tf.sat && Math.abs(tf.u) > 1.6 ? Math.min(1, Math.abs(tf.u) / 8) : (lf.sat && Math.abs(lf.u) > 2 ? 0.6 : 0);
        this.skid[1] = tr.sat && Math.abs(tr.u) > 1.6 ? Math.min(1, Math.abs(tr.u) / 8) : (lr.sat && Math.abs(lr.u) > 2 ? 0.6 : 0);
        // aero drag
        const drag = 0.42 * speed * dt * b.invM;
        b.vx -= b.vx * drag; b.vy -= b.vy * drag;
      }
      // yaw damping (keeps the arcade feel stable)
      b.w *= 1 - Math.min(0.5, (this.overturned ? 3 : hb ? 0.15 : 0.6) * dt);

      // ---- visual suspension: pitch from acceleration, roll from cornering
      const aLong = (vF - (this._vF || 0)) / dt; this._vF = vF;
      const latAcc = vF * b.w;
      this.pitchV += (-aLong * 0.006 - this.pitch * 60 - this.pitchV * 9) * dt;
      this.pitch += this.pitchV * dt;
      if (!this.overturned) {
        this.rollV += (latAcc * 0.004 * sp.cog - this.roll * 55 - this.rollV * 8) * dt;
        this.roll += this.rollV * dt;
      }
      this.kerbBump = Math.max(0, this.kerbBump - dt * 3);
      this.wheelSpin += vF * dt / 0.33;

      // ---- horn
      if (inp.horn && this.hornT <= 0) { this.hornT = 0.01; this.hornCount++; this.stats.horn++; this.fx.push({ type: 'horn' }); }
      if (!inp.horn) this.hornT = 0; else this.hornT += dt;

      // ---- stuck / overturned -> recovery offered
      const pushing = Math.abs(drive) > 0.3 || brake > 0.3;
      if (pushing && speed < 0.45 && (b.touching > 0 || onPave >= 2)) this.stuckT += dt;
      else if (speed > 1.2) this.stuckT = Math.max(0, this.stuckT - dt * 2);
      if (this.overturned) this.overT += dt;
      this.canRecover = this.overturned ? this.overT > 0.8 : this.stuckT > 2.5;
    }

    // a hit from the physics solver; dv = velocity change of this car, (nx,ny) points into this car
    takeHit(ev, dv, nx, ny, other, time) {
      const b = this.body, sp = this.spec;
      const [lx, ly] = b.toLocal(ev.x, ev.y);
      const zone = lx > sp.L * 0.27 ? 'front' : lx < -sp.L * 0.27 ? 'rear' : (ly > 0 ? 'left' : 'right');
      const severity = Math.max(0, dv - 1.0);
      const add = severity * severity * 0.011 / sp.durability;
      if (add > 0.0005) {
        this.damage[zone] = Math.min(1, this.damage[zone] + add);
        if (zone === 'front' || zone === 'rear') this.damage[ly > 0 ? 'left' : 'right'] = Math.min(1, this.damage[ly > 0 ? 'left' : 'right'] + add * 0.25);
        const d = this.damage; d.total = Math.min(1, (d.front * 1.2 + d.rear + d.left + d.right) / 3.2);
        this.stats.taken += add;
      }
      if (dv > 1.3) {
        // local direction of the push for the panel deformation
        const lnx = b.c * nx + b.s * ny, lny = -b.s * nx + b.c * ny;
        this.dents.push({ lx, ly, nx: lnx, ny: lny, depth: Math.min(0.32, (dv - 1.0) * 0.045 / Math.sqrt(sp.durability)), zone });
      }
      if (dv > 2.6) {
        if (zone === 'front') { if (ly >= 0 && this.parts.hl) { this.parts.hl = false; this.fx.push({ type: 'glass', lx, ly }); } if (ly <= 0 && this.parts.hr) { this.parts.hr = false; this.fx.push({ type: 'glass', lx, ly }); } }
        if (zone === 'rear') { if (ly >= 0 && this.parts.tl) { this.parts.tl = false; this.fx.push({ type: 'glass', lx, ly }); } if (ly <= 0 && this.parts.tr) { this.parts.tr = false; this.fx.push({ type: 'glass', lx, ly }); } }
      }
      if (zone === 'front' && this.parts.bumperF && this.damage.front > 0.42 && dv > 2.2) { this.parts.bumperF = false; this.fx.push({ type: 'bumper', end: 1 }); }
      if (zone === 'rear' && this.parts.bumperR && this.damage.rear > 0.42 && dv > 2.2) { this.parts.bumperR = false; this.fx.push({ type: 'bumper', end: -1 }); }
      if (ev.slide > 2.5 && ev.J > 0) this.scrapes.push({ lx, ly, len: Math.min(1.2, ev.slide * 0.12) });
      // side impacts can tip tall vehicles over
      const lat = Math.abs(-b.s * nx + b.c * ny) * dv;
      this.rollV += U.sign(-b.s * nx + b.c * ny) * Math.min(dv, 9) * 0.5 * (sp.cog / 0.6);
      if (lat > sp.tipDV && !this.overturned) this.tip(time, 'impact');
      this.pitchV += (b.c * nx + b.s * ny) * Math.min(dv, 9) * 0.25;
      if (other) { this.lastHitBy = other; this.lastHitT = time; }
      this.stats.hits++;
      this.stats.biggest = Math.max(this.stats.biggest, dv);
    }
    tip(time, why) {
      this.overturned = true; this.overT = 0; this.tipSide = this.rollV >= 0 ? 1 : -1;
      this.fx.push({ type: 'overturn', why });
    }

    // recovery: hold the button; the car is vulnerable (no control, hazards flashing) while it happens.
    // Never places the car on or next to a scoring space.
    updateRecovery(dt, arena, world, wantsHold) {
      if (this.recovering) {
        this.recoverHold += dt;
        if (this.recoverHold >= (this.spec.type === 'van' ? 2.4 : 1.6)) {
          this.recovering = false; this.recoverHold = 0;
          return this.placeSafely(arena, world);
        }
        return null;
      }
      if (wantsHold && this.canRecover) { this.recovering = true; this.recoverHold = 0; this.fx.push({ type: 'recover' }); }
      return null;
    }
    placeSafely(arena, world) {
      const b = this.body, sp = this.spec;
      const cands = [];
      for (const e of arena.nav.edges) {
        if (e.street === 'Grange Court') continue;
        for (let s = 3; s < e.length - 3; s += 2) {
          const p = e.line.at(s); const d = Math.hypot(p.x - b.x, p.y - b.y);
          if (d < 90) cands.push({ p, d, e });
        }
      }
      cands.sort((u, v) => u.d - v.d);
      const inSpace = (x, y, a) => {
        const probe = { x, y, c: Math.cos(a), s: Math.sin(a), hx: sp.L / 2 + 1.2, hy: sp.W / 2 + 1.0 };
        for (const q of arena.spaces) if (LS.Physics.collideBoxBox(probe, { x: q.x, y: q.y, c: q.c, s: q.s_, hx: q.hl, hy: q.hw })) return true;
        return false;
      };
      for (const cd of cands) {
        const p = cd.p;
        let a = p.heading;
        if (Math.cos(a - b.a) < 0) a += Math.PI;
        if (inSpace(p.x, p.y, a)) continue;
        if (world.overlapsBox(p.x, p.y, a, sp.L / 2 + 0.5, sp.W / 2 + 0.35, (o) => o !== b && o.kind !== 'bin' && o.kind !== 'debris', true)) continue;
        if (arena.kerb(p.x, p.y) > -1.5) continue;
        b.x = p.x; b.y = p.y; b.setAngle(a); b.vx = b.vy = b.w = 0;
        this.overturned = false; this.roll = 0; this.rollV = 0; this.stuckT = 0; this.canRecover = false; this.gear = 1;
        this.stats.recoveries++;
        this.fx.push({ type: 'recovered' });
        return { x: p.x, y: p.y };
      }
      return null;
    }
  }
  LS.Car = Car;
})(window.LS);
