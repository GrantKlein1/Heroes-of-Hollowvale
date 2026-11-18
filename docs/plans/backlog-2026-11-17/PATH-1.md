# PATH-1 — A missing tiled map must not dump the player in Brackenford

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **PATH-1**.

**Branch:** create `hv/PATH-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/PATH-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Depends on:** B10-2 merged to `origin/main`. If `_updateToolUse` is not in `HollowvaleScene.js` yet, stop and do not open a PR. Do not edit that method.

**Goal:** `path` has a painted scene in `sceneCatalog.js` (`PAINTED_SCENES.path`) and no entry in `mapRegistry.js` `DEFAULT_MAPS`. `enterScene` already paints when `resolveMap(id)` is null. The bug is the cache miss in `_showTiledMap`: it warns and calls `_showPainted('village', ...)` instead of the scene the player asked for.

When the tiled cache misses, fall back to `PAINTED_SCENES[this.sceneId]` when that entry exists. Do not hard-code `village`. Do not author a new `.tmj`. Do not add `path` to `DEFAULT_MAPS`. Do not invent places.

You may add an assertion in `client/src/game/maps/__tests__/mapRegistry.test.js` that `path` has no tiled map. Do not change other registry entries.

**Read first:** AGENTS.md, `_showTiledMap` in `client/src/game/scenes/HollowvaleScene.js` (the cache-miss branch), `PAINTED_SCENES` in `client/src/game/sceneCatalog.js` (read-only), `DEFAULT_MAPS` in `client/src/game/maps/mapRegistry.js` (read-only).

**In flight, do not overlap:** `FLAGS-1` (`flags.js`, `MapLoader.js`, `Player.js`), `4-2b` (`Projectile.js`), 4-2 / #90. Do not edit `Player.js`, `flags.js`, or `MapLoader.js`.

**Files you MAY change:**

- `client/src/game/scenes/HollowvaleScene.js` (the tiled cache-miss fallback only)
- `client/src/game/maps/__tests__/mapRegistry.test.js`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`, `client/public/maps/**`
- `client/src/game/actors/Player.js`, `client/src/game/config/flags.js`, `client/src/game/maps/MapLoader.js`
- `client/src/game/actors/Projectile.js`, `client/src/game/actors/__tests__/playerHitBuff.test.js`
- `client/src/game/combat/balance.js`, `client/src/game/combat/hitSystem.js`
- `client/src/game/sceneCatalog.js` (PT-K), `server/src/npcData.js`, `client/src/lib/api.js`

**Acceptance criteria:**

1. A cache miss for a scene that has `PAINTED_SCENES[id]` paints that scene, not Brackenford.
2. `path` is still absent from `DEFAULT_MAPS`.
3. `_updateToolUse` is unchanged.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[PATH-1] Paint the requested scene when its tiled map is missing`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
