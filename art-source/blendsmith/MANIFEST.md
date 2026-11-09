# Blendsmith final atlases v1

Generated from the atlas JSONs by a script (numbers not hand-typed).

## Conventions
- 4 directions rendered: down, left, right, up. No flipX.
- Frame naming: `<asset>_<anim>_<dir>_<i>`.
- Phaser 3 JSON-hash atlases. Hitboxes, hurtbox, footprint, hitFrames etc. live in each JSON's `meta` (`meta.anims`, `meta.footprint`, `meta.hurtbox`).
- **Origins differ per asset (≈0.9125–0.9375). The game must read the anchor from each sheet's meta, never hard-code it.**
- Dragon: cell 640×512, origin (320,400). Load only the current phase's pages. `red_dragon/attacks.json` is a separate sidecar.
- Mage is split across `mage/walk/` and `mage/spells/`.

## `critters/critters`

- PNG: `critters/critters.png` — 192×1408 px; PNG+JSON 135.3 KiB; 308 frames
- Cell size(s): 16×16, 32×32
- Anchor/origin: `{"x": 0.5, "y": 0.875}`

## `dwarf/dwarf`

- PNG: `dwarf/dwarf.png` — 896×320 px; PNG+JSON 61.5 KiB; 56 frames
- Cell size(s): 64×80
- Anchor/origin: `{"x": 0.5, "y": 0.9125}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -29, "w": 31, "h": 29, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| idle | 1@1 | loop |
| walk | 8@10 | loop |
| hurt | 5@12 | — |

## `dwarf/dwarf_attack`

- PNG: `dwarf/dwarf_attack.png` — 672×384 px; PNG+JSON 38.2 KiB; 28 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -29, "w": 31, "h": 29, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| attack | 7@11 | — |

## `dwarf/dwarf_attack2`

- PNG: `dwarf/dwarf_attack2.png` — 448×320 px; PNG+JSON 33.5 KiB; 28 frames
- Cell size(s): 64×80
- Anchor/origin: `{"x": 0.5, "y": 0.9125}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -29, "w": 31, "h": 29, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| attack_2 | 7@12 | — |

## `dwarf/dwarf_charged`

- PNG: `dwarf/dwarf_charged.png` — 768×320 px; PNG+JSON 54.1 KiB; 48 frames
- Cell size(s): 64×80
- Anchor/origin: `{"x": 0.5, "y": 0.9125}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -29, "w": 31, "h": 29, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| charge_hold | 4@10 | loop |
| charged_release | 8@12 | — |

## `dwarf/dwarf_death`

- PNG: `dwarf/dwarf_death.png` — 800×320 px; PNG+JSON 55.1 KiB; 40 frames
- Cell size(s): 80×80
- Anchor/origin: `{"x": 0.5, "y": 0.9125}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -29, "w": 31, "h": 29, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| death | 10@10 | holdLast |

## `dwarf/dwarf_dodge`

- PNG: `dwarf/dwarf_dodge.png` — 384×320 px; PNG+JSON 31.8 KiB; 24 frames
- Cell size(s): 64×80
- Anchor/origin: `{"x": 0.5, "y": 0.9125}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -29, "w": 31, "h": 29, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| dodge | 6@16 | — |

## `dwarf/dwarf_run`

- PNG: `dwarf/dwarf_run.png` — 512×320 px; PNG+JSON 31.7 KiB; 32 frames
- Cell size(s): 64×80
- Anchor/origin: `{"x": 0.5, "y": 0.9125}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -29, "w": 31, "h": 29, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| run | 8@14 | loop |

## `fx_common/fx_common`

- PNG: `fx_common/fx_common.png` — 368×32 px; PNG+JSON 5.5 KiB; 9 frames
- Cell size(s): 32×32, 48×32
- Anchor/origin: `{"x": 0.5, "y": 0.5}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| hit_spark | 4@20 | — |
| dust_puff | 5@14 | — |

## `goblin/goblin`

- PNG: `goblin/goblin.png` — 1344×256 px; PNG+JSON 73.1 KiB; 84 frames
- Cell size(s): 64×64
- Anchor/origin: `{"x": 0.5, "y": 0.9375}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -23, "w": 31, "h": 23, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| idle | 1@1 | loop |
| walk | 8@10 | loop |
| hurt | 5@12 | — |
| attack | 7@8 | — |

## `goblin/goblin_death`

- PNG: `goblin/goblin_death.png` — 640×288 px; PNG+JSON 35.2 KiB; 32 frames
- Cell size(s): 80×72
- Anchor/origin: `{"x": 0.5, "y": 0.8333}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -23, "w": 31, "h": 23, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| death | 8@10 | holdLast |

## `goblin/goblin_spawn`

- PNG: `goblin/goblin_spawn.png` — 384×288 px; PNG+JSON 25.5 KiB; 24 frames
- Cell size(s): 64×72
- Anchor/origin: `{"x": 0.5, "y": 0.8889}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -23, "w": 31, "h": 23, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| spawn | 6@12 | — |

## `goblin/goblin_telegraph`

- PNG: `goblin/goblin_telegraph.png` — 192×256 px; PNG+JSON 14.9 KiB; 12 frames
- Cell size(s): 64×64
- Anchor/origin: `{"x": 0.5, "y": 0.9375}`
- footprint: `{"x": -13, "y": -4, "w": 26, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -16, "y": -23, "w": 31, "h": 23, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| telegraph | 3@8 | loop |

## `goblin_archer/goblin_archer`

- PNG: `goblin_archer/goblin_archer.png` — 1408×280 px; PNG+JSON 87.5 KiB; 97 frames
- Cell size(s): 9×24, 16×16, 24×9, 64×64
- Anchor/origin: `{"x": 0.5, "y": 0.9375}`
- footprint: `{"x": -13, "y": -4, "w": 25, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -15, "y": -24, "w": 30, "h": 24, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| idle | 1@1 | loop |
| walk | 8@10 | loop |
| hurt | 5@12 | — |
| attack | 8@9 | — |
| arrow | 1@? | — |
| arrow_impact | 5@16 | — |

## `goblin_archer/goblin_archer_death`

- PNG: `goblin_archer/goblin_archer_death.png` — 640×288 px; PNG+JSON 38.2 KiB; 32 frames
- Cell size(s): 80×72
- Anchor/origin: `{"x": 0.5, "y": 0.8333}`
- footprint: `{"x": -13, "y": -4, "w": 25, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -15, "y": -24, "w": 30, "h": 24, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| death | 8@10 | holdLast |

## `goblin_archer/goblin_archer_spawn`

- PNG: `goblin_archer/goblin_archer_spawn.png` — 384×288 px; PNG+JSON 27.8 KiB; 24 frames
- Cell size(s): 64×72
- Anchor/origin: `{"x": 0.5, "y": 0.875}`
- footprint: `{"x": -13, "y": -4, "w": 25, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -15, "y": -24, "w": 30, "h": 24, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| spawn | 6@12 | — |

## `goblin_brute/goblin_brute`

- PNG: `goblin_brute/goblin_brute.png` — 2016×384 px; PNG+JSON 106.6 KiB; 84 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -20, "y": -6, "w": 40, "h": 12, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -24, "y": -31, "w": 48, "h": 31, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| idle | 1@1 | loop |
| walk | 8@8 | loop |
| hurt | 5@12 | — |
| attack | 7@8 | — |

## `goblin_brute/goblin_brute_death`

- PNG: `goblin_brute/goblin_brute_death.png` — 896×384 px; PNG+JSON 51.5 KiB; 32 frames
- Cell size(s): 112×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -20, "y": -6, "w": 40, "h": 12, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -24, "y": -31, "w": 48, "h": 31, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| death | 8@10 | holdLast |

## `goblin_brute/goblin_brute_spawn`

- PNG: `goblin_brute/goblin_brute_spawn.png` — 576×384 px; PNG+JSON 36.3 KiB; 24 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -20, "y": -6, "w": 40, "h": 12, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -24, "y": -31, "w": 48, "h": 31, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| spawn | 6@12 | — |

## `goblin_brute/goblin_brute_telegraph`

- PNG: `goblin_brute/goblin_brute_telegraph.png` — 288×384 px; PNG+JSON 21.0 KiB; 12 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -20, "y": -6, "w": 40, "h": 12, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -24, "y": -31, "w": 48, "h": 31, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| telegraph | 3@8 | loop |

## `knight/knight`

- PNG: `knight/knight.png` — 896×384 px; PNG+JSON 74.5 KiB; 56 frames
- Cell size(s): 64×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -12, "y": -4, "w": 23, "h": 7, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -14, "y": -37, "w": 28, "h": 37, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| idle | 1@1 | loop |
| walk | 8@10 | loop |
| hurt | 5@12 | — |

## `knight/knight_attack`

- PNG: `knight/knight_attack.png` — 896×384 px; PNG+JSON 49.0 KiB; 28 frames
- Cell size(s): 128×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -12, "y": -4, "w": 23, "h": 7, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -14, "y": -37, "w": 28, "h": 37, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| attack | 7@11 | — |

## `knight/knight_attack2`

- PNG: `knight/knight_attack2.png` — 560×384 px; PNG+JSON 40.5 KiB; 28 frames
- Cell size(s): 80×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -12, "y": -4, "w": 23, "h": 7, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -14, "y": -37, "w": 28, "h": 37, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| attack_2 | 7@12 | — |

## `knight/knight_block`

- PNG: `knight/knight_block.png` — 384×384 px; PNG+JSON 28.7 KiB; 24 frames
- Cell size(s): 64×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -12, "y": -4, "w": 23, "h": 7, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -14, "y": -37, "w": 28, "h": 37, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| block_start | 2@12 | — |
| block_hold | 1@12 | loop |
| block_hit | 3@12 | — |

## `knight/knight_charged`

- PNG: `knight/knight_charged.png` — 1152×384 px; PNG+JSON 65.7 KiB; 48 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -12, "y": -4, "w": 23, "h": 7, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -14, "y": -37, "w": 28, "h": 37, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| charge_hold | 4@10 | loop |
| charged_release | 8@12 | — |

## `knight/knight_death`

- PNG: `knight/knight_death.png` — 1280×416 px; PNG+JSON 69.0 KiB; 40 frames
- Cell size(s): 128×104
- Anchor/origin: `{"x": 0.5, "y": 0.8558}`
- footprint: `{"x": -12, "y": -4, "w": 23, "h": 7, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -14, "y": -37, "w": 28, "h": 37, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| death | 10@10 | holdLast |

## `knight/knight_dodge`

- PNG: `knight/knight_dodge.png` — 480×384 px; PNG+JSON 38.1 KiB; 24 frames
- Cell size(s): 80×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -12, "y": -4, "w": 23, "h": 7, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -14, "y": -37, "w": 28, "h": 37, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| dodge | 6@16 | — |

## `knight/knight_run`

- PNG: `knight/knight_run.png` — 512×384 px; PNG+JSON 37.5 KiB; 32 frames
- Cell size(s): 64×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -12, "y": -4, "w": 23, "h": 7, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -14, "y": -37, "w": 28, "h": 37, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| run | 8@14 | loop |

## `mage/spells/mage_book`

- PNG: `mage/spells/mage_book.png` — 1344×384 px; PNG+JSON 55.8 KiB; 56 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9274}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| mage_book_walk_down | 8@? | — |
| mage_book_idle_down | 1@? | — |
| mage_book_hurt_down | 5@? | — |
| mage_book_walk_left | 8@? | — |
| mage_book_idle_left | 1@? | — |
| mage_book_hurt_left | 5@? | — |
| mage_book_walk_right | 8@? | — |
| mage_book_idle_right | 1@? | — |
| mage_book_hurt_right | 5@? | — |
| mage_book_walk_up | 8@? | — |
| mage_book_idle_up | 1@? | — |
| mage_book_hurt_up | 5@? | — |

## `mage/spells/mage_spells`

- PNG: `mage/spells/mage_spells.png` — 1152×1920 px; PNG+JSON 269.4 KiB; 216 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9274}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| mage_cast_lightning_down | 12@? | — |
| mage_cast_lightning_left | 12@? | — |
| mage_cast_lightning_right | 12@? | — |
| mage_cast_lightning_up | 12@? | — |
| mage_cast_blink_vanish_down | 10@? | — |
| mage_cast_blink_vanish_left | 10@? | — |
| mage_cast_blink_vanish_right | 10@? | — |
| mage_cast_blink_vanish_up | 10@? | — |
| mage_cast_blink_appear_down | 8@? | — |
| mage_cast_blink_appear_left | 8@? | — |
| mage_cast_blink_appear_right | 8@? | — |
| mage_cast_blink_appear_up | 8@? | — |
| mage_cast_leech_down | 12@? | — |
| mage_cast_leech_left | 12@? | — |
| mage_cast_leech_right | 12@? | — |
| mage_cast_leech_up | 12@? | — |
| mage_cast_shield_down | 12@? | — |
| mage_cast_shield_left | 12@? | — |
| mage_cast_shield_right | 12@? | — |
| mage_cast_shield_up | 12@? | — |

## `mage/spells/spell_fx`

- PNG: `mage/spells/spell_fx.png` — 1024×736 px; PNG+JSON 49.5 KiB; 64 frames
- Cell size(s): 32×32, 48×48, 64×64, 96×32, 96×96, 128×128
- Anchor/origin: `{"x": 0.0, "y": 0.5}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| lightning_bolt | 4@? | — |
| lightning_impact | 6@? | — |
| leech_orb | 6@? | — |
| leech_impact | 6@? | — |
| leech_return | 8@? | — |
| leech_absorb | 8@? | — |
| shield_form | 6@? | — |
| shield_loop | 8@? | — |
| shield_break | 6@? | — |
| blink_portal | 6@? | — |

## `mage/walk/fireball`

- PNG: `mage/walk/fireball.png` — 192×64 px; PNG+JSON 5.4 KiB; 12 frames
- Cell size(s): 32×32
- Anchor/origin: `null`

## `mage/walk/mage_attack2`

- PNG: `mage/walk/mage_attack2.png` — 672×416 px; PNG+JSON 34.7 KiB; 28 frames
- Cell size(s): 96×104
- Anchor/origin: `{"x": 0.5, "y": 0.8846}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| attack_2 | 7@12 | — |

## `mage/walk/mage_cast`

- PNG: `mage/walk/mage_cast.png` — 960×384 px; PNG+JSON 48.3 KiB; 40 frames
- Cell size(s): 96×96
- Anchor/origin: `{"feetPivotNote": "footprint/hurtbox/hitbox px relative to the feet pivot (origin), +y down; x,y = top-left"}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| cast | 10@10 | — |

## `mage/walk/mage_charged`

- PNG: `mage/walk/mage_charged.png` — 1344×416 px; PNG+JSON 58.3 KiB; 48 frames
- Cell size(s): 112×104
- Anchor/origin: `{"x": 0.5, "y": 0.875}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| charge_hold | 4@10 | loop |
| charged_release | 8@12 | — |

## `mage/walk/mage_death`

- PNG: `mage/walk/mage_death.png` — 1120×384 px; PNG+JSON 55.2 KiB; 40 frames
- Cell size(s): 112×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| death | 10@10 | holdLast |

## `mage/walk/mage_dodge`

- PNG: `mage/walk/mage_dodge.png` — 576×384 px; PNG+JSON 32.1 KiB; 24 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| dodge | 6@16 | — |

## `mage/walk/mage_hurt`

- PNG: `mage/walk/mage_hurt.png` — 320×384 px; PNG+JSON 23.5 KiB; 20 frames
- Cell size(s): 64×96
- Anchor/origin: `{"feetPivotNote": "footprint/hurtbox/hitbox px relative to the feet pivot (origin), +y down; x,y = top-left"}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| hurt | 5@12 | — |

## `mage/walk/mage_run`

- PNG: `mage/walk/mage_run.png` — 640×384 px; PNG+JSON 31.9 KiB; 32 frames
- Cell size(s): 80×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| run | 8@14 | loop |

## `mage/walk/mage_walk`

- PNG: `mage/walk/mage_walk.png` — 576×384 px; PNG+JSON 32.3 KiB; 36 frames
- Cell size(s): 64×96
- Anchor/origin: `{"feetPivotNote": "footprint/hurtbox/hitbox px relative to the feet pivot (origin), +y down; x,y = top-left"}`
- footprint: `{"x": -14, "y": -4, "w": 28, "h": 8, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -17, "y": -36, "w": 34, "h": 36, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| idle | 1@1 | loop |
| walk | 8@10 | loop |

## `red_dragon/fx_v2/dragon_fx_v2`

- PNG: `red_dragon/fx_v2/dragon_fx_v2.png` — 4095×2847 px; PNG+JSON 1295.1 KiB; 204 frames
- Cell size(s): 64×64, 80×128, 112×112, 112×144, 128×128, 136×64, 160×128, 176×80, 192×192, 224×224, 264×168, 400×232, 448×408, 576×480, 592×184, 608×480
- Anchor/origin: `null`

## `red_dragon/red_dragon_p1_a`

- PNG: `red_dragon/red_dragon_p1_a.png` — 4055×4096 px; PNG+JSON 1082.2 KiB; 176 frames
- Cell size(s): 640×512
- Anchor/origin: `{"x": 0.5, "y": 0.7812, "px": [320, 400], "note": "all offsets/hitboxes are px relative to origin (feet centre); y down"}`
- footprint: `{"x": -101, "y": -30, "w": 201, "h": 60, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -121, "y": -131, "w": 241, "h": 131, "note": "body hurtbox, bottom on feet; P2 hover: raise by the hover height (52 px) with the body"}`

## `red_dragon/red_dragon_p1_b`

- PNG: `red_dragon/red_dragon_p1_b.png` — 4078×2717 px; PNG+JSON 802.5 KiB; 112 frames
- Cell size(s): 640×512
- Anchor/origin: `{"x": 0.5, "y": 0.7812, "px": [320, 400], "note": "all offsets/hitboxes are px relative to origin (feet centre); y down"}`
- footprint: `{"x": -101, "y": -30, "w": 201, "h": 60, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -121, "y": -131, "w": 241, "h": 131, "note": "body hurtbox, bottom on feet; P2 hover: raise by the hover height (52 px) with the body"}`

## `red_dragon/red_dragon_p2_a`

- PNG: `red_dragon/red_dragon_p2_a.png` — 4093×3948 px; PNG+JSON 1201.4 KiB; 169 frames
- Cell size(s): 640×512
- Anchor/origin: `{"x": 0.5, "y": 0.7812, "px": [320, 400], "note": "all offsets/hitboxes are px relative to origin (feet centre); y down"}`
- footprint: `{"x": -101, "y": -30, "w": 201, "h": 60, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -121, "y": -131, "w": 241, "h": 131, "note": "body hurtbox, bottom on feet; P2 hover: raise by the hover height (52 px) with the body"}`

## `red_dragon/red_dragon_p2_b`

- PNG: `red_dragon/red_dragon_p2_b.png` — 3840×610 px; PNG+JSON 198.0 KiB; 23 frames
- Cell size(s): 640×512
- Anchor/origin: `{"x": 0.5, "y": 0.7812, "px": [320, 400], "note": "all offsets/hitboxes are px relative to origin (feet centre); y down"}`
- footprint: `{"x": -101, "y": -30, "w": 201, "h": 60, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -121, "y": -131, "w": 241, "h": 131, "note": "body hurtbox, bottom on feet; P2 hover: raise by the hover height (52 px) with the body"}`

## `red_dragon/red_dragon_p2_land`

- PNG: `red_dragon/red_dragon_p2_land.png` — 4062×1191 px; PNG+JSON 347.7 KiB; 48 frames
- Cell size(s): 640×512
- Anchor/origin: `{"x": 0.5, "y": 0.7812, "px": [320, 400], "note": "all offsets px relative to origin (feet centre); y down. Shadow always at origin; body lifts bodyLiftPx above it (hover = 70 px feet lift, ~52 px body ref)."}`
- footprint: `{"x": -101, "y": -30, "w": 201, "h": 60, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -121, "y": -131, "w": 241, "h": 131, "note": "body hurtbox, bottom on feet; P2 hover: raise by the hover height (52 px) with the body"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| land_left | 6@12 | — |
| land_right | 6@12 | — |
| land_down | 6@12 | — |
| land_up | 6@12 | — |
| takeoff_left | 6@12 | — |
| takeoff_right | 6@12 | — |
| takeoff_down | 6@12 | — |
| takeoff_up | 6@12 | — |

## `red_dragon/red_dragon_p3_a`

- PNG: `red_dragon/red_dragon_p3_a.png` — 4088×4004 px; PNG+JSON 1255.8 KiB; 148 frames
- Cell size(s): 640×512
- Anchor/origin: `{"x": 0.5, "y": 0.7812, "px": [320, 400], "note": "all offsets/hitboxes are px relative to origin (feet centre); y down"}`
- footprint: `{"x": -101, "y": -30, "w": 201, "h": 60, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -121, "y": -131, "w": 241, "h": 131, "note": "body hurtbox, bottom on feet; P2 hover: raise by the hover height (52 px) with the body"}`

## `red_dragon/red_dragon_p3_b`

- PNG: `red_dragon/red_dragon_p3_b.png` — 4082×3051 px; PNG+JSON 867.4 KiB; 120 frames
- Cell size(s): 640×512
- Anchor/origin: `{"x": 0.5, "y": 0.7812, "px": [320, 400], "note": "all offsets/hitboxes are px relative to origin (feet centre); y down"}`
- footprint: `{"x": -101, "y": -30, "w": 201, "h": 60, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -121, "y": -131, "w": 241, "h": 131, "note": "body hurtbox, bottom on feet; P2 hover: raise by the hover height (52 px) with the body"}`

## `thief/fx/thief_fx`

- PNG: `thief/fx/thief_fx.png` — 576×48 px; PNG+JSON 8.5 KiB; 12 frames
- Cell size(s): 32×32, 64×48
- Anchor/origin: `{"x": 0.5, "y": 0.5}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| poison_vial | 6@12 | loop |
| poison_splash | 6@14 | — |

## `thief/thief`

- PNG: `thief/thief.png` — 896×384 px; PNG+JSON 60.8 KiB; 56 frames
- Cell size(s): 64×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -9, "y": -3, "w": 18, "h": 5, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -11, "y": -32, "w": 22, "h": 32, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| idle | 1@1 | loop |
| walk | 8@10 | loop |
| hurt | 5@12 | — |

## `thief/thief_attack`

- PNG: `thief/thief_attack.png` — 672×384 px; PNG+JSON 38.8 KiB; 28 frames
- Cell size(s): 96×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -9, "y": -3, "w": 18, "h": 5, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -11, "y": -32, "w": 22, "h": 32, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| attack | 7@11 | — |

## `thief/thief_attack2`

- PNG: `thief/thief_attack2.png` — 560×384 px; PNG+JSON 36.0 KiB; 28 frames
- Cell size(s): 80×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -9, "y": -3, "w": 18, "h": 5, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -11, "y": -32, "w": 22, "h": 32, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| attack_2 | 7@12 | — |

## `thief/thief_charged`

- PNG: `thief/thief_charged.png` — 960×384 px; PNG+JSON 60.2 KiB; 48 frames
- Cell size(s): 80×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -9, "y": -3, "w": 18, "h": 5, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -11, "y": -32, "w": 22, "h": 32, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| charge_hold | 4@10 | loop |
| charged_release | 8@12 | — |

## `thief/thief_death`

- PNG: `thief/thief_death.png` — 960×416 px; PNG+JSON 54.1 KiB; 40 frames
- Cell size(s): 96×104
- Anchor/origin: `{"x": 0.5, "y": 0.8558}`
- footprint: `{"x": -9, "y": -3, "w": 18, "h": 5, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -11, "y": -32, "w": 22, "h": 32, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| death | 10@10 | holdLast |

## `thief/thief_dodge`

- PNG: `thief/thief_dodge.png` — 480×384 px; PNG+JSON 31.0 KiB; 24 frames
- Cell size(s): 80×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -9, "y": -3, "w": 18, "h": 5, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -11, "y": -32, "w": 22, "h": 32, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| dodge | 6@16 | — |

## `thief/thief_run`

- PNG: `thief/thief_run.png` — 640×384 px; PNG+JSON 32.6 KiB; 32 frames
- Cell size(s): 80×96
- Anchor/origin: `{"x": 0.5, "y": 0.9271}`
- footprint: `{"x": -9, "y": -3, "w": 18, "h": 5, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -11, "y": -32, "w": 22, "h": 32, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| run | 8@14 | loop |

## `thief/thief_stealth`

- PNG: `thief/thief_stealth.png` — 1344×416 px; PNG+JSON 82.1 KiB; 56 frames
- Cell size(s): 96×104
- Anchor/origin: `{"x": 0.5, "y": 0.9327}`
- footprint: `{"x": -9, "y": -3, "w": 18, "h": 5, "shape": "ellipse", "note": "collision footprint centred on feet"}`
- hurtbox: `{"x": -11, "y": -32, "w": 22, "h": 32, "note": "body hurtbox, bottom on feet"}`

| anim | frames@fps | loop/holdLast |
|---|---|---|
| vanish | 8@14 | — |
| reappear | 6@14 | — |

## Sidecar meta JSONs

- `critters/critters_anims.json` (7018 B)
- `dwarf/hitbox.json` (832 B)
- `goblin/attack_hit.json` (428 B)
- `goblin_archer/attack_spawn.json` (497 B)
- `goblin_brute/attack_hit.json` (428 B)
- `knight/hitbox.json` (835 B)
- `mage/spells/anchors.json` (45536 B)
- `mage/walk/cast_tips.json` (3053 B)
- `red_dragon/attacks.json` (19868 B)
- `red_dragon/fx_v2/fx_manifest.json` (14890 B)
- `red_dragon/fx_v2/spawns.json` (8621 B)
- `thief/hitbox.json` (1345 B)

**Total atlas PNG+JSON size:** 9.29 MiB

## AS-3 (2026-11-09)

The following atlases and tilesets are art-locked Blendsmith deliverables added in package AS-3. Never re-encode, resize, rename frames, or edit JSON metadata.

### Environment & Prop Atlases
- `env/interior_props/interior_props`: 718×486 px, 36 frames, anchor `{"x": 0.5, "y": 1.0}` (includes animated `tavern_hearth_wall_burn_down_0..5`)
- `env/dungeon_props/dungeon_props`: 764×436 px, 22 frames, anchor `{"x": 0.5, "y": 1.0}`
- `env/dungeon_brazier/dungeon_brazier`: 398×98 px, 6 frames, anchor `{"x": 0.5, "y": 1.0}` (animated burn)
- `env/treasure_chest/treasure_chest`: 500×100 px, 12 frames, anchor `{"x": 0.5, "y": 1.0}` (animated wood & iron open)
- `env/wild_props/wild_props`: 670×242 px, 9 frames, anchor `{"x": 0.5, "y": 1.0}`
- `env/wild_props_4b/wild_props_4b`: 314×56 px, 6 frames, anchor `{"x": 0.5, "y": 1.0}`
- `env/ember_vent/ember_vent`: 198×48 px, 4 frames, anchor `{"x": 0.5, "y": 1.0}` (animated burn)

### NPC Sheets
- `npcs/npc_bartender/npc_bartender`: 832×1632 px, 144 frames (64×96 cells), anchor `{"x": 0.5, "y": 0.9271}`, non-hittable, clips in `meta.anims` (`idle`, `talk`, `bottle_clean`, `wipe_counter`, `gesture`)
- `npcs/npc_vendor/npc_vendor`: 768×1536 px, 136 frames (64×96 cells), anchor `{"x": 0.5, "y": 0.9271}`, non-hittable, clips in `meta.anims` (`idle`, `talk`, `count_coins`, `present_goods`)

### Loot Pickups
- `loot/loot_pickups/loot_pickups`: 508×92 px, 41 frames, anchor `{"x": 0.5, "y": 0.875}`, 6 pickup idles + collect anim

### Dragon FX Extra
- `red_dragon/fx_extra/dragon_fx_extra`: 672×48 px, 7 frames, anchor `{"x": 0.5, "y": 0.5}`, includes `dfx_meteor_marker` (7@10 = 700 ms) and `fx_defs_extra.json` sidecar

### Ground Tilesets (32 px, margin 1, spacing 2)
- `tiles/ground/interior_tavern_wall_trim` (.png + .tsj)
- `tiles/ground/interior_market_wall_trim` (.png + .tsj)
- `tiles/ground/dungeon_wall_trim` (.png + .tsj)
- `tiles/ground/molten_floor` (.png + .tsj)
- `tiles/ground/scorched_floor` (.png + .tsj)
- `tiles/ground/ash_ground` (.png + .tsj)
- `tiles/ground/ash_fill` (.png + .tsj)
- `tiles/ground/forest_floor` (.png + .tsj)

