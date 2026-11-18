# SESSION-1 — Session ids do not use Math.random

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **SESSION-1**.

**Branch:** create `hv/SESSION-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/SESSION-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** `getSessionId` in `client/src/lib/api.js` falls back to `Math.random` when `crypto.randomUUID` is missing. That path is outside `client/src/game`, so the seeded-RNG rule does not apply to it, but the fallback still makes session ids nondeterministic and unreadable in logs. Use `crypto.randomUUID` when it exists, and otherwise a short id built from `crypto.getRandomValues` (or `Date.now` plus a counter if `crypto` itself is missing). Remove the `Math.random` call. Do not change request URLs, headers other than the existing session id, or chat streaming.

If `client/src/lib/__tests__/apiStream.test.js` breaks, update only the assertion that assumed `Math.random`. Do not rewrite the suite.

**Read first:** AGENTS.md, `getSessionId` in `client/src/lib/api.js`.

**In flight, do not overlap:** `COPY-1` (`npcData.js`), `FLAGS-1`, `PATH-1`, `4-2b`.

**Files you MAY change:**

- `client/src/lib/api.js`
- `client/src/lib/__tests__/apiStream.test.js` only if that test breaks

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/game/**`, `server/src/npcData.js`

**Acceptance criteria:**

1. `rg Math.random client/src/lib/api.js` finds nothing.
2. A session id is still sent on chat requests.
3. No game file is in the diff.

**Verify with:**

```
npm test
npm run build --workspace client
```

No Playwright. Paste the output into the PR body. Never start a dev server by hand or use watch mode.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[SESSION-1] Drop Math.random from session ids`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
