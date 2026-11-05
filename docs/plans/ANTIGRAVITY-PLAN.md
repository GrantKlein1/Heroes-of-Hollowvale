# Heroes of Hollowvale — Antigravity handoff plan
Written Wed Nov 4, 2026 (CST). Repo: GrantKlein1/Heroes-of-Hollowvale, `main` @ 380f72a. Nothing in the repo or on GitHub was changed to write this.
Supersedes the order in SWE's WORK-PACKAGES-SWE.md where they differ (reasons in §H).

## A. Status on one screen
**Done**
- Phaser full-screen engine is on main (#21). Client builds (≈5 s) and runs with `npm run dev`; chat works with a stub reply without keys.
- Blendsmith has finished every P0 + P1 clip from the combat plan: deaths, dodges, knight block, goblin/brute telegraphs, dragon land/takeoff, arrow + impact, hit spark/dust, thief vanish + poison vial, and footprint/hurtbox/hitFrames written into atlas meta (archer has per-frame durations). Dragon: 7 pages (p1_a…p3_b + p2_land), fx_v2, attacks.json.
- Plans are written and all 13 design choices are decided (2D Phaser, 32 px tiles, 12°, 4 facings, dodge for all, block knight-only, no touch damage, no death penalty, desktop only).

**Broken / weak**
- No tests at all (`npm test` → "Missing script"). JS bundle 1.74 MB.
- "Ashfang" is used in Game.jsx, chat.js and old lore.txt but isn't in newLore.txt, so RAG can't ground it.
- NPC memory is shared by every player (keyed only by NPC).
- Characters are stretched still images; damage is instant on key press; enemies hurt you by touch.

**Blocked / waiting**
- Blendsmith's atlases live only on the bot computer (/workspace/blender/hollowvale/models), not in the repo and not on your laptop → package AS-1 fixes this.
- No tiles or props exist yet (32 px, 12°) → needed for all map content (lane F).
- P2 clips (run, combo, charge, goblin spawn/alert, critter up/down) are in progress at Blendsmith.
- Open PRs: #19 (merged), #20 (merged; newLore_expanded.txt is canon), #22/#23 (close; they use a 16 px flat CC0 pack). Stale branches: cursor/terrain-assets-d431, cursor/terrain-generator-d431, cursor/terrain-worldgraph-d431 (#8–10), newBranch.

## B. One-time setup (≈30 min, on your laptop)
1. **Clone:** `git clone https://github.com/GrantKlein1/Heroes-of-Hollowvale.git` → `cd Heroes-of-Hollowvale` → `npm install` → `npm run build --workspace client` (should pass) → `npm run dev` and open http://localhost:5173.
   - If Vite says it can't find `@rollup/rollup-win32-x64-msvc`, delete `node_modules` and `package-lock.json` and run `npm install` again.
2. **Env vars** (create `server/.env`; optional — leave a key out entirely rather than using a placeholder):
   - `GROQ_API_KEY` (real chat; without it chat is stubbed), `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` (voice; without it /api/tts returns 501), optionally `PORT=5051`. Client: `VITE_API_BASE` only if the server isn't on the Vite proxy.
   - Never let an agent commit `.env`.
3. **Rules files** (commit these in one small PR yourself, or as part of PR-2):
   - Replace the repo's `AGENTS.md` with [AGENTS.md](AGENTS.md) from this folder (the old one is Cursor-Cloud specific).
   - Copy `rules/hollowvale-guardrails.md` and `rules/assets.md` into `.agents/rules/`. Each starts with a YAML `trigger:` header — without it Antigravity silently ignores the file.
   - Don't use legacy Workflows (they stopped working 2026-10-19); use `.agents/skills/` if you ever need one.
4. **Antigravity settings:** open the clone as a Project. For every agent: **Planning mode**, review policy **Request review** (it stops and shows you a plan before writing code), **New worktree mode** (each agent gets its own folder + branch, so parallel agents can't collide). Branch per package: `hv/<id>`.
5. **Quota:** the free tier has an unpublished weekly limit. Check it with `/usage` in the `agy` CLI. Prefer Gemini Flash for small packages; save the stronger models (Claude listed free only until Nov 18) for 1-4, 1b-1, 3b-2, 0-2.

**Each package:** open the prompt file in `prompts/`, copy everything below the line into a new conversation, review the plan artifact (≈5 min), let it build, review the PR (§E), merge, then start the next.

## C. The queue
"Wave" ties to §D. Owner = who does the work. Sessions are estimates; budget +20% for re-runs (re-run fresh rather than continuing a failed session).

| # | Package | Lane | Depends on | Can run in parallel with | Owner | Est. sessions | Wave |
|---|---|---|---|---|---|---|---|
| 1 | [PR-1](prompts/01-PR-1.md) | Cleanup | — | AS-1, T-1 | Grant (+Antigravity review) | 0–1 | 0 |
| 2 | [PR-2](prompts/02-PR-2.md) | Cleanup | — | any | Grant + Antigravity | 1 | 0 |
| 3 | [AS-1](prompts/03-AS-1.md) | Assets | — | everything | Blendsmith | — (bot) | 0 |
| 4 | [T-1](prompts/04-T-1.md) | A Tests | main synced | 0-1, AS-1, L-lane | Antigravity | 1 | 1 |
| 5 | [0-1](prompts/05-0-1.md) | B Assets | AS-1 (open is enough) | T-1, L-lane | Antigravity | 1 | 1 |
| 6 | [BUG-1](prompts/06-BUG-1.md) | L Server | — (Grant decision) | any client package | Antigravity | 1 | 1 |
| 7 | [T-2](prompts/07-T-2.md) | A Tests | T-1 | T-3, 0-2 | Antigravity | 1 | 2 |
| 8 | [T-3](prompts/08-T-3.md) | A Tests | T-1 | T-2, 0-2 | Antigravity | 1 | 2 |
| 9 | [0-2](prompts/09-0-2.md) | B Assets | 0-1, AS-1 merged | T-2, T-3 | Antigravity | 1–2 | 2 |
| 10 | [BUG-2](prompts/10-BUG-2.md) | L Server | PR-1 merged | any client package | Antigravity | 1 | 2 |
| 11 | [L-2](prompts/11-L-2.md) | L Server | PR-1 merged | any client package | Antigravity | 1 | 3 |
| 12 | [T-4](prompts/12-T-4.md) | A Tests | T-3 | 0-3, 0-4 | Antigravity | 1 | 3 |
| 13 | [0-3](prompts/13-0-3.md) | B Assets | 0-2, T-1 | T-4, 0-4 | Antigravity | 1 | 3 |
| 14 | [0-4](prompts/14-0-4.md) | B Assets | 0-2 | T-4, 0-3 | Antigravity | 1 | 3 |
| 15 | [T-5](prompts/15-T-5.md) | A Tests | T-4 | 1-1, 2-1 | Antigravity | 1 | 4 |
| 16 | [1-1](prompts/16-1-1.md) | C Player | 0-4 | T-5, 2-1 | Antigravity | 1 | 4 |
| 17 | [2-1](prompts/17-2-1.md) | E Map code | 0-4 | 1-1, T-5 | Antigravity | 1–2 | 4 |
| 18 | [1-2](prompts/18-1-2.md) | C Player | 1-1 | 2-2 | Antigravity | 1 | 5 |
| 19 | [2-2](prompts/19-2-2.md) | E Map code | T-2, 2-1 | 1-2 | Antigravity | 1 | 5 |
| 20 | [L-3](prompts/20-L-3.md) | L Server | L-2 | any client package | Antigravity | 1 | 5 |
| 21 | [1-3](prompts/21-1-3.md) | C Player | 1-2, T-5 | L-2 | Antigravity | 1 | 6 |
| 22 | [L-4](prompts/22-L-4.md) | L Server | L-3 + Grant eval | any client package | Antigravity | 1 | 7 |
| 23 | [1-4](prompts/23-1-4.md) | C Player | 1-3 | L-3 | Antigravity | 1–2 | 7 |
| 24 | [1-5](prompts/24-1-5.md) | C Player | 1-4 | 1b-1, 1-6 | Antigravity | 1 | 8 |
| 25 | [1-6](prompts/25-1-6.md) | C Player | 1-4 | 1-5, 1b-1 | Antigravity | 1 | 8 |
| 26 | [L-5](prompts/26-L-5.md) | L Server | L-2 | any client package | Antigravity | 1 | 9 |
| 27 | [1b-1](prompts/27-1b-1.md) | D Enemies | 1-4 | 1-5, 1-6 | Antigravity | 1–2 | 9 |
| 28 | [1b-2](prompts/28-1b-2.md) | D Enemies | 1b-1 | 1b-3, 3b-1 | Antigravity | 1 | 10 |
| 29 | [1b-3](prompts/29-1b-3.md) | D Enemies | 1b-1, 1-5 | 1b-2, 3b-1 | Antigravity | 1 | 10 |
| 30 | [3b-1](prompts/30-3b-1.md) | G Boss | 0-4, 1-4 | 1b-x | Antigravity | 1 | 10 |
| 31 | [L-6](prompts/31-L-6.md) | L Server | L-5 | any client package | Antigravity | 1 | 11 |
| 32 | [1b-4](prompts/32-1b-4.md) | D Enemies | 1b-1, 1-6 | 1b-2, 1b-3 | Antigravity | 1 | 11 |
| 33 | [3b-2](prompts/33-3b-2.md) | G Boss | 3b-1, 1b-4 | 4-2 prep | Antigravity | 1–2 | 12 |
| 34 | [4-1](prompts/34-4-1.md) | H Finish | 1-6 + Blendsmith P2 | 3b-2 | Antigravity | 1 | 12 |
| 35 | [L-7](prompts/35-L-7.md) | L Server | L-6 | any client package | Antigravity | 1 | 12 |
| 36 | [L-8](prompts/36-L-8.md) | L Server | L-6 | any client package | Antigravity | 1 | 12 |
| 37 | [MM-1](prompts/37-MM-1.md) | F Map content | 2-2 in CI + Blendsmith tiles (AS-2) | — | Mapmaker (no cloud agents) + Antigravity | 1–2 | F |
| 38 | [2-3](prompts/38-2-3.md) | F Map content | 2-1, 2-2, MM-1, tiles | 3-3 | Mapmaker authors + Antigravity wires | 1–2 | F |
| 39 | [3-1](prompts/39-3-1.md) | F Map content | 2-3 | 3-2 | Mapmaker + Antigravity | 1 | F |
| 40 | [3-2](prompts/40-3-2.md) | F Map content | 2-3 | 3-1 | Mapmaker + Antigravity | 1–2 | F |
| 41 | [3-3](prompts/41-3-3.md) | F Map content | 2-1, tiles | 2-3 | Antigravity | 1–2 | F |
| 42 | [3-4](prompts/42-3-4.md) | H Finish | 3-1, 3-2, 3-3, 3b-2 | — | Antigravity | 1 | H |
| 43 | [4-2](prompts/43-4-2.md) | H Finish | 1b-4, 3b-2, Grant playtest | — | Antigravity | 1 | H |
| 44 | [4-3](prompts/44-4-3.md) | H Finish | 3-4 + Blendsmith normal maps | — | Antigravity | 1 | H |

Lanes: A tests · B assets · C player combat · D enemies · E map code · F map content (blocked on tiles) · G boss · H finish · L server (RAG/TTS + server bugs; independent of client lanes, never touches client/src/game).
Total ≈ 44 packages, ≈ 45–55 sessions (41 Antigravity packages; AS-1 is Blendsmith, PR-1 is mostly you).

## D. Waves (max 2–3 agents at once)
Rule between waves: **every PR from the wave is reviewed, CI green (after T-2), merged, and handed to QA if visual** before the next wave starts. Other worktrees then `git fetch && git rebase origin/main` before continuing.

| Wave | Launch together | Gate before next wave |
|---|---|---|
| 0 | You: PR-1 review/merge #19 (use prompt 01 as a read-only check), decide #20, close #22/#23. Blendsmith: AS-1 asset PR. Antigravity: PR-2 (notes + docs/plans + rules files) | #19 merged; AS-1 PR open |
| 1 | **T-1** (vitest) · **0-1** (asset spec) · **BUG-1** (Ashfang) | `npm test` exists on main; merge AS-1 before 0-2 |
| 2 | T-2 (CI) · T-3 (seed) · then 0-2 (importer) · BUG-2 (memory) | CI green; manifest.json on main |
| 3 | T-4 · 0-3 · 0-4 · (L-2 if a slot is free) | registry loads boot group |
| 4 | T-5 · 1-1 · 2-1 | Playwright baselines merged |
| 5 | 1-2 · 2-2 · L-3 | validate_map in CI → **tell Mapmaker it can start MM-1 once tiles exist** |
| 6–8 | 1-3 → 1-4 (one at a time; hardest packages) · L-4 alongside · then 1-5 + 1-6 | QA playtest of `?renderer=blend` combat |
| 9–12 | 1b-1 → 1b-2 + 1b-3 + 3b-1 → 1b-4 + L-6 → 3b-2 + 4-1 (+ L-5/L-7/L-8 in free slots) | QA playtest full fight + boss; you playtest for 4-2 |
| F | MM-1 → 2-3 → 3-1 + 3-2 + 3-3 (as soon as tiles arrive; can overlap waves 6–12) | each map validated + screenshots |
| H | 3-4 → 4-2 → 4-3 (optional) | final QA pass |

**Launch first:** Wave 1 = `04-T-1`, `05-0-1`, `06-BUG-1` (no file overlap: package.json/client tests vs docs vs Game.jsx+chat.js). If quota is tight, run T-1 alone first — everything depends on it.

## E. Reviewing each PR (≈15 min)
- [ ] Title `[<id>] …`, branch `hv/<id>`, base `main`, only one package.
- [ ] `git diff --stat` touches only the files the prompt allowed; no `.env`, no `newLore.txt`, no `art-source/` edits, no new deps unless allowed.
- [ ] Each acceptance criterion is shown (test output, screenshot, or recording) — not just claimed.
- [ ] Pull the branch locally: `git fetch origin && git switch hv/<id> && npm install && npm test && npm run build --workspace client`, then `npm run dev` and try it for 2 minutes (`?renderer=blend&qa=1&seed=1` once those exist). Legacy mode (no flags) still works.
- [ ] No `Math.random` added (after T-3); no hard-coded sprite origins; no invented place names.
- [ ] CI green (after T-2). Squash-merge, delete the branch.
- Optional: ask SWE to review the diff ("SWE, review PR #N for package <id> against WORK-PACKAGES"). It reads diffs; it doesn't push.

**Handing to Hollowvale QA** (visual/gameplay PRs: T-5, 1-3 onward, maps): message QA: "Clone GrantKlein1/Heroes-of-Hollowvale locally on the box (no cloud agents), check out `main` after PR #N merged (or branch `hv/<id>` before merging), run `npm install && npm run dev`, and playtest `<what changed>` with Playwright at `?renderer=blend&qa=1&seed=1`. Stub NPC calls. Report bugs with screenshots; don't push." The first time, you must explicitly OK the local clone.

## F. Standing requests to send the bots now
**Blendsmith — AS-1 asset PR (send now):**
> Please open a PR from your box clone of GrantKlein1/Heroes-of-Hollowvale (branch `assets/blendsmith-v1`, base `main`, don't merge) that adds ONLY the final atlases + JSON meta under `art-source/blendsmith/`: knight, thief, dwarf, mage (walk/ + spells/), goblin, goblin_archer, goblin_brute, critters, fx_common, red_dragon pages p1_a…p3_b + p2_land, attacks.json, fx_v2, spawns.json. Exclude frames/, render_hi/, 4x masters, *_bak*, previews, .blend and .glb (~2.7 GB). Add `art-source/blendsmith/MANIFEST.md` listing each atlas, its anchor, anims and size. If the total is over ~300 MB, use Git LFS for the PNGs or split per group. No Cursor cloud agents. Full spec: prompts/03-AS-1.md.

**Blendsmith — AS-2 tiles + props (send now, queue after P2):**
> New render job, fast EEVEE mode (tiles/maps only): a 32 px tile + prop set at the same 12° ortho camera and lighting as the characters, transparent background. Tiles: grass (+ variants), dirt road and cobble road each with a full edge/corner (Wang) set, water with shore edges, cliffs, tavern/market interior floor + walls, dungeon floor + walls. Props with base-anchored origin and a footprint in meta: trees (with separate canopy for an overhead layer), cottages, tavern exterior, well, fences, rocks, bushes, crates/barrels, torches. Pack as Tiled-compatible tilesets (.tsj + PNG) plus Phaser atlases for props, then open PR `assets/blendsmith-tiles-v1` into `art-source/blendsmith/tiles/`. When P2 (run, combo, charge, goblin spawn/alert, critter up/down) is done, add it in a separate PR `assets/blendsmith-p2`.

**Mapmaker (send now):**
> Please don't start new map work yet and don't use cloud agents. PR #22/#23 will be closed; route notes are being saved to docs/maps/brackenford-route-notes.md. Once package 2-2 (validate_map in CI) is merged AND Blendsmith's tiles PR exists, I'll ask you for MM-1: port the seeded generator to emit .tmj with the new 32 px gids, validated by validate_map, then Brackenford/village first. Meanwhile, non-agent help is welcome: review docs/ASSET_SPEC.md §Tiles when it lands (package 0-1) and list the exact tiles you'll need.

**Hollowvale QA:** nothing until T-5 merges; then use the handoff message in §E.
**SWE:** optional PR reviews; it owns the plan files.

## G. Risks
- **Repo size:** atlases in git (dragon pages ≈4096 px each). Mitigation: final atlases only, LFS if > 300 MB.
- **Free-tier quota** is unpublished and weekly; a big week can stall. Keep to 2–3 agents, small packages, Flash for simple ones.
- **Iris Xe performance:** dragon pages ≈400 MB GPU memory if all loaded → per-phase loading (3b-1); fps checks in 2-3/4-3.
- **Parallel conflicts:** HollowvaleScene.js and Player.js are touched by many packages — never run two of C/D at once; rebase after each merge.
- **Unverified numbers:** thief/dwarf/archer attack timings and all balance values are untested defaults → 4-2 playtest.
- **#19 predates #21:** it reported a clean merge, but verify (prompt 01) before merging.
- **Lore drift:** agents inventing names; the lore check in 2-2 and AGENTS.md guard against it.

## H. Your decisions (defaults in bold)
1. Merge #19 after the clean-merge check — **yes**.
2. PR #20 lore — **merged; newLore_expanded.txt is canon** (Hearthmile/Ruinwatch/Ember Road are canon).
3. Close #22/#23 — **yes, after PR-2 saves the notes**.
4. Delete stale branches (cursor/terrain-*-d431, newBranch, and the merged ones) — **yes, whenever**.
5. Ashfang — **remove the references (BUG-1 option a)**, or write it into newLore.txt yourself (option b).
6. Asset transfer — **Blendsmith opens a PR into `art-source/blendsmith/`** (alternative: the bot zips the atlases and copies them to your laptop, but then they aren't versioned and agents can't see them in worktrees).
7. OK Hollowvale QA to clone locally on the bot computer — **yes, once T-5 merges**.

### What changed vs SWE's package file
- Old 1-6 (stand-ins) became "dodge/block/telegraph with real clips"; old 4-1 (swap in real clips) became P2 wiring, since Blendsmith already delivered P0+P1.
- 0-2 reads `art-source/blendsmith` in the repo, reads anchors per sheet, merges mage walk/+spells/, keeps dragon pages per phase, merges attacks.json, uses fx_v2.
- 0-3 makes footprint/hurtbox an error (they exist now). 1-5 uses the real poison vial; 1b-3 the real arrow.
- Added AS-1 (asset PR), BUG-1 (Ashfang), BUG-2 (per-player NPC memory), L-2…L-8 (RAG/TTS), MM-1 (Mapmaker generator port), and bundle splitting inside 3-4.

