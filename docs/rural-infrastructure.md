# Rural infrastructure and field edges

Kairos now derives an original mid-ground infrastructure layer from the authored road network. Four utility corridors follow Lakeshore, Orchard Way, the lower Ridgeway route and Pinecrest. Road-relative stations place timber poles, crossarms, insulators and short three-wire spans. Four separate field-boundary corridors add two-rail timber fencing with periodic gate gaps. Five farm sites pair an existing detailed house module with a larger agricultural shed, giving open fields a visible destination and scale reference instead of isolated vegetation.

`src/content/rural-infrastructure.ts` owns the road fractions, spacing and setbacks. `src/world/rural-infrastructure.ts` resolves them into world-space data once, assigns every primitive or farm to exactly one 256m cell and rejects lake or junction-clearance placements. The cell worker merges pole, wire and fence geometry into one bark-material detail buffer per occupied cell. Farm walls, roofs and windows reuse the existing architecture batches. There is no per-pole mesh, material, texture, light or runtime request.

Poles, wires and fences are visual detail and deliberately do not add collision shapes; the authored farm buildings use the normal distant structure collision batch and remain more than 70m from a road. This preserves shoulder and off-road contact behavior and avoids hundreds of thin Havok shapes. Wire spans are twenty-metre road-following segments rather than a cable simulation, and the current farms have no people, animals, working machinery or crop animation. These are explicit limitations, not hidden completion claims.

## Measured verification

- Full-world pure checks cover deterministic output, finite dimensions, unique cell ownership, lake/junction exclusion, road setbacks, five farm sites and non-colliding detail buffers. The complete suite passes 222 tests / 33 files.
- Installed Edge/WebGL2 opens seven Lakeshore, Pinecrest, Ridgeway and rain views plus normal keyboard driving. Loaded infrastructure ranges from 5 meshes / 3,420 triangles to 11 / 8,076 because each occupied cell contributes one merged batch. Every scene remains grounded on four contacts with zero damage; errors, warnings and external requests are empty.
- The supplied game client reaches 3.753m/s on Lakeshore with four asphalt contacts, zero damage, 11 physical plus 13 distant traffic actors and no queued, failed or erroneous world cell.
- Three city–mountain–lake streaming loops repeat exactly at 491/74/44, 364/75/45 and 318/74/44 meshes/materials/textures. Three race/home cycles return to 138/73/43 and zero cells, with no retained sign or grandstand resource.
- Low 1280×720 development-host audits record Lakeshore at 240 draw calls / 290,022 triangles, Pinecrest at 163 / 465,842 and Ridgeway at 142 / 235,283. The eight-car GT and Formula maxima remain 298 / 483,838 and 281 / 484,764. These are submission/geometry samples on the development RTX 3060, not target-laptop FPS or memory certification.

The retained captures live under `output/rural-infrastructure-final`, `output/rural-infrastructure-supplied-client`, `output/rural-infrastructure-streaming` and `output/rural-infrastructure-cost`.
