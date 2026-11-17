**Model:** grok-4.7 low effort (asset / import / docs / mechanical work). **Package:** RR-1 (Wave 1). One package = one agent = one PR.

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/`. Do ONLY package **RR-1**.

**Branch:** `git fetch origin && git switch -c hv/RR-1 origin/main` (main must be at or after `4e68ca0`, which has BF-1 #78). Never push to `main`, never merge, never enable auto-merge, never force-push, never touch other branches or PRs. Grant merges.

**Refined spec (optional):** run `git fetch origin hv/PLAN-W1`. If that branch exists and has `docs/plans/wave-1/RR-1.md`, read it (`git show origin/hv/PLAN-W1:docs/plans/wave-1/RR-1.md`). It may only TIGHTEN this prompt (exact line numbers, extra test cases, risks). If it conflicts with this prompt, this prompt wins; say so in the PR. If the branch is missing, ignore this paragraph.

**Hard lock (IT-1 is in flight until it merges):** do not touch `client/src/game/actors/Player.js`, `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/combat/balance.js`, `client/public/assets/manifest.json`, `client/src/game/assets/itemAnchors/**`, `client/src/game/actors/itemHold.js`, or anything under `client/public/assets/items/inhand/` unless this package's MAY list names it AND the package header says IT-1 has merged.

**Goal:** stop `server/src/__tests__/rerank.test.js` from failing when the Hugging Face model can't be downloaded (it fails offline with "fetch failed", passes online; it failed once and passed on rerun in the BF-1 PR). It must be deterministic in both situations.

**Facts:** `warmupReranker()` returns `false` when the cross-encoder cannot load; `rerank()` then falls back to the original candidate order. The test "rerank orders a relevant chunk above an unrelated one" asserts real model ordering, so it fails whenever the model is unreachable.

**Do:**
1. In `rerank.test.js`, probe once at the top with `warmupReranker()`. If it returns `false`, mark the model-dependent test(s) as skipped with a clear message (`t.skip('cross-encoder model unavailable (offline)')`) instead of failing. Keep the real-model assertions unchanged when the model is available.
2. Add a model-free deterministic test of the fallback contract: with the model unavailable, `rerank()` returns every candidate once, never throws, preserves input order and any `cosScore`/`score` fields. (Only if that is testable without editing `rerank.js`; otherwise skip it and say so.)
3. Do not edit `server/src/rag/rerank.js` or `store.js`. Do not add dependencies or mocks of the network layer.

**Files you MAY change:** `server/src/__tests__/rerank.test.js` only.
**Must NOT change:** everything else (L-4 owns the reranker rollout).

**Acceptance:** run `node --test server/src/__tests__/rerank.test.js` three times online-or-offline (state which) with 0 failures; show the skip message once by running with the network blocked (for example `HF_HUB_OFFLINE=1` or an unreachable `HF_ENDPOINT`) if the sandbox allows; `npm test` green.

**Verify with:**
```
npm test
```
(No Playwright for this package; say "not applicable" in the PR.)

**Global must-NOT-change:** `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`, `.env*` (never create or commit one), `.github/**`, `package.json` / `package-lock.json` (no new dependencies), `art-source/**` unless the MAY list says so, `client/public/maps/zelda-like/**`, anything not in the MAY list, `AGENT_PROMPT.md`, `test-results/`. No new `Math.random` in `client/src/game` (use `client/src/game/rng.js`). If you need a file outside your MAY list, STOP and explain in your final report instead of editing it. No balance or timing change that this prompt does not name. Do not add place names that are not in `newLore.txt`.

**Evidence rules (CI runs only `npm test` + build and NEVER runs Playwright):** the PR body must contain the full local output of `npm test` (pass/fail counts), `npm run build --workspace client`, and every Playwright spec named in "Verify with", run as `npx playwright test <specs> --reporter=line`. Never start dev servers by hand and never use watch mode; Playwright's `webServer` starts the client. Known environmental failures are acceptable only if you say so: the Hugging Face `rerank.test.js` "fetch failed" offline and a first-run Playwright Chromium download. Also paste `git diff origin/main --stat` and confirm it lists only MAY-list files.

**Process:** 1) Write a short plan in the PR description; do not wait for review. 2) Small commits. 3) Run the verification. 4) Push `hv/RR-1` and open ONE PR into `main` titled `[RR-1] <summary>`. 5) Do not merge. No polish rounds after CI is green. Stop. Do not start another package.
