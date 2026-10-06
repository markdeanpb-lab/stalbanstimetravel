/* Procedural audio (WebAudio, no files): era ambience beds and events, the Gabriel bell, police
   sirens / bells / whistles, engines, hooves, bicycle bells, UI sounds. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const A = (SA.Audio = { ctx: null, ready: false, vol: 0.8, beds: {}, eventT: 0, engine: null });

  A.init = function (settings) {
    A.vol = settings.volume !== undefined ? settings.volume : 0.8;
    const unlock = () => {
      A.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    SA.on('era', (e) => A.setEra(e));
  };
  A.unlock = function () {
    if (A.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      A.ctx = new AC();
      const c = A.ctx;
      A.master = c.createGain();
      A.master.gain.value = A.vol;
      A.master.connect(c.destination);
      A.sfxBus = c.createGain();
      A.sfxBus.gain.value = 0.9;
      A.sfxBus.connect(A.master);
      A.ambBus = c.createGain();
      A.ambBus.gain.value = 0.55;
      A.ambBus.connect(A.master);
      // shared noise buffer
      const len = c.sampleRate * 2;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b = (b + 0.02 * w) / 1.02; // brownish
        d[i] = w * 0.5 + b * 3;
      }
      A.noise = buf;
      // a shared room: a synthetic impulse response gives every sound a little street reverb
      const ir = c.createBuffer(2, Math.floor(c.sampleRate * 2.2), c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const dd = ir.getChannelData(ch);
        for (let i = 0; i < dd.length; i++) {
          const k = i / dd.length;
          dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 3.4) * (i < 90 ? i / 90 : 1);
        }
      }
      A.reverb = c.createConvolver();
      A.reverb.buffer = ir;
      A.revOut = c.createGain();
      A.revOut.gain.value = 0.3;
      A.reverb.connect(A.revOut);
      A.revOut.connect(A.master);
      A.revSend = c.createGain();
      A.revSend.gain.value = 0.35;
      A.sfxBus.connect(A.revSend);
      A.ambBus.connect(A.revSend);
      A.revSend.connect(A.reverb);
      A.ready = true;
      if (c.state === 'suspended') c.resume();
      A.setEra(SA.Game.era);
    } catch (e) {
      A.ready = false;
    }
  };
  A.setVolume = function (v) {
    A.vol = v;
    if (A.master) A.master.gain.value = v;
  };

  function noiseSrc(loop) {
    const s = A.ctx.createBufferSource();
    s.buffer = A.noise;
    s.loop = !!loop;
    s.loopStart = Math.random();
    return s;
  }
  function env(g, t, a, peak, decay) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }
  // spatial: gain and pan from listener (camera)
  function spatial(x, z, vol) {
    const c = A.ctx;
    const g = c.createGain();
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    let gain = vol === undefined ? 1 : vol, pan = 0;
    if (x !== undefined && SA.Game.camera()) {
      const cam = SA.Game.camera();
      const dx = x - cam.position.x, dz = z - cam.position.z;
      const d = Math.hypot(dx, dz);
      gain *= 1 / (1 + d / 18);
      const yaw = SA.Game.cam.yaw;
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      pan = d > 0.1 ? U.clamp((dx * rx + dz * rz) / d, -1, 1) * 0.8 : 0;
    }
    g.gain.value = gain;
    if (p) {
      p.pan.value = pan;
      g.connect(p);
      p.connect(A.sfxBus);
    } else g.connect(A.sfxBus);
    return g;
  }
  function tone(type, f, t, dur, peak, out, a) {
    const c = A.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    const g = c.createGain();
    env(g, t, a || 0.005, peak, dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + (a || 0.005) + dur + 0.05);
    return o;
  }
  function burst(t, dur, peak, out, ftype, freq, q) {
    const c = A.ctx;
    const s = noiseSrc(false);
    const f = c.createBiquadFilter();
    f.type = ftype || 'lowpass';
    f.frequency.value = freq || 1000;
    f.Q.value = q || 0.7;
    const g = c.createGain();
    env(g, t, 0.004, peak, dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t, Math.random());
    s.stop(t + dur + 0.1);
  }

  // ---------------------------------------------------------------- the Gabriel bell (c.1335): inharmonic partials
  A.gabriel = function (vol, x, z) {
    if (!A.ready) return;
    const c = A.ctx, t = c.currentTime + 0.02;
    const out = spatial(x, z, (vol || 1) * 1.4);
    const f0 = 246; // strike note ~ B3 (estimated for a 1-ton bell)
    const partials = [[0.5, 0.5, 9], [1.0, 0.7, 6], [1.19, 0.45, 5], [1.5, 0.3, 4], [2.0, 0.5, 3.2], [2.51, 0.18, 2.4], [2.66, 0.15, 2], [3.01, 0.12, 1.6], [4.07, 0.07, 1.1]];
    for (const [m, a, d] of partials) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * m * (1 + (Math.random() - 0.5) * 0.002);
      const g = c.createGain();
      env(g, t, 0.006, a * 0.35, d);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + d + 0.2);
    }
    burst(t, 0.08, 0.25, out, 'bandpass', 2400, 2);
  };
  // ---------------------------------------------------------------- sfx table
  A.sfx = function (name, x, z, vol) {
    if (!A.ready) return;
    const c = A.ctx, t = c.currentTime + 0.01;
    const out = spatial(x, z, vol);
    switch (name) {
      case 'fwLaunch': {
        // a rocket's whoosh: noise swept upwards through a band-pass
        const s = noiseSrc(false);
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 3;
        f.frequency.setValueAtTime(500, t);
        f.frequency.exponentialRampToValueAtTime(3200, t + 1.2);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        s.connect(f);
        f.connect(g);
        g.connect(out);
        s.start(t, Math.random());
        s.stop(t + 1.5);
        break;
      }
      case 'fwBoom': {
        // the burst: a low thump with a long, rolling tail off the rooftops
        burst(t, 1.8, 0.9, out, 'lowpass', 180, 0.8);
        burst(t, 0.35, 0.5, out, 'lowpass', 900, 0.7);
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(70, t);
        o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
        const g = c.createGain();
        env(g, t, 0.004, 0.6, 0.7);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + 0.8);
        for (const [dly, v] of [[0.21, 0.35], [0.47, 0.22], [0.83, 0.12]]) burst(t + dly, 0.9, v, out, 'lowpass', 140, 0.7);
        break;
      }
      case 'fwCrackle': {
        // falling stars crackling: a scatter of tiny high clicks
        for (let i = 0; i < 26; i++) burst(t + Math.random() * 1.4, 0.03 + Math.random() * 0.03, 0.05 + Math.random() * 0.08, out, 'highpass', 2500 + Math.random() * 3000, 0.7);
        break;
      }
      case 'flutter': {
        // pigeons taking off: quick soft wing claps
        for (let i = 0; i < 9; i++) burst(t + i * 0.055 + Math.random() * 0.03, 0.05, 0.12, out, 'bandpass', 700 + Math.random() * 500, 1.2);
        break;
      }
      case 'whistle': {
        // police whistle: two close high pitches with a pea trill
        for (const f of [2800, 2870]) {
          const o = c.createOscillator();
          o.type = 'sine';
          o.frequency.value = f;
          const lfo = c.createOscillator();
          lfo.frequency.value = 24;
          const lg = c.createGain();
          lg.gain.value = 60;
          lfo.connect(lg);
          lg.connect(o.frequency);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
          g.gain.setValueAtTime(0.12, t + 0.5);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
          o.connect(g);
          g.connect(out);
          o.start(t);
          lfo.start(t);
          o.stop(t + 0.7);
          lfo.stop(t + 0.7);
        }
        break;
      }
      case 'siren2026': {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 2200;
        o.frequency.setValueAtTime(650, t);
        for (let i = 0; i < 4; i++) {
          o.frequency.linearRampToValueAtTime(1350, t + i * 0.6 + 0.3);
          o.frequency.linearRampToValueAtTime(650, t + i * 0.6 + 0.6);
        }
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
        g.gain.setValueAtTime(0.09, t + 2.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
        o.connect(f);
        f.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + 2.6);
        break;
      }
      case 'bell1964': {
        // mechanical police car bell: rapid strikes
        for (let i = 0; i < 14; i++) {
          const tt = t + i * 0.085;
          for (const [m, a] of [[1, 0.12], [2.76, 0.05], [5.4, 0.03]]) tone('sine', 1180 * m, tt, 0.18, a, out, 0.002);
        }
        break;
      }
      case 'horn2026':
        tone('square', 415, t, 0.35, 0.06, out, 0.01);
        tone('square', 523, t, 0.35, 0.05, out, 0.01);
        break;
      case 'scooterHorn':
        tone('square', 640, t, 0.28, 0.06, out, 0.01);
        tone('sawtooth', 660, t, 0.28, 0.03, out, 0.01);
        break;
      case 'bicycleBell':
        for (let i = 0; i < 2; i++) for (const [m, a] of [[1, 0.1], [2.4, 0.04], [3.9, 0.02]]) tone('sine', 2100 * m, t + i * 0.16, 0.5, a, out, 0.002);
        break;
      case 'horseWhinny': {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(700, t);
        o.frequency.linearRampToValueAtTime(1100, t + 0.15);
        o.frequency.linearRampToValueAtTime(500, t + 0.8);
        const lfo = c.createOscillator();
        lfo.frequency.value = 18;
        const lg = c.createGain();
        lg.gain.value = 70;
        lfo.connect(lg);
        lg.connect(o.frequency);
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1200;
        const g = c.createGain();
        env(g, t, 0.05, 0.07, 0.8);
        o.connect(f);
        f.connect(g);
        g.connect(out);
        o.start(t);
        lfo.start(t);
        o.stop(t + 1);
        lfo.stop(t + 1);
        break;
      }
      case 'crash':
        burst(t, 0.45, 0.5 * (vol || 1), out, 'lowpass', 1800);
        tone('sine', 70, t, 0.3, 0.4 * (vol || 1), out);
        break;
      case 'bump':
        burst(t, 0.12, 0.25, out, 'lowpass', 600);
        break;
      case 'door':
        burst(t, 0.06, 0.2, out, 'lowpass', 900);
        tone('sine', 120, t + 0.03, 0.08, 0.15, out);
        break;
      case 'shout':
        for (let i = 0; i < 2; i++) {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(180 + Math.random() * 40, t + i * 0.25);
          o.frequency.linearRampToValueAtTime(140, t + i * 0.25 + 0.22);
          const f = c.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 900;
          f.Q.value = 3;
          const g = c.createGain();
          env(g, t + i * 0.25, 0.02, 0.12, 0.2);
          o.connect(f);
          f.connect(g);
          g.connect(out);
          o.start(t + i * 0.25);
          o.stop(t + i * 0.25 + 0.3);
        }
        break;
      case 'tick':
        burst(t, 0.02, 0.18, out, 'highpass', 3000);
        break;
      case 'ratchet':
        for (let i = 0; i < 3; i++) burst(t + i * 0.05, 0.02, 0.2, out, 'bandpass', 2600, 4);
        break;
      case 'whoosh': {
        const s = noiseSrc(false);
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 1.2;
        f.frequency.setValueAtTime(200, t);
        f.frequency.exponentialRampToValueAtTime(3000, t + 1.4);
        f.frequency.exponentialRampToValueAtTime(300, t + 3.0);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        s.connect(f);
        f.connect(g);
        g.connect(out);
        s.start(t);
        s.stop(t + 3.3);
        break;
      }
      case 'chime':
        [784, 988, 1175].forEach((f, i) => tone('sine', f, t + i * 0.12, 0.9, 0.08, out, 0.004));
        break;
      case 'ui':
        tone('sine', 880, t, 0.08, 0.05, out);
        break;
      case 'cheer':
        for (let i = 0; i < 6; i++) burst(t + Math.random() * 0.4, 0.7, 0.08, out, 'bandpass', 600 + Math.random() * 800, 1.5);
        break;
      case 'coin':
        tone('sine', 1650, t, 0.2, 0.06, out);
        tone('sine', 2470, t + 0.06, 0.25, 0.05, out);
        break;
      case 'clopclop':
        for (let i = 0; i < 4; i++) burst(t + i * 0.18 + (i % 2) * 0.05, 0.05, 0.22, out, 'bandpass', 1400 + (i % 2) * 300, 6);
        break;
      default:
        break;
    }
  };

  // ---------------------------------------------------------------- ambience beds
  A.setEra = function (e) {
    if (!A.ready) return;
    const c = A.ctx;
    for (const k in A.beds) {
      const b = A.beds[k];
      b.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.6);
      setTimeout(() => {
        try {
          b.s.stop();
        } catch (er) {}
      }, 3000);
    }
    A.beds = {};
    const bed = (name, ftype, freq, gain, q) => {
      const s = noiseSrc(true);
      const f = c.createBiquadFilter();
      f.type = ftype;
      f.frequency.value = freq;
      f.Q.value = q || 0.7;
      const g = c.createGain();
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(gain, c.currentTime + 0.5, 1.2);
      s.connect(f);
      f.connect(g);
      g.connect(A.ambBus);
      s.start();
      A.beds[name] = { s, g, f };
    };
    if (e === 2026) {
      bed('traffic', 'lowpass', 260, 0.22);
      bed('city', 'bandpass', 900, 0.03, 0.5);
    } else if (e === 1964) {
      bed('traffic', 'lowpass', 200, 0.14);
      bed('crowd', 'bandpass', 700, 0.05, 0.9);
    } else {
      bed('crowd', 'bandpass', 600, 0.07, 0.8);
      bed('wind', 'lowpass', 140, 0.06);
    }
    A.eraNow = e;
  };

  // random ambient events + vehicle engine
  A.update = function (dt) {
    if (!A.ready) return;
    const c = A.ctx;
    SA.Music && SA.Music.update();
    // Robin's footsteps: one per half stride, heel and scuff, crisper on 1897 cobbles
    const pc = SA.Player.ch;
    if (pc && !SA.Player.vehicle && SA.Game.state === 'play' && (pc.speedNow || 0) > 0.4) {
      const half = Math.floor((pc.phase || 0) / Math.PI);
      if (half !== A.lastStep) {
        A.lastStep = half;
        const run = pc.speedNow > 3.2;
        const t0 = c.currentTime + 0.005;
        const out = spatial(pc.x, pc.z, run ? 0.5 : 0.32);
        const hard = SA.Game.era === 1897 ? 2600 : 1700;
        burst(t0, 0.035, 0.5, out, 'bandpass', hard * (0.9 + Math.random() * 0.2), 1.4);
        burst(t0 + 0.02, run ? 0.06 : 0.08, 0.18, out, 'highpass', 3200, 0.7);
      }
    }
    A.eventT -= dt;
    const e = SA.Game.era;
    const p = SA.Player.pos();
    if (A.eventT <= 0 && SA.Game.state === 'play') {
      A.eventT = 1.5 + Math.random() * 3.5;
      const r = Math.random();
      const ox = p.x + (Math.random() - 0.5) * 60, oz = p.z + (Math.random() - 0.5) * 60;
      if (e === 1897) {
        if (r < 0.35) A.sfx('clopclop', ox, oz, 0.7);
        else if (r < 0.55) A.swift(ox, oz);
        else if (r < 0.65) A.sfx('cheer', ox, oz, 0.6);
        else if (r < 0.8) A.bandPhrase();
      } else if (e === 1964) {
        if (r < 0.3) A.pigeon(ox, oz);
        else if (r < 0.5) A.trader(ox, oz);
        else if (r < 0.62) A.radio(ox, oz);
      } else {
        if (r < 0.3) A.pigeon(ox, oz);
        else if (r < 0.4) A.sfx('ui', ox, oz, 0.2);
        else if (r < 0.48) A.sfx('horn2026', ox, oz, 0.25);
      }
    }
    // engine loop for the player's vehicle
    const v = SA.Player.vehicle;
    if (v && v.def.engine !== 'pedal' && v.def.engine !== 'hooves') {
      if (!A.engine) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        const o2 = c.createOscillator();
        o2.type = 'square';
        const f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        const g = c.createGain();
        g.gain.value = 0;
        o.connect(f);
        o2.connect(f);
        f.connect(g);
        g.connect(A.sfxBus);
        o.start();
        o2.start();
        A.engine = { o, o2, g, f };
      }
      const rpm = 0.25 + Math.min(1, Math.abs(v.speed) / v.def.maxSpeed) * 0.75 + Math.abs(v.throttle) * 0.1;
      const base = v.def.engine === 'scooter' ? 95 : SA.Game.era === 1964 ? 42 : 36;
      A.engine.o.frequency.setTargetAtTime(base * (1 + rpm * 2.2), c.currentTime, 0.08);
      A.engine.o2.frequency.setTargetAtTime(base * 0.5 * (1 + rpm * 2.2), c.currentTime, 0.08);
      A.engine.g.gain.setTargetAtTime(SA.Game.era === 2026 ? 0.03 : 0.06, c.currentTime, 0.1);
    } else if (A.engine) {
      A.engine.g.gain.setTargetAtTime(0, c.currentTime, 0.15);
    }
    // hooves / pedalling for horse vehicles and bicycles ridden by the player
    if (v && (v.def.engine === 'hooves' || v.def.engine === 'pedal')) {
      A.stepAcc = (A.stepAcc || 0) + Math.abs(v.speed) * dt;
      const step = v.def.engine === 'hooves' ? 1.6 : 2.4;
      if (A.stepAcc > step) {
        A.stepAcc = 0;
        if (v.def.engine === 'hooves') A.sfx('clopclop', v.x, v.z, 0.6);
        else A.sfx('tick', v.x, v.z, 0.3);
      }
    }
  };
  A.pigeon = function (x, z) {
    const c = A.ctx, t = c.currentTime;
    const out = spatial(x, z, 0.5);
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(420, t + i * 0.45);
      o.frequency.linearRampToValueAtTime(520, t + i * 0.45 + 0.15);
      o.frequency.linearRampToValueAtTime(380, t + i * 0.45 + 0.35);
      const g = c.createGain();
      env(g, t + i * 0.45, 0.05, 0.06, 0.3);
      o.connect(g);
      g.connect(out);
      o.start(t + i * 0.45);
      o.stop(t + i * 0.45 + 0.4);
    }
  };
  A.swift = function (x, z) {
    const c = A.ctx, t = c.currentTime;
    const out = spatial(x, z, 0.4);
    for (let i = 0; i < 5; i++) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(5200 + Math.random() * 800, t + i * 0.07);
      o.frequency.linearRampToValueAtTime(4200, t + i * 0.07 + 0.06);
      const g = c.createGain();
      env(g, t + i * 0.07, 0.005, 0.03, 0.06);
      o.connect(g);
      g.connect(out);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.1);
    }
  };
  A.trader = function (x, z) {
    // a market trader's call: two "syllables" with vowel formants
    const c = A.ctx, t = c.currentTime;
    const out = spatial(x, z, 0.5);
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(150 + i * 20, t + i * 0.22);
      o.frequency.linearRampToValueAtTime(130 + i * 10, t + i * 0.22 + 0.2);
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = [700, 1100, 900][i];
      f.Q.value = 4;
      const g = c.createGain();
      env(g, t + i * 0.22, 0.02, 0.1, 0.2);
      o.connect(f);
      f.connect(g);
      g.connect(out);
      o.start(t + i * 0.22);
      o.stop(t + i * 0.22 + 0.25);
    }
  };
  A.radio = function (x, z) {
    // a few bars from a transistor radio: tinny jangly chords
    const c = A.ctx, t = c.currentTime;
    const out = spatial(x, z, 0.35);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 1;
    f.connect(out);
    const chords = [[392, 494, 587], [440, 523, 659], [349, 440, 523], [392, 494, 587]];
    chords.forEach((ch, i) => ch.forEach((fr) => tone('square', fr, t + i * 0.42, 0.38, 0.02, f, 0.005)));
  };
  // brass band (Jubilee night): an oom-pah phrase near the Town Hall
  A.bandPhrase = function () {
    const th = SA.Landmarks.townHallInfo;
    if (!th) return;
    const c = A.ctx, t = c.currentTime;
    const out = spatial(th.x + th.nx * 8, th.z + th.nz * 8, 0.9);
    const mel = [523, 587, 659, 523, 659, 698, 784, 784];
    const bass = [131, 196, 131, 196, 147, 196, 131, 196];
    for (let i = 0; i < 8; i++) {
      tone('sawtooth', bass[i], t + i * 0.3, 0.22, 0.05, out, 0.01);
      tone('triangle', mel[i], t + i * 0.3, 0.26, 0.05, out, 0.02);
    }
  };
})();
