# Reused parked-car scenery

Procedural Westbrook forecourts now receive a sparse parked-car population by reusing the existing **Velara LOD1** model. There is no separate background-car mesh, material set or texture. Every placement comes from the same loaded GLB container used by the driveable car; Babylon creates ordinary source meshes once and hardware instances for the repeated hierarchy. Seventeen cars in the representative city stream share 21 geometries and 10 materials across 374 visible mesh parts.

`buildUrbanForecourt` remains responsible for physical fit. A parked placement is emitted only when the paved depth is at least five metres and a deterministic one-in-four seed gate passes. The car is centred inside a marked bay and faces the street. Each streamed detail owner creates one shared-model instance and a hidden 4.4 × 1.86 × 1.05 m static collision box. Collision ownership follows the cell; leaving detail or clearing the cell disposes the instance, box and Havok resources. The shared source geometry/material cache remains resident for reuse and does not grow across transitions.

The first implementation attempt created a bespoke procedural sedan. Although its numeric placement and collision checks passed, opened screenshots showed a blocky low-poly shape partly reading against grass. That attempt was removed rather than counted as a graphics improvement. The accepted captures show the actual Kairos body, glazing, wheels and lamps grounded inside the paved bay on both WebGL2 and WebGPU.

## Verification — September 21, 2026

- `tests/urban-parcel.test.ts` covers the deterministic density gate, deep/shallow setback behavior, placement bounds, terrain support and street-facing orientation.
- `scripts/verify-reused-parked-cars.mjs` finds 17 Velara roots on each renderer, 374 parts backed by 21 geometries and 10 materials, and a collision-ray hit 1.64 m above terrain. It rejects renderer mismatches, unshared resources, missing collisions, browser errors and external requests.
- Opened close captures show the detailed Velara entirely on the marked concrete forecourt with matching WebGL2/WebGPU composition. The wider aerial confirms that parked cars improve selected building lots but do not by themselves finish the still-open broad-lawn and pedestrian/street-life art gap.
- Low city traffic measures **254 draw calls / 461,557 triangles**; wet night measures **255 / 461,702**. The GT grid remains the draw-call peak at **298 / 487,166**, and every measured scene stays below the 300-draw / approximately 500k-triangle Low targets.
- Three city/forest/lake loops repeat exactly at **889/84/44**, **368/85/45** and **318/84/44** meshes/materials/textures. Three race/home cycles return to **138/83/43**, zero world cells and no retained parked instances or collision bodies. Ten parked-source materials stay cached for reuse; their count does not grow.
- The supplied driving sequence reaches **10.933 m/s**, remains grounded with four contacts and zero damage, and reports no loading failure. The complete suite passes **236 tests / 37 files**; strict TypeScript, nineteen KTX2 files and production build pass.
- Cold-cache 25 Mbps/40 ms local production reaches the menu in **6.327 s forced WebGL2 / 5.688 s automatic**, transfers **12,794,923 bytes**, enters Free Drive/Northstar and records no page, failed or external requests.

These are development-machine checks, not the actual 8 GB integrated-GPU laptop, a 30-minute process/GPU-memory certification or authorized HTTPS deployment.
