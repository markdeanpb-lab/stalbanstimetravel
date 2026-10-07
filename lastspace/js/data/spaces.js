/* LAST SPACE - the pool of possible scoring spaces. Each round shows a handful of these as "?"
   markers; when the music stops some of them go live. s = metres along the OSM centreline from its
   first point (Dalton/Bernard: from Catherine Street northwards; Church: from Grange Street westwards;
   Grange: from the St Peter's Street end north-westwards), side +1 = left of that direction.
   Every space fits every starting vehicle (checked by tools/sim.js --fit). */
window.LS = window.LS || {};
LS.SPACE_POOL = [
  // Dalton Street
  { street: 'Dalton Street', s: 31, side: -1, kind: 'junction' },
  { street: 'Dalton Street', s: 76, side: 1, kind: 'tight' },
  { street: 'Dalton Street', s: 121, side: -1, kind: 'wide' },
  { street: 'Dalton Street', s: 166, side: 1, kind: 'small', openEnd: 1 },
  { street: 'Dalton Street', s: 206, side: -1, kind: 'tight' },
  { street: 'Dalton Street', s: 246, side: 1, kind: 'junction' },
  // Bernard Street
  { street: 'Bernard Street', s: 44, side: 1, kind: 'tight' },
  { street: 'Bernard Street', s: 68, side: -1, kind: 'tight' },
  { street: 'Bernard Street', s: 110, side: -1, kind: 'small', openEnd: -1 },
  { street: 'Bernard Street', s: 140, side: 1, kind: 'wide' },
  { street: 'Bernard Street', s: 205, side: -1, kind: 'tight' },
  // Church Street
  { street: 'Church Street', s: 26, side: 1, kind: 'junction' },
  { street: 'Church Street', s: 70, side: -1, kind: 'tight' },
  { street: 'Church Street', s: 112, side: -1, kind: 'small', openEnd: 1 },
  { street: 'Church Street', s: 148, side: 1, kind: 'wide', name: 'outside the Jubilee Centre' },
  { street: 'Church Street', s: 181, side: -1, kind: 'junction', name: 'by the choker' },
  // Grange Street
  { street: 'Grange Street', s: 30, side: -1, kind: 'tight', name: 'by the roadworks' },
  { street: 'Grange Street', s: 100, side: 1, kind: 'tight' },
  { street: 'Grange Street', s: 148, side: -1, kind: 'wide' },
  { street: 'Grange Street', s: 184, side: 1, kind: 'small', openEnd: 1 },
  { street: 'Grange Street', s: 229, side: -1, kind: 'junction' },
  { street: 'Grange Street', s: 256, side: 1, kind: 'tight' },
  { street: 'Grange Street', s: 312, side: -1, kind: 'tight', name: 'by the barrier' },
  // Grange Court residents' car park (perpendicular bays)
  { kind: 'bay', side: -1, slot: 1, label: 'COURT 1' },
  { kind: 'bay', side: -1, slot: 3, label: 'COURT 2' },
  { kind: 'bay', side: -1, slot: 2, label: 'COURT 3' },
];
