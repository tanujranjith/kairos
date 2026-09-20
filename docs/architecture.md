# Architecture and tuning

## Ownership

- `src/content`: authored vehicle parameters, road anchors, region height field, landmarks, navigation graph.
- `src/sim`: Havok world adapter, four-contact physical vehicles, tire solver, traffic/racing decisions, ordered-checkpoint session rules.
- `src/render`: Babylon initialization, local helper URLs, original car mesh generator, cell scenery, cameras, weather and showroom.
- `src/world`: pure cell manifests/blueprints, transferable worker protocol, prioritized asynchronous transactions and resource leases.
- `src/core`: shared contracts, math, controls, audio, versioned save validation.
- `src/ui`: HTML/CSS menus and HUD, with a read-only view model and action callbacks.
- `src/app.ts`: lifecycle, one fixed clock, subsystem integration, test hooks.
- `src/tools`: development-only asset authoring/export.
- `src/content/handling-course.ts`: authored pad bounds and height profiles, shared by geometry, map, surface selection and the physical validation rig.

Coordinates are meters, Y up, +Z forward at yaw zero, +X right. Time is seconds and angles are radians. Vehicle data uses kg, Nm, meters and SI simulation values; display converts speeds to mph/km/h. Catalog horsepower and claimed top-speed labels are tuning intent, not certified measured performance.

## Production startup

Vite groups Babylon/core and glTF loader modules into one hashed engine chunk; Kairos code remains separate. This avoids hundreds of tiny preload requests (particularly costly on HTTP/1.1) without removing shader helpers or lowering rendering quality. The engine chunk remains large; download, parse, device initialization and first-drive streaming still require independent measurement. All helper URLs stay local.

Startup emits six bounded `performance.measure` entries named `kairos:startup:*` for storage, renderer, physics, world resources, vehicles and interface. These contain only elapsed timing, expose no game-control API and are available in production diagnostics. `scripts/profile-startup.mjs` captures CPU samples, requests, long tasks and pending failures. `scripts/verify-startup.mjs` repeats cold-cache 25Mbps/40ms UI-to-driving checks without development hooks, with optional installed-browser and race-entry checks. Menu readiness and input-to-motion are recorded separately; neither proves target-laptop frame pacing.

## Physics

The application manually advances Havok at 120 Hz. Babylon's automatic physics step is disabled. Real-time catch-up is bounded to eight steps; hidden tabs pause and inputs are cleared. Rendering interpolates the preceding and current physical poses. Controlled-time testing bypasses the real-time accumulator and prevents double stepping.

Each chassis is a dynamic box. Four rays find suspension contacts. Spring/damper/anti-roll forces act at wheel locations. Combined-slip tire forces share a load-sensitive friction limit. An implicit wheel/contact solve prevents low-inertia wheels from producing artificial per-step slip spikes. Fuel changes chassis mass; temperature, wear, surface and accumulated rain wetness alter grip. There is no extra artificial weight-transfer term.

Tune mass/geometry, springs/damping, tire limits, gearing/torque, then aero in that order. Re-run identical acceleration/braking/turning traces at multiple render frame rates. Never compensate for poor AI with hidden grip or engine multipliers. AI feeds the same physical model and assists; its pace and corner-exit throttle are input decisions.

Keyboard steering has a speed/wheelbase-aware input envelope; analog range is unchanged. TC budgets next-step wheelspin against combined-slip capacity. Suspension damping uses surface-normal compression speed, not forward motion projected onto a tilted chassis. See `keyboard-handling.md` for the reported40mph spin, diagnosis and numerical regressions.

Northstar's validation rig creates a fresh physical vehicle per scenario, settles it with held brakes, then uses only normal controls through Havok. Braking/jump scenarios specify initial body and wheel velocity; subsequent motion is not position-corrected. The suite repeats scenarios and compares tolerances. It does not certify all vehicles under every maneuver or model chassis deformation. Detailed dimensions and measured results are in `handling-course.md`.

## Roads and cells

Spline definitions generate sampled road geometry, markings, contact surfaces and graph points. World cells are 256m. A same-origin module worker generates bulk geometry and transfers buffers; main-thread installation creates Babylon/Havok resources. Collision neighborhoods and six-second swept corridors outrank detail. Racing reserves circuit/pit contacts. Fixed simulation waits under a retryable loading overlay if required contacts are unavailable. Stale loads cannot allocate after cancellation. Special course/junction fixtures remain main-thread work; generation/installation spikes still need profiling. See `streaming.md`.

Repeated scenery uses thin instances. Each cell owns unique instance-buffer geometry (sharing it would overwrite every cell's transforms). Materials are shared; cell-owned sign textures are explicitly disposed. Physical AI locations protect their contact cells. Navigation uses A* over directed lanes and explicitly authored turn connectors shared with traffic. Incompatible-height junctions are rejected. Explicit bridge/tunnel spans, independent terrain/deck heights, height-aware reset/navigation and per-triangle wheel-contact identity are implemented; see `road-layers.md` for selected physical checks and limitations. Aster's private access, one-way pit and circuit participate in navigation but not ambient traffic. Connectors use two-metre navigation samples; one-way feeders merge into the nearest lane. See `circuit-access.md` for the physical connections and `traffic.md` for scheduling, priorities, signals, lane changes and physical/distant resource ownership.

## Race timing

`src/content/race-course.ts` defines race rules and finite-width, height-clipped directional timing gates. `RaceRouteTracker` owns per-entrant physical circuit/pit proof; `RaceManager` consumes interpolated crossing events for ordered checkpoints, sectors, laps, penalties and classification. The pit has its own ordered gate chain and circuit-equivalent progress anchored at entry, the extended finish plane and exit. Stationary service cannot advance race position, and resets/skipped gates cannot fabricate lap credit. See `race-timing.md` for tests and remaining AI/rejoin limitations.

### Racing line control

Racing AI reserves an anchored road-relative lane while another car's body overlaps now or within a1.2-second relative-speed horizon. Height-separated traffic is excluded. The occupied-lane bounds apply after passing decisions, so a later opponent cannot overwrite them. An unanchored reservation was rejected because it accumulated ordinary corner-tracking drift. Weakly owned per-vehicle/road state releases lane reservations once clearance returns and cannot retain disposed cars.

The target corridor subtracts half the vehicle width and a2m tracking allowance from each road edge. A smaller allowance let a sixteen-car GT overtake sequence reserve an outside line too close to the curb; ordinary tracking error then put wheels off the asphalt. Lane speed, prediction horizon, body clearance, tracking allowance and yaw-control gains live in `RACE_AI`, separate from vehicle physics and track-limit rules.

Unoccupied line changes move their target at1.2m/s using the actual controller timestep; player test autopilot and opponent decisions therefore use the same transition rate despite different update cadences. Pure pursuit requests a yaw rate, compared with the measured Havok chassis yaw rate to damp overshoot through the normal steering input. It does not modify yaw, velocity, tire forces or grip. A duplicate speed-squared curvature-steering term and an experimental steady sideslip correction were rejected by real first-bend tests. See `tests/racing-lanes.test.ts` and `scripts/inspect-race-launch.mjs` for the dense launch/field regression.

## Persistence

`SaveGame.version` is validated, numerical ranges are clamped, unknown vehicles fall back safely, and non-finite records are discarded. Corrupt or unsupported stored profiles are preserved under a timestamped recovery key before fresh defaults are saved. IndexedDB open/write failures remain user-visible; play continues in memory. Import is bounded to 2MB and parsed as data, never executed. Export uses a user-triggered download. No user data is transmitted. The closed-database, unavailable-storage, corrupt-profile and export/import paths have browser regression checks.

## Rendering and assets

One gameplay canvas, native WGSL-capable WebGPU first and WebGL2 fallback. Shader helpers, Draco and meshopt paths are explicit same-origin versioned URLs. Original materials and engine/noise audio are procedural. No remote fonts, CDN textures or analytics. The car generator merges static parts by material while keeping four named wheel pivots; the export tool creates compressed GLBs with camera nodes and chassis metadata.

Runtime loads six compressed LOD0/LOD1 GLB pairs as reusable templates, cloning per-car materials for customization. Missing GLBs fall back to the original mesh generator. Custom liveries use that generator to lay ribbons on the body profiles. Traffic and racing use two persistent rigs with distance hysteresis beneath a stable transform; switching never touches physics, wheel state or customization. The player remains LOD0. All twelve files are original Kairos assets.

Four graphics settings vary resolution caps (720p/900p/1080p/1440p), shadow-map sizes and cell density, never physics or rules. Original periodic albedo/normal textures use mipmaps and anisotropic filtering. The sky uses a generated cloudy gradient texture updated when lighting changes; wetness changes asphalt roughness and physical grip. Analytic valley/studio cubemaps supply fallback/background lighting; one bounded local probe captures nearby scenery for player paint/glass. Its ownership, refresh limits and approximations are described in `graphics.md`. FXAA runs on all presets; bloom is reserved for Medium and above. Headlights and showroom key/fill lights use physical falloff, and close chase cameras ray-test against collision geometry. Automatic quality selection, dynamic resolution and KTX2 texture authoring remain separate acceptance work.

The gallery additionally uses a same-origin, prefiltered CC0 photographic environment with a generated failure fallback. Its 512px planar floor reflection is limited to visible cars/softboxes and stops submitting those objects when driving. `coachwork.ts` separates paint, glazing, interior and trim geometry; `camera-mounts.ts` shares car-specific positions between gameplay and GLB export. Roadside grass is instanced visual dressing; lake normal-map offsets advance with simulation time. None of these rendering components owns or changes vehicle forces or road collisions.

## Input and audio

The controller menu adapter runs on displayed updates, independently of the fixed driving clock. It uses button edges, hysteresis, delayed repetition and per-screen semantic focus bookmarks. Controls that are hidden, disabled or inert are excluded. Form edits dispatch the same change events as keyboard/mouse input. Device reconnects, menu transitions and window blur seed button state so a held driving button cannot accidentally confirm/resume. Synthetic browser coverage does not establish physical-controller or vibration compatibility.

Audio is original Web Audio synthesis: engine harmonics vary with RPM/load and vehicle cylinder count; wheel speed and gear drive transmission whine; separate filtered noise creates slip, road, wind and rain layers. Contact and surface affect road noise. Current rain is separate from accumulated wetness. Cockpit filtering and a bounded delay/feedback path model enclosure, using the same road-relative tunnel dimensions as the renderer, including height exclusion and portal fades. A compressor bounds output. Gear-change attenuation persists across subsequent displayed updates, and impacts dispose their transient nodes when finished.

`createDrivingAudioGraph` is shared by live `AudioContext` and offline PCM checks; `drivingMix` and `tunnelEnclosure` are pure, testable calculations. Audio startup is intentionally non-blocking because a controller event may not unlock browser audio. A trusted pointer/key event resumes it. The autoplay regression test uses CDP with `userGesture:false`: ordinary Playwright function evaluation supplies synthetic activation and would invalidate that test. See Chromium's [autoplay policy](https://www.chromium.org/audio-video/autoplay/) for the browser constraint. No external audio assets or runtime requests are involved. Subjective sound realism still needs listening/tuning on hardware.

## Debugging and reproducibility

Use F3 for telemetry or the development-only `window.kairos.snapshot()` / `window.render_game_to_text()` interfaces. **Await `advanceTime(ms)`**: it disables normal animation-loop simulation and awaits missing collision data without advancing simulation clocks. Rejected batches discard unconsumed time. `resumeRealTime()` restores normal stepping. Never treat a multi-second controlled-time batch's `physicsMs` as one real displayed frame. Current telemetry counts active meshes, not all GPU draw passes; it is not a draw-call-budget certification.

The pure tire function in `src/sim/tire.ts` can be tested without loading Babylon. `tests/simulation.test.ts` covers road connectivity, combined grip, ordered timing, shortcuts, reverse crossings, track limits, false starts, lapped classifications, finish windows and save validation. Browser scripts complement those rules with actual Havok cars and UI flows. Keep numeric tolerances: repeatability on this build does not imply cross-browser bitwise determinism.
