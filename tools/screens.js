// Documentation screenshots: the same views in each year, the consequence on French Row,
// the time wave mid-transition, the title screen and the phone layout.
// Usage: node tools/screens.js <outdir>   (writes JPEGs; docs/screenshots holds the published set)
const path = require('path');
const fs = require('fs');
const http = require('http');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.join(__dirname, '..', 'game');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// camera views (game coordinates: x east, z south; heights are above the ground at the camera)
const VIEWS = `
window.VIEWS = () => {
  const L = SA.Landmarks, T = SA.Terrain;
  const ct = L.clockTowerInfo, cf = L.clockFace, wf = L.westFront, th = L.townHallInfo, gw = L.gatewayInfo;
  const v = (id, x, z, h, tx, ty, tz) => ({ id, x, z, y: T.height(x, z) + h, tx, ty, tz });
  return [
    v('clock-tower', ct.x + cf.nx * 17 + 6, ct.z + cf.nz * 17 + 3, 1.8, ct.x, ct.base + 10, ct.z),
    v('french-row', 24.5, -40, 1.8, -4, T.height(-4, -7) + 5, -7),
    v('high-street', -38, 6, 2.2, 40, T.height(40, 42) + 3, 42),
    v('st-peters-street', 100, -112, 2.6, 175, T.height(175, -210) + 3, -210),
    v('town-hall', th.x + th.nx * 10 + th.nz * 4, th.z + th.nz * 10 - th.nx * 4, 1.7, th.x - th.nx * 5, th.floor + 6.5, th.z - th.nz * 5),
    v('george-street', -60, -2, 2.0, -150, T.height(-150, -35) + 2, -35),
    v('cathedral-west-front', wf.x + wf.nx * 26, wf.z + wf.nz * 26, 1.8, wf.x - wf.nx * 10, T.height(wf.x, wf.z) + 13, wf.z - wf.nz * 10),
    gatewayView(),
  ];
};
// look through the Abbey Gateway arch along Abbey Mill Lane, from whichever side is open ground
window.gatewayView = () => {
  const gw = SA.Landmarks.gatewayInfo, T = SA.Terrain;
  const lane = SA.World.nearestRoad(gw.x, gw.z, (r) => r.n === 'Abbey Mill Lane', 30);
  let dx = 0, dz = 1;
  if (lane) {
    dx = lane.b[0] - lane.a[0];
    dz = lane.b[1] - lane.a[1];
    const l = Math.hypot(dx, dz);
    dx /= l;
    dz /= l;
  }
  let best = null;
  for (const sg of [1, -1]) {
    const x = gw.x + dx * 17 * sg, z = gw.z + dz * 17 * sg;
    const s = SA.World.findSafe(SA.Game.era, x, z, { r: 0.5 });
    const moved = Math.hypot(s.x - x, s.z - z) + (SA.World.inDistrict(x, z) ? 0 : 50);
    if (!best || moved < best.moved) best = { x: s.x, z: s.z, moved };
  }
  return { id: 'abbey-gateway', x: best.x, z: best.z, y: T.height(best.x, best.z) + 1.7, tx: gw.x, ty: gw.base + 4.5, tz: gw.z };
};
window.shopView = (era) => {
  // stand as far across French Row as the far wall allows, a little along the street, and
  // look at the middle of the shop's front, where its fascia sign hangs
  const d = SA.World.roleDoor(era, 'pennick', 'French Row');
  const sp = d.spec, n = sp.pts.length;
  const a = sp.pts[d.edge], b = sp.pts[(d.edge + 1) % n];
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
  const col = SA.World.eras[era].col;
  let best = null;
  for (const along of [4.5, -4.5, 3, -3]) {
    for (const k of [3.6, 3.2, 2.8, 2.4, 2.0]) {
      const x = mx + d.nx * k - d.nz * along, z = mz + d.nz * k + d.nx * along;
      if (col.isFree(x, z, 0.4, 'walk')) { if (!best || k > best.k) best = { x, z, k }; break; }
    }
  }
  best = best || { x: mx + d.nx * 2, z: mz + d.nz * 2 };
  const g = SA.Terrain.height(mx, mz);
  return { x: best.x, z: best.z, y: SA.Terrain.height(best.x, best.z) + 1.8, tx: mx, ty: g + 3.1, tz: mz };
};
window.plaqueView = () => {
  const ct = SA.Landmarks.clockTowerInfo, cf = SA.Landmarks.clockFace;
  const px = cf.x + cf.nx * 0.36 + cf.nz * 1.6, pz = cf.z + cf.nz * 0.36 - cf.nx * 1.6, py = ct.base + 2.6;
  const x = px + cf.nx * 4.2 + cf.nz * 1.5, z = pz + cf.nz * 4.2 - cf.nx * 1.5;
  return { x, z, y: SA.Terrain.height(x, z) + 1.7, tx: px, ty: py, tz: pz };
};
window.hideHud = (on) => { for (const id of ['hud', 'touch', 'obj-marker']) { const el = document.getElementById(id); if (el) el.style.visibility = on ? 'hidden' : ''; } };
window.frame = async (vw) => {
  // keep the player out of shot (behind the camera) and frame the view
  const dx = vw.tx - vw.x, dz = vw.tz - vw.z, l = Math.hypot(dx, dz) || 1;
  const s = SA.World.findSafe(SA.Game.era, vw.x - dx / l * 6, vw.z - dz / l * 6, { r: 0.4 });
  SA.debug.teleport(s.x, s.z);
  SA.debug.look(vw.x, vw.y, vw.z, vw.tx, vw.ty, vw.tz);
  SA.debug.sim(0.6);
};
1;`;

async function main() {
  const out = process.argv[2] || 'screens-out';
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const url = `http://127.0.0.1:${port}/index.html`;
  const errors = [];

  async function open(w, h, touch) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.SA && SA.Game && SA.Game.state === 'title', null, { timeout: 180000 });
    await page.evaluate(() => SA.Save.clear());
    await page.evaluate(VIEWS);
    return { ctx, page };
  }
  async function snap(page, name, settle) {
    await page.evaluate(() => { SA.debug.noRender = false; });
    await page.waitForTimeout(settle || 1500);
    await page.screenshot({ path: path.join(out, name + '.jpg'), type: 'jpeg', quality: 80 });
    await page.evaluate(() => { SA.debug.noRender = true; });
    console.log('shot', name);
  }
  const skip = async (page) => page.evaluate(() => { for (let i = 0; i < 40; i++) { if (SA.Dialogue.busy()) SA.Dialogue.skipAll(); SA.debug.sim(0.1); } });

  // ---------------------------------------------------------------- desktop views, every era
  {
    const { ctx, page } = await open(1280, 720);
    await snap(page, 'title', 2500);
    await page.evaluate(() => { document.getElementById('btn-new').click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { SA.debug.noRender = true; window.__fastTest = true; });
    await skip(page);
    await page.evaluate(() => { SA.Mission.reset(); hideHud(true); });
    const ids = await page.evaluate(() => VIEWS().map((v) => v.id));
    for (const era of [2026, 1964, 1897]) {
      await page.evaluate((era) => { SA.debug.era(era); SA.Police.clear(); SA.debug.sim(1); }, era);
      for (let i = 0; i < ids.length; i++) {
        await page.evaluate((i) => frame(VIEWS()[i]), i);
        await snap(page, `${era}-${ids[i]}`);
      }
    }
    // the consequence on French Row: before, and after each choice
    const variants = [['before', {}], ['returned', { fund_outcome: 'returned', josiah_cleared: true, crabbe_fate: 'jailed' }], ['dinner', { fund_outcome: 'dinner', josiah_cleared: false, crabbe_fate: 'fled' }]];
    for (const [name, flags] of variants) {
      await page.evaluate(async (flags) => {
        SA.Game.flags = Object.assign({}, flags);
        SA.Game.rebuildEra(2026);
        SA.Game.rebuildEra(1964);
        SA.debug.era(2026);
        SA.debug.sim(0.5);
      }, flags);
      for (const era of name === 'before' ? [2026, 1964] : [2026, 1964]) {
        await page.evaluate((era) => { SA.debug.era(era); SA.debug.sim(0.5); frame(shopView(era)); }, era);
        await snap(page, `consequence-${era}-french-row-${name}`);
      }
    }
    // the Clock Tower plaque and the Jubilee lamp (Town Hall ending), 2026
    await page.evaluate(() => {
      SA.Game.flags = { fund_outcome: 'returned', josiah_cleared: true, crabbe_fate: 'jailed' };
      SA.Game.rebuildEra(2026);
      SA.debug.era(2026);
      frame(plaqueView());
    });
    await snap(page, 'consequence-2026-clock-tower-plaque');
    // the time wave: 2026 folding into 1897 around the Clock Tower
    await page.evaluate(() => {
      SA.Game.flags = {};
      SA.Game.rebuildEra(2026);
      SA.Game.rebuildEra(1964);
      SA.debug.era(2026);
      const ct = SA.Landmarks.clockTowerInfo, cf = SA.Landmarks.clockFace;
      const s = SA.World.findSafe(2026, ct.x + cf.nx * 6, ct.z + cf.nz * 6, { r: 0.5 });
      SA.debug.teleport(s.x, s.z);
      SA.debug.sim(0.3);
      SA.TimeKey.owned = true;
      SA.TimeKey.locked = false;
      SA.TimeKey.restUntil = 0;
      SA.TimeKey.jumps = 1;
      SA.TimeKey.jump(1897);
      SA.debug.sim(2.0);
      const x = ct.x + cf.nx * 46 + 20, z = ct.z + cf.nz * 46 + 10;
      SA.debug.look(x, SA.Terrain.height(x, z) + 14, z, ct.x, ct.base + 6, ct.z);
      SA.debug.sim(0.1);
    });
    await snap(page, 'time-wave-2026-to-1897', 600);
    await ctx.close();
  }
  // ---------------------------------------------------------------- phone layout with touch controls
  for (const era of [1964, 1897]) {
    const { ctx, page } = await open(915, 412, true);
    await page.evaluate(() => { document.getElementById('btn-new').click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { SA.debug.noRender = true; window.__fastTest = true; });
    await skip(page);
    await page.evaluate((era) => {
      SA.Mission.reset();
      SA.debug.era(era);
      SA.TimeKey.owned = true;
      SA.TimeKey.locked = false;
      SA.TimeKey.allowed = [1897, 1964, 2026];
      SA.Player.setOutfit(era === 1897 ? 'victorian' : 'mod1964');
      const pos = era === 1964 ? [110, -128] : [-8, 8];
      const s = SA.World.findSafe(era, pos[0], pos[1], { r: 0.5 });
      SA.debug.teleport(s.x, s.z, era === 1964 ? 2.6 : 0.6);
      if (era === 1964) {
        const v = SA.Vehicles.create('scooter', s.x + 1.5, s.z + 1, 2.6, { era, parked: true });
        void v;
      }
      SA.debug.sim(1.5);
    }, era);
    await snap(page, `phone-${era}`);
    await ctx.close();
  }
  console.log(errors.length ? 'errors: ' + errors.slice(0, 5).join(' | ') : 'no page errors');
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
