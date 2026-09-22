# Directional sky

September 20, 2026 — verified incremental checkpoint.

The old sky repainted a 1024 × 256 equirectangular texture whenever the time bucket or weather changed. Dome UV interpolation enlarged its low-resolution cloud bands, and the night palette collapsed to nearly black after image processing. The replacement also fades both layers before its low-angle projection clamp, avoiding a separate horizon-streak defect caught by the wider handling-course screenshot.

`sky-material.ts` replaces that path with a single native GLSL/WGSL material. It normalizes the viewing direction per pixel, samples two projected cloud layers, shades their coverage/erosion, and blends a horizon/zenith gradient with sunward dusk haze. Small sun and moon discs are angular shader features rather than separate sphere meshes. Sparse procedural stars and a restrained blue-black night palette leave distant silhouettes readable. The existing scene pipeline applies exposure and ACES once.

`sky-field.ts` generates one original 512 × 512 packed periodic cloud texture at startup. Its channels encode cloud coverage, edge erosion and wisps. It has mipmaps for distant compression and no external asset dependency. Time, weather and slow cloud movement update uniforms only; no coloured-sky regeneration or texture upload is required per weather/time change. One sun definition continues to drive both visible direction and the directional light. The sun mesh/material are removed; texture count is unchanged, with approximately one-third extra mip storage for the atlas.

## Night legibility continuation — September 21

The existing directional light now reverses to the shared lunar direction after the solar light is below the horizon. Clear night uses a restrained 0.36 cool key; rain reduces that key to 0.217. Ambient and reflection-environment floors are 0.46 and 0.36, with a 1.23 night exposure. The generated shader has a lifted blue-black horizon and storm-cloud floor, readable sparse stars and a broad low-energy moon halo. Noon intensity, headlight activation and the daytime/golden-hour envelope are unchanged.

This reuses the already-budgeted sun/shadow path. It adds no lights, materials, textures, meshes, draw calls or physical effects. The pure lighting envelope is regression-tested so weather cannot accidentally remove all direct night definition or turn rain brighter than clear night.

The final installed-Edge WebGL2 and actual-WebGPU matrices each pass eight fixed-clock states, normal keyboard driving and resource cleanup at exactly 319 meshes / 75 materials / 44 textures. Clear/rain, upward-sky and moon-direction screenshots were opened on both renderers and visually match. Babylon's WebGPU KTX2 wrapper reports a placeholder 1×1 logical size even while its compressed source is ready and rendered; the verifier therefore checks the same-origin source/fallback state plus rendered parity rather than treating that wrapper metadata as decoded dimensions. WebGL2 reports the expected 512×512 internal atlas.

## Scope and limits

This is a layered sky approximation, not volumetric ray marching or a physically calibrated atmospheric scattering simulation. There are no moving cloud shadows or astronomical lunar phases. Storm fog is desaturated with the sky to avoid bright blue distant cutouts. Vehicle inputs, tire forces, terrain geometry and collision contacts are unchanged. Local reflections can naturally pick up the new sky.

Historical captures remain in `output/atmosphere/`; the current continuation is in `output/night-ambience-final-webgl/` and `output/night-ambience-final-webgpu/`. The current full suite passes 256 tests / 41 files, strict production build, both native eight-view checks and the Low geometry audit. The production preview serves `index-BYFdtviE.js`; full measurements and their hardware limitations are recorded in [benchmarks](benchmarks.md).

```sh
node scripts/verify-atmosphere.mjs --output=output/atmosphere/webgl
node scripts/verify-atmosphere.mjs --renderer=auto --output=output/atmosphere/webgpu
node scripts/benchmark-atmosphere.mjs --output=output/atmosphere/gpu
```

Use Node 24 with the development server on port 5187. The browser check covers eight lighting/weather states with the simulation clock held, resource stability, moon-direction readback, real keyboard driving and home cleanup. The GPU study is explicitly a static development-host diagnostic; it does not certify the target laptop, moving-route FPS or endurance. Final measurements belong in [benchmarks](benchmarks.md).
