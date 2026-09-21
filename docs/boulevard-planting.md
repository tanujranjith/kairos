# Westbrook boulevard planting

Westbrook's four city corridors now pair every 36-metre lamp cadence with a raised tree planter. This increases the deterministic planter inventory from 43 to 86 and turns the previously isolated street furniture into a readable boulevard rhythm. Each bed reuses its existing stone/soil geometry, the original oak canopy and trunk, and two low-cost original grass-card tufts. No new model, texture, material, light or external asset is introduced.

The first revision retained two miniature oak canopies as shrubs in every planter. Because scale does not reduce submitted mesh geometry, the representative city reached 509,677 triangles. That revision was rejected. The final beds use grass cards around one correctly scaled oak and trunk, reducing the city sample to 487,063 triangles while preserving the visible tree line.

Fixtures remain generated from shared road-distance stations, stay outside junction mouths and other roads, and inherit cell detail/collision ownership. The existing two-light pool is unchanged: trees add no lights, shadows remain bounded by the normal nearby-caster selection, and daytime/nighttime switching follows the same lamp data.

## Verification — September 21, 2026

- Pure coverage retains 83 lamps, 19 benches, 30 bins and 10 shelters, now with **86 planters**. Every planter emits one oak trunk; all solid vertices remain at least 0.90 m outside usable road surfaces and per-cell geometry stays under the raised 5,000-triangle fixture cap.
- Installed Edge passes full day, dusk, dry night and wet night on forced WebGL2 and actual WebGPU. Opened final captures show matching tree-lined composition and correct local illumination. Ordinary city driving reaches **21.521 m/s** with no browser error; the supplied input loop reaches **10.933 m/s**, four contacts, zero damage and no streaming failure.
- Low city traffic measures **263 draw calls / 487,063 triangles**; wet night measures **264 / 487,208**. The first full-canopy-shrub trial measured **252 / 509,677** and was not accepted. All eight retained audit scenes stay below 300 draws and approximately 500k triangles.
- Three city/lake cycles repeat exactly at **956/84/44** and **319/84/44** meshes/materials/textures in the streetscape route. The two-light pool remains fixed and unassigned outside loaded city detail.
- The complete suite passes **236 tests / 37 files**. Strict TypeScript, nineteen KTX2 files and production build pass (`index-Zla7Si_9.js`, `cell-worker-4NqBEf0t.js`).
- Cold-cache 25 Mbps/40 ms local production reaches the menu in **6.268 s forced WebGL2 / 5.680 s automatic**, transfers **12,794,956 bytes**, enters Free Drive/Northstar and records no page, failed or external requests.

This is a bounded boulevard-composition pass. It does not add pedestrians, a continuous city-wide park system, photoreal vegetation, target-laptop certification or hosted HTTPS acceptance.
