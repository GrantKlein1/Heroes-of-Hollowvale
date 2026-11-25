import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

    setScale(sx, sy) {
      this.scaleX = sx
      this.scaleY = sy !== undefined ? sy : sx
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
import { session } from '../../session.js'
import { eventBus, GameEvents } from '../../../lib/eventBus.js'
import { getVialThrowTiming, VIAL_THROW_COOLDOWN_MS } from '../../combat/spells.js'
import mageSpellsV2Atlas from '../../../../public/assets/characters/mage/spells_v2/mage_spells_v2.json'
import { getBowTiming, getBowCooldownMs, getScaledArrowSpawnOffset, ARROW_FLY_ANIM, ARROW_HIT_ANIM } from '../../combat/bowShot.js'
import { getItemAnchor } from '../itemHold.js'
import { BOW_HAND_SCALE, ARROW_VISUAL_SCALE } from '../../items/registry.js'
import thiefUseThrowAtlas from '../../../../public/assets/characters/thief/thief_use_throw.json'
import * as hitSystem from '../../combat/hitSystem.js'

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
    knight_run: {
      meta: {
        origin: { x: 0.5, y: 0.9271 },
        footprint: { x: -12, y: -4, w: 23, h: 7, shape: 'ellipse' },
      },
      frameDef: { w: 64, h: 96, pivot: { x: 0.5, y: 0.9271 } },
    },
    knight_attack2: {
      meta: {
        origin: { x: 0.5, y: 0.9271 },
        footprint: { x: -12, y: -4, w: 23, h: 7, shape: 'ellipse' },
        anims: {
          attack_2: {
            hitFrames: [3],
            hitbox: {
              '3': { down: { x: -28, y: -24, w: 56, h: 28 } },
            },
          },
        },
      },
      frameDef: { w: 96, h: 96, pivot: { x: 0.5, y: 0.9271 } },
    },
    knight_charged: {
      meta: {
        origin: { x: 0.5, y: 0.9271 },
        footprint: { x: -12, y: -4, w: 23, h: 7, shape: 'ellipse' },
        anims: {
          charge_hold: {
            fps: 10,
            loop: true,
          },
          charged_release: {
            hitFrames: [4, 5],
            hitbox: {
              '4': { down: { x: -32, y: -26, w: 64, h: 32 } },
              '5': { down: { x: -32, y: -26, w: 64, h: 32 } },
            },
          },
        },
      },
      frameDef: { w: 96, h: 96, pivot: { x: 0.5, y: 0.9271 } },
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
      get: vi.fn((key) => ({ key, frames: [{}] })),
    },
    textures: {
      exists: vi.fn(() => true),
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

  describe('Dodge Mechanics (Package 1-6)', () => {
    it.each(['knight', 'mage', 'thief', 'dwarf'])('allows %s to initiate dodge with 600 ms cooldown', (classId) => {
      const player = new Player(mockScene, 100, 200, classId)
      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)

      const dodged = player.dodge(1000)
      expect(dodged).toBe(true)
      expect(player.is(ACTOR_STATES.DODGE)).toBe(true)
      expect(player.isDodging()).toBe(true)
      expect(player.anims.play).toHaveBeenCalledWith(`${classId}_dodge_down`, false)

      // Cooldown: second dodge at 1400 ms (< 1000 + 600 ms) is rejected
      const tooEarly = player.dodge(1400)
      expect(tooEarly).toBe(false)

      // Completing dodge animation returns player to IDLE
      player.emit('animationcomplete', { key: `${classId}_dodge_down` })
      expect(player.is(ACTOR_STATES.IDLE)).toBe(true)
      expect(player.isDodging()).toBe(false)

      // After 600 ms (at 1601 ms), dodge succeeds again
      const canDodgeAgain = player.dodge(1601)
      expect(canDodgeAgain).toBe(true)
      expect(player.is(ACTOR_STATES.DODGE)).toBe(true)
    })

    it('Dodging through an attack takes 0 damage during i-frames', () => {
      const player = new Player(mockScene, 100, 200, 'knight')
      player.dodge(1000)
      expect(player.isDodging()).toBe(true)

      // Mock current frame index inside iFrames [1, 4]
      player.anims.currentFrame = {
        frame: { name: 'knight_dodge_down_2' },
        index: 3,
      }

      const tookDamage = player.takeDamage(15, 1150)
      expect(tookDamage).toBe(false)
      expect(player.is(ACTOR_STATES.DODGE)).toBe(true) // Not interrupted into HURT
    })

    it('Updates position along facing direction during dodge frames', () => {
      const player = new Player(mockScene, 100, 200, 'knight', { facing: 'right' })
      player.dodge(1000)

      // Frame 1: travel reaches 7.2px
      player.anims.currentFrame = { frame: { name: 'knight_dodge_right_1' }, index: 2 }
      player.update(1062, 16)
      expect(player.x).toBeCloseTo(107.2)

      // Frame 2: travel reaches 21.6px (+14.4px)
      player.anims.currentFrame = { frame: { name: 'knight_dodge_right_2' }, index: 3 }
      player.update(1124, 16)
      expect(player.x).toBeCloseTo(121.6)
    })
  })

  describe('Knight Shield Block (Package 1-6)', () => {
    it('Only knight can initiate shield block; other classes reject it', () => {
      const knight = new Player(mockScene, 100, 200, 'knight')
      expect(knight.startBlock(1000)).toBe(true)
      expect(knight.is(ACTOR_STATES.BLOCK)).toBe(true)
      expect(knight.isBlocking()).toBe(true)
      expect(knight.anims.play).toHaveBeenCalledWith('knight_block_start_down', false)

      const mage = new Player(mockScene, 100, 200, 'mage')
      expect(mage.startBlock(1000)).toBe(false)
      expect(mage.isBlocking()).toBe(false)
    })

    it('Advances from block_start to block_hold on animation complete', () => {
      const knight = new Player(mockScene, 100, 200, 'knight')
      knight.startBlock(1000)
      expect(knight.blockState.stage).toBe('start')

      knight.emit('animationcomplete', { key: 'knight_block_start_down' })
      expect(knight.blockState.stage).toBe('hold')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_block_hold_down', true)

      // stopBlock returns knight to IDLE
      knight.stopBlock()
      expect(knight.is(ACTOR_STATES.IDLE)).toBe(true)
      expect(knight.isBlocking()).toBe(false)
    })

    it('Reduces frontal incoming damage by 70% and plays block_hit', () => {
      const knight = new Player(mockScene, 100, 100, 'knight', { facing: 'right' })
      knight.startBlock(1000)

      // Attacker in front (x: 140, y: 100)
      const tookDamage = knight.takeDamage(10, 1050, { fromX: 140, fromY: 100 })
      expect(tookDamage).toBe(true)
      expect(knight.lastDamageTaken).toBe(3) // 10 * (1 - 0.70) = 3
      expect(knight.anims.play).toHaveBeenCalledWith('knight_block_hit_right', false)
      expect(knight.is(ACTOR_STATES.BLOCK)).toBe(true) // Remains in block
    })

    it('Does not reduce damage when struck from behind; enters HURT', () => {
      const knight = new Player(mockScene, 100, 100, 'knight', { facing: 'right' })
      knight.startBlock(1000)

      // Attacker behind knight (x: 60, y: 100)
      const tookDamage = knight.takeDamage(10, 1050, { fromX: 60, fromY: 100 })
      expect(tookDamage).toBe(true)
      expect(knight.lastDamageTaken).toBe(10) // Full damage
      expect(knight.is(ACTOR_STATES.HURT)).toBe(true)
    })
  })

  describe('Death and Stealth (Package 1-6)', () => {
    it.each(['knight', 'mage', 'thief', 'dwarf'])('plays real death animation and freezes on frame 9 for %s', (classId) => {
      const player = new Player(mockScene, 100, 200, classId)
      player.die()

      expect(player.is(ACTOR_STATES.DEAD)).toBe(true)
      expect(player.anims.play).toHaveBeenCalledWith(`${classId}_death_down`, false)
      expect(player.attack()).toBe(false)
      expect(player.dodge()).toBe(false)
    })

    it('supports thief vanish and reappear stealth mechanics', () => {
      const thief = new Player(mockScene, 100, 200, 'thief')
      expect(thief.vanish(1000)).toBe(true)
      expect(thief.anims.play).toHaveBeenCalledWith('thief_vanish_down', false)

      thief.emit('animationcomplete', { key: 'thief_vanish_down' })
      expect(thief.vanishState.invisible).toBe(true)
      expect(thief.visible).toBe(false)

      expect(thief.reappear(2000)).toBe(true)
      expect(thief.visible).toBe(true)
      expect(thief.anims.play).toHaveBeenCalledWith('thief_reappear_down', false)
    })
  })

  describe('P2 Hero Animation & Combat (Package 4-1)', () => {
    it.each(['knight', 'thief', 'dwarf', 'mage'])('configures run, attack2, and charged sheets for %s', (classId) => {
      const player = new Player(mockScene, 100, 100, classId)
      expect(CLASS_SHEETS[classId].runSheet).toBe(`${classId}_run`)
      expect(CLASS_SHEETS[classId].attack2Sheet).toBe(`${classId}_attack2`)
      expect(CLASS_SHEETS[classId].chargedSheet).toBe(`${classId}_charged`)
      expect(player.getSheetForAnim('run')).toBe(`${classId}_run`)
      expect(player.getSheetForAnim('attack_2')).toBe(`${classId}_attack2`)
      expect(player.getSheetForAnim('charge_hold')).toBe(`${classId}_charged`)
      expect(player.getSheetForAnim('charged_release')).toBe(`${classId}_charged`)
    })

    it('generates canonical P2 anim keys for all 4 classes', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      expect(knight.getAnimKey('run', 'down')).toBe('knight_run_down')
      expect(knight.getAnimKey('attack_2', 'left')).toBe('knight_attack_2_left')
      expect(knight.getAnimKey('charge_hold', 'up')).toBe('knight_charge_hold_up')
      expect(knight.getAnimKey('charged_release', 'right')).toBe('knight_charged_release_right')

      const thief = new Player(mockScene, 100, 100, 'thief')
      expect(thief.getAnimKey('run', 'right')).toBe('thief_run_right')
      expect(thief.getAnimKey('attack_2', 'up')).toBe('thief_attack_2_up')

      const mage = new Player(mockScene, 100, 100, 'mage')
      expect(mage.getAnimKey('run', 'down')).toBe('mage_run_down')
      expect(mage.getAnimKey('attack_2', 'down')).toBe('mage_attack_2_down')
    })

    it('plays run animation when moving at run speed', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      knight.body.velocity = { x: 200, y: 0 } // Moving at 200 > 160 * 1.2 = 192 px/s
      knight.update(1000, 16)

      expect(knight.is(ACTOR_STATES.WALK)).toBe(true)
      expect(knight.anims.play).toHaveBeenCalledWith('knight_run_right', true)

      // Slow down to walk speed
      knight.body.velocity = { x: 100, y: 0 }
      knight.update(1016, 16)
      expect(knight.anims.play).toHaveBeenCalledWith('knight_walk_right', true)
    })

    it('fires knight hit frame 3 once when Phaser skips from frame 1 to 5', () => {
      const meleeSpy = vi.spyOn(hitSystem, 'executePlayerMeleeHit').mockReturnValue(0)
      const knight = new Player(mockScene, 100, 100, 'knight')
      knight.attack(1000)

      knight.anims.currentFrame = { frame: { name: 'knight_attack_down_1' } }
      knight.update(1016, 16)
      expect(meleeSpy).not.toHaveBeenCalled()

      knight.anims.currentFrame = { frame: { name: 'knight_attack_down_5' } }
      knight.update(1100, 400)

      expect(meleeSpy).toHaveBeenCalledTimes(1)
      expect(meleeSpy).toHaveBeenCalledWith(knight, 3, 1100, 'attack')
      expect(knight._hitFramesProcessed.has(3)).toBe(true)
      meleeSpy.mockRestore()
    })

    it('chains attack_2 combo on second attack press inside combo window', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      const now = 1000

      // Initial swing
      knight.attack(now)
      expect(knight.is(ACTOR_STATES.ATTACK)).toBe(true)
      expect(knight.currentAttackType).toBe('attack')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_attack_down', false)

      // Simulate advance to frame 3 (combo window open)
      knight.anims.currentFrame = { frame: { name: 'knight_attack_down_3' } }

      // Second attack press inside combo window
      const chained = knight.attack(now + 200)
      expect(chained).toBe(true)
      expect(knight.currentAttackType).toBe('attack_2')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_attack_2_down', false)

      // Advance to attack_2 hit frame (frame 3)
      knight.anims.currentFrame = { frame: { name: 'knight_attack_2_down_3' } }
      knight.update(now + 300, 16)
      expect(knight._hitFramesProcessed.has(3)).toBe(true)
    })

    it('queues attack_2 combo if second press occurs before combo window and triggers at frame 3', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      knight.attack(1000)

      // At frame 1 (before combo window)
      knight.anims.currentFrame = { frame: { name: 'knight_attack_down_1' } }
      knight.attack(1050)
      expect(knight.comboQueued).toBe(true)
      expect(knight.currentAttackType).toBe('attack')

      // Advance to frame 3
      knight.anims.currentFrame = { frame: { name: 'knight_attack_down_3' } }
      knight.update(1200, 16)
      expect(knight.comboQueued).toBe(false)
      expect(knight.currentAttackType).toBe('attack_2')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_attack_2_down', false)
    })

    it('supports charged attack hold and release on hold >= 600 ms', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      const startTime = 1000

      // Start charge
      expect(knight.startCharge(startTime)).toBe(true)
      expect(knight.is(ACTOR_STATES.ATTACK)).toBe(true)
      expect(knight.currentAttackType).toBe('charge_hold')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_charge_hold_down', false)

      // Update at 300 ms (not yet fully charged)
      knight.update(startTime + 300, 16)
      expect(knight.chargeState.charged).toBe(false)

      // Update at 600 ms (fully charged)
      knight.update(startTime + 600, 16)
      expect(knight.chargeState.charged).toBe(true)

      // Release charge
      expect(knight.releaseCharge(startTime + 650)).toBe(true)
      expect(knight.currentAttackType).toBe('charged_release')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_charged_release_down', false)

      // Advance to frame 4 (hitFrame of charged_release)
      knight.anims.currentFrame = { frame: { name: 'knight_charged_release_down_4' } }
      knight.update(startTime + 800, 16)
      expect(knight._hitFramesProcessed.has(4)).toBe(true)
    })

    it('falls back to regular attack if charge released before 600 ms', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      knight.startCharge(1000)
      knight.update(1000 + 200, 16) // only 200 ms held

      expect(knight.releaseCharge(1000 + 250)).toBe(true)
      expect(knight.currentAttackType).toBe('attack')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_attack_down', false)
    })

    it('supports setRunning and isAtRunSpeed checks', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      expect(knight.isAtRunSpeed()).toBe(false)
      knight.setRunning(true)
      expect(knight.isAtRunSpeed()).toBe(true)
      knight.setRunning(false)
      expect(knight.isAtRunSpeed()).toBe(false)
    })
  })

  describe('Mage cast v2 release (MS-1)', () => {
    beforeEach(() => {
      mockScene.projectiles = []
      mockScene.mana = 100
      session.mana = 100
      session.lifeLeechCooldownUntil = 0
    })

    it('plays the lightning v2 clip and withholds the bolt until 312.5 ms', () => {
      const mage = new Player(mockScene, 200, 350, 'mage', { facing: 'down' })
      expect(mage.cast('lightning', 1000)).toBe(true)
      expect(mockScene.mana).toBe(90)
      expect(session.mana).toBe(90)
      expect(mockScene.mana).toBeGreaterThanOrEqual(0)
      expect(mockScene.projectiles).toHaveLength(0)
      expect(mage.anims.currentAnim.key).toBe('mage_cast_lightning_v2_down')
      expect(mage.anims.play).not.toHaveBeenCalledWith('mage_cast_down', expect.anything())
      expect(mage.flipX).toBe(false)

      const pivot = mageSpellsV2Atlas.frames.mage_cast_lightning_v2_down_0.pivot
      expect(mage.originX).toBe(pivot.x)
      expect(mage.originY).toBe(pivot.y)

      mage.update(1000 + 312.5 - 62.5, 16)
      expect(mockScene.projectiles).toHaveLength(0)

      mage.update(1000 + 312.5, 16)
      expect(mockScene.projectiles).toHaveLength(1)
      const proj = mockScene.projectiles[0]
      const offset = mageSpellsV2Atlas.meta.spawnOffset.lightning.down
      expect(proj.texture.key).toBe('spell_fx_v2')
      expect(proj.flyAnim).toBe('lightning_bolt_v2')
      expect(proj.hitAnim).toBe('lightning_impact_v2')
      expect(Math.abs(proj.x - (mage.x + offset.x))).toBeLessThanOrEqual(2)
      expect(Math.abs(proj.y - (mage.y + offset.y))).toBeLessThanOrEqual(2)
      expect(mage._v2Cast.spawnedAt - mage._v2Cast.startedAt).toBe(312.5)
    })

    it('plays the leech v2 clip for another facing and spawns the orb on release', () => {
      const mage = new Player(mockScene, 80, 120, 'mage', { facing: 'right' })
      expect(mage.cast('leech', 4000)).toBe(true)
      expect(mockScene.mana).toBe(100)
      expect(session.mana).toBe(100)
      expect(mage.anims.currentAnim.key).toBe('mage_cast_leech_v2_right')
      expect(mage.anims.play).not.toHaveBeenCalledWith('mage_cast_right', expect.anything())
      expect(mockScene.projectiles).toHaveLength(0)

      mage.update(4000 + 250, 16)
      expect(mockScene.projectiles).toHaveLength(0)
      mage.update(4000 + 312.5, 16)

      const proj = mockScene.projectiles[0]
      const offset = mageSpellsV2Atlas.meta.spawnOffset.leech.right
      expect(proj.flyAnim).toBe('leech_orb_v2')
      expect(proj.hitAnim).toBe('leech_impact_v2')
      expect(proj.returnAnim).toBe('leech_return_v2')
      expect(proj.absorbAnim).toBe('leech_absorb_v2')
      expect(Math.abs(proj.x - (mage.x + offset.x))).toBeLessThanOrEqual(2)
      expect(Math.abs(proj.y - (mage.y + offset.y))).toBeLessThanOrEqual(2)
    })

    it('with 5 mana lightning casts nothing, notices, and never drops mana below 0', () => {
      mockScene._notices = []
      mockScene._notice = (msg) => {
        mockScene._notices.push(msg)
      }
      mockScene._attackUntil = 0
      mockScene.mana = 5
      session.mana = 5
      session.lifeLeechCooldownUntil = 0

      const mage = new Player(mockScene, 200, 350, 'mage', { facing: 'down' })
      expect(mage.cast('lightning', 1000)).toBe(false)
      expect(mockScene.mana).toBe(5)
      expect(session.mana).toBe(5)
      expect(mockScene._notices).toContain('Not enough mana.')
      expect(mockScene.projectiles).toHaveLength(0)
      expect(mage._v2Cast).toBeFalsy()
      expect(mage.currentAttackType).toBeNull()
      expect(mage.is(ACTOR_STATES.ATTACK)).toBe(false)
      expect(mockScene._attackUntil).toBe(0)
      expect(session.lifeLeechCooldownUntil).toBe(0)
      expect(mage.anims.play.mock.calls.some((call) => String(call[0]).includes('lightning'))).toBe(false)

      mockScene.mana = 0
      session.mana = 0
      mockScene._notices = []
      expect(mage.cast('lightning', 2000)).toBe(false)
      expect(mockScene.mana).toBe(0)
      expect(session.mana).toBe(0)
      expect(mage.is(ACTOR_STATES.ATTACK)).toBe(false)

      mockScene.mana = 10
      session.mana = 10
      expect(mage.cast('lightning', 3000)).toBe(true)
      expect(mockScene.mana).toBe(0)
      expect(session.mana).toBe(0)
      expect(mockScene.mana).toBeGreaterThanOrEqual(0)
    })

    it('still fires fireball immediately on the generic cast clip', () => {
      const mage = new Player(mockScene, 200, 350, 'mage', { facing: 'down' })
      expect(mage.cast('fireball', 1000)).toBe(true)
      expect(mage.anims.currentAnim.key).toBe('mage_cast_down')
      expect(mockScene.projectiles).toHaveLength(1)
      expect(mockScene.projectiles[0].texture.key).toBe('fireball')
      expect(mockScene.mana).toBe(85)
    })
  })

  describe('Package BF-1: Defense in depth for empty v2 cast clips', () => {
    it('casting Lightning and Leech with an empty clip does not throw and plays the cast fallback', () => {
      mockScene.anims.get = vi.fn((key) => {
        if (key && key.startsWith('mage_cast_') && key.includes('_v2_')) {
          return { key, frames: [] }
        }
        return { key, frames: [{}] }
      })
      mockScene.anims.exists = vi.fn(() => true)
      mockScene.textures = { exists: vi.fn(() => true) }

      const mage = new Player(mockScene, 200, 350, 'mage', { facing: 'down' })
      expect(() => {
        mage._v2Cast = {
          animKey: 'mage_cast_lightning_v2_down',
          spellId: 'lightning',
          facing: 'down',
          releaseFrame: 5,
          releaseMs: 312.5,
          startedAt: 1000,
        }
        mage._playV2CastBody()
      }).not.toThrow()

      expect(mage.anims.play).toHaveBeenCalledWith('mage_cast_down', false)

      mage.facing = 'right'
      mage._v2Cast = {
        animKey: 'mage_cast_leech_v2_right',
        spellId: 'leech',
        facing: 'right',
        releaseFrame: 5,
        releaseMs: 312.5,
        startedAt: 2000,
      }
      expect(() => {
        mage._playV2CastBody()
      }).not.toThrow()
      expect(mage.anims.play).toHaveBeenCalledWith('mage_cast_right', false)
    })
  })

  describe('Hero Item Hold and Use Animations (Package IT-1)', () => {
    beforeEach(() => {
      session.equippedId = null
      session.hotbarSlot = 0
    })

    it('picks hold_idle / hold_run only when a consumable is equipped', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      session.equippedId = 'healing_potion'

      // Idle with consumable plays knight_hold_idle_down
      knight.playAnim('idle')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_hold_idle_down', true)

      // Walk with consumable plays knight_hold_run_down
      knight.playAnim('walk')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_hold_run_down', true)

      // Run with consumable plays knight_hold_run_down
      knight.playAnim('run')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_hold_run_down', true)

      // With non-consumable (weapon or null), regular anims are played
      session.equippedId = 'iron_sword'
      knight.playAnim('idle')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_idle_down', true)

      session.equippedId = null
      knight.playAnim('walk')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_walk_down', true)
    })

    it('plays hold animations across all 4 heroes when consumable is equipped', () => {
      session.equippedId = 'mana_potion'
      for (const hero of ['knight', 'thief', 'dwarf', 'mage']) {
        const player = new Player(mockScene, 100, 100, hero)
        player.playAnim('idle')
        expect(player.anims.play).toHaveBeenCalledWith(`${hero}_hold_idle_down`, true)
      }
    })

    it('begins item use with drink or eat animation and overrides walk/run', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      session.equippedId = 'healing_potion'

      knight.beginItemUse('healing_potion', 1000)
      expect(knight.itemUseState.active).toBe(true)
      expect(knight.itemUseState.clip).toBe('use_drink')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_use_drink_down', false)

      // While using, walk and run do not override use animation
      knight.playAnim('walk')
      expect(knight.anims.play).not.toHaveBeenCalledWith('knight_walk_down', expect.anything())
      expect(knight.anims.play).not.toHaveBeenCalledWith('knight_hold_run_down', expect.anything())

      // Apple plays use_eat
      const dwarf = new Player(mockScene, 100, 100, 'dwarf')
      dwarf.beginItemUse('apple', 1000)
      expect(dwarf.itemUseState.clip).toBe('use_eat')
      expect(dwarf.anims.play).toHaveBeenCalledWith('dwarf_use_eat_down', false)
    })

    it('switches facing mid-use at the same frame index without restarting', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      knight.anims.currentFrame = { frame: { name: 'knight_use_drink_down_5' } }
      knight.beginItemUse('healing_potion', 1000)

      // Mid-use facing change
      knight.setFacing('right')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_use_drink_right', false)
    })

    it('returns to hold (or normal idle) when use completes or ends', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      session.equippedId = 'healing_potion'
      knight.beginItemUse('healing_potion', 1000)

      knight.endItemUse()
      expect(knight.itemUseState.active).toBe(false)
      expect(knight.anims.play).toHaveBeenCalledWith('knight_hold_idle_down', false)

      // If item is unequipped when use ends, returns to regular idle
      knight.beginItemUse('healing_potion', 2000)
      session.equippedId = null
      knight.endItemUse()
      expect(knight.anims.play).toHaveBeenCalledWith('knight_idle_down', false)
    })

    it('manages itemSprite lifecycle across setClass and destroy', () => {
      const knight = new Player(mockScene, 100, 100, 'knight')
      session.equippedId = 'healing_potion'
      knight._syncItemInHandSprite()
      expect(knight.itemSprite).toBeDefined()

      const oldSprite = knight.itemSprite
      const destroySpy = vi.spyOn(oldSprite, 'destroy')
      knight.setClass('mage')
      expect(destroySpy).toHaveBeenCalled()

      expect(knight.itemSprite).toBeDefined()
      const mageSprite = knight.itemSprite
      const destroySpy2 = vi.spyOn(mageSprite, 'destroy')
      knight.destroy()
      expect(destroySpy2).toHaveBeenCalled()
      expect(knight.itemSprite).toBeNull()
    })

    it.each(['knight', 'mage', 'thief', 'dwarf'])('plays %s use_charm and draws the glow overlay frame-for-frame above the body', (hero) => {
      const player = new Player(mockScene, 100, 200, hero)
      session.classId = hero
      session.equippedId = 'healing_charm'
      player.beginItemUse('healing_charm', 1000)
      expect(player.itemUseState.clip).toBe('use_charm')
      expect(player.anims.play).toHaveBeenCalledWith(`${hero}_use_charm_down`, false)

      for (const frame of [0, 4, 10, 15]) {
        player.anims.currentFrame = { frame: { name: `${hero}_use_charm_down_${frame}` } }
        player._syncItemInHandSprite()
        expect(player.glowSprite.visible).toBe(true)
        expect(player.glowSprite.texture.key).toBe(`${hero}_use_charm_glow`)
        expect(player.glowSprite.frame.name).toBe(`${hero}_use_charm_down_${frame}`)
        expect(player.glowSprite.x).toBe(player.x)
        expect(player.glowSprite.y).toBe(player.y)
        expect(player.glowSprite.depth).toBeGreaterThan(player.itemSprite.depth)
        expect(player.glowSprite.depth).toBeGreaterThan(player.depth)
      }
      // the charm is drawn from the Batch 11 atlas with its own grip origin
      expect(player.itemSprite.texture.key).toBe('items_inhand_b11')
      expect(player.itemSprite.frame.name).toBe('healing_charm_down')
      expect(player.itemSprite.originY).toBeCloseTo(10.56 / 24, 3)

      // the glow follows a facing change at the same frame index
      player.anims.currentFrame = { frame: { name: `${hero}_use_charm_down_10` } }
      player.setFacing('left')
      player.anims.currentFrame = { frame: { name: `${hero}_use_charm_left_10` } }
      player._syncItemInHandSprite()
      expect(player.glowSprite.frame.name).toBe(`${hero}_use_charm_left_10`)

      // glow is hidden once the use ends and destroyed with the player
      player.endItemUse()
      expect(player.glowSprite.visible).toBe(false)
      const glow = player.glowSprite
      player.destroy()
      expect(player.glowSprite).toBeNull()
      expect(glow.visible).toBe(false)
    })

    it('uses the potion-grip charm_hold sheets for the dwarf charm and the tool grip for the hammer', () => {
      const dwarf = new Player(mockScene, 100, 100, 'dwarf')
      session.equippedId = 'healing_charm'
      dwarf.playAnim('idle')
      expect(dwarf.anims.play).toHaveBeenCalledWith('dwarf_charm_hold_idle_down', true)
      dwarf._syncItemInHandSprite()
      expect(dwarf._lastAnchor).toEqual(expect.objectContaining({ layer: expect.any(String) }))
      expect(dwarf._lastAnchor.x).not.toBeUndefined()

      session.equippedId = 'stonehollow_hammer'
      dwarf.playAnim('idle', false)
      expect(dwarf.anims.play).toHaveBeenCalledWith('dwarf_hold_idle_down', false)
      dwarf._syncItemInHandSprite()
      expect(dwarf.itemSprite.texture.key).toBe('items_inhand_b11')
      expect(dwarf.itemSprite.frame.name).toBe('stonehollow_hammer_down')
      expect(dwarf.itemSprite.originY).toBeCloseTo(24.49 / 32, 3)
      expect(dwarf.itemSprite.visible).toBe(true)
    })

    it('holds the nightfang dagger for the thief with the shared thief hold clips', () => {
      const thief = new Player(mockScene, 100, 100, 'thief')
      session.classId = 'thief'
      session.equippedId = 'nightfang_dagger'
      thief.playAnim('idle')
      expect(thief.anims.play).toHaveBeenCalledWith('thief_hold_idle_down', true)
      thief._syncItemInHandSprite()
      expect(thief.itemSprite.texture.key).toBe('items_inhand_b11')
      expect(thief.itemSprite.frame.name).toBe('nightfang_dagger_down')
      expect(thief.itemSprite.visible).toBe(true)
      expect(thief.glowSprite).toBeNull()
    })
  })

  describe('Thief poison vial wind-up (Package B10-1)', () => {
    function listenConsumed() {
      const events = []
      const off = eventBus.on(GameEvents.ITEM_CONSUMED, (evt) => events.push(evt))
      return { events, off }
    }

    it('plays thief_use_throw and spawns on the sheet offset only after 250 ms', () => {
      const thief = new Player(mockScene, 200, 300, 'thief')
      mockScene.projectiles = []
      thief.facing = 'down'
      const timing = getVialThrowTiming('down')
      const consumed = listenConsumed()

      const pending = thief.beginVialThrow(5000)
      expect(pending.animKey).toBe('thief_use_throw_down')
      expect(thief.anims.currentAnim.key).toBe('thief_use_throw_down')
      expect(thief.itemUseState.clip).toBe('use_throw')
      expect(mockScene.projectiles).toHaveLength(0)

      thief.update(5000 + timing.releaseMs - 1, 16)
      expect(mockScene.projectiles).toHaveLength(0)
      expect(consumed.events).toHaveLength(0)
      expect(thief._vialCooldownUntil).toBe(0)

      thief.update(5000 + timing.releaseMs, 16)
      expect(mockScene.projectiles).toHaveLength(1)
      const vial = mockScene.projectiles[0]
      const meta = thiefUseThrowAtlas.meta.anims.use_throw.spawnOffsetPx.down
      expect(Math.abs(vial.x - (200 + meta.x))).toBeLessThanOrEqual(2)
      expect(Math.abs(vial.y - (300 + meta.y))).toBeLessThanOrEqual(2)
      expect(vial.flyAnim).toBe('thief_poison_vial')
      expect(vial.damage).toBe(8)
      expect(consumed.events).toEqual([{ id: 'poison_vial', mode: 'search' }])
      expect(thief._vialCooldownUntil).toBe(5000 + timing.releaseMs + VIAL_THROW_COOLDOWN_MS)
      consumed.off()
    })

    it('uses the right-facing sheet offset', () => {
      const thief = new Player(mockScene, 40, 70, 'thief')
      mockScene.projectiles = []
      thief.facing = 'right'
      const meta = thiefUseThrowAtlas.meta.anims.use_throw.spawnOffsetPx.right
      thief.beginVialThrow(1000)
      thief.update(1000 + 250, 16)
      const vial = mockScene.projectiles[0]
      expect(Math.abs(vial.x - (40 + meta.x))).toBeLessThanOrEqual(2)
      expect(Math.abs(vial.y - (70 + meta.y))).toBeLessThanOrEqual(2)
    })

    it('switches throw clips at the same frame index when facing changes', () => {
      const thief = new Player(mockScene, 10, 10, 'thief')
      thief.beginVialThrow(1000)
      thief.anims.currentFrame = { frame: { name: 'thief_use_throw_down_2' } }
      thief.anims.setCurrentFrame = vi.fn()
      const frames = Array.from({ length: 8 }, (_, i) => ({ index: i }))
      mockScene.anims.get.mockImplementation(() => ({ frames }))

      thief.setFacing('left')
      expect(thief.anims.play).toHaveBeenCalledWith('thief_use_throw_left', false)
      expect(thief.anims.setCurrentFrame).toHaveBeenCalledWith(frames[2])
    })

    it('shows the in-hand vial during the wind-up and hides it when the anchor layer is none', () => {
      const thief = new Player(mockScene, 10, 10, 'thief')
      thief.beginVialThrow(1000)
      thief.anims.currentFrame = { frame: { name: 'thief_use_throw_down_1' } }
      thief._syncItemInHandSprite()
      expect(thief.itemSprite.visible).toBe(true)
      expect(thief.itemSprite.texture.key).toBe('items_inhand_b10')
      expect(thief.itemSprite.frame.name).toBe('poison_vial_down')

      thief.anims.currentFrame = { frame: { name: 'thief_use_throw_down_4' } }
      thief._syncItemInHandSprite()
      expect(thief.itemSprite.visible).toBe(false)
      expect(thief._lastAnchor.layer).toBe('none')
    })

    it.each([
      ['hurt', (thief, now) => thief.takeDamage(10, now)],
      ['dodge', (thief, now) => thief.dodge(now)],
      ['death', (thief) => thief.die()],
      ['class change', (thief) => thief.setClass('mage')],
    ])('cancel by %s before release spawns nothing and charges nothing', (_label, cancel) => {
      const thief = new Player(mockScene, 15, 25, 'thief')
      mockScene.projectiles = []
      const consumed = listenConsumed()
      thief.beginVialThrow(4000)
      cancel(thief, 4100)
      thief.update(4000 + 400, 16)
      expect(mockScene.projectiles).toHaveLength(0)
      expect(consumed.events).toHaveLength(0)
      expect(thief._vialCooldownUntil).toBe(0)
      consumed.off()
    })
  })

  describe('Lightning bow draw (BOW-1)', () => {
    let savedEquipped
    let savedClass
    beforeEach(() => {
      savedEquipped = session.equippedId
      savedClass = session.classId
      session.equippedId = 'lightning_bow'
    })
    afterEach(() => {
      session.equippedId = savedEquipped
      session.classId = savedClass
    })

    it('draws 10 frames at 12 fps and releases on frame 6 (500 ms in)', () => {
      expect(getBowTiming()).toEqual({ releaseFrame: 6, releaseMs: 500, durationMs: 833, frames: 10 })
      expect(getBowCooldownMs()).toBe(833)
    })

    it.each(['thief', 'knight', 'mage', 'dwarf'])('%s plays use_bow and fires nothing until the release frame', (hero) => {
      const player = new Player(mockScene, 200, 300, hero)
      session.classId = hero
      mockScene.projectiles = []
      player.facing = 'down'

      const pending = player.beginBowDraw(5000)
      expect(pending.animKey).toBe(`${hero}_use_bow_down`)
      expect(player.anims.currentAnim.key).toBe(`${hero}_use_bow_down`)
      expect(player.itemUseState).toMatchObject({ active: true, itemId: 'lightning_bow', clip: 'use_bow' })
      expect(mockScene.projectiles).toHaveLength(0)

      player.update(5000 + 499, 16)
      expect(mockScene.projectiles).toHaveLength(0)
      expect(player._bowCooldownUntil).toBe(0)

      player.update(5000 + 500, 16)
      expect(mockScene.projectiles).toHaveLength(1)
      const arrow = mockScene.projectiles[0]
      const tip = getScaledArrowSpawnOffset(hero, 'down')
      expect(arrow.x).toBeCloseTo(200 + tip.x, 3)
      expect(arrow.y).toBeCloseTo(300 + tip.y, 3)
      expect(arrow.scaleX).toBeCloseTo(ARROW_VISUAL_SCALE, 5)
      expect(arrow.size).toBe(24)
      expect(arrow.vy).toBe(520)
      expect(arrow.flyAnim).toBe(ARROW_FLY_ANIM)
      expect(arrow.hitAnim).toBe(ARROW_HIT_ANIM)
      expect(arrow.owner).toBe('player')
      expect(arrow.damage).toBe(14)
      expect(arrow.vy).toBeGreaterThan(0)
      expect(arrow.vx).toBe(0)
      expect(player._bowCooldownUntil).toBe(5000 + 833)

      // a second Space during the draw does nothing; once the clip ends, another draw can start
      expect(player.beginBowDraw(5600)).toBeNull()
      player.update(5000 + 833, 16)
      expect(player.itemUseState.active).toBe(false)
      const again = player.beginBowDraw(5000 + 833)
      expect(again).not.toBeNull()
      expect(again.animKey).toBe(`${hero}_use_bow_down`)
    })

    it('waits for frame 6 while the draw clip is playing, even after the 500 ms mark', () => {
      const player = new Player(mockScene, 200, 300, 'knight')
      session.classId = 'knight'
      mockScene.projectiles = []
      player.facing = 'right'
      player.beginBowDraw(5000)
      player.anims.currentFrame = { frame: { name: 'knight_use_bow_right_4' } }
      player.update(5000 + 700, 16)
      expect(mockScene.projectiles).toHaveLength(0)
      player.anims.currentFrame = { frame: { name: 'knight_use_bow_right_6' } }
      player.update(5000 + 720, 16)
      expect(mockScene.projectiles).toHaveLength(1)
      expect(mockScene.projectiles[0].vx).toBeGreaterThan(0)
    })

    it('fires along the facing the hero has at release, from that facing\'s arrow tip', () => {
      const thief = new Player(mockScene, 40, 70, 'thief')
      session.classId = 'thief'
      mockScene.projectiles = []
      thief.facing = 'right'
      thief.beginBowDraw(1000)
      thief.update(1000 + 500, 16)
      const arrow = mockScene.projectiles[0]
      const tip = getScaledArrowSpawnOffset('thief', 'right')
      expect(arrow.x).toBeCloseTo(40 + tip.x, 3)
      expect(arrow.y).toBeCloseTo(70 + tip.y, 3)
      expect(arrow.vx).toBe(520)
      expect(arrow.vx).toBeGreaterThan(0)
      expect(arrow.vy).toBe(0)
    })

    it('switches draw clips at the same frame index when facing changes', () => {
      const knight = new Player(mockScene, 10, 10, 'knight')
      session.classId = 'knight'
      knight.beginBowDraw(1000)
      knight.anims.currentFrame = { frame: { name: 'knight_use_bow_down_3' } }
      knight.anims.setCurrentFrame = vi.fn()
      const frames = Array.from({ length: 10 }, (_, i) => ({ index: i }))
      mockScene.anims.get.mockImplementation(() => ({ frames }))
      knight.setFacing('left')
      expect(knight.anims.play).toHaveBeenCalledWith('knight_use_bow_left', false)
      expect(knight.anims.setCurrentFrame).toHaveBeenCalledWith(frames[3])
    })

    it('draws the weapon overlay over the body and the glow over the weapon, in place of the in-hand sprite', () => {
      const mage = new Player(mockScene, 100, 120, 'mage')
      session.classId = 'mage'
      mage.beginBowDraw(1000)
      mage.anims.currentFrame = { frame: { name: 'mage_use_bow_down_5' } }
      mage._syncItemInHandSprite()
      expect(mage.itemSprite.texture.key).toBe('mage_use_bow_weapon')
      expect(mage.itemSprite.frame.name).toBe('mage_use_bow_down_5')
      expect(mage.itemSprite.visible).toBe(true)
      const anchor = getItemAnchor('mage', 'use_bow', 'mage_use_bow_down_5')
      expect(BOW_HAND_SCALE).toBe(1.45)
      expect(mage.itemSprite.scaleX).toBeCloseTo(BOW_HAND_SCALE, 5)
      expect(mage.itemSprite.x).toBeCloseTo(mage.x + anchor.x * (1 - BOW_HAND_SCALE), 3)
      expect(mage.itemSprite.y).toBeCloseTo(mage.y + anchor.y * (1 - BOW_HAND_SCALE), 3)
      expect(mage.itemSprite.depth).toBeGreaterThan(mage.depth)
      expect(mage.glowSprite.texture.key).toBe('mage_use_bow_glow')
      expect(mage.glowSprite.frame.name).toBe('mage_use_bow_down_5')
      expect(mage.glowSprite.scaleX).toBeCloseTo(BOW_HAND_SCALE, 5)
      expect(mage.glowSprite.x).toBeCloseTo(mage.itemSprite.x, 3)
      expect(mage.glowSprite.y).toBeCloseTo(mage.itemSprite.y, 3)
      expect(mage.glowSprite.depth).toBeGreaterThan(mage.itemSprite.depth)

      // back to the in-hand bow and the resting glow once the draw ends
      mage.endItemUse()
      mage._syncItemInHandSprite()
      expect(mage.itemSprite.texture.key).toBe('items_inhand_b12')
      expect(mage.itemSprite.frame.name).toBe('lightning_bow_down')
      const hold = getItemAnchor('mage', 'hold_idle', 'mage_hold_idle_down_0')
      expect(mage.itemSprite.scaleX).toBeCloseTo(BOW_HAND_SCALE, 5)
      expect(mage.itemSprite.x).toBeCloseTo(mage.x + hold.x, 3)
      expect(mage.itemSprite.y).toBeCloseTo(mage.y + hold.y, 3)
      expect(mage.glowSprite.scaleX).toBeCloseTo(BOW_HAND_SCALE, 5)
    })

    it('holds the bow with the hero hold clip and the resting glow; the dwarf uses charm_hold', () => {
      const thief = new Player(mockScene, 10, 10, 'thief')
      session.classId = 'thief'
      thief.playAnim('idle')
      expect(thief.anims.play).toHaveBeenCalledWith('thief_hold_idle_down', true)
      thief._syncItemInHandSprite()
      expect(thief.itemSprite.texture.key).toBe('items_inhand_b12')
      expect(thief.itemSprite.frame.name).toBe('lightning_bow_down')
      expect(thief.itemSprite.visible).toBe(true)
      expect(thief.itemSprite.scaleX).toBeCloseTo(BOW_HAND_SCALE, 5)
      expect(thief.glowSprite.texture.key).toBe('thief_bow_hold_idle_glow')
      expect(thief.glowSprite.frame.name).toBe('thief_bow_hold_idle_glow_down_0')
      expect(thief.glowSprite.scaleX).toBeCloseTo(BOW_HAND_SCALE, 5)
      expect(thief.glowSprite.depth).toBeGreaterThan(thief.itemSprite.depth)

      thief.facing = 'left'
      thief.anims.currentFrame = { frame: { name: 'thief_hold_idle_left_0' } }
      thief._syncItemInHandSprite()
      expect(thief.itemSprite.depth).toBeLessThan(thief.depth)
      expect(thief.itemSprite.scaleX).toBeCloseTo(BOW_HAND_SCALE, 5)

      const dwarf = new Player(mockScene, 10, 10, 'dwarf')
      session.classId = 'dwarf'
      dwarf.playAnim('idle')
      expect(dwarf.anims.play).toHaveBeenCalledWith('dwarf_charm_hold_idle_down', true)
    })

    it.each([
      ['hurt', (p, now) => p.takeDamage(10, now)],
      ['dodge', (p, now) => p.dodge(now)],
      ['death', (p) => p.die()],
      ['weapon swap', () => { session.equippedId = 'healing_potion' }],
    ])('cancel by %s before release fires nothing', (_label, cancel) => {
      const hero = new Player(mockScene, 15, 25, 'knight')
      session.classId = 'knight'
      mockScene.projectiles = []
      hero.beginBowDraw(4000)
      cancel(hero, 4100)
      hero.update(4000 + 600, 16)
      expect(mockScene.projectiles).toHaveLength(0)
      expect(hero._bowCooldownUntil).toBe(0)
    })
  })

  describe('Tool use clips (Package B10-2)', () => {
    beforeEach(() => {
      session.equippedId = null
      session.hotbarSlot = 0
    })

    it('starts, cancels, and completes a thief lockpick on the item-use path', () => {
      const thief = new Player(mockScene, 10, 20, 'thief')
      const started = thief.beginToolUse({
        id: 'lockpick',
        classId: 'thief',
        itemId: 'lockpicks',
        clip: 'use_lockpick',
        sheetKey: 'thief_use_lockpick',
      }, 5000)
      expect(started).toBe(thief)
      expect(thief.itemUseState).toMatchObject({
        active: true,
        itemId: 'lockpicks',
        clip: 'use_lockpick',
        tool: 'lockpick',
      })
      expect(thief.anims.play).toHaveBeenCalledWith('thief_use_lockpick_down', false)
      thief.anims.currentFrame = { frame: { name: 'thief_use_lockpick_down_1' } }
      thief._syncItemInHandSprite()
      expect(thief.itemSprite.visible).toBe(true)
      expect(thief.itemSprite.texture.key).toBe('items_inhand_b10')
      expect(thief.itemSprite.frame.name).toBe('lockpicks_down')

      thief.cancelToolUse()
      expect(thief.itemUseState.active).toBe(false)
      expect(thief.anims.play).toHaveBeenCalledWith('thief_idle_down', false)
    })

    it('refuses the wrong class and a second clip, and shows the pickaxe while mining', () => {
      const dwarf = new Player(mockScene, 4, 8, 'dwarf')
      expect(dwarf.beginToolUse({
        id: 'pickaxe',
        classId: 'thief',
        itemId: 'dwarf_pickaxe',
        clip: 'use_pickaxe',
        sheetKey: 'dwarf_use_pickaxe',
      }, 1000)).toBeNull()
      expect(dwarf.itemUseState.active).toBe(false)

      dwarf.beginToolUse({
        id: 'pickaxe',
        classId: 'dwarf',
        itemId: 'dwarf_pickaxe',
        clip: 'use_pickaxe',
        sheetKey: 'dwarf_use_pickaxe',
      }, 1100)
      expect(dwarf.anims.play).toHaveBeenCalledWith('dwarf_use_pickaxe_down', false)
      expect(dwarf.beginToolUse({
        id: 'pickaxe',
        classId: 'dwarf',
        itemId: 'dwarf_pickaxe',
        clip: 'use_pickaxe',
      }, 1200)).toBeNull()
      dwarf.anims.currentFrame = { frame: { name: 'dwarf_use_pickaxe_down_4' } }
      dwarf._syncItemInHandSprite()
      expect(dwarf.itemSprite.texture.key).toBe('items_inhand_b10')
      expect(dwarf.itemSprite.frame.name).toBe('dwarf_pickaxe_down')

      dwarf.completeToolUse()
      expect(dwarf.itemUseState.active).toBe(false)
      expect(dwarf.cancelToolUse()).toBe(dwarf)
    })
  })
})


describe('Player Actor — attack anim timeScale composition', () => {
  const swing = (classId, name = 'attack') => {
    const player = new Player(createMockScene(), 100, 200, classId)
    player.anims.timeScale = 1
    player.playAnim(name, false)
    return player
  }

  it.each([
    ['knight', 'attack', 1],
    ['dwarf', 'attack', 0.75],
    ['thief', 'attack', 1.5],
    ['thief', 'attack_2', 1.5],
    ['dwarf', 'walk', 1],
  ])('keeps normal %s %s timing at %sx', (classId, name, expected) => {
    expect(swing(classId, name).anims.timeScale).toBeCloseTo(expected, 10)
  })

  it('composes the class multiplier with an external slow-down instead of overwriting it', () => {
    const player = new Player(createMockScene(), 100, 200, 'knight')
    player.anims.timeScale = 0.25
    player.playAnim('attack', false)
    expect(player.anims.timeScale).toBeCloseTo(0.25, 10)

    const dwarf = new Player(createMockScene(), 100, 200, 'dwarf')
    dwarf.anims.timeScale = 0.25
    dwarf.playAnim('attack', false)
    expect(dwarf.anims.timeScale).toBeCloseTo(0.25 * 0.75, 10)
  })

  it('does not stack the class multiplier across repeated plays and removes it for non-attack clips', () => {
    const player = new Player(createMockScene(), 100, 200, 'thief')
    player.anims.timeScale = 0.5
    player.playAnim('attack', false)
    player.playAnim('attack_2', false)
    player.playAnim('attack', false)
    expect(player.anims.timeScale).toBeCloseTo(0.5 * 1.5, 10)
    player.playAnim('walk', false)
    expect(player.anims.timeScale).toBeCloseTo(0.5, 10)
  })
})
