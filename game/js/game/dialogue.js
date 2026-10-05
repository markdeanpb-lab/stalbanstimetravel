/* Dialogue and subtitles. Every spoken line is subtitled with the speaker's name. Lines advance on a
   timer (reading speed) or when the player presses interact. */
(function () {
  'use strict';
  const SA = window.SA, U = SA.U;
  const D = (SA.Dialogue = { queue: [], active: null, t: 0, barkT: 0, lock: false });

  function norm(line) {
    if (Array.isArray(line)) {
      const who = SA.STORY.names[line[0]] !== undefined ? SA.STORY.names[line[0]] : line[0];
      return { who, text: line[1], key: line[0] };
    }
    return line;
  }
  // say(lines, {lock: bool (freeze player), onLine(i)}) -> Promise
  D.say = function (lines, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      D.queue.push({ lines: lines.map(norm), i: 0, opts, resolve });
      if (!D.active) D.next();
    });
  };
  D.next = function () {
    const job = D.queue[0];
    if (!job) {
      D.active = null;
      D.hide();
      if (D.lock) {
        D.lock = false;
        SA.Game.inputLocked = false;
      }
      return;
    }
    if (job.i >= job.lines.length) {
      D.queue.shift();
      job.resolve();
      D.next();
      return;
    }
    const line = job.lines[job.i];
    D.active = { job, line };
    D.t = 0;
    D.dur = Math.max(2.4, 1.0 + line.text.length / 15);
    if (job.opts.lock) {
      D.lock = true;
      SA.Game.inputLocked = true;
    }
    D.show(line.who, line.text);
    if (job.opts.onLine) job.opts.onLine(job.i, line);
    // a little "voice" blip so lines are noticeable without audio files
    if (SA.Audio && SA.Audio.ready && line.key !== 'narrator') SA.Audio.sfx('ui', undefined, undefined, 0.15);
  };
  D.show = function (who, text) {
    const el = U.$('hud-subtitle');
    U.$('sub-speaker').textContent = who ? who + ':' : '';
    U.$('sub-text').textContent = text;
    el.classList.remove('hidden');
  };
  D.hide = function () {
    U.$('hud-subtitle').classList.add('hidden');
  };
  D.busy = () => !!D.active;
  D.skipAll = function () {
    while (D.queue.length) {
      const j = D.queue.shift();
      j.resolve();
    }
    D.active = null;
    D.hide();
    D.lock = false;
    SA.Game.inputLocked = false;
  };
  // short ambient line; ignored while a conversation is running
  D.bark = function (who, text, ch) {
    if (D.active || D.barkT > 0) return false;
    D.show(who, text);
    D.barkT = Math.max(2.2, 0.8 + text.length / 16);
    D.barkActive = true;
    return true;
  };
  D.update = function (dt) {
    if (D.active) {
      D.t += dt;
      const skip = D.t > 0.45 && (SA.Input.pressed('interact') || SA.Input.pressed('brake') && D.lock);
      if (D.t > D.dur || skip) {
        D.active.job.i++;
        D.next();
      }
    } else if (D.barkT > 0) {
      D.barkT -= dt;
      if (D.barkT <= 0) D.hide();
    }
  };
})();
