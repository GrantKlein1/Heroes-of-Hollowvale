/**
 * Barrel export for terrain modules.
 * Prefer importing from the specific file; this is for convenience / discovery.
 */
export { createRng, hashSeed } from './rng.js'
export { BIOMES, getBiome } from './biomes.js'
export { generateScreen } from './generate.js'
export {
  WORLD_NODES,
  WILDERNESS_ENTRANCE_ID,
  getNode,
  getNeighbors,
  oppositeEdge,
} from './worldGraph.js'
export { getLayout, preloadNeighbors, evictBeyond, clearCache } from './screenCache.js'
export { drawWilderness, wildernessCollidersPx } from './render.js'
