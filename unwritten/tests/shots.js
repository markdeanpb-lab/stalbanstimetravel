// Multi-step screenshot session. node tests/shots.js <outdir>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug');
  await page.waitForTimeout(300);
  const ev = (s) => page.evaluate(s);
  const shot = async (n) => { await page.screenshot({ path: path.join(out, n + '.png') }); console.log('shot', n); };
  await ev('__unwritten.newGame()');
  await page.waitForTimeout(2500);
  for (const id of (process.argv[3] || 'ABC').split('')) {
    await ev(`__unwritten.startScene('${id}')`);
    await page.waitForTimeout(2600);
    await ev("document.getElementById('hint').classList.add('hidden')");
    await shot('scene' + id + '_inspect');
    await ev(`__unwritten.beginCountdown(); __unwritten.G.timeScale = 8`);
    const at = { A: 116, B: 147, C: 85 }[id];
    await page.waitForFunction((t) => __unwritten.G.scene.sim.s.t >= t, at, { timeout: 60000 });
    await ev('__unwritten.G.timeScale = 0.0001');
    await page.waitForTimeout(300);
    await shot('scene' + id + '_run');
    await ev('__unwritten.G.timeScale = 8');
    await page.waitForFunction(() => __unwritten.G.scene.phase === 'resolved', null, { timeout: 60000 });
    await page.waitForTimeout(1600);
    await shot('scene' + id + '_resolved');
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await browser.close();
})();
