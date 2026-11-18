# PUBLIC-1 — Correct the public-image audit against current client/public

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **PUBLIC-1**.

**Branch:** create `hv/PUBLIC-1` from the latest `origin/main` (`git fetch origin && git switch -c hv/PUBLIC-1 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Goal:** Do not delete files. The 2026-11-17 MOVE list is already gone from `client/public`, and package 3-4 moved the painted backdrops as well. On `origin/main` at `09f6eca` those files are under `art-source/legacy-public/images/` and are not in `client/public/images/`:

- `animatedHealing/animatedHealing.gif`, `animatedHealing/animatedHealingPop.gif`
- `animatedMana/animatedMana.gif`
- `bossFightEmptyRoom.png`, `cleric.png`, `fireSmall.aseprite`, `red dragon.png`
- `specialSwordWithFire.gif`, `terrain/README.md`, `thiefReappear.gif`, `title screen.png`
- `dungeon entrance.png`, `dungeon.png`, `hiddenTreasureRoom.png`, `market.png`
- `start village screen.png`, `tavern.png`, `walkingPath.png`

`docs/public-audit-2026-11-17.md` still lists the MOVE rows as if they are in `client/public`, and it still marks several of the painted backdrops KEEP. Rebuild that table from the files that are actually in `client/public/images` on this branch. Drop every row whose file is not there. Add one line at the top: PUB-1 and 3-4 already moved the unreferenced and painted images to `art-source/legacy-public/`; this package does not delete or move anything.

Recheck references before you finish (`rg` the basename from `client/src`, `server/src`, and `tests`, excluding this audit doc). As of `09f6eca`, all 88 files under `client/public/images` are mentioned. If you find one that is not, stop and name it in the PR. Do not delete it.

Keep `images/red dragon boss fight room.png` and `images/title screen wider no background.png`. They are the title background and the title logo. Do not touch `art-source/**`, `client/public/assets/**`, `client/public/audio/**`, or `client/public/maps/**`.

**Read first:** AGENTS.md, `docs/public-audit-2026-11-17.md`, `git ls-tree -r --name-only HEAD -- client/public/images`.

**In flight, do not overlap:** B10-2, 4-2 / #90, `4-2b`.

**Files you MAY change:**

- `docs/public-audit-2026-11-17.md`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/**`, `client/src/**`, `server/**`, `tests/**`
- Wave 3 files owned by other packages: `client/src/Game.jsx`, `client/src/main.jsx`, `client/src/components/PhaserGame.jsx`, `server/src/middleware/errorHandler.js`, `server/src/__tests__/errorHandler.test.js`

**Acceptance criteria:**

1. The audit table lists only files that exist under `client/public/images`.
2. `git diff origin/main --stat` shows no deletions under `client/public` or `art-source`.
3. The two title images are still in `client/public/images`.

**Verify with:**

```
npm test
npm run build --workspace client
```

No Playwright. Paste the output into the PR body. Never start a dev server by hand or use watch mode.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[PUBLIC-1] Update the public-image audit to current client/public`. Stop after CI is green. No polish rounds. CI is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
