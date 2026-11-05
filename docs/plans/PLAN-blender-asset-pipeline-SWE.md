# Blender Asset Pipeline Specification (SWE Reference)

> **Status:** Active reference for Lanes B & F.  
> **Source:** Synthesized from Cursor SWE architectural specifications and [`ANTIGRAVITY-PLAN.md`](./ANTIGRAVITY-PLAN.md).

---

## 1. Asset Contract Overview

All in-game visual art is produced in Blender via **Blendsmith** and imported into Phaser 3 JSON-hash atlases. No third-party art packs are permitted.

### Rendering & Camera Standards
- **Projection:** Orthographic camera tilted at $12^\circ$.
- **Lighting:** Consistent key and fill directional lights matching the overworld zenith.
- **Tile Unit:** 32 px standard tiles (replacing legacy 16 px prototypes).
- **Directions:** 4 directional facings rendered (`down`, `left`, `right`, `up`). Horizontal flipping (`flipX`) is forbidden to preserve directional shading and weapon hands.

---

## 2. Atlas Packaging & Metadata

Atlases are exported as Phaser 3 JSON-hash texture atlases under `art-source/blendsmith/`:
- **Naming Pattern:** `<asset>_<anim>_<dir>_<i>` (e.g., `knight_walk_down_0`).
- **Pivot & Anchor:**
  - Origin is strictly feet-anchored ($\approx 0.9125 - 0.9375$ Y).
  - The exact anchor varies by asset; the importer must read `meta.anchor` dynamically from atlas JSON metadata and never hard-code values.
- **Embedded Hit & Body Data:**
  - Atlas `meta` contains per-animation specs: `anims`, `fps`, `hitFrames`, `hitbox`, `footprint`, and `hurtbox`.
  - Archer sheets specify per-frame duration arrays for realistic bow draw and release.
  - Exception: `red_dragon/attacks.json` remains a dedicated sidecar due to multi-phase attack patterns.

---

## 3. Complex Assets

### The Red Dragon Boss
- **Multi-Phase Memory Management:**
  - Dragon frames span 7 4K atlas sheets (`p1_a`, `p1_b`, `p2`, `p2_land`, `p3_a`, `p3_b`).
  - Total combined texture size exceeds 400 MB GPU memory if loaded simultaneously.
  - Runtime loads only the active phase's textures, evicting prior phases.
- **Visual Effects:** Uses `fx_v2/dragon_fx_v2` exclusively; legacy `dragon_fx.json` (v1) is deprecated.

### Mage Class
- Mage render outputs are generated across separate folders (`mage/walk/` and `mage/spells/`).
- The asset importer (`tools/assets/import_blendsmith.mjs`) automatically merges these streams into a unified `mage` atlas.

---

## 4. Repo Hygiene & Storage Boundaries
- Never commit Blender working files (`.blend`, `.glb`), raw frames (`frames/`), high-res master renders (`render_hi/`, 4x masters), backups (`*_bak*`), or preview renders to `client/public/`.
- Only final optimized PNG sheets and `.json` manifests are distributed to the client runtime.

