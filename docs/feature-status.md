# Feature status — working build, not acceptance certification

## Implemented, with initial checks

Six selectable physical vehicle definitions; original procedural bodies and wheel pivots; 120Hz Havok chassis and four suspension contacts; implicit combined-slip tires; gears/reverse, ABS/TC/stability assistance; fuel/temperature/wear; reset; keyboard/gamepad input; five cameras; connected spline roads with cell generation; authored circuit and pit road; traffic cars; graph-derived map and routes; activities and discovery; menu/garage/customization/settings/pause/results flows; weather/wetness/day clock; procedural audio; versioned IndexedDB save validation/import/export; development state/time hooks.

17 pure tests pass for road sampling/routing, combined-slip tire limits, ordered race timing, false starts, pit exclusion, shortcut progress, lapped classifications and save sanitization. All six cars pass controlled acceleration/ground-contact checks. Repeated 60/30/20Hz displayed-input cadences produce matching fixed-step acceleration results.

GT and Formula eight-car weekends have completed practice, qualifying, physical player pit service and three-lap race results. In the latest weekend run seven GT entrants finished and one AI entrant timed out; all eight Formula entrants finished. Both player races finished without penalties. Earlier standalone quick-race runs finished all eight cars. This is evidence of working flows, not exhaustive AI reliability.

The supplied web-game input client and supplemental browser checks exercise six-car selection, customization, map routing, driving/reverse/reset, pause, five cameras, wet-night lighting and save/reload. Corrupt-profile recovery, export/import, unavailable IndexedDB and failed writes pass separate fault checks. Installed Edge passes startup/driving with both WebGPU and forced WebGL2, with external hosts blocked. See [measured evidence](benchmarks.md) and the retained `output/` reports.

## Simplified or incomplete relative to the approved plan

- Visuals are original low-poly procedural content, not the mockups' photorealistic asset quality. Cars share body-generation topology; showroom/environment detail needs more art work.
- World generation is synchronous. Full asynchronous manifests, explicit elevation-layer routing, cancellation/reference-counted caches and racing-specific resource reservation are not complete.
- Traffic junction logic uses proximity and scheduled signals, not a fully authored directed lane/priority/merge graph. Distant traffic is not yet separated into a lightweight simulation tier.
- AI passing and defending are basic. Player pit service is physically verified, but automatic AI pit strategy, safe rejoining, dense 16-car fields and flags still need adversarial interaction tests. Rules are a compact implementation, not a complete motorsport rulebook. Pit progress is projected onto the circuit, not a separately validated ordered pit-checkpoint chain.
- A handling road exists, but the complete skidpad/slalom/curb/bank/jump validation course and quantitative acceptance suite are not yet built.
- Low uses an original environment cubemap rather than local reflection probes. Four presets have distinct resolution/shadow/density settings; automatic benchmarking, adaptive resolution and the full higher-end effect set are not implemented.
- Audio is synthesized, not recorded multi-layer automotive audio. Tunnel filtering and explicit transmission whine remain unfinished. Night headlights are working, with limited visual realism.
- Six compressed GLB templates are loaded at runtime, with procedural fallback. Both asset detail levels are exported, but distance-based vehicle LOD switching and a KTX2 pipeline remain incomplete.
- Controller input, button-based menu navigation and optional vibration are implemented, but no physical controller was available. Full select/range-control controller navigation and disconnect/reconnect coverage need completion.
- The local cold-cache download was below 30MB in initial checks; this does not establish Internet/laptop cold-start performance. No target-laptop FPS, GPU/process memory, 30-minute real-time endurance or device-loss recovery claim is made.
- Edge's two renderers were tested. Installed Chrome exited before automation connected; bundled Chromium checks are not a substitute for an installed-Chrome pass. No HTTPS destination has been authorized or deployment verified.

Do not represent this document or the existence of a menu option as proof that every acceptance criterion has passed.
