# FLAGS-1 — One maps-flag function; keep both legacy opt-outs

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **FLAGS-1**.

**Branch:** create `hv/FLAGS-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/FLAGS-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Depends on:** B10-2 merged to `origin/main`. If `Player.js` still has the pre-B10-2 tool-use code, stop and do not open a PR.

**Goal:** Two functions disagree about maps. `isTiledMaps` in `client/src/game/config/flags.js` is true only when the `maps` param is exactly `tiled` (an absent param defaults to tiled). `MapLoader.isTiledMapsEnabled` treats absent, empty, `tiled`, `1`, and `true` as on, and only `legacy` as off. So `?maps=1` is on in MapLoader and off in `flags.js`. `HollowvaleScene` uses `isTiledMaps` from `flags.js`.

Make `MapLoader` call the one function in `flags.js`. Keep `?renderer=legacy` and `?maps=legacy` working. `isBlendRenderer` is not a constant: `?renderer=legacy` must still return false. Do not delete either opt-out.

In `Player.js`, you may change only the `isBlendRenderer` import and the two constructor guards that use it. Do not touch tool-use. Do not edit `HollowvaleScene.js` (`PATH-1` owns the tiled fallback).

**Read first:** AGENTS.md, `client/src/game/config/flags.js`, `client/src/game/maps/MapLoader.js` (`isTiledMapsEnabled`), the two `isBlendRenderer` guards in `client/src/game/actors/Player.js`.

**In flight, do not overlap:** `PATH-1` (`HollowvaleScene.js`, `mapRegistry.test.js`), `4-2b` (`Projectile.js`, `playerHitBuff.test.js`), 4-2 / #90 (`balance.js`, `hitSystem.js`).

**Files you MAY change:**

- `client/src/game/config/flags.js`
- `client/src/game/config/__tests__/flags.test.js`
- `client/src/game/maps/MapLoader.js`
- `client/src/game/maps/__tests__/MapLoader.test.js`
- `client/src/game/actors/Player.js` (the `isBlendRenderer` import and its two guards only)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/maps/__tests__/mapRegistry.test.js`
- `client/src/game/actors/Projectile.js`, `client/src/game/actors/__tests__/playerHitBuff.test.js`
- `client/src/game/combat/balance.js`, `client/src/game/combat/hitSystem.js`
- `server/src/npcData.js`, `client/src/lib/api.js` (COPY-1, SESSION-1)

**Acceptance criteria:**

1. `?maps=legacy` is off in both call sites. `?renderer=legacy` still selects the legacy renderer.
2. Absent `maps`, `maps=tiled`, `maps=1`, and `maps=true` agree. Add a unit test for the case that used to disagree (`maps=1`).
3. `HollowvaleScene.js` is not in the diff.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[FLAGS-1] One maps flag, both legacy opt-outs kept`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
