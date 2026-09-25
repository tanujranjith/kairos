# Plan completion — local scope

The planned local gameplay systems are integrated. The user's later decisions replace six separate visual car bodies with **one shared Velara model** (six physical profiles remain) and replace HTTPS publication with **local-only delivery**. No deployment has been made.

Use the [full-plan acceptance matrix](acceptance-matrix.md) for subsystem-to-test mapping and [final closeout](final-closeout.md) for the exact current production build. Older dated reports remain evidence of their own checkpoints, not freshly repeated tests.

## Implemented

- 120 Hz Havok/contact vehicle simulation, combined-slip tires, keyboard/controller inputs and assists, fuel/wear/temperature, wet surfaces, verified resets and the Northstar handling course.
- Connected authored region, layered roads/bridges/tunnels, collision-first cell streaming, traffic/lane graph, routing/rerouting, discovery, all twelve activities and service locations.
- Live garage, shared compressed vehicle LODs, paint/wheels/liveries/setup, five cameras, warm showroom, weather/day cycle, original layered engine/environment audio and four graphics presets.
- Practice, qualifying, quick race and race weekend; directional checkpoints/sectors, flags/penalties/classification, physical pit service and input-driven racing AI with committed passing/defending.
- IndexedDB saves, validation/recovery/export/import/reset, graphics-loss handling, local dependencies, static build and release documentation.

## Final follow-up

- Improved shared-car optics, continuous panel normals, wheel arches and flush side trim; version-7 compressed models preserve pivots, camera mounts and hidden chassis metadata.
- Added detailed distant ridges, geology/snow/woodland shading and 1,600 original distant firs in one lightweight mesh. Roads, colliders and handling parameters are unchanged.
- Fixed automatic quality selection: sample moving grounded gameplay, not the showroom, and hold a full-resolution baseline throughout the benchmark. Defer a different preset until the showroom; preserve manual overrides and dynamic-resolution recovery.
- Found and fixed fifteen cloned collision-mesh materials leaking after each eight-car race. Repeated race/region transitions now return to stable resource counts.

Fresh evidence includes 277 passing tests in 46 files, strict TypeScript, both native renderers' model/preset/landscape checks, complete GT and Formula-profile weekends, menu/save/camera flows and collision-loading recovery. Eleven Low scenes stay below 300 draw calls and approximately 500,000 triangles. All five moving scenes meet the frame/CPU/GPU/simulation/AI p95 budgets on the development RTX 3060. See [benchmarks](benchmarks.md) for measurements, environments, prior failures and test limitations.

## Acceptance boundaries

The actual 8 GB integrated-graphics laptop and a physical controller still need their hardware checks. Development-PC, injected-gamepad and simulated-network results do not certify those devices. Art remains stylized rather than photoreal; audio is synthesized; racing rules are a compact game implementation, not a complete real-world safety-car/marshal system. Screen-space effects cannot reflect off-camera objects.

These limits are explicit: local implementation completion is not a claim of 100% original hardware/visual acceptance or exhaustive testing of every traffic/weather/setup permutation.
