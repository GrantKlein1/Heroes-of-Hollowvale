# DEAD-1 — Delete the unmounted HUD, dialogue modal, and unused Phaser bus

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **DEAD-1**.

**Branch:** create `hv/DEAD-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/DEAD-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** These three modules are not mounted:

- `client/src/components/GameHUD.jsx` (nothing imports it; the live HUD is inside `Game.jsx`)
- `client/src/components/DialogueModal.jsx` (nothing imports it; bartender chat is inside `Game.jsx`)
- `client/src/game/EventBus.js` (a Phaser `EventEmitter` imported only by those two components)

The live bus is `client/src/lib/eventBus.js`. Do not edit that file. Do not rewire the HUD.

Before deleting, run `rg` for `GameHUD`, `DialogueModal`, and `game/EventBus`. If something else imports them, stop and say so. Do not delete a file that is still imported.

**Read first:** AGENTS.md, the three files, `client/src/App.jsx`, `client/src/lib/eventBus.js` (read-only).

**In flight, do not overlap:** B10-2 and 4-2. Do not touch combat or `Game.jsx` (package UI-1 owns it in this wave).

**Files you MAY change:**

- `client/src/components/GameHUD.jsx` (delete)
- `client/src/components/DialogueModal.jsx` (delete)
- `client/src/game/EventBus.js` (delete)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/lib/eventBus.js`, `client/src/Game.jsx`, `client/src/components/PhaserGame.jsx`
- Wave 1 files owned by other packages: `tests/e2e/hit-timing.spec.ts`, `tests/e2e/wilderness.spec.ts`, `server/src/rag/store.js`, `server/src/__tests__/ragRerankFlag.test.js`, `server/src/__tests__/rerank.test.js`, `README.md`, `docs/art-pipeline.md`

**Acceptance criteria:**

1. The three files are gone.
2. `rg "GameHUD|DialogueModal|game/EventBus" client server tests` prints nothing.
3. `npm test` and the client build pass. The title screen and in-game HUD still come from `Game.jsx` (do not restyle them).

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[DEAD-1] Remove the unmounted HUD and dialogue modal`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
