/* LAST SPACE - sound, all synthesised with WebAudio: jaunty local-radio music that stops dead,
   engines, tyre squeal, crunches scaled to impact severity, glass, horns, the closing air horn,
   a ticking clock, and spoken commentary, radio links and residents through speech synthesis. */
(function (LS) {
  'use strict';
  const U = LS.U;
  const A = LS.Audio = {
    ctx: null, enabled: true, vol: { master: 0.8, music: 0.6, sfx: 0.9 }, voices: 'all',
    init() {
      this.unlockSpeech();
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { this.enabled = false; return; }
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.vol.master; this.master.connect(c.destination);
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 5; this.comp.connect(this.master);
      this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.comp);
      this.musicBus = c.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.comp);
      // the "radio" colour: band-limited and a touch crunchy
      this.radioIn = c.createGain();
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      const sh = c.createWaveShaper(); const k = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; k[i] = Math.tanh(x * 1.6); } sh.curve = k;
      this.radioIn.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(this.musicBus);
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.engines = new Map();
      this.tension = null;
    },
    setVolumes() { if (!this.ctx) return; this.master.gain.value = this.vol.master; this.sfx.gain.value = this.vol.sfx; },
    now() { return this.ctx ? this.ctx.currentTime : 0; },
    noise(dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.loopStart = Math.random(); return s; },
    env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); },

    // ------------------------------------------------------------------ one-shots
    // gain from distance to the nearest listener
    att(dist) { return U.clamp(1 / (1 + Math.max(0, dist - 4) * 0.06), 0, 1); },
    crash(sev, dist, kind) {
      if (!this.ctx || !this.enabled) return;
      const c = this.ctx, t = c.currentTime, a = this.att(dist) * U.clamp(sev / 9, 0.08, 1);
      if (a < 0.02) return;
      // crunch: filtered noise burst
      const n = this.noise(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = kind === 'bin' ? 'bandpass' : 'lowpass'; f.frequency.value = kind === 'bin' ? 900 : 1800 + sev * 300; f.Q.value = kind === 'bin' ? 2 : 0.7;
      n.connect(f); f.connect(g); g.connect(this.sfx); this.env(g, t, 0.004, a * 0.9, 0.15 + sev * 0.04); n.start(t); n.stop(t + 0.8);
      // thump
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(kind === 'bin' ? 160 : 90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      o.connect(og); og.connect(this.sfx); this.env(og, t, 0.005, a * (kind === 'bin' ? 0.4 : 1.1), 0.3); o.start(t); o.stop(t + 0.5);
      // metal ring for big car-on-car hits
      if (kind === 'car' && sev > 3) for (const fr of [310, 517, 733]) {
        const m = c.createOscillator(), mg = c.createGain(), bp = c.createBiquadFilter(); m.type = 'square'; m.frequency.value = fr * (0.9 + Math.random() * 0.2);
        bp.type = 'bandpass'; bp.frequency.value = fr * 2; bp.Q.value = 8; m.connect(bp); bp.connect(mg); mg.connect(this.sfx); this.env(mg, t, 0.003, a * 0.18, 0.35); m.start(t); m.stop(t + 0.5);
      }
    },
    scrape(slide, dist) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, a = this.att(dist) * U.clamp(slide / 12, 0.05, 0.4);
      if (a < 0.02) return;
      const n = this.noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 1500; f.Q.value = 6;
      n.connect(f); f.connect(g); g.connect(this.sfx); this.env(g, t, 0.01, a, 0.12); n.start(t); n.stop(t + 0.2);
    },
    glass(dist) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, a = this.att(dist) * 0.35;
      for (let i = 0; i < 7; i++) { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 2400 + Math.random() * 3500; o.connect(g); g.connect(this.sfx); const tt = t + Math.random() * 0.18; this.env(g, tt, 0.002, a * (0.3 + Math.random() * 0.7), 0.12 + Math.random() * 0.2); o.start(tt); o.stop(tt + 0.4); }
    },
    horn(type, dist) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, a = this.att(dist) * 0.32;
      if (a < 0.02) return;
      const pair = { hatch: [440, 554], estate: [392, 494], suv: [330, 415], van: [294, 370] }[type] || [400, 500];
      const g = c.createGain(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8; bp.connect(g); g.connect(this.sfx);
      for (const f of pair) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(bp); o.start(t); o.stop(t + 0.42); }
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a, t + 0.02); g.gain.setValueAtTime(a, t + 0.36); g.gain.linearRampToValueAtTime(0.0001, t + 0.42);
    },
    airHorn() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(g); g.connect(this.sfx);
      for (const f of [233, 294, 349]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.92, t); o.frequency.linearRampToValueAtTime(f, t + 0.12); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 1.8); o.connect(lp); o.start(t); o.stop(t + 1.8); }
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.05); g.gain.setValueAtTime(0.5, t + 1.5); g.gain.linearRampToValueAtTime(0.0001, t + 1.75);
    },
    beep(f, d, v) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(this.sfx); this.env(g, t, 0.005, v || 0.25, d || 0.12); o.start(t); o.stop(t + (d || 0.12) + 0.1);
    },
    tick(v) { if (!this.ctx) return; const c = this.ctx, t = c.currentTime, n = this.noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 5000; n.connect(f); f.connect(g); g.connect(this.sfx); this.env(g, t, 0.001, v || 0.12, 0.03); n.start(t); n.stop(t + 0.06); },
    clunk() { this.crash(2.5, 2, 'bin'); },

    // ------------------------------------------------------------------ continuous: engines and tyres for nearby cars
    engine(car, dist, on) {
      if (!this.ctx) return;
      let e = this.engines.get(car);
      if (!e) {
        const c = this.ctx;
        const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
        o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 3;
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx); g.gain.value = 0; o1.start(); o2.start();
        const n = this.noise(), nf = c.createBiquadFilter(), ng = c.createGain(); nf.type = 'bandpass'; nf.frequency.value = 1700; nf.Q.value = 3; n.connect(nf); nf.connect(ng); ng.connect(this.sfx); ng.gain.value = 0; n.start();
        e = { o1, o2, f, g, ng, base: { hatch: 46, estate: 38, suv: 32, van: 30 }[car.spec.type] || 38 };
        this.engines.set(car, e);
      }
      const t = this.ctx.currentTime, a = on ? this.att(dist) : 0;
      const v = Math.abs(car.forward), gearV = v % 6.5, rpm = e.base * (1 + gearV * 0.13 + Math.min(v, 22) * 0.02) * (1 + car.input.throttle * 0.15);
      e.o1.frequency.setTargetAtTime(rpm, t, 0.05); e.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.05);
      e.f.frequency.setTargetAtTime(400 + car.input.throttle * 900 + v * 20, t, 0.08);
      e.g.gain.setTargetAtTime(a * (0.05 + car.input.throttle * 0.07), t, 0.08);
      const sk = Math.max(car.skid[0], car.skid[1]);
      e.ng.gain.setTargetAtTime(a * sk * 0.22, t, 0.05);
    },
    stopEngines() { if (!this.engines) return; for (const [, e] of this.engines) { e.g.gain.value = 0; e.ng.gain.value = 0; } },

    // ------------------------------------------------------------------ music: Verulam Sound FM
    musicOn() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      this.musicBus.gain.cancelScheduledValues(t); this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t); this.musicBus.gain.linearRampToValueAtTime(this.vol.music * 0.55 * (this.speech.cur ? 0.45 : 1), t + 0.4);
      if (this.musicTimer) return;
      this.step = 0; this.nextT = t + 0.1;
      this.musicTimer = setInterval(() => this.schedule(), 50);
    },
    musicStop() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      // tape-stop: drop, then dead air
      this.musicBus.gain.cancelScheduledValues(t); this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t); this.musicBus.gain.linearRampToValueAtTime(0, t + 0.06);
      if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
      this.cutRadio();
      const n = this.noise(), g = c.createGain(); n.connect(g); g.connect(this.sfx); this.env(g, t, 0.001, 0.25, 0.08); n.start(t); n.stop(t + 0.12);
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.35); o.connect(og); og.connect(this.sfx); this.env(og, t, 0.005, 0.15, 0.35); o.start(t); o.stop(t + 0.4);
    },
    schedule() {
      const c = this.ctx, spb = 60 / 132 / 2; // eighth notes at 132 bpm
      while (this.nextT < c.currentTime + 0.2) { this.playStep(this.step, this.nextT, spb); this.step++; this.nextT += spb; }
    },
    playStep(s, t, d) {
      const c = this.ctx, out = this.radioIn;
      const bar = Math.floor(s / 8) % 8, st = s % 8;
      // I - vi - IV - V in C, twice, with a cheeky key change on the last two bars
      const prog = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
      const shift = (Math.floor(s / 64) % 2) ? 2 : 0;
      const chord = prog[bar].map((n) => n + shift);
      const note = (midi, type, dur, vol, at) => {
        const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        o.connect(g); g.connect(out); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.start(at); o.stop(at + dur + 0.05);
      };
      // drums
      if (st === 0 || st === 4) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); o.connect(g); g.connect(out); this.env(g, t, 0.003, 0.7, 0.16); o.start(t); o.stop(t + 0.2); }
      if (st === 2 || st === 6) { const n = this.noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.frequency.value = 1800; n.connect(f); f.connect(g); g.connect(out); this.env(g, t, 0.002, 0.35, 0.12); n.start(t); n.stop(t + 0.16); }
      { const n = this.noise(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 7000; n.connect(f); f.connect(g); g.connect(out); this.env(g, t, 0.001, st % 2 ? 0.08 : 0.14, 0.04); n.start(t); n.stop(t + 0.06); }
      // bass: bouncy root/fifth
      if (st % 2 === 0) note(chord[0] - 12 + (st === 4 ? 7 : 0), 'triangle', d * 1.6, 0.4, t);
      // organ stabs on the offbeat
      if (st % 2 === 1) for (const n of chord) note(n + 12, 'square', d * 0.7, 0.05, t);
      // melody: a cheery four-bar tune
      const mel = [76, 0, 74, 72, 74, 0, 76, 79, 77, 0, 76, 74, 72, 0, 0, 0, 74, 0, 72, 69, 72, 0, 74, 76, 74, 72, 71, 0, 67, 0, 0, 0];
      const m = mel[(s % 32)]; if (m && Math.floor(s / 32) % 2 === 0) note(m + shift, 'square', d * 1.4, 0.07, t);
      if (m && Math.floor(s / 32) % 2 === 1) note(m + shift + 12, 'triangle', d * 1.2, 0.09, t);
    },

    // ------------------------------------------------------------------ voices
    // Speech synthesis reads out exactly what the captions say: the TV commentator, Barry on the radio,
    // and (if wanted) the residents. One voice at a time: the commentator is never talked over, a line
    // that has waited too long is dropped rather than spoken out of step with the picture, and the
    // music ducks while anyone is talking. this.voices: 'all' | 'commentary' (commentator and Barry) | 'off'
    speech: { q: [], cur: null, voices: null, cast: new Map() },
    speechOK() { return !!(window.speechSynthesis && window.SpeechSynthesisUtterance); },
    unlockSpeech() {
      // iOS and some Androids only allow speech after a first utterance inside a user gesture
      if (!this.speechOK() || this.speech.unlocked) return;
      this.speech.unlocked = true;
      try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* optional */ }
      try { speechSynthesis.onvoiceschanged = () => { this.speech.voices = null; this.speech.cast.clear(); }; } catch (e) { /* optional */ }
    },
    voiceList() {
      const S = this.speech;
      if (!S.voices || !S.voices.length) {
        let all = []; try { all = speechSynthesis.getVoices(); } catch (e) { /* none */ }
        const gb = all.filter((v) => /en[-_]GB/i.test(v.lang));
        S.voices = gb.length ? gb : all.filter((v) => /^en/i.test(v.lang));
      }
      return S.voices;
    },
    // who sounds like what: the commentator and Barry get distinct, steady voices; residents are spread over the rest
    castFor(role, who) {
      const S = this.speech, key = role === 'resident' ? 'r:' + (who || '') : role;
      if (S.cast.has(key)) return S.cast.get(key);
      const vs = this.voiceList();
      const male = (v) => /male|daniel|george|arthur|ryan|thomas|oliver|james|harry|alfie|rishi/i.test(v.name) && !/female/i.test(v.name);
      const local = (v) => v.localService !== false;
      let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      let voice = null, pitch = 1, rate = 1.05;
      if (role === 'commentary') { voice = vs.find((v) => male(v) && local(v)) || vs.find(male) || vs[0] || null; pitch = 0.92; rate = 1.08; }
      else if (role === 'radio') {
        const pres = this.castFor('commentary').voice;
        voice = vs.find((v) => male(v) && v !== pres) || pres || vs[0] || null; pitch = voice === pres ? 1.18 : 1.05; rate = 1.12;
      } else {
        const pres = this.castFor('commentary').voice, pool = vs.filter((v) => v !== pres);
        const list = pool.length ? pool : vs;
        voice = list.length ? list[h % list.length] : null; pitch = 0.75 + (h % 7) * 0.09; rate = 0.98 + (h % 5) * 0.04;
      }
      const c = { voice, pitch, rate };
      S.cast.set(key, c);
      return c;
    },
    // item: { text, role: 'commentary' | 'radio' | 'resident', who, onstart, onend }
    say(item) {
      if (typeof item === 'string') item = { text: item, role: 'resident', who: arguments[1] };
      const mode = this.voices === true ? 'all' : this.voices === false ? 'off' : this.voices || 'all';
      if (mode === 'off' || !this.speechOK()) return false;
      if (mode === 'commentary' && item.role === 'resident') return false;
      const S = this.speech, pri = { commentary: 3, radio: 2, resident: 1 }[item.role] || 1;
      item.pri = pri; item.at = performance.now();
      if (!S.cur) { this.speakNow(item); return true; }
      if (pri > S.cur.pri) { // the commentator talks over everyone else
        S.q = S.q.filter((q) => q.pri >= pri);
        S.q.unshift(item); this.cancelSpeech(true);
        return true;
      }
      // otherwise wait in line; residents only queue behind each other briefly
      S.q = S.q.filter((q) => q.pri >= pri || q.pri > 1);
      S.q.push(item); S.q.sort((a, b) => b.pri - a.pri || a.at - b.at);
      if (S.q.length > 3) S.q.length = 3;
      return true;
    },
    speakNow(item) {
      const S = this.speech;
      let u;
      try { u = new SpeechSynthesisUtterance(item.text); } catch (e) { return; }
      const c = this.castFor(item.role, item.who);
      try { if (c.voice) u.voice = c.voice; } catch (e) { /* not a real voice object */ }
      u.lang = (c.voice && c.voice.lang) || 'en-GB'; u.pitch = c.pitch; u.rate = c.rate;
      u.volume = item.role === 'resident' ? 0.85 : 1;
      S.cur = item; item.u = u;
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        clearTimeout(item.guard);
        if (S.cur === item) S.cur = null;
        if (item.onend) item.onend();
        this.duck(false);
        // Chrome can swallow an utterance queued straight after cancel(): leave it a moment
        setTimeout(() => { if (!S.cur) this.nextSpeech(); }, 60);
      };
      u.onstart = () => { if (item.onstart) item.onstart(); };
      u.onend = finish; u.onerror = finish;
      item.finish = finish;
      // some engines never fire onend: give up after a generous estimate of the line's length
      item.guard = setTimeout(finish, 2500 + item.text.length * 110);
      this.duck(true);
      try { if (speechSynthesis.paused) speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { finish(); }
    },
    nextSpeech() {
      const S = this.speech, now = performance.now();
      while (S.q.length) {
        const it = S.q.shift();
        const maxWait = it.role === 'commentary' ? 4500 : it.role === 'radio' ? 3000 : 1800;
        if (now - it.at <= maxWait && !(it.stale && it.stale())) { this.speakNow(it); return; }
      }
    },
    cancelSpeech(keepQueue) {
      const S = this.speech;
      if (!keepQueue) S.q = [];
      const cur = S.cur;
      try { if (this.speechOK()) speechSynthesis.cancel(); } catch (e) { /* optional */ }
      if (cur && cur.finish) cur.finish();
      else if (keepQueue) setTimeout(() => { if (!S.cur) this.nextSpeech(); }, 60);
    },
    // Barry stops mid-word when the music does
    cutRadio() {
      const S = this.speech;
      S.q = S.q.filter((q) => q.role !== 'radio');
      if (S.cur && S.cur.role === 'radio') this.cancelSpeech(true);
    },
    duck(on) {
      if (!this.ctx || !this.musicTimer) return;
      const t = this.ctx.currentTime, g = this.musicBus.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(this.vol.music * 0.55 * (on ? 0.45 : 1), t + (on ? 0.15 : 0.6));
    },
  };
})(window.LS);
