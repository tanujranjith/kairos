# Agricultural fields and farm focal points

Five authored farm sites now carry cultivated terrain masks and original agricultural detail. Their road-relative centres and dimensions live in `src/content/rural-infrastructure.ts`. `ground-cover.ts` resolves each footprint against the authored road and writes a smooth field weight into the existing terrain vertex channels. The native GLSL/WGSL ground shader blends green and gold crop tones with narrow world-space planted rows while preserving meadow grain, lighting, fog and terrain normals.

The crop treatment is material-only: it creates no texture, mesh, draw call, light, collision shape, contact surface or runtime request. It does not move terrain or change grass friction. The masks follow streamed terrain across cell boundaries and remain absent from the coarse outer mountain floor.

Each farm also gains two original faceted grain silos with conical caps and reinforcing rings plus eight stacked hay/feed bales. Silo shells and caps merge into the existing wall and roof buffers; bales merge into the existing rural-detail buffer. Farm structures remain more than fifty metres from a public road. The extra geometry therefore adds no per-prop object, material or draw call and does not occupy the driving shoulder.

## Verification

- Pure checks cover five finite field masks, smooth falloff, terrain/contact invariants, two supported silos per farm and road clearance. The complete suite passes 226 tests / 34 files.
- Installed Edge renders all five farms in forced WebGL2 and actual WebGPU. Ten field overviews plus normal keyboard drives were opened; both paths reach 17.024m/s on four contacts with zero damage and no browser/network error.
- The required supplied client was attempted and retained no artifacts before its browser process stalled. The repository's loader-aware copy completed the same action file under installed Edge: 10.933m/s, four mixed Lakeshore contacts, zero damage, 12 physical + 12 distant traffic actors and no failed cell. Its screenshot and text state were opened.
- Three repeated city–forest–lake loops settle exactly at 492/74/44, 368/75/45 and 318/74/44 meshes/materials/textures. Three race/home cycles restore 138/73/43 and zero cells, with no retained mounted signs or grandstand detail.
- Low 720p stays within budget: showroom 187/176,416, Lakeshore 240/292,546, forest 163/470,494, mountain 142/238,483, city 210/459,155, wet night 211/459,300, GT grid 298/487,166 and Formula grid 281/484,764 (draw calls / active triangles).
- Production emits `index-CDPwHpt9.js` and `cell-worker-DIjAoBII.js`. Cold 25Mbps/40ms local smoke reaches the menu in 6.385s forced WebGL2 / 6.218s automatic WebGPU, transfers 12,974,788 bytes, and enters Free Drive and Northstar without page, failed or external requests.

These are stylized procedural fields and farm structures rather than crop simulation or photoreal scanned assets. There are no animated workers, animals, machinery, seasonal growth or harvest states. The measurements are from the development PC, not the target 8GB integrated-graphics laptop or an authorized HTTPS deployment.
