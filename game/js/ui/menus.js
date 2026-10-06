/* Menus and full-screen panels: title, pause, settings, save code, map, journal, controls, credits,
   the letter, the choice and the mission-complete card. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const M = (SA.Menus = { open: null });
  const $ = (id) => document.getElementById(id);

  function showScreen(id, on) {
    U.show(id, on);
  }
  function anyOpen() {
    return ['screen-pause', 'screen-map', 'screen-journal', 'screen-code', 'screen-settings', 'screen-help', 'screen-credits', 'screen-letter', 'screen-choice', 'screen-complete'].some((id) => !$(id).classList.contains('hidden'));
  }
  M.anyOpen = anyOpen;

  M.init = function () {
    // title
    $('btn-new').onclick = () => {
      hideTitle();
      SA.Game.newGame();
    };
    $('btn-continue').onclick = () => {
      const d = SA.Save.read();
      hideTitle();
      if (!d || !SA.Game.load(d)) SA.Game.newGame();
    };
    $('btn-import').onclick = () => M.openCode(true);
    $('btn-settings-t').onclick = () => M.openSettings();
    $('btn-credits-t').onclick = () => M.openCredits();
    // pause
    $('btn-resume').onclick = () => M.closeAll();
    $('btn-map').onclick = () => M.openMap();
    $('btn-journal').onclick = () => M.openJournal();
    $('btn-save').onclick = () => {
      const ok = SA.Game.save(true);
      $('pause-note').textContent = ok ? 'Saved to this browser.' : 'Browser storage is unavailable here: use "Save code" to keep your progress.';
    };
    $('btn-code').onclick = () => M.openCode(false);
    $('btn-settings').onclick = () => M.openSettings();
    $('btn-help').onclick = () => M.openHelp();
    $('btn-credits').onclick = () => M.openCredits();
    $('btn-quit').onclick = () => {
      SA.Game.save(true);
      M.closeAll(true);
      M.showTitle();
    };
    // code
    $('btn-code-copy').onclick = async () => {
      const t = $('code-text');
      t.select();
      let ok = false;
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(t.value);
          ok = true;
        }
      } catch (e) {}
      if (!ok) {
        try {
          ok = document.execCommand('copy');
        } catch (e) {}
      }
      $('code-msg').textContent = ok ? 'Copied. Paste it somewhere safe.' : 'Select the text and copy it manually.';
    };
    $('btn-code-load').onclick = () => {
      try {
        const d = SA.Save.decode($('code-text').value);
        M.closeAll(true);
        hideTitle();
        SA.Game.load(d);
        SA.Game.save(true);
        SA.HUD.toast('Save code loaded.');
      } catch (e) {
        $('code-msg').textContent = e.message;
      }
    };
    $('btn-letter-close').onclick = () => {
      showScreen('screen-letter', false);
      SA.Game.state = 'play';
      if (M._letterDone) {
        const f = M._letterDone;
        M._letterDone = null;
        f();
      }
    };
    $('btn-complete-ok').onclick = () => {
      showScreen('screen-complete', false);
      SA.Game.state = 'play';
      if (M._completeDone) {
        const f = M._completeDone;
        M._completeDone = null;
        f();
      }
    };
    document.querySelectorAll('[data-close]').forEach((b) => {
      b.onclick = () => {
        showScreen(b.dataset.close, false);
        if (SA.Game.state === 'title') return;
        if (!anyOpen()) M.closeAll();
        else if (b.dataset.close !== 'screen-pause' && $('screen-pause').classList.contains('hidden')) M.closeAll();
      };
    });
    SA.on('pointerlock-lost', () => {
      if (SA.Game.state === 'play' && !anyOpen()) M.openPause();
    });
    // keyboard: Escape closes the top panel
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' && e.code !== 'KeyM' && e.code !== 'KeyJ') return;
      if (SA.Game.state === 'pause' || SA.Game.state === 'menu') {
        if (e.code === 'Escape') {
          e.preventDefault();
          const top = ['screen-map', 'screen-journal', 'screen-code', 'screen-settings', 'screen-help', 'screen-credits'].find((id) => !$(id).classList.contains('hidden'));
          if (top) {
            showScreen(top, false);
            if ($('screen-pause').classList.contains('hidden')) M.closeAll();
          } else M.closeAll();
        } else if ((e.code === 'KeyM' && !$('screen-map').classList.contains('hidden')) || (e.code === 'KeyJ' && !$('screen-journal').classList.contains('hidden'))) M.closeAll();
      }
    });
    // pause buttons from gamepad
    M.storageNote();
    M.buildSettings();
  };
  M.storageNote = function () {
    $('storage-note').textContent = SA.Store.available ? '' : 'Browser storage is unavailable (private mode?). The game still runs: use save codes to keep progress.';
    U.show('btn-continue', SA.Save.exists());
  };

  function hideTitle() {
    showScreen('screen-title', false);
    showScreen('screen-loading', false);
  }
  // carry on with a game handed over by the page viewer (see main.js boot)
  M.resume = function (d) {
    hideTitle();
    if (!SA.Game.load(d)) M.showTitle();
  };
  M.showTitle = function () {
    SA.Game.state = 'title';
    showScreen('screen-loading', false);
    showScreen('screen-title', true);
    U.show('hud', false);
    U.show('touch', false);
    M.storageNote();
  };
  M.closeAll = function (silent) {
    for (const id of ['screen-pause', 'screen-map', 'screen-journal', 'screen-code', 'screen-settings', 'screen-help', 'screen-credits']) showScreen(id, false);
    if (SA.Game.state === 'pause' || SA.Game.state === 'menu') {
      SA.Game.state = 'play';
      SA.emit('pause', false);
    }
    void silent;
  };
  M.openPause = function () {
    if (SA.Game.state !== 'play') return;
    SA.Game.pause(true);
    $('pause-note').textContent = '';
    showScreen('screen-pause', true);
  };
  function enterMenu() {
    if (SA.Game.state === 'play') {
      SA.Game.state = 'menu';
      if (document.exitPointerLock && SA.Input.pointerLocked) document.exitPointerLock();
    }
  }

  // ---------------------------------------------------------------- save code
  M.openCode = function (importOnly) {
    if (SA.Game.state !== 'title') enterMenu();
    const t = $('code-text');
    t.value = importOnly || SA.Game.state === 'title' ? '' : SA.Save.encode(SA.Game.serialize());
    $('code-msg').textContent = importOnly ? 'Paste a save code and press "Load this code".' : 'This code contains your whole game. Paste it into "Load a save code" on any device.';
    showScreen('screen-code', true);
  };

  // ---------------------------------------------------------------- settings
  M.buildSettings = function () {
    const S = SA.Game.settings;
    const body = $('settings-body');
    body.innerHTML = '';
    const row = (label, el) => {
      const l = document.createElement('label');
      l.textContent = label;
      body.appendChild(l);
      body.appendChild(el);
      return el;
    };
    const sel = (key, opts, onch) => {
      const s = document.createElement('select');
      for (const [v, t] of opts) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = t;
        if (String(S[key]) === String(v)) o.selected = true;
        s.appendChild(o);
      }
      s.onchange = () => {
        S[key] = s.value === 'true' ? true : s.value === 'false' ? false : isNaN(+s.value) ? s.value : +s.value;
        SA.Save.saveSettings(S);
        onch && onch(S[key]);
      };
      return s;
    };
    const rng = (key, min, max, step, onch) => {
      const r = document.createElement('input');
      r.type = 'range';
      r.min = min;
      r.max = max;
      r.step = step;
      r.value = S[key];
      r.oninput = () => {
        S[key] = +r.value;
        SA.Save.saveSettings(S);
        onch && onch(S[key]);
      };
      return r;
    };
    row('Graphics quality (reload to apply)', sel('quality', [['low', 'Low (phones)'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra (fast graphics cards)']]));
    row('Subtitle size', sel('subtitleSize', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['huge', 'Huge']], applySubs));
    row('Camera sensitivity', rng('sensitivity', 0.3, 2.5, 0.1));
    row('Invert camera vertical', sel('invertY', [[false, 'Off'], [true, 'On']]));
    row('Volume', rng('volume', 0, 1, 0.05, (v) => SA.Audio && SA.Audio.setVolume(v)));
    row('Touch controls', sel('touch', [['auto', 'Automatic'], ['on', 'Always on'], ['off', 'Off']], () => SA.HUD && SA.HUD.refreshTouch()));
    row('Camera shake', sel('cameraShake', [[true, 'On'], [false, 'Off']]));
    row('Reduce flashes', sel('reduceFlashes', [[false, 'Off'], [true, 'On']]));
    row('Show frame rate', sel('showFps', [[false, 'Off'], [true, 'On']]));
    applySubs();
  };
  function applySubs() {
    const s = SA.Game.settings.subtitleSize;
    document.body.classList.remove('subs-small', 'subs-large', 'subs-huge');
    if (s !== 'medium') document.body.classList.add('subs-' + s);
  }
  M.openSettings = function () {
    if (SA.Game.state !== 'title') enterMenu();
    M.buildSettings();
    showScreen('screen-settings', true);
  };

  // ---------------------------------------------------------------- help / credits
  M.openHelp = function () {
    enterMenu();
    $('help-body').innerHTML = `
      <h3>Keyboard &amp; mouse</h3>
      <p><b>W A S D</b> or arrows: move / drive · <b>Shift</b>: run · <b>Mouse</b>: click to lock and look (or drag) · <b>E</b>: interact / skip line · <b>F</b>: get on or off a vehicle ·
      <b>Q</b> (hold): wind the Curfew Key · <b>1 / 2</b> or wheel: choose the year while winding · <b>Space</b>: handbrake · <b>H</b>: horn or bell · <b>C</b>: reset camera · <b>M</b>: map · <b>J</b>: journal · <b>Esc</b>: menu</p>
      <h3>Touch (phone)</h3>
      <p>Left side: virtual stick (walk, or accelerate/brake/steer in vehicles) · Right side: drag to look · Buttons appear when useful: <b>✋ Use</b>, <b>🚲 Ride</b>, <b>⌛ Key</b> (hold to wind; tap a year to choose), <b>🏃 Run</b>, <b>⛔ Brake</b>, <b>📯 Horn</b>, <b>🗺 Map</b>, <b>⏸ Menu</b>.</p>
      <h3>Gamepad</h3>
      <p>Left stick: move/steer · Right stick: camera · <b>A</b>: interact · <b>Y</b>: vehicle · <b>X</b> (hold): wind the key · <b>B</b>: run · <b>RT/LT</b>: accelerate/brake · <b>RB</b>: handbrake · <b>LB</b>: horn · <b>D-pad</b>: choose year · <b>Start</b>: menu · <b>Back</b>: map</p>
      <h3>The Curfew Key</h3>
      <ul>${SA.STORY.rules.map((r) => '<li><b>' + r.title + ':</b> ' + r.text + '</li>').join('')}<li><b>Gabriel answers:</b> the bell tolls in both years whenever the key is wound.</li></ul>
      <h3>Police</h3><p>Knocking people over, taking occupied vehicles and crashing into traffic raise your wanted level. Out-of-era clothes make people stare and the police notice sooner. Break line of sight until the stars fade. Police can't follow you through time, and the key won't turn while they're after you.</p>`;
    showScreen('screen-help', true);
  };
  M.openCredits = function () {
    if (SA.Game.state !== 'title') enterMenu();
    $('credits-body').innerHTML = `
      <h3>Map data</h3>
      <p>Street layout and building footprints © <b>OpenStreetMap contributors</b>, available under the <b>Open Database Licence (ODbL) 1.0</b>: openstreetmap.org/copyright. The game's map is a derived database; the processed extract is in <code>js/data/mapdata.js</code> and the raw extract in <code>tools/data/</code>.</p>
      <p>Ground heights derived from the Mapzen/AWS Terrain Tiles (sources include UK Environment Agency LIDAR, Open Government Licence, and SRTM).</p>
      <h3>Software</h3><p>three.js (MIT licence), bundled locally. All textures, models and sounds are generated procedurally by the game; no photographs or third-party images are included.</p>
      <h3>History</h3><p>Real places appear as settings. All characters and businesses are fictional, including every shop, pub, solicitor, clockmaker and newspaper. See docs/RESEARCH.md for sources and what is documented, inferred or invented.</p>
      <p class="fine">CURFEW: St Albans Across Time · Milestone 1 · v${SA.VERSION}</p>`;
    showScreen('screen-credits', true);
  };

  // ---------------------------------------------------------------- journal
  M.openJournal = function () {
    enterMenu();
    const S = SA.STORY;
    const mis = SA.Mission ? SA.Mission.journal() : [];
    const disc = SA.Discoveries ? SA.Discoveries.journal() : [];
    const sum = SA.Flags.summary();
    const rules = SA.Mission ? SA.Mission.rulesLearned() : [];
    $('journal-body').innerHTML = `
      <h3>The mystery</h3><p>${S.journal.premise}</p>
      ${mis.length ? '<h3>So far</h3><ul>' + mis.map((m) => '<li>' + U.esc(m) + '</li>').join('') + '</ul>' : ''}
      ${SA.Game.flags.fund_outcome ? '<h3>What you changed</h3><p>' + sum.choice + '</p><ul>' + sum.changes.map((c) => '<li>' + c + '</li>').join('') + '</ul>' : ''}
      ${SA.Game.flags.teaser ? '<h3>Loose ends</h3><p>' + S.journal.teaser + '</p>' : ''}
      <h3>Rules of the Curfew Key</h3>${rules.length ? '<ul>' + rules.map((r) => '<li><b>' + r.title + ':</b> ' + r.text + '</li>').join('') + '</ul>' : '<p>You have not learned them yet.</p>'}
      <h3>The three years</h3><ul>${[2026, 1964, 1897].map((e) => '<li><b>' + e + ':</b> ' + S.journal.eras[e] + '</li>').join('')}</ul>
      <h3>Discoveries (${disc.filter((d) => d.found).length}/${disc.length})</h3><ul>${disc.map((d) => '<li>' + (d.found ? '✔ <b>' + d.title + '</b> (' + d.eraLabel + '): ' + d.text : '? An undiscovered place (' + d.eraLabel + ')') + '</li>').join('')}</ul>
      ${SA.Discoveries ? SA.Discoveries.postcardJournal() : ''}`;
    showScreen('screen-journal', true);
  };

  // ---------------------------------------------------------------- big map
  M.openMap = function () {
    enterMenu();
    showScreen('screen-map', true);
    const cv = $('bigmap');
    const c = cv.getContext('2d');
    const era = SA.Game.era;
    const base = SA.HUD.minimapBase(era);
    $('map-title').textContent = 'Map: St Albans, ' + era;
    // fit district bounds
    const b = U.polyBounds(SA.World.district);
    const pad = 20;
    const sx = (cv.width - pad * 2) / (b.x1 - b.x0), sz = (cv.height - pad * 2) / (b.z1 - b.z0);
    const s = Math.min(sx, sz);
    const ox = pad - b.x0 * s + (cv.width - pad * 2 - (b.x1 - b.x0) * s) / 2, oz = pad - b.z0 * s + (cv.height - pad * 2 - (b.z1 - b.z0) * s) / 2;
    c.fillStyle = '#1a1814';
    c.fillRect(0, 0, cv.width, cv.height);
    c.save();
    c.translate(ox, oz);
    c.scale(s, s);
    c.drawImage(base, -330, -300, 600, 600);
    c.restore();
    const P = (x, z) => [ox + x * s, oz + z * s];
    // labels for streets
    c.font = '13px Georgia, serif';
    c.fillStyle = '#e8e0cc';
    c.textAlign = 'center';
    const labels = [['High St', 0, 30], ['George St', -105, -20], ['French Row', 6, -26], ['Market Place', 52, -62], ['Chequer St', 92, -30], ["St Peter's St", 175, -180], ['Waxhouse Gate', -30, 95], ['Romeland', -205, 0], ['Victoria St', 160, -82], ['Holywell Hill', 30, 82], ['Cathedral', -140, 88], ['Abbey Gateway', -258, 50], ['Town Hall', 110, -110], ['Clock Tower', 0, -10], ['Corn Exchange', 66, -38]];
    for (const [t, x, z] of labels) {
      const [px, pz] = P(x, z);
      c.fillStyle = 'rgba(0,0,0,0.55)';
      const w = c.measureText(t).width + 8;
      c.fillRect(px - w / 2, pz - 9, w, 17);
      c.fillStyle = '#efe6cf';
      c.fillText(t, px, pz + 4);
    }
    const mark = (x, z, sym, col, label) => {
      const [px, pz] = P(x, z);
      c.fillStyle = 'rgba(0,0,0,0.75)';
      c.beginPath();
      c.arc(px, pz, 11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = col;
      c.font = 'bold 14px sans-serif';
      c.fillText(sym, px, pz + 5);
      if (label) {
        c.font = '12px sans-serif';
        c.fillStyle = col;
        c.fillText(label, px, pz + 24);
      }
    };
    const legend = [];
    const om = SA.HUD.objMarker;
    if (om && (!om.era || om.era === era)) {
      mark(om.x, om.z, om.kind === 'search' ? '◎' : om.letter || '★', '#ffd27a', 'Objective');
      legend.push('<span><b>★</b> objective</span>');
    }
    for (const m of SA.HUD.markers) {
      if (m.era && m.era !== era) continue;
      mark(m.x, m.z, m.letter || '?', m.color || '#9fd3c7', m.label);
    }
    if (SA.HUD.markers.some((m) => m.kind === 'discovery')) legend.push('<span><b>?</b> discovery</span>');
    if (SA.HUD.markers.some((m) => m.kind === 'postcard')) legend.push('<span><b>✉</b> postcard view</span>');
    const p = SA.Player.pos();
    mark(p.x, p.z, '▲', '#ffffff', 'You');
    legend.push('<span><b>▲</b> you</span>', '<span>Barriers mark the edge of the district: the key goes cold beyond them.</span>');
    $('map-legend').innerHTML = legend.join('');
  };

  // ---------------------------------------------------------------- the letter
  M.showLetter = function (onDone) {
    const L = SA.STORY.letter;
    $('letter-body').innerHTML = '<div class="date">' + L.date + '</div>' + L.body.map((p) => '<p>' + p + '</p>').join('') + '<div class="sig">' + L.sig + '</div><p class="ps"><i>' + L.ps + '</i></p>';
    M._letterDone = onDone;
    SA.Game.state = 'menu';
    if (document.exitPointerLock && SA.Input.pointerLocked) document.exitPointerLock();
    showScreen('screen-letter', true);
  };
  // ---------------------------------------------------------------- choice info card (the actual choice is made in-world)
  M.showChoice = function (title, body, options) {
    return new Promise((resolve) => {
      $('choice-title').textContent = title;
      $('choice-body').textContent = body;
      const box = $('choice-options');
      box.innerHTML = '';
      SA.Game.state = 'menu';
      if (document.exitPointerLock && SA.Input.pointerLocked) document.exitPointerLock();
      for (const o of options) {
        const b = document.createElement('button');
        b.innerHTML = U.esc(o.label) + (o.hint ? '<small>' + U.esc(o.hint) + '</small>' : '');
        b.onclick = () => {
          showScreen('screen-choice', false);
          SA.Game.state = 'play';
          resolve(o.id);
        };
        box.appendChild(b);
      }
      showScreen('screen-choice', true);
    });
  };
  M.showComplete = function (title, html, onDone) {
    $('complete-title').textContent = title;
    $('complete-body').innerHTML = html;
    M._completeDone = onDone;
    SA.Game.state = 'menu';
    if (document.exitPointerLock && SA.Input.pointerLocked) document.exitPointerLock();
    showScreen('screen-complete', true);
  };
  // gamepad: Start opens/closes the pause menu even while a menu is open
  SA.on('loaded', () => {
    setInterval(() => {
      if (SA.Game.state !== 'pause' && SA.Game.state !== 'menu') return;
      let pads = [];
      try {
        pads = navigator.getGamepads ? navigator.getGamepads() : [];
      } catch (e) {
        return; // gamepads blocked here (some embedded viewers)
      }
      for (const p of pads) {
        if (p && p.buttons[9] && p.buttons[9].pressed && !M._padStart) {
          M._padStart = true;
          M.closeAll();
        } else if (p && p.buttons[9] && !p.buttons[9].pressed) M._padStart = false;
      }
    }, 100);
  });
})();
