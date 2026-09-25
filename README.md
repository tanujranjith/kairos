# Kairos

A single-player browser driving game built with strict TypeScript, Babylon.js and Havok. Rendering, physics, traffic, racing AI and audio run on your computer. No account, economy, multiplayer, service worker or paid asset is required.

**Local play:** http://127.0.0.1:5192/ while the production preview server is running. Nothing has been published. See the [current build and evidence](docs/final-closeout.md) and [full-plan acceptance matrix](docs/acceptance-matrix.md) for the difference between implemented systems and unverified hardware/visual targets.

## Run

Use **Node 24**, not the machine's default Node 20. Dependencies are pinned in the committed lockfile.

```sh
npm ci
npm run build
npm run preview -- --port 5192
```

For development and automated verification:

```sh
npm run dev -- --port 5187
npm run check
npm test
```

On this Windows machine, prepend the bundled runtime directory to PATH before running npm:

```powershell
$env:PATH = 'C:\Users\tanuj\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
```

Open the local URL in hardware-accelerated Chrome or Edge. Kairos prefers WebGPU and rebuilds with WebGL2 if initialization fails. Add `?renderer=webgl` to force WebGL2. Open through the local server, not by double-clicking `dist/index.html`.

## Play

Select a tuning profile in the garage, then **Free Drive** or **Motorsport**. All profiles, roads and activities are immediately available.

- Free Drive connects a 4,096 m region with roughly 35–45 km of public roads, city/suburbs, industrial yards, countryside, forest, a mountain pass, lake, highway, bridges, tunnels and service locations.
- The map offers routing/rerouting, road discovery, destination filters, four speed traps, three point-to-point trials, two drift zones and three scenic destinations. Records save locally.
- Aster International offers Practice, Qualifying, Quick Race and a practice → qualifying → race weekend. Choose 3/5/10/20 laps and up to 16 total entrants. The defaults are eight entrants, five race laps and five-minute qualifying.
- Northstar Handling Grounds supplies braking lanes, a slalom, skidpad, bumps, banking, gradient, curb and ramp.
- Weather, day/night, five cameras, driving assists, traffic density, sound and controls are configurable.

Per the user's content direction, **one original Velara S model is reused throughout**: player, showroom, traffic, parked cars and race opponents. The six garage entries are physical tuning profiles (FWD/RWD/AWD, road/GT/Formula-class parameters), not six visually different cars. Paint, wheel finish, liveries, brake bias and eligible aero setup remain customizable.

## Controls

| Action | Keyboard | Xbox-style controller |
|---|---|---|
| Accelerate / brake | W / S or ↑ / ↓ | RT / LT |
| Steer | A / D or ← / → | Left stick |
| Reverse from a stop | Hold brake | Hold LT |
| Handbrake | Space | A |
| Shift up / down (manual) | E / Q | RB / LB |
| Camera | C | B |
| Reset to road; invalidate lap | R | X |
| Map | M | Y |
| Pause | Escape | Menu |
| Fullscreen | F | — |
| Headlights | L | — |
| Developer telemetry | F3 | — |

Keyboard bindings are remappable. In menus use Tab/Shift+Tab and Enter/Space; controller D-pad/stick changes focus, left/right adjusts values, A confirms and B/Menu returns. Native save-file dialogs use the operating system's controls.

Switching tabs, losing focus through browser visibility changes or disconnecting the active controller pauses driving and clears held input. A click or key press unlocks audio if autoplay was blocked.

### Pits and services

Stay below **60 km/h / 37 mph** in Aster's pit lane. Stop in your assigned garage-side box and choose **SERVICE / PIT**; the six-second countdown restores fuel, tires and damage. Pit timing uses an ordered route and speeding incurs penalties. Free Drive service stations use the same stopped-car service action.

### Graphics

Low targets 1280 × 720; Medium, High and Ultra increase rendering quality without changing physics or rules. High adds ambient occlusion; Ultra also adds bounded outdoor screen-space reflections. Low/Medium retain the lightweight probe-based path.

Automatic selection waits for **moving gameplay**, not showroom frames. A changed recommendation applies safely when you return to the showroom. Choosing a preset disables automatic selection. Dynamic resolution can fall to 70% and recover under lighter load.

A graphics-device loss pauses simulation. WebGL2 can rebuild in place. If WebGPU cannot recover within 20 seconds, an explicit **Restart with WebGL2** action saves the profile and reloads; this is not seamless session recovery.

### Saves

Versioned IndexedDB stores settings, customization, discovery and records in this browser/origin. Export/import transfers a save to another browser, port or computer. **Reset progress** requires confirmation. Unavailable/full storage leaves play available in memory and displays a warning; unsaved progress can be lost on exit.

## Development and verification

Development builds expose `window.render_game_to_text()`, `window.advanceTime(ms)` and `window.kairos`; production builds do not. Await `advanceTime(ms)`: it suspends normal stepping and waits for collision data without advancing session clocks during loading. `window.kairos.resumeRealTime()` restores the animation loop.

Verification scripts use port 5187; production delivery checks use 5192. Playwright browser binaries must be installed. Do not rebuild watched source/assets during a running browser test.

```sh
node scripts/verify-interactions.mjs
node scripts/verify-adaptive-quality.mjs
node scripts/verify-shared-car-model.mjs
node scripts/verify-quality-effects.mjs
node scripts/verify-graphics-streaming.mjs
node scripts/verify-race-resource-lifecycle.mjs
node scripts/verify-keyboard-grip.mjs
node scripts/verify-weekend.mjs
node scripts/verify-browsers.mjs
node scripts/audit-frame-performance.mjs
node scripts/verify-delivery.mjs --25mbps
```

Additional focused tests and retained raw reports are indexed in [benchmarks](docs/benchmarks.md). Rebuild the original car assets with `node scripts/build-assets.mjs` while the dev server runs; rebuild original KTX2 assets with `npm run build:textures`. Ordinary production builds verify generated textures and copy dependency notices.

## Handoff and limits

The core local gameplay systems are implemented. The [final presentation pass](docs/final-presentation.md) corrects shared-car trim/optics, adds distant geology and forest groves, and fixes representative automatic-quality sampling. Art remains stylized; it does not reproduce the mockups' photorealism.

Development-PC tests **do not certify** performance/endurance on the separate 8 GB integrated-graphics laptop or feel/vibration on a physical controller. These remain explicit acceptance checks, not hidden passes. Synthetic audio and compact local race flags/rules are intentional documented implementations; there is no full safety-car/marshal simulation.

See [architecture and tuning](docs/architecture.md), [plan status](docs/plan-completion.md), [current closeout](docs/final-closeout.md), [feature history](docs/feature-status.md), [licenses](docs/assets-and-licenses.md) and [progress](progress.md).

## Static output

`dist/` is the self-contained static production output. The retained Vercel configuration revalidates the application shell and gives versioned assets immutable caching. **Do not publish:** the user chose local-only delivery. A future hosted release needs a newly authorized destination, preview checks and preservation of the previous deployment for rollback.
