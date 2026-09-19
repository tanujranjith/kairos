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

## Still required

Actual 8GB laptop city / mountain-highway / wet-night / eight-car-race routes; p95 frame time; separate physics/AI/GPU timing; resident process and GPU memory; controlled 25Mbps cold download; real-time 30-minute endurance; complete interaction/fault matrix; HTTPS smoke test after an authorized destination is supplied. No target-budget pass is claimed for these unmeasured items.
