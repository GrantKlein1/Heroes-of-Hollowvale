/**
 * Seeded terrain screen generator.
 *
 * 1. Choose ground tile from biome
 * 2. Carve walkable corridors from every active exit → central hub
 * 3. Seeded jittered-grid object scatter with footprint rejection
 * 4. Emit objects + nrect colliders + exits (+ 4 border walls)
 *
 * Develops against __fixtures__/fixtureManifest.js only (not terrainAssets.js).
 *
 * @typedef {{
 *   biome: string,
 *   groundTileId: string,
 *   objects: Array<{ assetId: string, nx: number, ny: number, scale: number, collide: boolean }>,
 *   colliders: Array<{ x: number, y: number, w: number, h: number }>,
 *   exits: { north?: boolean, south?: boolean, east?: boolean, west?: boolean }
 * }} TerrainLayout
 */

import { FIXTURE_MANIFEST } from './__fixtures__/fixtureManifest.js'
import { getBiome } from './biomes.js'
import { createRng, hashSeed } from './rng.js'

const HUB = { x: 0.5, y: 0.5 }
const HUB_RADIUS = 0.1
/** Half-width of exit→hub corridors in normalized space. */
const CORRIDOR_HALF = 0.09
/** Border inset for playable scatter / walkability. */
const MARGIN = 0.06

/** ~12 ground tiles across the frame; maps asset px → nrect size. */
const TILE_PX = 64
const WORLD_TILES_X = 12

const EXIT_POS = {
  north: { x: 0.5, y: 0 },
  south: { x: 0.5, y: 1 },
  east: { x: 1, y: 0.5 },
  west: { x: 0, y: 0.5 },
}

/**
 * @param {string} id
 * @returns {import('../../../config/terrainAssets.js').TerrainAsset | undefined}
 */
function getFixtureAsset(id) {
  return FIXTURE_MANIFEST.find((a) => a.id === id)
}

/**
 * Axis-aligned rect overlap (optional padding expands both).
 * @param {{ x:number,y:number,w:number,h:number }} a
 * @param {{ x:number,y:number,w:number,h:number }} b
 * @param {number} [pad]
 */
function rectsOverlap(a, b, pad = 0) {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  )
}

/**
 * Distance from point to axis-aligned segment (axis-aligned L via hub).
 * Corridor is the Minkowski sum of the polyline with a disk of radius CORRIDOR_HALF.
 * @param {number} px
 * @param {number} py
 * @param {{ north?:boolean, south?:boolean, east?:boolean, west?:boolean }} exits
 */
function distToCorridors(px, py, exits) {
  let best = Infinity
  // Hub disk
  const dh = Math.hypot(px - HUB.x, py - HUB.y)
  best = Math.min(best, Math.max(0, dh - HUB_RADIUS))

  for (const edge of /** @type {const} */ (['north', 'south', 'east', 'west'])) {
    if (!exits[edge]) continue
    const ep = EXIT_POS[edge]
    // Straight stub: exit → hub along the dominant axis, then into hub.
    // Vertical exits: corridor along x≈0.5 from ep.y → hub.y
    // Horizontal exits: corridor along y≈0.5 from ep.x → hub.x
    if (edge === 'north' || edge === 'south') {
      const x0 = HUB.x - CORRIDOR_HALF
      const x1 = HUB.x + CORRIDOR_HALF
      const y0 = Math.min(ep.y, HUB.y)
      const y1 = Math.max(ep.y, HUB.y)
      const cx = Math.max(x0, Math.min(x1, px))
      const cy = Math.max(y0, Math.min(y1, py))
      // Inside the strip → distance 0; else distance to strip rect
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
        best = 0
      } else {
        best = Math.min(best, Math.hypot(px - cx, py - cy))
      }
    } else {
      const y0 = HUB.y - CORRIDOR_HALF
      const y1 = HUB.y + CORRIDOR_HALF
      const x0 = Math.min(ep.x, HUB.x)
      const x1 = Math.max(ep.x, HUB.x)
      const cx = Math.max(x0, Math.min(x1, px))
      const cy = Math.max(y0, Math.min(y1, py))
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) {
        best = 0
      } else {
        best = Math.min(best, Math.hypot(px - cx, py - cy))
      }
    }
  }
  return best
}

/**
 * @param {number} px
 * @param {number} py
 * @param {{ north?:boolean, south?:boolean, east?:boolean, west?:boolean }} exits
 */
function inCorridor(px, py, exits) {
  return distToCorridors(px, py, exits) <= 0
}

/**
 * World-space nrect for an asset footprint at bottom/center anchor (nx, ny).
 * @param {import('../../../config/terrainAssets.js').TerrainAsset} asset
 * @param {number} nx
 * @param {number} ny
 * @param {number} scale
 */
export function footprintToNrect(asset, nx, ny, scale) {
  const spriteW = (asset.w / TILE_PX / WORLD_TILES_X) * scale
  const spriteH = (asset.h / TILE_PX / WORLD_TILES_X) * scale
  let left
  let top
  if (asset.anchor === 'bottom') {
    left = nx - spriteW / 2
    top = ny - spriteH
  } else {
    left = nx - spriteW / 2
    top = ny - spriteH / 2
  }
  const fp = asset.footprint
  return {
    x: left + fp.x * spriteW,
    y: top + fp.y * spriteH,
    w: fp.w * spriteW,
    h: fp.h * spriteH,
  }
}

/**
 * True if any sample of the rect lies inside a corridor (blocks path).
 * @param {{ x:number,y:number,w:number,h:number }} rect
 * @param {{ north?:boolean, south?:boolean, east?:boolean, west?:boolean }} exits
 */
function rectBlocksCorridor(rect, exits) {
  const samples = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
    [rect.x + rect.w / 2, rect.y + rect.h / 2],
  ]
  return samples.some(([x, y]) => inCorridor(x, y, exits))
}

/**
 * @param {import('./rng.js').Rng} rng
 * @param {import('./biomes.js').BiomeRecipe} recipe
 * @param {{ north?:boolean, south?:boolean, east?:boolean, west?:boolean }} exits
 */
function scatterObjects(rng, recipe, exits) {
  /** @type {TerrainLayout['objects']} */
  const objects = []
  /** @type {TerrainLayout['colliders']} */
  const colliders = []

  const pool = recipe.allowedObjectIds
    .map((id) => getFixtureAsset(id))
    .filter((a) => a && a.category === 'object')

  if (!pool.length) return { objects, colliders }

  // Jittered grid: denser biomes → finer cells → more placement attempts.
  const cell = 0.1 + (1 - Math.min(1, Math.max(0, recipe.objectDensity))) * 0.08
  const cols = Math.max(4, Math.floor((1 - 2 * MARGIN) / cell))
  const rows = Math.max(4, Math.floor((1 - 2 * MARGIN) / cell))
  const cellW = (1 - 2 * MARGIN) / cols
  const cellH = (1 - 2 * MARGIN) / rows

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (rng.next() > recipe.objectDensity) continue

      const jx = (rng.next() - 0.5) * cellW * 0.7
      const jy = (rng.next() - 0.5) * cellH * 0.7
      const nx = MARGIN + (col + 0.5) * cellW + jx
      const ny = MARGIN + (row + 0.5) * cellH + jy

      if (inCorridor(nx, ny, exits)) continue

      const asset = rng.weighted(pool)
      const scale = 0.85 + rng.next() * 0.35
      const nrect = footprintToNrect(asset, nx, ny, scale)

      // Keep footprints inside the playable frame
      if (
        nrect.x < MARGIN * 0.5 ||
        nrect.y < MARGIN * 0.5 ||
        nrect.x + nrect.w > 1 - MARGIN * 0.5 ||
        nrect.y + nrect.h > 1 - MARGIN * 0.5
      ) {
        continue
      }

      if (asset.collide && rectBlocksCorridor(nrect, exits)) continue

      if (asset.collide) {
        const hit = colliders.some((c) => rectsOverlap(c, nrect, 0.01))
        if (hit) continue
      }

      objects.push({
        assetId: asset.id,
        nx,
        ny,
        scale: Math.round(scale * 100) / 100,
        collide: !!asset.collide,
      })
      if (asset.collide) {
        colliders.push(nrect)
      }
    }
  }

  return { objects, colliders }
}

/**
 * Thin border walls just outside [0,1] so exits on the edge stay walkable.
 * @returns {Array<{ x:number, y:number, w:number, h:number }>}
 */
function borderColliders() {
  return [
    { x: 0, y: -0.02, w: 1, h: 0.02 },
    { x: 0, y: 1, w: 1, h: 0.02 },
    { x: -0.02, y: 0, w: 0.02, h: 1 },
    { x: 1, y: 0, w: 0.02, h: 1 },
  ]
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

  const rng = createRng(hashSeed(`${nodeId}:${seed ?? 0}`))
  const { objects, colliders } = scatterObjects(rng, recipe, resolvedExits)

  return {
    biome: recipe.id,
    groundTileId: recipe.groundTileId,
    objects,
    colliders: [...borderColliders(), ...colliders],
    exits: resolvedExits,
  }
}
