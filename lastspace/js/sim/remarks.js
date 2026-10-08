/* LAST SPACE - remarks: turns match events into short lines from drivers, neighbours and the TV
   commentary. Lines are rate-limited per channel, avoid recent repeats, and only fire after
   something relevant has actually happened. */
(function (LS) {
  'use strict';
  const U = LS.U;

  class Remarks {
    constructor(match, rand) {
      this.m = match; this.rand = rand; this.T = LS.TEXT;
      this.last = { driver: -99, neighbour: -99, commentary: -99, radio: -99 };
      this.used = new Map(); // text -> time last used
      this.keyT = new Map(); // key -> time
      match.on('*', (ev, d) => this.on(ev, d));
    }
    // how the commentary refers to a driver: "You" is fine on your own screen but not on the telly
    nm(c) { return c.human && c.short === LS.TEXT.playerNames[0] ? 'Player One' : c.short; }
    fmt(s, d) { return s.replace(/\{(\w+)\}/g, (_, k) => (d && d[k] != null ? d[k] : '')); }
    pick(list) {
      const now = this.m.time;
      const fresh = list.filter((t) => now - (this.used.get(t) ?? -999) > 90);
      const t = (fresh.length ? fresh : list)[Math.floor(this.rand() * (fresh.length || list.length))];
      this.used.set(t, now);
      return t;
    }
    say(channel, key, who, data, opts) {
      const now = this.m.time, o = opts || {};
      const gap = channel === 'commentary' ? 3.2 : 4.5;
      if (!o.force && now - this.last[channel] < gap) return false;
      if (!o.force && now - (this.keyT.get(key + (who && who.index != null ? who.index : '')) ?? -999) < (o.cool || 25)) return false;
      if (!o.force && o.p != null && this.rand() > o.p) return false;
      const pool = channel === 'commentary' ? this.T.commentary[key] : channel === 'radio' ? this.T.dj[key] : this.T.remarks[key];
      if (!pool) return false;
      const text = this.fmt(this.pick(pool), data);
      this.last[channel] = now; this.keyT.set(key + (who && who.index != null ? who.index : ''), now);
      let speaker;
      if (channel === 'commentary') speaker = 'COMMENTARY';
      else if (channel === 'radio') speaker = 'BARRY · VERULAM SOUND';
      else if (channel === 'neighbour') speaker = (o.neighbour || this.T.neighbours[Math.floor(this.rand() * this.T.neighbours.length)]).toUpperCase();
      else speaker = who ? who.name.toUpperCase() : 'RESIDENT';
      this.m.emit('remark', { channel, key, text, speaker, car: who || null, time: now });
      return true;
    }

    on(ev, d) {
      const m = this.m;
      if (ev === 'remark') return;
      switch (ev) {
        case 'phase':
          if (d.phase === 'intro' && m.mode === 'match') this.say('commentary', 'intro', null, {}, { force: true });
          if (d.phase === 'circulation' && d.round > 1) {
            if (d.spaces === 1) this.say('commentary', 'final', null, {}, { force: true });
            else this.say('commentary', 'round', null, { round: d.round, drivers: d.drivers, spaces: d.spaces }, { force: true });
          }
          if (d.phase === 'sudden') this.say('commentary', 'sudden', null, {}, { force: true });
          // Barry chats over the music; if the radio is still on later he starts another link (and gets cut off)
          if (d.phase === 'circulation' && m.mode === 'match') {
            const round = m.round;
            const live = () => m.phase === 'circulation' && m.round === round;
            m.after(round === 1 ? 4.5 : 6.5, () => { if (live()) this.say('radio', 'open', null, {}, { force: true }); });
            m.after(round === 1 ? 17 : 19, () => { if (live()) this.say('radio', 'more', null, {}, { force: true }); });
          }
          break;
        case 'musicStop': this.say('commentary', 'music_stop', null, {}, { force: true }); break;
        case 'horn': this.say('commentary', 'horn', null, {}, { force: true }); break;
        case 'parked': {
          const c = d.car, sp = d.space.sp;
          const data = { name: this.nm(c), space: d.space.sp.name || d.space.sp.label.replace(/^(\w)(\w*)/, (a, x, y) => x + y.toLowerCase()), vehicle: c.spec.class.toLowerCase() };
          if (c.home && U.dist(c.home.x, c.home.y, sp.x, sp.y) < 22) { this.say('driver', 'outside_house', c, data, { force: true }); break; }
          // it is always outside somebody's house: the nearest front door has views
          if (this.rand() < 0.4) {
            let h = null, bd = 1e9; for (const q of m.arena.houses) { const dd = U.dist(q.x, q.y, sp.x, sp.y); if (dd < bd) { bd = dd; h = q; } }
            if (h && bd < 16 && this.say('neighbour', 'outside_house', null, data, { cool: 20, neighbour: `No. ${h.num}, ${h.street}` })) break;
          }
          if (!this.say('commentary', 'parked', c, data, { cool: 10 })) this.say('driver', 'parked', c, data, { p: 0.3 });
          if ((c.spec.type === 'suv' || c.spec.type === 'van') && this.rand() < 0.35) this.say('driver', 'both_cars', c, data, { cool: 60 });
          break;
        }
        case 'dislodged': {
          const c = d.car, by = d.by;
          const data = { name: this.nm(c), by: by ? this.nm(by) : 'Someone', space: d.space ? (d.space.sp.name ? 'the space ' + d.space.sp.name : d.space.sp.label) : 'the space' };
          if (by) {
            if (!this.say('driver', 'permit', by, data, { cool: 30 })) this.say('commentary', 'dislodged', c, data, { cool: 8 });
          } else this.say('driver', 'lost_space', c, data, { p: 0.6 });
          if (by && by.spec.type === 'suv' && c.spec.type === 'hatch') this.say('neighbour', 'suv_push', null, data, { p: 0.5, cool: 50 });
          break;
        }
        case 'eliminatedGroup': {
          const cs = d.cars; if (!cs.length) break;
          // one grumble per horn (a human's first, if one went out), and one line of commentary for the lot
          const who = cs.find((c) => c.human) || cs[Math.floor(this.rand() * cs.length)];
          this.say('driver', 'residents_group', who, { name: this.nm(who) }, { force: true });
          if (cs.length === 1) setTimeoutish(m, 1.6, () => this.say('commentary', 'eliminated', cs[0], { name: this.nm(cs[0]) }, { force: true }));
          else {
            const names = cs.map((c) => this.nm(c)), list = names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
            const n = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'][cs.length] || String(cs.length);
            setTimeoutish(m, 1.6, () => this.say('commentary', 'eliminated_many', null, { names: list, n }, { force: true }));
          }
          break;
        }
        case 'impact': {
          if (d.severity > 6.5) { if (!this.say('commentary', 'big_hit', null, {}, { cool: 12 })) this.say('neighbour', 'big_hit', null, {}, { p: 0.5, cool: 20 }); }
          if (d.aggressor && d.severity > 2.5 && Math.abs(d.aggressor.steerAngle) > 0.22) this.say('driver', 'indicating', d.aggressor, {}, { p: 0.55, cool: 40 });
          break;
        }
        case 'bin': this.say('neighbour', 'bin', null, {}, { p: 0.5, cool: 18 }); break;
        case 'resident':
          if (!this.say('neighbour', 'resident', null, {}, { p: 0.6, cool: 20 }) && d.car && (d.car.spec.type === 'suv' || d.car.spec.type === 'van')) this.say('driver', 'both_cars', d.car, {}, { p: 0.3, cool: 60 });
          break;
        case 'pavement': this.say('neighbour', 'pavement', null, {}, { p: 0.5, cool: 30 }); break;
        case 'hornUse': this.say('neighbour', 'horn', null, {}, { p: 0.25, cool: 30 }); break;
        case 'overturn': if (!this.say('commentary', 'overturned', d.car, { name: this.nm(d.car) }, { cool: 15 })) this.say('neighbour', 'overturned', null, {}, { p: 0.6 }); break;
        case 'recovered': this.say('neighbour', 'recovered', null, {}, { p: 0.3, cool: 30 }); break;
        case 'extraSpace': this.say('commentary', 'extra_space', null, {}, { force: true }); break;
        case 'winner':
          this.say('commentary', 'winner', d.car, { name: this.nm(d.car) }, { force: true });
          setTimeoutish(m, 2.2, () => this.say('neighbour', 'cant_leave', null, {}, { force: true, neighbour: 'Mrs Cotterill, No. 12' }));
          break;
      }
    }
  }
  // schedule on the match clock (works in Node tests too)
  function setTimeoutish(m, delay, fn) { (m.timers = m.timers || []).push({ t: m.time + delay, fn }); }
  LS.Remarks = Remarks;
})(window.LS);
