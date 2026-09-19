# Directed traffic and navigation

## Data and ownership

`src/content/junctions.ts` explicitly authors crossings, signal groups, priorities, merge areas and turning terminals. `LaneGraph` projects those named connections onto road splines and rejects missing roads, distant ports and incompatible elevations. It never creates a connection merely because two roads are close. The regression audit checks all same-height public-road centerline crossings against this data.

Each road section has right-hand directional lanes, a speed limit, same-direction lane-change links, and legal curved turn connectors. Connectors identify their source/target lane, turn direction, signal group and priority. The navigation graph samples these same paths into directed A* edges, with denser two-metre samples through turns. One-way pit/circuit lanes and private access are included for navigation but excluded from ambient traffic. The map's road geometry still comes from the original road definitions. Explicit elevation/contact layers are documented in `road-layers.md`; Aster connections in `circuit-access.md`.

`src/sim/traffic.ts` owns pure decisions. `src/runtime/traffic.ts` owns vehicles, visual meshes, promotion/demotion and recycling. Racing AI is separate. Nearby traffic uses the normal Havok `Vehicle` model and normal input/assist settings, without extra grip or power.

## Decisions and rules

- Decision slots are anchored to the global 120Hz clock: twelve phases give each driver 10Hz decisions. Recycling preserves its phase, avoiding decision bunching. Control frames are held between decisions.
- Protected signal groups use 12 seconds green, 3 amber and 1 all-red before the opposing group. A driver that can safely stop does so on amber; a committed crossing retains its reservation while clearing.
- Turn reservations, connector conflicts, road priorities and arrival ordering arbitrate junctions. Left turns yield to conflicting through traffic; an occupied downstream exit prevents entry. Player occupancy/imminent approach can prevent entry even when the AI has green.
- Following combines time headway, stopping distance and an immediate collision corridor. A lane change requires a clear destination lane, including rear closing speed; following then anticipates that lane while retaining immediate obstruction checks.
- Curvature and upcoming turn speed produce a braking preview. The controller validates directional endpoint passage before changing path; it cannot jump to a crossing road by nearest-point lookup.
- Normal red-light/obstruction queues are never classified as stranded. Off-road/overturned recovery is allowed only away from the player, onto clear authored lane samples.

## Physical and distant tiers

The Low default initially creates twelve physical and twelve lightweight actors. Physical reach increases with player speed and six seconds of look-ahead. Cars inside a 140m safety zone remain physical even if that briefly exceeds the density target. Distant cars follow the same lane/rule decisions but use inexpensive longitudinal motion; they do not own Havok bodies or visual meshes. Promoting a car preserves horizontal position, heading and speed, ensures its collision cells first, and checks separation. Demotion disposes its body and visual resources.

Every two seconds, off-screen distant actors can replenish a shortage 220–410m behind/to the side of the player, with separation checks. Far actors are recycled 500–1000m away. These are bounded ambient-population rules, not a persistent simulation of every citizen. Density can temporarily fall during transitions or when no clear sample is available. Junction pavement, stop/yield bars and visible light aspects are generated from the same graph. Paved aprons also have asphalt tire friction.

## Verification and limitations

Run `node scripts/verify-traffic.mjs` against the development server on port 5187, using the bundled Node24 runtime. It uses real Havok vehicles for red/green departure, left/right turns, turning around, a stationary obstruction, overtaking, a merge and resuming after obstruction removal; it also checks integrated physical/distant transitions and the actual visible signal meshes. Passing clearance uses oriented full-vehicle rectangles, not center distance alone. Results and screenshots are retained under `output/traffic/`. Pure tests additionally cover legal connectivity, crossing audits, height rejection, signal clearance, reservation conflicts, opposing lanes, rear-gap checks, blocked exits, priorities and scheduling.

These checks are development-host evidence, not a claim that all junctions are tuned, that traffic is collision-free under arbitrary player behavior, or that the laptop's AI/physics frame budgets pass. Broad multi-car junction endurance, wet/night traffic, congestion fairness and dense traffic profiling remain acceptance work. Junction art is still simplified. See `feature-status.md` for the unchanged larger completion target.
