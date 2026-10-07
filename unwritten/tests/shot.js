// Quick screenshot helper: node tests/shot.js <out.png> [js to run after load] [wait ms]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [,, out, script, wait] = process.argv;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug');
  await page.waitForTimeout(400);
  if (script) await page.evaluate(script);
  await page.waitForTimeout(+(wait || 1500));
  await page.screenshot({ path: out });
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await browser.close();
})();
