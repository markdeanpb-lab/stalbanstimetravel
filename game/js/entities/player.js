/* The player: on-foot controller with collision, sprinting, interaction targeting, outfit, and the
   hooks for vehicles and the Curfew Key. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;

  const Player = (SA.Player = {
    ch: null,
    vehicle: null,
    outfit: 'modern',
    walk: 1.75,
    run: 5.4,
    inventory: [],
    stamina: 1,
    frozen: false,
    lastSafe: { x: 0, z: 0 },
    grabbedBy: null,
  });

  Player.init = function (pool) {
    Player.ch = new SA.Character({ role: 'player', radius: 0.33 });
    Player.setOutfit('modern');
    pool.add(Player.ch);
  };
  Player.setOutfit = function (id) {
    const o = SA.OUTFITS[id];
    if (!o) return;
    Player.outfit = id;
    Player.ch.look = Object.assign({}, o.look);
    SA.emit('outfit', id);
  };
  Player.outOfPlace = function (eraId) {
    const o = SA.OUTFITS[Player.outfit];
    return o && o.era !== eraId;
  };
  Player.pos = function () {
    const v = Player.vehicle;
    return v ? { x: v.x, z: v.z, y: v.y } : { x: Player.ch.x, z: Player.ch.z, y: Player.ch.y };
  };
  Player.teleport = function (x, z, yaw) {
    const c = Player.ch;
    c.x = x;
    c.z = z;
    c.y = SA.Terrain.height(x, z);
    c.groundY = c.y;
    c.vx = c.vz = 0;
    if (yaw !== undefined) c.yaw = yaw;
    Player.lastSafe = { x, z };
  };
  Player.has = (item) => Player.inventory.indexOf(item) >= 0;
  Player.give = function (item) {
    if (!Player.has(item)) {
      Player.inventory.push(item);
      SA.emit('inventory', item);
    }
  };
  Player.take = function (item) {
    const i = Player.inventory.indexOf(item);
    if (i >= 0) Player.inventory.splice(i, 1);
  };

  // on-foot update. camYaw: camera yaw (radians) so input is camera-relative
  Player.update = function (dt, camYaw) {
    const c = Player.ch;
    const I = SA.Input;
    const era = SA.World.current;
    if (!era) return;
    if (Player.vehicle) {
      c.visible = !!Player.vehicle.def.showRider;
      return;
    }
    c.visible = true;
    c.seated = false;
    c.ride = null;
    let mx = I.move.x, my = I.move.y;
    if (Player.frozen || SA.Game.inputLocked) mx = my = 0;
    const mag = Math.min(1, Math.hypot(mx, my));
    // camera-relative direction: forward = away from camera
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let dx = fx * my + rx * mx, dz = fz * my + rz * mx;
    const dl = Math.hypot(dx, dz);
    if (dl > 0) {
      dx /= dl;
      dz /= dl;
    }
    const sprint = I.held('sprint') && Player.stamina > 0.05;
    let target = mag * (sprint ? Player.run : Player.walk * (mag > 0.75 ? 1.55 : 1));
    if (c.anim === 'down') target = 0;
    if (Player.grabbedBy) target *= 0.25;
    // stamina
    if (sprint && mag > 0.1) Player.stamina = Math.max(0, Player.stamina - dt * 0.07);
    else Player.stamina = Math.min(1, Player.stamina + dt * 0.12);
    // velocity smoothing
    const tvx = dx * target, tvz = dz * target;
    const acc = mag > 0.05 ? 10 : 12;
    c.vx = U.damp(c.vx, tvx, acc, dt);
    c.vz = U.damp(c.vz, tvz, acc, dt);
    let nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
    // collide (passages let the player through their building)
    const col = era.col;
    const res = SA.Player.collide(col, nx, nz, c.radius, c.y);
    nx = res.x;
    nz = res.z;
    // soft district boundary: very rarely needed (barriers cover openings); slide back inside
    if (!SA.World.inDistrict(nx, nz)) {
      SA.emit('boundary', nx, nz);
      nx = c.x;
      nz = c.z;
      if (!SA.World.inDistrict(nx, nz)) {
        nx = Player.lastSafe.x;
        nz = Player.lastSafe.z;
      }
    } else if (U.dist2(nx, nz, Player.lastSafe.x, Player.lastSafe.z) > 4) {
      Player.lastSafe = { x: nx, z: nz };
    }
    const moved = Math.hypot(nx - c.x, nz - c.z) / Math.max(dt, 1e-4);
    c.x = nx;
    c.z = nz;
    const gy = SA.Terrain.height(c.x, c.z);
    c.groundY = gy;
    c.y = U.damp(c.y, gy, 20, dt);
    if (mag > 0.05 && target > 0.1) c.yaw = U.dampAngle(c.yaw, Math.atan2(dx, dz), 12, dt);
    c.animate(dt, Math.min(moved, target + 0.5));
    c.speedNow = moved;
  };

  // collision helper aware of passages through buildings
  Player.collide = function (col, x, z, r, y) {
    const pas = col.passages;
    if (pas && pas.length) {
      const inP = SA.Landmarks.inPassage(x, z, pas);
      if (inP) {
        // disable the owning building temporarily
        const off = [];
        col.query(x - 2, z - 2, x + 2, z + 2, (it) => {
          if (it.type === 'poly' && it.owner && it.owner.id === inP.bid) {
            it.enabled = false;
            off.push(it);
          }
        });
        const res = col.resolve(x, z, r, 'walk', y);
        for (const it of off) it.enabled = true;
        return res;
      }
    }
    return col.resolve(x, z, r, 'walk', y);
  };
})();
