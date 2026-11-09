# env_b2_interiors — Batch 2 + 2b dense tavern

Status: **art complete** + **structural verified**. NOT runtime-accepted. No Batch 3.
Recorded: 2026-11-09 08:48 CST

## Props atlas `runtime/props/interior_props.{png,json}` (36 frames)

|ID|canvas|footprint|tall / layer|collision|notes|
|---|---|---|---|---|---|
|`tavern_bar_counter`|128×80|rect (-56,-22,112,22)|false / props|base footprint||
|`tavern_table_round`|64×64|ellipse (-22,-14,44,14)|false / props|base footprint||
|`tavern_bench`|64×40|rect (-28,-12,56,12)|false / props|base footprint||
|`tavern_keg_stack`|64×64|rect (-22,-16,44,16)|false / props|base footprint||
|`market_stall_base`|128×128|rect (-52,-20,104,20)|false / props|base footprint||
|`market_stall_awning`|128×128|none (0,0,0,0)|true / overhead|none||
|`tavern_stool`|32×48|rect (-10,-8,20,8)|false / props|base footprint||
|`tavern_table_long`|96×64|rect (-44,-16,88,16)|false / props|base footprint||
|`tavern_shelf_bottles`|64×80|rect (-28,-8,56,8)|false / props|base footprint||
|`tavern_notice_board`|48×64|none (0,0,0,0)|false / props|none||
|`tavern_rug`|64×40|none (0,0,0,0)|false / props|none| **NOT USED IN TAVERN**|
|`market_crate_produce`|48×48|rect (-18,-14,36,14)|false / props|base footprint||
|`market_sack_pile`|48×48|rect (-18,-14,36,14)|false / props|base footprint||
|`market_counter`|112×96|rect (-48,-18,96,18)|false / props|base footprint||
|`market_hanging_goods`|112×96|none (0,0,0,0)|true / overhead|none||
|`market_barrel_open`|48×56|rect (-16,-14,32,14)|false / props|base footprint||
|`interior_candle_table`|40×48|rect (-14,-10,28,10)|false / props|base footprint||
|`interior_window_wall`|48×64|none (0,0,0,0)|false / props|none||
|`tavern_shelf_crockery`|64×80|rect (-28,-8,56,8)|false / props|base footprint||
|`tavern_barrel_cluster`|64×64|rect (-26,-18,52,18)|false / props|base footprint||
|`tavern_crate_cluster`|64×56|rect (-26,-16,52,16)|false / props|base footprint||
|`tavern_coat_rack`|48×80|rect (-16,-8,32,8)|false / props|base footprint||
|`tavern_lantern_hang`|32×64|none (0,0,0,0)|true / overhead|none||
|`tavern_lantern_beam`|32×96|none (0,0,0,0)|true / overhead|none| **NOT USED IN TAVERN** (frames kept)|
|`tavern_wall_sconce`|40×56|none (0,0,0,0)|false / props|none| **NOT USED IN TAVERN** (frames kept; Grant removed sconces 2026-11-09)|
|`tavern_chandelier`|64×112 (grew up from 64×80 for hang chain)|none (0,0,0,0)|true / overhead|none|| **NOT USED IN TAVERN sample** (frames kept).
|`tavern_antlers`|48×48|none (0,0,0,0)|false / props|none||
|`tavern_shield_wall`|40×56|none (0,0,0,0)|false / props|none||
|`tavern_hearth_chair`|40×64|rect (-14,-12,28,12)|false / props|base footprint||
|`tavern_woodpile`|64×48|rect (-26,-14,52,14)|false / props|base footprint||
|`tavern_hearth_wall_burn_down_0`|96×128|rect (-36,-18,72,18)|false / props|base footprint||
|`tavern_hearth_wall_burn_down_1`|96×128|rect (-36,-18,72,18)|false / props|base footprint||
|`tavern_hearth_wall_burn_down_2`|96×128|rect (-36,-18,72,18)|false / props|base footprint||
|`tavern_hearth_wall_burn_down_3`|96×128|rect (-36,-18,72,18)|false / props|base footprint||
|`tavern_hearth_wall_burn_down_4`|96×128|rect (-36,-18,72,18)|false / props|base footprint||
|`tavern_hearth_wall_burn_down_5`|96×128|rect (-36,-18,72,18)|false / props|base footprint||

### Anims
- `tavern_hearth_wall_burn`: 6 frames @ 8 fps loop (`tavern_hearth_wall_burn_down_<i>`). Alias: `meta.aliases.tavern_hearth_wall` → frame 0.
- v5 freestanding `hearth` left untouched (read-only).

### Path / rug
- Atlas at `runtime/props/` (Grant).
- `tavern_rug` frame retained but **not used in tavern** sample (see layouts/tavern_reference.json).
- `tavern_lantern_beam` / `tavern_lantern_hang` frames retained but **not used in tavern** (Grant 2026-11-09).
- `tavern_wall_sconce` frames and atlas entry retained but **not used in tavern** — Grant removed both sconces on 2026-11-09. Tavern light sources are the hearth (`tavern_hearth_wall`) and the two `interior_candle_table` only; no glow decals or light pools in the layout.

### Layouts
- `layouts/tavern_reference.json` — placement list (ids, feet x/y, layer, depth, collision)
- `layouts/tavern_reference.tmj` — Tiled-ready object layer + wall/floor gid sketch

### Runtime SHA256
- `runtime/ground/interior_market_wall_trim.png` 1176 B `74b4f945e30e4d26b7fc7e7b855e87876336a9f590e75f8106e87fd519511097`
- `runtime/ground/interior_market_wall_trim.tsj` 8415 B `5045a37101465e9e13c95f8243c8eff7977b89816754ce1ac9dd83fbf1e397c6`
- `runtime/ground/interior_tavern_wall_trim.png` 1077 B `3626b1c3e8d029f828541a875399b0e53366873f9f6e44b6f73c65ae1200692e`
- `runtime/ground/interior_tavern_wall_trim.tsj` 8415 B `660eda99cf84bb97d6381dc3caf0b45d9d726de36e581873f74365d8285a64c4`
- `runtime/props/PAIRING.md` 262 B `2d5de40eae5fa9b03b74d4f33e234af9f1e7fe9c65729763333b451a0024e4db`
- `runtime/props/interior_props.json` 29205 B `ac882e63dff1370800f7d51bf765f52371c1aed810d7440ed4ce932f84fec09b`
- `runtime/props/interior_props.png` 19267 B `a428ed84e8d34b222860ac6a1d9f51b408ec5ce97257a48695ff0bd0a41d052d`
- `runtime/props/pairing.json` 476 B `3c6583f0a43e6d6116cecdad8e1d9294ba8b86e4423e23460b3246970e4735f3`

### Previews reviewed
- `previews/gateB2_tavern_crop3x_room.png`
- `previews/gateB2_tavern_crop3x_wall.png`
- `previews/gateB2_tavern_footprints_native1x.png`
- `previews/gateB2_tavern_native1x.png`
- `previews/props_b2b_contact_1x.png` / `_3x.png`

## B2b art-pass notes (2026-11-09)
- `tavern_chandelier` canvas grew **64×80 → 64×112** upward for a readable hang chain (ID/anchor/footprint/tall unchanged).
- Hearth burn frames: stone courses/mortar/mantel, soot firebox, logs, andirons, glow; 6@8 kept.
- Woodpile: end-grain logs + hatchet. Chair: 3/4 toward hearth.
