# Research notes: St Albans in 1897, 1964 and 2026

These notes list the sources consulted for Milestone 1. Each modelled feature is marked:

- **Documented**: stated in a source listed below.
- **Inferred**: a reasonable deduction from documented facts, national practice or the map. It is not confirmed for this exact spot or year.
- **Invented**: fiction made for the game.

Every business, character and newspaper in the game is invented. Real buildings appear as settings only. Where a real building has a recognisable current occupant, the game gives it a fictional one.

## Sources

| # | Source | Used for |
|---|---|---|
| S1 | OpenStreetMap contributors, API extract of bbox −0.3460, 51.7488, −0.3360, 51.7555, downloaded 5 Oct 2026 (ODbL 1.0). Raw extract in `tools/data/district.osm.gz`. | Street centrelines, names, building footprints, Cathedral `building:part` heights, crossings, green areas |
| S2 | Mapzen/AWS "Terrarium" terrain tiles, zoom 15 (UK sources include Environment Agency LIDAR, OGL; elsewhere SRTM) | Ground heights on a 20 m grid (`tools/data/elev_grid.json`) |
| S3 | St Albans City & District Council, *Conservation Area Character Statement, Area 4a: The Commercial Centre* (PDF), https://www.stalbans.gov.uk/sites/default/files/documents/publications/planning-building-control/conservation/16.03.03%20Area%204a%20-%20Commercial%20Centre%20FINAL%20JD_tcm15-53958.pdf | Street character, storey heights, materials, the infilled medieval market triangle, the Eleanor Cross site, lime trees (1881) and planes (from 1999), the 1906 telephone-pole protest, the Corn Exchange, the K6 in Boot Alley, the Waxhouse Gate arch and memorial, plot amalgamation on St Peter's Street, Christopher Place / Gentle's Yard, the 1960s Civic Centre by Gibberd, the Peahen junction |
| S4 | Wikipedia, *Clock Tower, St Albans*, https://en.wikipedia.org/wiki/Clock_Tower,_St_Albans | Dates, 19.6 m height, five floors, flint with freestone, semaphore station, Gabriel, 1866 restoration |
| S5 | St Albans Museums, *Talking Buildings: The Clock Tower* (2016), https://www.stalbansmuseums.org.uk/sites/default/files/attachments/the_clock_tower_0.pdf | Gabriel (one ton, 46 in), curfew times, bell last swung 1901, 1866 Moore clock, 1958 copper face, railings, turret and weathervane, saddler's shop in the early 1890s, interior uses until c.1900 |
| S6 | Gilbert Scott database, *Clock Tower* and *Worley Drinking Fountain*, https://gilbertscott.org/buildings/clock-tower-market-place-st-albans and https://gilbertscott.org/buildings/worley-drinking-fountain-st-albans/ | Scott's c.1865–66 restoration; granite quatrefoil fountain (1874) in front of the tower, later moved |
| S7 | Wikipedia, *St Albans Town Hall*, https://en.wikipedia.org/wiki/St_Albans_Town_Hall | George Smith; Ionic tetrastyle portico; court until 1972; council moved out in 1966; Museum + Gallery from 2018 |
| S8 | St Albans Times, *Genesis of Christopher Place shopping centre revealed*, https://stalbanstimes.co.uk/feature/genesis-of-christopher-place-shopping-centre-revealed/ | Inn yards and Gentle's Yard slum in the 1890s; council purchase in 1949; rubble car park and cut-through in the 1960s; excavation in 1966; built in the 1980s |
| S9 | Prison History, *St Albans City Police Station*, https://www.prisonhistory.org/lockup/st-albans-city-police-station/; British Police History, *St Albans City Police*, https://british-police-history.uk/f/st-albans/ | Borough Police from 1836, renamed City Police in 1877; Town Hall cells; Chequer Street station from 1861; Victoria Street from 1893; merged into Herts Constabulary in 1947 |
| S10 | Herts Past Policing, *St Albans Police Station, 1963–1964*, https://www.hertspastpolicing.org.uk/content/police-history/other/st-albans-police-station-1963-1964-2 (read via search summary; direct fetch returned 403) | Temporary station at Bricket Road while Victoria Street was demolished and rebuilt; a "noddy rider" in October 1964 |
| S11 | Herts Past Policing, *Wolseley Patrol Car* and vehicle pages, https://www.hertspastpolicing.org.uk/content/police-history/police/1946-wolseley-patrol-car-hjh-310 | Herts Constabulary used Wolseley 6/80 and 6/90 cars in the 1950s; bells fitted |
| S12 | Wikipedia, *Alban Arena*, https://en.wikipedia.org/wiki/Alban_Arena; Gibberd practice history | City Hall built 1965–68 (so not standing in 1964); Gibberd appointed in 1958 |
| S13 | St Albans Times, *Looking back over the 500-year history of the Peahen*, https://stalbanstimes.co.uk/feature/looking-back-over-the-500-year-history-of-iconic-city-centre-pub-the-peahen/; Hertfordshire Genealogy, Holywell Hill walk, http://www.hertfordshire-genealogy.co.uk/data/places/places-s/st-albans/st-albans-walk-holywell-peahen.htm | The Peahen was demolished and rebuilt in 1898 |
| S14 | Wikipedia, *Abbey Gateway, St Albans*, https://en.wikipedia.org/wiki/Abbey_Gateway,_St._Albans; St Albans School history (search summary) | Built 1365; used as a prison until 1867; part of the school from 1871 |
| S15 | British History Online, *VCH Herts vol. 2: The city of St Albans: introduction*, https://www.british-history.ac.uk/vch/herts/vol2/pp469-477; Wikipedia, *Fleur de Lys, St Albans* | French Row history; the Fleur-de-Lys and Christopher inns; the C18 brick façade of the Fleur-de-Lys |
| S16 | Wikipedia, *Diamond Jubilee of Queen Victoria*, https://en.wikipedia.org/wiki/Diamond_Jubilee_of_Queen_Victoria (and local-history pages for other towns, found by search) | 22 June 1897 national celebrations: bunting, illuminations, processions and dinners for the poor |
| S17 | Wikipedia, *St Albans Market*, https://en.wikipedia.org/wiki/St_Albans_Market | Wednesday and Saturday market along St Peter's Street |
| S18 | Wikipedia, *1964 United Kingdom general election* (general knowledge) | Polling day was Thursday 15 October 1964 |

No photographs, maps or images from these sources are bundled. Map data comes from OSM under ODbL, with attribution shown in the game's Credits screen and in `js/data/mapdata.js`.

## Why these years

- **1897** (Tuesday 22 June, Diamond Jubilee night). It is a documented national festival (S16), which gives a natural reason for crowds, bunting and a brass band. Several local facts fix the townscape to this year:
  - The Clock Tower's ground floor was still a saddler's shop and the clock keeper lived upstairs; that arrangement lasted until c.1900 (S5).
  - Scott's 1874 granite fountain stood in front of the tower (S6).
  - The City Police had just moved to Victoria Street (1893, S9).
  - The Peahen had not yet been rebuilt (1898, S13).
  - The St Peter's Street limes were 16 years old (S3).
  - There were no telephone poles on St Peter's Street; the protest came in 1906 (S3).
  - The Cathedral's Victorian west front was complete.
- **1964** (Saturday 10 October, market day). The police station on Victoria Street was being demolished and rebuilt, so officers worked out of Bricket Road, and a "noddy rider" was on the books in October 1964 (S10). The Christopher Place site was a council-owned rubble car park; it was bought in 1949 and excavated in 1966 (S8). The council still sat in the Town Hall until 1966 (S7), and City Hall was not yet built (S12). The date falls five days before the general election (S18), a market Saturday (S17), and is still pre-decimal.
- **2026** (Monday 5 October): the brief's present day, and the date the solicitor's parcel is due.

## Feature register

### Layout and terrain
| Feature | Era(s) | Status | Notes |
|---|---|---|---|
| Street network, names and junctions | all | Documented (S1) | Same street plan in all three eras. Spencer Street (cut 1834) and Verulam Road (1825) both pre-date 1897 (S3). |
| Building footprints | 2026 | Documented (S1) | Simplified to 0.25 m. |
| Footprints in 1897 and 1964 | 1897, 1964 | Inferred | The modern footprints are re-split into narrow plots (≈6.5 m in 1897, ≈11 m on St Peter's Street and the High Street in 1964), following S3's account of later plot amalgamation. Plot lines are approximate. |
| Ground heights and slopes (High St ≈ 110 m, Town Hall ≈ 115 m, George St falling ≈ 8 m to Romeland, Abbey west front ≈ 100 m) | all | Documented (S2), smoothed | A 20 m grid is too coarse for steps and kerbs; those are not modelled. |
| Storey heights and materials per street | all | Inferred (S3) | Examples: George Street is medieval, jettied and stuccoed; the east side of St Peter's Street is Georgian brick; Chequer Street has Victorian 2–3½ storeys; Market Place mixes 2–3 storeys. Individual heights are randomised within those ranges. |
| Road and pavement widths | all | Inferred (S1 frontages) | Tuned per street. |
| Market triangle infill, with alleys (Boot Alley, Pudding Lane, Lamb Alley) | all | Documented (S1, S3) | |

### Landmarks
| Feature | Era(s) | Status | Notes |
|---|---|---|---|
| Clock Tower: five stages, flint with stone quoins, battlements, 1866 turret with weathervane | all | Documented (S4–S6) | Proportions simplified. |
| Clock face on the south side; 1958 copper face | 1964, 2026 | Documented (S5) | Colours are inferred. |
| Clock dial in 1897 | 1897 | Inferred | Not confirmed which dial existed before 1958. |
| Clock stops at 9.14 on Jubilee night | 1897 | Invented | Story device. |
| Saddler's shop sign and harnesses at the tower base; railings around it | 1897 | Documented (S5) | Name changed to the fictional "W. Ashby". |
| Clock keeper living upstairs | 1897 | Documented arrangement (S5) | Josiah Pennick is invented. |
| Gabriel bell, curfew role, tolling | all | Documented (S4, S5) | The sound is synthesised and its pitch is invented. |
| Eleanor Cross site in front of the tower | all | Documented (S3, S4) | Used as a discovery. |
| Worley drinking fountain, 1874 | 1897 | Documented (S6) | The model is simplified. |
| Fountain absent | 1964 | Inferred | The relocation date was not found. |
| Town Hall, 1826–31, George Smith, Ionic portico, stucco | all | Documented (S3, S7) | The portico faces north up St Peter's Street; inferred from the layout and S3's "focal point". |
| "V R 1837–1897" illumination | 1897 | Inferred | Common Jubilee practice; not verified for St Albans. |
| "Museum + Gallery" lettering | 2026 | Documented (S7) | |
| Corn Exchange, 1857: single storey, gault brick, pediment | all | Documented (S3) | Footprint taken from two OSM units (inferred). |
| Cathedral massing: nave, transepts, crossing tower, west turrets | all | Documented (S1 building:part heights) | The transept is synthesised from the four turrets (inferred). Window tracery is invented. |
| Victorian west front with three porches | all | Documented (well recorded; no single source retrieved here) | Simplified. |
| Abbey Gateway with the lane passing under its arch | all | Documented (S1, S14) | Detailing is invented. |
| Waxhouse Gate arch with a passage to the Abbey | all | Documented (S1, S3) | |
| Street war memorial on the arch | 1964, 2026 | Documented (S3) | Absent in 1897 (inferred: post-1918). |
| Peahen corner: old inn in 1897, rebuilt 1898 | all | Documented date (S13) | The 1897 appearance is approximated. Named "The Peacock" in game (fictional). |
| Fleur-de-Lys on French Row, C18 brick front | all | Documented (S15) | Named "The French King" in game, a nod to the legend of King John II of France. |
| Christopher Inn yard entrance off French Row | all | Documented (S1, S8, S15) | |
| Christopher Place shopping centre | 2026 | Documented (S3, S8) | Neo-medieval style, simplified. |
| Rubble car park on the Christopher site | 1964 | Documented (S8) | Rubble heaps are placed by the game (invented detail). |
| Gentle's Yard slum cottages | 1897 | Documented existence (S8) | Cottage layout invented. |
| Heritage Close (1970s) | 2026 | Documented (S3) | |
| Department store on the same site | 1964 | Documented (S3) | |
| Victorian buildings on that site | 1897 | Inferred | |
| Mid-C20 terrace at nos. 11–21 French Row | 1964, 2026 | Documented (S3) | Its date is inferred as before 1964; older buildings are shown there in 1897. |
| Baptist church spire, Upper Dagnall Street (1885) | all | Documented (S3) | Skyline element. |

### Street furniture, surfaces, lighting
| Feature | Era(s) | Status | Notes |
|---|---|---|---|
| Lime trees on St Peter's Street | 1897 (young), 1964 (mature) | Documented (S3) | Planted 1881. |
| Plane trees replacing the limes | 2026 | Documented (S3) | From 1999. |
| No telephone poles on St Peter's Street | 1897 | Documented (S3) | |
| Gas street lamps; lamp-light pools | 1897 | Inferred | National practice; local lamp design invented. |
| Tall concrete or steel lamp standards | 1964 | Inferred | |
| LED column lamps | 2026 | Inferred | |
| K6 kiosk in Boot Alley | 1964, 2026 | Documented (S3, listed) | Other K6 placements are inferred. |
| Penfold hexagonal pillar box | 1897 | Inferred | Type in use 1866–79. |
| Standard pillar box | 1964 | Inferred | |
| Belisha beacons at OSM crossing points | 1964, 2026 | Inferred | Beacons date from 1934 and zebra crossings from 1951; the locations are today's crossings. |
| Granite setts and blue brick in the Clock Tower square | 2026 | Documented (S3) | |
| Setts in Market Place and the High Street; macadam elsewhere | 1897 | Inferred | |
| Asphalt roads | 1964 | Inferred | |
| Saturday market stalls on St Peter's Street | 1964 | Documented market day (S17) | Stall design invented. |
| No market | 2026 | Documented | It is a Monday. |
| Cattle market on St Peter's Street | 1897 | Documented (S3), not shown | Jubilee night was a Tuesday holiday. |
| Jubilee bunting, crowd and brass band outside the Town Hall | 1897 | Inferred (S16) | Local specifics not found. |
| Era barriers at the district edge (2026 roadworks, 1964 trestles with red paraffin lamps, 1897 hurdles and crowd barriers) | all | Inferred and invented | Gameplay boundary. |
| Newspaper A-board | 1964, 2026 | Invented | "St Albans Chronicle" is fictional. |

### People, vehicles, police
| Feature | Era(s) | Status | Notes |
|---|---|---|---|
| Clothing: bowlers, boaters, flat caps, long skirts, leg-of-mutton blouses | 1897 | Inferred | National fashion history. |
| Clothing: trilbies, headscarves, beehives, parkas, A-line skirts | 1964 | Inferred | |
| Clothing: hoodies, puffers, trainers | 2026 | Inferred | |
| Pedestrian behaviour: phone-gazing, gawping at anachronisms, comic knock-downs | all | Invented (gameplay) | "Scorcher" was period slang for a reckless cyclist (inferred, common usage). |
| Safety bicycles, carts, hansom cabs, brewer's dray | 1897 | Inferred | |
| Generic 1960s saloons, small cars, bakery van, scooters, green double-decker country bus | 1964 | Inferred | No makes are named. |
| 2026 cars, bus, van, taxi | 2026 | Inferred | |
| St Albans City Police constables with whistles and custodian helmets; a sergeant on a bicycle | 1897 | Force documented (S9); kit and bicycle inferred | |
| Herts Constabulary "Noddy bike" | 1964 | Documented (S10) | |
| Black patrol car with a bell | 1964 | Inferred (S11) | It is not confirmed whether a bell or two-tone horns were in use in 1964. |
| Police arriving from the east (Victoria Street side) | 1964, 1897 | Inferred (S9, S10) | |
| Patrol cars in Battenburg livery with sirens; officers on foot | 2026 | Inferred | National practice. |

### Story
| Feature | Status |
|---|---|
| The Pennick family, Edie, Josiah, Robin, Aunt Bev, Crabbe, the Mayor, Mrs Abbott, Terry, Priya, Dot, Mrs Okafor | Invented |
| The Jubilee Dinner Fund, its theft, the Committee's gilded lamp, the Corn Exchange dinner | Invented (dinners for the poor were a documented national Jubilee custom, S16) |
| Lattimore & Hale solicitors; Phone Fixx; Pennick & Daughters; The Jubilee Table; the Gabriel Espresso Bar; Golding & Son; Crowther's bread van | Invented |
| The Curfew Key and its rules | Invented, built on Gabriel's documented curfew role |

## Gaps to verify before expanding
1. The exact appearance of the Clock Tower dial in 1897.
2. When the Worley fountain left the Market Cross.
3. Whether St Albans' 1897 street lamps were gas, and of what pattern.
4. Whether 1964 Herts patrol cars carried bells or two-tone horns.
5. St Albans' own Diamond Jubilee programme (local newspaper archives).
6. Shopfront-level detail for named frontages in 1897 and 1964, from trade directories such as Kelly's (as cited in S5).
7. A higher-resolution DTM for kerbs and steps, especially Waxhouse Gate and Romeland.
