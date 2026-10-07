#!/usr/bin/env node
/* Runs the tutorial in headless Chromium with scripted inputs and checks every step completes. */
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const out = process.argv[2] || 'out/tutorial'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.LS && LS.Game && LS.Game.match, null, { timeout: 120000 });
  await page.evaluate(() => { LS.Game.startTutorial(); LS.Game.paused = true; /* the test steps the game itself */ });
  const step = () => page.evaluate(() => LS.Game.tutorial ? LS.Game.tutorial.step : 99);
  const drive = (inp, secs) => page.evaluate(([inp, secs]) => { const c = LS.Game.tutorial.car; for (let i = 0; i < secs * 30; i++) { Object.assign(c.input, inp); LS.Game.match.step(1 / 30); LS.Game.tutorial.update(1 / 30); if (LS.Game.tutorial.finished) break; } LS.debug.sim(0.05); }, [inp, secs]);
  const log = async (msg) => console.log(msg, '-> step', await step(), JSON.stringify(await page.evaluate(() => { const T = LS.Game.tutorial, c = T.car; return { v: +c.forward.toFixed(1), gear: c.gear, over: c.overturned, rev: T.rev && +T.rev.toFixed(1), touching: c.body.touching, stuck: +c.stuckT.toFixed(1) }; })));
  await drive({ throttle: 1, brake: 0, steer: 0 }, 6); await log('drove to flag');
  await page.screenshot({ path: path.join(out, 't1.png') });
  await drive({ throttle: 0, brake: 1, steer: 0 }, 9); await log('reversed');
  await page.evaluate(() => { const c = LS.Game.tutorial.car.body, p = LS.Game.match.arena.byName['Dalton Street'].line.at(215); c.x = p.x; c.y = p.y; c.setAngle(p.heading); c.vx = Math.cos(p.heading) * 10; c.vy = Math.sin(p.heading) * 10; LS.Game.tutorial.car.gear = 1; }); await drive({ throttle: 1, steer: 1, handbrake: 1, brake: 0 }, 1.2); await drive({ throttle: 0, steer: 0, handbrake: 0, brake: 1 }, 2); await log('handbrake turn');
  // shunt: put the car behind the practice car, facing it, and floor it
  await page.evaluate(() => { const T = LS.Game.tutorial, d = T.dummy, c = T.car.body; c.x = d.x - Math.cos(d.a) * 9; c.y = d.y - Math.sin(d.a) * 9; c.setAngle(d.a); c.vx = c.vy = c.w = 0; });
  await drive({ throttle: 1, brake: 0, steer: 0, handbrake: 0 }, 4); await log('shunted');
  await page.screenshot({ path: path.join(out, 't4.png') });
  // park: drop the car into the space at walking pace (detection is what is being tested)
  await page.evaluate(() => { const T = LS.Game.tutorial, sp = T.space.sp, c = T.car.body; c.x = sp.x; c.y = sp.y; c.setAngle(sp.a); c.vx = c.vy = c.w = 0; });
  await drive({ throttle: 0, brake: 0, steer: 0 }, 3.5); await log('parked');
  await page.screenshot({ path: path.join(out, 't5.png') });
  await drive({ horn: 1 }, 1); await log('horn');
  const done = await page.evaluate(() => !!document.querySelector('.overlay') && document.querySelector('.overlay').textContent.includes('READY'));
  await page.screenshot({ path: path.join(out, 't6.png') });
  console.log(done ? 'TUTORIAL COMPLETE' : 'TUTORIAL NOT COMPLETE', errors.length ? errors : 'no errors');
  await browser.close();
  process.exitCode = done && !errors.length ? 0 : 1;
})();
