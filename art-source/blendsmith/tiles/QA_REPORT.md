# AS-2 v4 QA — completed local art scope, not integrated

15 tilesets / 222 tile IDs; 20 logical props (19 retained + animated hearth). 1160 structural checks; 0 failures.

## Exact boundary measurements
Mismatched fraction = differing edge RGBA pixels / 32. RGB MAE measured on adjacent edge RGB channels, scale 0..255. Repeating texture is not required to have identical adjacent pixels; geometry was reviewed separately.

| Set | pairs | fraction mean | fraction max | RGB MAE mean | exact pairs |
|---|---:|---:|---:|---:|---:|
| bridge_plank | 32 | 0.18750000 | 0.40625000 | 5.87500000 | 16 |
| cliff | 128 | 0.00000000 | 0.00000000 | 0.00000000 | 128 |
| cliff_face | 32 | 0.17187500 | 0.56250000 | 5.98958333 | 16 |
| cobble_road | 128 | 0.00000000 | 0.00000000 | 0.00000000 | 128 |
| dirt_road | 128 | 0.00000000 | 0.00000000 | 0.00000000 | 128 |
| dungeon_floor | 72 | 0.11718750 | 0.43750000 | 5.90104167 | 36 |
| dungeon_wall | 32 | 0.18750000 | 0.37500000 | 7.56250000 | 16 |
| grass | 128 | 0.00000000 | 0.00000000 | 0.00000000 | 128 |
| interior_market_floor | 32 | 0.09375000 | 0.37500000 | 3.81250000 | 24 |
| interior_market_wall | 32 | 0.00000000 | 0.00000000 | 0.00000000 | 32 |
| interior_tavern_floor | 32 | 0.18750000 | 0.40625000 | 5.87500000 | 16 |
| interior_tavern_wall | 32 | 0.00000000 | 0.00000000 | 0.00000000 | 32 |
| water | 2048 | 0.00000000 | 0.00000000 | 0.00000000 | 2048 |
| water_ford | 32 | 0.00000000 | 0.00000000 | 0.00000000 | 32 |
| water_shore | 2048 | 0.00000000 | 0.00000000 | 0.00000000 | 2048 |
| cross-terrain compatible | 2432 | 0.00000000 | 0.00000000 | 0.00000000 | 2432 |

Full pair rows, per-file colours/bboxes/padding and check results are in QA_REPORT.json.

## Corrections and visual evidence
- Retained the reviewed v3 seated-roof/no-neon prop corrections; added a separate geometry-rendered stone hearth with six-frame8fps flame animation.
- Fixed independently fitted roof/base camera scales: common world pivot and PPU now used. Mesh rotation about local centres repaired. Roof rows/bundles, ridge, eaves, braces, windows, hinges, chimney are geometry. Door opening is 2.30 world units, about 83 visible pixels; original knight bbox height is 82 px including crest.
- Reopened all247 Blender source scenes (222 ground,6 hearth,19 retained props). Nine selected ground/hearth scenes were re-rendered and compared by every RGBA pixel; see source audit. This is not an engine import.
- Corrected Tiled corner-Wang index ordering; IDs preserved. Complete 1px edge AND corner extrusion. Canonical terrain boundaries eliminate original endpoint overwrite errors.
- Entire ground inventory replaced with procedural Blender mesh renders, no pixel-sheet textures. Cosmetic floor/wall variants have real mesh cracks/grain/chips; structural geometry hashes stay fixed across variants. The canonical1px perimeter is explicitly disclosed in SOURCE_PROVENANCE.json.

## Remaining limitations
- Completed local AS-2 art scope, not an integrated/approved game release. No Tiled editor/Phaser runtime import, gameplay depth-sort or collision playtest was performed.
- Local camera design remains ground12deg FROM VERTICAL and props/hero12deg ABOVE HORIZONTAL. The latest ASSET_SPEC still calls these the same angle; documentation reconciliation is an integration follow-up, not a pending local camera choice.
- Ground is now genuinely Blender mesh-rendered: 222 source scenes, zero image-texture nodes. Palette/mode finishing plus canonical1px boundaries uses sampled rendered material colours; 30x30 interiors are unmodified from the Blender-derived pixel frame. Boundary postprocessing is disclosed, not a claim of untouched raw renders.
- Water/partial-cliff collision behavior is unchanged from the previous draft: walls/cliffs coarse collides=true, other ground false. Traversal and partial-cell polygon policy remain integrator decisions.
- Wang16 binary corner masks retain inherent diagonal saddle ambiguity; this is not a47-tile blob set. Only base IDs0..15 are paintable Wang members; appended water IDs16..63 are animation-only.
- Water/shore IDs16,32,48 repeat the dry mask0 across phases and are reserved unused animation slots. Any other duplicate IDs are enumerated in tile_uniqueness rather than advertised as new designs.
- Walls/cliff-face art is intended for horizontal repetition; vertical boundary measurements are reported but not a guarantee of arbitrary vertical stacking.
- Mixed projection remains front-elevation-heavy and building/foliage detail simpler than the knight, as in the positively reviewed v3; seated geometry and no-neon corrections are retained.
- Building footprints represent map-plane depth rather than alpha rectangles; overheads have no collision. Small authored foot clearance prevents outline clipping. No new game behavior was wired.
