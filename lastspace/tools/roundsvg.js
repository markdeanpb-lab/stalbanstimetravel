// Debug: draw every bot's path during round N's battle.  node tools/roundsvg.js SEED ROUND out.svg
const { load } = require('./load');
const LS = load();
const [seed, round, out] = [+process.argv[2] || 100, +process.argv[3] || 1, process.argv[4] || 'round.svg'];
const A = new LS.Arena(1);
const m = new LS.Match({ seed, arena: A, mode: 'test', botCount: 8, players: [] });
const tr = new Map(), marks = [];
m.start();
let lastState = new Map();
while (m.phase !== 'results' && !(m.round === round && m.phase === 'horn')) {
  m.step(1 / 30);
  if (m.round === round && m.phase === 'battle') for (const b of m.bots) {
    if (b.car.status !== 'active') continue;
    if (!tr.has(b)) tr.set(b, []);
    tr.get(b).push([b.car.x, b.car.y, b.state]);
    const st = b.state + (b.revLeg ? 'R' : '') + (b.turn ? 'T' : '');
    if (lastState.get(b) !== st) { marks.push([b.car.x, b.car.y, b.car.short[0] + ':' + st + '@' + m.phaseT.toFixed(0)]); lastState.set(b, st); }
  }
}
const S = 3, X0 = A.gx0, Y1 = A.gy0 + A.gh * A.gres;
const tx = (x) => ((x - X0) * S).toFixed(1), ty = (y) => ((Y1 - y) * S).toFixed(1);
const pl = (pts, st) => `<polyline points="${pts.map((p) => tx(p[0]) + ',' + ty(p[1])).join(' ')}" ${st}/>`;
let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${A.gw * A.gres * S}" height="${A.gh * A.gres * S}"><rect width="100%" height="100%" fill="#eee"/>`;
for (const l of A.kerbLines) o += pl(l, 'fill="none" stroke="#999" stroke-width="1"');
const box = (x, y, a, hl, hw, st) => { const c = Math.cos(a), s = Math.sin(a); const P = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([u, v]) => [x + c * u * hl - s * v * hw, y + s * u * hl + c * v * hw]); return pl(P.concat([P[0]]), st); };
for (const st of m.parking.spaces) if (st.status === 'active') o += box(st.sp.x, st.sp.y, st.sp.a, st.sp.hl, st.sp.hw, `fill="${st.owner && st.owner.park.parked ? '#0c0' : '#fc0'}" stroke="#000"`) + `<text x="${tx(st.sp.x) + 6}" y="${ty(st.sp.y)}" font-size="10">${st.sp.label}</text>`;
const cols = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#333'];
let i = 0;
for (const [b, pts] of tr) { o += pl(pts, `fill="none" stroke="${cols[i % 8]}" stroke-width="2"`); const e = pts[pts.length - 1]; o += `<circle cx="${tx(e[0])}" cy="${ty(e[1])}" r="5" fill="${cols[i % 8]}"/><text x="${tx(e[0]) + 6}" y="${ty(e[1]) + 12}" font-size="11" fill="${cols[i % 8]}">${b.car.short} ${b.car.park.parked ? 'P' : ''} ${b.state} ${b.target ? b.target.sp.label : ''}</text>`; i++; }
for (const mk of marks) o += `<text x="${tx(mk[0])}" y="${ty(mk[1])}" font-size="7" fill="#555">${mk[2]}</text>`;
o += '</svg>';
require('fs').writeFileSync(out, o);
console.log('parked', m.alive.filter((c) => c.park.parked).length);
