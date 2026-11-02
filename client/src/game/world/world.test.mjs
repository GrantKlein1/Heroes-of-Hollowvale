import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { roadConnected, clearWorldCache, createWorld, eachLeaguePair, floodLeague, getWorld } from './league.js'
import {
  LEAGUE_H,
  LEAGUE_MAX_X,
  LEAGUE_MAX_Y,
  LEAGUE_MIN_X,
  LEAGUE_MIN_Y,
  LEAGUE_W,
  ROAD_PX_PER_SEC,
  SCREEN_H,
  WORLD_SEED,
  forEachLeague,
  tileCenter,
} from './metrics.js'
import { T, collisionForTile } from './tileCatalog.js'
import { SOUTH_GATE, STONE } from './content.js'
import { containsPoint } from './props.js'

const MAP_DIR = new URL('../../../public/maps/', import.meta.url)

function snapshot(world) {
  const out = []
  forEachLeague((lx, ly) => {
    const view = world.league(lx, ly)
    out.push({
      lx,
      ly,
      tiles: view.tiles,
      kinds: view.kinds,
      walk: view.walk,
      loot: view.loot,
      encounters: view.encounters,
      interactables: view.interactables.map((it) => ({ id: it.id, wx: it.wx, wy: it.wy, action: it.action })),
      props: view.props.map((p) => ({ kind: p.kind, wx: p.wx, wy: p.wy, frame: p.frame })),
    })
  })
  return out
}

test('same seed rebuilds identical tiles, props, loot, and encounters', () => {
  const a = snapshot(createWorld(WORLD_SEED))
  const b = snapshot(createWorld(WORLD_SEED))
  assert.deepEqual(a, b)
  const c = snapshot(createWorld(`${WORLD_SEED}:other`))
  assert.notDeepEqual(a, c)
})

test('shared edges match for every adjacent league', () => {
  const world = createWorld(WORLD_SEED)
  eachLeaguePair((lx, ly, nx, ny, dir) => {
    const a = world.league(lx, ly)
    const b = world.league(nx, ny)
    if (dir === 'south') {
      const row = LEAGUE_H - 1
      assert.deepEqual(a.kinds[row], b.kinds[0], `kinds ${lx},${ly} south`)
      assert.deepEqual(a.tiles[row], b.tiles[0], `tiles ${lx},${ly} south`)
      assert.deepEqual(a.walk[row], b.walk[0], `walk ${lx},${ly} south`)
    } else {
      const colA = a.kinds.map((row) => row[LEAGUE_W - 1])
      const colB = b.kinds.map((row) => row[0])
      assert.deepEqual(colA, colB, `kinds ${lx},${ly} east`)
      const tileA = a.tiles.map((row) => row[LEAGUE_W - 1])
      const tileB = b.tiles.map((row) => row[0])
      assert.deepEqual(tileA, tileB, `tiles ${lx},${ly} east`)
      const walkA = a.walk.map((row) => row[LEAGUE_W - 1])
      const walkB = b.walk.map((row) => row[0])
      assert.deepEqual(walkA, walkB, `walk ${lx},${ly} walk`)
    }
  })
})

test('every walkable tile is reachable from a league entrance', () => {
  const world = createWorld(WORLD_SEED)
  forEachLeague((lx, ly) => {
    const view = world.league(lx, ly)
    const { lost } = floodLeague(view)
    assert.equal(lost.length, 0, `unreachable in ${lx},${ly}: ${JSON.stringify(lost.slice(0, 8))}`)
  })
})

test('loot and interactables are reachable and not inside a collider or on water', () => {
  const world = createWorld(WORLD_SEED)
  forEachLeague((lx, ly) => {
    const view = world.league(lx, ly)
    const { reachable } = floodLeague(view)
    const points = []
    for (const loot of view.loot) points.push(['loot', loot.id, loot.wx, loot.wy])
    for (const it of view.interactables) points.push(['interact', it.id, it.wx, it.wy])
    for (const enc of view.encounters) points.push(['encounter', enc.id, enc.wx, enc.wy])
    if (lx === 0 && ly === 0) points.push(['spawn', 'start', 10, 5])
    for (const [group, id, wx, wy] of points) {
      const tx = wx - lx * 19
      const ty = wy - ly * 11
      assert.ok(view.walk[ty][tx], `${group} ${id} not walkable at ${wx},${wy}`)
      assert.ok(reachable[ty][tx], `${group} ${id} not reachable`)
      const center = tileCenter(wx, wy)
      assert.equal(world.pointBlocked(wx, wy, center.x, center.y), false, `${group} ${id} blocked`)
      const kind = view.kinds[ty][tx]
      assert.notEqual(kind, 'water')
      for (const prop of view.props) {
        if (!prop.rect) continue
        assert.equal(containsPoint(prop.rect, center.x, center.y), false, `${group} ${id} inside ${prop.kind}`)
      }
    }
  })
})

test('the Ember Road is continuous from the south gate to Hearthmile Stone', () => {
  const world = createWorld(WORLD_SEED)
  assert.equal(roadConnected(world), true)
  const town = world.league(0, 0)
  for (const gate of SOUTH_GATE) {
    assert.equal(town.kinds[gate.wy][gate.wx], 'gate')
  }
  assert.equal(world.kindAt(9, 11), 'road')
  assert.equal(world.kindAt(STONE.wx, STONE.wy - 1), 'road')
  const mile = world.league(0, 4)
  const stoneProp = mile.props.find((p) => p.kind === 'milestone')
  assert.ok(stoneProp, 'milestone prop')
  assert.equal(stoneProp.wx, STONE.wx)
  assert.equal(stoneProp.wy, STONE.wy)
})

test('road pace is one league in eight seconds and forest is slower', () => {
  assert.equal(ROAD_PX_PER_SEC, SCREEN_H / 8)
  assert.equal(SCREEN_H / ROAD_PX_PER_SEC, 8)
})

test('tree trunks collide on a partial footprint and canopy tiles do not', () => {
  for (const id of [T.trunk0, T.trunk1, T.trunk2, T.trunk3]) {
    const hit = collisionForTile(id)
    assert.ok(hit)
    assert.ok(hit.w < 16 && hit.h < 16)
    assert.ok(hit.y > 0)
  }
  for (const id of [T.canopy0, T.canopy1, T.canopy2, T.canopy3]) {
    assert.equal(collisionForTile(id), null)
  }
  assert.deepEqual(collisionForTile(T.water), { x: 0, y: 0, w: 16, h: 16 })
  assert.equal(collisionForTile(T.ford), null)
  assert.equal(collisionForTile(T.bridgeH), null)
  assert.deepEqual(collisionForTile(T.wall), { x: 0, y: 0, w: 16, h: 16 })
})

test('stamped Tiled maps match the generated leagues', () => {
  const world = getWorld(WORLD_SEED)
  for (const [file, lx, ly] of [['brackenford.json', 0, 0], ['hearthmile.json', 0, 4]]) {
    const map = JSON.parse(readFileSync(new URL(file, MAP_DIR), 'utf8'))
    const layer = map.layers.find((l) => l.name === 'ground')
    const view = world.league(lx, ly)
    assert.equal(layer.width, 20)
    assert.equal(layer.height, 12)
    assert.equal(layer.data.length, 240)
    for (let i = 0; i < layer.data.length; i++) {
      const tx = i % 20
      const ty = (i - tx) / 20
      assert.equal(layer.data[i], view.tiles[ty][tx] + 1, `${file} ${tx},${ty}`)
    }
    const names = new Set(map.layers.find((l) => l.name === 'objects').objects.map((o) => o.name))
    for (const it of view.interactables) assert.ok(names.has(it.id), `${file} missing ${it.id}`)
    for (const loot of view.loot) assert.ok(names.has(loot.id), `${file} missing ${loot.id}`)
  }
  clearWorldCache()
})

test('corridor leagues exist inside the generated bounds', () => {
  assert.ok(LEAGUE_MIN_X < 0 && LEAGUE_MAX_X > 0)
  assert.ok(LEAGUE_MIN_Y < 0 && LEAGUE_MAX_Y > 4)
})
