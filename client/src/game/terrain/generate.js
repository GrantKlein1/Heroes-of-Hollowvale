/**
 * Seeded terrain screen generator.
 *
 * Builds a coarse tile grid: grass fill + walkable path corridors from every
 * active exit into a central hub. Path cells resolve to a concrete asset id
 * + rotation from neighbor connections.
 *
 * @typedef {{
 *   kind: 'grass'|'path',
 *   assetId: string,
 *   rotation: number
 * }} TerrainTileCell
 *
 * @typedef {{
 *   biome: string,
 *   groundTileId: string,
 *   objects: Array<{ assetId: string, nx: number, ny: number, scale: number, collide: boolean }>,
 *   colliders: Array<{ x: number, y: number, w: number, h: number }>,
 *   exits: { north?: boolean, south?: boolean, east?: boolean, west?: boolean },
 *   tiles?: { cols: number, rows: number, cells: TerrainTileCell[] }
 * }} TerrainLayout
 */

import { getBiome } from './biomes.js'
import { createRng, hashSeed } from './rng.js'
import {
  pickGrassVariantId,
  pathTileForConnections,
  DEFAULT_GROUND_ID,
  DEFAULT_PATH_ID,
} from '../../config/terrainAssets.js'

/** Coarse grid — high-res 1024px art reads well around ~80px on a 1920×1080 frame. */
export const GRID_COLS = 24
export const GRID_ROWS = 14

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

  const rng = createRng(hashSeed(`${nodeId}:${seed ?? 0}:${biome}`))
  const cols = GRID_COLS
  const rows = GRID_ROWS
  /** @type {number[]} 0 = grass, 1 = path */
  const mask = new Array(cols * rows).fill(0)

  const cx = Math.floor(cols / 2)
  const cy = Math.floor(rows / 2)

  // Hub cell at center — corridors meet here
  setPath(mask, cols, rows, cx, cy)

  if (resolvedExits.north) carveVertical(mask, cols, rows, cx, 0, cy)
  if (resolvedExits.south) carveVertical(mask, cols, rows, cx, cy, rows - 1)
  if (resolvedExits.west) carveHorizontal(mask, cols, rows, cy, 0, cx)
  if (resolvedExits.east) carveHorizontal(mask, cols, rows, cy, cx, cols - 1)

  // Keep corridors 1 cell wide — path PNGs already include grass margins

  const grassVariants = recipe.grassVariants || [recipe.groundTileId || DEFAULT_GROUND_ID]
  /** @type {import('./generate.js').TerrainTileCell[]} */
  const cells = new Array(cols * rows)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      if (mask[i] === 1) {
        const conn = {
          top: isPath(mask, cols, rows, col, row - 1) || (row === 0 && resolvedExits.north),
          bottom: isPath(mask, cols, rows, col, row + 1) || (row === rows - 1 && resolvedExits.south),
          left: isPath(mask, cols, rows, col - 1, row) || (col === 0 && resolvedExits.west),
          right: isPath(mask, cols, rows, col + 1, row) || (col === cols - 1 && resolvedExits.east),
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

  // Soft border walls with exit gaps (normalized rects)
  const border = 0.02
  const gap = 0.22
  const gapStart = (1 - gap) / 2
  /** @type {Array<{ x: number, y: number, w: number, h: number }>} */
  const colliders = []

  if (resolvedExits.north) {
    colliders.push({ x: 0, y: -border, w: gapStart, h: border })
    colliders.push({ x: gapStart + gap, y: -border, w: gapStart, h: border })
  } else {
    colliders.push({ x: 0, y: -border, w: 1, h: border })
  }
  if (resolvedExits.south) {
    colliders.push({ x: 0, y: 1, w: gapStart, h: border })
    colliders.push({ x: gapStart + gap, y: 1, w: gapStart, h: border })
  } else {
    colliders.push({ x: 0, y: 1, w: 1, h: border })
  }
  if (resolvedExits.west) {
    colliders.push({ x: -border, y: 0, w: border, h: gapStart })
    colliders.push({ x: -border, y: gapStart + gap, w: border, h: gapStart })
  } else {
    colliders.push({ x: -border, y: 0, w: border, h: 1 })
  }
  if (resolvedExits.east) {
    colliders.push({ x: 1, y: 0, w: border, h: gapStart })
    colliders.push({ x: 1, y: gapStart + gap, w: border, h: gapStart })
  } else {
    colliders.push({ x: 1, y: 0, w: border, h: 1 })
  }

  return {
    biome: recipe.id,
    groundTileId: recipe.groundTileId || DEFAULT_GROUND_ID,
    objects: [],
    colliders,
    exits: resolvedExits,
    tiles: { cols, rows, cells },
  }
}

/** @param {number[]} mask @param {number} cols @param {number} rows @param {number} x @param {number} y */
function isPath(mask, cols, rows, x, y) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false
  return mask[y * cols + x] === 1
}

/** @param {number[]} mask @param {number} cols @param {number} rows @param {number} x @param {number} y */
function setPath(mask, cols, rows, x, y) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return
  mask[y * cols + x] = 1
}

/** @param {number[]} mask @param {number} cols @param {number} rows @param {number} x @param {number} y0 @param {number} y1 */
function carveVertical(mask, cols, rows, x, y0, y1) {
  const lo = Math.min(y0, y1)
  const hi = Math.max(y0, y1)
  for (let y = lo; y <= hi; y++) setPath(mask, cols, rows, x, y)
}

/** @param {number[]} mask @param {number} cols @param {number} rows @param {number} y @param {number} x0 @param {number} x1 */
function carveHorizontal(mask, cols, rows, y, x0, x1) {
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  for (let x = lo; x <= hi; x++) setPath(mask, cols, rows, x, y)
}
