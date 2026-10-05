/* Discoveries (era vignettes worth seeking out), postcard views (a light side activity in every era)
   and two era encounters: the Jubilee greased pig (1897) and the scooter sprint (1964). */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const D = (SA.Discoveries = { found: {}, postcards: {}, best: {}, pig: null, sprint: null });

  D.init = function () {
    SA.on('era', () => {
      D.register();
      if (SA.Mission && SA.Mission.complete) D.showMarkers();
      D.despawnPig();
    });
    SA.on('era-rebuilt', () => D.register());
  };
  D.reset = function () {
    D.found = {};
    D.postcards = {};
    D.best = {};
    D.despawnPig();
    D.sprint = null;
  };
  D.serialize = () => ({ f: Object.keys(D.found), p: Object.keys(D.postcards), b: D.best });
  D.deserialize = function (d) {
    D.reset();
    if (!d) return;
    for (const k of d.f || []) D.found[k] = true;
    for (const k of d.p || []) D.postcards[k] = true;
    D.best = d.b || {};
  };

  function eraOk(item) {
    return item.era === 'all' || item.era === SA.Game.era;
  }
  // postcard viewpoints computed from landmarks
  function viewpoints() {
    const L = SA.Landmarks;
    const out = [];
    const ct = L.clockTowerInfo, cf = L.clockFace;
    if (ct) out.push({ id: 'clocktower', x: ct.x + cf.nx * 16, z: ct.z + cf.nz * 16, look: [ct.x, ct.base + 11, ct.z] });
    if (L.westFront) out.push({ id: 'cathedral', x: L.westFront.x + L.westFront.nx * 18, z: L.westFront.z + L.westFront.nz * 18, look: [L.westFront.x - L.westFront.nx * 14, SA.Terrain.height(L.westFront.x, L.westFront.z) + 12, L.westFront.z - L.westFront.nz * 14] });
    if (L.townHallInfo) out.push({ id: 'townhall', x: L.townHallInfo.x + L.townHallInfo.nx * 14, z: L.townHallInfo.z + L.townHallInfo.nz * 14, look: [L.townHallInfo.x - L.townHallInfo.nx * 6, L.townHallInfo.floor + 7, L.townHallInfo.z - L.townHallInfo.nz * 6] });
    if (L.gatewayInfo) out.push({ id: 'gateway', x: L.gatewayInfo.x + 14, z: L.gatewayInfo.z - 10, look: [L.gatewayInfo.x, L.gatewayInfo.base + 7, L.gatewayInfo.z] });
    if (L.cornInfo) out.push({ id: 'corn', x: L.cornInfo.x + L.cornInfo.nx * 6, z: L.cornInfo.z + L.cornInfo.nz * 6, look: [L.cornInfo.door[0], L.cornInfo.floor + 4, L.cornInfo.door[1]] });
    return out;
  }

  D.register = function () {
    SA.Interact.clear('d-');
    const e = SA.Game.era;
    for (const it of SA.STORY.discoveries) {
      if (!eraOk(it)) continue;
      const key = it.id + ':' + e;
      const s = SA.World.findSafe(e, it.x, it.z, { r: 0.4 });
      SA.Interact.add({
        id: 'd-' + it.id, x: s.x, z: s.z, r: it.r || 3, era: e, label: 'Look: ' + it.title, inVehicle: false,
        enabled: () => SA.Mission && (SA.Mission.complete || !D.found[key]),
        action: () => D.discover(it, key),
      });
    }
    for (const vp of viewpoints()) {
      const s = SA.World.findSafe(e, vp.x, vp.z, { r: 0.4 });
      vp.x = s.x;
      vp.z = s.z;
      const key = vp.id + ':' + e;
      SA.Interact.add({
        id: 'd-pc-' + vp.id, x: vp.x, z: vp.z, r: 2.5, era: e, label: 'Take a postcard photo: ' + SA.STORY.postcards[vp.id],
        enabled: () => SA.Mission && SA.Mission.complete,
        action: () => D.photo(vp, key),
      });
    }
    D._vps = viewpoints();
    // free-roam wardrobe at the Clock Tower door: swap between the outfits Robin has collected
    const ct = SA.Landmarks.clockTowerInfo, cf = SA.Landmarks.clockFace;
    if (ct && cf) {
      const wx = ct.x + cf.nx * (ct.hv + 1.4), wz = ct.z + cf.nz * (ct.hv + 1.4);
      const order = ['modern', 'mod1964', 'victorian'];
      const next = () => order[(order.indexOf(SA.Player.outfit) + 1) % order.length];
      SA.Interact.add({
        id: 'd-wardrobe', x: wx, z: wz, r: 2.2, era: 'all',
        label: () => 'Change clothes: ' + SA.OUTFITS[next()].label,
        enabled: () => SA.Mission && SA.Mission.complete,
        action: () => {
          SA.Player.setOutfit(next());
          SA.Audio && SA.Audio.sfx('door');
          SA.HUD.toast('Now wearing: ' + SA.OUTFITS[SA.Player.outfit].label + (SA.Player.outOfPlace(SA.Game.era) ? ' (out of place in ' + SA.Game.era + ')' : ' (fits in here)'));
          SA.Game.save(true);
        },
      });
    }
    // 1897 encounter: the Jubilee pig (after the mission, to avoid clutter)
    if (e === 1897 && SA.Mission && SA.Mission.complete) {
      const th = SA.Landmarks.townHallInfo;
      SA.Interact.add({ id: 'd-pigman', x: th.x + th.nx * 12 - th.nz * 10, z: th.z + th.nz * 12 + th.nx * 10, r: 3, era: 1897, label: 'Enter the greased-pig contest', enabled: () => !D.pig, action: () => D.startPig() });
    }
    if (e === 1964 && SA.Mission && SA.Mission.complete) {
      const ct = SA.Landmarks.clockTowerInfo, cf = SA.Landmarks.clockFace;
      SA.Interact.add({ id: 'd-sprint', x: ct.x + cf.nx * 10 + 4, z: ct.z + cf.nz * 10, r: 3, era: 1964, label: 'Scooter sprint (on a scooter)', inVehicle: true, enabled: () => !D.sprint && SA.Player.vehicle && SA.Player.vehicle.def.id === 'scooter', action: () => D.startSprint() });
    }
  };
  D.showMarkers = function () {
    const e = SA.Game.era;
    const mk = [];
    for (const it of SA.STORY.discoveries) {
      if (!eraOk(it)) continue;
      mk.push({ x: it.x, z: it.z, era: e, letter: D.found[it.id + ':' + e] ? '✔' : '?', kind: 'discovery', color: '#9fd3c7' });
    }
    for (const vp of D._vps || viewpoints()) mk.push({ x: vp.x, z: vp.z, era: e, letter: D.postcards[vp.id + ':' + e] ? '✔' : '✉', kind: 'postcard', color: '#f2c94c' });
    SA.HUD.setMarkers(mk);
  };
  D.discover = function (it, key) {
    const e = SA.Game.era;
    const txt = typeof it.text === 'string' ? it.text : it.text[e];
    const first = !D.found[key];
    D.found[key] = true;
    if (first) SA.Audio && SA.Audio.sfx('chime');
    SA.Dialogue.say([{ who: it.title, text: txt }]);
    if (first) SA.HUD.toast('Discovery: ' + it.title + ' (' + e + ')');
    if (SA.Mission && SA.Mission.complete) D.showMarkers();
    SA.Game.save(true);
  };
  D.photo = function (vp, key) {
    // frame the landmark with a quick camera move, flash, and file the postcard
    const cam = SA.Game.cam;
    cam.override = { pos: new THREE.Vector3(vp.x, SA.Terrain.height(vp.x, vp.z) + 1.7, vp.z), look: new THREE.Vector3(vp.look[0], vp.look[1], vp.look[2]), speed: 6 };
    SA.Game.inputLocked = true;
    setTimeout(() => {
      const fl = document.getElementById('flash');
      fl.style.transition = 'none';
      fl.style.opacity = '0.85';
      requestAnimationFrame(() => {
        fl.style.transition = 'opacity 0.6s';
        fl.style.opacity = '0';
      });
      SA.Audio && SA.Audio.sfx('tick');
      const first = !D.postcards[key];
      D.postcards[key] = true;
      const n = Object.keys(D.postcards).length;
      SA.HUD.toast((first ? 'Postcard filed: ' : 'Another view of ') + SA.STORY.postcards[vp.id] + ', ' + SA.Game.era + ' (' + n + '/15)');
      setTimeout(() => {
        cam.override = null;
        SA.Game.inputLocked = false;
        D.showMarkers();
        SA.Game.save(true);
      }, 900);
    }, 1100);
  };
  D.journal = function () {
    const out = [];
    for (const it of SA.STORY.discoveries) {
      const eras = it.era === 'all' ? [1897, 1964, 2026] : [it.era];
      for (const e of eras) {
        const key = it.id + ':' + e;
        out.push({ found: !!D.found[key], title: it.title, eraLabel: e, text: typeof it.text === 'string' ? it.text : it.text[e] });
      }
    }
    return out;
  };
  D.postcardJournal = function () {
    const ids = Object.keys(SA.STORY.postcards);
    let h = '<h3>Postcards (' + Object.keys(D.postcards).length + '/15)</h3><p>';
    for (const id of ids) {
      h += '<b>' + SA.STORY.postcards[id] + ':</b> ' + [1897, 1964, 2026].map((e) => (D.postcards[id + ':' + e] ? e + ' ✔' : e + ' ·')).join('  ') + '<br>';
    }
    h += '</p>';
    if (D.best.pig) h += '<p>Jubilee pig caught in ' + D.best.pig.toFixed(1) + ' s.</p>';
    if (D.best.sprint) h += '<p>Best scooter sprint: ' + D.best.sprint.toFixed(1) + ' s.</p>';
    return h;
  };

  // ---------------------------------------------------------------- 1897: the greased pig (comic chaos)
  D.startPig = function () {
    const th = SA.Landmarks.townHallInfo;
    const geo = SA.Props.merge([
      SA.Props.part(new THREE.SphereGeometry(0.42, 10, 8).scale(1, 0.85, 1.5), '#e7b8a8', 0, 0.48, 0),
      SA.Props.part(new THREE.SphereGeometry(0.24, 8, 6), '#e7b8a8', 0, 0.58, 0.62),
      SA.Props.part(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 8), '#d4968a', 0, 0.56, 0.86, Math.PI / 2),
      ...[[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]].map(([x, z]) => SA.Props.part(new THREE.CylinderGeometry(0.06, 0.05, 0.3, 6), '#d4968a', x, 0.15, z)),
    ]);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    SA.Game.scene().add(mesh);
    const s = SA.World.findSafe(1897, th.x + th.nx * 14, th.z + th.nz * 14, { r: 0.6 });
    D.pig = { mesh, x: s.x, z: s.z, yaw: 0, t: 0, flee: 0 };
    SA.Dialogue.say([['narrator', 'A greased pig is let loose for the Jubilee games. Catch it with your bare hands. The crowd is thrilled; the pig is not.']]);
    SA.Interact.add({ id: 'd-pig', x: () => D.pig && D.pig.x, z: () => D.pig && D.pig.z, r: 1.2, era: 1897, label: 'Grab the pig!', enabled: () => !!D.pig, action: () => D.grabPig() });
  };
  D.grabPig = function () {
    const p = D.pig;
    if (!p) return;
    if (Math.random() < 0.45) {
      SA.Dialogue.bark('Robin', ['It squirmed out of my hands!', 'Greased. Very greased.', 'Come back, you magnificent bacon!'][Math.floor(Math.random() * 3)]);
      p.flee = 2.5;
      SA.Game.cam.shake = 0.15;
      return;
    }
    const t = p.t;
    D.best.pig = D.best.pig ? Math.min(D.best.pig, t) : t;
    SA.Audio && SA.Audio.sfx('cheer');
    SA.Dialogue.say([['narrator', 'You caught the Jubilee pig in ' + t.toFixed(1) + ' seconds. Your coat will never recover. The crowd cheers anyway.']]);
    D.despawnPig();
    SA.Game.save(true);
  };
  D.despawnPig = function () {
    if (D.pig) {
      SA.Game.scene().remove(D.pig.mesh);
      D.pig = null;
      SA.Interact.remove('d-pig');
    }
  };
  // ---------------------------------------------------------------- 1964: scooter sprint (checkpoint time trial)
  D.startSprint = function () {
    const ct = SA.Landmarks.clockTowerInfo, th = SA.Landmarks.townHallInfo;
    D.sprint = { t: 0, i: 0, pts: [{ x: th.x + th.nx * 10, z: th.z + th.nz * 10 }, { x: -150, z: -22 }, { x: ct.x + 4, z: ct.z + 10 }] };
    SA.Dialogue.say([['terry', "Right: Town Hall, down to the bottom of George Street, and back to the Tower. Mods' honour. Go!"]]);
  };

  D.update = function (dt) {
    const pig = D.pig;
    if (pig) {
      pig.t += dt;
      const p = SA.Player.ch;
      const dx = pig.x - p.x, dz = pig.z - p.z, d = Math.hypot(dx, dz) || 1;
      let vx = 0, vz = 0;
      const sp = pig.flee > 0 ? 6.2 : d < 7 ? 5.0 : 1.2;
      pig.flee = Math.max(0, pig.flee - dt);
      if (d < 9 || pig.flee > 0) {
        // flee with a jink
        const j = Math.sin(pig.t * 3) * 0.8;
        vx = (dx / d) * Math.cos(j) - (dz / d) * Math.sin(j);
        vz = (dz / d) * Math.cos(j) + (dx / d) * Math.sin(j);
      } else {
        vx = Math.sin(pig.t * 0.7);
        vz = Math.cos(pig.t * 0.5);
      }
      const col = SA.World.current.col;
      const r = col.resolve(pig.x + vx * sp * dt, pig.z + vz * sp * dt, 0.45, 'walk');
      if (SA.World.inDistrict(r.x, r.z)) {
        pig.x = r.x;
        pig.z = r.z;
      }
      pig.yaw = U.dampAngle(pig.yaw, Math.atan2(vx, vz), 8, dt);
      pig.mesh.position.set(pig.x, SA.Terrain.height(pig.x, pig.z) + Math.abs(Math.sin(pig.t * 14)) * 0.05, pig.z);
      pig.mesh.rotation.y = pig.yaw;
      if (pig.t > 90) {
        SA.Dialogue.say([['narrator', 'The pig escapes into Gentle\'s Yard and is never seen again. Possibly it became a mayor.']]);
        D.despawnPig();
      }
    }
    const sp = D.sprint;
    if (sp) {
      sp.t += dt;
      const c = sp.pts[sp.i];
      SA.HUD.objMarker = { x: c.x, z: c.z, era: 1964, letter: String(sp.i + 1), label: 'Checkpoint' };
      const pp = SA.Player.pos();
      if (U.dist(pp.x, pp.z, c.x, c.z) < 7) {
        sp.i++;
        SA.Audio && SA.Audio.sfx('chime');
        if (sp.i >= sp.pts.length) {
          D.best.sprint = D.best.sprint ? Math.min(D.best.sprint, sp.t) : sp.t;
          SA.Dialogue.say([['terry', 'Sprint done in ' + sp.t.toFixed(1) + ' seconds! ' + (sp.t < 60 ? 'Ace. Proper ace.' : 'My nan does it faster. On foot.')]]);
          D.sprint = null;
          SA.HUD.objMarker = null;
          SA.Game.save(true);
        }
      }
      if (!SA.Player.vehicle || sp.t > 240) {
        D.sprint = null;
        SA.HUD.objMarker = null;
        SA.HUD.toast('Sprint abandoned.');
      }
    }
  };
})();
