# Shared Velara model

Kairos now deliberately uses one authored sports-car body throughout the live game. The Velara S LOD0/LOD1 pair supplies the player, both showroom background cars, physical traffic, racing opponents and parked-city cars. Six selectable tuning profiles remain because they carry the existing FWD/RWD/AWD, GT and Formula-class physics, power, mass, tires, setup limits and race rules; they are no longer presented as six different body models.

`visualModelId` is the single mapping point. Startup requests only `/models/velara-lod0.glb` and `/models/velara-lod1.glb`; every visual root records both `visualModel: velara` and its independent `handlingProfile`. Paint and wheel customization remain per profile. Livery selection uses the same body and changes its accent treatment instead of switching to another procedural shape.

If either GLB is unavailable, the local procedural fallback also generates the Velara body for every profile. It does not silently resurrect the old class-specific body generators. The ten obsolete alternate-body GLBs have been removed from the shipped source tree; only the shared Velara LOD0/LOD1 pair is generated and retained.

The version-5 shared model also refines the cabin with brighter charcoal trim, chrome vent/display accents, a smaller higher-detail steering wheel and a higher cockpit eye point. Each exported GLB carries a named `collision-chassis` box with the same dimensions used by the Havok chassis shape; the imported mesh is disabled before rendering. These are presentation/asset-contract changes and do not alter any handling profile.

## Current revision

Version `7-smooth-optics` retains the same shared-body contract. Interpolated decal normals, restrained transparent lamp covers, flush side moulding and clean wheel arches replace the earlier presentation details. Current LOD0 has 29 visible parts, 36,318 triangles and four wheel pivots. The compressed pair totals 480,096 bytes. Both native renderers verify all six profiles, normal traffic/parked/race reuse and procedural fallback (`output/full-plan-shared-car`). See [final presentation](final-presentation.md) and [current release evidence](final-closeout.md).

The collision mesh remains disabled. A race-cycle regression exposed a cloned default material left behind for each hidden collision mesh; instance disposal now includes those materials. Static scenery continues to share library materials without disposing them. The focused identity/count report and full streaming regression protect this ownership boundary.

## Earlier verification history

The September 22 integration pass also binds cockpit/hood/bumper cameras, steering-wheel animation and showroom floor placement to this shared visual body, rather than the old per-class body dimensions. Mounted camera positions follow chassis pitch/roll. `scripts/verify-shared-cabin.mjs` covers all six profiles with GLBs and fallback; current evidence and local-only scope are in [final closeout](final-closeout.md).

- `tests/graphics.test.ts` asserts that all six profile IDs resolve to `velara`.
- `scripts/verify-shared-car-model.mjs` exercises six profiles and three livery values in installed Edge under forced WebGL2 and actual WebGPU. Every live profile reports 29 visible parts, 38,304 visible triangles, four wheel pivots, one disabled named chassis-collision mesh, `visualModel: velara`, and its own handling-profile ID.
- The same verifier checks a normal Free Drive scene with 12 physical traffic cars and 17 parked cars, plus an eight-car Formula-class grid. Player, traffic, parked cars, race player and all seven opponents report only `velara`; network inspection sees only the two Velara GLBs.
- The existing six-profile road-model browser matrix also passes all eighteen profile/livery combinations, live steering and fixed calipers, all five cameras, telemetry, four contacts and zero-damage driving. The final Apex chase and cockpit captures were opened.
- With all GLB requests deliberately blocked, every profile reports the same 28-part / 38,602-triangle procedural Velara fallback. The final fallback and both renderer/grid captures were opened.
- Supplied keyboard input remains grounded at 10.933m/s with four contacts and zero damage. No physics, input, tire or race-rule parameter was changed.
- The final Low audit records 234 draw calls / 457,684 triangles in city traffic and 283 / 483,078 for the eight-car GT grid: below the 300/~500k target, with more than 16,000 triangles of measured grid headroom.
- Three region cycles repeat at city 905/84/44, forest 368/85/45 and lake 319/84/44 meshes/materials/textures; three race/home cycles return to 138/83/43 and zero cells.
- The pre-camera-change production snapshot passed 257 tests and cold-cache 25Mbps/40ms startup at 6.204s forced WebGL2 / 5.352s automatic, transferring 10,527,494 bytes. Current build hashes, the corrected 42-file test count and final delivery results are recorded in [final closeout](final-closeout.md).

These are local development-host checks, not target-laptop frame-pacing, browser-process/GPU-memory, 30-minute endurance or hosted HTTPS certification.
