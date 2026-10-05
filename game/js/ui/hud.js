/* HUD: era badge, objective tracker, minimap, key status, wanted level, prompts, hints, toasts,
   on-screen objective marker, touch button visibility. Markers always use an icon + letter + text,
   never colour alone. Also hosts the interaction registry (SA.Interact). */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const H = (SA.HUD = { markers: [], objective: null, hintQueue: [], hintsShown: {}, toastT: 0, hintT: 0, mmCache: {} });

  // ---------------------------------------------------------------- interaction registry
  const Interact = (SA.Interact = { list: [], current: null });
  // item: {id, x, z, r, era ('all' or year), label, key: 'interact'|'vehicle', enabled(), action(), icon}
  Interact.add = function (it) {
    Interact.remove(it.id);
    Interact.list.push(Object.assign({ r: 2.2, era: 'all', key: 'interact', enabled: () => true }, it));
    return it;
  };
  Interact.remove = function (id) {
    Interact.list = Interact.list.filter((i) => i.id !== id);
  };
  Interact.clear = function (prefix) {
    Interact.list = Interact.list.filter((i) => !(i.id || '').startsWith(prefix));
  };
  Interact.update = function () {
    const P = SA.Player;
    let best = null, bd = Infinity;
    if (!P.vehicle || true) {
      const px = P.vehicle ? P.vehicle.x : P.ch.x, pz = P.vehicle ? P.vehicle.z : P.ch.z;
      for (const it of Interact.list) {
        if (it.era !== 'all' && it.era !== SA.Game.era) continue;
        if (P.vehicle && !it.inVehicle) continue;
        if (!P.vehicle && it.vehicleOnly) continue;
        const x = typeof it.x === 'function' ? it.x() : it.x, z = typeof it.z === 'function' ? it.z() : it.z;
        const d = U.dist(px, pz, x, z);
        if (d > it.r) continue;
        if (!it.enabled()) continue;
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
    }
    Interact.current = best;
    // vehicle prompt if nothing else
    let vehPrompt = null;
    if (!best && !P.vehicle && !SA.Game.inputLocked) {
      const v = SA.Vehicles.nearest(P.ch.x, P.ch.z, 2.2);
      if (v && !v.noEnter) vehPrompt = v;
    }
    H.setPrompt(best, vehPrompt);
    if (best && !SA.Game.inputLocked && SA.Input.pressed('interact') && !(SA.Dialogue && SA.Dialogue.busy())) {
      SA.Audio && SA.Audio.sfx('ui');
      best.action();
    }
  };

  // ---------------------------------------------------------------- init
  H.init = function () {
    H.el = (id) => document.getElementById(id);
    H.mm = H.el('minimap').getContext('2d');
    H.keyCtx = H.el('key-ring').getContext('2d');
    H.marker = document.createElement('div');
    H.marker.id = 'obj-marker';
    H.marker.innerHTML = '<span class="mk-ic">★</span><span class="mk-d"></span>';
    H.marker.style.cssText = 'position:fixed;z-index:4;pointer-events:none;transform:translate(-50%,-100%);text-align:center;color:#ffd27a;font-weight:bold;text-shadow:0 1px 3px #000,0 0 6px #000;display:none;font-size:14px;';
    document.body.appendChild(H.marker);
    // grain image for the grade overlay
    document.getElementById('grade').style.setProperty('--grain-img', 'url(' + SA.Tex.grainDataURL() + ')');
    SA.on('era', (e) => H.setEra(e));
    SA.on('input-scheme', () => H.refreshTouch());
    SA.on('wanted', () => H.updateWanted());
    SA.on('boundary', () => {
      if (Game().time - (H.boundT || -99) > 6) {
        H.boundT = Game().time;
        H.toast(SA.STORY.ui.boundary, 4);
      }
    });
    SA.on('play', () => {
      U.show('hud', true);
      H.refreshTouch();
    });
    SA.on('era-rebuilt', (e) => delete H.mmCache[e]);
    H.refreshTouch();
    window.addEventListener('resize', () => H.refreshTouch());
  };
  const Game = () => SA.Game;

  H.refreshTouch = function () {
    const s = SA.Game.settings.touch;
    const on = s === 'on' || (s === 'auto' && SA.Input.scheme === 'touch');
    U.show('touch', on && SA.Game.state !== 'title');
    document.body.classList.toggle('touch-ui', on);
    const kb = SA.Input.scheme === 'gamepad' ? 'A' : 'E';
    H.el('prompt-key').textContent = on ? '✋' : kb;
  };

  H.setEra = function (e) {
    const E = SA.ERAS[e];
    H.el('era-year').textContent = e;
    H.el('era-date').textContent = E.dateLong + ', ' + E.timeText;
  };

  // ---------------------------------------------------------------- objective + markers
  // marker: {id, x, z, label, letter, kind: 'objective'|'discovery'|'choice'|'search', r (search radius)}
  H.setObjective = function (title, text, marker) {
    H.objective = { title, text };
    H.el('obj-mission').textContent = title || '';
    H.el('obj-text').textContent = text || '';
    H.objMarker = marker || null;
    U.show('hud-objective', !!text);
  };
  H.setMarkers = function (list) {
    H.markers = list || [];
  };

  // ---------------------------------------------------------------- prompts, hints, toasts
  H.setPrompt = function (it, veh) {
    const el = H.el('hud-prompt');
    if (SA.Game.inputLocked || (SA.Dialogue && SA.Dialogue.lock)) {
      el.classList.add('hidden');
      return;
    }
    const touch = document.body.classList.contains('touch-ui');
    if (it) {
      H.el('prompt-key').textContent = touch ? '✋' : SA.Input.scheme === 'gamepad' ? 'A' : 'E';
      H.el('prompt-text').textContent = typeof it.label === 'function' ? it.label() : it.label;
      el.classList.remove('hidden');
    } else if (veh) {
      H.el('prompt-key').textContent = touch ? '🚲' : SA.Input.scheme === 'gamepad' ? 'Y' : 'F';
      const verb = veh.def.riderPose === 'bicycle' || veh.def.riderPose === 'scooter' ? 'Ride' : veh.def.riderPose === 'driver' ? 'Drive' : 'Get in';
      H.el('prompt-text').textContent = verb + ': ' + veh.label + (veh.driver && veh.driver !== 'player' ? ' (occupied!)' : '');
      el.classList.remove('hidden');
    } else el.classList.add('hidden');
  };
  H.hint = function (key, force) {
    if (H.hintsShown[key] && !force) return;
    H.hintsShown[key] = true;
    const h = SA.STORY.hints[key];
    if (!h) return;
    const touch = document.body.classList.contains('touch-ui');
    const scheme = touch ? 'touch' : SA.Input.scheme === 'gamepad' ? 'gamepad' : 'keyboard';
    H.hintQueue.push(h[scheme] || h.keyboard);
  };
  H.toast = function (text, secs) {
    const el = H.el('hud-toast');
    el.textContent = text;
    el.classList.remove('hidden');
    H.toastT = secs || 3;
  };
  H.eraRoll = function (from, to, dur) {
    // rolling year counter in the era badge during a jump
    H.roll = { from, to, t: 0, dur };
  };

  // ---------------------------------------------------------------- wind UI
  H.showWind = function (p, target, choices, needStill) {
    const w = H.el('hud-wind'), chips = H.el('hud-eras');
    if (p < 0) {
      w.classList.add('hidden');
      chips.classList.add('hidden');
      return;
    }
    w.classList.remove('hidden');
    H.el('wind-label').textContent = needStill ? SA.STORY.ui.keyMoving : SA.STORY.ui.winding;
    H.el('wind-bar').style.width = Math.round(p * 100) + '%';
    H.el('wind-target').textContent = SA.STORY.ui.windTo(target) + ' (' + SA.ERAS[target].dateLong + ')';
    if (choices.length > 1) {
      chips.classList.remove('hidden');
      const key = choices.join(',') + target;
      if (chips.dataset.key !== key) {
        chips.dataset.key = key;
        chips.innerHTML = '';
        for (const y of choices) {
          const b = document.createElement('button');
          b.className = 'era-chip' + (y === target ? ' sel' : '');
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', y === target ? 'true' : 'false');
          b.innerHTML = y + '<small>' + SA.ERAS[y].name + '</small>';
          b.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            SA.emit('era-chip', y);
          });
          chips.appendChild(b);
        }
      }
    } else chips.classList.add('hidden');
  };

  // ---------------------------------------------------------------- wanted
  H.updateWanted = function () {
    const P = SA.Police;
    const el = H.el('hud-wanted');
    if (!P || !P.level) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const max = SA.ERAS[SA.Game.era].police.maxStars;
    let s = '';
    for (let i = 0; i < max; i++) s += i < P.level ? '★' : '☆';
    H.el('wanted-stars').textContent = s;
    H.el('wanted-label').textContent = 'WANTED ' + P.level + '/' + max;
  };

  // ---------------------------------------------------------------- per-frame
  const v3 = new THREE.Vector3();
  H.update = function (dt) {
    const G = SA.Game;
    // toast & hints
    if (H.toastT > 0) {
      H.toastT -= dt;
      if (H.toastT <= 0) U.show('hud-toast', false);
    }
    if (H.hintT > 0) {
      H.hintT -= dt;
      if (H.hintT <= 0) U.show('hud-hint', false);
    } else if (H.hintQueue.length) {
      const el = H.el('hud-hint');
      el.innerHTML = H.hintQueue.shift();
      el.classList.remove('hidden');
      H.hintT = 6.5;
    }
    // roll year
    if (H.roll) {
      H.roll.t += dt;
      const k = Math.min(1, H.roll.t / (H.roll.dur * 0.8));
      const y = Math.round(U.lerp(H.roll.from, H.roll.to, U.smooth(k)));
      H.el('era-year').textContent = y;
      if (k >= 1) {
        H.roll = null;
        H.setEra(G.era);
      }
    }
    // key status
    const K = SA.TimeKey;
    const keyEl = H.el('hud-key');
    if (K && K.owned) {
      keyEl.classList.remove('hidden');
      const st = K.status();
      H.el('key-text').textContent = st.text;
      const c = H.keyCtx;
      c.clearRect(0, 0, 64, 64);
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.beginPath();
      c.arc(32, 32, 25, 0, Math.PI * 2);
      c.stroke();
      const rl = K.restLeft(), frac = rl > 0 ? 1 - rl / K.restTotal : 1;
      c.strokeStyle = rl > 0 ? '#c98a2e' : st.ok ? '#ffd27a' : '#8a8478';
      c.beginPath();
      c.arc(32, 32, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      c.stroke();
      c.font = '24px serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#f4efe4';
      c.fillText('⌛', 32, 34);
    } else keyEl.classList.add('hidden');
    // wanted text
    if (SA.Police && SA.Police.level) {
      H.updateWanted();
      H.el('wanted-text').textContent = SA.Police.statusText();
    }
    // outfit
    const odd = SA.Player.outOfPlace(G.era);
    U.show('hud-outfit', odd);
    if (odd) H.el('outfit-text').textContent = SA.STORY.ui.outfitOdd;
    // vehicle
    const v = SA.Player.vehicle;
    U.show('hud-vehicle', !!v);
    if (v) {
      H.el('veh-name').textContent = v.label;
      H.el('veh-speed').textContent = Math.round(Math.abs(v.speed) * 2.237) + ' mph';
    }
    // objective distance & on-screen marker
    const m = H.objMarker;
    const p = SA.Player.pos();
    if (m && G.era === (m.era || G.era)) {
      const d = U.dist(p.x, p.z, m.x, m.z);
      H.el('obj-dist').textContent = (m.kind === 'search' ? 'Search area · ' : '★ ') + Math.round(d) + ' m';
      const cam = G.camera();
      v3.set(m.x, SA.Terrain.height(m.x, m.z) + (m.h || 3.2), m.z).project(cam);
      if (v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 && d > 4) {
        H.marker.style.display = 'block';
        H.marker.style.left = ((v3.x + 1) / 2) * window.innerWidth + 'px';
        H.marker.style.top = ((1 - v3.y) / 2) * window.innerHeight + 'px';
        H.marker.querySelector('.mk-ic').textContent = m.kind === 'search' ? '◎' : (m.letter || '★');
        H.marker.querySelector('.mk-d').textContent = ' ' + Math.round(d) + ' m';
      } else H.marker.style.display = 'none';
    } else {
      H.el('obj-dist').textContent = m && m.era && m.era !== G.era ? 'In ' + m.era : '';
      H.marker.style.display = 'none';
    }
    // touch buttons contextual visibility
    if (document.body.classList.contains('touch-ui')) {
      const near = !v && SA.Vehicles.nearest(SA.Player.ch.x, SA.Player.ch.z, 2.2);
      U.show('tb-veh', !!v || !!near);
      H.el('tb-veh').querySelector('.ic').textContent = v ? '⬇' : near && near.def.riderPose === 'bicycle' ? '🚲' : near && near.def.riderPose === 'scooter' ? '🛵' : near && near.def.riderPose === 'driver' ? '🐴' : '🚗';
      H.el('tb-veh').querySelector('.tl').textContent = v ? 'Get off' : 'Ride';
      U.show('tb-key', K && K.owned && !v);
      U.show('tb-run', !v);
      U.show('tb-brake', !!v);
      U.show('tb-horn', !!v);
      U.show('tb-act', !!SA.Interact.current || (SA.Dialogue && SA.Dialogue.busy()));
      H.el('tb-act').classList.toggle('hot', !!SA.Interact.current);
      H.el('tb-key').classList.toggle('hot', K && K.owned && K.status().ok);
    }
    // FPS
    const f = H.el('hud-fps');
    if (G.settings.showFps) f.textContent = Math.round(G.fps) + ' fps · ' + (G.drawCalls || 0) + ' calls';
    else f.textContent = '';
    SA.Dialogue && SA.Dialogue.update(dt);
    H.drawMinimap();
  };

  // ---------------------------------------------------------------- minimap
  const MM = { size: 600, x0: -330, z0: -300, scale: 1 };
  H.minimapBase = function (eraId) {
    if (H.mmCache[eraId]) return H.mmCache[eraId];
    const cv = document.createElement('canvas');
    cv.width = cv.height = MM.size;
    const c = cv.getContext('2d');
    const P = (x, z) => [(x - MM.x0) * MM.scale, (z - MM.z0) * MM.scale];
    c.fillStyle = eraId === 1897 ? '#2b2620' : eraId === 1964 ? '#2c2b27' : '#262829';
    c.fillRect(0, 0, MM.size, MM.size);
    const W = SA.World;
    // district
    c.fillStyle = eraId === 1897 ? '#3b352c' : '#38383a';
    c.beginPath();
    W.district.forEach((p, i) => {
      const q = P(p[0], p[1]);
      i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]);
    });
    c.closePath();
    c.fill();
    for (const a of W.areas) {
      if (a.k !== 'grass') continue;
      c.fillStyle = '#34452c';
      c.beginPath();
      a.p.forEach((p, i) => {
        const q = P(p[0], p[1]);
        i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]);
      });
      c.fill();
    }
    // roads
    for (const r of W.roads) {
      const carr = SA.Terrain.isCarriageway(r);
      c.strokeStyle = carr ? (eraId === 1897 ? '#6e6152' : '#5c5c60') : '#4d4b46';
      c.lineWidth = carr ? Math.max(2, SA.Terrain.roadWidth(r)) : 2;
      c.lineCap = 'round';
      c.beginPath();
      r.p.forEach((p, i) => {
        const q = P(p[0], p[1]);
        i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]);
      });
      c.stroke();
    }
    // buildings
    const e = W.eras[eraId];
    c.fillStyle = eraId === 1897 ? '#8a7258' : eraId === 1964 ? '#7c6e60' : '#77706a';
    for (const s of e.specs) {
      c.beginPath();
      s.pts.forEach((p, i) => {
        const q = P(p[0], p[1]);
        i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]);
      });
      c.closePath();
      c.fill();
    }
    // landmarks
    const ct = SA.Landmarks.clockTowerInfo;
    c.fillStyle = '#e2b04a';
    const q = P(ct.x, ct.z);
    c.fillRect(q[0] - 4, q[1] - 4, 8, 8);
    const cat = SA.World.rawBuildings.find((b) => b.id === SA.World.ID.cathedral);
    c.fillStyle = '#9a8f80';
    c.beginPath();
    cat.p.forEach((p, i) => {
      const qq = P(p[0], p[1]);
      i ? c.lineTo(qq[0], qq[1]) : c.moveTo(qq[0], qq[1]);
    });
    c.fill();
    H.mmCache[eraId] = cv;
    return cv;
  };
  H.drawMinimap = function () {
    const c = H.mm;
    if (!c) return;
    const G = SA.Game;
    const base = H.minimapBase(G.era);
    const S = 200, R = S / 2;
    const zoom = SA.Player.vehicle ? 1.0 : 1.5;
    const p = SA.Player.pos();
    const yaw = G.cam.yaw;
    c.save();
    c.clearRect(0, 0, S, S);
    c.beginPath();
    c.arc(R, R, R, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#1b1a18';
    c.fillRect(0, 0, S, S);
    c.translate(R, R);
    c.rotate(yaw);
    c.scale(zoom, zoom);
    c.translate(-(p.x - MM.x0) * MM.scale, -(p.z - MM.z0) * MM.scale);
    c.drawImage(base, 0, 0);
    c.restore();
    // markers (projected into rotated space)
    const toMM = (x, z) => {
      const dx = (x - p.x) * zoom, dz = (z - p.z) * zoom;
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      return [R + dx * cs - dz * sn, R + dx * sn + dz * cs];
    };
    const drawMark = (x, z, sym, col, clampEdge) => {
      let [mx, my] = toMM(x, z);
      const dx = mx - R, dy = my - R, d = Math.hypot(dx, dy);
      if (d > R - 10) {
        if (!clampEdge) return;
        mx = R + (dx / d) * (R - 10);
        my = R + (dy / d) * (R - 10);
      }
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.beginPath();
      c.arc(mx, my, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = col;
      c.font = 'bold 13px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(sym, mx, my + 1);
    };
    for (const m of H.markers) {
      if (m.era && m.era !== G.era) continue;
      if (m.kind === 'search') {
        const [mx, my] = toMM(m.x, m.z);
        c.strokeStyle = 'rgba(255,210,122,0.8)';
        c.setLineDash([4, 3]);
        c.lineWidth = 2;
        c.beginPath();
        c.arc(mx, my, m.r * zoom, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }
      drawMark(m.x, m.z, m.letter || '★', m.color || '#ffd27a', m.kind !== 'discovery');
    }
    const om = H.objMarker;
    if (om && (!om.era || om.era === G.era)) drawMark(om.x, om.z, om.kind === 'search' ? '◎' : om.letter || '★', '#ffd27a', true);
    // police
    if (SA.Police) for (const u of SA.Police.units) drawMark(u.x(), u.z(), 'P', '#7fb0ff', false);
    // player arrow (always points up = camera forward; rotate by player heading relative to camera)
    c.save();
    c.translate(R, R);
    const heading = SA.Player.vehicle ? SA.Player.vehicle.yaw : SA.Player.ch.yaw;
    c.rotate(Math.PI - heading + yaw);
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#000';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(6, 7);
    c.lineTo(0, 3);
    c.lineTo(-6, 7);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
    // north indicator follows rotation
    const n = H.el('mm-north');
    const cw = H.el('minimap').clientWidth || 160, rr = cw / 2;
    n.style.transform = 'translate(-50%,-50%)';
    n.style.left = 6 + rr + Math.sin(yaw) * (rr - 9) + 'px';
    n.style.top = 6 + rr - Math.cos(yaw) * (rr - 9) + 'px';
  };
})();
