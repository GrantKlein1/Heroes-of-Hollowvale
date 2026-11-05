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
        play: vi.fn(),
        currentAnim: null,
      }
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

import { Actor } from '../Actor.js'
import { FACING } from '../facing.js'
import { ACTOR_STATES } from '../stateMachine.js'

function createMockScene(textureMetaMap = {}) {
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
        const entry = textureMetaMap[key] || null
        if (!entry) return null
        const meta = entry.meta || entry
        const frameDef = entry.frameDef || {
          w: entry.w || 64,
          h: entry.h || 96,
          pivot: meta.origin || meta.anchor || null,
        }
        return {
          key,
          customData: { meta },
          _frameDef: frameDef,
          getFrameNames: () => ['frame_0'],
          get: () => ({
            customData: { pivot: meta.origin || meta.anchor || null },
          }),
        }
      }),
    },
  }
}

describe('Actor Base Class (Actor.js)', () => {
  let mockScene

  const knightMeta = {
    origin: { x: 0.5, y: 0.9271 },
    footprint: {
      x: -12,
      y: -4,
      w: 23,
      h: 7,
      shape: 'ellipse',
      note: 'collision footprint centred on feet',
    },
    hurtbox: {
      x: -14,
      y: -37,
      w: 28,
      h: 37,
      note: 'body hurtbox, bottom on feet',
    },
  }

  const goblinMeta = {
    origin: { x: 0.5, y: 0.9375 },
    footprint: {
      x: -13,
      y: -4,
      w: 26,
      h: 8,
      shape: 'ellipse',
      note: 'collision footprint centred on feet',
    },
  }

  beforeEach(() => {
    mockScene = createMockScene({
      knight: { meta: knightMeta, frameDef: { w: 64, h: 96, pivot: knightMeta.origin } },
      goblin: { meta: goblinMeta, frameDef: { w: 64, h: 64, pivot: goblinMeta.origin } },
    })
  })

  describe('Per-sheet feet origin resolution', () => {
    it('applies per-sheet feet origin dynamically from atlas metadata', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight', 'knight_walk_down_0')

      expect(actor.originX).toBeCloseTo(0.5, 4)
      expect(actor.originY).toBeCloseTo(0.9271, 4)
      expect(actor.anchor).toEqual({ x: 0.5, y: 0.9271 })
    })

    it('updates feet origin when sheet switches to another asset with different anchor', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight', 'knight_walk_down_0')
      expect(actor.originY).toBeCloseTo(0.9271, 4)

      actor.applySheetOrigin('goblin')
      expect(actor.originX).toBeCloseTo(0.5, 4)
      expect(actor.originY).toBeCloseTo(0.9375, 4)
    })

    it('falls back to (0.5, 0.5) when metadata is missing', () => {
      const actor = new Actor(mockScene, 100, 200, 'unknown_sheet')
      expect(actor.originX).toBe(0.5)
      expect(actor.originY).toBe(0.5)
    })
  })

  describe('Footprint collision body from metadata', () => {
    it('configures body size and offset relative to feet pivot', () => {
      // For knight: frame is 64x96.
      // originX = 0.5 -> pivotX = 32
      // originY = 0.9271 -> pivotY = Math.round(0.9271 * 96) = 89
      // footprint: { x: -12, y: -4, w: 23, h: 7 }
      // offsetX = 32 + (-12) = 20
      // offsetY = 89 + (-4) = 85
      const actor = new Actor(mockScene, 100, 200, 'knight', 'knight_walk_down_0')

      expect(actor.body.setSize).toHaveBeenCalledWith(23, 7, false)
      expect(actor.body.setOffset).toHaveBeenCalledWith(20, 85)
      expect(actor.footprint).toEqual(knightMeta.footprint)
      expect(actor.hurtbox).toEqual(knightMeta.hurtbox)
    })

    it('correctly adapts collision body to goblin footprint', () => {
      // For goblin: frame 64x64, origin (0.5, 0.9375) -> pivot (32, 60)
      // footprint: { x: -13, y: -4, w: 26, h: 8 }
      // offsetX = 32 - 13 = 19
      // offsetY = 60 - 4 = 56
      const actor = new Actor(mockScene, 50, 50, 'goblin')

      expect(actor.body.setSize).toHaveBeenCalledWith(26, 8, false)
      expect(actor.body.setOffset).toHaveBeenCalledWith(19, 56)
    })
  })

  describe('4-facing rule integration', () => {
    it('initializes with default facing "down"', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight')
      expect(actor.facing).toBe(FACING.DOWN)
    })

    it('updates facing based on velocity (dominant axis)', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight')

      // Moving right
      actor.updateFacing(150, 20)
      expect(actor.facing).toBe(FACING.RIGHT)

      // Moving up
      actor.updateFacing(-10, -120)
      expect(actor.facing).toBe(FACING.UP)

      // Moving left
      actor.updateFacing(-80, 10)
      expect(actor.facing).toBe(FACING.LEFT)

      // Moving down
      actor.updateFacing(5, 100)
      expect(actor.facing).toBe(FACING.DOWN)
    })

    it('retains previous facing on exact tie (acceptance criterion 1)', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight', '', { facing: 'up' })
      expect(actor.facing).toBe('up')

      // Stationary tie
      actor.updateFacing(0, 0)
      expect(actor.facing).toBe('up')

      // Diagonal tie
      actor.updateFacing(100, 100)
      expect(actor.facing).toBe('up')

      // Opposite diagonal tie
      actor.updateFacing(-50, 50)
      expect(actor.facing).toBe('up')
    })
  })

  describe('State machine delegation & input buffer', () => {
    it('delegates priority transitions to state machine (acceptance criterion 2)', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight')
      expect(actor.state).toBe(ACTOR_STATES.IDLE)

      // Higher priority interrupts lower
      expect(actor.transition('ATTACK')).toBe(true)
      expect(actor.state).toBe(ACTOR_STATES.ATTACK)

      // Lower priority cannot interrupt
      expect(actor.transition('WALK')).toBe(false)
      expect(actor.state).toBe(ACTOR_STATES.ATTACK)

      // Higher priority DODGE interrupts ATTACK
      expect(actor.transition('DODGE')).toBe(true)
      expect(actor.state).toBe(ACTOR_STATES.DODGE)
    })

    it('respects 150 ms input buffer window on Actor (acceptance criterion 3)', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight')
      // Enter attack with 500 ms duration
      actor.stateMachine.setState('ATTACK', { duration: 500, startTime: 0 })

      // Pressed 150 ms early (at t = 350 ms)
      actor.bufferInput('ATTACK', 350)

      // End of attack at 500 ms
      actor.update(500)
      // 150 ms early FIRES
      expect(actor.state).toBe(ACTOR_STATES.ATTACK)

      // Reset to attack
      actor.stateMachine.setState('ATTACK', { duration: 500, startTime: 0 })

      // Pressed 151 ms early (at t = 349 ms)
      actor.bufferInput('ATTACK', 349)

      // End of attack at 500 ms
      actor.update(500)
      // 151 ms early DOES NOT FIRE (falls back to IDLE)
      expect(actor.state).toBe(ACTOR_STATES.IDLE)
    })
  })

  describe('Animation & Depth utilities', () => {
    it('constructs correct 4-facing animation keys', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight', '', { facing: 'left' })
      expect(actor.getAnimKey('walk')).toBe('knight_walk_left')

      actor.setFacing('up')
      expect(actor.getAnimKey('attack')).toBe('knight_attack_up')
    })

    it('plays directional animation through anims component', () => {
      const actor = new Actor(mockScene, 100, 200, 'knight', '', { facing: 'right' })
      actor.playAnim('walk')

      expect(actor.anims.play).toHaveBeenCalledWith('knight_walk_right', true)
    })

    it('updates depth based on feet position (Y-sorting)', () => {
      const actor = new Actor(mockScene, 100, 250, 'knight')
      actor.body.bottom = 265
      actor.updateDepth()

      expect(actor.depth).toBe(265)
    })
  })
})
