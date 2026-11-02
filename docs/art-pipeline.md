# Art pipeline (Aseprite → Phaser)

Base tile size is **16×16**. One league is one screen of **20×12** tiles (320×192 pixels). Neighboring screens overlap by one tile, so a shared edge is the same world cells. The Embered Flagon and the market use interiors cut from the same sheet.

## Tileset

Overworld art is **Zelda-like tilesets and sprites** by ArMM1998, 16×16 top-down, released under [CC0](https://opengameart.org/content/zelda-like-tilesets-and-sprites). Attribution is not required. The pack, the measured `atlas.json`, and a CC0 note live in `client/public/maps/zelda-like/`. Derived tiles (dirt road, cobble, cottage, well, enemies, camp props) are authored in `bake.py` and saved under `zelda-like/authored/` as PNG and `.aseprite`.

`npm run tileset` runs `client/tools/generateTileset.mjs`, which runs `zelda-like/bake.py` and writes:

- `client/public/maps/hollowvale.png` — a 16×3 terrain sheet. One grass, two sparse details, dirt and cobble autotiles recolored from the pack's sand set, and the pack's water autotiles.
- `client/public/maps/hollowvale.tsj` — Tiled tileset. Water and walls are full-tile collision. Fords and bridges are not. Tree stems are prop footprints, not tiles.
- `client/public/maps/brackenford.json` and `hearthmile.json` — Tiled maps baked from `client/src/game/world/stamps.js`. Regenerate after editing the grids (the world test checks this).
- `tavern-interior.png` and `market-interior.png` — rooms composited from `Inner.png`.
- `atlas-contact.png` — every terrain id and sprite, labeled.

The generator stores a terrain kind. `autotile.js` picks a tile from the 9-piece set plus the four inner corners, using the neighbour mask. Houses, trees, fences, the bridge, and props are whole sprites, y-sorted. The hero is the pack's 16×32 walk cycle at scale 1.

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
