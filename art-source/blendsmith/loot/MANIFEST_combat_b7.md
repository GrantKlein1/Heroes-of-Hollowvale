# Batch 7 Manifest — combat_b7 (loot pickups + meteor marker)

Work dir: `/workspace/blender/hollowvale/combat_b7/`  
Plan: Batch 7 Combat extras. **NOT frozen.** Cavern mouth_mtn left alone (v4 last sheet).

## Runtime
| Atlas | Path | Notes |
|-------|------|-------|
| `loot_pickups` | `runtime/loot/loot_pickups.{png,json}` | 508×92; cells 24×24 origin (0.5,0.875); collect 32×32 centre |
| `dragon_fx_extra` | `runtime/fx/dragon_fx_extra.{png,json}` | 672×48; **new** atlas — never edits `dragon_fx_v2` |

## Inventory
| ID | Canvas | Origin/Pivot | Frames@fps | Camera |
|----|--------|--------------|------------|--------|
| `loot_ruby_idle` | 24×24 | (0.5,0.875) | 6@8 loop | prop |
| `loot_sapphire_idle` | 24×24 | (0.5,0.875) | 6@8 loop | prop |
| `loot_emerald_idle` | 24×24 | (0.5,0.875) | 6@8 loop | prop |
| `loot_healing_potion_idle` | 24×24 | (0.5,0.875) | 6@8 loop | prop |
| `loot_mana_potion_idle` | 24×24 | (0.5,0.875) | 6@8 loop | prop |
| `loot_speed_potion_idle` | 24×24 | (0.5,0.875) | 6@8 loop | prop |
| `loot_collect` | 32×32 | (0.5,0.5) | 5@16 oneshot | prop |
| `dfx_meteor_marker` | 96×48 | (0.5,0.5) | 7@10 loop (700ms) | ground |

Meteor ellipse sized to impact max hit radius 32 px. Pivot centre.

## Frames
- `frames/loot/loot_<id>_idle_down_0..5.png` (36)
- `frames/loot/loot_collect_down_0..4.png` (5)
- `frames/fx/dfx_meteor_marker_0..6.png` (7)

## Source / render
- Cycles 256 CPU (`scripts/build_loot_and_meteor.py`, gem fix `scripts/fix_gems.py`); prop cam for loot, ground cam for meteor
- Collect sparkle: 4× draw + `combat_tools/pixel.py` finish (fx_common pipeline)
- Palette: `palette.json` (legacy icon colours + house FX)
- Refs: `refs/board.png` (legacy UI icons)

## Previews / gate
- `previews/gate_b7_native1x.png` — ONE gate sheet (knight + 6 pickups + collect + meteor, 3× crops, blockout inset)
- `previews/loot_*_idle.gif` / `*_strip.png`, `loot_collect.gif`, `dfx_meteor_marker.gif`
- `blockout/blockout_true_size.png`
- Motion: `reports/motion_check.json` (sway≥2 px, bob≥3 px f0 vs f4 — all PASS)

## Scripts
`scripts/{build_loot_and_meteor,fix_gems,pack_b7}.py`
