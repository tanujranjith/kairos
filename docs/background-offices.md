# Shared background-office architecture

## Scope

Westbrook now uses one shared low-cost `buildBandArchitecture` path for authored secondary wings and a deterministic one-third subset of procedural office buildings. The variant keeps a real opaque shell, plinth, cornice, roof slab and equipment, four-sided continuous glazing, sparse proud mullions and an entrance canopy. It is not substituted for brick, limestone, residential or industrial buildings, so the skyline retains the older individual-window forms as well as the new larger glazing rhythm.

The first procedural trial replaced every office and made the city uniformly striped. A half-frequency trial still dominated the skyline. Both were rejected after screenshot review. The final `abs(seed) % 3 === 0` selection adds variation without turning the shared band form into the city’s only identity.

## Rendering and physical boundaries

Band glazing sits 0.065m proud of the opaque shell. Exact coplanarity was stable in forced WebGL2 but produced severe depth streaks on the native WebGPU path; both final renderer captures show the new bands without that artifact. Existing legacy individual-window towers still show their earlier stylized WebGPU reflection/speckling and are not represented as fixed by this checkpoint.

The helper appends only to the existing wall, roof and glass buffers. It adds no material, texture, light, mesh owner, collider type or network asset. Authored plaza grids remain the physical surface: Cedar Square, Market Court, Harbor Exchange and Westbrook Campus each return four `Concrete` contacts, while ordinary road driving retains four asphalt contacts and zero damage.

## Measured evidence

- Forced WebGL2 and actual WebGPU pass all four authored Westbrook views and normal keyboard driving at 19.325m/s. Browser errors, failed requests and external requests are empty.
- The Low city sample falls from 211 draws / 491,399 triangles to **210 / 464,507**. Wet night falls from 212 / 491,566 to **211 / 464,674**. This recovers roughly 26,892 submitted triangles without removing roads, traffic, authored blocks or gameplay systems.
- Other sampled Low scenes remain within the existing ceiling: showroom 187 / 176,416; Lakeshore 240 / 292,546; GT grid 298 / 487,166; pit 121 / 308,204; circuit 146 / 238,909; Formula grid 281 / 484,764.
- The required upstream web-game client was attempted and remained live for more than a minute without output or an artifact, so it was terminated and retained as a failure. The loader-aware copy completes the same supplied action sequence at 10.933m/s, four mixed contacts, zero damage, 12 physical + 12 distant traffic actors and no failed cell; its state and screenshot were opened.
- Three city/forest/lake loops repeat exactly at 496/74/44, 368/75/45 and 318/74/44 meshes/materials/textures. Three race/home cycles return to 138/73/43 with zero world cells and no retained race scenery.
- Strict TypeScript, 231 tests / 36 files, all nineteen KTX2 files and the Node24 production build pass. The exact chunks are `index-C7MrWYeJ.js` and `cell-worker-B5AXItFC.js`.
- Cold-cache 25Mbps/40ms local production reaches the menu in 6.204s forced WebGL2 and 5.768s on the automatic renderer request, transfers 12,977,628 bytes, and enters Free Drive plus Northstar without page, failed or external requests. These are development-host delivery samples, not target-laptop FPS, actual Internet or authorized HTTPS evidence.

The result is a cleaner and cheaper background-office family, not a global photoreal architecture pass. The later [renderer-safe façade pass](facade-materials.md) resolves the reproduced distant mip/depth triangles. Occupied interiors, pedestrians, street density and reference-level architecture remain future art work.
