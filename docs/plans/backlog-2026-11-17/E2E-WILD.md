# E2E-WILD — Stop the wilderness spec writing outside the repo

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **E2E-WILD**.

**Branch:** create `hv/E2E-WILD` from the latest `origin/main` (`git fetch origin && git switch -c hv/E2E-WILD origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `tests/e2e/wilderness.spec.ts` (the fps lines just after the Ashen screenshot, around line 121) does this:

```
const fpsPath = path.resolve('/opt/cursor/artifacts/wilderness-fps.txt')
fs.mkdirSync(...)
fs.writeFileSync(fpsPath, ...)
```

That path is a machine folder, not the repo. Remove the `fs` write and the `fs` import if it becomes unused. Keep `expect(fps).toBeGreaterThan(0)`. You may `test.info().attach` the fps text. Do not write a file under `/opt`, `/tmp`, or anywhere outside the Playwright output dir. Do not commit an fps log.

Do not change wilderness generation, tiles, or the cavern-mouth exit asserts.

**Read first:** AGENTS.md, `tests/e2e/wilderness.spec.ts`.

**In flight, do not overlap:** B10-2 (`Player.js` tool-use, `HollowvaleScene.js` `_updateToolUse`, `client/src/game/combat/toolUse.js`, cavern maps). 4-2 (`balance.js`, consume path, outgoing damage).

**Files you MAY change:**

- `tests/e2e/wilderness.spec.ts`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/**`
- Wave 1 files owned by other packages: `client/src/Game.jsx`, `tests/e2e/hit-timing.spec.ts`, `server/src/rag/store.js`, `server/src/__tests__/ragRerankFlag.test.js`, `server/src/__tests__/rerank.test.js`, `client/src/components/GameHUD.jsx`, `client/src/components/DialogueModal.jsx`, `client/src/game/EventBus.js`, `README.md`, `docs/art-pipeline.md`
- `tests/e2e/__screenshots__/**` baselines. Do not refresh them.

**Acceptance criteria:**

1. `rg '/opt/cursor/artifacts' tests/e2e/wilderness.spec.ts` prints nothing.
2. The spec still asserts fps is greater than 0, and the Emberwood / Ashen / cavern-link expects stay.
3. `git diff origin/main --stat` shows only that spec.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/wilderness.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[E2E-WILD] Stop the wilderness spec writing outside the repo`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
