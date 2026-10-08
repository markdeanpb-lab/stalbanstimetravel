/* LAST SPACE - menus: title, match setup (vehicle choice), settings, controls, pause, results. */
(function (LS) {
  'use strict';
  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const M = LS.Menus = {};

  M.root = null;
  M.show = function (html, cls) {
    if (M.root) { M.root.remove(); M.root = null; }
    const o = M.root = el('div', 'overlay ' + (cls || ''), document.getElementById('ui'), html);
    const first = o.querySelector('[data-focus]') || o.querySelector('button');
    if (first) setTimeout(() => first.focus(), 30);
    return o;
  };
  M.hide = function () { if (M.root) { M.root.remove(); M.root = null; } M.current = null; };
  M.on = (sel, fn) => { M.root.querySelectorAll(sel).forEach((b) => b.addEventListener('click', (e) => { LS.Audio.init(); fn(e, b); })); };
  // gamepad / arrow navigation between buttons in the current overlay
  M.navigate = function () {
    if (!M.root) return;
    const I = LS.Input.menu || {};
    const items = Array.from(M.root.querySelectorAll('button, [tabindex="0"]')).filter((b) => b.offsetParent !== null);
    if (!items.length) return;
    let i = items.indexOf(document.activeElement);
    if (I.down || I.right) { items[(i + 1 + items.length) % items.length].focus(); }
    if (I.up || I.left) { items[(i - 1 + items.length) % items.length].focus(); }
    if (I.ok && document.activeElement && items.includes(document.activeElement)) document.activeElement.click();
  };

  // re-render the current screen when its wording depends on touch vs keys
  M.refresh = function () { if (M.root && M.current) M.current(); };
  M.title = function () {
    M.current = M.title;
    M.show(`
      <div class="title-card">
        <div class="kicker">LIVE · 18:15 · A WEEKDAY · ST ALBANS AL3</div>
        <h1>LAST SPACE<span>: ST ALBANS</span></h1>
        <p class="tag">Everyone is home. Every household has two enormous cars. There is nowhere to park.</p>
        <div class="streets">Bernard Street · Grange Street · Dalton Street · Church Street</div>
        <div class="menu-buttons">
          <button data-act="solo" data-focus>SOLO MATCH <small>you vs seven residents</small></button>
          <button data-act="duo">TWO-PLAYER SPLIT-SCREEN <small>${LS.Touch.label('player 2 needs a gamepad or keyboard', 'plus six residents')}</small></button>
          <button data-act="tutorial">TUTORIAL <small>driving, shunting, parking</small></button>
          <button data-act="settings">SETTINGS</button>
          <button data-act="controls">CONTROLS</button>
        </div>
        <p class="fine">A neighbourhood parking dispute, now a televised sport. All residents are fictional. Street layout © OpenStreetMap contributors.</p>
      </div>`, 'title');
    M.on('[data-act=solo]', () => M.setup(1));
    M.on('[data-act=duo]', () => M.setup(2));
    M.on('[data-act=tutorial]', () => LS.Game.startTutorial());
    M.on('[data-act=settings]', () => M.settings(M.title));
    M.on('[data-act=controls]', () => M.controls(M.title));
  };

  const bars = (n) => '<span class="bar">' + '■'.repeat(n) + '<i>' + '■'.repeat(5 - n) + '</i></span>';
  M.setup = function (players) {
    M.current = () => M.setup(players);
    const S = LS.Game.settings;
    const picks = (S.lastPicks || ['hatch', 'suv']).slice(0, players);
    while (picks.length < players) picks.push('estate');
    const card = (t, p) => {
      const v = LS.VEHICLES[t];
      return `<button class="vcard ${picks[p] === t ? 'sel' : ''}" data-p="${p}" data-t="${t}">
        <div class="vimg vimg-${t}"></div>
        <div class="vname">${v.name}</div><div class="vclass">${v.class}</div>
        <div class="vstats"><div>Acceleration ${bars(v.stats.accel)}</div><div>Ramming ${bars(v.stats.ram)}</div><div>Handling ${bars(v.stats.handling)}</div><div>Parking ${bars(v.stats.parking)}</div><div>Durability ${bars(v.stats.durability)}</div></div>
        <div class="vblurb">${v.blurb}</div><div class="vsize">${v.L.toFixed(2)} m × ${v.W.toFixed(2)} m · ${v.mass} kg</div></button>`;
    };
    let html = `<div class="setup"><h2>${players === 1 ? 'SOLO MATCH' : 'TWO-PLAYER SPLIT-SCREEN'}</h2>`;
    for (let p = 0; p < players; p++) {
      html += `<div class="pick"><h3><span class="glyph" style="color:${LS.IDENTITY[p].color}">${LS.IDENTITY[p].glyph}</span> PLAYER ${p + 1} <small>${p === 0 && LS.Touch.wanted() ? 'Touch: steering pad on the left, pedals on the right' : players === 2 ? (p === 0 ? 'W A S D · Space · Q horn · E camera · R recover' : '↑ ↓ ← → · / handbrake · . horn · , camera · L recover') : 'WASD or arrows · Space handbrake · H horn · C parking camera · R recover'}</small></h3><div class="vcards">${LS.VEHICLE_ORDER.map((t) => card(t, p)).join('')}</div></div>`;
    }
    html += `<div class="setup-row"><label>Residents <select id="diff"><option value="easy">Polite</option><option value="normal">Entitled</option><option value="hard">Unhinged</option></select></label>
      <button data-act="go" data-focus>START THE EVENING ▶</button><button data-act="back">BACK</button></div></div>`;
    M.show(html, 'setupov');
    M.root.querySelector('#diff').value = S.difficulty || 'normal';
    M.on('.vcard', (e, b) => { const p = +b.dataset.p; picks[p] = b.dataset.t; M.root.querySelectorAll(`.vcard[data-p="${p}"]`).forEach((c) => c.classList.toggle('sel', c === b)); });
    M.on('[data-act=back]', () => M.title());
    M.on('[data-act=go]', () => {
      S.difficulty = M.root.querySelector('#diff').value; S.lastPicks = picks.concat((S.lastPicks || []).slice(players)); LS.Game.saveSettings();
      LS.Game.startMatch({ players: picks.map((t) => ({ type: t })), difficulty: S.difficulty });
    });
  };

  M.settings = function (back) {
    const S = LS.Game.settings;
    M.show(`<div class="panel"><h2>SETTINGS</h2>
      <label class="row"><span>Camera shake</span><input type="checkbox" id="shake" ${S.shake ? 'checked' : ''}></label>
      <label class="row"><span>Spoken voices${LS.Audio.speechOK() ? '' : ' (not available in this browser)'}</span><select id="voices"><option value="all">Commentary, radio and residents</option><option value="commentary">Commentary and radio only</option><option value="off">Off</option></select></label>
      <label class="row"><span>Music volume</span><input type="range" id="music" min="0" max="1" step="0.05" value="${S.music}"></label>
      <label class="row"><span>Effects volume</span><input type="range" id="sfx" min="0" max="1" step="0.05" value="${S.sfx}"></label>
      <label class="row"><span>Graphics</span><select id="quality"><option value="high">High (shadows)</option><option value="medium">Medium</option><option value="low">Low (no shadows)</option></select></label>
      <label class="row"><span>Split-screen layout</span><select id="split"><option value="auto">Automatic</option><option value="horizontal">Top / bottom</option><option value="vertical">Side by side</option></select></label>
      <label class="row"><span>Touch controls</span><select id="touchc"><option value="auto">Automatic</option><option value="on">Always on</option><option value="off">Off</option></select></label>
      <label class="row"><span>Larger HUD text</span><input type="checkbox" id="bighud" ${S.bighud ? 'checked' : ''}></label>
      <p class="fine">Spaces and drivers always use shapes, patterns and labels as well as colour. Graphics changes apply to the next match.</p>
      <button data-act="back" data-focus>DONE</button></div>`);
    const R = M.root;
    R.querySelector('#quality').value = S.quality; R.querySelector('#split').value = S.split; R.querySelector('#touchc').value = S.touch || 'auto'; R.querySelector('#voices').value = S.voices || 'all';
    const save = () => {
      S.shake = R.querySelector('#shake').checked; S.voices = R.querySelector('#voices').value; if (S.voices === 'off') LS.Audio.cancelSpeech(); S.music = +R.querySelector('#music').value; S.sfx = +R.querySelector('#sfx').value;
      S.quality = R.querySelector('#quality').value; S.split = R.querySelector('#split').value; S.bighud = R.querySelector('#bighud').checked; S.touch = R.querySelector('#touchc').value;
      LS.Game.saveSettings(); LS.Game.applySettings();
    };
    R.querySelectorAll('input,select').forEach((i) => i.addEventListener('change', save));
    M.on('[data-act=back]', () => { save(); back(); });
  };

  M.controls = function (back) {
    M.show(`<div class="panel wide"><h2>CONTROLS</h2>
      <table class="ctl"><tr><th></th><th>Solo keyboard</th><th>Split-screen P1</th><th>Split-screen P2</th><th>Gamepad</th></tr>
      <tr><td>Accelerate</td><td>W / ↑</td><td>W</td><td>↑</td><td>RT</td></tr>
      <tr><td>Brake, then reverse</td><td>S / ↓</td><td>S</td><td>↓</td><td>LT</td></tr>
      <tr><td>Steer</td><td>A D / ← →</td><td>A D</td><td>← →</td><td>Left stick</td></tr>
      <tr><td>Handbrake</td><td>Space</td><td>Space</td><td>/ or Num 0</td><td>A</td></tr>
      <tr><td>Horn</td><td>H or Q</td><td>Q</td><td>. or Enter</td><td>B</td></tr>
      <tr><td>Parking camera</td><td>C or E</td><td>E</td><td>, or Num 1</td><td>Y</td></tr>
      <tr><td>Look behind</td><td>F or B</td><td>F</td><td>K or Num 3</td><td>RB</td></tr>
      <tr><td>Recover (when stuck, hold)</td><td>R</td><td>R</td><td>L or Num 2</td><td>X</td></tr>
      <tr><td>Pause</td><td colspan="3">Esc or P</td><td>Start</td></tr></table>
      <p>With one gamepad in split-screen, player 2 uses the pad and player 1 the keyboard.</p>
      <p><b>Touch screens:</b> hold the phone sideways. Drag the <b>STEER</b> pad with your left thumb; how far you drag is how much lock you get. Press <b>GO</b> and <b>BRAKE</b> with your right thumb, higher up the pedal for more, and keep holding BRAKE once stopped to reverse. <b>HANDBRAKE</b> is above the pedals; <b>HORN</b>, <b>CAM</b> and <b>LOOK BACK</b> are above the steering pad; <b>RECOVER</b> appears when you are stuck; <b>❚❚</b> pauses. Settings can force touch controls on or off.</p>
      <h3>The rules</h3>
      <ul><li>While the radio plays, circulate. <b>?</b> markers show where spaces <i>might</i> appear.</li>
      <li>When the music stops, live spaces light up (blue, striped, <b>P</b>, numbered). You have 45 seconds.</li>
      <li>A valid park: your whole car inside the lines, facing along the space (within 15°), below walking pace for 2 seconds.</li>
      <li>Parked is not safe. Get shoved out and you are not parked any more.</li>
      <li>At the horn, everyone not parked is out. Next round: one space fewer than drivers.</li>
      <li>Nobody parked? Sudden death: first to hold a space for 3 seconds wins.</li></ul>
      <button data-act="back" data-focus>BACK</button></div>`);
    M.on('[data-act=back]', () => back());
  };

  M.pause = function () {
    M.show(`<div class="panel"><h2>PAUSED</h2><p class="fine">The neighbours are waiting.</p>
      <button data-act="resume" data-focus>RESUME</button><button data-act="restart">RESTART MATCH</button><button data-act="settings">SETTINGS</button><button data-act="controls">CONTROLS</button><button data-act="quit">QUIT TO TITLE</button></div>`);
    M.on('[data-act=resume]', () => LS.Game.resume());
    M.on('[data-act=restart]', () => LS.Game.restart());
    M.on('[data-act=settings]', () => M.settings(M.pause));
    M.on('[data-act=controls]', () => M.controls(M.pause));
    M.on('[data-act=quit]', () => LS.Game.quit());
  };

  M.results = function (res) {
    const rows = res.standings.map((c, i) => `<tr class="${c.human ? 'me' : ''}"><td>${LS.ordinal(i + 1)}</td><td><span class="glyph" style="color:${c.identity.color}">${c.identity.glyph}</span> ${c.name}${c.human ? ' <b>(P' + (c.player + 1) + ')</b>' : ''}</td><td>${c.spec.name}</td><td>${i === 0 ? 'Parked. Smug.' : 'Out in round ' + (c.elimRound || '-')}</td><td>${Math.round(c.damage.total * 100)}%</td></tr>`).join('');
    const awards = res.awards.map((a) => `<div class="award"><div class="atitle">${a.title}</div><div class="awho"><span class="glyph" style="color:${a.car.identity.color}">${a.car.identity.glyph}</span> ${a.car.name}</div><div class="atext">${a.text}</div></div>`).join('');
    const tickets = res.tickets.slice(0, 4).map((t) => `<div class="pcn"><div class="pcnh">PENALTY CHARGE NOTICE <span>${t.pcn}</span></div><div class="pcnb"><div><b>Vehicle:</b> ${t.car.spec.name} (${t.car.name})</div><div><b>Contravention ${t.code}:</b> ${t.offence}</div><div><b>Location:</b> ${t.car.park.space ? t.car.park.space.sp.street : 'Grange Street'}, St Albans, 18:${String(15 + Math.floor(res.duration / 60)).padStart(2, '0')}</div><div class="fine-amt">${t.fine}</div></div></div>`).join('');
    const w = res.winner;
    M.show(`<div class="results">
      <div class="res-head"><div class="kicker">FULL TIME · ${res.rounds} ROUND${res.rounds === 1 ? '' : 'S'} · ${Math.floor(res.duration / 60)} MIN ${Math.round(res.duration % 60)} S</div>
      <h2>${w ? w.name.toUpperCase() + ' WINS' : 'NOBODY WINS'}</h2><p>${w ? `${w.spec.name}, ${Math.round(w.damage.total * 100)}% damaged, perfectly parked${res.technicality ? ' (on a technicality)' : ''}.` : ''} “You can’t leave it there.”</p></div>
      <div class="res-cols"><div><h3>STANDINGS</h3><table class="stand">${rows}</table><h3>MATCH AWARDS</h3><div class="awards">${awards}</div></div>
      <div><h3>TICKETS ISSUED</h3><div class="pcns">${tickets}</div></div></div>
      <div class="menu-buttons row"><button data-act="again" data-focus>REMATCH</button><button data-act="cars">CHANGE CARS</button><button data-act="title">TITLE</button></div></div>`, 'resultsov');
    M.on('[data-act=again]', () => LS.Game.restart());
    M.on('[data-act=cars]', () => M.setup(LS.Game.cfg.players.length));
    M.on('[data-act=title]', () => LS.Game.quit());
  };
})(window.LS);
