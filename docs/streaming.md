# Collision-first world streaming

World geometry now comes from a same-origin module worker, with transferable typed buffers. `src/world/cell-blueprint.ts` generates terrain, roads, buildings and instance transforms; Babylon/Havok installation stays on the main thread. Handling-course fixtures and traffic-junction fixtures still generate on the main thread. This is not a claim that every resource installation is stall-free.

## Ownership and scheduling

- Cells are 256m. Manifests identify bounds, seed, road dependencies, procedural content version and the actual bridge/tunnel layers in their road samples. Merged collision meshes retain per-triangle contact identities; see `road-layers.md`.
- The player, physical actors and nearby pending traffic promotions own collision neighborhoods. Velocity adds a sampled six-second swept corridor, rather than only reserving its endpoint. Collision requests outrank the visual ring. Protecting pending promotions also prevents accelerated controlled-time tests from starving the worker event loop while distant cars remain nonphysical.
- Exploration releases obsolete cells. Racing additionally reserves the entire sampled circuit and pit neighborhood. Scenery remains limited to the selected quality's visible ring.
- Collision and scenery modes can be enabled separately. Static collision meshes install before scenery. Some special junction/course decorations remain allocated but hidden in collision-only cells.
- Cancellation aborts pending requests and prevents obsolete completions from installing. A running synchronous worker calculation is not preempted; its stale result is discarded. One worker request is scheduled at a time.
- Cell resources and material leases are explicitly owned. Each cell has its own instance buffers. Shared materials live with the world renderer; cell-specific sign materials and textures are disposed on release.

## Loading, failure and controlled time

Before a fixed step, all physical cars' contact neighborhoods must be ready. Otherwise the simulation and session clocks pause under a loading overlay. Real-time catch-up is discarded while waiting. Failed generation/module loads expose retry and return-to-menu controls; the overlay owns keyboard/controller focus and makes the underlying UI inert.

`startDrive()` and `startRace()` are asynchronous. **Await `window.advanceTime(ms)` in development tests.** It serializes controlled batches, suspends normal animation stepping and awaits required collision buffers without advancing simulation time. `advanceTime(0)` is a synchronous draw wrapped in a resolved promise. The synchronous `world.ensure()` is reserved for isolated physical validation rigs, not normal play.

## Verified checkpoint and limits

`verify-graphics-streaming.mjs` verifies grounded startup, deferred generation with clocks frozen, failed generation/retry, three repeated city/mountain/lakeshore resource cycles, full circuit/pit reservation with eight entrants and return-to-menu disposal. `verify-worker-recovery.mjs` actually blocks the worker module request, retries into driving, then cancels a separate in-progress session. Pure transaction tests cover priority, stale completion rejection, mode changes and idempotent leases.

These short controlled tests do not establish maximum-speed real-time hitch budgets, 30-minute process/GPU memory endurance, every sharp direction change, broad traffic stress or target-laptop performance. Additional elevated-road stress cases, private-site navigation, adaptive quality, device-loss handling and sustained budget profiling remain work.
