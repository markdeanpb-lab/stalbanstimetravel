# Test results

Both suites were run on the committed `index.html` on 7 October 2026, using Node 22 and Playwright 1.56 with headless Chromium. The full logs are in `resolver.log` and `playthrough.log`.

| Suite | Result |
|---|---|
| `resolver.test.js`: exhaustive timeline enumeration plus fuzz | **PASSED: all 17,635 checks** |
| `playthrough.js`: browser play-through of the real UI | **PASSED: 76 of 76** |

## 1. Resolver test (`node unwritten/tests/resolver.test.js`)

**What it enumerates:**
- Every sequence of 0, 1 or 2 journeys over the three graves, in both visiting orders.
- For each scene, a library of action logs that reach each outcome: 12 for A, 7 for B and 9 for C.
- 539 combinations in total, of which 521 are legal play paths. The other 18 are illegal because the grave has vanished or was already entered.

Each path is played the way the game plays it:
1. Check the grave is enterable in the current world.
2. Spend the charge.
3. Run the scene in the variant the player would see.
4. Record only the accepted actions.
5. Commit, then re-resolve.

**What it asserts:**
- **Order independence.** Resolving the same journeys in either order gives the same signature, graves, enterability and cemetery content. The same interventions reached by different visiting orders always produce the same world.
- **No hidden rewrites.** Across all paths, the outcome the player saw in a scene is never different after re-resolution (0 differences). The one exception is a scene that stops happening, which becomes moot. There are 18 moot journeys: Brin Lane entered, after which Dr Ashdown's survival meant the flood never came.
- **Grave rules.** A person alive on 2 November 1963 has no grave, and the grave can't be entered. A person who died differently has a changed inscription, changed evidence and changed mourners.
- **Charges.** A charge never goes negative. The second charge always has at least one grave available. No grave can be re-entered.
- **Endings.** All three endings are reachable: Saved on 68 paths, Accepted on 486 and Incomplete on 486. Saved first becomes reachable after 2 journeys.
- **No dead ends.** Every combination offers an ending. In every world where Iris is dead, the truth (her name and the current cause of death) can be discovered, so Accepted is always available.
- **State coverage.** Every outcome state of every scene and of Iris appears in some final world. There are 22 distinct final worlds.
- **Causal constraints:**
  - Indirect rescue: B saves Kath without entering C.
  - Changed solution: the café wireless exists only if Hal lives.
  - Plain kindness: C's early latch changes nothing else.
  - Misread cause: the stove fails, and the evidence for that is available before entry.
  - The best ending is reachable in both orders, through the changed solution, and with Hal's "died later" notebook route.
- **Fuzz.** 1,500 random action logs. No crashes, every outcome is valid, every replay is deterministic, and random pairs are order-independent.

**Strategy table (as printed by the test):**

| Scene | Strategy | Variant | Outcome |
|---|---|---|---|
| A | none / stove (misread) / cash box (misread) / fuse too early | — | died_fire |
| A | wireless off · phone after stick · fuse after stick · whisper at Comet · whisper at drawer · bolt early | — | survived + proof |
| A | phone before stick | — | survived (no proof) |
| A | bolt late | — | died_later + proof |
| B | none · kiosk only | either | died_lorry |
| B | door + whisper to Len (lorry only, misread) | either | died_pole |
| B | door + whisper + kiosk · door + whisper + whisper to the girl | either | survived |
| B | wireless only | Hal alive / dead | died_pole / died_lorry |
| B | wireless + kiosk | Hal alive / dead | survived / died_lorry |
| C | none · latch too late | — | drowned |
| C | latch before she wades (kindness) · latch during heave · grate early · grate before she goes back · kiosk · whisper at steps | — | survived |
| C | grate while pinned | — | died_pneumonia |

## 2. Play-through (`NODE_PATH=$(npm root -g) node unwritten/tests/playthrough.js [shotsDir]`)

This drives `index.html?debug` in headless Chromium. It uses real key presses for:
- WASD movement
- E to interact and digit keys for menu choices
- Enter to begin, Esc to pause, R to restart, J for the journal

It also uses real clicks on dialog buttons and context menus, and a tap on a touch viewport.

Timing-critical abilities are triggered through the same `possess()` and `whisper()` functions the context menu calls, at sim times read from the page. The debug time scale speeds up the waits.

**Confirmed:**
- **Flow:**
  - The title screen and New game work.
  - Investigation is free.
  - The entry dialog explains the cost, free restart, commit, and no re-entry.
  - The charge is spent on entry.
  - The scene starts frozen, and stays frozen.
  - Inspect works while time is frozen; possess is disabled until Begin.
- **Countdown:**
  - Enter starts it and Esc pauses it.
  - The pause menu shows the ability legend.
  - R restarts for free and clears the action log.
  - Return commits the journey.
  - The game saves to `localStorage`.
  - Reload, then Continue, restores the world.
  - New game asks for confirmation, and Cancel keeps the save.
- **NPC reactions:**
  - Hal tries the bolted back door before going in the front.
  - Hal hears the Comet's buzz once the wireless is silenced, and checks the heater.
  - Len stays for the boxing on the café wireless.
  - The girl answers the ringing kiosk.
  - Kath and Cyril meet and go round by the footbridge.
- **Scene A:**
  - The misread cause fails: turning down the stove means Hal still dies.
  - Silencing the wireless saves him with proof.
  - Drawing the bolt late gives the different death, and his grave then reads "He went back for the truth."
- **Scene B:**
  - The changed solution works: the café wireless exists (with Hal's repair label) only after Hal is saved.
  - Wireless plus kiosk saves Dr Ashdown.
  - Delaying only the lorry gives the pole death, with a changed inscription and a changed mourner belief.
- **Scene C:** releasing the car door early saves both of them. This is the plain kindness: Kath's grave goes, she visits Iris's stone with Davy, Win is absent, and nothing else changes.
- **Rewritten cemetery:**
  - Hal's grave vanishes, and Hal and Vera stand at the ghost's stone.
  - The journal shows before and after, and separates facts from contradicted theories.
  - Hal's overheard words point at what is still wrong.
  - After A + B, the world is `A:survived+p|B:survived|C:averted|I:alive`. Kath's grave has vanished without being entered, and the living Iris is present.
  - The on-screen banner says to walk freely and then return to end the chapter.
- **Endings:**
  - **Saved**, with its causal account.
  - **Incomplete**, offered when the truth isn't known, with its account.
  - **Accepted**, after learning the name and cause in the cemetery. The consequences are listed before the final choice, and the ending has its account.
- **Mobile (390 × 844, touch):** the on-screen journal, pause and whisper buttons appear, and tap-to-move works.
- No page errors or console errors across all runs.

Screenshots from the run are in `screenshots/`.

## Known issues and limits

- **Audio is unverified by ear.** All sound is synthesised with Web Audio. The automated runs confirm it starts and throws no errors, but no one has listened to it in this environment.
- **No human play session yet.** The 20–30 minute length is an estimate from scene lengths (2–3 minutes each, plus investigation). It has not been measured with a real player.
- **Tight timing windows.** The B whisper-to-the-girl window is about 4 seconds, and the kiosk window is about 9 seconds. The countdown can be paused, but neither is generous.
- **Lenient Brin Lane delays.** Whispering to Kath *before* she wades in delays her enough that the parcel has sunk by the time she would go back, so she survives. This follows the scene's rules, but it is more forgiving than intended.
- **The play-through doesn't click the canvas for abilities.** It calls the menu's handlers directly, and teleports the ghost in a few steps. Canvas hit-testing is exercised only for tap-to-move and hover.
- **Simple visuals.** The art is procedural primitives: iso boxes and simple figures. Some tall walls hide small areas. In Five Ways the approaching car is mostly shown as headlight glow in the fog.
- **The chapel bell's timing is random.** It uses `Math.random`. This is audio only and never touches the simulation, which is fully deterministic.
