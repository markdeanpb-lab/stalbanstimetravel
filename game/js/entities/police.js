/* Wanted level and era-appropriate police: 2026 patrol cars with sirens and officers; 1964 constables,
   a "Noddy bike" and a black patrol car with a bell; 1897 St Albans City Police constables with
   whistles and a sergeant on a bicycle. Escalates with crimes; escape by breaking line of sight. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const P = (SA.Police = { level: 0, heat: 0, units: [], lastSeen: null, unseenT: 0, perEra: {}, searching: false, caughtT: 0, cooldown: 0 });

  P.init = function (pool) {
    P.pool = pool;
    SA.on('crime', (kind, x, z) => P.crime(kind, x, z));
  };

  P.looks = {
    2026: { skin: '#d9a07a', top: '#1b1f2a', legs: '#1b1f2a', hair: '#2a1d14', hat: 'peaked', hatColor: '#111', skirt: 0, build: 1.06, height: 1.02, shoes: '#111', sleeves: '#e7ff1c' },
    1964: { skin: '#e8b996', top: '#1a2236', legs: '#1a2236', hair: '#2a1d14', hat: 'helmet', hatColor: '#141a2a', skirt: 0, build: 1.06, height: 1.03, shoes: '#111' },
    1897: { skin: '#e9bf9b', top: '#141a2c', legs: '#141a2c', hair: '#2a1d14', hat: 'helmet', hatColor: '#10141f', skirt: 0, build: 1.08, height: 1.03, shoes: '#111' },
  };

  P.crime = function (kind, x, z) {
    if (P.cooldown > 0 || SA.Game.state !== 'play') return;
    const weight = { knockdown: 1, carjack: 1, collision: 0.5, scripted: 0 }[kind] || 0.5;
    // witnessed by police?
    let seen = false;
    for (const u of P.units) if (U.dist(u.x(), u.z(), x, z) < 40 && SA.World.current.col.lineOfSight(u.x(), u.z(), x, z)) seen = true;
    if (seen) P.addHeat(weight * 1.2);
    else {
      // a passer-by may report it a moment later
      const odd = SA.Player.outOfPlace(SA.Game.era) ? 0.75 : 0.55;
      if (Math.random() < odd) setTimeout(() => P.addHeat(weight), 2500);
    }
  };
  P.addHeat = function (h) {
    P.heat = Math.min(P.heat + h, 6);
    const max = SA.ERAS[SA.Game.era].police.maxStars;
    const lvl = Math.min(max, Math.floor(P.heat + 0.001));
    if (lvl > P.level) P.setLevel(lvl);
  };
  P.setLevel = function (lvl, reason) {
    const max = SA.ERAS[SA.Game.era].police.maxStars;
    lvl = U.clamp(lvl, 0, max);
    const prev = P.level;
    P.level = lvl;
    P.heat = Math.max(P.heat, lvl);
    P.unseenT = 0;
    if (lvl > 0) {
      P.lastSeen = SA.Player.pos();
      P.searching = false;
      if (lvl > prev) {
        P.dispatch();
        SA.Audio && SA.Audio.sfx(SA.ERAS[SA.Game.era].police.siren, P.lastSeen.x, P.lastSeen.z);
        SA.emit('wanted', lvl, reason);
      }
    } else {
      P.heat = 0;
      P.standDown();
      SA.emit('wanted', 0, reason);
    }
  };
  P.clear = function () {
    P.setLevel(0, 'cleared');
  };

  // ---------------------------------------------------------------- units
  function spawnPoint(minD, maxD) {
    const era = SA.World.current;
    const p = SA.Player.pos();
    for (let i = 0; i < 40; i++) {
      const n = SA.Nav.randomPedNode(era, p.x, p.z, minD, maxD);
      if (n) return n;
    }
    return null;
  }
  P.spawnFoot = function () {
    const era = SA.Game.era;
    const n = spawnPoint(28, 60);
    if (!n) return null;
    const ch = new SA.Character({ era, role: 'police', look: Object.assign({}, P.looks[era]) });
    ch.x = n.x;
    ch.z = n.z;
    ch.y = SA.Terrain.height(n.x, n.z);
    ch.groundY = ch.y;
    P.pool.add(ch);
    const u = { kind: 'foot', ch, x: () => ch.x, z: () => ch.z, path: null, pathT: 0, speed: era === 2026 ? 5.0 : era === 1964 ? 4.7 : 4.5, whistleT: 0, grabT: 0 };
    P.units.push(u);
    return u;
  };
  P.spawnVehicle = function (type) {
    const era = SA.Game.era;
    const g = SA.World.current.lanes;
    const p = SA.Player.pos();
    let best = null;
    for (let i = 0; i < 60; i++) {
      const n = g.nodes[Math.floor(Math.random() * g.nodes.length)];
      if (!n || !n.inside || !n.nb.length) continue;
      const d = U.dist(n.x, n.z, p.x, p.z);
      if (d > 45 && d < 140) {
        best = n;
        break;
      }
    }
    if (!best) return null;
    const next = best.nb[0];
    const v = SA.Vehicles.create(type, best.x, best.z, Math.atan2(next.x - best.x, next.z - best.z), { era, driver: 'ai' });
    v.siren = true;
    v.police = true;
    const u = { kind: 'veh', v, x: () => v.x, z: () => v.z, prev: best, next, honkT: 0, sirenT: 0 };
    v.ai = { update: (veh, dt) => chaseDrive(u, veh, dt) };
    if (v.def.showRider) {
      const ch = new SA.Character({ era, role: 'police', look: Object.assign({}, P.looks[era], era === 1897 ? { hat: 'peaked' } : {}) });
      v.rider = ch;
      P.pool.add(ch);
    }
    P.units.push(u);
    return u;
  };
  P.dispatch = function () {
    const era = SA.Game.era;
    const L = P.level;
    const want = { foot: 0, veh: 0 };
    if (era === 2026) {
      want.foot = L >= 1 ? 1 : 0;
      want.veh = L >= 2 ? L - 1 : 0;
      if (L >= 3) want.foot = 2;
    } else if (era === 1964) {
      want.foot = L >= 1 ? (L >= 2 ? 2 : 1) : 0;
      want.veh = L >= 2 ? 1 : 0;
      if (L >= 3) want.veh = 2;
    } else {
      want.foot = L >= 1 ? L + (L >= 2 ? 1 : 0) : 0;
      want.veh = L >= 3 ? 1 : 0;
    }
    const have = { foot: P.units.filter((u) => u.kind === 'foot').length, veh: P.units.filter((u) => u.kind === 'veh').length };
    for (let i = have.foot; i < want.foot; i++) P.spawnFoot();
    for (let i = have.veh; i < want.veh; i++) {
      const type = era === 2026 ? 'police2026' : era === 1964 ? (i === 0 && L < 3 ? 'noddy' : 'police1964') : 'sergeantBike';
      P.spawnVehicle(type);
    }
  };
  P.standDown = function () {
    for (const u of P.units) {
      if (u.kind === 'foot') P.pool.remove(u.ch);
      else {
        if (u.v.rider) P.pool.remove(u.v.rider);
        SA.Vehicles.remove(u.v);
      }
    }
    P.units = [];
  };
  P.clearEra = function () {
    // remember heat for the era we leave; police can't follow through time
    if (P.level > 0) P.perEra[SA.Game.era] = { level: P.level, t: SA.Game.time };
    P.standDown();
    P.level = 0;
    P.heat = 0;
  };
  P.restoreEra = function (eraId) {
    const rec = P.perEra[eraId];
    if (!rec) return;
    const away = SA.Game.time - rec.t;
    const lvl = Math.max(0, rec.level - Math.floor(away / 60));
    delete P.perEra[eraId];
    if (lvl > 0) {
      P.setLevel(lvl, 'remembered');
      SA.HUD && SA.HUD.toast(SA.STORY ? SA.STORY.ui.policeRemember : 'The police here still remember your face.');
    }
  };

  function chaseDrive(u, v, dt) {
    const p = SA.Player.pos();
    const d = U.dist(v.x, v.z, p.x, p.z);
    const col = SA.World.current.col;
    let tx, tz;
    const los = d < 60 && col.lineOfSight(v.x, v.z, p.x, p.z);
    if (los) {
      tx = p.x;
      tz = p.z;
    } else {
      // follow lanes toward the last seen position
      const g = SA.World.current.lanes;
      const dn = U.dist(v.x, v.z, u.next.x, u.next.z);
      if (dn < 4) {
        const goal = P.lastSeen || p;
        let best = null, bd = Infinity;
        for (const m of u.next.nb) {
          const dd = U.dist(m.x, m.z, goal.x, goal.z) + (m === u.prev ? 30 : 0);
          if (dd < bd) {
            bd = dd;
            best = m;
          }
        }
        u.prev = u.next;
        u.next = best || u.prev;
      }
      tx = u.next.x;
      tz = u.next.z;
      void g;
    }
    const want = Math.atan2(tx - v.x, tz - v.z);
    const diff = U.wrapAngle(want - v.yaw);
    v.steerIn = U.clamp(diff * 2.4, -1, 1);
    let target = v.def.maxSpeed * (los ? (d < 8 ? 0.35 : 0.85) : 0.7) * (1 - Math.min(0.6, Math.abs(diff)));
    if (d < 4 && !SA.Player.vehicle) target = 0;
    v.throttle = U.clamp((target - v.speed) * 0.5, -1, 1);
    // dismount/arrest attempt when close and the player is on foot
    if (d < 3.2 && !SA.Player.vehicle && Math.abs(v.speed) < 2) u.near = (u.near || 0) + dt;
    else u.near = 0;
    if (u.near > 1.2) P.caught();
    u.sirenT -= dt;
    if (u.sirenT <= 0) {
      SA.Audio && SA.Audio.sfx(SA.ERAS[SA.Game.era].police.siren, v.x, v.z, 0.8);
      u.sirenT = SA.Game.era === 1897 ? 3.5 : 2.6;
    }
  }

  // A* over the pavement graph
  function astar(g, start, goal) {
    if (!start || !goal) return null;
    const open = [start], came = new Map(), gs = new Map([[start, 0]]), fs = new Map([[start, U.dist(start.x, start.z, goal.x, goal.z)]]);
    const closed = new Set();
    let iter = 0;
    while (open.length && iter++ < 1500) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (fs.get(open[i]) < fs.get(open[bi])) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === goal) {
        const path = [cur];
        let c = cur;
        while (came.has(c)) path.unshift((c = came.get(c)));
        return path;
      }
      closed.add(cur);
      for (const m of cur.nb) {
        if (closed.has(m)) continue;
        const tg = gs.get(cur) + U.dist(cur.x, cur.z, m.x, m.z);
        if (tg < (gs.has(m) ? gs.get(m) : Infinity)) {
          came.set(m, cur);
          gs.set(m, tg);
          fs.set(m, tg + U.dist(m.x, m.z, goal.x, goal.z));
          if (open.indexOf(m) < 0) open.push(m);
        }
      }
    }
    return null;
  }
  P.astar = astar;

  P.caught = function () {
    if (P.caughtT > 0) return;
    P.caughtT = 4;
    SA.emit('caught', SA.Game.era);
    if (P.onCaught && P.onCaught()) return; // mission handles it
    // default: a caution and a stern look, then released nearby
    const lines = SA.STORY ? SA.STORY.caught[SA.Game.era] : ['You are let off with a caution.'];
    SA.Dialogue && SA.Dialogue.say([{ who: 'Police', text: lines[Math.floor(Math.random() * lines.length)] }]);
    P.clear();
    P.cooldown = 8;
  };

  // ---------------------------------------------------------------- update
  P.update = function (dt) {
    P.cooldown = Math.max(0, P.cooldown - dt);
    P.caughtT = Math.max(0, P.caughtT - dt);
    if (!P.level && !P.units.length) return;
    const pl = SA.Player;
    const pp = pl.pos();
    const era = SA.World.current;
    const col = era.col;
    let anySee = false;
    for (const u of P.units) {
      const ux = u.x(), uz = u.z();
      const d = U.dist(ux, uz, pp.x, pp.z);
      const sees = d < (SA.Game.era === 1897 ? 38 : 50) && col.lineOfSight(ux, uz, pp.x, pp.z);
      if (sees) {
        anySee = true;
        P.lastSeen = { x: pp.x, z: pp.z };
      }
      if (u.kind === 'foot') {
        const ch = u.ch;
        u.pathT -= dt;
        let tx = pp.x, tz = pp.z;
        if (!sees) {
          const goal = P.lastSeen || pp;
          if (u.pathT <= 0 || !u.path) {
            const g = era.ped;
            u.path = astar(g, g.nearest(ch.x, ch.z, 25), g.nearest(goal.x, goal.z, 25));
            u.pathT = 1.2;
          }
          if (u.path && u.path.length) {
            const n = u.path[0];
            if (U.dist(ch.x, ch.z, n.x, n.z) < 1.2) u.path.shift();
            if (u.path.length) {
              tx = u.path[0].x;
              tz = u.path[0].z;
            } else {
              tx = goal.x;
              tz = goal.z;
            }
          } else {
            tx = goal.x;
            tz = goal.z;
          }
        }
        const dx = tx - ch.x, dz = tz - ch.z, dl = Math.hypot(dx, dz) || 1;
        const sp = d < 1.0 ? 0 : u.speed * (sees ? 1 : 0.85) * (pl.vehicle ? 1.05 : 1);
        let nx = ch.x + (dx / dl) * sp * dt, nz = ch.z + (dz / dl) * sp * dt;
        const r = col.resolve(nx, nz, 0.33, 'walk', ch.y);
        const moved = Math.hypot(r.x - ch.x, r.z - ch.z) / Math.max(dt, 1e-4);
        ch.x = r.x;
        ch.z = r.z;
        ch.y = U.damp(ch.y, SA.Terrain.height(ch.x, ch.z), 15, dt);
        ch.groundY = ch.y;
        ch.yaw = U.dampAngle(ch.yaw, Math.atan2(dx, dz), 10, dt);
        ch.animate(dt, moved);
        // whistle / shout
        u.whistleT -= dt;
        if (sees && u.whistleT <= 0) {
          SA.Audio && SA.Audio.sfx(SA.Game.era === 2026 ? 'shout' : 'whistle', ch.x, ch.z);
          u.whistleT = 3 + Math.random() * 2;
          if (Math.random() < 0.5 && SA.Dialogue) {
            const lines = SA.STORY && SA.STORY.policeShouts[SA.Game.era];
            if (lines) SA.Dialogue.bark('Constable', lines[Math.floor(Math.random() * lines.length)], ch);
          }
        }
        // grab: player on foot within reach
        if (!pl.vehicle && d < 1.1) {
          u.grabT += dt;
          pl.grabbedBy = u;
          if (u.grabT > 1.4) P.caught();
        } else {
          u.grabT = Math.max(0, u.grabT - dt * 2);
          if (pl.grabbedBy === u) pl.grabbedBy = null;
        }
      } else if (u.v && u.v.rider) {
        const ch = u.v.rider, v = u.v;
        ch.x = v.x;
        ch.z = v.z;
        ch.yaw = v.yaw;
        ch.y = v.y + (v.def.riderPose === 'bicycle' ? 0.42 : 0.12);
        ch.groundY = v.y;
        ch.seated = v.def.riderPose !== 'bicycle';
        ch.ride = v.def.riderPose === 'bicycle' ? 'bicycle' : null;
        ch.phase += Math.abs(v.speed) * dt * 2.2;
      }
    }
    if (!anySee && P.level > 0) {
      P.unseenT += dt;
      P.searching = true;
      const need = 7 + P.level * 5;
      if (P.unseenT > need) {
        P.setLevel(P.level - 1, 'lost');
        P.unseenT = 0;
        if (P.level === 0) SA.HUD && SA.HUD.toast(SA.STORY ? SA.STORY.ui.lostThem : 'You lost them.');
      }
    } else if (anySee) {
      P.unseenT = 0;
      P.searching = false;
    }
    if (!pl.vehicle && pl.grabbedBy && !P.units.includes(pl.grabbedBy)) pl.grabbedBy = null;
  };
  P.statusText = function () {
    const era = SA.Game.era;
    if (!P.level) return '';
    if (P.searching) return SA.STORY ? SA.STORY.ui.searching[era] : 'Searching';
    return SA.STORY ? SA.STORY.ui.chasing[era] : 'In pursuit';
  };
})();
