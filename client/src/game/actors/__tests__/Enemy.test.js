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
import { ENEMY_BASE_DAMAGE, ENEMY_BASE_HP, ENEMY_BASE_SPEED } from '../../combat/balance.js'
import { ACTOR_STATES } from '../stateMachine.js'
import { AttackTokenManager } from '../../ai/tokens.js'
import { ArcherAI } from '../../ai/archer.js'
import { ARCHER_PROJECTILE } from '../../combat/balance.js'

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
    goblin_archer: {
      meta: {
        origin: { x: 0.5, y: 0.9125 },
        footprint: { x: -13, y: -4, w: 25, h: 8, shape: 'ellipse' },
        hurtbox: { x: -15, y: -24, w: 30, h: 24 },
        anims: {
          idle: { fps: 1, loop: true, frameNames: 'goblin_archer_idle_<dir>' },
          attack: {
            frames: 8,
            releaseFrame: 4,
            spawnFrame: 4,
            spawnOffsetFromFeet: {
              down: { x: -1.5, y: -20 },
              right: { x: 21, y: -22 },
              up: { x: 2, y: -30 },
              left: { x: -11.25, y: -18.5 },
            },
          },
        },
      },
      frameDef: { w: 64, h: 64, pivot: { x: 0.5, y: 0.9125 } },
    },
    goblin_archer_alert: {
      meta: {
        origin: { x: 0.5, y: 0.9125 },
        anims: { alert: { frames: 4, fps: 8 } },
      },
      frameDef: { w: 64, h: 64, pivot: { x: 0.5, y: 0.9125 } },
    },
    goblin_archer_death: {
      meta: {
        origin: { x: 0.5, y: 0.8333 },
        anims: { death: { frames: 8, fps: 10 } },
      },
      frameDef: { w: 80, h: 72, pivot: { x: 0.5, y: 0.8333 } },
    },
    goblin_archer_spawn: {
      meta: {
        origin: { x: 0.5, y: 0.875 },
        anims: { spawn: { frames: 6, fps: 10 } },
      },
      frameDef: { w: 64, h: 64, pivot: { x: 0.5, y: 0.875 } },
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
    projectiles: [],
    add: { existing: vi.fn((obj) => obj) },
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

  it('initializes goblin archetype from the balance table', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    expect(enemy.enemyType).toBe('goblin')
    expect(enemy.hp).toBe(ENEMY_BASE_HP.goblin)
    expect(enemy.hpMax).toBe(ENEMY_BASE_HP.goblin)
    expect(enemy.damage).toBe(ENEMY_BASE_DAMAGE.goblin)
    expect(enemy.speed).toBe(ENEMY_BASE_SPEED.goblin)
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

  it('resolves the alert sheet for goblin, archer, and brute', () => {
    expect(new Enemy(mockScene, 0, 0, 'goblin').getSheetForAnim('alert')).toBe('goblin_alert')
    expect(new Enemy(mockScene, 0, 0, 'archer').getSheetForAnim('alert')).toBe('goblin_archer_alert')
    expect(new Enemy(mockScene, 0, 0, 'goblin_archer').getSheetForAnim('alert')).toBe('goblin_archer_alert')
    expect(new Enemy(mockScene, 0, 0, 'brute').getSheetForAnim('alert')).toBe('goblin_brute_alert')
    expect(new Enemy(mockScene, 0, 0, 'goblin_brute').getSheetForAnim('alert')).toBe('goblin_brute_alert')
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
    expect(enemy.hp).toBe(ENEMY_BASE_HP.goblin - 5)
    expect(enemy.is(ACTOR_STATES.HURT)).toBe(true)
    expect(enemy.isAttacking).toBe(false)
    // Token must be freed upon being hurt
    expect(mockScene.attackTokenManager.has(enemy)).toBe(false)
  })

  it('triggers die() when HP reaches 0 and plays death anim', () => {
    const enemy = new Enemy(mockScene, 200, 200, 'goblin')
    mockScene.attackTokenManager.acquire(enemy)

    enemy.takeDamage(enemy.hpMax, 1000)
    expect(enemy.hp).toBe(0)
    expect(enemy.is(ACTOR_STATES.DEAD)).toBe(true)
    expect(enemy.active).toBe(true)
    expect(enemy.body.enable).toBe(false)
    expect(enemy.lastAnimKey).toBe('goblin_death_down')
    expect(mockScene.attackTokenManager.has(enemy)).toBe(false)
  })

  it('attaches ArcherAI and plays goblin_archer clips from atlas meta', () => {
    const enemy = new Enemy(mockScene, 100, 140, 'archer')

    expect(enemy.ai).toBeInstanceOf(ArcherAI)
    expect(enemy.ai.damage).toBe(ARCHER_PROJECTILE.damage)
    expect(enemy.assetId).toBe('goblin_archer')
    expect(enemy.originX).toBe(0.5)
    expect(enemy.originY).toBe(0.9125)
    expect(enemy.footprint.w).toBe(25)
    expect(enemy.hitFrames).toEqual([4])
    expect(enemy.spawnOffsetFromFeet.left).toEqual({ x: -11.25, y: -18.5 })

    expect(enemy.getSheetForAnim('attack')).toBe('goblin_archer')
    expect(enemy.getSheetForAnim('alert')).toBe('goblin_archer_alert')
    expect(enemy.getSheetForAnim('death')).toBe('goblin_archer_death')
    expect(enemy.getSheetForAnim('spawn')).toBe('goblin_archer_spawn')
    expect(enemy.getAnimKey('idle')).toBe('goblin_archer_idle_down')
    expect(enemy.getAnimKey('attack')).toBe('goblin_archer_attack_down')
    expect(enemy.getAnimKey('alert')).toBe('goblin_archer_alert_down')
    expect(enemy.getAnimKey('death')).toBe('goblin_archer_death_down')
    expect(enemy.getAnimKey('spawn')).toBe('goblin_archer_spawn_down')
    expect(enemy.animHistory).toEqual(expect.arrayContaining([
      'goblin_archer_spawn_down',
      'goblin_archer_idle_down',
    ]))

    enemy.facing = 'left'
    enemy.anims.currentFrame = { index: 4 }
    enemy.ai.hasSpawned = true
    enemy.ai.hasAlerted = true
    enemy.ai.startAttack(1000)
    enemy.ai.update(1100, 16)

    expect(mockScene.projectiles).toHaveLength(1)
    const arrow = mockScene.projectiles[0]
    expect(arrow.x).toBeCloseTo(100 - 11.25)
    expect(arrow.y).toBeCloseTo(140 - 18.5)
    expect(arrow.texture.key).toBe('goblin_archer')
    expect(arrow.frame.name).toBe('goblin_archer_arrow_left')
    expect(arrow.damage).toBe(ARCHER_PROJECTILE.damage)
  })
})
