# Terrain continuity

September 20, 2026 — verified terrain-repair checkpoint, not final game acceptance.

## Cause and repair

Road and junction clipping inserted new height samples into one ground polygon without inserting the same points into its neighbor. The neighbor kept a straight edge between its old endpoints. Nonlinear terrain heights therefore disagreed along a shared boundary. The first mountain regression measured a 39.5 cm disagreement; a region-wide initial scan found larger cases.

`world/terrain-mesh.ts` builds the same authored cutouts with a one-tile halo. It canonicalizes shared coordinates, inserts neighboring edge vertices and samples their heights once. The halo contributes boundary information only: it never emits another cell's faces. A boundary-aware ear triangulator preserves collinear vertices; an ordinary corner fan can otherwise skip them and recreate a vertical seam. Roads, shoulders, handling features, vehicle parameters and assists are unchanged. Ground triangles really change; this is not a cosmetic floor or extra tire force.

## Numerical evidence

- Seven tests cover selected neighboring mountain/lake/forest/city cells, boundary-preserving triangulation, halo ownership and audit precision.
- All 324 allowed streamed cells build. The final independent buffer audit finds no T-junction or duplicate-height disagreement above its 2 mm vertical / 0.3 mm horizontal tolerances. One nearby corner belongs to a connected, very thin triangle and is classified using its pre-Float32 coordinates; a separate test ensures a genuinely vertical boundary fan is still rejected.
- Projected ground area is compared with the original road/junction/course clipping in every cell, with a 0.025 m² tolerance per 65,536 m² cell. Halo faces are rejected. Total terrain geometry rises from 211,762 to 223,476 triangles across the entire streamed region, not all visible simultaneously.
- The initial candidate scan, first strict-float failure and corrected adjacency/footprint reports are retained separately in `output/terrain-seams/`. Their differing audit classifications must not be presented as equivalent defect counts.

## Driving and visual scope

The browser check casts real Havok rays on both sides of former seams, then traverses three sites from controlled 7 m/s initial conditions using normal simulation and keyboard braking. Body-downward rays distinguish missing terrain from a physical hop over uneven ground. It records airborne duration and requires supported surfaces, bounded clearance, no recovery/damage, a complete crossing and a four-tire settled stop. WebGL2 and actual WebGPU repeat the same results. The forest route has a 0.25-second sampled rough-ground hop; mountain and lake have none. This is not certification that every off-road route is smooth or permanently grounded.

Both ordinary and backdrop-hidden images are reviewed. The earlier sky slits disappear in the inspected mountain view. Broader material-detail bands, vegetation density, terrain shape, sky and car-model finish remain separate art work.

The existing 16 real-road cases also pass: Velara/GTX bridge shoulders, grass entry/exit and 70 mph mixed asphalt/gravel braking. They show no damage or recovery, with maximum sampled sideslip 1.582 degrees. Layer separation, loading failure/retry and repeated resource-disposal checks pass. The supplied input/screenshot loop retains the earlier handling result. All 528 Low render-cost samples remain below 300 draws and 500,000 triangles on the development RTX3060 (maxima 288 and 488,780); these are not target-laptop frame-rate measurements.

Strict TypeScript, 188 unit tests and the Node 24 production build pass. Chrome and Edge each complete cold-cache production startup, Free Drive, handling, a clean eight-car race launch and home return on WebGL2 and actual WebGPU, with third-party runtime hosts blocked. Actual startup/driving/race screenshots were inspected. See [benchmark details](benchmarks.md) for measurements and remaining acceptance work.

```sh
node scripts/audit-terrain.mjs --output=output/terrain-seams/footprint-atlas
node scripts/verify-terrain.mjs --output=output/terrain-seams/contact-webgl
node scripts/verify-terrain.mjs --renderer=auto --output=output/terrain-seams/contact-webgpu
node scripts/verify-road-surfaces.mjs --output=output/terrain-seams/roads
```

Use Node 24 and the development server on port 5187 for browser checks. Target-laptop performance, all off-road routes/setups, long endurance and authorized HTTPS acceptance remain unproven.
