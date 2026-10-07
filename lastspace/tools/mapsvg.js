// Debug: draw the arena (walls, kerbs, slots, spaces, nav graph) to an SVG.
const { load } = require('./load');
const LS = load();
const t0 = Date.now();
const A = new LS.Arena(7);
console.error('arena built in', Date.now() - t0, 'ms; slots', A.slots.length, 'spaces', A.spaces.length, 'lamps', A.lamps.length, 'bins', A.bins.length, 'houses', A.houses.length, 'walls', A.wallCentre.reduce((n, l) => n + l.length, 0));
const S = 3, X0 = A.gx0, Y1 = A.gy0 + A.gh * A.gres;
const tx = (x) => ((x - X0) * S).toFixed(1), ty = (y) => ((Y1 - y) * S).toFixed(1);
const pl = (pts, st) => `<polyline points="${pts.map((p) => tx(p[0]) + ',' + ty(p[1])).join(' ')}" ${st}/>`;
let o = `<svg xmlns="http://www.w3.org/2000/svg" width="${A.gw * A.gres * S}" height="${A.gh * A.gres * S}" style="background:#cfc"><rect width="100%" height="100%" fill="#bdb"/>`;
for (const h of A.houses) { const c = Math.cos(h.a), s = Math.sin(h.a); const P = [[-h.w / 2, 0], [h.w / 2, 0], [h.w / 2, h.d], [-h.w / 2, h.d]].map(([u, v]) => [h.x + c * u - s * v, h.y + s * u + c * v]); o += pl(P.concat([P[0]]), 'fill="#b97" stroke="#653" stroke-width="0.5"'); }
for (const l of A.wallLines) o += pl(l, 'fill="none" stroke="#a33" stroke-width="2"');
for (const l of A.kerbLines) o += pl(l, 'fill="none" stroke="#444" stroke-width="1.5"');
for (const e of A.nav.edges) o += pl(e.line.pts, 'fill="none" stroke="#08f" stroke-width="1" stroke-dasharray="4,3"');
for (const n of A.nav.nodes) o += `<circle cx="${tx(n.x)}" cy="${ty(n.y)}" r="4" fill="#08f"/><text x="${tx(n.x) + 5}" y="${ty(n.y) - 5}" font-size="10">${n.id} ${n.name}</text>`;
const box = (x, y, a, hl, hw, st) => { const c = Math.cos(a), s = Math.sin(a); const P = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([u, v]) => [x + c * u * hl - s * v * hw, y + s * u * hl + c * v * hw]); return pl(P.concat([P[0]]), st); };
for (const s of A.slots) o += box(s.x, s.y, s.a, s.L / 2, s.W / 2, `fill="${s.model === 'mega' ? '#555' : '#888'}" stroke="#222" stroke-width="0.5"`);
for (const sp of A.spaces) o += box(sp.x, sp.y, sp.a, sp.hl, sp.hw, 'fill="#ff0" stroke="#f00" stroke-width="1"') + `<text x="${tx(sp.x)}" y="${ty(sp.y)}" font-size="9" fill="#00f">${sp.label}</text>`;
for (const b of A.barriers) o += box(b.x, b.y, b.a, 0.3, b.half, 'fill="#f00"');
for (const l of A.lamps) o += `<circle cx="${tx(l.x)}" cy="${ty(l.y)}" r="1.5" fill="#000"/>`;
for (const b of A.bins) o += `<circle cx="${tx(b.x)}" cy="${ty(b.y)}" r="1.2" fill="${b.color}"/>`;
for (const d of A.dropKerbs) o += box(d.x, d.y, d.a, d.len / 2, 1, 'fill="none" stroke="#fff" stroke-width="1"');
for (const c of A.cushions) o += box(c.x, c.y, c.a, 1.5, 0.9, 'fill="#c66"');
for (const sg of A.signs) o += `<rect x="${tx(sg.x) - 3}" y="${ty(sg.y) - 3}" width="6" height="6" fill="#fff" stroke="#000"/><text x="${tx(sg.x) + 4}" y="${ty(sg.y) + 10}" font-size="8">${sg.text}</text>`;
// street arclength ticks
for (const st of A.streets) for (let s = 0; s < st.line.length; s += 20) { const p = st.line.at(s); o += `<text x="${tx(p.x)}" y="${ty(p.y)}" font-size="8" fill="#a0a">${s}</text>`; }
o += '</svg>';
require('fs').writeFileSync(process.argv[2] || 'map.svg', o);
