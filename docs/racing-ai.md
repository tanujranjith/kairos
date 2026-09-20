# Racing AI control and verification

AI drives the same Havok chassis, suspension, tires, drivetrain and assists as the player. Its controller supplies steering, throttle and brake; it does not overwrite physical motion or gain hidden grip/power. The keyboard handling correction is a separate input path and is unchanged by this work.

## Line selection and tracking

- Reserve a fixed road-relative lane when another vehicle overlaps longitudinally now or within the prediction horizon. Keep elevation-separated vehicles out of that decision.
- Apply occupied-lane constraints after passing decisions. A later opponent in the iteration cannot cancel an earlier occupied lane.
- Release the reservation once longitudinal clearance returns. Move the next line target gradually, using elapsed simulation time rather than decision count.
- Subtract half the vehicle width and a tracking allowance at each road edge. An otherwise legal target too near a curb is unsafe when normal path-following error is included.
- Request a yaw rate from the pursuit point and compare it with the measured chassis yaw rate. Bound that correction in steering-input space. Corner pace and following-distance limits continue to control throttle/brake.

The two weakly owned per-vehicle maps hold the reservation anchor and moving target. They do not hold disposed vehicles alive. `RACE_AI` in `src/content/race-course.ts` contains lane-transition speed, overlap horizon, clearance, tracking margin and yaw-control gains. The pit controller passes its actual update interval; the test-player controller passes the120Hz step, giving the same target-transition rate at both cadences.

## Reproduced failures and rejected fixes

The original5m lateral trigger missed cars in grid lanes6m apart. They converged until physical body overlap, followed by abrupt yaw/load changes and a spin. The original low-fuel pit regression therefore failed before entering the pits. Zero recorded damage did not establish that no contact occurred.

An unanchored reservation accumulated corner-tracking drift. Instantaneous target changes after releasing a reservation also produced first-bend oscillation. A direct sideslip steering correction caused steady outward drift and was rejected. Finally, a sixteen-car GT passing sequence exposed insufficient road-edge clearance: a5.4m target offset plus ordinary tracking error placed outside wheels beyond the asphalt. Each failure and its trace/capture remains under `output/race-launch/`; no track-limit tolerance was relaxed.

## Run checks

Use Node24, the development server on5187, and installed Edge:

```sh
npm test
node scripts/inspect-race-launch.mjs --label=launch --position=4 --seconds=120 --verify
node scripts/verify-ai-pits.mjs --fault=fuel --output=output/ai-fuel-check
node scripts/verify-ai-pits.mjs --output=output/ai-tires-check
node scripts/verify-weekend.mjs --output=output/weekend-check
node scripts/verify-racing.mjs --entrants=16 --output=output/large-field-check
```

Run CPU-heavy browser simulations separately from unit timing and performance measurements. The weekend verifier drives an AI pit visit during practice, then uses the actual next-session interface through qualifying and the race. It no longer teleports a player into service as a substitute for driving there. Full-race checks reject unclassified entrants, warnings, penalties or damage in the tested normal field. The supplied input-client copy now waits for the requested menu control and exits nonzero on recorded browser/request failures; inspect its screenshot and text state, not just its exit status.

These checks do not prove every difficulty/weather/start order, simultaneous pit stops, physical controller behavior, hardware frame pacing or real-time endurance. Service is still single-file, not off-line garage boxes. Full qualifying-order preservation also needs work: the current session transition transfers the player's qualified slot but rebuilds the other grid slots in entrant-ID order. See `benchmarks.md` for dated evidence and `feature-status.md` for the unfinished overall game.
