# COMBAT-DIAG-1 — knight melee, knight block, lightning

Diagnosis only. No gameplay code is changed in this branch. Confirming tests live in `client/src/game/combat/__tests__/combatDiag1.test.js` and are `it.skip` so CI stays green. Unskip them after the fix. Do not invert the assertions to match the broken behavior.

Ran unskipped against current main. All five failed. Observed results are under each bug. After `it.skip`, `npm test` and `npm run build --workspace client` are green.

Do not edit `art-source/blendsmith/**`, lore files, or `package.json`. Do not change the 70% block reduction or lightning's 15 damage / 10 mana.

---

## Bug 1 — Knight melee deals no damage

### Root cause

The swing does run on the right frame. `Player._checkAttackHitFrames` (`client/src/game/actors/Player.js` 1690–1713) reads atlas `hitFrames`, which for the knight sword is `[3]` (`client/public/assets/characters/knight/knight_attack.json` 712–714), and calls `executePlayerMeleeHit` with that index. `getAnimationFrameIndex` parses `knight_attack_down_3` as 3. Frame skip is not the cause: calling `executePlayerMeleeHit` directly on frame 3 still misses.

The miss is the hit volume. `executePlayerMeleeHit` (`client/src/game/combat/hitSystem.js` 237–263) intersects that one atlas rect with `computeWorldHurtbox`. The knight sword rects are above the feet and, for down and left, are the same upper-left box:

| facing | rect in `knight_attack.json` 716–741 | bottom (`y + h`) |
| --- | --- | --- |
| down | `{ x: -68, y: -68, w: 56, h: 40 }` | -28 |
| left | `{ x: -68, y: -68, w: 56, h: 40 }` | -28 |
| right | `{ x: 12, y: -68, w: 56, h: 40 }` | -28 |
| up | `{ x: 12, y: -100, w: 56, h: 57 }` | -43 |

`rectIntersects` (`hitSystem.js` 219–226) is strict, so edges that only touch do not count. A goblin hurtbox is `{ x: -16, y: -23, w: 31, h: 23 }` (`client/public/assets/enemies/goblin/goblin.json` 2130–2136). Its top is `y = -23`. Every sword rect ends at `y <= -28`, so a goblin whose feet are on the knight's ground line is entirely below the rect. Overlapping feet does not help: the boxes still miss in Y. A goblin one tile in front (larger Y when the knight faces down) is further from the rect.

`attack_2` frame 3 (`knight_attack2.json` 716–742) has the same shape. Down bottom is -38. Same miss. Both sheets go through `executePlayerMeleeHit`. The sheet key is `getSheetForAnim('attack')` (`hitSystem.js` 241), which already remaps to `knight_attack2` while `currentAttackType === 'attack_2'` (`Player.js` 339–341). The sheet lookup is not the bug.

The down rect sits up-screen of the feet, so a down-facing swing damages a goblin standing one tile behind the knight and misses the goblin he is facing.

`computeWorldHitbox` (`hitSystem.js` 145) anchors on `body.bottom` instead of the feet pivot. That is not required to reproduce the miss. Leave `computeWorldHitbox` and `computeWorldHurtbox` alone so enemy swings do not move.

The only placements that connect today are `attack` up at 32px and `attack_2` up at 32px (a few pixels of X overlap). Every other facing at 0, 8, and 32px misses, including point-blank.

### Evidence

Unskipped `combatDiag1.test.js`:

- `hits a goblin overlapping the knight and one tile in front, on every facing` — 22 misses, all `hits=0 hp=36`. Not in the miss list (they already hit): `attack up @ 32px`, `attack_2 up @ 32px`.
- `does not hit a goblin standing one tile behind the facing` — only `down behind hits=1 hp=24` (sword damage is 12). Left, right, and up did not tag the goblin behind them.

### Fix spec

Edit `executePlayerMeleeHit` only.

1. Keep the active-frame gate. If `getHitbox(...)` returns null, return 0. That preserves `ignores frame that is not a hitFrame` in `hitSystem.test.js`. Do not read the returned rect's `x/y/w/h` for the intersection. Those rects are what miss in front and hit behind.
2. When a hitbox exists, build this feet-space rect for `player.facing`. `+y` is down. Anchor it at `player.x`, `player.y` (the sprite origin). Do not use `body.bottom`. Multiply `x, y, w, h` by `player.scaleX || player.scale || 1`.

| facing | rect |
| --- | --- |
| down | `{ x: -20, y: -24, w: 40, h: 64 }` |
| up | `{ x: -20, y: -40, w: 40, h: 52 }` |
| left | `{ x: -40, y: -24, w: 56, h: 48 }` |
| right | `{ x: -16, y: -24, w: 56, h: 48 }` |

3. Intersect that world rect with the existing `computeWorldHurtbox(enemy)`. Do not change `computeWorldHurtbox`. These rects were checked against it, including the goblin footprint shift `body.bottom = feet + 4`.
4. Same function covers `attack`, `attack_2`, and `charged_release`. Do not special-case the sheet. Charged frame 4 down ends at `y = -2` (`knight_charged.json` 1227–1232), so it also misses a tile ahead; the reach box replaces it on whatever frame `getHitbox` accepts.
5. Keep one hit per swing, `meleeDamageFor`, knockback, spark, and float. Spark may stay on the weapon tip.
6. Unskip both knight melee tests. Expected sword damage on a 36 HP goblin is 24. A goblin at distance -32 along facing must stay at 36.

---

## Bug 2 — Knight block is inconsistent

Two separate causes. A frontal block that does connect is supposed to leave 30% of the hit (`block.test.js` expects 10 damage to become 3). Do not change `BLOCK_DAMAGE_REDUCTION`.

### Root cause A — close attackers fall outside the 120° cone

`isFrontalHit` (`client/src/game/combat/block.js` 45–65) measures the angle from the knight's feet to the attacker's feet. The cone is 120° (`halfArc` 60). Overlap under 0.001px counts as frontal. Anything else must sit inside ±60°.

Goblins attack at `ATTACK_RANGE_PX` 36 (`client/src/game/ai/goblin.js` 29). `Enemy.executeAttackHit` passes the enemy's own `x, y` (`client/src/game/actors/Enemy.js` 435–438). A goblin at `(132, 116)` against a down-facing knight at `(100, 100)` is 35.8px away (inside attack range) and 63.4° off down. `isFrontalHit` returns false. `calculateBlockMitigation` (`block.js` 92–109) then returns full damage. `Player.takeDamage` (`Player.js` 851–898) plays no `block_hit` and enters `HURT`.

A goblin standing on the facing axis at the same range is inside the cone, so the shield works. That is the "sometimes".

### Root cause B — holding block through hurt never returns to block

`HURT` priority is 5 and `BLOCK` is 2 (`client/src/game/actors/stateMachine.js` 26–34), so `startBlock` cannot interrupt hurt. It stores `BLOCK` in the 150ms buffer (`Player.js` 712–714). The scene calls `startBlock` every frame while C is down (`HollowvaleScene.js` 519–524), so the buffer stays fresh.

When the hurt clip ends, `onAnimationComplete` (`Player.js` 967–972) consumes that buffer and, if it got one, does nothing with it. The knight stays in `HURT`. No later frame emits `animationcomplete` again. `startBlock` keeps failing `canInterrupt`, so C held after the flinch never raises the shield. Dodge and attack are lower priority than hurt, so they cannot break out either.

The attack-end and dodge-end handlers (`Player.js` 995 and 1002) drop a buffered `BLOCK` the same way. Holding C through a swing never starts the shield when the swing ends. The reappear handler at 1032 has the same shape.

After the first unblocked hit, further hits land at full damage while C is still held.

### Evidence

Unskipped:

- `mitigates a goblin inside attack range but outside the 60 degree half-angle` — `calculateBlockMitigation` returned `blocked: false` for damage 10 from `(132, 116)`.
- `returns to block when the hurt clip ends while C is still held` — after `knight_hurt_down` completed, `is(HURT)` was still true, so `isBlocking()` was not reached. Timestamps in that test are `Date.now()`, matching the handler's clock.

### Fix spec

1. In `isFrontalHit`, before the 120° test: if `hypot(dx, dy) <= 36` and the offset is not behind the facing, return true. Behind means the dot of the facing unit vector `(right 1,0; left -1,0; down 0,1; up 0,-1)` with `(dx, dy)` is `< 0`. Keep `hypot < 0.001` as frontal. Keep the 120° test for attackers farther than 36px so `block.test.js` still sees a true front at 40px and a true back at 40px. The `(132, 116)` case is 35.8px and has a positive down-dot, so it becomes frontal and `finalDamage` is 3.
2. Add one finish helper and use it from the hurt, attack, dodge, and reappear branches that currently call `consumeBuffer` and ignore the result. Behavior:
   - No buffer, or the buffer is older than 150ms: `transition(IDLE, { force: true })`, as today.
   - Buffered `BLOCK`: `transition(IDLE, { force: true })`, set `blockState.holding = true`, then `startBlock(now)` with the same `now` the handler already uses (`Date.now()`). `startBlock` from `IDLE` sets `blockState.active`, so `isBlocking()` is true.
   - Buffered `ATTACK`: force `IDLE`, then `attack(now)`.
   - Buffered `DODGE`: force `IDLE`, then `dodge(now)`.
   - Any other buffered state: `transition(that state, { force: true })`.
3. Do not change `BLOCK_DAMAGE_REDUCTION`, the 120° constant, or the chip-damage path in `takeDamage` (lines 857–876). A successful block still deals 3 on a 10-damage hit and stays in `BLOCK`.
4. Unskip both block tests.

---

## Bug 3 — Lightning passes through and deals no damage

### Root cause

The v2 bolt is a 96×32 beam whose pivot is the left edge. `spell_fx_v2.json` note at line 1034: origin `(0, 0.5)` at the staff tip, points `+x`, `setScale(dist/96, 1)` to the target. `spawnV2Spell` (`client/src/game/combat/spells.js` 455–497) does not do that. It spawns a `Projectile` with `size: 32`, `speed: 600`, `maxDist: 320`, `damage: 15`, origin from the frame pivot `(0, 0.5)`, and the facing vector. Down spawn is `(-37, -36)` from the feet (`mage_spells_v2.json` 2141–2145).

`HollowvaleScene._updateProjectiles` (`1308–1310`) sees `Projectile.update` and skips the legacy circle test. Collision is only `Projectile.update` (`client/src/game/actors/Projectile.js` 270–307).

`getBounds` (214–220) is a `size × size` box centered on `(x, y)`. That point is the tail, not the 96px tip. The box is not rotated and is not scaled by `dist/96`. Enemies are tested with `scene._enemyBox` (`HollowvaleScene.js` 1187–1194), which is the physics footprint. A goblin footprint is 26×8 at the feet (`goblin.json` 2122–2128), not the 31×23 hurtbox and not the 64×64 cell.

Down bolt from feet `(400, 400)` starts at `(363, 364)`. A 32px box on that centerline covers x 347–379. A goblin centered on the facing axis at `(400, 448)` has hurtbox x 384–415 and footprint x 387–413. The flight line misses both by about 5px, forever. The 64px cell still overlaps the beam (sprite x 368–432, beam to 379), so the graphic crosses the drawing and no hit is registered.

Nothing stops the bolt on a miss. At `distanceTraveled >= maxDist` it calls `impact(null)` (`Projectile.js` 305–306). `impact` with a null target (320–337) does not call `_applyPlayerHit`. The sprite then destroys. Play result: the bolt passes the first enemy, the impact plays at the end of the 320px path, HP does not change.

### Evidence

Unskipped `stops on the first enemy along facing and does not damage the one behind it`.

Setup: mage feet `(400, 400)` facing down, goblin A at `(400, 448)` with 40 HP, goblin B at `(400, 620)` with 40 HP, `_enemyBox` reading the footprint. `castLightning`, then `update` at `dt = 0.016` until inactive.

Observed: `first.hp` stayed 40 (expected 25), `second.hp` stayed 40, `distanceTraveled` 326.4, `isImpacted` true, `active` false. The bolt ran past `maxDist` 320 and ended with no target.

### Fix spec

Handle lightning inside `Projectile.update` when `impactType === 'lightning'` and `owner === 'player'`. Leave fireball, leech, arrows, and vials on the 32px box.

1. Ray origin is the caster's feet (`this.shooter` or the player passed into the projectile), not the staff-tip spawn. Direction is the existing unit `dirX, dirY`. Corridor half-width is 20px. Length is `maxDist` (320).
2. `spawnV2Spell` must pass the caster on the lightning projectile (`shooter: player` is enough). The test's mage is the object passed to `castLightning`.
3. Test enemy hurtboxes with `computeWorldHurtbox` from `hitSystem.js`. Do not use `_enemyBox` for lightning. On spawn and after each move, pick the intersecting hurtbox with the smallest forward distance `>= 0`. Ignore enemies with `hp <= 0`.
4. On that enemy, set `distanceTraveled` to the forward distance (this fixture is about 48, and the test requires `< 100`), call `impact(enemy)` once, and do not keep moving. `_applyPlayerHit` already subtracts `scaleOutgoingDamage(this.damage)`, which is 15 here, so 40 HP becomes 25. The second goblin at 220px must stay at 40.
5. If a solid in `scene._solidRects` is closer along the corridor than the enemy, `impact(null)` there instead. If nothing is hit, the current maxDist `impact(null)` stays.
6. Visual, from the atlas note: keep origin `(0, 0.5)`, `setRotation(atan2(dirY, dirX))`, and `setScale(hitDist / 96, 1)` so the 96px art stretches from the staff tip to the stop point. The staff-tip spawn offset stays the draw origin. It must not be the ray origin, or the down offset of x=-37 keeps missing a centered hurtbox.
7. Do not change `LIGHTNING_MANA_COST` or the damage field `15`.
8. Unskip the lightning test.

---

## Files

| file | this branch | fix agent |
| --- | --- | --- |
| `client/src/game/combat/__tests__/combatDiag1.test.js` | added, five `it.skip` | unskip, do not weaken |
| `docs/plans/combat-diag-1.md` | this note | follow it |
| `client/src/game/combat/hitSystem.js` | untouched | reach rect in `executePlayerMeleeHit` |
| `client/src/game/combat/block.js` | untouched | close-range front half in `isFrontalHit` |
| `client/src/game/actors/Player.js` | untouched | buffer finish helper |
| `client/src/game/actors/Projectile.js` | untouched | lightning corridor |
| `client/src/game/combat/spells.js` | untouched | pass the caster into the bolt |

## Not the cause

- Hit-frame parsing and the 11 fps clip. The melee tests call frame 3 directly.
- `body.bottom` in `computeWorldHitbox`. Real, but the atlas rects miss even when anchored on the feet. Leave the shared helpers so enemy attacks stay put.
- Block chip damage. 70% is the package 1-6 rule.
- The legacy projectile loop in `HollowvaleScene._updateProjectiles`. Lightning never reaches it.
