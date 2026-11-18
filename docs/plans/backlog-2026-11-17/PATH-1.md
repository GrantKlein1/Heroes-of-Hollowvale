# PATH-1 — Unknown scenes stay put, without a warning

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **PATH-1**.

**Branch:** create `hv/PATH-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/PATH-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Depends on:** B10-2 merged to `origin/main`. If `_updateToolUse` is not in `HollowvaleScene.js` yet, stop and do not open a PR. Do not edit that method.

**Goal:** Package 3-4 removed painted scenes. There is no `PAINTED_SCENES`, no `_showPainted`, and no `path` Tiled map. `DEFAULT_MAPS` has no `path` entry. Brackenford's south door targets `wilderness.tmj`, not a path scene.

`enterScene` on current main:

```js
const tiledMapEntry = id === 'wilderness' ? null : resolveMap(id)
if (id !== 'wilderness' && !tiledMapEntry) {
  console.warn(`[HollowvaleScene] No Tiled map for "${id}"`)
  return
}
```

`enterScene('path')` warns and returns. The current scene stays. It does not dump the player in Brackenford. That warn is the leftover. Delete it. Keep the early return so an id with no map (including `path`) does not change scene and does not mount wilderness.

This is the smaller fix. Do not also delete `SCENE_HINTS.path` or the `scene === 'path'` music check (`PT-K` and `UI-1` own those files). Do not author a `.tmj`. Do not add `path` to `DEFAULT_MAPS`. Do not restore a painted backdrop.

**Read first:** AGENTS.md, `enterScene` in `client/src/game/scenes/HollowvaleScene.js`, `DEFAULT_MAPS` in `client/src/game/maps/mapRegistry.js` (read-only).

**In flight, do not overlap:** `FLAGS-1` (`flags.js`, `MapLoader.js`, `Player.js`), `4-2b` (`Projectile.js`), 4-2 / #90.

**Files you MAY change:**

- `client/src/game/scenes/HollowvaleScene.js` (the no-map branch of `enterScene` only)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/**`, `manifest.json`
- `client/src/game/actors/Player.js`, `client/src/game/config/flags.js`, `client/src/game/maps/MapLoader.js`, `client/src/game/maps/mapRegistry.js`
- `client/src/game/sceneCatalog.js`, `client/src/Game.jsx`
- `client/src/game/actors/Projectile.js`, `client/src/game/combat/balance.js`, `client/src/game/combat/hitSystem.js`
- Anything not in the MAY list. If a test asserts the warning string, stop and name that file in the PR instead of editing it.

**Acceptance criteria:**

1. `enterScene('path')` does not log `[HollowvaleScene] No Tiled map`, does not change `sceneId`, and does not call `_showTiledMap` or `_showWilderness`.
2. `enterScene('village')` and `enterScene('wilderness', ...)` still run.
3. No new map file. `_updateToolUse` is unchanged.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[PATH-1] Stay put quietly when a scene has no Tiled map`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
