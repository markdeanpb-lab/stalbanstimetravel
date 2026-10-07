const Core = require('./load-core')();
const acts = process.argv.slice(2).map(s => { const [tick, type, target, poi] = s.split(':'); return { tick: Math.round(+tick / Core.TICK), type, target, poi }; });
const sim = Core.createSim('A', {});
let ai = 0, last = -1;
while (!Core.simDone(sim)) {
  while (ai < acts.length && acts[ai].tick <= sim.tick) { Core.simAct(sim, acts[ai]); ai++; }
  Core.simStep(sim); sim.ev.length = 0;
  const s = sim.s;
  if (s.fire.on && Math.floor(s.t) !== last && Math.floor(s.t) % 2 === 0) { last = Math.floor(s.t); console.log(s.t.toFixed(0), 'pos', s.hal.x.toFixed(1), s.hal.y.toFixed(1), 'exp', s.hal_.exposure.toFixed(2), 'fight', s.hal_.fighting); }
}
console.log(JSON.stringify(sim.scene.outcome(sim.s)), sim.s.notes.map(n=>n.k+'@'+n.t).join(' '));
