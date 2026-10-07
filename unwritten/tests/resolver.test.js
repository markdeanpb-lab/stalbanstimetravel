#!/usr/bin/env node
/* The Unwritten: timeline resolver test.
 *
 * Enumerates every combination of graves entered (0, 1 or 2 journeys),
 * every visiting order and every strategy (an action log chosen to reach
 * each outcome) and asserts:
 *   - the resolved world is independent of visiting order;
 *   - each strategy reaches its intended outcome in each scene variant;
 *   - graves vanish exactly when their person is alive on 2 Nov 1963;
 *   - a changed death changes the inscription, the evidence and the mourners;
 *   - only graves that still exist and haven't been entered are enterable;
 *   - every ending is reachable, the best within two journeys;
 *   - no combination leaves the player without an ending.
 * Plus a fuzz pass of random action logs.
 *
 * Run:  node unwritten/tests/resolver.test.js
 */
'use strict';
const Core = require('./load-core')();
const T = (s) => Math.round(s / Core.TICK);
const P = (t, target) => ({ tick: T(t), type: 'possess', target });
const W = (t, target, poi) => ({ tick: T(t), type: 'whisper', target, poi });

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; if (failures < 40) console.log('  FAIL: ' + msg); } }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------------------------------------------------------------- strategies
   expect: outcome (and proof for A) in a given variant. For B the expectation
   depends on whether the café wireless exists (Hal alive). */
const STRATS = {
  A: [
    { name: 'none', log: [], expect: { outcome: 'died_fire', proof: false } },
    { name: 'misread: stove', log: [P(10, 'stove')], expect: { outcome: 'died_fire', proof: false } },
    { name: 'misread: cash box', log: [W(20, 'hal', 'cash')], expect: { outcome: 'died_fire', proof: false } },
    { name: 'fuse too early', log: [P(30, 'fuse')], expect: { outcome: 'died_fire', proof: false } },
    { name: 'wireless off', log: [P(10, 'radio')], expect: { outcome: 'survived', proof: true } },
    { name: 'phone before stick', log: [P(30, 'phone')], expect: { outcome: 'survived', proof: false } },
    { name: 'phone after stick', log: [P(85, 'phone')], expect: { outcome: 'survived', proof: true } },
    { name: 'fuse after stick', log: [P(65, 'fuse')], expect: { outcome: 'survived', proof: true } },
    { name: 'whisper at Comet', log: [W(70, 'hal', 'comet')], expect: { outcome: 'survived', proof: true } },
    { name: 'whisper at drawer', log: [W(20, 'hal', 'drawer')], expect: { outcome: 'survived', proof: true } },
    { name: 'bolt early', log: [P(10, 'bolt')], expect: { outcome: 'survived', proof: true } },
    { name: 'bolt late', log: [P(128, 'bolt')], expect: { outcome: 'died_later', proof: true } },
  ],
  B: [
    { name: 'none', log: [], expect: { plain: 'died_lorry', radio: 'died_lorry' } },
    { name: 'kiosk only', log: [P(128, 'kiosk')], expect: { plain: 'died_lorry', radio: 'died_lorry' } },
    { name: 'misread: lorry only', log: [P(100, 'door'), W(120, 'len', 'lamp')], expect: { plain: 'died_pole', radio: 'died_pole' } },
    { name: 'door+whisper+kiosk', log: [P(100, 'door'), W(120, 'len', 'door'), P(129, 'kiosk')], expect: { plain: 'survived', radio: 'survived' } },
    { name: 'door+whisper+whisper girl', log: [P(100, 'door'), W(120, 'len', 'lamp'), W(131, 'iris', 'pole')], expect: { plain: 'survived', radio: 'survived' } },
    { name: 'wireless only', log: [P(100, 'radio')], expect: { plain: 'died_lorry', radio: 'died_pole' } },
    { name: 'wireless+kiosk', log: [P(100, 'radio'), P(128, 'kiosk')], expect: { plain: 'died_lorry', radio: 'survived' } },
  ],
  C: [
    { name: 'none', log: [], expect: { outcome: 'drowned' } },
    { name: 'kindness: latch before she wades', log: [P(10, 'cardoor')], expect: { outcome: 'survived' } },
    { name: 'latch during heave', log: [P(50, 'cardoor')], expect: { outcome: 'survived' } },
    { name: 'latch too late', log: [P(67, 'cardoor')], expect: { outcome: 'drowned' } },
    { name: 'grate early', log: [P(20, 'grate')], expect: { outcome: 'survived' } },
    { name: 'grate before she goes back', log: [P(78, 'grate')], expect: { outcome: 'survived' } },
    { name: 'grate while pinned', log: [P(93, 'grate')], expect: { outcome: 'died_pneumonia' } },
    { name: 'kiosk', log: [P(70, 'kiosk')], expect: { outcome: 'survived' } },
    { name: 'whisper at steps', log: [W(82, 'kath', 'cyril')], expect: { outcome: 'survived' } },
  ],
};

/* ------------------------------------------------- 1. strategy outcomes */
console.log('1. Strategy outcomes per scene variant');
const stratRows = [];
for (const s of STRATS.A) {
  const r = Core.runSim('A', {}, s.log);
  ok(r.outcome === s.expect.outcome && r.proof === s.expect.proof, `A/${s.name}: got ${r.outcome}${r.proof ? '+proof' : ''}`);
  stratRows.push(['A', s.name, '-', r.outcome + (r.proof ? ' +proof' : '')]);
}
for (const s of STRATS.B) for (const radio of [false, true]) {
  const r = Core.runSim('B', { radio }, s.log);
  const want = radio ? s.expect.radio : s.expect.plain;
  ok(r.outcome === want, `B/${s.name} radio=${radio}: got ${r.outcome}, want ${want}`);
  stratRows.push(['B', s.name, radio ? 'café wireless' : 'no wireless', r.outcome]);
}
for (const s of STRATS.C) {
  const r = Core.runSim('C', {}, s.log);
  ok(r.outcome === s.expect.outcome, `C/${s.name}: got ${r.outcome}`);
  stratRows.push(['C', s.name, '-', r.outcome]);
}
// A B log that never touches the wireless must behave identically in both variants,
// so re-resolving it after Hal is saved can't silently change history.
for (const s of STRATS.B) if (!s.log.some(a => a.target === 'radio')) {
  ok(Core.runSim('B', { radio: false }, s.log).outcome === Core.runSim('B', { radio: true }, s.log).outcome, `B/${s.name} differs between variants`);
}

/* ---------------------------------------- 2. original world sanity */
console.log('2. Original world');
const W0 = Core.resolve([]);
ok(W0.scenes.A.outcome === 'died_fire' && W0.scenes.B.outcome === 'died_lorry' && W0.scenes.C.outcome === 'drowned' && W0.iris === 'exchange_fire', 'original world is the documented original');
ok(W0.enterable.A && W0.enterable.B && W0.enterable.C, 'three graves enterable at start');
ok(Core.newProgress().charges === 2, 'two charges at start');

/* ---------------------------------------- 3. exhaustive enumeration */
console.log('3. Enumerating journeys, orders and strategies');
const cemOrig = Core.cemeteryFor(W0);
const graveThing = (cem, person) => cem.things.find(t => t.id === 'grave_' + person) || (person === 'iris' ? cem.things.find(t => t.id === 'mystone' && t.kind === 'mystone') : null);
const ATGRAVE = { hal: ['vera', 'hal'], ashdown: ['frank', 'len'], kath: ['win'], iris: ['davy', 'kath', 'hal', 'vera'] };
const GRAVE_XY = { hal: [16, 4], ashdown: [17, 12], kath: [5, 10], iris: [7, 10] };
function mournersAt(cem, person) {
  const [gx, gy] = GRAVE_XY[person];
  return cem.people.filter(p => Math.hypot(p.x - gx, p.y - gy) <= 2.5).map(p => p.id + ':' + p.lines.join('|')).sort();
}
function evidenceOf(cem, person) {
  const g = graveThing(cem, person); if (!g) return null;
  if (person === 'iris') return [g.clipping, g.flowers];
  return (g.items || []).map(i => i.text).concat([g.flowers]);
}
function cemClues(cem) {
  const c = new Set();
  for (const t of cem.things) { if (t.clue) c.add(t.clue); if (t.clipping) c.add(t.clipping); for (const i of t.items || []) if (i.clue) c.add(i.clue); }
  for (const p of cem.people) { for (const k of p.clues || []) c.add(k); if (p.whisperClue) c.add(p.whisperClue); }
  return c;
}
const SCENE_ID_CLUE = { A: 'id_A', B: 'id_B', C: 'id_C' };

const combos = [];
// 0 journeys
combos.push([]);
for (const a of Core.ORDER) for (const sa of STRATS[a]) {
  combos.push([{ scene: a, strat: sa }]);
  for (const b of Core.ORDER) if (b !== a) for (const sb of STRATS[b]) combos.push([{ scene: a, strat: sa }, { scene: b, strat: sb }]);
}

const endingsSeen = { saved: 0, accepted: 0, incomplete: 0 };
let savedMinJourneys = Infinity, illegal = 0, legal = 0, reresolved = 0, moot = 0;
const finalWorlds = new Map();
const outcomeCount = {};

for (const combo of combos) {
  let progress = Core.newProgress();
  let world = Core.resolve([]);
  let legalPath = true;
  const avail = new Set(cemClues(Core.cemeteryFor(world)));
  const seenOutcome = {};
  for (const step of combo) {
    if (!Core.canEnter(progress, world, step.scene)) { legalPath = false; break; }
    progress = Core.spendCharge(progress);
    ok(progress.charges >= 0, 'charges never negative');
    // what the player sees: the scene as it stands in the current timeline
    const variant = Core.sceneVariant(world, step.scene);
    const live = Core.runSim(step.scene, variant, step.strat.log);
    seenOutcome[step.scene] = live.outcome;
    // The game records only the actions that were accepted in the scene the player saw.
    const recorded = live.applied.filter(x => x.ok).map(x => x.a);
    progress = Core.commitJourney(progress, { scene: step.scene, actions: recorded });
    avail.add(SCENE_ID_CLUE[step.scene]);
    world = Core.resolve(progress.journeys);
    for (const c of cemClues(Core.cemeteryFor(world))) avail.add(c);
    ok(!world.enterable[step.scene], `${step.scene} cannot be re-entered`);
  }
  if (!legalPath) { illegal++; continue; }
  legal++;
  const journeys = progress.journeys;

  // order independence of the resolver input
  if (journeys.length === 2) {
    const rev = Core.resolve(journeys.slice().reverse());
    ok(eq(rev.signature, world.signature) && eq(rev.graves, world.graves) && eq(rev.enterable, world.enterable), 'resolver independent of journey order: ' + combo.map(c => c.scene + '/' + c.strat.name).join(' → '));
    ok(eq(Core.cemeteryFor(rev), Core.cemeteryFor(world)), 'cemetery independent of order');
  }
  // the same set visited in the other order (when that order is legal) gives the same world
  const key = journeys.map(j => j.scene + ':' + JSON.stringify(j.actions)).sort().join('#');
  if (finalWorlds.has(key)) ok(finalWorlds.get(key) === world.signature + JSON.stringify(world.graves), 'same interventions, different order → different world: ' + key);
  else finalWorlds.set(key, world.signature + JSON.stringify(world.graves));

  // what the player saw vs. the re-resolved history
  for (const step of combo) {
    const sc = world.scenes[step.scene];
    if (!sc.happens) { moot++; ok(step.scene === 'C' && world.ashAlive, 'only Brin Lane can stop happening, and only if Dr Ashdown lived'); continue; }
    if (sc.outcome !== seenOutcome[step.scene]) reresolved++;
    ok(sc.outcome === seenOutcome[step.scene], `re-resolved outcome differs from what was seen in ${step.scene}/${step.strat.name}`);
  }

  // grave rules
  const cem = Core.cemeteryFor(world);
  for (const person of ['hal', 'ashdown', 'kath', 'iris']) {
    const alive = world.people[person].alive;
    const g = world.graves.find(x => x.person === person);
    ok(alive === !g, `${person}: alive=${alive} but grave ${g ? 'exists' : 'missing'}`);
    ok(alive === !graveThing(cem, person), `${person}: cemetery shows wrong grave state`);
    const orig = Core.ORIGINAL[{ hal: 'A', ashdown: 'B', kath: 'C' }[person]] || 'exchange_fire';
    if (!alive && world.people[person].death !== orig) {
      const gO = W0.graves.find(x => x.person === person);
      ok(!eq(g.inscription, gO.inscription), `${person}: changed death but same inscription`);
      ok(!eq(evidenceOf(cem, person), evidenceOf(cemOrig, person)), `${person}: changed death but same evidence`);
      ok(!eq(mournersAt(cem, person), mournersAt(cemOrig, person)), `${person}: changed death but same mourners`);
    }
  }
  for (const id of Core.ORDER) {
    const person = Core.SCENES[id].person;
    const expectEnterable = world.scenes[id].happens && !world.people[person].alive && !journeys.some(j => j.scene === id);
    ok(world.enterable[id] === expectEnterable, `enterable ${id} wrong`);
  }
  // the second charge always has somewhere to go
  if (journeys.length === 1) ok(Core.ORDER.some(id => Core.canEnter(progress, world, id)), 'second charge stranded with nowhere to go');

  // endings
  const none = { clues: {} };
  const full = { clues: Object.fromEntries([...avail].map(k => [k, { first: 'x' }])) };
  const eNone = Core.endingOptions(world, none), eFull = Core.endingOptions(world, full);
  ok(eNone.length > 0 && eFull.length > 0, 'combination with no ending');
  if (journeys.length > 0) {
    for (const e of eNone.concat(eFull)) endingsSeen[e]++;
    if (eFull.includes('saved')) savedMinJourneys = Math.min(savedMinJourneys, journeys.length);
    if (!world.irisAlive) ok(eFull.includes('accepted'), 'truth not discoverable in ' + world.signature + ' via ' + combo.map(c => c.scene + '/' + c.strat.name).join(' → '));
    ok(Core.accountFor(world).length > 0, 'empty ending account');
  }
  outcomeCount[world.signature] = (outcomeCount[world.signature] || 0) + 1;
}
ok(endingsSeen.saved > 0, 'Saved ending unreachable');
ok(endingsSeen.accepted > 0, 'Accepted ending unreachable');
ok(endingsSeen.incomplete > 0, 'Incomplete ending unreachable');
ok(savedMinJourneys <= 2, 'Saved not reachable within two journeys');

// Every outcome state of every scene appears in some final world.
const states = { A: new Set(), B: new Set(), C: new Set(), I: new Set() };
for (const sig of Object.keys(outcomeCount)) { const m = sig.split('|'); states.A.add(m[0].slice(2).replace('+p', '')); states.B.add(m[1].slice(2)); states.C.add(m[2].slice(2)); states.I.add(m[3].slice(2)); }
for (const s of ['died_fire', 'died_later', 'survived']) ok(states.A.has(s), 'A state never reached: ' + s);
for (const s of ['died_lorry', 'died_pole', 'survived']) ok(states.B.has(s), 'B state never reached: ' + s);
for (const s of ['drowned', 'died_pneumonia', 'survived', 'averted']) ok(states.C.has(s), 'C state never reached: ' + s);
for (const s of ['exchange_fire', 'home_fire', 'alive']) ok(states.I.has(s), 'Iris state never reached: ' + s);

/* ---------------------------------------- 4. causal constraints */
console.log('4. Causal constraints');
const sA = (n) => STRATS.A.find(s => s.name === n).log, sB = (n) => STRATS.B.find(s => s.name === n).log, sC = (n) => STRATS.C.find(s => s.name === n).log;
{ // indirect rescue: B saves Kath without entering C
  const w = Core.resolve([{ scene: 'B', actions: sB('door+whisper+kiosk') }]);
  ok(w.kathAlive && !w.scenes.C.entered && !w.graves.some(g => g.person === 'kath') && !w.enterable.C, 'indirect rescue of Kath via Dr Ashdown');
}
{ // changed solution: saving Hal adds the café wireless to Five Ways
  const w = Core.resolve([{ scene: 'A', actions: sA('wireless off') }]);
  ok(Core.sceneVariant(w, 'B').radio === true && Core.sceneVariant(W0, 'B').radio === false, 'café wireless appears in Five Ways only if Hal lives');
}
{ // plain kindness: C latch early changes nothing else for the worse
  const w = Core.resolve([{ scene: 'C', actions: sC('kindness: latch before she wades') }]);
  ok(w.kathAlive && w.iris === W0.iris && !w.halAlive === !W0.halAlive && w.ashAlive === W0.ashAlive && w.graves.length === W0.graves.length - 1, 'plain kindness has no hidden cost');
}
{ // misread cause: stove / cash box fail and the evidence is in the cemetery before entry
  ok(Core.runSim('A', {}, sA('misread: stove')).outcome === 'died_fire', 'stove misread fails');
  const c0 = cemClues(cemOrig);
  ok(c0.has('hal_report') && c0.has('hal_letter') && c0.has('hal_vera_stove'), 'misread-cause evidence available before entry');
}
{ // best ending in both orders
  const j1 = { scene: 'A', actions: sA('wireless off') }, j2 = { scene: 'B', actions: sB('door+whisper+kiosk') };
  ok(Core.resolve([j1, j2]).irisAlive && Core.resolve([j2, j1]).irisAlive, 'Saved via A then B and B then A');
  const j2r = { scene: 'B', actions: sB('wireless+kiosk') };
  ok(Core.resolve([j1, j2r]).irisAlive, 'Saved via the changed solution (café wireless)');
  ok(Core.resolve([{ scene: 'A', actions: sA('bolt late') }, j2]).irisAlive, 'Saved even when Hal dies later (Vera\'s notebook)');
}
{ // moot action: C committed first, then B saves Ashdown
  const w = Core.resolve([{ scene: 'C', actions: sC('none') }, { scene: 'B', actions: sB('door+whisper+kiosk') }]);
  ok(w.scenes.C.outcome === 'averted' && w.scenes.C.moot, 'C actions become moot when the flood never happens');
}

/* ---------------------------------------- 5. fuzz */
console.log('5. Fuzzing random action logs');
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const TARGETS = {
  A: [['possess', 'radio'], ['possess', 'phone'], ['possess', 'fuse'], ['possess', 'bolt'], ['possess', 'stove'], ['whisper', 'hal'], ['whisper', 'vera']],
  B: [['possess', 'kiosk'], ['possess', 'door'], ['possess', 'radio'], ['whisper', 'len'], ['whisper', 'iris'], ['whisper', 'bert']],
  C: [['possess', 'cardoor'], ['possess', 'grate'], ['possess', 'kiosk'], ['whisper', 'kath'], ['whisper', 'cyril']],
};
const VALID = { A: ['died_fire', 'died_later', 'survived'], B: ['died_lorry', 'died_pole', 'survived'], C: ['drowned', 'died_pneumonia', 'survived'] };
let fuzzRuns = 0; const fuzzOut = {};
for (let i = 0; i < 1500; i++) {
  const id = Core.ORDER[i % 3];
  const n = 1 + Math.floor(rnd() * 4);
  const log = [];
  for (let k = 0; k < n; k++) {
    const [type, target] = TARGETS[id][Math.floor(rnd() * TARGETS[id].length)];
    const pois = Core.SCENES[id].pois;
    log.push({ tick: Math.floor(rnd() * Core.SCENES[id].maxT / Core.TICK), type, target, poi: type === 'whisper' ? pois[Math.floor(rnd() * pois.length)].id : undefined });
  }
  log.sort((a, b) => a.tick - b.tick);
  let r;
  try { r = Core.runSim(id, id === 'B' ? { radio: rnd() < 0.5 } : {}, log); } catch (e) { ok(false, 'sim crashed: ' + id + ' ' + JSON.stringify(log) + ' ' + e.stack); continue; }
  ok(VALID[id].includes(r.outcome), 'invalid outcome ' + r.outcome);
  ok(r.t <= Core.SCENES[id].maxT + 0.1, 'scene overran maxT');
  fuzzOut[id + ':' + r.outcome] = (fuzzOut[id + ':' + r.outcome] || 0) + 1;
  // determinism
  ok(eq(Core.runSim(id, {}, log).outcome, Core.runSim(id, {}, log).outcome), 'non-deterministic replay');
  // random pairs: order independence
  if (i % 3 === 2) {
    const other = Core.ORDER[Math.floor(rnd() * 2)];
    const j1 = { scene: id, actions: log }, j2 = { scene: other, actions: [] };
    ok(Core.resolve([j1, j2]).signature === Core.resolve([j2, j1]).signature, 'fuzz order dependence');
  }
  fuzzRuns++;
}

/* ---------------------------------------- report */
console.log('\nStrategy table:');
for (const r of stratRows) console.log('  ' + r[0] + '  ' + r[1].padEnd(34) + r[2].padEnd(15) + r[3]);
console.log('\nCombinations: ' + combos.length + ' enumerated, ' + legal + ' legal play paths, ' + illegal + ' illegal (grave gone or already entered)');
console.log('Distinct final worlds: ' + Object.keys(outcomeCount).length);
for (const [k, v] of Object.entries(outcomeCount).sort()) console.log('  ' + k.padEnd(62) + v);
console.log('Endings reachable: ' + JSON.stringify(endingsSeen) + '; Saved first reachable after ' + savedMinJourneys + ' journey(s)');
console.log('Moot journeys (scene no longer happens): ' + moot + '; seen outcome re-resolved differently: ' + reresolved);
console.log('Fuzz: ' + fuzzRuns + ' random logs; outcomes ' + JSON.stringify(fuzzOut));
console.log('\n' + (failures ? 'FAILED: ' + failures + ' of ' + checks + ' checks' : 'PASSED: all ' + checks + ' checks'));
process.exit(failures ? 1 : 0);
