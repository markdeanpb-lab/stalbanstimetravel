# CURFEW: St Albans Across Time. Milestone 1 design note

Written before building. Later changes are marked *(revised)*.

## Era years

| Era | Exact moment | Why this year |
|---|---|---|
| **Present** | Monday 5 October 2026, 4.40 pm, low autumn sun | This year was set in the brief. The Old Town Hall is now the Museum + Gallery, Christopher Place (1980s) is in place, and the plane trees have replaced the limes. |
| **1960s → 1964** | Saturday 10 October 1964, 11.30 am, market day | Victoria Street police station was being demolished and rebuilt in 1963–64, so the police worked from a temporary station off-map. That year's officers rode "Noddy bikes", which became the 1964 pursuit vehicle. The Christopher Place site was a council-owned rubble car park (bought 1949, excavated 1966). The City Council still met in the Town Hall (it moved out in 1966), and the Civic Centre hadn't been built yet. The general election fell on 15 Oct 1964, so the streets carry election posters. Money is pre-decimal. |
| **1890s → 1897** | Tuesday 22 June 1897, 9.13 pm, Diamond Jubilee night | It was a national festival night, with bunting, lanterns, a band and crowds. A saddler had the Clock Tower's ground floor and a clock keeper lived upstairs (until c.1900). Gilbert Scott's Worley fountain (1874) still stood in front of the tower. St Albans City Police had moved to Victoria Street in 1893. The old Peahen inn was still standing; it was rebuilt in 1898. The St Peter's Street limes were 16 years old, gas lit the streets, and the safety-bicycle craze was at its peak. |

## The device: the Curfew Key

The Curfew Key is an iron winding key from the Clock Tower's 1866 mechanism. Its brass collar is engraved with the motto of Gabriel, the tower's c.1335 curfew bell, and three notches are filed into it: **1897 · 1964 · 2026**. You turn it back to go back and turn it on to go forward. Its rules:

1. **Earshot.** The key works only where Gabriel can be heard, which is the playable district. At the edge it goes cold and does nothing. This rule doubles as the explanation for the soft boundary.
2. **Steady hands.** You must be on foot, standing still and not wanted by the police. Winding takes 2 seconds, and moving, being grabbed or being chased cancels it.
3. **Rest.** After each jump the key needs a rest before it will turn again. A short wind (1964 ↔ 1897 or 1964 ↔ 2026) needs 45 s; a long wind (1897 ↔ 2026) needs 90 s.
4. **Luggage.** The key carries you, your clothes and your pockets. It never takes vehicles, animals or other people. Anything you leave behind stays in that year, and history keeps it.
5. **Same place.** You arrive at the same spot in the other year. If something solid stands there in the target year (a wall, a cart, a bus or traffic), the key slips you to the nearest safe open ground, and you get one line of explanation.
6. **Gabriel answers.** Every wind makes the bell toll once, in both years. This rule is a clue to the central mystery.

Your clothes travel with you, so wrong-era clothing makes people stare and the police notice you sooner. You can change clothes at Edie's shop (1964) or the Clock Tower door (any era). The police can't follow you through time, but each era remembers your face, and its wanted level fades only slowly while you're away.

## Story premise

**Robin Pennick** (2026) belongs to a family that still carries a 129-year-old stain. On Jubilee night in 1897 the Clock Tower's clock stopped at 9.14 and the Jubilee Dinner Fund (£212) vanished from the Town Hall. **Josiah Pennick**, the clock keeper, was blamed. Robin's late Nana always insisted he was innocent. A solicitor has been holding a parcel since 1971 with instructions to hand it to Robin *in person on 5 October 2026*. It contains the Curfew Key and a letter from great-great-grandmother **Edie Pennick**, who seems to know Robin already.

The mystery is about the Pennick family and what really happened on Jubilee night, and its meaning shifts as you play:

1. It starts as "a clock keeper stole the fund".
2. Then it becomes "a clerk, Cuthbert Crabbe, used the stopped clock as cover".
3. Then you learn that Robin's own arrival stopped the clock: Gabriel answers the key.
4. Finally, Crabbe turns out to have taken the money to feed the poor after the Committee cancelled their dinner.

Later missions will ask who else has been winding the key (the "Curfew Man" teaser).

## District and boundary

The playable district covers the Clock Tower and Market Cross, French Row, Market Place with its alleys (Boot Alley, Pudding Lane, Lamb Alley), Chequer Street, the Old Town Hall square, St Peter's Street as far as roughly the Civic Centre entrance, the High Street to the Peahen junction, and George Street to Romeland. It also includes Waxhouse Gate, the Cathedral's west front and the Abbey Gateway. The street plan comes from OpenStreetMap (ODbL) and the ground heights from a terrain DEM. Exits are blocked by era-appropriate barriers in fog: 2026 has gas-main roadworks and Heras fencing; 1964 has striped trestles, red paraffin lamps and building-site hoardings; 1897 has hurdles, Jubilee crowd barriers and parked drays. Each barrier has a one-line Gabriel explanation and none is an invisible wall.

## Opening mission: "Wind the Key" (about 12 minutes)

1. **2026, about 3 min.** Robin takes Aunt Bev's phone call (personal motive), walks to the solicitors on the High Street (movement and camera), picks up the parcel (interaction) and reads Edie's letter. At the Clock Tower comes the **first wind**: the world rewinds around a still-playable Robin.
2. **1964, about 4 min.** On arrival a parked van is blocking the spot, which demonstrates the slip rule. Robin finds 84-year-old Edie on French Row. She teaches the key's rules in dialogue and gives a description of the thief: pale check suit, red carnation, carpet bag, smells of violets. Robin borrows Terry's scooter (the **vehicle tutorial**) to buy a Victorian coat and cap at the market, then changes into them (the clothing rule).
3. **1897, about 5 min.** Gabriel tolls and the clock stops. Using the 1964 description, Robin picks the real thief from three check-suited men. Crabbe flees in a baker's cart, and Robin chases him on young Edie's bicycle. St Albans City Police constables (whistles, a sergeant on a bicycle) give chase. Robin grabs the bag, loses the police, and then **chooses** where to take the fund: the **Town Hall** (clears Josiah, jails Crabbe, the Committee builds its gilded lamp) or the **Corn Exchange**, where the cancelled dinner goes ahead (the poor eat, but suspicion stays on Josiah).
4. **2026, about 1 min.** Robin winds forward to see the result. French Row now holds either a clockmaker's or a community kitchen, with a matching plaque, newspaper board, occupant and phone call. The mission-complete card summarises the change.

## Consequence flags (opening mission)

| Flag | Values | Drives |
|---|---|---|
| `fund_outcome` | `none` / `returned` / `dinner` | **1964:** Edie's shop name and stock, her dialogue, and the Town Hall lamp. **2026:** the French Row shopfront and occupant (Phone Fixx, Pennick & Daughters or The Jubilee Table), the Clock Tower plaque, the Museum lamp, the newspaper A-board and Aunt Bev's call |
| `crabbe_fate` | `unknown` / `jailed` / `fled` | Dialogue in 1964 ("the Crabbe business") and a museum caption in 2026 |
| `josiah_cleared` | bool | The Pennick plaque on the Clock Tower (1964 and 2026) and NPC lines |
| `met_young_edie` | bool | Old Edie's dialogue and the letter's existence (bootstrap) |

All flags are saved in localStorage and in the copyable save code. They are applied by one function (`World.applyFlags`) every time an era is built or shown, so every variant stays consistent.

## Build order (vertical slices)

1. Map pipeline (OSM to compact JS data, plus terrain heights) and the engine core: renderer, loop, input (keys, mouse, touch, gamepad), the camera with anti-clip, collision and save/load.
2. **2026 playable end to end:** buildings, landmarks, street furniture, pedestrians, traffic, a drivable car, police and wanted level, the HUD, minimap and audio.
3. 1964, then 1897: building and shopfront variants, period props, vehicles (scooter, bicycle, cart), police, lighting, fog and grading.
4. The key: winding, transition effects, safe-arrival search and rest timer.
5. The mission script, dialogue and subtitles, flags and world variants, discoveries and side activities.
6. Verification with headless Playwright scripts (the checklist below) and screenshots of each era, then fixes, docs and the zip.
