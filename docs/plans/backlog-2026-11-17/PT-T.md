# PT-T — Playtest thief: move, vanish, dagger swing

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **PT-T**.

**Branch:** create `hv/PT-T` from the latest `origin/main` (`git fetch origin && git switch -c hv/PT-T origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** Play the thief headlessly and write a bug report. Fix only a trivial bug inside the whitelist.

**Route:** `?qa=1&seed=1`. Title, thief (third Choose). Move, press J to vanish, press Space to swing the daggers, and watch a poison vial if one is already equipped. Observe only. Do not change vial damage (`4-2b`). Do not edit `Player.js` or `toolUse.js` (B10-2).

**Report:** `docs/playtest/2026-11-17-thief.md` and screenshots under `docs/playtest/thief/`.

**Trivial fixes only** in `client/src/game/combat/dodge.js` (a null guard or a wrong comment). Do not change the 600 ms cooldown or the dodge distance. If the bug is not in `dodge.js`, report it and do not fix it.

**Read first:** AGENTS.md, `client/src/game/combat/dodge.js`.

**In flight, do not overlap:** B10-2 (`Player.js`, `HollowvaleScene.js` `_updateToolUse`, `toolUse.js`), 4-2 / #90, `4-2b`. UI-4 owns `Game.jsx`.

**Files you MAY change:**

- `docs/playtest/2026-11-17-thief.md` (new)
- `docs/playtest/thief/**` (new screenshots)
- `tests/e2e/playtest-thief.spec.ts` (new)
- `client/src/game/combat/dodge.js` (only a trivial null/comment fix)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/game/actors/Player.js`, `client/src/game/combat/toolUse.js`, `client/src/game/actors/Projectile.js`, `client/src/game/combat/balance.js`, `client/src/Game.jsx`
- Wave 4 files owned by other packages: `docs/playtest/2026-11-17-knight.md`, `docs/playtest/knight/**`, `tests/e2e/playtest-knight.spec.ts`, `client/src/game/sceneCatalog.js`, `docs/playtest/2026-11-17-mage.md`, `docs/playtest/mage/**`, `tests/e2e/playtest-mage.spec.ts`, `client/src/game/fxLayer.js`, `docs/playtest/2026-11-17-dwarf.md`, `docs/playtest/dwarf/**`, `tests/e2e/playtest-dwarf.spec.ts`, `client/src/game/combat/fallbacks.js`

**Acceptance criteria:**

1. The spec selects the thief, presses J, and presses Space.
2. The report exists.
3. Dodge cooldown and distance are unchanged.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/playtest-thief.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary. Do not write screenshots into `tests/e2e/__screenshots__/`.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[PT-T] Thief playtest of vanish and the dagger swing`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
