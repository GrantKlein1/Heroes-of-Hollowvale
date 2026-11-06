# Blendsmith AS-2 v4 — completed LOCAL art scope / DRAFT integration status

This package finishes the existing AS-2 art inventory, including animated water and a separate stone hearth. It is NOT game-integrated or approved for PR/push/merge. Expected destination only after authorization: `art-source/blendsmith/tiles/`.

## Contents
15 ground PNG/TSJ pairs, 222 tile IDs (126 existing IDs plus 96 appended water-animation cells), 19 retained village props and one animated hearth. Existing names and tile IDs are unchanged. See MANIFEST.md and SHOT_LIST.md for inventory, sizes, anchors and reserved IDs. QA_REPORT.md / QA_REPORT.json contain full pixel/metadata/seam measurements. SOURCE_PROVENANCE.json records source reopen/rerender evidence and actual finishing changes. Palette is included as palette.json.

## Genuine Blender ground provenance
All222 ground cells are NEW FAST EEVEE renders of procedural mesh surfaces, tufts, cobbles, plank courses, rock slabs, obsidian bricks and geometric wave ribbons. There are zero image-texture nodes or v3 pixel-sheet inputs. Every ground cell has a retained .blend scene in the separate source archive. Ground is rendered4x, mode/palette/binary-alpha finished, then gets an explicitly disclosed1px canonical perimeter from actual rendered material samples. The30x30 interior remains byte-identical to its Blender-derived pixel frame; maximum changed perimeter fraction is recorded in QA. This is not a claim of untouched raw rendering. Nine sample source scenes were rerendered with zero differing RGBA pixels; all247 scenes reopen successfully.

## Camera / scale / lighting
Ground: **12 degrees FROM VERTICAL**. Props and existing knight: **12 degrees ABOVE HORIZONTAL**. These are different angles, the already selected local design. No further camera choice is pending. The repository ASSET_SPEC wording still needs documentation reconciliation before integration.
Grid32x32, fixed36.9230769 PPU. Ground EEVEE4 samples/2 threads, retained props EEVEE8 samples, new small hearth/flame EEVEE32 samples/2 threads. Shared key/fill rotation and palette. This is a2D Phaser/Tiled handoff, not an isometric/3D game conversion.

## Tiled / water animation
32px cells, margin1, spacing2, complete1px extrusion including corners. TSJ image paths are relative basenames. Wang16 corner bits: NW1 NE2 SW4 SE8. Standard Tiled wangid order is edgeN,cornerNE,edgeE,cornerSE,edgeS,cornerSW,edgeW,cornerNW; corner sets use edge0. Only IDs0..15 are paintable Wang members.

`water` and `water_shore` preserve IDs0..15. Each wet base ID1..15 has standard Tiled `animation` entries: tileid=i, i+16, i+32, i+48; duration160ms each (640ms loop). Additional IDs16..63 are animation-only. Dry mask0 stays static; IDs16,32,48 intentionally repeat it as reserved unused phase slots. Frozen shared perimeter ensures even different animation phases remain edge-compatible. No new loader behavior was invented or wired.

## Phaser props and hearth
`props/village_props.json` retains19 frame names, canvases, pivots and collision metadata from reviewed v3. Frame pivot/meta.origin=(0.5,1.0). `meta.props[name]` describes footprint, tall/layer. Pairing is in props/pairing.json and props/PAIRING.md: identical placement coordinates for base/roof and trunk/canopy. Keep frames UNTRIMMED; never infer offsets from alpha bboxes. Small transparent foot clearance is intentional.

`props/hearth.json` is a separate JSON-hash atlas with six96x96 frames named hearth_burn_down_0..5. `meta.anims.burn`: frames6, fps8, looptrue, directions[down], frameNames=hearth_burn_down_<i>. `meta.origin`=(0.5,1.0); footprint=(-34,-30,68,30), rect, relative to common feet (+y down); tallfalse, layerprops. Stone body/log/grate stays fixed; geometry flames sway and change height. No combat hitbox or game fire behavior is implied.

## Integration choices deliberately unchanged
Ground collides flags remain as authored previously: walls/cliffs true, other ground false. Water traversal and partial-cliff collision geometry need integrator decisions; this handoff does not silently change behavior. Roofs/canopies remain non-colliding overheads; base footprints only. Actual Tiled/Phaser import, sorting, pathfinding and gameplay collision were NOT tested or integrated. Walls/cliff faces are horizontal-repeat art; arbitrary vertical stacking is not guaranteed.

Nearest filtering, no mipmaps/compression/resizing; honor TSJ margin/spacing and per-atlas pivots. Mixed projection remains front-elevation-heavy and simpler than the knight, as in reviewed v3. Wang16 retains its inherent diagonal-saddle limitation, not47-blob coverage.

## Separate archives
Runtime includes no .blend, .glb, frames, masters, backups or beauty/debug previews. The preview archive contains native-scale village, all15 sets/all222 IDs, all20 props, separate footprint guides, repetition samples, water GIF/strip and hearth GIF/strip. The source archive includes all247 .blend scenes, procedural scripts, palette, metadata and REBUILD.md. Sources and raw4x renders remain stored locally. No character files were modified.
