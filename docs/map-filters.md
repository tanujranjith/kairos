# World-map event filters

The full map has five accessible views: All, Activities, Scenic, Services and Motorsport. Activities contains speed traps, point-to-point trials and drift zones; Services contains the home garage and both service locations; Motorsport contains Aster International. Northstar remains available in All.

The selected filter is runtime UI state and does not change or gate content. An active destination remains visible when its category is hidden, including its chosen marker, route line and detail card. Once that route is cleared, reopening the map moves selection to the first visible item instead of retaining a hidden marker. Filter buttons are native focusable controls with `aria-pressed` state and work through mouse, keyboard and the existing controller menu navigator.

## Verification

- Pure tests prove exact membership: 17 All, 9 Activities, 3 Scenic, 3 Services and 1 Motorsport.
- `scripts/verify-map-filters.mjs` activates all five views through the rendered UI, compares every marker id, verifies ARIA state and `render_game_to_text`, activates Scenic with keyboard Enter, and confirms a speed-trap route survives the Services filter and Free Drive transition. It also clears that route and confirms the hidden selection is replaced.
- Opened All, Activities and Services-with-active-route captures at 1280×720. The first pass put filter pills too close to the heading; final spacing was recaptured and inspected.
- The integrated synthetic-controller suite now passes 23 checks, including filter activation across an Interface rerender and subsequent scenic-marker navigation.
- The complete suite passes 247 tests / 38 files. Strict TypeScript, nineteen KTX2 assets and production build pass (`index-Dwdi1_TO.js`, worker `cell-worker-D1LLTGra.js`).
- The exact production WebGL2 smoke reaches the menu in 6.183s under 25Mbps/40ms emulation, transfers 10,520,327 bytes, and completes Free Drive plus Northstar with no page, failed or external requests.

These are development-host checks, not target-laptop or hosted HTTPS certification.
