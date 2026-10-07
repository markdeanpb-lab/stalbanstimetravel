/* LAST SPACE - procedural textures (canvas) and a small geometry builder for merged meshes. */
(function (LS) {
  'use strict';
  const T = LS.Tex = {};
  const cache = {};
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rnd(seed) { return LS.U.rng(seed); }
  function finish(c, opts) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = opts && opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }
  T.make = function (key, fn) { if (!cache[key]) cache[key] = fn(); return cache[key]; };

  // asphalt: fine aggregate with darker patches (1 texture = 4 m)
  T.asphalt = () => T.make('asphalt', () => {
    const c = canvas(512, 512), g = c.getContext('2d'), r = rnd(11);
    g.fillStyle = '#4a4b4e'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${30 + r() * 20},${30 + r() * 20},${34 + r() * 20},${0.10 + r() * 0.12})`; const x = r() * 512, y = r() * 512, w = 40 + r() * 160; g.beginPath(); g.ellipse(x, y, w, w * (0.3 + r() * 0.6), r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 36000; i++) { const v = 40 + r() * 70; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(r() * 512, r() * 512, 1 + r() * 1.6, 1 + r() * 1.6); }
    g.strokeStyle = 'rgba(20,20,22,0.5)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
    return finish(c);
  });
  // paving slabs 600 mm (1 texture = 2.4 m)
  T.paving = () => T.make('paving', () => {
    const c = canvas(512, 512), g = c.getContext('2d'), r = rnd(12), S = 128;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = 150 + r() * 26; g.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g.fillRect(x * S, y * S, S, S);
      for (let i = 0; i < 500; i++) { const q = v - 30 + r() * 50; g.fillStyle = `rgba(${q},${q},${q},0.5)`; g.fillRect(x * S + r() * S, y * S + r() * S, 1.5, 1.5); }
      if (r() < 0.25) { g.fillStyle = 'rgba(40,40,40,0.18)'; g.beginPath(); g.ellipse(x * S + r() * S, y * S + r() * S, 10 + r() * 20, 6 + r() * 10, 0, 0, 7); g.fill(); }
    }
    g.strokeStyle = '#6d6a66'; g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * S, 0); g.lineTo(i * S, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * S); g.lineTo(512, i * S); g.stroke(); }
    return finish(c);
  });
  // brick, stretcher bond (1 texture = 1.8 m wide x 1.2 m tall). Tinted by vertex colour.
  T.brick = () => T.make('brick', () => {
    const c = canvas(512, 512), g = c.getContext('2d'), r = rnd(13);
    g.fillStyle = '#bdb6aa'; g.fillRect(0, 0, 512, 512);
    const bw = 64, bh = 32 * 512 / 512 * 0.8;
    const rows = Math.round(512 / 25.6);
    for (let row = 0; row < rows; row++) {
      const y = row * 25.6, off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < 512 + bw; x += bw) {
        const v = 0.78 + r() * 0.3, bump = r();
        const rr = 255 * v, gg = 255 * v * (0.93 + r() * 0.05), bb = 255 * v * (0.88 + r() * 0.08);
        g.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
        g.fillRect(x + off + 2, y + 2, bw - 4, 25.6 - 4);
        if (bump < 0.15) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + off + 2, y + 2, bw - 4, 25.6 - 4); }
      }
    }
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * 512, r() * 512, 2, 2); }
    return finish(c);
  });
  T.slate = () => T.make('slate', () => {
    const c = canvas(256, 256), g = c.getContext('2d'), r = rnd(14);
    g.fillStyle = '#3f4248'; g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 16; row++) {
      const y = row * 16, off = row % 2 ? 16 : 0;
      for (let x = -32; x < 288; x += 32) { const v = 52 + r() * 22; g.fillStyle = `rgb(${v},${v + 2},${v + 8})`; g.fillRect(x + off + 1, y + 1, 30, 14); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 13, 256, 3);
    }
    return finish(c);
  });
  T.garden = () => T.make('garden', () => {
    const c = canvas(256, 256), g = c.getContext('2d'), r = rnd(15);
    g.fillStyle = '#4c6a33'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(40,${70 + r() * 50},30,0.6)` : `rgba(${90 + r() * 40},${100 + r() * 40},50,0.4)`; g.fillRect(r() * 256, r() * 256, 1.5, 2.5); }
    return finish(c);
  });
  T.kerb = () => T.make('kerb', () => {
    const c = canvas(128, 32), g = c.getContext('2d'), r = rnd(16);
    g.fillStyle = '#b9b6b0'; g.fillRect(0, 0, 128, 32);
    for (let i = 0; i < 800; i++) { const v = 150 + r() * 60; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * 128, r() * 32, 1, 1); }
    g.fillStyle = '#7b7873'; for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 2, 32);
    return finish(c);
  });
  T.hedge = () => T.make('hedge', () => {
    const c = canvas(256, 128), g = c.getContext('2d'), r = rnd(17);
    g.fillStyle = '#2d4a22'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${30 + r() * 50},${70 + r() * 70},${25 + r() * 30},0.8)`; g.beginPath(); g.arc(r() * 256, r() * 128, 1 + r() * 3, 0, 7); g.fill(); }
    return finish(c);
  });

  // ------------------------------------------------------------------ signs and labels
  T.streetSign = (text, sub) => T.make('sign:' + text, () => {
    const c = canvas(1024, 192), g = c.getContext('2d');
    g.fillStyle = '#f8f8f4'; g.fillRect(0, 0, 1024, 192);
    g.strokeStyle = '#111'; g.lineWidth = 10; g.strokeRect(14, 14, 996, 164);
    g.fillStyle = '#111'; g.textBaseline = 'middle';
    g.font = 'bold 104px "Arial Narrow", Arial, Helvetica, sans-serif';
    const w = g.measureText(text).width; const sc = Math.min(1, 800 / w);
    g.save(); g.translate(60, 100); g.scale(sc, 1); g.fillText(text, 0, 0); g.restore();
    g.fillStyle = '#c4161c'; g.font = 'bold 52px Arial, sans-serif'; g.fillText(sub || '', 880, 100);
    return finish(c);
  });
  T.textPanel = (key, lines, opts) => T.make('panel:' + key, () => {
    const o = opts || {}, W = o.w || 512, H = o.h || 512;
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = o.bg || '#fff'; g.fillRect(0, 0, W, H);
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = o.bw || 16; g.strokeRect(8, 8, W - 16, H - 16); }
    g.fillStyle = o.fg || '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let y = o.top || H / (lines.length + 1);
    for (const ln of lines) { g.font = ln.font || 'bold 60px Arial'; g.fillStyle = ln.color || o.fg || '#111'; g.fillText(ln.t, W / 2, ln.y || y); y += ln.dy || H / (lines.length + 1); }
    return finish(c);
  });
  T.permit = () => T.textPanel('permit', [
    { t: 'P', font: 'bold 150px Arial', color: '#fff', y: 92 },
    { t: 'Permit holders', font: 'bold 50px Arial', color: '#111', y: 210 },
    { t: 'only', font: 'bold 50px Arial', color: '#111', y: 262 },
    { t: 'Mon - Sat', font: '40px Arial', color: '#111', y: 330 },
    { t: '8.30 am - 6.30 pm', font: '40px Arial', color: '#111', y: 378 },
    { t: 'ZONE R', font: 'bold 54px Arial', color: '#111', y: 452 },
  ], { w: 360, h: 512, bg: '#fff', border: '#111', bw: 10 });
  // the "P" plate needs a blue square: draw it over
  T.permitSign = () => T.make('permit2', () => {
    const t = T.permit(); const c = t.image, g = c.getContext('2d');
    g.fillStyle = '#1d4f9c'; g.fillRect(100, 22, 160, 140); g.fillStyle = '#fff'; g.font = 'bold 130px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 180, 96);
    t.needsUpdate = true; return t;
  });
  T.roadClosed = (label) => T.textPanel('closed:' + label, [
    { t: 'ROAD', font: 'bold 120px Arial', y: 150 }, { t: 'CLOSED', font: 'bold 120px Arial', y: 290 },
    { t: label.replace('ROAD CLOSED', '').replace(/^ - /, ''), font: 'bold 44px Arial', y: 420 },
  ], { w: 512, h: 512, bg: '#fff', border: '#c4161c', bw: 34 });
  T.plate = (text, rear) => T.make('plate:' + text + rear, () => {
    const c = canvas(256, 56), g = c.getContext('2d');
    g.fillStyle = rear ? '#f4c400' : '#f4f4f0'; g.fillRect(0, 0, 256, 56);
    g.fillStyle = '#1f3c8a'; g.fillRect(0, 0, 22, 56);
    g.fillStyle = '#111'; g.font = 'bold 40px "Arial Narrow", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 138, 30);
    return finish(c);
  });
  T.livery = (text) => T.make('livery:' + text, () => {
    const c = canvas(1024, 256), g = c.getContext('2d');
    g.clearRect(0, 0, 1024, 256);
    g.fillStyle = '#1a3d7c'; g.font = 'bold 74px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const [a, b] = text.split(' - ');
    g.fillText(a, 512, 92); g.fillStyle = '#c4161c'; g.font = 'bold 46px Arial'; g.fillText(b || '', 512, 170);
    g.fillStyle = '#1a3d7c'; g.font = '34px Arial'; g.fillText('No job too small. No space too small.', 512, 226);
    return finish(c);
  });
  // identity badge: shape + number in a colour (colour is never the only cue)
  T.badge = (identity, label, opts) => T.make('badge:' + identity.shape + label + (opts && opts.ring ? 'r' : ''), () => {
    const c = canvas(256, 256), g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    LS.drawShape(g, identity.shape, 128, 112, 84, identity.color, '#111', 10);
    g.fillStyle = identity.shape === 'ring' || identity.color === '#F0E442' || identity.color === '#FFFFFF' ? '#111' : '#fff';
    g.font = 'bold 64px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 128, 116);
    return finish(c);
  });
  T.spaceIcon = (kind, label) => T.make('spaceicon:' + kind + label, () => {
    const c = canvas(256, 320), g = c.getContext('2d');
    g.clearRect(0, 0, 256, 320);
    if (kind === 'candidate') {
      g.fillStyle = 'rgba(20,20,20,0.75)'; g.strokeStyle = '#ffd400'; g.lineWidth = 10; g.setLineDash([22, 14]);
      g.beginPath(); g.arc(128, 128, 104, 0, 7); g.fill(); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffd400'; g.font = 'bold 150px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 128, 136);
    } else if (kind === 'active') {
      g.fillStyle = '#1d4f9c'; g.strokeStyle = '#fff'; g.lineWidth = 12;
      g.beginPath(); g.roundRect(22, 22, 212, 212, 30); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 170px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 128, 136);
    } else if (kind === 'suspended') {
      g.fillStyle = 'rgba(30,30,30,0.6)'; g.beginPath(); g.arc(128, 128, 90, 0, 7); g.fill();
      g.strokeStyle = '#e8402a'; g.lineWidth = 26; g.beginPath(); g.moveTo(70, 70); g.lineTo(186, 186); g.moveTo(186, 70); g.lineTo(70, 186); g.stroke();
    }
    if (label) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(8, 252, 240, 60); g.fillStyle = '#fff'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 128, 284); }
    return finish(c);
  });
  // stripes for space ground markings: diagonal hatch (pattern, not just colour)
  T.hatch = (color, bg) => T.make('hatch:' + color + bg, () => {
    const c = canvas(128, 128), g = c.getContext('2d');
    g.fillStyle = bg || 'rgba(0,0,0,0)'; g.clearRect(0, 0, 128, 128); if (bg) g.fillRect(0, 0, 128, 128);
    g.strokeStyle = color; g.lineWidth = 18;
    for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 64 - 10, 138); g.lineTo(i * 64 + 138, -10); g.stroke(); }
    return finish(c);
  });
  T.glow = () => T.make('glow', () => {
    const c = canvas(128, 128), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return finish(c, { linear: true });
  });
  T.smoke = () => T.make('smoke', () => {
    const c = canvas(128, 128), g = c.getContext('2d'), r = rnd(18);
    for (let i = 0; i < 26; i++) { const x = 40 + r() * 48, y = 40 + r() * 48, rad = 18 + r() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    return finish(c, { linear: true });
  });

  // canvas 2D shapes shared by sprites, HUD and minimap
  LS.drawShape = function (g, shape, x, y, r, fill, stroke, lw) {
    g.save(); g.beginPath();
    const poly = (n, rot, rr) => { for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n; const px = x + Math.cos(a) * (rr || r), py = y + Math.sin(a) * (rr || r); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); };
    switch (shape) {
      case 'circle': g.arc(x, y, r * 0.9, 0, Math.PI * 2); break;
      case 'square': g.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); break;
      case 'triangle': poly(3, -Math.PI / 2, r * 1.05); break;
      case 'diamond': poly(4, -Math.PI / 2, r); break;
      case 'hexagon': poly(6, 0, r * 0.95); break;
      case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); break;
      case 'cross': { const w = r * 0.38; g.moveTo(x - w, y - r); g.lineTo(x + w, y - r); g.lineTo(x + w, y - w); g.lineTo(x + r, y - w); g.lineTo(x + r, y + w); g.lineTo(x + w, y + w); g.lineTo(x + w, y + r); g.lineTo(x - w, y + r); g.lineTo(x - w, y + w); g.lineTo(x - r, y + w); g.lineTo(x - r, y - w); g.lineTo(x - w, y - w); g.closePath(); break; }
      case 'ring': g.arc(x, y, r * 0.9, 0, Math.PI * 2); g.moveTo(x + r * 0.5, y); g.arc(x, y, r * 0.5, 0, Math.PI * 2, true); break;
      default: g.arc(x, y, r, 0, Math.PI * 2);
    }
    if (fill) { g.fillStyle = fill; g.fill('evenodd'); }
    if (stroke) { g.lineWidth = lw || 2; g.strokeStyle = stroke; g.stroke(); }
    g.restore();
  };

  // ------------------------------------------------------------------ merged-geometry builder
  class GeoBuilder {
    constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.idx = []; this.vc = 0; }
    // quad from 4 points (counter-clockwise seen from the front), colour [r,g,b], uv rect
    quad(a, b, c, d, col, uvs) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const base = this.vc;
      for (const [P, U] of [[a, uvs ? uvs[0] : [0, 0]], [b, uvs ? uvs[1] : [1, 0]], [c, uvs ? uvs[2] : [1, 1]], [d, uvs ? uvs[3] : [0, 1]]]) {
        this.p.push(P[0], P[1], P[2]); this.n.push(nx, ny, nz); this.uv.push(U[0], U[1]); this.c.push(col[0], col[1], col[2]);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); this.vc += 4;
    }
    tri(a, b, c, col, uvs) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const base = this.vc;
      for (const [P, U] of [[a, uvs ? uvs[0] : [0, 0]], [b, uvs ? uvs[1] : [1, 0]], [c, uvs ? uvs[2] : [0, 1]]]) { this.p.push(P[0], P[1], P[2]); this.n.push(nx, ny, nz); this.uv.push(U[0], U[1]); this.c.push(col[0], col[1], col[2]); }
      this.idx.push(base, base + 1, base + 2); this.vc += 3;
    }
    // oriented box in three.js coords: centre (x,y,z), size (w along local X, h, d along local Z), rotation about Y.
    // uvScale: metres per texture repeat (world-scaled UVs so bricks stay brick-sized)
    box(x, y, z, w, h, d, rot, col, uvScale, skip) {
      const c = Math.cos(rot), s = Math.sin(rot);
      const P = (lx, ly, lz) => [x + c * lx + s * lz, y + ly, z - s * lx + c * lz];
      const hw = w / 2, hh = h / 2, hd = d / 2, k = uvScale || 1;
      const faces = [
        ['px', P(hw, -hh, hd), P(hw, -hh, -hd), P(hw, hh, -hd), P(hw, hh, hd), d, h],
        ['nx', P(-hw, -hh, -hd), P(-hw, -hh, hd), P(-hw, hh, hd), P(-hw, hh, -hd), d, h],
        ['pz', P(-hw, -hh, hd), P(hw, -hh, hd), P(hw, hh, hd), P(-hw, hh, hd), w, h],
        ['nz', P(hw, -hh, -hd), P(-hw, -hh, -hd), P(-hw, hh, -hd), P(hw, hh, -hd), w, h],
        ['py', P(-hw, hh, hd), P(hw, hh, hd), P(hw, hh, -hd), P(-hw, hh, -hd), w, d],
        ['ny', P(-hw, -hh, -hd), P(hw, -hh, -hd), P(hw, -hh, hd), P(-hw, -hh, hd), w, d],
      ];
      for (const f of faces) {
        if (skip && skip.includes(f[0])) continue;
        const uw = f[5] / k, uh = f[6] / k, u0 = (x + z) / k * 0.37 % 1, v0 = (y - hh) / k;
        this.quad(f[1], f[2], f[3], f[4], col, [[u0, v0], [u0 + uw, v0], [u0 + uw, v0 + uh], [u0, v0 + uh]]);
      }
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
      g.computeBoundingSphere();
      return g;
    }
  }
  LS.GeoBuilder = GeoBuilder;
  LS.hexRGB = (hex, k) => { const v = parseInt(hex.slice(1), 16); k = k == null ? 1 : k; return [((v >> 16) & 255) / 255 * k, ((v >> 8) & 255) / 255 * k, (v & 255) / 255 * k]; };
})(window.LS);
