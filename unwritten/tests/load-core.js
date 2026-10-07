// Loads the pure core out of index.html into Node, exactly as the browser runs it.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
module.exports = function loadCore() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('core script not found');
  const ctx = { console, Math, JSON, Object, Array, Map, Set, Number, String, Boolean, Error };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx, { filename: 'index.html#core' });
  return ctx.UnwrittenCore;
};
