/* Opening mission "Wind the Key": a checkpointed stage machine.
   2026 prologue -> first wind -> 1964 (Edie, scooter errand, clothes) -> 1897 (Jubilee night, suspects,
   cart chase on Edie's bicycle, City Police, the choice) -> 2026 (the changed present). */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const M = (SA.Mission = { stage: null, data: {}, log: [], rules: [], npcs: {}, token: 0, title: 'Wind the Key', complete: false });
  const S = () => SA.STORY;
  const G = () => SA.Game;

  // ---------------------------------------------------------------- helpers
  function say(lines, opts) {
    return SA.Dialogue.say(lines, opts);
  }
  function obj(text, marker) {
    SA.HUD.setObjective(M.complete ? 'Free roam' : M.title, text, marker);
  }
  function note(t) {
    if (M.log[M.log.length - 1] !== t) M.log.push(t);
  }
  function spot(x, z, era) {
    return SA.World.findSafe(era || G().era, x, z, { r: 0.45 });
  }
  function alive(tok) {
    return tok === M.token;
  }
  M.learnRule = function (id) {
    const r = S().rules.find((x) => x.id === id);
    if (r && !M.rules.find((x) => x.id === id)) {
      M.rules.push(r);
      SA.HUD.toast('Key rule learned: ' + r.title + '. ' + r.text, 6);
    }
  };
  M.rulesLearned = () => M.rules.slice();
  M.journal = () => M.log.slice();

  // story characters
  const LOOKS = {
    edieOld: { skin: '#f1d0b5', top: '#5a4a6b', legs: '#3a3a40', hair: '#e8e4dc', hat: 'bun', hatColor: '#e8e4dc', skirt: 1, skirtColor: '#3a3448', build: 0.92, height: 0.93, shoes: '#2a2a2a', fem: true },
    terry: { skin: '#e9bf9b', top: '#4b5320', legs: '#3a3a40', hair: '#2a1d14', hat: 'none', build: 0.96, height: 1.0, shoes: '#3a2a1a' },
    abbott: { skin: '#f1c9a5', top: '#c9a3a3', legs: '#3a3a3a', hair: '#9a9590', hat: 'headscarf', hatColor: '#7aa6b8', skirt: 1, skirtColor: '#5a4a3a', build: 1.1, height: 0.95, fem: true },
    josiah: { skin: '#e9bf9b', top: '#3a3028', legs: '#2c2620', hair: '#9a948a', hat: 'flatcap', hatColor: '#3a3028', build: 1.02, height: 1.0, shoes: '#1a1a1a', sleeves: '#e8e2d2' },
    edieYoung: { skin: '#f3d2b4', top: '#f0ebdf', legs: '#2b2b38', hair: '#5a3a22', hat: 'boater', hatColor: '#e8d9a8', skirt: 1, skirtColor: '#2b2b38', build: 0.92, height: 0.96, fem: true },
    crabbe: { skin: '#f0c8a8', top: '#d9cfb0', legs: '#c9bea0', hair: '#7a3b21', hat: 'bowler', hatColor: '#2a2420', build: 1.12, height: 1.0, shoes: '#1a1a1a' },
    auctioneer: { skin: '#e9bf9b', top: '#cfc4a6', legs: '#bfb496', hair: '#4a3222', hat: 'tophat', hatColor: '#151515', build: 1.05, height: 1.03 },
    reveller: { skin: '#f3d2b4', top: '#d6ccae', legs: '#c4b898', hair: '#b89060', hat: 'boater', hatColor: '#e8d9a8', build: 1.0, height: 0.99 },
    mayor: { skin: '#f0c8a8', top: '#5a1f24', legs: '#1d1d22', hair: '#a8a39b', hat: 'tophat', hatColor: '#151515', build: 1.18, height: 1.0 },
    cook: { skin: '#f1c9a5', top: '#f2efe4', legs: '#3a3a3a', hair: '#7a5a3a', hat: 'bonnet', hatColor: '#f2efe4', skirt: 2, skirtColor: '#3a3a3a', build: 1.12, height: 0.95, fem: true },
    priya: { skin: '#a8714d', top: '#1d3c6e', legs: '#2b2b2b', hair: '#1a1a1a', hat: 'bun', hatColor: '#1a1a1a', build: 0.95, height: 0.97, fem: true, shoes: '#f2f2f2' },
    dot: { skin: '#f1c9a5', top: '#c8102e', legs: '#2b3f63', hair: '#b7b2aa', hat: 'none', build: 1.08, height: 0.94, fem: true, shoes: '#f2f2f2' },
    clerk: { skin: '#5c3a26', top: '#20232a', legs: '#2b3f63', hair: '#1a1a1a', hat: 'cap', hatColor: '#111', build: 1.0, height: 1.0, shoes: '#f2f2f2' },
    constable: { skin: '#e9bf9b', top: '#141a2c', legs: '#141a2c', hair: '#2a1d14', hat: 'helmet', hatColor: '#10141f', build: 1.08, height: 1.03 },
  };
  M.npc = function (id, era, lookId, x, z, yaw, opts) {
    M.removeNpc(id);
    const s = spot(x, z, era);
    const ch = new SA.Character({ era, role: 'story', look: Object.assign({}, LOOKS[lookId || id]) });
    ch.x = s.x;
    ch.z = s.z;
    ch.y = SA.Terrain.height(s.x, s.z);
    ch.groundY = ch.y;
    ch.yaw = yaw || 0;
    if (opts && opts.prop) ch.prop = opts.prop;
    SA.Game.pool.add(ch);
    M.npcs[id] = { ch, era, id, walkTo: null };
    return M.npcs[id];
  };
  M.removeNpc = function (id) {
    const n = M.npcs[id];
    if (n) {
      SA.Game.pool.remove(n.ch);
      delete M.npcs[id];
    }
  };
  M.clearNpcs = function () {
    for (const id in M.npcs) M.removeNpc(id);
  };
  function faceTo(ch, x, z) {
    ch.yaw = Math.atan2(x - ch.x, z - ch.z);
  }

  // ---------------------------------------------------------------- positions
  function townHall() {
    return SA.Landmarks.townHallInfo;
  }
  function tower() {
    const ct = SA.Landmarks.clockTowerInfo, cf = SA.Landmarks.clockFace;
    return { x: ct.x + cf.nx * 6, z: ct.z + cf.nz * 6, nx: cf.nx, nz: cf.nz, cx: ct.x, cz: ct.z };
  }
  M.startPos = function () {
    const th = townHall();
    const x = th.x + th.nx * 9, z = th.z + th.nz * 9;
    const s = spot(x, z, 2026);
    const yaw = Math.atan2(-th.nx, -th.nz); // facing the portico
    return { x: s.x, z: s.z, yaw };
  };
  function stallPos() {
    // a market pitch on the St Peter's Street pedestrian strip ~45 m north of the Town Hall
    const th = townHall();
    let best = null, bd = Infinity;
    for (const r of SA.World.roads) {
      if (r.n !== "St Peter's Street" || r.t !== 'pedestrian') continue;
      for (const p of r.p) {
        const d = Math.abs(U.dist(p[0], p[1], th.x, th.z) - 45);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    }
    return best ? { x: best[0], z: best[1] } : { x: th.x + th.nx * 40, z: th.z + th.nz * 40 };
  }

  // ---------------------------------------------------------------- stages
  const ST = {};
  M.goto = function (id, opts) {
    const prev = M.stage;
    if (prev && ST[prev] && ST[prev].exit) ST[prev].exit();
    M.stage = id;
    M.token++;
    M.data.stageT = 0;
    SA.Interact.clear('m-');
    SA.HUD.setMarkers([]);
    const st = ST[id];
    if (st && st.enter) st.enter(M.token, opts || {});
    if (!(opts && opts.nosave) && st && st.checkpoint !== false && G().state === 'play') G().save(true);
    SA.emit('mission-stage', id);
  };

  // --- 2026 prologue
  ST.p0 = {
    era: 2026,
    enter(tok) {
      SA.TimeKey.owned = false;
      obj(S().obj.toSolicitor, M.solicitorMarker());
      note('Robin arrived in St Albans to collect a parcel left by great-great-grandmother Edie in 1971.');
      SA.HUD.hint('move');
      setTimeout(() => alive(tok) && SA.HUD.hint('look'), 7000);
      setTimeout(() => {
        if (!alive(tok)) return;
        say(S().phone1).then(() => alive(tok) && SA.HUD.hint('map'));
      }, 1600);
      M.data.towerSeen = false;
    },
    update(dt, tok) {
      // camera lesson: notice the Clock Tower above the rooftops
      if (!M.data.towerSeen) {
        const cam = G().camera();
        const ct = SA.Landmarks.clockTowerInfo;
        const v = new THREE.Vector3(ct.x, ct.base + 14, ct.z).project(cam);
        const d = U.dist(cam.position.x, cam.position.z, ct.x, ct.z);
        if (v.z < 1 && Math.abs(v.x) < 0.5 && Math.abs(v.y) < 0.6 && d < 220 && SA.World.current.col.lineOfSight(cam.position.x, cam.position.z, ct.x, ct.z)) {
          M.data.towerSeen = true;
          if (!SA.Dialogue.busy()) say(S().towerSeen);
        }
      }
      const door = M.solicitorDoor();
      if (door && U.dist(SA.Player.ch.x, SA.Player.ch.z, door.x, door.z) < 14) M.goto('p1', { nosave: true });
    },
  };
  M.solicitorDoor = () => SA.World.roleDoor(2026, 'solicitors', 'High Street');
  M.solicitorMarker = function () {
    const d = M.solicitorDoor();
    return d ? { x: d.x, z: d.z, era: 2026, letter: 'S', label: 'Lattimore & Hale' } : null;
  };
  ST.p1 = {
    era: 2026,
    checkpoint: false,
    enter(tok) {
      obj(S().obj.enterSolicitor, M.solicitorMarker());
      const d = M.solicitorDoor();
      SA.HUD.hint('interact');
      SA.Interact.add({
        id: 'm-sol', x: d.x, z: d.z, r: 2.6, era: 2026, label: 'Go into Lattimore & Hale',
        action: async () => {
          SA.Interact.remove('m-sol');
          SA.Game.inputLocked = true;
          const t = M.token;
          await say(S().solicitor, { lock: true });
          if (!alive(t)) return;
          SA.Player.give('parcel');
          SA.Player.give('letter');
          SA.Player.give('key');
          SA.Audio && SA.Audio.sfx('chime');
          SA.HUD.toast(S().ui.gotItem(S().items.parcel), 3);
          SA.Menus.showLetter(() => {
            if (!alive(t)) return;
            SA.Game.inputLocked = false;
            SA.TimeKey.owned = true;
            SA.TimeKey.allowed = [1964];
            SA.TimeKey.suggested = 1964;
            note("Edie's letter: stand by the Clock Tower, turn the key back and listen for Gabriel.");
            M.goto('p2');
          });
        },
      });
    },
    update() {},
  };
  ST.p2 = {
    era: 2026,
    enter(tok) {
      const t = tower();
      SA.TimeKey.owned = true;
      SA.TimeKey.allowed = [1964];
      SA.TimeKey.suggested = 1964;
      SA.TimeKey.locked = true;
      obj(S().obj.toTower, { x: t.x, z: t.z, era: 2026, letter: 'T', label: 'Clock Tower' });
      M.data.atTower = false;
      // the van that will be parked exactly where Robin lands (demonstrates the slip rule)
      SA.TimeKey.beforeArrive = (target, x, z) => {
        if (target !== 1964) return;
        const v = SA.Vehicles.create('van60', x, z, Math.atan2(-t.nz, -t.nx) + Math.PI / 2, { era: 1964, parked: true, color: '#e8e2cf' });
        v.label = "Crowther's bread van";
        SA.TimeKey.beforeArrive = null;
      };
    },
    update(dt, tok) {
      const t = tower();
      const p = SA.Player.ch;
      if (!M.data.atTower && U.dist(p.x, p.z, t.cx, t.cz) < 13) {
        M.data.atTower = true;
        SA.TimeKey.locked = false;
        obj(S().obj.windBack1964, { x: t.x, z: t.z, era: 2026, letter: 'T' });
        say(S().atTower);
        SA.HUD.hint('wind');
      }
    },
  };
  // --- 1964
  M.edieDoor = () => SA.World.roleDoor(1964, 'pennick', 'French Row');
  ST.a1 = {
    era: 1964,
    enter(tok) {
      const d = M.edieDoor();
      M.npc('edieOld', 1964, 'edieOld', d.x + d.nx * 0.8, d.z + d.nz * 0.8, Math.atan2(d.nx, d.nz));
      obj(S().obj.findEdie, { x: d.x, z: d.z, era: 1964, letter: 'E', label: "Edie's shop" });
      note('Wound back to Saturday 10 October 1964. A bread van was parked where Robin landed: the key slipped Robin sideways.');
      M.learnRule('slip');
      SA.Interact.add({
        id: 'm-edie', x: () => M.npcs.edieOld.ch.x, z: () => M.npcs.edieOld.ch.z, r: 2.6, era: 1964, label: 'Talk to Edie',
        action: async () => {
          SA.Interact.remove('m-edie');
          const t = M.token;
          faceTo(M.npcs.edieOld.ch, SA.Player.ch.x, SA.Player.ch.z);
          await say(S().edieMeet, { lock: true });
          for (const r of S().rules) {
            if (!alive(t)) return;
            await say([r.line], { lock: true });
            M.learnRule(r.id);
          }
          if (!alive(t)) return;
          await say(S().edieErrand, { lock: true });
          if (!alive(t)) return;
          SA.Player.give('halfcrown');
          SA.HUD.toast(S().ui.gotItem(S().items.halfcrown));
          note('Old Edie described the thief: pale check suit, red carnation, carpet bag, smell of violets. She explained the rules of the key.');
          M.goto('a2');
        },
      });
      if (!SA.Dialogue.busy()) setTimeout(() => alive(tok) && say(S().arrive1964), 2200);
    },
    update() {
      const e = M.npcs.edieOld;
      if (e) e.ch.anim = 'idle';
    },
  };
  M.espressoDoor = () => SA.World.roleDoor(1964, 'espresso', 'Market Place');
  ST.a2 = {
    era: 1964,
    enter(tok) {
      const d = M.espressoDoor() || M.edieDoor();
      if (!M.npcs.edieOld) {
        const ed = M.edieDoor();
        M.npc('edieOld', 1964, 'edieOld', ed.x + ed.nx * 0.8, ed.z + ed.nz * 0.8, Math.atan2(ed.nx, ed.nz));
      }
      const sx = d.x + d.nx * 2.2, sz = d.z + d.nz * 2.2;
      const s = SA.World.findSafe(1964, sx, sz, { r: 1.0 });
      let v = SA.Vehicles.list.find((x) => x.mission === 'terry');
      if (!v) {
        v = SA.Vehicles.create('scooter', s.x, s.z, Math.atan2(-d.nz, -d.nx), { era: 1964, parked: true, color: '#9fd3c7', mission: 'terry' });
        v.label = "Terry's scooter";
      }
      M.data.scooter = v;
      M.npc('terry', 1964, 'terry', s.x + d.nx * 1.5 + 1.2, s.z + d.nz * 1.5, Math.atan2(-d.nx, -d.nz), { prop: 'coffee' });
      obj(S().obj.getScooter, { x: s.x, z: s.z, era: 1964, letter: 'S', label: "Terry's scooter" });
      M.data.terrySaid = false;
    },
    update(dt, tok) {
      const v = M.data.scooter;
      if (!v) return;
      if (SA.Player.vehicle === v) {
        if (!M.data.terrySaid) {
          M.data.terrySaid = true;
          say(S().terry);
          SA.HUD.hint('vehicle');
        }
        M.goto('a3', { nosave: true });
      }
    },
  };
  ST.a3 = {
    era: 1964,
    enter(tok) {
      const sp = stallPos();
      const s = SA.World.findSafe(1964, sp.x, sp.z, { r: 1.2 });
      M.data.stall = s;
      M.npc('abbott', 1964, 'abbott', s.x, s.z, 0);
      obj(S().obj.rideToStall, { x: s.x, z: s.z, era: 1964, letter: 'J', label: 'Jumble stall' });
      SA.Interact.add({
        id: 'm-abbott', x: () => M.npcs.abbott.ch.x, z: () => M.npcs.abbott.ch.z, r: 3.0, era: 1964, label: 'Buy the coat and cap (2s 6d)', inVehicle: true,
        action: async () => {
          SA.Interact.remove('m-abbott');
          const t = M.token;
          faceTo(M.npcs.abbott.ch, SA.Player.pos().x, SA.Player.pos().z);
          await say(S().abbott, { lock: true });
          if (!alive(t)) return;
          SA.Player.take('halfcrown');
          SA.Player.give('coat');
          SA.Audio && SA.Audio.sfx('coin');
          SA.HUD.toast(S().ui.gotItem(S().items.coat));
          note("Bought an 1890s coat and cap from Mrs Abbott's jumble stall.");
          M.goto('a4');
        },
      });
    },
    update() {
      const a = M.npcs.abbott;
      if (a) {
        const p = SA.Player.pos();
        if (U.dist(a.ch.x, a.ch.z, p.x, p.z) < 12) faceTo(a.ch, p.x, p.z);
      }
    },
  };
  ST.a4 = {
    era: 1964,
    enter(tok) {
      const d = M.edieDoor();
      if (!M.npcs.edieOld) M.npc('edieOld', 1964, 'edieOld', d.x + d.nx * 0.8, d.z + d.nz * 0.8, Math.atan2(d.nx, d.nz));
      if (!M.npcs.abbott && M.data.stall) M.npc('abbott', 1964, 'abbott', M.data.stall.x, M.data.stall.z, 0);
      obj(S().obj.backToEdie, { x: d.x, z: d.z, era: 1964, letter: 'E', label: "Edie's shop" });
      SA.Interact.add({
        id: 'm-change', x: () => M.npcs.edieOld.ch.x, z: () => M.npcs.edieOld.ch.z, r: 2.8, era: 1964, label: "Change behind Edie's screen",
        action: async () => {
          SA.Interact.remove('m-change');
          const t = M.token;
          await say(S().edieChange, { lock: true });
          if (!alive(t)) return;
          // a quick fade for the change of clothes
          const fl = document.getElementById('flash');
          fl.style.transition = 'opacity 0.3s';
          fl.style.background = '#000';
          fl.style.opacity = '1';
          await new Promise((r) => setTimeout(r, 450));
          SA.Player.setOutfit('victorian');
          SA.Player.take('coat');
          fl.style.opacity = '0';
          setTimeout(() => (fl.style.background = ''), 500);
          await say(S().edieSendoff, { lock: true });
          if (!alive(t)) return;
          note('Changed into the 1890s coat. Edie: "Don\'t tell young me who you are."');
          SA.TimeKey.allowed = [1897];
          SA.TimeKey.suggested = 1897;
          M.goto('a5');
        },
      });
      // return the scooter to Terry (optional nicety)
      const v = M.data.scooter;
      if (v && !M.npcs.terry) {
        const ed = M.espressoDoor();
        if (ed) M.npc('terry', 1964, 'terry', ed.x + ed.nx * 3, ed.z + ed.nz * 3, 0, { prop: 'coffee' });
      }
    },
    update() {},
  };
  ST.a5 = {
    era: 1964,
    enter() {
      obj(S().obj.windBack1897);
      SA.TimeKey.locked = false;
      SA.HUD.hint('wind', true);
    },
    update() {},
  };
  // --- 1897
  ST.b1 = {
    era: 1897,
    enter(tok) {
      const t = tower();
      note('Wound back to Jubilee night, 22 June 1897. Gabriel tolled and the Clock Tower clock stopped at 9.14, the moment Robin arrived.');
      M.npc('josiah', 1897, 'josiah', t.cx + t.nx * 4.5, t.cz + t.nz * 4.5, Math.atan2(t.nx, t.nz));
      M.npc('edieYoung', 1897, 'edieYoung', t.cx + t.nx * 8 + t.nz * 3, t.cz + t.nz * 8 - t.nx * 3, 0);
      // young Edie's bicycle, waiting
      let b = SA.Vehicles.list.find((x) => x.mission === 'ediebike');
      if (!b) {
        const s = SA.World.findSafe(1897, t.cx + t.nx * 9 + t.nz * 4.5, t.cz + t.nz * 9 - t.nx * 4.5, { r: 0.8 });
        b = SA.Vehicles.create('bicycle', s.x, s.z, 0.6, { era: 1897, parked: true, color: '#1d1d1d', mission: 'ediebike' });
        b.label = "Edie's bicycle";
      }
      b.noEnter = true;
      M.data.bike = b;
      obj(S().obj.findThief);
      SA.TimeKey.locked = true;
      setTimeout(async () => {
        if (!alive(tok)) return;
        await say(S().arrive1897);
        if (!alive(tok)) return;
        SA.Audio && SA.Audio.sfx('whistle', t.cx + 60, t.cz - 60, 0.6);
        await say(S().josiahBurst, { lock: true });
        if (!alive(tok)) return;
        SA.Game.setFlag('met_young_edie', true);
        M.goto('b2');
      }, 1200);
    },
    update() {
      const p = SA.Player.ch;
      for (const id of ['josiah', 'edieYoung']) {
        const n = M.npcs[id];
        if (n && U.dist(n.ch.x, n.ch.z, p.x, p.z) < 14) faceTo(n.ch, p.x, p.z);
      }
    },
  };
  // the three gentlemen in check suits near the Jubilee band
  ST.b2 = {
    era: 1897,
    enter(tok) {
      const th = townHall();
      const cx = th.x + th.nx * 22, cz = th.z + th.nz * 22;
      M.data.searchC = { x: cx, z: cz };
      obj(S().obj.findThief, { x: cx, z: cz, era: 1897, kind: 'search', r: 26, label: 'Search the crowd' });
      SA.HUD.setMarkers([{ x: cx, z: cz, era: 1897, kind: 'search', r: 26, letter: '◎' }]);
      const rnd = U.rng(42);
      const place = (id, look, ox, oz, prop) => {
        const n = M.npc(id, 1897, look, cx + ox, cz + oz, rnd() * 6, { prop });
        return n;
      };
      // suspects are positioned along the street so the player meets them one by one
      place('auctioneer', 'auctioneer', -14, 10, 'cane');
      place('reveller', 'reveller', 12, -6, 'flag');
      const cr = place('crabbe', 'crabbe', 4, 22, 'carpetbag');
      cr.ch.look.flower = true;
      const ask = (id) => async () => {
        const t = M.token;
        const n = M.npcs[id];
        faceTo(n.ch, SA.Player.ch.x, SA.Player.ch.z);
        if (id === 'crabbe') {
          SA.Interact.clear('m-sus');
          await say(S().suspects.crabbe, { lock: true });
          if (!alive(t)) return;
          M.goto('b3');
        } else {
          SA.Interact.remove('m-sus-' + id);
          await say(S().suspects[id], { lock: true });
          if (alive(t)) say([['robin', S().wrongSuspectRobin[id === 'auctioneer' ? 0 : 1]]]);
          M.data.wrong = (M.data.wrong || 0) + 1;
        }
      };
      for (const id of ['auctioneer', 'reveller', 'crabbe']) {
        SA.Interact.add({ id: 'm-sus-' + id, x: () => M.npcs[id].ch.x, z: () => M.npcs[id].ch.z, r: 2.4, era: 1897, label: 'Confront the man in the check suit', action: ask(id) });
      }
      // young Edie follows to the search area
      const ey = M.npcs.edieYoung;
      if (ey) ey.walkTo = { x: cx - 8, z: cz + 6 };
    },
    update(dt) {
      // idle suspects drift a little; Crabbe edges away if the player loiters close without confronting
      const cr = M.npcs.crabbe;
      if (cr) {
        cr.ch.anim = 'idle';
        const p = SA.Player.ch;
        const d = U.dist(cr.ch.x, cr.ch.z, p.x, p.z);
        if (d < 6) M.data.near = (M.data.near || 0) + dt;
        if (d < 3.5 && !M.data.sniff) {
          M.data.sniff = true;
          SA.Dialogue.bark('Robin', 'Is that... violets?');
        }
      }
    },
  };
  // the cart chase
  ST.b3 = {
    era: 1897,
    checkpoint: true,
    enter(tok, opts) {
      const th = townHall();
      // Crabbe takes the baker's cart parked on St Peter's Street
      const cr = M.npcs.crabbe || M.npc('crabbe', 1897, 'crabbe', th.x + th.nx * 26, th.z + th.nz * 26, 0, { prop: 'carpetbag' });
      const cs = SA.World.findSafe(1897, cr.ch.x + 6, cr.ch.z, { r: 1.6, avoidRoad: false });
      let cart = SA.Vehicles.create('cart', cs.x, cs.z, Math.atan2(th.nx, th.nz), { era: 1897, driver: 'ai', color: '#7a3b2a', mission: 'crabbecart' });
      cart.label = "Baker's cart";
      cart.noEnter = true;
      M.data.cart = cart;
      M.removeNpc('crabbe');
      // the escape route: along the lane graph towards Romeland and the Abbey Gateway
      const g = SA.World.current.lanes;
      const start = g.nearest(cart.x, cart.z, 40);
      const goal = g.nearest(-215, -5, 60) || g.nearest(SA.Landmarks.gatewayInfo.x, SA.Landmarks.gatewayInfo.z, 80);
      const path = SA.Police.astar(g, start, goal) || [start];
      cart.ai = { update: M.cartDrive, path, i: 0, done: false };
      // Crabbe rides on the cart (visible driver)
      const ch = new SA.Character({ era: 1897, role: 'story', look: Object.assign({}, LOOKS.crabbe) });
      ch.prop = 'carpetbag';
      SA.Game.pool.add(ch);
      cart.rider = ch;
      // the bicycle is unlocked; Edie urges Robin on
      const b = M.data.bike || SA.Vehicles.list.find((x) => x.mission === 'ediebike');
      if (b) {
        b.noEnter = false;
        // bring the bicycle close if it's far away (Edie wheels it over)
        if (U.dist(b.x, b.z, SA.Player.ch.x, SA.Player.ch.z) > 12) {
          const s = SA.World.findSafe(1897, SA.Player.ch.x + 2, SA.Player.ch.z + 1, { r: 0.8 });
          b.x = s.x;
          b.z = s.z;
        }
        M.data.bike = b;
      }
      obj(S().obj.chaseCart);
      say(S().chaseStart).then(() => SA.HUD.hint('vehicle'));
      M.data.lostT = 0;
      M.data.chaseT = 0;
      SA.Police.onCaught = () => {
        M.retry('b3');
        return true;
      };
      // constables spot a curate chasing a gentleman
      setTimeout(() => {
        if (alive(tok) && SA.Police.level < 1) SA.Police.setLevel(1, 'scripted');
      }, 6000);
      SA.HUD.setMarkers([]);
      SA.Interact.add({
        id: 'm-grab', x: () => cart.x, z: () => cart.z, r: 4.2, era: 1897, label: 'Grab the carpet bag', inVehicle: true,
        enabled: () => SA.Player.vehicle && SA.Player.vehicle.def.id === 'bicycle',
        action: () => M.grabBag(),
      });
    },
    update(dt, tok) {
      const cart = M.data.cart;
      if (!cart) return;
      M.data.chaseT += dt;
      const p = SA.Player.pos();
      SA.HUD.objMarker = { x: cart.x, z: cart.z, era: 1897, letter: 'C', label: "Crabbe's cart", h: 3.5 };
      if (!SA.Player.vehicle && M.data.bike && !M.data.bikeHint && U.dist(p.x, p.z, M.data.bike.x, M.data.bike.z) < 6) {
        M.data.bikeHint = true;
        obj(S().obj.chaseCart + ' (get on Edie\'s bicycle)', { x: M.data.bike.x, z: M.data.bike.z, era: 1897, letter: 'B' });
      }
      if (SA.Player.vehicle && SA.Player.vehicle.def.id === 'bicycle' && U.dist(p.x, p.z, cart.x, cart.z) < 9) obj(S().obj.grabBag);
      // escape check
      const d = U.dist(p.x, p.z, cart.x, cart.z);
      if (d > 150) M.data.lostT += dt;
      else M.data.lostT = 0;
      if (M.data.lostT > 14 || M.data.chaseT > 240) {
        SA.HUD.toast("Crabbe got away. Try again: Edie's had a word with the baker.", 5);
        M.retry('b3');
      }
    },
    exit() {
      SA.HUD.objMarker = null;
    },
  };
  M.cartDrive = function (v, dt) {
    const ai = v.ai;
    if (ai.done || !ai.path || ai.i >= ai.path.length) {
      v.throttle = U.clamp(-v.speed, -1, 0);
      v.steerIn = 0;
      ai.done = true;
      return;
    }
    const n = ai.path[ai.i];
    const nx = ai.path[Math.min(ai.i + 1, ai.path.length - 1)];
    // keep left
    const dx0 = nx.x - n.x, dz0 = nx.z - n.z, l0 = Math.hypot(dx0, dz0) || 1;
    const tx = n.x + (dz0 / l0) * 1.6, tz = n.z + (-dx0 / l0) * 1.6;
    const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz);
    if (d < 3.5) {
      ai.i++;
      return;
    }
    const want = Math.atan2(dx, dz);
    const diff = U.wrapAngle(want - v.yaw);
    v.steerIn = U.clamp(diff * 2.4, -1, 1);
    // Crabbe drives hard but slows when the player is right behind (the horse is tiring)
    const p = SA.Player.pos();
    const pd = U.dist(p.x, p.z, v.x, v.z);
    let target = v.def.maxSpeed * (pd < 25 ? 0.85 : 0.75) * (1 - Math.min(0.6, Math.abs(diff)));
    if (M.data.chaseT > 50) target *= 0.8;
    v.throttle = U.clamp((target - v.speed) * 0.7, -1, 1);
    v.handbrake = false;
  };
  M.grabBag = async function () {
    const t = M.token;
    SA.Interact.remove('m-grab');
    SA.Player.give('bag');
    SA.Audio && SA.Audio.sfx('coin');
    SA.HUD.toast(S().ui.gotItem(S().items.bag));
    const cart = M.data.cart;
    if (cart) {
      cart.ai.done = true;
      if (cart.rider) cart.rider.prop = null;
    }
    SA.Police.setLevel(2, 'scripted');
    note('Caught up with Crabbe on Edie\'s bicycle and grabbed the carpet bag. Crabbe cried "Thief!" and the City Police gave chase.');
    await say(S().grabBag);
    if (!alive(t)) return;
    M.goto('b4');
  };
  M.retry = function (stage) {
    // reset the chase: Robin back near the Town Hall, police cleared
    SA.Police.clear();
    SA.Police.cooldown = 3;
    const th = townHall();
    const cart = M.data.cart;
    if (cart) {
      if (cart.rider) SA.Game.pool.remove(cart.rider);
      SA.Vehicles.remove(cart);
      M.data.cart = null;
    }
    if (SA.Player.vehicle) SA.Vehicles.exit(true);
    const s = spot(th.x + th.nx * 18, th.z + th.nz * 18, 1897);
    SA.Player.teleport(s.x, s.z);
    if (stage === 'b4') SA.Player.give('bag');
    else SA.Player.take('bag');
    const b = M.data.bike;
    if (b) {
      const bs = SA.World.findSafe(1897, s.x + 2, s.z + 1, { r: 0.8 });
      b.x = bs.x;
      b.z = bs.z;
      b.speed = 0;
    }
    if (stage === 'b4') {
      M.goto('b4', { retry: true });
      setTimeout(() => SA.Police.setLevel(2, 'scripted'), 3000);
    } else M.goto('b3', { retry: true });
  };
  ST.b4 = {
    era: 1897,
    enter(tok, opts) {
      obj(S().obj.loseCops);
      SA.HUD.hint('wanted');
      if (!opts.retry) setTimeout(() => alive(tok) && say(S().loseThem), 2500);
      SA.Police.onCaught = () => {
        say(S().missionCaught);
        M.retry('b4');
        return true;
      };
      M.data.clearT = 0;
      if (!SA.Police.level && !opts.retry) SA.Police.setLevel(2, 'scripted');
    },
    update(dt) {
      if (!SA.Police.level) {
        M.data.clearT += dt;
        if (M.data.clearT > 1.0) M.goto('b5');
      } else M.data.clearT = 0;
    },
    exit() {
      SA.Police.onCaught = null;
    },
  };
  ST.b5 = {
    era: 1897,
    enter(tok) {
      const t = tower();
      SA.Police.onCaught = null;
      M.removeNpc('edieYoung');
      M.npc('edieYoung', 1897, 'edieYoung', t.cx + t.nx * 5 + t.nz * 2, t.cz + t.nz * 5 - t.nx * 2, Math.atan2(t.nx, t.nz));
      if (!M.npcs.josiah) M.npc('josiah', 1897, 'josiah', t.cx + t.nx * 4.5 - t.nz * 2, t.cz + t.nz * 4.5 + t.nx * 2, 0);
      obj(S().obj.meetEdie, { x: t.x, z: t.z, era: 1897, letter: 'E', label: 'Young Edie' });
      SA.Interact.add({
        id: 'm-edieyoung', x: () => M.npcs.edieYoung.ch.x, z: () => M.npcs.edieYoung.ch.z, r: 2.8, era: 1897, label: 'Show Edie the carpet bag', inVehicle: true,
        action: async () => {
          SA.Interact.remove('m-edieyoung');
          const tt = M.token;
          await say(S().edieBag, { lock: true });
          if (!alive(tt)) return;
          note("The bag held the Fund and Crabbe's note: the Committee had cancelled the poor's Jubilee dinner to pay for a gilded lamp.");
          await SA.Menus.showChoice(S().choice.title, S().choice.body, [{ id: 'ok', label: 'Understood: carry the bag to one of them', hint: S().choice.returned.label + ': ' + S().choice.returned.hint + ' · ' + S().choice.dinner.label + ': ' + S().choice.dinner.hint }]);
          if (!alive(tt)) return;
          M.goto('b6');
        },
      });
    },
    update() {
      const e = M.npcs.edieYoung;
      if (e) faceTo(e.ch, SA.Player.ch.x, SA.Player.ch.z);
    },
  };
  ST.b6 = {
    era: 1897,
    enter(tok) {
      const th = townHall();
      const ci = SA.Landmarks.cornInfo;
      obj(S().obj.choose);
      SA.HUD.setMarkers([
        { x: th.x, z: th.z, era: 1897, letter: 'A', label: S().choice.returned.label, color: '#ffd27a' },
        { x: ci.x, z: ci.z, era: 1897, letter: 'B', label: S().choice.dinner.label, color: '#ffd27a' },
      ]);
      SA.HUD.objMarker = null;
      M.npc('mayor', 1897, 'mayor', th.x - th.nx * 2.5, th.z - th.nz * 2.5, Math.atan2(th.nx, th.nz));
      M.npc('cook', 1897, 'cook', ci.door[0] + ci.nx * 1.0, ci.door[1] + ci.nz * 1.0, Math.atan2(ci.nx, ci.nz));
      SA.Interact.add({ id: 'm-choiceA', x: th.x, z: th.z, r: 4.5, era: 1897, label: 'Give the Jubilee Fund to the Mayor (Town Hall)', inVehicle: true, action: () => M.choose('returned') });
      SA.Interact.add({ id: 'm-choiceB', x: ci.x, z: ci.z, r: 4.5, era: 1897, label: 'Bring the Jubilee Fund to the dinner (Corn Exchange)', inVehicle: true, action: () => M.choose('dinner') });
    },
    update() {},
  };
  M.choose = async function (which) {
    const t = M.token;
    SA.Interact.clear('m-choice');
    SA.HUD.setMarkers([]);
    if (SA.Player.vehicle) SA.Vehicles.exit(true);
    SA.Player.take('bag');
    if (which === 'returned') {
      // Crabbe is led away by a constable
      const th = townHall();
      M.npc('crabbe', 1897, 'crabbe', th.x + th.nx * 5 + th.nz * 3, th.z + th.nz * 5 - th.nx * 3, 0);
      M.npc('constableA', 1897, 'constable', th.x + th.nx * 5 + th.nz * 4, th.z + th.nz * 5 - th.nx * 4, 0);
      await say(S().endReturned, { lock: true });
      SA.Audio && SA.Audio.sfx('cheer');
      if (!alive(t)) return;
      note('Chose the Town Hall: the Fund was returned, Crabbe arrested and Josiah publicly cleared.');
      SA.Flags.set('josiah_cleared', true, { deferRebuild: true });
      SA.Flags.set('crabbe_fate', 'jailed', { deferRebuild: true });
    } else {
      await say(S().endDinner, { lock: true });
      SA.Audio && SA.Audio.sfx('cheer');
      if (!alive(t)) return;
      note('Chose the Corn Exchange: three hundred people had their Jubilee dinner; Josiah stayed under suspicion.');
      SA.Flags.set('josiah_cleared', false, { deferRebuild: true });
      SA.Flags.set('crabbe_fate', 'fled', { deferRebuild: true });
    }
    // apply the consequence to later eras (rebuild 1964 and 2026 with the new history)
    SA.Flags.set('fund_outcome', which);
    if (!alive(t)) return;
    const ey = M.npcs.edieYoung;
    if (ey) {
      const p = SA.Player.ch;
      const s = spot(p.x + 1.5, p.z + 1.0, 1897);
      ey.ch.x = s.x;
      ey.ch.z = s.z;
      faceTo(ey.ch, p.x, p.z);
    }
    await say(S().goodbyeYoung, { lock: true });
    if (!alive(t)) return;
    SA.TimeKey.allowed = [1964, 2026];
    SA.TimeKey.suggested = 2026;
    SA.TimeKey.locked = false;
    M.goto('b7');
  };
  ST.b7 = {
    era: 1897,
    enter() {
      obj(S().obj.windForward);
      SA.HUD.hint('pickEra');
    },
    update() {},
  };
  // --- back to 2026
  M.pennickDoor2026 = () => SA.World.roleDoor(2026, 'pennick', 'French Row');
  ST.c1 = {
    era: 2026,
    enter(tok) {
      M.clearNpcs();
      const d = M.pennickDoor2026();
      const f = SA.Game.flags;
      const who = f.fund_outcome === 'returned' ? 'priya' : f.fund_outcome === 'dinner' ? 'dot' : 'clerk';
      M.npc(who, 2026, who, d.x + d.nx * 0.8, d.z + d.nz * 0.8, Math.atan2(d.nx, d.nz));
      M.data.shopNpc = who;
      obj(S().obj.seeChange, { x: d.x, z: d.z, era: 2026, letter: 'F', label: 'French Row' });
      setTimeout(() => alive(tok) && say(S().arriveHome), 1500);
      M.data.met = false;
    },
    update(dt, tok) {
      const d = M.pennickDoor2026();
      const p = SA.Player.ch;
      if (!M.data.met && U.dist(p.x, p.z, d.x, d.z) < 7) {
        M.data.met = true;
        M.finale(tok);
      }
      const n = M.npcs[M.data.shopNpc];
      if (n && U.dist(n.ch.x, n.ch.z, p.x, p.z) < 10) faceTo(n.ch, p.x, p.z);
    },
  };
  M.finale = async function (tok) {
    const f = SA.Game.flags;
    const who = M.data.shopNpc;
    await say(who === 'priya' ? S().priya : who === 'dot' ? S().dot : S().phoneFixx, { lock: true });
    if (!alive(tok)) return;
    await new Promise((r) => setTimeout(r, 900));
    await say(S().phone2[f.fund_outcome === 'dinner' ? 'dinner' : 'returned']);
    if (!alive(tok)) return;
    M.complete = true;
    note('Back in 2026, history has changed. ' + SA.Flags.summary().choice);
    SA.Game.setFlag('mission1_complete', true);
    const sum = SA.Flags.summary();
    const html = '<p><b>' + sum.choice + '</b></p><ul class="changes">' + sum.changes.map((c) => '<li>' + c + '</li>').join('') + '</ul>' +
      '<p>The change is saved. Wind the key to see it in 1964, or walk to French Row, the ' + (f.fund_outcome === 'dinner' ? 'Corn Exchange' : 'Clock Tower') + ' and the newspaper board by the Museum.</p>' +
      '<p class="fine">Free roam is open: all three years are available. Look for discoveries (?) and postcard views (✉) on the map.</p>';
    SA.Menus.showComplete('Mission complete: Wind the Key', html, () => {
      M.goto('free');
      setTimeout(() => {
        SA.Audio && SA.Audio.gabriel(0.8);
        say(S().teaser);
        SA.Game.setFlag('teaser', true);
      }, 4000);
    });
  };
  ST.free = {
    era: null,
    enter() {
      M.complete = true;
      SA.TimeKey.owned = true;
      SA.TimeKey.allowed = [1897, 1964, 2026];
      SA.TimeKey.locked = false;
      SA.TimeKey.suggested = null;
      obj(S().obj.done);
      SA.Discoveries && SA.Discoveries.showMarkers();
      M.spawnAftermath();
    },
    update() {},
  };
  // story NPCs in free roam reflecting the consequence
  M.spawnAftermath = function () {
    const e = SA.Game.era;
    M.clearNpcs();
    const f = SA.Game.flags;
    if (!f.fund_outcome) return;
    if (e === 2026) {
      const d = M.pennickDoor2026();
      const who = f.fund_outcome === 'returned' ? 'priya' : 'dot';
      M.npc(who, 2026, who, d.x + d.nx * 0.8, d.z + d.nz * 0.8, Math.atan2(d.nx, d.nz));
      SA.Interact.add({ id: 'm-aftermath', x: () => M.npcs[who].ch.x, z: () => M.npcs[who].ch.z, r: 2.6, era: 2026, label: 'Talk to ' + S().names[who], action: () => say(who === 'priya' ? S().priya : S().dot) });
    } else if (e === 1964) {
      const d = M.edieDoor();
      M.npc('edieOld', 1964, 'edieOld', d.x + d.nx * 0.8, d.z + d.nz * 0.8, Math.atan2(d.nx, d.nz));
      const lines = f.fund_outcome === 'returned'
        ? [['edieOld', "Clocks, clocks, clocks. Father's name over the door, and the Mayor's lamp polished every Jubilee. You did that."], ['edieOld', "Mind you, poor Mr Crabbe did six months for being kind. Sit with that, curate."]]
        : [['edieOld', "Still curios. Still Father's name in the mud. And still the best night this town ever had."], ['edieOld', "Three hundred dinners. I kept the menu. It's behind the till, with your name on the back."]];
      SA.Interact.add({ id: 'm-aftermath', x: () => M.npcs.edieOld.ch.x, z: () => M.npcs.edieOld.ch.z, r: 2.6, era: 1964, label: 'Talk to Edie', action: () => say(lines) });
    }
  };

  // ---------------------------------------------------------------- lifecycle
  M.init = function () {
    SA.on('jump', (from, to, first) => M.onJump(from, to, first));
    SA.on('era', () => {
      // hide story NPCs not in this era
      for (const id in M.npcs) M.npcs[id].ch.visible = M.npcs[id].era === SA.Game.era;
    });
  };
  M.reset = function () {
    M.clearNpcs();
    M.stage = null;
    M.data = {};
    M.log = [];
    M.rules = [];
    M.complete = false;
    M.token++;
    SA.Interact.clear('m-');
    SA.Police && (SA.Police.onCaught = null);
  };
  M.begin = function () {
    M.goto('p0');
  };
  M.onJump = function (from, to, first) {
    const st = M.stage;
    if (st === 'p2' && to === 1964) M.goto('a1');
    else if (st === 'a5' && to === 1897) M.goto('b1');
    else if (st === 'b7' && to === 2026) M.goto('c1');
    else if (st === 'b7' && to === 1964) {
      SA.HUD.toast('Edie looks up from her counter and smiles. Then: "2026, curate. Go and see."', 5);
      M.spawnAftermath();
    } else if (st === 'free') M.spawnAftermath();
    else {
      // story NPC visibility per era
      for (const id in M.npcs) M.npcs[id].ch.visible = M.npcs[id].era === to;
    }
  };
  M.update = function (dt) {
    if (!M.stage) return;
    M.data.stageT = (M.data.stageT || 0) + dt;
    const st = ST[M.stage];
    // story NPC simple walking
    for (const id in M.npcs) {
      const n = M.npcs[id];
      n.ch.visible = n.era === SA.Game.era;
      if (n.walkTo) {
        const dx = n.walkTo.x - n.ch.x, dz = n.walkTo.z - n.ch.z, d = Math.hypot(dx, dz);
        if (d < 0.5) {
          n.walkTo = null;
          n.ch.animate(dt, 0);
        } else {
          const sp = 1.4;
          const r = SA.World.current.col.resolve(n.ch.x + (dx / d) * sp * dt, n.ch.z + (dz / d) * sp * dt, 0.3, 'walk');
          n.ch.x = r.x;
          n.ch.z = r.z;
          n.ch.y = SA.Terrain.height(n.ch.x, n.ch.z);
          n.ch.groundY = n.ch.y;
          n.ch.yaw = Math.atan2(dx, dz);
          n.ch.animate(dt, sp);
        }
      } else if (n.ch.anim === 'walk') n.ch.animate(dt, 0);
    }
    if (st && st.update && (!st.era || st.era === SA.Game.era)) st.update(dt, M.token);
    // keep the objective marker pointing at the right era
    if (st && st.era && st.era !== SA.Game.era && SA.HUD.objective) {
      SA.HUD.el('obj-dist').textContent = 'Wind the key to ' + st.era;
    }
  };
  M.serialize = function () {
    return { stage: M.stage, log: M.log, rules: M.rules.map((r) => r.id), complete: M.complete };
  };
  // Restore at the stage checkpoint (stage enter re-creates NPCs and markers)
  M.deserialize = function (d) {
    M.reset();
    if (!d || !d.stage) {
      M.stage = null;
      return;
    }
    M.log = d.log || [];
    M.rules = (d.rules || []).map((id) => S().rules.find((r) => r.id === id)).filter(Boolean);
    M.complete = !!d.complete;
    let stage = d.stage;
    // non-checkpoint stages resume at their checkpoint
    const resume = { p1: 'p0', b2: 'b2', b3: 'b2', b4: 'b2', b6: 'b6' };
    if (stage === 'p1') stage = 'p0';
    if (stage === 'b3' || stage === 'b4') stage = 'b2';
    void resume;
    setTimeout(() => M.goto(stage, { nosave: true, restored: true }), 50);
  };
  M.debugState = () => ({ stage: M.stage, complete: M.complete, npcs: Object.keys(M.npcs) });
  M.debugGoto = (id) => M.goto(id);
})();
