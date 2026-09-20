# Asset provenance

No purchased assets, copied vehicle designs, third-party logos or remote runtime media are used.

| Content | Source / terms |
|---|---|
| Six car meshes, showroom, terrain, roads, scenery, icons | Original Kairos code-generated content in this project |
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
