# LOG-1 — Enemy anim logs only when `?debug=1`

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **LOG-1**.

**Branch:** create `hv/LOG-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/LOG-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** These `console.log` calls fire on ordinary play:

- `client/src/game/actors/Enemy.js` — `` `[Enemy anim] ${key}` ``
- `client/src/game/ai/goblin.js` — `` `[Enemy anim] ${alertKey}` ``
- `client/src/game/ai/brute.js` — the same
- `client/src/game/ai/archer.js` — the same
- `client/src/game/ai/dragon.js` — `` `[DragonAI] Transitioning P...` ``

Gate each one behind `isDebug()` from `client/src/game/config/flags.js` (true only for `?debug=1` or `?debug=true`). When debug is off, do not log. Do not change AI timing, damage, facing, or phase rules. Do not edit `flags.js` (package FLAGS-1 owns it later).

If a unit test asserts that log text, update that test so it stubs `isDebug` or asserts the call only when debug is on. If no test asserts the log, do not edit the test files.

**Read first:** AGENTS.md, the five files, `client/src/game/config/flags.js` (`isDebug`, read-only).

**In flight, do not overlap:** B10-2 and 4-2. Do not edit `Player.js` or `balance.js`.

**Files you MAY change:**

- `client/src/game/actors/Enemy.js`
- `client/src/game/ai/goblin.js`
- `client/src/game/ai/brute.js`
- `client/src/game/ai/archer.js`
- `client/src/game/ai/dragon.js`
- `client/src/game/actors/__tests__/Enemy.test.js`
- `client/src/game/ai/__tests__/goblin.test.js`
- `client/src/game/ai/__tests__/brute.test.js`
- `client/src/game/ai/__tests__/archer.test.js`
- `client/src/game/ai/__tests__/dragon.test.js`

Touch a test file only when it fails because of the log gate.

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/game/config/flags.js`, `client/src/game/actors/Player.js`, `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/combat/balance.js`
- Wave 2 files owned by other packages: `client/src/Game.jsx`, `tests/e2e/full-flow.spec.ts`, `client/vite.config.js`, `client/src/styles/index.css`

**Acceptance criteria:**

1. With debug off, those five log lines are not called.
2. With `isDebug()` true, the same messages still log.
3. Enemy behavior tests still pass. No damage or timing numbers changed.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/enemy-goblin.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[LOG-1] Gate enemy anim logs behind debug`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
