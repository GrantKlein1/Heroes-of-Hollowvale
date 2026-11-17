# CV-1 refined spec (Wave 1 planning, verified on `origin/main` @ `4e68ca0`)

Tightens `prompts/CV-1.md`. If this file conflicts with the prompt, the prompt wins.

## 1. Verified facts

| Prompt claim | Status | Evidence |
|---|---|---|
| `cavern_mouth.tmj` is 24x29 | CONFIRMED | `width: 24, height: 29` (768x928 px) |
| 13 rows prepended, objects shifted +416 y | CONFIRMED | old script `mouthFeetY = 7 * TILE_SIZE` (224, `build_cavern.mjs` 125) -> committed mountain feet y 640 = 224 + 416 |
| Mountain feet (384,640), `mountain_mouth` atlases | CONFIRMED | props id 1 `mountain_mouth_base` and id 2 `mountain_mouth_arch` at x 128, y 0, 512x640; map properties `backdrop: "mountain_mouth"`, `propAtlases: "dungeon_props,dungeon_brazier,treasure_chest,mountain_mouth_props"` |
| Grass gids at firstgid 43 | CONFIRMED | tilesets `cliff@1 cliff_face@17 dungeon_wall_trim@21 dungeon_floor@37 grass@43` |
| Script still emits the pre-CB-1 24x16 mouth | CONFIRMED | `build_cavern.mjs` 66 `function buildCavernMouthMap()`, 68 `const height = 16;`, 299 propAtlases without `mountain_mouth_props`, 303 `tilesets: [tsCliff, tsCliffFace, tsDungeonWallTrim, tsDungeonFloor]` |
| Script also generates halls/treasure/lair | CONFIRMED, and they **already reproduce byte-for-byte** | Ran the script in a scratch worktree: `git diff --stat` touched only `cavern_mouth.tmj` (1252+/3028-). |
| Exact reproduction of the mouth is possible | **Very likely: every field checked** | All 5 embedded tilesets equal `loadTileset(name, firstgid)` output exactly. Ground matches one formula for all 696 cells: rows 0-16 `1 + ((((r-13)*4 + c) % 16) + 16) % 16`, row 17 = 0, rows 18-28 `43 + ((r + c) % 8)`. Collision: rows 0-16 = 1, row 17 = 17, rows 18-27 cols 0 and 23 = 1, row 28 = 1 except cols 17-20. Walls: row 17 only, `17 + (c % 4)`. `ground_detail` and `overhead` are all 0. `nextobjectid` 22 (= `nextObjId + 10` with 11 objects). The file ends with `}\n` (the script writes `+ '\n'`). |
| `wilderness.spec.ts` predates the taller map and the v5 tiles | **Partly WRONG** | Map size CONFIRMED stale: lines 144-145 `expect(dungeon.w).toBe(768)` / `expect(dungeon.h).toBe(512)`, while the mouth is now 768x**928**. "v5 tiles" is WRONG for the wilderness: O-V5-1 (#77) changed only `client/public/assets/tiles/dungeon_floor.png` among public tiles, and every tileset/prop name the spec asserts (`forest_floor`, `dirt_road`, `ash_ground`, `ash_fill`, `grass`, `wild_props_4b`, `tree_dead_*`, `ash_drift_*`, `ember_vent_burn_down_0`, `fern`, `mushroom_cluster`, `stump_mossy`, `log_fallen`) still exists in `client/src/game/terrain`. Both wilderness baselines were last set in 3-3 (#71). I did not run this spec (budget), so whether the two screenshots fail is unknown. |
| `cavern.spec.ts` may fail on the 24x29 mouth | Already updated | lines 61-62 expect 768x928; lines 97-98 expect mountain feet (384,640). |

Exact committed objects to reproduce (key order `id,name,type,x,y,width,height,visible,properties`):
- props 1-2 mountain base/arch at (128,0) 512x640; footprints from `client/public/assets/env/mountain_mouth_props/mountain_mouth_props.json` `meta.props` (base `{"x":-160,"y":-64,"w":320,"h":64,"shape":"rect"}`, arch `shape:"none"`, arch gets `layer: overhead`); 3 `cavern_rock_large_a` (160,592) 64x48; 4 `cavern_rock_large_b` (544,592) 64x48; 5-6 `cavern_torch_wall` (128,512) and (608,512) 32x64.
- zones 7 `spawn_default` and 8 `spawn_wilderness` (592,832); 9 `spawn_halls` (368,672); 10 `door_halls` (352,576) 64x64; 11 `exit_wilderness` (544,864) 128x64 with `targetSpawn: "HUB_RETURN_SPAWN"`. Keep the valueless `{ name: 'type', type: 'door' }` / `{ name: 'type', type: 'exit' }` properties exactly as the script already emits them (lines 254, 272).

## 2. Exact MAY-change list (tightened)

- `tools/maps/build_cavern.mjs`
- NEW `client/src/game/maps/__tests__/buildCavern.test.js`
- `client/public/maps/cavern_mouth.tmj`: `layers[name=ground].data` indices 0..311 (rows 0-12) only
- `tests/e2e/wilderness.spec.ts`, `tests/e2e/cavern.spec.ts`
- `tests/e2e/__screenshots__/wilderness-emberwood.png`, `tests/e2e/__screenshots__/wilderness-ashen-edge.png`, `tests/e2e/__screenshots__/cavern-mouth.png`
- No ADDITIONS needed.
- Must NOT commit (add to the must-not-change list): `cavern-halls.png`, `cavern-treasure.png`, `cavern-lair.png`, `cavern-lair-dragon-reset.png`. `cavern.spec.ts` rewrites all five cavern PNGs with plain `page.screenshot` (lines 131, 167, 186, 231, 268) on every run. Commit `cavern-mouth.png` only if part C changed tiles.

## 3. Overlap check

- Open PRs: none. `hv/IT-1` = `main`.
- Wave 1: no shared file. MX-1 owns `generate_tmj.mjs`/`build_interiors.mjs`/brackenford/market/tavern maps; SS-1 owns `brackenford-*.png`; PUB-1 owns `client/public/images/**`.

## 4. Test plan

A (generator):
- `node tools/maps/build_cavern.mjs --check`: build all four maps in memory, compare `JSON.stringify(map, null, 2) + '\n'` with each committed file **byte-for-byte**, print the first differing map, key or index, exit 1 on any difference, write nothing.
- `buildCavern.test.js`: `spawnSync(process.execPath, ['tools/maps/build_cavern.mjs', '--check'], { cwd: repoRoot })` -> `status === 0`. Also assert `git status --porcelain client/public/maps` is unchanged before/after, or compare file mtimes/bytes. **Do not `import` the script** (see trap 1).
- Expected today: `--check` is unrecognised and the script **writes** the 24x16 mouth (it has no CLI guard), so the test fails.
- Acceptance: `node tools/maps/build_cavern.mjs && git diff --exit-code client/public/maps` exits 0.

B (wilderness spec): run it first and paste the failures. Known required fix: lines 144-145 -> `expect(dungeon.w).toBe(768)`, `expect(dungeon.h).toBe(928)`. Update a screenshot baseline only if its diff is explained (state the cause per image). If the diff has no cause in a merged PR, do not update it; report it.

C (top rows): see trap 4 for how to see rows 0-12. Cliff is a 16-tile **corner-wang** set (`cliff.tsj` wangset `cliff_blob16`, bitmask NW=1,NE=2,SW=4,SE=8; gid = 1 + wangId). The committed rows 0-16 cycle all 16 corner variants diagonally, so unmatched corner edges sit side by side. That is a seam source by construction. The existing-tile fix is gid **16** (wangId 15, all four corners cliff) everywhere in rows 0-12. Whatever you change in the tmj **must be produced by the script** (change the formula for rows 0-12), or `--check` breaks. Do A first, then C in both places, then re-run `--check`. Rows 13-16 are outside the MAY range; list any seam there as a follow-up.

Commands: `npm test && npm run build --workspace client`, `node tools/maps/build_cavern.mjs --check`, `npx playwright test tests/e2e/wilderness.spec.ts tests/e2e/cavern.spec.ts --reporter=line`, then `git checkout -- tests/e2e/__screenshots__/cavern-{halls,treasure,lair,lair-dragon-reset}.png` (and `cavern-mouth.png` if C changed nothing).

## 5. Risks and traps

1. **`build_cavern.mjs` writes on import**: line 1074 `buildAllCavernMaps();` runs at module load with no `process.argv` guard. A vitest that imports it overwrites all four maps. Add a guard like `generate_tmj.mjs` 1413 (`fileURLToPath(import.meta.url) === path.resolve(process.argv[1])`) and spawn the check from the test.
2. Byte equality: compare strings, not parsed JSON, and include the trailing `\n`. Numbers like `1.0` scale must stay out of the mouth (`formatPropProperties` omits `scale` when it is 1.0).
3. **Don't "fix" the map to match the script.** Every field is reproducible from the script side (section 1). If some field still differs, STOP per the prompt and print the field.
4. Camera: the mouth uses cover zoom (`screenCamera.js` 95-99, not the `isTiled` branch), and the player cannot walk above row 18 (collision rows 0-17), so rows 0-12 (y < 416) are mostly off-screen in play. For the audit screenshot use an ad-hoc `page.evaluate`: `cam.stopFollow(); cam.setZoom(1); cam.setScroll(0, 0)`. It is not part of a committed spec.
5. Cavern spec is slow (it walks through four maps plus a dragon reset), and `wilderness.spec.ts` has `setTimeout(180000)`. Run each spec once, `--reporter=line`, no `--repeat-each`.
6. `wilderness.spec.ts` writes `/opt/cursor/artifacts/wilderness-fps.txt` (outside the repo). Harmless; ignore.
7. Playwright browser download can be blocked; see MX-1 trap 5 for the system-Chrome symlink.

## 6. Open questions for Grant

none
