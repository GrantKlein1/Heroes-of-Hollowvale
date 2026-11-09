import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Phaser Sprite & Scene structures for node test environment
vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }

      const texObj = scene?.textures?.get ? scene.textures.get(texture) : null
      const frameDef = texObj?._frameDef || {}

      this.frame = {
        name: frame,
        width: frameDef.w ?? 640,
        height: frameDef.h ?? 512,
        realWidth: frameDef.w ?? 640,
        realHeight: frameDef.h ?? 512,
        pivot: frameDef.pivot ?? { x: 0.5, y: 0.7812 },
      }
      this.originX = 0.5
      this.originY = 0.7812
      this.depth = 0
      this.scaleX = 1.0
      this.scaleY = 1.0
      this.body = {
        setSize: vi.fn(),
        setOffset: vi.fn(),
        setVelocity: vi.fn(),
        reset: vi.fn(),
        velocity: { x: 0, y: 0 },
        bottom: y,
      }
      this.anims = {
        play: vi.fn((key) => {
          this.anims.currentAnim = { key }
          return this
        }),
        currentAnim: null,
      }
    }

    setOrigin(x, y) {
      this.originX = x
      this.originY = y !== undefined ? y : x
      return this
    }

    setScale(s) {
      this.scaleX = s
      this.scaleY = s
      return this
    }

    setDepth(d) {
      this.depth = d
      return this
    }

    setTexture(key, frame) {
      this.texture = { key }
      const texObj = this.scene?.textures?.get ? this.scene.textures.get(key) : null
      const frameDef = texObj?._frameDef || {}
      this.frame = {
        name: frame,
        width: frameDef.w ?? 640,
        height: frameDef.h ?? 512,
        realWidth: frameDef.w ?? 640,
        realHeight: frameDef.h ?? 512,
        pivot: frameDef.pivot ?? { x: 0.5, y: 0.7812 },
      }
      return this
    }
  }

  return {
    default: {
      Physics: {
        Arcade: {
          Sprite: MockSprite,
        },
      },
      GameObjects: {
        Sprite: MockSprite,
      },
    },
  }
})

import { Dragon, DEFAULT_BOSS_SCALE, HOVER_ELEVATION_PX, DRAGON_FOOTPRINT, DRAGON_HURTBOX } from '../Dragon.js'
import { AssetRegistry } from '../../assets/AssetRegistry.js'
import defaultManifest from '../../../../public/assets/manifest.json'
import defaultAttacks from '../../../../public/assets/boss/red_dragon/attacks.json'

function createMockBossScene() {
  const queuedAtlases = []
  const loadedTextureMap = new Map()
  const createdAnims = new Map()

  const scene = {
    add: {
      existing: vi.fn((obj) => obj),
    },
    physics: {
      add: {
        existing: vi.fn((obj) => obj),
      },
    },
    load: {
      atlas: vi.fn((key, image, json) => {
        queuedAtlases.push({ key, image, json })
        // Simulate immediate texture registration in Phaser cache
        if (!loadedTextureMap.has(key)) {
          loadedTextureMap.set(key, {
            key,
            customData: {},
            getFrameNames: () => [],
            get: () => null,
          })
        }
      }),
      isLoading: vi.fn(() => false),
      start: vi.fn(),
      list: { size: 0 },
    },
    textures: {
      exists: vi.fn((key) => loadedTextureMap.has(key)),
      get: vi.fn((key) => loadedTextureMap.get(key) || null),
      getTextureKeys: vi.fn(() => Array.from(loadedTextureMap.keys())),
      remove: vi.fn((key) => loadedTextureMap.delete(key)),
      _addTexture: (key, textureObj) => loadedTextureMap.set(key, textureObj),
      _map: loadedTextureMap,
    },
    anims: {
      create: vi.fn((config) => {
        createdAnims.set(config.key, config)
        return config
      }),
      exists: vi.fn((key) => createdAnims.has(key)),
      remove: vi.fn((key) => createdAnims.delete(key)),
      _created: createdAnims,
    },
    queuedAtlases,
  }

  scene.assetRegistry = new AssetRegistry(scene, defaultManifest)
  return scene
}

describe('Dragon Actor — Package 3b-1', () => {
  let mockScene

  beforeEach(() => {
    mockScene = createMockBossScene()
  })

  describe('Boss Scale Independence', () => {
    it('initializes with default boss scale 1.0', () => {
      const dragon = new Dragon(mockScene, 100, 200)

      expect(dragon.bossScale).toBe(DEFAULT_BOSS_SCALE)
      expect(dragon.scaleX).toBe(1.0)
      expect(dragon.scaleY).toBe(1.0)
    })

    it('accepts a custom boss scale and does not inherit player integer scale', () => {
      // Suppose scene had a playerIntegerScale of 3
      mockScene._playerIntegerScale = 3

      const dragon = new Dragon(mockScene, 100, 200, 'red_dragon_p1_a', '', { scale: 1.5 })

      expect(dragon.bossScale).toBe(1.5)
      expect(dragon.scaleX).toBe(1.5)
      expect(dragon.scaleY).toBe(1.5)

      // Footprint should scale by 1.5
      const footprint = dragon.getFootprint()
      expect(footprint.w).toBe(DRAGON_FOOTPRINT.w * 1.5)
      expect(footprint.h).toBe(DRAGON_FOOTPRINT.h * 1.5)

      // Hurtbox should scale by 1.5
      const hurtbox = dragon.getHurtbox()
      expect(hurtbox.w).toBe(DRAGON_HURTBOX.w * 1.5)
      expect(hurtbox.h).toBe(DRAGON_HURTBOX.h * 1.5)
    })
  })

  describe('Lazy-Loading and Eviction per Phase (Acceptance Criterion 1)', () => {
    it('loads only current phase pages and evicts previous phase pages on transition', () => {
      // 1. Initial Phase 1 loading
      mockScene.assetRegistry.loadDragonPhase(1)
      const dragon = new Dragon(mockScene, 300, 300, 'red_dragon_p1_a', '', { phase: 1 })

      const phase1Keys = mockScene.textures.getTextureKeys()
      expect(phase1Keys).toContain('red_dragon_p1_a')
      expect(phase1Keys).toContain('red_dragon_p1_b')
      expect(phase1Keys).not.toContain('red_dragon_p2_a')
      expect(phase1Keys).not.toContain('red_dragon_p2_b')
      expect(phase1Keys).not.toContain('red_dragon_p2_land')
      expect(phase1Keys).not.toContain('red_dragon_p3_a')

      // Verify active dragon pages helper
      const activeP1 = mockScene.assetRegistry.getActiveDragonPages()
      expect(activeP1).toEqual(['red_dragon_p1_a', 'red_dragon_p1_b'])

      // 2. Transition to Phase 2: must evict phase 1 pages and load phase 2 (+p2_land)
      dragon.setPhase(2)

      const phase2Keys = mockScene.textures.getTextureKeys()
      expect(phase2Keys).not.toContain('red_dragon_p1_a')
      expect(phase2Keys).not.toContain('red_dragon_p1_b')
      expect(phase2Keys).toContain('red_dragon_p2_a')
      expect(phase2Keys).toContain('red_dragon_p2_b')
      expect(phase2Keys).toContain('red_dragon_p2_land')
      expect(phase2Keys).not.toContain('red_dragon_p3_a')

      const activeP2 = mockScene.assetRegistry.getActiveDragonPages()
      expect(activeP2.sort()).toEqual(['red_dragon_p2_a', 'red_dragon_p2_b', 'red_dragon_p2_land'].sort())

      // 3. Transition to Phase 3: must evict phase 2 pages and load phase 3
      dragon.setPhase(3)

      const phase3Keys = mockScene.textures.getTextureKeys()
      expect(phase3Keys).not.toContain('red_dragon_p1_a')
      expect(phase3Keys).not.toContain('red_dragon_p2_a')
      expect(phase3Keys).not.toContain('red_dragon_p2_b')
      expect(phase3Keys).not.toContain('red_dragon_p2_land')
      expect(phase3Keys).toContain('red_dragon_p3_a')
      expect(phase3Keys).toContain('red_dragon_p3_b')

      const activeP3 = mockScene.assetRegistry.getActiveDragonPages()
      expect(activeP3.sort()).toEqual(['red_dragon_p3_a', 'red_dragon_p3_b'].sort())
    })
  })

  describe('Frame Time on Phase Change (Acceptance Criterion 2)', () => {
    it('executes phase change transition well within 100 ms budget', () => {
      mockScene.assetRegistry.loadDragonPhase(1)
      const dragon = new Dragon(mockScene, 300, 300, 'red_dragon_p1_a', '', { phase: 1 })

      // Transition to Phase 2
      dragon.setPhase(2)
      expect(dragon.lastTransitionDurationMs).toBeLessThan(100)

      // Transition to Phase 3
      dragon.setPhase(3)
      expect(dragon.lastTransitionDurationMs).toBeLessThan(100)
    })
  })

  describe('Per-Frame Mouth Offsets from Meta and attacks.json', () => {
    it('extracts per-frame mouth position and angle from attacks.json fallback', () => {
      const dragon = new Dragon(mockScene, 200, 400, 'red_dragon_p1_a', '', {
        attacks: defaultAttacks,
        phase: 1,
      })
      dragon.facing = 'left'

      // Firebreath frame 0 in attacks.json has { f: 0, x: 163.8, y: 191.7, angleDeg: -169.9 }
      // Relative to origin (320, 400): localX = 163.8 - 320 = -156.2, localY = 191.7 - 400 = -208.3
      const mouth = dragon.getMouthOffset('firebreath', 'left', 0)

      expect(mouth.x).toBeCloseTo(-156.2, 1)
      expect(mouth.y).toBeCloseTo(-208.3, 1)
      expect(mouth.angleDeg).toBeCloseTo(-169.9, 1)
      expect(mouth.worldX).toBeCloseTo(200 - 156.2, 1)
      expect(mouth.worldY).toBeCloseTo(400 - 208.3, 1)
    })

    it('prioritizes active atlas meta perFrame mouth data if present', () => {
      const mockMeta = {
        animations: {
          firebreath_left: {
            perFrame: {
              0: {
                mouth: { x: -156.2, y: -208.3 },
                mouthAngleDeg: -170.0,
              },
            },
          },
        },
      }

      mockScene.textures._addTexture('red_dragon_p1_a', {
        key: 'red_dragon_p1_a',
        customData: { meta: mockMeta },
      })

      const dragon = new Dragon(mockScene, 100, 100, 'red_dragon_p1_a')
      dragon.facing = 'left'

      const mouth = dragon.getMouthOffset('firebreath', 'left', 0)
      expect(mouth.x).toBeCloseTo(-156.2)
      expect(mouth.y).toBeCloseTo(-208.3)
      expect(mouth.angleDeg).toBe(-170.0)
    })
  })

  describe('Per-Frame Hitboxes from Meta and attacks.json', () => {
    it('returns active hitbox on hit frames and null on inactive frames', () => {
      const mockMeta = {
        animations: {
          claw_right: {
            perFrame: {
              2: {
                hitbox: { x: 120, y: -80, w: 90, h: 60 },
              },
              4: {
                hitbox: { x: 130, y: -85, w: 95, h: 65 },
              },
            },
          },
        },
      }

      mockScene.textures._addTexture('red_dragon_p1_a', {
        key: 'red_dragon_p1_a',
        customData: { meta: mockMeta },
      })

      const dragon = new Dragon(mockScene, 100, 100, 'red_dragon_p1_a', '', {
        attacks: defaultAttacks,
      })
      dragon.facing = 'right'

      // Frame 0 is windup, not an active hit
      expect(dragon.isHitFrame('claw', 0)).toBe(false)
      expect(dragon.getHitbox('claw', 'right', 0)).toBeNull()

      // Frame 2 is active claw hit frame (in defaultAttacks.claw.hitFrames = [2, 4])
      expect(dragon.isHitFrame('claw', 2)).toBe(true)
      const hit2 = dragon.getHitbox('claw', 'right', 2)
      expect(hit2).toEqual({ x: 120, y: -80, w: 90, h: 60 })

      // Frame 4 is active claw hit frame
      expect(dragon.isHitFrame('claw', 4)).toBe(true)
      const hit4 = dragon.getHitbox('claw', 'right', 4)
      expect(hit4).toEqual({ x: 130, y: -85, w: 95, h: 65 })
    })

    it('scales hitboxes by bossScale and offsets to world coordinates when requested', () => {
      const mockMeta = {
        animations: {
          tail_left: {
            perFrame: {
              3: {
                hitbox: { x: -150, y: -50, w: 100, h: 70 },
              },
            },
          },
        },
      }

      mockScene.textures._addTexture('red_dragon_p1_a', {
        key: 'red_dragon_p1_a',
        customData: { meta: mockMeta },
      })

      const dragon = new Dragon(mockScene, 500, 600, 'red_dragon_p1_a', '', {
        scale: 2.0,
      })
      dragon.facing = 'left'

      const localHitbox = dragon.getHitbox('tail', 'left', 3, false)
      expect(localHitbox).toEqual({
        x: -300, // -150 * 2.0
        y: -100, // -50 * 2.0
        w: 200,  // 100 * 2.0
        h: 140,  // 70 * 2.0
      })

      const worldHitbox = dragon.getHitbox('tail', 'left', 3, true)
      expect(worldHitbox).toEqual({
        x: 500 - 300,
        y: 600 - 100,
        w: 200,
        h: 140,
      })
    })
  })

  describe('Phase 2 Hover & Post-Volley Landing Mechanics', () => {
    it('applies 52px elevation lift to hurtbox in Phase 2 hover while keeping footprint grounded', () => {
      const dragon = new Dragon(mockScene, 200, 200, 'red_dragon_p2_a', '', { phase: 2 })

      expect(dragon.airborne).toBe(true)
      expect(dragon.elevation).toBe(HOVER_ELEVATION_PX)

      // Footprint must stay at origin (ground level)
      const footprint = dragon.getFootprint()
      expect(footprint.y).toBe(DRAGON_FOOTPRINT.y)

      // Hurtbox must be raised by 52px (-131 - 52 = -183)
      const hurtbox = dragon.getHurtbox()
      expect(hurtbox.y).toBe(DRAGON_HURTBOX.y - HOVER_ELEVATION_PX)
    })

    it('lands after volley: switches to p2_land, resets elevation to 0, and takeoff restores hover', () => {
      const dragon = new Dragon(mockScene, 200, 200, 'red_dragon_p2_a', '', { phase: 2 })

      expect(dragon.airborne).toBe(true)

      // Flying dragon lands after each volley
      const landed = dragon.landAfterVolley()
      expect(landed).toBe(true)
      expect(dragon.isLanding).toBe(true)
      expect(dragon.airborne).toBe(false)
      expect(dragon.elevation).toBe(0)
      expect(dragon.texture.key).toBe('red_dragon_p2_land')

      // Ground hurtbox is restored
      expect(dragon.getHurtbox().y).toBe(DRAGON_HURTBOX.y)

      // Takeoff back into hover
      const tookOff = dragon.takeoff()
      expect(tookOff).toBe(true)
      expect(dragon.airborne).toBe(true)
      expect(dragon.elevation).toBe(HOVER_ELEVATION_PX)
      expect(dragon.getHurtbox().y).toBe(DRAGON_HURTBOX.y - HOVER_ELEVATION_PX)
    })
  })

  describe('Exclusive dragon_fx_v2 Enforcement (Acceptance Criterion 3)', () => {
    it('manifest includes dragon_fx_v2 and excludes legacy v1 dragon_fx', () => {
      const bossGroup = defaultManifest.groups?.boss || []
      expect(bossGroup).toContain('dragon_fx_v2')
      expect(bossGroup).not.toContain('dragon_fx')

      const fxDef = defaultManifest.assets?.dragon_fx_v2
      expect(fxDef).toBeDefined()
      expect(fxDef.image).toContain('fx_v2/dragon_fx_v2.png')
      expect(fxDef.json).toContain('fx_v2/dragon_fx_v2.json')
    })

    it('throws error if attempting to load legacy v1 dragon_fx', () => {
      const customManifest = {
        groups: { test_v1: ['test_dragon_fx'] },
        assets: {
          test_dragon_fx: {
            id: 'test_dragon_fx',
            sheets: {
              dragon_fx: {
                key: 'dragon_fx',
                image: 'assets/boss/red_dragon/dragon_fx.png',
                json: 'assets/boss/red_dragon/dragon_fx.json',
              },
            },
          },
        },
      }
      const testRegistry = new AssetRegistry(mockScene, customManifest)
      expect(() => {
        testRegistry.loadGroup('test_v1')
      }).toThrow(/Legacy v1 dragon_fx is deprecated/i)
    })
  })
})
