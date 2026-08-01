/**
 * Layout provider for wilderness screens.
 *
 * Screens are regenerated on every visit by design — the player should never
 * walk back into the exact same clearing. Callers hold the returned layout for
 * as long as they stay on that screen; nothing is memoized here.
 */

import { generateScreen } from './generate.js'
import { getNode, getNeighbors, WILDERNESS_ENTRANCE_ID } from './worldGraph.js'

let visitCounter = 0

/**
 * @param {string} nodeId
 * @returns {import('./generate.js').TerrainLayout}
 */
export function getLayout(nodeId) {
  const node = getNode(nodeId)
  if (!node) throw new Error(`screenCache.getLayout: unknown node ${nodeId}`)

  const neighbors = getNeighbors(nodeId)
  const exits = {
    // Entrance north is the hub return, so it is open without a graph neighbor.
    north: !!neighbors.north || nodeId === WILDERNESS_ENTRANCE_ID,
    south: !!neighbors.south,
    east: !!neighbors.east,
    west: !!neighbors.west,
  }

  visitCounter += 1
  return generateScreen({
    nodeId,
    seed: `${visitCounter}:${Math.floor(Math.random() * 0xffffffff)}`,
    biome: node.biome,
    exits,
  })
}

/** No-op: layouts are generated on demand, so there is nothing to warm. */
export function preloadNeighbors() {}

/** No-op: nothing is retained between visits. */
export function evictBeyond() {}

/** Test helper — resets the visit counter used for seeding. */
export function clearCache() {
  visitCounter = 0
}
