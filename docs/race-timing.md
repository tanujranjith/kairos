# Circuit and pit timing

Kairos uses physical directional line crossings, not a change in nearest-road segment, to award laps and sectors. `src/content/race-course.ts` owns the twelve circuit gates, twenty-four pit-route gates, progress anchors and shared rule constants. Every line clips the crossing by width and elevation. Crossing time is interpolated within the fixed step. Small airborne crossings count; another road layer does not.

`RaceRouteTracker` maintains each entrant's ordered pit proof. Entry must be driven forward; subsequent gates must be reached in sequence. The pit's finish line lies on the extended circuit finish plane, and two later gates supply the circuit-equivalent checkpoints before merging. Progress is continuous at entry, finish and exit and stays constant while stationary for service. Race position still clamps progress to the validated checkpoint interval.

Spawning/resetting into the middle, leaving the route, skipping gates, discontinuous movement, wrong-height crossings or reversing cannot award missing checkpoints. Reset invalidates the current lap and clears pit proof. Restart clears route and penalty state. A valid new lap can begin after an invalid completed lap; the invalid lap is never saved as a best time.

The pit limit is 60 km/h (displayed as 37 mph with imperial units); a five-second penalty applies above the small configured tolerance. It covers the tracked visit even just outside the painted lane and latches once per visit, including a brief lane departure. Adjacent main-straight cars are excluded. The HUD shows the limit during a visit, highlights overspeed, and marks an invalid pit route.

## Reproduce

Run `npm test` and `node scripts/verify-pit-timing.mjs` with the development server on port 5187 and installed Edge available. The physical rig starts at the normal race grid, drives a circuit, takes the authored entry connector, stops for ordinary service, follows the exit connector and finishes the next lap. It uses normal vehicle inputs with no position/velocity corrections. Fuel and wear are deliberately reduced only at the service stop to test replenishment. This rig is not the automatic AI pit strategy.

The report and actual pit/service/rejoin screenshots are in `output/pit-timing/`. The first late-braking test-driver failure is retained alongside the corrected trace. Assertions cover the entire sampled visit, not just the new lap's final validity. Supplemental race/weekend scripts exercise the same timing through normal session transitions.

## Remaining limitations

The independent physical visit test uses one entrant; it does not certify every contested merge or race strategy. Gate/rule tests are not a complete motorsport rulebook, performance benchmark or target-laptop acceptance. Visual service-box presentation still needs polish.

## Automatic AI pit strategy

`content/pit-plan.ts` defines a continuous circuit approach → entry connector → pit lane → exit connector → rejoin path. `sim/pit-driver.ts` decides from actual fuel use, wear and remaining race distance, then drives through normal controls and vehicle physics. It decelerates before committing, requires six contiguous grounded/stationary seconds at its assigned stop, and yields at the exit for a conservative main-track time gap. Only the runtime performs refueling/tire replacement after the controller requests completed service. No position, velocity, power or grip bonus is used by the pit controller.

The development snapshot reports phase, reason, assigned stop, elapsed service, completed stops, merge blocker and fuel-per-lap estimate. Wear-aware race inputs include a limp-home pace and additional combined braking/turning margin. Following now measures distance around bends; avoidance steers away from adjacent cars, and slow obstacle bypass is permitted when clear. Intentional queue braking no longer triggers the stuck-car reset.

`node scripts/verify-ai-pits.mjs` injects one worn-tire fault after the normal grid departure in eight-car GT and Formula practice. Both scenarios have completed a valid visit and subsequent lap, including Formula yielding at the merge, with no sampled warnings, penalties or damage. `--fault=fuel`, `--formula` and `--entrants=16` select additional scenarios; an available flag is not evidence it has passed. The selected AI's proof is not a claim that every other entrant is fault-free. Historical failed/queue traces remain in `output/`.

The assigned service stops are separated longitudinal positions on the single-file pit centerline, **not physical off-lane garage boxes**; cars queue behind service. Dense 16-car fields, simultaneous stops, service-overshoot recovery and all fuel-depletion/retirement cases remain incomplete or unverified. The conservative merge gap is not a full trajectory planner.

With the final circuit setting, both eight-car worn-tire runs re-pass, and the separate Formula low-fuel run passes including a merge yield. GT's low-fuel run completes service but fails the strict assertion because it runs wide on its opening lap (one warning/invalid lap near s249 at11s). This failure is retained, not a passing fuel-strategy certification. The normal eight-car three-lap GT/Formula races finish all entrants with zero warnings/penalties in the latest regression.
