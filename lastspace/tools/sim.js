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
      for (const seed of [1, 2]) {
        const r = soloPark(t, sp, seed + sp.id * 7);
        n++; if (r.ok) { ok++; tsum += r.t; } else fails.push(`${sp.label}(${sp.kind})s${seed}:${r.state} out ${r.measure.out.toFixed(2)} ang ${(r.measure.align * 57.3).toFixed(0)}`);
      }
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

process.exitCode = failures ? 1 : 0;
if (failures) console.log(failures + ' failure(s)');
