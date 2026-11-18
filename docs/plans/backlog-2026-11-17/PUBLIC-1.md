# PUBLIC-1 — Delete the unreferenced public images from the 2026-11-17 audit

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **PUBLIC-1**.

**Branch:** create `hv/PUBLIC-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/PUBLIC-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `docs/public-audit-2026-11-17.md` marks 11 files under `client/public/images` as MOVE (no runtime reference). Delete only these:

- `client/public/images/animatedHealing/animatedHealing.gif`
- `client/public/images/animatedHealing/animatedHealingPop.gif`
- `client/public/images/animatedMana/animatedMana.gif`
- `client/public/images/bossFightEmptyRoom.png`
- `client/public/images/cleric.png`
- `client/public/images/fireSmall.aseprite`
- `client/public/images/red dragon.png`
- `client/public/images/specialSwordWithFire.gif`
- `client/public/images/terrain/README.md`
- `client/public/images/thiefReappear.gif`
- `client/public/images/title screen.png`

Before deleting, `rg` the repo (excluding `docs/public-audit-2026-11-17.md` and `docs/plans/**`) for each basename. If a file is referenced, do not delete it; say so in the PR.

Do not delete KEEP files. In particular keep `images/red dragon boss fight room.png` (title background) and `images/title screen wider no background.png` (title logo). Do not touch `client/public/assets/**`, `client/public/audio/**`, or `client/public/maps/**`.

Add one line at the top of `docs/public-audit-2026-11-17.md` saying PUBLIC-1 removed the MOVE rows that were still unreferenced. Do not rewrite the table.

**Read first:** AGENTS.md, `docs/public-audit-2026-11-17.md`.

**In flight, do not overlap:** B10-2, 4-2 / #90, `4-2b`.

**Files you MAY change:**

- the eleven paths listed above (delete)
- `docs/public-audit-2026-11-17.md` (one note)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/**`, `server/**`, `tests/**`
- Wave 3 files owned by other packages: `client/src/Game.jsx`, `client/src/main.jsx`, `client/src/components/PhaserGame.jsx`, `server/src/middleware/errorHandler.js`, `server/src/__tests__/errorHandler.test.js`

**Acceptance criteria:**

1. The eleven paths are gone, except any you proved are still referenced.
2. `images/red dragon boss fight room.png` and `images/title screen wider no background.png` are still present.
3. `npm run build --workspace client` succeeds. Title assets still resolve from `client/src/config/paths.js` (do not edit that file).

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[PUBLIC-1] Remove unreferenced images from client/public`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
