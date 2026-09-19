# Asset provenance

No purchased assets, copied vehicle designs, third-party logos or remote runtime media are used.

| Content | Source / terms |
|---|---|
| Six car meshes, showroom, terrain, roads, scenery, icons | Original Kairos code-generated content in this project |
| Paint, glass, albedo/normal material fields, fir/oak foliage atlases, cloudy sky, valley/studio cubemaps, contact darkening, signs | Original procedural materials/textures; source in `src/render`, no external photos or HDR downloads |
| Engine, transmission, tire, road, wind, rain, impact and tunnel audio | Original Web Audio synthesis and seeded procedural noise; no recorded samples |
| Four supplied PNG references and context markdown | User-provided design references; not included in the production build |
| Babylon.js core, loaders, serializers 9.27.1 | Apache-2.0; included license text and Babylon NOTICE |
| Havok WebAssembly 1.3.14 | MIT according to the installed package LICENSE; included as Havok-MIT.txt |
| Draco helpers distributed with Babylon | Apache-2.0; `@babylonjs/core/assets/Draco/draco.license` |
| meshoptimizer / meshopt decoder | MIT; package LICENSE and Babylon asset notice |
| glslang and twgsl helpers | Bundled Babylon-distributed binaries; covered by the supplied Babylon component NOTICE and Apache-2.0 text |
| TypeScript, Vite, Vitest, Playwright | Development tools; see pinned package lock and package licenses |

Original file names do not imply a real manufacturer or a licensed production vehicle. Exported GLBs are generated from the same original mesh tooling. `scripts/copy-notices.mjs` copies the installed package license texts into `public/licenses/`; the production build includes them at `/licenses/`. Keep those texts and notices with redistribution. This inventory is not a replacement for third-party license text.
