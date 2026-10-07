#!/usr/bin/env node
/* LAST SPACE - headless checks (no browser): node tools/sim.js [--fit] [--park] [--match N] [--seed S]
   --fit    every contestant vehicle fits every scoring space (static geometry, with margins)
   --park   a bot in each vehicle parks in each space on its own (physics, real controls)
   --match  N complete eight-bot matches: duration, rounds, winner, parks, recoveries */
const { load } = require('./load');
const LS = load();
const args = process.argv.slice(2);
const has = (k) => args.includes(k);
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const U = LS.U;
let failures = 0;

const arena = new LS.Arena(1);

if (has('--fit')) {
  console.log('== fit: every vehicle in every space (centred, aligned) ==');
  for (const t of LS.VEHICLE_ORDER) {
    const v = LS.VEHICLES[t];
    let worst = 1e9, worstSp = null;
    for (const sp of arena.spaces) {
      const slackL = sp.hl * 2 - v.L, slackW = sp.hw * 2 - v.W;
      // largest heading error that still fits when centred
      let maxAng = 0;
      for (let a = 0; a < 0.5; a += 0.002) {
        const ex = v.L / 2 * Math.cos(a) + v.W / 2 * Math.sin(a), ey = v.L / 2 * Math.sin(a) + v.W / 2 * Math.cos(a);
        if (ex <= sp.hl + LS.Parking.EDGE_TOL && ey <= sp.hw + LS.Parking.EDGE_TOL) maxAng = a; else break;
      }
      const ok = slackL > 0.2 && slackW > 0.2 && maxAng > 0.03;
      if (!ok) { failures++; console.log('  FAIL', t, sp.label, sp.kind, slackL.toFixed(2), slackW.toFixed(2)); }
      if (Math.min(slackL, slackW) < worst) { worst = Math.min(slackL, slackW); worstSp = sp.label + ' (' + sp.kind + ', ' + (maxAng * 180 / Math.PI).toFixed(1) + ' deg tolerance)'; }
    }
    console.log(`  ${t.padEnd(7)} L ${v.L} W ${v.W}: tightest margin ${worst.toFixed(2)} m in ${worstSp}`);
  }
  // spaces must lie on the carriageway and be clear of residents' cars
  for (const sp of arena.spaces) {
    for (const [x, y] of sp.corners) if (arena.wall(x, y) > -0.3) { failures++; console.log('  FAIL space crosses wall', sp.label); }
    for (const s of arena.slots) {
      const P = { x: sp.x, y: sp.y, c: sp.c, s: sp.s_, hx: sp.hl, hy: sp.hw }, Q = { x: s.x, y: s.y, c: Math.cos(s.a), s: Math.sin(s.a), hx: s.L / 2, hy: s.W / 2 };
      if (LS.Physics.collideBoxBox(P, Q)) { failures++; console.log('  FAIL resident car in space', sp.label); }
    }
  }
}

function soloPark(type, sp, seed, opts) {
  // one bot, one live space, everything else as in a match
  const m = new LS.Match({ seed, arena, mode: 'test', botCount: 0, players: [] });
  const car = new LS.Car({ index: 0, type, name: 'Test', x: 0, y: 0, a: 0 });
  m.addCar(car);
  // start on the street 30-45 m away
  const ap = sp.access, e = ap.edge;
  let s = ap.s + (opts && opts.from ? opts.from : 35) * ((seed & 1) ? 1 : -1);
  if (s < 5 || s > e.length - 5) s = ap.s + 35 * ((seed & 1) ? -1 : 1);
  s = U.clamp(s, 4, e.length - 4);
  const p = e.line.at(s);
  car.body.x = p.x; car.body.y = p.y; car.body.setAngle(p.heading + ((seed & 2) ? Math.PI : 0));
  const bot = new LS.Bot(car, m, 'nearest', U.rng(seed), 'normal'); car.bot = bot; m.bots.push(bot);
  bot.reaction = 0;
  for (const st of m.parking.spaces) st.status = st.sp === sp ? 'active' : 'idle';
  m.phase = 'battle'; m.timeLeft = 99; m.battleLen = 1e9; m.spacesThisRound = 1;
  bot.lastPhase = 'battle'; bot.state = 'choose';
  let t = 0;
  while (t < 60) {
    m.substep(1 / 120); t += 1 / 120;
    if (car.park.parked) return { ok: true, t, car, m };
  }
  return { ok: false, t, car, m, state: bot.state, measure: m.parking.measure(car, sp) };
}

if (has('--park')) {
  console.log('== park: one bot per vehicle per space ==');
  const only = val('--only', null);
  const tally = {};
  for (const t of LS.VEHICLE_ORDER) {
    let ok = 0, n = 0, tsum = 0; const fails = [];
    for (const sp of arena.spaces) {
      if (only && !sp.label.includes(only)) continue;
      let any = false;
      for (const seed of [1, 2]) {
        const r = soloPark(t, sp, seed + sp.id * 7);
        n++; if (r.ok) { ok++; tsum += r.t; any = true; } else fails.push(`${sp.label}(${sp.kind})s${seed}:${r.state} out ${r.measure.out.toFixed(2)} ang ${(r.measure.align * 57.3).toFixed(0)}`);
      }
      // physically possible for every vehicle: keep trying other approaches until one works
      for (let seed = 3; !any && seed < 11; seed++) { const r = soloPark(t, sp, seed + sp.id * 7); if (r.ok) any = true; }
      if (!any) { failures++; fails.push('NEVER PARKED IN ' + sp.label); }
    }
    tally[t] = ok / n;
    console.log(`  ${t.padEnd(7)} ${ok}/${n} parked, mean ${(tsum / Math.max(ok, 1)).toFixed(1)} s`);
    if (fails.length) console.log('     fails: ' + fails.join('; '));
  }
}

if (has('--match')) {
  const N = +val('--match', 3), seed0 = +val('--seed', 100);
  console.log(`== ${N} eight-bot matches ==`);
  for (let k = 0; k < N; k++) {
    const t0 = Date.now();
    const m = new LS.Match({ seed: seed0 + k, arena, mode: 'test', botCount: 8, players: [], difficulty: 'normal' });
    const log = [];
    let parks = 0, dislodged = 0, impacts = 0, big = 0, remarks = 0;
    m.on('parked', () => parks++); m.on('dislodged', () => dislodged++);
    m.on('impact', (d) => { impacts++; if (d.severity > 6) big++; });
    m.on('remark', () => remarks++);
    m.on('phase', (d) => { if (d.phase === 'circulation' || d.phase === 'sudden') log.push(`${d.phase === 'sudden' ? 'SD' : 'R' + d.round}:${d.drivers}d/${d.spaces}s`); });
    m.on('horn', () => { log.push(`horn@${(m.time / 60).toFixed(1)}m parked ${m.alive.filter((c) => c.park.parked).length}`); });
    m.start();
    while (m.phase !== 'results' && m.time < 20 * 60) m.step(1 / 30);
    const res = m.phase === 'results' ? m.results() : null;
    const recov = m.cars.reduce((n, c) => n + c.stats.recoveries, 0);
    const ok = !!res && m.time < 12 * 60;
    if (!ok) failures++;
    console.log(`  match ${k} seed ${seed0 + k}: ${ok ? 'OK' : 'FAIL'} ${(m.time / 60).toFixed(2)} min, ${m.round} rounds, winner ${res && res.winner ? res.winner.name + ' (' + res.winner.spec.type + ', ' + res.winner.bot.kind + ')' : '-'}${res && res.technicality ? ' (technicality)' : ''}; parks ${parks}, dislodged ${dislodged}, impacts ${impacts} (${big} big), recoveries ${recov}, remarks ${remarks}; sim ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    console.log('     ' + log.join(' | '));
  }
}

if (has('--rules')) {
  console.log('== parking rules and collisions ==');
  const check = (name, ok, extra) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' (' + extra + ')' : ''}`); if (!ok) failures++; };
  const setup = (type, dx, da) => {
    const m = new LS.Match({ seed: 9, arena, mode: 'test', botCount: 0, players: [] });
    const sp = arena.spaces.find((s) => s.kind === 'wide');
    const car = new LS.Car({ index: 0, type, name: 'T', x: sp.x + Math.cos(sp.a) * (dx || 0), y: sp.y + Math.sin(sp.a) * (dx || 0), a: sp.a + (da || 0) });
    m.addCar(car);
    for (const st of m.parking.spaces) st.status = st.sp === sp ? 'active' : 'idle';
    // clear residents' cars from round the space so the test cars have room
    for (const b of m.world.bodies) if (b.kind === 'parked' && Math.hypot(b.x - sp.x, b.y - sp.y) < 11) b.enabled = false;
    m.phase = 'battle'; m.battleLen = 1e9;
    return { m, car, sp };
  };
  const run = (m, s, fn) => { for (let t = 0; t < s; t += 1 / 120) { if (fn) fn(t); m.substep(1 / 120); } };
  { const { m, car } = setup('hatch'); run(m, 1.5); check('not parked before 2 s', !car.park.parked, 'progress ' + car.park.progress.toFixed(2)); run(m, 0.7); check('parked after 2 s below walking pace', car.park.parked); }
  { const { m, car } = setup('hatch', 0, 0.4); run(m, 3); check('23 deg off the kerb line is not parked', !car.park.parked, car.park.hint); }
  { const { m, car, sp } = setup('estate', sp0 => 0); run(m, 0, () => {}); car.body.x += Math.cos(arena.spaces.find((s) => s.kind === 'wide').a) * 1.6; run(m, 3); check('estate overhanging the end line is not parked', !car.park.parked, 'out ' + (car.park.measure ? car.park.measure.out.toFixed(2) : '?') + ' m'); }
  { const { m, car } = setup('hatch'); car.input.throttle = 1; run(m, 3); check('driving through at speed never parks', !car.park.parked); }
  // shove a parked hatch with an SUV: a nudge keeps it, a proper shove ends it
  for (const [label, speed, expectOut] of [['gentle 1 m/s nudge from behind', 1.0, false], ['12 m/s side ram by an SUV', 12, true]]) {
    const { m, car, sp } = setup('hatch'); run(m, 2.3);
    const side = expectOut;
    const suv = new LS.Car({ index: 1, type: 'suv', name: 'S', x: 0, y: 0, a: 0 });
    m.addCar(suv);
    const ax = Math.cos(sp.a), ay = Math.sin(sp.a), nx = -ay, ny = ax;
    // approach from the lane side (towards the kerb) or from behind
    const lane = (sp.access.x - sp.x) * nx + (sp.access.y - sp.y) * ny > 0 ? 1 : -1;
    if (side) { suv.body.x = sp.x + nx * lane * 4.0 + ax * 1.2; suv.body.y = sp.y + ny * lane * 4.0 + ay * 1.2; suv.body.setAngle(Math.atan2(-ny * lane, -nx * lane)); }
    else { suv.body.x = sp.x - ax * 5.3; suv.body.y = sp.y - ay * 5.3; suv.body.setAngle(sp.a); }
    suv.body.vx = Math.cos(suv.body.a) * speed; suv.body.vy = Math.sin(suv.body.a) * speed;
    let lost = false; m.on('dislodged', (d) => { if (d.car === car) lost = true; });
    run(m, 2.5, () => { suv.input.throttle = side ? 1 : 0; });
    check(label + (expectOut ? ' dislodges' : ' keeps the park'), expectOut ? lost && !car.park.parked : car.park.parked, 'hatch dv ' + car.stats.biggest.toFixed(1) + ' m/s');
  }
}

if (has('--impacts')) {
  console.log('== impacts depend on mass, speed and angle ==');
  const W = () => { const w = new LS.Physics.World(); return w; };
  const pair = (ta, tb, speed, layout) => {
    const w = W(), a = new LS.Car({ index: 0, type: ta, name: 'A', x: 0, y: 0, a: 0 }), b = new LS.Car({ index: 1, type: tb, name: 'B', x: 0, y: 0, a: 0 });
    w.add(a.body); w.add(b.body);
    const flat = { kerb: () => -5, kerbGrad: () => [0, 1] };
    if (layout === 'tbone') { a.body.x = -6; b.body.x = 0; b.body.y = 0; b.body.setAngle(Math.PI / 2); }
    if (layout === 'headon') { a.body.x = -6; b.body.x = 6; b.body.setAngle(Math.PI); b.body.vx = -speed; }
    if (layout === 'corner') { a.body.x = -6; a.body.y = 0; b.body.x = 0; b.body.y = 1.7; b.body.setAngle(Math.PI / 2); }
    a.body.vx = speed;
    let worst = { a: 0, b: 0 };
    for (let t = 0; t < 1.5; t += 1 / 120) {
      a.step(1 / 120, flat, t); b.step(1 / 120, flat, t);
      w.step(1 / 120);
      for (const ev of w.events) {
        if (ev.A === a.body) a.takeHit(ev, ev.dvA, -ev.nx, -ev.ny, b, t); if (ev.B === a.body) a.takeHit(ev, ev.dvB, ev.nx, ev.ny, b, t);
        if (ev.A === b.body) b.takeHit(ev, ev.dvA, -ev.nx, -ev.ny, a, t); if (ev.B === b.body) b.takeHit(ev, ev.dvB, ev.nx, ev.ny, a, t);
        if (ev.A === a.body || ev.B === a.body) worst.a = Math.max(worst.a, ev.A === a.body ? ev.dvA : ev.dvB); if (ev.A === b.body || ev.B === b.body) worst.b = Math.max(worst.b, ev.A === b.body ? ev.dvA : ev.dvB); }
    }
    return { a, b, worst, bMoved: Math.hypot(b.body.x - (layout === 'headon' ? 6 : 0), b.body.y - (layout === 'corner' ? 1.7 : 0)), bSpin: Math.abs(b.body.a - (layout === 'headon' ? Math.PI : Math.PI / 2)) };
  };
  const r1 = pair('suv', 'hatch', 10, 'tbone'), r2 = pair('hatch', 'suv', 10, 'tbone');
  console.log(`  SUV T-bones hatch at 10 m/s: hatch shoved ${r1.bMoved.toFixed(1)} m, hatch dv ${r1.worst.b.toFixed(1)}, SUV dv ${r1.worst.a.toFixed(1)}`);
  console.log(`  hatch T-bones SUV at 10 m/s: SUV shoved ${r2.bMoved.toFixed(1)} m, SUV dv ${r2.worst.b.toFixed(1)}, hatch dv ${r2.worst.a.toFixed(1)}`);
  if (!(r1.bMoved > r2.bMoved * 1.8)) failures++;
  const s5 = pair('estate', 'estate', 5, 'tbone'), s15 = pair('estate', 'estate', 15, 'tbone');
  console.log(`  estate into estate: 5 m/s shoves ${s5.bMoved.toFixed(1)} m, 15 m/s shoves ${s15.bMoved.toFixed(1)} m; damage ${s5.b.damage.total.toFixed(2)} vs ${s15.b.damage.total.toFixed(2)}`);
  if (!(s15.bMoved > s5.bMoved * 2 && s15.b.damage.total > s5.b.damage.total * 3)) failures++;
  const c = pair('estate', 'estate', 10, 'corner'), t = pair('estate', 'estate', 10, 'tbone');
  console.log(`  rear-corner hit spins the victim ${(c.bSpin * 57.3).toFixed(0)} deg vs centre hit ${(t.bSpin * 57.3).toFixed(0)} deg`);
  if (!(c.bSpin > t.bSpin + 0.3)) failures++;
  const h = pair('estate', 'estate', 9, 'headon');
  console.log(`  head-on at 9 + 9 m/s: both stop (A ${Math.abs(h.a.forward).toFixed(1)} m/s after), dv ${h.worst.a.toFixed(1)} m/s, front damage ${h.a.damage.front.toFixed(2)}, bumper ${h.a.parts.bumperF ? 'on' : 'off'}`);
  if (!(h.worst.a > 7)) failures++;
}

process.exitCode = failures ? 1 : 0;
if (failures) console.log(failures + ' failure(s)');
