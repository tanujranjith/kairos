# Validation evidence

These are development-host results, not certification of the secondary 8GB integrated-GPU laptop. Browser screenshots and JSON reports are retained in `output/` (ignored by source control).

## Numerical driving checks

The same four-second Velara acceleration input was run with displayed-frame cadences of 60, 30 and 20Hz while physics stayed at 120Hz. All three returned **23.060786 m/s**. Braking to below 1m/s took **33.08–33.10m**; the difference is the sampling boundary. Rendering was deliberately disabled during these numerical checks. This is not an FPS measurement.

After the same four-second acceleration input, starting from rest on the same road:

| Car | Speed (m/s) | Approx. km/h |
|---|---:|---:|
| Aeris C | 15.675 | 56.4 |
| Velara S | 23.061 | 83.0 |
| Crest RS | 22.967 | 82.7 |
| Nova GT | 20.868 | 75.1 |
| GTX-R | 25.562 | 92.0 |
| Apex 01 | 31.692 | 114.1 |

All six had ground contact. These results demonstrate differentiated acceleration; they do not certify the catalog 0–100 or maximum-speed tuning targets.

## Browser checks

### September 19 handling, controller and sound checks

- Pure suite: **46 passing tests**, including precise partial-tile terrain clipping at the course boundary. TypeScript strict check and production build pass. The existing large-entry-chunk warning remains visible; it is not a performance-budget pass.
- Handling suite: **13 passing checks**, including a fresh second run. Six-car 0–100 times, dry/wet/worn braking, skidpad RMS, banking and barrier endpoints matched between these two runs (zero observed difference for the recorded comparisons). Tolerances, physical dimensions and measured figures are in [Northstar's validation notes](handling-course.md). This is controlled simulation, not an FPS benchmark.
- Interface suite: fifteen flow checks pass, now including course entry, map overlay and course-local reset. The provided web-game skill client completed independent input bursts, and its screenshot and state JSON were opened/inspected after integration. Vehicle remained on four contacts; no page-error artifact was produced.
- Controller suite: **21 browser checks** pass with synthetic standard-gamepad snapshots. Actual settings, select/range/checkbox controls, paint/wheel palettes, map markers, gamepad driving, pause/reconnect and race-results return are exercised. A stalled audio-permission promise does not stall entry to driving. Physical controller, rumble and OS dialogs are not certified.
- Audio suite: eight audible layer/scene renders plus mute, pause, pause transition, shift and engine-reference renders use the live synthesis graph through `OfflineAudioContext`. Every sample was finite; largest tested absolute peak was 0.352 (below digital clipping), mute/pause were exactly silent, and pause-transition tail settled to zero. Cockpit/tunnel processing and the persistent shift envelope changed rendered PCM as expected. This is signal verification, not a claim of acoustic realism or hardware latency.
- A separate strict-autoplay startup test started with **no document user activation**, entered the drive while sound remained suspended, and then resumed the actual audio context on a trusted keyboard event. Initial test attempts accidentally granted user activation through Playwright evaluation; the final test uses explicit no-gesture CDP evaluation and asserts inactive startup.

### Earlier baseline delivery and platform checks

The September 19 rebuilt production bundle also passed both local delivery paths, including Free Drive and Northstar. Cold-browser-cache startup was 3.033s (forced WebGL2) / 2.414s (automatic request), with 4,481,082 bytes transferred and JS heap samples approximately 71 / 82MB. There were no page errors, failed requests, third-party requests or exposed development hooks. These runs were unthrottled localhost on the development host. Installed Edge re-passed WebGPU and WebGL2 with identical 12.101111m/s two-second acceleration and four contacts. Earlier baseline numbers follow for comparison; no actual-laptop performance conclusion follows from either set.

With browser network emulation set to 25Mbps download / 5Mbps upload and 40ms latency, the final production page (after paint/boundary corrections) reached its usable start button in **6.045s / 4.495s**, transferring 4,481,261 bytes through the two drives. JS heap samples were approximately 58 / 88MB. An earlier run before those small corrections took 4.114s / 4.046s; concurrent verification affects development-host timings. Both final runs passed with no page errors, failed or external requests. See `output/delivery-25mbps/report.json`. These are controlled development-host cold-browser-cache samples, not an HTTPS deployment test, real connection measurement or target-laptop cold-start certification.

- Six-vehicle selection, paint customization, settings, route selection, acceleration, reverse, reset, pause clock, five cameras, night lighting and save/reload exercised through browser inputs.
- External HTTP(S) hosts were blocked during interaction and production delivery checks: no unexpected external requests or page errors.
- Production test hooks (`advanceTime`, `kairos`) were absent as intended.
- Final local cold-cache production startup: 1.764–2.340s; transferred bytes through startup and a short drive: 4,474,177 (~4.5 MB); JS heap snapshots: approximately 53–72 MB. Repeat runs varied (an earlier concurrent verification run took up to 5.7s), so these are samples, not a guaranteed maximum.
- Those download/startup numbers used unthrottled localhost, Chromium/SwiftShader and a development computer. They do not establish the 25Mbps Internet cold-start target, process memory, GPU memory or actual laptop performance.
- GLB exports: twelve files (six vehicles × two detail levels), approximately 0.69 MB in total. The six LOD0 files are the runtime vehicle templates; procedural generation is the fallback.
- Installed Windows Edge: WebGPU and forced WebGL2 both started and drove with external hosts blocked, no page errors and four grounded contacts. The identical two-second input returned 12.101111m/s in each renderer. This validates the renderer paths on the development host, not the secondary laptop.
- Installed Chrome did not reach a controllable browser page: its process exited during headless startup. No Chrome pass is claimed. Most remaining browser checks use bundled Chromium/SwiftShader.
- Storage fault suite: export/import round trip, preserved corrupt/unsupported profile, closed-database warning and unavailable IndexedDB all passed. Play continued when persistence was unavailable.

## Race checks

Eight-car three-lap GT and Formula tests reached results with all eight entrants classified. Subsequent review found pit-lane proximity could falsely penalize the main circuit near the pit entrance; this was corrected and a main-line exclusion regression test added. Completed-lap count now takes precedence over elapsed time when classifying lapped cars.

Physical pit checks confirmed both GT and Formula refuel and replace worn tires after stopping and waiting for service. The pit test starts at the service area, so it does not certify a full manual pit approach/rejoin. A reset synchronization bug was found and fixed: forces are now deferred until Havok has accepted a teleported chassis pose.

Latest full-weekend test (eight cars; 300s practice, 300s qualifying, three-lap race):

| Class | Practice best | Qualifying best | Race best | Race completion |
|---|---:|---:|---:|---|
| GTX-R | 113.91s | 113.66s | 113.63s | Player and six AI finished; one AI DNF |
| Apex 01 | 95.02s | 95.12s | 95.12s | All eight finished |

Both player races had zero penalties after the pit-lane exclusion fix. The six phases total approximately 33 minutes of **controlled simulation time**, not 30 minutes of real-time endurance. At phase endpoints, scene meshes ranged 357–512, materials 76–100 and textures 8–9; these bounded samples do not prove absence of memory growth, resident memory limits or GPU budgets. Physics-batch timing in this harness covers many simulated seconds and must not be read as a per-frame CPU measurement.

## Directed traffic checkpoint — September 19, 2026

The 60-test pure suite passes. Eleven browser traffic checks pass using real Havok cars with standard input/assists. Selected dry-road scenarios measured:

| Scenario | Observation |
|---|---|
| Red-light approach | Stopped with chassis center 3.92m before connector entry; departed on green |
| Left / right turn | Maximum path error 0.80m / 1.21m; zero recorded damage |
| Terminal turn-around | Completed connector and exit; maximum path error 1.71m |
| Merge | Completed connector, joined parkway and returned to outer lane; maximum tracking error 1.81m |
| Stationary obstruction | Stopped with 4.26m full-body clearance, then held position |
| Passing | Completed lane change with minimum oriented full-body clearance 1.53m |
| Obstruction removed | Resumed from a stopped queue; reached 12.21m/s without reset |
| Tier transitions | Started 12 physical + 12 distant; sampled 40 promotions / 33 demotions after region changes; maximum two decisions per 120Hz tick |

Tier samples retained 24 actors, no non-finite states or recorded damage, and 31–51 loaded cells. A sample during transition had seven physical actors, so these results do not promise twelve physical cars at every instant. Timing is controlled simulation, not real-time performance/endurance. Detailed traces, visible red/green light names and screenshots are in `output/traffic/report.json` and `output/traffic/`.

The general interaction and six-car physics suites passed after the junction collider/terrain changes. Repeated 60/30/20Hz input cadence still yielded 23.060786m/s and 33.08–33.10m stopping distance. Installed Edge sequentially passed both WebGPU and WebGL2 with four contacts, 12.101111m/s after two seconds, and no page/external-request errors. The supplied skill client was rerun sequentially; its gameplay screenshot/state were opened and checked. A prior concurrent verification attempt timed out in Edge navigation and the client's click; those timed-out checks were not counted as passes.

The sequential production cold-browser-cache checks with 25Mbps/40ms emulation reached the start screen in **4.197s / 4.088s**, transferred **4,489,007 bytes** through Free Drive and the handling-course flow, and sampled approximately **85 / 60MB JS heap**. No page errors, failed or external requests were recorded, and production test hooks were absent. Concurrent runs were slower (15.198s / 8.343s); neither set measures target-laptop frame pacing, whole-process/GPU memory or an HTTPS deployment. The final sequential report is `output/delivery-25mbps/report.json`.

## September 19 — asynchronous streaming and first graphics upgrade

- 72 tests, strict TypeScript and the production build pass. Six-car physical acceleration/contact checks and 60/30/20Hz displayed-input cadence still give Velara 23.060786m/s and 33.08–33.10m braking distance. Twenty-one synthetic controller browser checks pass with asynchronous entry.
- The worker/graphics suite passes grounded entry, deliberately delayed collision buffers with clocks frozen, failed generation/retry, eight-car circuit/pit reservations and return-to-menu disposal. A separate real network fault test blocks the module-worker request, retries into driving, then cancels another in-progress session. No page errors or external runtime requests occur in those checks.
- Eleven traffic checks pass after protecting pending promotions against worker starvation. The sampled physical populations are 12/12/7 with 24 total actors; the lakeshore increases to eight after another three seconds. No recorded damage, maximum two decisions per fixed step. The narrow off-camera safe-spawn band still limits instantaneous density. The first rerun's zero-car samples and a subsequent too-strict eight-at-every-endpoint assertion were investigated and are not counted as passes.
- Three city/mountain/lakeshore cycles return to identical resource counts at each destination: **451/54/31**, **320/53/30**, and **320/54/31** scene meshes/materials/textures, respectively, with 25 ready cells at each sampled endpoint. This is a short controlled resource-ownership check, not a 30-minute process-memory result.
- Installed Edge passes WebGPU and WebGL2: four wheel contacts and 12.101111m/s after two seconds, no page/external-request errors. The supplied skill client was run and its actual gameplay screenshots/state inspected; supplemental full-UI captures cover showroom, day, city, wet night and race grid. Reports are in `output/graphics-streaming`, `output/graphics-upgrade-input`, `output/worker-recovery` and `output/browsers`.
- Production cold-cache **25Mbps / 40ms** emulation reached the start screen in **5.132s / 4.968s**, transferring **5,959,312 bytes** through Free Drive and handling entry. JS heap samples were **118,480,664 / 110,969,436 bytes**. No page/failed/external requests; development hooks absent. This remains localhost/Chromium/SwiftShader evidence, not laptop, GPU/process-memory or HTTPS certification. New car assets are larger and normal-mapped/alpha foliage adds rendering cost: the 30FPS Low target is not yet measured on the target machine.

## September 19 — local reflections, LOD and second foliage pass

The rendering audit uses installed Edge, forced WebGL2, **NVIDIA GeForce RTX 3060 / ANGLE D3D11**, Low, 1280×720. It samples 66 controlled 30Hz steps per scene, including reflection capture frames. These are short development-host draw-submission measurements, not a real-time route, integrated-laptop FPS proof or GPU-memory measurement. `SceneInstrumentation` counts draw calls including render targets; active-index counts below also include extra submissions (the line-system count is rounded).

| Sample | Maximum draw calls | Maximum submitted triangles | Median scene submission time |
|---|---:|---:|---:|
| Showroom | 126 | 146,870 | 2.9ms |
| Lakeshore with traffic | 235 | 371,700 | 6.9ms |
| City with traffic | 189 | 374,773 | 5.2ms |
| Wet night | 190 | 374,780 | 6.2ms |
| Eight-car grid / countdown | 285 | 426,870 | 4.9ms |

An initial version exceeded the budgets: 333 draw calls in lakeshore traffic and 607,350 submitted triangles at the grid. Tuning the Low visual-detail threshold and capture budget reduced geometry; spreading double-buffered reflections over six displayed frames removed the six-face draw spike. Both raw reports remain in `output/render-cost/`. No hidden physics/AI grip or power changes were used. Submission time includes driver synchronization and is not isolated CPU work or GPU time.

The six GLB rigs and six livery rigs pass repeated detail switches with stable roots, four animated pivots, matching paint and no mesh/material/node growth after disposal. Typical distant geometry falls from approximately 40–46k triangles to 13–16k. Reflection checks cover actual first-frame showroom architecture, feedback exclusion, cached idle frames, one face per displayed frame, retention of the old complete cube until replacement, and repeated preset resource disposal. A readback/disposed-texture race and an initial sky-only capture were found and fixed; those earlier checks are not counted as final passes. Reports/screenshots: `output/render-detail/`.

74 pure tests pass. Installed Edge passes WebGPU and WebGL2 with four wheel contacts and 12.101111m/s after two seconds, no page errors or external requests. Six-car physics, 60/30/20Hz cadence/braking, general interaction and all eleven traffic regressions pass unchanged. The supplied web-game input client was rerun and its actual screenshots/state inspected after both foliage passes. Three streaming cycles settle at identical city/mountain/lakeshore resource counts of 468/54/33, 326/53/32 and 343/54/33 meshes/materials/textures. Loading freeze, failed-generation retry, race reservation and return-home cleanup pass. These short checks still do not establish 30-minute endurance.

The final production cold-cache 25Mbps/40ms smoke passes both requested renderer paths and Free Drive/handling entry: **15.870s / 5.483s** readiness, **6,789,276 transferred bytes**, **73,653,112 / 127,555,448 bytes JS heap**, no page/failed/external requests, development hooks absent. Both LOD libraries are now in the startup payload. Readiness varied materially between runs; this is browser network emulation on the development host, not a target-laptop cold-start guarantee. The final supplied-client steering capture (`output/reflections-final-input`) shows four wheel contacts, 3.711m/s, zero damage and no loading/error state.

## September 19 — coachwork, gallery and environment refinement

Final build and strict check pass; **77 tests** cover the existing systems plus body/roof normals, scale-safe camera mounts and deterministic grass. Six GLB/livery pairs retain four pivots, customization and stable resource disposal. Five camera views, all six car selections, livery variants, animated water and an intentionally blocked HDR request pass browser checks. The optional photo failure preserves the generated gallery and grounded Free Drive. Actual screenshots were opened and inspected; a reversed-surface bug and cameras positioned at/inside the new roof/hood were corrected before the final checks.

All six acceleration traces and 60/30/20Hz cadence/braking results match the previous checkpoint: Velara 23.060786m/s after the acceleration interval, 33.08–33.10m braking. Menu/control/save interactions pass. Three city/mountain/lakeshore streaming cycles settle identically at **454/66/41**, **324/65/40**, and **336/66/41** scene meshes/materials/textures. Delayed/failed collisions, retry without replay, race reservation and return-home disposal pass; this still is not 30-minute endurance.

**Installed Chrome and Edge both pass WebGPU and forced WebGL2**: 12.101111m/s, four contacts, no page errors or external requests in all four runs. The previous installed-Chrome launch limitation did not recur in this run. Reports: `output/browsers`.

The final submission audit uses installed Edge / RTX 3060 / ANGLE D3D11, Low 1280×720, the same 66 controlled steps per sample. It includes the gallery mirror and local capture passes. These are development-host submissions, not integrated-GPU FPS, isolated CPU/GPU timings or process memory.

| Sample | Maximum draw calls | Maximum submitted triangles | Median scene submission |
|---|---:|---:|---:|
| Showroom | 162 | 164,246 | 4.2ms |
| Lakeshore traffic | 235 | 348,784 | 7.2ms |
| City traffic | 188 | 351,651 | 6.7ms |
| Wet night | 189 | 351,658 | 6.8ms |
| Eight-car grid | 277 | 351,332 | 4.4ms |

The gallery reflection adds work to menus; simplified wheel rings and the new body topology reduce race geometry versus the prior 426,870-triangle grid sample. The photographic `.env` adds 4,726,025 bytes to initial content. Its original HDR is retained outside the production directory.

Final production cold-cache **25Mbps/40ms browser emulation** reached the start screen in **7.874s / 7.855s**, transferring **11,140,653 bytes** through Free Drive and handling-course entry. JS heap samples were **83,063,364 / 134,852,456 bytes**; no page errors, failed/external requests or exposed development hooks. This is localhost/Chromium/SwiftShader, not actual target-laptop or HTTPS certification. The supplied web-game steering screenshot/state (`output/art-final-input`) was opened: four contacts, 3.711m/s, zero damage and no loading/error state.

## September 19 — environmental graphics continuation

The final environment build has 83 passing tests and a successful strict production build. Seven region/weather/daylight scenarios remain on four contacts; the five architectural families are also captured with a separate inspection camera. The supplied input client screenshot/state was opened: 3.710974m/s, four wheel contacts, zero damage, no loading/error state. Fifteen general interaction checks pass, including pause, five cameras, save/reload and handling entry/reset. Six-car acceleration and cadence/braking match the previous checkpoint.

Final window-emission streaming checks pass delayed/failed collisions, retry without replay, race reservation, home cleanup and three repeated region cycles. City/mountain/lakeshore counts settle identically at **469/66/42**, **324/65/41**, **337/66/42** meshes/materials/textures. The single additional shared texture is the two-pixel window emission atlas. This is bounded short-run evidence, not 30-minute endurance.

Installed Chrome and Edge both pass WebGPU and forced WebGL2 again: **12.101111m/s**, four contacts, no page/external-request errors in all four runs.

The final 66-step Low720p submission audit is again installed Edge / RTX3060 / ANGLE D3D11. Numbers include extra passes and driver submission/synchronization; they are **not actual-laptop FPS, real-time pacing or isolated CPU/GPU timing**.

| Sample | Maximum draw calls | Maximum submitted triangles | Median scene submission |
|---|---:|---:|---:|
| Showroom | 162 | 164,246 | 4.7ms |
| Lakeshore traffic | 235 | 326,038 | 6.5ms |
| City traffic | 194 | 400,305 | 6.4ms |
| Wet night | 195 | 400,472 | 6.8ms |
| Eight-car grid | 276 | 328,074 | 5.0ms |

Architectural detail increases city geometry while the lower-cost outer range reduces the other driving scenes. These sampled Low submission counts remain below 300 draws/500,000 triangles. They do not prove the budgets on every route or hardware profile. Raw reports: `output/scenery`, `output/scenery-final-input`, `output/render-cost`, `output/graphics-streaming`, `output/browsers`.

A final geometry review corrected rows of windows that could overlap an eave and tightened the returned building-height bounds. The 83-test suite, seven-region captures, supplied driving client and submission audit above were rerun after that correction. Four-path browser, general-interaction and streaming reports precede this last geometry-only correction; no renderer, resource-lifecycle, input or physics logic changed afterward.

The final rebuilt production bundle passes both cold-cache 25Mbps/40ms emulated startup paths: **6.887s / 6.740s**, **11,143,058 transferred bytes**, JS heap **132,364,648 / 122,347,584 bytes** through Free Drive and handling-course entry. No page errors, failed/external requests or exposed development hooks. These are localhost/Chromium/SwiftShader samples, not Internet/HTTPS, actual-laptop performance or process-memory certification.

## Outstanding hardware and deployment acceptance

Actual 8GB laptop city / mountain-highway / wet-night / eight-car-race routes; p95 frame time; separate physics/AI/GPU timing; resident process and GPU memory; actual-hosted 25Mbps cold download (local emulation now has evidence above); real-time 30-minute endurance; complete interaction/fault matrix; HTTPS smoke test after an authorized destination is supplied. No target-budget pass is claimed for these unmeasured items.
