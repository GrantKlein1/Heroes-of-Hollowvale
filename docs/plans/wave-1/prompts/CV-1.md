**Model:** grok-4.7 high effort (code-heavy; never fast). **Package:** CV-1 (Wave 1). One package = one agent = one PR.

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/`. Do ONLY package **CV-1**.

**Branch:** `git fetch origin && git switch -c hv/CV-1 origin/main` (main must be at or after `4e68ca0`, which has BF-1 #78). Never push to `main`, never merge, never enable auto-merge, never force-push, never touch other branches or PRs. Grant merges.

**Refined spec (optional):** run `git fetch origin hv/PLAN-W1`. If that branch exists and has `docs/plans/wave-1/CV-1.md`, read it (`git show origin/hv/PLAN-W1:docs/plans/wave-1/CV-1.md`). It may only TIGHTEN this prompt (exact line numbers, extra test cases, risks). If it conflicts with this prompt, this prompt wins; say so in the PR. If the branch is missing, ignore this paragraph.

**Hard lock (IT-1 is in flight until it merges):** do not touch `client/src/game/actors/Player.js`, `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/combat/balance.js`, `client/public/assets/manifest.json`, `client/src/game/assets/itemAnchors/**`, `client/src/game/actors/itemHold.js`, or anything under `client/public/assets/items/inhand/` unless this package's MAY list names it AND the package header says IT-1 has merged.

**Goal:** three small cleanups left over from CB-1 / O-V5-1: (A) the stale cavern generator, (B) the wilderness e2e spec, (C) a top-row check on the cavern mouth map. Test and tooling work; no game code.

**A. `tools/maps/build_cavern.mjs` is stale.** `cavern_mouth.tmj` on main is 24x29 (13 rows prepended by O-V5-1, objects shifted +416 in y, mountain feet (384,640), `mountain_mouth` atlases, grass gids at firstgid 43). The script still emits the pre-CB-1 24x16 mouth. Update the script so its output for the mouth is **identical to the committed `cavern_mouth.tmj`** (and that it still reproduces `cavern_halls`, `cavern_treasure`, `cavern_lair` as committed, if it generates them). Add a `--check` flag that builds in memory and exits non-zero on any difference from the committed files without writing. Acceptance: `node tools/maps/build_cavern.mjs --check` exits 0, and running the script normally leaves `git diff client/public/maps` empty. Add a vitest `client/src/game/maps/__tests__/buildCavern.test.js` that runs the check path. If exact reproduction of an already hand-edited file is impossible, STOP and report which fields differ; do not hand-edit the map to match the script.

**B. `tests/e2e/wilderness.spec.ts`** (3-3 spec) predates the new/taller map dimensions and the v5 tiles. Run it first and record what fails. Fix the SPEC ONLY (spot-picking bounds, expected tilesets/props, camera/zoom assumptions) so it asserts what the game now does. Do not change generators or game code to make it pass. Regenerate only the two screenshots it owns (`wilderness-emberwood.png`, `wilderness-ashen-edge.png`) if the diff is the expected v5/map-size change, and describe each change in the PR (Grant approves art by merging). Also run `tests/e2e/cavern.spec.ts` and report; fix the spec only if it fails because of the 24x29 mouth.

**C. Cavern mouth top-row audit (report + existing-tile fixes only).** Boot `?qa=1`, `__scene.enterScene('dungeon')` (cavern mouth), take a native 1x screenshot of the top ~13 rows (the prepended rows 0-12 and the mountain edge). List any visible seam, repeated-tile pattern, or hard edge at the top of the map or beside the mountain sprite. Fix ONLY by changing ground-layer gids in `cavern_mouth.tmj` rows 0-12 to other tiles that already exist in its embedded tilesets (keep collision data and every object unchanged). If a seam needs new art, do not invent it: list it as "needs Blendsmith" in the PR. No new art, no new tilesets.

**Files you MAY change:** `tools/maps/build_cavern.mjs`, new `client/src/game/maps/__tests__/buildCavern.test.js`, `client/public/maps/cavern_mouth.tmj` (ground layer rows 0-12 gids only), `tests/e2e/wilderness.spec.ts`, `tests/e2e/cavern.spec.ts`, `tests/e2e/__screenshots__/wilderness-emberwood.png`, `wilderness-ashen-edge.png`, `cavern-mouth.png`.
**Must NOT change:** any other map, `generate_tmj.mjs`, `build_interiors.mjs` (MX-1 owns those), `client/src/game/terrain/**`, `HollowvaleScene.js`, `Player.js`, assets, other screenshots.

**Acceptance:** (A) the `--check` command and the vitest pass, `git diff client/public/maps` empty after a normal run; (B) wilderness + cavern specs green locally with before/after notes for each updated screenshot; (C) top-row screenshot attached and a list (possibly empty) of seams, with what was fixed vs "needs Blendsmith"; `npm test` + build green.

**Verify with:**
```
npm test && npm run build --workspace client
node tools/maps/build_cavern.mjs --check
npx playwright test tests/e2e/wilderness.spec.ts tests/e2e/cavern.spec.ts --reporter=line
```

**Global must-NOT-change:** `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`, `.env*` (never create or commit one), `.github/**`, `package.json` / `package-lock.json` (no new dependencies), `art-source/**` unless the MAY list says so, `client/public/maps/zelda-like/**`, anything not in the MAY list, `AGENT_PROMPT.md`, `test-results/`. No new `Math.random` in `client/src/game` (use `client/src/game/rng.js`). If you need a file outside your MAY list, STOP and explain in your final report instead of editing it. No balance or timing change that this prompt does not name. Do not add place names that are not in `newLore.txt`.

**Evidence rules (CI runs only `npm test` + build and NEVER runs Playwright):** the PR body must contain the full local output of `npm test` (pass/fail counts), `npm run build --workspace client`, and every Playwright spec named in "Verify with", run as `npx playwright test <specs> --reporter=line`. Never start dev servers by hand and never use watch mode; Playwright's `webServer` starts the client. Known environmental failures are acceptable only if you say so: the Hugging Face `rerank.test.js` "fetch failed" offline and a first-run Playwright Chromium download. Also paste `git diff origin/main --stat` and confirm it lists only MAY-list files.

**Process:** 1) Write a short plan in the PR description; do not wait for review. 2) Small commits. 3) Run the verification. 4) Push `hv/CV-1` and open ONE PR into `main` titled `[CV-1] <summary>`. 5) Do not merge. No polish rounds after CI is green. Stop. Do not start another package.
