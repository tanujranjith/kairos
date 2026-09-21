# Navigation rerouting and discovery

The driving HUD reports remaining road-route length rather than straight-line distance. The calculation includes the short joins from the live vehicle position to the directed lane route and from its final node to the landmark. Development text state exposes the same metre value as `routeDistance`.

Returning from the map renders the selected destination and road distance immediately. Route or destination changes also invalidate the minimap immediately instead of waiting for its ordinary five-tick position refresh, so a newly recalculated line appears at once and a completed route disappears on the arrival frame.

`scripts/verify-navigation-reroute.mjs` selects Ridgeway Overlook through the rendered map, confirms a 2.803km initial route, moves off route to the Foundry, and lets the ordinary three-second update recalculate 4.330km of legal road from the new location. The road distance exceeds the 2.861km straight line, the minimap route changes, and Foundry Avenue is discovered. Arrival clears destination, route, distance and the blue minimap line; both the discovered road and scenic visit survive IndexedDB reload.

The opened rerouted HUD, world map and arrival captures agree with development text state. The focused path records no page errors, failed requests or third-party requests. The complete suite passes 249 tests / 39 files; strict TypeScript, nineteen KTX2 assets and production build `index-Du9sEhL0.js` pass. Cold 25Mbps/40ms production reaches the menu in 15.420s forced WebGL2 / 4.872s automatic, transfers 10,520,824 bytes, and enters Free Drive and Northstar without page, failed or external requests. These are local development-host checks, not target-laptop or hosted HTTPS acceptance.
