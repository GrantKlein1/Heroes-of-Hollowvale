# npc_bartender: Tharos, keeper of the Embered Flagon (final sheet v1.0, not integrated)

Files: `npc_bartender.png` (832x1632) and `npc_bartender.json` (Phaser 3 JSON-hash, untrimmed 64x96 cells). The gate D draft `npc_bartender_gateD_sample.*` is superseded by these files and kept only for history.
- Origin is `setOrigin(0.5, 0.9271)` (89/96, the same feet row as the knight). pxPerUnit is 36.923. Scale is 1.
- Left and right are rendered separately. **Do not use flipX.**
- `meta.footprint` is ellipse (-13,-4,26,8) relative to the feet. Tharos is not hittable (`hurtbox: null`).
- Rows are `<clip>:<dir>` in this order: idle x4, talk x4, bottle_clean x4, wipe_counter (down only), gesture x4.

| clip | frames | fps | playback | facings | duration |
|---|---|---|---|---|---|
| idle | 4 | 6 | loop | down, left, right, up | 667 ms |
| talk | 6 | 8 | loop | down, left, right, up | 750 ms |
| bottle_clean | 13 | 8 | one-shot, then idle | down, left, right, up | 1625 ms |
| wipe_counter | 12 | 8 | one-shot, then idle | **down only** | 1500 ms |
| gesture | 10 | 8 | one-shot, then idle | down, left, right, up | 1250 ms |

Frame names are `npc_bartender_<clip>_<dir>_<i>`. Every idle variant's first and last frame is byte-identical to `idle_<dir>_0`, so you can cut in and out of idle at frame 0 with no pop. `talk_<dir>_0` also equals `idle_<dir>_0`.

## Idle variants (`meta.idleVariants`)
- Loop `idle`. After a random **6–14 s**, pick a variant valid for the current facing (equal weights, no immediate repeat).
- Play it once, return to `idle` at frame 0, then re-roll the timer.
- Don't start a variant while `talk` is playing. On interaction, switch to `talk` at the next return to idle frame 0, or immediately; frame 0 matches either way.

**wipe_counter is down only.** The rag drops to the top line of the Batch 1 `tavern_bar_counter`, and that prop exists only south-facing. In the other facings he would be wiping empty air at thigh height, so the variant isn't offered there.

**bottle_clean note.** He dips to set the tankard down and take a bottle; the props swap on frames 2 and 10, at the lowest point. Facing down behind the bar, the counter hides the swap. In left, right and up the swap is visible at knee height and reads as a quick grab from a low shelf. Prefer facing down.

## Phaser 3
```js
this.load.atlas('npc_bartender','assets/npc_bartender/npc_bartender.png','assets/npc_bartender/npc_bartender.json');
const meta = this.cache.json.get('npc_bartender')?.meta; // or read the file once
const A = { idle:[4,6,-1], talk:[6,8,-1], bottle_clean:[13,8,0], wipe_counter:[12,8,0], gesture:[10,8,0] };
for (const [clip,[n,fps,rep]] of Object.entries(A)) for (const d of (clip==='wipe_counter'?['down']:['down','left','right','up']))
  this.anims.create({ key:`npc_bartender_${clip}_${d}`, frames:this.anims.generateFrameNames('npc_bartender',{prefix:`npc_bartender_${clip}_${d}_`,start:0,end:n-1}), frameRate:fps, repeat:rep });
const tharos = this.add.sprite(x, y, 'npc_bartender', 'npc_bartender_idle_down_0').setOrigin(0.5, 0.9271).play('npc_bartender_idle_down');
const pool = d => d==='down' ? ['bottle_clean','wipe_counter','gesture'] : ['bottle_clean','gesture'];
const schedule = () => this.time.delayedCall(Phaser.Math.Between(6000,14000), () => {
  if (talking) return schedule(); const v = Phaser.Utils.Array.GetRandom(pool(dir));
  tharos.play(`npc_bartender_${v}_${dir}`).once('animationcomplete', () => { tharos.play(`npc_bartender_idle_${dir}`); schedule(); });
});
schedule();
```
Readability tweak, approved after Gate D: the shirt's silhouette rim uses `shirt_md` (#c2b090) instead of `shirt` (#d8cbb0), applied to shirt pixels within 4 px of the exterior, so he separates from the plaster wall. Design, palette, lighting and idle motion are otherwise unchanged. Before the rim pass, the idle frames are byte-identical to the approved Gate D frames.

**gesture, left facing (QA fix 2026-11-09).** Facing left the raised far hand used to slip behind his head on frames 3, 5 and 7. The left row now uses its own wave beats (forearm 35↔75°), so the hand stays visible on every raised frame. Only gesture_left frames 3–7 changed; every other frame is byte-identical to the previous sheet.
