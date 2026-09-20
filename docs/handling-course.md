# Northstar Handling Grounds

Open **Handling course** from the sidebar with any selected car, or follow the world-map route to Northstar Access. The dedicated entry starts without traffic; R/X resets within the pad to the braking lane. It is part of the existing region, not a separate fictional scale test scene.

## Authored layout

All dimensions are meters, with Y up. The pad spans X −2000…−990 and Z 1710…1980 at Y 18.05. Road-height profiles are shared between generated collision geometry and the validation rig. The map uses the same bounds/features.

| Section | Dimensions / purpose |
|---|---|
| Acceleration / braking | West-to-east lane, 50m markers, solid barrier at X −1250 |
| Skidpad | 35 / 55 / 70m radius painted rings; validation uses 55m |
| Slalom | Twelve non-solid cones, 38m spacing, 4.5m reference-path amplitude |
| Ride lane | Three rounded bumps: 80 / 130 / 200mm |
| Banking | 10° crossfall, 45m blended entry/exit |
| Gradient | 10% ascent/descent with a 12m-high plateau |
| Curb | One-sided 120mm trapezoidal curb |
| Launch | 12m ramp rising 1m, followed by a drop to the pad |

Cones are targets, not immovable crash obstacles. The barrier, bank, ramp, slope, bumps and curb have physical colliders. Surface selection treats the pad as asphalt; nearby scenery is excluded from the course. Terrain tiles are clipped precisely at its boundary to avoid overlap, and painted markings have a raster depth bias without moving the physical contact surface.

## Reproduce

With the development server running on port 5187 and Node 24:

```sh
node scripts/verify-handling.mjs
node scripts/inspect-handling.mjs
node scripts/web_game_playwright_client.mjs --url "http://127.0.0.1:5187/?renderer=webgl" --actions-file tests/actions-handling.json --click-selector "#start-handling" --iterations 1 --screenshot-dir output/handling-final
```

The physical suite runs at 120Hz with rendering suspended. Each scenario uses a fresh vehicle, a two-second settling interval, default assists and automatic transmission. Tests that start at speed explicitly initialize body and wheel velocities. Steering scenarios follow paths through normal steering/throttle/brake inputs, with no injected cornering forces or position corrections. Inspect `output/handling/report.json` for traces and limits, and `output/handling-visuals/` for the explicit inspection cameras. Only `drive.png` uses the normal gameplay camera.

## Measured development-host results

The table below is the original baseline, not the latest tuning. The September20 keyboard/suspension correction re-passes the full suite with measured0–100km/h times8.817/5.192/5.192/6.050/4.658/3.817s for Aeris/Velara/Crest/Nova/GTX/Apex. Default-car30m/s braking is49.56m dry,57.70m wet,62.89m worn. See `keyboard-handling.md` and the current `output/handling/report.json`; the original measurements remain for comparison.

These initial measurements are from Havok on this build, not manufacturer claims or target-laptop performance.

| Vehicle | Measured 0–100 km/h |
|---|---:|
| Aeris C | 8.52s |
| Velara S | 4.95s |
| Crest RS | 5.17s |
| Nova GT | 5.74s |
| GTX-R | 4.32s |
| Apex 01 | 3.34s |

Velara braking from 30m/s to below 0.25m/s: dry **49.73m**, full wetness **57.63m**, fully worn dry tires **63.00m**. Neutral drift over 30 simulated seconds was 0.040m. Held brakes on the 10% slope drifted 0.061m in 20 seconds.

At a 16m/s target, the 55m skidpad completed over two circuits: dry radius RMS error 0.705m, wet 1.260m. The 12m/s slalom had 0.136m RMS path error and minimum cone-center clearance 4.57m. This is path-following evidence, not a lateral-grip-limit certification.

The bump/curb runs remained stable; banking produced mean chassis roll −0.185rad (10.6°); the jump had a 0.392s airborne interval and landed on four contacts. The physical barrier stopped the car without tunneling; depleted fuel did not propel it.

`verify-handling.mjs` repeats the scenarios. Allowed inter-run differences: 0–100 times <0.05s, braking <0.25m, skidpad RMS <0.25m, banking <0.02rad, collision endpoint <0.1m. Repeatability on one browser is not a claim of cross-browser bitwise determinism.

Remaining: all-class/setup maneuver coverage, more tire-limit characterization, actual hardware driving/feel review, representative city/track performance, and polished proving-ground art. Catalog acceleration/top-speed labels are still tuning targets, not these measured results.
