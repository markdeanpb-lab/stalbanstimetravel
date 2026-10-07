# The Unwritten: Chapter One

You're an amnesiac ghost in a small Hertfordshire cemetery on All Souls' Day, 1963. You walk into the last minutes of the people buried there and change how they died. Then you come back to see what the cemetery has become.

A single self-contained `index.html`, with no build step, no network and no asset files. A play-through takes 20–30 minutes.

## Launch

- **Desktop:** double-click `index.html`. It works from `file://` in Chrome, Edge and Firefox.
- **Local server (optional):** `python3 -m http.server -d unwritten 8080`, then open <http://localhost:8080>.
- **Phone or tablet:** serve the folder as above and open it over Wi-Fi. Landscape or portrait both work.

The game saves to `localStorage` after each committed journey. If storage is blocked (some private windows), it still runs and tells you saving is off. **Pause → New game** asks before erasing anything.

## Controls

| | Keyboard and mouse | Touch |
|---|---|---|
| Move | W A S D or arrow keys, or click the ground | Tap the ground |
| Interact (inspect, listen, possess, enter) | E, or click the object | Tap the object for its actions |
| Whisper to the nearest person | Q | **Whisper** button |
| Journal | J | **Journal** button |
| Pause and options | Esc | **Pause** button |
| Begin a scene's countdown | Enter, or the **Begin** button | **Begin** button |
| Restart a scene (free) | R | **Restart** button |
| Choose from an action menu | 1 to 3 | Tap |

**Options** (in the pause menu):
- Subtitle size: small, medium or large.
- Reduced motion. This follows your system setting by default.
- Sound: off, low or full.

The pause menu also has the ability legend.

## How it works (no spoilers)

- **You have two journeys and three graves you can enter.** Investigating the cemetery is free.
- **Each grave can be entered only once.** A journey is spent the moment you go in.
- **Inside a death:**
  - Time is frozen until you press **Begin**, so you can inspect everything first.
  - A few minutes of real time then play out. You can pause at any time.
  - **Restarting is free and unlimited.**
  - **Returning to the cemetery makes what happened permanent.**
- **Four abilities**, each with one icon used everywhere:
  - **Pass through** thin barriers (dashed teal edge).
  - **Inspect** (eye).
  - **Possess** a marked object to do its one thing (diamond).
  - **Whisper**, so someone comes to look where you are (sound arcs).
- **When your journeys are spent,** walk the rewritten cemetery as long as you like. Return to your own headstone to end the chapter. You can also end it there early, after at least one journey.

## Debug mode

Open `index.html?debug`. A **debug** button appears in the bottom-left corner. It lets you:
- Jump to any scene.
- Speed up time (1× to 8×).
- Force any outcome per scene, and view the resolved timeline (graves, enterable scenes, endings).
- Grant all clues, add a charge, or trigger the ending.

The toggle is hidden without `?debug`.

## Files

- `index.html`: the game. The pure core (scene simulations, timeline resolver, cemetery content, endings) is the `<script id="core">` block. Rendering, input, audio and UI live in `<script id="game">`.
- `DESIGN.md`: the design, timeline table, causal graph and constraint check. **Contains every solution.**
- `tests/resolver.test.js`: exhaustive Node test of the resolver (`node unwritten/tests/resolver.test.js`).
- `tests/playthrough.js`: Playwright play-through in headless Chromium (`NODE_PATH=$(npm root -g) node unwritten/tests/playthrough.js`).
- `tests/RESULTS.md`: the latest test results and known issues.
