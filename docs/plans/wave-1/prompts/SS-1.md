**Model:** grok-4.7 low effort (asset / import / docs / mechanical work). **Package:** SS-1 (Wave 1). One package = one agent = one PR.

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/`. Do ONLY package **SS-1**.

**Branch:** `git fetch origin && git switch -c hv/SS-1 origin/main` (main must be at or after `4e68ca0`, which has BF-1 #78). Never push to `main`, never merge, never enable auto-merge, never force-push, never touch other branches or PRs. Grant merges.

**Refined spec (optional):** run `git fetch origin hv/PLAN-W1`. If that branch exists and has `docs/plans/wave-1/SS-1.md`, read it (`git show origin/hv/PLAN-W1:docs/plans/wave-1/SS-1.md`). It may only TIGHTEN this prompt (exact line numbers, extra test cases, risks). If it conflicts with this prompt, this prompt wins; say so in the PR. If the branch is missing, ignore this paragraph.

**Hard lock (IT-1 is in flight until it merges):** do not touch `client/src/game/actors/Player.js`, `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/combat/balance.js`, `client/public/assets/manifest.json`, `client/src/game/assets/itemAnchors/**`, `client/src/game/actors/itemHold.js`, or anything under `client/public/assets/items/inhand/` unless this package's MAY list names it AND the package header says IT-1 has merged.

**Goal:** refresh the one stale screenshot baseline after BF-1 moved the Brackenford barrel (x 128 -> 544). **Only Grant approves art: your PR is a proposal and merging it is his approval. Do not describe it as approved.**

**Do:**
1. Run `npx playwright test tests/e2e/brackenford.spec.ts --reporter=line` on fresh main. Record which `toHaveScreenshot` assertions fail (expected: `brackenford-overview.png`; check the four `brackenford-<class>-1080p.png` too, and `camera-centering-*`).
2. For each failing baseline, open the expected / actual / diff images from `test-results/` and confirm the diff is ONLY the barrel move (the old barrel position cleared, the new one at about x 544, y 6 tiles) and nothing else (no tile, NPC, UI or lighting change). If anything else differs, do NOT update; report it as a possible regression.
3. Update only the baselines whose diff is exactly the barrel move: `npx playwright test tests/e2e/brackenford.spec.ts -g "<test title>" --update-snapshots --reporter=line`. Re-run the whole spec once more: it must be green.
4. In the PR body, embed the old and new `brackenford-overview.png` side by side (or attach both) and one sentence naming exactly what changed, so Grant can approve by looking.

**Files you MAY change:** `tests/e2e/__screenshots__/brackenford-overview.png` and, only if step 2 proves the same barrel-only diff, `tests/e2e/__screenshots__/brackenford-{knight,mage,thief,dwarf}-1080p.png`.
**Must NOT change:** any spec file, any map, any code, any other screenshot.

**Acceptance:** before/after images in the PR; `brackenford.spec.ts` green; `git diff origin/main --stat` lists only the PNGs; `npm test` + build green.

**Verify with:**
```
npm test && npm run build --workspace client
npx playwright test tests/e2e/brackenford.spec.ts --reporter=line
```

**Global must-NOT-change:** `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`, `.env*` (never create or commit one), `.github/**`, `package.json` / `package-lock.json` (no new dependencies), `art-source/**` unless the MAY list says so, `client/public/maps/zelda-like/**`, anything not in the MAY list, `AGENT_PROMPT.md`, `test-results/`. No new `Math.random` in `client/src/game` (use `client/src/game/rng.js`). If you need a file outside your MAY list, STOP and explain in your final report instead of editing it. No balance or timing change that this prompt does not name. Do not add place names that are not in `newLore.txt`.

**Evidence rules (CI runs only `npm test` + build and NEVER runs Playwright):** the PR body must contain the full local output of `npm test` (pass/fail counts), `npm run build --workspace client`, and every Playwright spec named in "Verify with", run as `npx playwright test <specs> --reporter=line`. Never start dev servers by hand and never use watch mode; Playwright's `webServer` starts the client. Known environmental failures are acceptable only if you say so: the Hugging Face `rerank.test.js` "fetch failed" offline and a first-run Playwright Chromium download. Also paste `git diff origin/main --stat` and confirm it lists only MAY-list files.

**Process:** 1) Write a short plan in the PR description; do not wait for review. 2) Small commits. 3) Run the verification. 4) Push `hv/SS-1` and open ONE PR into `main` titled `[SS-1] <summary>`. 5) Do not merge. No polish rounds after CI is green. Stop. Do not start another package.
