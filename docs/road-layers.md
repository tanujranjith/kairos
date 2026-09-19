# Road layers and wheel-contact identity

`src/content/road-layers.ts` authors metre-based bridge/tunnel spans. The lake bridge keeps its authored height; the Ridgeway overpass raises the pass by eight metres above the Parkway, using 145m smooth entry/exit ramps. The former `ridgeway-parkway` at-grade junction is removed. Both roads remain connected through their other legal junctions.

Every span boundary is inserted exactly into road samples before lanes, mesh cells or navigation are generated. Road points retain `terrainY` independently from deck height. Lane samples carry the layer of their outgoing segment in both travel directions; a complete lane path may cross multiple layers without creating a fictitious turn. Progress still uses horizontal authored metres, consistent with existing lap/navigation units.

Cell asphalt remains one merged material/collider. Sorted triangle ranges identify road ID, layer and surface; Babylon/Havok's original triangle index selects the metadata for each actual suspension hit. Grip is now per tire, not inferred from the chassis centre. Wetness, wear and temperature continue to modify that contact's tire coefficient. Unclassified solid structures default to concrete, terrain to grass, submerged terrain to water, and airborne wheels report air. Visual gravel shoulders do not yet have separate gravel collision strips; their underlying terrain remains grass.

Terrain polygons are clipped against at-grade road footprints, avoiding coarse grid triangles poking through asphalt and falsely changing tire grip. Ground remains beneath bridge spans. Deck undersides follow road pitch; piers avoid the lower road's clearance. Structural objects remain collidable.

Reset and route-source selection include height. Landmark destinations have explicit road IDs and sampled height; arrivals, service and activity triggers require vertical proximity, and player activities require ground contact. Navigation cannot jump between stacked roads. [Aster's access integration](circuit-access.md) additionally connects the private road, one-way pit and circuit graph. Its bridge retains track height while grading the ground below; no junction is created at the stacked crossing.

## Evidence and limits

`tests/road-layers.test.ts` covers the separation, ramp continuity, exact span boundaries, reverse lane layers, legal detours, wrong-height arrival rejection, terrain clipping and per-triangle metadata. `scripts/verify-layers.mjs` uses actual Havok bodies and tire rays. It checks both levels before/after reset, lake/tunnel tags, grass below the deck and two-on/two-off split contact. Two 410m forward traversals use normal throttle/brake/steer inputs with no speed/pose/force correction. Both remain grounded without damage or grass intrusion; lane errors were below 0.46m. Reports and upper/lower/workshop captures are in `output/road-layers/`.

These are selected controlled-time checks, not every road at maximum speed, every vehicle/setup, arbitrary stacked intersections, traffic endurance or target-laptop certification. Span authoring currently assumes nonoverlapping, nonwrapping intervals. Broader content validation and pit/checkpoint integration remain on the full-game plan.
