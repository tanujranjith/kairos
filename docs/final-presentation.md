# Final landscape, shared-model and quality-selection pass

The September 22 full-plan follow-up keeps one shared Velara body and local-only delivery. No tire coefficient, suspension force, brake balance, road elevation, collider, race rule or traffic policy was changed.

## Landscape

`world/landscape.ts` gives the existing visual-only outer range more subordinate ridges and gullies. Redistributing its grid from 384 × 40 to 256 × 60 keeps exactly 30,720 mountain triangles while increasing radial detail. The recessed distant valley floor remains intact.

The outer branch of `GroundMaterial` shades woodland foothills, rock strata and broken snow deposits in world coordinates. It shares the existing ridge draw, texture and fog. The playable-ground branch is unchanged. GLSL and WGSL use the same generated equations.

`world/horizon-forest.ts` places 1,600 deterministic distant firs in groves beyond the driving region (at least 2,600 m on either world axis). `render/horizon-forest.ts` uses two crossed cards per tree, one original atlas, one material and one mesh: 6,400 triangles, no collision, no shadow-caster pass and no per-frame geometry updates. They follow world visibility and remain scene-owned rather than accumulating across streaming transitions.

## Shared car

Clipped decals now interpolate the continuous body's vertex normals. Previously each clipped polygon recomputed a flat normal, turning reflective headlamp covers into visibly separate facets. Clear covers have restrained, alpha-scaled reflection and dark transparent tint applied consistently after GLB import and procedural creation. Transparent covers no longer cast opaque shadows.

Removed the extra painted wheel-arch tube that intersected the aperture. The recessed liner and original physical/visual wheel positions remain. Side moulding conforms to the skin instead of floating as a bright rod. Exported LODs retain camera mounts, wheel/steering pivots and the named disabled collision-shape metadata. Model fingerprint: `7-smooth-optics`.

The final streaming regression caught a material-lifetime defect introduced by the hidden collision metadata: drawing correctly excluded that mesh, but material disposal incorrectly used the same filtered list. Each eight-car race retained fifteen cloned default materials (one player plus two LODs for each opponent). Instance ownership now includes all cloned mesh materials, even when hidden; static parked cars still retain their shared library materials. A focused four-cycle verifier records exact identities/counts and asserts no mesh, material or texture growth.

## Representative automatic quality

The previous selector could finish its benchmark in the showroom. It now waits for grounded driving above 5 m/s with no loading or transition, restores full requested resolution, skips 30 warm-up frames and samples 120 displayed frames without changing resolution during measurement. This prevents a reduced-resolution sample from recommending an overly costly preset. It includes the world and traffic actually being played; it is not a comprehensive fixed-route hardware certification. Settings explain the waiting state. A suggested different preset applies on returning to the showroom; it cannot reload cells mid-race. Manual preset override and the 70% dynamic-resolution floor remain. Dynamic adaptation resumes after the benchmark; the resolution decision is applied independently of a deferred preset decision.

`verify-adaptive-quality.mjs` explicitly rejects showroom/parked samples, accelerates using real keyboard input, verifies scenery/traffic are present, injects frame intervals to exercise the policy and confirms deferred application plus manual override. Injected timings are labelled as integration evidence, not measured hardware performance.

## Evidence and limits

Pure geometry/material/policy tests, matched car close-ups and regional screenshots cover the implementation. Current release results are in [final closeout](final-closeout.md), with raw reports under `output/`. The first opaque-looking lens iteration is retained as a diagnostic comparison rather than counted as final visual acceptance.

The scenery and car are original stylized assets. This improves visible artifacts and background structure; it does not establish reference-image photorealism. The actual 8 GB laptop and physical controller still require tests on those devices. No website has been published.
