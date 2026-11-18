# RAG-1 — Stable lore order when scores tie

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **RAG-1**.

**Branch:** create `hv/RAG-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/RAG-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** Lore retrieval sorts by score only (`server/src/rag/store.js`, both `.sort((a, b) => b.score - a.score)` sites in `retrieveCandidates`). Equal scores keep whatever order the input had. Two calls can disagree when embeddings fail and the token-overlap fallback ties, which is what `ragRerankFlag.test.js` and `rerank.test.js` compare with `deepEqual`. On this audit machine the embedder and the cross-encoder both failed with `fetch failed`, and the tests still passed once. The order is not guaranteed.

Break ties by chunk id (string compare) after the score compare, in both sort sites. Higher score still wins. Do not change which texts are eligible, the token cap, `RAG_RERANK` (leave the default off), or `lore.json`.

Add a test that calls the same query twice and asserts the chunk id order matches. Put it in `server/src/__tests__/rerank.test.js` or `ragRerankFlag.test.js`. Do not load a new model and do not add a dependency.

**Read first:** AGENTS.md, `server/src/rag/store.js` (`retrieveCandidates`), `server/src/__tests__/ragRerankFlag.test.js`, `server/src/__tests__/rerank.test.js`.

**In flight, do not overlap:** B10-2 and 4-2 are client combat packages. Do not touch them. Do not turn rerank on.

**Files you MAY change:**

- `server/src/rag/store.js`
- `server/src/__tests__/ragRerankFlag.test.js`
- `server/src/__tests__/rerank.test.js`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/**`
- Wave 1 files owned by other packages: `client/src/Game.jsx`, `tests/e2e/hit-timing.spec.ts`, `tests/e2e/wilderness.spec.ts`, `client/src/components/GameHUD.jsx`, `client/src/components/DialogueModal.jsx`, `client/src/game/EventBus.js`, `README.md`, `docs/art-pipeline.md`
- `server/src/rag/rerank.js` (do not retune the model)

**Acceptance criteria:**

1. Both sorts in `retrieveCandidates` order by score descending, then by id ascending.
2. A new test retrieves one query twice and deep-equals the ids.
3. `npm test` passes, including the existing rerank and `RAG_RERANK` flag tests. Default mode stays off.
4. `lore.json` is not in the diff.

**Verify with:**

```
npm test
npm run build --workspace client
```

No Playwright. This package does not change the client.

Paste the output into the PR body. Never start a dev server by hand or use watch mode.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[RAG-1] Break lore retrieval ties by chunk id`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
