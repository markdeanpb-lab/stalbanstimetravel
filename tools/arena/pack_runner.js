#!/usr/bin/env node
// Wraps the runner GLB in a classic script (window.AR_RUNNER_GLB = base64) so the arena can load it
// from file:// with no fetch. Usage: node tools/arena/pack_runner.js <runner.glb> arena/assets/runner.glb.js
const fs = require('fs');
const [src, out] = process.argv.slice(2);
const b64 = fs.readFileSync(src).toString('base64');
fs.writeFileSync(out, '/* Runner character: built by tools/arena/build_runner.py from Quaternius\'s Universal Animation Library (CC0). */\nwindow.AR_RUNNER_GLB="' + b64 + '";\n');
console.log('wrote', out, (b64.length / 1e6).toFixed(2) + ' MB');
