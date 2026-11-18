# DOCS-1 — README and art-pipeline match the shipped game

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **DOCS-1**.

**Branch:** create `hv/DOCS-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/DOCS-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** Two docs describe an older game.

`README.md` says lore comes from `newLore.txt`, the stack is React + Tailwind with no Phaser, and the world is only Village → Path → Dungeon. Canon for place names is `newLore_expanded.txt` (do not edit it). The client is React 18 + Vite + Tailwind + Phaser 3. The server is Express on port 5051. Dev is `npm install` then `npm run dev` (client 5173, API proxied). `npm test` runs Vitest and `node --test`. CI (`.github/workflows/ci.yml`, read-only) runs `npm test` and `npm run build --workspace client`. It does not run Playwright.

`docs/art-pipeline.md` still says Grant exports 16×16 Aseprite sheets into `client/public/images/` and the scene calls `this.load.aseprite`. The shipped path is Blendsmith atlases via `tools/assets/import_blendsmith.mjs`, 32 px tiles, 4 facings, anchors read from atlas meta. Point readers at `docs/ASSET_SPEC.md`. Keep a short note that `?renderer=legacy` still paints the old backdrops. Do not invent a new pipeline.

Do not add place names that are not already in `newLore_expanded.txt`. You may name Brackenford, the Embered Flagon, the Cavern of Embers, Emberwood, and the Ashen Wastes only if you need examples, and only because they are already in that file.

**Read first:** AGENTS.md, `README.md`, `docs/art-pipeline.md`, `docs/ASSET_SPEC.md` (read-only), `.github/workflows/ci.yml` (read-only).

**In flight, do not overlap:** B10-2 and 4-2. This package is docs only.

**Files you MAY change:**

- `README.md`
- `docs/art-pipeline.md`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `newLore_expanded.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/**`, `server/**`, `tests/**`, `tools/**`
- Wave 1 files owned by other packages: `client/src/Game.jsx`, `tests/e2e/hit-timing.spec.ts`, `tests/e2e/wilderness.spec.ts`, `server/src/rag/store.js`, `server/src/__tests__/ragRerankFlag.test.js`, `server/src/__tests__/rerank.test.js`, `client/src/components/GameHUD.jsx`, `client/src/components/DialogueModal.jsx`, `client/src/game/EventBus.js`

**Acceptance criteria:**

1. README names Phaser, the two ports, `npm test`, and `newLore_expanded.txt` as the place-name canon. It does not claim `newLore.txt` is the only lore source.
2. `docs/art-pipeline.md` no longer tells the reader to call `this.load.aseprite` as the current path. It points at `docs/ASSET_SPEC.md` and the importer.
3. No code files in the diff. No new place names.

**Verify with:**

```
npm test
npm run build --workspace client
```

No Playwright. Docs only. Paste the output into the PR body anyway. Never start a dev server by hand or use watch mode.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[DOCS-1] Correct the README and art-pipeline docs`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
