/* Procedural textures (canvas) and shader patches for facades, roofs and signs.
   No image files: everything is drawn at load time, keeping texture memory small. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const Tex = (SA.Tex = {});

  // ------------------------------------------------------------------ facade feature atlas
  // 8 x 4 cells. Each cell = one bay of one storey (about 3.0 m wide x 3.2 m tall).
  const COLS = 8, ROWS = 4;
  const CELLS = {
    // row 0: upper-floor windows
    sash6: [0, 0], sash2: [1, 0], casement: [2, 0], modern: [3, 0], timber: [4, 0], timberWin: [5, 0], band60: [6, 0], blank: [7, 0],
    // row 1: special windows
    arched: [0, 1], oriel: [1, 1], lancet: [2, 1], towerWin: [3, 1], smallsq: [4, 1], roundel: [5, 1], glassWall: [6, 1], stoneBlank: [7, 1],
    // row 2: shopfronts
    shopGreen: [0, 2], shopMaroon: [1, 2], shopNavy: [2, 2], shopBlack: [3, 2], shop60a: [4, 2], shop60b: [5, 2], shopMod: [6, 2], shopModB: [7, 2],
    // row 3: other ground floors
    pub: [0, 3], bank: [1, 3], doorGeorgian: [2, 3], house: [3, 3], arch: [4, 3], shutter: [5, 3], boarded: [6, 3], hoarding: [7, 3],
  };
  Tex.CELLS = CELLS;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function glassGrad(ctx, x, y, w, h, tint) {
    const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    const t = tint || [40, 52, 64];
    g.addColorStop(0, `rgb(${t[0] + 70},${t[1] + 78},${t[2] + 86})`);
    g.addColorStop(0.35, `rgb(${t[0] + 10},${t[1] + 16},${t[2] + 24})`);
    g.addColorStop(0.36, `rgb(${t[0] + 35},${t[1] + 42},${t[2] + 52})`);
    g.addColorStop(1, `rgb(${t[0]},${t[1]},${t[2]})`);
    return g;
  }
  // window with glazing bars. Returns glass rect for the glow map.
  function sash(ctx, gl, x, y, w, h, cols, rows, frame, bar) {
    ctx.fillStyle = frame;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = glassGrad(ctx, x, y, w, h);
    ctx.fillRect(x, y, w, h);
    gl.fillRect(x, y, w, h);
    ctx.fillStyle = frame;
    for (let c = 1; c < cols; c++) ctx.fillRect(x + (w * c) / cols - bar / 2, y, bar, h);
    for (let r = 1; r < rows; r++) ctx.fillRect(x, y + (h * r) / rows - bar / 2, w, bar);
    // meeting rail
    ctx.fillRect(x, y + h / 2 - bar, w, bar * 2);
    gl.fillStyle = '#000';
    for (let c = 1; c < cols; c++) gl.fillRect(x + (w * c) / cols - bar / 2, y, bar, h);
    for (let r = 1; r < rows; r++) gl.fillRect(x, y + (h * r) / rows - bar / 2, w, bar);
    gl.fillStyle = '#fff';
  }
  function sill(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(230,226,214,1)';
    ctx.fillRect(x - 10, y, w + 20, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x - 10, y + 9, w + 20, 3);
  }
  function lintelShade(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(40,20,10,0.22)';
    ctx.fillRect(x - 10, y - 20, w + 20, 14);
  }
  function shopfront(ctx, gl, S, paint, style) {
    // S = cell size. Ground floor: fascia at top (sign drawn separately as geometry), glazing, stall riser, door.
    const p = paint;
    ctx.fillStyle = p;
    ctx.fillRect(0, 18, S, S - 18);
    // cornice
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 18, S, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 14, S, 4);
    // fascia band (sign area) slightly darker
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(10, 26, S - 20, 34);
    // pilasters
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(4, 26, 12, S - 26);
    ctx.fillRect(S - 16, 26, 12, S - 26);
    // window + door
    const wx = 22, wy = 70, ww = style === 'wide' ? S - 44 : S - 110, wh = S - 70 - 44;
    ctx.fillStyle = glassGrad(ctx, wx, wy, ww, wh, [52, 46, 38]);
    ctx.fillRect(wx, wy, ww, wh);
    gl.fillRect(wx, wy, ww, wh);
    // display goods silhouettes
    ctx.fillStyle = 'rgba(255,230,190,0.22)';
    for (let i = 0; i < 5; i++) ctx.fillRect(wx + 8 + i * (ww / 5), wy + wh - 30 - (i % 2) * 12, ww / 7, 26 + (i % 2) * 12);
    // glazing bars
    ctx.fillStyle = p;
    ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh);
    ctx.fillRect(wx, wy + 26, ww, 4);
    // stall riser
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(wx, S - 44, ww, 40);
    if (style !== 'wide') {
      // door
      const dx = S - 80;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(dx, 64, 60, S - 64);
      ctx.fillStyle = glassGrad(ctx, dx + 8, 72, 44, 80, [52, 46, 38]);
      ctx.fillRect(dx + 8, 72, 44, 80);
      gl.fillRect(dx + 8, 72, 44, 80);
      ctx.fillStyle = p;
      ctx.fillRect(dx + 8, 160, 44, S - 168);
      ctx.fillStyle = '#c9a54a';
      ctx.fillRect(dx + 44, 175, 5, 5);
    }
  }

  Tex.makeFacadeAtlas = function (cell) {
    const S = cell || 256;
    const cv = document.createElement('canvas');
    cv.width = COLS * S;
    cv.height = ROWS * S;
    const ctx = cv.getContext('2d');
    const gcv = document.createElement('canvas');
    gcv.width = cv.width / 2;
    gcv.height = cv.height / 2;
    const gctx = gcv.getContext('2d');
    gctx.fillStyle = '#000';
    gctx.fillRect(0, 0, gcv.width, gcv.height);

    function draw(name, fn) {
      const c = CELLS[name];
      ctx.save();
      ctx.translate(c[0] * S, c[1] * S);
      ctx.scale(S / 256, S / 256);
      ctx.beginPath();
      ctx.rect(0, 0, 256, 256);
      ctx.clip();
      gctx.save();
      gctx.translate((c[0] * S) / 2, (c[1] * S) / 2);
      gctx.scale(S / 512, S / 512);
      gctx.fillStyle = '#fff';
      fn(ctx, gctx);
      ctx.restore();
      gctx.restore();
    }
    // --- row 0
    draw('sash6', (c, g) => {
      lintelShade(c, 86, 52, 84);
      sash(c, g, 86, 52, 84, 136, 3, 4, '#f3f0e8', 3);
      sill(c, 86, 194, 84);
    });
    draw('sash2', (c, g) => {
      c.fillStyle = '#ddd5c2';
      c.fillRect(74, 30, 108, 22); // stone lintel
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.fillRect(74, 52, 108, 3);
      sash(c, g, 84, 58, 88, 132, 1, 2, '#eeeae0', 4);
      sill(c, 84, 196, 88);
    });
    draw('casement', (c, g) => {
      c.fillStyle = '#3a2a1e';
      c.fillRect(70, 72, 116, 102);
      c.fillStyle = glassGrad(c, 78, 80, 100, 86, [50, 50, 46]);
      c.fillRect(78, 80, 100, 86);
      g.fillRect(78, 80, 100, 86);
      c.strokeStyle = 'rgba(30,30,30,0.7)';
      c.lineWidth = 1.5;
      for (let i = -8; i < 12; i++) {
        c.beginPath();
        c.moveTo(78 + i * 12, 80);
        c.lineTo(78 + i * 12 + 86, 166);
        c.stroke();
        c.beginPath();
        c.moveTo(78 + i * 12 + 86, 80);
        c.lineTo(78 + i * 12, 166);
        c.stroke();
      }
      c.fillStyle = '#3a2a1e';
      c.fillRect(126, 80, 5, 86);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(66, 174, 124, 8);
    });
    draw('modern', (c, g) => {
      c.fillStyle = '#3b3f45';
      c.fillRect(40, 44, 176, 168);
      c.fillStyle = glassGrad(c, 46, 50, 164, 156, [38, 50, 62]);
      c.fillRect(46, 50, 164, 156);
      g.fillRect(46, 50, 164, 156);
      c.fillStyle = '#3b3f45';
      c.fillRect(126, 50, 4, 156);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(46, 50, 164, 20);
    });
    function timberFrame(c, withWin) {
      c.fillStyle = '#efe9da';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#2b211a';
      c.fillRect(0, 0, 256, 12);
      c.fillRect(0, 244, 256, 12);
      for (const x of [0, 84, 168, 244]) c.fillRect(x, 0, 12, 256);
      c.fillRect(0, 126, 256, 10);
      // braces
      c.save();
      c.lineWidth = 10;
      c.strokeStyle = '#2b211a';
      c.beginPath();
      c.moveTo(12, 244);
      c.lineTo(84, 136);
      c.moveTo(244, 244);
      c.lineTo(180, 136);
      c.stroke();
      c.restore();
    }
    draw('timber', (c) => timberFrame(c, false));
    draw('timberWin', (c, g) => {
      timberFrame(c, true);
      c.fillStyle = '#2b211a';
      c.fillRect(92, 36, 72, 84);
      c.fillStyle = glassGrad(c, 98, 42, 60, 72, [50, 50, 46]);
      c.fillRect(98, 42, 60, 72);
      g.fillRect(98, 42, 60, 72);
      c.fillStyle = '#2b211a';
      c.fillRect(126, 42, 4, 72);
      c.fillRect(98, 76, 60, 4);
    });
    draw('band60', (c, g) => {
      c.fillStyle = '#d7d2c4';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#6f7c80';
      c.fillRect(0, 170, 256, 70); // spandrel
      c.fillStyle = '#2e3236';
      c.fillRect(0, 56, 256, 108);
      c.fillStyle = glassGrad(c, 0, 60, 256, 100, [44, 56, 66]);
      c.fillRect(0, 60, 256, 100);
      g.fillRect(0, 60, 256, 100);
      c.fillStyle = '#2e3236';
      for (const x of [0, 85, 170, 252]) c.fillRect(x, 60, 4, 100);
    });
    // blank: fully transparent (wall only)
    // --- row 1
    draw('arched', (c, g) => {
      c.fillStyle = '#e2dccb';
      c.beginPath();
      c.arc(128, 82, 52, Math.PI, 0);
      c.lineTo(180, 82);
      c.lineTo(76, 82);
      c.fill();
      c.fillStyle = '#efebe0';
      c.beginPath();
      c.arc(128, 86, 44, Math.PI, 0);
      c.lineTo(172, 196);
      c.lineTo(84, 196);
      c.closePath();
      c.fill();
      c.fillStyle = glassGrad(c, 90, 48, 76, 146, [40, 50, 60]);
      c.beginPath();
      c.arc(128, 88, 38, Math.PI, 0);
      c.lineTo(166, 190);
      c.lineTo(90, 190);
      c.closePath();
      c.fill();
      g.fillRect(90, 50, 76, 140);
      c.fillStyle = '#efebe0';
      c.fillRect(126, 50, 4, 140);
      c.fillRect(90, 120, 76, 4);
      sill(c, 84, 198, 88);
    });
    draw('oriel', (c, g) => {
      c.fillStyle = '#e8e2d2';
      c.fillRect(48, 40, 160, 176);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(48, 210, 160, 10);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = glassGrad(c, 58 + i * 50, 52, 40, 150, [40, 50, 60]);
        c.fillRect(58 + i * 50, 52, 40, 150);
        g.fillRect(58 + i * 50, 52, 40, 150);
      }
      c.fillStyle = '#e8e2d2';
      c.fillRect(48, 120, 160, 5);
    });
    draw('lancet', (c, g) => {
      c.fillStyle = '#cfc6b2';
      c.beginPath();
      c.moveTo(96, 236);
      c.lineTo(96, 90);
      c.quadraticCurveTo(96, 30, 128, 18);
      c.quadraticCurveTo(160, 30, 160, 90);
      c.lineTo(160, 236);
      c.closePath();
      c.fill();
      c.fillStyle = glassGrad(c, 104, 30, 48, 200, [30, 36, 54]);
      c.beginPath();
      c.moveTo(104, 228);
      c.lineTo(104, 92);
      c.quadraticCurveTo(104, 40, 128, 28);
      c.quadraticCurveTo(152, 40, 152, 92);
      c.lineTo(152, 228);
      c.closePath();
      c.fill();
      g.fillRect(104, 40, 48, 188);
    });
    draw('towerWin', (c, g) => {
      c.fillStyle = '#d8d0bc';
      c.beginPath();
      c.moveTo(84, 220);
      c.lineTo(84, 110);
      c.quadraticCurveTo(128, 40, 172, 110);
      c.lineTo(172, 220);
      c.closePath();
      c.fill();
      c.fillStyle = '#1f2226';
      c.beginPath();
      c.moveTo(94, 212);
      c.lineTo(94, 112);
      c.quadraticCurveTo(128, 56, 162, 112);
      c.lineTo(162, 212);
      c.closePath();
      c.fill();
      c.fillStyle = '#d8d0bc';
      c.fillRect(126, 70, 4, 142);
      // louvres
      c.fillStyle = 'rgba(120,110,95,0.9)';
      for (let y = 120; y < 210; y += 14) c.fillRect(96, y, 64, 5);
    });
    draw('smallsq', (c, g) => {
      sash(c, g, 100, 90, 56, 70, 2, 2, '#ece8dc', 3);
      sill(c, 100, 166, 56);
    });
    draw('roundel', (c, g) => {
      c.fillStyle = '#e6e0d0';
      c.beginPath();
      c.arc(128, 128, 40, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = glassGrad(c, 96, 96, 64, 64, [40, 50, 60]);
      c.beginPath();
      c.arc(128, 128, 32, 0, Math.PI * 2);
      c.fill();
      g.fillRect(100, 100, 56, 56);
    });
    draw('glassWall', (c, g) => {
      c.fillStyle = glassGrad(c, 0, 0, 256, 256, [46, 58, 70]);
      c.fillRect(0, 0, 256, 256);
      g.fillRect(0, 0, 256, 256);
      c.fillStyle = '#4a4f55';
      c.fillRect(0, 0, 256, 8);
      c.fillRect(0, 0, 6, 256);
      c.fillRect(126, 0, 4, 256);
    });
    draw('stoneBlank', (c) => {
      c.fillStyle = '#d9d2c1';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < 256; y += 32) c.fillRect(0, y, 256, 2);
      for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < 256; x += 64) c.fillRect(x, y, 2, 32);
    });
    // --- row 2: shopfronts
    draw('shopGreen', (c, g) => shopfront(c, g, 256, '#1f4a35'));
    draw('shopMaroon', (c, g) => shopfront(c, g, 256, '#5a1f24'));
    draw('shopNavy', (c, g) => shopfront(c, g, 256, '#1d2a48'));
    draw('shopBlack', (c, g) => shopfront(c, g, 256, '#1b1a19'));
    draw('shop60a', (c, g) => {
      // 1960s: thin frames, tiled stall riser, canopy shadow
      c.fillStyle = '#c9c2b0';
      c.fillRect(0, 16, 256, 240);
      c.fillStyle = '#e4d9a8';
      c.fillRect(0, 22, 256, 36);
      c.fillStyle = glassGrad(c, 8, 64, 168, 152, [46, 50, 52]);
      c.fillRect(8, 64, 168, 152);
      g.fillRect(8, 64, 168, 152);
      c.fillStyle = 'rgba(255,240,200,0.25)';
      for (let i = 0; i < 6; i++) c.fillRect(16 + i * 26, 170 - (i % 3) * 14, 18, 40 + (i % 3) * 14);
      c.fillStyle = '#7c8a8f';
      c.fillRect(8, 216, 168, 40);
      c.fillStyle = '#9fb0b5';
      for (let x = 8; x < 176; x += 14) c.fillRect(x, 216, 2, 40);
      c.fillStyle = '#3a3a3a';
      c.fillRect(186, 62, 62, 194);
      c.fillStyle = glassGrad(c, 194, 70, 46, 120, [46, 50, 52]);
      c.fillRect(194, 70, 46, 120);
      g.fillRect(194, 70, 46, 120);
      c.fillStyle = '#d0d0d0';
      c.fillRect(176, 62, 10, 194);
    });
    draw('shop60b', (c, g) => {
      c.fillStyle = '#2c3b4a';
      c.fillRect(0, 16, 256, 240);
      c.fillStyle = '#e8e1cf';
      c.fillRect(0, 20, 256, 38);
      c.fillStyle = glassGrad(c, 10, 66, 236, 140, [50, 46, 42]);
      c.fillRect(10, 66, 236, 140);
      g.fillRect(10, 66, 236, 140);
      c.fillStyle = 'rgba(255,220,180,0.25)';
      for (let i = 0; i < 7; i++) c.fillRect(20 + i * 32, 150 - (i % 2) * 20, 20, 50 + (i % 2) * 20);
      c.fillStyle = '#c0c0c0';
      c.fillRect(126, 66, 3, 140);
      c.fillStyle = '#5f5446';
      c.fillRect(10, 206, 236, 50);
    });
    draw('shopMod', (c, g) => {
      c.fillStyle = '#2f3134';
      c.fillRect(0, 14, 256, 242);
      c.fillStyle = glassGrad(c, 8, 62, 240, 194, [52, 54, 56]);
      c.fillRect(8, 62, 240, 194);
      g.fillRect(8, 62, 240, 194);
      c.fillStyle = 'rgba(255,255,255,0.28)';
      for (let i = 0; i < 4; i++) c.fillRect(24 + i * 58, 150, 30, 70 - i * 8);
      c.fillStyle = '#2f3134';
      c.fillRect(160, 62, 4, 194);
    });
    draw('shopModB', (c, g) => {
      c.fillStyle = '#d8d4cc';
      c.fillRect(0, 14, 256, 242);
      c.fillStyle = '#1e1f21';
      c.fillRect(6, 60, 244, 196);
      c.fillStyle = glassGrad(c, 12, 66, 232, 190, [60, 56, 50]);
      c.fillRect(12, 66, 232, 190);
      g.fillRect(12, 66, 232, 190);
      c.fillStyle = 'rgba(255,230,200,0.3)';
      c.fillRect(30, 140, 60, 80);
      c.fillRect(150, 120, 70, 100);
      c.fillStyle = '#1e1f21';
      c.fillRect(126, 66, 4, 190);
    });
    // --- row 3
    draw('pub', (c, g) => {
      c.fillStyle = '#2a1a12';
      c.fillRect(0, 16, 256, 240);
      c.fillStyle = '#3d2618';
      c.fillRect(0, 20, 256, 38);
      for (let i = 0; i < 2; i++) {
        const x = 16 + i * 120;
        c.fillStyle = '#c69a4a';
        c.fillRect(x - 4, 70, 104, 120);
        c.fillStyle = glassGrad(c, x, 74, 96, 112, [70, 52, 30]);
        c.fillRect(x, 74, 96, 112);
        g.fillRect(x, 74, 96, 112);
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(x, 120, 96, 30); // etched band
        c.fillStyle = '#2a1a12';
        c.fillRect(x + 46, 74, 4, 112);
      }
      c.fillStyle = '#4a2e1c';
      c.fillRect(0, 200, 256, 56);
    });
    draw('bank', (c, g) => {
      c.fillStyle = '#ddd6c4';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 8; y < 256; y += 30) c.fillRect(0, y, 256, 3);
      c.fillStyle = '#efeadf';
      c.beginPath();
      c.arc(128, 104, 62, Math.PI, 0);
      c.lineTo(190, 236);
      c.lineTo(66, 236);
      c.closePath();
      c.fill();
      c.fillStyle = glassGrad(c, 76, 52, 104, 184, [36, 42, 50]);
      c.beginPath();
      c.arc(128, 106, 52, Math.PI, 0);
      c.lineTo(180, 236);
      c.lineTo(76, 236);
      c.closePath();
      c.fill();
      g.fillRect(76, 60, 104, 176);
      c.fillStyle = '#efeadf';
      c.fillRect(126, 56, 4, 180);
    });
    draw('doorGeorgian', (c, g) => {
      c.fillStyle = '#f0ece2';
      c.fillRect(70, 36, 116, 220);
      c.fillStyle = '#1e2a24';
      c.fillRect(84, 98, 88, 158);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(92, 108, 30, 60);
      c.fillRect(134, 108, 30, 60);
      c.fillRect(92, 182, 30, 60);
      c.fillRect(134, 182, 30, 60);
      c.fillStyle = glassGrad(c, 84, 46, 88, 46, [40, 50, 60]);
      c.beginPath();
      c.arc(128, 92, 44, Math.PI, 0);
      c.fill();
      g.fillRect(90, 52, 76, 40);
      c.fillStyle = '#c9a54a';
      c.fillRect(160, 176, 6, 6);
    });
    draw('house', (c, g) => {
      sash(c, g, 30, 76, 90, 110, 2, 2, '#ece8dc', 4);
      sill(c, 30, 192, 90);
      c.fillStyle = '#2c3a4e';
      c.fillRect(160, 84, 64, 172);
      c.fillStyle = '#ece8dc';
      c.fillRect(154, 78, 76, 8);
      c.fillStyle = '#c9a54a';
      c.fillRect(214, 170, 5, 5);
    });
    draw('arch', (c, g) => {
      c.fillStyle = '#16120f';
      c.beginPath();
      c.moveTo(30, 256);
      c.lineTo(30, 110);
      c.quadraticCurveTo(128, 20, 226, 110);
      c.lineTo(226, 256);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(220,210,190,0.9)';
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(30, 256);
      c.lineTo(30, 110);
      c.quadraticCurveTo(128, 20, 226, 110);
      c.lineTo(226, 256);
      c.stroke();
    });
    draw('shutter', (c) => {
      c.fillStyle = '#8d9196';
      c.fillRect(0, 50, 256, 206);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 54; y < 256; y += 9) c.fillRect(0, y, 256, 2);
      c.fillStyle = '#4b4e52';
      c.fillRect(0, 14, 256, 40);
    });
    draw('boarded', (c) => {
      c.fillStyle = '#8a7356';
      c.fillRect(10, 30, 236, 226);
      c.fillStyle = 'rgba(0,0,0,0.2)';
      for (let x = 10; x < 246; x += 30) c.fillRect(x, 30, 2, 226);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(10, 120, 236, 6);
    });
    draw('hoarding', (c) => {
      c.fillStyle = '#5c6b4a';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < 256; x += 32) c.fillRect(x, 0, 3, 256);
      c.fillStyle = '#e9e1c9';
      c.fillRect(30, 60, 90, 120);
      c.fillStyle = '#d24a3a';
      c.fillRect(140, 80, 90, 60);
    });

    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    const glow = new THREE.CanvasTexture(gcv);
    glow.generateMipmaps = true;
    return { map, glow, canvas: cv };
  };
  Tex.cellUV = function (name) {
    const c = CELLS[name] || CELLS.blank;
    // texture v=0 at bottom (flipY)
    const pad = 0.5 / 2048;
    return [c[0] / COLS + pad, 1 - (c[1] + 1) / ROWS + pad, (c[0] + 1) / COLS - pad, 1 - c[1] / ROWS - pad];
  };

  // ------------------------------------------------------------------ shared GLSL
  const NOISE = `
    float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  `;
  // wall types: 0 brick, 1 stucco, 2 flint, 3 stock brick, 4 render, 5 stone ashlar, 6 painted timber, 7 plain
  const WALL = `
    vec3 wallPattern(vec2 uv, float wt, vec3 base){
      float aa = clamp(1.0 - length(fwidth(uv))*9.0, 0.0, 1.0);
      if (wt < 0.5 || (wt > 2.5 && wt < 3.5)) {
        float row = floor(uv.y/0.075);
        float off = mod(row,2.0)*0.11;
        float bx = floor((uv.x+off)/0.22);
        vec2 f = vec2(fract((uv.x+off)/0.22), fract(uv.y/0.075));
        float mortar = (1.0 - smoothstep(0.0,0.06,f.y)*smoothstep(1.0,0.94,f.y)*smoothstep(0.0,0.03,f.x)*smoothstep(1.0,0.97,f.x));
        float v = h21(vec2(bx,row));
        vec3 b = base*(0.82+0.32*v);
        b = mix(b, vec3(0.78,0.75,0.68), mortar*0.55*aa);
        return mix(base, b, aa) * (0.94 + 0.08*vnoise(uv*1.3));
      } else if (wt < 1.5) {
        float n = vnoise(uv*2.0)*0.06 + vnoise(uv*9.0)*0.03;
        float streak = vnoise(vec2(uv.x*3.0, uv.y*0.4))*0.05;
        return base*(0.96 + n - streak);
      } else if (wt < 2.5) {
        // flint: packed nodules (Worley cells, about 11 x 9 cm) in pale lime mortar
        vec2 q = uv*vec2(9.0, 11.0);
        vec2 qi = floor(q), qf = fract(q);
        float d1 = 8.0, d2 = 8.0; vec2 id = qi;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(float(x), float(y));
          vec2 r = g + vec2(h21(qi + g), h21(qi + g + 17.3))*0.8 + 0.1 - qf;
          float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; id = qi + g; } else if (d < d2) { d2 = d; }
        }
        float nod = smoothstep(0.05, 0.2, sqrt(d2) - sqrt(d1));
        float hv = h21(id + 3.1);
        vec3 fl = mix(vec3(0.11,0.12,0.14), vec3(0.38,0.37,0.35), hv*hv);
        fl = mix(fl, vec3(0.74,0.72,0.66), step(0.92, hv)*0.6);
        fl *= 0.8 + 0.35*(1.0 - sqrt(d1));
        vec3 mortar = mix(vec3(0.80,0.78,0.72), base, 0.25);
        float aaF = clamp(1.0 - length(fwidth(q))*1.2, 0.0, 1.0);
        vec3 avg = mix(mortar, vec3(0.24,0.24,0.25), 0.6);
        vec3 c = mix(avg, mix(mortar, fl, nod), aaF);
        return c*(0.94+0.1*vnoise(uv*0.7));
      } else if (wt < 4.5) {
        return base*(0.97 + vnoise(uv*1.5)*0.05);
      } else if (wt < 5.5) {
        float row = floor(uv.y/0.35);
        float off = mod(row,2.0)*0.3;
        vec2 f = vec2(fract((uv.x+off)/0.6), fract(uv.y/0.35));
        float j = 1.0 - smoothstep(0.0,0.04,f.y)*smoothstep(0.0,0.02,f.x);
        return base*(0.95+0.08*h21(floor(vec2((uv.x+off)/0.6,row)))) * (1.0 - j*0.18*aa);
      }
      return base;
    }
  `;
  // roof types: 0 clay tile, 1 slate, 2 flat felt, 3 lead, 4 modern tile
  const ROOF = `
    vec3 roofPattern(vec2 uv, float rt, vec3 base){
      float aa = clamp(1.0 - length(fwidth(uv))*7.0, 0.0, 1.0);
      if (rt < 0.5 || rt > 3.5) {
        float rh = rt > 3.5 ? 0.32 : 0.11; float rw = rt > 3.5 ? 0.3 : 0.17;
        float row = floor(uv.y/rh);
        float off = mod(row,2.0)*rw*0.5;
        vec2 f = vec2(fract((uv.x+off)/rw), fract(uv.y/rh));
        float v = h21(vec2(floor((uv.x+off)/rw), row));
        float edge = smoothstep(0.0,0.18,f.y);
        vec3 c = base*(0.8+0.35*v)*(0.75+0.25*edge);
        float moss = smoothstep(0.62,0.85,vnoise(uv*0.9))*0.35;
        c = mix(c, vec3(0.32,0.36,0.22), moss);
        return mix(base*0.95, c, aa);
      } else if (rt < 1.5) {
        float row = floor(uv.y/0.22);
        float off = mod(row,2.0)*0.15;
        vec2 f = vec2(fract((uv.x+off)/0.3), fract(uv.y/0.22));
        float v = h21(vec2(floor((uv.x+off)/0.3), row));
        vec3 c = base*(0.85+0.22*v)*(0.8+0.2*smoothstep(0.0,0.12,f.y));
        return mix(base, c, aa);
      } else if (rt < 2.5) {
        return base*(0.9+0.15*vnoise(uv*0.8));
      }
      float f = fract(uv.x/0.6);
      float roll = smoothstep(0.0,0.08,f)*smoothstep(1.0,0.92,f);
      return base*(0.85+0.15*roll)*(0.95+0.08*vnoise(uv*0.5));
    }
  `;
  Tex.GLSL = { NOISE, WALL, ROOF };

  // Shared time-wave uniforms for era transitions (collapse/grow buildings around a moving ring)
  Tex.wave = { uWaveCenter: { value: new THREE.Vector2(0, 0) }, uWaveRadius: { value: 0 } };
  const WAVE_VERT = `
    uniform vec2 uWaveCenter; uniform float uWaveRadius; uniform float uWaveMode;
    float waveK(vec2 p){
      if (uWaveMode == 0.0) return 1.0;
      float d = distance(p, uWaveCenter);
      float inside = 1.0 - smoothstep(uWaveRadius - 10.0, uWaveRadius, d);
      return uWaveMode > 0.0 ? inside : 1.0 - inside;
    }
  `;
  Tex.WAVE_VERT = WAVE_VERT;

  // Patch a MeshLambertMaterial into a facade material:
  // attributes: color (wall tint), uv (bay/floor units, tiled with fract), aWall (u,v metres, wall type),
  // aCell (atlas col, row (-1 = plain wall), building seed), aBase (ground y for the time-wave collapse)
  Tex.facadeMaterial = function (atlas, eraUniforms) {
    if (SA.PBR && SA.PBR.ready) return facadePBR(atlas, eraUniforms);
    const m = new THREE.MeshLambertMaterial({ map: atlas.map, emissiveMap: atlas.glow, emissive: 0xffc070, vertexColors: true });
    m.userData.era = eraUniforms;
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uWaveCenter = Tex.wave.uWaveCenter;
      sh.uniforms.uWaveRadius = Tex.wave.uWaveRadius;
      sh.uniforms.uWaveMode = eraUniforms.uWaveMode;
      sh.uniforms.uNight = eraUniforms.uNight;
      sh.uniforms.uLitFrac = eraUniforms.uLitFrac;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aWall; attribute vec3 aCell; attribute float aBase; varying vec3 vWall; varying vec3 vCell; varying vec2 vLocal;\n' + WAVE_VERT)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWall = aWall; vCell = aCell; vLocal = uv;\n float wk = waveK(position.xz); transformed.y = mix(aBase - 1.0, transformed.y, wk);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWall; varying vec3 vCell; varying vec2 vLocal; uniform float uNight; uniform float uLitFrac;\n' + NOISE + WALL)
        .replace('#include <map_fragment>', `
          vec4 feat = vec4(0.0);
          float glowm = 0.0;
          if (vCell.x >= 0.0) {
            vec2 cs = vec2(0.125, 0.25);
            vec2 lf = fract(vLocal);
            vec2 auv = vec2(vCell.x*cs.x, 1.0 - (vCell.y + 1.0)*cs.y) + (lf*0.994 + 0.003)*cs;
            vec2 gx = dFdx(vLocal)*cs, gy = dFdy(vLocal)*cs;
            feat = textureGrad(map, auv, gx, gy);
            glowm = textureGrad(emissiveMap, auv, gx, gy).r;
          }
          vec3 wallc = wallPattern(vWall.xy, vWall.z, vColor.rgb);
          diffuseColor.rgb = mix(wallc, feat.rgb, feat.a);
          diffuseColor.rgb *= 0.86 + 0.14*smoothstep(-0.2, 1.2, vWall.y);
        `)
        .replace('#include <color_fragment>', '')
        .replace('#include <emissivemap_fragment>', `
          // lit or dark per window bay. Round the building seed first: the interpolated varying
          // differs by tiny amounts per pixel, which made the hash flicker into speckles.
          float sd = floor(vCell.z * 997.0 + 0.5);
          float litBay = step(h21(floor(vLocal) + vec2(sd * 0.113, sd * 0.007)), uLitFrac);
          totalEmissiveRadiance *= glowm * litBay * uNight;
        `);
    };
    m.customProgramCacheKey = () => 'facade';
    return m;
  };
  Tex.roofMaterial = function (eraUniforms) {
    if (SA.PBR && SA.PBR.ready) return roofPBR(eraUniforms);
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uWaveCenter = Tex.wave.uWaveCenter;
      sh.uniforms.uWaveRadius = Tex.wave.uWaveRadius;
      sh.uniforms.uWaveMode = eraUniforms.uWaveMode;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aWall; attribute float aBase; varying vec3 vWall;\n' + WAVE_VERT)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWall = aWall; float wk = waveK(position.xz); transformed.y = mix(aBase - 1.0, transformed.y, wk);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWall;\n' + NOISE + ROOF)
        .replace('#include <color_fragment>', 'diffuseColor.rgb = roofPattern(vWall.xy, vWall.z, vColor.rgb);');
    };
    m.customProgramCacheKey = () => 'roof';
    return m;
  };
  // ------------------------------------------------------------------ scanned (PBR) facades and roofs
  // Physically based versions of the two materials above, used when SA.PBR has loaded its texture
  // arrays. Walls and roofs sample a scan by wall type in metres, recoloured to the building's own
  // colour; window glass is glossy, so it reflects the sky; ambient occlusion and normals come from
  // the scans. The Lambert versions above remain the fallback.
  const PBR_SHARED_FRAG = `
    // wall type -> texture layer. Red brick alternates between two scans by building.
    float wallLayer(float wt, float sd) {
      if (wt < 0.5) return h21(vec2(sd * 0.37, 5.1)) < 0.45 ? L_BRICK_DARK : L_BRICK;
      if (wt < 1.5) return L_STUCCO;
      if (wt < 2.5) return L_FLINT;
      if (wt < 3.5) return L_STOCK_BRICK;
      if (wt < 4.5) return L_RENDER;
      return L_STUCCO;
    }
    float roofLayer(float rt) {
      if (rt < 0.5) return L_CLAY_TILE;
      if (rt < 1.5) return L_SLATE;
      if (rt < 2.5) return L_FELT;
      if (rt < 3.5) return L_LEAD;
      return L_CLAY_TILE;
    }
  `;
  function pbrCommon(sh, eraUniforms) {
    Object.assign(sh.uniforms, SA.PBR.uniforms);
    sh.uniforms.uWaveCenter = Tex.wave.uWaveCenter;
    sh.uniforms.uWaveRadius = Tex.wave.uWaveRadius;
    sh.uniforms.uWaveMode = eraUniforms.uWaveMode;
    sh.uniforms.uWeather = eraUniforms.uWeather || { value: 0 };
  }
  // Window openings set back into the wall (256-unit cell coordinates, y down). Other cells keep
  // their glass on the wall plane but still show a room behind it.
  const OPENINGS = { sash6: [80, 46, 176, 194], sash2: [78, 52, 178, 196], casement: [70, 72, 186, 174], modern: [40, 44, 216, 212], timberWin: [92, 36, 164, 120], band60: [0, 56, 256, 164], smallsq: [94, 84, 162, 166] };
  function openingTable() {
    const t = [];
    for (let i = 0; i < COLS * ROWS; i++) t.push(new THREE.Vector4(0, 0, 0, 0));
    for (const k in OPENINGS) {
      const c = CELLS[k], o = OPENINGS[k];
      t[c[1] * COLS + c[0]].set(o[0] / 256, 1 - o[3] / 256, o[2] / 256, 1 - o[1] / 256);
    }
    return t;
  }
  // Interior mapping: the room behind each window is traced in the shader (back wall, side walls,
  // floor and ceiling, a piece of furniture, shelves in shops), lit by daylight from the window
  // or, at night, by a lamp in lit rooms. Glass is glossy, so the sky reflects over it.
  const INTERIOR_GLSL = `
    uniform vec4 uOpen[${COLS * ROWS}];
    uniform float uEra, uBoost;
    float roomKind(vec2 cell) { // 0 home, 1 shop or pub, 2 office
      if (cell.y > 1.5 && cell.y < 2.5) return 1.0;
      if (cell.y > 2.5 && cell.x < 1.5) return 1.0;
      if (cell.y < 0.5 && (abs(cell.x - 3.0) < 0.5 || abs(cell.x - 6.0) < 0.5)) return 2.0;
      if (abs(cell.y - 1.0) < 0.5 && abs(cell.x - 6.0) < 0.5) return 2.0;
      return 0.0;
    }
    vec3 eraWallpaper(float s) {
      vec3 a, b, c;
      if (uEra < 1900.0) { a = vec3(0.26, 0.07, 0.05); b = vec3(0.10, 0.17, 0.10); c = vec3(0.36, 0.28, 0.16); }
      else if (uEra < 2000.0) { a = vec3(0.52, 0.38, 0.18); b = vec3(0.17, 0.33, 0.34); c = vec3(0.58, 0.53, 0.43); }
      else { a = vec3(0.76, 0.75, 0.72); b = vec3(0.50, 0.54, 0.56); c = vec3(0.66, 0.58, 0.48); }
      return s < 0.34 ? a : s < 0.67 ? b : c;
    }
    vec3 eraCurtain(float s) {
      if (uEra < 1900.0) return s < 0.5 ? vec3(0.32, 0.05, 0.05) : vec3(0.10, 0.20, 0.12);
      if (uEra < 2000.0) return s < 0.5 ? vec3(0.62, 0.42, 0.14) : vec3(0.80, 0.78, 0.70);
      return s < 0.5 ? vec3(0.78, 0.78, 0.76) : vec3(0.28, 0.30, 0.34);
    }
    // p: where the ray meets the glass, metres from the room's lower left corner;
    // dir: the ray into the room in the wall's frame (x right, y up, z out of the wall)
    // shop shelving: boards every 45 cm, stocked with goods of varied widths, heights and colours
    vec3 shopShelves(vec2 q, float seed, vec3 back) {
      float row = floor(q.y / 0.45), fy = fract(q.y / 0.45);
      float k = 2.5 + 4.5 * h21(vec2(row, seed));
      float ix = floor(q.x * k + row * 0.37), fx = fract(q.x * k + row * 0.37);
      float hsh = h21(vec2(ix + row * 17.0, seed + 3.3));
      float top = 0.4 + 0.5 * h21(vec2(ix, row + seed));
      // each shop keeps to its own range of colours, muted like packaging and spines
      vec3 goods = 0.55 + 0.45 * cos(6.2832 * (h21(vec2(seed, 5.5)) + hsh * 0.4 + vec3(0.0, 0.33, 0.67)));
      goods = mix(vec3(dot(goods, vec3(0.3, 0.59, 0.11))), goods, 0.5) * (0.2 + 0.3 * h21(vec2(ix, row * 3.1 + seed)));
      float item = step(0.09, fy) * step(fy, 0.09 + top * 0.88) * step(0.06, fx) * step(h21(vec2(ix, row + 9.1)), 0.9);
      vec3 c = mix(back * 0.32, goods, item);
      return mix(c, vec3(0.5, 0.45, 0.38), step(fy, 0.07));
    }
    vec3 interiorRoom(vec2 p, vec3 dir, vec2 room, float depth, float seed, float kind, float lamp, float day) {
      dir.x = abs(dir.x) < 1e-4 ? 1e-4 : dir.x;
      dir.y = abs(dir.y) < 1e-4 ? 1e-4 : dir.y;
      dir.z = min(dir.z, -1e-3);
      float tx = ((dir.x > 0.0 ? room.x : 0.0) - p.x) / dir.x;
      float ty = ((dir.y > 0.0 ? room.y : 0.0) - p.y) / dir.y;
      float tz = -depth / dir.z;
      float t = min(min(tx, ty), tz);
      vec3 hp = vec3(p + dir.xy * t, dir.z * t);
      float s1 = h21(vec2(seed, 3.1)), s2 = h21(vec2(seed, 7.7)), s3 = h21(vec2(seed, 1.9));
      vec3 paper = kind > 1.5 ? vec3(0.56, 0.57, 0.56) : kind > 0.5 ? vec3(0.46, 0.43, 0.38) * (0.85 + 0.3 * s1) : eraWallpaper(s1);
      vec3 c;
      if (t == tz) {
        c = paper;
        if (kind < 0.5) {
          float fx = (0.2 + 0.6 * s2) * room.x;
          if (abs(hp.x - fx) < 0.35 + 0.35 * s3 && hp.y < 0.75 + 0.9 * s3) c = vec3(0.08, 0.055, 0.035);
          else if (abs(hp.x - (room.x - fx)) < 0.28 && abs(hp.y - 1.75) < 0.22) c = mix(vec3(0.45, 0.38, 0.22), vec3(0.18, 0.22, 0.28), s2);
        } else if (kind < 1.5) {
          if (hp.y < 2.1) c = shopShelves(hp.xy, seed, paper);
        } else if (abs(hp.x - room.x * (0.3 + 0.4 * s2)) < 0.45 && hp.y < 2.1) c = vec3(0.1);
      } else if (t == ty) {
        c = dir.y > 0.0 ? vec3(0.76, 0.74, 0.70) : (kind > 0.5 ? vec3(0.30, 0.28, 0.26) : vec3(0.13, 0.085, 0.05) * (0.8 + 0.4 * s3));
      } else {
        c = paper * 0.8;
        // shops: shelving along the side walls too
        if (kind > 0.5 && kind < 1.5 && hp.y < 2.1) c = shopShelves(vec2(hp.z, hp.y), seed + 0.5, paper) * 0.85;
      }
      // shop floors: chequered tiles in 1964, boards in 1897
      if (t == ty && dir.y < 0.0 && kind > 0.5 && kind < 1.5) {
        if (uEra > 1950.0 && uEra < 2000.0) c = mix(vec3(0.08), vec3(0.62, 0.6, 0.55), mod(floor(hp.x * 3.3) + floor(hp.z * 3.3), 2.0));
        else if (uEra < 1900.0) c = vec3(0.2, 0.13, 0.08) * (0.8 + 0.3 * h21(vec2(floor(hp.x * 6.0), 1.0)));
      }
      vec3 dl = hp - vec3(room.x * 0.5, room.y - 0.35, -depth * 0.45);
      float fall = 1.0 / (1.0 + dot(dl, dl) * 0.45);
      vec3 lampCol = kind > 0.5 && uEra > 1950.0 ? vec3(0.95, 0.97, 1.0) : vec3(1.0, 0.64, 0.33);
      return c * (lampCol * lamp * (0.3 + 1.7 * fall) + vec3(0.85, 0.9, 1.0) * day * exp(hp.z * 0.3));
    }
  `;
  function facadePBR(atlas, eraUniforms) {
    const m = new THREE.MeshStandardMaterial({ map: atlas.map, emissiveMap: atlas.glow, emissive: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0 });
    m.userData.era = eraUniforms;
    const open = openingTable();
    m.onBeforeCompile = function (sh) {
      pbrCommon(sh, eraUniforms);
      sh.uniforms.uNight = eraUniforms.uNight;
      sh.uniforms.uLitFrac = eraUniforms.uLitFrac;
      sh.uniforms.uEra = eraUniforms.uEra || { value: 2026 };
      sh.uniforms.uBoost = eraUniforms.uBoost || { value: 1 };
      sh.uniforms.uOpen = { value: open };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aWall; attribute vec3 aCell; attribute float aBase; varying vec3 vWall; varying vec3 vCell; varying vec2 vLocal;\n' + WAVE_VERT)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWall = aWall; vCell = aCell; vLocal = uv;\n float wk = waveK(position.xz); transformed.y = mix(aBase - 1.0, transformed.y, wk);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWall; varying vec3 vCell; varying vec2 vLocal; uniform float uNight; uniform float uLitFrac; uniform float uWeather;\n' + NOISE + SA.PBR.glsl + PBR_SHARED_FRAG + INTERIOR_GLSL)
        .replace('#include <map_fragment>', `
          // round the building seed first: the interpolated varying differs per pixel
          float sd = floor(vCell.z * 997.0 + 0.5);
          // the wall's frame (x along the wall, y up, z out) and the view direction in it
          mat3 fT = pbrTBN(-vViewPosition, normalize(vNormal), vWall.xy);
          vec3 Vv = normalize(vViewPosition);
          vec3 vt = vec3(dot(Vv, fT[0]), dot(Vv, fT[1]), dot(Vv, fT[2]));
          vec2 dLx = dFdx(vLocal), dLy = dFdy(vLocal);
          vec2 cellM = vec2(3.0, 3.0);
          vec2 lf = fract(vLocal);
          vec2 lq = lf;
          vec4 op = vec4(0.0);
          vec4 feat = vec4(0.0);
          float glowm = 0.0, reveal = 0.0, inOpen = 0.0;
          if (vCell.x >= 0.0) {
            op = uOpen[int(vCell.y + 0.5) * ${COLS} + int(vCell.x + 0.5)];
            if (op.z > op.x && lf.x > op.x && lf.x < op.z && lf.y > op.y && lf.y < op.w) {
              // the window sits 12 cm back: follow the view ray to its plane; if the ray leaves the
              // opening first, this pixel shows the reveal (the side of the opening)
              inOpen = 1.0;
              vec2 q = lf - vt.xy / max(vt.z, 0.2) * 0.12 / cellM;
              if (q.x < op.x || q.x > op.z || q.y < op.y || q.y > op.w) reveal = 1.0;
              lq = clamp(q, op.xy + 0.002, op.zw - 0.002);
            }
            vec2 cs = vec2(0.125, 0.25);
            vec2 auv = vec2(vCell.x*cs.x, 1.0 - (vCell.y + 1.0)*cs.y) + (lq*0.994 + 0.003)*cs;
            feat = textureGrad(map, auv, dLx*cs, dLy*cs);
            glowm = textureGrad(emissiveMap, auv, dLx*cs, dLy*cs).r;
          }
          float wL = wallLayer(vWall.z, sd);
          // each building starts the scan at its own offset, so neighbours never line up
          vec2 wm = vWall.xy + vec2(h21(vec2(sd, 1.7)) * 9.0, h21(vec2(sd, 4.3)) * 0.6);
          vec3 tuv = pbrUV(wm, wL);
          vec4 pa = texture(tPbrA, tuv);
          vec4 pb = texture(tPbrB, tuv);
          vec3 wallc = pbrRecolour(pa.rgb, vColor.rgb, wL);
          // weathering: soot and splash-back towards the pavement, slow streaks down the face
          float streak = vnoise(vec2(wm.x * 1.7, wm.y * 0.08)) * 0.5 + vnoise(wm * vec2(0.6, 0.3)) * 0.5;
          float grime = (1.0 - smoothstep(0.0, 1.1, vWall.y)) * 0.28 + streak * 0.14 * smoothstep(0.4, 1.0, streak);
          wallc *= 1.0 - grime;
          vec3 surf = mix(mix(wallc, feat.rgb, feat.a), wallc * 0.45, reveal);
          float glass = glowm * (1.0 - reveal);
          // the room behind the glass
          float roomSeed = h21(floor(vLocal) + vec2(sd * 0.113, sd * 0.007));
          float litBay = step(roomSeed, uLitFrac);
          vec3 roomRad = vec3(0.0);
          float curtain = 0.0;
          if (glass > 0.01) {
            float kind = roomKind(vCell.xy);
            float lamp = litBay * uNight * uBoost * 1.6 + (kind > 0.5 && uEra > 1950.0 ? (1.0 - uNight) * 0.32 : 0.0);
            float day = (1.0 - smoothstep(0.0, 0.6, uNight)) * 0.42 + 0.008;
            roomRad = interiorRoom(lq * cellM, -vt, cellM, kind > 0.5 ? 6.0 : 4.0, roomSeed * 91.0 + sd, kind, lamp, day);
            // curtains across the sides of some windows, glowing when the lamp behind is lit
            if (kind < 0.5 && op.z > op.x && h21(vec2(roomSeed, 5.3)) < 0.6) {
              float wx = (lq.x - op.x) / (op.z - op.x);
              float cl = 0.06 + 0.2 * h21(vec2(roomSeed, 8.1)), cr = 0.06 + 0.2 * h21(vec2(roomSeed, 2.6));
              curtain = (step(wx, cl) + step(1.0 - cr, wx)) * (0.85 + 0.15 * sin(lq.x * 260.0));
              vec3 cc = eraCurtain(h21(vec2(roomSeed, 4.4)));
              surf = mix(surf, cc * 0.55, curtain * glass);
              roomRad = mix(roomRad, cc * vec3(1.0, 0.64, 0.33) * lamp * 0.5, curtain);
            }
            roomRad *= glass * (1.0 - curtain);
          }
          diffuseColor.rgb = mix(surf, vec3(0.004), glass * (1.0 - curtain));
          float pbrAO = mix(mix(pa.a, 1.0, feat.a), 0.6, reveal);
          float pbrRough = mix(mix(pb.z, 0.6, feat.a), mix(0.04, 0.9, curtain), glass);
          vec4 pbrB = pb;
          float pbrFlat = max(feat.a, inOpen) * (1.0 - reveal);
          float pbrL = wL;
        `)
        .replace('#include <color_fragment>', '')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = pbrRough;')
        .replace('#include <normal_fragment_maps>', `
          normal = normalize(fT * pbrTangentNormal(pbrB, pbrL, 1.0 - pbrFlat));
        `)
        .replace('#include <emissivemap_fragment>', `
          totalEmissiveRadiance = roomRad;
        `)
        .replace('#include <lights_fragment_end>', `
          // glass mirrors the street: the buildings opposite up to their rooflines, then the sky
          // (the environment map alone is all sky, which leaves every pane a flat bright sheet)
          #ifdef USE_ENVMAP
          float gR = glass * (1.0 - curtain);
          if (gR > 0.01) {
            vec3 rW = inverseTransformDirection(reflect(-geometryViewDir, geometryNormal), viewMatrix);
            vec3 nW = inverseTransformDirection(geometryNormal, viewMatrix);
            float hz = max(length(rW.xz), 1e-3);
            // a glancing ray runs a long way down the street before it meets a wall
            float across = max(dot(rW.xz, nW.xz) / (hz * max(length(nW.xz), 1e-3)), 0.06);
            float hOpp = 7.5 + 8.0 * vnoise(vec2(vWall.x * 0.06 + sd, 3.1));
            float rise = (hOpp - vWall.y) * across / 14.0;
            float skyV = smoothstep(rise - 0.03, rise + 0.03, rW.y / hz);
            float alb = 0.14 + 0.16 * vnoise(vec2(vWall.x * 0.9 + rW.x * 3.0, rW.y * 6.0));
            vec3 farE = irradiance + iblIrradiance;
            #if NUM_DIR_LIGHTS > 0
              farE += directionalLights[0].color * max(dot(-geometryNormal, directionalLights[0].direction), 0.0) * 0.7;
            #endif
            radiance = mix(radiance, mix(farE * RECIPROCAL_PI * alb, radiance, skyV), gR);
          }
          #endif
          #include <lights_fragment_end>
        `)
        .replace('#include <aomap_fragment>', `
          reflectedLight.indirectDiffuse *= pbrAO;
          reflectedLight.indirectSpecular *= pbrAO * pbrAO;
          reflectedLight.directDiffuse *= mix(1.0, pbrAO, 0.4);
        `);
    };
    m.customProgramCacheKey = () => 'facade-pbr';
    return m;
  }
  function roofPBR(eraUniforms) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    m.onBeforeCompile = function (sh) {
      pbrCommon(sh, eraUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aWall; attribute float aBase; varying vec3 vWall;\n' + WAVE_VERT)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWall = aWall; float wk = waveK(position.xz); transformed.y = mix(aBase - 1.0, transformed.y, wk);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWall; uniform float uWeather;\n' + NOISE + SA.PBR.glsl + PBR_SHARED_FRAG)
        .replace('#include <color_fragment>', `
          float rL = roofLayer(vWall.z);
          vec3 tuv = pbrUV(vWall.xy, rL);
          vec4 pa = texture(tPbrA, tuv);
          vec4 pb = texture(tPbrB, tuv);
          vec3 rc = pbrRecolour(pa.rgb, vColor.rgb, rL);
          // lichen and moss on the old clay and slate, thickest towards the eaves
          float mossN = vnoise(vWall.xy * 0.55) * 0.6 + vnoise(vWall.xy * 2.3) * 0.4;
          float moss = smoothstep(0.55, 0.85, mossN) * (rL == L_CLAY_TILE ? 0.45 : rL == L_SLATE ? 0.25 : 0.0) * (1.0 - smoothstep(0.0, 4.0, vWall.y) * 0.5);
          rc = mix(rc, vec3(0.16, 0.18, 0.09) * (0.7 + 0.6 * pa.g), moss);
          diffuseColor.rgb = rc * (0.92 + 0.16 * vnoise(vWall.xy * 0.21));
          float pbrAO = pa.a;
          float pbrRough = min(1.0, pb.z + moss * 0.2);
          vec4 pbrB = pb;
          vec2 pbrM = tuv.xy;
        `)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = pbrRough;')
        .replace('#include <normal_fragment_maps>', `
          normal = normalize(pbrTBN(-vViewPosition, normal, pbrM) * pbrTangentNormal(pbrB, rL, 1.0));
        `)
        .replace('#include <aomap_fragment>', `
          reflectedLight.indirectDiffuse *= pbrAO;
          reflectedLight.indirectSpecular *= pbrAO * pbrAO;
          reflectedLight.directDiffuse *= mix(1.0, pbrAO, 0.5);
        `);
    };
    m.customProgramCacheKey = () => 'roof-pbr';
    return m;
  }

  // Plain vertex-coloured material that also obeys the time wave (signs, props merged geometry)
  Tex.waveMaterial = function (eraUniforms, opts) {
    opts = opts || {};
    const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.8, metalness: 0 }, opts));
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uWaveCenter = Tex.wave.uWaveCenter;
      sh.uniforms.uWaveRadius = Tex.wave.uWaveRadius;
      sh.uniforms.uWaveMode = eraUniforms.uWaveMode;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aBase;\n' + WAVE_VERT)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n float wk = waveK(position.xz); transformed.y = mix(aBase - 1.0, transformed.y, wk);');
    };
    m.customProgramCacheKey = () => 'wave' + (opts.map ? 'm' : '') + (opts.emissive ? 'e' : '');
    return m;
  };

  // Instanced props/chimneys/trees: collapse each instance around its origin when outside the wave
  Tex.patchInstancedWave = function (m, eraUniforms) {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = function (sh) {
      if (prev) prev(sh);
      sh.uniforms.uWaveCenter = Tex.wave.uWaveCenter;
      sh.uniforms.uWaveRadius = Tex.wave.uWaveRadius;
      sh.uniforms.uWaveMode = eraUniforms.uWaveMode;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + WAVE_VERT)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 io = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
            transformed *= max(waveK(io), 0.0001);
          #endif`);
    };
    m.customProgramCacheKey = () => 'instwave-' + m.type + (m.vertexColors ? 'v' : '');
    return m;
  };

  // ------------------------------------------------------------------ sign atlas (per era)
  // Shelf-packed 2048 x 2048 canvas holding fascia signs, plaques, posters and banners.
  // Signs are packed on a tall canvas; finish() crops it to the rows actually used, so an era
  // with few signs costs less texture memory and a busy one (1897) never runs out of room.
  Tex.SignAtlas = function (size, maxH) {
    const S = size || 2048;
    this.size = S;
    this.maxH = maxH || S;
    this.cv = document.createElement('canvas');
    this.cv.width = S;
    this.cv.height = this.maxH;
    this.ctx = this.cv.getContext('2d');
    this.x = 0;
    this.y = 0;
    this.rowH = 0;
    this.texture = null;
    this.full = false;
  };
  Tex.SignAtlas.prototype.allocRect = function (w, h) {
    const S = this.size;
    w = Math.min(w, S);
    if (this.x + w > S) {
      this.x = 0;
      this.y += this.rowH + 2;
      this.rowH = 0;
    }
    if (this.y + h > this.maxH) {
      this.full = true;
      console.warn('[SA] sign atlas full: a sign was dropped');
      return null;
    }
    const r = { x: this.x, y: this.y, w, h };
    this.x += w + 2;
    if (h > this.rowH) this.rowH = h;
    return r;
  };
  Tex.SignAtlas.prototype.alloc = function () {
    return this.allocRect(256, 48);
  };
  Tex.SignAtlas.prototype.allocSquare = function (w, h) {
    return this.allocRect(w || 128, h || 128);
  };
  Tex.SignAtlas.prototype.uv = function (r) {
    const S = this.size, H = this.maxH;
    return [(r.x + 0.5) / S, 1 - (r.y + r.h - 0.5) / H, (r.x + r.w - 0.5) / S, 1 - (r.y + 0.5) / H];
  };
  // style: {bg, fg, font, border, gilt, script, upper}
  Tex.SignAtlas.prototype.text = function (text, style, w, h) {
    const r = this.allocRect(w || 256, h || 48);
    if (!r) return null;
    const c = this.ctx;
    style = style || {};
    c.save();
    c.fillStyle = style.bg || '#1f3a2a';
    c.fillRect(r.x, r.y, r.w, r.h);
    if (style.border) {
      c.strokeStyle = style.border;
      c.lineWidth = 5;
      c.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
    }
    if (style.shade !== false) {
      const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.18)');
      c.fillStyle = g;
      c.fillRect(r.x, r.y, r.w, r.h);
    }
    let t = style.upper === false ? text : text.toUpperCase();
    let fs = Math.floor(r.h * (style.scale || 0.56));
    const fam = style.font || 'Georgia, "Times New Roman", serif';
    const weight = style.weight || 'bold';
    c.font = `${style.italic ? 'italic ' : ''}${weight} ${fs}px ${fam}`;
    while (c.measureText(t).width > r.w * 0.9 && fs > 10) {
      fs -= 2;
      c.font = `${style.italic ? 'italic ' : ''}${weight} ${fs}px ${fam}`;
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (style.gilt) {
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillText(t, r.x + r.w / 2 + 2, r.y + r.h / 2 + 3);
    }
    c.fillStyle = style.fg || '#f2e6c4';
    if (style.letterSpacing) c.letterSpacing = style.letterSpacing;
    c.fillText(t, r.x + r.w / 2, r.y + r.h / 2 + 2);
    c.restore();
    return this.uv(r);
  };
  // free-form drawing into a square slot (plaques, posters, hanging signs)
  Tex.SignAtlas.prototype.square = function (fn, w, h) {
    const r = this.allocSquare(w, h);
    if (!r) return null;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(r.x, r.y, r.w, r.h);
    this.ctx.clip();
    this.ctx.translate(r.x, r.y);
    fn(this.ctx, r.w, r.h);
    this.ctx.restore();
    return this.uv(r);
  };
  Tex.SignAtlas.prototype.finish = function () {
    // crop to the used rows; UVs were computed for the full height, so map them with the
    // texture transform: v' = v * k + (1 - k), k = fullHeight / croppedHeight
    const used = Math.min(this.maxH, Math.max(128, Math.ceil((this.y + this.rowH + 2) / 128) * 128));
    let cv = this.cv;
    if (used < this.maxH) {
      cv = document.createElement('canvas');
      cv.width = this.size;
      cv.height = used;
      cv.getContext('2d').drawImage(this.cv, 0, 0);
      this.cv = cv;
      this.ctx = cv.getContext('2d');
    }
    const t = new THREE.CanvasTexture(cv);
    const k = this.maxH / used;
    t.repeat.set(1, k);
    t.offset.set(0, 1 - k);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    this.texture = t;
    this.usedHeight = used;
    return t;
  };

  // ------------------------------------------------------------------ misc canvases
  Tex.grainDataURL = function () {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const img = c.createImageData(128, 128);
    const r = U.rng(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 40;
    }
    c.putImageData(img, 0, 0);
    return cv.toDataURL();
  };
  // soft round sprite (lamp glow, dust)
  Tex.glowTexture = function () {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    return t;
  };
})();
