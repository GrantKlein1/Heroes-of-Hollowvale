# UI-1 — Drop dead backdrop keys, fix the Ruby plural, timeout the loading line

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **UI-1**.

**Branch:** create `hv/UI-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/UI-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** In `client/src/Game.jsx`, the `ASSETS` object still lists painted backdrop keys that nothing reads. Only `ASSETS.titleBg` and `ASSETS.titleLogo` are used (the title screen). Delete the unused keys: `villageBg`, `tavernBg`, `marketBg`, `pathBg`, `dungeonBg`, `dungeonInteriorBg`, `treasureBg`, and `player`. Do not delete `titleBg` or `titleLogo`.

PR #89 already removed `PATHS.villageBg`, `PATHS.tavernBg`, `PATHS.marketBg`, `PATHS.walkingPath`, `PATHS.dungeonEntrance`, `PATHS.dungeonInterior`, and `PATHS.hiddenTreasureRoom` from `client/src/config/paths.js`. Those `ASSETS` values are undefined. Do not add the fields back, and do not edit `paths.js`. The image files are in `art-source/legacy-public/`, not in `client/public`.

Loot notices build "Ruby" + (`count > 1` ? `"ies"` : `""`), so two rubies read "Rubyies". Make the plural "Rubies". Leave Sapphire and Emerald plurals correct (Sapphires, Emeralds).

If `ready` is still false 12 seconds after mount, replace the forever "Loading assets…" line with one sentence that the assets are still loading and the player can refresh. Do not add a spinner library.

**Read first:** AGENTS.md, `client/src/Game.jsx` (`ASSETS` near the top, the loot notice around the `onLoot` handler, the `{!ready && (` loading block).

**In flight, do not overlap:** B10-2 is editing `Player.js` tool-use, `HollowvaleScene.js` `_updateToolUse`, a new `client/src/game/combat/toolUse.js`, and cavern maps. 4-2 is editing `client/src/game/combat/balance.js` (`CONSUMABLE_EFFECTS`), the consume path, and outgoing-damage math. Do not edit those. Do not edit the `ITEM_CONSUMED` handler or any consume/damage helper in `Game.jsx`.

**Files you MAY change:**

- `client/src/Game.jsx`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- Wave 1 files owned by other packages: `tests/e2e/hit-timing.spec.ts`, `tests/e2e/wilderness.spec.ts`, `server/src/rag/store.js`, `server/src/__tests__/ragRerankFlag.test.js`, `server/src/__tests__/rerank.test.js`, `client/src/components/GameHUD.jsx`, `client/src/components/DialogueModal.jsx`, `client/src/game/EventBus.js`, `README.md`, `docs/art-pipeline.md`
- Anything not in the MAY list. If you need another file, stop and say so in the PR. Do not take it.

**Acceptance criteria:**

1. `ASSETS` in `Game.jsx` contains only `titleBg` and `titleLogo`. The title screen still shows both images.
2. A loot notice for 2 rubies contains "Rubies" and does not contain "Rubyies". One ruby stays "Ruby".
3. The loading line changes after about 12 seconds when assets never become ready. It does not change the normal ready path.
4. No new dependency. No lore edits. No balance or consume-effect edits.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[UI-1] Drop dead backdrop keys and fix the Ruby plural`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
