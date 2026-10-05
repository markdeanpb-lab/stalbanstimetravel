/* Unified input: keyboard + mouse, touch (virtual stick, camera drag, contextual buttons) and gamepad. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;

  const ACTIONS = ['interact', 'vehicle', 'timekey', 'sprint', 'brake', 'horn', 'map', 'pause', 'camreset', 'eraPrev', 'eraNext', 'journal', 'photo'];
  const KEYMAP = {
    KeyE: 'interact', Enter: 'interact', KeyF: 'vehicle', KeyQ: 'timekey', KeyT: 'timekey',
    ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'brake', KeyH: 'horn', KeyM: 'map',
    Escape: 'pause', KeyP: 'pause', KeyC: 'camreset', Digit1: 'eraPrev', Digit2: 'eraNext', KeyZ: 'eraPrev', KeyX: 'eraNext',
    KeyJ: 'journal', KeyV: 'photo',
  };
  const MOVEKEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

  const I = (SA.Input = {
    move: { x: 0, y: 0 },
    look: { dx: 0, dy: 0 }, // pixel deltas this frame (mouse/touch)
    lookStick: { x: 0, y: 0 }, // gamepad right stick
    scheme: U.isTouch() ? 'touch' : 'keyboard',
    enabled: true,
    pointerLocked: false,
    usePointerLock: !U.isTouch(),
    sensitivity: 1,
    invertY: false,
    _now: {},
    _prev: {},
    _kb: {},
    _touch: {},
    _pad: {},
    _keysDown: {},
    _wheel: 0,
  });

  I.held = (a) => !!I._now[a];
  I.pressed = (a) => !!I._now[a] && !I._prev[a];
  I.released = (a) => !I._now[a] && !!I._prev[a];
  // synthetic press for tests/automation
  I.tap = (a) => {
    I._synthetic = I._synthetic || {};
    I._synthetic[a] = 2;
  };
  I.hold = (a, on) => {
    I._kb[a] = !!on;
  };

  // ---------------------------------------------------------------- keyboard
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
    I._keysDown[e.code] = true;
    const a = KEYMAP[e.code];
    if (a) I._kb[a] = true;
    if (MOVEKEYS[e.code] || e.code === 'Space') e.preventDefault();
    if (I.scheme !== 'keyboard') setScheme('keyboard');
  });
  window.addEventListener('keyup', (e) => {
    I._keysDown[e.code] = false;
    const a = KEYMAP[e.code];
    if (a) {
      // only release if no other key for the same action is down
      let still = false;
      for (const k in KEYMAP) if (KEYMAP[k] === a && I._keysDown[k]) still = true;
      if (!still) I._kb[a] = false;
    }
  });
  window.addEventListener('blur', () => {
    I._keysDown = {};
    I._kb = {};
    I._touch = {};
  });

  // ---------------------------------------------------------------- mouse
  let dragging = false, lastX = 0, lastY = 0;
  function canvas() {
    return document.getElementById('game');
  }
  window.addEventListener('mousedown', (e) => {
    if (e.target !== canvas()) return;
    if (I.scheme === 'touch') setScheme('keyboard');
    if (I.usePointerLock && !I.pointerLocked && SA.Game && SA.Game.state === 'play') {
      const c = canvas();
      if (c.requestPointerLock) {
        try {
          const p = c.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch (err) {}
      }
    }
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => (dragging = false));
  window.addEventListener('mousemove', (e) => {
    if (I.pointerLocked) {
      I.look.dx += e.movementX || 0;
      I.look.dy += e.movementY || 0;
    } else if (dragging) {
      I.look.dx += e.clientX - lastX;
      I.look.dy += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  window.addEventListener('wheel', (e) => {
    if (e.target === canvas()) I._wheel += Math.sign(e.deltaY);
  }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    const was = I.pointerLocked;
    I.pointerLocked = document.pointerLockElement === canvas();
    if (was && !I.pointerLocked) SA.emit('pointerlock-lost');
  });

  // ---------------------------------------------------------------- touch
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const lookT = { id: null, x: 0, y: 0 };
  const STICK_R = 52;
  function setupTouch() {
    const zone = U.$('stick-zone'), lz = U.$('look-zone'), base = U.$('stick-base'), knob = U.$('stick-knob');
    if (!zone) return;
    zone.addEventListener('touchstart', (e) => {
      setScheme('touch');
      for (const t of e.changedTouches) {
        if (stick.id === null) {
          stick.id = t.identifier;
          stick.ox = t.clientX;
          stick.oy = t.clientY;
          stick.x = stick.y = 0;
          base.style.left = t.clientX - 60 + 'px';
          base.style.top = t.clientY - 60 + 'px';
          base.classList.add('on');
          knob.style.transform = 'translate(0px,0px)';
        }
      }
      e.preventDefault();
    }, { passive: false });
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) {
          let dx = t.clientX - stick.ox, dy = t.clientY - stick.oy;
          const l = Math.hypot(dx, dy);
          if (l > STICK_R) {
            dx *= STICK_R / l;
            dy *= STICK_R / l;
          }
          stick.x = dx / STICK_R;
          stick.y = -dy / STICK_R;
          knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        } else if (t.identifier === lookT.id) {
          I.look.dx += (t.clientX - lookT.x) * 1.6;
          I.look.dy += (t.clientY - lookT.y) * 1.6;
          lookT.x = t.clientX;
          lookT.y = t.clientY;
        }
      }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) {
          stick.id = null;
          stick.x = stick.y = 0;
          base.classList.remove('on');
        }
        if (t.identifier === lookT.id) lookT.id = null;
      }
    };
    zone.addEventListener('touchmove', (e) => { move(e); e.preventDefault(); }, { passive: false });
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
    lz.addEventListener('touchstart', (e) => {
      setScheme('touch');
      for (const t of e.changedTouches) {
        if (lookT.id === null) {
          lookT.id = t.identifier;
          lookT.x = t.clientX;
          lookT.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    lz.addEventListener('touchmove', (e) => { move(e); e.preventDefault(); }, { passive: false });
    lz.addEventListener('touchend', end);
    lz.addEventListener('touchcancel', end);
    // buttons (pointer events so they also work with a mouse for testing)
    document.querySelectorAll('#touch .tbtn').forEach((b) => {
      const a = b.dataset.act;
      const down = (e) => {
        I._touch[a] = true;
        b.classList.add('down');
        e.preventDefault();
        e.stopPropagation();
      };
      const up = (e) => {
        I._touch[a] = false;
        b.classList.remove('down');
        if (e) e.preventDefault();
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  function setScheme(s) {
    if (I.scheme === s) return;
    I.scheme = s;
    SA.emit('input-scheme', s);
  }
  I.setScheme = setScheme;

  // ---------------------------------------------------------------- gamepad
  const DEAD = 0.18;
  function dz(v) {
    return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD);
  }
  function pollPad() {
    I._pad = {};
    I.lookStick.x = I.lookStick.y = 0;
    I._padMove = null;
    if (!navigator.getGamepads) return;
    let pads;
    try {
      pads = navigator.getGamepads();
    } catch (e) {
      return;
    }
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
      const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
      const rt = p.buttons[7] ? p.buttons[7].value : 0, lt = p.buttons[6] ? p.buttons[6].value : 0;
      let my = -ly;
      if (rt > 0.1 || lt > 0.1) my = rt - lt; // triggers drive vehicles too
      let mx = lx;
      if (b(14)) mx = -1;
      if (b(15)) mx = 1;
      if (b(12)) my = 1;
      if (b(13)) my = -1;
      const any = Math.abs(mx) + Math.abs(my) + Math.abs(rx) + Math.abs(ry) > 0 || p.buttons.some((x) => x.pressed);
      if (any) setScheme('gamepad');
      I._padMove = [mx, my];
      I.lookStick.x = rx;
      I.lookStick.y = ry;
      I._pad.interact = b(0);
      I._pad.sprint = b(1);
      I._pad.timekey = b(2);
      I._pad.vehicle = b(3);
      I._pad.horn = b(4);
      I._pad.brake = b(5) || lt > 0.6;
      I._pad.map = b(8);
      I._pad.pause = b(9);
      I._pad.camreset = b(11);
      break;
    }
  }

  // ---------------------------------------------------------------- per-frame
  I.update = function () {
    pollPad();
    // movement
    let mx = 0, my = 0;
    for (const k in MOVEKEYS) if (I._keysDown[k]) {
      mx += MOVEKEYS[k][0];
      my += MOVEKEYS[k][1];
    }
    if (stick.id !== null) {
      mx += stick.x;
      my += stick.y;
    }
    if (I._padMove) {
      mx += I._padMove[0];
      my += I._padMove[1];
    }
    if (I._autoMove) {
      mx += I._autoMove[0];
      my += I._autoMove[1];
    }
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    I.move.x = mx;
    I.move.y = my;
    // actions
    I._prev = I._now;
    I._now = {};
    for (const a of ACTIONS) I._now[a] = !!(I._kb[a] || I._touch[a] || I._pad[a]);
    if (I._synthetic) {
      for (const a in I._synthetic) {
        if (I._synthetic[a] > 0) {
          if (I._synthetic[a] === 2) I._now[a] = true; // pressed for one frame, then released
          I._synthetic[a]--;
        }
      }
    }
    if (I._wheel) {
      if (I._wheel < 0) I._now.eraPrev = true;
      else I._now.eraNext = true;
      I._wheel = 0;
    }
    if (!I.enabled) {
      I.move.x = I.move.y = 0;
    }
  };
  I.endFrame = function () {
    I.look.dx = 0;
    I.look.dy = 0;
  };
  // automation hook: set a constant movement vector (used by tests/demo)
  I.setAutoMove = function (x, y) {
    I._autoMove = x === null ? null : [x, y];
  };

  SA.on('boot', setupTouch);
})();
