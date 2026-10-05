// Automated verification for Milestone 1. Usage: node tools/verify.js <outdir>
// Runs headless Chromium (SwiftShader) against game/ over a local static server.
// Uses SA.debug.sim() to advance the simulation deterministically (rendering is paused
// between screenshots because software WebGL is far slower than a phone GPU).
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

const HELPERS = `
window.__fastTest = true; SA.debug.noRender = true;
window.tick = () => new Promise((r) => setTimeout(r, 0));
window.skipAll = async (n) => { for (let i = 0; i < (n || 40); i++) { if (SA.Dialogue.busy()) SA.Dialogue.skipAll(); SA.debug.sim(0.12); await tick(); } };
window.simA = async (secs) => { for (let t = 0; t < secs; t += 0.5) { SA.debug.sim(0.5); await tick(); } };
window.tp = (x, z, yaw) => { SA.debug.teleport(x, z, yaw); SA.debug.sim(0.2); };
window.insideBuilding = (x, z) => { const p = SA.World.current.col.polyAt(x, z); return !!(p && p.tag !== 'barrier' && !(SA.Landmarks.inPassage(x, z, SA.World.current.col.passages || []))); };
1;`;

async function main() {
  const out = process.argv[2] || 'verify-out';
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  const external = []; // any request that leaves the local server (the game must make none)
  const watchRequests = (page) => page.on('request', (r) => { const u = r.url(); if (!/^(http:\/\/127\.0\.0\.1|data:|blob:|file:)/.test(u)) external.push(u); });
  const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); };

  async function open(opts) {
    opts = opts || {};
    const ctx = await browser.newContext({ viewport: { width: opts.w || 960, height: opts.h || 540 }, deviceScaleFactor: 1, hasTouch: !!opts.touch, isMobile: !!opts.touch });
    const page = await ctx.newPage();
    watchRequests(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/index.html${opts.qs || ''}`);
    await page.waitForFunction(() => window.SA && SA.Game && SA.Game.state === 'title', null, { timeout: 180000 });
    if (opts.clearSave) await page.evaluate(() => SA.Save.clear());
    await page.evaluate(HELPERS);
    return { ctx, page, errors };
  }
  async function shot(page, name) {
    await page.evaluate(() => { SA.debug.noRender = false; });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, name + '.png') });
    await page.evaluate(() => { SA.debug.noRender = true; });
  }

  // ------------------------------------------------------------------ 1. movement & collision sweep (all eras)
  {
    const { ctx, page, errors } = await open({ clearSave: true });
    await page.evaluate(() => document.getElementById('btn-new').click());
    await page.waitForTimeout(500);
    for (const era of [2026, 1964, 1897]) {
      const r = await page.evaluate(async (era) => {
        await skipAll(5);
        SA.debug.era(era);
        SA.Mission.reset();
        const g = SA.World.current.ped;
        const rng = SA.U.rng(era);
        let samples = 0, inside = 0, stuckFalls = 0, maxDy = 0;
        for (let k = 0; k < 24; k++) {
          const n = g.main[Math.floor(rng() * g.main.length)];
          tp(n.x, n.z, rng() * 6.28);
          const ang = rng() * Math.PI * 2;
          SA.debug.setCam(ang, 0.3);
          SA.Input.setAutoMove(0, 1);
          SA.Input.hold('sprint', rng() < 0.5);
          for (let i = 0; i < 40; i++) {
            SA.debug.sim(0.1);
            const c = SA.Player.ch;
            samples++;
            if (insideBuilding(c.x, c.z)) inside++;
            const gy = SA.Terrain.height(c.x, c.z);
            maxDy = Math.max(maxDy, Math.abs(c.y - gy));
            if (!isFinite(c.x) || !isFinite(c.y)) stuckFalls++;
          }
          SA.Input.setAutoMove(null);
          SA.Input.hold('sprint', false);
        }
        return { samples, inside, maxDy: +maxDy.toFixed(3), nan: stuckFalls };
      }, era);
      rec(`Movement & collision sweep ${era} (24 random runs, walls never penetrated, feet on ground)`, r.inside === 0 && r.maxDy < 0.35 && r.nan === 0, r);
    }
    // ------------------------------------------------------------------ 2. camera in narrow streets
    const cam = await page.evaluate(async () => {
      SA.debug.era(2026);
      const res = [];
      // French Row (~5 m wide), Boot Alley and the Waxhouse Gate passage
      for (const [name, x, z] of [['French Row', 12, -30], ['Market Place alley', 40, -10], ['Waxhouse Gate passage', -17, 27], ['George Street', -100, -20]]) {
        const s = SA.World.findSafe(2026, x, z, { r: 0.4 });
        tp(s.x, s.z, 0);
        let worst = 0, insideCount = 0, minD = 99;
        for (let a = 0; a < 16; a++) {
          SA.debug.setCam((a / 16) * Math.PI * 2, 0.25);
          SA.debug.sim(0.5);
          const st = SA.debug.state();
          if (insideBuilding(st.cam.x, st.cam.z)) insideCount++;
          minD = Math.min(minD, st.cam.dist);
        }
        res.push({ name, insideCount, minDist: minD });
      }
      return res;
    });
    rec('Camera never ends up inside a building in narrow streets (16 angles × 4 places)', cam.every((c) => c.insideCount === 0), cam);
    await page.evaluate(() => { const s = SA.World.findSafe(2026, 12, -30, { r: 0.4 }); tp(s.x, s.z, 0); SA.debug.setCam(Math.PI * 0.95, 0.2); SA.debug.sim(1); });
    await shot(page, 'verify_camera_french_row');

    // ------------------------------------------------------------------ 3. vehicles: enter/exit and slopes (George Street hill)
    for (const [era, type] of [[2026, 'hatch'], [1964, 'scooter'], [1897, 'bicycle'], [1897, 'cart']]) {
      const r = await page.evaluate(async ([era, type]) => {
        SA.debug.era(era);
        SA.Police.clear();
        SA.Traffic.clearEra(); // no AI traffic in the way, so runs are repeatable
        // George Street, on the centre line of its long straight stretch (about 100 m between the
        // bend below the High Street junction and Romeland), heading downhill towards Romeland
        const nr = SA.World.nearestRoad(-94, -15, (rd) => rd.n === 'George Street', 20);
        let ux = -70, uz = -28;
        const ul = Math.hypot(ux, uz);
        ux /= ul;
        uz /= ul;
        if (SA.Terrain.height(nr.x + ux * 10, nr.z + uz * 10) > SA.Terrain.height(nr.x - ux * 10, nr.z - uz * 10)) { ux = -ux; uz = -uz; }
        const s = { x: nr.x, z: nr.z };
        const down = Math.atan2(ux, uz);
        const v = SA.Vehicles.create(type, s.x, s.z, down, { era, parked: true });
        tp(v.x + 1.6, v.z + 1.6);
        SA.Input.tap('vehicle');
        SA.debug.sim(0.3);
        const entered = SA.Player.vehicle === v;
        const place = (yaw, speed) => { v.x = s.x; v.z = s.z; v.yaw = yaw; v.speed = speed; v.y = SA.Terrain.height(s.x, s.z); };
        SA.Input.setAutoMove(0, 0);
        // a stopped vehicle with no input holds on the slope (no creeping)
        place(down, 0);
        SA.debug.sim(2);
        const creep = Math.hypot(v.x - s.x, v.z - s.z);
        // coasting: gravity keeps more speed downhill than uphill
        place(down, 6);
        SA.debug.sim(2.5);
        const coastDown = v.speed;
        place(down + Math.PI, 6);
        SA.debug.sim(2.5);
        const coastUp = v.speed;
        // drive down the hill
        place(down, 0);
        const y0 = v.y;
        SA.Input.setAutoMove(0, 1);
        let maxSpeed = 0, offGround = 0;
        for (let i = 0; i < 50; i++) {
          SA.debug.sim(0.1);
          maxSpeed = Math.max(maxSpeed, v.speed);
          if (Math.abs(v.y - SA.Terrain.height(v.x, v.z)) > 0.5) offGround++;
        }
        const dropped = y0 - v.y;
        // turn round and climb back up
        v.speed = 0;
        v.yaw += Math.PI;
        const yb = v.y;
        for (let i = 0; i < 50; i++) {
          SA.debug.sim(0.1);
          if (Math.abs(v.y - SA.Terrain.height(v.x, v.z)) > 0.5) offGround++;
        }
        const climbed = v.y - yb;
        // brake, stop, get off
        SA.Input.setAutoMove(0, -1);
        SA.Input.hold('brake', true);
        SA.debug.sim(2.5);
        SA.Input.hold('brake', false);
        SA.Input.setAutoMove(null);
        const stopped = Math.abs(v.speed) < 1.5;
        SA.Input.tap('vehicle');
        SA.debug.sim(0.4);
        const exited = !SA.Player.vehicle;
        const stand = SA.World.current.col.isFree(SA.Player.ch.x, SA.Player.ch.z, 0.3, 'walk');
        SA.Vehicles.remove(v);
        SA.Traffic.spawnEra(era);
        const f = (x) => +x.toFixed(2);
        return { grade: f((SA.Terrain.height(s.x - ux * 8, s.z - uz * 8) - SA.Terrain.height(s.x + ux * 8, s.z + uz * 8)) / 16 * 100) + '%', entered, creep: f(creep), coastDown: f(coastDown), coastUp: f(coastUp), maxSpeed: f(maxSpeed), dropped: f(dropped), climbed: f(climbed), offGround, stopped, exited, standFree: stand };
      }, [era, type]);
      rec(`Vehicle ${type} (${era}) on the George Street slope: enter, holds when parked, coasts further downhill than up, drives down, climbs back, exits to a free spot`,
        r.entered && r.exited && r.standFree && r.offGround === 0 && r.creep < 0.2 && r.coastDown > r.coastUp + 0.3 && r.maxSpeed > 2 && r.dropped > 0.3 && r.climbed > 0.3, r);
    }
    // ------------------------------------------------------------------ 4. time travel: every era pair + blocked arrivals
    const pairs = [[2026, 1964], [1964, 1897], [1897, 2026], [2026, 1897], [1897, 1964], [1964, 2026]];
    for (const [a, b] of pairs) {
      const r = await page.evaluate(async ([a, b]) => {
        SA.debug.era(a);
        SA.Police.clear();
        SA.Police.perEra = {};
        SA.TimeKey.owned = true;
        SA.TimeKey.locked = false;
        SA.TimeKey.allowed = [1897, 1964, 2026];
        SA.TimeKey.restUntil = 0;
        SA.TimeKey.target = b;
        SA.TimeKey.suggested = b;
        const ct = SA.Landmarks.clockTowerInfo;
        const s = SA.World.findSafe(a, ct.x + 12, ct.z + 10, { r: 0.5 });
        tp(s.x, s.z);
        SA.Input.hold('timekey', true);
        await simA(3);
        SA.Input.hold('timekey', false);
        await simA(8);
        const st = SA.debug.state();
        return { era: st.era, rest: st.key.rest, inside: insideBuilding(st.x, st.z), trans: st.key.trans };
      }, [a, b]);
      rec(`Jump ${a} -> ${b} completes, rest timer set, lands on open ground`, r.era === b && !r.trans && r.rest > 30 && !r.inside, r);
    }
    // blocked arrival: inside a building of the target era (Christopher Place exists only in 2026)
    const blocked = await page.evaluate(async () => {
      const out = {};
      // pick a point inside a 2026 Christopher Place building but open ground (car park) in 1964
      SA.debug.era(1964);
      SA.Police.clear();
      SA.Police.perEra = {};
      let pt = null;
      const spec = SA.World.eras[2026].specs.find((sp) => sp.id === SA.World.ID.christopherCentre) || SA.World.eras[2026].specs.find((sp) => SA.U.pointInPoly(SA.U.polyCentroid(sp.pts)[0], SA.U.polyCentroid(sp.pts)[1], SA.World.CHRISTOPHER));
      const c = SA.U.polyCentroid(spec.pts);
      pt = SA.World.findSafe(1964, c[0], c[1], { r: 0.5 });
      // ensure the 1964 point is inside the 2026 building footprint
      out.pointInside2026 = SA.World.eras[2026].col.polyAt(pt.x, pt.z) !== null;
      tp(pt.x, pt.z);
      SA.TimeKey.owned = true; SA.TimeKey.locked = false; SA.TimeKey.restUntil = 0; SA.TimeKey.target = 2026; SA.TimeKey.allowed = [1897, 1964, 2026];
      let slip = null;
      const off = SA.on('slip', (reason, moved) => { slip = { reason, moved: +moved.toFixed(1) }; });
      SA.Input.hold('timekey', true);
      await simA(3);
      SA.Input.hold('timekey', false);
      await simA(5);
      off();
      const st = SA.debug.state();
      out.slip = slip;
      out.era = st.era;
      out.nowInside = insideBuilding(st.x, st.z);
      // blocked by a vehicle: park a van exactly where the player stands in the target era
      SA.TimeKey.restUntil = 0; SA.TimeKey.target = 1964;
      SA.Police.clear();
      SA.Police.perEra = {};
      const ct = SA.Landmarks.clockTowerInfo;
      const s2 = SA.World.findSafe(2026, ct.x + 10, ct.z + 12, { r: 0.6 });
      tp(s2.x, s2.z);
      out.statusBeforeVehicleTest = SA.TimeKey.status().code;
      SA.TimeKey.beforeArrive = (target, x, z) => { SA.Vehicles.create('van60', x, z, 0, { era: 1964, parked: true }); SA.TimeKey.beforeArrive = null; };
      let slip2 = null;
      const off2 = SA.on('slip', (reason, moved) => { slip2 = { reason, moved: +moved.toFixed(1) }; });
      SA.Input.hold('timekey', true);
      await simA(3);
      SA.Input.hold('timekey', false);
      await simA(5);
      off2();
      out.vehicleSlip = slip2;
      return out;
    });
    rec('Blocked arrival inside a building slips to safe ground with a message', blocked.pointInside2026 && blocked.slip && blocked.slip.reason === 'building' && !blocked.nowInside, blocked);
    rec('Blocked arrival on a parked vehicle slips aside with a message', blocked.vehicleSlip && blocked.vehicleSlip.reason === 'vehicle', { slip: blocked.vehicleSlip, keyBefore: blocked.statusBeforeVehicleTest });
    // blocked by traffic: land on the High Street carriageway with a car coming in the target year
    const road = await page.evaluate(async () => {
      SA.debug.era(2026);
      SA.Police.clear();
      SA.Police.perEra = {};
      SA.Traffic.clearEra();
      const nr = SA.World.nearestRoad(21.5, 34, (r) => r.n === 'High Street', 10);
      let ux = nr.b[0] - nr.a[0], uz = nr.b[1] - nr.a[1];
      const ul = Math.hypot(ux, uz);
      ux /= ul;
      uz /= ul;
      tp(nr.x, nr.z);
      const onRoad = (x, z) => { const r = SA.World.nearestRoad(x, z, (rd) => SA.Terrain.isCarriageway(rd) && rd.t !== 'service', 6); return !!(r && r.d < SA.Terrain.roadWidth(r.road) / 2); };
      const startOnRoad = onRoad(SA.Player.ch.x, SA.Player.ch.z);
      SA.TimeKey.owned = true; SA.TimeKey.locked = false; SA.TimeKey.restUntil = 0; SA.TimeKey.target = 1964; SA.TimeKey.allowed = [1897, 1964, 2026];
      SA.TimeKey.beforeArrive = (target, x, z) => {
        SA.Traffic.clearEra();
        const v = SA.Vehicles.create('saloon60', x - ux * 16, z - uz * 16, Math.atan2(ux, uz), { era: target });
        v.speed = 7;
        SA.TimeKey.beforeArrive = null;
      };
      let slip = null;
      const off = SA.on('slip', (reason, moved) => { slip = { reason, moved: +moved.toFixed(1) }; });
      SA.Input.hold('timekey', true);
      await simA(3);
      SA.Input.hold('timekey', false);
      await simA(5);
      off();
      SA.Traffic.spawnEra(SA.Game.era);
      return { startOnRoad, slip, era: SA.Game.era, endOnRoad: onRoad(SA.Player.ch.x, SA.Player.ch.z) };
    });
    rec('Blocked arrival in the road with traffic coming slips onto the pavement with a message', road.startOnRoad && road.slip && road.slip.reason === 'road' && !road.endOnRoad && road.era === 1964, road);
    // key refuses while wanted / in vehicle / moving
    const rules = await page.evaluate(async () => {
      SA.debug.era(2026);
      SA.TimeKey.restUntil = 0;
      const ct = SA.Landmarks.clockTowerInfo;
      const s = SA.World.findSafe(2026, ct.x + 10, ct.z + 12, { r: 0.6 });
      tp(s.x, s.z);
      SA.Police.setLevel(1, 'test');
      const wanted = SA.TimeKey.status().code;
      SA.Police.clear();
      SA.TimeKey.restUntil = SA.Game.time + 30;
      const rest = SA.TimeKey.status().code;
      SA.TimeKey.restUntil = 0;
      return { wanted, rest, ready: SA.TimeKey.status().code };
    });
    rec('Key rules enforced: refuses while wanted and while resting', rules.wanted === 'chased' && rules.rest === 'rest' && rules.ready === 'ready', rules);
    // ------------------------------------------------------------------ 5. wanted level escalates and can be escaped
    const pol = await page.evaluate(async () => {
      SA.debug.era(1897);
      const th = SA.Landmarks.townHallInfo;
      const s = SA.World.findSafe(1897, th.x + th.nx * 15, th.z + th.nz * 15, { r: 0.5 });
      tp(s.x, s.z);
      SA.Police.cooldown = 0;
      SA.Police.addHeat(1.2);
      const l1 = SA.Police.level;
      SA.Police.addHeat(1.0);
      const l2 = SA.Police.level;
      const units = SA.Police.units.length;
      // hide: teleport far away behind buildings (Waxhouse Gate passage) and wait
      const h = SA.World.findSafe(1897, -17, 40, { r: 0.4 });
      tp(h.x, h.z);
      for (const u of SA.Police.units) if (u.kind === 'foot') { u.ch.x = th.x + th.nx * 30; u.ch.z = th.z + th.nz * 30; }
      let lvl = SA.Police.level, t = 0;
      while (SA.Police.level > 0 && t < 90) { SA.debug.sim(1); t++; }
      return { l1, l2, units, escapedAfter: t, final: SA.Police.level };
    });
    rec('Wanted level escalates (1 -> 2, units dispatched) and decays once out of sight', pol.l1 >= 1 && pol.l2 >= 2 && pol.units >= 2 && pol.final === 0, pol);
    const ers = await page.evaluate(() => SA.lastError);
    rec('No runtime errors during sweeps', !ers && errors.length === 0, ers || errors.slice(0, 5));
    await ctx.close();
  }

  // ------------------------------------------------------------------ 6. save & reload preserves the consequence
  {
    const { ctx, page } = await open({ clearSave: true });
    const r1 = await page.evaluate(async () => {
      document.getElementById('btn-new').click();
      await simA(1);
      await skipAll(10);
      SA.Mission.goto('free');
      SA.Flags.set('fund_outcome', 'returned');
      SA.Flags.set('josiah_cleared', true);
      SA.Game.save(true);
      const code = SA.Save.encode(SA.Game.serialize());
      return { sign: SA.World.eras[2026].specs.find((s) => s.role === 'pennick').signText, code };
    });
    await page.reload();
    await page.waitForFunction(() => window.SA && SA.Game && SA.Game.state === 'title', null, { timeout: 180000 });
    await page.evaluate(HELPERS);
    const r2 = await page.evaluate(async () => {
      const cont = !document.getElementById('btn-continue').classList.contains('hidden');
      document.getElementById('btn-continue').click();
      await simA(1);
      return { cont, flags: SA.Game.flags, sign: SA.World.eras[2026].specs.find((s) => s.role === 'pennick').signText, sign1964: SA.World.eras[1964].specs.find((s) => s.role === 'pennick').signText, plaque: !!SA.Landmarks.consequenceInfo };
    });
    rec('Save + page reload preserves the consequence (flags, 2026 and 1964 shopfront signs)', r2.cont && r2.flags.fund_outcome === 'returned' && /Pennick & Daughters/.test(r2.sign) && /Clockmakers/.test(r2.sign1964), { before: r1.sign, after: r2 });
    // the in-world change near French Row
    await page.evaluate(async () => {
      SA.debug.era(2026);
      const d = SA.World.roleDoor(2026, 'pennick', 'French Row');
      tp(d.x + d.nx * 7, d.z + d.nz * 7, Math.atan2(-d.nx, -d.nz));
      SA.debug.setCam(Math.atan2(-d.nx, -d.nz) + Math.PI, 0.12);
      SA.debug.sim(1);
    });
    await shot(page, 'verify_2026_after_returned');
    // save code import on a fresh page: switch to the other outcome via code
    const r3 = await page.evaluate(async (code) => {
      const d = SA.Save.decode(code);
      d.flags.fund_outcome = 'dinner';
      const code2 = SA.Save.encode(d);
      let bad = null;
      try { SA.Save.decode(code2.slice(0, -3) + 'AAA'); } catch (e) { bad = e.message; }
      document.getElementById('code-text').value = code2;
      document.getElementById('btn-code-load').click();
      await simA(1);
      return { sign: SA.World.eras[2026].specs.find((s) => s.role === 'pennick').signText, badCodeRejected: bad };
    }, r1.code);
    rec('Save code export/import works and corrupt codes are rejected', /Jubilee Table/.test(r3.sign) && !!r3.badCodeRejected, r3);
    await page.evaluate(async () => {
      const d = SA.World.roleDoor(2026, 'pennick', 'French Row');
      tp(d.x + d.nx * 7, d.z + d.nz * 7, Math.atan2(-d.nx, -d.nz));
      SA.debug.setCam(Math.atan2(-d.nx, -d.nz) + Math.PI, 0.12);
      SA.debug.sim(1);
    });
    await shot(page, 'verify_2026_after_dinner');
    await ctx.close();
  }

  // ------------------------------------------------------------------ 7. storage unavailable: the game still runs
  {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
    await ctx.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
    });
    const page = await ctx.newPage();
    watchRequests(page);
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    const ok = await page.waitForFunction(() => window.SA && SA.Game && SA.Game.state === 'title', null, { timeout: 180000 }).then(() => true).catch(() => false);
    const note = ok ? await page.evaluate(() => ({ avail: SA.Store.available, note: document.getElementById('storage-note').textContent })) : null;
    rec('Runs with localStorage blocked (shows a note, save codes still available)', ok && note && note.avail === false && note.note.length > 10, note);
    await ctx.close();
  }

  // ------------------------------------------------------------------ 8. touch controls at a phone viewport
  {
    const { ctx, page, errors } = await open({ w: 915, h: 412, touch: true, clearSave: true });
    await page.evaluate(() => { document.getElementById('btn-new').click(); });
    await page.waitForTimeout(400);
    await page.evaluate(async () => { await skipAll(5); });
    const vis = await page.evaluate(() => ({ touch: !document.getElementById('touch').classList.contains('hidden'), scheme: SA.Input.scheme }));
    // drag the virtual stick upward for a while with CDP touch events
    const cdp = await ctx.newCDPSession(page);
    const x0 = 120, y0 = 300;
    const p0 = await page.evaluate(() => [SA.Player.ch.x, SA.Player.ch.z]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - 45, id: 1 }] });
    await page.evaluate(() => SA.debug.sim(2));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const p1 = await page.evaluate(() => [SA.Player.ch.x, SA.Player.ch.z]);
    const moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    // look drag on the right side
    const yaw0 = await page.evaluate(() => SA.Game.cam.yaw);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 700, y: 200, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 600, y: 200, id: 2 }] });
    await page.evaluate(() => SA.debug.sim(0.1));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const yaw1 = await page.evaluate(() => SA.Game.cam.yaw);
    // contextual key button: hold it via pointer events
    const keyBtn = await page.evaluate(() => { SA.TimeKey.owned = true; SA.TimeKey.locked = false; SA.TimeKey.allowed = [1964]; SA.debug.sim(0.2); const b = document.getElementById('tb-key'); return !b.classList.contains('hidden'); });
    await page.evaluate(() => { const b = document.getElementById('tb-key'); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await page.evaluate(async () => { await simA(3.5); });
    await page.evaluate(() => { const b = document.getElementById('tb-key'); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
    const jumped = await page.evaluate(async () => { await simA(8); return SA.Game.era; });
    rec('Touch: controls shown, stick moves the player, drag rotates the camera, Key button winds', vis.touch && moved > 2 && Math.abs(yaw1 - yaw0) > 0.05 && keyBtn && jumped === 1964, { vis, moved: +moved.toFixed(2), dyaw: +(yaw1 - yaw0).toFixed(3), keyBtn, jumped });
    await page.evaluate(() => { SA.debug.noRender = false; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, 'verify_touch_phone.png') });
    // render stats at phone resolution, low quality preset (what the phone would draw)
    const stats = await page.evaluate(() => { SA.debug.noRender = false; return new Promise((r) => setTimeout(() => r(SA.debug.renderInfo()), 1500)); });
    rec('Phone viewport (915x412, low quality): render stats', stats.calls < 220, stats);
    rec('No runtime errors in touch run', errors.length === 0, errors.slice(0, 5));
    await ctx.close();
  }

  // ------------------------------------------------------------------ 9. opening index.html straight from disk
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    watchRequests(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, 'index.html'));
    const ok = await page.waitForFunction(() => window.SA && SA.Game && SA.Game.state === 'title', null, { timeout: 180000 }).then(() => true).catch(() => false);
    let st = null;
    if (ok) {
      await page.evaluate(() => document.getElementById('btn-new').click());
      await page.waitForTimeout(1500);
      st = await page.evaluate(() => ({ state: SA.Game.state, era: SA.Game.era, error: SA.lastError || null }));
    }
    rec('Runs when index.html is opened directly (file://, no server)', ok && st && st.state === 'play' && !st.error && errors.length === 0, { st, errors: errors.slice(0, 3) });
    await ctx.close();
  }
  rec('No requests to external services (every page in this run)', external.length === 0, external.slice(0, 5));

  fs.writeFileSync(path.join(out, 'verify-results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
