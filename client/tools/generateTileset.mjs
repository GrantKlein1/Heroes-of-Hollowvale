/**
 * Deterministic 16×16 tileset for the Brackenford league map.
 * Run from the repo root: `npm run tileset`
 *
 * Writes:
 *   client/public/maps/hollowvale.png        sheet Grant can open in Aseprite
 *   client/public/maps/hollowvale.tsj        Tiled tileset with collision shapes
 *   client/public/maps/brackenford.json      stamped league
 *   client/public/maps/hearthmile.json
 *   client/public/maps/preview.png           sheet + corridor preview
 *   client/public/maps/aseprite/*.png        ground, props, and transition slices
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { STAMP_LEAGUES } from '../src/game/world/stamps.js'
import { getWorld, clearWorldCache } from '../src/game/world/league.js'
import { SHEET_COLS, SHEET_ROWS, TILE_COUNT, T, DUAL_ROWS, collisionForTile } from '../src/game/world/tileCatalog.js'
import { LEAGUE_H, LEAGUE_W, STRIDE_X, STRIDE_Y, TILE, WORLD_SEED } from '../src/game/world/metrics.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'maps')
const TILE_PX = 16

function clamp(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n
}
function rgba(r, g, b, a = 255) {
  return [r, g, b, a]
}
function add(c, d) {
  return rgba(clamp(c[0] + d), clamp(c[1] + d), clamp(c[2] + d), c[3] ?? 255)
}
function mix(a, b, t) {
  return rgba(
    clamp(a[0] + (b[0] - a[0]) * t),
    clamp(a[1] + (b[1] - a[1]) * t),
    clamp(a[2] + (b[2] - a[2]) * t),
    a[3] ?? 255,
  )
}

const LIGHT = (x, y) => 8 - Math.floor((x + y) / 4)

function grass(x, y) {
  const n = (x * 13 + y * 7 + ((x * y) & 7)) & 7
  let base = n < 5 ? rgba(42, 108, 40) : n < 7 ? rgba(32, 88, 32) : rgba(58, 130, 50)
  return add(base, LIGHT(x, y))
}
function plains(x, y) {
  const n = (x * 5 + y * 9) & 7
  let base = n < 5 ? rgba(124, 138, 62) : n < 7 ? rgba(104, 116, 48) : rgba(148, 156, 74)
  if (x % 4 === 1 && y % 3 !== 0) base = add(base, -10)
  return add(base, Math.floor(LIGHT(x, y) / 2))
}
function forest(x, y) {
  const n = (x * 3 + y * 11) & 7
  let base = n < 5 ? rgba(18, 58, 28) : n < 7 ? rgba(14, 44, 22) : rgba(28, 74, 34)
  if ((x + y * 2) % 9 === 0) base = rgba(36, 28, 16)
  return add(base, Math.floor(LIGHT(x, y) / 3))
}
function water(x, y) {
  const wave = (x + y * 3) % 8
  let c = wave < 2 ? rgba(52, 112, 148) : rgba(30, 74, 110)
  if (y % 4 === 1 && x % 6 === 3) c = rgba(168, 210, 214)
  return add(c, y < 4 ? 6 : y > 12 ? -6 : 0)
}
function road(x, y) {
  const ox = (Math.floor(y / 8) % 2) * 4
  const sx = (x + ox) % 8
  const sy = y % 8
  if (sx === 0 || sy === 0) return rgba(64, 42, 26)
  const tone = ((Math.floor((x + ox) / 8) * 3 + Math.floor(y / 8)) % 4) * 8
  let c = rgba(118 + tone, 98 + Math.floor(tone / 2), 84)
  if (sx < 3 && sy < 3) c = add(c, 22)
  else if (sx > 5 || sy > 5) c = add(c, -20)
  return c
}
function cobble(x, y) {
  const sx = x % 5
  const sy = y % 4
  if (sx === 0 || sy === 0) return rgba(58, 52, 46)
  let c = ((x + y) & 2) ? rgba(138, 128, 114) : rgba(112, 104, 92)
  if (sx < 2 && sy < 2) c = add(c, 18)
  else if (sy > 2) c = add(c, -14)
  return c
}
function wall(x, y) {
  const sx = x % 4
  if (sx === 3) return rgba(36, 24, 14)
  let c = rgba(112, 74, 40)
  if (sx === 0) c = add(c, 22)
  if (sx === 2) c = add(c, -16)
  if (y < 2) c = add(c, 10)
  if (y > 13) c = add(c, -12)
  return c
}
function roof(x, y) {
  const stripe = (x + y) % 4
  let c = stripe === 0 ? rgba(156, 82, 50) : stripe === 3 ? rgba(82, 30, 24) : rgba(122, 48, 34)
  if (y < 2) c = add(c, 18)
  if (y > 13) c = add(c, -16)
  return c
}
function bwall(x, y) {
  if (x < 2 || x > 13 || y < 2 || y > 13 || y === 8) return wall(x < 2 ? x : x > 13 ? x : 1, y)
  if (x > 5 && x < 10 && y > 3 && y < 8) {
    if (x === 6 || x === 9 || y === 4 || y === 7) return rgba(40, 28, 18)
    return rgba(86, 118, 138)
  }
  let c = rgba(168, 148, 112)
  if (x + y < 8) c = add(c, 12)
  if (x + y > 22) c = add(c, -14)
  return c
}
function thicket(x, y) {
  let c = forest(x, y)
  if ((x * 2 + y) % 5 === 0 || (x + y * 3) % 7 === 0) c = rgba(16, 32, 14)
  if (x % 6 === 2 && y % 5 === 1) c = rgba(48, 36, 20)
  return c
}
function ford(x, y) {
  const sx = x % 8
  const sy = y % 8
  if (sx > 1 && sx < 6 && sy > 2 && sy < 7) return road(x, y)
  return mix(water(x, y), rgba(70, 90, 70), 0.35)
}
function bridge(x, y) {
  if (y < 2 || y > 13) return water(x, y)
  if (y % 4 === 0) return rgba(58, 36, 20)
  let c = rgba(132, 88, 48)
  if (x < 3) c = add(c, 16)
  if (x > 12) c = add(c, -14)
  return c
}
function gate(side, x, y) {
  const post = side === 'L' ? x < 4 : x > 11
  if (y < 3 || post) return wall(x, y)
  return road(x, y)
}

function tuft(x, y, spots) {
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i]
    if (x === s[0] && (y === s[1] || y === s[1] + 1)) return rgba(18, 72, 22)
    if (x === s[0] && y === s[1] - 1) return rgba(90, 150, 60)
  }
  return null
}

const GRASS_TUFTS = [[5, 6], [10, 9], [7, 12]]
const GRASS_TUFTS_B = [[4, 5], [11, 8], [8, 11], [6, 14]]
const PLAINS_BLADES = [[4, 4], [8, 7], [12, 5], [6, 11], [11, 12]]

function centerDetail(baseFn, x, y, paint) {
  if (x < 2 || y < 2 || x > 13 || y > 13) return baseFn(x, y)
  return paint(x, y) || baseFn(x, y)
}

function flowerPix(x, y, kind) {
  const c = 8
  const dx = x - c
  const dy = y - 8
  if (dx * dx + dy * dy > 10) return rgba(0, 0, 0, 0)
  if (dx === 0 && dy === 0) return kind === 1 ? rgba(230, 200, 70) : rgba(236, 236, 230)
  if (Math.abs(dx) + Math.abs(dy) <= 2) return kind === 2 ? rgba(186, 92, 150) : rgba(220, 180, 70)
  return rgba(0, 0, 0, 0)
}

function mushroomPix(x, y, glow) {
  if (y > 11 && x > 6 && x < 10) return rgba(214, 206, 186)
  if (y >= 6 && y <= 11) {
    const dx = x - 8
    const dy = y - 8
    if (dx * dx + dy * dy <= 16) {
      if (glow && (x + y) % 3 === 0) return rgba(120, 210, 150)
      return dx < 0 && dy < 0 ? rgba(196, 64, 48) : rgba(140, 36, 32)
    }
  }
  return rgba(0, 0, 0, 0)
}

function canopyPix(v, x, y) {
  const seeds = [[8, 8, 7.1], [7, 9, 6.6], [9, 8, 7.4], [8, 7, 6.8]]
  const s = seeds[v]
  const dx = x - s[0]
  const dy = y - s[1]
  const r2 = s[2] * s[2]
  if (dx * dx + dy * dy > r2) return rgba(0, 0, 0, 0)
  let c = rgba(20, 84, 32)
  if (dx + dy < -2) c = rgba(52, 124, 46)
  else if (dx + dy > 5) c = rgba(10, 48, 20)
  if ((x * 3 + y + v * 5) % 11 === 0) c = rgba(14, 60, 24)
  if ((x + y * 2 + v) % 13 === 0) c = rgba(70, 140, 52)
  return c
}

function trunkPix(v, x, y) {
  const left = 5 + (v % 2)
  const right = 10 + (v % 2)
  if (x < left || x > right) return rgba(0, 0, 0, 0)
  let c = rgba(92, 60, 34)
  if (x === left) c = add(c, 18)
  if (x === right) c = add(c, -16)
  if (v === 3 && y % 4 === 0) c = rgba(70, 86, 42)
  return c
}

function bushPix(v, x, y) {
  const dx = x - 8
  const dy = y - 10
  const r = 5 + (v % 2)
  if (dx * dx + dy * dy > r * r || y < 5) return rgba(0, 0, 0, 0)
  let c = rgba(28, 90, 34)
  if (dx + dy < 0) c = add(c, 16)
  else c = add(c, -12)
  return c
}

function rockPix(v, x, y) {
  const dx = x - 8
  const dy = y - 9
  const r = 6 + (v % 2)
  if (dx * dx * 0.8 + dy * dy > r * r || y < 4) return rgba(0, 0, 0, 0)
  let c = rgba(112, 112, 116)
  if (dx < -1 && dy < 0) c = add(c, 28)
  else if (dx > 2 || dy > 2) c = add(c, -22)
  if ((x + y + v) % 9 === 0) c = rgba(70, 104, 52)
  return c
}

function logPix(x, y) {
  if (y < 8 || y > 13 || x < 1 || x > 14) return rgba(0, 0, 0, 0)
  if (y === 8 || y === 13) return rgba(54, 34, 18)
  let c = rgba(118, 76, 40)
  if (x < 4) c = add(c, 12)
  if (y > 11) c = add(c, -14)
  if (x % 5 === 0) c = add(c, -10)
  return c
}

function fencePix(dir, x, y) {
  const post = (px) => x >= px && x <= px + 2 && y >= 2 && y <= 14
  const rail = y === 5 || y === 9
  if (dir === 'E' && (post(10) || (rail && x >= 0))) {
    return x >= 10 && x <= 12 ? rgba(96, 64, 34) : rgba(120, 82, 44)
  }
  if (dir === 'W' && (post(3) || (rail && x < 12))) {
    return x >= 3 && x <= 5 ? rgba(96, 64, 34) : rgba(120, 82, 44)
  }
  if (dir === 'N' && (y >= 3 && y <= 6) && (x % 5 === 0 || (y === 4 || y === 5))) {
    return x % 5 === 0 ? rgba(84, 54, 28) : rgba(130, 88, 48)
  }
  if (dir === 'S' && (y >= 8 && y <= 12) && (x % 5 === 0 || y === 9 || y === 10)) {
    return x % 5 === 0 ? rgba(84, 54, 28) : rgba(130, 88, 48)
  }
  if (dir === 'P' && x >= 5 && x <= 9 && y >= 2 && y <= 14) return x < 7 ? rgba(140, 96, 52) : rgba(84, 54, 28)
  if (dir === 'C' && ((x >= 3 && x <= 6 && y >= 3 && y <= 14) || (y >= 6 && y <= 8))) {
    return rgba(110, 74, 40)
  }
  return rgba(0, 0, 0, 0)
}

function milestonePix(x, y) {
  if (x < 5 || x > 11 || y < 2 || y > 14) return rgba(0, 0, 0, 0)
  if (y > 12 && x >= 4 && x <= 12) {
    return x < 8 ? rgba(150, 146, 138) : rgba(96, 92, 86)
  }
  let c = rgba(132, 128, 120)
  if (x < 7) c = add(c, 16)
  if (x > 9) c = add(c, -18)
  if (y > 5 && y < 11 && x > 6 && x < 10 && (y % 2 === 0)) c = rgba(72, 64, 52)
  return c
}

function satchelPix(x, y) {
  if (x < 4 || x > 12 || y < 5 || y > 13) return rgba(0, 0, 0, 0)
  if (y < 8 && x > 5 && x < 11) return rgba(92, 60, 36)
  let c = rgba(128, 84, 46)
  if (x < 6) c = add(c, 14)
  if (x > 10 || y > 11) c = add(c, -16)
  if (y === 9 && x > 6 && x < 10) c = rgba(70, 46, 28)
  return c
}
function herbPix(x, y) {
  if ((x === 8 || x === 7 || x === 9) && y > 6 && y < 14) return rgba(40, 110, 40)
  if (y > 3 && y < 8 && x > 4 && x < 12 && (x + y) % 2 === 0) return rgba(70, 150, 60)
  return rgba(0, 0, 0, 0)
}
function cachePix(x, y) {
  if (x < 3 || x > 12 || y < 6 || y > 13) return rgba(0, 0, 0, 0)
  if (y === 6 || x === 3 || x === 12) return rgba(58, 40, 24)
  return x < 7 ? rgba(140, 98, 56) : rgba(104, 72, 40)
}
function offeringPix(x, y) {
  const dx = x - 8
  const dy = y - 9
  if (Math.abs(dx) + Math.abs(dy) > 4) return rgba(0, 0, 0, 0)
  if (dx < 0 && dy < 0) return rgba(150, 230, 160)
  return rgba(40, 140, 80)
}
function signPix(x, y) {
  if (x >= 7 && x <= 9 && y >= 6 && y <= 14) return x === 7 ? rgba(140, 96, 52) : rgba(84, 56, 30)
  if (y >= 3 && y <= 7 && x >= 3 && x <= 13) return y < 5 ? rgba(168, 140, 90) : rgba(112, 84, 52)
  return rgba(0, 0, 0, 0)
}
function boardPix(x, y) {
  if (x < 2 || x > 13 || y < 3 || y > 12) return rgba(0, 0, 0, 0)
  if (x < 3 || y < 4 || x > 12 || y > 11) return rgba(72, 48, 28)
  if (y % 3 === 0 && x > 4 && x < 12) return rgba(90, 70, 48)
  return rgba(156, 132, 92)
}

function maskValue(bits, x, y) {
  const nw = bits & 1
  const ne = (bits >> 1) & 1
  const sw = (bits >> 2) & 1
  const se = (bits >> 3) & 1
  const u = x / 15
  const v = y / 15
  const top = nw + (ne - nw) * u
  const bot = sw + (se - sw) * u
  return top + (bot - top) * v
}

const FAMILY_FN = { grass, plains, forest, road, water, cobble }

function dualPainter(pair, bits) {
  const [fg, bg] = pair.split('_')
  const fgFn = FAMILY_FN[fg]
  const bgFn = FAMILY_FN[bg]
  return (x, y) => {
    const m = maskValue(bits, x, y)
    if (m > 0.58) return fgFn(x, y)
    if (m < 0.42) return bgFn(x, y)
    const c = ((x + y) & 1) ? fgFn(x, y) : bgFn(x, y)
    return add(c, -10)
  }
}

function painterFor(index) {
  const dualEntries = Object.entries(DUAL_ROWS)
  for (let i = 0; i < dualEntries.length; i++) {
    const [pair, row] = dualEntries[i]
    const start = row * SHEET_COLS
    if (index >= start && index < start + 16) return dualPainter(pair, index - start)
  }
  switch (index) {
    case T.grass: return grass
    case T.grassB: return (x, y) => centerDetail(grass, x, y, (px, py) => tuft(px, py, GRASS_TUFTS))
    case T.grassC: return (x, y) => centerDetail(grass, x, y, (px, py) => tuft(px, py, GRASS_TUFTS_B))
    case T.grassD: return (x, y) => centerDetail(grass, x, y, (px, py) => (px === 8 && py === 8 ? rgba(210, 200, 90) : null))
    case T.plains: return plains
    case T.plainsB:
    case T.plainsC:
      return (x, y) => centerDetail(plains, x, y, (px, py) => tuft(px, py, PLAINS_BLADES))
    case T.forest: return forest
    case T.forestB:
    case T.forestC:
      return (x, y) => centerDetail(forest, x, y, (px, py) => ((px + py) % 6 === 0 ? rgba(40, 120, 70) : null))
    case T.water: return water
    case T.road: return road
    case T.cobble:
    case T.cobbleB:
    case T.cobbleC:
      return cobble
    case T.ford:
    case T.fordB:
      return ford
    case T.wall:
    case T.wallB:
    case T.wallC:
    case T.wallD:
      return wall
    case T.gateL: return (x, y) => gate('L', x, y)
    case T.gateR: return (x, y) => gate('R', x, y)
    case T.bridgeH:
    case T.bridgeHb:
    case T.bridgeV:
    case T.bridgeVb:
      return bridge
    case T.thicket:
    case T.thicketB:
      return thicket
    case T.roof:
    case T.roofB:
    case T.roofC:
      return roof
    case T.bwall:
    case T.bwallB:
    case T.bwallC:
      return bwall
    case T.door:
    case T.doorB:
      return (x, y) => (x > 3 && x < 12 && y > 2 ? rgba(64, 40, 24) : wall(x, y))
    case T.canopy0: return (x, y) => canopyPix(0, x, y)
    case T.canopy1: return (x, y) => canopyPix(1, x, y)
    case T.canopy2: return (x, y) => canopyPix(2, x, y)
    case T.canopy3: return (x, y) => canopyPix(3, x, y)
    case T.trunk0: return (x, y) => trunkPix(0, x, y)
    case T.trunk1: return (x, y) => trunkPix(1, x, y)
    case T.trunk2: return (x, y) => trunkPix(2, x, y)
    case T.trunk3: return (x, y) => trunkPix(3, x, y)
    case T.bush:
    case T.bushB:
    case T.bushC:
    case T.bushD:
      return (x, y) => bushPix(index, x, y)
    case T.rock:
    case T.rockB:
    case T.rockC:
    case T.rockD:
      return (x, y) => rockPix(index, x, y)
    case T.log:
    case T.logB:
    case T.logC:
      return logPix
    case T.flower: return (x, y) => flowerPix(x, y, 0)
    case T.flowerB: return (x, y) => flowerPix(x, y, 1)
    case T.flowerC: return (x, y) => flowerPix(x, y, 2)
    case T.flowerD: return (x, y) => flowerPix(x, y, 0)
    case T.mushroom:
    case T.mushroomB:
      return (x, y) => mushroomPix(x, y, false)
    case T.fungi:
    case T.fungiB:
      return (x, y) => mushroomPix(x, y, true)
    case T.fenceN: return (x, y) => fencePix('N', x, y)
    case T.fenceS: return (x, y) => fencePix('S', x, y)
    case T.fenceE: return (x, y) => fencePix('E', x, y)
    case T.fenceW: return (x, y) => fencePix('W', x, y)
    case T.fencePost: return (x, y) => fencePix('P', x, y)
    case T.fenceCorner: return (x, y) => fencePix('C', x, y)
    case T.milestone:
    case T.milestoneB:
      return milestonePix
    case T.satchel: return satchelPix
    case T.herb: return herbPix
    case T.cache: return cachePix
    case T.offering: return offeringPix
    case T.sign: return signPix
    case T.board: return boardPix
    case T.pebble: return (x, y) => rockPix(1, x, y)
    case T.reed: return (x, y) => (x % 3 === 1 && y > 4 ? rgba(70, 130, 60) : rgba(0, 0, 0, 0))
    default: return () => rgba(255, 0, 255)
  }
}

function renderSheet() {
  const width = SHEET_COLS * TILE_PX
  const height = SHEET_ROWS * TILE_PX
  const png = new PNG({ width, height })
  for (let index = 0; index < TILE_COUNT; index++) {
    const painter = painterFor(index)
    const col = index % SHEET_COLS
    const row = Math.floor(index / SHEET_COLS)
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const c = painter(x, y)
        const i = ((row * TILE_PX + y) * width + (col * TILE_PX + x)) * 4
        png.data[i] = c[0]
        png.data[i + 1] = c[1]
        png.data[i + 2] = c[2]
        png.data[i + 3] = c[3]
      }
    }
  }
  return png
}

function slice(src, row0, row1) {
  const width = src.width
  const height = (row1 - row0) * TILE_PX
  const png = new PNG({ width, height })
  PNG.bitblt(src, png, 0, row0 * TILE_PX, width, height, 0, 0)
  return png
}

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
    imageheight: SHEET_ROWS * TILE_PX,
    imagewidth: SHEET_COLS * TILE_PX,
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

function stampMap(world, stamp) {
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
  const tileset = tilesetJson()
  tileset.firstgid = 1
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
    tilesets: [tileset],
  }
}

function blit(dst, sheet, index, dx, dy, scale) {
  const sx0 = (index % SHEET_COLS) * TILE_PX
  const sy0 = Math.floor(index / SHEET_COLS) * TILE_PX
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const si = ((sy0 + y) * sheet.width + (sx0 + x)) * 4
      const a = sheet.data[si + 3]
      if (a < 16) continue
      for (let oy = 0; oy < scale; oy++) {
        for (let ox = 0; ox < scale; ox++) {
          const px = dx + x * scale + ox
          const py = dy + y * scale + oy
          if (px < 0 || py < 0 || px >= dst.width || py >= dst.height) continue
          const di = (py * dst.width + px) * 4
          const t = a / 255
          dst.data[di] = dst.data[di] * (1 - t) + sheet.data[si] * t
          dst.data[di + 1] = dst.data[di + 1] * (1 - t) + sheet.data[si + 1] * t
          dst.data[di + 2] = dst.data[di + 2] * (1 - t) + sheet.data[si + 2] * t
          dst.data[di + 3] = 255
        }
      }
    }
  }
}

function renderPreview(sheet, world) {
  const scale = 2
  const sheetW = sheet.width * scale
  const sheetH = sheet.height * scale
  const mapW = LEAGUE_W * TILE * scale
  const mapH = LEAGUE_H * TILE * scale
  const width = Math.max(sheetW, mapW)
  const height = sheetH + mapH * 5 + 8
  const png = new PNG({ width, height, fill: true })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 24
    png.data[i + 1] = 20
    png.data[i + 2] = 16
    png.data[i + 3] = 255
  }
  for (let index = 0; index < TILE_COUNT; index++) {
    const col = index % SHEET_COLS
    const row = Math.floor(index / SHEET_COLS)
    blit(png, sheet, index, col * TILE_PX * scale, row * TILE_PX * scale, scale)
  }
  for (let ly = 0; ly <= 4; ly++) {
    const view = world.league(0, ly)
    const top = sheetH + 4 + ly * mapH
    for (let ty = 0; ty < LEAGUE_H; ty++) {
      for (let tx = 0; tx < LEAGUE_W; tx++) {
        blit(png, sheet, view.tiles[ty][tx], tx * TILE * scale, top + ty * TILE * scale, scale)
      }
    }
    for (const prop of view.props) {
      const tx = prop.wx - 0 * STRIDE_X
      const ty = prop.wy - ly * STRIDE_Y
      if (prop.tall) {
        blit(png, sheet, T[`canopy${prop.variant}`], tx * TILE * scale, top + (ty - 1) * TILE * scale, scale)
        blit(png, sheet, T[`trunk${prop.variant}`], tx * TILE * scale, top + ty * TILE * scale, scale)
      } else {
        blit(png, sheet, prop.frame, tx * TILE * scale, top + ty * TILE * scale, scale)
      }
    }
  }
  return png
}

mkdirSync(join(root, 'aseprite'), { recursive: true })
clearWorldCache()
const world = getWorld(WORLD_SEED)
const sheet = renderSheet()
writeFileSync(join(root, 'hollowvale.png'), PNG.sync.write(sheet))
writeFileSync(join(root, 'aseprite', 'hollowvale-sheet.png'), PNG.sync.write(sheet))
writeFileSync(join(root, 'aseprite', '01-ground.png'), PNG.sync.write(slice(sheet, 0, 3)))
writeFileSync(join(root, 'aseprite', '02-props.png'), PNG.sync.write(slice(sheet, 3, 5)))
writeFileSync(join(root, 'aseprite', '03-transitions.png'), PNG.sync.write(slice(sheet, 5, 16)))
const tsj = tilesetJson()
writeFileSync(join(root, 'hollowvale.tsj'), JSON.stringify(tsj))
for (const stamp of STAMP_LEAGUES) {
  writeFileSync(join(root, `${stamp.key}.json`), JSON.stringify(stampMap(world, stamp)))
}
writeFileSync(join(root, 'preview.png'), PNG.sync.write(renderPreview(sheet, world)))
console.log('wrote tileset, stamps, and preview to', root)
