**Model:** grok-4.7 low effort (asset / import / docs / mechanical work). **Package:** PUB-1 (Wave 1). One package = one agent = one PR.

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/`. Do ONLY package **PUB-1**.

**Branch:** `git fetch origin && git switch -c hv/PUB-1 origin/main` (main must be at or after `4e68ca0`, which has BF-1 #78). Never push to `main`, never merge, never enable auto-merge, never force-push, never touch other branches or PRs. Grant merges.

**Refined spec (optional):** run `git fetch origin hv/PLAN-W1`. If that branch exists and has `docs/plans/wave-1/PUB-1.md`, read it (`git show origin/hv/PLAN-W1:docs/plans/wave-1/PUB-1.md`). It may only TIGHTEN this prompt (exact line numbers, extra test cases, risks). If it conflicts with this prompt, this prompt wins; say so in the PR. If the branch is missing, ignore this paragraph.

**Hard lock (IT-1 is in flight until it merges):** do not touch `client/src/game/actors/Player.js`, `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/combat/balance.js`, `client/public/assets/manifest.json`, `client/src/game/assets/itemAnchors/**`, `client/src/game/actors/itemHold.js`, or anything under `client/public/assets/items/inhand/` unless this package's MAY list names it AND the package header says IT-1 has merged.

**Goal:** shrink what the game ships by moving legacy art tools and provably unused images out of `client/public/` (first half of the old 3-4 goal). `client/public` is about 96 MB today (`images/` 73 MB, `assets/` 12 MB, `audio/` 9.8 MB, `maps/` 1.1 MB). This package must be safe to land BEFORE the legacy renderer is removed, so it moves only files that nothing references.

**Do:**
1. Write `tools/assets/audit_public_refs.mjs` (new, plain node, no deps): lists every file under `client/public/` (excluding `assets/`, `audio/`, `maps/`) and for each reports whether its path or basename appears in `client/src`, `client/index.html`, `client/vite.config.*`, `server/src`, `tests/`, `tools/`, `docs/`, `art-source/` text, including common string-built forms (for example a directory prefix used in a template literal or `PAINTED_SCENES[..].bg`). Be conservative: a file is "unused" only when nothing could build its path.
2. Run it, commit the report as `docs/public-audit-2026-11-17.md` (a table: path, size, referenced-by or "none", action).
3. `git mv` files with zero references, plus any tool files (`*.aseprite`, `*.py`, other non-runtime files) that ship under `client/public/`, into `art-source/legacy-public/<original relative path>`. History is preserved; nothing is deleted.
4. Do NOT move anything referenced by `PAINTED_SCENES` / `sceneCatalog.js` backgrounds or anything the legacy renderer still loads (a later package, 3-4, owns that). Do NOT touch `assets/`, `audio/`, `maps/`.
5. Report `du -sh client/public` before and after.

**Files you MAY change:** moves from `client/public/images/**` (and stray tool files elsewhere in `client/public/` except `assets/`, `audio/`, `maps/`) to `art-source/legacy-public/**`; new `tools/assets/audit_public_refs.mjs`; new `docs/public-audit-2026-11-17.md`; `docs/art-pipeline.md` (add a short note on `art-source/legacy-public/`).
**Must NOT change:** any file in `client/src/**`, `sceneCatalog.js`, `worldMetrics.js`, `config/paths.js`, `HollowvaleScene.js`, `manifest.json`, tests, anything in `client/public/{assets,audio,maps}`.

**Acceptance:** audit table in the PR; `du` before/after; `git diff origin/main --stat -M` shows only renames plus the three new/edited docs/tool files; `npm test` + build green; the smoke and village specs pass locally with no 404s in the console (add a `page.on('response')` check in your run, not a committed spec change).

**Verify with:**
```
npm test && npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts tests/e2e/brackenford.spec.ts tests/e2e/flip-defaults.spec.ts --reporter=line
```
(The Brackenford overview baseline is known-stale from the barrel move; report it, do not fix it.)

**Global must-NOT-change:** `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`, `.env*` (never create or commit one), `.github/**`, `package.json` / `package-lock.json` (no new dependencies), `art-source/**` unless the MAY list says so, `client/public/maps/zelda-like/**`, anything not in the MAY list, `AGENT_PROMPT.md`, `test-results/`. No new `Math.random` in `client/src/game` (use `client/src/game/rng.js`). If you need a file outside your MAY list, STOP and explain in your final report instead of editing it. No balance or timing change that this prompt does not name. Do not add place names that are not in `newLore.txt`.

**Evidence rules (CI runs only `npm test` + build and NEVER runs Playwright):** the PR body must contain the full local output of `npm test` (pass/fail counts), `npm run build --workspace client`, and every Playwright spec named in "Verify with", run as `npx playwright test <specs> --reporter=line`. Never start dev servers by hand and never use watch mode; Playwright's `webServer` starts the client. Known environmental failures are acceptable only if you say so: the Hugging Face `rerank.test.js` "fetch failed" offline and a first-run Playwright Chromium download. Also paste `git diff origin/main --stat` and confirm it lists only MAY-list files.

**Process:** 1) Write a short plan in the PR description; do not wait for review. 2) Small commits. 3) Run the verification. 4) Push `hv/PUB-1` and open ONE PR into `main` titled `[PUB-1] <summary>`. 5) Do not merge. No polish rounds after CI is green. Stop. Do not start another package.
