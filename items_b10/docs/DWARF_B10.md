# items_b10 — dwarf + dwarf_pickaxe HOLD + USE (not frozen)

Local art only. No repo edits, no freeze, no writes into `models/`, `items_b9_full/`, `thief_*`, or `runtime/items_inhand*`.
Rig opened from a read-only copy at `scratch/dwarf.blend` (byte-identical to `models/dwarf/dwarf.blend`, models mtime unchanged 2026-11-06 15:06:56 CT).

A parallel worker owns `thief_*`, `scripts/thief_*.py`, `scripts/pack_items.py`, `scripts/gate_sheet.py`, and `runtime/items_inhand_b10.*`. This share is dwarf only.

Grant has not approved this set yet. Do not freeze until he does.

## Clips

| clip | frames | fps | timing | notes |
|---|---|---|---|---|
| `hold_idle` | 1 | 1 | loop | matches shipped dwarf idle; axe hidden; pickaxe in `hand.R` |
| `hold_run` | 8 | 14 | loop, durations `[71]×8` | matches shipped run; right arm locked to the hold pose; legs + off-hand follow the run cycle |
| `use_pickaxe` | 8 | 12 | 666 ms oneshot, durations `[83,83,84,83,83,84,83,83]` | overhead mining swing. `contactFrame` = `effectFrame` = **4**. f0 near hold, f2 wind-up (head back/up), f4 ground contact with the point leading, f7 settle toward hold |

Body clips are separate from the pickaxe sprite. Per-frame anchors: `{x, y, rotation, layer}`
(px from feet origin, +y down; rotation 0 = pick head up, positive clockwise on screen; layer `front`|`behind`).
Exported from a grip empty on `hand.R`. Up-facing layer is forced `front` (approved).

Layer locks (no flicker):

| clip | down | left | right | up |
|---|---|---|---|---|
| hold_idle / hold_run / use_pickaxe | front | behind | front | front (forced) |

## Pipeline / cells

EEVEE Next, 1 sample, Standard view, sun 3.0 at (45°, 0, −30°), world 0.6/0.6/0.65 @ 0.5.
Prop camera 12° above horizontal, `PPU = 36.923`, 4× render → 4×4 mode-filter, dwarf palette snap, binary alpha, 1 px outline.

| | cell | origin | tz | weapon hidden | off-hand kept |
|---|---|---|---|---|---|
| hold_idle, hold_run, use_pickaxe | **64×80** | (0.5, 0.9125), feet row 73 | 0.8284928711125771 | `Haft`, `Grip`, `Socket`, `AxeBlade`, `AxeEdge`, `BackSpike` | left fist |

`use_pickaxe` was rendered on an 80×80 canvas (same tz / height so feet stay on row 73) and measured. Body extent bbox `(18,13,62,75)` fits 64×80 after an 8 px symmetric crop. **No widen.** The pickaxe is a separate sprite and can draw outside the body cell at wind-up and contact; the check sheet composites onto a 16 px pad so the overflow is visible.

Feet match the idle ref in every facing: down 72, left/right 73, up 71. Contact crouch moves down/up feet to row 73.

## In-hand pickaxe

`frames/items/dwarf_pickaxe_{down,left,right,up}.png` + `frames/items/dwarf_pickaxe.json`.

- Cell **32×32** — 24×24 was too tight for a readable haft + pointed head (left/right nearly clipped at 32 before a −40° yaw of the head around the haft toward −X, which also gives down/up a clear point + short poll).
- Grip mid-haft, pivot `(16.00, 21.06)` in all facings. Rotation 0 = haft along +Z (head up), point along −Y (forward).
- Bboxes (unclipped): down `(5,8,22,31)`, left `(3,7,23,31)`, right `(9,8,29,31)`, up `(10,6,27,31)`.
- Id `dwarf_pickaxe` from Game.jsx tools. Palette is the dwarf palette (haft / leather / axe steel / outline).

The parallel worker already packed these cells into `runtime/items_inhand_b10.png/.json` (this share did not rewrite that pack).

## Paths (not frozen)

- Check sheet: `previews/dwarf_b10_check.png`
- Body sheets + JSON + anchors: `runtime/dwarf_{hold_idle,hold_run,use_pickaxe}.{png,json}` and `*_anchors.json`
- Item cells: `frames/items/dwarf_pickaxe_<dir>.png`, `frames/items/dwarf_pickaxe.json`
- Frames: `frames/dwarf/`
- Scripts: `scripts/dwarf_render_body.py`, `scripts/dwarf_pack.py`, `scripts/dwarf_render_pickaxe.py`

## SHA256

```
runtime/dwarf_hold_idle.png            29785d64be64b4ca26f84e557d46d228e84986fc58c7f33c6c0030f7e44e65ae
runtime/dwarf_hold_idle.json           d6523387a6154a266aeec969edb9d76f8e851b886e282f6dc73e45d9752e297e
runtime/dwarf_hold_idle_anchors.json   f5473b6dccd81f94f09002b9a3123823e90b2c323a3014bf9c88a09609e24eea
runtime/dwarf_hold_run.png             48d05acbe47a92469ea8d78a25bbe10f9b3a67e8812bc38f60fc86520da62676
runtime/dwarf_hold_run.json            cc17d2a2cfa10b10a22e10aa66e2771f735c07c18689df01ff2339798981408d
runtime/dwarf_hold_run_anchors.json    a2ff17dfa2cd1eeaa11718131593ae9ee79f5513a9677ee1c741af640f1748b7
runtime/dwarf_use_pickaxe.png          01b2674a217f5ab5bfab7a7ceb04c972a118c1264c09282bf773a2e6e528ac8c
runtime/dwarf_use_pickaxe.json         2fe6db8d9a3e17c6e623238527dbd489361d729a6ce7d80b371d1404db19449d
runtime/dwarf_use_pickaxe_anchors.json 489cb4e477591d07bc65c83befac7ef06002b8683e4a07d37096430d08644e96
previews/dwarf_b10_check.png           740478811d4de56e398ad768b02303add78da5fa45dae55bb164a1e28d865142
frames/items/dwarf_pickaxe_down.png    beabc4353556c96eceab119abd8d1f09fe24788cfe756d9978c005bdfc5dfbae
frames/items/dwarf_pickaxe_left.png    b40b7d0b22fad939686615476b2fbaddb0f6dce535d9fa5e6359db7eca541232
frames/items/dwarf_pickaxe_right.png   984270f9f662c844db7676c1b39cf240f9b4484d6d0077544362a691624ed81d
frames/items/dwarf_pickaxe_up.png      12b1e9ae5414d3bd878cb8b9b11448eaecc6949abb54189b466133c51a7862fd
frames/items/dwarf_pickaxe.json        a4393d649d20aff83b04695a2e9291977d5a89f7a7e7cff1f6506641a35d2ff9
```

## Checks

Pickaxe attached every frame; point leads the downward arc (clearest on right f3–f4); no body clipping; binary alpha; palette snap clean (0 off-palette pixels on item cells and body sheets); feet match idle; L/R not mirrors.

`kit/qa.py items_b10` → **QA 16/0 · contract – seams – pairing – rebuild – frozen ✓ (batch unfrozen, 16 other trees ok) plausibility –**

(Sheets live under `runtime/` not `runtime/npc_*`, so kit contract/rebuild do not run on them; frozen-tree check did.)

Art ✓ · Structural ✓ · Runtime not claimed.
