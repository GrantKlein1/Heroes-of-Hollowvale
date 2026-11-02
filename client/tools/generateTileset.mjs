/**
 * Bake the overworld sheet from the CC0 Ninja Adventure tileset.
 * Copies the pack, fills transparent roof/post pixels with grass, writes
 * stamp JSON, interior backdrops, and a bandit frame. Does not paint tiles.
 *
 *   npm run tileset
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { STAMP_LEAGUES } from '../src/game/world/stamps.js'
import { SHEET_COLS, TILE_COUNT, collisionForTile } from '../src/game/world/tileCatalog.js'
import { TREES, UNDERPAINT, auditRects, cell } from '../src/game/world/packMap.js'
import { clearWorldCache, getWorld } from '../src/game/world/league.js'
import { LEAGUE_H, LEAGUE_W, STRIDE_X, STRIDE_Y, TILE, WORLD_SEED } from '../src/game/world/metrics.js'
import { PROP_KINDS, propSprite } from '../src/game/world/props.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../public/maps')
const packDir = join(root, 'ninja-adventure')
const TILE_PX = 16
const GRASS_COL = 14
const GRASS_ROW = 16

function underpaint(sheet) {
  for (const [col, row] of UNDERPAINT) {
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const di = ((row * TILE_PX + y) * sheet.width + col * TILE_PX + x) * 4
        const si = ((GRASS_ROW * TILE_PX + y) * sheet.width + GRASS_COL * TILE_PX + x) * 4
        const a = sheet.data[di + 3] / 255
        if (a > 0.98) continue
        sheet.data[di] = sheet.data[di] * a + sheet.data[si] * (1 - a)
        sheet.data[di + 1] = sheet.data[di + 1] * a + sheet.data[si + 1] * (1 - a)
        sheet.data[di + 2] = sheet.data[di + 2] * a + sheet.data[si + 2] * (1 - a)
        sheet.data[di + 3] = 255
      }
    }
  }
}

function tilesetJson(sheet) {
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
    tileheight: TILE_PX,
    tiles,
    tilewidth: TILE_PX,
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

function blitIndex(dst, sheet, index, dx, dy) {
  const sx0 = (index % SHEET_COLS) * TILE_PX
  const sy0 = Math.floor(index / SHEET_COLS) * TILE_PX
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const si = ((sy0 + y) * sheet.width + (sx0 + x)) * 4
      const a = sheet.data[si + 3] / 255
      if (a < 0.05) continue
      const px = dx + x
      const py = dy + y
      if (px < 0 || py < 0 || px >= dst.width || py >= dst.height) continue
      const di = (py * dst.width + px) * 4
      dst.data[di] = dst.data[di] * (1 - a) + sheet.data[si] * a
      dst.data[di + 1] = dst.data[di + 1] * (1 - a) + sheet.data[si + 1] * a
      dst.data[di + 2] = dst.data[di + 2] * (1 - a) + sheet.data[si + 2] * a
      dst.data[di + 3] = 255
    }
  }
}

function blitRect(dst, sheet, col, row, tw, th, dx, dy) {
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      blitIndex(dst, sheet, cell(col + tx, row + ty), dx + tx * TILE_PX, dy + ty * TILE_PX)
    }
  }
}

function renderRoom(sheet, kind) {
  const cols = 20
  const rows = 14
  const png = new PNG({ width: cols * TILE_PX, height: rows * TILE_PX })
  const floor = kind === 'tavern' ? cell(24, 8) : cell(25, 8)
  const wall = cell(18, 4)
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) blitIndex(png, sheet, floor, tx * TILE_PX, ty * TILE_PX)
  }
  for (let tx = 0; tx < cols; tx++) {
    blitIndex(png, sheet, wall, tx * TILE_PX, 0)
    blitIndex(png, sheet, wall, tx * TILE_PX, TILE_PX)
    if (tx !== 9 && tx !== 10) blitIndex(png, sheet, wall, tx * TILE_PX, (rows - 1) * TILE_PX)
  }
  for (let ty = 2; ty < rows - 1; ty++) {
    blitIndex(png, sheet, wall, 0, ty * TILE_PX)
    blitIndex(png, sheet, wall, (cols - 1) * TILE_PX, ty * TILE_PX)
  }
  if (kind === 'tavern') {
    for (let tx = 4; tx <= 15; tx++) blitIndex(png, sheet, cell(14, 6), tx * TILE_PX, 4 * TILE_PX)
    blitIndex(png, sheet, cell(1, 6), 2 * TILE_PX, 8 * TILE_PX)
    blitIndex(png, sheet, cell(2, 6), 3 * TILE_PX, 8 * TILE_PX)
    blitIndex(png, sheet, cell(2, 6), 16 * TILE_PX, 8 * TILE_PX)
    blitIndex(png, sheet, cell(4, 8), 15 * TILE_PX, 9 * TILE_PX)
    blitIndex(png, sheet, cell(8, 6), 9 * TILE_PX, 3 * TILE_PX)
  } else {
    for (let tx = 2; tx <= 8; tx++) blitIndex(png, sheet, cell(2, 6), tx * TILE_PX, 3 * TILE_PX)
    for (let tx = 11; tx <= 17; tx++) blitIndex(png, sheet, cell(11, 6), tx * TILE_PX, 3 * TILE_PX)
    blitIndex(png, sheet, cell(1, 6), 4 * TILE_PX, 9 * TILE_PX)
    blitIndex(png, sheet, cell(4, 8), 14 * TILE_PX, 9 * TILE_PX)
    blitIndex(png, sheet, cell(8, 6), 8 * TILE_PX, 2 * TILE_PX)
  }
  return png
}

function renderBandit() {
  const src = PNG.sync.read(readFileSync(join(packDir, 'character.png')))
  const png = new PNG({ width: 16, height: 16 })
  const sx = 0
  const sy = 0
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const si = ((sy + y) * src.width + (sx + x)) * 4
      const di = (y * 16 + x) * 4
      png.data[di] = src.data[si]
      png.data[di + 1] = src.data[si + 1]
      png.data[di + 2] = src.data[si + 2]
      png.data[di + 3] = src.data[si + 3]
    }
  }
  return png
}

function renderPreview(sheet, world) {
  const scale = 3
  const mapW = LEAGUE_W * TILE * scale
  const mapH = LEAGUE_H * TILE * scale
  const png = new PNG({ width: mapW, height: mapH * 5, fill: true })
  for (let ly = 0; ly <= 4; ly++) {
    const view = world.league(0, ly)
    const top = ly * mapH
    for (let ty = 0; ty < LEAGUE_H; ty++) {
      for (let tx = 0; tx < LEAGUE_W; tx++) {
        const index = view.tiles[ty][tx]
        for (let y = 0; y < TILE; y++) {
          for (let x = 0; x < TILE; x++) {
            const sx0 = (index % SHEET_COLS) * TILE
            const sy0 = Math.floor(index / SHEET_COLS) * TILE
            const si = ((sy0 + y) * sheet.width + (sx0 + x)) * 4
            for (let oy = 0; oy < scale; oy++) {
              for (let ox = 0; ox < scale; ox++) {
                const dx = (tx * TILE + x) * scale + ox
                const dy = top + (ty * TILE + y) * scale + oy
                const di = (dy * png.width + dx) * 4
                png.data[di] = sheet.data[si]
                png.data[di + 1] = sheet.data[si + 1]
                png.data[di + 2] = sheet.data[si + 2]
                png.data[di + 3] = 255
              }
            }
          }
        }
      }
    }
    for (const prop of view.props) {
      const tx = prop.wx - ly * 0
      const ty = prop.wy - ly * STRIDE_Y
      if (ty < -2 || ty >= LEAGUE_H || tx < -1 || tx >= LEAGUE_W) continue
      if (prop.tall) {
        const tree = TREES[prop.variant % TREES.length]
        blitPixels(png, sheet, tree.x, tree.y, tree.w, tree.h, tx, ty, top, scale)
      } else {
        const spec = propSprite(prop.kind, prop.variant)
        blitScaled(png, sheet, spec.col, spec.row, spec.tw, spec.th, tx, ty, top, scale, false)
      }
    }
  }
  return png
}

function blitPixels(dst, sheet, sx0, sy0, sw, sh, tx, ty, top, scale) {
  const originX = (tx * TILE + TILE / 2) * scale
  const originY = (top + (ty + 1) * TILE) * scale
  const left = originX - (sw * scale) / 2
  const up = originY - sh * scale
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const si = ((sy0 + y) * sheet.width + (sx0 + x)) * 4
      if (sx0 + x >= sheet.width || sy0 + y >= sheet.height) continue
      const a = sheet.data[si + 3] / 255
      if (a < 0.2) continue
      for (let oy = 0; oy < scale; oy++) {
        for (let ox = 0; ox < scale; ox++) {
          const dx = (left + x * scale + ox) | 0
          const dy = (up + y * scale + oy) | 0
          if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue
          const di = (dy * dst.width + dx) * 4
          dst.data[di] = dst.data[di] * (1 - a) + sheet.data[si] * a
          dst.data[di + 1] = dst.data[di + 1] * (1 - a) + sheet.data[si + 1] * a
          dst.data[di + 2] = dst.data[di + 2] * (1 - a) + sheet.data[si + 2] * a
          dst.data[di + 3] = 255
        }
      }
    }
  }
}

function blitScaled(dst, sheet, col, row, tw, th, tx, ty, top, scale, tall) {
  const originX = (tx * TILE + TILE / 2) * scale
  const originY = (top + (ty + 1) * TILE) * scale
  const pw = tw * TILE * scale
  const ph = th * TILE * scale
  const left = originX - pw / 2
  const up = originY - ph
  for (let y = 0; y < th * TILE; y++) {
    for (let x = 0; x < tw * TILE; x++) {
      const sx = col * TILE + x
      const sy = row * TILE + y
      const si = (sy * sheet.width + sx) * 4
      const a = sheet.data[si + 3] / 255
      if (a < 0.2) continue
      for (let oy = 0; oy < scale; oy++) {
        for (let ox = 0; ox < scale; ox++) {
          const dx = (left + x * scale + ox) | 0
          const dy = (up + y * scale + oy) | 0
          if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue
          const di = (dy * dst.width + dx) * 4
          dst.data[di] = dst.data[di] * (1 - a) + sheet.data[si] * a
          dst.data[di + 1] = dst.data[di + 1] * (1 - a) + sheet.data[si + 1] * a
          dst.data[di + 2] = dst.data[di + 2] * (1 - a) + sheet.data[si + 2] * a
          dst.data[di + 3] = 255
        }
      }
    }
  }
  if (tall) {
    /* canopy already included in the tree rect */
  }
}

const sheet = PNG.sync.read(readFileSync(join(packDir, 'tileset.png')))
underpaint(sheet)
clearWorldCache()
const world = getWorld(WORLD_SEED)
const tsj = tilesetJson(sheet)
writeFileSync(join(root, 'hollowvale.png'), PNG.sync.write(sheet))
writeFileSync(join(root, 'hollowvale.tsj'), JSON.stringify(tsj))
for (const stamp of STAMP_LEAGUES) {
  writeFileSync(join(root, `${stamp.key}.json`), JSON.stringify(stampMap(world, stamp, tsj)))
}
writeFileSync(join(root, 'tavern-interior.png'), PNG.sync.write(renderRoom(sheet, 'tavern')))
writeFileSync(join(root, 'market-interior.png'), PNG.sync.write(renderRoom(sheet, 'market')))
writeFileSync(join(root, 'bandit.png'), PNG.sync.write(renderBandit()))
writeFileSync(join(root, 'preview.png'), PNG.sync.write(renderPreview(sheet, world)))
rmSync(join(root, 'aseprite'), { recursive: true, force: true })
mkdirSync(join(root, 'aseprite'), { recursive: true })
const frames = auditRects()
for (const [kind, def] of Object.entries(PROP_KINDS)) {
  if (def.tall) continue
  const count = def.sprites ? def.sprites.length : def.frames.length
  for (let i = 0; i < count; i++) {
    const spec = propSprite(kind, i)
    frames.push({
      name: `${kind}-${i}`,
      x: spec.col * 16,
      y: spec.row * 16,
      w: (spec.tw || 1) * 16,
      h: (spec.th || 1) * 16,
    })
  }
}
writeFileSync('/tmp/atlas-frames.json', JSON.stringify(frames))
const sheetPy = spawnSync('python3', [join(dirname(fileURLToPath(import.meta.url)), 'contactSheet.py'), '/tmp/atlas-frames.json', join(root, 'atlas-contact.png'), join(packDir, 'tileset.png')], { encoding: 'utf8' })
if (sheetPy.status !== 0) {
  console.error(sheetPy.stderr || sheetPy.stdout)
  process.exit(sheetPy.status || 1)
}
console.log('baked Ninja Adventure sheet, stamps, interiors, bandit, contact sheet')
