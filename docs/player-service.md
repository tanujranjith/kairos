# Player service

Kairos exposes the complete six-second player-service state in both the driving HUD and development snapshot. A valid stationary stop at Westbrook Service, Summit Service, the home garage, or the player's assigned Aster pit box changes the HUD action to a disabled `SERVICING · n.n s` countdown. Completion refills fuel, repairs damage, replaces tires, normalizes tire temperature, and restores the ordinary `SERVICE / PIT` action. A moving car is refused before the timer starts.

`scripts/verify-player-service.mjs` uses the rendered HUD button and the normal 120 Hz simulation. It verifies both authored Free Drive stations, a moving refusal, and box 16 during a four-car Quick Race. Mid-service screenshots confirm the countdown at all three tested locations; final state confirms fuel, damage and all four tires were restored. The report is retained under `output/player-service/`.

The focused browser path records no page errors, failed requests, or third-party requests. The full suite passes 247 tests / 38 files; strict TypeScript, all nineteen KTX2 assets, and production build `index-DY7WhfKh.js` pass. Cold 25Mbps/40ms production reaches the menu in 5.586s forced WebGL2 / 4.813s automatic, transfers 10,520,467 bytes, and enters Free Drive and Northstar without page, failed, or external requests. These are local development-host checks, not target-laptop or hosted HTTPS acceptance.

The supplied generic web-game client was also attempted. It remained live without output or artifacts for more than a minute and was terminated; it is not counted as evidence. The dedicated verifier supplies the input, rendered UI, state, network, and screenshot evidence for this change.
