# Original graphics upgrade — first substantial art pass

The September 19 passes respond to the request to move away from the blocky placeholder appearance. Cars and scenery are original generated content; the gallery adds one attributed CC0 photographic environment. There are no paid assets or external runtime requests.

- Car body lofts now have smoothly interpolated longitudinal and perimeter sections, wheel-arch clearances, undertrays, rounded mirrors, panel seams, shaped spoilers, exhaust rings and rounded tire profiles with multi-spoke rims. Both compressed detail levels were regenerated for all six vehicles.
- Paint uses linear-space color and a clearcoat layer; glass and alloys have separate optical properties. Direction-correct analytic cubemaps provide background illumination and a fallback while a real local reflection capture is prepared.
- Roads, meadows, gravel, concrete, stone and bark have original periodic albedo/normal textures. Terrain has continuous world-coordinate macro color variation; building faces have hard-edge normals, individual windows, bands and rooftop details.
- Instanced needle boughs and irregular oak branch/leaf sprays replace solid cone trees. Oaks have forked trunks rather than straight poles protruding from their crowns. Terrain, architecture and nearby vegetation receive/cast local sun shadows; cars have merged body/tire contact darkening, hidden when airborne.
- The sky has generated clouds, the mountain backdrop has a denser silhouette, and the showroom has architectural bays, plinths, ceiling lights, floor inlays and textured finishes.
- FXAA runs on all presets. Medium and above add restrained bloom; Ultra enables the pipeline's higher sample count. Density/resolution/shadow differences remain separate from physics and rules.

## Rebuild and review

Run `node scripts/build-assets.mjs` with the dev server running to regenerate the twelve GLBs. `src/render/car.ts` and `coachwork.ts` are the original mesh sources; `surface-textures.ts`, `vegetation.ts` and `lighting-environment.ts` generate the material content. `camera-mounts.ts` shares physical-scale cockpit/hood/bumper positions with the exported markers.

Run the supplied `web_game_playwright_client.mjs` for driving inputs and open its screenshot/state, then `verify-graphics-streaming.mjs` for full-UI showroom/day/city/wet-night/grid captures. New pure tests check all six car meshes/detail levels, deterministic normal maps and transferred terrain colors. See `benchmarks.md` for measured checks.

## Local reflections and runtime detail

`car-lod.ts` owns two visual rigs beneath one stable transform. Traffic and racing visuals change level with hysteresis; the physics body and its state never change. Low switches outward at 18m and inward at 14.4m; Medium/High/Ultra use 60/80/110m outward thresholds and 80% inward thresholds. The player remains full detail. Both GLB libraries are loaded; customized liveries use equivalent generated rigs. Wheels update on both rigs so suspension/rotation do not snap on a switch. Hidden geometry remains resident; it does not create draw calls. Typical distant car geometry is about one third of its detailed counterpart.

`local-reflections.ts` owns a double-buffered mipmapped local capture for player paint/glass. Low uses 128px faces, a two-second regular update limit, at most 16 source meshes and 16,000 source triangles per face. Movement, weather, time and arriving scenery invalidate it; showroom changes and large teleports request a fresh capture immediately. Higher presets raise capture limits/resolution. Only one face receives geometry/clear work per displayed frame. The previous complete cube remains visible until all six replacement faces are ready; presets dispose both old buffers. Cubic box projection approximates local parallax; mipmaps approximate rough reflections, not full GGX prefiltering. Diffuse ambient coefficients remain authored, avoiding asynchronous readbacks racing texture disposal. Cars/contact shadows are excluded from capture to prevent feedback; world materials retain the analytic environment. The first capture explicitly updates world bounds so it contains the actual showroom instead of just the sky. Small decorative floor seams do not consume the local capture budget.

`verify-render-detail.mjs` checks both asset/procedural rigs, resource cleanup, probe feedback exclusion, initial architecture capture and preset target disposal, plus driving/day/wet-night/race screenshots. `audit-render-cost.mjs` measures draw submissions on installed Edge and labels the actual adapter. Its controlled-time submission timings are not real-time frame pacing or target-laptop certification.

## Still below the finished art target

This remains procedural, stylized game art, not the reference images' photorealism. Car families share topology; interiors, glazing, liveries, building variety, roadside dressing, terrain blending, water and vegetation silhouettes need further art direction. The local probe covers a bounded subset of nearby scenery; AI reflections remain analytic. KTX2 compression, broader quality tuning and actual 8GB laptop performance acceptance remain incomplete.

## Sculpted coachwork and gallery pass

The five enclosed cars now use continuous shaped body panels, separate crowned roofs and bowed/tinted glazing, rolled fender apertures, inset lamp housings/LED guides, flush handles, grilles, sills, visible bolstered seats, instrument bezels and a roof liner. The visual roof now matches the vehicle definition's height instead of exceeding it by roughly 18cm. Formula retains its existing open-wheel body. Lower-cost tubular rim rings replace dense torus grids on every car; the twelve GLBs were rebuilt. Livery meshes and fallback cars use the same source. No vehicle forces, collision dimensions, AI or race rules changed.

The gallery has clear architectural bays, a lower presentation camera, a polished floor and a 512px blurred planar reflection containing only visible cars and ceiling softboxes. The floor itself is excluded, and the list is empty outside the gallery. This extra pass is confined to menus. It is not a screen-space reflection effect or a full ray-traced lighting system.

[Fish Eagle Hill by Greg Zaal / Poly Haven](https://polyhaven.com/a/fish_eagle_hill) supplies the CC0 photographic view and prefiltered ambient light. `scripts/build-environment.mjs` converts the retained 2K source HDR into a 512px-per-face GGX-prefiltered RGBD `.env` file (4,726,025 bytes). The 7,168,833-byte source stays outside `public/` and does not ship. The license, checksum and build recipe are recorded in the provenance inventory. A generated landscape remains available if the optional environment request fails; that failure is explicitly browser-tested.

Roadside grass uses seeded alpha-tested cards/instancing, without collisions or extra shadow passes. The lake now follows an elliptical outline with subtle periodic normal-map motion tied to simulation time, instead of a rectangular flat slab. Surface stone noise is restrained to avoid the former contour-like floor pattern. Detailed art/camera/fallback captures are in `output/art-pass`; `verify-art-pass.mjs` supports `KAIROS_BROWSER=msedge` for hardware rendering. Open actual captures when reviewing—successful state checks alone do not establish visual quality.

## Environmental graphics continuation

`src/world/architecture.ts` now produces five original architectural families: brick storefronts with selected balconies, limestone blocks, setback offices, pitched-roof factories with loading shutters, and suburban houses. Cornices, parapets, canopies, rooftop equipment, sills and glazing are merged into the existing three per-cell material groups. Vertex colors give each family its own palette without one material/draw call per building. Occupied/unoccupied windows share an eight-byte two-pixel emission atlas; a time-of-day uniform fades selected panes on at dusk. They are emissive surfaces, not additional local lights. Full building-footprint setback avoids placing their walls across roads. Factory heights no longer accidentally use the overlapping city-height rule.

City streets receive flush visual pavement and expansion joints. These are deliberately not raised collision curbs. Buildings have updated matching collision meshes; suspension, road surfaces, vehicle forces, navigation and race rules are unchanged.

`src/world/landscape.ts` supplies continuous nonperiodic meadow tint and a multi-scale outer mountain range with continuous height-field normals. The combined 33,032-triangle backdrop also retains recessed coarse ground inside the valley, avoiding sky holes beyond loaded cells. The former backdrop used 55,778 triangles. It is visual-only; it does not change drivable terrain elevation or wheel contacts. Fine grass/concrete texture contrast is reduced to avoid obvious repeating blotches.

`src/render/atmosphere.ts` supplies the generated 1024×256 directional sky and cloud field, with clear/cloudy/overcast/rain and time-of-day variation. No photographic world sky, volumetric clouds, screen-space global illumination or new remote asset has been added. This pass remains stylized; detailed street blocks, more irregular vegetation/dressing, authored mountain geology and the mockups' visual fidelity remain unfinished.

Use `scripts/verify-scenery.mjs` for seven region/weather/light captures and a separate architecture camera study. The latter is an inspection view, not a gameplay location. It verifies contacts, sky/mountain/worker buffers, night emission and absence of external requests. Run the supplied input client with `scripts/scenery-input.json` and open its screenshot/state after meaningful edits. See the newest benchmark section for regression and submission evidence.

## Roadside presentation and coherent lighting

The next pass lowers and brings in the chase cameras, gives asphalt a finer one-metre texture repeat and reduced grain contrast, and adjusts meadow/gravel scale. Grass clumps are narrower and taller; rural scenery density rises. Low keeps its previous urban density after the first expanded-city sample exceeded the triangle budget. Service/garage sites use original workshop pavilions with framed reception glazing, timber battens, slatted doors, a canopy, planters and a paved terrace. All use the existing shared cell material groups, with no new per-building light or reflection pass. Redundant time-trial/drift billboards near the garage are removed; their activities remain in the map/HUD.

A shared solar model drives the sky, visible sun, directional light and fog warmth. Golden-hour lighting has a genuinely lower sun instead of retaining a midday angle. Sky azimuth is mapped to the sphere's actual orientation. The first review showed excessive haze; the density was reduced after screenshot inspection. This is an authored lighting cycle, not astronomical location/date simulation or volumetric atmosphere. Night/readability and richer natural scenery still require further art review on the target display.

The simultaneously added overpass/contact work changes road geometry and actual contact selection; those physical changes are documented separately in `road-layers.md`, rather than attributed to this visual-only material/camera pass.
