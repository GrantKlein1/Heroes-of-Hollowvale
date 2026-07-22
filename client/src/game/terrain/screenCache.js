/**
 * Layout cache + neighbor preload — Phase 0 stub.
 *
 * Track C owns the real regeneration policy:
 *  - memoize layouts by node id
 *  - preloadNeighbors via requestIdleCallback (or setTimeout fallback)
 *  - evictBeyond drops nodes farther than `distance` (default 2) so returning
 *    regenerates with a fresh seed while adjacent moves stay instant
 */

import { generateScreen } from './generate.js'
import { getNode, getNeighbors, WILDERNESS_ENTRANCE_ID } from './worldGraph.js'

/** @type {Map<string, import('./generate.js').TerrainLayout>} */
const cache = new Map()

/** @type {Map<string, number>} seeds used so eviction → new seed on regenerate */
const seeds = new Map()

function seedFor(nodeId) {
  if (!seeds.has(nodeId)) {
    // Stub: time-based seed so eviction produces a different layout later.
    // Track C may switch to a counter or crypto-ish source.
    seeds.set(nodeId, (Date.now() ^ hashStr(nodeId)) >>> 0)
  }
  return seeds.get(nodeId)
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h >>> 0
}

/**
 * @param {string} nodeId
 * @returns {import('./generate.js').TerrainLayout}
 */
export function getLayout(nodeId) {
  if (cache.has(nodeId)) return cache.get(nodeId)

  const node = getNode(nodeId)
  if (!node) throw new Error(`screenCache.getLayout: unknown node ${nodeId}`)

  const neighbors = getNeighbors(nodeId)
  const exits = {
    // Entrance north returns to the village hub (not a graph neighbor)
    north: !!neighbors.north || nodeId === WILDERNESS_ENTRANCE_ID,
    south: !!neighbors.south,
    east: !!neighbors.east,
    west: !!neighbors.west,
  }

  const layout = generateScreen({
    nodeId,
    seed: seedFor(nodeId),
    biome: node.biome,
    exits,
  })
  cache.set(nodeId, layout)
  return layout
}

/**
 * Build layouts for immediate neighbors during idle time.
 * @param {string} nodeId
 */
export function preloadNeighbors(nodeId) {
  const neighbors = getNeighbors(nodeId)
  const ids = Object.values(neighbors).filter(Boolean)

  const run = () => {
    for (const id of ids) {
      if (!cache.has(id)) {
        try {
          getLayout(id)
        } catch (e) {
          console.warn('[screenCache] preload failed for', id, e)
        }
      }
    }
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 500 })
  } else {
    setTimeout(run, 0)
  }
}

/**
 * Drop cached layouts for nodes farther than `distance` graph steps from nodeId.
 * Also clears their seeds so the next getLayout regenerates differently.
 * @param {string} nodeId
 * @param {number} [distance=2]
 */
export function evictBeyond(nodeId, distance = 2) {
  const keep = new Set(bfsWithin(nodeId, distance))
  for (const id of [...cache.keys()]) {
    if (!keep.has(id)) {
      cache.delete(id)
      seeds.delete(id)
    }
  }
}

/** @param {string} start @param {number} maxDist @returns {string[]} */
function bfsWithin(start, maxDist) {
  const seen = new Map([[start, 0]])
  const q = [start]
  while (q.length) {
    const cur = q.shift()
    const d = seen.get(cur)
    if (d >= maxDist) continue
    const n = getNeighbors(cur)
    for (const id of Object.values(n)) {
      if (id && !seen.has(id)) {
        seen.set(id, d + 1)
        q.push(id)
      }
    }
  }
  return [...seen.keys()]
}

/** Test helper */
export function clearCache() {
  cache.clear()
  seeds.clear()
}
