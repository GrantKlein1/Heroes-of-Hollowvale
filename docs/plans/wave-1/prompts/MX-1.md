**Model:** grok-4.7 high effort (code-heavy; never fast). **Package:** MX-1 (Wave 1). One package = one agent = one PR.

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/`. Do ONLY package **MX-1**.

**Branch:** `git fetch origin && git switch -c hv/MX-1 origin/main` (main must be at or after `4e68ca0`, which has BF-1 #78). Never push to `main`, never merge, never enable auto-merge, never force-push, never touch other branches or PRs. Grant merges.

**Refined spec (optional):** run `git fetch origin hv/PLAN-W1`. If that branch exists and has `docs/plans/wave-1/MX-1.md`, read it (`git show origin/hv/PLAN-W1:docs/plans/wave-1/MX-1.md`). It may only TIGHTEN this prompt (exact line numbers, extra test cases, risks). If it conflicts with this prompt, this prompt wins; say so in the PR. If the branch is missing, ignore this paragraph.

**Hard lock (IT-1 is in flight until it merges):** do not touch `client/src/game/actors/Player.js`, `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/combat/balance.js`, `client/public/assets/manifest.json`, `client/src/game/assets/itemAnchors/**`, `client/src/game/actors/itemHold.js`, or anything under `client/public/assets/items/inhand/` unless this package's MAY list names it AND the package header says IT-1 has merged.

**Goal:** leaving the Market (and The Flagon tavern) puts the player back on the Brackenford map at a walkable spot outside the door, not inside a building.

**Verify on fresh main before coding (quote the evidence in the PR plan):**
- `client/public/maps/market.tmj` zone `exit_village` has `targetSpawn = "door_market"`. `tavern.tmj` has `targetSpawn = "door_tavern"`. Both names are `door` zones in `brackenford.tmj` (`door_market` x64 y96 64x128; `door_tavern` x256 y128 64x32), not `spawn` zones. `HollowvaleScene` places the player at the **center** of the named zone (`targetZone.x + width/2`), so the market exit lands at (96,160), inside the cottage footprint, and the player cannot move. Boot `/?qa=1` and reproduce it with `__scene.enterScene('market')` then the exit; record the landing (x,y) and whether `body.blocked`/collider overlaps.
- Check the tavern exit the same way and report its landing point.

**Fix (data + generators; NO scene code):**
1. In `tools/maps/generate_tmj.mjs` (Brackenford zones, around the `door_market` object near line 848) add two `spawn` zones, `spawn_from_market` and `spawn_from_tavern`, each a 32x32 cell on walkable, collision-free ground just OUTSIDE its door (south of the door, on the road/yard; pick the cell by reading the collision layer, not by guessing). Keep `door_market` / `door_tavern` unchanged.
2. In `tools/maps/build_interiors.mjs` (market `exit_village` near line 532, and the tavern equivalent) retarget `targetSpawn` to `spawn_from_market` / `spawn_from_tavern`.
3. Regenerate with the generators (`node tools/maps/generate_tmj.mjs`, `node tools/maps/build_interiors.mjs`) so `brackenford.tmj`, `market.tmj`, `tavern.tmj` are produced, not hand-edited. The `git diff` on those three tmj files must show only the new spawn objects and the two retargeted properties (no layer/tile churn). If the generators produce unrelated churn, STOP and report.
4. Add a unit test `client/src/game/maps/__tests__/interiorExits.test.js`: for every `exit`/`door` zone with a `targetSpawn` in `brackenford`, `market`, `tavern`, the target resolves to a zone of kind `spawn` on the target map, and that spawn rect has no collision-layer overlap. Optional, only if it needs no fixture changes: make `tools/maps/validate_map.mjs` (+ `validate.test.js`) warn when a `targetSpawn` resolves to a non-spawn zone. If it forces edits in `__fixtures__/`, skip it and say so.
5. Extend `tests/e2e/market-approach.spec.ts` (exists from BF-1): after entering the Market and using the exit, assert the player is NOT at (96,160), overlaps no collider, and can move at least 32 px in some direction within 1 s. Add the same for the tavern in `tests/e2e/interiors.spec.ts`. Save one screenshot `tests/e2e/__screenshots__/mx1-market-exit.png` (player visibly outside the door).

**Files you MAY change:** `tools/maps/generate_tmj.mjs`, `tools/maps/build_interiors.mjs`, `tools/maps/validate_map.mjs` (+ `client/src/game/maps/__tests__/validate.test.js`, optional), `client/public/maps/brackenford.tmj`, `client/public/maps/market.tmj`, `client/public/maps/tavern.tmj`, new `client/src/game/maps/__tests__/interiorExits.test.js`, existing `client/src/game/maps/__tests__/{MapLoader,mapRegistry,brackenfordApproach}.test.js` only if a count/assertion must change, `tests/e2e/market-approach.spec.ts`, `tests/e2e/interiors.spec.ts`, `tests/e2e/tiled-registry.spec.ts`, `tests/e2e/__screenshots__/mx1-market-exit.png`.
**Must NOT change:** `HollowvaleScene.js`, `Player.js`, `balance.js`, `manifest.json`, any other map, existing screenshots (the Brackenford overview baseline is Grant's call; another package handles it), `client/src/game/maps/MapLoader.js`, `zones.js`.

**Acceptance (evidence):** (1) before/after landing coordinates for market and tavern exits; (2) `interiorExits.test.js` green and fails if you point a target back at a door zone (show that once); (3) the e2e assertions above pass; (4) regenerated tmj diffs are spawn-only; (5) `npm test` + build green.

**Verify with:**
```
npm test && npm run build --workspace client
npx playwright test tests/e2e/market-approach.spec.ts tests/e2e/interiors.spec.ts tests/e2e/tiled-registry.spec.ts tests/e2e/brackenford.spec.ts --reporter=line
```
Note: `brackenford.spec.ts` `brackenford-overview.png` will show a known visual diff from the earlier barrel move (package SS-1 owns that baseline). Report it as expected; do not update it.

**Global must-NOT-change:** `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`, `.env*` (never create or commit one), `.github/**`, `package.json` / `package-lock.json` (no new dependencies), `art-source/**` unless the MAY list says so, `client/public/maps/zelda-like/**`, anything not in the MAY list, `AGENT_PROMPT.md`, `test-results/`. No new `Math.random` in `client/src/game` (use `client/src/game/rng.js`). If you need a file outside your MAY list, STOP and explain in your final report instead of editing it. No balance or timing change that this prompt does not name. Do not add place names that are not in `newLore.txt`.

**Evidence rules (CI runs only `npm test` + build and NEVER runs Playwright):** the PR body must contain the full local output of `npm test` (pass/fail counts), `npm run build --workspace client`, and every Playwright spec named in "Verify with", run as `npx playwright test <specs> --reporter=line`. Never start dev servers by hand and never use watch mode; Playwright's `webServer` starts the client. Known environmental failures are acceptable only if you say so: the Hugging Face `rerank.test.js` "fetch failed" offline and a first-run Playwright Chromium download. Also paste `git diff origin/main --stat` and confirm it lists only MAY-list files.

**Process:** 1) Write a short plan in the PR description; do not wait for review. 2) Small commits. 3) Run the verification. 4) Push `hv/MX-1` and open ONE PR into `main` titled `[MX-1] <summary>`. 5) Do not merge. No polish rounds after CI is green. Stop. Do not start another package.
