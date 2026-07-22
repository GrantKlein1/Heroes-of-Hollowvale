/**
 * Smoke-check that Phase 0 stubs satisfy the frozen contracts.
 * Run: node client/src/game/terrain/contracts.smoke.mjs
 *
 * Does NOT call Groq or ElevenLabs.
 */
import { TERRAIN_ASSETS, getAsset, assetsForBiome } from '../../config/terrainAssets.js'
import { createRng, hashSeed } from './rng.js'
import { BIOMES, getBiome } from './biomes.js'
import { generateScreen } from './generate.js'
import {
  WORLD_NODES,
  WILDERNESS_ENTRANCE_ID,
  getNode,
  getNeighbors,
  oppositeEdge,
} from './worldGraph.js'
import { getLayout, preloadNeighbors, evictBeyond, clearCache } from './screenCache.js'
import { drawWilderness, wildernessCollidersPx } from './render.js'
import { FIXTURE_MANIFEST } from './__fixtures__/fixtureManifest.js'
import fixtureLayout from './__fixtures__/fixtureLayout.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    failed++
  } else {
    console.log('ok:', msg)
  }
}

assert(Array.isArray(TERRAIN_ASSETS) && TERRAIN_ASSETS.length >= 4, 'TERRAIN_ASSETS populated')
assert(getAsset('grass_version1')?.category === 'ground', 'getAsset(grass_version1)')
assert(getAsset('path_top_bottom')?.tileType === 'path', 'getAsset(path_top_bottom)')
assert(assetsForBiome('emberwood_forest').length > 0, 'assetsForBiome(emberwood_forest)')
assert(FIXTURE_MANIFEST.every((a) => a.id && a.w && a.h), 'fixture manifest shape')

const rng = createRng(42)
assert(typeof rng.next() === 'number' && rng.next() >= 0 && rng.next() < 1, 'rng.next in [0,1)')
assert(hashSeed('a') !== hashSeed('b'), 'hashSeed differs by input')

assert(getBiome('plains').groundTileId, 'getBiome(plains)')
assert(Object.keys(BIOMES).includes('emberwood_forest'), 'biome emberwood_forest')

const layoutA = generateScreen({
  nodeId: 'wild_0_0',
  seed: 1,
  biome: 'plains',
  exits: { north: false, south: true, east: true, west: false },
})
const layoutB = generateScreen({
  nodeId: 'wild_0_0',
  seed: 1,
  biome: 'plains',
  exits: { north: false, south: true, east: true, west: false },
})
assert(layoutA.groundTileId === layoutB.groundTileId, 'generateScreen deterministic ground')
assert(JSON.stringify(layoutA.objects) === JSON.stringify(layoutB.objects), 'generateScreen deterministic objects')
assert(Array.isArray(layoutA.colliders) && layoutA.colliders.length >= 4, 'generateScreen has border colliders')
assert(fixtureLayout.objects.length > 0, 'fixtureLayout has objects')

assert(getNode(WILDERNESS_ENTRANCE_ID)?.id === WILDERNESS_ENTRANCE_ID, 'entrance node exists')
assert(WORLD_NODES.length >= 4, 'WORLD_NODES populated')
assert(oppositeEdge('north') === 'south', 'oppositeEdge')
assert(getNeighbors(WILDERNESS_ENTRANCE_ID).south === 'wild_0_1', 'entrance south neighbor')

clearCache()
const L1 = getLayout(WILDERNESS_ENTRANCE_ID)
const L2 = getLayout(WILDERNESS_ENTRANCE_ID)
assert(L1 === L2, 'getLayout memoizes')
preloadNeighbors(WILDERNESS_ENTRANCE_ID)
evictBeyond(WILDERNESS_ENTRANCE_ID, 0)
assert(true, 'preloadNeighbors + evictBeyond callable')

assert(typeof drawWilderness === 'function', 'drawWilderness export')
assert(typeof wildernessCollidersPx === 'function', 'wildernessCollidersPx export')
const px = wildernessCollidersPx(layoutA, { dx: 0, dy: 0, dw: 1000, dh: 1500 })
assert(px.length === layoutA.colliders.length, 'wildernessCollidersPx length')
assert(Math.abs(px[0].w - layoutA.colliders[0].w * 1000) < 0.01, 'wildernessCollidersPx scales w')

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll Phase 0 contract smoke checks passed.')
