# MX-1 refined spec (Wave 1 planning, verified on `origin/main` @ `4e68ca0`)

Tightens `prompts/MX-1.md`. If this file conflicts with the prompt, the prompt wins.

## 1. Verified facts

| Prompt claim | Status | Evidence |
|---|---|---|
| `market.tmj` `exit_village` has `targetSpawn = "door_market"` | CONFIRMED | zone id 12, `exit_village` (256,224) 128x128, `targetMap: "brackenford.tmj"`, `targetSpawn: "door_market"` |
| `tavern.tmj` `exit_village` has `targetSpawn = "door_tavern"` | CONFIRMED | zone id 12, same rect, `targetSpawn: "door_tavern"` |
| `door_market` x64 y96 64x128, `door_tavern` x256 y128 64x32, both `door`, not `spawn` | CONFIRMED | `brackenford.tmj` zones id 21 and id 18, `type: "door"`, `kind: "door"` |
| Scene places player at the zone centre | CONFIRMED | `HollowvaleScene.js` 1454-1459: `const namedTarget = typeof spawn === 'string' ? spawn : ...` then `px = targetZone.x + targetZone.width / 2` / `py = targetZone.y + targetZone.height / 2`. The string reaches it via `_activate` 601 `this.enterScene(zone.to, this._resolveSpawn(zone.spawn))` and `_resolveSpawn` 639 (returns the string unchanged). |
| Market exit lands at (96,160) inside the cottage, player cannot move | CONFIRMED (ran it) | `npx playwright test tests/e2e/market-approach.spec.ts` on clean main printed `[BF-1 Post-Exit Spawn Report] {"landingX":96,"landingY":160,"insideCottage":true,"canWalkSouth":false,"canWalkNorth":false,"canWalkEast":false,"canWalkWest":false}`. Cause is the **prop footprint**, not the collision tile layer: `cottage_base` (id 3) footprint resolves via `parsePropFootprint` to x 22-138, y 122-192, and (96,160) is inside it. The collision **tile** layer is empty at tiles (2..3, 3..6). |
| Tavern exit "check the same way" | Landing is (288,144) and it is **NOT stuck** | Headless `MapLoader` check with the knight body (23x7 at the feet): no overlap; 32 px sweeps S/E/W free, N blocked by the tavern footprint (x 198-346, y 42-128). It does land inside `door_tavern`, so "Press E to enter The Flagon" shows on arrival. Still add `spawn_from_tavern` as the prompt says (consistency), but report the tavern "before" honestly as walkable. |
| Generator zones near `door_market` line 848 | CONFIRMED | `tools/maps/generate_tmj.mjs` 848 `name: 'door_market'` (inside `buildBrackenfordMap` 678-903; `zonesObjects` 803-884; `door_tavern` 836) |
| Interiors `exit_village` near line 532 | CONFIRMED | `tools/maps/build_interiors.mjs` market: 521 `name: 'exit_village'`, **532** `targetSpawn: 'door_market'`; tavern: 294 `name: 'exit_village'`, **305** `targetSpawn: 'door_tavern'` |
| Regenerate gives spawn-only diffs | **WRONG on clean main** | See section 5, trap 1. Running `node tools/maps/generate_tmj.mjs` on untouched main already rewrites `brackenford.tmj`: the committed `door_market` was hand-appended last (id 21, has `"visible": true`, no trailing newline), but the generator emits it before `The Flagon`/`Brackenford` and renumbers them 19/20/21. `build_interiors.mjs` reproduces `market.tmj` and `tavern.tmj` byte-for-byte. `hearthmile/ruinwatch/wilderness.tmj` also reproduce byte-for-byte. |
| `market-approach.spec.ts` exists from BF-1 | CONFIRMED | It logs the landing report but asserts nothing about it (lines 103-144). |

Player body (from each atlas `meta.footprint`, applied in `Actor.js` 225-233 at the feet): knight 23x7, thief 18x5, dwarf 26x8. The mage has no `mage.json` base sheet, so test with the knight (index 0), as the existing specs do.

## 2. Exact MAY-change list (tightened)

- `tools/maps/generate_tmj.mjs`: in `buildBrackenfordMap` only.
- `tools/maps/build_interiors.mjs`: lines 305 and 532 only.
- `client/public/maps/brackenford.tmj`, `client/public/maps/market.tmj`, `client/public/maps/tavern.tmj`: regenerated, never hand-edited.
- NEW `client/src/game/maps/__tests__/interiorExits.test.js`
- `tests/e2e/market-approach.spec.ts`, `tests/e2e/interiors.spec.ts`
- `tests/e2e/tiled-registry.spec.ts`: **required**, not optional. Line 96 `expect(returnedPos.x).toBeCloseTo(288, -1)` (tolerance < 5 px) fails once the tavern exit lands at x 304.
- NEW `tests/e2e/__screenshots__/mx1-market-exit.png`
- Optional only if no fixture edits: `tools/maps/validate_map.mjs` + `client/src/game/maps/__tests__/validate.test.js`
- `MapLoader.test.js` / `mapRegistry.test.js` / `brackenfordApproach.test.js`: expected to need **no** change (none of them count Brackenford zones; `MapLoader.test.js` 222 counts zones of an inline fixture).
- No ADDITIONS needed.
- Must NOT commit (add to the must-not-change list): `tests/e2e/__screenshots__/bf1-market-approach.png`, `scene-tavern-interior.png`, `scene-market-interior.png`. `market-approach.spec.ts` (line 153) and `interiors.spec.ts` (lines 107, 231) overwrite them with `page.screenshot` on every run. Also do not commit `hearthmile.tmj`, `ruinwatch.tmj` or `wilderness.tmj`; the generator rewrites them, but they come out identical.

## 3. Collision-free spawn cells (how determined)

Method: `new MapLoader(brackenford.tmj)` in plain node (no Phaser needed), then `loader.checkCollision(rect)`, which tests the collision tile grid **and** every prop footprint, plus `loader.sweep(knightBody, dx, dy)` for ±32 px, plus an overlap test against every zone. Combined blocked grid (`#` = a 32x32 cell that overlaps a tile or footprint):

```
 0 ....................
 1 ..################..
 2 .#.#..##########..#.
 3 #####.###########.#.
 4 #####......#####..#.
 5 #####.............#.
 6 .#..............###.
 7 #####..#....########   <- river (cols 5-6 bridge, 8-11 ford)
 8 .#................#.
 9 .#......#.........#.
10 ..#######..#######..
11 ....................
```

"South of the market door" is the river (row 7, cols 0-4 blocked), so the nearest valid cell is on the north bank, just east of the door zone:

| Zone | Tile (col,row) | Rect | Feet (centre) | Result |
|---|---|---|---|---|
| `spawn_from_market` | (4,6) | x 128, y 192, 32x32 | (144,208) | cell free; knight body free; sweeps E and W ≥32 px free (N = cottage, S = river); overlaps no zone (door_market ends at x 128) |
| `spawn_from_tavern` | (9,5) | x 288, y 160, 32x32 | (304,176) | cell free; sweeps N/S/E/W all free; directly south of `door_tavern` (ends y 160); clear of the `The Flagon` landmark (7,5) and `Brackenford` landmark (10,4) |

Use exactly these rects. They are 32-aligned, `type: 'spawn'`, `properties: [{ name: 'kind', type: 'string', value: 'spawn' }]`, matching `spawn_default`/`spawn_south`.

## 4. Generator recipe (zero churn), verified in a scratch worktree

1. In `zonesObjects`, **move** the `door_market` object to the end of the array (after `Brackenford`) and add `visible: true,` right after `height: 4 * TILE_SIZE,`. Regenerating then reproduces the committed `brackenford.tmj` exactly, except for the trailing newline (`createTiledMapStructure` output is written with `+ '\n'`; the committed file has none).
2. Append `spawn_from_market`, then `spawn_from_tavern`, after `door_market`. They get ids 22 and 23 and `nextobjectid` becomes 24 (ids come from `if (!obj.id) obj.id = nextObjectId++` at line 564).
3. `build_interiors.mjs` 305 -> `spawn_from_tavern`, 532 -> `spawn_from_market`.
4. Run both generators, then `git status --short client/public/maps` must list only `brackenford.tmj`, `market.tmj`, `tavern.tmj`. `git diff` must show: brackenford = 2 new objects + `nextobjectid` 22->24 + trailing newline; market/tavern = one `value` line each. Anything else: STOP.

## 5. Overlap check

- Open PRs: none (`gh pr list --state open` -> `[]`). `origin/hv/IT-1` has 0 commits beyond `main`. No hard-lock file is touched.
- Other wave-1 packages: no shared file. CV-1 owns `build_cavern.mjs`/`cavern_mouth.tmj`; SS-1 owns `brackenford-*.png`; PUB-1 owns `client/public/images/**`. MX-1's new spawn zones are not drawn (`_drawBeacons` only draws prompts), so they do not change SS-1's overview baseline.

## 6. Test plan

Unit `interiorExits.test.js` (vitest, plain fs + `MapLoader`):
- For each map in `brackenford.tmj`, `market.tmj`, `tavern.tmj`: every zone with `type` or `kind` in {`exit`,`door`} and a `targetSpawn` -> load `client/public/maps/<targetMap>` (`brackenford.tmj`, `wilderness.tmj`) -> `loader.getZone(targetSpawn)` exists, `type === 'spawn'`, `properties.kind === 'spawn'`.
- `loader.checkCollision({x,y,width,height})` of that spawn rect `=== false`. **Use `checkCollision`, not the collision layer alone**: the market bug is a prop footprint, and the collision tile layer is clear under `door_market`.
- The spawn rect overlaps no `door`/`exit` zone on the target map (prevents arrival under a prompt).
- Expected today: 2 failures (market and tavern `exit_village` resolve to `type: 'door'`). `exit_south -> wilderness.tmj spawn_north` (288,32) passes today.
- Negative proof for acceptance (2): temporarily set line 532 back to `door_market`, regenerate, show the failing test output, then revert. Do not commit it.

E2E (`--reporter=line`; knight; read the body from `scene.player.body`, do not hard-code 23x7):
- `market-approach.spec.ts`, after the second exit: `expect(Math.hypot(x - 96, y - 160)).toBeGreaterThan(16)`; `expect(x).toBeCloseTo(144, 0)` and `expect(y).toBeCloseTo(208, 0)`; after one frame (trap 7) `loader.checkCollision({x:b.x,y:b.y,width:b.width,height:b.height}) === false` (expect body ≈ (132,204) 23x7); then `keyboard.down('ArrowRight')` and `waitForFunction(() => player.x >= x0 + 32, null, { timeout: 1000 })`, then `keyboard.up`. Take `mx1-market-exit.png` before moving.
- `interiors.spec.ts` tavern test, after the exit at line 127: landing (304,176) ±1, not (288,144), no overlap, moves ≥32 px with `ArrowDown` within 1000 ms. Add the same block to the market test after line 246.
- `tiled-registry.spec.ts` 96: `toBeCloseTo(304, 0)` and add `expect(returnedPos.y).toBeCloseTo(176, 0)`.
- Expected today: the new market/tavern landing asserts fail. `brackenford.spec.ts` fails 2 of 5 on clean main, with neither caused by MX-1 (see trap 4).

Commands: `npm test && npm run build --workspace client`, then the four Playwright specs from the prompt, then `git checkout -- tests/e2e/__screenshots__/bf1-market-approach.png tests/e2e/__screenshots__/scene-tavern-interior.png tests/e2e/__screenshots__/scene-market-interior.png`.

## 7. Risks and traps

1. **Generator churn on clean main**: use the section 4 recipe. Don't run `--out` tricks and then hand-copy; regenerate in place and inspect the diff.
2. **Screenshot side effects**: the two specs rewrite three tracked PNGs (section 2). Restore them before `git add`; never `git add -A`.
3. **Tavern "before" is not stuck**: don't fabricate a stuck tavern. Report (288,144), walkable, inside `door_tavern`.
4. **Pre-existing `brackenford.spec.ts` failures on clean main** (I ran it with system Chrome 157): (a) `brackenford-overview.png` diff ratio 0.06 > 0.05, owned by SS-1; (b) "Tavern door exit leads to tavern and NPC interaction opens dialogue" (line 196) fails at `locator('text=Tharos')`, because 3-1b (#76) moved Tharos to zone (320,40) 64x96 and the test interacts at the world centre (320,192). Neither is in MX-1's MAY list. Report both as pre-existing; do not fix.
5. **Playwright browser download** may be blocked (`cdn.playwright.dev` reset here). If `npx playwright install chromium` fails and a system Chrome exists, symlink it to `~/.cache/ms-playwright/chromium-<rev>/chrome-linux64/chrome` and `chromium_headless_shell-<rev>/chrome-headless-shell-linux64/chrome-headless-shell` (`touch INSTALLATION_COMPLETE` in each), and say so in the PR.
6. `npm test` is 595/595 client and 51/52 server on main offline; the 1 failure is `rerank.test.js` "fetch failed" (RR-1 fixes it).
7. **Stale body right after a teleport** (measured with a probe on main): after `player.setPosition(x, y); body.reset(x, y)`, `scene.player.body` reports the sprite's top-left `(x - 32, y - 89)` with size 23x7 until the next physics step. After one frame it moves to the feet: `(x - 12, y - 4)`, offset (20,85). The scene's own spawn uses the same calls (`_showTiledMap` 1474-1475). So in the e2e, wait one frame (`await page.waitForTimeout(100)`, or `waitForFunction` on `body.y > player.y - 10`) before reading `body` for the overlap assert. Otherwise you test the wrong rect. Existing specs that call `_tryInteract()` in the same `evaluate` as `setPosition` depend on this stale box (for example `interiors.spec.ts` reaches Tharos from (340,175)), so don't "fix" them.
8. `interiors.spec.ts` is green on main (2 passed, ran it). `market-approach.spec.ts` is green on main (1 passed).

## 8. Open questions for Grant

- The regenerated `brackenford.tmj` gains a trailing newline, because the generator always writes one. Is that 1-line EOF diff acceptable, i.e. not "churn" that should STOP the package? **Recommended default: yes, accept it and mention it in the PR.**
