# Shoulder support, braking and keyboard response

September 20, 2026. This follows the earlier [40 mph keyboard correction](keyboard-handling.md).

## What changed

- **Physical shoulders:** rendered gravel/concrete verges now supply collision triangles with the same road ID, elevation layer and surface as their geometry. Previously the bridge shoulder could be visibly present but unsupported; ground-level shoulders contacted terrain below the rendered strip.
- **Predictive ABS:** pedal torque is limited before the next wheel step locks the tire, using actual wheel load, friction and combined-slip demand. It leaves lateral capacity when turning. The old reactive threshold allowed large lock/unlock oscillations.
- **Split-surface stability:** with ABS and ESC enabled, the high-grip wheel's brake pressure is capped by the weaker side of its axle. It does not add grip to grass or gravel. Uneven-surface braking is consequently controlled but takes longer than an asphalt stop.
- **Keyboard response:** actual wheel-contact materials now inform the digital cornering envelope. Turn-in filtering is faster (7/s versus 4.5/s) and centering is faster (12/s versus 10/s). At 200 ms the input reaches about 75% of its target, previously 59%; physical rack response still applies. Parking lock, steady road-speed demand, user sensitivity and analog-controller travel are preserved.

No tire-grip constants, vehicle power, lateral-velocity cancellation, artificial downforce or AI-only handling bonus was added. ABS and ESC remain switchable. The handbrake remains an intentional rear-wheel locking control, outside pedal ABS. Default assists are recommended for keyboard driving.

## Evidence and reproduction

Use Node 24 with the development server on port 5187:

```sh
node scripts/verify-surfaces.mjs --ids=aeris,velara,crest,nova,gtx,apex --output=output/surfaces/final-fleet
node scripts/verify-road-surfaces.mjs --output=output/surfaces/roads
node scripts/verify-keyboard-grip.mjs --label=surface-response
node scripts/verify-handling.mjs --output=output/surfaces/handling
```

The isolated physical material tests cover 48 seventy-mph stops: all six cars on asphalt, wet asphalt, grass, gravel and both orientations of asphalt/grass and asphalt/gravel splits. Each starts with a small 0.57° heading misalignment. All stop, retain four contacts and have zero damage. Maximum sideslip is 2.36° and heading departure 8.02°. Before correction, the reproduced Velara split-surface cases exceeded 62° sideslip and 100° heading departure. Baseline stop loops used forward speed; final loops correctly use total velocity, so baseline spin distances are not comparable full stopping distances.

Thirty Havok ray checks match visible shoulders, including bridge and overlapping-road layers. Sixteen normal-game real-road runs exercise both Velara and GTX on both sides: Lake Crossing shoulders, asphalt → gravel → grass, grass → gravel → asphalt, and seventy-mph split shoulder braking. All stop with zero damage and no recovery/reset. Brief wheel unloading occurs over the actual terrain step; the cars do not fall through. Final screenshots and sampled contacts/positions are retained.

Thirty-six throttle-on forty-mph turns cover asphalt, grass and gravel in both directions. The separate 144-case dry/wet keyboard suite covers 150/500/1000 ms holds, both directions, throttle/coast and all six cars; maximum sideslip is 4.59°, with four contacts and no damage. Actual keyboard acceleration, turn, brake-to-reverse and reset also pass.

The repeated Northstar suite passes acceleration, dry/wet/worn braking, slope holding, skidpad, slalom, bumps, curbs, banking, jumps, collisions and fuel depletion. Velara stops from 30 m/s in 51.20 m dry, 62.28 m wet and 68.24 m with worn tires. Conservative pressure control prioritizes stability; this is not a claim of shorter stopping distance than the previous brake model. Repeated traces agree within the existing tolerances.

These are development-host functional tests with controlled initial conditions and normal subsequent Havok/input behavior. They are not every possible road/setup/assist combination, target-laptop performance, physical-controller feel, or a guarantee against deliberately exceeding available traction. High-speed brake/steer combinations and wider terrain-route coverage remain ongoing tuning work. Car art, cockpit detail and world ambience also remain below the requested final standard.

Final delivery checks:165unit tests, strict TypeScript and production build; both complete eight-car GT/Formula weekends with physical AI service, all classified and zero warnings/penalties/damage; streaming failure/retry and resource cleanup; road-layer traversal/reset;60/30/20Hz cadence; Chrome and Edge with WebGL2 and WebGPU and all external hosts blocked. The Low development-host submission audit remains below300draws/500,000active triangles in528samples. See [dated results and limits](benchmarks.md). The local preview on5192 includes this update; reload an already-open page to use it.
