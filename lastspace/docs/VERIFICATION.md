# Verification record

Build checked on 2026-10-07. Everything below was produced by the tools in `tools/`.

## Headless simulation (`node tools/sim.js --fit --park --rules --impacts --match 12`)

The simulation runs in Node with the same files the browser loads (no rendering). Exit code 0.

```
== fit: every vehicle in every space (centred, aligned) ==
  hatch   L 3.95 W 1.75: tightest margin 0.70 m in DALTON 4 (small, 12.6 deg tolerance)
  estate  L 4.82 W 1.85: tightest margin 0.60 m in DALTON 4 (small, 8.8 deg tolerance)
  suv     L 5.05 W 2: tightest margin 0.45 m in DALTON 4 (small, 6.5 deg tolerance)
  van     L 5.2 W 2: tightest margin 0.45 m in DALTON 4 (small, 6.4 deg tolerance)
== park: one bot per vehicle per space ==
  hatch   49/52 parked, mean 12.1 s
     fails: BERNARD 3(small)s1:maneuver out 0.41 ang 13; COURT 1(bay)s1:goto out 4.24 ang 84; COURT 2(bay)s2:goto out 6.55 ang 75
  estate  49/52 parked, mean 13.3 s
     fails: COURT 1(bay)s1:goto out 14.01 ang 67; COURT 1(bay)s2:maneuver out 4.87 ang 9; COURT 2(bay)s2:goto out 45.05 ang 36
  suv     48/52 parked, mean 13.9 s
     fails: DALTON 4(small)s2:goto out 12.72 ang 53; COURT 1(bay)s1:goto out 17.66 ang 80; COURT 1(bay)s2:goto out 24.27 ang 81; COURT 2(bay)s2:goto out 44.95 ang 13
  van     48/52 parked, mean 14.9 s
     fails: COURT 1(bay)s1:choose out 38.80 ang 7; COURT 1(bay)s2:choose out 38.03 ang 9; COURT 2(bay)s2:choose out 42.37 ang 10; COURT 3(bay)s1:goto out 2.21 ang 49
== 12 eight-bot matches ==
  match 0 seed 100: OK 2.47 min, 2 rounds, winner Malcolm Ashby (hatch, nearest); parks 6, dislodged 1, impacts 74 (4 big), recoveries 1, remarks 44; sim 3.0 s
  match 1 seed 101: OK 5.40 min, 4 rounds, winner Colin Pargeter (suv, confident); parks 11, dislodged 1, impacts 86 (14 big), recoveries 5, remarks 66; sim 4.3 s
  match 2 seed 102: OK 4.35 min, 3 rounds, winner Priya Okonedo (hatch, quiet); parks 8, dislodged 0, impacts 201 (6 big), recoveries 2, remarks 53; sim 3.6 s
  match 3 seed 103: OK 7.09 min, 5 rounds, winner Linda Marchmont (suv, bully); parks 17, dislodged 0, impacts 151 (8 big), recoveries 7, remarks 80; sim 5.3 s
  match 4 seed 104: OK 4.06 min, 3 rounds, winner Malcolm Ashby (hatch, nearest); parks 8, dislodged 0, impacts 92 (7 big), recoveries 1, remarks 55; sim 3.1 s
  match 5 seed 105: OK 2.85 min, 2 rounds, winner Trevor Baskerville (estate, quiet); parks 7, dislodged 0, impacts 106 (8 big), recoveries 2, remarks 52; sim 2.5 s
  match 6 seed 106: OK 4.14 min, 3 rounds, winner Trevor Baskerville (estate, quiet); parks 8, dislodged 0, impacts 120 (6 big), recoveries 2, remarks 50; sim 3.2 s
  match 7 seed 107: OK 2.66 min, 2 rounds, winner Malcolm Ashby (hatch, nearest); parks 6, dislodged 2, impacts 93 (2 big), recoveries 1, remarks 41; sim 2.1 s
  match 8 seed 108: OK 5.30 min, 4 rounds, winner Colin Pargeter (suv, confident); parks 14, dislodged 1, impacts 130 (6 big), recoveries 2, remarks 70; sim 4.3 s
  match 9 seed 109: OK 3.94 min, 3 rounds, winner Trevor Baskerville (estate, quiet); parks 9, dislodged 1, impacts 89 (4 big), recoveries 1, remarks 50; sim 3.3 s
  match 10 seed 110: OK 3.74 min, 3 rounds, winner Sandra Okafor-Lowe (estate, confident); parks 10, dislodged 0, impacts 135 (9 big), recoveries 4, remarks 58; sim 3.0 s
  match 11 seed 111: OK 3.97 min, 3 rounds, winner Malcolm Ashby (hatch, nearest); parks 8, dislodged 0, impacts 118 (18 big), recoveries 2, remarks 60; sim 3.3 s
== parking rules and collisions ==
  PASS not parked before 2 s (progress 0.75)
  PASS parked after 2 s below walking pace
  PASS 23 deg off the kerb line is not parked (lines)
  PASS estate overhanging the end line is not parked (out ? m)
  PASS driving through at speed never parks
  PASS gentle 1 m/s nudge from behind keeps the park (hatch dv 0.6 m/s)
  PASS 12 m/s side ram by an SUV dislodges (hatch dv 23.1 m/s)
== impacts depend on mass, speed and angle ==
  SUV T-bones hatch at 10 m/s: hatch shoved 6.2 m, hatch dv 7.8, SUV dv 3.5
  hatch T-bones SUV at 10 m/s: SUV shoved 0.7 m, SUV dv 3.5, hatch dv 7.8
  estate into estate: 5 m/s shoves 0.6 m, 15 m/s shoves 5.6 m; damage 0.01 vs 0.19
  rear-corner hit spins the victim 59 deg vs centre hit 0 deg
  head-on at 9 + 9 m/s: both stop (A 1.4 m/s after), dv 10.4 m/s, front damage 0.98, bumper off

```

What the sections mean:

- **fit**: each vehicle, centred and aligned in each of the 26 pool spaces, with the largest heading error that still fits. No space overlaps a resident's car or crosses a wall.
- **park**: one bot, alone, parks each vehicle in each space from two start positions (30–45 m away, either direction). Up to eight more starts are tried until each vehicle has parked in each space at least once. "NEVER PARKED" would be a failure; there were none. The individual failed attempts are almost all in the Grange Court car-park bays.
- **rules**: parking validity under the conditions that matter, including being hit while parked.
- **impacts**: two cars on an empty plane, to show the result comes from mass, speed and contact geometry.
- **matches**: eight-bot matches from start to results. `parks` counts valid parks, `dislodged` counts parked cars shoved out, `big` counts impacts of more than 6 m/s velocity change.

## In the browser (headless Chromium, software WebGL)

| Check | Tool | Result |
|---|---|---|
| Boots from `file://`, title over a live attract-mode match | `browser-check.js` | Pass, no console errors |
| Solo: circulation, music stop, battle, parking camera | `browser-check.js` | Pass |
| Two-player split-screen with six bots | `browser-check.js` | Pass |
| Tutorial: all six steps, scripted inputs | `browser-tutorial.js` | Pass ("TUTORIAL COMPLETE", no errors) |
| Full solo match, player on autopilot, to the results screen | `browser-match.js` | Pass (3.8 min, finale freeze-frame, results, no errors) |
| Phone (844 × 390, touch, landscape): menus by tap, then GO held while dragging STEER, then BRAKE held | `browser-touch.js` | Pass: car drove 7.6 m and turned right, then reversed; tutorial shows touch wording; no errors |
| Single-file build boots and runs a match | `build-single.js` + manual load | Pass |
| Staged head-on crash: hatch hit by an SUV at 15 m/s | ad hoc | Front damage 100%, front bumper detached as debris, headlight broken, hatch shoved backwards |

## Not verified here

- Real-time frame rate on real hardware (software rendering is far too slow to judge).
- Touch controls on a physical phone (tested in Chromium's phone emulation with real multi-touch events).
- Gamepads and speech synthesis on real devices (the code paths run, but there is no device in the test container).
- Long play sessions by people. The balance of the four vehicles against human players needs playtesting.
