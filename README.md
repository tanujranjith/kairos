# Kairos

A single-player browser driving game built with TypeScript, Babylon.js and Havok. All simulation, rendering and audio run locally. No account, economy, paid assets, multiplayer or service worker.

## Run

Use Node **24** (or a compatible Node >=22.12), not the machine's default Node 20.

```sh
npm ci
npm run dev -- --port 5187
npm run check
npm test
npm run build
npm run preview -- --port 5192
```

The bundled Windows runtime is `C:/Users/tanuj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`. Prepend that runtime's `bin` directory to the current shell's `PATH` before invoking npm, so npm's child scripts also use Node24. Merely invoking `npm-cli.js` through Node24 leaves child scripts on the machine's default Node20.

Open the local URL in hardware-accelerated Chrome or Edge. `?renderer=webgl` forces WebGL2. The default attempts WebGPU and falls back to WebGL2.

## Play

Keyboard turn-in and centering are quicker, with a speed- and surface-aware steering limit. Gravel/concrete shoulders now have matching physical support. Predictive ABS and split-surface brake-pressure control address the reproduced70mph spin without increasing tire grip. See [current handling evidence](docs/surface-handling.md) and the [earlier40mph correction](docs/keyboard-handling.md). All six cars retain their original tire-grip and power parameters.

The latest [car-model pass](docs/graphics.md) now extends all six cars with constructed tire sidewalls, tread or slick details, valve hardware and rotor hats. The five enclosed cars add covered projector optics, segmented rear lamps, recessed wheel-opening liners, revised rolled lips, bonnet/deck/fuel-filler boundaries, class-specific shoulder creases, air curtains and lower reflectors, plus a higher-detail wheel with centre badge, top marker and paddles. Apex adds head-surround padding, a camera fairing, antenna and moving yoke assembly. All twelve GLBs expose named wheel, camera and steering pivots. The controls animate from actual steering state in the player car while invisible NPC cabin controls are culled to retain the Low-grid budget. This builds on curved glazing, molded cabins, smoother body surfaces and open Formula intakes. It is substantial original model work, while small-scale surface material variety and reference-level realism remain unfinished.

City corridors now have original lamp standards, benches, bins, planted beds and shelters. At night, two nearby pooled streetlights illuminate the road and cars; their ownership follows streamed scenery. This is bounded city dressing, not a completed world-art pass or a bus-service feature. The existing handling corrections are unchanged.

Ground materials blend meadow, dry grass, woodland soil, shore sediment and exposed rock in world coordinates. Clipped terrain now shares boundary vertices across polygons and streamed cells, repairing a measured height-gap defect in the actual collision mesh. Authored road/shoulder surfaces and vehicle handling are unchanged. See [terrain continuity and off-road limits](docs/terrain-continuity.md). Scenery density, broader terrain shape and visual polish remain unfinished.

The [directional sky](docs/atmosphere.md) now has layered clouds, sunward dusk haze, a small cloud-obscured sun, and a readable night gradient with stars and moon. It uses one shared cloud atlas and native shaders on both renderers, not a low-resolution coloured sky repainted every time the clock changes. This does not change driving physics or complete the wider scenery upgrade.

Rural roads now use [authored roadside groves and weathered boulders](docs/rural-landscape.md) instead of uniform tree scatter and white concrete-looking rocks. A complementary [utility, field-edge and farm layer](docs/rural-infrastructure.md) adds road-following poles/wires, timber fencing with gate gaps and five distant farm clusters. Both layers are deterministic, streamed by cell and kept clear of protected roads, water and junction views. Utility/fence detail is visual-only; it does not alter road, shoulder or vehicle physics. The result is less empty, while the world and cars remain stylized and need further art passes.

In Free Drive, select **Aster International** on the map to drive through its access underpass to the pit destination. The pit exit joins the one-way circuit; follow it to the west gate to return to public roads. See [circuit access and verification](docs/circuit-access.md).

Choose one of six unlocked original vehicles in the garage, then Free Drive or Motorsport. The map lists destinations and optional activities. Motorsport offers practice, qualifying, quick races, and a practice → qualifying → race weekend.

Pit visits use their own ordered timing route. Stay below **60 km/h (37 mph)**, stop in your assigned garage-side box and select **SERVICE / PIT** for fuel and tires. The HUD displays the limit; speeding incurs a penalty. See [timing and pit verification](docs/race-timing.md).

Aster now has planted banks/tree belts and a dressed rear paddock. Racing AI requests fuel/tire service, leaves the continuous fast lane for one of sixteen assigned drive-through boxes, and yields at the circuit exit. A car that fully depletes its fuel now coasts to rest and receives an explicit `DNF · OUT OF FUEL`; it is never recycled through the spin-recovery teleport, and following cars use a slow road-coordinate bypass. The race HUD distinguishes local stopped-car/off-track yellow, a close lapping-car blue and checkered; these are local flag states, not a safety-car system. Predictive lane reservation, gradual line changes and yaw-rate feedback correct the reproduced opening-lap spins; both eight-car weekends and sixteen-car three-lap races pass selected clean-field and multi-retirement checks. Race Weekend now preserves the entire [earned qualifying grid](docs/qualifying-grid.md), including identity, ties and loading retries. Restart weekend starts fresh practice without overwriting your setup position. See [timing/flag rules](docs/race-timing.md), [racing control](docs/racing-ai.md), the [feature status](docs/feature-status.md) and [measured checks](docs/benchmarks.md), rather than treating the working build as final acceptance.

**Handling course** in the sidebar opens Northstar's traffic-free proving ground with the selected car. It contains braking lanes, a slalom, three skidpad rings, measured bumps, a banked road, a gradient, a curb and a launch ramp. It is also connected to the public road network. Reset inside the course returns to its braking lane. See [course layout and measured tests](docs/handling-course.md).

| Action | Keyboard | Xbox-style controller |
|---|---|---|
| Accelerate / brake | W / S or ↑ / ↓ | RT / LT |
| Steer | A / D or ← / → | Left stick |
| Reverse from a stop | Hold brake | Hold LT |
| Handbrake | Space | A |
| Shift up / down (manual) | E / Q | RB / LB |
| Camera | C | B |
| Reset to road, invalidate lap | R | X |
| Map | M | Y |
| Pause | Escape | Menu |
| Fullscreen | F | — |
| Headlights | L | — |
| Developer telemetry | F3 | — |

Settings contain key remapping, assists, units, weather, time, graphics, traffic and sound. Fresh profiles benchmark displayed frame pacing and choose a graphics preset automatically; selecting Low, Medium, High or Ultra turns that selection off. Dynamic resolution remains active during driving, with a 70% floor and gradual recovery, and never changes physics or race rules. Telemetry shows actual render dimensions and effective scale. Save data is versioned IndexedDB data on this browser and origin; use export/import to transfer it. An unavailable database leaves the game playable in memory and displays a warning. Clearing browser data removes local saves.

If the browser loses its graphics context or GPU device while driving, Kairos pauses the simulation and keeps the vehicle/session state unchanged. WebGL2 rebuilds the local environment maps and reflection probes in place, then waits for the player to resume. A WebGPU device that cannot be reacquired within 20 seconds offers an explicit **Restart with WebGL2** action after persisting the save. The fallback reload is intentional because current Edge/Windows did not provide a replacement device after an explicit device destruction; it is not represented as seamless WebGPU recovery.

In menus, controller D-pad / left stick up-down moves focus, left-right changes selects/sliders or cycles paint colors, A confirms and B/Menu returns. Keyboard Tab/Shift+Tab moves focus, Enter/Space activates, and Escape returns. Focus survives settings changes; held buttons must be released after connecting or entering a menu. If browser autoplay is blocked, click or press a key once to enable audio; driving does not wait for sound permission. Native save-file dialogs still require the operating system's controls.

## Validation and development

`window.render_game_to_text()`, `window.advanceTime(ms)`, and `window.kairos` exist only in development/test builds. **Await `advanceTime(ms)`**: it suspends normal stepping and waits for required collision cells without advancing session clocks during loading. Call `window.kairos.resumeRealTime()` to resume. One fixed accumulator owns the 120 Hz simulation.

```sh
node scripts/web_game_playwright_client.mjs --url "http://127.0.0.1:5187/?renderer=webgl" --actions-file tests/actions-drive.json --click-selector "#start-drive" --iterations 1 --screenshot-dir output/driving
node scripts/inspect.mjs "http://127.0.0.1:5187/?renderer=webgl" garage
node scripts/verify-racing.mjs
node scripts/verify-weekend.mjs
node scripts/verify-physics.mjs
node scripts/profile-startup.mjs
node scripts/verify-startup.mjs --repeats=3 --output=output/startup-delivery
node scripts/verify-startup.mjs --channel=msedge --race --output=output/startup-edge
node scripts/verify-startup.mjs --channel=chrome --race --formula --output=output/startup-formula-chrome
node scripts/verify-formula-model.mjs
node scripts/verify-road-models.mjs
node scripts/verify-road-models.mjs --fallback
node scripts/verify-handling.mjs
node scripts/verify-traffic.mjs
node scripts/verify-layers.mjs
node scripts/verify-access.mjs
node scripts/verify-pits.mjs
node scripts/verify-pit-timing.mjs
node scripts/verify-contested-pits.mjs
node scripts/verify-scenery.mjs
node scripts/verify-streetscape.mjs
node scripts/verify-streetscape.mjs --renderer=auto --output=output/streetscape-webgpu
node scripts/verify-graphics-streaming.mjs
node scripts/verify-freedrive-stress.mjs
node scripts/verify-worker-recovery.mjs
node scripts/inspect-handling.mjs
node scripts/verify-controller-navigation.mjs
node scripts/verify-audio.mjs
node scripts/verify-interactions.mjs
node scripts/verify-storage.mjs
node scripts/verify-browsers.mjs msedge
node scripts/verify-adaptive-quality.mjs
node scripts/verify-graphics-recovery.mjs
node scripts/verify-endurance.mjs --minutes=30 --sample-ms=30000 --renderer=webgl --output=output/endurance-real30
node scripts/build-assets.mjs
npm run build:textures
npm run verify:textures
node scripts/verify-compressed-textures.mjs
```

The web-game client is an unmodified copy of the supplied skill client. Supplementary scripts inspect full HTML HUDs and run physical race traces. Artifacts go in `output/`. Headless Chromium may use SwiftShader: its timings are **not** integrated-GPU laptop performance measurements.

Vite excludes generated `output/` captures/reports from hot reload. Watching those files caused a confirmed Windows `EBUSY` server crash while a report was being copied; game source and public models remain watched. This prevents that specific artifact-watcher failure, not every possible startup problem.

The verification scripts use the dev server on port 5187. `verify-delivery.mjs` requires the production preview on port 5192. Browser binaries must be available to Playwright. `build-assets.mjs` rebuilds the original compressed car models through the dev-only exporter; the generated models are already included. `build:textures` rebuilds the nineteen original KTX2 surface/cloud assets and their cache version from the shared deterministic source fields. The ordinary production build verifies those generated assets rather than silently regenerating them. `npm run build` also copies third-party runtime notices into `dist/licenses/`.

`node scripts/verify-delivery.mjs --25mbps` adds browser-emulated 25Mbps download / 5Mbps upload with 40ms latency and a cold browser cache. Its separate `output/delivery-25mbps/` results are development-host network emulation, not an actual-laptop or Internet deployment benchmark.

See [architecture and tuning](docs/architecture.md), [graphics](docs/graphics.md), [rural landscape](docs/rural-landscape.md), [rural infrastructure](docs/rural-infrastructure.md), [road/contact layers](docs/road-layers.md), [streaming](docs/streaming.md), [traffic](docs/traffic.md), [feature status](docs/feature-status.md), [validation evidence](docs/benchmarks.md), [licenses](docs/assets-and-licenses.md), and [progress](progress.md). This is a playable development build, **not completion of every requirement in the approved plan**. A real-time 30-minute repeated eight-car race/session run and selected maximum-speed Free Drive routes now pass on the development PC. Further car/world art polish, broader wet/night traffic endurance, the full interaction/fault matrix, and target-laptop performance still need work.

## Static hosting

`dist/` is the static output. The included Vercel configuration builds with npm, revalidates the application shell, gives hashed `/assets/` files immutable caching and gives fingerprint-query `/textures/` files immutable caching. Select Node 24 in the authorized project's settings. Do not publish source references or the complete project directory as a static file server.

No deployment has been authorized or verified yet. Once a project is supplied, deploy a preview, test startup and driving with external hosts blocked, then promote that exact tested deployment. Keep its predecessor for rollback. The Vercel deployment guidance informed this preview-first configuration; no credentials or cloud services are required for local play.
