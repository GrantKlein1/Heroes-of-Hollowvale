# npc_vendor: Brackenford market trader (final sheets)
`npc_vendor.png` (768x1536) + `npc_vendor.json` (Phaser JSON-hash, 136 frames). Same contract as npc_bartender: 64x96 cells, origin (0.5, 0.9271) = feet row 89 (knight contract), 36.923 px/unit, footprint ellipse (-13,-4,26,8) relative to the feet pivot, **not hittable** (hurtbox null).
Left and right are rendered separately. **Do not use flipX.** Frame names: `npc_vendor_<clip>_<dir>_<i>`.
The gate sample (`npc_vendor_gate_sample.{png,json}`) is kept; its 16 idle frames are byte-identical to the idle rows here.

| clip | frames | fps | playback | facings | duration |
|---|---|---|---|---|---|
| idle | 4 | 6 | loop | down, left, right, up | 667 ms |
| talk | 6 | 8 | loop (while dialogue is open) | down, left, right, up | 750 ms |
| count_coins | 12 | 8 | one-shot, then idle | down, left, right, up | 1500 ms |
| present_goods | 12 | 8 | one-shot, then idle | down, left, right, up | 1500 ms |

**Idle variants.** Loop idle; after a random 6–14 s play `count_coins` or `present_goods` once (never the one that just played, never while talk is playing), return to idle frame 0 and re-roll the timer. Both variants start and end on idle frame 0 (byte-identical), so they can cut in and out at any idle loop boundary. No clip is down-only: both variants read in every facing (no stall-specific contact), so no `downOnlyReason` is needed.
- **count_coins**: reaches into the purse on his right hip, holds a stack of gold coins in his left palm and counts three taps with a small knee dip and lean on each; closes his hands on the coins and settles. The coins are a hand prop shown only on frames 3–8.
- **present_goods**: showman "behold!": arms flung wide, then his left hand sweeps palm-up toward the counter (toward the stall at the reference placement), a small bow, back to the clasp.
- **talk**: sales pitch: the right hand opens out in a big palm-up arc to shoulder height, with a head nod/tilt, torso twist and knee bob.

**Stall placement (reference).** Place B1 `market_stall_base` and `market_stall_awning` at the same x/y (origin 0.5,1.0, per B1 PAIRING.md). Put the vendor's feet at **stall origin + (-72, -3)**: the open left end of the counter, just outside the left post. He depth-sorts before the base, and the awning does not overlap him. On every frame of every clip, his head, shoulders and upper torso are clear of the baskets, posts/braces and awning valance (0 px occluded; checked in qa_vendor_final.py). Outstretched hands (talk/present_goods toward the stall, count_coins facing right) pass behind the left post on 23 frames, by design. The same offset is in `meta.placement`.

Phaser:
```js
this.load.atlas('npc_vendor','npc_vendor.png','npc_vendor.json');
const A={idle:[4,6,-1],talk:[6,8,-1],count_coins:[12,8,0],present_goods:[12,8,0]};
for (const [clip,[n,fps,rep]] of Object.entries(A)) for (const d of ['down','left','right','up'])
  this.anims.create({key:`vendor_${clip}_${d}`,frames:this.anims.generateFrameNames('npc_vendor',{prefix:`npc_vendor_${clip}_${d}_`,start:0,end:n-1}),frameRate:fps,repeat:rep});
// sprite.setOrigin(0.5, 0.9271); place feet at stall.x-72, stall.y-3
```
Build: `blender -b --python-exit-code 1 --python scripts/build_npc_vendor.py -- --samples 256 --out render_hi_vendor_full` → `python3 scripts/pack_vendor_final.py` → `python3 scripts/vendor_scene.py` → `python3 scripts/qa_vendor_final.py`.
Not integrated in the game; runtime behaviour is not verified.
