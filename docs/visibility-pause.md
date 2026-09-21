# Browser visibility pause

Kairos stops the 120Hz simulation when its document becomes hidden during driving. The transition enters the normal pause screen, clears held keyboard/controller input, zeros the fixed-step accumulator and resets the real-time frame baseline. Returning to the tab does not resume automatically: the player explicitly resumes from the same simulation clock and vehicle pose.

The pause panel distinguishes three causes:

- browser backgrounding: explains that Kairos paused and released the controls;
- controller disconnection: asks the player to reconnect or continue on keyboard;
- manual pause: reports `Drive paused.`

The reason is exposed as `pauseReason` by `window.render_game_to_text()` in development builds. The same snapshot now includes the simulation `clock`, allowing controlled tests to compare UI, state and time directly.

## Verification

`node scripts/verify-visibility-pause.mjs` runs installed Edge in forced WebGL2, blocks third-party hosts, enters Free Drive and holds the keyboard throttle until the car is moving. It then gives the document a controlled hidden state and dispatches the real browser `visibilitychange` event handled by the game.

The final September 21 result pauses at 0.608333 seconds with the same exact timestamp and position after a further 600ms wall-clock wait. The held-key set is empty. Explicit resume advances simulation time while speed falls slightly from 3.224m/s to 3.206m/s, proving the former held throttle was not replayed. A subsequent Escape pause reports the manual reason. The pause and resumed screenshots were opened; page errors, failed requests and external requests are empty.

Playwright did not make a programmatically-created second page the foreground browser tab in this environment, so the verifier controls `document.hidden`/`visibilityState` before dispatching the native event. This validates Kairos's listener and complete pause/resume chain, but does not claim an operating-system minimize automation test.

The same bundle passes 249 tests in 39 files, strict TypeScript, production asset/build validation, and cold 25Mbps/40ms production startup in 5.359 seconds forced WebGL2 and 4.820 seconds automatic with 10,520,925 transferred bytes. These measurements are local development-host/SwiftShader evidence, not the target 8GB laptop or hosted HTTPS certification.
