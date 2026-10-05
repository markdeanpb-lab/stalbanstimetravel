# Verification (Milestone 1)

This page records how the build was checked against the brief's verification list, what passed, and what could not be tested.

## How it was tested

All checks run the real game (`game/index.html`) in headless Chromium through Playwright. Software WebGL (SwiftShader) is far too slow to play in real time, so the scripts advance the game with `SA.debug.sim()`, a fixed 1/30 s step that runs exactly the code a frame runs, minus rendering. They render only when taking a screenshot. Inputs go through the real input layer: held keys and buttons, the virtual stick, and emulated touch events. To get between mission beats quickly, the scripts teleport, but every beat still uses the game's own interaction, dialogue, vehicle and Curfew Key code.

| Script | What it does |
|---|---|
| `tools/verify.js` | The checklist below: 28 automated checks across movement, camera, vehicles, time travel, police, saving, storage, touch, launching from disk and network use |
| `tools/playthrough.js` | Plays the whole opening mission from New Game to the mission-complete card, then reloads the page and continues. It runs once for each ending |
| `tools/perf.js` | Draw calls, triangles, GPU memory estimate and simulation cost per era, at a phone preset and a desktop preset |
| `tools/screens.js` | The screenshots in `docs/screenshots/` |

Final results, for this commit: **`verify.js` 28/28 checks passed**, **`playthrough.js` 21/21 beats (Town Hall ending) and 21/21 beats (Corn Exchange ending)**, no runtime errors and no network requests outside the game folder.

## The brief's checklist

| Check | How | Result |
|---|---|---|
| **Movement and collision** | In each era, 24 random runs from pavement nodes (walk or sprint in a random direction for 4 s), sampled every step: 960 samples per era. | **Pass.** No sample inside a building in any era. Feet stay within 0.03 m of the ground on every slope. |
| **Narrow-street camera** | The camera turned through 16 directions at 4 places: French Row, a Market Place alley, the Waxhouse Gate passage and George Street. | **Pass.** The camera never ends up inside a building. In tight spots it cranes up or swings aside, keeping at least 0.6 m from Robin, and hides Robin's model below 0.9 m. |
| **Vehicles on slopes** | A 2026 hatchback, the 1964 scooter, the 1897 bicycle and the 1897 cart, each on the straight of George Street (6.9% grade). Each one gets in, sits parked, coasts downhill and uphill from 6 m/s, drives down, turns and climbs back, brakes, and gets out. | **Pass, all four.** No creeping when parked. They coast faster downhill than up (hatchback 5.1 vs 3.5 m/s, scooter 5.3 vs 3.2, bicycle 6.1 vs 3.1, cart 5.1 vs 3.5). Every one climbs back up, never leaves the ground, and gets out onto free pavement. |
| **Every time-travel transition** | All six year pairs (2026 → 1964 → 1897 → 2026 → 1897 → 1964 → 2026), winding with the held key input. | **Pass.** Each completes and lands on open ground. The rest timer is set (45 s, or 90 s for 1897 ↔ 2026). |
| **Blocked arrivals** | (a) Wind 1964 → 2026 from a spot inside a 2026 Christopher Place building. (b) A van parked on the arrival spot. (c) Arrival on the High Street carriageway with a car coming. | **Pass, all three.** Robin slips 12.8 m to safe ground ("something solid stands where you were"), 3.2 m aside ("a vehicle was standing exactly where you landed"), and 4.8 m onto the pavement ("traffic was coming"). |
| **Key rules** | Try to wind while wanted and while resting. | **Pass.** The key refuses ("chased", "rest") and works again once clear. |
| **Wanted level** | Two crimes, then hide out of sight. | **Pass.** Level 1, then 2, with 3 units dispatched; the level decays to 0 after about 29 s unseen. |
| **The full mission** | `playthrough.js` for each ending. Beats: phone call; camera lesson; solicitors and letter; first jump with a slip off the bread van; Edie and the rules; Terry's scooter; the coat at the market; changing clothes; the jump to 1897; picking Crabbe from three suspects; the cart chase on the bicycle with the City Police; grabbing the bag; losing the constables; young Edie and the choice; the Town Hall or the Corn Exchange; the 90 s rest and the long wind home; French Row changed; the mission-complete card. | **Pass, 21/21 beats for each ending.** |
| **The consequence persists through save and reload** | Two routes. `verify.js` saves, reloads the page and presses Continue. `playthrough.js` reloads after the real mission ends. Both also check the save code. | **Pass.** The flags and both the 2026 and 1964 French Row shopfronts survive a reload. Exporting and importing a save code switches the outcome, and a damaged code is rejected with a message. |
| **No `localStorage`** | Load with `localStorage` throwing on access. | **Pass.** The game starts, says storage is unavailable, and offers save codes. |
| **Touch** | 915 × 412 viewport with touch emulation, driven by Chrome DevTools touch events. | **Pass.** Touch controls appear. Dragging the left stick moves Robin 4.8 m. Dragging the right side turns the camera. Holding the ⌛ Key button winds to 1964. |
| **Phone frame rate** | Not measurable here: there is no phone or GPU. `perf.js` reports the inputs that decide frame rate instead (below). | **Not tested on a device.** The budgets are in range for 30 fps on a mid-range phone, but this needs confirming by hand. See [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md). |
| **Runs from `index.html` without a server** | Open `file:///…/game/index.html` and start a new game. | **Pass.** |
| **No runtime calls to external services** | Every request from every page in the run is logged. | **Pass.** None left the local server or the file system. |

## Performance budget (`tools/perf.js`)

Figures are per era, at five places: the Clock Tower, St Peter's Street, the High Street, the Cathedral precinct and George Street. "Step" is the CPU time of one game step (people, traffic, police, physics, HUD) on the test machine. Expect a phone to be 3–5× slower.

| Preset | Year | Draw calls | Triangles | Step (ms) | People / vehicles |
|---|---|---|---|---|---|
| **Phone**: 915 × 412, Low (no shadows, pixel ratio 1) | 2026 | 50–92 | 88k–112k | 0.5–0.8 | 32 / 12 |
| | 1964 | 51–91 | 102k–130k | 0.6–0.8 | 35 / 12 |
| | 1897 | 58–92 | 119k–142k | 0.7–1.0 | 59 / 7 |
| **Desktop**: 1280 × 720, High (with shadows) | 2026 | 114–161 | 200k–226k | 0.6–0.8 | 46 / 15 |
| | 1964 | 103–148 | 223k–259k | 0.5–0.8 | 50 / 15 |
| | 1897 | 121–158 | 255k–285k | 1.0–1.5 | 76 / 10 |

- On the desktop preset, the draw calls and triangles include the shadow-map pass.
- GPU memory estimate, with all three years resident:
  - Low: geometry 21 MB, textures 67 MB.
  - High: geometry 21 MB, textures 101 MB.
- Loading to the title screen takes about 4 s in headless Chromium.

Rendering time itself can't be measured meaningfully with software WebGL, so these numbers are the inputs that determine it.

## Screenshots

All screenshots are in [`screenshots/`](screenshots/).

- **Each year, the same views:** `eras/<year>-<view>.jpg` for the Clock Tower, French Row, the High Street, St Peter's Street, the Town Hall, George Street, the Cathedral's west front and the Abbey Gateway.
- **The consequence:**
  - `consequence-2026-french-row-{before,returned,dinner}.jpg` and the 1964 equivalents.
  - `consequence-2026-clock-tower-plaque.jpg`, Josiah's blue plaque after the Town Hall ending.
- **The time wave:** `time-wave-2026-to-1897.jpg`, the 1897 town unfolding around the Clock Tower.
- **The mission, beat by beat:** `playthrough/NN_<beat>.jpg`, from the Town Hall ending run.
- **Phone layout:** `phone-1964.jpg` and `phone-1897.jpg`, at 915 × 412 with the touch controls.
- **Title screen:** `title.jpg`.
- **Raw results:** `verify/` holds the checks' own screenshots, `verify-results.json` and `perf.json`. The playthrough results for both endings are in `playthrough/`.

Images come from software rendering at 1280 × 720 (phone shots at 915 × 412). Shadows and colours match a real GPU, but anti-aliasing and texture filtering differ slightly.

## What could not be tested

Five things need hardware or a person and could not be tested here:

- Real frame rates on a phone or desktop GPU.
- Audio playback.
- A physical gamepad.
- A physical touch screen.
- Safari and iOS.

[`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) lists each one with what to check.

## Re-running

```sh
node tools/verify.js out/verify
node tools/playthrough.js out/play returned
node tools/playthrough.js out/play dinner
node tools/perf.js out/perf
node tools/screens.js out/screens
```

Each script writes a JSON results file next to its screenshots. A full `verify.js` run takes about 10–20 minutes in software rendering.
