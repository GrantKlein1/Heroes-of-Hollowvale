import { describe, it, expect, beforeEach } from 'vitest'
import { TERRAIN_ASSETS, getAsset, assetsForBiome } from '../../../config/terrainAssets.js'
import { createRng, hashSeed } from '../rng.js'
import { BIOMES, getBiome } from '../biomes.js'
import { generateScreen } from '../generate.js'
import {
  WORLD_NODES,
  WILDERNESS_ENTRANCE_ID,
  getNode,
  getNeighbors,
  oppositeEdge,
} from '../worldGraph.js'
import { getLayout, preloadNeighbors, evictBeyond, clearCache } from '../screenCache.js'
import { drawWilderness, wildernessCollidersPx } from '../render.js'
import {
  detectCrossedEdge,
  spawnAtEdge,
  HUB_RETURN_SPAWN,
  wildernessExitPrompts,
  wildernessFrame,
} from '../wildernessBridge.js'
import { FIXTURE_MANIFEST } from '../__fixtures__/fixtureManifest.js'
import fixtureLayout from '../__fixtures__/fixtureLayout.js'

describe('Terrain Contract Tests', () => {
  describe('Terrain Asset Manifest', () => {
    it('populates TERRAIN_ASSETS with at least 4 items', () => {
      expect(Array.isArray(TERRAIN_ASSETS)).toBe(true)
      expect(TERRAIN_ASSETS.length).toBeGreaterThanOrEqual(4)
    })

    it('retrieves ground and path assets by id', () => {
      expect(getAsset('grass_version1')?.category).toBe('ground')
      expect(getAsset('path_top_bottom')?.tileType).toBe('path')
    })

    it('returns assets for emberwood_forest biome', () => {
      expect(assetsForBiome('emberwood_forest').length).toBeGreaterThan(0)
    })

    it('validates fixture manifest shape', () => {
      expect(FIXTURE_MANIFEST.every((a) => a.id && a.w && a.h)).toBe(true)
    })
  })

  describe('RNG & Biomes', () => {
    it('generates numbers in [0, 1)', () => {
      const rng = createRng(42)
      const val = rng.next()
      expect(typeof val).toBe('number')
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    })

    it('produces distinct hash seeds for different inputs', () => {
      expect(hashSeed('a')).not.toBe(hashSeed('b'))
    })

    it('provides groundTileId for plains biome', () => {
      expect(getBiome('plains').groundTileId).toBeDefined()
    })

    it('includes emberwood_forest in BIOMES', () => {
      expect(Object.keys(BIOMES)).toContain('emberwood_forest')
    })
  })

  describe('Screen Generation Determinism & Constraints', () => {
    const allExits = { north: true, south: true, east: true, west: true }
    const layoutA = generateScreen({ nodeId: 'wild_0_0', seed: 1, biome: 'plains', exits: allExits })
    const layoutB = generateScreen({ nodeId: 'wild_0_0', seed: 1, biome: 'plains', exits: allExits })

    it('is strictly deterministic across runs with the same seed', () => {
      expect(layoutA.groundTileId).toBe(layoutB.groundTileId)
      expect(JSON.stringify(layoutA.objects)).toBe(JSON.stringify(layoutB.objects))
      expect(JSON.stringify(layoutA.tiles)).toBe(JSON.stringify(layoutB.tiles))
    })

    it('generates border colliders and fixture objects', () => {
      expect(Array.isArray(layoutA.colliders)).toBe(true)
      expect(layoutA.colliders.length).toBeGreaterThanOrEqual(4)
      expect(fixtureLayout.objects.length).toBeGreaterThan(0)
    })

    it('maps every tile cell to a valid asset and mixes path with grass', () => {
      expect(layoutA.tiles.cells.every((c) => !!getAsset(c.assetId))).toBe(true)
      expect(layoutA.tiles.cells.some((c) => c.kind === 'path')).toBe(true)
      expect(layoutA.tiles.cells.some((c) => c.kind === 'grass')).toBe(true)
    })

    it('provides open corridor bands for all exits', () => {
      const directions = ['north', 'south', 'east', 'west']
      directions.forEach((e) => {
        const b = layoutA.exitBands[e]
        expect(b).toBeDefined()
        expect(b.end).toBeGreaterThan(b.start)
        expect(b.start).toBeGreaterThanOrEqual(0)
        expect(b.end).toBeLessThanOrEqual(1)
      })
    })

    it('does not seal open exits with border colliders', () => {
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
        expect(sealed).toBe(false)
      }
    })

    it('places no obstacles on path tiles', () => {
      const { cols, rows, cells } = layoutA.tiles
      const hasObstacleOnPath = layoutA.objects.some((o) => {
        const i = Math.min(rows - 1, Math.floor(o.ny * rows)) * cols + Math.min(cols - 1, Math.floor(o.nx * cols))
        return cells[i]?.kind === 'path'
      })
      expect(hasObstacleOnPath).toBe(false)
    })
  })

  describe('World Graph & Navigation', () => {
    it('defines entrance node and populated WORLD_NODES', () => {
      expect(getNode(WILDERNESS_ENTRANCE_ID)?.id).toBe(WILDERNESS_ENTRANCE_ID)
      expect(WORLD_NODES.length).toBeGreaterThanOrEqual(4)
      expect(oppositeEdge('north')).toBe('south')
    })

    it('configures entrance neighbors correctly', () => {
      const entranceNeighbors = getNeighbors(WILDERNESS_ENTRANCE_ID)
      expect(entranceNeighbors.north).toBeNull()
      expect(entranceNeighbors.south).toBeTruthy()
      expect(entranceNeighbors.east).toBeTruthy()
      expect(entranceNeighbors.west).toBeTruthy()
      expect(getNeighbors('wild_3_4').north).toBeTruthy()
    })
  })

  describe('Screen Cache & Crossing Detection', () => {
    beforeEach(() => {
      clearCache()
    })

    it('regenerates layout on every visit and keeps entrance north open', () => {
      const L1 = getLayout(WILDERNESS_ENTRANCE_ID)
      const L2 = getLayout(WILDERNESS_ENTRANCE_ID)
      expect(L1).not.toBe(L2)
      expect(L1.exits.north).toBe(true)
      expect(L2.exits.north).toBe(true)
    })

    it('allows preloading neighbors and evicting beyond', () => {
      expect(() => {
        preloadNeighbors(WILDERNESS_ENTRANCE_ID)
        evictBeyond(WILDERNESS_ENTRANCE_ID, 0)
      }).not.toThrow()
    })

    it('detects border crossing and computes spawn point', () => {
      const L1 = getLayout(WILDERNESS_ENTRANCE_ID)
      const band = L1.exitBands.north
      const spriteW = 0.1
      const spriteH = 0.11
      const atNorth = { x: (band.start + band.end) / 2 - spriteW / 2, y: 0, w: spriteW, h: spriteH }
      expect(detectCrossedEdge(atNorth, L1)).toBe('north')
      expect(detectCrossedEdge({ ...atNorth, y: 0.4 }, L1)).toBeNull()

      const atSouth = { ...atNorth, x: (L1.exitBands.south.start + L1.exitBands.south.end) / 2 - spriteW / 2, y: 1 - spriteH }
      expect(detectCrossedEdge(atSouth, L1)).toBe('south')

      const northSpawn = spawnAtEdge('north', L1)
      expect(northSpawn.ny).toBeLessThan(0.5)
      expect(Math.abs(northSpawn.nx - (band.start + band.end) / 2)).toBeLessThan(1e-9)
      expect(HUB_RETURN_SPAWN.scene).toBe('dungeon')
    })
  })

  describe('Rendering & Viewport Frame', () => {
    it('exports drawWilderness and wildernessCollidersPx', () => {
      expect(typeof drawWilderness).toBe('function')
      expect(typeof wildernessCollidersPx).toBe('function')
    })

    it('scales colliders correctly in wildernessCollidersPx', () => {
      const allExits = { north: true, south: true, east: true, west: true }
      const layoutA = generateScreen({ nodeId: 'wild_0_0', seed: 1, biome: 'plains', exits: allExits })
      const px = wildernessCollidersPx(layoutA, { dx: 0, dy: 0, dw: 1000, dh: 1500 })
      expect(px.length).toBe(layoutA.colliders.length)
      expect(Math.abs(px[0].w - layoutA.colliders[0].w * 1000)).toBeLessThan(0.01)
    })

    it('surfaces exit prompts and respects 2:3 aspect frame with HUD margin', () => {
      const L1 = getLayout(WILDERNESS_ENTRANCE_ID)
      const prompts = wildernessExitPrompts(L1, WILDERNESS_ENTRANCE_ID)
      expect(prompts.length).toBe(4)
      expect(prompts.find((p) => p.edge === 'north')?.short).toBe('Dungeon Entrance')

      const frame = wildernessFrame(1920, 1080)
      expect(frame.dy).toBeGreaterThanOrEqual(0)
      expect(frame.dh + frame.dy).toBeLessThanOrEqual(1080 - 100)
      expect(Math.abs(frame.dw / frame.dh - 1024 / 1536)).toBeLessThan(1e-6)
    })
  })
})

