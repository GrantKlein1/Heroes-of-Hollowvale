# Procedural Terrain — Frozen Contracts (Phase 0)

This directory freezes the shared interfaces for the parallel Track A–D agents.
**Do not change these shapes without updating every track.** Fork your branch from
the commit that lands this Phase 0 PR.

## Architecture note (as of this commit)

`App.jsx` boots **Phaser** via `client/src/components/PhaserGame.jsx` →
`client/src/game/scenes/MainGameScene.js`. The legacy canvas loop in
`client/src/Game.jsx` still exists but is not mounted. Track D must integrate
wilderness into the **Phaser** scene (sole owner of
`client/src/game/scenes/MainGameScene.js` + related Phaser host files), not
`Game.jsx`.

Contracts below are **engine-agnostic pure data** so Tracks A–C never import Phaser.

## File ownership (parallel tracks)

| Track | Branch | Owns (only these) |
|-------|--------|-------------------|
| A — Art + real manifest | `cursor/terrain-assets-d431` | `client/public/images/terrain/*`, body of `client/src/config/terrainAssets.js` |
| B — Generator | `cursor/terrain-generator-d431` | `rng.js`, `biomes.js`, `generate.js`, `generate.check.mjs` |
| C — World graph + cache | `cursor/terrain-worldgraph-d431` | `worldGraph.js`, `screenCache.js` |
| D — Render + Phaser wiring | `cursor/terrain-render-integration-d431` | `render.js`, `client/src/game/scenes/MainGameScene.js`, `PhaserGame.jsx` if needed |

Tracks A–C **must not** edit Phaser / `Game.jsx`. Track D is the sole scene owner.

## Normalized coordinate space

All rects and positions use **image-normalized** coords in `[0, 1]`:

```js
{ x, y, w, h }  // fraction of the scene background / world frame
{ nx, ny }      // point in the same space
```

This matches the legacy `nrect` convention and maps cleanly to Phaser world
pixels once a frame `{ dx, dy, dw, dh }` (or world width/height) is known.

## Module contracts

### `client/src/config/terrainAssets.js`

```js
/** @typedef {{
 *   id: string,
 *   src: string,
 *   w: number,
 *   h: number,
 *   category: 'ground'|'object',
 *   collide: boolean,
 *   footprint: { x:number, y:number, w:number, h:number },
 *   anchor: 'bottom'|'center',
 *   biomes: string[],
 *   weight: number
 * }} TerrainAsset */

export const TERRAIN_ASSETS  // TerrainAsset[]
export function getAsset(id) // TerrainAsset | undefined
export function assetsForBiome(biome) // TerrainAsset[]
```

Asset files live at `/images/terrain/<type>_<W>x<H>.png` (transparent PNG).
Ground tiles must tile seamlessly. Phase 0 ships a **fixture** manifest only;
Track A replaces it with the real one.

### `client/src/game/terrain/rng.js`

```js
export function createRng(seed) // → { next(): number in [0,1), int(min,max), pick(arr), weighted(items) }
export function hashSeed(str)   // string → uint32 seed
```

### `client/src/game/terrain/biomes.js`

```js
/** @typedef {{
 *   id: string,
 *   groundTileId: string,
 *   pathTileId?: string,
 *   objectDensity: number,
 *   palette: string[],
 *   allowedObjectIds: string[]
 * }} BiomeRecipe */

export const BIOMES // Record<string, BiomeRecipe>
export function getBiome(id) // BiomeRecipe
```

Initial biome ids: `emberwood_forest`, `ashen_wastes`, `plains`.

### `client/src/game/terrain/generate.js`

```js
/** @typedef {{
 *   biome: string,
 *   groundTileId: string,
 *   objects: Array<{ assetId:string, nx:number, ny:number, scale:number, collide:boolean }>,
 *   colliders: Array<{ x:number, y:number, w:number, h:number }>,
 *   exits: { north?:boolean, south?:boolean, east?:boolean, west?:boolean }
 * }} TerrainLayout */

export function generateScreen({ nodeId, seed, biome, exits }) // → TerrainLayout
```

Must carve walkable corridors connecting every active exit to a central hub so
the player can always cross. Same `(nodeId, seed)` → identical layout.

### `client/src/game/terrain/worldGraph.js`

```js
/** @typedef {{
 *   id: string,
 *   biome: string,
 *   exits: { north?:string|null, south?:string|null, east?:string|null, west?:string|null }
 * }} WorldNode */
// exit value = neighbor node id, or null/undefined if closed

export function getNode(id) // WorldNode | undefined
export function getNeighbors(id) // { north, south, east, west } (ids or null)
export function oppositeEdge(edge) // 'north'↔'south', 'east'↔'west'
export const WORLD_NODES // WorldNode[]
```

### `client/src/game/terrain/screenCache.js`

```js
export function getLayout(nodeId)           // TerrainLayout (memoized)
export function preloadNeighbors(nodeId)   // void — idle-time neighbor layouts
export function evictBeyond(nodeId, distance = 2) // drop layouts farther than distance
export function clearCache()               // test helper
```

Regeneration: keep current + adjacent layouts; evict when player moves ≥2 nodes
away so returning yields a fresh seed.

### `client/src/game/terrain/render.js`

```js
/** @typedef {{ dx:number, dy:number, dw:number, dh:number }} Frame */

export function drawWilderness(ctx, layout, imagesById, frame)
// Canvas2D helper. If a sprite is missing from imagesById, draw a tinted
// color-box by category (ground=greenish, object=brown). This is the Track D
// fallback so integration never blocks on Track A art.

export function wildernessCollidersPx(layout, frame)
// → Array<{ x,y,w,h }> in pixel space for AABB collision
```

Phaser Track D may wrap these (or reimplement with Phaser sprites) but must
honor the same layout + color-box fallback semantics.

## Fixtures

`__fixtures__/fixtureManifest.js` — 4–5 fake assets (no real PNGs required).
`__fixtures__/fixtureLayout.js` — one hand-authored layout for Tracks C/D.

Tracks B/C/D develop against fixtures until Phase 2 swaps in real modules.

## API usage constraint

Do **not** exercise innkeeper chat (`POST /api/chat` → Groq) or TTS
(`POST /api/tts` → ElevenLabs) while building this feature. Leave those keys
unset. Terrain work needs zero external AI API calls at runtime.

## Copy-paste prompts for parallel agents

Start each Cloud Agent from **this branch** (`cursor/terrain-contracts-d431`)
once it is merged to `main`, or from `main` after merge. Keep Groq/ElevenLabs
keys unset.

### Track A — `cursor/terrain-assets-d431`
```
Implement Track A of the Procedural Terrain plan. Read client/src/game/terrain/CONTRACTS.md first and obey the frozen contracts.

Branch: cursor/terrain-assets-d431
ONLY create/edit: client/public/images/terrain/* and the body of client/src/config/terrainAssets.js (keep the exported API identical).

Produce transparent PNGs named type_WxH.png: grass_64x64, dirt_64x64 (seamless), rock_64x64, bush_48x48, tree_128x160 (+ one variant). Fill TERRAIN_ASSETS with real entries matching the TerrainAsset typedef.

Do NOT edit Game.jsx, Phaser scenes, generate.js, worldGraph.js, render.js, or screenCache.js.
Do NOT call Groq or ElevenLabs. Open a PR into main.
```

### Track B — `cursor/terrain-generator-d431`
```
Implement Track B of the Procedural Terrain plan. Read client/src/game/terrain/CONTRACTS.md first and obey the frozen contracts.

Branch: cursor/terrain-generator-d431
ONLY create/edit: client/src/game/terrain/rng.js, biomes.js, generate.js, and add generate.check.mjs.

Replace the Phase 0 stubs with: mulberry32 RNG; real biome recipes; generateScreen that tiles ground, carves exit→hub corridors, seeded footprint-rejection scatter, emits objects+colliders+exits. Develop against __fixtures__/fixtureManifest.js only.

Assert in generate.check.mjs: exit reachability, no overlapping colliders, same seed → identical layout.
Do NOT edit Game.jsx, Phaser scenes, terrainAssets.js, worldGraph.js, screenCache.js, render.js.
Do NOT call Groq or ElevenLabs. Open a PR into main.
```

### Track C — `cursor/terrain-worldgraph-d431`
```
Implement Track C of the Procedural Terrain plan. Read client/src/game/terrain/CONTRACTS.md first and obey the frozen contracts.

Branch: cursor/terrain-worldgraph-d431
ONLY create/edit: client/src/game/terrain/worldGraph.js and screenCache.js.

Replace stubs with a solid node table (biomes + N/S/E/W neighbors), getLayout memoization, idle-time preloadNeighbors, and evictBeyond(distance=2) regeneration policy. Depend only on the generateScreen signature / fixtures.

Do NOT edit Game.jsx, Phaser scenes, terrainAssets.js, generate.js, biomes.js, rng.js, render.js.
Do NOT call Groq or ElevenLabs. Open a PR into main.
```

### Track D — `cursor/terrain-render-integration-d431`
```
Implement Track D of the Procedural Terrain plan. Read client/src/game/terrain/CONTRACTS.md first and obey the frozen contracts.

Branch: cursor/terrain-render-integration-d431
You are the SOLE editor of client/src/game/scenes/MainGameScene.js (and PhaserGame.jsx if needed). Also own client/src/game/terrain/render.js.

Wire wilderness into the Phaser scene: drawWilderness (or Phaser equivalent) with color-box fallback when sprites are missing, wildernessCollidersPx / arcade colliders from layout, edge-exit transitions via worldGraph + oppositeEdge spawn, entrance from a hub into WILDERNESS_ENTRANCE_ID, screenCache getLayout/preloadNeighbors/evictBeyond.

Test with fixtures + placeholder color boxes. Do NOT exercise innkeeper chat or TTS (leave Groq/ElevenLabs unset).
Do NOT edit Track A–C files except render.js. Open a PR into main.
```

## Phase 2 integration checklist

1. Merge Tracks A–D into `main`.
2. Swap fixtures for real manifest + generator + worldGraph.
3. Load real terrain sprites (Phaser `this.load.image` or Image()).
4. Wire one hub exit into the wilderness graph.
5. Manual E2E: cross screens N/S/E/W, leave/return regeneration, no blocked paths.

