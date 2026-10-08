#!/usr/bin/env node
/* Boots the game in headless Chromium (software WebGL), checks for errors, plays a few
   moments of a solo match, split-screen and the tutorial, and saves screenshots.
   node tools/browser-check.js OUTDIR */
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const out = process.argv[2] || 'out/check'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  const t0 = Date.now();
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.LS && LS.Game && LS.Game.match, null, { timeout: 120000 });
  console.log('booted in', Date.now() - t0, 'ms');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, '01-title.png') });
  const step = async (s) => page.evaluate((s) => LS.debug.sim(s), s);
  const mode = process.argv[3] || 'all';
  if (mode === 'all' || mode === 'solo') {
    await page.evaluate(() => LS.Game.startMatch({ players: [{ type: 'hatch' }], difficulty: 'normal' }));
    await step(6); await page.screenshot({ path: path.join(out, '02-circulation.png'), timeout: 120000 });
    await page.evaluate(() => { const m = LS.Game.match; m.phaseLen = m.phaseT + 0.1; });
    await step(8); await page.screenshot({ path: path.join(out, '03-battle.png') });
    await page.evaluate(() => { LS.Game.views[0].mode = 'park'; });
    await step(1); await page.screenshot({ path: path.join(out, '04-parkcam.png') });
    await page.evaluate(() => { LS.Game.views[0].mode = 'chase'; });
    console.log(JSON.stringify(await page.evaluate(() => LS.debug.state())));
  }
  if (mode === 'all' || mode === 'duo') {
    await page.evaluate(() => LS.Game.startMatch({ players: [{ type: 'suv' }, { type: 'van' }], difficulty: 'normal' }));
    await step(5); await page.screenshot({ path: path.join(out, '05-split.png') });
  }
  if (mode === 'all' || mode === 'tutorial') {
    await page.evaluate(() => LS.Game.startTutorial());
    await step(2); await page.screenshot({ path: path.join(out, '06-tutorial.png') });
  }
  console.log(errors.length ? errors.slice(0, 30).join('\n') : 'no console errors');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
