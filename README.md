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

Keyboard turn-in and centering are quicker, with a speed- and surface-aware steering limit. Gravel/concrete shoulders now have matching physical support. Predictive ABS and split-surface brake-pressure control address the reproduced70mph spin without increasing tire grip. See [current handling evidence](docs/surface-handling.md) and the [earlier40mph correction](docs/keyboard-handling.md). All six tuning profiles retain their original tire-grip and power parameters.

Per the current content direction, the live game now [reuses one authored Velara S model](docs/shared-car-model.md) for the player, traffic, race grids, showroom background and parked scenery. The garage presents six tuning profiles rather than six different bodies: their FWD/RWD/AWD, GT and Formula-class physics, power, tire and race-rule differences remain intact. Only the Velara LOD0/LOD1 files are requested; paint, wheel finish and accent treatment remain customizable. A blocked-asset fallback also preserves the same body instead of changing shape.

City corridors now have original lamp standards, benches, bins, planted beds and shelters. A [boulevard planting pass](docs/boulevard-planting.md) pairs all 83 lamp stations with 86 raised beds that reuse the original oak/trunk and low-cost grass cards, replacing isolated greenery with a consistent tree line. At night, two nearby pooled streetlights illuminate the road and cars; their ownership follows streamed scenery. This is bounded city dressing, not pedestrians, a completed world-art pass or a bus-service feature. The existing handling corrections are unchanged.

Westbrook's signalized approaches now add [lane-derived zebra crossings and correctly ordered stop bars](docs/urban-crosswalks.md) to the existing shared white-paint batch. [Continuous corner sidewalks](docs/junction-sidewalks.md) join the straight paving around all four signal aprons and analytically trim the old approach overlaps. Its ten transit shelters also carry a [small streamed street-life population](docs/street-life.md): one seated and one standing figure per shelter, merged by cell without AI or collision bodies. Together they improve junction scale and human context while preserving driving behavior.

Ambient traffic uses wet-aware cruise, corner, following and stopping targets rather than dry-road pace on rain-reduced tire grip. A commanded-motion timer also recovers a physically wedged middle-distance car without touching legitimate red-light or following queues, preventing one blocked connector from starving an intersection indefinitely. The selected 270-second rainy-night stress evidence and remaining limits are documented in [traffic](docs/traffic.md).

[Westbrook Commons](docs/westbrook-commons.md) replaces one large downtown lawn with a streamed civic park: terrain-following physical walks, a fountain, benches, path lamps, planted beds and reused mature trees. It shares existing cell materials and vegetation libraries and stays inside the Low submission budget. This is one composed public space, not pedestrians or a complete city-park network.

Ground materials blend meadow, dry grass, woodland soil, shore sediment and exposed rock in world coordinates. Clipped terrain now shares boundary vertices across polygons and streamed cells, repairing a measured height-gap defect in the actual collision mesh. Authored road/shoulder surfaces and vehicle handling are unchanged. See [terrain continuity and off-road limits](docs/terrain-continuity.md). Scenery density, broader terrain shape and visual polish remain unfinished.

The [directional sky](docs/atmosphere.md) now has layered clouds, sunward dusk haze, a small cloud-obscured sun, and a readable night gradient with stars and moon. It uses one shared cloud atlas and native shaders on both renderers, not a low-resolution coloured sky repainted every time the clock changes. This does not change driving physics or complete the wider scenery upgrade.

Rural roads now use [authored roadside groves and weathered boulders](docs/rural-landscape.md) instead of uniform tree scatter and white concrete-looking rocks. A complementary [utility, field-edge and farm layer](docs/rural-infrastructure.md) adds road-following poles/wires, timber fencing with gate gaps and five distant farm clusters. [Roadside guidance](docs/roadside-guidance.md) adds dark-banded reflector posts at a continuous road-distance cadence and yellow-on-black chevron boards on Ridgeway's two sharp hairpins. The [industrial compound pass](docs/industrial-setting.md) adds two container yards, a tank farm and a process plant, while [four authored Westbrook blocks](docs/urban-setting.md) replace isolated towers and empty lawns with varied multi-building courtyards. A [shared background-office family](docs/background-offices.md) mixes cleaner continuous-band façades into one third of procedural offices, [single-surface repeated panes](docs/window-geometry.md) remove hidden architectural geometry, [renderer-safe façade materials](docs/facade-materials.md) remove the reproduced WebGPU mip/depth triangles, and [terrain-following urban aprons and marked forecourts](docs/urban-parcels.md) keep procedural buildings from meeting bare grass directly. Eligible lots now use [repeated instances of the same authored Velara LOD](docs/parked-model-reuse.md), rather than a cheaper background-car prop. All layers are deterministic, streamed by cell and kept clear of protected roads, water and junction views. The result is less empty and easier to read while broad lawns, pedestrians, sidewalk continuity and final material realism remain open.

In Free Drive, select **Aster International** on the map to drive through its access underpass to the pit destination. The pit exit joins the one-way circuit; follow it to the west gate to return to public roads. See [circuit access and verification](docs/circuit-access.md).

Choose one of six unlocked Velara tuning profiles in the garage, then Free Drive or Motorsport. The map filters All, Activities, Scenic, Services and Motorsport destinations and includes the complete optional set of four speed traps, three point-to-point trials, two drift zones and three scenic discoveries; its detail panel shows persistent personal bests. Motorsport offers practice, qualifying, quick races, and a practice → qualifying → race weekend.

Pit visits use their own ordered timing route. Stay below **60 km/h (37 mph)**, stop in your assigned garage-side box and select **SERVICE / PIT** for fuel and tires. The HUD displays the limit; speeding incurs a penalty. See [timing and pit verification](docs/race-timing.md).

Aster now has planted banks/tree belts and a dressed rear paddock. Racing AI requests fuel/tire service, leaves the continuous fast lane for one of sixteen assigned drive-through boxes, and yields at the circuit exit. If it misses its assigned stop, it continues forward, rejoins safely and retries on the next lap instead of reversing through pit traffic. A fifteen-AI same-lap service demand now passes in both GT and Formula profiles without an overshoot, reset, warning, penalty or collision. A car that fully depletes its fuel coasts to rest and receives an explicit `DNF · OUT OF FUEL`; it is never recycled through the spin-recovery teleport, and following cars use a slow road-coordinate bypass. The race HUD distinguishes local stopped-car/off-track yellow, a close lapping-car blue and checkered; these are local flag states, not a safety-car system. Predictive lane reservation, gradual line changes and yaw-rate feedback correct the reproduced opening-lap spins; both eight-car weekends and sixteen-car three-lap races pass selected clean-field and multi-retirement checks. Race Weekend now preserves the entire [earned qualifying grid](docs/qualifying-grid.md), including identity, ties and loading retries. Restart weekend starts fresh practice without overwriting your setup position. See [timing/flag rules](docs/race-timing.md), [racing control](docs/racing-ai.md), the [feature status](docs/feature-status.md) and [measured checks](docs/benchmarks.md), rather than treating the working build as final acceptance.

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
node scripts/verify-crosswalks.mjs --output=output/junction-sidewalks
node scripts/verify-streetscape.mjs
node scripts/verify-streetscape.mjs --renderer=auto --output=output/streetscape-webgpu
node scripts/verify-agricultural-fields.mjs --output=output/agricultural-fields
node scripts/verify-industrial-setting.mjs --output=output/industrial-setting
node scripts/verify-urban-setting.mjs --output=output/urban-setting
node scripts/verify-urban-park.mjs --output=output/urban-park
node scripts/verify-reused-parked-cars.mjs --output=output/reused-parked-cars
node scripts/verify-roadside-guidance.mjs
node scripts/verify-graphics-streaming.mjs
node scripts/verify-wet-night-driving.mjs
node scripts/verify-freedrive-stress.mjs
node scripts/verify-worker-recovery.mjs
node scripts/inspect-handling.mjs
node scripts/verify-controller-navigation.mjs
node scripts/verify-camera-collision.mjs
node scripts/verify-player-service.mjs
node scripts/verify-platform-interactions.mjs --output=output/platform-interactions
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

See [architecture and tuning](docs/architecture.md), [graphics](docs/graphics.md), [chase-camera collision](docs/camera-collision.md), [Free Drive activities](docs/free-drive-activities.md), [map filters](docs/map-filters.md), [player service](docs/player-service.md), [rural landscape](docs/rural-landscape.md), [rural infrastructure](docs/rural-infrastructure.md), [agricultural fields](docs/agricultural-fields.md), [industrial compounds](docs/industrial-setting.md), [Westbrook urban blocks](docs/urban-setting.md), [roadside guidance](docs/roadside-guidance.md), [road/contact layers](docs/road-layers.md), [streaming](docs/streaming.md), [traffic](docs/traffic.md), [feature status](docs/feature-status.md), [validation evidence](docs/benchmarks.md), [licenses](docs/assets-and-licenses.md), and [progress](progress.md). This is a playable development build, **not completion of every requirement in the approved plan**. A real-time 30-minute repeated eight-car race/session run and selected maximum-speed Free Drive routes now pass on the development PC. Further car/world art polish, broader wet/night traffic endurance, the full interaction/fault matrix, and target-laptop performance still need work.

## Static hosting

`dist/` is the static output. The included Vercel configuration builds with npm, revalidates the application shell, gives hashed `/assets/` files immutable caching and gives fingerprint-query `/textures/` files immutable caching. Select Node 24 in the authorized project's settings. Do not publish source references or the complete project directory as a static file server.

No deployment has been authorized or verified yet. Once a project is supplied, deploy a preview, test startup and driving with external hosts blocked, then promote that exact tested deployment. Keep its predecessor for rollback. The Vercel deployment guidance informed this preview-first configuration; no credentials or cloud services are required for local play.
