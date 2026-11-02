# Art pipeline (Aseprite → Phaser)

Base tile size is **16×16**. One league is one screen of **20×12** tiles (320×192 pixels). Neighboring screens overlap by one tile, so a shared edge is the same world cells. Painted 1024×1536 backdrops remain for interiors (the Embered Flagon, the market, the Cavern stand-in).

## Starter tileset

`npm run tileset` runs `client/tools/generateTileset.mjs` (pngjs only). It writes:

- `client/public/maps/hollowvale.png` — 16×16 sheet, 16 columns. Light is from the top-left. Ground tiles are opaque and seamless; trees, rocks, plants, and markers use alpha.
- `client/public/maps/hollowvale.tsj` — Tiled tileset. Water, walls, roofs, and building walls are full-tile collision. Tree trunks, rocks, logs, bushes, fences, and the milestone use a partial footprint. Canopy tiles, fords, and bridges have none.
- `client/public/maps/brackenford.json` and `hearthmile.json` — Tiled maps baked from the hand-authored kind grids in `client/src/game/world/stamps.js`. Phaser loads them with `tilemapTiledJSON`. Regenerate after editing the grids so the JSON stays in lockstep (the world test checks this).
- `client/public/maps/preview.png` — the sheet plus the Brackenford-to-Hearthmile corridor.
- `client/public/maps/aseprite/` — plain PNG slices (`01-ground.png`, `02-props.png`, `03-transitions.png`, and the full sheet) for editing in Aseprite. Open a slice, edit on the 16×16 grid, export over `hollowvale.png`, and keep the tile order. Do not add margin or spacing.

Rows 5–15 are dual-grid transitions, one pair per row, column = 4-bit corner mask (NW=1, NE=2, SW=4, SE=8). A mask of 0 or 15 is the seamless base tile. Trees are two tiles: canopy on row 3, trunk directly below on row 4, columns 0–3. The game stitches those into a 16×32 sprite so the canopy sorts above the player.

## Sprite sheets

1. Draw on a 16×16 grid (or a whole multiple of it, e.g. a 32×32 character made of four tiles).
2. In Aseprite: **File → Export Sprite Sheet**.
3. Layout: **By Rows** or **Packed**. Output file: PNG.
4. JSON Data: check **JSON Data**, and set the format to **Array** or **Hash**.
   - Array matches `this.load.aseprite(key, png, json)` frame order.
   - Hash matches frame names (`player_walk_0`) if you need to pick frames by tag.
5. Borders / padding: 0. Do not trim frames unless every frame is the same size — Phaser slices the sheet from the JSON rectangles.
6. Put the PNG and JSON under `client/public/images/` (or `client/public/images/sprites/`).

Load them once in the scene `preload`:

```js
this.load.aseprite('knight', '/images/sprites/knight.png', '/images/sprites/knight.json')
```

In `create`, register the tags Aseprite wrote (walk, attack, idle) and play them:

```js
this.anims.createFromAseprite('knight')
sprite.play({ key: 'walk', repeat: -1 })
```

Keep `pixelArt: true` on the game config so the canvas uses nearest-neighbor filtering. Do not scale frames by a fractional amount; the camera zoom is an integer.

## Tilesets for Tiled

1. In Aseprite, export a tileset image: one row or a grid of 16×16 cells, no spacing, no margin. PNG, indexed color is fine.
2. In Tiled: **New Tileset → Based on Tileset Image**. Tile width/height **16**, margin **0**, spacing **0**.
3. Stamp a map of **20×12** tiles per league screen. Save as JSON (`.tmj` / `.json`), not as a Lua or XML map.
4. Put the map JSON and the tileset PNG under `client/public/maps/`.

Load them in `preload`:

```js
this.load.image('hollowvale', '/maps/hollowvale.png')
this.load.tilemapTiledJSON('brackenford', '/maps/brackenford.json')
```

In `create`:

```js
const map = this.make.tilemap({ key: 'brackenford' })
const tiles = map.addTilesetImage('hollowvale', 'hollowvale')
map.createLayer('ground', tiles, 0, 0)
```

The tileset name in `addTilesetImage` must match the name stored in the Tiled JSON (`hollowvale`). Per-tile collision shapes live on `hollowvale.tsj` and inside each stamp. The overworld builds Arcade bodies from those footprints (trunk, not canopy) plus solid kinds (water, wall).

Screens stay 20×12. Walking off an edge calls `ScreenCamera.setScreenBounds` with the next league rectangle and `slideMs` 250. Painted interiors still snap (`slideMs` 0).
