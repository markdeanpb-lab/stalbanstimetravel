/* Saving: localStorage when available (wrapped so the game still runs without it),
   plus copyable save codes for export/import. */
(function () {
  'use strict';
  const SA = window.SA;
  const KEY = 'curfew-stalbans-save-v1';
  const SETTINGS_KEY = 'curfew-stalbans-settings-v1';

  // ---- safe storage wrapper
  const mem = {};
  let ok = false;
  try {
    const t = '__curfew_test__';
    window.localStorage.setItem(t, '1');
    ok = window.localStorage.getItem(t) === '1';
    window.localStorage.removeItem(t);
  } catch (e) {
    ok = false;
  }
  const Store = (SA.Store = {
    available: ok,
    get(k) {
      if (ok) {
        try {
          return window.localStorage.getItem(k);
        } catch (e) {
          /* fall through */
        }
      }
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    set(k, v) {
      mem[k] = v;
      if (!ok) return false;
      try {
        window.localStorage.setItem(k, v);
        return true;
      } catch (e) {
        return false; // quota or privacy mode: keep in memory only
      }
    },
    remove(k) {
      delete mem[k];
      if (!ok) return;
      try {
        window.localStorage.removeItem(k);
      } catch (e) {}
    },
  });

  // ---- CRC32 for save-code integrity
  const table = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function toB64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const s = atob(str);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  const Save = (SA.Save = {
    KEY,
    // A save is a plain object produced by SA.Game.serialize()
    write(data) {
      const json = JSON.stringify(data);
      const stored = Store.set(KEY, json);
      SA.emit('saved', stored);
      return stored;
    },
    read() {
      const raw = Store.get(KEY);
      if (!raw) return null;
      try {
        const d = JSON.parse(raw);
        return d && d.v === 1 ? d : null;
      } catch (e) {
        return null;
      }
    },
    clear() {
      Store.remove(KEY);
    },
    exists() {
      return !!Save.read();
    },
    encode(data) {
      const bytes = new TextEncoder().encode(JSON.stringify(data));
      const crc = crc32(bytes).toString(16).padStart(8, '0');
      return 'CURFEW1-' + crc + '-' + toB64url(bytes);
    },
    decode(code) {
      if (typeof code !== 'string') throw new Error('No code given.');
      code = code.trim().replace(/\s+/g, '');
      const m = /^CURFEW1-([0-9a-f]{8})-([A-Za-z0-9_-]+)$/.exec(code);
      if (!m) throw new Error('That does not look like a Curfew save code.');
      let bytes;
      try {
        bytes = fromB64url(m[2]);
      } catch (e) {
        throw new Error('The code is damaged (bad characters).');
      }
      if (crc32(bytes).toString(16).padStart(8, '0') !== m[1]) throw new Error('The code is damaged (checksum mismatch). Copy it again in full.');
      let d;
      try {
        d = JSON.parse(new TextDecoder().decode(bytes));
      } catch (e) {
        throw new Error('The code could not be read.');
      }
      if (!d || d.v !== 1) throw new Error('This code is from an unknown version of the game.');
      return d;
    },
    loadSettings() {
      try {
        return JSON.parse(Store.get(SETTINGS_KEY) || '{}') || {};
      } catch (e) {
        return {};
      }
    },
    saveSettings(s) {
      Store.set(SETTINGS_KEY, JSON.stringify(s));
    },
  });
})();
