# BUNDLE-1 — Put Phaser in its own Vite chunk

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **BUNDLE-1**.

**Branch:** create `hv/BUNDLE-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/BUNDLE-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `npm run build --workspace client` emits one JS chunk of about **2,067.73 kB** (gzip about 496.63 kB) and Vite warns that chunks are over 500 kB. It names `build.rollupOptions.output.manualChunks`.

In `client/vite.config.js` only, set `build.rollupOptions.output.manualChunks` so `phaser` is its own chunk. Do not add a dependency. Do not raise `chunkSizeWarningLimit` to hide the warning. Do not dynamic-import scenes, and do not edit `Game.jsx` or `HollowvaleScene.js`.

Record the before/after chunk list (name and kB) in the PR. If the app chunk is still over 500 kB after Phaser is split out, say so and stop. Do not start a second refactor.

**Read first:** AGENTS.md, `client/vite.config.js`, `client/package.json` (read-only).

**In flight, do not overlap:** B10-2 and 4-2.

**Files you MAY change:**

- `client/vite.config.js`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/**`, `server/**`, `tests/**`
- Wave 2 files owned by other packages: `client/src/Game.jsx`, `tests/e2e/full-flow.spec.ts`, `client/src/game/actors/Enemy.js`, `client/src/game/ai/goblin.js`, `client/src/game/ai/brute.js`, `client/src/game/ai/archer.js`, `client/src/game/ai/dragon.js`, their `__tests__` files, `client/src/styles/index.css`

**Acceptance criteria:**

1. The production build lists a separate chunk whose module is Phaser, and an app chunk that is smaller than the old 2,067.73 kB single file.
2. `npm test` still passes. The built `index.html` still loads the app.
3. No new dependency. `package-lock.json` is not in the diff.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the build's chunk table into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[BUNDLE-1] Split Phaser into its own chunk`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
