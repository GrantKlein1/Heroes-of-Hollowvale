# Heroes of Hollowvale — Blendsmith Asset Specification & Contract

This document specifies the frozen asset contract as delivered by Blendsmith under `art-source/blendsmith/`. It governs atlas formats, coordinate conventions, origin anchor resolution, combat metadata, multi-phase boss handling, and the upcoming 32 px Tiled tileset/prop pipeline.

---

## 1. Visual & Camera Standards

- **Projection:** Orthographic camera tilted at a fixed $12^\circ$ top-down isometric angle.
- **Pixels Per Unit (PPU):** $\approx 36.92$ PPU, matching character scale to 32 px world grid tiles.
- **Tile Unit:** 32 px standard grid (replacing legacy 16 px CC0 prototypes).
- **Directional Rendering:** 4 facings rendered explicitly: `down`, `left`, `right`, and `up`.
  - Horizontal flipping (`flipX`) is **forbidden** across the engine; all directional shading, key/fill lighting, and weapon hands are hand-rendered per direction.
  - *Exception:* Critters render Left (`left`) and Right (`right`) only in Phase 1 (Up/Down facings are queued for Phase 2).
- **Frame Naming Scheme:** `<asset>_<anim>_<dir>_<i>` (e.g., `knight_walk_down_0`, `thief_attack_left_3`).

---

## 2. Atlas Packaging & Per-Sheet Anchor Contract

All assets are packaged as **Phaser 3 JSON-hash texture atlases** (`.png` sheet paired with a `.json` manifest).

> [!CAUTION]
> **No Single Hard-Coded Origin:** Anchor/origin values differ per asset sheet ($\approx 0.8333 - 0.9375$). The runtime importer (`tools/assets/import_blendsmith.mjs`) and animation loader must **always read the anchor dynamically from each atlas's `meta` or frame `pivot`**, and never assume a single global origin.

### Complete Delivered Atlas & Anchor Registry

| Atlas Group / Sheet | Image Size | Cell Size(s) | Frames | Anchor (`x, y`) | Pixel Pivot (`x, y`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`critters/critters`** | $192 \times 1408$ | $16\times 16, 32\times 32$ | 308 | `0.5, 0.8750` | Center-feet |
| **`dwarf/dwarf`** | $896 \times 320$ | $64\times 80$ | 56 | `0.5, 0.9125` | $(32, 73)$ |
| **`dwarf/dwarf_attack`** | $672 \times 384$ | $96\times 96$ | 28 | `0.5, 0.9271` | $(48, 89)$ |
| **`dwarf/dwarf_attack2`** | $448 \times 320$ | $64\times 80$ | 28 | `0.5, 0.9125` | $(32, 73)$ |
| **`dwarf/dwarf_charged`** | $768 \times 320$ | $64\times 80$ | 48 | `0.5, 0.9125` | $(32, 73)$ |
| **`dwarf/dwarf_death`** | $800 \times 320$ | $80\times 80$ | 40 | `0.5, 0.9125` | $(40, 73)$ |
| **`dwarf/dwarf_dodge`** | $384 \times 320$ | $64\times 80$ | 24 | `0.5, 0.9125` | $(32, 73)$ |
| **`dwarf/dwarf_run`** | $512 \times 320$ | $64\times 80$ | 32 | `0.5, 0.9125` | $(32, 73)$ |
| **`fx_common/fx_common`** | $368 \times 32$ | $32\times 32, 48\times 32$ | 9 | `0.5, 0.5000` | Center $(16, 16)$ |
| **`goblin/goblin`** | $1344 \times 256$ | $64\times 64$ | 84 | `0.5, 0.9375` | $(32, 60)$ |
| **`goblin/goblin_death`** | $640 \times 288$ | $80\times 72$ | 32 | `0.5, 0.8333` | $(40, 60)$ |
| **`goblin/goblin_spawn`** | $384 \times 288$ | $64\times 72$ | 24 | `0.5, 0.8889` | $(32, 64)$ |
| **`goblin/goblin_telegraph`**| $192 \times 256$ | $64\times 64$ | 12 | `0.5, 0.9375` | $(32, 60)$ |
| **`goblin_archer/goblin_archer`** | $1408 \times 280$ | $64\times 64$ | 97 | `0.5, 0.9375` | $(32, 60)$ |
| **`goblin_archer/goblin_archer_death`** | $640 \times 288$ | $80\times 72$ | 32 | `0.5, 0.8333` | $(40, 60)$ |
| **`goblin_archer/goblin_archer_spawn`** | $384 \times 288$ | $64\times 72$ | 24 | `0.5, 0.8750` | $(32, 63)$ |
| **`goblin_brute/goblin_brute`** | $2016 \times 384$ | $96\times 96$ | 84 | `0.5, 0.9271` | $(48, 89)$ |
| **`goblin_brute/goblin_brute_death`** | $896 \times 384$ | $112\times 96$ | 32 | `0.5, 0.9271` | $(56, 89)$ |
| **`goblin_brute/goblin_brute_spawn`** | $576 \times 384$ | $96\times 96$ | 24 | `0.5, 0.9271` | $(48, 89)$ |
| **`goblin_brute/goblin_brute_telegraph`** | $288 \times 384$ | $96\times 96$ | 12 | `0.5, 0.9271` | $(48, 89)$ |
| **`knight/knight`** | $1024 \times 384$ | $64\times 96$ | 56 | `0.5, 0.9271` | $(32, 89)$ |
| **`knight/knight_attack`** | $896 \times 384$ | $128\times 96$ | 28 | `0.5, 0.9271` | $(64, 89)$ |
| **`knight/knight_attack2`** | $560 \times 384$ | $80\times 96$ | 28 | `0.5, 0.9271` | $(40, 89)$ |
| **`knight/knight_block`** | $448 \times 384$ | $64\times 96$ | 24 | `0.5, 0.9271` | $(32, 89)$ |
| **`knight/knight_charged`** | $1152 \times 384$ | $96\times 96$ | 48 | `0.5, 0.9271` | $(48, 89)$ |
| **`knight/knight_death`** | $1280 \times 416$ | $128\times 104$ | 40 | `0.5, 0.8558` | $(64, 89)$ |
| **`knight/knight_dodge`** | $480 \times 384$ | $80\times 96$ | 24 | `0.5, 0.9271` | $(40, 89)$ |
| **`knight/knight_run`** | $512 \times 384$ | $64\times 96$ | 32 | `0.5, 0.9271` | $(32, 89)$ |
| **`mage/spells/mage_book`** | $672 \times 384$ | $96\times 96$ | 28 | `0.5, 0.9274` | $(48, 89)$ |
| **`mage/spells/mage_spells`** | $1920 \times 384$ | $96\times 96$ | 76 | `0.5, 0.9274` | $(48, 89)$ |
| **`mage/spells/spell_fx`** | $1536 \times 128$ | Multi ($32..128$) | 34 | `0.0, 0.5000` | Spell origin |
| **`mage/walk/fireball`** | $256 \times 32$ | $32\times 32$ | 8 | `0.5, 0.5000` | Center |
| **`mage/walk/mage_attack2`** | $672 \times 416$ | $96\times 104$ | 28 | `0.5, 0.8846` | $(48, 92)$ |
| **`mage/walk/mage_cast`** | $768 \times 384$ | $96\times 96$ | 32 | `0.5, 0.9271` | $(48, 89)$ |
| **`mage/walk/mage_charged`** | $896 \times 416$ | $112\times 104$ | 32 | `0.5, 0.8750` | $(56, 91)$ |
| **`mage/walk/mage_death`** | $896 \times 384$ | $112\times 96$ | 32 | `0.5, 0.9271` | $(56, 89)$ |
| **`mage/walk/mage_dodge`** | $576 \times 384$ | $96\times 96$ | 24 | `0.5, 0.9271` | $(48, 89)$ |
| **`mage/walk/mage_hurt`** | $320 \times 384$ | $64\times 96$ | 20 | `0.5, 0.9271` | $(32, 89)$ |
| **`mage/walk/mage_run`** | $640 \times 384$ | $80\times 96$ | 32 | `0.5, 0.9271` | $(40, 89)$ |
| **`mage/walk/mage_walk`** | $576 \times 384$ | $64\times 96$ | 36 | `0.5, 0.9271` | $(32, 89)$ |
| **`red_dragon/red_dragon_p1_a`** | $4096 \times 3584$ | $640\times 512$ | 42 | `0.5, 0.7812` | $(320, 400)$ |
| **`red_dragon/red_dragon_p1_b`** | $4096 \times 3584$ | $640\times 512$ | 42 | `0.5, 0.7812` | $(320, 400)$ |
| **`red_dragon/red_dragon_p2_a`** | $4096 \times 3584$ | $640\times 512$ | 42 | `0.5, 0.7812` | $(320, 400)$ |
| **`red_dragon/red_dragon_p2_b`** | $4096 \times 3584$ | $640\times 512$ | 42 | `0.5, 0.7812` | $(320, 400)$ |
| **`red_dragon/red_dragon_p2_land`** | $4096 \times 2048$ | $640\times 512$ | 24 | `0.5, 0.7812` | $(320, 400)$ |
| **`red_dragon/red_dragon_p3_a`** | $4096 \times 3584$ | $640\times 512$ | 42 | `0.5, 0.7812` | $(320, 400)$ |
| **`red_dragon/red_dragon_p3_b`** | $4096 \times 3584$ | $640\times 512$ | 42 | `0.5, 0.7812` | $(320, 400)$ |
| **`red_dragon/fx_v2/dragon_fx_v2`**| $4096 \times 2048$ | Multi ($64..608$) | 114 | Per-frame | FX Anchor |
| **`thief/fx/thief_fx`** | $320 \times 48$ | $32\times 32, 64\times 48$ | 9 | `0.5, 0.5000` | Center |
| **`thief/thief`** | $1024 \times 384$ | $64\times 96$ | 56 | `0.5, 0.9271` | $(32, 89)$ |
| **`thief/thief_attack`** | $672 \times 384$ | $96\times 96$ | 28 | `0.5, 0.9271` | $(48, 89)$ |
| **`thief/thief_attack2`** | $560 \times 384$ | $80\times 96$ | 28 | `0.5, 0.9271` | $(40, 89)$ |
| **`thief/thief_charged`** | $640 \times 384$ | $80\times 96$ | 32 | `0.5, 0.9271` | $(40, 89)$ |
| **`thief/thief_death`** | $960 \times 416$ | $96\times 104$ | 40 | `0.5, 0.8558` | $(48, 89)$ |
| **`thief/thief_dodge`** | $480 \times 384$ | $80\times 96$ | 24 | `0.5, 0.9271` | $(40, 89)$ |
| **`thief/thief_run`** | $640 \times 384$ | $80\times 96$ | 32 | `0.5, 0.9271` | $(40, 89)$ |
| **`thief/thief_stealth`** | $768 \times 416$ | $96\times 104$ | 32 | `0.5, 0.9327` | $(48, 97)$ |

---

## 3. Atlas Metadata Contract & Verbatim Examples

All combat colliders, timing data, and hit specifications are embedded directly in the `meta` object of each atlas JSON file. Pixels are relative to the feet pivot ($+y$ downwards; $(x, y)$ represents top-left).

### A. Animation Definitions (`anims`, `fps`, `loop`, `holdLast`)
Copied verbatim from `art-source/blendsmith/knight/knight.json`:
```json
"anims": {
  "walk": {
    "frames": 8,
    "directions": ["down", "left", "right", "up"],
    "frameNames": "knight_walk_<dir>_<i>",
    "fps": 10,
    "fpsSource": "knight_walk_down.gif",
    "loop": true
  },
  "hurt": {
    "frames": 5,
    "directions": ["down", "left", "right", "up"],
    "frameNames": "knight_hurt_<dir>_<i>",
    "fps": 12,
    "fpsSource": "knight_hurt_down.gif",
    "loop": false,
    "holdLast": false
  }
}
```

### B. Collision Footprint (`footprint`) & Body Hurtbox (`hurtbox`)
Copied verbatim from `art-source/blendsmith/knight/knight.json`:
```json
"footprint": {
  "x": -12,
  "y": -4,
  "w": 23,
  "h": 7,
  "shape": "ellipse",
  "note": "collision footprint centred on feet"
},
"hurtbox": {
  "x": -14,
  "y": -37,
  "w": 28,
  "h": 37,
  "note": "body hurtbox, bottom on feet"
}
```

### C. Melee Hitboxes & Active Attack Frames (`hitFrames`, `hitbox`)
Copied verbatim from `art-source/blendsmith/knight/knight_attack.json`:
```json
"attack": {
  "frames": 7,
  "directions": ["down", "left", "right", "up"],
  "frameNames": "knight_attack_<dir>_<i>",
  "fps": 11,
  "fpsSource": "knight_attack_down.gif",
  "loop": false,
  "holdLast": false,
  "hitFrames": [3],
  "hitbox": {
    "3": {
      "down":  { "x": -48, "y": -40, "w": 56, "h": 40 },
      "left":  { "x": -68, "y": -68, "w": 56, "h": 40 },
      "right": { "x": 12,  "y": -68, "w": 56, "h": 40 },
      "up":    { "x": 12,  "y": -100, "w": 56, "h": 57 }
    }
  }
}
```

### D. Ranged Projectiles, Spawning & Variable Frame Durations
Copied verbatim from `art-source/blendsmith/goblin_archer/goblin_archer.json`:
```json
"attack": {
  "frames": 8,
  "directions": ["down", "left", "right", "up"],
  "frameNames": "goblin_archer_attack_<dir>_<i>",
  "fps": 9,
  "frameDurationsMs": [120, 100, 100, 120, 250, 70, 100, 120],
  "fpsSource": "goblin_archer_attack_down.gif",
  "loop": false,
  "holdLast": false,
  "releaseFrame": 6,
  "spawnFrame": 6,
  "spawnOffsetFromFeet": {
    "down":  { "x": -3.5,  "y": -26.0, "z": 0.802 },
    "right": { "x": 27.5,  "y": -31.0, "z": 0.802 },
    "up":    { "x": 3.5,   "y": -37.4, "z": 0.802 },
    "left":  { "x": -27.5, "y": -32.4, "z": 0.802 }
  },
  "projectile": "goblin_archer_arrow"
}
```

---

## 4. Complex Multi-Sheet & Multi-Phase Assets

### The Red Dragon Boss
- **Cell Size & Pivot:** Standard cell is $640 \times 512$ px with anchor `{"x": 0.5, "y": 0.7812}` (pixel point $(320, 400)$).
- **Multi-Page Texture Budgeting:**
  - The dragon frames span 7 high-resolution sheets ($4096 \times 3584$ or $4096 \times 2048$):
    - Phase 1: `red_dragon_p1_a.png`, `red_dragon_p1_b.png`
    - Phase 2: `red_dragon_p2_a.png`, `red_dragon_p2_b.png`, `red_dragon_p2_land.png`
    - Phase 3: `red_dragon_p3_a.png`, `red_dragon_p3_b.png`
  - *Memory Constraint:* Loading all 7 pages simultaneously exhausts GPU texture memory on integrated graphics (e.g., Iris Xe). The Phaser registry must load **only the current active phase** and evict prior phases upon phase transition.
- **Dedicated Attack Sidecar:** `art-source/blendsmith/red_dragon/attacks.json` controls multi-phase combat logic:
  - `claw`: 12 fps, hits on frames $[2, 4]$.
  - `tail`: 12 fps, 360° spin hitting on frames $[3, 4]$.
  - `breath`: 10 fps, loops frames $[3..6]$, hits on $[3, 4, 5, 6]$.
  - `volley`: 10 fps, spawns 3 fireballs on frames $[1, 4, 7]$.
  - `hover` & `t12`: Airborne transition; body lifts $52$ px above ground while shadow stays anchored at origin $(320, 400)$.
- **Dragon Visual Effects:** Driven exclusively by `red_dragon/fx_v2/dragon_fx_v2` (`fx_v2/dragon_fx_v2.json`). Legacy `dragon_fx.json` (v1) is deprecated.

### Mage Pipeline Merge
- Render outputs from Blendsmith are delivered across two distinct subdirectories:
  - `mage/walk/`: base animations (walk, run, hurt, death, dodge, cast, charged, attack2, fireball).
  - `mage/spells/`: spell animations (mage_book, mage_spells, spell_fx).
- The importer (`tools/assets/import_blendsmith.mjs`) automatically parses and combines both directories into a unified `mage` atlas manifest for the client.

### Ambient Critters
- Critter atlases contain small wildlife (e.g., squirrels, frogs, birds, rabbits) in $16\times 16$ and $32\times 32$ cells.
- Phase 1 renders Left and Right facings only. Directional facing logic must map `up` to `right` and `down` to `left` (or maintain last horizontal facing) until Phase 2 delivers 4-way critter sheets.

---

## 5. §Tiles: 32 px Tile & Prop Specification

This section governs the upcoming 32 px tile and prop asset set (`AS-2` and Lane F / `MM-1`).

### A. Tile Resolution & Camera Alignment
- **Base Grid Size:** $32 \times 32$ pixels per tile.
- **Orthographic Rendering:** Matches the characters' $12^\circ$ camera angle and directional key lighting.
- **Transparency:** All tiles and props are rendered against fully transparent alpha backgrounds.

### B. Wang / Edge Set Autotiling Standard
To allow seamless terrain transitions in Tiled (`.tmj` / `.tsj`) and Phaser, terrain sheets provide a standard 16-tile Wang/blob edge set (corners, cardinal edges, inner corners, full center) named:
- `grass`: Base lawn, tuft variants, flower dressings, path edge fillets.
- `dirt_road`: Cart track dirt core, north/south/east/west grass-to-dirt edge transitions, 4-way intersections.
- `cobble_road`: Paved town square cobblestone with stone-to-dirt edge Wang sets.
- `water`: River water, animated shimmer frames, bank edges, shallow gravel ford, and plank bridge deck.
- `cliffs`: Rocky terrain elevation rises with sheer face, corners, and plateau caps.
- `interiors`: Tavern and market timber floor planks, interior wainscot walls, stone hearths.
- `dungeon`: Stone dungeon flagstones, cracked slabs, obsidian walls.

### C. Prop Anchors & Colliders
- **Origin Pivot:** Base-anchored at bottom-center $(0.5, 1.0)$ relative to the footprint.
- **Embedded Footprint:** Every prop defines its physical ground footprint in its atlas metadata:
  ```json
  "footprint": {
    "x": -16, "y": -8, "w": 32, "h": 16,
    "shape": "ellipse"
  }
  ```
- **Overhead Canopies & Roofs (`tall: true`):**
  - Props like cottages, tavern structures, and large pine trees separate the collidable base trunk/wall from the overhead canopy/roof.
  - The upper canopy is marked `tall: true` with no collision, allowing player and NPC sprites to walk behind and beneath it with standard Phaser depth sorting (`depth = y`).
