/* The Curfew Key: winding, rules, rest timer, safe arrival and the playable "time wave" transition.
   Rules (taught in the mission, listed in the journal):
   1 Earshot: only within the district (cold near the barriers at its edge).
   2 Steady hands: on foot, standing still, not wanted by the police.
   3 Rest: 45 s after a short wind (one era step), 90 s after the long wind (1897 <-> 2026).
   4 Pockets: you, your clothes and your inventory travel; vehicles, animals and people never do.
   5 Same place: arrive at the same spot; if it's blocked or unsafe, slip to the nearest safe ground.
   6 Gabriel answers: the bell tolls in both years. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const K = (SA.TimeKey = {
    owned: false, restUntil: 0, restTotal: 1, winding: 0, target: null, allowed: [1897, 1964, 2026], locked: false, trans: null, jumps: 0,
    WIND_TIME: 2.0, suggested: null, beforeArrive: null,
  });

  K.init = function () {
    SA.on('era-chip', (y) => K.select(y));
  };
  K.reset = function () {
    K.owned = false;
    K.restUntil = 0;
    K.winding = 0;
    K.target = null;
    K.allowed = [1897, 1964, 2026];
    K.locked = false;
    K.jumps = 0;
    K.suggested = null;
  };
  K.serialize = () => ({ owned: K.owned, rest: Math.max(0, Math.round(K.restUntil - SA.Game.time)), allowed: K.allowed, jumps: K.jumps, locked: K.locked, sug: K.suggested });
  K.deserialize = function (d) {
    K.reset();
    if (!d) return;
    K.owned = !!d.owned;
    K.restUntil = SA.Game.time + (d.rest || 0);
    K.restTotal = Math.max(1, d.rest || 1);
    K.allowed = d.allowed || [1897, 1964, 2026];
    K.jumps = d.jumps || 0;
    K.locked = !!d.locked;
    K.suggested = d.sug || null;
  };
  K.restLeft = () => Math.max(0, K.restUntil - SA.Game.time);
  K.restFor = (a, b) => (Math.abs(SA.eraIndex(a) - SA.eraIndex(b)) >= 2 ? 90 : 45);

  // near a barrier opening? (the key goes cold at the edge of town)
  function nearEdge(x, z) {
    for (const seg of SA.World.openings) {
      for (let i = 0; i < seg.length - 1; i++) {
        const c = U.closestOnSeg(x, z, seg[i][0], seg[i][1], seg[i + 1][0], seg[i + 1][1]);
        if (U.dist(x, z, c[0], c[1]) < 5) return true;
      }
    }
    return false;
  }
  K.status = function () {
    const S = SA.STORY.ui;
    if (!K.owned) return { ok: false, code: 'none', text: S.keyNone };
    if (K.trans) return { ok: false, code: 'busy', text: '…' };
    if (K.locked) return { ok: false, code: 'locked', text: S.keyLocked };
    const rl = K.restLeft();
    if (rl > 0) return { ok: false, code: 'rest', text: S.keyRest(U.fmtTime(rl)) };
    if (SA.Player.vehicle) return { ok: false, code: 'vehicle', text: S.keyVehicle };
    if (SA.Police && SA.Police.level > 0) return { ok: false, code: 'chased', text: S.keyChased };
    const p = SA.Player.ch;
    if (nearEdge(p.x, p.z)) return { ok: false, code: 'cold', text: S.keyCold };
    if (p.speedNow > 0.5) return { ok: true, code: 'moving', text: S.keyMoving, needStill: true };
    return { ok: true, code: 'ready', text: S.keyReady };
  };
  K.choices = function () {
    return SA.ERA_ORDER.filter((y) => y !== SA.Game.era && K.allowed.indexOf(y) >= 0);
  };
  K.defaultTarget = function () {
    const ch = K.choices();
    if (K.suggested && ch.indexOf(K.suggested) >= 0) return K.suggested;
    return ch[0] || null;
  };
  K.select = function (y) {
    if (K.choices().indexOf(y) < 0) return;
    if (K.target !== y) {
      K.target = y;
      K.winding = Math.min(K.winding, 0.3);
      SA.Audio && SA.Audio.sfx('ratchet');
    }
  };

  // ---------------------------------------------------------------- update: winding input + transition
  K.update = function (dt) {
    if (K.trans) {
      stepTransition(dt);
      SA.HUD && SA.HUD.showWind(-1);
      return;
    }
    const I = SA.Input;
    const st = K.status();
    const holding = I.held('timekey') && !SA.Game.inputLocked;
    if (I.pressed('timekey') && !st.ok && st.code !== 'none') {
      SA.HUD && SA.HUD.toast(st.text);
      SA.Audio && SA.Audio.sfx('tick');
    }
    if (holding && st.ok) {
      if (!K.target || K.choices().indexOf(K.target) < 0) K.target = K.defaultTarget();
      if (!K.target) return;
      if (I.pressed('eraPrev') || I.pressed('eraNext')) {
        const ch = K.choices();
        const i = ch.indexOf(K.target);
        K.select(ch[(i + (I.pressed('eraNext') ? 1 : ch.length - 1)) % ch.length]);
      }
      if (st.needStill) {
        K.winding = Math.max(0, K.winding - dt * 2);
      } else {
        const prev = K.winding;
        K.winding += dt / (K.jumps === 0 ? K.WIND_TIME * 1.25 : K.WIND_TIME);
        // ratchet clicks while winding
        if (Math.floor(prev * 8) !== Math.floor(K.winding * 8)) SA.Audio && SA.Audio.sfx('ratchet');
        SA.Player.ch.anim = 'wind';
        if (K.winding >= 1) {
          K.winding = 0;
          K.jump(K.target);
        }
      }
      SA.HUD && SA.HUD.showWind(K.winding, K.target, K.choices(), st.needStill);
    } else {
      if (K.winding > 0) K.winding = Math.max(0, K.winding - dt * 3);
      SA.HUD && SA.HUD.showWind(-1);
    }
  };

  // ---------------------------------------------------------------- the jump
  K.jump = function (target, opts) {
    opts = opts || {};
    const G = SA.Game;
    const from = G.era;
    if (target === from || !SA.World.eras[target]) return false;
    const P = SA.Player;
    const pos = { x: P.ch.x, z: P.ch.z };
    const first = K.jumps === 0;
    K.jumps++;
    SA.emit('jump-start', from, target);
    // police can't follow; heat is remembered per era
    SA.Police && SA.Police.clearEra();
    // Gabriel answers in both years
    SA.Audio && SA.Audio.gabriel(1.0);
    SA.Audio && SA.Audio.sfx('whoosh');
    // mark old era entities as leaving
    for (const n of SA.NPCs.list) n.leaving = true;
    for (const v of SA.Vehicles.list) if (v !== P.vehicle) v.leaving = true;
    for (const v of SA.Traffic.list) v.leaving = true;
    const oldNpcs = SA.NPCs.list.slice(), oldTraffic = SA.Traffic.list.slice();
    SA.NPCs.list = [];
    SA.Traffic.list = [];
    // switch the active world (collision, nav) to the target era immediately; the old era stays visible outside the ring
    const oldE = SA.World.eras[from], newE = SA.World.eras[target];
    newE.group.visible = true;
    SA.World.current = newE;
    G.era = target;
    newE.mats.uniforms.uWaveMode.value = 1;
    oldE.mats.uniforms.uWaveMode.value = -1;
    const gu = G.groundMat().userData.uniforms;
    gu.tColB.value = newE.groundTex.col;
    gu.tMatB.value = newE.groundTex.mat;
    gu.uWaveMode.value = 1;
    SA.Tex.wave.uWaveCenter.value.set(pos.x, pos.z);
    SA.Tex.wave.uWaveRadius.value = 0;
    // spawn the new era's people and vehicles
    SA.NPCs.spawnEra(target);
    SA.Traffic.spawnEra(target);
    SA.Vehicles.spawnParked(target);
    // mission hook (e.g. the van that's parked where you land on the first jump)
    if (K.beforeArrive) K.beforeArrive(target, pos.x, pos.z);
    // safe arrival
    const vehicles = SA.Vehicles.list.filter((v) => v.era === target && !v.leaving);
    const moving = vehicles.filter((v) => Math.abs(v.speed) > 0.5 || v.ai);
    let reason = null;
    const e = target;
    if (!SA.World.eras[e].col.isFree(pos.x, pos.z, 0.45, 'walk')) reason = 'building';
    else if (vehicles.some((v) => U.dist(v.x, v.z, pos.x, pos.z) < v.def.radius + 0.6)) reason = 'vehicle';
    else {
      const nr = SA.World.nearestRoad(pos.x, pos.z, (r) => SA.Terrain.isCarriageway(r) && r.t !== 'service', 6);
      if (nr && nr.d < SA.Terrain.roadWidth(nr.road) / 2 && moving.some((v) => U.dist(v.x, v.z, pos.x, pos.z) < 30)) reason = 'road';
    }
    if (reason) {
      const safe = SA.World.findSafe(target, pos.x, pos.z, { vehicles, avoidRoad: reason === 'road', r: 0.5 });
      P.teleport(safe.x, safe.z, P.ch.yaw);
      SA.emit('slip', reason, safe.moved);
      setTimeout(() => SA.HUD && SA.HUD.toast(SA.STORY.slipLines[reason] || SA.STORY.slipLines.unsafe, 5), first ? 1800 : 400);
    }
    // rest timer
    const rest = K.restFor(from, target);
    K.restUntil = G.time + rest + (first ? 4 : 0);
    K.restTotal = rest;
    K.trans = { from, to: target, t: 0, dur: first ? 7.5 : opts.fast ? 1.2 : 3.4, oldNpcs, oldTraffic, first, cx: pos.x, cz: pos.z };
    // visual flourish
    const fl = document.getElementById('flash');
    if (fl && !G.settings.reduceFlashes) {
      fl.style.transition = 'none';
      fl.style.opacity = first ? '0.95' : '0.7';
      requestAnimationFrame(() => {
        fl.style.transition = 'opacity ' + (first ? 2.4 : 1.1) + 's ease-out';
        fl.style.opacity = '0';
      });
    }
    G.cam.shake = first ? 0.5 : 0.25;
    G.cam.fovKick = 10;
    if (target === 1897) SA.Game.setFlag('clockStopped1897', true);
    SA.HUD && SA.HUD.eraRoll(from, target, K.trans.dur);
    return true;
  };

  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  function lerpColor(a, b, t) {
    return tmpC.set(a).lerp(tmpC2.set(b), t).getHex();
  }
  function stepTransition(dt) {
    const tr = K.trans;
    const G = SA.Game;
    tr.t += dt;
    const k = U.clamp(tr.t / tr.dur, 0, 1);
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const R = 2 + ease * 520;
    SA.Tex.wave.uWaveRadius.value = R;
    const cx = tr.cx, cz = tr.cz;
    // blend lighting between eras
    const A = SA.ERAS[tr.from], B = SA.ERAS[tr.to];
    const scene = G.scene();
    const lk = U.smoothstep(0.1, 0.9, k);
    scene.fog.color.setHex(lerpColor(A.fog.color, B.fog.color, lk));
    scene.fog.near = U.lerp(A.fog.near, B.fog.near, lk);
    scene.fog.far = U.lerp(A.fog.far, B.fog.far, lk);
    const hemi = G.hemi(), sun = G.sun(), sky = G.sky().material.uniforms;
    hemi.color.setHex(lerpColor(A.hemi.sky, B.hemi.sky, lk));
    hemi.groundColor.setHex(lerpColor(A.hemi.ground, B.hemi.ground, lk));
    hemi.intensity = U.lerp(A.hemi.intensity, B.hemi.intensity, lk);
    sun.color.setHex(lerpColor(A.sun.color, B.sun.color, lk));
    sun.intensity = U.lerp(A.sun.intensity, B.sun.intensity, lk);
    G.sunDir.set(U.lerp(A.sun.dir[0], B.sun.dir[0], lk), U.lerp(A.sun.dir[1], B.sun.dir[1], lk), U.lerp(A.sun.dir[2], B.sun.dir[2], lk)).normalize();
    sky.top.value.setHex(lerpColor(A.sky.top, B.sky.top, lk));
    sky.mid.value.setHex(lerpColor(A.sky.mid, B.sky.mid, lk));
    sky.horizon.value.setHex(lerpColor(A.sky.horizon, B.sky.horizon, lk));
    sky.glow.value.setHex(lerpColor(A.sky.sunGlow, B.sky.sunGlow, lk));
    sky.sunDir.value.copy(G.sunDir);
    sky.uStars.value = U.lerp(tr.from === 1897 ? 0.6 : 0, tr.to === 1897 ? 0.6 : 0, lk);
    G.renderer().toneMappingExposure = U.lerp(A.exposure, B.exposure, lk);
    G.cam.fovKick = U.damp(G.cam.fovKick, 0, 1.5, dt);
    // old entities vanish as the ring passes; new ones appear inside it
    for (const n of tr.oldNpcs) n.ch.visible = U.dist(n.ch.x, n.ch.z, cx, cz) > R;
    for (const n of SA.NPCs.list) n.ch.visible = U.dist(n.ch.x, n.ch.z, cx, cz) < R;
    for (const v of SA.Vehicles.list) {
      const inside = U.dist(v.x, v.z, cx, cz) < R;
      v.visible = v.leaving ? !inside : inside || v === SA.Player.vehicle;
      if (v.rider) v.rider.visible = v.visible;
    }
    // loose meshes (signs, dial, lamp) toggle by distance
    for (const [eraId, mode] of [[tr.from, -1], [tr.to, 1]]) {
      const g = SA.World.eras[eraId].group;
      g.traverse((o) => {
        if (o.userData && o.userData.waveCPU) {
          const p = o.position;
          const inside = U.dist(p.x, p.z, cx, cz) < R;
          o.visible = mode > 0 ? inside : !inside;
        }
        if (o.isPoints) o.visible = mode > 0 ? k > 0.45 : k <= 0.45;
      });
    }
    if (k >= 1) finishTransition();
  }
  function finishTransition() {
    const tr = K.trans;
    const G = SA.Game;
    // remove old era entities
    for (const n of tr.oldNpcs) SA.NPCs.pool.remove(n.ch);
    for (const v of tr.oldTraffic) if (v.rider) G.pool.remove(v.rider);
    SA.Vehicles.list = SA.Vehicles.list.filter((v) => !v.leaving);
    for (const n of SA.NPCs.list) n.ch.visible = true;
    for (const v of SA.Vehicles.list) v.visible = true;
    const oldE = SA.World.eras[tr.from], newE = SA.World.eras[tr.to];
    oldE.group.visible = false;
    oldE.mats.uniforms.uWaveMode.value = 0;
    newE.mats.uniforms.uWaveMode.value = 0;
    for (const g of [oldE.group, newE.group]) g.traverse((o) => {
      if (o.userData && o.userData.waveCPU) o.visible = true;
      if (o.isPoints) o.visible = true;
    });
    G.showEra(tr.to);
    K.trans = null;
    G.cam.fovKick = 0;
    SA.Police && SA.Police.restoreEra(tr.to);
    SA.emit('jump', tr.from, tr.to, tr.first);
    SA.Game.save(true);
  }
  K.inTransition = () => !!K.trans;
  K.debugState = () => ({ owned: K.owned, rest: Math.round(K.restLeft()), allowed: K.allowed.slice(), locked: K.locked, trans: !!K.trans, jumps: K.jumps, status: K.status().code });
})();
