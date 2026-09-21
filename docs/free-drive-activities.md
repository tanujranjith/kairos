# Free Drive activities

Redwood Valley contains the planned optional activity baseline: four speed traps, three point-to-point time trials, two drift zones and three scenic destinations. They remain optional and do not gate roads, tuning profiles or Motorsport.

Speed traps measure the physical vehicle's signed speed as an absolute km/h value, retain the fastest result, identify a new personal best and compare it with the authored target. Selecting a trap from the map arms it while stationary; the result appears only after the car moves through the trigger. Starting a new drive clears only the runtime trigger debounce, not the saved record. This prevents a trap crossed in one session from being unavailable at the beginning of the next.

The map detail panel shows saved speed, time-trial and drift personal bests plus scenic discovery state. Records and visits use the existing versioned IndexedDB profile and therefore participate in the existing save validation, export/import and reset flows.

## Verification

- Pure tests verify the exact 4/3/2/3 content counts, fastest-speed semantics, target comparison and record formatting.
- `scripts/verify-activities.mjs` opens the real game, starts every authored activity from the normal action path, loads and settles every relevant streamed destination, and verifies completion, records, visits, routes, HUD state and IndexedDB reload. Every speed target is exceeded; all three trials finish; both drift zones earn positive points and finish; all three scenic destinations are discovered.
- The activity verifier uses controlled placement between distant endpoints to isolate activity state and persistence; it is not evidence of twelve uninterrupted player-driven route runs.
- Opened captures verify the map's personal-best panel and the in-world `ARMED` speed-trap HUD. The supplied skill client separately verifies ordinary keyboard driving with four contacts, zero damage and live traffic.
- The full suite passes 246 tests / 38 files. Strict TypeScript, nineteen KTX2 assets and production build pass (`index-CBYkiIlZ.js`, worker `cell-worker-D1LLTGra.js`).
- The exact rebuilt production WebGL2 smoke reaches the menu in 6.303s under 25Mbps/40ms emulation, transfers 10,519,923 bytes, and completes Free Drive plus Northstar with no page, failed or external requests. The immediately preceding activity bundle also completed a clean eight-car GT launch/return before the final non-activity map-label guard.

These are development-host checks, not actual-laptop performance, hosted HTTPS or proof of every possible activity approach direction and interrupted-session permutation.
