# Brackenford to Hearthmile & Ruinwatch: Route & Generator Design Notes

These notes preserve the world generator architecture, road geometry, collision model, and topological reachability rules developed in PR #22 (`agent/brackenford-hearthmile-map-976b`) and PR #23 (`agent/hearthmile-ruinwatch-road-976b`). They serve as the definitive specification for the Mapmaker bot and subsequent packages (MM-1, 2-1, 2-2, 2-3) when re-porting the procedural overworld into 32px Tiled maps (`.tmj` / `.tsj`) and Phaser tilemaps.

---

## 1. Continuous League Grid System

The world is structured as a continuous 2D coordinate grid of interconnected screen-sized windows called **leagues**:

```
            [North Wilderness] (-1, -1) .. (1, -1)
                        |
            [Brackenford (0, 0)] (Town, Flagon, Market, River)
                        |
            [Ember Road Screen 1] (0, 1)
                        |
            [Ember Road Screen 2] (0, 2)
                        |
            [Ember Road Screen 3] (0, 3)
                        |
[Ruinwatch Camp] <-- [Northern Eaves Road] <-- [Hearthmile Stone] (0, 4)
  (-16..-1, 46)        (16 leagues WNW)
```

### Grid Metrics & Stride Overlap
- **Origin League:** League `(0, 0)` is Brackenford. East is $+x$, South is $+y$.
- **Window Dimensions:** Each league window spans $20 \times 12$ tiles (`LEAGUE_W = 20`, `LEAGUE_H = 12`).
  - *Note:* Originally prototyped at 16px per tile ($320 \times 192$ px); the asset pipeline upgrades this to 32px per tile ($640 \times 384$ px viewport) using Blendsmith assets.
- **Stride Geometry:** The screen stride is $19 \times 11$ tiles (`STRIDE_X = 19`, `STRIDE_Y = 11`).
  - Because window width is 20 and stride is 19, adjacent leagues overlap by exactly 1 tile on shared borders.
  - The rightmost column of league $(lx, ly)$ (`tx = 19`) shares identical world tile coordinates $(wx, wy)$ with the leftmost column of league $(lx + 1, ly)$ (`tx = 0`).
  - The bottom row of league $(lx, ly)$ (`ty = 11`) shares identical world tile coordinates with the top row of league $(lx, ly + 1)$ (`ty = 0`).
  - This 1-tile seam guarantees continuous, seamless world transitions without visual seams or boundary teleportation.
- **World Coordinate Bounds:**
  - `LEAGUE_MIN_X = -2`, `LEAGUE_MAX_X = 2`
  - `LEAGUE_MIN_Y = -1`, `LEAGUE_MAX_Y = 5`
  - $wx \in [\text{MIN\_WX}, \text{MAX\_WX}]$ where $\text{MIN\_WX} = -2 \times 19 = -38$, $\text{MAX\_WX} = 2 \times 19 + 20 - 1 = 57$.
  - $wy \in [\text{MIN\_WY}, \text{MAX\_WY}]$ where $\text{MIN\_WY} = -1 \times 11 = -11$, $\text{MAX\_WY} = 5 \times 11 + 12 - 1 = 71$.
- **Stride Edge Protection (`isStrideEdge`):**
  - Stride boundaries occur wherever `wx % 19 === 0` or `wy % 11 === 0`.
  - The procedural generator forbids placing blocking props, colliders, or barrier terrain along stride edge cells. This ensures borders between screens remain permanently passable.

---

## 2. Road Geometry & Route Progression

### A. The Ember Road (Brackenford to Hearthmile)
- **Departure Gate:** The road leaves Brackenford through the fortified south gate at $wx \in [9..10], wy = 10$.
- **Highway Track:** Runs due south from $wy = 11$ through $wy = 47$ across three wilderness screens:
  - $wx \in [8..11]$ (4 tiles wide).
  - The 4-tile dirt footprint provides an effective 3-tile wide cartway with half-tile dirt fringe borders blending into ambient grass.
- **Hearthmile Stone Bend:**
  - Located at league `(0, 4)` around $wy = 48$.
  - A 4-connected turn set connects the south road to the Hearthmile Stone monument at $(wx = 7, wy = 48)$.
  - Stamped cobblestone apron pads the monument at $wx \in [6..8], wy \in [48..50]$.

### B. The Northern Eaves Road (Hearthmile to Ruinwatch)
- **Path Course:** Extends 16 leagues west-northwest from the Hearthmile bend along the northern forest eaves to Ruinwatch Camp.
- **Step Algorithm:**
  - Begins at $(wx = -4, wy = 46)$ and progresses over $16 \times 18 = 288$ steps.
  - For each step, $x$ decrements by 1 (heading west). Every 5th step (`i % 5 === 4`), $y$ decrements by 1 (heading north), producing a shallow WNW bearing.
  - Road width is 2 tiles wide (cells $(x, y)$ and $(x, y + 1)$).
- **Waymarks:**
  - Landmark mile posts sit beside the road every 4 leagues ($i > 0$ and $i \% 72 === 0$).
- **Ruinwatch Camp Terminus:**
  - Sits at the road terminus just off the shared screen edge beside the road.
  - Features a cobblestone ring apron, tent, campfire, crates, barrels, and the trail leading toward the ancient caverns.

### C. River Bracken Crossing
- **River Line:** Runs horizontally across $wy = 7$.
- **Town Ford:** Natural shallow gravel ford across $wy = 7$ at $wx \in [8..11]$.
- **Plank Bridge:** Wooden crossing constructed just west of the ford at $wx \in [5..6], wy = 7$.
- Water elsewhere along $wy = 7$ is non-passable river terrain.

---

## 3. Footprint Colliders & Sprite Bodies

To avoid character clipping and preserve visual depth:

### Whole Building Sprites
- Buildings are rendered as complete architectural sprites anchored at the bottom edge.
- **Footprint Collision:** Only the structural base (wall and roof footprint) carries collision data; roofs overhang the walkable area above the building.
- **Entry Doors:** The cell directly south of a building's footprint remains open, walkable grass or cobble, serving as the interaction/door waypoint.
- **Landmark Buildings:**
  - *The Flagon Tavern:* Cottage sprite, $wx = 8, wy = 3$, 4 tiles wide.
  - *Market Stalls:* Cottage sprite, $wx = 2, wy = 5$, 3 tiles wide.
  - *Blacksmith:* Cottage sprite, $wx = 13, wy = 4$, 3 tiles wide.
  - *Farm Barn:* House sprite south of the town gate, $wx = 2, wy = 19$, 4 tiles wide.

### Environmental Props & Trees
- **Stem/Base Colliders:** Props define collision bounding boxes relative to their anchor tile:
  ```javascript
  propRect = {
    x: prop.wx * TILE + collision.x,
    y: prop.wy * TILE + collision.y,
    w: collision.w,
    h: collision.h,
  }
  ```
- **Overhead Canopies:** Large pine trees define collision only on the bottom stem/trunk. The wide upper foliage is tagged `tall: true` with no collision, allowing the player sprite to walk behind and beneath the canopy with proper Y-sorting.
- **Center-Point Tile Invalidation:** A world tile only loses walkability in the movement graph if a prop's collider overlaps the geometric center point of that tile (`tileCenter(wx, wy)`). Props that merely graze cell boundaries do not obstruct movement.

---

## 4. Topological Safety & Reachability

To guarantee that procedural decoration never strands the player or blocks progression:

### BFS Flood-Fill Validation (`floodLeague`)
- For every generated league window, a flood-fill traversal initiates simultaneously from all walkable perimeter border cells.
- Any walkable cell not reached by the flood-fill queue is categorized as "lost" (an isolated pocket).
- If any lost cells are detected, the configuration is invalid.

### Prop Placement Rollback (`leagueConnected`)
- When placing procedural props (trees, boulders, fences, debris), each candidate blocking prop is tentatively added to the collision set.
- `leagueConnected` evaluates the league graph. If adding the prop partitions any passable cell or cuts off screen-to-screen connectivity, the prop is rejected and rolled back immediately.
- Roads, bridges, gates, and fords are strictly reserved: no blocking props may ever be placed on road or transit cells.

### Road BFS Continuity (`roadConnected`)
- A global BFS pathfinder verifies end-to-end 4-connected passage from Brackenford south gate $(9, 10)$ all the way to Hearthmile Stone $(7, 48)$.
- Continuous open road is guaranteed on every valid seed.

---

## 5. Deterministic Seeding & Randomness Control

- **Zero `Math.random` Policy:** Consistent with project rules, all generation is strictly deterministic.
- **Hash Mixing Algorithm:**
  ```javascript
  export function mix(seed, x, y, salt = 0) {
    let h = (typeof seed === 'number' ? seed : hashSeed(String(seed))) >>> 0
    h ^= Math.imul(x | 0, 0x9e3779b1)
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
    h ^= Math.imul(y | 0, 0xc2b2ae35)
    h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f)
    h ^= salt >>> 0
    h = Math.imul(h ^ (h >>> 16), 0x165667b1)
    return h >>> 0
  }
  ```
- **World Seed:** `hollowvale-1477`.
- **Revisit Stability:** Visiting any league coordinate, moving away, and returning generates identical tiles, props, loot markers, and encounter triggers.

---

## 6. Place Names & Lore Canon Grounding

All places, landmarks, and routes referenced in the generator are grounded in **`newLore_expanded.txt`** (PR #20 merged and confirmed canon):

| Entity / Landmark | Role in Generator | Location in `newLore_expanded.txt` | Canon Status |
| :--- | :--- | :--- | :--- |
| **Brackenford** | Starting town, hub league `(0, 0)` | Lines 12, 101, 103, 163, 185, 348... | **Canon** (Original & Expanded) |
| **The Flagon** | Town tavern and meeting hall | Lines 106, 175, 411, 413, 1792... | **Canon** (Original & Expanded) |
| **River Bracken** | River crossing at $wy = 7$ (ford & bridge) | Lines 101, 114, 186, 218, 483... | **Canon** (Original & Expanded) |
| **Ember Road** | Southern highway from Brackenford to Hearthmile | Lines 103, 113, 165, 348, 350... | **Canon** (Expanded PR #20) |
| **Hearthmile Stone** | Road bend marker stone at league `(0, 4)` | Lines 103, 166, 350, 360... | **Canon** (Expanded PR #20) |
| **Ruinwatch** | Frontier camp at terminus of the 16-league eaves road | Lines 103, 167, 352, 355, 362... | **Canon** (Expanded PR #20) |

*Summary:* There are zero ungrounded or invented place names. Every named feature is documented in canon lore.

