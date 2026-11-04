/* Sound, all synthesised with Web Audio: the crowd bed, cheers and "woo"s, the "STRI-DERS" chant and
   claps, the timekeeper's bell, pyro booms, footsteps and a short rock entrance theme. */
(function () {
  'use strict';
  const AR = (window.AR = window.AR || {});
  const S = (AR.sound = { ctx: null, on: false });
  let ctx, master, comp, noiseBuf, bed, bedGain, bedFilter, musicGain;

  function makeNoise(seconds) {
    const n = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1; // pinkish
        b0 = 0.99765 * b0 + w * 0.099;
        b1 = 0.963 * b1 + w * 0.2965;
        b2 = 0.57 * b2 + w * 1.0526;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      }
    }
    return b;
  }
  function noise(dest, t, dur, opts = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.value = opts.freq || 1000;
    f.Q.value = opts.q || 0.8;
    const g = ctx.createGain();
    const a = opts.attack || 0.005, peak = opts.gain || 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.05);
    return { f, g };
  }
  function tone(dest, t, freq, dur, opts = {}) {
    const o = ctx.createOscillator();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.3, t + (opts.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      node = node.connect(f);
    }
    node.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  S.start = function () {
    if (S.ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = S.ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = S.muted ? 0 : 0.8;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = makeNoise(4);
    // crowd bed: two looping noise layers whose level and brightness follow the hype
    bedGain = ctx.createGain();
    bedGain.gain.value = 0.18;
    bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'bandpass';
    bedFilter.frequency.value = 650;
    bedFilter.Q.value = 0.5;
    bed = ctx.createBufferSource();
    bed.buffer = noiseBuf;
    bed.loop = true;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(bedGain.gain);
    lfo.start();
    bed.connect(bedFilter).connect(bedGain).connect(master);
    bed.start();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.32;
    musicGain.connect(master);
    S.on = true;
  };
  S.setMuted = function (m) {
    S.muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  };
  S.setHype = function (h) {
    if (!S.on) return;
    const t = ctx.currentTime;
    bedGain.gain.setTargetAtTime(0.14 + h * 0.36, t, 0.5);
    bedFilter.frequency.setTargetAtTime(500 + h * 700, t, 0.5);
  };

  // a roar: a swell of bright noise and a scatter of "woo"s
  S.cheer = function (amount = 1) {
    if (!S.on) return;
    const t = ctx.currentTime;
    noise(master, t, 2.2 + amount * 1.8, { freq: 1100, q: 0.5, gain: 0.25 + amount * 0.35, attack: 0.18 });
    noise(master, t + 0.05, 2.0 + amount * 1.5, { freq: 2600, q: 0.7, gain: 0.08 + amount * 0.12, attack: 0.25 });
    const n = Math.floor(4 + amount * 10);
    for (let i = 0; i < n; i++) {
      const st = t + Math.random() * 1.2;
      const f0 = 260 + Math.random() * 260;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.4), st + 0.35);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.9, st + 1.2);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5 + Math.random() * 2;
      const vg = ctx.createGain();
      vg.gain.value = f0 * 0.02;
      vib.connect(vg).connect(o.frequency);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.025 * amount + 0.01, st + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 1.3);
      o.connect(f).connect(g).connect(master);
      o.start(st);
      vib.start(st);
      o.stop(st + 1.4);
      vib.stop(st + 1.4);
    }
  };
  S.boo = function () {
    if (!S.on) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 10; i++) tone(master, t + Math.random() * 0.3, 110 + Math.random() * 40, 1.6, { type: 'sawtooth', gain: 0.02, attack: 0.2, filter: 500 });
  };
  function clapAt(t, gain = 0.3) {
    for (let k = 0; k < 6; k++) noise(master, t + Math.random() * 0.03, 0.12, { freq: 1300 + Math.random() * 600, q: 1.2, gain: gain / 3 });
  }
  // the chant: "STRI-DERS!" clap clap clap-clap-clap, twice
  S.chant = function () {
    if (!S.on) return;
    const t0 = ctx.currentTime + 0.05, beat = 0.42;
    for (let rep = 0; rep < 2; rep++) {
      const t = t0 + rep * beat * 8;
      for (const [k, f] of [[0, 220], [1, 185]]) {
        const st = t + k * beat;
        noise(master, st, 0.16, { freq: 5200, q: 1.5, gain: k ? 0.04 : 0.16 }); // the "S"
        for (let v = 0; v < 12; v++) {
          tone(master, st + 0.05 + Math.random() * 0.04, f * (0.96 + Math.random() * 0.08), beat * 0.95, { type: 'sawtooth', gain: 0.02, attack: 0.03, filter: 1300 });
        }
      }
      for (const b of [3, 4, 5.5, 6, 6.5]) clapAt(t + b * beat, 0.4);
    }
  };
  S.bell = function (times = 3) {
    if (!S.on) return;
    const t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const st = t + i * 0.32;
      for (const [r, g] of [[1, 0.35], [2.76, 0.18], [5.4, 0.1], [8.93, 0.05]]) tone(master, st, 820 * r, 2.2 / r + 0.4, { gain: g });
    }
  };
  S.boom = function () {
    if (!S.on) return;
    const t = ctx.currentTime;
    tone(master, t, 90, 1.2, { to: 30, glide: 0.9, gain: 0.9 });
    noise(master, t, 1.4, { type: 'lowpass', freq: 600, q: 0.5, gain: 0.8, attack: 0.01 });
    for (let i = 0; i < 30; i++) noise(master, t + 0.2 + Math.random() * 1.6, 0.03, { freq: 4000 + Math.random() * 3000, q: 3, gain: 0.1 });
  };
  S.whoosh = function () {
    if (!S.on) return;
    const t = ctx.currentTime;
    const n = noise(master, t, 0.5, { freq: 400, q: 1, gain: 0.25, attack: 0.15 });
    n.f.frequency.exponentialRampToValueAtTime(2500, t + 0.4);
  };
  S.thud = function (big) {
    if (!S.on) return;
    const t = ctx.currentTime;
    tone(master, t, big ? 120 : 160, big ? 0.5 : 0.25, { to: 45, glide: 0.25, gain: big ? 0.9 : 0.35 });
    noise(master, t, big ? 0.35 : 0.18, { type: 'lowpass', freq: 700, gain: big ? 0.5 : 0.2 });
  };
  S.step = function (surface) {
    if (!S.on) return;
    const t = ctx.currentTime;
    if (surface === 'mat') {
      tone(master, t, 110, 0.12, { to: 60, glide: 0.1, gain: 0.12 });
      noise(master, t, 0.08, { freq: 500, gain: 0.05 });
    } else if (surface === 'metal') {
      noise(master, t, 0.12, { freq: 2200, q: 4, gain: 0.07 });
      tone(master, t, 340 + Math.random() * 30, 0.15, { gain: 0.03 });
    } else {
      noise(master, t, 0.07, { freq: 1500 + Math.random() * 400, q: 1.5, gain: 0.05 });
    }
  };
  S.slap = function () {
    if (!S.on) return;
    noise(master, ctx.currentTime, 0.09, { freq: 2200, q: 0.9, gain: 0.4 });
  };
  S.mic = function () {
    // a burst of PA feedback before a promo
    if (!S.on) return;
    tone(master, ctx.currentTime, 1760, 0.5, { gain: 0.04, attack: 0.2 });
  };

  // ------------------------------------------------------------------ entrance theme
  // 4 bars of drums and an overdriven riff in E at 140 bpm
  let curve = null;
  function drive() {
    if (curve) return curve;
    curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 6);
    }
    return curve;
  }
  S.theme = function (bars = 8) {
    if (!S.on) return;
    const t0 = ctx.currentTime + 0.08;
    const beat = 60 / 140;
    const ws = ctx.createWaveShaper();
    ws.curve = drive();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const gg = ctx.createGain();
    gg.gain.value = 0.22;
    ws.connect(lp).connect(gg).connect(musicGain);
    const riff = [[0, 82.41, 0.5], [0.75, 82.41, 0.25], [1, 98, 0.5], [1.75, 110, 0.25], [2, 82.41, 0.5], [2.5, 123.47, 0.5], [3, 110, 0.5], [3.5, 98, 0.5]];
    for (let bar = 0; bar < bars; bar++) {
      const tb = t0 + bar * beat * 4;
      for (let b = 0; b < 4; b++) {
        const tk = tb + b * beat;
        // kick on 1 and 3, snare on 2 and 4, eighth-note hats
        if (b % 2 === 0) tone(musicGain, tk, 150, 0.35, { to: 40, glide: 0.12, gain: 0.9 });
        else noise(musicGain, tk, 0.22, { freq: 1800, q: 0.6, gain: 0.5 });
        noise(musicGain, tk, 0.05, { type: 'highpass', freq: 7000, gain: 0.12 });
        noise(musicGain, tk + beat / 2, 0.05, { type: 'highpass', freq: 7000, gain: 0.08 });
      }
      if (bar === bars - 1) noise(musicGain, tb + beat * 3, 2.5, { type: 'highpass', freq: 5000, gain: 0.25 }); // crash
      for (const [b, f, d] of riff) {
        const st = tb + b * beat;
        for (const m of [1, 1.4983, 2]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f * m * (bar % 4 === 3 && b >= 2 ? 1.122 : 1);
          o.detune.value = (Math.random() - 0.5) * 12;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, st);
          g.gain.exponentialRampToValueAtTime(0.3, st + 0.01);
          g.gain.setValueAtTime(0.3, st + d * beat * 0.9);
          g.gain.exponentialRampToValueAtTime(0.0001, st + d * beat);
          o.connect(g).connect(ws);
          o.start(st);
          o.stop(st + d * beat + 0.05);
        }
      }
    }
    return bars * 4 * beat;
  };
})();
