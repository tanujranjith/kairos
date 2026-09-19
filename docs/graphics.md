# Original graphics upgrade — first substantial art pass

The September 19 pass responds to the request to move away from the blocky placeholder appearance. All new assets are original generated content, with no paid assets or external runtime requests.

- Car body lofts now have smoothly interpolated longitudinal and perimeter sections, wheel-arch clearances, undertrays, rounded mirrors, panel seams, shaped spoilers, exhaust rings and rounded tire profiles with multi-spoke rims. Both compressed detail levels were regenerated for all six vehicles.
- Paint uses linear-space color and a clearcoat layer; glass and alloys have separate optical properties. Direction-correct 128px environment cubemaps provide valley lighting and studio softbox highlights. These are analytic environments, **not local reflection probes**.
- Roads, meadows, gravel, concrete, stone and bark have original periodic albedo/normal textures. Terrain has continuous world-coordinate macro color variation; building faces have hard-edge normals, individual windows, bands and rooftop details.
- Instanced needle boughs and clustered oak leaf cards replace solid cone trees. Terrain, architecture and nearby vegetation receive/cast local sun shadows; cars have inexpensive soft contact darkening.
- The sky has generated clouds, the mountain backdrop has a denser silhouette, and the showroom has architectural bays, plinths, ceiling lights, floor inlays and textured finishes.
- FXAA runs on all presets. Medium and above add restrained bloom; Ultra enables the pipeline's higher sample count. Density/resolution/shadow differences remain separate from physics and rules.

## Rebuild and review

Run `node scripts/build-assets.mjs` with the dev server running to regenerate the twelve GLBs. `src/render/car.ts` is the original mesh source; `surface-textures.ts`, `vegetation.ts` and `lighting-environment.ts` generate the material content.

Run the supplied `web_game_playwright_client.mjs` for driving inputs and open its screenshot/state, then `verify-graphics-streaming.mjs` for full-UI showroom/day/city/wet-night/grid captures. New pure tests check all six car meshes/detail levels, deterministic normal maps and transferred terrain colors. See `benchmarks.md` for measured checks.

## Still below the finished art target

This remains procedural, stylized game art, not the reference images' photorealism. Car families share topology; interiors, glazing, liveries, building variety, roadside dressing, terrain blending, water and vegetation silhouettes need further art direction. Analytic cubemaps do not reflect nearby scenery. Runtime vehicle LOD swapping, local probes and KTX2 compression remain incomplete. Increased geometry/material cost must be profiled on the actual 8GB laptop before claiming the Low preset performance target.
