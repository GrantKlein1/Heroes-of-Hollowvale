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
})
