// Full playthrough of the opening mission, "Wind the Key", from New Game to the
// mission-complete card, then a page reload to check the consequence survives.
// Usage: node tools/playthrough.js <outdir> [returned|dinner]
// Like verify.js, it advances the game with SA.debug.sim() (software WebGL is too slow
// to play in real time) and teleports between beats instead of walking every street;
// each beat still goes through the real interaction, dialogue, vehicle and key code.
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
window.skipAll = async (n) => { for (let i = 0; i < (n || 60); i++) { if (SA.Dialogue.busy()) SA.Dialogue.skipAll(); SA.debug.sim(0.12); await tick(); } };
window.tp = (x, z, yaw) => { SA.debug.teleport(x, z, yaw); SA.debug.sim(0.3); };
window.act = async () => { await skipAll(10); SA.Input.tap('interact'); SA.debug.sim(0.1); await tick(); await skipAll(80); };
window.simA = async (secs) => { for (let t = 0; t < secs; t += 0.5) { SA.debug.sim(0.5); await tick(); } };
window.wind = async () => { await skipAll(10); SA.Input.hold('timekey', true); await simA(3.0); SA.Input.hold('timekey', false); await simA(9); await skipAll(30); };
window.restOff = async () => { let n = 0; while (SA.TimeKey.restLeft() > 0 && n++ < 400) await simA(0.5); };
window.face = (x, z, pitch) => { const p = SA.Player.ch; SA.debug.setCam(Math.atan2(x - p.x, z - p.z) + Math.PI, pitch === undefined ? 0.2 : pitch); };
window.__slips = window.__slips || [];
if (!window.__slipHook) window.__slipHook = SA.on('slip', (reason, moved) => window.__slips.push({ era: SA.Game.era, reason, moved: +moved.toFixed(1) }));
1;`;

async function main() {
  const out = process.argv[2] || 'playthrough-out';
  const ending = process.argv[3] === 'dinner' ? 'dinner' : 'returned';
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(180000); // software WebGL loads slowly
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const results = [];
  const rec = (name, pass, detail) => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  let shotN = 0;
  async function shot(name) {
    await ev(() => { SA.debug.noRender = false; });
    await page.waitForTimeout(1300);
    shotN++;
    await page.screenshot({ path: path.join(out, String(shotN).padStart(2, '0') + '_' + name + '.jpg'), type: 'jpeg', quality: 82, timeout: 180000 });
    await ev(() => { SA.debug.noRender = true; });
  }

  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.SA && SA.Game && SA.Game.state === 'title', null, { timeout: 180000 });
  await ev(() => SA.Save.clear());
  await ev(HELPERS);
  const t0 = Date.now();

  // ---------------------------------------------------------------- 2026: phone call, solicitors, letter
  let r = await ev(async () => {
    document.getElementById('btn-new').click();
    await simA(1.5);
    const sub = document.getElementById('hud-subtitle').innerText;
    await skipAll(30);
    return { era: SA.Game.era, stage: SA.Mission.stage, subtitle: sub.slice(0, 80), objective: document.getElementById('hud-objective').innerText.slice(0, 120) };
  });
  rec('2026 start: New Game opens in 2026 with the phone call and an objective', r.era === 2026 && r.stage === 'p0' && r.objective.length > 5, r);
  await shot('2026_start');
  r = await ev(async () => {
    // the camera lesson: from a street with a view of the Clock Tower, turn the camera to it
    const ct = SA.Landmarks.clockTowerInfo;
    const col = SA.World.current.col;
    let spot = null;
    for (const rd of SA.World.roads) {
      if (!['High Street', 'Market Place', 'Chequer Street'].includes(rd.n)) continue;
      for (let i = 0; i < rd.p.length - 1 && !spot; i++) {
        for (let t = 0; t <= 1 && !spot; t += 0.25) {
          const x = rd.p[i][0] + (rd.p[i + 1][0] - rd.p[i][0]) * t, z = rd.p[i][1] + (rd.p[i + 1][1] - rd.p[i][1]) * t;
          const d = Math.hypot(x - ct.x, z - ct.z);
          if (d < 35 || d > 120) continue;
          const f = col.castCamera(x, SA.Terrain.height(x, z) + 3, z, ct.x, ct.base + 14, ct.z);
          if ((1 - f) * d < 6) spot = { x, z };
        }
      }
    }
    if (spot) {
      tp(spot.x, spot.z);
      face(ct.x, ct.z, 0.1);
      await simA(1);
      await skipAll(10);
    }
    const seen = SA.Mission.data.towerSeen;
    const d = SA.Mission.solicitorDoor();
    tp(d.x + d.nx * 1.5, d.z + d.nz * 1.5);
    face(d.x, d.z, 0.15);
    await skipAll(10);
    const label = SA.Interact.current && SA.Interact.current.label;
    await act();
    const letter = !document.getElementById('screen-letter').classList.contains('hidden');
    return { seen, label, letter, stage: SA.Mission.stage, inv: SA.Player.inventory.slice() };
  });
  rec('2026: camera lesson (tower spotted), solicitors door interaction, parcel and letter', r.seen && r.letter && r.inv.includes('key'), r);
  await shot('edie_letter');
  r = await ev(async () => {
    document.getElementById('btn-letter-close').click();
    await simA(0.5);
    await skipAll(20);
    const ct = SA.Landmarks.clockTowerInfo, cf = SA.Landmarks.clockFace;
    tp(ct.x + cf.nx * 5, ct.z + cf.nz * 5);
    face(ct.x, ct.z, 0.1);
    await skipAll(20);
    return { stage: SA.Mission.stage, key: SA.TimeKey.debugState() };
  });
  rec('2026: letter closed, the Curfew Key is ready at the Clock Tower', r.stage === 'p2' && r.key.status === 'ready', r);

  // ---------------------------------------------------------------- first jump: 2026 -> 1964
  await ev(async () => { SA.Input.hold('timekey', true); await simA(2.8); SA.Input.hold('timekey', false); await simA(1.5); });
  await shot('first_jump_time_wave');
  r = await ev(async () => {
    await simA(8);
    await skipAll(40);
    return { era: SA.Game.era, stage: SA.Mission.stage, rest: Math.round(SA.TimeKey.restLeft()), slips: window.__slips.slice(), toast: document.getElementById('hud-toast').innerText.slice(0, 120) };
  });
  rec("First jump lands in 1964 (Saturday market day), rest timer running; a parked bread van on the spot makes the key slip Robin aside", r.era === 1964 && r.stage === 'a1' && r.rest > 0 && r.slips.some((x) => x.era === 1964 && x.reason === 'vehicle'), r);
  await shot('1964_arrival');

  // ---------------------------------------------------------------- 1964: Edie, scooter, market, change clothes
  r = await ev(async () => {
    const d = SA.Mission.edieDoor();
    tp(d.x + d.nx * 2.2, d.z + d.nz * 2.2);
    face(d.x, d.z, 0.15);
    await skipAll(10);
    const label = SA.Interact.current && SA.Interact.current.label;
    await act();
    await skipAll(150);
    return { label, stage: SA.Mission.stage, rules: SA.Mission.rules.length, inv: SA.Player.inventory.slice() };
  });
  rec('1964: old Edie explains the six rules and the thief (information carried to 1897)', r.stage === 'a2' && r.rules >= 5, r);
  r = await ev(async () => {
    const v = SA.Mission.data.scooter;
    tp(v.x + 1.2, v.z + 0.5);
    await skipAll(10);
    SA.Input.tap('vehicle');
    await simA(0.5);
    await skipAll(20);
    const veh = SA.Player.vehicle && SA.Player.vehicle.def.id;
    SA.debug.setCam(SA.Player.vehicle.yaw + Math.PI, 0.25);
    SA.Input.setAutoMove(0, 1);
    await simA(1.5);
    SA.Input.setAutoMove(null);
    return { veh, stage: SA.Mission.stage, speed: +SA.Player.vehicle.speed.toFixed(1) };
  });
  rec("1964: Terry's scooter — get on and ride (vehicle tutorial)", r.veh === 'scooter' && r.speed > 2, r);
  await shot('scooter');
  r = await ev(async () => {
    const s = SA.Mission.data.stall;
    const v = SA.Player.vehicle;
    v.x = s.x + 2.5;
    v.z = s.z + 1;
    v.speed = 0;
    await simA(0.5);
    await act();
    await skipAll(40);
    const inv = SA.Player.inventory.slice();
    SA.Input.tap('vehicle');
    await simA(0.5);
    const d = SA.Mission.edieDoor();
    tp(d.x + d.nx * 2.0, d.z + d.nz * 2.0);
    await act();
    await skipAll(80);
    return { invAtStall: inv, stage: SA.Mission.stage, outfit: SA.Player.outfit };
  });
  rec('1964: buy the coat at the market stall, change into Victorian clothes at Edie\'s', r.invAtStall.includes('coat') && r.outfit === 'victorian' && r.stage === 'a5', r);
  r = await ev(async () => {
    await restOff();
    const ct = SA.Landmarks.clockTowerInfo;
    const s = SA.World.findSafe(1964, ct.x + 8, ct.z + 8, { r: 0.5 });
    tp(s.x, s.z);
    await wind();
    await skipAll(60);
    return { era: SA.Game.era, stage: SA.Mission.stage, flags: SA.Game.flags };
  });
  rec('Second jump: 1964 -> 1897, Jubilee night (Gabriel tolls, the clock stops)', r.era === 1897 && (r.stage === 'b1' || r.stage === 'b2'), r);
  await shot('1897_arrival');

  // ---------------------------------------------------------------- 1897: suspects, chase, police
  r = await ev(async () => {
    await skipAll(60);
    const c = SA.Mission.npcs.crabbe && SA.Mission.npcs.crabbe.ch;
    if (!c) return { stage: SA.Mission.stage, crabbe: false };
    tp(c.x + 1.2, c.z + 0.6);
    face(c.x, c.z, 0.2);
    await skipAll(5);
    return { stage: SA.Mission.stage, label: SA.Interact.current && SA.Interact.current.label };
  });
  rec('1897: three men in check suits; the 1964 description singles out Crabbe', r.stage === 'b2' && /check suit/i.test(r.label || ''), r);
  await shot('suspect');
  r = await ev(async () => {
    SA.Input.tap('interact');
    SA.debug.sim(0.1);
    await tick();
    let n = 0;
    while (SA.Mission.stage !== 'b3' && n++ < 120) {
      if (SA.Dialogue.busy()) SA.Dialogue.skipAll();
      SA.debug.sim(0.12);
      await tick();
    }
    const cart = SA.Mission.data.cart;
    const b = SA.Mission.data.bike;
    tp(b.x + 0.8, b.z + 0.3);
    SA.Input.tap('vehicle');
    await simA(0.5);
    const veh = SA.Player.vehicle && SA.Player.vehicle.def.id;
    // keep up with the cart for 10 s (placed a few metres behind it, as a player chasing would be)
    let maxWanted = 0, units = 0;
    for (let t = 0; t < 10; t += 0.5) {
      const v = SA.Player.vehicle;
      if (v) {
        v.x = cart.x - Math.sin(cart.yaw) * 7;
        v.z = cart.z - Math.cos(cart.yaw) * 7;
        v.yaw = cart.yaw;
        v.speed = cart.speed;
      }
      await simA(0.5);
      if (SA.Dialogue.busy()) SA.Dialogue.skipAll();
      maxWanted = Math.max(maxWanted, SA.Police.level);
      units = Math.max(units, SA.Police.units.length);
    }
    return { stage: SA.Mission.stage, veh, maxWanted, units, sameCart: SA.Mission.data.cart === cart, cartNode: cart.ai.i, cartSpeed: +cart.speed.toFixed(1) };
  });
  rec("1897: Crabbe flees in the baker's cart; Robin takes young Edie's bicycle; the City Police join in", r.stage === 'b3' && r.veh === 'bicycle' && r.maxWanted >= 1 && r.sameCart, r);
  r = await ev(async () => {
    // catch up with the cart (teleport alongside rather than steering the whole route)
    const c = SA.Mission.data.cart;
    const v = SA.Player.vehicle;
    v.x = c.x - Math.sin(c.yaw) * 1.0 + Math.cos(c.yaw) * 1.8;
    v.z = c.z - Math.cos(c.yaw) * 1.0 - Math.sin(c.yaw) * 1.8;
    v.yaw = c.yaw;
    v.speed = c.speed;
    SA.debug.setCam(c.yaw + Math.PI, 0.25);
    await simA(0.3);
    return { label: SA.Interact.current && SA.Interact.current.label };
  });
  rec('1897: alongside the cart, the prompt offers to grab the carpet bag', /carpet bag/i.test(r.label || ''), r);
  await shot('cart_chase');
  r = await ev(async () => {
    SA.Input.tap('interact');
    await simA(0.3);
    await skipAll(20);
    await simA(3);
    return { stage: SA.Mission.stage, inv: SA.Player.inventory.slice(), wanted: SA.Police.level, units: SA.Police.units.length };
  });
  rec('1897: bag grabbed; wanted level rises to 2 and constables close in', r.stage === 'b4' && r.inv.includes('bag') && r.wanted >= 2 && r.units >= 1, r);
  await shot('city_police');
  r = await ev(async () => {
    // lose them: ride away down a side street and stay out of sight
    if (SA.Player.vehicle) { SA.Input.tap('vehicle'); await simA(0.5); }
    const h = SA.World.findSafe(1897, -17, 40, { r: 0.4 });
    tp(h.x, h.z);
    for (const u of SA.Police.units) {
      const o = u.kind === 'foot' ? u.ch : u.v;
      if (o) { o.x += 60; o.z -= 60; }
    }
    let t = 0;
    while (SA.Police.level > 0 && t < 120) { await simA(1); t++; }
    await skipAll(20);
    return { wanted: SA.Police.level, secondsToLose: t, stage: SA.Mission.stage };
  });
  rec('1897: break line of sight and the constables give up (wanted level decays to 0)', r.wanted === 0 && r.stage === 'b5', r);

  // ---------------------------------------------------------------- the choice
  r = await ev(async (ending) => {
    const e = SA.Mission.npcs.edieYoung.ch;
    tp(e.x + 1.2, e.z + 0.5);
    face(e.x, e.z, 0.2);
    await skipAll(5);
    SA.Input.tap('interact');
    await simA(0.2);
    await skipAll(120);
    const open = !document.getElementById('screen-choice').classList.contains('hidden');
    return { open, stage: SA.Mission.stage };
  }, ending);
  rec('1897: young Edie explains the choice (choice card shown)', r.open, r);
  await shot('choice_card');
  r = await ev(async (ending) => {
    document.querySelector('#choice-options button').click();
    await simA(0.5);
    const info = ending === 'dinner' ? SA.Landmarks.cornInfo : SA.Landmarks.townHallInfo;
    const k = ending === 'dinner' ? 1.0 : 1.5;
    tp(info.x + info.nx * k, info.z + info.nz * k);
    SA.debug.setCam(Math.atan2(-info.nx, -info.nz) + Math.PI, 0.1);
    await skipAll(5);
    return { stage: SA.Mission.stage, label: SA.Interact.current && SA.Interact.current.label };
  }, ending);
  rec(`1897: carry the fund to the ${ending === 'dinner' ? 'Corn Exchange' : 'Town Hall'}`, r.stage === 'b6' && !!r.label, r);
  await shot('choice_' + ending);
  r = await ev(async () => {
    SA.Input.tap('interact');
    await simA(0.3);
    await skipAll(150);
    return { stage: SA.Mission.stage, flags: Object.assign({}, SA.Game.flags) };
  });
  rec('1897: the choice sets the world-state flags', r.stage === 'b7' && r.flags.fund_outcome === ending, r);

  // ---------------------------------------------------------------- home to 2026
  r = await ev(async () => {
    await restOff();
    await wind();
    await skipAll(40);
    return { era: SA.Game.era, stage: SA.Mission.stage };
  });
  rec('Long wind 1897 -> 2026 after the 90 s rest', r.era === 2026 && r.stage === 'c1', r);
  r = await ev(async () => {
    const d = SA.Mission.pennickDoor2026();
    tp(d.x + d.nx * 3.5, d.z + d.nz * 3.5);
    await simA(0.5);
    await skipAll(150);
    const open = !document.getElementById('screen-complete').classList.contains('hidden');
    return { open, stage: SA.Mission.stage, text: document.getElementById('screen-complete').innerText.slice(0, 160) };
  });
  rec('2026: French Row shows the change; mission-complete card summarises it', r.open, r);
  await shot('mission_complete');
  r = await ev(async () => {
    document.getElementById('btn-complete-ok').click();
    await simA(1);
    const d = SA.World.roleDoor(2026, 'pennick', 'French Row');
    tp(d.x + d.nx * 7, d.z + d.nz * 7, Math.atan2(-d.nx, -d.nz));
    SA.debug.setCam(Math.atan2(-d.nx, -d.nz) + Math.PI, 0.12);
    await simA(1.5);
    return { stage: SA.Mission.stage, sign: SA.World.eras[2026].specs.find((s) => s.role === 'pennick').signText };
  });
  const wantSign = ending === 'dinner' ? /Jubilee Table/ : /Pennick & Daughters/;
  rec('2026 free roam: French Row shopfront changed in the world', r.stage === 'free' && wantSign.test(r.sign), r);
  await shot('french_row_2026_after');

  // ---------------------------------------------------------------- reload: the consequence persists
  await page.reload();
  await page.waitForFunction(() => window.SA && SA.Game && SA.Game.state === 'title', null, { timeout: 180000 });
  await ev(HELPERS);
  r = await ev(async () => {
    const cont = !document.getElementById('btn-continue').classList.contains('hidden');
    document.getElementById('btn-continue').click();
    await simA(1);
    return { cont, era: SA.Game.era, stage: SA.Mission.stage, flags: SA.Game.flags, sign: SA.World.eras[2026].specs.find((s) => s.role === 'pennick').signText };
  });
  rec('Page reload + Continue: the outcome and the changed shopfront persist', r.cont && r.flags.fund_outcome === ending && wantSign.test(r.sign), r);
  rec('No runtime errors during the playthrough', errors.length === 0, errors.slice(0, 5));

  const failed = results.filter((x) => !x.pass).length;
  fs.writeFileSync(path.join(out, 'playthrough-results-' + ending + '.json'), JSON.stringify({ ending, results, wallSeconds: Math.round((Date.now() - t0) / 1000) }, null, 2));
  console.log(`\n${results.length - failed}/${results.length} beats passed (${ending} ending)`);
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
