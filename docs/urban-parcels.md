# Procedural urban aprons and parking forecourts

Westbrook's procedural buildings now receive a narrow terrain-following concrete apron instead of meeting the grass plane directly. `buildUrbanParcel` expands each footprint by two metres per side, rotates the grid with the building and samples the shared terrain height at every vertex. The grid is appended to the existing collision-bearing structure batch, so the visible hardscape and `Concrete` wheel-contact surface are the same geometry.

Two thirds of deterministic building seeds also request a street-facing parking forecourt. `buildUrbanForecourt` measures the actual building setback and road width, refuses sites with less than three metres of safe space, and caps the paved depth at seven metres before the outer sidewalk. Its darker terrain-following surface shares the physical structure batch; restrained white bay separators join the cell's ordinary road-marking batch. The first separate-inlay version raised the repeated city resource count to 510 meshes and was rejected; shared finalization reduces it to 498, only two above the parcel-only checkpoint.

This remains a grounding treatment for background buildings, not a city-wide pavement layer or finished streetscape. A later [model-reuse pass](parked-model-reuse.md) fills a sparse subset of these bays with the same authored Velara LOD used elsewhere; Westbrook still needs broader sidewalk continuity, people and additional street life.

## Verification — September 21, 2026

- Pure coverage checks finite rotated bounds, terrain support, vertex colour and a bounded 20–90 triangle range. Forecourt tests cover clearance refusal, terrain support, bounded pad geometry and visible marking output. A cell-blueprint integration test proves both surface types live in the collision-bearing `Concrete/structure` batch.
- Forced WebGL2 and actual WebGPU pass the four authored Westbrook views and ordinary driving. Opened overview and driving captures show clean edges, readable parking bays and no grass bleed or z-fighting; existing roads and authored plazas remain intact. A thin access-path trial was rejected because it was usually hidden and did not materially improve the images.
- The supplied loader-aware keyboard sequence reaches **10.933m/s**, with four grounded mixed contacts, zero damage, 12 physical plus 12 distant traffic actors and no failed cells.
- Low city measures **217 draws / 432,509 triangles** and wet night **218 / 432,654**. The forecourts add about 1,640 city triangles beyond the apron-only checkpoint; captured draw counts vary with reflection-face submission but remain far below 300. Race maxima remain **298 / 487,166** for GT and **281 / 484,764** for Formula.
- Three repeated city/forest/lake loops retain exact resource counts of **498/74/44**, **368/75/45** and **318/74/44**. Three race/home cycles return to **138/73/43** and zero world cells.
- The complete suite passes **235 tests / 37 files**. Strict TypeScript, nineteen KTX2 assets and the production build pass (`index-tDFsprbG.js`, `cell-worker-BxudDnB6.js`). Cold25Mbps/40ms local production reaches menu in **6.292s forced WebGL2 / 5.677s automatic request**, transfers **12,978,168 bytes**, enters Free Drive/Northstar and records no page, failed or external requests.

These are development-machine checks. They do not certify the secondary 8GB integrated-GPU laptop, a real Internet transfer, process/GPU memory, long endurance or an authorized HTTPS deployment.
