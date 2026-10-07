// Debug: trace one solo bot parking attempt and draw it on the map.  node tools/trace.js TYPE "SPACE LABEL" SEED out.svg
const { load } = require('./load');
const LS = load();
const [type, label, seed, out] = process.argv.slice(2);
const A = new LS.Arena(1);
const sp = A.spaces.find((s) => s.label === label);
const U = LS.U;
const m = new LS.Match({ seed: +seed, arena: A, mode: 'test', botCount: 0, players: [] });
const car = new LS.Car({ index: 0, type, name: 'Test', x: 0, y: 0, a: 0 });
m.addCar(car);
const ap = sp.access, e = ap.edge; const sd = +seed + sp.id * 7;
let s = ap.s + 35 * ((sd & 1) ? 1 : -1); if (s < 5 || s > e.length - 5) s = ap.s + 35 * ((sd & 1) ? -1 : 1); s = U.clamp(s, 4, e.length - 4);
const p = e.line.at(s); car.body.x = p.x; car.body.y = p.y; car.body.setAngle(p.heading + ((sd & 2) ? Math.PI : 0));
const bot = new LS.Bot(car, m, 'nearest', U.rng(sd), 'normal'); car.bot = bot; m.bots.push(bot); bot.reaction = 0;
for (const st of m.parking.spaces) st.status = st.sp === sp ? 'active' : 'idle';
m.phase = 'battle'; m.battleLen = 1e9; m.spacesThisRound = 1; bot.lastPhase = 'battle'; bot.state = 'choose';
const trail = [], events = []; let lastState = '';
for (let t = 0; t < 60; t += 1 / 120) {
  m.substep(1 / 120);
  if (m.stepN % 12 === 0) trail.push([car.x, car.y, car.a, bot.state, car.gear]);
  const stt = bot.state + (bot.turn ? '+turn' : '');
  if (stt !== lastState) { events.push(`${t.toFixed(1)} ${stt} @(${car.x.toFixed(1)},${car.y.toFixed(1)}) v=${car.forward.toFixed(1)}`); lastState = stt; }
  if (car.park.parked) { events.push('PARKED ' + t.toFixed(1)); break; }
}
console.log(events.join('\n'));
const mm = m.parking.measure(car, sp); console.log('final out', mm.out.toFixed(2), 'align', (mm.align * 57.3).toFixed(1), 'lx', mm.lx.toFixed(2), 'ly', mm.ly.toFixed(2));
// draw a 70 m window around the space
const W = 70, S = 12, x0 = sp.x - W / 2, y1 = sp.y + W / 2;
const tx = (x) => ((x - x0) * S).toFixed(1), ty = (y) => ((y1 - y) * S).toFixed(1);
const pl = (pts, st) => `<polyline points="${pts.map((q) => tx(q[0]) + ',' + ty(q[1])).join(' ')}" ${st}/>`;
const box = (x, y, a, hl, hw, st) => { const c = Math.cos(a), s = Math.sin(a); const P = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([u, v]) => [x + c * u * hl - s * v * hw, y + s * u * hl + c * v * hw]); return pl(P.concat([P[0]]), st); };
let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${W * S}"><rect width="100%" height="100%" fill="#bdb"/>`;
for (const l of A.wallLines) o += pl(l, 'fill="none" stroke="#a33" stroke-width="3"');
for (const l of A.kerbLines) o += pl(l, 'fill="none" stroke="#444" stroke-width="2"');
for (const b of m.world.bodies) if (b.kind === 'parked') o += box(b.x, b.y, b.a, b.hx, b.hy, 'fill="#999" stroke="#222"');
o += box(sp.x, sp.y, sp.a, sp.hl, sp.hw, 'fill="#ff0" fill-opacity="0.5" stroke="#f00" stroke-width="2"');
if (bot.plan) o += pl(bot.plan.pts, 'fill="none" stroke="#f0f" stroke-width="2"') + `<circle cx="${tx(bot.plan.start[0])}" cy="${ty(bot.plan.start[1])}" r="5" fill="#f0f"/>`;
for (let i = 0; i < trail.length; i += 2) { const q = trail[i]; o += box(q[0], q[1], q[2], car.spec.L / 2, car.spec.W / 2, `fill="none" stroke="${q[4] < 0 ? '#00f' : '#0a0'}" stroke-opacity="0.5"`); }
o += box(car.x, car.y, car.a, car.spec.L / 2, car.spec.W / 2, 'fill="#f80" fill-opacity="0.6" stroke="#000" stroke-width="2"');
o += '</svg>';
require('fs').writeFileSync(out, o);
