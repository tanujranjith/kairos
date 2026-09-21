# Chase-camera collision avoidance

Both chase cameras cast from the vehicle anchor toward their requested position against collision-group-1 world geometry. A hit places the camera 0.25m in front of the obstruction. The inward correction is immediate, so a newly encountered wall cannot remain between the camera and the car for several smoothed frames. Once the path clears, the existing exponential spring releases the camera outward without a visual pop. Cockpit, hood and bumper mounts remain unchanged.

Development text state now exposes camera mode, obstruction status, requested distance, collision-resolved distance and current smoothed distance. `scripts/verify-camera-collision.mjs` inserts a temporary physical wall across the real ray for chase and close-chase modes, captures the obstructed views, removes it, checks partial release after 100ms and full return after 1.2s, then confirms the three mounted cameras remain unobstructed.

The measured full/blocked distances are 6.555m/2.750m for chase and 4.921m/2.035m for close chase. The opened 1280×720 screenshots keep the car visible on the correct side of the wall and return to the intended framing after removal. The focused browser path records no page errors, failed requests or third-party requests.

The complete suite passes 247 tests / 38 files. Strict TypeScript, all nineteen KTX2 assets and production build `index-BchIDcA1.js` pass. Cold 25Mbps/40ms production reaches the menu in 5.352s forced WebGL2 / 4.868s automatic, transfers 10,520,622 bytes, and enters Free Drive and Northstar without page, failed or external requests. This is functional camera evidence, not target-laptop or hosted HTTPS acceptance.
