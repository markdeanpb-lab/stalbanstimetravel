#!/usr/bin/env node
/* Phone check: landscape phone viewport with touch, real multi-touch through the DevTools protocol.
   Holds GO and drags the steering pad at the same time, then brakes into reverse, and checks the
   car responds. Saves screenshots of the controls in play, the title and the tutorial.
   node tools/browser-touch.js OUTDIR */
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const out = process.argv[2] || 'out/touch'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.LS && LS.Game && LS.Game.match, null, { timeout: 120000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'phone-title.png') });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] != null ? p[2] : i })) });
  const centre = async (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.top, r.height]; }, sel);
  // start a solo match from the menus by tapping, like a player would
  const tapEl = async (sel) => { const c = await centre(sel); await touch('touchStart', [[c[0], c[1]]]); await touch('touchEnd', []); await page.waitForTimeout(150); };
  await tapEl('[data-act=solo]');
  await tapEl('.vcard[data-t="hatch"]');
  await tapEl('[data-act=go]');
  const shown = await page.waitForFunction(() => document.body.classList.contains('touch-play'), null, { timeout: 20000 }).then(() => true, () => false);
  console.log('touch controls shown in play:', shown);
  // skip the countdown so the car can move
  await page.evaluate(() => { const m = LS.Game.match; m.phaseLen = 0; });
  await page.waitForFunction(() => LS.Game.match.phase === 'circulation', null, { timeout: 20000 });
  const st = () => page.evaluate(() => { const c = LS.Game.match.humans[0]; return { v: +c.forward.toFixed(2), steer: +c.steerAngle.toFixed(2), gear: c.gear, a: +c.a.toFixed(2), x: +c.x.toFixed(1), y: +c.y.toFixed(1) }; });
  // software rendering is slow: wait on game time, not wall-clock time
  const waitSim = async (sec) => { const t0 = await page.evaluate(() => LS.Game.match.time); await page.waitForFunction((t) => LS.Game.match.time > t, t0 + sec, { timeout: 240000, polling: 100 }); };
  const before = await st();
  const go = await centre('#t-go'), pad = await centre('#t-steer');
  // GO near the top of the pedal (full power) with one finger, steering right with another
  await touch('touchStart', [[go[0], go[2] + go[3] * 0.15, 1]]);
  await touch('touchStart', [[go[0], go[2] + go[3] * 0.15, 1], [pad[0], pad[1], 2]]);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', [[go[0], go[2] + go[3] * 0.15, 1], [pad[0] + k * 12, pad[1], 2]]); await page.waitForTimeout(120); }
  await waitSim(2.5);
  const driving = await st();
  await page.screenshot({ path: path.join(out, 'phone-driving.png') });
  await touch('touchEnd', []);
  // brake, keep holding: reverse
  const br = await centre('#t-brake');
  await touch('touchStart', [[br[0], br[1], 3]]);
  await waitSim(3.5);
  const reversing = await st();
  await touch('touchEnd', []);
  console.log('before', JSON.stringify(before), '\ndriving (GO + steer right)', JSON.stringify(driving), '\nafter holding BRAKE', JSON.stringify(reversing));
  const moved = Math.hypot(driving.x - before.x, driving.y - before.y);
  console.log('moved under GO:', moved.toFixed(1), 'm; turned', (driving.a - before.a).toFixed(2), 'rad (negative = right)');
  const ok = shown && moved > 3 && driving.a < before.a && driving.steer < -0.05 && reversing.gear === -1;
  // tutorial in touch wording
  await page.evaluate(() => LS.Game.startTutorial());
  await page.waitForTimeout(1500);
  const tut = await page.evaluate(() => document.querySelector('#tutpanel p').textContent);
  console.log('tutorial step 1:', tut);
  await page.screenshot({ path: path.join(out, 'phone-tutorial.png') });
  console.log(ok ? 'TOUCH OK' : 'TOUCH FAILED', errors.length ? errors : 'no errors');
  process.exitCode = ok && !errors.length ? 0 : 1;
  await browser.close();
})();
