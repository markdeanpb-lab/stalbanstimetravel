#!/usr/bin/env node
/* Plays a whole solo match in headless Chromium (the player's car on autopilot) through to the
   results screen, checking it never gets stuck. node tools/browser-match.js OUTDIR [type] */
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const out = process.argv[2] || 'out/match'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.LS && LS.Game && LS.Game.match, null, { timeout: 120000 });
  await page.evaluate((t) => { LS.Game.startMatch({ players: [{ type: t }], difficulty: 'normal' }); LS.debug.autopilot('nearest'); }, process.argv[3] || 'hatch');
  let last = '', shots = 0;
  for (let i = 0; i < 400; i++) {
    await page.evaluate(() => LS.debug.sim(2));
    const st = await page.evaluate(() => ({ s: LS.debug.state(), g: LS.Game.state, ui: !!document.querySelector('.resultsov') }));
    const key = st.s.phase + st.s.round;
    if (key !== last) { console.log(`t=${st.s.time.toFixed(0)}s ${st.s.phase} round ${st.s.round} alive ${st.s.alive} you=${st.s.cars[0].status}${st.s.cars[0].parked ? ' parked' : ''}`); last = key;
      if (['battle', 'finale', 'sudden'].includes(st.s.phase) && shots < 8) await page.screenshot({ path: path.join(out, `m${String(shots++).padStart(2, '0')}-${st.s.phase}.png`) }); }
    if (st.ui) { await page.screenshot({ path: path.join(out, 'results.png') }); console.log('RESULTS after', (st.s.time / 60).toFixed(2), 'min'); break; }
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 20).join('\n') : 'no errors');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
