# items_b10 — hero item HOLD + USE (thief share)

Not frozen. Batch output lives only under `items_b10/`. `items_b9_full/` was not written. `models/` was opened read-only (scratch copy of `thief.blend`, never saved). A parallel worker owns all `dwarf_*` files and `frames/items/dwarf_pickaxe*`.

## Design (reused from approved B9)

Body clips are separate from in-hand item sprites. Items are composited at runtime from hand-anchor JSON. Format: `{x, y, rotation, layer}` in px from the feet origin (+y down); rotation degrees, 0 = item upright (cork / pick shafts up), clockwise on screen; `layer` is `front` | `behind` | `none`.

Approved rules used: main-hand weapon hidden (thief `Dagger.R`, `Guard.R`); left dagger kept; item in `hand.R`; up facing forced front; `hold_idle` is 1 static frame; `hold_run` matches the shipped run (8 f @ 14 fps, right arm locked to the hold pose).

## Thief clips

| clip | cell | fps | frames | playback | notes |
|---|---|---|---|---|---|
| hold_idle | 64×96 | 1 | 1 | loop | **byte-identical** copy of frozen `items_b9_full` |
| hold_run | 80×96 | 14 | 8 | loop | **byte-identical** copy of frozen `items_b9_full` |
| use_lockpick | 64×96 | 12 | 14 | start-loop-end | start 4 + loop 6 + end 4 (333 / 500 / 333 ms). Crouched, picking a lock in front at hand height. `f0` and last are the hold pose. |
| use_throw | 64×96 | 12 | 8 | oneshot (667 ms) | Underhand lob. `releaseFrame` = 3. After that, anchor `layer` is `"none"` (vial not in hand). |

Origin / pivot: `{x: 0.5, y: 0.9271}`, pivot row 89.0016 px, 12° prop camera, 36.923 px/unit, EEVEE 1-sample toon. 4 facings, left and right rendered separately (not mirrored).

### use_lockpick layers

`layerLock`: down front, left **front** (forced — see decision 1), right front, up front (approved).

### use_throw spawn

`releaseFrame` = 3. Measured grip point at release, px from feet origin (+y down):

| facing | spawnOffsetPx (this clip) | current `throwPoisonVial` hardcoded offset |
|---|---|---|
| down | x -17.69, y -34.81 | x 0, y -4 |
| left | x -9.84, y -40.54 | x -12, y -16 |
| right | x 9.84, y -33.18 | x 12, y -16 |
| up | x 17.69, y -38.91 | x 0, y -28 |

Current `throwPoisonVial` (`origin/main` `client/src/game/combat/spells.js`) spawns **instantly** (no wind-up) at `player.x + dx*12`, `player.y - 16 + dy*12`. After release the in-hand vial is omitted (`layer: "none"`).

## In-hand items (`runtime/items_inhand_b10.png/.json`)

Packed from `frames/items/*` by `scripts/pack_items.py`. Mixed cell sizes (each item keeps its native frame):

| id | cell | grip pivot (px) | notes |
|---|---|---|---|
| dwarf_pickaxe | 32×32 | 16.00, 21.06 | landed by the parallel worker; 24×24 was too tight per their `dwarf_pickaxe.json` |
| lockpicks | 24×24 | 12.00, 15.61 | crossed rake + tension wrench, metal + leather handles |
| poison_vial | 24×24 | 12.00, 15.61 | two-tone dark-glass flask, green liquid in the lower body, cork (matches the legacy icon silhouette) |

## Paths

- Gate sheet: `previews/b10_gate.png` (dwarf body clips were skipped — only anchors had landed when the sheet was built; the pickaxe is in the items row)
- Sheets: `runtime/thief_hold_idle.png/.json`, `thief_hold_run.png/.json`, `thief_use_lockpick.png/.json`, `thief_use_throw.png/.json`, `items_inhand_b10.png/.json`
- Anchors: `runtime/thief_*_anchors.json` (plus `use_*` meta: start/loop/end, releaseFrame, spawnOffsetPx)
- Scripts: `scripts/thief_render_body.py`, `thief_pack.py`, `render_items.py`, `pack_items.py`, `gate_sheet.py`
- Palette: `palette.json` (union of thief + B9 item colours + dwarf). Lockpicks and poison_vial snap cleanly. Dwarf pickaxe cells were packed as landed (dwarf palette, including outline `#111521`); they were not re-snapped.

## QA

- `kit/qa.py items_b10` → **QA 16/0 · contract – seams – pairing – rebuild – frozen ✓ (batch unfrozen, 16 other trees ok) plausibility –**
- Visual: items stay attached; no front/behind flicker (layers locked); lockpicks visible on left after the force-front; vial gone after throw release; binary alpha; thief body snaps to the thief palette; items snap to the union palette; throw feet match idle exactly; lockpick squat has a 1–3 px foot crawl on down/up (cloak/boot foreshortening under the 12° camera).
- Art ✓ · Structural ✓ · Runtime not claimed.

## Approved and frozen (Grant, Nov 17 2026, relayed by Grok Bot)

Supersedes the "Not frozen" and "dwarf skipped" notes above. The final gate sheet `previews/b10_gate.png` contains all three tools.

### Dwarf + dwarf_pickaxe (body cell 64×80, origin (0.5, 0.9125), feet row 73; axe hidden; item in hand.R)
| clip | fps | frames | playback | notes |
|---|---|---|---|---|
| dwarf_hold_idle | 1 | 1 | loop | static hold pose |
| dwarf_hold_run | 14 | 8 | loop | durations [71]×8, right arm locked to the hold pose |
| dwarf_use_pickaxe | 12 | 8 | oneshot (666 ms) | durations [83,83,84,83,83,84,83,83]; **contactFrame = effectFrame = 4**; f2 is the wind-up |
Layers: up is forced front. Left use_pickaxe stays behind (approved; contact only peeks). Details are in `docs/DWARF_B10.md`.

### Thief (approved as gated)
- use_lockpick: 14 f @ 12 fps. Start f0–3 (333 ms), loop f4–9 (500 ms), end f10–13 (333 ms). Left is forced front (approved).
- use_throw: 8 f @ 12 fps oneshot (667 ms). **releaseFrame = 3** (250 ms wind-up). After the release the anchor layer is `"none"`.
- Vial release spawnOffsetPx from the feet (+y down): down (−17.69, −34.81), left (−9.84, −40.54), right (9.84, −33.18), up (17.69, −38.91). The wind-up and offset change to `throwPoisonVial` belongs to the code wire-in package, not to the art.

### Items
`runtime/items_inhand_b10.png/.json` contains dwarf_pickaxe (32×32, pivot 16.00, 21.06; approved), lockpicks and poison_vial (24×24, pivot 12.00, 15.61). There are 4 facings each.
