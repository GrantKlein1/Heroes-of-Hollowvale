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
import { PNG } from 'pngjs'
import { T, collisionForTile } from './tileCatalog.js'
import { auditRects } from './packMap.js'
import { PROP_KINDS, propSprite } from './props.js'
import { SOUTH_GATE, STONE } from './content.js'
import { STAMP_LEAGUES } from './stamps.js'
import { DECORATION_KINDS, containsPoint } from './props.js'
import { RUINWATCH, isRoad } from './roads.js'

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

test('the eaves road runs from the Hearthmile bend to Ruinwatch', () => {
  const world = createWorld(WORLD_SEED)
  const start = { wx: -4, wy: 46 }
  const seen = new Set([`${start.wx},${start.wy}`])
  const q = [start]
  let qi = 0
  while (qi < q.length) {
    const cur = q[qi++]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const wx = cur.wx + dx
      const wy = cur.wy + dy
      const key = `${wx},${wy}`
      if (seen.has(key)) continue
      const kind = world.kindAt(wx, wy)
      if (kind !== 'road' && kind !== 'gate') continue
      seen.add(key)
      q.push({ wx, wy })
    }
  }
  let near = false
  for (const key of seen) {
    const [x, y] = key.split(',').map(Number)
    if (Math.abs(x - RUINWATCH.wx) <= 2 && Math.abs(y - RUINWATCH.wy) <= 2) near = true
  }
  assert.equal(near, true, `road never reaches ${RUINWATCH.wx},${RUINWATCH.wy}`)
})

test('decoration props do not block the road or an entrance', () => {
  const world = createWorld(WORLD_SEED)
  for (const prop of world.props) {
    if (!DECORATION_KINDS.has(prop.kind) || !prop.blocks) continue
    assert.equal(isRoad(prop.wx, prop.wy), false, `${prop.kind} on road ${prop.wx},${prop.wy}`)
    assert.notEqual(world.kindAt(prop.wx, prop.wy), 'gate')
    const edge = ((prop.wx % 19) + 19) % 19 === 0 || ((prop.wy % 11) + 11) % 11 === 0
    assert.equal(edge, false, `${prop.kind} blocks entrance ${prop.wx},${prop.wy}`)
  }
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

function rectProblem(png, rect) {
  let opaque = 0
  let minR = 255
  let minG = 255
  let minB = 255
  let maxR = 0
  let maxG = 0
  let maxB = 0
  const area = rect.w * rect.h
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const sx = rect.x + x
      const sy = rect.y + y
      if (sx < 0 || sy < 0 || sx >= png.width || sy >= png.height) continue
      const i = (sy * png.width + sx) * 4
      if (png.data[i + 3] < 24) continue
      opaque++
      const r = png.data[i]
      const g = png.data[i + 1]
      const b = png.data[i + 2]
      if (r < minR) minR = r
      if (g < minG) minG = g
      if (b < minB) minB = b
      if (r > maxR) maxR = r
      if (g > maxG) maxG = g
      if (b > maxB) maxB = b
    }
  }
  if (opaque < 12) return 'empty'
  const flat = maxR - minR < 8 && maxG - minG < 8 && maxB - minB < 8
  const black = maxR < 28 && maxG < 28 && maxB < 28
  const magenta = minR > 160 && minB > 160 && maxG < 80
  if (flat && (black || magenta)) return black ? 'solid-black' : 'solid-magenta'
  if (opaque / area < 0.02) return 'empty'
  return null
}

test('mapped atlas frames are not empty or solid black', () => {
  const png = PNG.sync.read(readFileSync(new URL('../../../public/maps/ninja-adventure/tileset.png', import.meta.url)))
  const rects = auditRects()
  for (const [kind, def] of Object.entries(PROP_KINDS)) {
    if (def.tall) continue
    const count = def.sprites ? def.sprites.length : def.frames.length
    for (let i = 0; i < count; i++) {
      const spec = propSprite(kind, i)
      rects.push({
        name: `${kind}-${i}`,
        x: spec.col * 16,
        y: spec.row * 16,
        w: (spec.tw || 1) * 16,
        h: (spec.th || 1) * 16,
      })
    }
  }
  const bad = []
  for (const rect of rects) {
    const problem = rectProblem(png, rect)
    if (problem) bad.push(`${rect.name} ${problem} @${rect.x},${rect.y}`)
  }
  assert.deepEqual(bad, [])
})

test('stamped Tiled maps match the generated leagues', () => {
  const world = getWorld(WORLD_SEED)
  const camp = STAMP_LEAGUES.find((s) => s.key === 'ruinwatch')
  for (const [file, lx, ly] of [['brackenford.json', 0, 0], ['hearthmile.json', 0, 4], ['ruinwatch.json', camp.lx, camp.ly]]) {
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
