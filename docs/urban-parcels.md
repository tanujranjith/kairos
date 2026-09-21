# Procedural urban parcel aprons

Westbrook's procedural buildings now receive a narrow terrain-following concrete apron instead of meeting the grass plane directly. `buildUrbanParcel` expands each footprint by two metres per side, rotates the grid with the building and samples the shared terrain height at every vertex. The grid is appended to the existing collision-bearing structure batch, so the visible hardscape and `Concrete` wheel-contact surface are the same geometry.

The aprons add no material, texture, light, scene mesh, draw call or request. They remain deliberately small: this is a grounding treatment for background buildings, not a replacement for authored plazas, a city-wide pavement layer or finished streetscape art. Westbrook still needs broader sidewalk continuity, parking detail, people and additional street furniture.

## Verification — September 21, 2026

- Pure coverage checks finite rotated bounds, terrain support, vertex colour and a bounded 20–90 triangle range. A cell-blueprint integration test proves apron vertices live in the collision-bearing `Concrete/structure` batch.
- Forced WebGL2 and actual WebGPU pass the four authored Westbrook views and ordinary driving. Opened overview and driving captures show clean edges without grass bleed or z-fighting; existing roads and authored plazas remain intact.
- The supplied loader-aware keyboard sequence reaches **10.933m/s**, with four grounded mixed contacts, zero damage, 12 physical plus 12 distant traffic actors and no failed cells.
- Low city increases from **218 draws / 428,325 triangles** to **218 / 430,869**; wet night increases from **219 / 428,492** to **219 / 431,036**. Race maxima remain **298 / 487,166** for GT and **281 / 484,764** for Formula.
- Three repeated city/forest/lake loops retain exact resource counts of **496/74/44**, **368/75/45** and **318/74/44**. Three race/home cycles return to **138/73/43** and zero world cells.
- The complete suite passes **234 tests / 37 files**. Strict TypeScript, nineteen KTX2 assets and the production build pass (`index-wea1ar_Z.js`, `cell-worker-CxwQoy_V.js`). Cold25Mbps/40ms local production reaches menu in **6.371s forced WebGL2 / 5.728s automatic request**, transfers **12,977,924 bytes**, enters Free Drive/Northstar and records no page, failed or external requests.

These are development-machine checks. They do not certify the secondary 8GB integrated-GPU laptop, a real Internet transfer, process/GPU memory, long endurance or an authorized HTTPS deployment.
