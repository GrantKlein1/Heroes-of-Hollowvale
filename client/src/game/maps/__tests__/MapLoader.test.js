import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MapLoader,
  isTiledMapsEnabled,
  parsePropFootprint,
  resolvePropAtlasKeys,
  resolvePropFrame,
  detectPropAnimation,
  resolveNpcPlacement,
} from '../MapLoader.js'
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

  // =========================================================================
  // Package 2-3: Brackenford Tiled Map Integration
  // =========================================================================
  describe('Package 2-3: Brackenford Tiled Map & Multi-Tileset Integration', () => {
    const brackenfordPath = path.resolve(__dirname, '../../../../public/maps/brackenford.tmj')
    const brackenfordData = JSON.parse(fs.readFileSync(brackenfordPath, 'utf-8'))

    it('loads brackenford.tmj and verifies 640x384 league world metrics', () => {
      const loader = new MapLoader(brackenfordData)
      expect(loader.width).toBe(20)
      expect(loader.height).toBe(12)
      expect(loader.tileWidth).toBe(32)
      expect(loader.tileHeight).toBe(32)
      expect(loader.worldWidth).toBe(640)
      expect(loader.worldHeight).toBe(384)
      expect(loader.validateLayers().valid).toBe(true)
    })

    it('blocks movement on deep water tiles but allows passage over bridge planks and water fords', () => {
      const loader = new MapLoader(brackenfordData)

      // Row 7 has River Bracken (y in [224..256])
      // Col 2 (x: 80, y: 240) is deep water: must block
      expect(loader.isTileColliding(2, 7)).toBe(true)
      expect(loader.isBlockedPoint(80, 240)).toBe(true)

      // Col 5 (x: 176, y: 240) is bridge_plank: passable!
      expect(loader.isTileColliding(5, 7)).toBe(false)
      expect(loader.isBlockedPoint(176, 240)).toBe(false)

      // Col 6 (x: 208, y: 240) is bridge_plank: passable!
      expect(loader.isTileColliding(6, 7)).toBe(false)
      expect(loader.isBlockedPoint(208, 240)).toBe(false)

      // Col 9 (x: 304, y: 240) is water_ford: passable!
      expect(loader.isTileColliding(9, 7)).toBe(false)
      expect(loader.isBlockedPoint(304, 240)).toBe(false)

      // Col 10 (x: 336, y: 240) is water_ford: passable!
      expect(loader.isTileColliding(10, 7)).toBe(false)
      expect(loader.isBlockedPoint(336, 240)).toBe(false)

      // Col 15 (x: 496, y: 240) is deep water: must block
      expect(loader.isTileColliding(15, 7)).toBe(true)
      expect(loader.isBlockedPoint(496, 240)).toBe(true)
    })

    it('verifies barrier crossing sweep at maximum movement speed (300 px/s)', () => {
      const loader = new MapLoader(brackenfordData)

      // Thief with speed boost moving south at 300 px/s (5 px/frame at 60 FPS)
      // Moving toward deep water at (x: 80, y: 224..256)
      const collider = { x: 72, y: 192, width: 24, height: 16 }
      // Desired movement 50px south (would land inside y: 242, which is deep water)
      const sweepResult = loader.sweep(collider, 0, 50)

      expect(sweepResult.collided).toBe(true)
      expect(sweepResult.collidedY).toBe(true)
      // Player bottom edge must not penetrate deep water at y = 224
      expect(sweepResult.y + collider.height).toBeLessThanOrEqual(224)
    })

    it('verifies building base and roof paired coordinates and overhead non-collision', () => {
      const loader = new MapLoader(brackenfordData)

      const tavernBase = loader.propObjects.find((p) => p.name === 'tavern_base')
      const tavernRoof = loader.propObjects.find((p) => p.name === 'tavern_roof')
      expect(tavernBase).toBeDefined()
      expect(tavernRoof).toBeDefined()

      // Shared authored coordinates and untrimmed canvas dimensions
      expect(tavernBase.x).toBe(tavernRoof.x)
      expect(tavernBase.y).toBe(tavernRoof.y)
      expect(tavernBase.width).toBe(tavernRoof.width)
      expect(tavernBase.height).toBe(tavernRoof.height)
      expect(tavernBase.feetY).toBe(tavernRoof.feetY)

      // Base collides, roof has shape 'none' and does not collide
      expect(tavernBase.footprint.shape).toBe('rect')
      expect(tavernRoof.footprint.shape).toBe('none')
      expect(tavernRoof.footprint.width).toBe(0)
      expect(tavernRoof.footprint.height).toBe(0)

      // Only base is included in solid propFootprints
      const baseInFootprints = loader.propFootprints.some((p) => p.name === 'tavern_base')
      const roofInFootprints = loader.propFootprints.some((p) => p.name === 'tavern_roof')
      expect(baseInFootprints).toBe(true)
      expect(roofInFootprints).toBe(false)
    })

    it('advances water animation frames across 4 steps via stepWaterAnimation', () => {
      const loader = new MapLoader(brackenfordData)

      const putTiles = []
      const mockGroundLayer = {
        name: 'ground',
        putTileAt: (gid, col, row) => {
          putTiles.push({ gid, col, row })
        },
      }
      loader.tilemapLayers.set('ground', mockGroundLayer)
      loader._initWaterAnimation({})

      expect(loader.waterTiles.length).toBeGreaterThan(0)
      expect(loader.waterFrame).toBe(0)

      // Step 1: frame 1 (+16 GID offset)
      putTiles.length = 0
      loader.stepWaterAnimation()
      expect(loader.waterFrame).toBe(1)
      expect(putTiles.length).toBe(loader.waterTiles.length)
      expect(putTiles[0].gid).toBe(41 + loader.waterTiles[0].baseTileId + 16)

      // Step 2: frame 2 (+32 GID offset)
      putTiles.length = 0
      loader.stepWaterAnimation()
      expect(loader.waterFrame).toBe(2)
      expect(putTiles[0].gid).toBe(41 + loader.waterTiles[0].baseTileId + 32)

      // Step 3: frame 3 (+48 GID offset)
      putTiles.length = 0
      loader.stepWaterAnimation()
      expect(loader.waterFrame).toBe(3)
      expect(putTiles[0].gid).toBe(41 + loader.waterTiles[0].baseTileId + 48)

      // Step 4: cycles back to frame 0 (0 offset)
      putTiles.length = 0
      loader.stepWaterAnimation()
      expect(loader.waterFrame).toBe(0)
      expect(putTiles[0].gid).toBe(41 + loader.waterTiles[0].baseTileId)
    })

    it('documents and verifies AABB approximation for ellipse footprints', () => {
      const loader = new MapLoader(brackenfordData)

      // Well has ellipse footprint
      const well = loader.propObjects.find((p) => p.name === 'well')
      expect(well).toBeDefined()
      expect(well.footprint.shape).toBe('ellipse')

      // The bounding AABB is used for 2D Arcade collision
      const wellFootprint = loader.propFootprints.find((p) => p.name === 'well')
      expect(wellFootprint).toBeDefined()
      expect(wellFootprint.bounds.width).toBe(28)
      expect(wellFootprint.bounds.height).toBe(20)

      // Point in center of well footprint blocks
      const cx = wellFootprint.bounds.x + wellFootprint.bounds.width / 2
      const cy = wellFootprint.bounds.y + wellFootprint.bounds.height / 2
      expect(loader.isBlockedPoint(cx, cy)).toBe(true)

      // Point just outside the bounding box does not block
      expect(loader.isBlockedPoint(wellFootprint.bounds.x - 2, cy)).toBe(false)
    })
  })

  // =========================================================================
  // Package 2-4: Multi-Atlas Props, Animated Props & NPC Sprites
  // =========================================================================
  describe('Package 2-4: Multi-Atlas Props, Animated Props & NPC Sprites', () => {
    describe('resolvePropAtlasKeys', () => {
      it('resolves options.propAtlasKeys array and csv string', () => {
        expect(resolvePropAtlasKeys({ propAtlasKeys: ['atlas_a', 'atlas_b'] })).toEqual(['atlas_a', 'atlas_b'])
        expect(resolvePropAtlasKeys({ propAtlasKeys: 'atlas_1, atlas_2' })).toEqual(['atlas_1', 'atlas_2'])
      })

      it('falls back to options.propAtlasKey', () => {
        expect(resolvePropAtlasKeys({ propAtlasKey: 'single_atlas' })).toEqual(['single_atlas'])
      })

      it('reads mapProperties.propAtlases if options do not specify keys', () => {
        expect(resolvePropAtlasKeys({}, { propAtlases: 'map_props, dungeon_props' })).toEqual([
          'map_props',
          'dungeon_props',
        ])
        expect(resolvePropAtlasKeys({}, { propAtlases: ['prop_a', 'prop_b'] })).toEqual(['prop_a', 'prop_b'])
      })

      it('defaults to ["village_props"] when none provided', () => {
        expect(resolvePropAtlasKeys({})).toEqual(['village_props'])
        expect(resolvePropAtlasKeys(null, null)).toEqual(['village_props'])
      })
    })

    describe('resolvePropFrame & Multi-Atlas Lookup', () => {
      const mockTextures = {
        exists: (key) => ['atlas_primary', 'atlas_secondary'].includes(key),
        get: (key) => {
          if (key === 'atlas_primary') {
            return { has: (frame) => ['barrel', 'crate'].includes(frame) }
          }
          if (key === 'atlas_secondary') {
            return { has: (frame) => ['hearth_burn_down_0', 'brazier'].includes(frame) }
          }
          return null
        },
      }

      it('resolves frame found in the first atlas', () => {
        const res = resolvePropFrame('barrel', ['atlas_primary', 'atlas_secondary'], mockTextures)
        expect(res).toEqual({ atlasKey: 'atlas_primary', frameName: 'barrel' })
      })

      it('resolves frame found only in subsequent atlas', () => {
        const res = resolvePropFrame('hearth_burn_down_0', ['atlas_primary', 'atlas_secondary'], mockTextures)
        expect(res).toEqual({ atlasKey: 'atlas_secondary', frameName: 'hearth_burn_down_0' })
      })

      it('returns null when frame is missing across all atlases', () => {
        const res = resolvePropFrame('missing_chest', ['atlas_primary', 'atlas_secondary'], mockTextures)
        expect(res).toBeNull()
      })
    })

    describe('detectPropAnimation', () => {
      const mockTexturesWithAnims = {
        get: (key) => {
          if (key === 'hearth_atlas') {
            return {
              customData: {
                meta: {
                  anims: {
                    burn: {
                      frames: 6,
                      fps: 8,
                      loop: true,
                      directions: ['down'],
                      frameNames: 'hearth_burn_down_<i>',
                    },
                  },
                },
              },
            }
          }
          return null
        },
      }

      it('detects anim template and returns animation key, fps, and frame list', () => {
        const createdAnims = []
        const mockAnims = {
          exists: () => false,
          create: (def) => createdAnims.push(def),
        }

        const animInfo = detectPropAnimation('hearth_atlas', 'hearth_burn_down_0', mockTexturesWithAnims, mockAnims)
        expect(animInfo).toBeDefined()
        expect(animInfo.fps).toBe(8)
        expect(animInfo.repeat).toBe(-1)
        expect(animInfo.frames).toHaveLength(6)
        expect(animInfo.frames).toContain('hearth_burn_down_0')
        expect(animInfo.frames).toContain('hearth_burn_down_5')
        expect(createdAnims).toHaveLength(1)
      })

      it('returns null for static props without matching animation frames', () => {
        const animInfo = detectPropAnimation('hearth_atlas', 'static_stone', mockTexturesWithAnims, null)
        expect(animInfo).toBeNull()
      })
    })

    describe('resolveNpcPlacement Math', () => {
      it('calculates feet coordinates, meta origin, and depth accurately', () => {
        const zone = {
          x: 200,
          y: 100,
          width: 64,
          height: 32,
        }
        const meta = {
          origin: {
            x: 0.5,
            y: 0.9375,
          },
        }

        const placement = resolveNpcPlacement(zone, meta)
        // feetX = x + width / 2 = 200 + 32 = 232
        expect(placement.feetX).toBe(232)
        // feetY = y + height = 100 + 32 = 132
        expect(placement.feetY).toBe(132)
        expect(placement.originX).toBe(0.5)
        expect(placement.originY).toBe(0.9375)
        expect(placement.depth).toBe(132)
      })

      it('falls back to origin 0.5, 1.0 when meta origin is omitted', () => {
        const zone = { x: 50, y: 50, width: 20, height: 40 }
        const placement = resolveNpcPlacement(zone, null)
        expect(placement.feetX).toBe(60)
        expect(placement.feetY).toBe(90)
        expect(placement.originX).toBe(0.5)
        expect(placement.originY).toBe(1.0)
      })
    })

    describe('mount Integration with Multi-Atlas Props & NPC Sprites', () => {
      it('spawns animated prop sprite and plays animation', () => {
        const mapWithProps = {
          ...fixtureData,
          layers: fixtureData.layers.map((l) => {
            if (l.name === 'props') {
              return {
                ...l,
                objects: [
                  {
                    id: 99,
                    name: 'hearth_burn_down_0',
                    x: 64,
                    y: 64,
                    width: 32,
                    height: 32,
                  },
                ],
              }
            }
            return l
          }),
        }

        const playedAnims = []
        const createdSprites = []
        const mockScene = {
          make: {
            tilemap: () => ({
              addTilesetImage: () => ({}),
              createLayer: () => ({ setDepth: () => {}, setCollisionByProperty: () => {}, setVisible: () => {} }),
            }),
          },
          textures: {
            exists: (key) => key === 'hearth_atlas',
            get: (key) => ({
              has: (frame) => frame === 'hearth_burn_down_0',
              customData: {
                meta: {
                  anims: {
                    burn: {
                      frames: 6,
                      fps: 8,
                      loop: true,
                      frameNames: 'hearth_burn_down_<i>',
                    },
                  },
                },
              },
            }),
          },
          anims: {
            exists: () => true,
          },
          add: {
            sprite: (x, y, key, frame) => {
              const spr = {
                x,
                y,
                key,
                frame,
                originX: 0,
                originY: 0,
                depth: 0,
                setOrigin: (ox, oy) => {
                  spr.originX = ox
                  spr.originY = oy
                  return spr
                },
                setDepth: (d) => {
                  spr.depth = d
                  return spr
                },
                play: (anim) => playedAnims.push(anim),
                destroy: () => {},
              }
              createdSprites.push(spr)
              return spr
            },
            image: () => ({ setOrigin: () => {}, setDepth: () => {}, destroy: () => {} }),
          },
        }

        const loader = new MapLoader(mapWithProps)
        const mounted = loader.mount(mockScene, { propAtlasKeys: ['hearth_atlas'] })

        expect(mounted.propSprites).toHaveLength(1)
        expect(playedAnims.length).toBeGreaterThanOrEqual(1)
        expect(playedAnims[0]).toBe('hearth_burn_down')
      })

      it('spawns NPC sprite when zone has sprite + facing, and skips silently when atlas missing', () => {
        const mapWithNpc = {
          ...fixtureData,
          layers: fixtureData.layers.map((l) => {
            if (l.name === 'zones') {
              return {
                ...l,
                objects: [
                  {
                    id: 101,
                    name: 'npc_guard',
                    type: 'npc',
                    x: 100,
                    y: 100,
                    width: 32,
                    height: 32,
                    properties: [
                      { name: 'sprite', value: 'guard_atlas' },
                      { name: 'facing', value: 'left' },
                    ],
                  },
                  {
                    id: 102,
                    name: 'npc_ghost',
                    type: 'npc',
                    x: 200,
                    y: 200,
                    width: 32,
                    height: 32,
                    properties: [
                      { name: 'sprite', value: 'missing_atlas' },
                      { name: 'facing', value: 'down' },
                    ],
                  },
                ],
              }
            }
            return l
          }),
        }

        const createdNpcSprites = []
        const playedAnims = []
        const mockScene = {
          make: {
            tilemap: () => ({
              addTilesetImage: () => ({}),
              createLayer: () => ({ setDepth: () => {}, setCollisionByProperty: () => {}, setVisible: () => {} }),
            }),
          },
          textures: {
            exists: (key) => key === 'guard_atlas', // missing_atlas does NOT exist
            get: (key) => ({
              has: () => true,
              customData: {
                meta: { origin: { x: 0.5, y: 0.92 } },
              },
            }),
          },
          anims: {
            exists: (k) => k === 'guard_atlas_idle_left',
          },
          add: {
            sprite: (x, y, key, frame) => {
              const spr = {
                x,
                y,
                key,
                frame,
                originX: 0,
                originY: 0,
                depth: 0,
                setOrigin: (ox, oy) => {
                  spr.originX = ox
                  spr.originY = oy
                  return spr
                },
                setDepth: (d) => {
                  spr.depth = d
                  return spr
                },
                play: (a) => playedAnims.push(a),
                destroy: () => {},
              }
              createdNpcSprites.push(spr)
              return spr
            },
            image: () => ({ setOrigin: () => {}, setDepth: () => {}, destroy: () => {} }),
          },
        }

        const loader = new MapLoader(mapWithNpc)
        const mounted = loader.mount(mockScene)

        // Only guard_atlas spawned (missing_atlas was skipped silently)
        expect(mounted.npcSprites).toHaveLength(1)
        expect(createdNpcSprites[0].key).toBe('guard_atlas')
        expect(createdNpcSprites[0].originY).toBe(0.92)
        expect(playedAnims).toContain('guard_atlas_idle_left')

        // Clean destroy cleans up both prop and npc sprites
        loader.destroy()
        expect(loader.npcSprites).toHaveLength(0)
      })
    })
  })
})
