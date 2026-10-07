// Debug: run one bot match and report what every bot was doing at each horn
const { load } = require('./load');
const LS = load();
const seed = +(process.argv[2] || 100);
const A = new LS.Arena(1);
const m = new LS.Match({ seed, arena: A, mode: 'test', botCount: 8, players: [] });
const stateTime = new Map();
const sw = new Map();
let bigN = 0;
m.on('impact', (d) => { if (d.severity > 6 && bigN++ < 6) console.log('  big impact', m.time.toFixed(1), d.kind, d.cars.map((c) => c.short + (c.overturned ? '(over)' : '')).join('+'), d.severity.toFixed(1)); });
m.on('horn', () => {
  console.log(`HORN round ${m.round} t=${m.time.toFixed(1)}`);
  for (const b of m.bots) {
    const c = b.car; if (c.status !== 'active') continue;
    const st = b.target; const d = st ? LS.U.dist(c.x, c.y, st.sp.x, st.sp.y).toFixed(0) : '-';
    const times = [...(stateTime.get(b) || new Map()).entries()].map(([k, v]) => k + ':' + v.toFixed(0)).join(' ');
    console.log(`  ${c.short.padEnd(8)} ${c.spec.type.padEnd(6)} ${b.kind.padEnd(9)} parked=${c.park.parked ? 'Y' : 'n'} state=${b.state}${b.turn ? '+turn' : ''} tgt=${st ? st.sp.label : '-'} d=${d} switches=${sw.get(b) || 0} rec=${c.stats.recoveries} over=${c.overturned} | ${times}`);
  }
  stateTime.clear(); sw.clear();
});
m.start();
let last = new Map();
while (m.phase !== 'results' && m.time < 600) {
  m.step(1 / 30);
  if (m.phase === 'battle') for (const b of m.bots) {
    if (!stateTime.has(b)) stateTime.set(b, new Map());
    const k = b.state + (b.turn ? '+T' : '') + (b.unstickT > 0 ? '+U' : '');
    const mm = stateTime.get(b); mm.set(k, (mm.get(k) || 0) + 1 / 30);
    if (last.get(b) !== b.target) { sw.set(b, (sw.get(b) || 0) + 1); last.set(b, b.target); }
  }
}
console.log('end', m.phase, (m.time / 60).toFixed(2), 'min; winner', m.winner && m.winner.short);
