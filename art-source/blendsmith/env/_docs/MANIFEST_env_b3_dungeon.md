# Batch 3 Manifest — env_b3_dungeon

Work dir: `/workspace/blender/hollowvale/env_b3_dungeon/`  
(Plan: `env_b3_cavern/` — using Grant-directed `env_b3_dungeon`.)

## Unified hall dressing base set (1 design / type)
| Type | ID | Notes |
|------|----|-------|
| brazier | `dungeon_brazier` | reuse Batch 3 anim; `runtime/props_anim/` |
| rubble cluster | `dungeon_rubble_a` | `dungeon_rubble_b` dropped from atlas |
| pillar stump | `dungeon_pillar_stump` | new densify |
| bone pile | `dungeon_bones` | reuse |
| chain mount | `dungeon_chain_wall` | reuse |
| crate | `dungeon_crate` | new densify |
| barrel | `dungeon_barrel` | new densify |
| crack decal | `dungeon_crack_decal` | new densify; rotation via layout instance |
| debris/loot | `dungeon_debris` | new densify |

Variety = layout-instance only: `flipX`, `scale` 0.9–1.1, `tint`, and `rotation` (decals). No atlas variants.

## Props `runtime/props/dungeon_props.*` (22 frames)
| ID | Canvas | Footprint | Layer | Frames |
|----|--------|-----------|-------|--------|
| `cavern_mouth_arch` | 256×224 | none | overhead | static |
| `cavern_mouth_base` | 256×224 | (-100,-48,200,48) rect | props | static |
| `cavern_rock_large_a` | 64×48 | (-22,-16,44,16) ellipse | props | static |
| `cavern_rock_large_b` | 64×48 | (-20,-14,40,14) ellipse | props | static |
| `cavern_torch_wall` | 32×64 | (-6,-6,12,6) rect | props | static |
| `dungeon_bones` | 48×32 | (-16,-10,32,10) rect | props | static |
| `dungeon_chain_wall` | 32×64 | (-6,-6,12,6) rect | props | static |
| `dungeon_pillar_base` | 64×160 | (-14,-12,28,12) rect | props | static |
| `dungeon_pillar_top` | 64×160 | none | overhead | static |
| `dungeon_pillar_stump` | 40×48 | (-12,-10,24,10) ellipse | props | static |
| `dungeon_rubble_a` | 48×40 | (-16,-12,32,12) rect | props | static |
| `dungeon_crate` | 40×40 | (-12,-10,24,10) rect | props | static |
| `dungeon_barrel` | 40×48 | (-12,-10,24,10) ellipse | props | static |
| `dungeon_crack_decal` | 32×32 | none | floor | static |
| `dungeon_debris` | 40×32 | (-12,-8,24,8) ellipse | props | static |
| `dungeon_sealed_stair` | 64×80 | (-22,-16,44,16) rect | props | static |
| `dungeon_secret_door_closed` | 48×80 | (-14,-8,28,8) rect | props | static |
| `dungeon_secret_door_open` | 48×80 | (-14,-8,28,8) rect | props | static |
| `dungeon_stalagmite_a` | 40×64 | (-10,-10,20,10) ellipse | props | static |
| `dungeon_stalagmite_b` | 40×56 | (-10,-10,20,10) ellipse | props | static |
| `gold_pile_hoard` | 192×96 | (-80,-32,160,32) ellipse | props | static |
| `gold_pile_small` | 48×40 | (-16,-12,32,12) ellipse | props | static |

Dropped before pack: `dungeon_rubble_b` → `frames/dropped_variants/`.

## Animated (`runtime/props_anim/`)
| Atlas | ID pattern | Canvas | Anim |
|-------|------------|--------|------|
| dungeon_brazier | `dungeon_brazier_burn_down_<i>` | 64×96 | 6@8 loop |
| treasure_chest | `chest_wood_open_down_<i>` / `chest_iron_open_down_<i>` | 48×48 | 6@12 holdLast, down-only |

kit/qa.py pairs against a single props atlas (B2 pattern); brazier + treasure_chest live here.

## Ground
| Set | Tiles | Notes |
|-----|-------|-------|
| molten_floor | 64 (Wang16 × 4 phases) | outer=dungeon flagstone; wang15 collides |
| dungeon_wall_trim | 16 | face/cap/corner/doorway |
| scorched_floor | 6 variants | |

## Pairing
See `runtime/props/pairing.json` + PAIRING.md

## Layout / previews
- `layouts/molten_halls_sample.json` — densified ~50 props; base_set duplicates + instance jitter
- Gate sheet: `previews/batch3_gate_sheet.png`
- Blockout: `previews/blockout_molten_halls_native1x.png`
- Halls: `previews/batch3_halls_native1x.png`

## Freeze
`frozen_baseline` NOT updated for B3 (per densify brief).


## Mountain mouth (NEW, unfrozen) `runtime/props_mouth_mtn/`
| ID | Canvas | Footprint | Notes |
|----|--------|-----------|-------|
| `mountain_mouth_base` | 384×448 | (-120,-56,240,56) rect | mountain mass + composited frozen opening/ember |
| `mountain_mouth_arch` | 384×448 | none | overhead rim + composited frozen stalactites |

Does **not** modify `dungeon_props` / frozen cavern_mouth pair. Layout: `layouts/mouth_mtn_sample.json`. Gate: `previews/mouth_mtn_gate_sheet.png`.
