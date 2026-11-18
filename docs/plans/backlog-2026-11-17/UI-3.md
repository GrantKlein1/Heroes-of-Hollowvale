# UI-3 — Bartender dialog: name, focus, and errors that are not raw HTTP bodies

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **UI-3**.

**Branch:** create `hv/UI-3` from the latest `origin/main` (`git fetch origin && git switch -c hv/UI-3 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Depends on:** UI-2 merged to `origin/main`. If it is not, stop.

**Goal:** The bartender panel in `client/src/Game.jsx` is a plain `div`. Escape already closes it when the player is not typing. Make the panel a dialog: `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the existing "Tharos the Bartender" heading (give that heading an id). On open, move focus into the dialog. On close, return focus to the element that had it before. Do not trap focus with a library.

The chat text field has no accessible name. Add `aria-label="Message to the bartender"` (or a real `<label>`).

`sendToBartender` appends `Bartender (annoyed): ${err.message}` on failure. `err.message` can be a raw `API error: 500 ...` body. Replace that with one short line that the bartender could not answer, and do not include the response body or status text. Keep the loading line "The bartender is thinking…".

Do not change `client/src/lib/api.js` (SESSION-1 owns it in a later wave). Do not change prompts, RAG, or the five-turn leave rule. Do not edit the `ITEM_CONSUMED` handler.

**Read first:** AGENTS.md, the chat overlay and `sendToBartender` in `client/src/Game.jsx`.

**In flight, do not overlap:** B10-2 and 4-2 / #90 (`balance.js`, consume path, `hitSystem.js`). `4-2b` owns `Projectile.js`.

**Files you MAY change:**

- `client/src/Game.jsx`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- Wave 3 files owned by other packages: `client/src/main.jsx`, `client/src/components/PhaserGame.jsx`, `server/src/middleware/errorHandler.js`, `server/src/__tests__/errorHandler.test.js`, `docs/public-audit-2026-11-17.md`, and the `client/public/images` files listed in `PUBLIC-1.md`

**Acceptance criteria:**

1. The open chat panel is a named modal dialog and receives focus.
2. Closing it restores the previous focus.
3. A failed send does not put `API error` or a response body into the transcript.
4. The text field has an accessible name.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/chat-stream.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[UI-3] Name the bartender dialog and hide raw API errors`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
