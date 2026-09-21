# Local release readiness and handoff

Kairos is a playable local release candidate. The current source integrates the approved driving, world, traffic, navigation, activity, garage, customization, weather, audio, persistence and motorsport systems. Per the user's later direction, one authored Velara body and its two LODs are reused throughout; the six unlocked garage entries remain distinct drivetrain, setup and performance profiles.

## Verified locally

- Strict TypeScript, nineteen KTX2 assets, production build and 250 tests in 39 files pass.
- Garage, customization, settings, map/routing, Free Drive, reverse/reset, all five cameras, pause/resume, night, the handling course and persisted reload pass in a complete rendered browser flow.
- Confirmed progress reset survives reload. Save export/import, corrupt data preservation, genuine quota failure/recovery, closed-database writes and unavailable IndexedDB fail safely while play remains available.
- Keyboard and controller navigation are covered; real fullscreen, disconnect pause and bounded vibration dispatch pass. A physical controller motor was not available.
- Audio entry survives autoplay blocking and unlocks on the next real interaction. Engine/load, shift, transmission, road, wind, tire, impact, rain, cockpit and tunnel paths produce finite output; mute and pause reach silence.
- Automatic preset selection, manual override and dynamic resolution's 70% floor/recovery do not alter simulation state.
- A WebGL2 context loss rebuilds in place. A WebGPU device loss holds game state, then offers the documented persisted WebGL2 restart after its bounded recovery attempt.
- Installed Chrome and Edge both drive through actual WebGPU and forced WebGL2 with third-party hosts blocked.
- Selected 30-minute race endurance, maximum-speed streaming, 16-car racing/pits, wet-night traffic, handling/surface, race weekend and production delivery checks are retained in the dated benchmark evidence.

The exact audited production files include `index-BBNmaQ2P.js` and `cell-worker-D1LLTGra.js`. Under local cold-cache 25Mbps/40ms emulation, the menu is ready in 5.277 seconds forced WebGL2 and 4.852 seconds automatic, with 10,521,118 bytes transferred. Both enter Free Drive and Northstar without page errors, failed requests or external requests.

## Remaining acceptance boundary

The development machine cannot certify the 8 GB integrated-graphics laptop's 720p/30 FPS frame pacing, whole-process memory or GPU residency. Run the documented benchmark routes on that machine before calling the hardware target accepted.

No cloud project or destination has been authorized, so the included static/Vercel configuration has not been deployed or smoke-tested over HTTPS. Deployment requires an explicitly authorized project, preview-first validation and preservation of the previous release for rollback.

The original procedural cars and world are substantially richer than the initial blockout but remain stylized. They do not match the references' photorealism, and the compact racing rules/AI are not a complete real-world marshal or safety-car simulation. These are documented product simplifications, not hidden test passes.

## Handoff commands

Use Node 24, then run:

```sh
npm ci
npm test
npm run build
npm run preview -- --port 5192
node scripts/verify-delivery.mjs --25mbps
node scripts/verify-browsers.mjs
node scripts/verify-interactions.mjs
node scripts/verify-platform-interactions.mjs --output=output/final-platform-interactions
node scripts/verify-storage.mjs
node scripts/verify-audio.mjs
node scripts/verify-adaptive-quality.mjs
node scripts/verify-graphics-recovery.mjs webgl
node scripts/verify-graphics-recovery.mjs webgpu
```

Do not publish until the target-hardware and authorized HTTPS checks above are completed and their results are added to the benchmark log.
