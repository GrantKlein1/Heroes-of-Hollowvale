/**
 * Layout cache + neighbor preload — Track C.
 *
 * Policy:
 *  - getLayout memoizes TerrainLayout by node id (same seed → identical layout
 *    via generateScreen)
 *  - preloadNeighbors builds adjacent layouts during idle time
 *  - evictBeyond(distance=2) drops layouts farther than `distance` graph steps
 *    and clears their seeds so a later return regenerates with a fresh seed
 *  - keep current + nearby screens hot so adjacent moves stay instant
 *
 * Depends only on generateScreen({ nodeId, seed, biome, exits }) and the
 * worldGraph neighbor table — safe against fixture or real Track B generators.
 */

import { generateScreen } from './generate.js'
import { getNode, getNeighbors } from './worldGraph.js'

/** @type {Map<string, import('./generate.js').TerrainLayout>} */
const cache = new Map()

/**
 * Per-node seeds. Cleared on eviction so the next getLayout allocates a new
 * generation and regenerateScreen produces a different (still deterministic)
 * layout for that (nodeId, seed) pair.
 * @type {Map<string, number>}
 */
const seeds = new Map()

/** Monotonic counter mixed into new seeds after eviction / first visit. */
let generation = 1

/** Pending idle / timeout handle so clearCache can cancel in-flight preload. */
let pendingIdle = null
/** @type {'ric'|'timeout'|null} */
let pendingKind = null

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h >>> 0
}

/**
 * Stable-ish uint32 seed for a node. First visit and post-eviction visits
 * advance `generation` so returning players see a fresh screen.
 * @param {string} nodeId
 * @returns {number}
 */
function seedFor(nodeId) {
  if (!seeds.has(nodeId)) {
    const seed = (hashStr(nodeId) ^ (generation * 0x9e3779b9)) >>> 0
    seeds.set(nodeId, seed)
    generation += 1
  }
  return seeds.get(nodeId)
}

/**
 * Boolean exit mask for generateScreen from open neighbor edges.
 * @param {string} nodeId
 */
function exitsFor(nodeId) {
  const neighbors = getNeighbors(nodeId)
  return {
    north: !!neighbors.north,
    south: !!neighbors.south,
    east: !!neighbors.east,
    west: !!neighbors.west,
  }
}

/**
 * @param {string} nodeId
 * @returns {import('./generate.js').TerrainLayout}
 */
export function getLayout(nodeId) {
  if (cache.has(nodeId)) return cache.get(nodeId)

  const node = getNode(nodeId)
  if (!node) throw new Error(`screenCache.getLayout: unknown node ${nodeId}`)

  const layout = generateScreen({
    nodeId,
    seed: seedFor(nodeId),
    biome: node.biome,
    exits: exitsFor(nodeId),
  })
  cache.set(nodeId, layout)
  return layout
}

function cancelPendingPreload() {
  if (pendingIdle == null) return
  if (pendingKind === 'ric' && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(pendingIdle)
  } else if (pendingKind === 'timeout') {
    clearTimeout(pendingIdle)
  }
  pendingIdle = null
  pendingKind = null
}

/**
 * Build layouts for immediate neighbors during idle time.
 * Only schedules one batch at a time; a newer call cancels the previous.
 * @param {string} nodeId
 */
export function preloadNeighbors(nodeId) {
  const neighbors = getNeighbors(nodeId)
  const ids = Object.values(neighbors).filter(Boolean)

  cancelPendingPreload()

  const run = () => {
    pendingIdle = null
    pendingKind = null
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
    pendingKind = 'ric'
    pendingIdle = requestIdleCallback(run, { timeout: 500 })
  } else {
    pendingKind = 'timeout'
    pendingIdle = setTimeout(run, 0)
  }
}

/**
 * Drop cached layouts for nodes farther than `distance` graph steps from nodeId.
 * Also clears their seeds so the next getLayout regenerates differently.
 * Default distance 2 keeps current + adjacent (+ one more hop) warm.
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

/**
 * BFS over the world graph; returns node ids within maxDist steps of start
 * (inclusive of start at distance 0).
 * @param {string} start
 * @param {number} maxDist
 * @returns {string[]}
 */
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

/** Test helper — wipe layouts, seeds, and any pending preload. */
export function clearCache() {
  cancelPendingPreload()
  cache.clear()
  seeds.clear()
}
