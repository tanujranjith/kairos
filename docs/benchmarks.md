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

## Remaining acceptance work

Actual 8GB laptop city / mountain-highway / wet-night / eight-car-race routes; p95 frame time; separate physics/AI/GPU timing; resident process and GPU memory; actual-hosted 25Mbps cold download (local emulation now has evidence above); real-time 30-minute endurance; complete interaction/fault matrix; HTTPS smoke test after an authorized destination is supplied. No target-budget pass is claimed for these unmeasured items.
