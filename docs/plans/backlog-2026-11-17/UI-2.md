# UI-2 — Class cards, gem names, and readable HUD type match real controls

You are working in GrantKlein1/Heroes-of-Hollowvale. Follow AGENTS.md and `.agents/rules/hollowvale-guardrails.md`. Do ONLY package **UI-2**.

**Branch:** create `hv/UI-2` from the latest `origin/main` (`git fetch origin && git switch -c hv/UI-2 origin/main`). Never push to main, never merge, never auto-merge, never force-push.

**Grant's bot reviews and merges; you never merge.**

**Depends on:** UI-1 merged to `origin/main`. If it is not merged, stop. Do not rebase onto an unmerged UI-1 branch.

**Goal:** The class-select cards in `client/src/Game.jsx` advertise controls the game does not have (`[Z] Shield Bash`, `[X] Frost Nova`, `[C] Power Strike`, and the same pattern for mage, thief, and dwarf). Real controls, from `HollowvaleScene.js` (read-only):

- WASD or arrows: move
- E: interact
- Space: attack or cast
- Shift: dodge (all classes)
- C: block while held, knight only. Other classes dodge on C as well as Shift
- J: thief vanish
- V: inventory
- 1–9: hotbar
- F: swap hotbar with offhand when that option is on
- K: mage spell wheel while the spellbook is selected

Rewrite each class's `abilities` (and the strengths/weaknesses only if they name a control that does not exist) so they describe those real controls. Do not invent new abilities, spells, or place names. Keep the four class ids: knight, mage, thief, dwarf.

Market prices show `R`, `S`, and `E`. Spell those out as Ruby, Sapphire, and Emerald on the "Your gems" line and on each price. Do not change `MARKET_PRICES` numbers.

The corner hint says `WASD: Move · E: Interact · V: Inventory · F2: Collision`. Add Space and Shift to that line. Keep it to two short lines.

Replace `text-[10px]` in this file with at least `text-xs` (12px). Where `text-stone-400` sits on a `stone-900` / `stone-950` panel as the only copy (hotbar counts, spell key captions), use `text-stone-300`. Do not restyle the whole theme. Do not change layout structure.

Do not edit the `ITEM_CONSUMED` handler, loot grant math (UI-1 fixed the Ruby plural; leave that alone if it is already correct), consume effects, or damage.

**Read first:** AGENTS.md, the `CLASSES` object and the market and HUD blocks in `client/src/Game.jsx`, the key bindings in `client/src/game/scenes/HollowvaleScene.js` (read-only, around the `addKeys` and dodge/block checks).

**In flight, do not overlap:** B10-2 (`Player.js` tool-use, `HollowvaleScene.js` `_updateToolUse`, `toolUse.js`, cavern maps). 4-2 (`balance.js`, consume path, outgoing damage).

**Files you MAY change:**

- `client/src/Game.jsx`

**Files you MUST NOT change:**

- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json`
- `.env*`, `.github/**`
- `package.json`, `package-lock.json` (no new dependencies)
- `art-source/**`, `client/public/assets/**`, `manifest.json`
- `client/src/game/combat/balance.js`, `client/src/game/combat/hitSystem.js`, `client/src/game/scenes/HollowvaleScene.js`, `client/src/game/actors/Player.js`
- Wave 2 files owned by other packages: `tests/e2e/full-flow.spec.ts`, `client/src/game/actors/Enemy.js`, `client/src/game/ai/goblin.js`, `client/src/game/ai/brute.js`, `client/src/game/ai/archer.js`, `client/src/game/ai/dragon.js`, their `__tests__` files, `client/vite.config.js`, `client/src/styles/index.css`

**Acceptance criteria:**

1. Class cards do not mention Z, X, Shield Bash, Frost Nova, Power Strike, or any other control that is not in the list above.
2. Market gem labels say Ruby, Sapphire, and Emerald. Prices are unchanged.
3. `rg "text-\\[10px\\]" client/src/Game.jsx` prints nothing.
4. The corner hint mentions Space and Shift.
5. No new dependency and no balance change.

**Verify with:**

```
npm test
npm run build --workspace client
npx playwright test tests/e2e/smoke.spec.ts --reporter=line
```

Paste the output into the PR body. Never start a dev server by hand or use watch mode. Playwright's `webServer` starts Vite. If the Chromium download fails, use system Chrome (`channel: 'chrome'` in a temporary Playwright config, or `/usr/bin/google-chrome`). Do not commit that config or any browser binary.

**Evidence:** paste the command output and `git diff origin/main --stat` in the PR body.

**Process:** short plan at the top of the PR, small commits, ONE PR titled `[UI-2] Match class cards and HUD type to the real controls`. Stop after CI is green. No polish rounds. CI on this repo is `npm test` and `npm run build --workspace client` only.

**Stop** after that PR is open and CI is green. Do not start another package.
