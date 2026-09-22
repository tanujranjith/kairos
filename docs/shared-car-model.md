# Shared Velara model

Kairos now deliberately uses one authored sports-car body throughout the live game. The Velara S LOD0/LOD1 pair supplies the player, both showroom background cars, physical traffic, racing opponents and parked-city cars. Six selectable tuning profiles remain because they carry the existing FWD/RWD/AWD, GT and Formula-class physics, power, mass, tires, setup limits and race rules; they are no longer presented as six different body models.

`visualModelId` is the single mapping point. Startup requests only `/models/velara-lod0.glb` and `/models/velara-lod1.glb`; every visual root records both `visualModel: velara` and its independent `handlingProfile`. Paint and wheel customization remain per profile. Livery selection uses the same body and changes its accent treatment instead of switching to another procedural shape.

If either GLB is unavailable, the local procedural fallback also generates the Velara body for every profile. It does not silently resurrect the old class-specific body generators. The ten obsolete alternate-body GLBs have been removed from the shipped source tree; only the shared Velara LOD0/LOD1 pair is generated and retained.

The version-4 shared model also refines the cabin with brighter charcoal trim, chrome vent/display accents, a smaller higher-detail steering wheel and a higher cockpit eye point. These are presentation-only changes and do not alter any handling profile.

## Verification

- `tests/graphics.test.ts` asserts that all six profile IDs resolve to `velara`.
- `scripts/verify-shared-car-model.mjs` exercises six profiles and three livery values in installed Edge under forced WebGL2 and actual WebGPU. Every live profile reports 29 parts, 37,936 triangles, four wheel pivots, `visualModel: velara`, and its own handling-profile ID.
- The same verifier checks a normal Free Drive scene with 12 physical traffic cars and 17 parked cars, plus an eight-car Formula-class grid. Player, traffic, parked cars, race player and all seven opponents report only `velara`; network inspection sees only the two Velara GLBs.
- The existing six-profile road-model browser matrix also passes all eighteen profile/livery combinations, live steering and fixed calipers, all five cameras, telemetry, four contacts and zero-damage driving. The final Apex chase and cockpit captures were opened.
- With all GLB requests deliberately blocked, every profile reports the same 28-part / 38,602-triangle procedural Velara fallback. The final fallback and both renderer/grid captures were opened.
- Supplied keyboard input remains grounded at 10.933m/s with four contacts and zero damage. No physics, input, tire or race-rule parameter was changed.
- Low city remains 262 draw calls / 487,353 triangles. Reusing the coupe on both race classes produces 291 / 496,870 for either eight-car grid: below the 300/~500k target, with about 3,100 triangles of measured headroom.
- Three region cycles repeat at city 905/84/44, forest 368/85/45 and lake 319/84/44 meshes/materials/textures; three race/home cycles return to 138/83/43 and zero cells.
- The complete suite passes 238 tests / 37 files. Strict TypeScript, nineteen KTX2 assets and production build pass (`index-NicfuzSm.js`, `cell-worker-4NqBEf0t.js`). Cold-cache 25Mbps/40ms local production reaches the menu in 5.529s forced WebGL2 / 4.908s automatic, transfers 10,517,042 bytes, enters Free Drive and Northstar, and records no page, failed or external request.

These are local development-host checks, not target-laptop frame-pacing, browser-process/GPU-memory, 30-minute endurance or hosted HTTPS certification.
