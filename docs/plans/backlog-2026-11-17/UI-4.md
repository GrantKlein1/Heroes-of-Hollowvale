# UI-4 — Death is a short notice, then the existing entrance respawn

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **UI-4**.

**Branch:** create `hv/UI-4` from the latest `origin/main` (`git fetch origin && git switch -c hv/UI-4 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Depends on:** UI-3 merged to `origin/main`. If it is not, stop.

**Goal:** `death.js` already respawns the player at the area entrance with full HP and mana (no penalty). `Game.jsx` also opens a full-screen "You Died / Return to Main Menu" overlay on `GameEvents.DIED`, and `session.blocked` includes `gameOver`, so the overlay fights that respawn and the button wipes the class back to the title.

Replace the menu with a short non-blocking notice, about two seconds, that the player wakes at the entrance. Do not set `gameOver` in a way that blocks input after respawn. Do not clear `session.classId`, the inventory, or the scene. Do not add a death penalty. Do not edit `client/src/game/combat/death.js`.

If `tests/e2e/death-respawn.spec.ts` asserts the old menu, update only that assertion. It did not mention "You Died" when this plan was written. If it does not, do not edit it.

**Read first:** AGENTS.md, the `onDied` / `onRespawn` handlers and the death overlay in `client/src/Game.jsx`, `client/src/game/combat/death.js` (read-only).

**In flight, do not overlap:** B10-2, 4-2 / #90 (`balance.js`, consume, melee damage), `4-2b` (`Projectile.js`).

**Files you MAY change:**

- `client/src/Game.jsx`
- `tests/e2e/death-respawn.spec.ts` (only if it requires the old menu)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/game/combat/death.js`, `client/src/game/combat/balance.js`, `client/src/game/scenes/HollowvaleScene.js`
- Wave 4 files owned by other packages: `docs/playtest/**`, `tests/e2e/playtest-knight.spec.ts`, `tests/e2e/playtest-mage.spec.ts`, `tests/e2e/playtest-thief.spec.ts`, `tests/e2e/playtest-dwarf.spec.ts`, `client/src/game/sceneCatalog.js`, `client/src/game/fxLayer.js`, `client/src/game/combat/dodge.js`, `client/src/game/combat/fallbacks.js`

**Acceptance criteria:**

1. Dying does not show "Return to Main Menu" and does not send the player to the title screen.
2. After respawn the same class is still selected and input is not stuck blocked.
3. HP and mana come back full because `death.js` already does that. You did not change those numbers.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/death-respawn.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[UI-4] Replace the death menu with an entrance-respawn notice`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
