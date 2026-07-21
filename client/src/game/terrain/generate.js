/**
 * Seeded terrain screen generator — Phase 0 stub.
 *
 * Track B owns the real implementation:
 *  1. Choose ground tile from biome
 *  2. Carve walkable corridors from every active exit → central hub
 *  3. Seeded jittered-grid object scatter with footprint rejection
 *  4. Emit objects + nrect colliders + exits (+ 4 border walls)
 *
 * Stub returns a clone of the fixture layout so Tracks C/D can integrate
 * without waiting on Track B. Same (nodeId, seed) is still deterministic.
 *
 * @typedef {{
 *   biome: string,
 *   groundTileId: string,
 *   objects: Array<{ assetId: string, nx: number, ny: number, scale: number, collide: boolean }>,
 *   colliders: Array<{ x: number, y: number, w: number, h: number }>,
 *   exits: { north?: boolean, south?: boolean, east?: boolean, west?: boolean }
 * }} TerrainLayout
 */

import fixtureLayout from './__fixtures__/fixtureLayout.js'
import { getBiome } from './biomes.js'
import { hashSeed } from './rng.js'

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

  // Deterministic stub: clone fixture, stamp biome/exits, nudge by seed hash
  // so different seeds are distinguishable until Track B lands for real.
  const h = hashSeed(`${nodeId}:${seed ?? 0}:${biome}`)
  const nudge = ((h % 1000) / 1000) * 0.02 // tiny, keeps corridors intact

  /** @type {TerrainLayout} */
  const layout = {
    biome: recipe.id,
    groundTileId: recipe.groundTileId,
    objects: fixtureLayout.objects.map((o) => ({
      ...o,
      nx: clamp01(o.nx + nudge),
      ny: clamp01(o.ny + nudge * 0.5),
    })),
    colliders: [
      // World borders (match existing scene convention)
      { x: 0, y: -0.02, w: 1, h: 0.02 },
      { x: 0, y: 1, w: 1, h: 0.02 },
      { x: -0.02, y: 0, w: 0.02, h: 1 },
      { x: 1, y: 0, w: 0.02, h: 1 },
      ...fixtureLayout.colliders.map((c) => ({ ...c })),
    ],
    exits: resolvedExits,
  }

  return layout
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}
