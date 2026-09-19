# Circuit and pit timing

Kairos uses physical directional line crossings, not a change in nearest-road segment, to award laps and sectors. `src/content/race-course.ts` owns the twelve circuit gates, twenty-four pit-route gates, progress anchors and shared rule constants. Every line clips the crossing by width and elevation. Crossing time is interpolated within the fixed step. Small airborne crossings count; another road layer does not.

`RaceRouteTracker` maintains each entrant's ordered pit proof. Entry must be driven forward; subsequent gates must be reached in sequence. The pit's finish line lies on the extended circuit finish plane, and two later gates supply the circuit-equivalent checkpoints before merging. Progress is continuous at entry, finish and exit and stays constant while stationary for service. Race position still clamps progress to the validated checkpoint interval.

Spawning/resetting into the middle, leaving the route, skipping gates, discontinuous movement, wrong-height crossings or reversing cannot award missing checkpoints. Reset invalidates the current lap and clears pit proof. Restart clears route and penalty state. A valid new lap can begin after an invalid completed lap; the invalid lap is never saved as a best time.

The pit limit is 60 km/h (displayed as 37 mph with imperial units); a five-second penalty applies above the small configured tolerance. It covers the tracked visit even just outside the painted lane and latches once per visit, including a brief lane departure. Adjacent main-straight cars are excluded. The HUD shows the limit during a visit, highlights overspeed, and marks an invalid pit route.

## Reproduce

Run `npm test` and `node scripts/verify-pit-timing.mjs` with the development server on port 5187 and installed Edge available. The physical rig starts at the normal race grid, drives a circuit, takes the authored entry connector, stops for ordinary service, follows the exit connector and finishes the next lap. It uses normal vehicle inputs with no position/velocity corrections. Fuel and wear are deliberately reduced only at the service stop to test replenishment. This rig is not the automatic AI pit strategy.

The report and actual pit/service/rejoin screenshots are in `output/pit-timing/`. The first late-braking test-driver failure is retained alongside the corrected trace. Assertions cover the entire sampled visit, not just the new lap's final validity. Supplemental race/weekend scripts exercise the same timing through normal session transitions.

## Remaining limitations

Automatic AI pit decisions and approach control still need integration with a proper entry route, service-box selection and traffic-aware safe rejoining. The physical visit test uses one entrant; it does not certify a contested merge, a dense field or race strategy. Gate/rule tests are not a complete motorsport rulebook, performance benchmark or target-laptop acceptance. Visual pit signs, service-box presentation and track surroundings still need polish.
