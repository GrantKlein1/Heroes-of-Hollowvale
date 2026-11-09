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
        height: frameDef.h ?? 64,
        realWidth: frameDef.w ?? 64,
        realHeight: frameDef.h ?? 64,
        pivot: frameDef.pivot ?? null,
      }
      this.originX = 0.5
      this.originY = 0.5
      this.depth = 0
      this.body = {
        setSize: vi.fn(),
        setOffset: vi.fn(),
        setVelocity: vi.fn(),
        setAllowGravity: vi.fn(),
        setCollideWorldBounds: vi.fn(),
        setPushable: vi.fn(),
        velocity: { x: 0, y: 0 },
        bottom: y,
        enable: true,
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
        height: frameDef.h ?? 64,
        realWidth: frameDef.w ?? 64,
        realHeight: frameDef.h ?? 64,
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

import { Enemy, ENEMY_SHEETS } from '../Enemy.js'
import { ACTOR_STATES } from '../stateMachine.js'
import { AttackTokenManager } from '../../ai/tokens.js'

function createMockScene() {
  const metadataMap = {
    goblin: {
      meta: {
        origin: { x: 0.5, y: 0.9375 },
        footprint: { x: -13, y: -4, w: 26, h: 8, shape: 'ellipse' },
        hurtbox: { x: -16, y: -23, w: 31, h: 23 },
        anims: {
          idle: { fps: 1, loop: true, frameNames: 'goblin_idle_<dir>', directions: ['down', 'left', 'right', 'up'] },
          walk: { fps: 10, loop: true, frames: 8, directions: ['down', 'left', 'right', 'up'] },
          hurt: { fps: 12, loop: false, frames: 5, directions: ['down', 'left', 'right', 'up'] },
          attack: {
            fps: 8,
            frames: 7,
            hitFrames: [3],
            directions: ['down', 'left', 'right', 'up'],
            weaponTipOffsetFromFeet: {
              3: {
                down: { x: -16.0, y: -10.1 },
                right: { x: 29.1, y: -12.8 },
                up: { x: 16.0, y: -22.2 },
                left: { x: -29.1, y: -19.5 },
              },
            },
          },
        },
      },
      frameDef: { w: 64, h: 64, pivot: { x: 0.5, y: 0.9375 } },
    },
    goblin_telegraph: {
      meta: {
        origin: { x: 0.5, y: 0.9375 },
        footprint: { x: -13, y: -4, w: 26, h: 8, shape: 'ellipse' },
        hurtbox: { x: -16, y: -23, w: 31, h: 23 },
        anims: {
          telegraph: { fps: 8, loop: true, frames: 3, directions: ['down', 'left', 'right', 'up'] },
        },
      },
      frameDef: { w: 64, h: 64, pivot: { x: 0.5, y: 0.9375 } },
    },
    goblin_death: {
      meta: {
        origin: { x: 0.5, y: 0.8333 },
        footprint: { x: -13, y: -4, w: 26, h: 8, shape: 'ellipse' },
        hurtbox: { x: -16, y: -23, w: 31, h: 23 },
        anims: {
          death: { fps: 10, loop: false, frames: 8, directions: ['down', 'left', 'right', 'up'] },
        },
      },
      frameDef: { w: 80, h: 72, pivot: { x: 0.5, y: 0.8333 } },
    },
  }

  const textureManager = {
    get: vi.fn((key) => {
      const data = metadataMap[key]
      if (!data) return null
      return {
        customData: { meta: data.meta },
        _frameDef: data.frameDef,
        frames: {
          default: { realWidth: data.frameDef.w, realHeight: data.frameDef.h },
        },
      }
    }),
    exists: vi.fn((key) => Boolean(metadataMap[key])),
  }

  const animsManager = {
    exists: vi.fn(() => true),
  }

  const tokenManager = new AttackTokenManager(2)

  return {
    textures: textureManager,
    anims: animsManager,
    attackTokenManager: tokenManager,
    player: {
      x: 100,
      y: 100,
      hp: 100,
      body: { bottom: 100, x: 84, y: 77, width: 32, height: 23 },
      hurtbox: { x: -14, y: -37, w: 28, h: 37 },
      takeDamage: vi.fn(),
      is: vi.fn(() => false),
    },
  }
}

describe('Enemy Actor — Package 1b-1', () => {
  let mockScene

  beforeEach(() => {
    mockScene = createMockScene()
  })

  it('initializes goblin archetype with base HP 15, damage 8, and speed 70', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    expect(enemy.enemyType).toBe('goblin')
    expect(enemy.hp).toBe(15)
    expect(enemy.hpMax).toBe(15)
    expect(enemy.damage).toBe(8)
    expect(enemy.speed).toBe(70)
    expect(enemy.isEnemy).toBe(true)
  })

  it('resolves dynamic feet anchor and footprint from goblin metadata', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    expect(enemy.originX).toBe(0.5)
    expect(enemy.originY).toBe(0.9375)
    expect(enemy.footprint).toEqual({
      x: -13,
      y: -4,
      w: 26,
      h: 8,
      shape: 'ellipse',
    })
    expect(enemy.body.setSize).toHaveBeenCalledWith(26, 8, false)
  })

  it('resolves sheet keys for telegraph, death, and attack', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    expect(enemy.getSheetForAnim('telegraph')).toBe('goblin_telegraph')
    expect(enemy.getSheetForAnim('death')).toBe('goblin_death')
    expect(enemy.getSheetForAnim('attack')).toBe('goblin')
    expect(enemy.getSheetForAnim('walk')).toBe('goblin')
  })

  it('records and logs animation keys on playAnim', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    enemy.playAnim('telegraph')
    expect(enemy.lastAnimKey).toBe('goblin_telegraph_down')
    expect(enemy.animHistory).toContain('goblin_telegraph_down')

    enemy.setFacing('left')
    enemy.playAnim('attack')
    expect(enemy.lastAnimKey).toBe('goblin_attack_left')
    expect(enemy.animHistory).toContain('goblin_attack_left')
  })

  it('manages telegraph then attack sequence with token and cooldown', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    const now = 1000

    expect(mockScene.attackTokenManager.acquire(enemy)).toBe(true)
    expect(enemy.startAttack(now)).toBe(true)
    expect(enemy.isAttacking).toBe(true)
    expect(enemy.attackPhase).toBe('telegraph')
    expect(enemy.lastAnimKey).toBe('goblin_telegraph_down')

    // Advance to swing
    enemy.transitionToSwing(now + 380)
    expect(enemy.attackPhase).toBe('swing')
    expect(enemy.lastAnimKey).toBe('goblin_attack_down')

    // Conclude attack
    enemy.finishAttack(now + 1000)
    expect(enemy.isAttacking).toBe(false)
    expect(mockScene.attackTokenManager.has(enemy)).toBe(false)
    expect(enemy.attackCooldownUntil).toBeGreaterThanOrEqual(now + 1900) // 900 ms base
  })

  it('takes damage, plays hurt anim, and interrupts attack', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    mockScene.attackTokenManager.acquire(enemy)
    enemy.startAttack(1000)
    expect(mockScene.attackTokenManager.has(enemy)).toBe(true)

    const tookDamage = enemy.takeDamage(5, 1100)
    expect(tookDamage).toBe(true)
    expect(enemy.hp).toBe(10)
    expect(enemy.is(ACTOR_STATES.HURT)).toBe(true)
    expect(enemy.isAttacking).toBe(false)
    // Token must be freed upon being hurt
    expect(mockScene.attackTokenManager.has(enemy)).toBe(false)
  })

  it('triggers die() when HP reaches 0 and plays death anim', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    mockScene.attackTokenManager.acquire(enemy)

    enemy.takeDamage(15, 1000)
    expect(enemy.hp).toBe(0)
    expect(enemy.is(ACTOR_STATES.DEAD)).toBe(true)
    expect(enemy.active).toBe(false)
    expect(enemy.lastAnimKey).toBe('goblin_death_down')
    expect(mockScene.attackTokenManager.has(enemy)).toBe(false)
  })
})
