# COPY-1 — Bartender prompt: "gravelly", not "gravely"

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **COPY-1**.

**Branch:** create `hv/COPY-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/COPY-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `server/src/npcData.js` tells the bartender model to speak in a voice that is "wise and gravely". Change that one word to "gravelly". Do not rewrite the prompt. Do not add the name Tharos to lore. Do not edit `server/src/rag/lore.json`.

If a test snapshots that sentence, update the one word. If no test does, do not add a test file.

**Read first:** AGENTS.md, the bartender system prompt in `server/src/npcData.js`.

**In flight, do not overlap:** wave 5 files of `FLAGS-1`, `PATH-1`, `SESSION-1`, and `4-2b`.

**Files you MAY change:**

- `server/src/npcData.js`
- a test file only if it already snapshots the word "gravely"

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/lib/api.js`, `client/src/game/config/flags.js`, `client/src/game/maps/MapLoader.js`, `client/src/game/actors/Player.js`, `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/actors/Projectile.js`

**Acceptance criteria:**

1. The prompt contains "gravelly" and does not contain "gravely".
2. The rest of the prompt is unchanged.

**Verify with:**

```
npm test
npm run build --workspace client
```

No Playwright. Paste the output into the PR body. Never start a dev server by hand or use watch mode.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[COPY-1] Fix the bartender prompt spelling of gravelly`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
