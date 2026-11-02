/**
 * Bake the Zelda-like terrain sheet, then write Tiled stamps from the
 * generator. Art itself is produced by client/public/maps/zelda-like/bake.py.
 *
 *   npm run tileset
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { STAMP_LEAGUES } from '../src/game/world/stamps.js'
import { SHEET_COLS, TILE_COUNT, collisionForTile } from '../src/game/world/tileCatalog.js'
import { clearWorldCache, getWorld } from '../src/game/world/league.js'
import { LEAGUE_H, LEAGUE_W, STRIDE_X, STRIDE_Y, TILE, WORLD_SEED } from '../src/game/world/metrics.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../public/maps')
const bake = spawnSync('python3', [join(root, 'zelda-like/bake.py')], { encoding: 'utf8' })
if (bake.status !== 0) {
  console.error(bake.stdout)
  console.error(bake.stderr)
  process.exit(bake.status || 1)
}

const sheet = PNG.sync.read(readFileSync(join(root, 'hollowvale.png')))

function tilesetJson() {
  const tiles = []
  for (let id = 0; id < TILE_COUNT; id++) {
    const hit = collisionForTile(id)
    if (!hit) continue
    tiles.push({
      id,
      objectgroup: {
        draworder: 'index',
        name: '',
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
        objects: [{
          height: hit.h,
          id: id + 1,
          name: '',
          rotation: 0,
          type: '',
          visible: true,
          width: hit.w,
          x: hit.x,
          y: hit.y,
        }],
      },
    })
  }
  return {
    columns: SHEET_COLS,
    image: 'hollowvale.png',
    imageheight: sheet.height,
    imagewidth: sheet.width,
    margin: 0,
    name: 'hollowvale',
    spacing: 0,
    tilecount: TILE_COUNT,
    tiledversion: '1.10.2',
    tileheight: TILE,
    tiles,
    tilewidth: TILE,
    type: 'tileset',
    version: '1.10',
  }
}

function stampMap(world, stamp, tileset) {
  const view = world.league(stamp.lx, stamp.ly)
  const data = []
  for (let ty = 0; ty < LEAGUE_H; ty++) {
    for (let tx = 0; tx < LEAGUE_W; tx++) data.push(view.tiles[ty][tx] + 1)
  }
  const objects = []
  let oid = 1
  const push = (name, type, wx, wy, w, h, props) => {
    const tx = wx - stamp.lx * STRIDE_X
    const ty = wy - stamp.ly * STRIDE_Y
    objects.push({
      id: oid++,
      name,
      type,
      x: tx * TILE,
      y: ty * TILE,
      width: w * TILE,
      height: h * TILE,
      rotation: 0,
      visible: true,
      properties: props,
    })
  }
  for (const it of view.interactables) {
    push(it.id, it.action, it.wx, it.wy, it.w || 1, it.h || 1, [
      { name: 'action', type: 'string', value: it.action },
      { name: 'label', type: 'string', value: it.label },
    ])
  }
  for (const loot of view.loot) {
    push(loot.id, 'loot', loot.wx, loot.wy, 1, 1, [
      { name: 'action', type: 'string', value: 'loot' },
      { name: 'label', type: 'string', value: loot.label },
    ])
  }
  const embedded = { ...tileset, firstgid: 1 }
  return {
    compressionlevel: -1,
    height: LEAGUE_H,
    width: LEAGUE_W,
    infinite: false,
    layers: [
      {
        id: 1,
        name: 'ground',
        type: 'tilelayer',
        width: LEAGUE_W,
        height: LEAGUE_H,
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        data,
      },
      {
        id: 2,
        name: 'objects',
        type: 'objectgroup',
        draworder: 'topdown',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects,
      },
    ],
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tileheight: TILE,
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    nextlayerid: 3,
    nextobjectid: oid,
    tilesets: [embedded],
  }
}

clearWorldCache()
const world = getWorld(WORLD_SEED)
const tsj = tilesetJson()
writeFileSync(join(root, 'hollowvale.tsj'), JSON.stringify(tsj))
for (const stamp of STAMP_LEAGUES) {
  writeFileSync(join(root, `${stamp.key}.json`), JSON.stringify(stampMap(world, stamp, tsj)))
}
console.log('stamps written for', STAMP_LEAGUES.map((s) => s.key).join(', '))
console.log(bake.stdout.trim())
