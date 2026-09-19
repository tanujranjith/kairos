# Aster access, pit exit and navigation

Free Drive now reaches the actual Aster pit destination from Cross Valley Expressway. The private access passes beneath the west side of the circuit, climbs to the paddock gate, and joins the one-way pit/circuit network. The pit exit connects to circuit metre 840 and merges into the nearest inside lane. Returning to the expressway follows the circuit's legal direction to the west gate; navigation does not instruct a wrong-way trip down the pit.

The circuit's horizontal length remains **4,121.644m**. Its access overpass uses the original track elevation, a separate lower terrain profile and smoothly graded embankments. Both levels retain independent wheel-contact tags and reset locations. Ambient traffic is excluded from access, pit and circuit lanes. Free Drive reset now includes pit-road candidates and centres the car on one-way roads.

`RoadGraph` samples connectors at no more than two-metre spacing, retaining tight turn geometry instead of coarse sixteen-metre chords. Ordinary lane sampling remains sixteen metres. Physical verification exposed unsteerable turns at the expressway approach and paddock gate: the approach now meets the expressway more squarely, and the gate has a wider turning envelope. A pure regression requires at least a six-metre radius for all Aster connectors. This was fixed in authored geometry, without relaxing the lane-error assertion or modifying steering/grip.

The three original garage buildings have shuttered bays, framed upper/side glazing, canopies, trim and roof plant. A level asphalt working apron and painted service boxes replace the grass strip in front. Geometry is merged into existing per-cell material/collision batches; there are no new textures or per-bay draw calls. The architecture remains simplified procedural art.

## Verification

Run `node scripts/verify-access.mjs` against the local development server. It checks upper/lower/pit contacts before and after reset, drives from the expressway into the pit destination, confirms discovery/arrival, then drives from the pit through its exit, the circuit, west gate and back onto the expressway. Movement uses normal throttle/brake/steer inputs, with no force, speed or pose corrections after each scenario's initial spawn. Screenshots include the underpass, track deck, paddock, pit exit and garage bays.

The rig installs collision cells synchronously to isolate geometry. Its controlled-time traversal does **not** certify live asynchronous streaming, maximum-speed safety, real-time FPS or target-laptop performance. `scripts/inspect-aster.mjs` is a read-only geometry diagnostic. Reports are in `output/circuit-access`; measurements are retained in [benchmarks](benchmarks.md).

## Remaining motorsport work

The physical pit exit and navigation links are not AI pit strategy or a traffic-aware safe-release controller. Ordered pit checkpoints, automatic racing-AI service/rejoin, adversarial flags and dense-field tests remain separate work. Garage doors are decorative, not usable interiors; service still uses the established service interaction.
