/* LAST SPACE - HUD: one overlay per player view, plus the TV graphics shared by both. */
(function (LS) {
  'use strict';
  const U = LS.U;
  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const fmt = (t) => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  class ViewHUD {
    constructor(root, view, match) {
      this.view = view; this.m = match;
      const r = this.root = el('div', 'vhud', root);
      this.bug = el('div', 'tvbug', r, '<span class="live">● LIVE</span> <b>LAST SPACE</b><span class="clock">18:15</span>');
      this.info = el('div', 'roundinfo', r);
      this.phase = el('div', 'phasebox', r);
      this.phaseLabel = el('div', 'phase-label', this.phase);
      this.timer = el('div', 'phase-timer', this.phase);
      this.sub = el('div', 'phase-sub', this.phase);
      this.list = el('div', 'drivers', r);
      this.mini = el('canvas', 'minimap', r); this.mini.width = 220; this.mini.height = 220;
      this.dash = el('div', 'dash', r);
      this.speed = el('div', 'speed', this.dash);
      this.gear = el('div', 'gear', this.dash);
      this.dmg = el('canvas', 'dmg', this.dash); this.dmg.width = 70; this.dmg.height = 110;
      this.park = el('div', 'parkbox', r);
      this.park.innerHTML = '<svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="50" class="bg"/><circle cx="60" cy="60" r="50" class="fg"/></svg><div class="parktext"></div>';
      this.ringFg = this.park.querySelector('.fg'); this.parkText = this.park.querySelector('.parktext');
      this.prompt = el('div', 'prompt', r);
      this.arrow = el('div', 'arrow', r, '<div class="arr">➤</div><div class="arrd"></div>');
      this.vignette = el('div', 'vignette', r);
      this.camhint = el('div', 'camhint', r);
      this.out = el('div', 'outbanner', r);
      this.lastList = '';
      this.drawMapBase();
    }
    place(rect, H) { const s = this.root.style; s.left = rect.x + 'px'; s.top = (H - rect.y - rect.h) + 'px'; s.width = rect.w + 'px'; s.height = rect.h + 'px'; this.root.classList.toggle('compact', rect.h < 520 || rect.w < 760); }
    drawMapBase() {
      const A = this.m.arena;
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      for (const l of A.wallLines) for (const p of l) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
      const S = 204 / Math.max(maxx - minx, maxy - miny);
      this.mx = (x) => 8 + (x - minx) * S; this.my = (y) => 212 - (y - miny) * S; this.mS = S;
      const c = document.createElement('canvas'); c.width = c.height = 220; const g = c.getContext('2d');
      g.fillStyle = 'rgba(14,18,24,0.72)'; g.fillRect(0, 0, 220, 220);
      g.strokeStyle = '#6b7684'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const st of A.streets) { g.beginPath(); st.line.pts.forEach((p, i) => (i ? g.lineTo(this.mx(p[0]), this.my(p[1])) : g.moveTo(this.mx(p[0]), this.my(p[1])))); g.stroke(); }
      g.strokeStyle = '#3c4450'; g.lineWidth = 9; g.beginPath(); g.rect(this.mx(A.carpark.x) - 4, this.my(A.carpark.y) - 4, 8, 8); g.stroke();
      g.fillStyle = '#c9d1db'; g.font = 'bold 9px Arial';
      const lab = { 'Dalton Street': 0.45, 'Bernard Street': 0.5, 'Church Street': 0.55, 'Grange Street': 0.42 };
      for (const n in lab) { const st = A.byName[n], p = st.line.at(st.line.length * lab[n]); g.save(); g.translate(this.mx(p.x), this.my(p.y)); let ang = -p.heading; if (Math.cos(ang) < 0) ang += Math.PI; g.rotate(ang); g.textAlign = 'center'; g.fillText(n.replace(' Street', ' St').toUpperCase(), 0, -6); g.restore(); }
      for (const b of A.barriers) { g.fillStyle = '#d42a1e'; g.fillRect(this.mx(b.x) - 3, this.my(b.y) - 3, 6, 6); }
      this.mapBase = c;
    }
    update(dt, t, settings) {
      const m = this.m, car = this.view.car, tgt = this.view.target();
      const P = m.phase;
      // round info
      const alive = m.alive.length, spaces = m.spacesThisRound || Math.max(1, alive - 1);
      this.info.innerHTML = m.mode === 'tutorial' ? '<b>TUTORIAL</b>' : `ROUND <b>${Math.max(1, m.round)}</b> · <span title="drivers">🚗 ${alive} DRIVERS</span> · <span title="spaces">🅿 ${P === 'battle' || P === 'sudden' ? m.parking.active.filter((s) => !(s.owner && s.owner.park.parked)).length + ' / ' : ''}${spaces} SPACE${spaces === 1 ? '' : 'S'}</span>`;
      const clockMin = 15 + Math.floor(m.time / 60);
      this.bug.querySelector('.clock').textContent = '18:' + String(Math.min(59, clockMin)).padStart(2, '0');
      // phase
      let label = '', timer = '', sub = '', cls = '';
      if (P === 'intro') { label = 'GET READY'; timer = String(Math.max(1, Math.ceil(m.phaseLen - m.phaseT))); sub = 'Radio on in…'; cls = 'intro'; }
      else if (P === 'circulation') { label = '♪ MUSIC PLAYING — CIRCULATE'; timer = '?:??'; sub = (LS.TEXT.radio[m.round % LS.TEXT.radio.length]) + ' · the music will stop without warning'; cls = 'circ'; }
      else if (P === 'battle') { label = 'PARK!'; timer = fmt(m.timeLeft); sub = m.spacesThisRound === 1 ? 'ONE SPACE. TWO DRIVERS.' : 'Find a space and hold it until the horn'; cls = m.timeLeft < 10 ? 'battle hot' : 'battle'; }
      else if (P === 'horn') { label = 'HORN!'; timer = ''; sub = m.lastHorn && m.lastHorn.out.length ? 'Out: ' + m.lastHorn.out.map((c) => c.short).join(', ') : 'Nobody parked…'; cls = 'horn'; }
      else if (P === 'sudden') { label = 'SUDDEN DEATH'; timer = fmt(m.timeLeft); sub = 'First to hold a space for 3 seconds wins'; cls = 'sudden'; }
      else if (P === 'finale') { label = 'WINNER'; sub = m.winner ? m.winner.name : ''; cls = 'final'; }
      else if (P === 'free') { label = m.tutorialTitle || ''; timer = ''; sub = ''; cls = 'circ'; }
      this.phase.className = 'phasebox ' + cls;
      this.phaseLabel.textContent = label; this.timer.textContent = timer; this.sub.textContent = sub;
      // drivers list (shape + colour + number; never colour alone)
      const rows = m.cars.slice().sort((a, b) => (a.status === b.status ? a.index - b.index : a.status === 'active' ? -1 : 1));
      const html = rows.map((c) => {
        const st = c.status !== 'active' ? 'out' : c.park.parked ? 'parked' : c.park.progress > 0 ? 'parking' : '';
        const tag = st === 'out' ? '✖ OUT' : st === 'parked' ? '🅿 PARKED' : st === 'parking' ? Math.round(c.park.progress * 100) + '%' : '';
        return `<div class="drow ${st} ${c === car ? 'me' : ''}"><span class="glyph" style="color:${c.identity.color}">${c.identity.glyph}</span><span class="dnum">${c.human ? 'P' + (c.player + 1) : c.index + 1}</span><span class="dname">${c.short}</span><span class="dveh">${c.spec.type.toUpperCase()}</span><span class="dst">${tag}</span></div>`;
      }).join('');
      if (html !== this.lastList) { this.list.innerHTML = html; this.lastList = html; }
      this.drawMinimap(t);
      // dashboard
      this.speed.innerHTML = `<b>${Math.round(Math.abs(tgt.forward) * 2.237)}</b><small>MPH</small>`;
      this.gear.textContent = tgt.gear === -1 ? 'R' : 'D';
      this.gear.className = 'gear ' + (tgt.gear === -1 ? 'rev' : '');
      this.drawDamage(tgt);
      // parking state
      const pk = tgt.park;
      const inBattle = P === 'battle' || P === 'sudden' || (P === 'free' && m.parking.active.length);
      if (inBattle && (pk.progress > 0 || pk.parked || (pk.near && pk.measure && pk.measure.out < 1.5))) {
        this.park.style.display = 'block';
        const circ = 2 * Math.PI * 50;
        this.ringFg.style.strokeDasharray = circ; this.ringFg.style.strokeDashoffset = circ * (1 - pk.progress);
        this.park.classList.toggle('done', pk.parked);
        let txt;
        if (pk.parked) txt = '<b>PARKED</b><br>HOLD YOUR POSITION';
        else if (pk.hint === 'lines') txt = 'Outside the lines' + (pk.measure ? ` (${Math.round(pk.measure.out * 100)} cm)` : '');
        else if (pk.hint === 'align') txt = 'Straighten up';
        else if (pk.hint === 'slow') txt = 'Too fast — walking pace';
        else if (pk.hint === 'taken') txt = 'Space taken';
        else if (pk.hint === 'upright') txt = 'Wheels down first';
        else txt = 'PARKING… keep still';
        this.parkText.innerHTML = txt;
      } else this.park.style.display = 'none';
      // prompts
      let prompt = '';
      if (car.status === 'active') {
        if (car.recovering) prompt = 'RECOVERING… you are vulnerable';
        else if (car.canRecover && LS.Touch && LS.Touch.active && this.view.idx === 0) prompt = 'Stuck? Hold <b>RECOVER</b>';
        else if (car.canRecover) prompt = `<kbd>${this.view.idx === 0 && m.humans.length < 2 ? 'R' : this.view.idx === 0 ? 'R' : 'L'}</kbd> / <kbd>X</kbd> hold to recover`;
      } else if (car.status === 'eliminated' && m.phase !== 'results' && m.phase !== 'finale') prompt = LS.Touch && LS.Touch.wanted() ? `Spectating ${tgt.short} · tap ❚❚ for the menu` : `Spectating ${tgt.short} · <kbd>Tab</kbd> next driver · <kbd>Esc</kbd> menu`;
      this.prompt.innerHTML = prompt; this.prompt.style.display = prompt ? 'block' : 'none';
      this.out.style.display = car.status === 'eliminated' && P !== 'finale' && P !== 'results' ? 'block' : 'none';
      this.out.innerHTML = `ELIMINATED<small>${car.place ? 'Finished ' + ordinal(car.place) : ''}</small>`;
      // arrow to the nearest free live space
      const free = m.parking.active.filter((s) => !(s.owner && s.owner.park.parked && s.owner !== tgt));
      if ((P === 'battle' || P === 'sudden' || P === 'free') && free.length && !pk.parked && tgt.status === 'active') {
        let best = null, bd = 1e9; for (const s of free) { const d = U.dist(tgt.x, tgt.y, s.sp.x, s.sp.y); if (d < bd) { bd = d; best = s; } }
        const ang = Math.atan2(best.sp.y - tgt.y, best.sp.x - tgt.x) - this.view.yaw;
        this.arrow.style.display = bd > 8 ? 'block' : 'none';
        this.arrow.querySelector('.arr').style.transform = `rotate(${-ang * 180 / Math.PI - 90}deg)`;
        this.arrow.querySelector('.arrd').textContent = `${best.sp.label} · ${Math.round(bd)} m`;
      } else this.arrow.style.display = 'none';
      // van: no rear window
      const noRear = tgt.spec.rearView === 0 && ((this.view.mode === 'park' && tgt.gear === -1) || (LS.Input.players[this.view.idx].out.look));
      this.vignette.className = 'vignette' + (noRear ? ' norear' : '');
      this.vignette.textContent = noRear ? 'NO REAR WINDOW · NO SENSORS · USE YOUR MIRRORS' : '';
      this.camhint.textContent = this.view.mode === 'park' ? 'PARKING CAMERA' : '';
    }
    drawMinimap(t) {
      const g = this.mini.getContext('2d'), m = this.m, me = this.view.target();
      g.clearRect(0, 0, 220, 220); g.drawImage(this.mapBase, 0, 0);
      for (const s of m.parking.spaces) {
        if (s.status === 'idle') continue;
        const x = this.mx(s.sp.x), y = this.my(s.sp.y);
        if (s.status === 'candidate') { g.fillStyle = '#ffd400'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', x, y); }
        else if (s.status === 'suspended') { g.strokeStyle = '#e8402a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3); g.stroke(); }
        else {
          const own = s.owner && s.owner.park.parked ? s.owner : null;
          g.fillStyle = own ? own.identity.color : '#1d4f9c'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
          g.fillRect(x - 6, y - 6, 12, 12); g.strokeRect(x - 6, y - 6, 12, 12);
          g.fillStyle = own ? '#111' : '#fff'; g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(own ? own.identity.glyph : 'P', x, y + 0.5);
          if (!own && Math.sin(t * 6) > 0) { g.strokeStyle = '#fff'; g.beginPath(); g.arc(x, y, 10, 0, 7); g.stroke(); }
        }
      }
      for (const c of m.cars) {
        if (c.status !== 'active') continue;
        const x = this.mx(c.x), y = this.my(c.y);
        if (c === me) { g.save(); g.translate(x, y); g.rotate(-c.a); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, 6); g.lineTo(-3, 0); g.lineTo(-6, -6); g.closePath(); g.fill(); g.stroke(); g.restore(); }
        LS.drawShape(g, c.identity.shape, x, y, c === me ? 5 : 4.5, c.identity.color, '#000', 1.2);
      }
    }
    drawDamage(c) {
      const g = this.dmg.getContext('2d'), d = c.damage;
      g.clearRect(0, 0, 70, 110);
      const col = (v) => `hsl(${120 - v * 120},70%,${55 - v * 15}%)`;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(15, 10, 40, 90);
      g.fillStyle = col(d.front); g.fillRect(17, 12, 36, 20);
      g.fillStyle = col(d.rear); g.fillRect(17, 78, 36, 20);
      g.fillStyle = col(d.left); g.fillRect(17, 34, 10, 42);
      g.fillStyle = col(d.right); g.fillRect(43, 34, 10, 42);
      g.fillStyle = '#111'; g.fillRect(29, 34, 12, 42);
      g.fillStyle = '#fff'; g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.fillText(Math.round(d.total * 100) + '%', 35, 59);
      if (!c.parts.bumperF) { g.fillStyle = '#e8402a'; g.fillText('✖', 35, 8 + 1); }
    }
    dispose() { this.root.remove(); }
  }
  function ordinal(n) { return n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'); }
  LS.ordinal = ordinal;

  // shared TV graphics: commentary/remark captions and big announcements
  class TVOverlay {
    constructor(root) {
      this.root = el('div', 'tv', root);
      this.captions = el('div', 'captions', this.root);
      this.big = el('div', 'bigmsg', this.root);
      this.lower = el('div', 'lowerthird', this.root);
      this.items = [];
    }
    caption(r) {
      const d = el('div', 'cap ' + r.channel, this.captions, `<span class="who">${r.speaker}</span><span class="what">${r.text}</span>`);
      this.items.push({ d, t: 4.5 + r.text.length * 0.03 });
      while (this.items.length > 3) { const x = this.items.shift(); x.d.remove(); }
    }
    announce(text, sub, cls, dur) {
      this.big.className = 'bigmsg show ' + (cls || ''); this.big.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
      this.bigT = dur || 2.2;
    }
    lowerThird(title, sub, dur) { this.lower.innerHTML = `<b>${title}</b><span>${sub || ''}</span>`; this.lower.classList.add('show'); this.lowerT = dur || 4; }
    update(dt) {
      for (const it of this.items.slice()) { it.t -= dt; if (it.t < 0.4) it.d.classList.add('fade'); if (it.t <= 0) { it.d.remove(); this.items.splice(this.items.indexOf(it), 1); } }
      if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) this.big.classList.remove('show'); }
      if (this.lowerT > 0) { this.lowerT -= dt; if (this.lowerT <= 0) this.lower.classList.remove('show'); }
    }
    clear() { this.captions.innerHTML = ''; this.items = []; this.big.classList.remove('show'); this.lower.classList.remove('show'); }
  }
  LS.ViewHUD = ViewHUD; LS.TVOverlay = TVOverlay;
})(window.LS);
