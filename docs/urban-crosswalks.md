# Signal crosswalks

Westbrook's authored signal approaches now derive a six-band zebra crossing and repositioned stop bar from the same incoming lane endpoint used by traffic rules. The markings therefore inherit the road width, height and yaw instead of being hand-placed decoration that can drift away from navigation or signals.

The bands join each cell's existing white-marking mesh. They add no material, texture, light, collider, draw call or runtime request, and remain visual-only so tire surfaces and vehicle handling are unchanged. The stop bar sits before the crossing from the driver's direction; the crossing remains outside the central turning area.

## Verification

- `tests/traffic.test.ts` checks all four controlled approaches at every signal junction: six finite full-road bands, bounded between the stop approach and junction edge.
- `scripts/verify-crosswalks.mjs` loads Westbrook in installed Edge under forced WebGL2 and actual WebGPU. Both paths report four approaches, 24 bands, one shared paint mesh, 336 paint triangles, four grounded wheel contacts and zero damage. Driver and aerial captures were opened.
- The complete traffic browser suite still passes red/green departure, left/right/U-turn connectors, merge, queue, passing, obstruction recovery, physical/distant population and browser/network checks.
- Low city traffic is 262 draw calls / 487,353 submitted triangles; wet night is 263 / 487,520. The prior boulevard checkpoint was 263 / 487,063 and 264 / 487,208, so the change stays inside the approximately 500k / 300-draw target without a new draw call.
- Three region cycles repeat exactly at city 905/84/44, forest 368/85/45 and lake 319/84/44 meshes/materials/textures. Three race/home cycles return to 138/83/43 and zero cells.
- The full suite passes 237 tests / 37 files. Strict TypeScript, nineteen KTX2 assets and the production build pass (`index-oBk1swCr.js`, `cell-worker-4NqBEf0t.js`). Cold-cache 25Mbps/40ms local production reaches the menu in 6.291s forced WebGL2 / 5.736s automatic, transfers 12,795,069 bytes, enters Free Drive and Northstar, and records no page, failed or external request.

This is a targeted junction-legibility and city-detail pass. It does not turn Westbrook's large radial junction aprons into a finished pedestrian plaza, add pedestrians, certify the target laptop, or provide hosted HTTPS acceptance.
