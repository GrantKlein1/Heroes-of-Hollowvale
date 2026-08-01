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
import {
  detectCrossedEdge,
  spawnAtEdge,
  HUB_RETURN_SPAWN,
  wildernessExitPrompts,
  wildernessFrame,
} from './wildernessBridge.js'
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

const allExits = { north: true, south: true, east: true, west: true }
const layoutA = generateScreen({ nodeId: 'wild_0_0', seed: 1, biome: 'plains', exits: allExits })
const layoutB = generateScreen({ nodeId: 'wild_0_0', seed: 1, biome: 'plains', exits: allExits })
assert(layoutA.groundTileId === layoutB.groundTileId, 'generateScreen deterministic ground')
assert(JSON.stringify(layoutA.objects) === JSON.stringify(layoutB.objects), 'generateScreen deterministic objects')
assert(JSON.stringify(layoutA.tiles) === JSON.stringify(layoutB.tiles), 'generateScreen deterministic tiles')
assert(Array.isArray(layoutA.colliders) && layoutA.colliders.length >= 4, 'generateScreen has border colliders')
assert(fixtureLayout.objects.length > 0, 'fixtureLayout has objects')

// Every tile must resolve to a real manifest asset or nothing renders.
assert(
  layoutA.tiles.cells.every((c) => !!getAsset(c.assetId)),
  'every tile cell maps to a real terrain asset'
)
assert(
  layoutA.tiles.cells.some((c) => c.kind === 'path') && layoutA.tiles.cells.some((c) => c.kind === 'grass'),
  'tile grid mixes path and grass'
)
assert(
  ['north', 'south', 'east', 'west'].every((e) => {
    const b = layoutA.exitBands[e]
    return b && b.end > b.start && b.start >= 0 && b.end <= 1
  }),
  'each open exit has a corridor band'
)
// Border walls must leave a real gap on every open exit.
for (const e of ['north', 'south', 'east', 'west']) {
  const band = layoutA.exitBands[e]
  const horizontal = e === 'north' || e === 'south'
  const wall = layoutA.colliders.filter((c) =>
    horizontal
      ? (e === 'north' ? c.y < 0 : c.y >= 1) && c.w > 0.001
      : (e === 'west' ? c.x < 0 : c.x >= 1) && c.h > 0.001
  )
  const mid = (band.start + band.end) / 2
  const sealed = wall.some((c) =>
    horizontal ? mid > c.x && mid < c.x + c.w : mid > c.y && mid < c.y + c.h
  )
  assert(!sealed, `${e} exit is not sealed by a border collider`)
}
// No obstacle may sit on a path cell.
const { cols, rows, cells } = layoutA.tiles
assert(
  layoutA.objects.every((o) => {
    const i = Math.min(rows - 1, Math.floor(o.ny * rows)) * cols + Math.min(cols - 1, Math.floor(o.nx * cols))
    return cells[i]?.kind !== 'path'
  }),
  'no obstacle placed on a path tile'
)

assert(getNode(WILDERNESS_ENTRANCE_ID)?.id === WILDERNESS_ENTRANCE_ID, 'entrance node exists')
assert(WORLD_NODES.length >= 4, 'WORLD_NODES populated')
assert(oppositeEdge('north') === 'south', 'oppositeEdge')
const entranceNeighbors = getNeighbors(WILDERNESS_ENTRANCE_ID)
assert(entranceNeighbors.north === null, 'entrance north is reserved for the hub')
assert(!!entranceNeighbors.south && !!entranceNeighbors.east && !!entranceNeighbors.west, 'entrance has wilderness neighbors')
assert(!!getNeighbors('wild_3_4').north, 'inner nodes expose all four neighbors')

clearCache()
const L1 = getLayout(WILDERNESS_ENTRANCE_ID)
const L2 = getLayout(WILDERNESS_ENTRANCE_ID)
assert(L1 !== L2, 'getLayout regenerates on every visit')
assert(L1.exits.north && L2.exits.north, 'entrance keeps its north exit open')
preloadNeighbors(WILDERNESS_ENTRANCE_ID)
evictBeyond(WILDERNESS_ENTRANCE_ID, 0)
assert(true, 'preloadNeighbors + evictBeyond callable')

// Leading-edge crossing must fire for a sprite clamped against the border.
const band = L1.exitBands.north
const spriteW = 0.1
const spriteH = 0.11
const atNorth = { x: (band.start + band.end) / 2 - spriteW / 2, y: 0, w: spriteW, h: spriteH }
assert(detectCrossedEdge(atNorth, L1) === 'north', 'north crossing detected at the clamped border')
assert(detectCrossedEdge({ ...atNorth, y: 0.4 }, L1) === null, 'no crossing mid-screen')
const atSouth = { ...atNorth, x: (L1.exitBands.south.start + L1.exitBands.south.end) / 2 - spriteW / 2, y: 1 - spriteH }
assert(detectCrossedEdge(atSouth, L1) === 'south', 'south crossing detected at the clamped border')
assert(spawnAtEdge('north', L1).ny < 0.5, 'spawnAtEdge north lands near the top')
assert(
  Math.abs(spawnAtEdge('north', L1).nx - (band.start + band.end) / 2) < 1e-9,
  'spawnAtEdge centres on the corridor'
)
assert(HUB_RETURN_SPAWN.scene === 'dungeon', 'hub return targets the dungeon entrance')

assert(typeof drawWilderness === 'function', 'drawWilderness export')
assert(typeof wildernessCollidersPx === 'function', 'wildernessCollidersPx export')
const px = wildernessCollidersPx(layoutA, { dx: 0, dy: 0, dw: 1000, dh: 1500 })
assert(px.length === layoutA.colliders.length, 'wildernessCollidersPx length')
assert(Math.abs(px[0].w - layoutA.colliders[0].w * 1000) < 0.01, 'wildernessCollidersPx scales w')

const prompts = wildernessExitPrompts(L1, WILDERNESS_ENTRANCE_ID)
assert(prompts.length === 4, 'entrance surfaces four exit prompts')
assert(prompts.find((p) => p.edge === 'north')?.short === 'Dungeon Entrance', 'north prompt is labelled Dungeon Entrance')
const frame = wildernessFrame(1920, 1080)
assert(frame.dy >= 0 && frame.dh + frame.dy <= 1080 - 100, 'wilderness frame reserves HUD space')
assert(Math.abs(frame.dw / frame.dh - 1024 / 1536) < 1e-6, 'wilderness frame keeps 2:3 aspect')

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll Phase 0 contract smoke checks passed.')
