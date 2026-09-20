# Keyboard handling correction — September 20, 2026

Historical first correction below. The later [shoulder/braking update](surface-handling.md) adds predictive ABS, split-surface pressure control and faster surface-aware keyboard input, with fresh results and different measured stopping distances.

The user reported spinning from a slight keyboard turn at about 40 mph, in the default Velara and other cars. This was not covered by the previous AI-followed skidpad test.

## Causes and changes

- The old digital steering target approached most of the mechanical rack travel at road speeds. `core/steering.ts` now maps held keyboard input to a speed/wheelbase-sensitive cornering demand, retains parking lock, reduces the demand in wet conditions and recenters smoothly. User sensitivity still applies. Analog-controller range remains unchanged.
- Traction control used to reduce torque only after wheelspin exceeded a threshold, leaving high-powered rear tires saturated during turns. `sim/tire.ts` now budgets engine torque against the same combined-slip tire response and next-step wheel speed. Turning reduces target wheelspin. It works in reverse as well. Disabling TC or using the handbrake retains unassisted torque behavior.
- Suspension damping projected contact velocity onto the tilted chassis axis. Horizontal travel could therefore look like compression when the car pitched, pumping the body toward full droop. `sim/suspension.ts` derives compression speed from the surface-normal intersection instead. Contact point velocity is measured relative to the actual center of mass.

No tire friction constants, vehicle power specifications, artificial weight-transfer terms, lateral velocity cancellation or AI-only grip bonuses were added.

## Reproduction and evidence

Run `node scripts/verify-keyboard-grip.mjs --label=current` with the development server on port5187. The controlled rig uses actual `Input.poll`, default assists and Havok at120Hz, with only an explicit initial40mph condition. It covers six cars, left/right,150ms/500ms/1s key holds, coasting/full throttle and dry/wet asphalt (144 scenarios). A separate browser-keyboard flow accelerates naturally to40mph, turns, brakes into reverse and resets.

Before the fix, the default Velara's dry500ms accelerator-on turn reached57.74° sideslip and138.89° accumulated heading change. The same fixed-input case after correction reaches2.29° and10.91°. Across all144 cases, peak sideslip is below4.4°, all four contacts remain present and there is no damage. These are measured scripted maneuvers, not a promise that every excessive input or surface cannot cause a skid.

The repeated full physical handling suite also passes: all six acceleration runs, dry/wet/worn braking, low-speed stability, slope hold, skidpad, slalom, bank, bumps, curb, jump, barrier and empty-fuel behavior. Default-car30m/s stopping distances are49.56m dry,57.70m wet and62.89m worn. Numeric repeats matched within the suite's tolerances. No target-laptop FPS claim.

Baseline and intermediate failures are retained under `output/keyboard-grip/`. `first-fix` stopped the spins but correctly failed the four-contact requirement; `suspension-fix` fixes the contact defect. `final` contains the expanded144-case report and actual moving gameplay screenshot. The rendering/model work remains below the user's requested final quality and is a separate ongoing milestone.
