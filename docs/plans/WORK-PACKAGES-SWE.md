# SWE Work Packages (Reference Specification)

> **Status:** Superseded and adapted by [`ANTIGRAVITY-PLAN.md`](./ANTIGRAVITY-PLAN.md).  
> **Source:** Synthesized from Cursor SWE architectural specifications and Antigravity handoff documentation.

---

## 1. Work Package Lanes

The project is structured into nine functional lanes executed in phased waves:

- **Lane A (Tests):** Vitest test harness (T-1), CI workflow (T-2), seeded PRNG (T-3), combat logic unit tests (T-4), Playwright visual/gameplay regression suite (T-5).
- **Lane B (Assets):** Blendsmith asset specification (0-1), atlas importer & validator (0-2), registry runtime loader (0-3), asset pipeline integration (0-4).
- **Lane C (Player Combat):** Player sprite migration (1-1), 4-directional animations (1-2), dodge roll & knight shield block (1-3), class attacks (knight swing, archer shot, thief backstab, mage fireball) (1-4), player status & inventory interaction (1-5), telegraphing & hit reactions (1-6).
- **Lane D (Enemies):** Goblin grunt melee & behavior (1b-1), goblin archer ranged attacks & projectiles (1b-2), brute heavy telegraph & charge (1b-3), critter ambient wildlife (1b-4).
- **Lane E (Map Code):** Overworld continuous league runner (2-1), map validator (`validate_map`) & CI gate (2-2).
- **Lane F (Map Content):** Procedural generator port to Tiled `.tmj` format (MM-1), Brackenford town wiring (2-3), Wilderness screens (3-1), Ember Road & Hearthmile (3-2), Ruinwatch & Cavern entrance (3-3).
- **Lane G (Boss):** Red dragon Phase 1 (landed breath & tail swipe) (3b-1), Phase 2 (flight, fire volleys, takeoff/landing cycle) and Phase 3 (enrage) (3b-2).
- **Lane H (Finish):** Blendsmith P2 clip wiring (4-1), balance playtest tuning (4-2), dynamic lighting & normal maps (4-3).
- **Lane L (Server & Lore):** Ashfang name reconciliation (BUG-1), per-player conversation memory (BUG-2), lore re-chunking & embeddings (L-2), streaming TTS & voice tuning (L-3..L-8).

---

## 2. Antigravity Adaptations (Delta vs. Original SWE Order)

As detailed in §H of [`ANTIGRAVITY-PLAN.md`](./ANTIGRAVITY-PLAN.md):
1. **Real Clips in P0/P1:** Blendsmith pre-delivered finished P0+P1 clips (deaths, dodges, blocks, telegraphs, dragon landings), rendering old stand-in packages obsolete.
2. **Atlas Metadata Integration:** Importer (0-2) reads origin anchors and hit data directly from atlas `meta` rather than relying on external lookup tables.
3. **Dragon Memory Optimization:** Split dragon sheets (`p1_a` through `p3_b`) into per-phase loads to stay within Iris Xe GPU memory limits (< 400 MB).
4. **Cleanup Packages:** Added PR-1 (review of #19) and PR-2 (route notes from #22/#23) to preserve prototype work safely before starting Wave 1.

