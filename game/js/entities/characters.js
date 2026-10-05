/* Instanced, procedurally animated characters. Every body part type is one InstancedMesh, so the whole
   crowd (player, pedestrians, police) costs a fixed ~16 draw calls. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;

  const MAX = 140;
  const PARTS = {};
  function g(geo, ty) {
    geo.translate(0, ty || 0, 0);
    return geo;
  }
  function defineParts() {
    PARTS.torso = g(new THREE.CylinderGeometry(0.17, 0.2, 0.56, 7), 0);
    PARTS.hips = g(new THREE.CylinderGeometry(0.19, 0.18, 0.2, 7), 0);
    PARTS.head = g(new THREE.SphereGeometry(0.115, 8, 6), 0);
    PARTS.hair = g(new THREE.SphereGeometry(0.122, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55), 0.005);
    PARTS.arm = g(new THREE.CylinderGeometry(0.052, 0.045, 0.62, 6), -0.31); // pivot at shoulder
    PARTS.leg = g(new THREE.CylinderGeometry(0.075, 0.06, 0.86, 6), -0.43); // pivot at hip
    PARTS.shoe = g(new THREE.BoxGeometry(0.1, 0.07, 0.22), 0);
    PARTS.skirt = g(new THREE.CylinderGeometry(0.19, 0.34, 1, 9, 1, true), -0.5); // pivot at waist, scaled to length
    PARTS.hand = g(new THREE.SphereGeometry(0.045, 5, 3), 0);
    // hats (all pivot at head top)
    const bowler = THREE.BufferGeometryUtils.mergeGeometries([new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 0.03, 0), new THREE.CylinderGeometry(0.17, 0.17, 0.015, 12).translate(0, 0.03, 0)].map(strip));
    const top = THREE.BufferGeometryUtils.mergeGeometries([new THREE.CylinderGeometry(0.11, 0.105, 0.2, 10).translate(0, 0.12, 0), new THREE.CylinderGeometry(0.17, 0.17, 0.015, 12).translate(0, 0.025, 0)].map(strip));
    const flatcap = THREE.BufferGeometryUtils.mergeGeometries([new THREE.SphereGeometry(0.13, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(1, 0.55, 1.08).translate(0, 0.0, 0.01), new THREE.BoxGeometry(0.16, 0.012, 0.08).translate(0, 0.0, 0.14)].map(strip));
    const boater = THREE.BufferGeometryUtils.mergeGeometries([new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12).translate(0, 0.05, 0), new THREE.CylinderGeometry(0.19, 0.19, 0.012, 14).translate(0, 0.02, 0)].map(strip));
    const ladyhat = THREE.BufferGeometryUtils.mergeGeometries([new THREE.CylinderGeometry(0.09, 0.11, 0.08, 10).translate(0, 0.06, 0), new THREE.CylinderGeometry(0.24, 0.24, 0.012, 14).translate(0, 0.025, 0), new THREE.SphereGeometry(0.05, 6, 4).translate(0.06, 0.11, 0.02)].map(strip));
    const helmet = THREE.BufferGeometryUtils.mergeGeometries([new THREE.SphereGeometry(0.135, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1, 1.75, 1.05).translate(0, -0.02, 0), new THREE.SphereGeometry(0.03, 6, 4).translate(0, 0.21, 0), new THREE.CylinderGeometry(0.15, 0.15, 0.015, 12).translate(0, -0.03, 0)].map(strip));
    const peaked = THREE.BufferGeometryUtils.mergeGeometries([new THREE.CylinderGeometry(0.14, 0.12, 0.08, 12).translate(0, 0.02, 0), new THREE.BoxGeometry(0.2, 0.012, 0.09).translate(0, -0.01, 0.12)].map(strip));
    const beanie = new THREE.SphereGeometry(0.128, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.15, 1).translate(0, -0.005, 0);
    const scarf = new THREE.SphereGeometry(0.13, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.7).scale(1.02, 1.0, 1.05).translate(0, -0.02, -0.005);
    const beehive = new THREE.SphereGeometry(0.11, 10, 8).scale(1, 1.6, 1).translate(0, 0.08, -0.01);
    const bonnet = new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1.0, 0.9, 1.15).translate(0, -0.01, -0.02);
    const bun = THREE.BufferGeometryUtils.mergeGeometries([new THREE.SphereGeometry(0.06, 6, 5).translate(0, 0.03, -0.09)].map(strip));
    const hood = new THREE.SphereGeometry(0.14, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1.05, 1.0, 1.08).translate(0, -0.03, -0.02);
    PARTS.hat_bowler = bowler;
    PARTS.hat_tophat = top;
    PARTS.hat_flatcap = flatcap;
    PARTS.hat_boater = boater;
    PARTS.hat_ladyhat = ladyhat;
    PARTS.hat_helmet = helmet;
    PARTS.hat_peaked = peaked;
    PARTS.hat_beanie = beanie;
    PARTS.hat_cap = peaked;
    PARTS.hat_headscarf = scarf;
    PARTS.hat_beehive = beehive;
    PARTS.hat_bonnet = bonnet;
    PARTS.hat_bun = bun;
    PARTS.hat_hood = hood;
    PARTS.hat_trilby = boater;
    PARTS.hat_parka = hood;
    PARTS.prop_phone = new THREE.BoxGeometry(0.07, 0.13, 0.015);
    PARTS.prop_bag = new THREE.BoxGeometry(0.28, 0.24, 0.1).translate(0, -0.12, 0);
    PARTS.prop_basket = new THREE.CylinderGeometry(0.16, 0.12, 0.16, 8).translate(0, -0.1, 0);
    PARTS.prop_paper = new THREE.BoxGeometry(0.25, 0.32, 0.02);
    PARTS.prop_coffee = new THREE.CylinderGeometry(0.035, 0.03, 0.12, 8);
    PARTS.prop_flag = THREE.BufferGeometryUtils.mergeGeometries([new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4).translate(0, 0.2, 0), new THREE.BoxGeometry(0.22, 0.14, 0.004).translate(0.11, 0.38, 0)].map(strip));
    PARTS.prop_cane = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4).translate(0, -0.45, 0);
    PARTS.prop_carpetbag = new THREE.BoxGeometry(0.36, 0.28, 0.16).translate(0, -0.16, 0);
    PARTS.prop_key = new THREE.BoxGeometry(0.03, 0.16, 0.03).translate(0, -0.05, 0);
    PARTS.blob = new THREE.CircleGeometry(0.42, 12).rotateX(-Math.PI / 2);
  }
  function strip(geo) {
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    return geo.index ? geo.toNonIndexed() : geo;
  }

  const HAT_TYPES = ['bowler', 'tophat', 'flatcap', 'boater', 'ladyhat', 'helmet', 'peaked', 'beanie', 'cap', 'headscarf', 'beehive', 'bonnet', 'bun', 'hood', 'trilby', 'parka'];
  const PROP_TYPES = ['phone', 'bag', 'basket', 'paper', 'coffee', 'flag', 'cane', 'carpetbag', 'key'];

  // ------------------------------------------------------------------ pool
  function Pool(scene) {
    if (!PARTS.torso) defineParts();
    this.scene = scene;
    this.list = [];
    this.meshes = {};
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mat = mat;
    const mk = (name, geo, count) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      m.name = 'chars-' + name;
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      scene.add(m);
      this.meshes[name] = m;
      return m;
    };
    for (const n of ['torso', 'hips', 'head', 'hair', 'shoe', 'hand', 'skirt']) mk(n, PARTS[n], n === 'shoe' || n === 'hand' ? MAX * 2 : MAX);
    mk('arm', PARTS.arm, MAX * 2);
    mk('leg', PARTS.leg, MAX * 2);
    for (const h of HAT_TYPES) if (!this.meshes['hat_' + h]) mk('hat_' + h, PARTS['hat_' + h], h === 'helmet' || h === 'bowler' || h === 'flatcap' ? MAX : 60);
    for (const p of PROP_TYPES) mk('prop_' + p, PARTS['prop_' + p], 50);
    // blob shadows
    const bm = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.blobs = new THREE.InstancedMesh(PARTS.blob, bm, MAX);
    this.blobs.count = 0;
    this.blobs.frustumCulled = false;
    this.blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.blobs);
    this._m = new THREE.Matrix4();
    this._root = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
    this._c = new THREE.Color();
    this.camPos = new THREE.Vector3();
  }
  Pool.prototype.add = function (ch) {
    this.list.push(ch);
    return ch;
  };
  Pool.prototype.remove = function (ch) {
    const i = this.list.indexOf(ch);
    if (i >= 0) this.list.splice(i, 1);
  };
  Pool.prototype.clear = function (filter) {
    this.list = filter ? this.list.filter((c) => !filter(c)) : [];
  };

  // write one part instance
  Pool.prototype._put = function (name, local, color) {
    const m = this.meshes[name];
    const i = m.count;
    if (i >= m.instanceMatrix.count) return;
    this._m.multiplyMatrices(this._root, local);
    m.setMatrixAt(i, this._m);
    m.setColorAt(i, this._c.set(color));
    m.count = i + 1;
  };
  const L = new THREE.Matrix4();
  const TMP1 = new THREE.Matrix4(), TMP2 = new THREE.Matrix4();
  const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _sc = new THREE.Vector3();
  function local(x, y, z, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    L.compose(_p.set(x, y, z), _q, _sc.set(sx || 1, sy || 1, sz || 1));
    return L;
  }

  Pool.prototype.update = function (dt, camPos) {
    for (const k in this.meshes) this.meshes[k].count = 0;
    this.blobs.count = 0;
    let n = 0;
    for (const ch of this.list) {
      if (!ch.visible || ch.camNear) continue;
      if (camPos && U.dist2(ch.x, ch.z, camPos.x, camPos.z) > 160 * 160) continue;
      this._draw(ch, dt);
      n++;
    }
    for (const k in this.meshes) {
      const m = this.meshes[k];
      m.visible = m.count > 0;
      if (!m.visible) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.blobs.visible = this.blobs.count > 0;
    this.blobs.instanceMatrix.needsUpdate = true;
    return n;
  };

  Pool.prototype._draw = function (ch, dt) {
    const lk = ch.look;
    const h = lk.height || 1;
    // root
    this._q.setFromAxisAngle(this._v.set(0, 1, 0), ch.yaw);
    const bob = ch.anim === 'walk' || ch.anim === 'run' ? Math.abs(Math.sin(ch.phase)) * (ch.anim === 'run' ? 0.06 : 0.03) : 0;
    let lieRoll = 0;
    if (ch.anim === 'down') lieRoll = Math.min(1, ch.downT * 3) * (Math.PI / 2 - 0.15);
    this._root.compose(this._v.set(ch.x, ch.y + bob, ch.z), this._q, this._s.set(h, h, h));
    if (lieRoll) {
      this._root.multiply(TMP1.makeTranslation(0, 0.18 * Math.min(1, ch.downT * 3), 0)).multiply(TMP2.makeRotationX(-lieRoll));
    }
    if (ch.seated) {
      this._root.multiply(TMP1.makeTranslation(0, ch.seatY || 0, 0));
    }
    const w = lk.build || 1;
    const sw = ch.anim === 'run' ? 0.85 : ch.anim === 'walk' ? 0.5 : 0;
    const p = ch.phase;
    let legA = Math.sin(p) * sw, legB = -Math.sin(p) * sw;
    let armA = -Math.sin(p) * sw * 0.8, armB = Math.sin(p) * sw * 0.8;
    let armRaise = 0, armRaiseR = 0;
    if (ch.anim === 'cower') {
      armA = armB = -2.4;
    }
    if (ch.anim === 'wave') armRaiseR = -2.6 + Math.sin(ch.t * 9) * 0.3;
    if (ch.anim === 'point') armRaiseR = -1.5;
    if (ch.anim === 'wind') armRaiseR = -1.2 + Math.sin(ch.t * 14) * 0.15;
    if (ch.seated) {
      legA = legB = -1.45;
      armA = armB = -0.9;
    }
    if (ch.ride === 'bicycle') {
      legA = -1.0 + Math.sin(p) * 0.6;
      legB = -1.0 - Math.sin(p) * 0.6;
      armA = armB = -0.9;
    }
    if (ch.prop === 'phone' && ch.anim !== 'run') armRaiseR = Math.min(armRaiseR, -1.3);
    const skirtLen = lk.skirt === 2 ? 0.95 : lk.skirt === 1 ? 0.5 : 0;
    // legs
    if (skirtLen < 0.9) {
      this._put('leg', local(-0.09 * w, 0.92, 0, legA, 0, 0, w, 1, w), lk.legs);
      this._put('leg', local(0.09 * w, 0.92, 0, legB, 0, 0, w, 1, w), lk.legs);
    }
    // shoes follow legs roughly
    const sh = (a) => [Math.sin(a) * 0.86, 0.92 - Math.cos(a) * 0.86];
    const s1 = sh(legA), s2 = sh(legB);
    this._put('shoe', local(-0.09 * w, s1[1] + 0.02, s1[0] + 0.03, 0, 0, 0), lk.shoes || '#222');
    this._put('shoe', local(0.09 * w, s2[1] + 0.02, s2[0] + 0.03, 0, 0, 0), lk.shoes || '#222');
    this._put('hips', local(0, 0.95, 0, 0, 0, 0, w, 1, w), skirtLen ? lk.skirtColor || lk.legs : lk.legs);
    if (skirtLen) this._put('skirt', local(0, 1.02, 0, 0, 0, 0, w * (lk.skirt === 2 ? 1.05 : 0.9), skirtLen, w * (lk.skirt === 2 ? 1.0 : 0.9)), lk.skirtColor || lk.legs);
    // torso
    const lean = ch.anim === 'run' ? 0.18 : ch.ride === 'bicycle' ? 0.35 : 0;
    this._put('torso', local(0, 1.33, 0, lean, 0, 0, w, 1, w * 0.85), lk.top);
    // arms
    const shY = 1.58;
    this._put('arm', local(-0.23 * w, shY, 0.02, armA + (armRaise || 0), 0, 0.08), lk.sleeves || lk.top);
    this._put('arm', local(0.23 * w, shY, 0.02, armB + (armRaiseR || 0), 0, -0.08), lk.sleeves || lk.top);
    const hand = (a, x) => [x, shY - Math.cos(a) * 0.62, 0.02 + Math.sin(a) * 0.62];
    const hL = hand(armA, -0.25 * w), hR = hand(armB + armRaiseR, 0.25 * w);
    this._put('hand', local(hL[0], hL[1], hL[2]), lk.skin);
    this._put('hand', local(hR[0], hR[1], hR[2]), lk.skin);
    // head
    const headY = 1.77;
    this._put('head', local(0, headY, 0.01 + lean * 0.12), lk.skin);
    if (lk.hair && lk.hat !== 'helmet' && lk.hat !== 'tophat') this._put('hair', local(0, headY + 0.01, -0.01), lk.hair);
    if (lk.hat && lk.hat !== 'none' && this.meshes['hat_' + lk.hat]) {
      const hatY = lk.hat === 'headscarf' || lk.hat === 'hood' || lk.hat === 'parka' || lk.hat === 'bonnet' ? headY : lk.hat === 'beehive' || lk.hat === 'bun' ? headY + 0.02 : headY + 0.07;
      this._put('hat_' + lk.hat, local(0, hatY, 0.01), lk.hatColor || '#222');
    }
    // held prop (right hand)
    if (ch.prop && this.meshes['prop_' + ch.prop]) {
      const pr = ch.prop;
      if (pr === 'phone') this._put('prop_phone', local(hR[0] - 0.03, hR[1] + 0.06, hR[2] + 0.05, -0.4, 0, 0), '#111');
      else this._put('prop_' + pr, local(hR[0], hR[1], hR[2]), ch.propColor || (pr === 'carpetbag' ? '#7a3b2a' : pr === 'basket' ? '#a87a3a' : pr === 'paper' ? '#e9e4d6' : pr === 'coffee' ? '#f2f2f2' : pr === 'key' ? '#3a3a3a' : '#4a3a2a'));
    }
    // blob shadow
    const bi = this.blobs.count;
    if (bi < MAX) {
      this._m.compose(this._v.set(ch.x, ch.groundY !== undefined ? ch.groundY + 0.03 : ch.y + 0.03, ch.z), this._q.identity(), this._s.set(1, 1, 1));
      this.blobs.setMatrixAt(bi, this._m);
      this.blobs.count = bi + 1;
    }
  };

  // ------------------------------------------------------------------ character state object
  function Character(opts) {
    Object.assign(this, {
      x: 0, y: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, phase: 0, t: 0, anim: 'idle', visible: true,
      look: { skin: '#e0ac85', top: '#333', legs: '#223', hair: '#2a1d14', hat: 'none', hatColor: '#222', skirt: 0, build: 1, height: 1 },
      prop: null, radius: 0.32, era: 2026, downT: 0, role: 'npc', seated: false,
    }, opts || {});
  }
  Character.prototype.animate = function (dt, moveSpeed) {
    this.t += dt;
    if (this.anim === 'down') {
      this.downT += dt;
      return;
    }
    if (moveSpeed > 0.15) {
      this.anim = moveSpeed > 3.2 ? 'run' : 'walk';
      this.phase += dt * (moveSpeed > 3.2 ? 2.6 * moveSpeed : 3.6 * moveSpeed);
    } else if (this.anim === 'walk' || this.anim === 'run') {
      this.anim = 'idle';
      this.phase = 0;
    }
  };

  // ------------------------------------------------------------------ era looks
  function pickWeighted(r, obj) {
    let t = 0;
    for (const k in obj) t += obj[k];
    let x = r() * t;
    for (const k in obj) {
      x -= obj[k];
      if (x <= 0) return k;
    }
    return Object.keys(obj)[0];
  }
  SA.randomLook = function (eraId, r, opts) {
    const E = SA.ERAS[eraId].npc;
    const P = E.palette;
    const pick = (a) => a[Math.floor(r() * a.length)];
    const fem = r() < 0.5;
    let hat = pickWeighted(r, E.hats);
    let skirt = 0;
    if (fem && r() < E.skirts * 2) skirt = eraId === 1897 ? 2 : r() < 0.7 ? 1 : 2;
    if (eraId === 1897 && fem) skirt = 2;
    // gendered hats by era
    if (eraId === 1897) {
      if (fem && ['bowler', 'flatcap', 'tophat', 'boater'].includes(hat)) hat = r() < 0.7 ? 'ladyhat' : 'bonnet';
      if (!fem && ['ladyhat', 'bonnet'].includes(hat)) hat = r() < 0.5 ? 'bowler' : 'flatcap';
    }
    if (eraId === 1964) {
      if (fem && ['trilby', 'flatcap'].includes(hat)) hat = 'headscarf';
      if (!fem && ['headscarf', 'beehive'].includes(hat)) hat = r() < 0.5 ? 'trilby' : 'none';
    }
    const look = {
      skin: pick(P.skin), hair: pick(P.hair), top: pick(P.top), legs: pick(P.legs), shoes: eraId === 2026 && r() < 0.5 ? '#f2f2f2' : '#1e1a17',
      hat, hatColor: hat === 'boater' ? '#e8d9a8' : hat === 'tophat' ? '#151515' : hat === 'headscarf' ? pick(['#c8102e', '#e8b100', '#7aa6b8', '#f2efe4', '#9b6b9f']) : hat === 'beehive' || hat === 'bun' ? null : pick(['#222', '#3a2f28', '#4a4038', '#2b3245', '#5a2a2a', '#ccc5b3']),
      skirt, skirtColor: null, build: 0.92 + r() * 0.2 + (fem ? -0.05 : 0.04), height: 0.94 + r() * 0.1 + (fem ? -0.03 : 0.02), fem,
    };
    if (hat === 'beehive' || hat === 'bun') look.hatColor = look.hair;
    if (skirt) look.skirtColor = pick(eraId === 1897 ? ['#2b2b38', '#3a2a40', '#4a2a2a', '#22303a', '#3a3a2a', '#5a4a3a'] : ['#c8102e', '#1d3c6e', '#e8b100', '#2e6b3a', '#9b6b9f', '#2b2b2b', '#d46a3a']);
    if (eraId === 1897 && fem) look.top = pick(['#f0ebdf', '#e8dcc8', '#2b3245', '#5a2a2a', '#3a2f28', '#d9c8b0']);
    let prop = null;
    for (const k in E.props) if (r() < E.props[k]) prop = k;
    return { look, prop };
  };
  // outfits for the player
  SA.OUTFITS = {
    modern: { label: '2026 clothes', era: 2026, look: { top: '#2f4858', legs: '#2b3f63', shoes: '#e9e9e9', hat: 'none', hair: '#3a2618', skin: '#d9a07a', skirt: 0, build: 1, height: 1, sleeves: '#2f4858' } },
    mod1964: { label: '1964 mod jacket', era: 1964, look: { top: '#4b5320', legs: '#3a3a40', shoes: '#1e1a17', hat: 'none', hair: '#3a2618', skin: '#d9a07a', skirt: 0, build: 1, height: 1, sleeves: '#4b5320' } },
    victorian: { label: '1897 coat and cap', era: 1897, look: { top: '#2c2620', legs: '#3a342e', shoes: '#1e1a17', hat: 'flatcap', hatColor: '#4a4038', hair: '#3a2618', skin: '#d9a07a', skirt: 0, build: 1.04, height: 1, sleeves: '#2c2620' } },
  };

  SA.CharPool = Pool;
  SA.Character = Character;
})();
