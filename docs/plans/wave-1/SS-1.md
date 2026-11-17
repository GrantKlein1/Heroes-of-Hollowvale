# SS-1 refined spec (Wave 1 planning, verified on `origin/main` @ `4e68ca0`)

Tightens `prompts/SS-1.md`. If this file conflicts with the prompt, the prompt wins.

> **BLOCKER (wrong premise).** The `brackenford-overview.png` diff on main is **not barrel-only**. Under the prompt as written (step 2: "If anything else differs, do NOT update"), SS-1 ends with no baseline change. The "whole spec must be green" acceptance is also impossible, because of an unrelated pre-existing failure. See section 6 for the question to Grant.

## 1. Verified facts

I ran `npx playwright test tests/e2e/brackenford.spec.ts --reporter=line` on clean `origin/main` (system Chrome 157 symlinked as Playwright's chromium, because `cdn.playwright.dev` was blocked; see trap 3). Result: `2 failed, 3 passed`.

| Prompt claim | Status | Evidence |
|---|---|---|
| BF-1 moved the barrel x 128 -> 544 | CONFIRMED | `generate_tmj.mjs` 796 `addProp('barrel', 17, 6)`; `brackenford.tmj` prop id 8 `barrel` x 544, y 176, 32x48 (feet y 224) |
| `brackenford-overview.png` is the one stale baseline | CONFIRMED that it fails; **WRONG that the cause is only the barrel** | `47903 pixels (ratio 0.06 of all image pixels) are different` (threshold `maxDiffPixelRatio: 0.05`, `playwright.config.ts`). The baseline dates from 2-3 (#48, 2026-11-08), last touched in `0dc7a8f`. The diff image also shows: (a) all three buildings redrawn (different doors, windows, roof trim), because O-V5-1 (#77) replaced `client/public/assets/props/village_props/village_props.png` (10141 -> 14872 bytes); (b) prompt beacons and labels ("The Flagon", "Notice", "Wilderness", the active "Press E to exit to wilderness") with their outline rectangles, which are absent from the baseline; (c) differences along both river rows; (d) the barrel move. |
| Check the four `brackenford-<class>-1080p.png` | CONFIRMED passing | test "Calibrated viewports … across all 4 classes" (line 248) **passed** within the 5% threshold. Do not touch them. |
| Check `camera-centering-*` | WRONG file | Those baselines belong to `tests/e2e/camera-centering.spec.ts`, not `brackenford.spec.ts`. They are out of SS-1 scope; don't run or update them. |
| After updating, the whole spec "must be green" | **Impossible within SS-1's MAY list** | "Tavern door exit leads to tavern and NPC interaction opens dialogue" (line 196) fails on main at line 245 `await expect(page.locator('text=Tharos').first()).toBeVisible()`. 3-1b (#76) rebuilt the tavern and put Tharos's NPC zone at (320,40) 64x96, while the test interacts at the world centre (320,192) (lines 233-240). This has nothing to do with screenshots, and SS-1 may not edit specs. |

## 2. Exact MAY-change list (tightened)

- `tests/e2e/__screenshots__/brackenford-overview.png`, and only if Grant answers the section 6 question "yes".
- `brackenford-{knight,mage,thief,dwarf}-1080p.png`: **do not change**. They pass today.
- No ADDITIONS.

## 3. Overlap check

- Open PRs: none. `hv/IT-1` = `main`.
- Wave 1: no shared file. MX-1 and PUB-1 also run `brackenford.spec.ts` and will see the same two failures until SS-1 lands. MX-1's new spawn zones are not drawn (`_drawBeacons`, `HollowvaleScene.js` 1882-1894, draws only `this.prompts`), so MX-1 landing first or second does not change this baseline. PUB-1 moves only unreferenced images, so it does not change it either.

## 4. Test plan

1. `npx playwright test tests/e2e/brackenford.spec.ts --reporter=line` -> expect exactly `2 failed` (overview 0.06 and the Tharos test) and `3 passed`. Anything else = report it.
2. Open `brackenford-overview-{expected,actual,diff}.png` in `test-results/brackenford-Package-2-3-Pl-<hash>-d-maps-tiled-renderer-blend-chromium/` (the run prints the exact path). For each changed region, name its source: barrel = BF-1 #78; building art = O-V5-1 #77 `village_props.png`; beacons and labels = prompt beacons (`_drawBeacons`, `_buildTiledPrompts`); river = name it or flag it as unexplained.
3. Only with Grant's "yes" (section 6): `npx playwright test tests/e2e/brackenford.spec.ts -g "Brackenford visibly renders 32px tiles" --update-snapshots --reporter=line`. Note `-g` takes the **title**, not the PNG name.
4. Re-run the spec: expect `1 failed` (the Tharos test, pre-existing) and `4 passed`. Report the Tharos failure as pre-existing with the cause above.
5. `npm test && npm run build --workspace client` (main: client 595/595; server 51/52 offline, the 1 is `rerank.test.js` "fetch failed").

## 5. Risks and traps

1. **Beacon pulse is time-based** (`_drawBeacons`: `alpha = 0.35 + 0.35 * Math.sin(performance.now() / 350)`), so the outline alpha changes frame to frame. `toHaveScreenshot` waits for two identical frames ("captured a stable screenshot"), but a fresh baseline can still be borderline against later runs. After updating, run the spec **twice** and paste both overview results. If the second run fails the overview, report it rather than looping on `--update-snapshots`.
2. Baselines are machine-specific (fonts, GPU and Chrome version). Say in the PR which browser produced the new PNG.
3. Browser download: `npx playwright install chromium` was blocked here (`ECONNRESET` on `cdn.playwright.dev`). The workaround: symlink the system Chrome into `~/.cache/ms-playwright/chromium-<rev>/chrome-linux64/chrome` and `chromium_headless_shell-<rev>/chrome-headless-shell-linux64/chrome-headless-shell`, and `touch INSTALLATION_COMPLETE` in both.
4. `brackenford.spec.ts` writes nothing via `page.screenshot`, but `--update-snapshots` without `-g` would rewrite the 1080p PNGs too. Always pass `-g`.
5. Embed old and new PNGs in the PR body; don't describe them as approved.

## 6. Open questions for Grant

1. **(blocking)** The overview diff = barrel (BF-1) + new village building art (O-V5-1, already merged) + prompt beacons and labels + river rows. May SS-1 refresh `brackenford-overview.png` to the current main render if the PR attributes every changed region to a merged PR and flags any unexplained region? **Recommended default: yes.** Every visible change comes from merged work. Otherwise SS-1 has nothing to do and the baseline stays red for MX-1 and PUB-1.
2. **(acceptance)** The Tharos test (line 196) fails on main since #76 and SS-1 can't edit specs. Accept "green except that pre-existing failure"? **Recommended default: yes.** Queue a small follow-up package that changes the test's interact point to (340,175), the point that the green `interiors.spec.ts` already uses to reach Tharos.
