/* Authored world-state flags. Each flag drives specific variants in later eras; World.buildEra and
   Landmarks.consequences read them, so every change is applied in one place and persists in saves.

   fund_outcome   'returned' | 'dinner'   (unset = original history)
     1964: Edie's shop sign/front, Town Hall Jubilee Lamp (returned), Edie's lines
     2026: French Row shop (Phone Fixx / Pennick & Daughters / The Jubilee Table), occupant NPC,
           Clock Tower plaque (returned) or Corn Exchange plaque (dinner), Jubilee Lamp, newspaper board
   crabbe_fate    'jailed' | 'fled'
   josiah_cleared true | false
   met_young_edie true
   clockStopped1897 true  (the clock dial in 1897 reads 9.14 once the key has been used there)
*/
(function () {
  'use strict';
  const SA = window.SA;
  const F = (SA.Flags = {});
  // which eras must be rebuilt when a flag changes
  const AFFECTS = { fund_outcome: [1964, 2026], josiah_cleared: [1964, 2026], crabbe_fate: [2026] };
  F.set = function (key, value, opts) {
    const prev = SA.Game.flags[key];
    SA.Game.setFlag(key, value);
    if (prev === value) return;
    const eras = AFFECTS[key] || [];
    if (!(opts && opts.deferRebuild)) for (const e of eras) SA.Game.rebuildEra(e);
  };
  F.get = (k) => SA.Game.flags[k];
  F.rebuildFor = function (keys) {
    const set = new Set();
    for (const k of keys) for (const e of AFFECTS[k] || []) set.add(e);
    for (const e of set) SA.Game.rebuildEra(e);
  };
  // Human-readable summary of consequences (mission complete card + journal)
  F.summary = function () {
    const f = SA.Game.flags;
    if (f.fund_outcome === 'returned') {
      return {
        choice: 'You returned the Jubilee Fund to the Town Hall.',
        changes: [
          '1897: Crabbe is arrested; the Mayor thanks Josiah Pennick in front of the crowd.',
          '1964: Edie\'s shop is "Pennick & Daughter, Clockmakers", and a gilded Jubilee Lamp stands by the Town Hall steps.',
          '2026: French Row has "Pennick & Daughters, Clockmakers since 1881", where cousin Priya works. A plaque on the Clock Tower names Josiah as keeper of the clock.',
        ],
      };
    }
    if (f.fund_outcome === 'dinner') {
      return {
        choice: 'You took the Jubilee Fund to the Corn Exchange dinner.',
        changes: [
          '1897: Three hundred people eat roast beef and plum duff; Crabbe slips away and Josiah stays under suspicion.',
          '1964: Edie\'s shop is still "Curios", and she keeps a framed menu from Jubilee night.',
          '2026: French Row has "The Jubilee Table", a pay-what-you-can kitchen run by Dot. A plaque on the Corn Exchange remembers an unknown friend who fed the city\'s poor.',
        ],
      };
    }
    return { choice: 'History has not been changed yet.', changes: [] };
  };
})();
