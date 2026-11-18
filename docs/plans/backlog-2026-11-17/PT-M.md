# PT-M — Playtest mage: spell wheel and one cast

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **PT-M**.

**Branch:** create `hv/PT-M` from the latest `origin/main` (`git fetch origin && git switch -c hv/PT-M origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** Play the mage headlessly and write a bug report. Fix only a trivial bug inside the whitelist.

**Route:** `?qa=1&seed=1`. Title, second Choose button (mage). The spellbook starts in storage and the staff is on the hotbar. Open inventory with V and try to equip the spellbook. Hold K for the spell wheel (1 lightning, 2 blink, 3 leech, 4 shield). Cast once with Space. If drag-and-drop fails, report it. Do not rewrite inventory. Do not change spell damage (that is `4-2b` / `spells.js`).

**Report:** `docs/playtest/2026-11-17-mage.md` and screenshots under `docs/playtest/mage/`.

**Trivial fixes only** in `client/src/game/fxLayer.js` (a null guard or a wrong comment). Do not change timings, colors used as balance, or hitboxes. If the bug is not in `fxLayer.js`, report it and do not fix it.

**Read first:** AGENTS.md, `client/src/game/fxLayer.js`, the spell-wheel click math in `Game.jsx` (read-only).

**In flight, do not overlap:** B10-2, 4-2 / #90, `4-2b`. UI-4 owns `Game.jsx`.

**Files you MAY change:**

- `docs/playtest/2026-11-17-mage.md` (new)
- `docs/playtest/mage/**` (new screenshots)
- `tests/e2e/playtest-mage.spec.ts` (new)
- `client/src/game/fxLayer.js` (only a trivial null/comment fix)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/Game.jsx`, `client/src/game/combat/spells.js`, `client/src/game/actors/Projectile.js`, `client/src/game/combat/balance.js`
- Wave 4 files owned by other packages: `docs/playtest/2026-11-17-knight.md`, `docs/playtest/knight/**`, `tests/e2e/playtest-knight.spec.ts`, `client/src/game/sceneCatalog.js`, `docs/playtest/2026-11-17-thief.md`, `docs/playtest/thief/**`, `tests/e2e/playtest-thief.spec.ts`, `client/src/game/combat/dodge.js`, `docs/playtest/2026-11-17-dwarf.md`, `docs/playtest/dwarf/**`, `tests/e2e/playtest-dwarf.spec.ts`, `client/src/game/combat/fallbacks.js`

**Acceptance criteria:**

1. The spec selects the mage, opens the wheel or documents why it could not, and attempts one cast.
2. The report exists.
3. Spell damage numbers are unchanged.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/playtest-mage.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary. Do not write screenshots into `tests/e2e/__screenshots__/`.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[PT-M] Mage playtest of the spell wheel and one cast`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
