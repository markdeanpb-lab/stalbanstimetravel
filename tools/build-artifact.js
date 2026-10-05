// Builds the page published as a claude.ai Artifact, so the game can be played from a link.
// Usage: node tools/build-artifact.js <outdir>
// Writes <outdir>/index.html and <outdir>/files.json ({ "published/path": "game/source/path" }).
// The Artifact viewer wraps the page in its own <!doctype html><head><body> skeleton, so the page
// is the body content of game/index.html with the title first and the stylesheet inlined; the
// scripts stay separate files published next to the page under the same relative paths.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GAME = path.join(ROOT, 'game');
const out = process.argv[2] || path.join(ROOT, 'dist', 'artifact');
fs.mkdirSync(out, { recursive: true });

const html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + '<body>'.length, html.lastIndexOf('</body>')).trim();
const css = fs.readFileSync(path.join(GAME, 'css', 'style.css'), 'utf8');
if (/<\/style/i.test(css)) throw new Error('style.css contains a closing style tag');

const page = [
  '<title>Curfew St Albans</title>',
  '<style>',
  css.trim(),
  '</style>',
  body,
  '',
].join('\n');
fs.writeFileSync(path.join(out, 'index.html'), page);

// every local script the page loads, published at the same relative path
const files = {};
for (const m of body.matchAll(/<script src="([^"]+)"><\/script>/g)) {
  const rel = m[1];
  if (/^https?:/.test(rel)) continue;
  const src = path.join('game', rel);
  if (!fs.existsSync(path.join(ROOT, src))) throw new Error('missing ' + src);
  files[rel] = src;
}
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 2));
const bytes = Object.values(files).reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
console.log(`page ${(page.length / 1024).toFixed(1)} KB, ${Object.keys(files).length} script files, ${(bytes / 1048576).toFixed(2)} MB`);
