# Rural roadside guidance

Kairos derives a continuous delineator layer from authored road progress on Lakeshore Drive, Lake Crossing, Ridgeway Pass, Pinecrest Road and Orchard Way. White posts use dark reflector bands and two outward-facing amber lenses, so their cadence gives open roads a stronger sense of scale by day and keeps road edges readable in rain, dusk and night driving.

Stations are forty-two metres apart and sit beyond the recoverable gravel shoulder. Generation excludes the first and last forty-eight metres of each route, water, bridge and tunnel spans, and protected junction sightlines. Urban streets retain their separate streetscape system; highways, circuit roads and private access routes retain their barrier treatment. Every post is deterministically assigned to the 256m cell containing its actual world position.

The posts are visual guidance, not obstacles. Their white shells and dark bands merge into the existing road-paint vertex-colour batch; amber lenses merge into the existing centerline batch. They therefore add no material, texture, light, draw call, external asset or Havok body. Road, shoulder, terrain, traffic and tire-contact geometry remain unchanged.

## Measured verification

- Full-region checks cover more than 300 finite posts, unique cell ownership, exact terrain support, approved-road membership, shoulder setback, water/junction exclusion and deterministic output. Blueprint checks prove both batches remain non-colliding and contain complete coloured geometry.
- Installed Edge/WebGL2 reviewed Lakeshore, Pinecrest and Ridgeway in clear, dusk and rain conditions plus a real keyboard drive. The drive reaches 17.024m/s with four contacts and zero damage; page errors, unexpected warnings and external requests are empty.
- The required upstream game client reached its fixed five-second click timeout while the valid startup overlay still intercepted input. The repository's loader-aware copy completed normally: 10.933m/s, four mixed Lakeshore contacts, zero damage, 12 physical plus 12 distant traffic actors and no failed cells. The screenshot and state were opened.
- Low 1280×720 development-host peaks are Lakeshore 240 draws / 292,450 triangles, Pinecrest 163 / 470,338, Ridgeway 142 / 238,327, city 210 / 459,155, wet night 211 / 459,300, GT grid 298 / 487,166 and Formula grid 281 / 484,764. These are RTX3060/Edge geometry samples, not target-laptop FPS.
- The complete suite passes 224 tests / 34 files. Strict TypeScript, the nineteen-texture integrity gate and production build pass. Cold 25Mbps/40ms installed-Edge production checks reach the menu in 7.399s forced WebGL2 and 7.049s automatic WebGPU, then enter Free Drive and Northstar without page, failed or external requests.

This is a focused rural readability and ambience layer, not final world-art acceptance. Posts are rigid low-poly geometry rather than deformable roadside hardware, reflectors use visible colour rather than a dedicated retroreflection shader, and target-laptop performance plus authorized HTTPS deployment remain unverified.

