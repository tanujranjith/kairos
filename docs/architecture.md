# Architecture and tuning

## Ownership

- `src/content`: authored vehicle parameters, road anchors, region height field, landmarks, navigation graph.
- `src/sim`: Havok world adapter, four-contact physical vehicles, tire solver, traffic/racing decisions, ordered-checkpoint session rules.
- `src/render`: Babylon initialization, local helper URLs, original car mesh generator, cell scenery, cameras, weather and showroom.
- `src/core`: shared contracts, math, controls, audio, versioned save validation.
- `src/ui`: HTML/CSS menus and HUD, with a read-only view model and action callbacks.
- `src/app.ts`: lifecycle, one fixed clock, subsystem integration, test hooks.
- `src/tools`: development-only asset authoring/export.

Coordinates are meters, Y up, +Z forward at yaw zero, +X right. Time is seconds and angles are radians. Vehicle data uses kg, Nm, meters and SI simulation values; display converts speeds to mph/km/h. Catalog horsepower and claimed top-speed labels are tuning intent, not certified measured performance.

## Physics

The application manually advances Havok at 120 Hz. Babylon's automatic physics step is disabled. Real-time catch-up is bounded to eight steps; hidden tabs pause and inputs are cleared. Rendering interpolates the preceding and current physical poses. Controlled-time testing bypasses the real-time accumulator and prevents double stepping.

Each chassis is a dynamic box. Four rays find suspension contacts. Spring/damper/anti-roll forces act at wheel locations. Combined-slip tire forces share a load-sensitive friction limit. An implicit wheel/contact solve prevents low-inertia wheels from producing artificial per-step slip spikes. Fuel changes chassis mass; temperature, wear, surface and accumulated rain wetness alter grip. There is no extra artificial weight-transfer term.

Tune mass/geometry, springs/damping, tire limits, gearing/torque, then aero in that order. Re-run identical acceleration/braking/turning traces at multiple render frame rates. Never compensate for poor AI with hidden grip or engine multipliers. AI feeds the same physical model and assists; its pace and corner-exit throttle are input decisions.

## Roads and cells

Spline definitions generate sampled road geometry, markings, contact surfaces and graph points. World cells are 256m. Nearby surface cells are generated before physics reaches them; additional detail queues favor direction/speed. The local implementation generates cells synchronously, so there are no asynchronous network-cell requests to cancel. This simplifies failure handling but cell-generation spikes still need profiling.

Repeated scenery uses thin instances. Each cell owns unique instance-buffer geometry (sharing it would overwrite every cell's transforms). Materials are shared; cell-owned sign textures are explicitly disposed. AI locations protect their contact cells. Navigation uses A* over sampled roads and intersection proximity links. Layer-aware overpass topology is not yet generalized.

## Persistence

`SaveGame.version` is validated, numerical ranges are clamped, unknown vehicles fall back safely, and non-finite records are discarded. Corrupt or unsupported stored profiles are preserved under a timestamped recovery key before fresh defaults are saved. IndexedDB open/write failures remain user-visible; play continues in memory. Import is bounded to 2MB and parsed as data, never executed. Export uses a user-triggered download. No user data is transmitted. The closed-database, unavailable-storage, corrupt-profile and export/import paths have browser regression checks.

## Rendering and assets

One gameplay canvas, native WGSL-capable WebGPU first and WebGL2 fallback. Shader helpers, Draco and meshopt paths are explicit same-origin versioned URLs. Original materials and engine/noise audio are procedural. No remote fonts, CDN textures or analytics. The car generator merges static parts by material while keeping four named wheel pivots; the export tool creates compressed GLBs with camera nodes and chassis metadata.

Runtime loads the six compressed LOD0 GLBs as reusable templates, cloning per-car materials for customization. Missing GLBs fall back to the original mesh generator. Custom liveries use that generator to lay ribbons on the body profiles. Exported LOD1 files are retained, but runtime distance-based model swapping is not implemented. All twelve files are original Kairos assets.

Four graphics settings vary resolution caps (720p/900p/1080p/1440p), shadow-map sizes and cell density, never physics or rules. Small procedural ground textures use mipmaps and anisotropic filtering. The sky uses a small generated gradient texture; wetness changes asphalt roughness and physical grip. Headlights use physical falloff, and close chase cameras ray-test against collision geometry. Reflection probes, automatic quality selection, dynamic resolution and KTX2 texture authoring remain separate acceptance work.

## Debugging and reproducibility

Use F3 for telemetry or the development-only `window.kairos.snapshot()` / `window.render_game_to_text()` interfaces. `advanceTime(ms)` disables normal animation-loop simulation; `resumeRealTime()` restores it. Never treat a multi-second controlled-time batch's `physicsMs` as one real displayed frame. Current telemetry counts active meshes, not all GPU draw passes; it is not a draw-call-budget certification.

The pure tire function in `src/sim/tire.ts` can be tested without loading Babylon. `tests/simulation.test.ts` covers road connectivity, combined grip, ordered timing, shortcuts, reverse crossings, track limits, false starts, lapped classifications, finish windows and save validation. Browser scripts complement those rules with actual Havok cars and UI flows. Keep numeric tolerances: repeatability on this build does not imply cross-browser bitwise determinism.
