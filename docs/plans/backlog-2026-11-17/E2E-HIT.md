# E2E-HIT — Spawn the hit-timing goblin inside the right-facing sword box

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **E2E-HIT**.

**Branch:** create `hv/E2E-HIT` from the latest `origin/main` (`git fetch origin && git switch -c hv/E2E-HIT origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `tests/e2e/hit-timing.spec.ts` (the knight melee test, the assertion that waits for goblin HP `<= 3`, around the `waitForFunction` near line 127) fails because the goblin is spawned outside the right-facing sword box. The spec does `player.x + 70` and `player.y - 90` after facing right. The knight is feet-anchored. The sword box sits beside the body, not 90 px above the feet.

Fix the **spec only**. Read the right-facing `attack` hitbox from the knight attack atlas JSON under `client/public/assets/` (read-only). Place the dummy so its hurtbox intersects that box, with `speed = 0`. Keep the timing asserts: HP stays 15 before the hit frame, then drops to 3, and `lastFx` is `fx_common_hit_spark`.

If the atlas hitbox itself cannot reach a goblin standing in front of the knight, stop. Write that in the PR. Do not edit `hitSystem.js`, `balance.js`, or `Player.js`. Outgoing damage belongs to package 4-2, which is in flight.

**Read first:** AGENTS.md, `tests/e2e/hit-timing.spec.ts`, `client/src/game/combat/hitSystem.js` (read-only: `computeWorldHitbox`), the knight attack atlas meta `hitbox` for facing `right`.

**In flight, do not overlap:** B10-2 (`Player.js` tool-use, `HollowvaleScene.js` `_updateToolUse`, `client/src/game/combat/toolUse.js`, cavern maps). 4-2 (`balance.js`, consume path, outgoing damage).

**Files you MAY change:**

- `tests/e2e/hit-timing.spec.ts`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/**` (product code)
- Wave 1 files owned by other packages: `client/src/Game.jsx`, `tests/e2e/wilderness.spec.ts`, `server/src/rag/store.js`, `server/src/__tests__/ragRerankFlag.test.js`, `server/src/__tests__/rerank.test.js`, `client/src/components/GameHUD.jsx`, `client/src/components/DialogueModal.jsx`, `client/src/game/EventBus.js`, `README.md`, `docs/art-pipeline.md`
- Screenshot baselines under `tests/e2e/__screenshots__/`. If you need a shot, write it under `test-results/` and do not commit it.

**Acceptance criteria:**

1. The knight hit-timing test passes with `--reporter=line`.
2. The goblin is stationary and stands where the right-facing attack box can hit it. The HP-before-hit-frame assert is unchanged.
3. `git diff origin/main --stat` shows only `tests/e2e/hit-timing.spec.ts`.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/hit-timing.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[E2E-HIT] Spawn the hit-timing goblin inside the sword box`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
