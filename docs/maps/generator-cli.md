# Tiled TMJ Map Generator (`generate_tmj.mjs`)

Package **MM-1** implements the procedural overworld generator CLI that ports the world design from [`docs/maps/brackenford-route-notes.md`](./brackenford-route-notes.md) into 32 px Tiled `.tmj` maps using Blendsmith v4 tilesets and prop metadata.

---

## 1. CLI Usage

```bash
# Generate all maps with the default world seed ('hollowvale-1477')
node tools/maps/generate_tmj.mjs

# Specify a custom seed
node tools/maps/generate_tmj.mjs --seed hollowvale-1477

# Specify a custom output directory
node tools/maps/generate_tmj.mjs --out client/public/maps
```

---

## 2. Generated Map Outputs

All generated maps are written to `client/public/maps/`:

| Map File | Grid Dimensions | Pixel Size | Role / Lore Grounding |
| :--- | :--- | :--- | :--- |
| **`brackenford.tmj`** | $20 \times 12$ tiles | $640 \times 384$ px | League $(0, 0)$ town hub: The Flagon, market, blacksmith, river crossings, south gate |
| **`hearthmile.tmj`** | $20 \times 12$ tiles | $640 \times 384$ px | League $(0, 4)$ road bend: Hearthmile Stone monument, cobblestone apron, eaves turn |
| **`ruinwatch.tmj`** | $20 \times 12$ tiles | $640 \times 384$ px | Ruinwatch Camp terminus: campfire, tents, crates, barrels, Cavern track |
| **`wilderness.tmj`** | $20 \times 34$ tiles | $640 \times 1088$ px | Ember Road wilderness corridor between Brackenford south gate and Hearthmile |

All place names (`Brackenford`, `Hearthmile`, `Ruinwatch`, `Ember Road`, `The Flagon`, `wilderness`) are strictly grounded in [`newLore_expanded.txt`](../../newLore_expanded.txt).

---

## 3. Water & Traversal Representation (Hard Rule 2)

Blendsmith v4 TSJs author river water with `collides: false` to allow proper water rendering and animation without treating water as inherently impassable or walkable. Traversal is governed as follows:

1. **`ground` Layer**:
   - Deep river water: GIDs from `water.tsj` ($49 \dots 144$) autotiled via 2x2 corner Wang sets.
   - Town ford: GIDs from `water_ford.tsj` ($145 \dots 148$) placed at $wy = 7, wx \in [8..11]$.
   - Plank bridge: GIDs from `bridge_plank.tsj` ($149 \dots 152$) placed at $wy = 7, wx \in [5..6]$.
2. **`collision` Layer**:
   - **Deep Water**: Blocked explicitly using solid obstacle GIDs (e.g. `cliff` GID 153 or `cliff_face` GID 177).
   - **Fords & Bridges**: Remain open with tile value `0` (passable).
   - **Land**: Walkable grass, dirt roads, and cobblestone retain tile value `0`.

### River shore and ground variants (TILES-VARIANTS, Batch 11 package B)

- Firstgids follow the tilecounts, in the order of `TILESET_SPECS` (`grass` 1, `dirt_road` 9, `cobble_road` 33, `water` 49, `water_ford` 145, `bridge_plank` 149, `cliff` 153, `cliff_face` 177, `water_shore` 185), so a tilecount change moves every later gid. Always regenerate after one.
- Brackenford's river banks use `water_shore`: grass cells above or below the river become sand over water (ids 0-15), and the grass cells that touch them use the sand to grass blend (ids 64-78, id = 63 + grass corner mask). `computeRiverShore` does this; nothing in the collision layer changes.
- Straight dirt road edges (Wang masks 3, 5, 10, 12) pick one of three art variants per cell (`dirtRoadVariant`, a pure function of the seed and the world cell). The id tables live in `client/src/game/terrain/tileVariants.js`, which the wilderness generator and `build_cavern.mjs` share.

---

## 4. Prop Pairing & Overhead Contract (Hard Rule 3)

In accordance with [`art-source/blendsmith/tiles/props/pairing.json`](../../art-source/blendsmith/tiles/props/pairing.json):

- **Shared Coordinates**: Paired structures (`cottage_base` + `cottage_roof`, `tavern_base` + `tavern_roof`, `tree_pine_base` + `tree_pine_canopy`, `tree_oak_base` + `tree_oak_canopy`) are placed at identical $(x, y)$ world coordinates with bottom-center pivot $(0.5, 1.0)$ and untrimmed canvas dimensions.
- **Collision Separation**:
  - Base props carry physical collision bounding boxes from their atlas footprint metadata in the `props` layer.
  - Overhead roofs and canopies are marked with `tall: true`, `layer: 'overhead'`, and non-colliding `shape: 'none'` footprints, ensuring characters walk behind and beneath them without collision clipping.

---

## 5. Canonical 7 Layers Architecture

Every generated map emits the 7 canonical layers required by [`client/src/game/maps/depth.js`](../../client/src/game/maps/depth.js) and [`client/src/game/maps/MapLoader.js`](../../client/src/game/maps/MapLoader.js):

1. **`ground`** (`tilelayer`, depth 0): Autotiled terrain, grass, roads, water, bridge planks, fords.
2. **`ground_detail`** (`tilelayer`, depth 10): Seeded grass tufts, flower dressings, path edge fillets.
3. **`walls`** (`tilelayer`, depth 20): Cliff faces, palisade walls.
4. **`props`** (`objectgroup`, depth 100): Physical base props, overheads (`tall: true`), interactive objects.
5. **`collision`** (`tilelayer`, depth 40000): Explicit 1-tile blocking colliders for deep water, barrier terrain, and solid walls.
6. **`zones`** (`objectgroup`, depth 40001): Player spawns (`spawn_default`, `spawn_north`, `spawn_south`, etc.) and map exits (`exit_south`, `exit_north`, etc.).
7. **`overhead`** (`tilelayer`, depth 30000): Overhead ceiling/treetop tile layer.
