/**
 * Track B checks for the terrain generator.
 * Run: node client/src/game/terrain/generate.check.mjs
 *
 * Asserts: exit reachability, no overlapping colliders, same seed → identical layout.
 * Does NOT call Groq or ElevenLabs. Uses __fixtures__/fixtureManifest.js only.
 */
import { FIXTURE_MANIFEST } from './__fixtures__/fixtureManifest.js'
import { BIOMES, getBiome } from './biomes.js'
import { generateScreen, footprintToNrect } from './generate.js'
import { createRng, hashSeed } from './rng.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    failed++
  } else {
    console.log('ok:', msg)
  }
}

// --- RNG ---
const rng = createRng(42)
const a = rng.next()
const b = rng.next()
assert(typeof a === 'number' && a >= 0 && a < 1, 'rng.next in [0,1)')
assert(a !== b, 'mulberry32 advances')
assert(hashSeed('ember') !== hashSeed('ash'), 'hashSeed differs by input')
const r1 = createRng(hashSeed('same'))
const r2 = createRng(hashSeed('same'))
assert(r1.next() === r2.next() && r1.int(0, 9) === r2.int(0, 9), 'same seed → same stream')

// --- Biomes ---
for (const id of ['emberwood_forest', 'ashen_wastes', 'plains']) {
  const recipe = getBiome(id)
  assert(recipe.groundTileId && FIXTURE_MANIFEST.some((a) => a.id === recipe.groundTileId), `${id} ground in fixture manifest`)
  assert(
    recipe.allowedObjectIds.every((oid) => FIXTURE_MANIFEST.some((a) => a.id === oid)),
    `${id} objects in fixture manifest`,
  )
}
assert(Object.keys(BIOMES).length === 3, 'three biomes')

// --- Determinism ---
const opts = {
  nodeId: 'wild_0_0',
  seed: 7,
  biome: 'emberwood_forest',
  exits: { north: true, south: true, east: true, west: false },
}
const layoutA = generateScreen(opts)
const layoutB = generateScreen(opts)
assert(JSON.stringify(layoutA) === JSON.stringify(layoutB), 'same seed → identical layout')
const layoutC = generateScreen({ ...opts, seed: 8 })
assert(JSON.stringify(layoutA) !== JSON.stringify(layoutC), 'different seed → different layout')

// --- Shape ---
assert(layoutA.groundTileId === getBiome('emberwood_forest').groundTileId, 'ground from biome')
assert(layoutA.colliders.length >= 4, 'border colliders present')
assert(
  layoutA.objects.every((o) => FIXTURE_MANIFEST.some((a) => a.id === o.assetId)),
  'objects use fixture asset ids only',
)

/**
 * @param {{ x:number,y:number,w:number,h:number }} a
 * @param {{ x:number,y:number,w:number,h:number }} b
 */
function overlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

// Object colliders only (skip the 4 border slabs outside the playable frame)
const objectColliders = layoutA.colliders.slice(4)
for (let i = 0; i < objectColliders.length; i++) {
  for (let j = i + 1; j < objectColliders.length; j++) {
    assert(!overlap(objectColliders[i], objectColliders[j]), `colliders ${i} and ${j} do not overlap`)
  }
}

/**
 * Grid flood-fill: can walk from each open exit mouth to the hub without
 * stepping on object colliders.
 * @param {import('./generate.js').TerrainLayout} layout
 */
function exitsReachHub(layout) {
  const N = 48
  const cell = 1 / N
  const blocked = Array.from({ length: N }, () => Array(N).fill(false))

  for (const c of layout.colliders.slice(4)) {
    const x0 = Math.max(0, Math.floor(c.x * N))
    const y0 = Math.max(0, Math.floor(c.y * N))
    const x1 = Math.min(N - 1, Math.floor((c.x + c.w) * N))
    const y1 = Math.min(N - 1, Math.floor((c.y + c.h) * N))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) blocked[y][x] = true
    }
  }

  const hub = { x: Math.floor(0.5 * N), y: Math.floor(0.5 * N) }
  const mouths = []
  if (layout.exits.north) mouths.push({ x: Math.floor(0.5 * N), y: 1 })
  if (layout.exits.south) mouths.push({ x: Math.floor(0.5 * N), y: N - 2 })
  if (layout.exits.east) mouths.push({ x: N - 2, y: Math.floor(0.5 * N) })
  if (layout.exits.west) mouths.push({ x: 1, y: Math.floor(0.5 * N) })

  function reachable(start) {
    if (blocked[start.y][start.x]) return false
    const seen = Array.from({ length: N }, () => Array(N).fill(false))
    const q = [start]
    seen[start.y][start.x] = true
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    while (q.length) {
      const { x, y } = q.shift()
      if (x === hub.x && y === hub.y) return true
      for (const [dx, dy] of dirs) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue
        if (seen[ny][nx] || blocked[ny][nx]) continue
        seen[ny][nx] = true
        q.push({ x: nx, y: ny })
      }
    }
    return false
  }

  return mouths.every((m) => reachable(m))
}

assert(exitsReachHub(layoutA), 'emberwood exits reach hub')

const plains = generateScreen({
  nodeId: 'wild_1_2',
  seed: 99,
  biome: 'plains',
  exits: { north: false, south: true, east: true, west: true },
})
assert(exitsReachHub(plains), 'plains exits reach hub')

const wastes = generateScreen({
  nodeId: 'wild_2_0',
  seed: 3,
  biome: 'ashen_wastes',
  exits: { north: true, south: false, east: false, west: true },
})
assert(exitsReachHub(wastes), 'ashen_wastes exits reach hub')

// Footprint helper sanity (tree bottom-anchor)
const tree = FIXTURE_MANIFEST.find((a) => a.id === 'fixture_tree')
const fp = footprintToNrect(tree, 0.5, 0.5, 1)
assert(fp.w > 0 && fp.h > 0 && fp.y < 0.5, 'footprintToNrect tree above bottom anchor')

if (failed) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('\nAll Track B generate checks passed.')
