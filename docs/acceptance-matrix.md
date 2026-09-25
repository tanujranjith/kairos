# Full-plan acceptance matrix

This separates implemented software, local evidence and external acceptance. It supersedes older checkpoint TODO wording but does not turn historical reports into freshly run tests.

Scope changes explicitly requested by the user: **one shared Velara model throughout** (six physical tuning profiles remain); **local build only**, not HTTPS publication. No economy, account, multiplayer or steering-wheel support is required.

| Plan area | Implemented local scope | Evidence entry points |
|---|---|---|
| Foundation | Strict TypeScript, pinned Vite/Babylon/Havok, one canvas, WebGPU → WebGL2 fallback, local WASM/decoders/fonts/shaders, no service worker | `npm test`, `npm run build`, `verify-delivery.mjs`, `verify-browsers.mjs` |
| Vehicle simulation | 120 Hz fixed clock, four suspension contacts, combined-slip tires, drivetrains, assists, fuel/wear/temperature, wet surfaces, valid resets, Northstar handling course | `verify-physics.mjs`, `verify-keyboard-grip.mjs`, `verify-road-surfaces.mjs`, `verify-handling.mjs` |
| World | Connected 4,096 m region, 35–45 km public roads, required districts/landscapes, service locations, elevation layers, bridges/tunnels | `simulation.test.ts`, `road-layers.test.ts`, `verify-access.mjs`, regional visual scripts |
| Streaming | 256 m cells, travel look-ahead, collision-first loading gate, cancellation, resource ownership, separate circuit reservation, failure/retry | `streaming.test.ts`, `verify-graphics-streaming.mjs`, `verify-worker-recovery.mjs`, `verify-freedrive-stress.mjs` |
| Free Drive | Lane graph, signals/priority/merges/lane changes, following/recovery, default 12 physical nearby traffic cars, map/rerouting/discovery/filters | `traffic.test.ts`, `navigation.test.ts`, `verify-traffic.mjs`, `verify-navigation-reroute.mjs` |
| Activities | Four speed traps, three point-to-point trials, two drift zones, three scenic discoveries and persistent records | `activities.test.ts`, `verify-activities.mjs` (controlled placements test state/records, not uninterrupted human runs) |
| Garage/model | Live showroom, six immediately available tuning profiles, shared compressed LODs, paint/wheels/liveries/brake and eligible aero setup | `verify-shared-car-model.mjs`, `verify-shared-cabin.mjs`, `verify-interactions.mjs` |
| Motorsport | Approximately 4 km Aster circuit, sectors/grid/paddock/runoff/pits, Practice/Qualifying/Quick Race/Weekend, 3/5/10/20 laps, 4–16 entrants | `verify-weekend.mjs`, `verify-racing.mjs`, `verify-dense-pits.mjs` |
| Racing rules and AI | Ordered directional timing, track limits/invalid laps, false-start/pit penalties, local flags, classification, physical service/rejoin, input-driven passing/defending/recovery without grip bonuses | Race unit tests, `verify-race-flags.mjs`, `verify-pit-timing.mjs`, `verify-racing-tactics.mjs`, pit/fuel/retirement stress scripts |
| Presentation | Warm showroom, restrained Kairos UI, five cameras, spring/collision chase, four weather states, day/night, gradual wetness, layered original audio, four graphics presets | `verify-landscape-dressing.mjs`, `verify-quality-effects.mjs`, `verify-audio.mjs`, `verify-camera-collision.mjs` |
| Controls/saves | Remappable keyboard, Xbox-style input/menu navigation, deadzones/curves/vibration dispatch, disconnect/background pause, IndexedDB validation/recovery/export/import/reset | `verify-controller-navigation.mjs`, `verify-platform-interactions.mjs`, `verify-visibility-pause.mjs`, `verify-storage.mjs` |
| Delivery | Static production output, versioned same-origin assets, local preview, Vercel configuration retained for future authorized use, documented provenance/tuning/debugging | `docs/final-closeout.md`, `docs/assets-and-licenses.md`, `docs/architecture.md`, `docs/benchmarks.md` |

## Still not accepted as complete

- **Target hardware:** development RTX/SwiftShader measurements cannot establish the requested 8 GB integrated-laptop frame pacing, memory or endurance. Run the existing performance, resource and endurance scripts on that laptop when accessible.
- **Physical controller:** automated gamepad, disconnect and vibration-dispatch tests do not establish stick feel or motor feedback on real hardware.
- **Visual fidelity:** the game follows the lighting/composition/interface direction but its procedural assets are stylized, not a match for the mockups' photorealism. There is no claim of artistic equivalence.

These are not percentages or hidden passes. Core software completion and full original-plan acceptance are different statements. Hosting is intentionally excluded by the later user instruction, not a missing deployment to perform without permission.
