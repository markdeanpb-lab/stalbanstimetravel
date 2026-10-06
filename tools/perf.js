// Performance budget report: draw calls, triangles, GPU memory estimate and simulation cost
// per frame, for each era at several places, at a phone preset (915x412, Low quality) and a
// desktop preset (1280x720, High quality).
// Usage: node tools/perf.js <outdir>
// Software WebGL (SwiftShader) can't say anything about real GPU frame rates; these numbers are
// the inputs that decide them (calls, triangles, memory) plus the CPU cost of one game step.
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

const PLACES = [
  ['Clock Tower', 6, 12, Math.PI * 0.8],
  ["St Peter's Street", 120, -140, 0.5],
  ['High Street', -20, 14, 1.9],
  ['Cathedral precinct', -150, -60, -1.2],
  ['George Street', -90, -14, -1.9],
];

async function main() {
  const out = process.argv[2] || 'perf-out';
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await playwright.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = {};
  for (const preset of [{ name: 'phone-low', w: 915, h: 412, quality: 'low', touch: true }, { name: 'desktop-high', w: 1280, h: 720, quality: 'high', touch: false }]) {
    const ctx = await browser.newContext({ viewport: { width: preset.w, height: preset.h }, deviceScaleFactor: 1, hasTouch: preset.touch, isMobile: preset.touch });
    await ctx.addInitScript((q) => {
      try { localStorage.setItem('curfew-stalbans-settings-v1', JSON.stringify({ quality: q })); } catch (e) { /* ignore */ }
    }, preset.quality);
    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(180000); // software WebGL loads slowly
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForFunction(() => window.SA && SA.Game && SA.Game.state === 'title', null, { timeout: 180000 });
    const loadMs = Date.now() - t0;
    const res = await page.evaluate(async (PLACES) => {
      const tick = () => new Promise((r) => setTimeout(r, 0));
      SA.Save.clear();
      document.getElementById('btn-new').click();
      await tick();
      for (let i = 0; i < 40; i++) { if (SA.Dialogue.busy()) SA.Dialogue.skipAll(); SA.debug.sim(0.1); }
      SA.Mission.reset();
      const R = SA.Game.renderer();
      const scene = SA.Game.scene();
      const cam = SA.Game.camera();
      // GPU memory estimate for everything resident (all three eras are built up front)
      const geos = new Set(), texs = new Set();
      scene.traverse((o) => {
        if (o.geometry) geos.add(o.geometry);
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) for (const k of ['map', 'emissiveMap', 'alphaMap']) if (m[k]) texs.add(m[k]);
        if (o.isInstancedMesh && o.instanceMatrix) geos.add({ attributes: { m: o.instanceMatrix } });
      });
      for (const k in SA.World.eras) {
        const e = SA.World.eras[k];
        if (e.groundTex) for (const t of Object.values(e.groundTex)) if (t && t.isTexture) texs.add(t);
      }
      let geoBytes = 0;
      for (const g of geos) {
        for (const a of Object.values(g.attributes || {})) if (a && a.array) geoBytes += a.array.byteLength;
        if (g.index && g.index.array) geoBytes += g.index.array.byteLength;
      }
      // shader-only textures: surface scan arrays, the people's bone texture and face atlas
      if (SA.PBR && SA.PBR.uniforms) for (const k of ['tPbrA', 'tPbrB']) texs.add(SA.PBR.uniforms[k].value);
      if (SA.Game.pool) for (const t of [SA.Game.pool.boneTex, SA.Game.pool.faceTex]) if (t) texs.add(t);
      let texBytes = 0;
      for (const t of texs) {
        const img = t.image;
        if (!img || !img.width) continue;
        const bpp = t.type === THREE.FloatType ? 16 : 4;
        texBytes += img.width * img.height * (img.depth || 1) * bpp * (t.generateMipmaps === false ? 1 : 1.33);
      }
      // render targets: shadow map, environment maps and the post-processing buffers
      const W = R.domElement.width, H = R.domElement.height;
      let rtBytes = 0;
      const sun = SA.Game.sun();
      if (R.shadowMap.enabled && sun.shadow && sun.shadow.mapSize) rtBytes += sun.shadow.mapSize.x * sun.shadow.mapSize.y * 4;
      rtBytes += Object.keys(SA.Render.envCache || {}).length * 256 * 256 * 6 * 8 * 1.33;
      if (SA.Render.composer) rtBytes += W * H * 8 * 2 + W * H * 4 + (SA.Render.ao ? W * H * 8 : 0) + W * H * 8 * 0.7;
      const rows = [];
      for (const era of [2026, 1964, 1897]) {
        SA.debug.era(era);
        SA.Police.clear();
        SA.debug.sim(0.5);
        for (const [name, x, z, yaw] of PLACES) {
          const s = SA.World.findSafe(era, x, z, { r: 0.5 });
          SA.debug.teleport(s.x, s.z, yaw);
          SA.debug.sim(1.0);
          // simulation cost: 90 game steps at 1/30 s (no rendering)
          const t1 = performance.now();
          SA.debug.sim(3.0);
          const stepMs = (performance.now() - t1) / 90;
          // one full frame (shadows, scene and post-processing passes) for the counts;
          // SwiftShader timing is not meaningful
          SA.Render.render(1 / 60);
          const ri = SA.Render.info();
          rows.push({ era, place: name, calls: ri.calls, tris: ri.tris, stepMs: +stepMs.toFixed(2), npcs: SA.NPCs.list.length, vehicles: SA.Vehicles.list.filter((v) => v.era === era).length, people: SA.Game.pool.list.length });
          await tick();
        }
      }
      return { rows, memory: { geometryMB: +(geoBytes / 1048576).toFixed(1), textureMB: +(texBytes / 1048576).toFixed(1), renderTargetMB: +(rtBytes / 1048576).toFixed(1), textures: texs.size, geometries: geos.size, rendererInfo: SA.debug.renderInfo() }, quality: SA.Game.settings.quality, pixelRatio: R.getPixelRatio(), shadows: R.shadowMap.enabled, post: !!SA.Render.composer };
    }, PLACES);
    res.loadMs = loadMs;
    report[preset.name] = res;
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'perf.json'), JSON.stringify(report, null, 2));
  for (const [k, r] of Object.entries(report)) {
    console.log(`\n== ${k} (quality ${r.quality}, pixel ratio ${r.pixelRatio}, shadows ${r.shadows}, load ${r.loadMs} ms in headless Chromium)`);
    console.log(`memory estimate: geometry ${r.memory.geometryMB} MB, textures ${r.memory.textureMB} MB (${r.memory.textures} textures), render targets ${r.memory.renderTargetMB} MB, post-processing ${r.post}`);
    console.log('era  place                 calls   tris    step ms  npcs veh');
    for (const x of r.rows) console.log(`${x.era} ${x.place.padEnd(22)} ${String(x.calls).padStart(5)} ${String(x.tris).padStart(8)} ${String(x.stepMs).padStart(8)} ${String(x.npcs).padStart(5)} ${String(x.vehicles).padStart(3)}`);
  }
  await browser.close();
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
