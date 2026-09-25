# Optional rendering effects

Low and Medium keep the existing reflection probes, contact shadows and photographic tone mapping. They allocate no geometry-buffer targets, SSAO pipeline or SSR pipeline.

High adds half-resolution, eight-sample ambient occlusion. Ultra uses 75%-resolution, sixteen-sample occlusion and outdoor half-resolution screen-space reflections, capped at 64 ray steps and 65 metres. Both retain the existing final HDR/FXAA pipeline. The showroom uses its planar reflection rather than reflecting the same car twice through SSR. Blended glass, rain and contact-shadow quads do not write solid geometry-buffer depth; alpha-tested vegetation still does.

`src/render/quality-effects.ts` owns creation, preset/environment transitions and disposal. It destroys the shared geometry buffer when the effects are removed. Unsupported render-target capabilities fall back to the existing local probes and expose the reason in development graphics telemetry. The original `geometry-shader.ts` registration corrects one vec3/vec4 gamma-conversion mismatch in pinned Babylon 9.27.1 WGSL. The adapter also seeds the thin AO pipeline's camera before its first frame: the upstream color-copy callback can otherwise run after a cached AO shader becomes ready, leaving the random sampler unbound in WebGPU. Revisit both narrow compatibility adaptations when upgrading Babylon. No installed dependency file is modified.

These are screen-space approximations, not ray tracing or global illumination. Reflections cannot recover objects outside the camera view. Low remains the laptop target; Ultra is not intended as an integrated-GPU acceptance preset.

Run `node scripts/verify-quality-effects.mjs` for WebGL2/WebGPU preset cycling, same-origin loading, shader-warning checks and stable return-to-Low texture counts. Inspect the saved screenshots. `node scripts/verify-graphics-recovery.mjs webgl --quality=Ultra` and the equivalent `webgpu` invocation verify interruption behavior with the expensive effects present.
