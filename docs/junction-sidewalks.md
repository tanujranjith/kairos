# Signal-junction sidewalks

Westbrook's four signalized junctions now continue their road-parallel paving around each circular apron. The corner walks are generated from the same authored junction radius and road set as traffic, use 96-segment terrain-following arcs, and leave every driving approach open. They reuse the existing concrete material and merge into one visual mesh per owner cell; they add no collider or material.

Road shoulder, edge-line and straight-sidewalk strips are analytically trimmed before the apron. This replaces the former whole-segment overlap that produced concrete wedges at curved approaches. The asphalt/apron collision overlap remains, so tire support and traffic rules are unchanged.

## Verification

- Pure coverage checks all four signals, finite geometry, road clearance and exact segment trimming in both travel directions.
- Installed Edge renders the selected junction consistently in forced WebGL2 and actual WebGPU: four approaches, 24 crosswalk bands, one 140-triangle corner-walk mesh, four wheel contacts, zero damage and no streaming errors.
- Day, dusk, night, rain, 21.52 m/s city driving and three repeated city/lake streaming cycles pass on both renderers. City resources repeat at 970 meshes / 85 materials / 44 textures; lake resources repeat at 319 / 85 / 44.
- Low submission maxima remain within target: city 266 draws / 495,619 triangles, wet night 267 / 495,786, and either eight-car grid 291 / 496,846.
- The complete suite passes 243 tests in 37 files. Strict TypeScript, nineteen KTX2 assets and the production build pass (`index-DypuZvO-.js`, worker `cell-worker-D1LLTGra.js`). The supplied gameplay client reaches 10.93 m/s through throttle, steering and braking with four contacts, zero damage and no streaming failure.

This completes pedestrian-edge continuity at the four signal junctions. It is not a pedestrian-navigation system, citywide curb-height simulation, accessibility certification, target-laptop certification or hosted HTTPS acceptance.
