# Backlog 2026-11-17

Planning only. No game code in this branch. Launch one grok-4.7 cloud agent per package. Each agent opens one PR from `hv/<ID>`. Grant's bot reviews and merges. Agents never merge.

Audit date: 2026-11-18 (workspace clock). Package premises rechecked against `origin/main` at `09f6eca` (`[3-4] Remove the painted renderer and maps opt-out`, PR #89). The test and Playwright counts below were run on `64f103c`, before that merge.

## Do not overlap work already running

| Package | Owns right now | This backlog |
|---|---|---|
| B10-2 | `Player.js` tool-use, `HollowvaleScene.js` `_updateToolUse`, new `client/src/game/combat/toolUse.js`, cavern maps | `FLAGS-1` and `PATH-1` wait until B10-2 is on `origin/main`. Nobody else touches those files. |
| 4-2 (PR #90, being merged) | `scaleOutgoingDamage` in `balance.js`, called from melee in `hitSystem.js`. Ale is +10 HP and 1.25x for 5s. Fireball, lightning, and the poison vial are not scaled yet. | `4-2b` waits until #90 is on `origin/main`, then calls that helper from `Projectile._applyPlayerHit`. Nobody else edits `balance.js`, `hitSystem.js`, or the consume path. |

PR #89 removed the painted renderer and both URL opt-outs. `parseFlags` always returns blend and tiled. `FLAGS-1` deletes `getRenderer`, `isBlendRenderer`, `getMaps`, `isTiledMaps`, and `isTiledMapsEnabled`. It does not keep `?renderer=legacy` or `?maps=legacy`.

## Audit (this run)

| Command | Result |
|---|---|
| `npm test` | Client Vitest: 44 files, 631 passed. Server `node --test`: 63 passed, 1 skipped, 0 failed. Exit 0. |
| `npm run build --workspace client` | Exit 0. One JS chunk `dist/assets/index-*.js` **2,067.73 kB** (gzip 496.63 kB). Vite warns over 500 kB. |
| `npx playwright test --reporter=line` | See the Playwright section below. System Chrome (`channel: 'chrome'`). The Chromium download was not used. |

Server retrieval tests passed on this machine while local embeddings and the cross-encoder failed to fetch (`[RAG] Local embeddings failed: fetch failed`) and the token-overlap fallback ran. Order can still change between calls when scores tie. That is `RAG-1`.

`tests/e2e/hit-timing.spec.ts` spawns the goblin at `player.x + 70`, `player.y - 90`. The knight is feet-anchored; the right-facing sword box is beside the body, not 90 px above it. `tests/e2e/wilderness.spec.ts` writes `/opt/cursor/artifacts/wilderness-fps.txt`. `tests/e2e/full-flow.spec.ts` is the long shipped-path spec and has been flaky.

Vite's dev server warned that JavaScript imports JSON from `client/public/` (`AssetRegistry.js`, `spells.js`, `Dragon.js`, `generate.js`, and some tests). Fixing that makes preload async and touches `HollowvaleScene.js`, which B10-2 and `PATH-1` already own. It is **not** a package in this backlog.

Several specs call `page.screenshot` into `tests/e2e/__screenshots__/`, which overwrites committed baselines. This audit run dirtied those PNGs. They are not part of this branch. A later cleanup can point those writes at `test-results/` instead.

## Waves

Twenty-five packages. The audit listed twenty-four. `4-2b` was added after PR #90, which scales melee only.

Run a wave together. Do not start the next wave until the previous wave's PRs are merged, because `Game.jsx` is one package per wave. Inside a wave the file lists do not overlap.

`COPY-1` and `SESSION-1` do not need B10-2 or #90. They sit in wave 5 so that wave stays one disjoint set. They may start as soon as wave 4 has merged. `FLAGS-1` and `PATH-1` also wait on B10-2. `4-2b` also waits on PR #90. Those three waits are independent of each other.

| ID | Title | Wave | Files touched | Risk | Dependency |
|---|---|---|---|---|---|
| UI-1 | Drop dead backdrop keys, fix the Ruby plural, timeout the loading line | 1 | `client/src/Game.jsx` | low | none |
| E2E-HIT | Spawn the hit-timing goblin inside the right-facing sword box | 1 | `tests/e2e/hit-timing.spec.ts` | low | none. Do not edit damage math (4-2). |
| E2E-WILD | Stop the wilderness spec writing outside the repo | 1 | `tests/e2e/wilderness.spec.ts` | low | none |
| RAG-1 | Stable lore order when scores tie | 1 | `server/src/rag/store.js`, `server/src/__tests__/ragRerankFlag.test.js`, `server/src/__tests__/rerank.test.js` | low | none |
| DEAD-1 | Delete the unmounted HUD, dialogue modal, and unused Phaser bus | 1 | `client/src/components/GameHUD.jsx`, `client/src/components/DialogueModal.jsx`, `client/src/game/EventBus.js` | low | none |
| DOCS-1 | README and art-pipeline match the shipped game | 1 | `README.md`, `docs/art-pipeline.md` | low | none |
| UI-2 | Class cards, gem names, and readable HUD type match real controls | 2 | `client/src/Game.jsx` | low | UI-1 merged |
| E2E-FLOW | Tighten waits in the full shipped-path spec | 2 | `tests/e2e/full-flow.spec.ts` | med | none |
| LOG-1 | Enemy anim logs only when `?debug=1` | 2 | `client/src/game/actors/Enemy.js`, `client/src/game/ai/goblin.js`, `client/src/game/ai/brute.js`, `client/src/game/ai/archer.js`, `client/src/game/ai/dragon.js`, plus those suites only if they assert the log line | low | none |
| BUNDLE-1 | Put Phaser in its own Vite chunk | 2 | `client/vite.config.js` | med | none |
| A11Y-1 | Visible keyboard focus rings | 2 | `client/src/styles/index.css` | low | none |
| UI-3 | Bartender dialog: name, focus, and errors that are not raw HTTP bodies | 3 | `client/src/Game.jsx` | low | UI-2 merged |
| STRICT-1 | One Phaser game under React StrictMode | 3 | `client/src/main.jsx`, `client/src/components/PhaserGame.jsx` | med | none |
| ERR-1 | Production API errors do not echo internal messages | 3 | `server/src/middleware/errorHandler.js`, `server/src/__tests__/errorHandler.test.js` | low | none |
| PUBLIC-1 | Correct the public-image audit; the old MOVE files are already gone | 3 | `docs/public-audit-2026-11-17.md` | low | none. Do not delete `client/public` files. |
| UI-4 | Death is a short notice, then the existing entrance respawn | 4 | `client/src/Game.jsx`, `tests/e2e/death-respawn.spec.ts` only if that spec requires the old menu | low | UI-3 merged. Do not edit `death.js` or balance. |
| PT-K | Playtest knight: Brackenford, tavern, wilderness | 4 | `docs/playtest/2026-11-17-knight.md`, `docs/playtest/knight/**`, `tests/e2e/playtest-knight.spec.ts`, `client/src/game/sceneCatalog.js` (`SCENE_HINTS` strings only) | low | none. South from Brackenford is wilderness, not `path`. |
| PT-M | Playtest mage: spell wheel and one cast | 4 | `docs/playtest/2026-11-17-mage.md`, `docs/playtest/mage/**`, `tests/e2e/playtest-mage.spec.ts`, `client/src/game/fxLayer.js` | low | none |
| PT-T | Playtest thief: move, vanish, dagger swing | 4 | `docs/playtest/2026-11-17-thief.md`, `docs/playtest/thief/**`, `tests/e2e/playtest-thief.spec.ts`, `client/src/game/combat/dodge.js` | low | none. Do not edit Player tool-use (B10-2). |
| PT-D | Playtest dwarf: axe swing in Brackenford | 4 | `docs/playtest/2026-11-17-dwarf.md`, `docs/playtest/dwarf/**`, `tests/e2e/playtest-dwarf.spec.ts`, `client/src/game/combat/fallbacks.js` | low | none. Do not edit ale damage (4-2). |
| FLAGS-1 | Remove the constant renderer and maps wrappers | 5 | `client/src/game/config/flags.js`, `client/src/game/config/__tests__/flags.test.js`, `client/src/game/maps/MapLoader.js`, `client/src/game/maps/__tests__/MapLoader.test.js`, `client/src/game/actors/Player.js` (the `isBlendRenderer` import and its two hooks only) | med | **Wait for B10-2** on `origin/main`. Do not edit `HollowvaleScene.js` (`PATH-1`). Do not keep the legacy opt-outs. |
| PATH-1 | An unknown scene id stays put, with no warning | 5 | `client/src/game/scenes/HollowvaleScene.js` (`enterScene` no-map branch only) | low | **Wait for B10-2** on `origin/main`. Do not edit `Player.js`, `flags.js`, `MapLoader.js`, or `sceneCatalog.js`. |
| COPY-1 | Bartender prompt: "gravelly", not "gravely" | 5 | `server/src/npcData.js` and a test only if it snapshots that sentence | low | none (wave 5 only so the wave stays disjoint) |
| SESSION-1 | Session ids do not use `Math.random` | 5 | `client/src/lib/api.js`, `client/src/lib/__tests__/apiStream.test.js` only if that test breaks | low | none (wave 5 only so the wave stays disjoint) |
| 4-2b | Ale damage boost on fireball, lightning, and poison vial hits | 5 | `client/src/game/actors/Projectile.js` (`_applyPlayerHit` flat-damage branch only), `client/src/game/actors/__tests__/playerHitBuff.test.js` | low | **Wait for PR #90** on `origin/main`. Do not edit `balance.js` or `hitSystem.js`. |

## Launch order

1. Wave 1, six agents at once.
2. Wave 2 after wave 1 has merged (`UI-2` needs `UI-1`'s `Game.jsx`).
3. Wave 3 after wave 2 has merged (`UI-3` needs `UI-2`).
4. Wave 4 after wave 3 has merged (`UI-4` needs `UI-3`). The four playtests do not edit `Game.jsx`.
5. Wave 5 after wave 4 has merged. `COPY-1` and `SESSION-1` can start then. `FLAGS-1` and `PATH-1` also wait until B10-2 is on `origin/main`. `4-2b` also waits until PR #90 is on `origin/main`. If a wait is not met, that agent stops without a PR.

`4-2b` is the only package that applies the ale buff. It does not change the 1.25 multiplier or the 5 second timer. Those stay in `balance.js` from #90.

## Place names

Packages may use names already in `newLore_expanded.txt` and in the game: Hollowvale, Brackenford, the Embered Flagon, the Cavern of Embers, Emberwood, the Ashen Wastes, Veyrath. They must not add names, and they must not edit `newLore.txt`, `lore.txt`, or `server/src/rag/lore.json`. The bartender label "Tharos" is already in the UI. Do not add it to lore.

## Playwright

`npx playwright test --reporter=line` with system Chrome (`channel: 'chrome'` on a temporary config, not committed). 63 tests, **62 passed, 1 failed**, 4.9m.

The failure is `tests/e2e/hit-timing.spec.ts:127`: `page.waitForFunction` timed out at 5000ms waiting for goblin HP `<= 3` after the knight's right-facing swing. That is `E2E-HIT`. The wilderness spec passed on this run and still writes `/opt/cursor/artifacts/wilderness-fps.txt` (`E2E-WILD`). `full-flow.spec.ts` passed this run; it stays in the backlog because it has been flaky (`E2E-FLOW`).
