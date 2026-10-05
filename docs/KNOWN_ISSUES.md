# Known issues and next steps (Milestone 1)

This page covers the state of the build at the end of Milestone 1: what is known to be missing or rough, what could not be tested here, and the order I would expand the map and story in. Test evidence is in [`VERIFICATION.md`](VERIFICATION.md).

## Not tested on real hardware

These could not be checked in the build environment, which has no GPU, speakers, phone or controller. Each needs a person and a device.

| Area | What was done instead | What still needs doing |
|---|---|---|
| **Frame rate on a mid-range Android phone (target 30 fps)** | Measured what drives the frame rate in headless Chromium, using the phone preset (915 × 412, Low quality). The results were 51–93 draw calls, 89k–142k triangles, and 0.5–2.3 ms of simulation per step on the test machine. See `tools/perf.js`. | Play for 10 minutes on a real mid-range phone with the counter on (**Settings → Show frame rate**). The heaviest scene is 1897 at the Clock Tower with the Jubilee crowd. |
| **Frame rate on desktop (target 60 fps)** | The same measurements on the High preset: 105–161 draw calls with shadows and 200k–285k triangles. | Check on integrated graphics (an Intel Iris/UHD class laptop). |
| **Audio** | All sound is procedural Web Audio and was not played back here (no audio device). | Listen to each era's ambience, the bell (Gabriel), sirens and whistles, engines and hooves, and check the mix levels. |
| **Gamepad** | The standard Gamepad API mapping is implemented. | Try an Xbox or PlayStation pad in Chrome and Firefox. |
| **Touch on a physical phone** | Emulated touch through Chrome DevTools: the stick moves the player, dragging turns the camera, the Key button winds. | Check thumb comfort, two-thumb use (stick and look together), notches and safe areas, and the browser's own gestures (pull to refresh, back swipe). |
| **Safari and iOS** | Not tested. | iOS Safari has stricter audio unlock and memory limits. |
| **Long sessions** | Not tested. | Look for memory growth over a 30-minute session with many jumps; each era is rebuilt only when a consequence flag changes. |

## Known issues

Issues are grouped by area and roughly ordered by how noticeable they are.

### Performance and memory

1. **All three eras are built at start-up and stay in memory.** Load takes 6–7 s in headless Chromium on the test machine and will be longer on a phone. Geometry is about 21 MB. Textures are about 90–100 MB, estimated as the sum of uploaded images: mostly the three sign atlases and the ground paint. Building an era only when you first wind to it would roughly halve both.
2. **There is no automatic quality drop.** The game picks Low on touch devices and High elsewhere, but it does not lower settings if the frame rate stays below target.
3. **WebGL context loss is not handled.** If a phone browser discards the GPU context, for example after a long time in the background, the page needs a reload.

### World and visuals

4. **Buildings are generated from OpenStreetMap footprints.** Heights and storey counts are estimated, facades are generic per street zone, and only landmarks and story buildings are authored. Changes between eras are modelled where documented (Christopher Place, the Peahen, Heritage Close, the 1897 yards); other plots keep their 2026 footprint.
5. **Landmarks are simplified.** The Cathedral is massing plus the Victorian west front, with no interior or detailed tower. The Clock Tower has no interior stair. The Abbey Gateway is two flint blocks bridged over the passage.
6. **People are low-poly figures** with no faces or facial animation. All dialogue is subtitled text with no recorded voices.
7. **There are no dynamic lights at night.** 1897 relies on lit windows, lamp glows and pools painted on the ground. Shadows are on High quality only.
8. **In the narrowest alleys the camera can end up very close.** It cranes up and swings aside first. At under 0.9 m it hides Robin rather than clipping through, but the view is cramped.
9. **Time-wave transition.** Buildings and props fold and unfold at the ring, but loose meshes such as signs and plaques pop at the ring instead of folding.

### People, traffic and police

10. **Police AI is basic.** Constables follow the pavement graph with A* and cars follow the lane graph. There are no roadblocks or flanking, and units can be lost easily through the walk-through passages (Waxhouse Gate, Half Moon Yard).
11. **AI traffic has no junction priority or traffic lights.** It stops for people in front of it, but queues can bunch and overlap at junctions.
12. **Pedestrians separate from each other but sometimes overlap in dense crowds**, such as the 1897 Jubilee crowd by the Town Hall.
13. **The chase cart follows a fixed route** from the Town Hall to Romeland. It overtakes traffic and eases off when tired, but does not react to the player. If you stand still during the chase, the police catch you and the chase restarts.

### Story and saving

14. **The mission is linear between checkpoints.** Reloading mid-chase resumes at the start of the 1897 search (`b2`), by design.
15. **Save codes are long** (about 1–2 KB of base64). They are checksummed and validated, but awkward to type by hand; copy and paste is expected.
16. **Only `fund_outcome` drives what you see.** `crabbe_fate` and `josiah_cleared` always change together with it in this mission, and `met_young_edie` is set on every playthrough, so none of them has effects of its own yet (see the revised note in [`DESIGN.md`](DESIGN.md#consequence-flags-opening-mission)).

### History and data

17. The **research gaps** listed in [`RESEARCH.md`](RESEARCH.md#gaps-to-verify-before-expanding) still apply. They are the 1897 dial, the date the Worley fountain was removed, the lamp pattern, 1964 police-car warning equipment, the town's own Jubilee programme, shop-level detail, and kerbs and steps from a finer terrain model.
18. Shop names and characters are invented and placed according to the documented use of each frontage where that was known. Nothing represents a real current business.

## Fixed during verification

These were found by the checks in [`VERIFICATION.md`](VERIFICATION.md) and fixed before release. They are listed because they show what the checks catch.

- **Signs disappeared from the 1897 Cathedral.** The 1897 sign atlas (268 painted fascias) ran out of room and silently dropped the Cathedral's west window and porch doors. The atlas now packs on a tall canvas and crops to the rows actually used.
- **Lit windows looked like static.** The per-window lit or dark choice hashed an interpolated seed, which flickered per pixel. The seed is now rounded first.
- **Market stalls and phone boxes on St Peter's Street could be walked through.** Their colliders used absolute heights, so they sat below the ground on the uphill end. They are now relative to the ground.
- **A crime report could follow you through time.** The delayed "passer-by reports you" used a real-time timer. All state-changing delays now run on game time, pause with the game and are dropped when you change year.
- **The chase cart stalled behind slow traffic and started facing the wrong way.** Traffic on the escape route is now cleared, the cart overtakes, and it joins the route ahead of itself.
- **The Town Hall portico columns were bunched together**, and **the flint looked like camouflage**. The portico now spans the real projecting front, and flint is drawn as packed nodules in lime mortar.

## Next steps, in priority order

### 1. Measure on real devices, then tune (before adding content)

- Play-test on one mid-range Android phone (for example a Pixel 6a or Galaxy A54 class) and one integrated-GPU laptop, and record frame times per era.
- Build eras lazily, and drop an era's GPU resources when it has not been visited for a while, keeping its flags and memory of police heat.
- Add adaptive quality: step down from High to Medium to Low if the frame time stays above budget for 5 s.
- Recover from WebGL context loss by rebuilding era textures from data.

### 2. Expand the map, one area at a time

Each area follows the same steps:

1. Extend `tools/build_map.py` (the `STREETS` widths, `CLIP` boxes and `AREAS`) and re-export `mapdata.js`.
2. Move the boundary barriers to the new openings.
3. Research the frontages for each era (Kelly's directories, the council's conservation area appraisals and the Museum's photo collections).
4. Write era overrides and fictional businesses.
5. Run `tools/verify.js` and `tools/playthrough.js`.

The areas, in order:

1. **Holywell Hill down to the Abbey Mill and the river.** This is the steepest street in the centre, which makes it ideal for chases and the vehicle physics. In 1897 it had coaching inns. It joins the existing Abbey Gateway and Romeland edge.
2. **Fishpool Street to St Michael's.** A long, curving, historic street that leads to the Verulamium Park edge. It adds the river and lake in all three eras.
3. **Bernard, Catherine, Grange and Dalton Streets.** Terraced residential streets east of St Peter's Street. They give quieter streets, back alleys for escaping police, and homes for Mission 2 characters.

### 3. Story: Mission 2, *The Curfew Man*

- Follow the teaser at the end of Mission 1: someone else has been winding a key.
- Use one new year-specific location per era (for example, the 1964 Town Hall cells before the Council left in 1966).
- Pay off the `crabbe_fate` and `josiah_cleared` flags with different allies and suspects for each Mission 1 outcome.
- Explain the 1971 parcel: how Edie knew to leave it for Robin.

### 4. Systems that make the world deeper

- **Interiors** for Edie's shop (1964), the Town Hall court room (1897) and a Clock Tower climb to the bell.
- **One or two side activities per era**, as the brief allows. Examples: a 2026 delivery-rider time trial, the 1964 scooter rally (extending the scooter sprint), and the 1897 Jubilee bicycle race.
- **Police roadblocks** at the district exits, and traffic lights with junction priority in 1964 and 2026.
- **Recorded voices** for the main cast, keeping subtitles on by default.

### 5. History pass

- Close the research gaps (see item 17 above) using the Hertfordshire Archives and the St Albans Museums collections.
- Upgrade the Clock Tower dial and the 1897 street lighting once the sources are confirmed.

### 6. Tooling

- Run `tools/verify.js` and both `tools/playthrough.js` endings in CI (GitHub Actions with Playwright) on every push, and publish the screenshots as artefacts.
- Add a frame-time capture to `tools/perf.js` for when a real GPU is available.
