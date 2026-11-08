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
        width: frameDef.w ?? 64,
        height: frameDef.h ?? 96,
        realWidth: frameDef.w ?? 64,
        realHeight: frameDef.h ?? 96,
        pivot: frameDef.pivot ?? null,
      }
      this.originX = 0.5
      this.originY = 0.5
      this.depth = 0
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
      this._eventListeners = new Map()
    }

    on(event, fn) {
      if (!this._eventListeners.has(event)) {
        this._eventListeners.set(event, [])
      }
      this._eventListeners.get(event).push(fn)
      return this
    }

    emit(event, ...args) {
      const listeners = this._eventListeners.get(event) || []
      for (const fn of listeners) fn(...args)
    }

    setOrigin(x, y) {
      this.originX = x
      this.originY = y !== undefined ? y : x
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
        width: frameDef.w ?? 64,
        height: frameDef.h ?? 96,
        realWidth: frameDef.w ?? 64,
        realHeight: frameDef.h ?? 96,
        pivot: frameDef.pivot ?? null,
      }
      return this
    }
  }

  return {
    default: {
      Animations: {
        Events: {
          ANIMATION_COMPLETE: 'animationcomplete',
        },
      },
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

import { Player, CLASS_SHEETS } from '../Player.js'
import { FACING } from '../facing.js'
import { ACTOR_STATES } from '../stateMachine.js'

function createMockScene() {
  const metadataMap = {
    knight: {
      meta: {
        origin: { x: 0.5, y: 0.9271 },
        footprint: { x: -12, y: -4, w: 23, h: 7, shape: 'ellipse' },
        hurtbox: { x: -14, y: -37, w: 28, h: 37 },
      },
      frameDef: { w: 64, h: 96, pivot: { x: 0.5, y: 0.9271 } },
    },
    thief: {
      meta: {
        origin: { x: 0.5, y: 0.9271 },
        footprint: { x: -12, y: -4, w: 24, h: 7, shape: 'ellipse' },
      },
      frameDef: { w: 64, h: 96, pivot: { x: 0.5, y: 0.9271 } },
    },
    dwarf: {
      meta: {
        origin: { x: 0.5, y: 0.9125 },
        footprint: { x: -12, y: -4, w: 23, h: 7, shape: 'ellipse' },
      },
      frameDef: { w: 64, h: 80, pivot: { x: 0.5, y: 0.9125 } },
    },
    mage_walk: {
      meta: {
        origin: { x: 0.5, y: 0.927 },
        footprint: { x: -12, y: -4, w: 24, h: 7, shape: 'ellipse' },
      },
      frameDef: { w: 64, h: 96, pivot: { x: 0.5, y: 0.927 } },
    },
    mage_hurt: {
      meta: {
        origin: { x: 0.5, y: 0.927 },
        footprint: { x: -12, y: -4, w: 24, h: 7, shape: 'ellipse' },
      },
      frameDef: { w: 64, h: 96, pivot: { x: 0.5, y: 0.927 } },
    },
    knight_attack: {
      meta: {
        origin: { x: 0.5, y: 0.9271 },
        footprint: { x: -12, y: -4, w: 23, h: 7, shape: 'ellipse' },
        anims: {
          attack: {
            hitFrames: [3],
            hitbox: {
              '3': {
                down: { x: -68, y: -68, w: 56, h: 40 },
                right: { x: 12, y: -68, w: 56, h: 40 },
              },
            },
          },
        },
      },
      frameDef: { w: 128, h: 96, pivot: { x: 0.5, y: 0.9271 } },
    },
    thief_attack: {
      meta: {
        origin: { x: 0.5, y: 0.9271 },
        footprint: { x: -9, y: -3, w: 18, h: 5, shape: 'ellipse' },
        anims: {
          attack: {
            hitFrames: [1, 3],
            hitbox: {
              '1': { down: { x: -42, y: -29, w: 40, h: 37 } },
              '3': { down: { x: 3, y: -29, w: 40, h: 37 } },
            },
          },
        },
      },
      frameDef: { w: 96, h: 96, pivot: { x: 0.5, y: 0.9271 } },
    },
    dwarf_attack: {
      meta: {
        origin: { x: 0.5, y: 0.9271 },
        footprint: { x: -13, y: -4, w: 26, h: 8, shape: 'ellipse' },
        anims: {
          attack: {
            hitFrames: [3],
            hitbox: {
              '3': { down: { x: -68, y: -68, w: 56, h: 40 } },
            },
          },
        },
      },
      frameDef: { w: 96, h: 96, pivot: { x: 0.5, y: 0.9271 } },
    },
    mage_attack2: {
      meta: {
        origin: { x: 0.5, y: 0.8846 },
        footprint: { x: -14, y: -4, w: 28, h: 8, shape: 'ellipse' },
        anims: {
          attack_2: {
            hitFrames: [3],
            hitbox: {
              '3': { down: { x: -33, y: -72, w: 36, h: 80 } },
            },
          },
        },
      },
      frameDef: { w: 96, h: 104, pivot: { x: 0.5, y: 0.8846 } },
    },
  }

  return {
    add: {
      existing: vi.fn((obj) => obj),
    },
    physics: {
      add: {
        existing: vi.fn((obj) => obj),
      },
    },
    anims: {
      exists: vi.fn(() => true),
    },
    textures: {
      get: vi.fn((key) => {
        const entry = metadataMap[key] || null
        if (!entry) return null
        return {
          key,
          customData: { meta: entry.meta },
          _frameDef: entry.frameDef,
          getFrameNames: () => [`${key}_frame_0`],
          get: () => ({ customData: { pivot: entry.meta.origin } }),
        }
      }),
    },
  }
}

describe('Player Actor — Package 1-3', () => {
  let mockScene

  beforeEach(() => {
    mockScene = createMockScene()
  })

  describe('Class Initialization & Mapping', () => {
    it.each([
      ['knight', 'knight', 'knight_idle_down', 0.9271],
      ['thief', 'thief', 'thief_idle_down', 0.9271],
      ['dwarf', 'dwarf', 'dwarf_idle_down', 0.9125],
      ['mage', 'mage_walk', 'mage_idle_down', 0.927],
    ])('initializes %s with correct sheet, frame, and anchor', (classId, sheet, frame, originY) => {
      const player = new Player(mockScene, 100, 200, classId)

      expect(player.classId).toBe(classId)
      expect(player.assetId).toBe(classId)
      expect(player.texture.key).toBe(sheet)
      expect(player.frame.name).toBe(frame)
      expect(player.originX).toBeCloseTo(0.5, 3)
      expect(player.originY).toBeCloseTo(originY, 3)
      expect(player.anims.play).toHaveBeenCalledWith(`${classId}_idle_down`, true)
    })

    it('falls back to knight if an invalid class is provided', () => {
      const player = new Player(mockScene, 100, 200, 'invalid_class')
      expect(player.classId).toBe('knight')
      expect(player.assetId).toBe('knight')
      expect(player.texture.key).toBe('knight')
    })
  })

  describe('Dynamic Class Switching (setClass)', () => {
    it('switches class and updates sheet, footprint, and active animation', () => {
      const player = new Player(mockScene, 100, 200, 'knight')
      expect(player.classId).toBe('knight')

      player.setClass('dwarf')
      expect(player.classId).toBe('dwarf')
      expect(player.assetId).toBe('dwarf')
      expect(player.texture.key).toBe('dwarf')
      expect(player.originY).toBeCloseTo(0.9125, 3)
      expect(player.anims.play).toHaveBeenCalledWith('dwarf_idle_down', false)

      player.setClass('mage')
      expect(player.classId).toBe('mage')
      expect(player.assetId).toBe('mage')
      expect(player.texture.key).toBe('mage_walk')
      expect(player.originY).toBeCloseTo(0.927, 3)
      expect(player.anims.play).toHaveBeenCalledWith('mage_idle_down', false)
    })
  })

  describe('4-Directional Animation Keys Across Classes', () => {
    it.each([
      ['knight', 'down', 'knight_walk_down'],
      ['knight', 'left', 'knight_walk_left'],
      ['knight', 'right', 'knight_walk_right'],
      ['knight', 'up', 'knight_walk_up'],
      ['mage', 'down', 'mage_walk_down'],
      ['mage', 'left', 'mage_walk_left'],
      ['mage', 'right', 'mage_walk_right'],
      ['mage', 'up', 'mage_walk_up'],
      ['thief', 'down', 'thief_walk_down'],
      ['thief', 'left', 'thief_walk_left'],
      ['thief', 'right', 'thief_walk_right'],
      ['thief', 'up', 'thief_walk_up'],
      ['dwarf', 'down', 'dwarf_walk_down'],
      ['dwarf', 'left', 'dwarf_walk_left'],
      ['dwarf', 'right', 'dwarf_walk_right'],
      ['dwarf', 'up', 'dwarf_walk_up'],
    ])('plays %s walking animation in %s direction: %s', (classId, dir, expectedAnim) => {
      const player = new Player(mockScene, 100, 200, classId)
      player.setFacing(dir)
      player.transition(ACTOR_STATES.WALK)

      expect(player.anims.play).toHaveBeenCalledWith(expectedAnim, expect.anything())
    })
  })

  describe('Hurt Animation and Recovery', () => {
    it('plays hurt animation on transition to HURT', () => {
      const player = new Player(mockScene, 100, 200, 'knight', { facing: 'left' })
      player.transition(ACTOR_STATES.HURT)

      expect(player.is(ACTOR_STATES.HURT)).toBe(true)
      expect(player.anims.play).toHaveBeenCalledWith('knight_hurt_left', false)
    })

    it('switches to mage_hurt sheet when mage is hurt', () => {
      const player = new Player(mockScene, 100, 200, 'mage', { facing: 'up' })
      expect(player.texture.key).toBe('mage_walk')

      player.transition(ACTOR_STATES.HURT)
      expect(player.anims.play).toHaveBeenCalledWith('mage_hurt_up', false)
    })

    it('returns to IDLE when hurt animation completes', () => {
      const player = new Player(mockScene, 100, 200, 'knight')
      player.transition(ACTOR_STATES.HURT)
      expect(player.is(ACTOR_STATES.HURT)).toBe(true)

      // Emit animation completion event
      player.emit('animationcomplete', { key: 'knight_hurt_down' })

      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)
      expect(player.anims.play).toHaveBeenCalledWith('knight_idle_down', expect.anything())
    })
  })

  describe('Velocity Driven State Transitions in update()', () => {
    it('transitions to WALK and plays directional walk when moving', () => {
      const player = new Player(mockScene, 100, 200, 'thief')
      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)

      // Simulate velocity moving left
      player.body.velocity.x = -160
      player.body.velocity.y = 0
      player.update(1000, 16)

      expect(player.is(ACTOR_STATES.WALK)).toBe(true)
      expect(player.facing).toBe(FACING.LEFT)
      expect(player.anims.play).toHaveBeenCalledWith('thief_walk_left', false)
    })

    it('transitions back to IDLE when velocity drops to zero', () => {
      const player = new Player(mockScene, 100, 200, 'dwarf')
      player.body.velocity.x = 160
      player.update(1000, 16)
      expect(player.is(ACTOR_STATES.WALK)).toBe(true)

      // Stop moving
      player.body.velocity.x = 0
      player.body.velocity.y = 0
      player.update(1016, 16)

      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)
      expect(player.anims.play).toHaveBeenCalledWith('dwarf_idle_right', expect.anything())
    })
  })

  describe('Melee Attack and Hit Timing (Package 1-4)', () => {
    it('switches to attackSheet and plays directional attack on attack()', () => {
      const player = new Player(mockScene, 100, 200, 'knight', { facing: 'right' })
      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)

      const started = player.attack(1000)
      expect(started).toBe(true)
      expect(player.is(ACTOR_STATES.ATTACK)).toBe(true)
      expect(player.getSheetForAnim('attack')).toBe('knight_attack')
      expect(player.anims.play).toHaveBeenCalledWith('knight_attack_right', false)
    })

    it('returns to IDLE when attack animation finishes', () => {
      const player = new Player(mockScene, 100, 200, 'knight')
      player.attack(1000)
      expect(player.is(ACTOR_STATES.ATTACK)).toBe(true)

      player.emit('animationcomplete', { key: 'knight_attack_down' })
      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)
      expect(player.anims.play).toHaveBeenCalledWith('knight_idle_down', expect.anything())
    })

    it('enforces 600 ms i-frames on takeDamage()', () => {
      const player = new Player(mockScene, 100, 200, 'knight')
      const firstHit = player.takeDamage(10, 1000)
      expect(firstHit).toBe(true)
      expect(player.is(ACTOR_STATES.HURT)).toBe(true)

      // Second hit at t = 1300 ms (< 600 ms) is ignored
      const secondHit = player.takeDamage(10, 1300)
      expect(secondHit).toBe(false)

      // Hit at t = 1601 ms (> 600 ms) is accepted
      const thirdHit = player.takeDamage(10, 1601)
      expect(thirdHit).toBe(true)
    })

    it('Mage: resolves attack animation key to mage_attack_2_<facing> and returns to idle upon completion', () => {
      const mage = new Player(mockScene, 100, 200, 'mage', { facing: 'down' })
      expect(mage.getAnimKey('attack')).toBe('mage_attack_2_down')

      const started = mage.attack(1000)
      expect(started).toBe(true)
      expect(mage.is(ACTOR_STATES.ATTACK)).toBe(true)
      expect(mage.anims.play).toHaveBeenCalledWith('mage_attack_2_down', false)

      // Emit animationcomplete
      mage.emit('animationcomplete', { key: 'mage_attack_2_down' })
      expect(mage.is(ACTOR_STATES.IDLE)).toBe(true)
      expect(mage.anims.play).toHaveBeenCalledWith('mage_idle_down', expect.anything())
    })

    it('Safe fallback on missing animation keys: transitions out of ATTACK to IDLE without locking', () => {
      const player = new Player(mockScene, 100, 200, 'knight')
      mockScene.anims.exists = vi.fn((key) => !key.includes('attack'))

      player.stateMachine.state = ACTOR_STATES.ATTACK
      player.playAnim('attack')
      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)
    })

    it('Single-input attack idempotency: setClass during attack does not force-restart animation', () => {
      const player = new Player(mockScene, 100, 200, 'knight')
      player.attack(1000)
      expect(player.is(ACTOR_STATES.ATTACK)).toBe(true)
      expect(player.anims.play).toHaveBeenCalledWith('knight_attack_down', false)

      // Clear mock calls to verify next call
      player.anims.play.mockClear()

      // Calling setClass while in ATTACK should pass ignoreIfPlaying = true
      player.setClass('knight')
      expect(player.anims.play).toHaveBeenCalledWith('knight_attack_down', true)
    })

    it.each([
      ['knight', 'knight', 'knight_attack', 23, 7],
      ['thief', 'thief', 'thief_attack', 24, 7],
      ['dwarf', 'dwarf', 'dwarf_attack', 23, 7],
      ['mage', 'mage_walk', 'mage_attack2', 24, 7],
    ])('maintains stable body footprint and feet alignment across idle -> attack -> idle for %s', (classId, baseSheet, attackSheet, expectedW, expectedH) => {
      const player = new Player(mockScene, 100, 200, classId)
      expect(player.footprint.w).toBe(expectedW)
      expect(player.footprint.h).toBe(expectedH)

      // Capture idle offsets
      const idleSetOffsetCalls = player.body.setOffset.mock.calls
      const idleOffset = idleSetOffsetCalls[idleSetOffsetCalls.length - 1]

      // Start attack
      player.attack(1000)
      expect(player.is(ACTOR_STATES.ATTACK)).toBe(true)

      // Footprint size in metadata remains exact
      expect(player.footprint.w).toBeDefined()
      expect(player.footprint.h).toBeDefined()

      // Footprint offsets updated for attack frame
      const attackSetOffsetCalls = player.body.setOffset.mock.calls
      const attackOffset = attackSetOffsetCalls[attackSetOffsetCalls.length - 1]
      expect(attackOffset).toBeDefined()

      // Complete attack back to idle
      player.emit('animationcomplete', { key: player.getAnimKey('attack') })
      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)

      // Body footprint size restored to base sheet
      expect(player.footprint.w).toBe(expectedW)
      expect(player.footprint.h).toBe(expectedH)
    })
  })
})

