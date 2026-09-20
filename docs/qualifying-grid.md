# Qualifying and starting-grid continuity

The race grid is an ordered list of **driver IDs**, independent of the identity-owned entrant array. Player identity remains `player`; names, AI indices, paint and pit assignments stay with the same opponent when its starting position changes. Physics and racing-controller parameters are unchanged.

`RaceState.grid` describes the physical grid and is included in the development text snapshot. `RaceManager.nextSession()` creates a copied `RaceSessionStart` before the application replaces its manager and vehicles. The application spawns every chassis at the slot belonging to its ID, not its registration index. Countdown position uses the same grid. Once the race starts, ordered checkpoint progress and finish classification take over.

## Rules

- Quick Race places the player at the selected position and fills other positions in registration order.
- A new weekend uses that selected order for practice and qualifying. Practice lap times do not set the race grid.
- Qualifying ranks every entrant by its best valid lap. A later invalid lap does not erase an earlier valid best.
- Equal times retain their qualifying starting order. Drivers without a valid time follow timed drivers, also in their qualifying starting order. With no valid times, the starting order is unchanged. This is an explicit Kairos tie-break rule, not a claim to implement a particular racing organization's regulations.
- Continue is available only after a completed practice/qualifying stage of a weekend. It cannot advance an unfinished session or a standalone qualifying session.
- **Restart weekend** starts fresh practice and clears timing, penalties and the earned grid. It does not silently restart only the current stage. Quick Race's **Run it again** starts a fresh race.
- Home/Free Drive/new setup cannot inherit a previous earned grid. Preferences retain the user's selected starting position; qualifying does not overwrite that choice.

## Loading and presentation

Each start captures its configuration and grid. Loading retries use that captured request, even after `prepareDrive()` has replaced the previous manager. Grid lists must contain every current entrant exactly once; duplicate, unknown or stale-field IDs are rejected before the manager changes state.

Qualifying results, the Start race button's position, the countdown HUD and actual grid use the same ranking. The results heading/actions remain in place while a sixteen-driver table scrolls internally. Previous/Next drivers buttons make the entire table accessible through the ordinary keyboard/controller menu navigator as well as the mouse wheel. Active-session HUD settings come from that session, not mutable setup preferences.

## Verification

Run the following with Node24 and the development server on5187:

```sh
npm test
node scripts/verify-qualifying-grid.mjs --output=output/qualifying-grid/final
node scripts/verify-weekend.mjs --output=output/qualifying-grid/weekends
```

The targeted browser test deliberately assigns synthetic times to reverse the field, covering eight-car GT and sixteen-car Formula, ties, no times, later invalid laps, fresh restarts, a smaller subsequent Quick Race, standalone qualifying, and a one-shot world-loading failure/retry. It reads actual Havok chassis positions against the authored grid marks before physics advances and checks driver/pit identity, stored order and displayed position. This is a session-transition test, **not proof of naturally driven qualifying times**.

The separate full-weekend test runs actual practice/qualifying laps and an AI practice pit service through normal vehicle inputs. It verifies both stored and physical next-stage grid against the preceding natural results and requires clean whole-field classification. See dated benchmark/progress entries for the latest completed runs, rather than treating script existence as passing evidence.

The retained `baseline-physical` test demonstrates the old bug: reversed qualifying results moved the player toP5, but AI still spawned in registration order. The first inspection also captured a single zero-time draw before newly created PBR materials/scenery were ready. Targeted screenshots now wait for scene readiness and repeated zero-time rendering, leaving chassis positions untouched; this does not certify a runtime shader-warmup/loading budget.

## Scope

No physics, tire grip, keyboard input, car geometry or scenery changed for this fix. This does not complete off-line pit boxes, all race-rule/strategy cases, reference-quality vehicle/environment art, hardware performance/endurance, or HTTPS acceptance. Mid-weekend save/resume is not implemented.
