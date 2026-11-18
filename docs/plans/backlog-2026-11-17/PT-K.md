# PT-K — Playtest knight: Brackenford, tavern, path

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **PT-K**.

**Branch:** create `hv/PT-K` from the latest `origin/main` (`git fetch origin && git switch -c hv/PT-K origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** Play the knight headlessly and write a bug report. Fix only a trivial bug inside the whitelist. Everything else is a report, not a code change.

**Route:** `?qa=1&seed=1`. Title screen, first Choose (knight), Brackenford village, walk to the tavern and press E, confirm the bartender panel opens, leave, walk south onto `path`. Do not enter the dragon lair. Do not rename the bartender label "Tharos". Do not invent place names. Names you may use are already in the game and in `newLore_expanded.txt`: Hollowvale, Brackenford, the Embered Flagon, the Cavern of Embers, Emberwood, the Ashen Wastes, Veyrath.

**Report:** `docs/playtest/2026-11-17-knight.md`. What you did, what broke, screenshots saved under `docs/playtest/knight/`.

**Trivial fixes only** in `client/src/game/sceneCatalog.js` `SCENE_HINTS` strings (typos, a hint that names a key the game does not have). Do not retune combat, movement, or the camera. If the bug is not in `SCENE_HINTS`, report it and do not fix it.

**Read first:** AGENTS.md, `client/src/game/sceneCatalog.js` `SCENE_HINTS`, `tests/e2e/full-flow.spec.ts` for the qa boot pattern (read-only).

**In flight, do not overlap:** B10-2, 4-2 / #90, `4-2b` (`Projectile.js`). UI-4 owns `Game.jsx`.

**Files you MAY change:**

- `docs/playtest/2026-11-17-knight.md` (new)
- `docs/playtest/knight/**` (new screenshots)
- `tests/e2e/playtest-knight.spec.ts` (new)
- `client/src/game/sceneCatalog.js` (`SCENE_HINTS` strings only, and only for a trivial fix)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/Game.jsx`, `client/src/game/combat/balance.js`, `client/src/game/combat/hitSystem.js`, `client/src/game/actors/Projectile.js`, `client/src/game/actors/Player.js`, `client/src/game/scenes/HollowvaleScene.js`
- Wave 4 files owned by other packages: `docs/playtest/2026-11-17-mage.md`, `docs/playtest/mage/**`, `tests/e2e/playtest-mage.spec.ts`, `client/src/game/fxLayer.js`, `docs/playtest/2026-11-17-thief.md`, `docs/playtest/thief/**`, `tests/e2e/playtest-thief.spec.ts`, `client/src/game/combat/dodge.js`, `docs/playtest/2026-11-17-dwarf.md`, `docs/playtest/dwarf/**`, `tests/e2e/playtest-dwarf.spec.ts`, `client/src/game/combat/fallbacks.js`

**Acceptance criteria:**

1. `playtest-knight.spec.ts` boots the knight, reaches the tavern, and reaches `path` without asserting dragon HP.
2. The markdown report exists and names each bug or says none.
3. Any code change outside `SCENE_HINTS` is absent from `git diff origin/main --stat`.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/playtest-knight.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary. Do not write screenshots into `tests/e2e/__screenshots__/`.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[PT-K] Knight playtest through Brackenford, the tavern, and the path`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
