# Collision Approximation & Map Geometry Contract

## 1. Ellipse Footprints in Arcade Physics

Blendsmith v4 props and Tiled maps authored under `AS-2` specify collision footprints in object properties or atlas metadata (`footprint: { x, y, w, h, shape }`).

Several props are authored with `shape: "ellipse"`:
- `well`: `{ x: -14, y: -20, w: 28, h: 20, shape: "ellipse" }`
- `barrel`: `{ x: -10, y: -12, w: 20, h: 12, shape: "ellipse" }`
- `tree_pine_base`: `{ x: -10, y: -12, w: 20, h: 12, shape: "ellipse" }`
- `tree_oak_base`: `{ x: -12, y: -12, w: 24, h: 12, shape: "ellipse" }`

### Supported Approximation Policy
Phaser 3 Arcade Physics is an Axis-Aligned Bounding Box (AABB) physics engine. In order to provide deterministic, high-performance collision resolution without non-axis-aligned penetration artifacts:
1. Every prop footprint with `shape: "ellipse"` is approximated by its circumscribed AABB bounding rectangle of width `w` and height `h` positioned at the authored feet offset.
2. `MapLoader.checkCollision()` and `MapLoader.sweep()` evaluate continuous collision against this AABB.
3. In Phaser scenes, `MapLoader.mount()` instantiates static Arcade physics bodies with matching dimensions `(width: fp.w, height: fp.h)`.
4. Clearance around all placed ellipse props in `brackenford.tmj` guarantees full passage along all roads, paths, and fords without player clipping or entrapment.

---

## 2. Base and Overhead Prop Pairing Contract

As established in `client/public/assets/props/village_props/PAIRING.md` and `pairing.json`:
- **Shared Canvases & Bottom-Center Feet**:
  - `tavern_base` (192×208) + `tavern_roof` (192×208)
  - `cottage_base` (160×176) + `cottage_roof` (160×176)
  - `tree_pine_base` (128×160) + `tree_pine_canopy` (128×160)
  - `tree_oak_base` (144×144) + `tree_oak_canopy` (144×144)
- **Positioning**: Base and overhead are placed at identical authored coordinates `(x + width/2, y + height)` with pivot `(0.5, 1.0)`.
- **Collision Exclusion**:
  - Base props have solid footprints in `propFootprints`.
  - Overhead roofs and tree canopies specify `layer: "overhead"` and `shape: "none"`, `w: 0, h: 0`.
  - Overheads **never** instantiate collision bodies or block player movement.
- **Occlusion**:
  - Base props render at `depth = feetY` (Y-sorting with actors).
  - Overhead roofs and canopies render at `depth = LAYER_DEPTHS.overhead` (30000).
  - Actors standing behind bases or under overhanging eaves/canopies are naturally occluded.

---

## 3. Water Collision & Animation

- **River Bracken Waterway (Row 7)**:
  - Deep water tiles (`water`, GIDs 41–104 with `collides: true`) block player movement.
  - Bridge planks (`bridge_plank`, GIDs 109–112) and fords (`water_ford`, GIDs 105–108) have `collides: false` and are 100% passable.
- **Tunnelling Prevention**: Continuous sweep in `MapLoader` and Arcade Physics step separation ensure zero barrier penetration even at maximum movement speed (300 px/s).
- **Water Animation**:
  - In `water.tsj`, tiles 1..15 define a 4-frame animated sequence cycling by +16 GID offset every 160ms (cycle = 640ms).
  - `MapLoader.stepWaterAnimation()` dynamically updates animated water tile GIDs on the `ground` layer.
  - When animated tiles are not available or disabled, static water displays without errors.

