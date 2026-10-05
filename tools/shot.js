// Headless screenshot helper: node tools/shot.js <outdir> [script.json]
// Loads game/index.html over a tiny static server, waits for load, then runs steps.
const path = require('path');
const fs = require('fs');
const http = require('http');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.join(__dirname, '..', 'game');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function main() {
  const out = process.argv[2] || 'shots';
  const steps = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const vw = +(process.env.VW || 1280), vh = +(process.env.VH || 720);
  const browser = await playwright.chromium.launch({
    executablePath: process.env.CHROME || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + e.stack));
  const url = `http://127.0.0.1:${port}/index.html${process.env.QS || ''}`;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.SA && window.SA.Game && (window.SA.Game.state !== 'loading' || window.SA.lastError), null, { timeout: 180000 });
  logs.push('[harness] loaded in ' + (Date.now() - t0) + ' ms');
  const err = await page.evaluate(() => window.SA.lastError);
  if (err) logs.push('[harness] lastError: ' + err);
  const run = steps || [{ do: 'shot', name: 'title' }];
  for (const s of run) {
    if (s.do === 'eval') {
      try {
        const r = await page.evaluate(s.js);
        if (r !== undefined) logs.push('[eval] ' + JSON.stringify(r));
      } catch (e) { logs.push('[eval ERROR] ' + e.message.split('\n').slice(0, 4).join(' | ')); }
    } else if (s.do === 'wait') {
      await page.waitForTimeout(s.ms || 500);
    } else if (s.do === 'shot') {
      await page.evaluate(() => { if (window.SA && SA.debug) SA.debug.noRender = false; });
      await page.waitForTimeout(s.settle || 900);
      await page.screenshot({ path: path.join(out, s.name + '.png') });
      await page.evaluate(() => { if (window.SA && SA.debug && window.__fastTest) SA.debug.noRender = true; });
      logs.push('[shot] ' + s.name);
    } else if (s.do === 'key') {
      if (s.down) await page.keyboard.down(s.key);
      else if (s.up) await page.keyboard.up(s.key);
      else await page.keyboard.press(s.key);
    } else if (s.do === 'state') {
      try {
        const st = await page.evaluate(() => window.SA.debug && window.SA.debug.state());
        logs.push('[state] ' + JSON.stringify(st));
      } catch (e) { logs.push('[state ERROR] ' + e.message.split('\n').slice(0, 4).join(' | ')); }
    } else if (s.do === 'waitFor') {
      try { await page.waitForFunction(s.js, null, { timeout: s.timeout || 30000 }); logs.push('[waitFor ok] ' + (s.label || '')); }
      catch (e) { logs.push('[waitFor TIMEOUT] ' + (s.label || s.js)); }
    } else if (s.do === 'tap') {
      await page.touchscreen.tap(s.x, s.y);
    } else if (s.do === 'click') {
      await page.mouse.click(s.x, s.y);
    }
  }
  fs.writeFileSync(path.join(out, 'log.txt'), logs.join('\n'));
  console.log(logs.slice(-60).join('\n'));
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
