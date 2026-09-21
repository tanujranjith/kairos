# Westbrook shelter population

Westbrook's ten existing transit shelters now each have one seated passenger and one standing passenger. The twenty figures are deterministic original geometry, not downloaded character models. Six-sided tapered limbs, eight-sided torsos, separate skin/clothing/hair colours and two authored poses give the streetscape human scale while keeping the people secondary to driving.

`content/streetscape.ts` derives each person from its shelter and assigns the actual transformed position to one 256m owner cell. `world/pedestrian.ts` generates the finite coloured mesh data. `world/streetscape.ts` merges every person in an owner cell into one non-colliding `street-life` mesh using one shared rough PBR material. The figures therefore add no character AI, animation, collision body, texture, external request or per-person draw call. They unload with ordinary detail scenery.

Pure coverage checks all twenty unique placements, one seated/standing pair per shelter, correct cell ownership, road clearance, finite geometry and a bounded 2,000–5,000-triangle total. Installed Edge on forced WebGL2 and actual WebGPU shows matching daytime close-ups and driving views. Both paths retain day/dusk/night/rain lighting behavior, normal keyboard driving at 21.52m/s with four contacts and zero damage, and exact three-cycle city/lake resource counts. The loaded city view contains eight merged street-life meshes and 3,648 submitted figure triangles.

The final Low audit records 264 draws / 495,715 triangles in city traffic and 265 / 495,882 in wet night. Westbrook Commons is 192 / 454,925; both shared-car grids remain 291 / 496,870. Every measured scene remains within 300 draws and approximately 500,000 triangles, although city and race-grid headroom is deliberately narrow.

These figures are static mid-distance ambience, not a pedestrian simulation. They do not cross roads, react to vehicles, enter buildings or claim close-up character realism. Broader lawns, sidewalk destinations and many blocks remain intentionally quiet; target-laptop frame pacing and hosted HTTPS acceptance also remain open.

The refreshed local production preview serves the final hashed bundle. Cold-cache 25Mbps/40ms Chromium/SwiftShader smoke reaches the menu in 5.626s forced WebGL2 and 4.932s automatic, transfers 10,518,921 bytes, enters Free Drive and Northstar, and records no page, failed or external request. This remains development-host localhost evidence, not target-laptop or hosted-HTTPS certification.
