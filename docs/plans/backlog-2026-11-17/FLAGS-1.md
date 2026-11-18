# FLAGS-1 — Remove the constant renderer and maps wrappers

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **FLAGS-1**.

**Branch:** create `hv/FLAGS-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/FLAGS-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Depends on:** B10-2 merged to `origin/main`. `Player.js` is the only production caller of `isBlendRenderer`. If that import or the two guards below are not the ones B10-2 left behind, stop and do not open a PR.

**Goal:** PR #89 (`09f6eca`, package 3-4) deleted the painted renderer and the maps opt-out. Grant approved that removal. `parseFlags` now always sets `renderer: 'blend'` and `maps: 'tiled'` and ignores the query. These wrappers only return that constant:

- `getRenderer`, `isBlendRenderer`, `getMaps`, `isTiledMaps` in `client/src/game/config/flags.js`
- `isTiledMapsEnabled` in `client/src/game/maps/MapLoader.js` (always `true`; the search argument is ignored)

Delete the wrappers, their imports, and the tests that only call them. Do not keep `?renderer=legacy` or `?maps=legacy`. Do not add a query switch back.

Call sites on `09f6eca`:

- `Player.js` imports `isBlendRenderer` and uses it in two constructor hooks (`scene._tryAttack` and `scene._hurtPlayer`). Both true-branches are the blend player. Make those hooks run that branch with no flag check. Delete the `origTryAttack(now)` / `origHurtPlayer(amount, opts)` fallbacks that existed only for the painted renderer. Do not touch tool-use, vial throw, or `cast`.
- Nothing else in production imports the five functions. `HollowvaleScene.js` does not. Do not edit it (`PATH-1`).

Keep `parseFlags`, `getFlags`, `isQa`, `getSeed`, and `isDebug`. `LOG-1` still calls `isDebug`. You may leave `renderer` and `maps` on the object `parseFlags` returns, always `'blend'` and `'tiled'`. One test may assert that a `renderer` or `maps` query does not change those two fields. Delete tests whose only job is `getRenderer` / `isBlendRenderer` / `getMaps` / `isTiledMaps` / `isTiledMapsEnabled`.

**Read first:** AGENTS.md, `client/src/game/config/flags.js`, `client/src/game/maps/MapLoader.js` (`isTiledMapsEnabled`), the two hooks in `client/src/game/actors/Player.js`.

**In flight, do not overlap:** `PATH-1` (`HollowvaleScene.js`), `4-2b` (`Projectile.js`), 4-2 / #90 (`balance.js`, `hitSystem.js`).

**Files you MAY change:**

- `client/src/game/config/flags.js`
- `client/src/game/config/__tests__/flags.test.js`
- `client/src/game/maps/MapLoader.js`
- `client/src/game/maps/__tests__/MapLoader.test.js`
- `client/src/game/actors/Player.js` (the `isBlendRenderer` import and the two hooks only)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/game/scenes/HollowvaleScene.js`
- `client/src/game/actors/Projectile.js`, `client/src/game/combat/balance.js`, `client/src/game/combat/hitSystem.js`
- `server/src/npcData.js`, `client/src/lib/api.js`
- Anything not in the MAY list. If you need another file, stop and say so in the PR.

**Acceptance criteria:**

1. `rg "getRenderer|isBlendRenderer|getMaps|isTiledMaps" client/src` finds nothing. `isTiledMapsEnabled` is gone.
2. `isQa`, `getSeed`, and `isDebug` still work. `?debug=1` is still debug. `?renderer=legacy` and `?maps=legacy` do not select another renderer or another map mode.
3. The player attack and hurt hooks no longer branch on a renderer flag.
4. `HollowvaleScene.js` is not in the diff.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[FLAGS-1] Remove the constant renderer and maps wrappers`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
