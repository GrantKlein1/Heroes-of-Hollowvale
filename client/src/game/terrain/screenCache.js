/**
 * Layout provider for wilderness screens.
 *
 * Layouts are a pure function of the world seed and the node id. Revisiting
 * a screen rebuilds the same grid. The cache only avoids repeat work; evicting
 * it cannot reshuffle the forest.
 */

import { generateScreen } from './generate.js'
import { getNode, getNeighbors, WILDERNESS_ENTRANCE_ID } from './worldGraph.js'
import { WORLD_SEED } from '../world/metrics.js'

const cache = new Map()

function layoutFor(nodeId) {
  const node = getNode(nodeId)
  if (!node) throw new Error(`screenCache.getLayout: unknown node ${nodeId}`)
  const neighbors = getNeighbors(nodeId)
  const exits = {
    north: !!neighbors.north || nodeId === WILDERNESS_ENTRANCE_ID,
    south: !!neighbors.south,
    east: !!neighbors.east,
    west: !!neighbors.west,
  }
  return generateScreen({
    nodeId,
    seed: `${WORLD_SEED}:${nodeId}`,
    biome: node.biome,
    exits,
  })
}

/**
 * @param {string} nodeId
 * @returns {import('./generate.js').TerrainLayout}
 */
export function getLayout(nodeId) {
  const hit = cache.get(nodeId)
  if (hit) return hit
  const layout = layoutFor(nodeId)
  cache.set(nodeId, layout)
  return layout
}

/** Warm the deterministic layouts of the adjacent nodes. */
export function preloadNeighbors(nodeId) {
  const neighbors = getNeighbors(nodeId)
  const ids = [neighbors.north, neighbors.south, neighbors.east, neighbors.west]
  for (let i = 0; i < ids.length; i++) {
    if (ids[i]) getLayout(ids[i])
  }
}

/**
 * Drop cached layouts farther than `distance` hops from nodeId.
 * The next visit regenerates the same seed, so the screen does not reshuffle.
 */
export function evictBeyond(nodeId, distance = 2) {
  const dist = new Map([[nodeId, 0]])
  const q = [nodeId]
  let qi = 0
  while (qi < q.length) {
    const id = q[qi++]
    const d = dist.get(id)
    if (d >= distance) continue
    const neighbors = getNeighbors(id)
    const next = [neighbors.north, neighbors.south, neighbors.east, neighbors.west]
    for (let i = 0; i < next.length; i++) {
      const n = next[i]
      if (!n || dist.has(n)) continue
      dist.set(n, d + 1)
      q.push(n)
    }
  }
  for (const id of cache.keys()) {
    if (!dist.has(id)) cache.delete(id)
  }
}

/** Test helper. */
export function clearCache() {
  cache.clear()
}
