# env_b4_wilderness — Gate C sample (Batch 4a), 2026-11-09

Built on kit v1.0 (imported read-only). v5 (`tiles_as2_v5`) is the style baseline and was only read. Draft, not runtime-accepted.

| ID | canvas | footprint (feet-relative px) | tall / layer | frames@fps |
|---|---|---|---|---|
| tree_dead_base | 144x160 | ellipse (-12,-12,24,12), collides | false / props | static |
| tree_dead_canopy | 144x160 | none | true / overhead (paired with base, pairing.json) | static |
| stump_charred | 48x48 | ellipse (-10,-8,20,8), collides | false / props | static |
| ash_ground | 16 tiles, 32 px, Wang corner (NW1 NE2 SW4 SE8, set bit = ash) | outer terrain = v5 grass pixels; id 0 == v5 grass 0 | - | static |

- Runtime: `runtime/props/wild_props.{png,json}`, `pairing.json`, `PAIRING.md`; `runtime/ground/ash_ground.{png,tsj}`
- Layout: `layouts/wilderness_edge.json` (16x11 tiles, wall-less, ground.corners map). Blockout: `blockout/` (greybox atlas from the same models, EEVEE 1 sample) → `previews/blockout_native1x.png`
- Gate sheet: `previews/gateC_gate_sheet.png` (native 1x + blockout inset + 3 crops at 3x + callouts 1-3); scene: `previews/gateC_native1x.png`
- Refs: `refs/board.png`. Palette: `palette.json` = v5 (51 keys) + ash_lt, ash, ash_dk, char_lt, char, soot, ember_dim
- Render: `scripts/render_b4.py` (MODE=greybox|final; 1 Blender process, 2 threads, EEVEE 16 final). Provenance: `reports/render_provenance_final.json`. Packing: `scripts/pack_b4.py` (kit.pack). Scene: `scripts/scene_b4.py` (kit.scene plus an outdoor ground painter)
- QA: `python3 kit/qa.py <this dir> --out reports/qa_gateC.json`

Kit notes for v1.1 (kit not edited this job):
1. `vocab.beam` rotates verts that were already translated about the world origin, so off-origin beams land in the wrong place. This batch uses a local fix in render_b4.py.
2. `scene.room/blockout` are interior-only (wall band, no Wang map). This batch patches them at runtime in scene_b4.py. Native support for `ground.type: wang_corners` is needed.
3. `qa.py` frozen check fails any batch that isn't in frozen_baseline.json and then skips the other-tree guard. For new batches it should run the guard on every frozen tree. It also writes to kit/reports by default, so pass `--out`.

## Gate C revision (2026-11-09)
- Dead tree silhouettes unchanged (Grant-approved).
- Ash palette darkened (warm charcoal); softer mottling, fewer hard light flecks; soot fringe kept.
- More ember seams on trunks/stumps; ash ember flecks with baked halo (below Batch 3 lava brightness).
- New batch palette keys: ember_halo, cinder, ember_core. Frozen palettes untouched.

### Rev2 (Grant feedback)
- Ash: soft continuous body + low-contrast ash_mid drifts (no 2x2 cell grid, no tile-baked embers).
- Embers: 8 sparse scene props (3 cinder_patch + 5 ember_fleck) across the 512x352 sample only.
- Stumps: 1–2 camera-facing glowing seams each.
- Trees / grass fringe / darker ash value kept.

### Rev3 (Grant feedback)
- Ash: world-space soft drifts in scene_b4 (multi-tile wind streaks + charcoal pools + sparse flecks); Wang tiles stay seamless base; no 32px repeat.
- Cinders: 24x24 patches, ~5–8px core, yellow-orange hot centre (ember_lt), 2px halo; max lum ~170 < B3 lava ~237.
- Ember count still 8 scene-placed (3 cinder + 5 fleck). Trees/stump seams/grass fringe kept.
- Angular diagonal ash boundary = Wang outer edge of the sample corner map (not a modelling error).

### Rev4 (blocker fix — honest runtime drifts)
- Removed preview-only `soft_ash_drifts` paint from scene_b4; preview is straight tiles+props composite.
- Shipped 4 runtime ground-decal sprites in wild_props atlas: ash_drift_streak_a (112×48), streak_b (96×40), pool_a (80×64), pool_b (128×80). depth `ground decal`, meta.anchor (0.5,0.5), feet pivot (0.5,1.0) for QA, footprint none / no collision.
- Soft look: ≤2 palette steps from base ash (#4a453f) — light streaks use ash_soft (#56514b), dark pools ash_mid (#3f3b36); ragged/dithered edges; no outlines.
- Layout places all 4 decals; embers (3 cinder_patch + 5 ember_fleck), trees, stumps, fringe, Wang boundary unchanged from rev3.
- Optional Wang internal mottling: sparse ash_mid flecks on solid ash tiles; seams still clean (QA seams ✓).
- Honesty: `gateC_honest_runtime.png` byte-identical to `gateC_native1x.png`; gate-sheet main view matches native once callout ink is excluded.

## Batch 4b (frozen 2026-11-09)

Look = Gate C rev4. New atlases/tilesets only; Gate C frozen outputs untouched.

| ID | canvas | footprint | notes |
|---|---|---|---|
| forest_floor | 8×32×32 | — | emberwood interior fill variants (`runtime/ground/forest_floor.{png,tsj}`) |
| ash_fill | 5×32×32 | — | full-ash fill interchangeable with Wang-15 (`runtime/ground/ash_fill.{png,tsj}`) |
| stump_mossy | 48×48 | ellipse (−10,−8,20,8), collides | one design; variety via flip/scale/placement |
| log_fallen | 96×48 | rect (−28,−8,56,14), collides | |
| mushroom_cluster | 40×40 | ellipse (−8,−6,16,10) | |
| fern | 40×56 | ellipse (−6,−4,12,8) | one design (no fern_a/b) |
| flowers | 32×40 | none | one design (no flowers_a/b) |
| rock_ash | 48×40 | ellipse (−12,−8,24,12), collides | one design (no rock_ash_a/b) |
| ember_vent | 48×48 ×4 @ 8fps | ellipse (−10,−8,20,12), collides | own atlas `runtime/props_anim/ember_vent.{png,json}` |

- Props atlas: `runtime/props_4b/wild_props_4b.{png,json}` (new props only)
- Reused frozen: tree_dead_*, stump_charred, ash_ground Wang16, ash_drift_*, cinder_patch, ember_fleck
- Layout: `layouts/wilderness_4b.json`
- Gate sheet: `previews/gateC4b_gate_sheet.png` · native: `previews/gateC4b_native1x.png`
- Honesty: native ≡ honest_runtime byte-identical; gate main ≡ native after callout ink stripped
- Freeze: Gate C sample frozen 2026-11-09 (outputs narrowed to Gate C prefixes). **4b frozen** 2026-11-09T11:38:28-06:00 (Grant approved 4b including lush forest floor on Nov 9).
