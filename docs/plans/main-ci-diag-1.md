# MAIN-CI-DIAG-1 — knight swings miss on main CI

Diagnosis only. No gameplay code in this branch.

Both specs fail because the sword's contact frame is never tested, not because the goblin is outside the reach box, and not because of #145. #145 only renames exit beacons and draws debug prop rects in `HollowvaleScene.js`. `hitSystem.js` is unchanged from the green PR head `d4a5d6a` to `210a9d0`. The goblin offset the specs use is inside the right-facing reach.

## Root cause

`Player._checkAttackHitFrames` (`client/src/game/actors/Player.js` 1706–1731) reads only `anims.currentFrame`. Knight sword `hitFrames` is `[3]` at 11 fps (`knight_attack.json`), about 91 ms per frame. Phaser's `AnimationState` has `skipMissedFrames === true`, so one game step whose delta is longer than a frame advances the clip several frames inside the animation update, before this method runs. The contact frame is never the current frame, `_hitFramesProcessed` stays empty, and `executePlayerMeleeHit` is not called. HP does not change. Later frames cannot retry it.

That is a real gameplay miss: any hitch during the swing deletes the hit. It is the same failure CI reports.

- `hit-timing.spec.ts:134` waits 5 s for HP to drop. After a 400 ms `scene.game.step` while the clip was on `knight_attack_right_1`, the frame was `knight_attack_right_5`, `_hitFramesProcessed` was `[]`, HP stayed 36, and that wait timed out.
- `attack-combat-regression.spec.ts:121` expects 88 and gets 100 when the same skip happens on an unslowed swing. CI marks that spec flaky (a retry still sees frame 3). The slowed hit-timing clip failed every retry on runs 44636474216 (`1b6a904`) and 45276400599 (`210a9d0`).

Isolated on this machine, with normal frame deltas, both specs passed (`2 passed`). Live boxes at the spec offset overlapped, and frame 3 dropped a goblin from 36 to 24:

- player feet `(325.33, 345.6)`, reach right `x 309.33–365.33`, `y 321.6–369.6`
- goblin feet `(360.33, 330.6)`, hurtbox `{x:-16,y:-23,w:31,h:23}` anchored at `body.bottom` → `x 344.33–375.33`, `y 315.6–338.6`

`attack-combat-regression` places the same `+35, -15` offset at `(200, 200)` / `(235, 185)`. Do not move those spawns.

## Minimal fix

`client/src/game/actors/Player.js`, `_checkAttackHitFrames`, lines 1706–1731.

Track the previous attack frame index. When the index jumps forward, run the existing `hitFrames.includes` / `executePlayerMeleeHit` body for every index from `previous + 1` through `current`, and mark each hit frame in `_hitFramesProcessed`. A new swing starts at a lower index (0); scan only that index, not the gap behind it. Initialize the tracker to `-1`. No reach-rect, spawn, or map edit.
