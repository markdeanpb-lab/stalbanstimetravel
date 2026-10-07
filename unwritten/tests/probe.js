const Core = require('./load-core')();
const [,, id, ...rest] = process.argv;
const variant = JSON.parse(process.env.V || '{}');
const actions = rest.map(s => { const [tick, type, target, poi] = s.split(':'); return { tick: Math.round(+tick / Core.TICK), type, target, poi }; });
const sim = Core.createSim(id, variant);
let ai = 0;
const acts = actions.sort((a,b)=>a.tick-b.tick);
while (!Core.simDone(sim)) {
  while (ai < acts.length && acts[ai].tick <= sim.tick) { const r = Core.simAct(sim, acts[ai]); console.log(sim.s.t.toFixed(1), 'ACT', JSON.stringify(acts[ai]), JSON.stringify(r)); ai++; }
  Core.simStep(sim);
  for (const e of sim.ev) if (e.t === 'say') console.log(sim.s.t.toFixed(1), (e.who||'?') + ':', e.text);
  sim.ev.length = 0;
}
console.log('NOTES', sim.s.notes.map(n => n.k + '@' + n.t).join(' '));
const extra = id === 'A' ? ' exposure=' + sim.s.hal_.exposure.toFixed(2) + ' book=' + sim.s.book : id === 'C' ? ' exposure=' + sim.s.k.exposure.toFixed(1) + ' L=' + sim.s.L.toFixed(2) : ' lorryX=' + sim.s.lorry.x.toFixed(2);
console.log('OUTCOME', JSON.stringify(sim.scene.outcome(sim.s)), 't=' + sim.s.t.toFixed(1) + extra);
