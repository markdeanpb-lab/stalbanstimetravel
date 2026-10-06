# Assets and credits

Almost everything in the game is made in code at load time: the town and its buildings, the people, the vehicles, the trees, the signs, the sky, the sounds and the music. This page covers the few things that are not. These are the scanned surface textures and the third-party libraries, and every one is under a licence that allows redistribution.

## Scanned surface textures (CC0)

The brick, plaster, render, roof and ground surfaces are photo scans from [Poly Haven](https://polyhaven.com). Poly Haven releases all its assets under [CC0 1.0](https://polyhaven.com/license), so they can be used and redistributed for any purpose without attribution. The artists are credited here anyway.

| Layer in the game | Texture | Artist(s) | Real size |
|---|---|---|---|
| Red brick (Georgian) | [Large Red Bricks](https://polyhaven.com/a/large_red_bricks) | Rob Tuytel | 2.0 × 2.0 m |
| Red brick (Victorian, darker) | [Red Brick 03](https://polyhaven.com/a/red_brick_03) | Rob Tuytel | 1.0 × 1.0 m |
| Yellow stock brick | [Yellow Brick](https://polyhaven.com/a/yellow_brick) | Rob Tuytel | 2.0 × 2.0 m |
| Stucco and paint | [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall) | Amal Kumar | 2.0 × 2.0 m |
| Render (1960s and modern) | [Rough Concrete](https://polyhaven.com/a/rough_concrete) | Dimitrios Savva | 1.23 × 1.23 m |
| Clay plain tiles | [Clay Roof Tiles 03](https://polyhaven.com/a/clay_roof_tiles_03) | Amal Kumar | 2.6 × 2.6 m |
| Slate | [Grey Roof 01](https://polyhaven.com/a/grey_roof_01) | Rob Tuytel | used at 5 × 5 m |
| Flat felt roofs | [Tarred Gravel](https://polyhaven.com/a/tarred_gravel) | Dimitrios Savva | 2.2 × 2.2 m |
| Lead | [Metal Plate 02](https://polyhaven.com/a/metal_plate_02) | Rob Tuytel | 2.0 × 2.0 m |
| Concrete paving slabs (1964, 2026) | [Concrete Pavement](https://polyhaven.com/a/concrete_pavement) | Charlotte Baglioni | 1.8 × 1.8 m |
| York stone flags (1897) | [Red Sandstone Pavement](https://polyhaven.com/a/red_sandstone_pavement) | Amal Kumar | 2.15 × 2.15 m |
| Asphalt | [Worn Asphalt](https://polyhaven.com/a/worn_asphalt) | Amal Kumar | 2.0 × 2.0 m |
| Granite setts | [Cobblestone Square](https://polyhaven.com/a/cobblestone_square) | Rob Tuytel | 1.0 × 1.0 m |
| Grass | [Sparse Grass](https://polyhaven.com/a/sparse_grass) | Amal Kumar | 2.0 × 2.0 m |
| Macadam roads (1897) | [Dirt](https://polyhaven.com/a/dirt) | Charlotte Baglioni | 2.0 × 2.0 m |
| Gravel paths | [Gravel Floor](https://polyhaven.com/a/gravel_floor) | Jenelle van Heerden, Matterfield | 2.25 × 2.25 m |

Knapped flint, used for the Clock Tower and the Cathedral, has no suitable free scan. `tools/fetch_textures.py` generates it from a seeded random pattern: dark nodules, some with a white rind, set in lime mortar. It is released under CC0 with the rest of the project's generated assets.

### How the textures are packed

`tools/fetch_textures.py` downloads the 1K maps from Poly Haven's public API and builds `game/js/data/pbr_textures.js`, about 2.7 MB. That one script holds all the textures as WebP data URIs, so the game still runs from `file://` with no network access. For each layer the script:

1. Resizes the colour, normal (OpenGL convention) and height maps to 512 × 512.
2. Stores the colour map as one WebP.
3. Stores the height map, plus the normal map's X and Y for the structured surfaces, as one greyscale strip. Fine-grained surfaces (asphalt, gravel, grass, render, felt, dirt, flint) ship height only, and the game derives their normals in the browser.
4. Records the real-world size, the mean colour, and the parameters the game uses to derive roughness and ambient occlusion from height.

At load, `game/js/world/pbr.js` decodes these into two texture arrays shared by the facade, roof and ground shaders. Phones on Low quality use 256 × 256 layers. To rebuild the pack:

```sh
python3 -I tools/fetch_textures.py --cache /tmp/pbr-cache --preview /tmp/pbr-preview.jpg
```

## Libraries

All are bundled into `game/vendor/three.min.js` by `tools/vendor-three.sh`, with their licence files beside it.

| Library | Version | Licence | Used for |
|---|---|---|---|
| [three.js](https://threejs.org) with BufferGeometryUtils, SkeletonUtils and Sky | r186.1 | MIT (`game/vendor/three.LICENSE.txt`) | Rendering |
| [postprocessing](https://github.com/pmndrs/postprocessing) | 6.39.5 | Zlib (`game/vendor/postprocessing.LICENSE.txt`) | Bloom, depth of field, SMAA, the effect pipeline |
| [N8AO](https://github.com/N8python/n8ao) | 2.0.1 | CC0 (`game/vendor/n8ao.LICENSE.txt`) | Screen-space ambient occlusion |

## Map data

Building footprints, streets and land use come from [OpenStreetMap](https://www.openstreetmap.org/copyright), © OpenStreetMap contributors, under the [Open Database Licence](https://opendatacommons.org/licenses/odbl/). The in-game Credits screen shows this attribution. `tools/build_map.py` describes the extraction.

## Made in code

None of these use asset files:

- **People:** skinned procedural bodies, painted faces, hair, clothing and hats (`game/js/entities/characters.js`).
- **Vehicles and horses:** `game/js/entities/vehiclemodels.js` and `vehicles.js`.
- **Trees and leaves:** `game/js/world/trees.js`.
- **Building details:** window and shopfront art, signs and plaques (`game/js/world/textures.js`). Every business name is fictional.
- **Effects:** smoke, leaves, fireworks and pigeons (`game/js/world/fx.js`).
- **Sound and music:** the Web Audio synthesis in `game/js/core/audio.js` and `music.js`.
