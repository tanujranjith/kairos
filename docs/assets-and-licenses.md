# Asset provenance

No purchased assets, copied vehicle designs, third-party logos or remote runtime media are used.

| Content | Source / terms |
|---|---|
| Six car meshes, showroom, terrain, roads, scenery, icons | Original Kairos code-generated content in this project |
| Continuous ground-cover palette, world-space blending fields, shoulder tint and smooth terrain display normals | Original Kairos code in `src/render/ground-material.ts` and `src/world/ground-cover.ts`; reuses existing original surface textures, with no new external asset or runtime host. |
| City lamp standards, benches, bins, planted beds and shelters | Original geometry/placement in `src/content/streetscape.ts` and `src/world/streetscape.ts`; small plants reuse the original oak atlas. Local light pool in `src/render/street-lighting.ts`. No new texture, third-party or paid asset. |
| Shared curved cabin/glazing, molded seats and door cards, closed headrests/rear bulkhead, GT harness and cage | Original geometry in `src/render/road-cabin.ts`; existing car materials and local GLB exporter, no external asset or paid content |
| Continuous body profiles/normals, fitted arch trim and open Formula intake throats | Original source in `src/render/profile-curve.ts`, `coachwork.ts` and `formula-coachwork.ts`; twelve regenerated GLBs, no new external assets or paid content |
| Aster race-control tower, external stairs/rails, forecourt links, benches/pergola, raised planters and pit tool/wheel racks | Original geometry in `src/world/pit-forecourt.ts`; planting definitions in `src/content/circuit-landscape.ts` reuse the existing original oak atlas. No new third-party or paid content. |
| Sculpted front/rear bumper surfaces, recessed grilles/valances, fitted trim and vector Kairos lettering | Original geometry in `src/render/fascia.ts` and `coachwork.ts`; shared trim response in `car-materials.ts`. No external model, texture, logo or paid content added. |
| Aster planted banks/woodland, rear paddock lanes, transporters/canopies, pit wall, fencing, shelters and lamp standards | Original geometry and placements in `src/content/circuit-landscape.ts`, `src/world/circuit-setting.ts`, `src/render/circuit-woodland.ts`; reuses original local vegetation atlases/materials, no new external asset |
| Five enclosed-car design profiles, open passenger cells, projected lamp/livery surfaces, deep six-style wheels and fixed calipers | Original sources `src/render/road-design.ts`, `coachwork.ts`, `panel-stripe.ts`, `wheel-model.ts`; no manufacturer geometry, paid content or new external asset. Road/GT instruments reuse the original local canvas display. |
| Rebuilt Apex body/aero, recessed cockpit, conforming liveries and live gear/speed/RPM/fuel display | Original geometry in `src/render/formula-coachwork.ts`; locally drawn display in `src/render/car-instruments.ts`; both optimized GLB levels generated from the same source, no new third-party content |
| Aster garage bays, glazing, shutters, canopy, roof plant and working apron | Original code-generated geometry in `src/world/pit-garage.ts` and `src/world/cell-blueprint.ts`; no new external asset |
| Covered grandstand, individual seats, safety fencing, Kairos gantry, grid/finish paint, authored mountain groups and projected cloud deck | Original code-generated content in `src/world/grandstand.ts`, `src/world/cell-blueprint.ts`, `src/world/landscape.ts` and `src/render/atmosphere.ts`; no new external asset |
| Brick/limestone/office/factory/house architecture, outer ridges, macro meadow colors, occupied-window atlas | Original code-generated content in `src/world/architecture.ts`, `src/world/landscape.ts` and `src/render/world.ts`; no third-party asset |
| Service pavilions, overpass structure and updated solar/cloud field | Original code-generated content in `src/world/service-pavilion.ts`, `src/world/cell-blueprint.ts` and `src/render/atmosphere.ts`; no new external asset |
| Paint, glass, albedo/normal material fields, fir/oak/grass atlases, cloudy sky, fallback valley/studio cubemaps, contact darkening, signs | Original procedural materials/textures; source in `src/render` |
| Showroom photographic environment | [Fish Eagle Hill](https://polyhaven.com/a/fish_eagle_hill), Greg Zaal / Poly Haven, [CC0](https://polyhaven.com/license). Locally bundled prefiltered derivative; no runtime external request. Source checksum and conversion recipe in `assets/sources/environment-provenance.json`; notice in `public/licenses/Poly-Haven-environment.txt`. |
| Engine, transmission, tire, road, wind, rain, impact and tunnel audio | Original Web Audio synthesis and seeded procedural noise; no recorded samples |
| Four supplied PNG references and context markdown | User-provided design references; not included in the production build |
| Babylon.js core, loaders, serializers 9.27.1 | Apache-2.0; included license text and Babylon NOTICE |
| Havok WebAssembly 1.3.14 | MIT according to the installed package LICENSE; included as Havok-MIT.txt |
| Draco helpers distributed with Babylon | Apache-2.0; `@babylonjs/core/assets/Draco/draco.license` |
| meshoptimizer / meshopt decoder | MIT; package LICENSE and Babylon asset notice |
| glslang and twgsl helpers | Bundled Babylon-distributed binaries; covered by the supplied Babylon component NOTICE and Apache-2.0 text |
| TypeScript, Vite, Vitest, Playwright | Development tools; see pinned package lock and package licenses |

Original file names do not imply a real manufacturer or a licensed production vehicle. Exported GLBs are generated from the same original mesh tooling. `scripts/copy-notices.mjs` copies the installed package license texts into `public/licenses/`; the production build includes them at `/licenses/`. Keep those texts and notices with redistribution. This inventory is not a replacement for third-party license text.
