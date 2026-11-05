# Heroes of Hollowvale — rules for Google Antigravity agents
Drop this file at the repo root as `AGENTS.md` (it replaces the old Cursor-oriented one). Antigravity loads it automatically, always on, no frontmatter.

## Stack
- npm workspaces monorepo. `client/`: React 18 + Vite + Tailwind + Phaser 3 (full-screen game engine, mounted in #21). `server/`: Node + Express (port 5051): `/api/chat` (Groq LLM + RAG from `server/src/rag/lore.json`), `/api/tts` (ElevenLabs), `/api/health`.
- Dev: `npm install` then `npm run dev` from the root (server 5051 + client 5173; Vite proxies `/api`). Open http://localhost:5173.
- Windows note: use PowerShell or Git Bash; if Vite fails with a missing `@rollup/rollup-*` module, delete `node_modules` and `package-lock.json` and run `npm install` (do not commit an unrelated lockfile rewrite unless the package asks for it).
- API keys are optional. With `GROQ_API_KEY` unset, chat returns a stub; with `ELEVENLABS_API_KEY` unset, `/api/tts` returns 501. Never put placeholder keys in `.env`; never commit `.env` or any key.

## Commands (run before you say "done")
- `npm test` (exists after package T-1; before that, say so and skip)
- `npm run build --workspace client`
- `npx playwright test` (exists after T-5) for anything visual or gameplay
- Paste the command output (pass/fail counts) into the PR description and your walkthrough artifact.

## Branch and PR rules
- One package = one branch = one PR. Branch name: `hv/<package-id>-<short-slug>` (e.g. `hv/T-1-vitest`), created from the latest `main`.
- NEVER push to `main`, never merge, never force-push, never rebase a branch you didn't create, never delete branches, never close or edit other PRs. Grant merges.
- PR title: `[<package-id>] <summary>`. Body: what changed, files touched, test/build output, screenshots for anything visual, known issues, what's left.
- Keep diffs small (aim < 400 changed lines excluding generated assets/baselines). If the package needs more, stop and propose a split.
- Touch ONLY the files the package prompt allows. If you need another file, stop and ask in the plan artifact.
- Shared files (`package.json`, `package-lock.json`, `vite.config.*`, `.github/workflows/*`) change only in packages that list them.
- Don't add dependencies unless the package says so.

## Game rules
- Lore canon is `newLore_expanded.txt` on `main`. Don't edit it or `lore.txt` unless the package says so. Don't invent place names, characters, or factions; every map/zone/NPC name must appear in `newLore_expanded.txt`. PR #20 (`newLore_expanded.txt`) is canon.
- No third-party art packs. All character/enemy/FX/tile art comes from Blendsmith via `art-source/blendsmith/` and the importer (`tools/assets/import_blendsmith.mjs`).
- Keep `?renderer=legacy` working until package 3-4 removes it. New rendering goes behind `?renderer=blend`; Tiled maps behind `?maps=tiled`.
- Use the seeded RNG (`client/src/game/rng.js`, after T-3) — no new `Math.random` in `client/src/game`.
- Combat decisions are final (DECIDED 2026-11-04): dodge roll for all classes on cooldown (no stamina), block for the knight only, aim follows movement, no death penalty (respawn at area entrance), no touch/contact damage, 12° camera, 32 px tiles, 4 facings (down/left/right/up, no flipX), desktop only. Flying dragon lands after each volley.

## Asset spec (summary; full contract in docs/ASSET_SPEC.md after 0-1)
- Phaser 3 JSON-hash atlases; frame names `<asset>_<anim>_<dir>_<i>`; 4 facings rendered; feet origin.
- Origin/anchor differs per sheet (≈0.9125–0.9375): ALWAYS read it from each atlas's `meta`, never hard-code.
- Hit data lives in atlas meta (`anims`, fps, `hitFrames`, `hitbox`, `footprint`, `hurtbox`; archer uses per-frame durations). Exception: `red_dragon/attacks.json` is still a separate sidecar.
- Dragon: pages `p1_a, p1_b, p2, p2_land, p3_a, p3_b` (≈4096 px each, hundreds of MB of GPU memory if all loaded) — load only the current phase. Use `fx_v2/dragon_fx_v2`, never v1 `dragon_fx.json`. Boss has its own scale.
- Mage is split across `mage/walk/` and `mage/spells/`; the importer merges them.
- Critters render L/R only (up/down coming in P2).
- Never copy `frames/`, `render_hi/`, 4x masters, `*_bak*`, previews, `.blend`, or `.glb` into `client/public/`.

## Do not touch (unless the package explicitly allows it)
- `newLore.txt`, `lore.txt`, `server/src/rag/lore.json` (regenerated only in package L-2)
- `.env*`, secrets, `.github/` (only T-2 / 2-2)
- `art-source/blendsmith/**` (Blendsmith owns it; read-only for you)
- `client/public/maps/zelda-like/**` or anything from PRs #22/#23
- Other packages' files while their PR is open

## When you finish
Stop and summarize: what you did, files changed, test/build output, screenshots, anything you could not do, and suggested follow-ups. Do not start the next package.
