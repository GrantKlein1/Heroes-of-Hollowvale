# PUB-1 refined spec (Wave 1 planning, verified on `origin/main` @ `4e68ca0`)

Tightens `prompts/PUB-1.md`. If this file conflicts with the prompt, the prompt wins.

## 1. Verified facts

| Prompt claim | Status | Evidence |
|---|---|---|
| `client/public` ≈ 96 MB: `images/` 73 MB, `assets/` 12 MB, `audio/` 9.8 MB, `maps/` 1.1 MB | CONFIRMED | `du -sh`: 96M / 73M / 12M / 9.8M / 1.1M |
| Audit scope = `client/public` minus `assets/`, `audio/`, `maps/` | CONFIRMED that this means `images/` only | `client/public` has exactly 4 entries: `assets audio images maps`. `images/` has 106 files: 64 at the root, plus `animatedSword/` 22, `terrain/` 8, `mageSpellBookSpellIcons/` 4, `animatedHealing/` 2, and six folders with 1 each. |
| Stray tool files under `client/public` | Only two | `images/fireSmall.aseprite`, `images/terrain/README.md`. No `*.py` or other non-runtime files. |
| Legacy backgrounds come from `PAINTED_SCENES` / `sceneCatalog.js` | CONFIRMED | `sceneCatalog.js` `bg: PATHS.villageBg` (22), `tavernBg` (68), `walkingPath` (87), `dungeonEntrance` (129), `marketBg` (186), `dungeonInterior` (212), `hiddenTreasureRoom` (240). These resolve in `client/src/config/paths.js` 12-18. |
| `docs/art-pipeline.md` exists | CONFIRMED | `art-source/legacy-public/` does not exist yet (new). |

## 2. Hand-run of the audit on the five biggest files in `client/public/images`

| File | Size | Literal `images/<path>` hit? | Basename hit | Real reference chain | Action |
|---|---|---|---|---|---|
| `dungeon.png` | 2.69 MB | no | `paths.js:17` `` dungeonInterior: `${IMAGES_BASE}/dungeon.png` `` (also a false-positive substring in `tests/e2e/smoke.spec.ts:76` `'scene-04-dungeon.png'`) | `PATHS.dungeonInterior` -> `sceneCatalog.js:212`, `Game.jsx:23` | KEEP |
| `walkingPath.png` | 2.55 MB | no | `paths.js:15` | `PATHS.walkingPath` -> `sceneCatalog.js:87`, `Game.jsx:21` | KEEP |
| `bossFightEmptyRoom.png` | 2.26 MB | no | none | none: no path, basename, stem, `%20` form, item-id or builder match anywhere in the search roots | candidate MOVE |
| `hiddenTreasureRoom.png` | 2.13 MB | no | `paths.js:18` | `sceneCatalog.js:240`, `Game.jsx:24` | KEEP |
| `start village screen.png` | 2.05 MB | no | `paths.js:12` `` encodeURI(`${IMAGES_BASE}/start village screen.png`) `` | `PATHS.villageBg` -> `sceneCatalog.js:22` | KEEP |

## 3. String-built path patterns the prompt's audit would miss

1. **Item-id icon builder (real breakage risk).** `paths.js:103` `` export const DEFAULT_ITEM_ICON = (id) => `${IMAGES_BASE}/${id}.png` ``, used in `Game.jsx` 228-233 and 237 `const getItemDef = (id) => ITEMS[id] || { name: id, icon: DEFAULT_ITEM_ICON(id) }`. `ruby.png`, `sapphire.png` and `emerald.png` have **zero** path or basename references anywhere. They load only via `DEFAULT_ITEM_ICON('ruby')` etc. (the gem ids are in `Game.jsx` 231-233 and `client/src/game/combat/death.js` 31-33), and they show in the default HUD hotbar. A path-or-basename audit would mark them unused and move them. **Rule:** a root-level `images/<stem>.png` counts as referenced if `'<stem>'` or `"<stem>"` appears as a string literal anywhere in `client/src` or `server/src`.
2. **`${IMAGES_BASE}/<name>` template literals.** Every path in `paths.js` is built from `IMAGES_BASE = '/images'` (line 7), so the literal `images/<name>` never appears. A full-path search alone marks almost everything unused. Basename search is required (the prompt says "path or basename"; make sure the implementation really does both).
3. **Spaces and `encodeURI`.** 9 files have spaces in their names (e.g. `start village screen.png`, `dungeon entrance.png`, `mage 2.png`, `goblin brute.png`, `red dragon boss fight room.png`). Walk the tree with `fs.readdirSync(..., { recursive: true })`, never shell word-splitting. Search both the raw name and the `encodeURIComponent`/`%20` form.
4. **Self-reference via `docs/`.** `docs/` is a search root, so this plan file (it names `bossFightEmptyRoom.png`) and the audit's own output `docs/public-audit-2026-11-17.md` would make every listed file "referenced" on a rerun. Exclude `docs/public-audit-*.md`, `docs/plans/**` and `tools/assets/audit_public_refs.mjs` from the roots.
5. **Binary noise.** Search text files only (`.js .jsx .ts .tsx .mjs .cjs .json .md .txt .html .css .tsj .tmj .yml .yaml .py`). Skip `node_modules/`, `test-results/`, `tests/e2e/__screenshots__/`, and every image, audio, `.blend`, `.glb` and `.aseprite` file in `art-source/`.
6. Not a miss, but expect it: substring false positives (`dungeon.png` inside `scene-04-dungeon.png`) keep files. That is the conservative direction; print the hit in the "referenced-by" column.

No `import.meta.glob`, `require.context`, CSS `url()` to `/images`, or `/images/` reference from inside `client/public` (maps, manifest) exists on main (searched).

## 4. Exact MAY-change list (tightened)

- `git mv client/public/images/<f> art-source/legacy-public/images/<f>`, only for files with zero hits after rules 1-5. Always move `images/fireSmall.aseprite` and `images/terrain/README.md`. Note: "`<original relative path>`" means relative to `client/public`, so the destination keeps the `images/` segment.
- NEW `tools/assets/audit_public_refs.mjs`, NEW `docs/public-audit-2026-11-17.md`, edit `docs/art-pipeline.md` (short note only).
- No ADDITIONS.
- Must NOT commit (add to the must-not-change list): `tests/e2e/__screenshots__/fd-1-default-village.png`, which `flip-defaults.spec.ts` line 57 overwrites with `page.screenshot` on every run. Do not commit a 404-check spec either: keep it as an untracked temp file such as `tests/e2e/zz-pub1-404.spec.ts` and delete it before committing.

## 5. Overlap check

- Open PRs: none (`gh pr list --state open` is empty).
- Wave 1: no shared file. No other package touches `client/public/images`, `tools/assets/` or `docs/`, apart from the `docs/plans/wave-1/*` planning files on this branch, which PUB-1 must not edit.

## 6. Test plan

- Audit script self-check (prove rule 1 works): its output must list `ruby.png`, `sapphire.png`, `emerald.png` as referenced (by the item-id rule), and `bossFightEmptyRoom.png` as `none`. If the gem icons show `none`, the script is wrong; fix it before moving anything.
- `du -sh client/public` before and after.
- `git diff origin/main --stat -M`: only `R100` renames plus the three doc/tool files. A rename below 100% means a file changed; STOP.
- `npm test && npm run build --workspace client` (main: client 595/595, server 51/52 offline; the 1 is `rerank.test.js` "fetch failed").
- `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/brackenford.spec.ts tests/e2e/flip-defaults.spec.ts --reporter=line`. `smoke.spec.ts` runs `?renderer=legacy&maps=legacy` and visits all 8 painted scenes with `toHaveScreenshot`, so a moved background shows up there. Expected pre-existing failures in `brackenford.spec.ts`: overview screenshot (ratio 0.06, SS-1) and "Tavern door exit … opens dialogue" (line 196, Tharos moved by #76). Report both; fix neither.
- 404 check: in the temp spec, `page.on('response', r => r.status() === 404 && r.url().includes('/images/') && hits.push(r.url()))`, visit the default village (HUD with the gem icons) and `__hv.goto(<id>)` for each painted scene on `?renderer=legacy&maps=legacy`, then `expect(hits).toEqual([])`. Paste the output and delete the file.

## 7. Risks and traps

1. Moving the gem icons (rule 1). It is caught only if the HUD loads them in a run that has a 404 listener, so do the self-check first.
2. `git mv` with spaces: quote every path, or drive it from node with `execFileSync('git', ['mv', src, dst])`.
3. Running the audit after writing the report makes everything "referenced" (rule 4).
4. `art-source/blendsmith/**` is read-only (AGENTS.md); only create `art-source/legacy-public/**`.
5. Playwright browser download may be blocked; see MX-1 trap 5 for the system-Chrome symlink.

## 8. Open questions for Grant

none
