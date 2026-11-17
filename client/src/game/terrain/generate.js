/**
 * Seeded wilderness screen generator.
 *
 * Every cell is a manifest tileset frame (gid).
 * Ash corners use Wang bits NW=1 NE=2 SW=4 SE=8 (set bit = ash). Mask 0 is the
 * biome base (`forest_floor` or AS-2 `grass`), masks 1–14 are `ash_ground`,
 * and mask 15 is an `ash_fill` interior. Roads stay on AS-2 `dirt_road`.
 *
 * Ground gids are a pure function of world-cell coordinates, so a screen edge
 * does not depend on the visit seed. Exit mouths are hashed from the shared
 * edge key, which keeps neighbouring gaps and boundary corners identical.
 * Normalized gap widths match the historical 12×18 / 3-cell gaps (0.25 on
 * the horizontal edges, 0.20 on the vertical edges).
 *
 * @typedef {{ nw: boolean, ne: boolean, sw: boolean, se: boolean }} CornerBits
 *
 * @typedef {{
 *   kind: 'grass'|'path'|'forest'|'ash'|'ash_fill',
 *   tileset: string,
 *   frame: number,
 *   gid: number,
 *   ashMask: number,
 *   roadMask: number,
 *   corners: CornerBits
 * }} TerrainTileCell
 *
 * @typedef {{ start: number, end: number }} ExitBand
 *
 * @typedef {{
 *   biome: string,
 *   groundTileId: string,
 *   objects: Array<{
 *     assetId: string,
 *     atlas: string,
 *     frame: string,
 *     nx: number,
 *     ny: number,
 *     scale: number,
 *     flipX: boolean,
 *     collide: boolean,
 *     layer: 'props'|'overhead'|'decal',
 *     anchor: { x: number, y: number },
 *     footprint: { x: number, y: number, w: number, h: number, shape?: string },
 *     w: number,
 *     h: number,
 *     anim: string|null
 *   }>,
 *   colliders: Array<{ x: number, y: number, w: number, h: number }>,
 *   exits: { north?: boolean, south?: boolean, east?: boolean, west?: boolean },
 *   exitBands: { north?: ExitBand, south?: ExitBand, east?: ExitBand, west?: ExitBand },
 *   tiles: { cols: number, rows: number, cells: TerrainTileCell[] },
 *   tilesets: Array<{ name: string, firstgid: number, count: number, margin: number, spacing: number }>
 * }} TerrainLayout
 */

import wildPropsAtlas from '../../../public/assets/env/wild_props/wild_props.json' with { type: 'json' }
import wildProps4bAtlas from '../../../public/assets/env/wild_props_4b/wild_props_4b.json' with { type: 'json' }
import emberVentAtlas from '../../../public/assets/env/ember_vent/ember_vent.json' with { type: 'json' }
import { getBiome } from './biomes.js'
import { createRng, hashSeed } from './rng.js'
import { biomeFor, nodeIdAt } from './worldGraph.js'

/** Native Blendsmith tile size. 24×36 fills the 768×1152 wilderness world. */
export const TILE_PX = 32
export const GRID_COLS = 24
export const GRID_ROWS = 36

/**
 * Manifest tilesets used by wilderness screens.
 * firstgid is local to the generated layout (not a .tmj firstgid).
 */
export const TILESET_CATALOG = [
  { name: 'grass', firstgid: 1, count: 8, margin: 1, spacing: 2 },
  { name: 'dirt_road', firstgid: 9, count: 16, margin: 1, spacing: 2 },
  { name: 'forest_floor', firstgid: 25, count: 8, margin: 1, spacing: 2 },
  { name: 'ash_ground', firstgid: 41, count: 16, margin: 1, spacing: 2 },
  { name: 'ash_fill', firstgid: 57, count: 5, margin: 1, spacing: 2 },
]

const ATLASES = {
  wild_props: wildPropsAtlas,
  wild_props_4b: wildProps4bAtlas,
  ember_vent: emberVentAtlas,
}

/** Border collider thickness, normalized. */
const BORDER = 0.02
/**
 * Mouth width in cells. 6/24 = 0.25 and max(6/36, 0.20) = 0.20, the same
 * normalized gaps the 12×18 grid produced with a 3-cell mouth.
 */
const GAP_CELLS = 6
const MIN_GAP = 0.2
/** Chebyshev cells an obstacle must keep from a corridor (4×32 = the old 2×64). */
const OBSTACLE_CLEARANCE = 4
const MAX_ATTEMPTS = 8
const SCALES = [0.9, 0.95, 1, 1.05, 1.1]

const EMBERWOOD_PROPS = [
  { assetId: 'fern', atlas: 'wild_props_4b', per: 3, sample: 88, radius: 1 },
  { assetId: 'flowers', atlas: 'wild_props_4b', per: 3, sample: 88, radius: 1 },
  { assetId: 'mushroom_cluster', atlas: 'wild_props_4b', per: 2, sample: 88, radius: 1 },
  { assetId: 'stump_mossy', atlas: 'wild_props_4b', per: 2, sample: 88, radius: 2 },
  { assetId: 'log_fallen', atlas: 'wild_props_4b', per: 2, sample: 88, radius: 2 },
]

const ASH_DRIFTS = ['ash_drift_pool_a', 'ash_drift_pool_b', 'ash_drift_streak_a', 'ash_drift_streak_b']

/**
 * Wang corner bits. A set bit means that corner is ash (or, for roads, dirt).
 * @param {boolean} nw
 * @param {boolean} ne
 * @param {boolean} sw
 * @param {boolean} se
 * @returns {number} 0..15
 */
export function wangMask(nw, ne, sw, se) {
  return (nw ? 1 : 0) | (ne ? 2 : 0) | (sw ? 4 : 0) | (se ? 8 : 0)
}

/**
 * Pick the manifest frame for one ash Wang mask.
 * @param {number} mask 0..15
 * @param {string} baseTileset `forest_floor` or `grass`
 * @param {number} baseFrame
 * @param {number} fillFrame `ash_fill` variant
 */
export function tileForAshMask(mask, baseTileset, baseFrame, fillFrame) {
  if (mask <= 0) {
    return {
      tileset: baseTileset,
      frame: baseFrame,
      kind: baseTileset === 'grass' ? 'grass' : 'forest',
    }
  }
  if (mask >= 15) {
    return { tileset: 'ash_fill', frame: fillFrame, kind: 'ash_fill' }
  }
  return { tileset: 'ash_ground', frame: mask, kind: 'ash' }
}

/**
 * @param {string} name
 * @param {number} frame
 * @returns {number}
 */
export function gidFor(name, frame) {
  const ts = TILESET_CATALOG.find((t) => t.name === name)
  if (!ts) throw new Error(`Unknown wilderness tileset: ${name}`)
  const local = Math.max(0, Math.min(ts.count - 1, frame | 0))
  return ts.firstgid + local
}

/**
 * Atlas meta for one prop. Origins and footprints are never hardcoded.
 * @param {string} atlas
 * @param {string} assetId
 */
export function propDef(atlas, assetId) {
  const meta = ATLASES[atlas]?.meta?.props?.[assetId]
  if (!meta) throw new Error(`Missing prop meta ${atlas}:${assetId}`)
  return meta
}

/**
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {'north'|'south'|'east'|'west'} edge
 * @returns {TerrainTileCell[]}
 */
export function edgeCells(layout, edge) {
  const { cols, rows, cells } = layout.tiles
  const out = []
  if (edge === 'north') {
    for (let c = 0; c < cols; c++) out.push(cells[c])
  } else if (edge === 'south') {
    for (let c = 0; c < cols; c++) out.push(cells[(rows - 1) * cols + c])
  } else if (edge === 'west') {
    for (let r = 0; r < rows; r++) out.push(cells[r * cols])
  } else if (edge === 'east') {
    for (let r = 0; r < rows; r++) out.push(cells[r * cols + cols - 1])
  }
  return out
}

/**
 * @param {{
 *   nodeId: string,
 *   seed?: number|string,
 *   biome: string,
 *   exits?: { north?: boolean, south?: boolean, east?: boolean, west?: boolean }
 * }} opts
 * @returns {TerrainLayout}
 */
export function generateScreen({ nodeId, seed, biome, exits }) {
  const recipe = getBiome(biome)
  const resolvedExits = {
    north: !!exits?.north,
    south: !!exits?.south,
    east: !!exits?.east,
    west: !!exits?.west,
  }
  const at = parseNode(nodeId)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(hashSeed(`${nodeId}:${seed ?? 0}:${biome}:${attempt}`))
    const layout = buildLayout(recipe, resolvedExits, rng, at, false)
    if (isConnected(layout)) return layout
  }

  const rng = createRng(hashSeed(`${nodeId}:${seed ?? 0}:${biome}:bare`))
  return buildLayout(recipe, resolvedExits, rng, at, true)
}

/**
 * @param {string} id
 * @returns {{ id: string, col: number, row: number }|null}
 */
function parseNode(id) {
  const m = /^wild_(-?\d+)_(-?\d+)$/.exec(String(id ?? ''))
  if (!m) return null
  const col = Number(m[1])
  const row = Number(m[2])
  return { id: nodeIdAt(col, row), col, row }
}

/**
 * @param {import('./biomes.js').BiomeRecipe} recipe
 * @param {{ north: boolean, south: boolean, east: boolean, west: boolean }} exits
 * @param {import('./rng.js').Rng} rng
 * @param {{ id: string, col: number, row: number }|null} at
 * @param {boolean} skipObstacles
 * @returns {TerrainLayout}
 */
function buildLayout(recipe, exits, rng, at, skipObstacles) {
  const cols = GRID_COLS
  const rows = GRID_ROWS
  const mask = new Uint8Array(cols * rows)
  const self = at ? { id: at.id, biome: recipe.id } : { id: '', biome: recipe.id }

  const hubCol = rng.int(2, cols - 3)
  const hubRow = rng.int(2, rows - 3)
  mask[hubRow * cols + hubCol] = 1

  const mouths = {
    north: exits.north ? mouthAlong(horizontalEdgeKey(at, 'north'), cols) : null,
    south: exits.south ? mouthAlong(horizontalEdgeKey(at, 'south'), cols) : null,
    west: exits.west ? mouthAlong(verticalEdgeKey(at, 'west'), rows) : null,
    east: exits.east ? mouthAlong(verticalEdgeKey(at, 'east'), rows) : null,
  }

  if (mouths.north != null) stampMouth(mask, cols, rows, 'north', mouths.north, hubCol, hubRow)
  if (mouths.south != null) stampMouth(mask, cols, rows, 'south', mouths.south, hubCol, hubRow)
  if (mouths.west != null) stampMouth(mask, cols, rows, 'west', mouths.west, hubCol, hubRow)
  if (mouths.east != null) stampMouth(mask, cols, rows, 'east', mouths.east, hubCol, hubRow)

  const roadAt = (x, y) => isRoad(mask, cols, rows, exits, mouths, x, y)
  const ox = at ? at.col * cols : 0
  const oy = at ? at.row * rows : 0

  /** @type {TerrainTileCell[]} */
  const cells = new Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = ox + col
      const wy = oy + row
      const ashNW = ashCorner(wx, wy, self)
      const ashNE = ashCorner(wx + 1, wy, self)
      const ashSW = ashCorner(wx, wy + 1, self)
      const ashSE = ashCorner(wx + 1, wy + 1, self)
      const ashBits = wangMask(ashNW, ashNE, ashSW, ashSE)
      const roadBits = wangMask(
        roadCorner(wx, wy, roadAt),
        roadCorner(wx + 1, wy, roadAt),
        roadCorner(wx, wy + 1, roadAt),
        roadCorner(wx + 1, wy + 1, roadAt),
      )
      const onPath = mask[row * cols + col] === 1
      const ownBiome = biomeAt(wx, wy, self)
      // Wang frames are painted on Ashen cells. Neighbours keep their own base
      // so plains stay on AS-2 grass and Emberwood stays on forest_floor.
      const displayAsh = ownBiome === 'ashen_wastes' ? ashBits : 0
      const baseName = baseTileset(ownBiome)
      const ashTile = tileForAshMask(
        displayAsh,
        baseName,
        variantOf(baseName, wx, wy),
        variantOf('ash_fill', wx, wy),
      )
      const tileset = roadBits > 0 ? 'dirt_road' : ashTile.tileset
      const frame = roadBits > 0 ? roadBits : ashTile.frame
      const kind = onPath ? 'path' : ashTile.kind
      cells[row * cols + col] = {
        kind,
        tileset,
        frame,
        gid: gidFor(tileset, frame),
        ashMask: ashBits,
        roadMask: roadBits,
        corners: { nw: ashNW, ne: ashNE, sw: ashSW, se: ashSE },
      }
    }
  }

  const cellW = 1 / cols
  const cellH = 1 / rows
  /** @type {TerrainLayout['exitBands']} */
  const exitBands = {}
  if (mouths.north != null) exitBands.north = bandFor(mouths.north, cellW)
  if (mouths.south != null) exitBands.south = bandFor(mouths.south, cellW)
  if (mouths.west != null) exitBands.west = bandFor(mouths.west, cellH)
  if (mouths.east != null) exitBands.east = bandFor(mouths.east, cellH)

  const objects = skipObstacles ? [] : scatterProps(recipe.id, mask, cells, cols, rows, rng)

  return {
    biome: recipe.id,
    groundTileId: recipe.groundTileId,
    objects,
    colliders: buildColliders(exits, exitBands, objects),
    exits,
    exitBands,
    tiles: { cols, rows, cells },
    tilesets: TILESET_CATALOG,
  }
}

/**
 * @param {string} biome
 * @returns {'forest_floor'|'grass'}
 */
function baseTileset(biome) {
  return biome === 'emberwood_forest' ? 'forest_floor' : 'grass'
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {{ id: string, biome: string }} self
 */
function biomeAt(wx, wy, self) {
  const col = Math.floor(wx / GRID_COLS)
  const row = Math.floor(wy / GRID_ROWS)
  const id = nodeIdAt(col, row)
  if (self && id === self.id) return self.biome
  return biomeFor(id)
}

/**
 * Low-frequency value noise in 0..1. Corner (cx, cy) is owned by the cell
 * whose northwest corner it is, so both screens that share the corner agree.
 * @param {number} cx
 * @param {number} cy
 * @param {{ id: string, biome: string }} self
 */
function ashCorner(cx, cy, self) {
  const biome = biomeAt(cx, cy, self)
  if (biome !== 'ashen_wastes') return false
  return fbm(cx, cy) > 0.36
}

/** @param {number} x @param {number} y */
function fbm(x, y) {
  const n1 = valueNoise(x * 0.16, y * 0.16)
  const n2 = valueNoise(x * 0.37 + 11.2, y * 0.37 + 4.4)
  return n1 * 0.68 + n2 * 0.32
}

/** @param {number} x @param {number} y */
function valueNoise(x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = fade(x - x0)
  const ty = fade(y - y0)
  const v00 = hash01(x0, y0)
  const v10 = hash01(x0 + 1, y0)
  const v01 = hash01(x0, y0 + 1)
  const v11 = hash01(x0 + 1, y0 + 1)
  const a = v00 + (v10 - v00) * tx
  const b = v01 + (v11 - v01) * tx
  return a + (b - a) * ty
}

/** @param {number} t */
function fade(t) {
  return t * t * (3 - 2 * t)
}

/** @param {number} ix @param {number} iy */
function hash01(ix, iy) {
  return hashSeed(`n:${ix}:${iy}`) / 4294967296
}

/**
 * Floor variants sit in soft blobs on a base tile. A hard N×N block of a
 * different frame reads as a checker; a region that only fills its interior,
 * and only sometimes, keeps `forest_floor` / `ash_fill` / `grass` as one texture
 * with scattered patches. Independent of the visit seed.
 * @param {string} name
 * @param {number} wx
 * @param {number} wy
 */
function variantOf(name, wx, wy) {
  const count = name === 'ash_fill' ? 5 : 8
  const size = 8
  const rx = Math.floor(wx / size)
  const ry = Math.floor(wy / size)
  const roll = hashSeed(`region:${name}:${rx}:${ry}`) % (count + 5)
  if (roll === 0 || roll >= count) return 0
  const cx = rx * size + (size - 1) / 2
  const cy = ry * size + (size - 1) / 2
  const jx = (hashSeed(`jx:${name}:${wx}:${wy}`) % 5) - 2
  const jy = (hashSeed(`jy:${name}:${wx}:${wy}`) % 5) - 2
  const dx = wx + jx * 0.35 - cx
  const dy = wy + jy * 0.35 - cy
  if (dx * dx + dy * dy > 6.25) return 0
  return roll
}

/**
 * @param {{ col: number, row: number }|null} at
 * @param {'north'|'south'} edge
 */
function horizontalEdgeKey(at, edge) {
  const col = at ? at.col : 0
  const row = at ? at.row : 0
  const boundary = edge === 'south' ? row + 1 : row
  return `edge:h:${col}:${boundary}`
}

/**
 * @param {{ col: number, row: number }|null} at
 * @param {'west'|'east'} edge
 */
function verticalEdgeKey(at, edge) {
  const col = at ? at.col : 0
  const row = at ? at.row : 0
  const boundary = edge === 'east' ? col + 1 : col
  return `edge:v:${boundary}:${row}`
}

/** @param {string} edgeKey @param {number} span */
function mouthAlong(edgeKey, span) {
  const margin = Math.ceil(GAP_CELLS / 2)
  const lo = margin
  const hi = span - margin - 1
  if (hi < lo) return Math.floor(span / 2)
  return lo + (hashSeed(edgeKey) % (hi - lo + 1))
}

/** @param {number} mouth @param {number} size */
function bandFor(mouth, size) {
  const width = Math.max(GAP_CELLS * size, MIN_GAP)
  const center = (mouth + 0.5) * size
  const start = Math.max(0, Math.min(1 - width, center - width / 2))
  return { start, end: start + width }
}

/**
 * Corridor stays off the border except the single shared mouth cell, so the
 * facing edges of two neighbours carry the same path index.
 */
function stampMouth(mask, cols, rows, edge, index, hubCol, hubRow) {
  if (edge === 'north') {
    carveCol(mask, cols, rows, index, 1, hubRow)
    carveRow(mask, cols, rows, hubRow, hubCol, index)
    mask[index] = 1
  } else if (edge === 'south') {
    carveCol(mask, cols, rows, index, hubRow, rows - 2)
    carveRow(mask, cols, rows, hubRow, hubCol, index)
    mask[(rows - 1) * cols + index] = 1
  } else if (edge === 'west') {
    carveRow(mask, cols, rows, index, 1, hubCol)
    carveCol(mask, cols, rows, hubCol, hubRow, index)
    mask[index * cols] = 1
  } else if (edge === 'east') {
    carveRow(mask, cols, rows, index, hubCol, cols - 2)
    carveCol(mask, cols, rows, hubCol, hubRow, index)
    mask[index * cols + cols - 1] = 1
  }
}

function isRoad(mask, cols, rows, exits, mouths, x, y) {
  if (x >= 0 && y >= 0 && x < cols && y < rows) return mask[y * cols + x] === 1
  if (y < 0) return !!(exits.north && mouths.north != null && x === mouths.north)
  if (y >= rows) return !!(exits.south && mouths.south != null && x === mouths.south)
  if (x < 0) return !!(exits.west && mouths.west != null && y === mouths.west)
  if (x >= cols) return !!(exits.east && mouths.east != null && y === mouths.east)
  return false
}

/** A road corner is set when any of the four touching cells is corridor. */
function roadCorner(cx, cy, roadAt) {
  return roadAt(cx - 1, cy - 1) || roadAt(cx, cy - 1) || roadAt(cx - 1, cy) || roadAt(cx, cy)
}

/**
 * @param {string} biome
 * @param {Uint8Array} mask
 * @param {TerrainTileCell[]} cells
 * @param {number} cols
 * @param {number} rows
 * @param {import('./rng.js').Rng} rng
 */
function scatterProps(biome, mask, cells, cols, rows, rng) {
  /** @type {TerrainLayout['objects']} */
  const objects = []
  const occupied = new Uint8Array(cols * rows)

  const eligible = (pred) => {
    const list = []
    for (let row = 2; row < rows - 2; row++) {
      for (let col = 2; col < cols - 2; col++) {
        const i = row * cols + col
        if (mask[i]) continue
        if (cells[i].roadMask) continue
        if (nearPath(mask, cols, rows, col, row, OBSTACLE_CLEARANCE)) continue
        if (!pred(cells[i])) continue
        list.push(i)
      }
    }
    return list
  }

  const placeAt = (assetId, atlas, index, radius) => {
    if (occupied[index]) return false
    const col = index % cols
    const row = (index - col) / cols
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = col + dx
        const r = row + dy
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        if (occupied[r * cols + c]) return false
      }
    }
    const meta = propDef(atlas, assetId)
    const scale = rng.pick(SCALES)
    const flipX = rng.next() < 0.5
    const jx = (rng.next() - 0.5) * 0.4
    const jy = (rng.next() - 0.5) * 0.25
    const layer = layerOf(meta)
    const feet = layer !== 'decal'
    const nx = clamp01((col + 0.5 + jx) / cols)
    const ny = clamp01((row + (feet ? 0.9 : 0.5) + jy * 0.15) / rows)
    const anchor = meta.anchor || { x: 0.5, y: feet ? 1 : 0.5 }
    objects.push({
      assetId,
      atlas,
      frame: assetId,
      nx,
      ny,
      scale,
      flipX,
      collide: !!meta.collides,
      layer,
      anchor: { x: anchor.x, y: anchor.y },
      footprint: {
        x: meta.footprint?.x || 0,
        y: meta.footprint?.y || 0,
        w: meta.footprint?.w || 0,
        h: meta.footprint?.h || 0,
        shape: meta.footprint?.shape || 'none',
      },
      w: meta.size?.w || 32,
      h: meta.size?.h || 32,
      anim: null,
    })
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = col + dx
        const r = row + dy
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        occupied[r * cols + c] = 1
      }
    }
    return true
  }

  const fillQuota = (assetId, atlas, count, pool, radius) => {
    if (count <= 0 || !pool.length) return
    const bag = shuffle(pool, rng)
    let placed = 0
    for (let i = 0; i < bag.length && placed < count; i++) {
      if (placeAt(assetId, atlas, bag[i], radius)) placed++
    }
  }

  if (biome === 'emberwood_forest') {
    const forest = eligible((cell) => cell.tileset === 'forest_floor')
    // One of each dressing first, then fill toward the 4b forest-half density
    // (~12 props / 88 cells) without letting ferns consume every open cell.
    for (const spec of EMBERWOOD_PROPS) fillQuota(spec.assetId, spec.atlas, 1, forest, 1)
    const budget = Math.max(EMBERWOOD_PROPS.length, Math.round(forest.length * (12 / 88)))
    let extra = budget - EMBERWOOD_PROPS.length
    const weight = EMBERWOOD_PROPS.reduce((sum, spec) => sum + spec.per, 0)
    for (const spec of EMBERWOOD_PROPS) {
      const share = extra > 0 ? Math.round((extra * spec.per) / weight) : 0
      fillQuota(spec.assetId, spec.atlas, share, forest, spec.radius)
    }
  } else if (biome === 'ashen_wastes') {
    const ash = eligible((cell) => cell.tileset === 'ash_fill' || cell.tileset === 'ash_ground')
    // One of every dressing first (including each drift), then fill toward the
    // edge-sample density. Canopies are copied from trunks after the trees exist.
    const required = [
      ['tree_dead_base', 'wild_props'],
      ['stump_charred', 'wild_props'],
      ['rock_ash', 'wild_props_4b'],
      ...ASH_DRIFTS.map((id) => [id, 'wild_props']),
      ['cinder_patch', 'wild_props'],
      ['ember_fleck', 'wild_props'],
      ['ember_vent_burn_down_0', 'ember_vent'],
    ]
    for (const [assetId, atlas] of required) fillQuota(assetId, atlas, 1, ash, 1)
    const extraTrees = Math.max(0, quota(2, ash.length, 220) - 1)
    fillQuota('tree_dead_base', 'wild_props', extraTrees, ash, 2)
    const trunks = objects.filter((obj) => obj.assetId === 'tree_dead_base')
    for (const base of trunks) {
      const meta = propDef('wild_props', 'tree_dead_canopy')
      objects.push({
        ...base,
        assetId: 'tree_dead_canopy',
        frame: 'tree_dead_canopy',
        collide: false,
        layer: 'overhead',
        anchor: { x: meta.anchor.x, y: meta.anchor.y },
        footprint: {
          x: meta.footprint?.x || 0,
          y: meta.footprint?.y || 0,
          w: meta.footprint?.w || 0,
          h: meta.footprint?.h || 0,
          shape: meta.footprint?.shape || 'none',
        },
        w: meta.size?.w || base.w,
        h: meta.size?.h || base.h,
        anim: null,
      })
    }
    fillQuota('stump_charred', 'wild_props', Math.max(0, quota(2, ash.length, 220) - 1), ash, 2)
    fillQuota('rock_ash', 'wild_props_4b', Math.max(0, quota(3, ash.length, 220) - 1), ash, 1)
    const driftExtra = Math.max(0, quota(4, ash.length, 160) - ASH_DRIFTS.length)
    const driftBag = shuffle(ash, rng)
    let drifts = 0
    for (let i = 0; i < driftBag.length && drifts < driftExtra; i++) {
      const assetId = ASH_DRIFTS[drifts % ASH_DRIFTS.length]
      if (placeAt(assetId, 'wild_props', driftBag[i], 1)) drifts++
    }
    fillQuota('cinder_patch', 'wild_props', Math.max(0, quota(3, ash.length, 220) - 1), ash, 1)
    fillQuota('ember_fleck', 'wild_props', Math.max(0, quota(4, ash.length, 220) - 1), ash, 1)
    const ventExtra = Math.max(0, quota(2, ash.length, 300) - 1)
    const ventBag = shuffle(ash, rng)
    let vents = 0
    for (let i = 0; i < ventBag.length && vents < ventExtra; i++) {
      if (!placeAt('ember_vent_burn_down_0', 'ember_vent', ventBag[i], 2)) continue
      vents++
    }
    for (const obj of objects) {
      if (obj.assetId === 'ember_vent_burn_down_0') obj.anim = 'ember_vent_burn_down'
    }
  }

  return objects
}

/** @param {number} per @param {number} eligible @param {number} sample */
function quota(per, eligible, sample) {
  if (!eligible) return 0
  return Math.max(1, Math.round((per * eligible) / sample))
}

/** @param {{ layer?: string, depth?: string, tall?: boolean }} meta */
function layerOf(meta) {
  if (meta.layer === 'overhead' || meta.tall) return 'overhead'
  if (typeof meta.depth === 'string' && meta.depth.includes('decal')) return 'decal'
  return 'props'
}

/** @param {number} n */
function clamp01(n) {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/**
 * @param {number[]} list
 * @param {import('./rng.js').Rng} rng
 */
function shuffle(list, rng) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/**
 * @param {{ north: boolean, south: boolean, east: boolean, west: boolean }} exits
 * @param {TerrainLayout['exitBands']} bands
 * @param {TerrainLayout['objects']} objects
 */
function buildColliders(exits, bands, objects) {
  /** @type {Array<{ x:number, y:number, w:number, h:number }>} */
  const colliders = []
  const worldW = GRID_COLS * TILE_PX
  const worldH = GRID_ROWS * TILE_PX

  const horizontalWall = (y, band) => {
    if (!band) {
      colliders.push({ x: 0, y, w: 1, h: BORDER })
      return
    }
    if (band.start > 0) colliders.push({ x: 0, y, w: band.start, h: BORDER })
    if (band.end < 1) colliders.push({ x: band.end, y, w: 1 - band.end, h: BORDER })
  }
  const verticalWall = (x, band) => {
    if (!band) {
      colliders.push({ x, y: 0, w: BORDER, h: 1 })
      return
    }
    if (band.start > 0) colliders.push({ x, y: 0, w: BORDER, h: band.start })
    if (band.end < 1) colliders.push({ x, y: band.end, w: BORDER, h: 1 - band.end })
  }

  horizontalWall(-BORDER, exits.north ? bands.north : null)
  horizontalWall(1, exits.south ? bands.south : null)
  verticalWall(-BORDER, exits.west ? bands.west : null)
  verticalWall(1, exits.east ? bands.east : null)

  for (const o of objects) {
    if (!o.collide) continue
    const fp = o.footprint
    if (!fp || !(fp.w > 0) || !(fp.h > 0)) continue
    colliders.push({
      x: (o.nx * worldW + fp.x * o.scale) / worldW,
      y: (o.ny * worldH + fp.y * o.scale) / worldH,
      w: (fp.w * o.scale) / worldW,
      h: (fp.h * o.scale) / worldH,
    })
  }

  return colliders
}

/**
 * @param {TerrainLayout} layout
 * @returns {boolean}
 */
function isConnected(layout) {
  const { cols, rows, cells } = layout.tiles
  const blocked = new Uint8Array(cols * rows)
  for (const c of layout.colliders) {
    if (c.x < 0 || c.y < 0 || c.x + c.w > 1 || c.y + c.h > 1) continue
    const c0 = Math.max(0, Math.floor(c.x * cols))
    const c1 = Math.min(cols - 1, Math.floor((c.x + c.w) * cols))
    const r0 = Math.max(0, Math.floor(c.y * rows))
    const r1 = Math.min(rows - 1, Math.floor((c.y + c.h) * rows))
    for (let r = r0; r <= r1; r++) {
      for (let c2 = c0; c2 <= c1; c2++) blocked[r * cols + c2] = 1
    }
  }

  const start = cells.findIndex((cell, i) => cell.kind === 'path' && !blocked[i])
  if (start < 0) return !hasAnyExit(layout)

  const seen = new Uint8Array(cols * rows)
  const queue = [start]
  seen[start] = 1
  while (queue.length) {
    const i = queue.pop()
    const col = i % cols
    const row = (i - col) / cols
    const push = (c, r) => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return
      const j = r * cols + c
      if (seen[j] || blocked[j]) return
      seen[j] = 1
      queue.push(j)
    }
    push(col - 1, row)
    push(col + 1, row)
    push(col, row - 1)
    push(col, row + 1)
  }

  const bandReached = (band, size, fixedIndex, horizontal) => {
    if (!band) return true
    const first = Math.floor(band.start / size)
    const last = Math.min(Math.ceil(band.end / size) - 1, (horizontal ? cols : rows) - 1)
    for (let k = first; k <= last; k++) {
      const j = horizontal ? fixedIndex * cols + k : k * cols + fixedIndex
      if (seen[j]) return true
    }
    return false
  }

  if (layout.exits.north && !bandReached(layout.exitBands.north, 1 / cols, 0, true)) return false
  if (layout.exits.south && !bandReached(layout.exitBands.south, 1 / cols, rows - 1, true)) return false
  if (layout.exits.west && !bandReached(layout.exitBands.west, 1 / rows, 0, false)) return false
  if (layout.exits.east && !bandReached(layout.exitBands.east, 1 / rows, cols - 1, false)) return false
  return true
}

/** @param {TerrainLayout} layout */
function hasAnyExit(layout) {
  const e = layout.exits || {}
  return !!(e.north || e.south || e.east || e.west)
}

function nearPath(mask, cols, rows, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const cx = x + dx
      const cy = y + dy
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue
      if (mask[cy * cols + cx] === 1) return true
    }
  }
  return false
}

function carveCol(mask, cols, rows, x, y0, y1) {
  if (x < 0 || x >= cols) return
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    if (y >= 0 && y < rows) mask[y * cols + x] = 1
  }
}

function carveRow(mask, cols, rows, y, x0, x1) {
  if (y < 0 || y >= rows) return
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    if (x >= 0 && x < cols) mask[y * cols + x] = 1
  }
}
