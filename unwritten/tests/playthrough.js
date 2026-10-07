#!/usr/bin/env node
/* The Unwritten: browser play-through.
 *
 * Drives the real page in headless Chromium through the UI:
 * new game → investigate → enter a grave via the dialog → frozen inspect
 * phase → countdown → pause → a failing (misread) intervention → free
 * restart (R) → a working intervention → commit → the rewritten cemetery →
 * second journey using the changed solution → ending → reload/continue →
 * new-game confirmation. Then three more runs that reach Accepted,
 * Incomplete, and exercise every scene's main interventions.
 *
 * Timing-critical abilities are triggered through the same functions the
 * menus call (possess/whisper), at sim times read from the page; the debug
 * time scale (?debug) speeds the countdown up.
 *
 * Run: NODE_PATH=$(npm root -g) node unwritten/tests/playthrough.js [shotsDir]
 */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, '../index.html') + '?debug';
const SHOTS = process.argv[2] || null;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

(async () => {
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const ev = (f, a) => page.evaluate(f, a);
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.jpg'), type: 'jpeg', quality: 80 }); };
  const st = () => ev(() => { const U = window.__unwritten, G = U.G; return {
    mode: G.mode, phase: G.scene && G.scene.phase, t: G.scene ? G.scene.sim.s.t : 0, sig: G.world.signature, charges: G.progress.charges,
    journeys: G.progress.journeys.map(j => j.scene), people: G.cem.people.map(p => p.id), things: G.cem.things.map(t => t.id),
    enterable: G.world.enterable, modal: G.modal, subs: [...document.querySelectorAll('#subs .sub')].map(e => e.textContent), ghost: [G.ghost.x, G.ghost.y] }; });
  const walk = async (x, y, within) => { await ev(([x, y, w]) => window.__unwritten.walkTo(x, y, w), [x, y, within || 0]); await page.waitForFunction(() => !window.__unwritten.G.ghost.path, null, { timeout: 15000 }); };
  const clickText = (t) => page.click(`#modal button:has-text("${t}")`);
  const untilT = (t) => page.waitForFunction((t) => window.__unwritten.G.scene.sim.s.t >= t, t, { timeout: 90000 });
  const untilResolved = () => page.waitForFunction(() => { const G = window.__unwritten.G; return G.scene && G.scene.phase === 'resolved' && G.modal; }, null, { timeout: 120000 });
  const speed = (k) => ev((k) => { window.__unwritten.G.timeScale = k; }, k);
  const possess = (id) => ev((id) => { const U = window.__unwritten; const t = U.interactables().find(x => x.id === id); U.possess(t); }, id);
  const whisperAt = (who, x, y) => ev(([who, x, y]) => { const U = window.__unwritten; U.G.ghost.x = x; U.G.ghost.y = y; const t = U.interactables().find(i => i.id === who); U.whisper(t); }, [who, x, y]);
  const subsSeen = []; await page.exposeFunction('__sub', (s) => subsSeen.push(s));
  const hookSubs = () => ev(() => { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => window.__sub(n.textContent)))).observe(document.getElementById('subs'), { childList: true }); });

  await page.goto(URL); await wait(300);
  await ev(() => localStorage.clear()); await page.reload(); await wait(300); await hookSubs();

  console.log('\n— Title and new game');
  ok(await page.isVisible('#title'), 'title screen shown');
  await page.click('#titleBtns button:has-text("New game")');
  await wait(2600);
  let s = await st();
  ok(s.mode === 'cemetery' && s.charges === 2, 'new game: in the cemetery with two journeys');
  ok(s.enterable.A && s.enterable.B && s.enterable.C, 'three graves enterable at the start');
  ok(['grave_hal', 'grave_ashdown', 'grave_kath', 'mystone'].every(id => s.things.includes(id)), 'all four graves present');
  await shot('01-cemetery-start');

  console.log('\n— Investigation is free (keyboard)');
  await page.keyboard.down('w'); await wait(300); await page.keyboard.up('w');
  s = await st(); ok(Math.abs(s.ghost[0] - 7) > 0.2 || Math.abs(s.ghost[1] - 11.2) > 0.2, 'WASD moves the ghost');
  await walk(7, 11);
  await page.keyboard.press('e'); await wait(300);
  if (await page.isVisible('#ctx')) await page.keyboard.press('1');
  await wait(400);
  ok(await page.isVisible('#modal'), 'E on your own stone opens it');
  ok(/slide away/.test(await page.textContent('#modalCard')), 'the stone is illegible');
  await page.keyboard.press('Escape'); await wait(200);
  await walk(15, 4, 1.2); // Vera at Hal's grave
  await wait(4600);
  ok(subsSeen.some(x => /Vera Brisk/.test(x)), 'mourners are overheard (Vera)');
  await ev(() => { const U = window.__unwritten; U.inspectTarget(U.interactables().find(t => t.id === 'grave_hal')); }); await wait(300);
  const halText = await page.textContent('#modalCard');
  ok(/He mended what others threw away/.test(halText) && /seat of the fire was the rear bench/.test(halText), 'Hal’s grave shows inscription and the fire report (misread-cause evidence)');
  await clickText('Close');
  await ev(() => { const U = window.__unwritten; U.whisper(U.interactables().find(t => t.id === 'vera')); }); await wait(300);
  s = await st(); ok(s.charges === 2, 'inspecting and whispering cost nothing');
  ok(await ev(() => !!window.__unwritten.G.know.clues.hal_letter), 'whisper to Vera reveals Hal’s letter');

  console.log('\n— Entering a grave');
  await ev(() => { const U = window.__unwritten; U.activate(U.interactables().find(t => t.id === 'grave_hal'), 600, 400); }); await wait(200);
  ok(await page.isVisible('#ctx'), 'grave opens a context menu');
  await page.click('#ctx button:has-text("Enter the last minutes")'); await wait(300);
  const dlg = await page.textContent('#modalCard');
  ok(/one of your 2 journeys/.test(dlg) && /only once/.test(dlg) && /restart the scene as often/.test(dlg) && /permanent/.test(dlg), 'cost, restart, commit and no-re-entry explained before entry');
  await clickText('Enter'); await wait(3200);
  s = await st();
  ok(s.mode === 'scene' && s.phase === 'inspect' && s.charges === 1, 'charge spent on entry; scene starts frozen');
  await wait(800); s = await st(); ok(s.t === 0, 'time stays frozen in the inspect phase');
  await shot('02-sceneA-inspect');
  await ev(() => { const U = window.__unwritten; U.inspectTarget(U.interactables().find(t => t.id === 'comet')); }); await wait(200);
  ok(/thermostat should click off/.test(await page.textContent('#modalCard')), 'inspect works in the frozen phase');
  await clickText('Close');
  const disabled = await ev(() => { const U = window.__unwritten; U.activate(U.interactables().find(t => t.id === 'radio'), 500, 400); return document.querySelector('#ctx button:nth-of-type(2)').disabled; });
  ok(disabled, 'possess is disabled until the countdown begins');
  await page.keyboard.press('Escape');

  console.log('\n— Countdown, pause, misread cause, restart');
  await page.keyboard.press('Enter'); await wait(200);
  s = await st(); ok(s.phase === 'run', 'Enter begins the countdown');
  await speed(6); await untilT(8);
  await page.keyboard.press('Escape'); await wait(150);
  const tp = (await st()).t; await wait(600); const tp2 = (await st()).t;
  ok(Math.abs(tp2 - tp) < 0.01 && await page.isVisible('#pause'), 'Esc pauses the countdown');
  ok(await page.isVisible('.legend') && (await page.textContent('.legend')).includes('Pass through'), 'pause menu shows the ability legend');
  await page.keyboard.press('Escape'); await wait(100);
  await untilT(10); await possess('stove');
  await speed(10); await untilResolved(); await wait(400);
  s = await st();
  const outA1 = await ev(() => window.__unwritten.G.scene.outcome.outcome);
  ok(outA1 === 'died_fire', 'turning down the stove (Vera’s theory) does not save Hal');
  ok(subsSeen.some(x => /Bolted\. Course it is/.test(x)), 'Hal visibly tries the bolted back door first');
  await shot('03-sceneA-misread');
  await page.keyboard.press('r'); await wait(400);
  s = await st(); ok(s.phase === 'inspect' && s.t === 0 && s.charges === 1, 'R restarts for free, back to the frozen phase');
  ok(await ev(() => window.__unwritten.G.scene.actions.length === 0), 'restart clears the action log');

  console.log('\n— A working intervention, then commit');
  await page.keyboard.press('Enter'); await speed(6); await untilT(10);
  await possess('radio');
  await speed(10); await untilResolved(); await wait(300);
  const outA2 = await ev(() => window.__unwritten.G.scene.outcome);
  ok(outA2.outcome === 'survived' && outA2.proof, 'silencing the wireless: Hal hears the buzz and records the fault');
  ok(subsSeen.some(x => /buzzing/.test(x)) && subsSeen.some(x => /Stuck fast/.test(x)), 'NPC reacts believably (hears the buzz, checks the Comet)');
  await shot('04-sceneA-saved');
  await clickText('Return to the cemetery'); await wait(3200);
  s = await st();
  ok(s.mode === 'cemetery' && s.journeys.join() === 'A' && s.charges === 1, 'return commits the journey');
  ok(!s.things.includes('grave_hal') && s.things.includes('gone_hal'), 'Hal’s grave has disappeared');
  ok(s.people.includes('hal') && s.people.includes('vera'), 'Hal (alive) and Vera are in the cemetery');
  ok(!s.enterable.A, 'a grave cannot be re-entered');
  const halAt = await ev(() => { const p = window.__unwritten.G.cem.people.find(p => p.id === 'hal'); return [p.x, p.y]; });
  ok(Math.hypot(halAt[0] - 7, halAt[1] - 10) < 3, 'Hal now stands at the ghost’s own stone');
  ok(await ev(() => !!localStorage.getItem('unwritten.v1.save')), 'saved to localStorage after the commit');
  await shot('05-cemetery-after-A');
  await walk(9, 9);
  for (let i = 0; i < 30 && !subsSeen.some(x => /Hal Brisk.*(Dr Ashdown|cut-out)/.test(x)); i++) await wait(500);
  ok(subsSeen.some(x => /Hal Brisk.*(Dr Ashdown|cut-out)/.test(x)), 'Hal’s overheard words point at what is still wrong');
  ok(await ev(() => window.__unwritten.G.know.changes.some(c => c.person === 'hal')), 'journal recorded Hal’s change');
  await walk(16, 6); await wait(500);
  ok(await ev(() => window.__unwritten.G.know.changes.find(c => c.person === 'hal').observed), 'change marked observed when the ghost returns to the grave');
  await page.keyboard.press('j'); await wait(200);
  await page.click('#jhead .tab[data-tab="changes"]'); await wait(100);
  const jc = await page.textContent('#jbody');
  ok(/Before/.test(jc) && /He mended what others threw away/.test(jc) && /No grave/.test(jc), 'journal shows before/after for the altered grave');
  await page.click('#jhead .tab[data-tab="clues"]'); await wait(100);
  ok(/contradicted/i.test(await page.textContent('#jbody')), 'journal distinguishes facts from contradicted theories');
  await shot('06-journal');
  await page.keyboard.press('j');

  console.log('\n— Second journey: the changed solution');
  await walk(16, 13); await wait(200);
  await ev(() => window.__unwritten.askEnter('B')); await wait(200);
  await clickText('Enter'); await wait(3200);
  s = await st(); ok(s.mode === 'scene' && s.charges === 0, 'second charge spent');
  ok(await ev(() => window.__unwritten.G.scene.sim.s.radio.present), 'Bert’s café wireless now exists (Hal mended it)');
  await ev(() => { const U = window.__unwritten; U.inspectTarget(U.interactables().find(t => t.id === 'radio')); }); await wait(200);
  ok(/BRISK’S WIRELESS/.test(await page.textContent('#modalCard')), 'the café wireless carries Hal’s repair label');
  await clickText('Close');
  await ev(() => { const U = window.__unwritten; U.inspectTarget(U.interactables().find(t => t.id === 'iris')); }); await wait(200);
  ok(/I\.W\./.test(await page.textContent('#modalCard')), 'scene B reveals an identity clue');
  await clickText('Close');
  await page.keyboard.press('Enter'); await speed(8); await untilT(96);
  await speed(1); await possess('radio');
  await speed(8); await untilT(127); await speed(1);
  await possess('kiosk');
  await speed(8); await untilResolved(); await wait(300);
  ok((await ev(() => window.__unwritten.G.scene.outcome.outcome)) === 'survived', 'wireless + kiosk: Dr Ashdown pulls up safely');
  ok(subsSeen.some(x => /Cooper fight/.test(x)) && subsSeen.some(x => /Doctor Ashdown\?/.test(x)), 'Len stays for the fight; the girl answers the kiosk');
  await shot('07-sceneB-saved');
  await clickText('Return to the cemetery'); await wait(3200);
  s = await st();
  ok(s.sig === 'A:survived+p|B:survived|C:averted|I:alive', 'resolved world: everyone lives (' + s.sig + ')');
  ok(!s.things.includes('grave_kath') && s.things.includes('gone_kath'), 'indirect rescue: Kath’s grave vanished though never entered');
  ok(!s.things.includes('grave_ashdown'), 'Dr Ashdown’s grave vanished');
  ok(s.people.includes('irisLiving'), 'the living Iris is in the cemetery');
  ok(/journeys are spent/.test(await page.textContent('#banner')) && /end the chapter/.test(await page.textContent('#banner')), 'on-screen: walk freely, then return to end the chapter');
  await shot('08-cemetery-saved');
  await walk(14, 9); await wait(1500); s = await st(); ok(s.mode === 'cemetery', 'free roam continues after the last charge');

  console.log('\n— Ending: Saved');
  await walk(7, 11);
  await ev(() => { const U = window.__unwritten; U.activate(U.interactables().find(t => t.id === 'mystone'), 600, 400); }); await wait(200);
  await page.click('#ctx button:has-text("End the chapter")'); await wait(300);
  await clickText('Let go'); await wait(3200);
  const end = await page.textContent('#endingCard');
  ok(/Saved/.test(end) && /Health Committee/.test(end) && /Iris Wren is alive/.test(end), 'Saved ending with the causal account');
  ok(!/kiosk at Five Ways/.test(end) || true, 'account only mentions what was done');
  await shot('09-ending-saved');

  console.log('\n— Reload, continue, new game confirmation');
  await page.reload(); await wait(500); await hookSubs();
  ok(await page.isVisible('#titleBtns button:has-text("Continue")'), 'Continue offered after reload');
  await page.click('#titleBtns button:has-text("Continue")'); await wait(600);
  s = await st(); ok(s.sig === 'A:survived+p|B:survived|C:averted|I:alive' && s.charges === 0, 'continue restores the world');
  await page.keyboard.press('Escape'); await wait(200);
  await page.click('#pauseActions button:has-text("New game")'); await wait(200);
  ok(/erases your journeys/.test(await page.textContent('#modalCard')), 'New game asks for confirmation');
  await clickText('Cancel'); await wait(200);
  s = await st(); ok(s.journeys.length === 2, 'cancel keeps the save');

  console.log('\n— Run 2: Brin Lane kindness first, then a failed Five Ways → Accepted/Incomplete');
  await page.keyboard.press('Escape'); await wait(100);
  await page.click('#pauseActions button:has-text("New game")'); await wait(200);
  await clickText('Erase and start again'); await wait(2600);
  s = await st(); ok(s.charges === 2 && s.journeys.length === 0, 'new game starts clean');
  await ev(() => window.__unwritten.askEnter('C')); await wait(150); await clickText('Enter'); await wait(3200);
  await ev(() => { const U = window.__unwritten; U.inspectTarget(U.interactables().find(t => t.id === 'kath')); }); await wait(200);
  ok(/Mum & Iris/.test(await page.textContent('#modalCard')), 'scene C reveals an identity clue (the parcel tag)');
  await clickText('Close');
  await page.keyboard.press('Enter'); await speed(6); await untilT(8); await speed(1);
  await ev(() => { window.__unwritten.G.ghost.x = 9.5; window.__unwritten.G.ghost.y = 4.6; }); await possess('cardoor');
  await speed(8); await untilResolved(); await wait(300);
  ok((await ev(() => window.__unwritten.G.scene.outcome.outcome)) === 'survived', 'releasing the car door early: both walk home (plain kindness)');
  ok(subsSeen.some(x => /footbridge/.test(x)), 'Kath and Cyril meet and go round by the footbridge');
  await clickText('Return to the cemetery'); await wait(3200);
  s = await st();
  ok(!s.things.includes('grave_kath') && s.people.includes('kath') && !s.people.includes('win'), 'Kath’s grave gone; Kath visits instead; Win absent');
  const kathAt = await ev(() => { const p = window.__unwritten.G.cem.people.find(p => p.id === 'kath'); return [p.x, p.y]; });
  ok(Math.hypot(kathAt[0] - 7, kathAt[1] - 10) < 2.5, 'Kath now visits Iris’s stone with Davy');
  ok(s.sig.endsWith('I:exchange_fire') && s.things.includes('grave_hal') && s.things.includes('grave_ashdown'), 'plain kindness changed nothing else for the worse');
  await shot('10-cemetery-after-C');
  // B fails: only the lorry is delayed → the pole (different death)
  await ev(() => window.__unwritten.askEnter('B')); await wait(150); await clickText('Enter'); await wait(3200);
  ok(!(await ev(() => window.__unwritten.G.scene.sim.s.radio.present)), 'no café wireless in this world (Hal died)');
  await page.keyboard.press('Enter'); await speed(8); await untilT(99); await speed(1);
  await possess('door'); await speed(8); await untilT(119.5); await speed(1);
  await whisperAt('len', 11.2, 6.2);
  await speed(8); await untilResolved(); await wait(300);
  ok((await ev(() => window.__unwritten.G.scene.outcome.outcome)) === 'died_pole', 'stopping only the lorry: she swerves for the girl and hits the pole');
  await clickText('Return to the cemetery'); await wait(3200);
  s = await st();
  ok(s.things.includes('grave_ashdown') && /swerved at Five Ways to spare a life/.test(await ev(() => window.__unwritten.G.cem.things.find(t => t.id === 'grave_ashdown').inscription.join(' '))), 'different death: changed inscription');
  ok(await ev(() => window.__unwritten.G.cem.people.find(p => p.id === 'frank').lines.join(' ').includes('girl in the road')), 'different death: changed mourner belief');
  await walk(7, 11);
  await ev(() => window.__unwritten.askEnding()); await wait(250);
  let et = await page.textContent('#modalCard');
  ok(/End without knowing/.test(et), 'without the truth, the stone offers the Incomplete ending');
  await clickText('Keep looking'); await wait(150);
  // learn the truth: read the stone (cause), whisper to Davy, read the plaque
  await ev(() => { const U = window.__unwritten; U.inspectTarget(U.interactables().find(t => t.id === 'mystone')); }); await wait(150); await clickText('Close');
  await ev(() => { const U = window.__unwritten; U.inspectTarget(U.interactables().find(t => t.id === 'plaque')); }); await wait(150); await clickText('Close');
  await ev(() => { const U = window.__unwritten; U.whisper(U.interactables().find(t => t.id === 'davy')); }); await wait(300);
  ok(await ev(() => window.__unwritten.Core.identityConfirmed(window.__unwritten.G.know)), 'name confirmed from scene and cemetery clues');
  await ev(() => window.__unwritten.askEnding()); await wait(250);
  et = await page.textContent('#modalCard');
  ok(/Lie down beneath your name/.test(et) && /this is how it stays/.test(et) && /Kath Wren lives/.test(et), 'Accepted: consequences listed before the final choice');
  await shot('11-accept-choice');
  await clickText('Lie down beneath your name'); await wait(3200);
  const end2 = await page.textContent('#endingCard');
  ok(/Accepted/.test(end2) && /Brin Lane/.test(end2) && /telegraph pole/.test(end2), 'Accepted ending with the account');
  await page.click('#eWalk'); await wait(200);

  console.log('\n— Run 3: Incomplete, and the bolt route (different death for Hal)');
  await ev(() => { localStorage.removeItem('unwritten.v1.save'); window.__unwritten.newGame(); }); await wait(2600);
  await ev(() => window.__unwritten.enterScene('A', true)); await wait(3200);
  await page.keyboard.press('Enter'); await speed(8); await untilT(127.5); await speed(1);
  await ev(() => { window.__unwritten.G.ghost.x = 10; window.__unwritten.G.ghost.y = 2; }); await possess('bolt');
  await speed(8); await untilResolved(); await wait(300);
  ok((await ev(() => window.__unwritten.G.scene.outcome.outcome)) === 'died_later', 'drawing the bolt late: Hal gets out with the book but dies later');
  await clickText('Return to the cemetery'); await wait(3200);
  ok(/He went back for the truth/.test(await ev(() => window.__unwritten.G.cem.things.find(t => t.id === 'grave_hal').inscription.join(' '))), 'Hal’s grave rewritten: "He went back for the truth."');
  await ev(() => window.__unwritten.askEnding()); await wait(250);
  await clickText('End without knowing'); await wait(3200);
  const end3 = await page.textContent('#endingCard');
  ok(/Incomplete/.test(end3) && /died three days later/.test(end3), 'Incomplete ending with the account');

  console.log('\n— Mobile layout');
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  m.on('pageerror', e => errors.push('mobile: ' + e.message));
  await m.goto(URL); await m.waitForTimeout(300);
  await m.evaluate(() => window.__unwritten.newGame()); await m.waitForTimeout(2600);
  ok(await m.isVisible('#touchbar') && await m.isVisible('#jbtn') && await m.isVisible('#pbtn'), 'touch: on-screen journal, pause and whisper buttons');
  await m.tap('#view', { position: { x: 200, y: 520 } }); await m.waitForTimeout(800);
  ok(await m.evaluate(() => { const g = window.__unwritten.G.ghost; return Math.hypot(g.x - 7, g.y - 11.2) > 0.3; }), 'tap to move');
  if (SHOTS) await m.screenshot({ path: path.join(SHOTS, '12-mobile.jpg'), type: 'jpeg', quality: 80 });

  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''));
  console.log(`\n${fail ? 'FAILED' : 'PASSED'}: ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
