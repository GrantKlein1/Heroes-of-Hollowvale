# ERR-1 — Production API errors do not echo internal messages

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **ERR-1**.

**Branch:** create `hv/ERR-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/ERR-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `server/src/middleware/errorHandler.js` sends `err.message` to the client for every status. When `NODE_ENV` is `production` and the status is 500 (or missing), respond with `{ error: "Internal Server Error" }` and keep the status. Still log the real message on the server. 4xx responses may still send `err.message`. Non-production behavior stays as it is now (the message goes to the client) so local debugging does not change.

Add `server/src/__tests__/errorHandler.test.js` using `node:test`. Do not boot the listening server in `server/src/index.js`. Call the handler with mock `req` / `res`.

**Read first:** AGENTS.md, `server/src/middleware/errorHandler.js`.

**In flight, do not overlap:** B10-2, 4-2 / #90, `4-2b`.

**Files you MAY change:**

- `server/src/middleware/errorHandler.js`
- `server/src/__tests__/errorHandler.test.js` (new)

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `server/src/index.js`, `server/src/routes/**`
- Wave 3 files owned by other packages: `client/src/Game.jsx`, `client/src/main.jsx`, `client/src/components/PhaserGame.jsx`, `docs/public-audit-2026-11-17.md`, and the image files in `PUBLIC-1.md`

**Acceptance criteria:**

1. Production + status 500 returns exactly `{ error: "Internal Server Error" }`.
2. Production + status 400 still returns `err.message`.
3. When `NODE_ENV` is unset, status 500 still returns `err.message`.
4. The server log still includes the real message in both cases.

**Verify with:**

```
npm test
npm run build --workspace client
```

No Playwright. Paste the output into the PR body. Never start a dev server by hand or use watch mode.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[ERR-1] Hide internal error text on production 500s`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
