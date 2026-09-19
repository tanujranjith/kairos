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

The bundled Windows runtime is `C:/Users/tanuj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`. If `npm.cmd` selects Node 20, invoke `C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js` with the bundled Node executable explicitly.

Open the local URL in hardware-accelerated Chrome or Edge. `?renderer=webgl` forces WebGL2. The default attempts WebGPU and falls back to WebGL2.

## Play

Choose one of six unlocked original vehicles in the garage, then Free Drive or Motorsport. The map lists destinations and optional activities. Motorsport offers practice, qualifying, quick races, and a practice → qualifying → race weekend.

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

Settings contain key remapping, assists, units, weather, time, graphics, traffic and sound. Save data is versioned IndexedDB data on this browser and origin; use export/import to transfer it. An unavailable database leaves the game playable in memory and displays a warning. Clearing browser data removes local saves.

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
node scripts/verify-handling.mjs
node scripts/verify-traffic.mjs
node scripts/verify-layers.mjs
node scripts/verify-pits.mjs
node scripts/verify-scenery.mjs
node scripts/verify-graphics-streaming.mjs
node scripts/verify-worker-recovery.mjs
node scripts/inspect-handling.mjs
node scripts/verify-controller-navigation.mjs
node scripts/verify-audio.mjs
node scripts/verify-interactions.mjs
node scripts/verify-storage.mjs
node scripts/verify-browsers.mjs msedge
node scripts/build-assets.mjs
```

The web-game client is an unmodified copy of the supplied skill client. Supplementary scripts inspect full HTML HUDs and run physical race traces. Artifacts go in `output/`. Headless Chromium may use SwiftShader: its timings are **not** integrated-GPU laptop performance measurements.

The verification scripts use the dev server on port 5187. `verify-delivery.mjs` requires the production preview on port 5192. Browser binaries must be available to Playwright. `build-assets.mjs` rebuilds the original compressed car models through the dev-only exporter; the generated models are already included. `npm run build` also copies third-party runtime notices into `dist/licenses/`.

`node scripts/verify-delivery.mjs --25mbps` adds browser-emulated 25Mbps download / 5Mbps upload with 40ms latency and a cold browser cache. Its separate `output/delivery-25mbps/` results are development-host network emulation, not an actual-laptop or Internet deployment benchmark.

See [architecture and tuning](docs/architecture.md), [graphics](docs/graphics.md), [road/contact layers](docs/road-layers.md), [streaming](docs/streaming.md), [traffic](docs/traffic.md), [feature status](docs/feature-status.md), [validation evidence](docs/benchmarks.md), [licenses](docs/assets-and-licenses.md), and [progress](progress.md). This is a playable development build, **not completion of every requirement in the approved plan**. Further art polish, streaming performance/endurance, broad traffic/racing stress, the full interaction/fault matrix, and target-laptop performance still need work.

## Static hosting

`dist/` is the static output. The included Vercel configuration builds with npm, revalidates the application shell and gives hashed `/assets/` files immutable caching. Select Node 24 in the authorized project's settings. Do not publish source references or the complete project directory as a static file server.

No deployment has been authorized or verified yet. Once a project is supplied, deploy a preview, test startup and driving with external hosts blocked, then promote that exact tested deployment. Keep its predecessor for rollback. The Vercel deployment guidance informed this preview-first configuration; no credentials or cloud services are required for local play.
