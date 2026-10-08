# Verification record

Build checked on 2026-10-08. Everything below was produced by the tools in `tools/`.

## Headless simulation (`node tools/sim.js --fit --park --rules --impacts --match 12`)

The simulation runs in Node with the same files the browser loads (no rendering). Exit code 0.

```
== fit: every vehicle in every space (centred, aligned) ==
  hatch   L 3.95 W 1.75: tightest margin 0.70 m in DALTON 4 (small, 12.6 deg tolerance)
  estate  L 4.82 W 1.85: tightest margin 0.60 m in DALTON 4 (small, 8.8 deg tolerance)
  suv     L 5.05 W 2: tightest margin 0.45 m in DALTON 4 (small, 6.5 deg tolerance)
  van     L 5.2 W 2: tightest margin 0.45 m in DALTON 4 (small, 6.4 deg tolerance)
== park: one bot per vehicle per space ==
  hatch   50/52 parked, mean 13.0 s
     fails: COURT 1(bay)s1:goto out 38.35 ang 6; COURT 2(bay)s2:settle out 2.22 ang 7
  estate  50/52 parked, mean 14.0 s
     fails: COURT 1(bay)s2:maneuver out 0.85 ang 2; COURT 2(bay)s2:goto out 4.59 ang 71
  suv     48/52 parked, mean 14.2 s
     fails: DALTON 4(small)s2:goto out 14.26 ang 72; COURT 1(bay)s1:goto out 36.30 ang 79; COURT 1(bay)s2:goto out 36.27 ang 82; COURT 2(bay)s2:goto out 7.21 ang 85
  van     50/52 parked, mean 17.2 s
     fails: COURT 2(bay)s2:maneuver out 6.32 ang 38; COURT 3(bay)s1:goto out 3.68 ang 70
== 12 eight-bot matches ==
  match 0 seed 100: OK 4.83 min, 3 rounds, winner Trevor Baskerville (estate, quiet); parks 9, dislodged 0, impacts 131 (19 big), recoveries 0, remarks 61
     R1:8d/7s | horn@1.1m parked 5 | R2:5d/4s | horn@2.4m parked 3 | R3:3d/2s | horn@3.6m parked 0 | SD:3d/2s
  match 1 seed 101: OK 3.94 min, 3 rounds, winner Gary Strood (van, bully); parks 8, dislodged 1, impacts 92 (14 big), recoveries 4, remarks 48
     R1:8d/7s | horn@1.3m parked 4 | R2:4d/3s | horn@2.6m parked 2 | R3:2d/1s | horn@3.8m parked 1
  match 2 seed 102: OK 5.15 min, 4 rounds, winner Trevor Baskerville (estate, quiet); parks 12, dislodged 1, impacts 135 (19 big), recoveries 5, remarks 61
     R1:8d/7s | horn@1.3m parked 5 | R2:5d/4s | horn@2.5m parked 3 | R3:3d/2s | horn@3.8m parked 2 | R4:2d/1s | horn@5.0m parked 1
  match 3 seed 103: OK 5.05 min, 4 rounds, winner Malcolm Ashby (hatch, nearest); parks 11, dislodged 0, impacts 152 (7 big), recoveries 3, remarks 58
     R1:8d/7s | horn@1.1m parked 5 | R2:5d/4s | horn@2.3m parked 3 | R3:3d/2s | horn@3.6m parked 2 | R4:2d/1s | horn@4.9m parked 1
  match 4 seed 104: OK 4.08 min, 3 rounds, winner Deborah Fenwick-Hythe (estate, nearest); parks 9, dislodged 0, impacts 110 (13 big), recoveries 2, remarks 43
     R1:8d/7s | horn@1.2m parked 6 | R2:6d/5s | horn@2.6m parked 2 | R3:2d/1s | horn@4.0m parked 1
  match 5 seed 105: OK 4.26 min, 3 rounds, winner Gary Strood (van, bully); parks 9, dislodged 2, impacts 109 (10 big), recoveries 0, remarks 51
     R1:8d/7s | horn@1.3m parked 4 | R2:4d/3s | horn@2.6m parked 2 | R3:2d/1s | horn@3.9m parked 0 | SD:2d/1s
  match 6 seed 106: OK 5.26 min, 4 rounds, winner Linda Marchmont (suv, bully); parks 13, dislodged 0, impacts 156 (21 big), recoveries 1, remarks 63
     R1:8d/7s | horn@1.1m parked 6 | R2:6d/5s | horn@2.3m parked 4 | R3:4d/3s | horn@3.6m parked 2 | R4:2d/1s | horn@5.0m parked 0 | SD:2d/1s
  match 7 seed 107: OK 3.88 min, 3 rounds, winner Sandra Okafor-Lowe (estate, confident); parks 10, dislodged 1, impacts 153 (6 big), recoveries 2, remarks 46
     R1:8d/7s | horn@1.2m parked 5 | R2:5d/4s | horn@2.5m parked 3 | R3:3d/2s | horn@3.8m parked 1
  match 8 seed 108: OK 3.95 min, 3 rounds, winner Trevor Baskerville (estate, quiet); parks 10, dislodged 0, impacts 110 (11 big), recoveries 2, remarks 49
     R1:8d/7s | horn@1.2m parked 6 | R2:6d/5s | horn@2.6m parked 3 | R3:3d/2s | horn@3.8m parked 1
  match 9 seed 109: OK 4.29 min, 3 rounds, winner Sandra Okafor-Lowe (estate, confident); parks 9, dislodged 0, impacts 117 (10 big), recoveries 2, remarks 53
     R1:8d/7s | horn@1.2m parked 6 | R2:6d/5s | horn@2.5m parked 2 | R3:2d/1s | horn@3.7m parked 0 | SD:2d/1s
  match 10 seed 110: OK 4.98 min, 4 rounds, winner Priya Okonedo (hatch, quiet); parks 16, dislodged 1, impacts 117 (7 big), recoveries 3, remarks 64
     R1:8d/7s | horn@1.1m parked 7 | R2:7d/6s | horn@2.4m parked 4 | R3:4d/3s | horn@3.7m parked 3 | R4:3d/2s | horn@4.9m parked 1
  match 11 seed 111: OK 3.74 min, 3 rounds, winner Sandra Okafor-Lowe (estate, confident); parks 9, dislodged 0, impacts 98 (14 big), recoveries 3, remarks 49
     R1:8d/7s | horn@1.3m parked 5 | R2:5d/4s | horn@2.5m parked 3 | R3:3d/2s | horn@3.6m parked 1
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
| Phone (844 × 390, touch, landscape): menus by tap, then GO held while dragging STEER, then BRAKE held | `browser-touch.js` | Pass: car drove 11.1 m and turned right, then reversed; tutorial shows touch wording; no errors |
| Phone spectating after elimination: NEXT and pause only, compact HUD | screenshot | Pass: no controls overlap the minimap or driver row |
| Spoken commentary with a stand-in speech engine (headless Chromium has no voices) | `browser-voices.js` | Pass: every spoken line matched an on-screen caption, never two voices at once, one steady commentator voice, Barry spoke over the music and was cut off when it stopped, residents silent in "commentary only" mode, captions marked while being read |
| Single-file build boots and runs a match | `build-single.js` + manual load | Pass |
| Staged head-on crash: hatch hit by an SUV at 15 m/s | ad hoc | Front damage 100%, front bumper detached as debris, headlight broken, hatch shoved backwards |

## Not verified here

- Real-time frame rate on real hardware (software rendering is far too slow to judge).
- Touch controls on a physical phone (tested in Chromium's phone emulation with real multi-touch events).
- Gamepads and real speech voices (the code paths run against a stand-in speech engine; which voices you hear depends on the browser and operating system).
- Long play sessions by people. The balance of the four vehicles against human players needs playtesting.
