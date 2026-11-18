# PT-D — Playtest dwarf: axe swing in Brackenford

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **PT-D**.

**Branch:** create `hv/PT-D` from the latest `origin/main` (`git fetch origin && git switch -c hv/PT-D origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** Play the dwarf headlessly and write a bug report. Fix only a trivial bug inside the whitelist.

**Route:** `?qa=1&seed=1`. Title, dwarf (fourth Choose). Walk in Brackenford and swing the axe with Space. Do not drink ale and do not test the damage buff. That is #90 and `4-2b`. Do not edit `balance.js` or `Projectile.js`.

**Report:** `docs/playtest/2026-11-17-dwarf.md` and screenshots under `docs/playtest/dwarf/`.

**Trivial fixes only** in `client/src/game/combat/fallbacks.js` (a null guard). Do not change damage, cooldowns, or which class gets which fallback. If the bug is not in `fallbacks.js`, report it and do not fix it.

**Read first:** AGENTS.md, `client/src/game/combat/fallbacks.js`.

**In flight, do not overlap:** B10-2, 4-2 / #90, `4-2b`. UI-4 owns `Game.jsx`.

**Files you MAY change:**

- `docs/playtest/2026-11-17-dwarf.md` (new)
- `docs/playtest/dwarf/**` (new screenshots)
- `tests/e2e/playtest-dwarf.spec.ts` (new)
- `client/src/game/combat/fallbacks.js` (only a trivial null guard)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/game/combat/balance.js`, `client/src/game/combat/hitSystem.js`, `client/src/game/actors/Projectile.js`, `client/src/Game.jsx`, `client/src/game/actors/Player.js`
- Wave 4 files owned by other packages: `docs/playtest/2026-11-17-knight.md`, `docs/playtest/knight/**`, `tests/e2e/playtest-knight.spec.ts`, `client/src/game/sceneCatalog.js`, `docs/playtest/2026-11-17-mage.md`, `docs/playtest/mage/**`, `tests/e2e/playtest-mage.spec.ts`, `client/src/game/fxLayer.js`, `docs/playtest/2026-11-17-thief.md`, `docs/playtest/thief/**`, `tests/e2e/playtest-thief.spec.ts`, `client/src/game/combat/dodge.js`

**Acceptance criteria:**

1. The spec selects the dwarf and presses Space at least once.
2. The report exists.
3. `balance.js` and `Projectile.js` are not in the diff.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/playtest-dwarf.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary. Do not write screenshots into `tests/e2e/__screenshots__/`.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[PT-D] Dwarf playtest of the axe swing in Brackenford`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
