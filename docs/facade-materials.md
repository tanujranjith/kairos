# Façade material and distant-pane stability

## Problem and diagnosis

WebGPU city overviews exposed two independent triangular patterns. Large pale/dark triangles crossed concrete plazas and masonry faces, while detailed office panes split against their solid low-cost wall shells only at skyline distance. Close glass captures were clean.

Controlled renders rejected wall normal mapping, received shadows, larger shadow-map bias, metallic reflections, clear-coat strength and matte glass as causes. Replacing only the concrete KTX2 albedo with the exact procedural PNG removed the first pattern; disabling mipmapping on the same KTX2 also removed it. The original source pixels, UVs, geometry and lighting were therefore sound. Chromium WebGPU was sampling corrupted ETC1S-generated mip levels.

The remaining panes stayed clean near the camera and failed progressively with distance. Their physical 65 mm shell separation eventually became smaller than a depth-buffer step under the 9 km camera range. A one-unit material bias was insufficient; six units removed the split in both aerial and driving views without moving geometry or collision.

## Implementation

- `build-textures.mjs` now encodes all perceptual albedo, linear normal and cloud textures as UASTC+Zstd. Albedo retains its sRGB transfer function and complete mip chain. The nineteen generated files total 1,276,205 bytes, only 307,650 bytes above the former mixed ETC1S/UASTC set and still a small part of the initial download.
- `verify-texture-assets.mjs` rejects any albedo manifest entry that is not UASTC+Zstd, in addition to its existing source, builder, dimensions, size, hash and runtime-version checks.
- `configureArchitecturalGlass` owns the restrained dielectric response and a raster-only `-6` depth bias. Physics, wall/pane positions and contact geometry are unchanged.
- Detailed offices use 3.1 m modules with 2.55 m panes. The wider piers retain a stable architectural rhythm farther from the camera and reduce city geometry.

## Measured evidence

- Forced WebGL2 and actual WebGPU pass Cedar Square, Market Court, Harbor Exchange and Westbrook Campus. Every test plaza retains four `Concrete` contacts, zero damage and normal keyboard driving reaches 19.325 m/s. Opened aerial and driving captures show coherent concrete and glazing on both renderers.
- Native compressed-texture checks load 22 active KTX2-backed texture instances with mipmaps and no ordinary fallback on each renderer. The deliberate asphalt-albedo failure rebuilds its exact local procedural PNG and remains grounded.
- The supplied keyboard sequence reaches 10.933 m/s with four mixed contacts, zero damage, 12 physical plus 12 distant traffic actors and no failed cell; its screenshot and text state were opened.
- Low city falls from 432,509 to 427,817 active triangles at the same 217 draws; wet night is 218 / 427,962. GT and Formula grids remain 298 / 487,166 and 281 / 484,764.
- Three city/forest/lake loops repeat exactly at 498/74/44, 368/75/45 and 318/74/44 meshes/materials/textures. Three race/home cycles return to 138/73/43 and zero streamed cells.
- The complete suite passes 236 tests / 37 files. Strict TypeScript, nineteen-texture integrity and production build pass (`index-DrUztXtx.js`, worker `cell-worker-_XpAMRNN.js`). Cold 25 Mbps/40 ms production reaches menu in 6.365 s forced WebGL2 and 5.688 s automatic, transfers 12,794,314 bytes, enters Free Drive/Northstar and records no page, failed or external requests. Final production captures were opened.

This closes the reproduced façade triangle defect on the tested development GPU. It does not certify every adapter, replace solid-shell buildings with modeled interiors, make the stylized city photoreal, measure the secondary 8 GB laptop or supply authorized HTTPS acceptance.
