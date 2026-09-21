# Single-surface architectural panes

## Problem and implementation

The original modular-building generator represented every repeated upper-story window as a six-faced shallow box. Only the exterior face was useful at driving distance; the inner face sat effectively coplanar with the opaque wall, and the four edge faces were hidden by the proud frame. Each pane therefore submitted twelve triangles where two were sufficient.

`buildArchitecture` now emits one outward-facing quad for each repeated pane. Winding is explicit for the front, rear, left and right elevations so Babylon’s normal back-face culling remains enabled. The existing proud frame and sill geometry, pane size, deterministic tint, occupied/unoccupied emission UV, building massing and ground-floor openings remain unchanged. The helper still appends to the same cell-owned glass buffer and introduces no mesh, material, texture, light, collider or runtime request.

## Visual result and limitation

Forced WebGL2 and native WebGPU screenshots were opened at Cedar Square, Market Court, Harbor Exchange, Westbrook Campus and during normal road driving. Every exterior elevation keeps visible windows and the authored band-window buildings are unchanged. The old box volume is gone without creating culling holes or missing side elevations.

This optimization does **not** remove the remaining stylized light/dark variation on legacy pane-grid towers. That variation survives with single surfaces and is therefore a glass/material/reflection art issue rather than proof of overlapping pane geometry. It remains future work and is not represented as fixed here.

## Measured evidence

- Sampled structure geometry falls from 33,650 to 25,550 triangles at Cedar Square, 36,930 to 27,290 at Market Court, 41,930 to 29,370 at Harbor Exchange and 14,866 to 11,466 at Westbrook Campus.
- The Low city sample falls from the immediately preceding 210 draws / 464,507 triangles to **218 / 428,325**; wet night falls from 211 / 464,674 to **219 / 428,492**. Draw maxima include two reflection-face captures in the city sample instead of one and remain below the 300-draw ceiling. Against the pre-background-office 491,399-triangle city sample, the two checkpoints together recover **63,074 triangles**.
- Unaffected Low samples remain showroom 187 / 176,416; Lakeshore 240 / 292,546; GT grid 298 / 487,166; pit 121 / 308,204; circuit 146 / 238,909; Formula grid 281 / 484,764.
- The supplied loader-aware input reaches 10.933m/s with four mixed contacts, zero damage, 12 physical + 12 distant traffic actors and no failed cell. Its screenshot and state were opened.
- Forced WebGL2 and actual WebGPU retain four `Concrete` contacts at all four plazas and normal keyboard driving at 19.325m/s. Page/network errors are empty.
- Three city/forest/lake streaming loops repeat exactly at 496/74/44, 368/75/45 and 318/74/44 resources. Three race/home cycles return to 138/73/43 and zero world cells.
- Strict TypeScript, 231 tests / 36 files, all nineteen KTX2 files and the Node24 production build pass. Exact chunks are `index-DUXjTamo.js` and `cell-worker-wmMV49N6.js`.
- Cold-cache 25Mbps/40ms local production reaches the menu in 6.312s forced WebGL2 and 6.186s on the automatic renderer request, transfers 12,977,785 bytes, and enters Free Drive plus Northstar without page, failed or external requests. These are development-host samples, not target-laptop FPS, actual Internet or authorized HTTPS evidence.
