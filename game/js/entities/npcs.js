/* Pedestrians: era crowds that stroll the pavements, gawp at anachronisms, get comically knocked
   over (never hurt) and react to police chases. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const N = (SA.NPCs = { list: [], pool: null, era: null, barkT: 0 });

  N.init = function (pool) {
    N.pool = pool;
  };
  N.count = () => N.list.length;

  N.clearEra = function () {
    for (const n of N.list) N.pool.remove(n.ch);
    N.list = [];
  };

  N.spawnEra = function (eraId) {
    N.era = eraId;
    const era = SA.World.eras[eraId];
    const E = SA.ERAS[eraId];
    const p = SA.Player.pos();
    const rng = U.rng(eraId * 101 + Math.floor(Math.random() * 1000));
    const count = SA.Game.settings.quality === 'low' ? Math.round(E.npc.count * 0.7) : E.npc.count;
    for (let i = 0; i < count; i++) {
      const node = SA.Nav.randomPedNode(era, p.x, p.z, 8, 110, rng);
      if (!node) continue;
      N.spawn(eraId, node, rng);
    }
    // set pieces
    if (eraId === 1897) N.spawnBand(rng);
  };

  N.spawn = function (eraId, node, rng, opts) {
    opts = opts || {};
    const { look, prop } = SA.randomLook(eraId, rng);
    const ch = new SA.Character({ era: eraId, look, prop, role: 'npc' });
    ch.x = node.x + (rng() - 0.5) * 1.5;
    ch.z = node.z + (rng() - 0.5) * 1.5;
    ch.y = SA.Terrain.height(ch.x, ch.z);
    ch.groundY = ch.y;
    const E = SA.ERAS[eraId].npc;
    const npc = {
      ch, node, prev: null, target: null, mode: 'walk', t: 0, wait: 0, era: eraId,
      speed: U.lerp(E.speed[0], E.speed[1], rng()) * (prop === 'phone' ? 0.82 : 1), rng: U.rng(Math.floor(rng() * 1e9)),
      stareCD: 0, hitCD: 0, id: N.list.length, special: opts.special || null,
    };
    N.pickNext(npc);
    N.pool.add(ch);
    N.list.push(npc);
    return npc;
  };

  // A small brass band and listeners outside the Town Hall on Jubilee night
  N.spawnBand = function (rng) {
    const th = SA.Landmarks.townHallInfo;
    if (!th) return;
    const cx = th.x + th.nx * 8, cz = th.z + th.nz * 8;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.2 + (i / 5) * 0.6);
      const x = cx + Math.cos(a + Math.atan2(th.nz, th.nx) + Math.PI / 2) * 3.2, z = cz + Math.sin(a + Math.atan2(th.nz, th.nx) + Math.PI / 2) * 3.2;
      const ch = new SA.Character({ era: 1897, role: 'npc', look: { skin: '#e9bf9b', top: '#a3222a', legs: '#1d1d22', hair: '#3a2618', hat: 'peaked', hatColor: '#1d1d22', skirt: 0, build: 1.02, height: 1, shoes: '#111' } });
      ch.x = x;
      ch.z = z;
      ch.y = SA.Terrain.height(x, z);
      ch.groundY = ch.y;
      ch.yaw = Math.atan2(cx - x, cz - z) + Math.PI;
      ch.prop = 'basket';
      ch.propColor = '#d9b45a';
      N.pool.add(ch);
      N.list.push({ ch, mode: 'band', t: rng() * 3, era: 1897, rng, fixed: true, speed: 0 });
    }
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2, r = 6 + rng() * 6;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const era = SA.World.eras[1897];
      if (!era.col.isFree(x, z, 0.5, 'walk') || !SA.World.inDistrict(x, z)) continue;
      const { look, prop } = SA.randomLook(1897, rng);
      const ch = new SA.Character({ era: 1897, look, prop: rng() < 0.3 ? 'flag' : prop, role: 'npc' });
      ch.x = x;
      ch.z = z;
      ch.y = SA.Terrain.height(x, z);
      ch.groundY = ch.y;
      ch.yaw = Math.atan2(cx - x, cz - z);
      N.pool.add(ch);
      N.list.push({ ch, mode: 'gather', t: rng() * 5, era: 1897, rng, fixed: true, speed: 0, home: [x, z], hitCD: 0, stareCD: 0 });
    }
  };

  N.pickNext = function (npc) {
    const n = npc.node;
    if (!n || !n.nb.length) {
      npc.target = null;
      return;
    }
    let best = null, bs = -Infinity;
    for (const m of n.nb) {
      let s = npc.rng() * 1.2;
      if (m === npc.prev) s -= 2.5;
      if (npc.prev) {
        const ax = n.x - npc.prev.x, az = n.z - npc.prev.z, bx = m.x - n.x, bz = m.z - n.z;
        const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
        s += ((ax * bx + az * bz) / (la * lb)) * 1.2;
      }
      if (m.crossing && npc.rng() < 0.6) s -= 1.5;
      if (s > bs) {
        bs = s;
        best = m;
      }
    }
    npc.prev = n;
    npc.target = best;
  };

  // bark lines (subtitled)
  N.bark = function (npc, kind) {
    if (N.barkT > 0) return;
    const lines = SA.STORY && SA.STORY.barks && SA.STORY.barks[npc.era] && SA.STORY.barks[npc.era][kind];
    if (!lines || !lines.length) return;
    const line = lines[Math.floor(npc.rng() * lines.length)];
    if (SA.Dialogue && SA.Dialogue.bark(SA.STORY.barkSpeaker(npc.era, npc.ch.look), line, npc.ch)) N.barkT = 6;
  };

  // knock an NPC over (comic, non-graphic): they sit up dazed and complain
  N.knock = function (npc, dirx, dirz, strength) {
    if (npc.mode === 'down' || npc.fixedSpecial) return;
    npc.mode = 'down';
    npc.ch.anim = 'down';
    npc.ch.downT = 0;
    npc.t = 0;
    npc.wait = 2.2 + npc.rng() * 1.5;
    npc.ch.yaw = Math.atan2(-dirx, -dirz);
    npc.kx = dirx * strength;
    npc.kz = dirz * strength;
    SA.Audio && SA.Audio.sfx('bump', npc.ch.x, npc.ch.z);
    SA.emit('npc-knocked', npc);
  };

  const tmp = [];
  N.update = function (dt) {
    N.barkT = Math.max(0, N.barkT - dt);
    const era = SA.World.current;
    if (!era || !N.list.length) return;
    const P = SA.Player;
    const pp = P.pos();
    const pv = P.vehicle;
    const outfitOdd = P.outOfPlace(SA.Game.era);
    const col = era.col;
    const wanted = SA.Police ? SA.Police.level : 0;
    for (const npc of N.list) {
      const c = npc.ch;
      if (!c.visible && !npc.waveHidden) continue;
      npc.t += dt;
      npc.hitCD = Math.max(0, (npc.hitCD || 0) - dt);
      npc.stareCD = Math.max(0, (npc.stareCD || 0) - dt);
      const dP = U.dist(c.x, c.z, pp.x, pp.z);
      // recycle far-away pedestrians near the player (out of sight)
      if (!npc.fixed && dP > 135 && npc.mode !== 'down') {
        const n = SA.Nav.randomPedNode(era, pp.x, pp.z, 45, 100, npc.rng);
        if (n) {
          c.x = n.x;
          c.z = n.z;
          npc.node = n;
          npc.prev = null;
          N.pickNext(npc);
        }
        continue;
      }
      // vehicle impacts
      if (pv && npc.hitCD <= 0 && npc.mode !== 'down') {
        const sp = Math.abs(pv.speed);
        const d = U.dist(c.x, c.z, pv.x, pv.z);
        if (d < pv.def.radius + 0.4 && sp > 2.0) {
          const dx = c.x - pv.x, dz = c.z - pv.z, l = Math.hypot(dx, dz) || 1;
          N.knock(npc, dx / l, dz / l, Math.min(6, sp * 0.6));
          npc.hitCD = 4;
          SA.emit('crime', 'knockdown', c.x, c.z);
          pv.speed *= 0.82;
          continue;
        } else if (d < 9 && sp > 6 && npc.mode !== 'flee') {
          npc.mode = 'flee';
          npc.t = 0;
          npc.fleeFrom = [pv.x, pv.z];
          if (npc.rng() < 0.3) N.bark(npc, 'car');
        }
      }
      // player bumps on foot while sprinting
      if (!pv && npc.mode !== 'down' && dP < 0.75 && P.ch.speedNow > 4.2 && npc.hitCD <= 0) {
        const dx = c.x - pp.x, dz = c.z - pp.z, l = Math.hypot(dx, dz) || 1;
        if (npc.rng() < 0.5) N.knock(npc, dx / l, dz / l, 2.5);
        else N.bark(npc, 'bump');
        npc.hitCD = 3;
      }
      switch (npc.mode) {
        case 'down': {
          c.x += (npc.kx || 0) * dt;
          c.z += (npc.kz || 0) * dt;
          npc.kx = U.damp(npc.kx || 0, 0, 6, dt);
          npc.kz = U.damp(npc.kz || 0, 0, 6, dt);
          if (npc.t > npc.wait) {
            c.anim = 'idle';
            c.downT = 0;
            npc.mode = 'walk';
            N.bark(npc, 'knocked');
          }
          break;
        }
        case 'band': {
          c.anim = 'idle';
          c.t += dt;
          // bob with the music
          c.phase += dt * 4;
          c.anim = Math.sin(npc.t * 4) > 0.6 ? 'idle' : 'idle';
          break;
        }
        case 'gather': {
          c.anim = 'idle';
          if (wanted >= 2 && dP < 18) {
            npc.mode = 'flee';
            npc.t = 0;
            npc.fleeFrom = [pp.x, pp.z];
          }
          break;
        }
        case 'stare': {
          c.anim = 'idle';
          c.yaw = U.dampAngle(c.yaw, Math.atan2(pp.x - c.x, pp.z - c.z), 5, dt);
          if (npc.t > 2.5) npc.mode = 'walk';
          break;
        }
        case 'cower': {
          c.anim = 'cower';
          if (npc.t > 3) npc.mode = 'walk';
          break;
        }
        case 'flee': {
          const fx = c.x - npc.fleeFrom[0], fz = c.z - npc.fleeFrom[1];
          const l = Math.hypot(fx, fz) || 1;
          const sp = 4.2;
          N.move(npc, (fx / l) * sp, (fz / l) * sp, dt, col);
          if (npc.t > 2.2) {
            npc.mode = npc.fixed ? 'gather' : 'walk';
            if (npc.fixed && npc.home) {
              c.x = npc.home[0];
              c.z = npc.home[1];
            }
            npc.node = era.ped.nearest(c.x, c.z, 20) || npc.node;
            npc.prev = null;
            N.pickNext(npc);
          }
          break;
        }
        case 'idle': {
          c.anim = 'idle';
          if (npc.t > npc.wait) {
            npc.mode = 'walk';
            npc.t = 0;
          }
          break;
        }
        default: {
          // walking along the pavement graph
          if (npc.fixed) break;
          const tg = npc.target;
          if (!tg) {
            npc.node = era.ped.nearest(c.x, c.z, 25);
            if (npc.node) N.pickNext(npc);
            break;
          }
          const dx = tg.x - c.x, dz = tg.z - c.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.8) {
            npc.node = tg;
            N.pickNext(npc);
            if (npc.rng() < 0.04) {
              npc.mode = 'idle';
              npc.t = 0;
              npc.wait = 2 + npc.rng() * 5;
            }
            break;
          }
          let sp = npc.speed;
          if (wanted >= 2 && dP < 14 && npc.rng() < 0.01) {
            npc.mode = 'cower';
            npc.t = 0;
            N.bark(npc, 'police');
          }
          // gawp at anachronistic clothes
          if (outfitOdd && dP < 6 && npc.stareCD <= 0 && npc.rng() < 0.02) {
            npc.mode = 'stare';
            npc.t = 0;
            npc.stareCD = 25;
            N.bark(npc, 'outfit');
            SA.emit('stared');
          }
          N.move(npc, (dx / d) * sp, (dz / d) * sp, dt, col);
        }
      }
      c.y = U.damp(c.y, SA.Terrain.height(c.x, c.z), 15, dt);
      c.groundY = c.y;
    }
    // light separation between nearby walkers and from the player
    N.separate(pp, pv);
  };
  N.move = function (npc, vx, vz, dt, col) {
    const c = npc.ch;
    let nx = c.x + vx * dt, nz = c.z + vz * dt;
    const r = col.resolve(nx, nz, 0.3, 'walk', c.y);
    nx = r.x;
    nz = r.z;
    if (!SA.World.inDistrict(nx, nz)) {
      nx = c.x;
      nz = c.z;
      npc.node = SA.World.current.ped.nearest(c.x, c.z, 25) || npc.node;
      npc.prev = null;
      N.pickNext(npc);
    }
    const moved = Math.hypot(nx - c.x, nz - c.z) / Math.max(dt, 1e-4);
    c.x = nx;
    c.z = nz;
    if (moved > 0.1) c.yaw = U.dampAngle(c.yaw, Math.atan2(vx, vz), 8, dt);
    c.animate(dt, moved);
  };
  const grid = new Map();
  N.separate = function (pp, pv) {
    grid.clear();
    for (const n of N.list) {
      const k = Math.floor(n.ch.x) * 1000 + Math.floor(n.ch.z);
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(n);
    }
    for (const n of N.list) {
      if (n.mode === 'down' || n.fixed) continue;
      const c = n.ch;
      const kx = Math.floor(c.x), kz = Math.floor(c.z);
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const a = grid.get((kx + i) * 1000 + kz + j);
          if (!a) continue;
          for (const m of a) {
            if (m === n) continue;
            const dx = c.x - m.ch.x, dz = c.z - m.ch.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < 0.36 && d2 > 1e-6) {
              const d = Math.sqrt(d2), push = (0.6 - d) * 0.5;
              c.x += (dx / d) * push;
              c.z += (dz / d) * push;
            }
          }
        }
      if (!pv) {
        const dx = c.x - pp.x, dz = c.z - pp.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.42 && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = 0.65 - d;
          c.x += (dx / d) * push;
          c.z += (dz / d) * push;
        }
      }
    }
  };
  // nearest NPC to a point (for interactions/police witnesses)
  N.nearest = function (x, z, r, filter) {
    let best = null, bd = r * r;
    for (const n of N.list) {
      if (filter && !filter(n)) continue;
      const d = U.dist2(n.ch.x, n.ch.z, x, z);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  };
})();
