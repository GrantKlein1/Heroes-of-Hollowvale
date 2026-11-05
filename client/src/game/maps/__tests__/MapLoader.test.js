import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MapLoader, isTiledMapsEnabled, parsePropFootprint } from '../MapLoader.js'
import { LAYER_DEPTHS, calculateDepth, sortByFeet, resolveFeetY } from '../depth.js'
import { parseZonesLayer } from '../zones.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureMapPath = path.resolve(__dirname, '../__fixtures__/fixture_map.tmj')

describe('Package 2-1: MapLoader & Tiled TMJ Architecture', () => {
  const rawJson = fs.readFileSync(fixtureMapPath, 'utf-8')
  const fixtureData = JSON.parse(rawJson)

  // =========================================================================
  // Acceptance Criterion 1: Loads fixture .tmj and finds every layer
  // =========================================================================
  describe('Criterion 1: Layer Detection & Verification', () => {
    it('loads fixture .tmj and verifies 32px grid metrics', () => {
      const loader = new MapLoader(fixtureData)
      expect(loader.tileWidth).toBe(32)
      expect(loader.tileHeight).toBe(32)
      expect(loader.width).toBe(10)
      expect(loader.height).toBe(8)
      expect(loader.worldWidth).toBe(320)
      expect(loader.worldHeight).toBe(256)
    })

    it('finds every required layer: ground, ground_detail, walls, props, collision, zones, overhead', () => {
      const loader = new MapLoader(fixtureData)
      const expectedLayers = [
        'ground',
        'ground_detail',
        'walls',
        'props',
        'collision',
        'zones',
        'overhead',
      ]

      for (const name of expectedLayers) {
        expect(loader.hasLayer(name), `Missing required layer: ${name}`).toBe(true)
        const layer = loader.getLayer(name)
        expect(layer).toBeDefined()
        expect(layer.name).toBe(name)
      }

      const validation = loader.validateLayers()
      expect(validation.valid).toBe(true)
      expect(validation.missing).toEqual([])
    })

    it('preserves layer types correctly (tilelayer vs objectgroup)', () => {
      const loader = new MapLoader(fixtureData)
      expect(loader.getLayer('ground').type).toBe('tilelayer')
      expect(loader.getLayer('ground_detail').type).toBe('tilelayer')
      expect(loader.getLayer('walls').type).toBe('tilelayer')
      expect(loader.getLayer('props').type).toBe('objectgroup')
      expect(loader.getLayer('collision').type).toBe('tilelayer')
      expect(loader.getLayer('zones').type).toBe('objectgroup')
      expect(loader.getLayer('overhead').type).toBe('tilelayer')
    })
  })

  // =========================================================================
  // Acceptance Criterion 2: Collision sweep prevents entry into collision tiles
  // =========================================================================
  describe('Criterion 2: Collision Sweep & Boundary Prevention', () => {
    it('prevents player from entering collision tiles when sweeping horizontally', () => {
      const loader = new MapLoader(fixtureData)

      // In fixture_map.tmj:
      // Tile (col 4, row 4) is a collision tile at [x: 128..160, y: 128..160].
      // Tile (col 4, row 5) is a collision tile at [x: 128..160, y: 160..192].
      // Place player at (x: 64, y: 136) with size 24x16.
      const playerCollider = { x: 64, y: 136, width: 24, height: 16 }

      // Sweep player 80px eastward (toward target x = 144, which is deep inside col 4).
      const result = loader.sweep(playerCollider, 80, 0)

      expect(result.collided).toBe(true)
      expect(result.collidedX).toBe(true)
      expect(result.blocked).toBe(true)

      // The player's right edge (x + width) must not penetrate x = 128 (col 4 left border).
      // Max allowable x is 128 - 24 = 104.
      expect(result.x).toBeLessThanOrEqual(104)

      // Verify final position does not intersect any collision tile
      const finalCollider = { x: result.x, y: result.y, width: 24, height: 16 }
      expect(loader.checkCollision(finalCollider)).toBe(false)
    })

    it('prevents player from entering collision tiles when sweeping vertically', () => {
      const loader = new MapLoader(fixtureData)

      // Row 0 has wall tiles [y: 0..32].
      // Place player at (x: 96, y: 48) with size 24x16.
      const playerCollider = { x: 96, y: 48, width: 24, height: 16 }

      // Sweep player upward by 40px (target y = 8, inside row 0 wall).
      const result = loader.sweep(playerCollider, 0, -40)

      expect(result.collided).toBe(true)
      expect(result.collidedY).toBe(true)
      // Top edge must stop at or below row 0 bottom border (y = 32)
      expect(result.y).toBeGreaterThanOrEqual(32)

      const finalCollider = { x: result.x, y: result.y, width: 24, height: 16 }
      expect(loader.checkCollision(finalCollider)).toBe(false)
    })

    it('prevents player from penetrating prop footprint bodies', () => {
      const loader = new MapLoader(fixtureData)

      // In fixture_map.tmj, cottage prop sits at x: 224, y: 96 with footprint:
      // x: 224, y: 128, width: 64, height: 32.
      // Place player just to the left at x: 180, y: 136 (size: 24x16).
      const playerCollider = { x: 180, y: 136, width: 24, height: 16 }

      // Attempt to sweep rightward through the cottage footprint
      const result = loader.sweep(playerCollider, 60, 0)

      expect(result.collided).toBe(true)
      expect(result.collidedX).toBe(true)
      // Player right edge cannot penetrate x = 224, so x <= 200
      expect(result.x).toBeLessThanOrEqual(200)

      const finalCollider = { x: result.x, y: result.y, width: 24, height: 16 }
      expect(loader.checkCollision(finalCollider)).toBe(false)
    })

    it('allows unimpeded movement across clear ground', () => {
      const loader = new MapLoader(fixtureData)

      // Row 6 is open grass [y: 192..224].
      const playerCollider = { x: 32, y: 200, width: 24, height: 16 }
      const deltaX = 30
      const deltaY = 10

      const result = loader.sweep(playerCollider, deltaX, deltaY)

      expect(result.collided).toBe(false)
      expect(result.blocked).toBe(false)
      expect(result.x).toBe(32 + deltaX)
      expect(result.y).toBe(200 + deltaY)
    })

    it('blocks movement attempts out of world bounds', () => {
      const loader = new MapLoader(fixtureData)
      const playerCollider = { x: 8, y: 100, width: 24, height: 16 }

      // Sweep left beyond world border (x < 0)
      const result = loader.sweep(playerCollider, -20, 0)
      expect(result.collided).toBe(true)
      expect(result.x).toBeGreaterThanOrEqual(0)
    })
  })

  // =========================================================================
  // Depth & Feet-Anchored Y-Sorting
  // =========================================================================
  describe('Layer Depths & Feet-Anchored Y-Sorting', () => {
    it('exports standard layer depths according to ASSET_SPEC', () => {
      expect(LAYER_DEPTHS.ground).toBe(0)
      expect(LAYER_DEPTHS.ground_detail).toBe(10)
      expect(LAYER_DEPTHS.walls).toBe(20)
      expect(LAYER_DEPTHS.overhead).toBe(30000)
      expect(LAYER_DEPTHS.overhead).toBeGreaterThan(LAYER_DEPTHS.walls)
    })

    it('computes depth based on feet position (depth = feetY)', () => {
      expect(calculateDepth(120)).toBe(120)
      expect(calculateDepth(120, 5)).toBe(125)

      const actor = { x: 50, y: 100, height: 40 }
      expect(resolveFeetY(actor)).toBe(140)
      expect(calculateDepth(resolveFeetY(actor))).toBe(140)
    })

    it('sorts entities deterministically by their feet Y coordinates', () => {
      const entities = [
        { name: 'cottage', y: 100, height: 64 }, // feetY = 164
        { name: 'player', y: 50, height: 32 },    // feetY = 82
        { name: 'tree', y: 30, height: 60 },      // feetY = 90
        { name: 'goblin', y: 200, height: 32 },   // feetY = 232
      ]

      const sorted = sortByFeet(entities)
      expect(sorted.map((e) => e.name)).toEqual(['player', 'tree', 'cottage', 'goblin'])
    })

    it('assigns feet depth to all parsed props in MapLoader', () => {
      const loader = new MapLoader(fixtureData)
      expect(loader.propObjects.length).toBeGreaterThan(0)

      for (const prop of loader.propObjects) {
        expect(prop.feetY).toBeDefined()
        expect(prop.depth).toBe(calculateDepth(prop.feetY))
        expect(prop.footprint).toBeDefined()
      }
    })
  })

  // =========================================================================
  // Zones Layer Ingestion & Queries
  // =========================================================================
  describe('Zones Parsing & Queries', () => {
    it('parses spawn, exit, and door zones from objectgroup', () => {
      const loader = new MapLoader(fixtureData)
      const zones = loader.getZones()

      expect(zones.all.length).toBe(3)

      const spawn = loader.getZone('spawn_default')
      expect(spawn).toBeDefined()
      expect(spawn.isSpawn).toBe(true)
      expect(spawn.x).toBe(32)
      expect(spawn.y).toBe(96)

      const exit = loader.getZone('exit_south')
      expect(exit).toBeDefined()
      expect(exit.isExit).toBe(true)
      expect(exit.properties.targetMap).toBe('wilderness.tmj')
      expect(exit.properties.targetSpawn).toBe('north')

      const door = loader.getZone('door_tavern')
      expect(door).toBeDefined()
      expect(door.isDoor).toBe(true)
      expect(door.properties.prompt).toContain('The Flagon')
    })

    it('performs zone hit testing for points and bounding boxes', () => {
      const loader = new MapLoader(fixtureData)
      const zones = loader.getZones()

      // Point inside exit_south (x: 128..192, y: 224..256)
      const match = zones.findZoneAt(140, 230)
      expect(match).toBeDefined()
      expect(match.name).toBe('exit_south')

      // Point outside zones
      expect(zones.findZoneAt(10, 10)).toBeUndefined()

      // Rect overlapping door_tavern (x: 224, y: 160)
      const intersecting = zones.findIntersecting({ x: 220, y: 155, width: 20, height: 20 })
      expect(intersecting.some((z) => z.name === 'door_tavern')).toBe(true)
    })
  })

  // =========================================================================
  // ?maps=tiled URL Flag Support
  // =========================================================================
  describe('Flag Control: ?maps=tiled', () => {
    it('returns true when ?maps=tiled is present', () => {
      expect(isTiledMapsEnabled('?maps=tiled')).toBe(true)
      expect(isTiledMapsEnabled('?renderer=blend&maps=tiled&seed=42')).toBe(true)
      expect(isTiledMapsEnabled('maps=tiled')).toBe(true)
      expect(isTiledMapsEnabled('?maps=1')).toBe(true)
      expect(isTiledMapsEnabled('?maps=true')).toBe(true)
    })

    it('returns false when maps flag is absent or set to other value', () => {
      expect(isTiledMapsEnabled('')).toBe(false)
      expect(isTiledMapsEnabled('?renderer=blend')).toBe(false)
      expect(isTiledMapsEnabled('?maps=legacy')).toBe(false)
      expect(isTiledMapsEnabled('?renderer=legacy')).toBe(false)
    })
  })

  // =========================================================================
  // Collision by Property Configuration
  // =========================================================================
  describe('setCollisionByProperty', () => {
    it('registers colliding tiles from tileset properties', () => {
      const loader = new MapLoader(fixtureData)
      // GID 3 (Wall stone) has { collides: true }
      expect(loader.collidingGids.has(3)).toBe(true)
      // GID 5 (Collision block) has { collides: true }
      expect(loader.collidingGids.has(5)).toBe(true)
      // GID 1 (Grass base) has { collides: false }
      expect(loader.collidingGids.has(1)).toBe(false)
    })

    it('updates collision grid via setCollisionByProperty', () => {
      const loader = new MapLoader(fixtureData)
      loader.setCollisionByProperty({ collides: true }, 'walls')
      // Row 0 has wall tiles (GID 3), so (col 0, row 0) must collide
      expect(loader.isTileColliding(0, 0)).toBe(true)
    })
  })

  // =========================================================================
  // Mock Phaser Scene Mounting
  // =========================================================================
  describe('Phaser Scene Mounting Integration', () => {
    it('creates TilemapLayers and assigns depth in a Phaser Scene', () => {
      const createdLayers = new Map()
      const mockTilemap = {
        addTilesetImage: () => ({ name: 'placeholder_tiles' }),
        createLayer: (layerName) => {
          let currentDepth = 0
          let visible = true
          let collisionProps = null
          const layerObj = {
            name: layerName,
            setDepth: (d) => {
              currentDepth = d
              return layerObj
            },
            getDepth: () => currentDepth,
            setVisible: (v) => {
              visible = v
              return layerObj
            },
            setCollisionByProperty: (p) => {
              collisionProps = p
              return layerObj
            },
          }
          createdLayers.set(layerName, layerObj)
          return layerObj
        },
      }

      const mockScene = {
        make: {
          tilemap: () => mockTilemap,
        },
        physics: {
          add: {
            staticGroup: () => ({
              add: () => {},
            }),
            existing: () => {},
          },
        },
        add: {
          zone: (x, y, w, h) => ({ x, y, w, h }),
        },
      }

      const loader = new MapLoader(fixtureData)
      const mounted = loader.mount(mockScene)

      expect(mounted).toBeDefined()
      expect(createdLayers.has('ground')).toBe(true)
      expect(createdLayers.get('ground').getDepth()).toBe(LAYER_DEPTHS.ground)
      expect(createdLayers.get('overhead').getDepth()).toBe(LAYER_DEPTHS.overhead)
      expect(createdLayers.get('walls').getDepth()).toBe(LAYER_DEPTHS.walls)
    })
  })

  // =========================================================================
  // Robustness & Edge Cases
  // =========================================================================
  describe('Robustness, Point Testing & Error Handling', () => {
    it('throws when initialized with null or non-object map data', () => {
      expect(() => new MapLoader(null)).toThrow('MapLoader requires valid Tiled map data')
      expect(() => new MapLoader('invalid')).toThrow('MapLoader requires valid Tiled map data')
    })

    it('reports missing layers when an incomplete map is loaded', () => {
      const incomplete = {
        ...fixtureData,
        layers: fixtureData.layers.filter((l) => l.name !== 'collision' && l.name !== 'overhead'),
      }
      const loader = new MapLoader(incomplete)
      const validation = loader.validateLayers()
      expect(validation.valid).toBe(false)
      expect(validation.missing).toContain('collision')
      expect(validation.missing).toContain('overhead')
    })

    it('tests isBlockedPoint against collision tiles and prop footprints', () => {
      const loader = new MapLoader(fixtureData)

      // Point inside collision tile (col 4, row 4) -> x: 140, y: 140
      expect(loader.isBlockedPoint(140, 140)).toBe(true)

      // Point inside cottage footprint (x: 224..288, y: 128..160) -> x: 230, y: 135
      expect(loader.isBlockedPoint(230, 135)).toBe(true)

      // Point in open grass -> x: 32, y: 200
      expect(loader.isBlockedPoint(32, 200)).toBe(false)

      // Point out of bounds -> negative or beyond dimensions
      expect(loader.isBlockedPoint(-5, 50)).toBe(true)
      expect(loader.isBlockedPoint(400, 50)).toBe(true)
    })

    it('allows player to walk under prop tall canopy above footprint', () => {
      const loader = new MapLoader(fixtureData)

      // Pine tree is at x: 64, y: 32 (height: 64).
      // Footprint is at x: 64, y: 80, width: 32, height: 16 (bottom stem).
      // Upper foliage at y in [32..79] is marked tall: true and has no collision.
      // Point at (x: 80, y: 50) is inside tree canopy but above footprint:
      expect(loader.isBlockedPoint(80, 50)).toBe(false)

      // Point at (x: 80, y: 88) is inside tree footprint:
      expect(loader.isBlockedPoint(80, 88)).toBe(true)
    })
  })
})
