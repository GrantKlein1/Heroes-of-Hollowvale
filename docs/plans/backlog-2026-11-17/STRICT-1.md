# STRICT-1 — One Phaser game under React StrictMode

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **STRICT-1**.

**Branch:** create `hv/STRICT-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/STRICT-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `client/src/main.jsx` wraps the app in `React.StrictMode`. In dev, React runs the effect in `client/src/components/PhaserGame.jsx`, cleans it up (`game.destroy`), and runs it again. Playwright uses `npm run dev --workspace client`, so this is the path the specs boot. Keep a single Phaser game and a single canvas after that remount. Do not leak a second `Phaser.Game`. Do not remove StrictMode unless that is the only way to stop the double game, and if you remove it, say why in the PR.

Do not change `HollowvaleScene` or combat.

**Read first:** AGENTS.md, `client/src/main.jsx`, `client/src/components/PhaserGame.jsx`.

**In flight, do not overlap:** B10-2, 4-2 / #90, and `4-2b` (`Projectile.js`).

**Files you MAY change:**

- `client/src/main.jsx`
- `client/src/components/PhaserGame.jsx`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/Game.jsx` (UI-3 owns it this wave)
- Wave 3 files owned by other packages: `server/src/middleware/errorHandler.js`, `server/src/__tests__/errorHandler.test.js`, `docs/public-audit-2026-11-17.md`, and the image files in `PUBLIC-1.md`

**Acceptance criteria:**

1. Booting the dev client shows one canvas.
2. `npm test` and `tests/e2e/smoke.spec.ts` pass.
3. No scene or combat file in the diff.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[STRICT-1] Keep a single Phaser game under StrictMode`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
