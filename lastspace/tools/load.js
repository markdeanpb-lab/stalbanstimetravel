// Loads the simulation scripts into this Node process (no browser, no three.js).
// runInThisContext keeps global lookups (Math etc.) fast; a separate vm context is much slower.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SIM_FILES = ['js/core/base.js', 'js/data/mapdata.js', 'js/data/spaces.js', 'js/data/text.js', 'js/sim/physics.js', 'js/sim/map.js', 'js/sim/vehicles.js', 'js/sim/parking.js', 'js/sim/bots.js', 'js/sim/match.js', 'js/sim/remarks.js'];
function load(files) {
  globalThis.window = globalThis;
  for (const f of files || SIM_FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
  }
  return globalThis.LS;
}
module.exports = { load, ROOT, SIM_FILES };
