# Local release readiness and handoff

The local gameplay implementation is complete under the user's shared-car/local-only scope. Full original-plan acceptance is not certified on the separate target hardware. See [current build and verified evidence](final-closeout.md), [subsystem acceptance matrix](acceptance-matrix.md) and [plan status](plan-completion.md).

## Current verified release

Production `index-DtFmU65y.js`, engine `babylon-BtLuxeV9.js`, worker `cell-worker-BYSSieaE.js` and version-7 shared Velara LODs pass strict TypeScript, 277 tests / 46 files, nineteen texture integrity checks and the build. The known large engine-chunk warning remains.

Cold-cache 25Mbps/40ms local production reaches the menu in 6.050s forced WebGL2 / 5.191s automatic, transferring 10,524,864 bytes through Free Drive and Northstar entry, with no page, failed or external requests. Both real UI flows accelerate successfully and production contains no development control hooks.

Fresh browser checks cover both native renderers' model/preset/landscape paths, Chrome/Edge renderer combinations, complete GT/Formula race weekends, menu/save/camera interactions, loading failure/retry, resource disposal and representative automatic quality. The supplied keyboard client completes and its final screenshot/state were inspected. The final leak fix returns four race/home cycles to identical 142/78/44 mesh/material/texture counts in each native renderer.

Low 1280×720 stays under 300 draw calls / approximately 500,000 submitted triangles across eleven scenes. Five isolated moving development-RTX scenes pass the frame/CPU/GPU/simulation/AI p95 targets. Prior narrow-margin city variability is preserved in the benchmark log.

Earlier audio/storage/controller/fault/endurance/memory reports remain retained evidence, not freshly repeated tests. In particular, 157.57MiB estimated GPU residency and 1,334.97MiB settled browser-process working set belong to their earlier measured build, not new measurements of version 7.

## Remaining acceptance boundary

Run the existing benchmark/resource/endurance routes on the actual 8 GB integrated-graphics laptop before accepting its 720p/30 FPS target. Test a physical controller for stick feel and vibration. Automated gamepad events and development-PC measurements are not substitutes.

Art remains stylized procedural content; audio is synthesized; racing rules/AI are a compact driving-game implementation rather than a complete real-world marshal/safety-car simulation. No photorealistic reference equivalence or exhaustive permutation coverage is claimed.

The user chose local-only delivery. Nothing has been published. A future hosted release requires a newly authorized project, HTTPS preview checks and preservation of its previous deployment for rollback.

## Handoff commands

Use Node 24. The current local preview is **http://127.0.0.1:5192/**. For a clean checkout:

```sh
npm ci
npm test
npm run build
npm run preview -- --port 5192
```

Start the development server on port 5187 before development-only browser verifiers:

```sh
npm run dev -- --port 5187
node scripts/verify-interactions.mjs
node scripts/verify-adaptive-quality.mjs
node scripts/verify-graphics-streaming.mjs
node scripts/verify-race-resource-lifecycle.mjs
node scripts/verify-race-resource-lifecycle.mjs --webgpu
node scripts/verify-browsers.mjs
node scripts/audit-frame-performance.mjs --output=output/frame-performance
node scripts/verify-delivery.mjs --25mbps
```

See [README](../README.md) for controls, local saves, pits, the bundled Windows Node path and restart instructions; [benchmarks](benchmarks.md) indexes the remaining targeted fault/hardware scripts.
