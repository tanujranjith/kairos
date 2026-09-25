# Final local closeout — September 22, 2026

Kairos's planned local gameplay systems are integrated and the rebuilt local release passes the checks below. The user's overrides remain: one shared Velara body with six physical profiles, and local-only delivery. Nothing has been deployed. [Full-plan acceptance matrix](acceptance-matrix.md) separates this software handoff from unverified hardware and visual targets.

Play at **http://127.0.0.1:5192/** while the preview server is running. Refresh an older open tab. Restart with Node 24 and `npm run preview -- --port 5192`; rebuild with `npm run build`.

## Current release

- Main bundle: `index-DtFmU65y.js`; engine: `babylon-BtLuxeV9.js`; worker: `cell-worker-BYSSieaE.js`.
- Shared models: `v=7-smooth-optics`, 36,318 LOD0 triangles and 480,096 compressed bytes across both LODs.
- Strict TypeScript, all **277 tests in 46 files**, nineteen KTX2 integrity checks and production build pass. Vite's known large-engine-chunk warning remains; the measured delivery below is within the download/startup targets.
- Cold-cache local 25Mbps/40ms emulation reaches the menu in **6.050s forced WebGL2 / 5.191s automatic**, transferring **10,524,864 bytes** through Free Drive and handling-course entry. Both accelerate through the real UI, request versioned local assets, expose no development control hooks, and report no page errors, failed requests or external requests. This is Chromium/SwiftShader, not laptop or actual Internet certification (`output/delivery-25mbps`).

## Fresh verification

- Final shared-model and regional captures were opened on native WebGPU and WebGL2. Improved panel normals, lamp covers, arches and side trim, plus distant ridges/geology/forest groves, preserve the original road/collision/handling systems. See [presentation details](final-presentation.md).
- Both native renderers pass six profile selections, normal player/traffic/parked/opponent reuse and unavailable-model fallback (`output/full-plan-shared-car`). Twenty-four High/Ultra/Low effect states pass without shader errors or retained Low effect targets (`output/full-plan-quality-effects`).
- Both full eight-car GT and Formula-profile weekends pass practice, qualifying, physical AI pit service, earned starting grids and three-lap races. All eight finish with zero warnings, penalties or damage (`output/full-plan-weekends`).
- Collision-first loading freeze, worker failure/retry, three region round trips and three race/home cycles pass (`output/full-plan-streaming-fixed`). A discovered fifteen-material-per-race leak is fixed. Four dedicated race/home cycles return exactly to **142 meshes / 78 materials / 44 textures** in each native backend (`output/full-plan-race-resources`, `output/full-plan-race-resources-webgpu`). The failing before-fix report is retained.
- Full rendered menu/customization/settings/map, wet driving, pause/resume, all five cameras, reverse/reset, private handling course and persisted reload pass (`output/interaction`).
- Automatic quality rejects showroom/parked samples, restores a full-resolution gameplay baseline, preserves deferred preset application/manual override and 70% dynamic-resolution recovery (`output/full-plan-adaptive-final`). Injected intervals test policy integration, not hardware speed.
- Installed Chrome and Edge both drive with actual WebGPU and forced WebGL2, four contacts and no page/external errors (`output/browsers`).
- The supplied web-game skill's keyboard-input loop completes with **10.932653m/s, four contacts (two asphalt/two gravel), zero damage, twelve nearby traffic cars and no loading error**. Its screenshot and state were opened (`output/full-plan-release-input`); controlled-time performance counters are not a benchmark.
- Eleven Low scenes peak at **283 draw calls / 475,615.67 submitted triangles** (`output/full-plan-render-cost`). Five isolated moving Low scenes pass all frame/CPU/GPU/simulation/AI p95 budgets on the development RTX 3060. Frame p95 ranges 20.0–22.4ms; complete CPU p95 8.1–10.5ms. Full figures and earlier variability are retained in [benchmarks](benchmarks.md).

## Retained earlier evidence

These checks were not all rerun during the final landscape/model pass: 144 six-profile keyboard maneuvers (maximum sideslip 4.59°); thirty shoulder probes, 48 braking cases from 70mph and 36 off-road turns (four contacts/no damage); physical racing overtake; audio PCM/autoplay; storage failures/export/import/reset; graphics loss recovery; virtual controller/fullscreen/disconnect; selected 30-minute endurance; conservative GPU-resource and whole-process memory audits. Their reports remain in `output/` and the dated benchmark log. Handling coefficients were not changed in this final pass.

## Limits and external acceptance

Performance/endurance on the actual **8 GB integrated-graphics laptop**, and feel/vibration on a **physical controller**, remain unverified. The scenery/car are stylized, not photoreal; audio is synthesized; race rules are a compact game implementation, not a full real-world marshal/safety-car system. No exhaustive every-setup/weather/traffic-permutation certification is claimed.

Publishing is excluded by the user. The Vercel configuration is retained for a future separately authorized deployment. The five original user reference/context files remain untouched.
