/* Simple traffic: AI drivers follow the lane graph (keeping left), slow for corners, stop for people,
   honk when blocked, and respawn out of sight. Riders of carts and bicycles are visible characters. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const T = (SA.Traffic = { list: [] });

  T.init = function () {};
  T.count = () => T.list.length;
  T.clearEra = function () {
    for (const v of T.list) {
      if (v.rider) SA.Game.pool.remove(v.rider);
      SA.Vehicles.remove(v);
    }
    T.list = [];
  };
  T.spawnEra = function (eraId) {
    const E = SA.ERAS[eraId];
    const n = SA.Game.settings.quality === 'low' ? Math.max(3, E.vehicles.density - 3) : E.vehicles.density;
    for (let i = 0; i < n; i++) T.spawnOne(eraId, true);
  };

  function inView(x, z) {
    const cam = SA.Game.camera();
    if (!cam) return false;
    const dx = x - cam.position.x, dz = z - cam.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 25) return true;
    const fx = -Math.sin(SA.Game.cam.yaw), fz = -Math.cos(SA.Game.cam.yaw);
    return (dx * fx + dz * fz) / d > 0.45 && d < 150;
  }

  T.spawnOne = function (eraId, initial) {
    const era = SA.World.eras[eraId];
    const g = era.lanes;
    if (!g || !g.nodes.length) return null;
    const p = SA.Player.pos();
    const rng = Math.random;
    for (let tries = 0; tries < 30; tries++) {
      const n = g.nodes[Math.floor(rng() * g.nodes.length)];
      if (!n.inside || n.nb.length === 0) continue;
      const d = U.dist(n.x, n.z, p.x, p.z);
      if (d < 30 || d > 170) continue;
      if (!initial && inView(n.x, n.z)) continue;
      const next = n.nb[Math.floor(rng() * n.nb.length)];
      // avoid stacking
      if (SA.Vehicles.list.some((v) => v.era === eraId && U.dist(v.x, v.z, n.x, n.z) < 9)) continue;
      const types = SA.ERAS[eraId].vehicles.traffic;
      const type = types[Math.floor(rng() * types.length)];
      const yaw = Math.atan2(next.x - n.x, next.z - n.z);
      const off = laneOffset(n, next, SA.Vehicles.defs[type]);
      const v = SA.Vehicles.create(type, n.x + off[0], n.z + off[1], yaw, { era: eraId, driver: 'ai' });
      v.ai = { update: drive, prev: n, next, wait: 0, honkT: 0, cruise: 0.5 + rng() * 0.25, stuck: 0 };
      T.attachRider(v, eraId);
      T.list.push(v);
      return v;
    }
    return null;
  };
  T.attachRider = function (v, eraId) {
    const d = v.def;
    if (!d.showRider) return;
    const { look } = SA.randomLook(eraId, U.rng((Math.random() * 1e9) | 0));
    if (d.riderPose === 'driver') {
      look.hat = eraId === 1897 ? (Math.random() < 0.5 ? 'bowler' : 'tophat') : look.hat;
      look.skirt = 0;
    }
    if (d.riderPose === 'bicycle') look.skirt = look.skirt ? 1 : 0;
    const ch = new SA.Character({ era: eraId, look, role: 'rider' });
    v.rider = ch;
    SA.Game.pool.add(ch);
  };

  function laneOffset(a, b, def) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    // UK: drive on the left. Left of travel direction f=(dx,dz) is (dz, -dx)/l rotated: left = (fz, -fx)?
    // With +z forward and +x... left vector = (cos(yaw), -sin(yaw)) where f=(sin yaw, cos yaw)
    const fx = dx / l, fz = dz / l;
    const w = a.road ? SA.Terrain.roadWidth(a.road) : 7;
    const off = Math.min(w / 4 + 0.2, 2.4);
    return [fz * off, -fx * off];
  }

  function obstacleAhead(v, dist) {
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const P = SA.Player;
    const check = (x, z, r) => {
      const dx = x - v.x, dz = z - v.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > dist) return false;
      const across = Math.abs(-dx * fz + dz * fx);
      return across < v.def.wid / 2 + r + 0.3;
    };
    const pp = P.pos();
    if (check(pp.x, pp.z, P.vehicle ? P.vehicle.def.wid / 2 : 0.4)) return 'player';
    for (const o of SA.Vehicles.list) {
      if (o === v || o.era !== v.era || !o.visible) continue;
      if (check(o.x, o.z, o.def.wid / 2)) return 'vehicle';
    }
    if (SA.NPCs) {
      for (const n of SA.NPCs.list) {
        if (n.mode === 'down' && check(n.ch.x, n.ch.z, 0.4)) return 'npc';
        if (check(n.ch.x, n.ch.z, 0.3) && U.dist(n.ch.x, n.ch.z, v.x, v.z) < dist * 0.6) return 'npc';
      }
    }
    return null;
  }

  function drive(v, dt) {
    const ai = v.ai;
    const era = SA.World.current;
    const g = era.lanes;
    if (!ai.next) return;
    const off = laneOffset(ai.prev, ai.next, v.def);
    const tx = ai.next.x + off[0], tz = ai.next.z + off[1];
    const dx = tx - v.x, dz = tz - v.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.2) {
      // advance
      const cur = ai.next;
      let opts = cur.nb.filter((m) => m !== ai.prev);
      if (!opts.length || !cur.inside) {
        // dead end (district edge): respawn if not seen, else turn back
        if (!inView(v.x, v.z)) {
          T.respawn(v);
          return;
        }
        opts = [ai.prev];
      }
      ai.prev = cur;
      ai.next = opts[Math.floor(Math.random() * opts.length)];
      return;
    }
    const want = Math.atan2(dx, dz);
    const diff = U.wrapAngle(want - v.yaw);
    v.steerIn = U.clamp(diff * 2.2, -1, 1);
    // speed: slow in corners, cruise otherwise
    let target = v.def.maxSpeed * ai.cruise * (1 - Math.min(0.7, Math.abs(diff) * 1.2));
    const lookAhead = 6 + Math.abs(v.speed) * 1.4;
    const ob = obstacleAhead(v, lookAhead);
    if (ob) {
      target = 0;
      ai.wait += dt;
      if (ob === 'player' && ai.wait > 1.6 && ai.honkT <= 0) {
        SA.Audio && SA.Audio.sfx(v.def.horn, v.x, v.z, 0.7);
        ai.honkT = 4;
        if (v.def.riderPose === 'driver' || Math.random() < 0.5) SA.emit('honked', v);
      }
    } else ai.wait = 0;
    ai.honkT -= dt;
    const err = target - v.speed;
    v.throttle = U.clamp(err * 0.6, -1, 1);
    v.handbrake = false;
    // stuck detection
    if (Math.abs(v.speed) < 0.3 && target > 1) ai.stuck += dt;
    else ai.stuck = 0;
    if (ai.stuck > 6 && !inView(v.x, v.z)) T.respawn(v);
  }
  T.drive = drive;

  T.respawn = function (v) {
    const i = T.list.indexOf(v);
    if (i >= 0) T.list.splice(i, 1);
    if (v.rider) SA.Game.pool.remove(v.rider);
    SA.Vehicles.remove(v);
    T.spawnOne(SA.Game.era, false);
  };

  T.update = function (dt) {
    // keep riders on their vehicles
    for (const v of T.list) {
      if (!v.rider) continue;
      const ch = v.rider;
      if (v.driver === 'player' || !v.ai) {
        // the player took this vehicle: rider is ejected (handled by carjack)
        SA.Game.pool.remove(ch);
        v.rider = null;
        continue;
      }
      const d = v.def;
      ch.visible = v.visible;
      ch.x = v.x;
      ch.z = v.z;
      ch.yaw = v.yaw;
      ch.y = v.y + (d.riderPose === 'bicycle' ? 0.42 : d.riderPose === 'scooter' ? 0.12 : 0.55);
      ch.groundY = v.y;
      ch.seated = d.riderPose !== 'bicycle';
      ch.ride = d.riderPose === 'bicycle' ? 'bicycle' : null;
      ch.phase += Math.abs(v.speed) * dt * 2.2;
      if (d.riderPose === 'driver') {
        ch.x = v.x + Math.sin(v.yaw) * 0.2;
        ch.z = v.z + Math.cos(v.yaw) * 0.2;
      }
    }
    // remove traffic that the player has taken over
    T.list = T.list.filter((v) => v.ai && v.ai.update === drive);
    // top up density
    const want = SA.ERAS[SA.Game.era].vehicles.density - (SA.Game.settings.quality === 'low' ? 3 : 0);
    if (T.list.length < want && Math.random() < 0.02) T.spawnOne(SA.Game.era, false);
  };
})();
