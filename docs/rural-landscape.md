# Rural landscape composition

Kairos's rural dressing is authored from road-aligned corridors rather than uniform random scatter. The goal is readable regional composition—woodland rooms, open views and denser transition bands—without changing the physical terrain or obscuring sightlines.

## Design and ownership

- `src/content/rural-landscape.ts` defines six corridor identities and their spacing, setback, radius, tree, shrub and rock ranges.
- `src/world/rural-dressing.ts` expands those definitions deterministically, adds sparse background copses, samples the existing terrain height and assigns every instance to one 256 m streamed cell.
- Placements reject roads and crowns, junction sightlines, water, service plots, the circuit/paddock, urban and industrial districts, and Northstar. This is conservative visual clearance, not a new collision system.
- Low, Medium, High and Ultra use stable prefixes of each generated group. Changing quality therefore adds or removes detail without moving retained plants.
- Trees, understory and boulders are visual instances. Existing terrain and road meshes continue to provide wheel contact and vehicle collision.

## Original rock asset

`src/render/boulders.ts` starts from an icosphere, applies asymmetric mineral deformation, compresses the lower profile and rebuilds normals. Coincident UV-seam vertices share averaged normals. The result is 180 triangles, down from the old 400-triangle sphere, with vertex tint plus original periodic boulder albedo and normal textures. It deliberately reads as dark weathered stone instead of white concrete.

## Verification

Run:

```sh
node scripts/verify-landscape-dressing.mjs --renderer=webgl --output=output/landscape-dressing/webgl
node scripts/verify-landscape-dressing.mjs --renderer=auto --output=output/landscape-dressing/webgpu
node scripts/audit-render-cost.mjs --rural --output=output/landscape-dressing/cost
node scripts/verify-graphics-streaming.mjs --output=output/landscape-dressing/streaming
```

The focused verifier captures lakeshore, lower and upper forest, mountain, rain and close-rock views, checks the renderer requested, rejects external/error traffic, confirms four contacts and zero damage after normal keyboard input, and verifies cleanup on return to the showroom. The streaming verifier repeats three region circuits and three race/home cycles; resource counts must settle identically on every visit.

The final development-host Low audit contains 660 frames across ten views. Every frame is positive and below 300 draw calls and 500,000 active triangles; the measured maxima are 288 and 488,780. These are submission/geometry limits on an RTX 3060, not target-laptop FPS or memory evidence.

## Known limits

The landscape is still generated, with a small plant vocabulary and broad open fields. It does not include photogrammetric rocks, dense ground-cover cards, seasonal variation, wildlife or final naturalistic terrain. Car models, foreground material detail, the 8 GB integrated-graphics benchmark, 30-minute endurance and authorized HTTPS deployment remain separate unfinished requirements.
