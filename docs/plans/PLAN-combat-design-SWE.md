# Combat Design Specification (SWE Reference)

> **Status:** Final & Decided (2026-11-04).  
> **Source:** Synthesized from Cursor SWE architectural specifications and [`ANTIGRAVITY-PLAN.md`](./ANTIGRAVITY-PLAN.md).

---

## 1. Core Combat Principles

All 13 foundational combat design decisions are locked:
1. **Engine:** Phaser 3 full-screen 2D action RPG.
2. **Camera Angle:** $12^\circ$ isometric top-down orthographic perspective.
3. **Tile Resolution:** 32 px world grid.
4. **Sprite Facings:** 4 directions rendered explicitly (`down`, `left`, `right`, `up`). No `flipX`.
5. **Aim Mechanics:** Aim strictly follows current movement direction (directional lock during attack active frames).
6. **No Touch/Contact Damage:** Running into enemies causes zero damage; damage occurs solely through active attack hitboxes during designated `hitFrames`.
7. **Dodge Roll:** Universally available to all player classes on cooldown.
   - Grants invulnerability frames (I-frames) during peak roll.
   - Consumes cooldown timer (no stamina gauge required).
8. **Shield Block:** Exclusive to the Knight class; negates or mitigates frontal damage while held.
9. **No Death Penalty:** Dying does not destroy inventory or gold; the player respawns at the area/screen entrance.
10. **Target Platform:** Desktop browser (keyboard + mouse/WASD controls).
11. **Boss Flight Cycle:** The Red Dragon flies during aerial attack patterns but must land on the ground after each volley to allow player melee/counterplay.
12. **Renderer Abstraction:** Support `?renderer=legacy` alongside the modern Blendsmith engine (`?renderer=blend`) until retirement in package 3-4.
13. **RNG Grounding:** All combat rolls, crits, and variances use seeded PRNG (`client/src/game/rng.js`).

---

## 2. Player Class Archetypes

- **Knight:** High HP, moderate speed, sword slash combo, frontal shield block, standard dodge roll.
- **Archer:** Long range, high single-target puncture, kiting speed, variable draw-time bow attacks.
- **Thief:** High burst melee, backstab critical multiplier, evasion smoke vanish, poison vial area debuff.
- **Mage:** Area-of-effect spells (fireball, frost nova), mana management, high vulnerability in close quarters.

