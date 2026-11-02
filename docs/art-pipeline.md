# Art pipeline (Aseprite → Phaser)

Grant exports from Aseprite. The game loads those files at runtime; this repo does not generate art.

Base tile size is **16×16**. The next world map is one league per screen, **20×12 tiles** (320×192 pixels), authored as Tiled JSON. Painted 1024×1536 backdrops are temporary and are not tiles.

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
this.load.image('terrain', '/maps/terrain.png')
this.load.tilemapTiledJSON('league-0-0', '/maps/league-0-0.json')
```

In `create`:

```js
const map = this.make.tilemap({ key: 'league-0-0' })
const tiles = map.addTilesetImage('terrain', 'terrain')
map.createLayer('ground', tiles, 0, 0)
```

The tileset name in `addTilesetImage` must match the name stored in the Tiled JSON. Collision for the league map can be an object layer of rectangles, or tile `collides` properties — the scene already builds Arcade static bodies from rectangles.

Screens stay 20×12. Walking off an edge should call `ScreenCamera.setScreenBounds` with the next league rectangle and `slideMs` around 250. That helper is in `client/src/game/screenCamera.js`; today's painted scenes pass the whole backdrop and snap (`slideMs` 0).
