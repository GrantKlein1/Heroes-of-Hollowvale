# E2E-FLOW — Tighten waits in the full shipped-path spec

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **E2E-FLOW**.

**Branch:** create `hv/E2E-FLOW` from the latest `origin/main` (`git fetch origin && git switch -c hv/E2E-FLOW origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `tests/e2e/full-flow.spec.ts` walks the shipped path (village, market, cavern mouth, and the later scenes it already enters) and has been flaky: a single `E` can miss Phaser's `JustDown`, and a click or a scene wait sometimes races the title and class screens. The file already retries `E` in `pressEUntilScene`. Keep that idea.

Make the spec wait for a visible condition before each input: start button visible, class modal hidden, `__hv.scene()` equal to the scene you think you are in, and the prompt present before an `E` that is supposed to use a door. Do not raise a single `waitForFunction` timeout above 30 seconds. If a step is already documented as `enterScene` because the wilderness hub has no walk back to Brackenford, leave that shortcut and keep the comment.

Do not edit product code. Do not add `test.fixme` to hide a failure you can fix with a wait. If a step fails because the game is wrong, record it in the PR and leave the assertion. Do not patch `HollowvaleScene.js`.

Do not write screenshots over `tests/e2e/__screenshots__/`. If you add a shot, put it in `test-results/` and do not commit it. The spec already writes some shots into `__screenshots__`. Do not add new writes there. You may leave the existing ones.

**Read first:** AGENTS.md, `tests/e2e/full-flow.spec.ts`.

**In flight, do not overlap:** B10-2 and 4-2. Do not touch their files.

**Files you MAY change:**

- `tests/e2e/full-flow.spec.ts`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/**`, `server/**`
- Wave 2 files owned by other packages: `client/src/Game.jsx`, `client/src/game/actors/Enemy.js`, `client/src/game/ai/goblin.js`, `client/src/game/ai/brute.js`, `client/src/game/ai/archer.js`, `client/src/game/ai/dragon.js`, their `__tests__` files, `client/vite.config.js`, `client/src/styles/index.css`
- `tests/e2e/__screenshots__/**`

**Acceptance criteria:**

1. `npx playwright test tests/e2e/full-flow.spec.ts --reporter=line` passes twice in a row on this machine.
2. The spec still uses default flags plus `qa=1` and `seed=1` (no `renderer=` or `maps=` params), matching the comment at the top of the file.
3. The diff is only that spec.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/full-flow.spec.ts --reporter=line
npx playwright test tests/e2e/full-flow.spec.ts --reporter=line
```

Paste both Playwright runs into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[E2E-FLOW] Stabilize the full-flow spec waits`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only. CI does not run Playwright, so the two local runs are the evidence.

**Stop** after that PR is open and CI is green. Do not start another package.
