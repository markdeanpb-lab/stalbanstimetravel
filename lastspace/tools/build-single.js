#!/usr/bin/env node
/* Packs the game into one self-contained HTML file (scripts and styles inlined) so it can be
   opened anywhere or published as a single page.  node tools/build-single.js [out.html] */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const artifact = process.argv.includes('--artifact');
const out = process.argv.filter((a) => !a.startsWith('--'))[2] || path.join(ROOT, 'dist', artifact ? 'last-space-artifact.html' : 'last-space-st-albans.html');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(ROOT, f), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>/* ${f} */\n${src}\n</script>`;
});
if (artifact) {
  // a hosted page supplies its own document skeleton: keep only title, styles and body content
  const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
  const styles = (html.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  html = `${title}\n<style>:root { color-scheme: dark; } html, body { background: #0d1016; }</style>\n${styles}\n${body}`;
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
