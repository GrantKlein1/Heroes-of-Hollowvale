# AS-2 v4 scope and shot list

Completed LOCAL art inventory, not game integration. Counts below distinguish unique art from reserved animation cells.

| Set | IDs | Unique images | Coverage |
|---|---|---:|---|
| bridge_plank | 0..3 | 4 | variants |
| cliff | 0..15 | 16 | Wang16 |
| cliff_face | 0..3 | 4 | variants |
| cobble_road | 0..15 | 16 | Wang16 |
| dirt_road | 0..15 | 16 | Wang16 |
| dungeon_floor | 0..5 | 6 | variants |
| dungeon_wall | 0..3 | 4 | variants |
| grass | 0..7 | 8 | variants |
| interior_market_floor | 0..3 | 4 | variants |
| interior_market_wall | 0..3 | 4 | variants |
| interior_tavern_floor | 0..3 | 4 | variants |
| interior_tavern_wall | 0..3 | 4 | variants |
| water | 0..63 | 61 | Wang16 +4phase shimmer; base0..15 preserved,16..63 appended |
| water_ford | 0..3 | 4 | variants |
| water_shore | 0..63 | 61 | Wang16 +4phase shimmer; base0..15 preserved,16..63 appended |

## Props — done
Pine/oak base+canopy, cottage/tavern base+roof, well, fence h/v/corner, rocks a/b, bushes a/b, crate, barrel, torch (19 retained); separate stone hearth with6-frame8fps flame (20 logical props total).

## Mandatory missing items from v3 — now done
- Animated water shimmer: standard TSJ animation for water and water_shore wet masks.
- Separate stone hearth: Blender geometry, Phaser JSON-hash atlas + animation metadata.
- Blender ground provenance: all222 cells rendered from real procedural mesh scenes; no raster texture inputs.
- Easy cosmetic variants: distinct plank grain/knots, floor cracks, wall hairlines/chips, cliff weathering.

## Reserved duplicates / remaining
Water and water_shore IDs16,32,48 duplicate dry mask0 and are intentionally reserved unused animation phase cells. Any other duplicate groups are listed in QA.
Remaining integration only: water/partial-cliff collision policy, actual Tiled/Phaser import/playtest, camera wording reconciliation, visual sign-off. No art-inventory item is silently omitted.
