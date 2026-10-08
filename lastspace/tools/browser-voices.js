/* LAST SPACE - spoken commentary check with a stand-in speech engine (headless browsers have no voices).
   Every line spoken must be a caption on screen, one voice at a time, with the commentator, Barry on
   the radio and the residents all heard, the caption marked while it is read, and residents silent
   in "commentary only" mode.
   node tools/browser-voices.js */
const path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
(async () => {
  const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    const log = window.__speech = { spoken: [], cancelled: 0, maxConcurrent: 0 };
    let cur = null, timer = null;
    const voices = ['Daniel', 'Google UK English Male', 'Kate', 'Serena', 'Arthur'].map((n) => ({ name: n, lang: 'en-GB', localService: true, voiceURI: n, default: false }));
    class U { constructor(t) { this.text = t; this.voice = null; this.pitch = 1; this.rate = 1; this.volume = 1; this.lang = ''; this.onstart = null; this.onend = null; this.onerror = null; } }
    const end = (u, ev) => { if (cur !== u) return; cur = null; clearTimeout(timer); (ev === 'end' ? u.onend : u.onerror || u.onend) && (ev === 'end' ? u.onend : u.onerror || u.onend)({ error: 'interrupted' }); };
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      paused: false, get speaking() { return !!cur; }, getVoices: () => voices, resume() {}, pause() {}, onvoiceschanged: null,
      speak(u) {
        if (!u.text.trim()) return;
        if (cur) { log.maxConcurrent = 2; return; } // a real engine would queue: we want only one at a time
        cur = u; log.maxConcurrent = Math.max(log.maxConcurrent, 1);
        const rec = { text: u.text, voice: u.voice && u.voice.name, pitch: u.pitch, t: performance.now() }; log.spoken.push(rec);
        setTimeout(() => u.onstart && u.onstart({}), 10);
        timer = setTimeout(() => { rec.done = true; end(u, 'end'); }, 300 + u.text.length * 22);
      },
      cancel() { if (cur) { log.cancelled++; end(cur, 'error'); } },
    } });
  });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForFunction(() => window.LS && LS.Game && LS.Game.match, null, { timeout: 120000 });
  await page.evaluate(() => {
    window.__caps = []; window.__speakingSeen = 0;
    new MutationObserver((ms) => { for (const m of ms) { for (const n of m.addedNodes) if (n.classList && n.classList.contains('cap')) window.__caps.push(n.querySelector('.what').textContent); if (m.type === 'attributes' && m.target.classList.contains('speaking')) window.__speakingSeen++; } })
      .observe(document.getElementById('tvlayer'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    LS.Game.settings.voices = 'all'; LS.Game.applySettings(); LS.Audio.init();
    LS.Game.startMatch({ players: [{ type: 'estate' }] }); LS.debug.autopilot('nearest');
    // drive the match without rendering (software GL is far too slow), at twice real time; speech runs on real time
    LS.Game.paused = true;
    setInterval(() => { const G = LS.Game; for (let i = 0; i < 3; i++) G.match.step(1 / 30); G.tv.update(0.1); }, 50);
  });
  // play in real time until the battle is well under way (the frame loop caps each step, so wait on game time)
  const until = async (cond, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await page.evaluate(cond)) return true; await page.waitForTimeout(500); } return false; };
  await until(() => LS.Game.match.phase === 'battle' && LS.Game.match.phaseT > 12, 400000);
  const a = await page.evaluate(() => ({ s: window.__speech, caps: window.__caps, seen: window.__speakingSeen, phase: LS.Game.match.phase, t: LS.Game.match.time }));
  // then commentary only
  await page.evaluate(() => { LS.Game.settings.voices = 'commentary'; LS.Game.applySettings(); window.__speech.mark = window.__speech.spoken.length; });
  await until(() => LS.Game.match.phase !== 'battle' || LS.Game.match.phaseT > 40, 300000);
  const b2 = await page.evaluate(() => ({ s: window.__speech, caps: window.__caps }));
  await b.close();

  const norm = (t) => t.replace(/\s+-\s+/g, ', ');
  const caps = new Set(b2.caps.map(norm));
  const spoken = b2.s.spoken;
  const unmatched = spoken.filter((x) => !caps.has(x.text));
  const by = (re) => spoken.filter((x) => re.test(x.text));
  const comm = LS_TEXT();
  function LS_TEXT() { global.window = global; require('../js/core/base.js'); require('../js/data/text.js'); return global.LS.TEXT; }
  const all = (o) => Object.values(o).flat();
  const isComm = (t) => all(comm.commentary).some((p) => new RegExp('^' + norm(p).replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+') + '$').test(t));
  const isRadio = (t) => all(comm.dj).includes(t);
  const nComm = spoken.filter((x) => isComm(x.text)).length, nRadio = spoken.filter((x) => isRadio(x.text)).length;
  const later = spoken.slice(b2.s.mark), residentsLater = later.filter((x) => !isComm(x.text) && !isRadio(x.text));
  const voicesBy = {}; for (const x of spoken) { const k = isComm(x.text) ? 'commentary' : isRadio(x.text) ? 'radio' : 'resident'; (voicesBy[k] = voicesBy[k] || new Set()).add(x.voice + '@' + x.pitch.toFixed(2)); }
  console.log('reached', a.phase, a.t.toFixed(1));
  console.log(`captions ${b2.caps.length}, spoken ${spoken.length} (commentary ${nComm}, radio ${nRadio}, residents ${spoken.length - nComm - nRadio}), cut off ${b2.s.cancelled}, captions marked while speaking: ${a.seen}`);
  for (const k in voicesBy) console.log(`  ${k} voice(s): ${[...voicesBy[k]].join(', ')}`);
  for (const x of spoken.slice(0, 14)) console.log('  said: ' + x.text.slice(0, 90));
  const fails = [];
  if (unmatched.length) fails.push('spoken without a matching caption: ' + unmatched.map((x) => x.text).join(' | '));
  if (b2.s.maxConcurrent > 1) fails.push('two voices at once');
  if (!nComm) fails.push('no commentary spoken');
  if (!nRadio) fails.push('Barry never spoke');
  if (!(a.seen > 0)) fails.push('captions never marked as speaking');
  if (residentsLater.length) fails.push('residents spoken in commentary-only mode: ' + residentsLater.map((x) => x.text).join(' | '));
  if (voicesBy.commentary && voicesBy.commentary.size !== 1) fails.push('commentator changed voice');
  if (errs.length) fails.push('page errors: ' + errs.join(' | '));
  console.log(fails.length ? 'VOICES FAIL\n  ' + fails.join('\n  ') : 'VOICES OK');
  process.exit(fails.length ? 1 : 0);
})();
