#!/usr/bin/env node
// Headless check and screenshots of the arena. Usage: node tools/arena/shots.js <url-of-arena/index.html> <outdir> [scenario]
// Software WebGL is slow, so the game is advanced with AR.debug.sim() between screenshots.
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, only] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { errors.push(m.text()); console.log('console:', m.text().slice(0, 300)); } });
  p.on('pageerror', (e) => { errors.push(e.message); console.log('pageerror:', e.message); });
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'auto=1');
  await p.waitForFunction('window.AR && AR.ready', null, { timeout: 240000 });
  await p.screenshot({ path: out + '/00-title.jpg', quality: 85 });
  await p.evaluate(() => AR.debug.start());
  const shot = async (name, js, secs = 0.5) => {
    if (only && !name.includes(only)) return;
    await p.evaluate(js);
    await p.evaluate((s) => AR.debug.sim(s), secs);
    await p.screenshot({ path: `${out}/${name}.jpg`, quality: 85 });
    console.log(name, JSON.stringify(await p.evaluate(() => AR.debug.state())));
  };
  await shot('01-stage-start', () => {}, 1.0);
  await shot('02-entrance', () => AR.debug.tap('KeyE'), 1.2);
  await shot('03-ramp', () => { AR.debug.place(0, 0.4, -11, Math.PI * 0); AR.debug.setCam(Math.PI, 0.15, 4); }, 0.6);
  await shot('04-ringside', () => { AR.debug.place(0, 0, -4.6, 0); AR.debug.setCam(Math.PI + 0.5, 0.2, 4); }, 0.4);
  await shot('05-climb-in', () => AR.debug.tap('KeyE'), 2.2);
  await shot('06-pose', () => { AR.debug.place(0, 1.2, 0.4, Math.PI); AR.debug.tap('KeyV'); }, 2.0);
  await shot('07-pose-late', () => {}, 1.0);
  await shot('08-wide', () => { AR.debug.setCam(0.8, 0.35, 8); }, 2.5);
  await shot('09-buckle', () => { AR.debug.place(2.2, 1.2, 2.2, 0); AR.debug.tap('KeyE'); }, 1.6);
  await shot('10-buckle-pose', () => AR.debug.tap('KeyV'), 2.0);
  await shot('11-table', () => { AR.debug.place(5.3, 0, -0.6, Math.PI / 2); AR.debug.setCam(-Math.PI / 2 - 0.6, 0.2, 4); }, 0.5);
  await shot('12-champion', () => { AR.debug.place(0, 1.2, -1.2, 0); AR.debug.energy(1); }, 6);
  await shot('13-grab', () => { AR.debug.place(0, 1.2, -0.6, 0); AR.debug.tap('KeyE'); }, 0.8);
  await shot('14-belt-pose', () => { AR.debug.tap('KeyV'); }, 2.5);
  // the other crowd pleasers
  await shot('15-bell', () => { AR.debug.place(5.6, 0, 2.6, Math.PI / 2); AR.debug.tap('KeyE'); }, 1.0);
  await shot('16-promo', () => { AR.debug.place(5.3, 0, -0.6, Math.PI / 2); AR.debug.tap('KeyE'); }, 2.0);
  await shot('17-fives', () => { AR.debug.place(0, 0, 7.0, 0); AR.debug.setCam(Math.PI * 0.75, 0.25, 4); AR.debug.tap('KeyE'); }, 0.6);
  await shot('18-leap', () => { AR.debug.place(-2.2, 1.2, -2.2, 0); AR.debug.tap('KeyE'); AR.debug.sim(1.4); AR.debug.tap('Space'); }, 0.7);
  await shot('19-leap-land', () => {}, 1.6);
  await shot('20-walk', () => { AR.debug.place(0, 0, -6, Math.PI); AR.debug.setCam(0.4, 0.2, 3.6); AR.debug.key('KeyW'); AR.debug.key('ShiftLeft'); }, 1.2);
  await shot('21-entrance-cine', () => { AR.debug.key('KeyW', false); AR.debug.key('ShiftLeft', false); AR.debug.place(0, 1.2, -18.5, 0); AR.debug.reEntrance(); AR.debug.tap('KeyE'); }, 1.6);
  fs.writeFileSync(out + '/errors.txt', errors.join('\n'));
  await b.close();
})();
