# items_b13 – Ashen Cultist ember bolt (B13) – NOT FROZEN, awaiting Grant

## Files
| path | what |
|---|---|
| runtime/ashen_bolt.png | 192x64 RGBA atlas (same size/layout as main characters/mage/fireball.png), sha256 1bb5806e9726e1df… |
| runtime/ashen_bolt.json | Phaser JSON hash, 12 frames, 32x32 cells, untrimmed; frame rects identical to fireball.json; same meta keys (app/version/image/format/size/scale), sha256 1b25dd368c0b0888… |
| frames/ashen_bolt_{fly,hit}_{0-5}.png | 32x32 pixel frames (pack source) |
| render_hi/*.png | 128x128 Blender renders (4x of the cell) |
| scripts/build_ashen_bolt.py | Blender side (render_hi) |
| scripts/pack_ashen_bolt.py | pixelize + pack -> frames/, runtime/ |
| scripts/make_gate.py | previews/b13_ashen_bolt_gate.png |
| scripts/run_all.sh | gated render + pack (python3 scripts/make_gate.py afterwards) |
| palette.json | 10-colour palette, all from the B11 cultist palette (enemies_b11/palettes/ashen_cultist.json) except the outline |
| previews/b13_ashen_bolt_gate.png | gate: 1x + 4x over main grass tile vs mage fireball and cultist; rotation 0/45/180 |

## Layout (identical to fireball)
Row 0 (y=0): ashen_bolt_fly_0..5 at x=0,32,..160. Row 1 (y=32): ashen_bolt_hit_0..5. Frame names: `ashen_bolt_fly_<i>`, `ashen_bolt_hit_<i>`.
Pointing RIGHT (+x). The sprite is a plain Phaser atlas frame: origin default (0.5, 0.5) = cell centre (16,16), the same as the fireball; no pivot/anchor keys exist in fireball.json, so none were added.
Animation timing is NOT in the atlas (main defines it in client/src/game/combat/spells.js): fireball_fly = 6 frames @ 12 fps, repeat -1; fireball_hit = 6 frames @ 14 fps, repeat 0. The bolt was designed for those fps (fly cycle = 500 ms, hit = 429 ms).

## Drop-in (for the code owner; nothing was edited here)
cultist.js currently: EMBER_BOLT_TEXTURE='fireball', EMBER_BOLT_FLY_ANIM='fireball_fly', EMBER_BOLT_HIT_ANIM='fireball_hit', spawn frame 'fireball_fly_0', EMBER_BOLT_SCALE 0.7.
To use this art: load atlas key 'ashen_bolt' (ashen_bolt.png/.json), create anims 'ashen_bolt_fly' (frames ashen_bolt_fly_0..5, 12 fps, repeat -1) and 'ashen_bolt_hit' (ashen_bolt_hit_0..5, 14 fps, repeat 0) like the fireball ones, then set EMBER_BOLT_TEXTURE='ashen_bolt', the two anim constants, and the spawn frame 'ashen_bolt_fly_0'. Do not rename/replace the mage's 'fireball' key (spells.js still uses it).

## Look
Narrow dart (about 5 px tall x 25 px long incl. nose): steady charcoal core (#2b2931) with a #58535f highlight, ember rim (#e8661a over #8a2c0a), white-hot nose (#ffbe36/#fff0a8), flickering ember licks behind the body, a short sooty ash trail (charcoal -> ash grey puffs) and 3 drifting ember flecks. The core is the same pixel set in all 6 fly frames (no wobble under rotation); only the rim glow, licks, trail puffs and flecks change; the loop is exactly periodic (frame 6 == frame 0).
Hit: 0 ember flash -> 1 star burst -> 2 burst + ash puffs -> 3 peak (ember sphere, ash chunks, flung flecks) -> 4 core shrinks, ash puffs drift out -> 5 only ash specks and ember flecks (21 px) = dissipated.
Palette (10): outline #241a1c, char_dk #2b2931, char #58535f, ash #716b7a, ember_dk #8a2c0a, ember_rim #a3400d (unused), ember #e8661a, hot #ff8a1f, flame #ffbe36, spark #fff0a8.

## Pipeline / render settings
Blender 4.5.3, B11 enemy settings (enemies_b11/scripts/b11_bl.py setup_render): BLENDER_EEVEE_NEXT, taa_render_samples 1, filter_size 0.0, film_transparent, view_transform Standard, 2 threads; NO Cycles. Orthographic camera along +Y, 128x128 px (1 game px = 4 render px), flat emissive materials in exact palette colours (no lights; the bolt is self-lit, and a fireball-style flat look matches main), depth order by object offsets.
Downsample = kit/pixel.py Pix.pixelize (4x4 mode filter, palette snap, binary alpha), then a 1 px outline (#241a1c) around bodies (not around detached 1-2 px flecks, like the fireball's flecks), and an assertion that nothing touches the cell edge.
Alpha: main's fireball.png and the B11 cultist sheets are BINARY alpha (only 0 and 255, 0 semi-transparent pixels), so the bolt is binary too ("soft" edges do not exist on main; forcing soft alpha would look out of place).

## Frame stats (opaque px, bbox x0,y0,x1,y1 in the cell)
- ashen_bolt_fly_0: 165 px, bbox [1, 11, 27, 19]
- ashen_bolt_fly_1: 162 px, bbox [2, 12, 27, 19]
- ashen_bolt_fly_2: 162 px, bbox [2, 11, 27, 19]
- ashen_bolt_fly_3: 164 px, bbox [1, 11, 27, 19]
- ashen_bolt_fly_4: 153 px, bbox [1, 12, 27, 19]
- ashen_bolt_fly_5: 147 px, bbox [1, 12, 27, 19]
- ashen_bolt_hit_0: 92 px, bbox [11, 10, 22, 21]
- ashen_bolt_hit_1: 223 px, bbox [6, 4, 26, 24]
- ashen_bolt_hit_2: 387 px, bbox [4, 4, 28, 28]
- ashen_bolt_hit_3: 516 px, bbox [1, 2, 29, 29]
- ashen_bolt_hit_4: 302 px, bbox [5, 3, 28, 29]
- ashen_bolt_hit_5: 21 px, bbox [4, 7, 27, 25]
Fireball for comparison: fly 186-216 px (bbox ~x5-28, y8-24), hit 14-525 px.
Cell border: every frame has >=1 px fully clear on all four sides (asserted in the pack script; tightest = hit_3 x1..29,y2..29, fly trail x1).

## QA
kit/qa.py items_b13 (no --freeze): QA 21/0 – it only ran the "frozen/other trees unchanged" check (it has no atlas-contract group for this kind of batch). The contract checks (size, names, frame rects, meta keys, binary alpha, palette-only, clear border) were done by script, see the report.
Not frozen; Grant has not approved.
