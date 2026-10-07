/* LAST SPACE - per-player views: chase camera, look-back, parking camera with guide lines,
   restrained camera shake (can be turned off), and keeping the player visible in pile-ups. */
(function (LS) {
  'use strict';
  const U = LS.U;

  class PlayerView {
    constructor(scene, car, idx) {
      this.car = car; this.idx = idx; this.scene = scene;
      this.cam = new THREE.PerspectiveCamera(62, 1, 0.15, 900);
      this.mode = 'chase'; this.shake = 0; this.shakeT = 0;
      this.pos = new THREE.Vector3(car.x - Math.cos(car.a) * 8, 4, -(car.y - Math.sin(car.a) * 8));
      this.look = new THREE.Vector3(car.x, 1, -car.y);
      this.yaw = car.a; this.lift = 0;
      this.spectate = null;
      // parking guide lines: two arcs for the wheels' path, forwards or backwards
      const mk = (c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 40), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthTest: false })); l.renderOrder = 20; l.frustumCulled = false; scene.add(l); return l; };
      this.guides = [mk(0x7cff8a), mk(0x7cff8a), mk(0xffd34d)];
      for (const g of this.guides) g.visible = false;
    }
    target() { return this.spectate || this.car; }
    bump(sev, settings) { if (!settings.shake) return; this.shake = Math.min(0.45, this.shake + sev * 0.025); }
    update(dt, arena, cars, input, settings) {
      const car = this.target(), b = car.body;
      const L = car.spec.L, H = car.spec.H || 1.5;
      const fwdx = Math.cos(b.a), fwdy = Math.sin(b.a);
      const park = this.mode === 'park' && !this.spectate;
      const look = input && input.look && !this.spectate;
      // yaw follows the car (or the direction of travel when sliding backwards fast)
      let wantYaw = b.a;
      this.yaw += U.wrap(wantYaw - this.yaw) * (1 - Math.exp(-dt * (park ? 8 : 4.5)));
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      let px, py, ph, tx, ty, th;
      if (park) {
        ph = 13 + L; px = car.x - cy * 2.5; py = car.y - sy * 2.5; tx = car.x + cy * 0.8; ty = car.y + sy * 0.8; th = 0;
      } else if (look) {
        px = car.x + cy * (L * 0.5 + 0.4); py = car.y + sy * (L * 0.5 + 0.4); ph = H + 0.5; tx = car.x - cy * 20; ty = car.y - sy * 20; th = 0.6;
      } else {
        const back = 5.4 + L * 0.55, up = 2.2 + H * 0.65;
        px = car.x - cy * back; py = car.y - sy * back; ph = up; tx = car.x + cy * 3.2; ty = car.y + sy * 3.2; th = 1.0;
        // keep the camera inside the street (out of the houses), pulling in and up if needed
        let k = 1;
        while (k > 0.35 && arena.wall(car.x - cy * back * k, car.y - sy * back * k) > -0.4) k -= 0.08;
        if (k < 1) { px = car.x - cy * back * k; py = car.y - sy * back * k; ph = up + (1 - k) * 4; }
        // pile-up: another car between us and the player? go higher
        let occl = 0;
        for (const o of cars) {
          if (o === car || o.status !== 'active') continue;
          const r = U.segDist(o.x, o.y, px, py, car.x, car.y);
          if (r.d < 1.6 && r.t > 0.05 && r.t < 0.9) occl = 1;
        }
        // or the camera would sit inside a resident's car
        if (LS.Game.match && LS.Game.match.world.raycast(car.x, car.y, px, py, (o) => o.kind === 'parked' || o.kind === 'car' && o !== car.body)) occl = Math.max(occl, 0.8);
        this.lift = U.approach(this.lift, occl * 3.5, dt * 6);
        ph += this.lift;
        if (car.overturned) ph += 2;
      }
      const k = park || look ? 1 - Math.exp(-dt * 12) : 1 - Math.exp(-dt * 7);
      this.pos.lerp(new THREE.Vector3(px, ph, -py), k);
      this.look.lerp(new THREE.Vector3(tx, th, -ty), 1 - Math.exp(-dt * 10));
      this.cam.position.copy(this.pos);
      if (this.shake > 0.001) {
        this.shakeT += dt * 45;
        this.cam.position.x += Math.sin(this.shakeT * 1.3) * this.shake; this.cam.position.y += Math.sin(this.shakeT * 1.7) * this.shake * 0.6; this.cam.position.z += Math.cos(this.shakeT) * this.shake;
        this.shake *= Math.exp(-dt * 7);
      }
      this.cam.lookAt(this.look);
      const fov = park ? 50 : look ? 70 : 60 + Math.min(14, Math.abs(car.forward) * 0.55);
      if (Math.abs(this.cam.fov - fov) > 0.05) { this.cam.fov += (fov - this.cam.fov) * (1 - Math.exp(-dt * 4)); this.cam.updateProjectionMatrix(); }
      this.updateGuides(park, car);
    }
    // predicted wheel paths for the current steering, like a reversing camera
    updateGuides(on, car) {
      const showRev = on && car.gear === -1 && car.spec.rearView > 0;
      const showFwd = on && car.gear === 1;
      const vis = showRev || showFwd;
      for (const g of this.guides) g.visible = vis;
      if (!vis) return;
      const b = car.body, wb = car.spec.wb, W = car.spec.W / 2, dir = car.gear;
      const kappa = Math.tan(car.steerAngle) / wb;
      for (let side = 0; side < 3; side++) {
        const off = side === 2 ? 0 : (side === 0 ? -W : W);
        const arr = this.guides[side].geometry.attributes.position.array;
        // integrate the rear axle along the arc
        let x = b.x - b.c * wb / 2, y = b.y - b.s * wb / 2, a = b.a;
        const startL = dir > 0 ? car.spec.L / 2 + wb / 2 : 0.0;
        for (let i = 0; i < 40; i++) {
          const s = i * 0.16 * dir;
          const ca = Math.cos(a), sa = Math.sin(a);
          const ex = x + ca * (dir > 0 ? startL : -(car.spec.L / 2 - wb / 2)) - sa * off, ey = y + sa * (dir > 0 ? startL : -(car.spec.L / 2 - wb / 2)) + ca * off;
          arr[i * 3] = ex; arr[i * 3 + 1] = 0.2; arr[i * 3 + 2] = -ey;
          x += Math.cos(a) * 0.16 * dir; y += Math.sin(a) * 0.16 * dir; a += kappa * 0.16 * dir;
        }
        this.guides[side].geometry.attributes.position.needsUpdate = true;
        this.guides[side].material.color.set(side === 2 ? (dir > 0 ? 0x7cc7ff : 0xffd34d) : (dir > 0 ? 0x7cc7ff : 0x7cff8a));
        this.guides[side].visible = side !== 2;
      }
    }
    dispose() { for (const g of this.guides) this.scene.remove(g); }
  }

  // split-screen layout: side by side on wide screens, stacked otherwise
  LS.layoutViews = function (n, W, H, pref) {
    if (n === 1) return [{ x: 0, y: 0, w: W, h: H }];
    const side = pref === 'vertical' || (pref !== 'horizontal' && W / H > 1.9);
    if (side) return [{ x: 0, y: 0, w: Math.floor(W / 2), h: H }, { x: Math.floor(W / 2), y: 0, w: W - Math.floor(W / 2), h: H }];
    return [{ x: 0, y: Math.floor(H / 2), w: W, h: H - Math.floor(H / 2) }, { x: 0, y: 0, w: W, h: Math.floor(H / 2) }];
  };
  LS.PlayerView = PlayerView;
})(window.LS);
