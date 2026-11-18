import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  BIOME_SPAWN_TABLES,
  MAX_SPAWNS_PER_SCREEN,
  SPAWN_CLEARANCE_PX,
  getBiomeSpawnTable,
  planScreenSpawns,
  sceneHasSpawns,
} from '../spawnTables.js'
import { BIOMES } from '../biomes.js'
import { generateScreen } from '../generate.js'
import { getNeighbors, biomeFor, WILDERNESS_ENTRANCE_ID } from '../worldGraph.js'
import { wildernessExitPrompts } from '../wildernessBridge.js'
import { ENEMY_DEFS, pickEnemyTypeByWeight } from '../../combat/enemyDefs.js'
import { BASE_WAVE_SPAWNS } from '../../combat/balance.js'
import { WILDERNESS_WORLD_W, WILDERNESS_WORLD_H } from '../../worldMetrics.js'

const W = WILDERNESS_WORLD_W
const H = WILDERNESS_WORLD_H

function layoutFor(nodeId, seed = 'fixture') {
  const neighbors = getNeighbors(nodeId)
  const exits = {
    north: !!neighbors.north || nodeId === WILDERNESS_ENTRANCE_ID,
    south: !!neighbors.south,
    east: !!neighbors.east,
    west: !!neighbors.west,
  }
  return generateScreen({ nodeId, seed, biome: biomeFor(nodeId), exits })
}

function planFor(nodeId, { worldSeed = 1, player = { x: 384, y: 100 }, seed } = {}) {
  const layout = layoutFor(nodeId, seed)
  const plan = planScreenSpawns({
    sceneId: 'wilderness',
    worldSeed,
    nodeId,
    biome: layout.biome,
    worldW: W,
    worldH: H,
    colliders: layout.colliders,
    exitRects: wildernessExitPrompts(layout, nodeId).map((p) => p.rect),
    player,
  })
  return { layout, plan }
}

const NODES = []
for (let c = -3; c <= 4; c++) for (let r = 0; r <= 4; r++) NODES.push(`wild_${c}_${r}`)

describe('spawn tables', () => {
  it('has a row for every biome and only uses real enemy def ids', () => {
    for (const id of Object.keys(BIOMES)) {
      const table = getBiomeSpawnTable(id)
      expect(table, id).toBeTruthy()
      expect(table.count[0]).toBeGreaterThanOrEqual(0)
      expect(table.count[1]).toBeLessThanOrEqual(MAX_SPAWNS_PER_SCREEN)
      for (const [defId, weight] of Object.entries(table.weights)) {
        expect(ENEMY_DEFS[defId], `${id}:${defId}`).toBeTruthy()
        expect(weight).toBeGreaterThan(0)
      }
    }
    expect(Object.keys(BIOME_SPAWN_TABLES).sort()).toEqual(Object.keys(BIOMES).sort())
  })

  it('pickEnemyTypeByWeight honours a weights map', () => {
    expect(pickEnemyTypeByWeight(() => 0, { archer: 1, goblin: 1 })).toBe('archer')
    expect(pickEnemyTypeByWeight(() => 0.99, { archer: 1, goblin: 1 })).toBe('goblin')
    expect(pickEnemyTypeByWeight(() => 0.5, { nope: 5, brute: 1 })).toBe('brute')
    expect(pickEnemyTypeByWeight(() => 0.5, { nope: 5 })).toBe(null)
  })
})

describe('planScreenSpawns', () => {
  it('gives the same spawns for the same seed, screen and layout', () => {
    for (const node of NODES) {
      const a = planFor(node).plan
      const b = planFor(node).plan
      expect(b).toEqual(a)
    }
  })

  it('differs between screens and between world seeds', () => {
    const sig = (worldSeed) => NODES.map((n) => JSON.stringify(planFor(n, { worldSeed }).plan)).join('|')
    expect(sig(1)).not.toBe(sig(2))
    const perScreen = new Set(NODES.map((n) => JSON.stringify(planFor(n).plan)))
    expect(perScreen.size).toBeGreaterThan(NODES.length / 2)
  })

  it('never lands within 128 px of an exit or the player', () => {
    const players = [
      { x: 384, y: 100 },
      { x: 384, y: 576 },
      { x: 100, y: 1000 },
    ]
    let checked = 0
    for (const node of NODES) {
      for (const player of players) {
        const { layout, plan } = planFor(node, { player })
        const rects = wildernessExitPrompts(layout, node).map((p) => ({
          x: p.rect.x * W,
          y: p.rect.y * H,
          w: p.rect.w * W,
          h: p.rect.h * H,
        }))
        for (const s of plan) {
          checked++
          expect(Math.hypot(s.x - player.x, s.y - player.y)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_PX)
          for (const r of rects) {
            const dx = Math.max(r.x - s.x, 0, s.x - (r.x + r.w))
            const dy = Math.max(r.y - s.y, 0, s.y - (r.y + r.h))
            expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE_PX)
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('never lands on a collider', () => {
    for (const node of NODES) {
      const { layout, plan } = planFor(node)
      for (const s of plan) {
        for (const c of layout.colliders) {
          const inside = s.x >= c.x * W && s.x <= (c.x + c.w) * W && s.y >= c.y * H && s.y <= (c.y + c.h) * H
          expect(inside, `${node} ${JSON.stringify(s)}`).toBe(false)
        }
      }
    }
  })

  it('holds the cap of 3 per screen, even with a greedy table', () => {
    for (const node of NODES) {
      const { plan } = planFor(node)
      expect(plan.length).toBeLessThanOrEqual(MAX_SPAWNS_PER_SCREEN)
    }
    const saved = BIOME_SPAWN_TABLES.plains
    BIOME_SPAWN_TABLES.plains = { count: [9, 20], weights: { goblin: 1 } }
    try {
      const out = planScreenSpawns({ sceneId: 'wilderness', worldSeed: 1, nodeId: 'wild_1_1', biome: 'plains', worldW: W, worldH: H })
      expect(out.length).toBe(MAX_SPAWNS_PER_SCREEN)
    } finally {
      BIOME_SPAWN_TABLES.plains = saved
    }
  })

  it('puts at least one enemy on most screens so the wilderness is not empty', () => {
    const withEnemies = NODES.filter((n) => planFor(n).plan.length > 0).length
    expect(withEnemies).toBeGreaterThanOrEqual(Math.floor(NODES.length * 0.9))
  })

  it('spawns nothing in town, interiors, the dungeon hub or the cavern', () => {
    for (const sceneId of ['village', 'brackenford', 'tavern', 'market', 'dungeon', 'dungeonInterior', 'cavern_halls', 'cavern_lair']) {
      expect(sceneHasSpawns(sceneId), sceneId).toBe(false)
      const out = planScreenSpawns({ sceneId, worldSeed: 1, nodeId: 'wild_2_0', biome: 'emberwood_forest', worldW: W, worldH: H })
      expect(out, sceneId).toEqual([])
    }
    expect(sceneHasSpawns('wilderness')).toBe(true)
  })

  it('returns nothing for an unknown biome', () => {
    expect(planScreenSpawns({ sceneId: 'wilderness', worldSeed: 1, nodeId: 'x', biome: 'nope', worldW: W, worldH: H })).toEqual([])
  })
})

describe('cavern wave loop is untouched', () => {
  const src = readFileSync(fileURLToPath(new URL('../../scenes/HollowvaleScene.js', import.meta.url)), 'utf8')
  const start = src.indexOf('  _spawnWave() {')
  const body = src.slice(start, src.indexOf('  _spawnEnemy(', start))

  it('keeps the base wave and the wave rules, and never touches the spawn tables', () => {
    expect(BASE_WAVE_SPAWNS).toEqual([
      ['goblin', 0.47, 0.28],
      ['goblin', 0.53, 0.31],
      ['brute', 0.5, 0.22],
      ['archer', 0.56, 0.26],
    ])
    expect(body).toContain('...BASE_WAVE_SPAWNS')
    expect(body).toContain("spawns.push(['goblin', 0.45 + random() * 0.12, 0.2 + random() * 0.14])")
    expect(body).toContain("wave % 2 === 0) spawns.push(['archer'")
    expect(body).toContain("wave % 3 === 0) spawns.push(['brute'")
    expect(body).not.toMatch(/planScreenSpawns|spawnTables|_spawnWildernessEnemies/)
  })

  it('only the wilderness mount spawns table enemies', () => {
    const calls = src.match(/_spawnWildernessEnemies\(/g) || []
    expect(calls.length).toBe(2) // the definition and the one call in _mountWilderness
    const mount = src.slice(src.indexOf('  _mountWilderness('), src.indexOf('  _drawWilderness('))
    expect(mount).toContain('this._spawnWildernessEnemies(layout)')
  })
})
