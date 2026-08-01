/**
 * Seeded terrain screen generator.
 *
 * Builds a tile grid: grass fill plus a walkable corridor network that routes
 * every active exit into one central hub, then scatters obstacles onto grass
 * cells that are far enough from the corridors to never pinch them. A flood
 * fill from the hub verifies every exit mouth is still reachable before the
 * layout is returned.
 *
 * @typedef {{
 *   kind: 'grass'|'path',
 *   assetId: string,
 *   rotation: number
 * }} TerrainTileCell
 *
 * @typedef {{ start: number, end: number }} ExitBand
 *
 * @typedef {{
 *   biome: string,
 *   groundTileId: string,
 *   objects: Array<{ assetId: string, nx: number, ny: number, scale: number, collide: boolean }>,
 *   colliders: Array<{ x: number, y: number, w: number, h: number }>,
 *   exits: { north?: boolean, south?: boolean, east?: boolean, west?: boolean },
 *   exitBands: { north?: ExitBand, south?: ExitBand, east?: ExitBand, west?: ExitBand },
 *   tiles: { cols: number, rows: number, cells: TerrainTileCell[] }
 * }} TerrainLayout
 */

import { getBiome } from './biomes.js'
import { createRng, hashSeed } from './rng.js'
import {
  getAsset,
  pickGrassVariantId,
  pathTileForConnections,
  DEFAULT_GROUND_ID,
  DEFAULT_PATH_ID,
} from '../../config/terrainAssets.js'

/**
 * Grid aspect matches the 1024x1536 wilderness frame so cells stay square.
 * 12x18 puts each tile at roughly 55px on a 1080p screen.
 */
export const GRID_COLS = 12
export const GRID_ROWS = 18

/** Border collider thickness, normalized. */
const BORDER = 0.02
/** Exit gap width in cells — wide enough for the player sprite to fit through. */
const GAP_CELLS = 3
/** Normalized floor on gap width so short grids still clear the player sprite. */
const MIN_GAP = 0.2
/** Chebyshev cell distance obstacles must keep from any corridor cell. */
const OBSTACLE_CLEARANCE = 2
/** Retries before falling back to an obstacle-free layout. */
const MAX_ATTEMPTS = 8

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

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(hashSeed(`${nodeId}:${seed ?? 0}:${biome}:${attempt}`))
    const layout = buildLayout(recipe, resolvedExits, rng, attempt > 0)
    if (isConnected(layout)) return layout
  }

  // Last resort: corridors only. Carving alone is connected by construction.
  const rng = createRng(hashSeed(`${nodeId}:${seed ?? 0}:${biome}:bare`))
  return buildLayout(recipe, resolvedExits, rng, true)
}

/**
 * @param {import('./biomes.js').BiomeRecipe} recipe
 * @param {{ north: boolean, south: boolean, east: boolean, west: boolean }} exits
 * @param {import('./rng.js').Rng} rng
 * @param {boolean} skipObstacles
 * @returns {TerrainLayout}
 */
function buildLayout(recipe, exits, rng, skipObstacles) {
  const cols = GRID_COLS
  const rows = GRID_ROWS
  /** @type {Uint8Array} 0 = grass, 1 = corridor */
  const mask = new Uint8Array(cols * rows)

  const margin = Math.ceil(GAP_CELLS / 2)
  const hubCol = rng.int(margin + 1, cols - margin - 2)
  const hubRow = rng.int(Math.floor(rows * 0.35), Math.floor(rows * 0.65))
  mask[hubRow * cols + hubCol] = 1

  /** @type {Record<string, number>} exit mouth position along the border, in cells */
  const mouths = {}

  if (exits.north) {
    mouths.north = rng.int(margin, cols - margin - 1)
    carveCol(mask, cols, rows, mouths.north, 0, hubRow)
    carveRow(mask, cols, rows, hubRow, mouths.north, hubCol)
  }
  if (exits.south) {
    mouths.south = rng.int(margin, cols - margin - 1)
    carveCol(mask, cols, rows, mouths.south, hubRow, rows - 1)
    carveRow(mask, cols, rows, hubRow, mouths.south, hubCol)
  }
  if (exits.west) {
    mouths.west = rng.int(margin, rows - margin - 1)
    carveRow(mask, cols, rows, mouths.west, 0, hubCol)
    carveCol(mask, cols, rows, hubCol, mouths.west, hubRow)
  }
  if (exits.east) {
    mouths.east = rng.int(margin, rows - margin - 1)
    carveRow(mask, cols, rows, mouths.east, hubCol, cols - 1)
    carveCol(mask, cols, rows, hubCol, mouths.east, hubRow)
  }

  const grassVariants = recipe.grassVariants?.length
    ? recipe.grassVariants
    : [recipe.groundTileId || DEFAULT_GROUND_ID]

  /** @type {TerrainTileCell[]} */
  const cells = new Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      if (mask[i]) {
        const conn = {
          top: isPath(mask, cols, rows, col, row - 1) || (row === 0 && exits.north),
          bottom: isPath(mask, cols, rows, col, row + 1) || (row === rows - 1 && exits.south),
          left: isPath(mask, cols, rows, col - 1, row) || (col === 0 && exits.west),
          right: isPath(mask, cols, rows, col + 1, row) || (col === cols - 1 && exits.east),
        }
        const pick = pathTileForConnections(conn)
        cells[i] = {
          kind: 'path',
          assetId: pick?.id || recipe.pathTileId || DEFAULT_PATH_ID,
          rotation: pick?.rotation || 0,
        }
      } else {
        cells[i] = {
          kind: 'grass',
          assetId: pickGrassVariantId(grassVariants, rng.next()),
          rotation: 0,
        }
      }
    }
  }

  const cellW = 1 / cols
  const cellH = 1 / rows
  /** @type {TerrainLayout['exitBands']} */
  const exitBands = {}
  const bandFor = (mouth, size) => {
    const width = Math.max(GAP_CELLS * size, MIN_GAP)
    const center = (mouth + 0.5) * size
    const start = Math.max(0, Math.min(1 - width, center - width / 2))
    return { start, end: start + width }
  }
  if (exits.north) exitBands.north = bandFor(mouths.north, cellW)
  if (exits.south) exitBands.south = bandFor(mouths.south, cellW)
  if (exits.west) exitBands.west = bandFor(mouths.west, cellH)
  if (exits.east) exitBands.east = bandFor(mouths.east, cellH)

  const objects = skipObstacles
    ? []
    : scatterObstacles(recipe, mask, cols, rows, rng)

  return {
    biome: recipe.id,
    groundTileId: recipe.groundTileId || DEFAULT_GROUND_ID,
    objects,
    colliders: buildColliders(exits, exitBands, objects),
    exits,
    exitBands,
    tiles: { cols, rows, cells },
  }
}

/**
 * Seeded scatter onto grass cells that keep clear of every corridor.
 * @param {import('./biomes.js').BiomeRecipe} recipe
 * @param {Uint8Array} mask
 * @param {number} cols
 * @param {number} rows
 * @param {import('./rng.js').Rng} rng
 */
function scatterObstacles(recipe, mask, cols, rows, rng) {
  const allowed = (recipe.allowedObjectIds || [])
    .map((id) => getAsset(id))
    .filter(Boolean)
  if (!allowed.length) return []

  const density = Math.max(0, Math.min(1, recipe.objectDensity ?? 0.2))
  const objects = []
  const cellW = 1 / cols
  const cellH = 1 / rows

  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      if (mask[row * cols + col]) continue
      if (nearPath(mask, cols, rows, col, row, OBSTACLE_CLEARANCE)) continue
      if (rng.next() > density) continue

      const asset = rng.weighted(allowed)
      objects.push({
        assetId: asset.id,
        nx: (col + 0.5) * cellW,
        ny: (row + 1) * cellH,
        scale: 0.85 + rng.next() * 0.3,
        collide: !!asset.collide,
      })
    }
  }
  return objects
}

/**
 * Border walls with a gap at every open exit, plus object footprints.
 * @param {{ north: boolean, south: boolean, east: boolean, west: boolean }} exits
 * @param {TerrainLayout['exitBands']} bands
 * @param {TerrainLayout['objects']} objects
 */
function buildColliders(exits, bands, objects) {
  /** @type {Array<{ x:number, y:number, w:number, h:number }>} */
  const colliders = []

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
    const asset = getAsset(o.assetId)
    if (!asset) continue
    const nw = (asset.w / 1024) * o.scale
    const nh = (asset.h / 1536) * o.scale
    const fp = asset.footprint || { x: 0, y: 0.6, w: 1, h: 0.4 }
    colliders.push({
      x: o.nx - nw / 2 + fp.x * nw,
      y: o.ny - nh + fp.y * nh,
      w: fp.w * nw,
      h: fp.h * nh,
    })
  }

  return colliders
}

/**
 * Flood fill the walkable cells and confirm every open exit mouth is reachable.
 * @param {TerrainLayout} layout
 * @returns {boolean}
 */
function isConnected(layout) {
  const { cols, rows, cells } = layout.tiles
  const blocked = new Uint8Array(cols * rows)
  for (const c of layout.colliders) {
    // Border walls sit outside [0,1]; only object footprints block cells.
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

function isPath(mask, cols, rows, x, y) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false
  return mask[y * cols + x] === 1
}

function nearPath(mask, cols, rows, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (isPath(mask, cols, rows, x + dx, y + dy)) return true
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
