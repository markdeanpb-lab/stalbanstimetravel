/* Adaptive score, synthesised with Web Audio (no files). A small sequencer schedules notes a little
   ahead of the audio clock. Each year has its own theme: a reflective piano and pad in 2026, a
   jangling guitar and walking bass in 1964, a parlour string waltz with a celesta in 1897. When
   the police are after Robin a driving chase cue takes over, coloured by the year. The title has
   its own clockwork theme. Cues crossfade, and the score ducks under dialogue. The volume follows
   Settings > Music. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const Mu = (SA.Music = { cue: null, next: null, vol: 0.5 });

  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
  // chords as MIDI roots and qualities
  const CH = { maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], sus2: [0, 2, 7] };

  function ctx() {
    return SA.Audio && SA.Audio.ready ? SA.Audio.ctx : null;
  }
  // ---------------------------------------------------------------- instruments
  function envGain(c, t, a, peak, hold, rel) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (hold > 0) g.gain.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    return g;
  }
  function osc(c, type, f, t, end, dest, detune) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(end);
    return o;
  }
  const INST = {
    piano(c, out, n, t, dur, v) {
      const f = NOTE(n);
      const g = envGain(c, t, 0.004, 0.22 * v, 0, 1.6 + dur);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3800, t);
      lp.frequency.exponentialRampToValueAtTime(900, t + 1.2);
      lp.connect(g);
      g.connect(out);
      osc(c, 'triangle', f, t, t + dur + 1.8, lp);
      const h = c.createGain();
      h.gain.value = 0.35;
      h.connect(lp);
      osc(c, 'sine', f * 2.003, t, t + dur + 1.2, h);
    },
    pad(c, out, n, t, dur, v) {
      const f = NOTE(n);
      const g = envGain(c, t, 0.9, 0.06 * v, dur - 0.9, 1.5);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      lp.connect(g);
      g.connect(out);
      osc(c, 'sawtooth', f, t, t + dur + 1.6, lp, -7);
      osc(c, 'sawtooth', f, t, t + dur + 1.6, lp, 7);
    },
    strings(c, out, n, t, dur, v) {
      const f = NOTE(n);
      const g = envGain(c, t, 0.12, 0.07 * v, Math.max(0, dur - 0.2), 0.45);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      lp.connect(g);
      g.connect(out);
      const vib = c.createOscillator();
      vib.frequency.value = 5.2;
      const vg = c.createGain();
      vg.gain.value = f * 0.004;
      vib.connect(vg);
      for (const d of [-6, 5]) {
        const o = osc(c, 'sawtooth', f, t, t + dur + 0.6, lp, d);
        vg.connect(o.frequency);
      }
      vib.start(t);
      vib.stop(t + dur + 0.6);
    },
    pluck(c, out, n, t, dur, v) {
      const f = NOTE(n);
      const g = envGain(c, t, 0.003, 0.13 * v, 0, 0.55);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.3);
      lp.Q.value = 2;
      lp.connect(g);
      g.connect(out);
      osc(c, 'square', f, t, t + 0.7, lp);
      osc(c, 'sawtooth', f * 1.002, t, t + 0.7, lp);
    },
    bass(c, out, n, t, dur, v) {
      const f = NOTE(n);
      const g = envGain(c, t, 0.01, 0.2 * v, Math.max(0, dur * 0.6), 0.25);
      g.connect(out);
      osc(c, 'sine', f, t, t + dur + 0.4, g);
      const h = c.createGain();
      h.gain.value = 0.3;
      h.connect(g);
      osc(c, 'triangle', f * 2, t, t + dur + 0.4, h);
    },
    celesta(c, out, n, t, dur, v) {
      const f = NOTE(n);
      for (const [m, a, d] of [[1, 0.1, 1.4], [2.76, 0.04, 0.5], [5.4, 0.02, 0.25]]) {
        const g = envGain(c, t, 0.002, a * v, 0, d);
        g.connect(out);
        osc(c, 'sine', f * m, t, t + d + 0.1, g);
      }
    },
    lead(c, out, n, t, dur, v) {
      const f = NOTE(n);
      const g = envGain(c, t, 0.01, 0.06 * v, Math.max(0, dur - 0.05), 0.12);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      lp.connect(g);
      g.connect(out);
      osc(c, 'sawtooth', f, t, t + dur + 0.3, lp, -4);
      osc(c, 'square', f, t, t + dur + 0.3, lp, 4);
    },
    kick(c, out, n, t, dur, v) {
      const g = envGain(c, t, 0.002, 0.5 * v, 0, 0.22);
      g.connect(out);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.3);
    },
    noise(c, out, n, t, dur, v, type, freq) {
      const A = SA.Audio;
      const s = c.createBufferSource();
      s.buffer = A.noise;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = envGain(c, t, 0.002, v, 0, dur);
      s.connect(f);
      f.connect(g);
      g.connect(out);
      s.start(t, Math.random());
      s.stop(t + dur + 0.05);
    },
    snare(c, out, n, t, dur, v) {
      INST.noise(c, out, n, t, 0.16, 0.16 * v, 'bandpass', 1800);
      const g = envGain(c, t, 0.002, 0.08 * v, 0, 0.08);
      g.connect(out);
      osc(c, 'triangle', 190, t, t + 0.1, g);
    },
    hat(c, out, n, t, dur, v) {
      INST.noise(c, out, n, t, 0.04, 0.06 * v, 'highpass', 7000);
    },
    brush(c, out, n, t, dur, v) {
      INST.noise(c, out, n, t, 0.12, 0.05 * v, 'bandpass', 4200);
    },
    tick(c, out, n, t, dur, v) {
      INST.noise(c, out, n, t, 0.02, 0.07 * v, 'bandpass', 3000);
    },
  };

  // ---------------------------------------------------------------- cues
  // each cue: bpm, beats per bar, a chord progression (root MIDI note + quality, one per bar)
  // and a beat(i, bar, beatInBar, chord, t, play) that schedules that beat's notes
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  const CUES = {
    title: {
      bpm: 66, bar: 4,
      prog: [[52, 'min'], [48, 'maj7'], [55, 'maj'], [50, 'sus2']],
      beat(b, bar, k, ch, t, play, r) {
        play('tick', 0, t, 0.05, 0.8);
        if (k === 0) {
          for (const iv of CH[ch[1]]) play('pad', ch[0] + iv, t, (60 / this.bpm) * this.bar, 0.9);
          play('bass', ch[0] - 12, t, 1.6, 0.7);
        }
        if (k === 1 || (k === 3 && r() < 0.5)) {
          const scale = [0, 2, 3, 7, 10];
          play('celesta', ch[0] + 24 + scale[Math.floor(r() * scale.length)], t, 0.5, 0.8);
        }
      },
    },
    2026: {
      bpm: 76, bar: 4,
      prog: [[57, 'min7'], [53, 'maj7'], [48, 'maj'], [55, 'sus2'], [57, 'min7'], [53, 'maj7'], [50, 'min7'], [52, 'min']],
      beat(b, bar, k, ch, t, play, r) {
        const notes = CH[ch[1]];
        if (k === 0) {
          for (const iv of notes) play('pad', ch[0] + iv, t, (60 / this.bpm) * this.bar, 0.7);
          play('bass', ch[0] - 12, t, 1.4, 0.6);
        }
        // a gentle broken chord on the piano, eighth notes, sometimes resting
        const step = 60 / this.bpm / 2;
        for (let h = 0; h < 2; h++) {
          if (r() < 0.22) continue;
          const idx = (k * 2 + h) % notes.length;
          play('piano', ch[0] + 12 + notes[idx] + (r() < 0.15 ? 12 : 0), t + h * step, 0.4, 0.55);
        }
      },
    },
    1964: {
      bpm: 104, bar: 4,
      prog: [[50, 'maj'], [59, 'min'], [55, 'maj'], [57, 'dom7']],
      beat(b, bar, k, ch, t, play, r) {
        const notes = CH[ch[1]];
        const step = 60 / this.bpm;
        // walking bass
        const walk = [0, notes[1], notes[2], k === 3 ? 10 : 5];
        play('bass', ch[0] - 12 + walk[k], t, step * 0.8, 0.8);
        // jangling strummed chords on 2 and 4, a guitar figure in between
        if (k === 1 || k === 3) for (let s = 0; s < notes.length; s++) play('pluck', ch[0] + 12 + notes[s], t + s * 0.012, 0.3, 0.6);
        else if (r() < 0.6) play('pluck', ch[0] + 24 + notes[Math.floor(r() * notes.length)], t + step * 0.5, 0.2, 0.5);
        play('brush', 0, t, 0.1, k % 2 ? 1 : 0.6);
      },
    },
    1897: {
      bpm: 92, bar: 3,
      prog: [[48, 'maj'], [55, 'dom7'], [55, 'dom7'], [48, 'maj'], [53, 'maj'], [48, 'maj'], [55, 'dom7'], [48, 'maj']],
      beat(b, bar, k, ch, t, play, r) {
        const notes = CH[ch[1]];
        const step = 60 / this.bpm;
        // waltz: bass on one, chords on two and three
        if (k === 0) play('bass', ch[0] - 12, t, step * 0.9, 0.7);
        else for (const iv of notes.slice(0, 3)) play('strings', ch[0] + 12 + iv, t, step * 0.5, 0.45);
        // the melody in the first violin
        if (k === 0 || r() < 0.45) {
          const pick = notes[Math.floor(r() * notes.length)] + (r() < 0.3 ? 2 : 0);
          play('strings', ch[0] + 24 + pick, t, step * (k === 0 ? 1.4 : 0.8), 0.7);
        }
        if (k === 0 && bar % 4 === 3) play('celesta', ch[0] + 36, t + step * 0.5, 0.4, 0.6);
      },
    },
    chase: {
      bpm: 132, bar: 4,
      prog: [[50, 'min'], [50, 'min'], [46, 'maj'], [48, 'maj']],
      beat(b, bar, k, ch, t, play, r) {
        const step = 60 / this.bpm;
        const era = SA.Game.era;
        // a driving eighth-note ostinato
        for (let h = 0; h < 2; h++) play('bass', ch[0] - 12 + (h ? 12 : 0), t + h * step * 0.5, step * 0.4, 0.75);
        play('kick', 0, t, 0.2, k % 2 === 0 ? 1 : 0.6);
        if (k === 1 || k === 3) play('snare', 0, t, 0.2, 1);
        play('hat', 0, t + step * 0.5, 0.05, 0.8);
        const lead = era === 1897 ? 'strings' : era === 1964 ? 'pluck' : 'lead';
        if (k === 0 || r() < 0.4) {
          const sc = [0, 3, 5, 7, 10];
          play(lead, ch[0] + 12 + sc[Math.floor(r() * sc.length)], t, step * 0.45, 0.8);
        }
      },
    },
  };

  // ---------------------------------------------------------------- engine
  Mu.init = function (settings) {
    Mu.vol = settings.music !== undefined ? settings.music : 0.5;
  };
  function ensureBus(c) {
    if (Mu.bus) return;
    const A = SA.Audio;
    Mu.bus = c.createGain();
    Mu.bus.gain.value = Mu.vol * 0.5;
    Mu.bus.connect(A.master);
    if (A.reverb) {
      const send = c.createGain();
      send.gain.value = 0.55;
      Mu.bus.connect(send);
      send.connect(A.reverb);
    }
  }
  Mu.setVolume = function (v) {
    Mu.vol = v;
    const c = ctx();
    if (c && Mu.bus) Mu.bus.gain.setTargetAtTime(v * 0.5, c.currentTime, 0.2);
  };
  function startCue(name, c) {
    const cue = CUES[name];
    if (!cue) return null;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(1, c.currentTime, 0.9);
    g.connect(Mu.bus);
    return { name, cue, g, beat: 0, at: c.currentTime + 0.15, r: rng(name.length * 977 + 13) };
  }
  function stopCue(p, c) {
    p.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.7);
    setTimeout(() => {
      try {
        p.g.disconnect();
      } catch (e) {}
    }, 4000);
  }
  Mu.wanted = function () {
    const st = SA.Game.state;
    if (st === 'title' || st === 'loading') return 'title';
    if (SA.Police && SA.Police.level > 0) return 'chase';
    return String(SA.Game.era);
  };
  Mu.update = function () {
    const c = ctx();
    if (!c || Mu.vol <= 0.001) return;
    ensureBus(c);
    const want = Mu.wanted();
    if (!Mu.cue || Mu.cue.name !== want) {
      if (Mu.cue) stopCue(Mu.cue, c);
      Mu.cue = startCue(want, c);
    }
    // duck under conversation
    const talk = SA.Dialogue && SA.Dialogue.busy && SA.Dialogue.busy();
    Mu.bus.gain.setTargetAtTime(Mu.vol * 0.5 * (talk ? 0.45 : 1), c.currentTime, 0.4);
    const p = Mu.cue;
    if (!p) return;
    const cue = p.cue;
    const spb = 60 / cue.bpm;
    if (p.at < c.currentTime - 0.5) p.at = c.currentTime + 0.05; // after a stall, resync
    while (p.at < c.currentTime + 0.3) {
      const bar = Math.floor(p.beat / cue.bar);
      const k = p.beat % cue.bar;
      const ch = cue.prog[bar % cue.prog.length];
      const play = (inst, n, t, dur, v) => INST[inst] && INST[inst](c, p.g, n, t, dur, v === undefined ? 1 : v);
      cue.beat(p.beat, bar, k, ch, p.at, play, p.r);
      p.beat++;
      p.at += spb;
    }
  };
})();
