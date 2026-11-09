import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Phaser Sprite & Scene
vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 96, height: 96 }
      this.originX = 0.5
      this.originY = 0.9271
      this.body = {
        setSize: vi.fn(),
        setOffset: vi.fn(),
        setVelocity: vi.fn(),
        setAllowGravity: vi.fn(),
        setCollideWorldBounds: vi.fn(),
        setPushable: vi.fn(),
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
    setOrigin(x, y) { this.originX = x; this.originY = y !== undefined ? y : x; return this }
    setDepth(d) { this.depth = d; return this }
    setTexture(k, f) { this.texture = { key: k }; return this }
    on(event, fn) {
      if (!this._eventListeners.has(event)) this._eventListeners.set(event, [])
      this._eventListeners.get(event).push(fn)
      return this
    }
    emit(event, ...args) {
      const listeners = this._eventListeners.get(event) || []
      for (const fn of listeners) fn(...args)
    }
  }

  return {
    default: {
      Animations: { Events: { ANIMATION_COMPLETE: 'animationcomplete' } },
      Physics: { Arcade: { Sprite: MockSprite } },
      GameObjects: { Sprite: MockSprite },
    },
  }
})

import { Enemy } from '../../actors/Enemy.js'
import {
  BruteAI,
  BRUTE_AI_MODES,
  AGGRO_RADIUS_PX,
  ATTACK_RANGE_PX,
  TELEGRAPH_DURATION_MS,
  KNOCKBACK_IMPULSE,
  COOLDOWN_MS,
  BRUTE_BASE_HP,
  BRUTE_BASE_SPEED,
  BRUTE_BASE_DAMAGE,
} from '../brute.js'
import { AttackTokenManager } from '../tokens.js'
import { ACTOR_STATES } from '../../actors/stateMachine.js'

function createMockScene() {
  const tokenManager = new AttackTokenManager(2)
  return {
    textures: {
      get: vi.fn(() => ({
        customData: {
          meta: {
            origin: { x: 0.5, y: 0.9271 },
            footprint: { x: -20, y: -6, w: 40, h: 12, shape: 'ellipse' },
            hurtbox: { x: -24, y: -31, w: 48, h: 31 },
            anims: {
              attack: {
                frames: 7,
                hitFrames: [3],
                frameDurationsMs: [120, 200, 70, 220, 120, 100, 100],
                weaponTipOffsetFromFeet: {
                  3: {
                    down: { x: -27.6, y: -15.4 },
                  },
                },
              },
            },
          },
        },
        _frameDef: { w: 96, h: 96, pivot: { x: 0.5, y: 0.9271 } },
      })),
      exists: vi.fn(() => true),
    },
    anims: { exists: vi.fn(() => true) },
    attackTokenManager: tokenManager,
    player: {
      x: 100,
      y: 100,
      hp: 100,
      body: { bottom: 100, x: 84, y: 77, width: 32, height: 23 },
      hurtbox: { x: -14, y: -37, w: 28, h: 37 },
      takeDamage: vi.fn(() => true),
      is: vi.fn(() => false),
    },
  }
}

describe('Brute AI & Enemy Integration — Package 1b-2', () => {
  let mockScene

  beforeEach(() => {
    mockScene = createMockScene()
  })

  it('initializes brute archetype with HP 25, damage 12, speed 55, and isArmored true', () => {
    const enemy = new Enemy(mockScene, 300, 300, 'brute')
    expect(enemy.enemyType).toBe('brute')
    expect(enemy.hp).toBe(BRUTE_BASE_HP)
    expect(enemy.hpMax).toBe(BRUTE_BASE_HP)
    expect(enemy.damage).toBe(BRUTE_BASE_DAMAGE)
    expect(enemy.speed).toBe(BRUTE_BASE_SPEED)
    expect(enemy.isArmored).toBe(true)
    expect(enemy.telegraphDuration).toBe(TELEGRAPH_DURATION_MS)
    expect(enemy.baseCooldown).toBe(COOLDOWN_MS)
    expect(enemy.knockbackImpulse).toBe(KNOCKBACK_IMPULSE)
    expect(enemy.ai).toBeInstanceOf(BruteAI)
  })

  it('resolves goblin_brute sheets for walk, telegraph, attack, and death', () => {
    const enemy = new Enemy(mockScene, 300, 300, 'brute')
    expect(enemy.getSheetForAnim('walk')).toBe('goblin_brute')
    expect(enemy.getSheetForAnim('telegraph')).toBe('goblin_brute_telegraph')
    expect(enemy.getSheetForAnim('attack')).toBe('goblin_brute')
    expect(enemy.getSheetForAnim('death')).toBe('goblin_brute_death')
  })

  it('patrols when player is beyond aggro radius (> 180 px)', () => {
    const enemy = new Enemy(mockScene, 400, 400, 'brute')
    const ai = enemy.ai
    ai.update(1000, 16)
    expect(ai.mode).toBe(BRUTE_AI_MODES.PATROL)
  })

  it('enters chase mode and moves toward player when within 180 px at brute speed', () => {
    // Enemy at (200, 100), player at (100, 100) -> distance 100 px (<= 180 px, > 44 px)
    const enemy = new Enemy(mockScene, 200, 100, 'brute')
    const ai = enemy.ai
    ai.update(1000, 16)
    expect(ai.mode).toBe(BRUTE_AI_MODES.CHASE)
    expect(enemy.body.setVelocity).toHaveBeenCalled()
    const [vx] = enemy.body.setVelocity.mock.calls[0]
    expect(vx).toBeCloseTo(-BRUTE_BASE_SPEED)
  })

  it('triggers attack when within 44 px and acquires attack token', () => {
    // Enemy at (130, 100), player at (100, 100) -> distance 30 px (<= 44 px)
    const enemy = new Enemy(mockScene, 130, 100, 'brute')
    const ai = enemy.ai
    ai.update(1000, 16)
    expect(ai.mode).toBe(BRUTE_AI_MODES.ATTACK)
    expect(enemy.isAttacking).toBe(true)
    expect(enemy.attackPhase).toBe('telegraph')
    expect(mockScene.attackTokenManager.has(enemy)).toBe(true)
  })

  it('Criterion 1: Telegraph duration is 300 ms before transitioning to swing', () => {
    const enemy = new Enemy(mockScene, 130, 100, 'brute')
    const startTime = 1000
    enemy.startAttack(startTime)

    expect(enemy.isAttacking).toBe(true)
    expect(enemy.attackPhase).toBe('telegraph')
    expect(enemy.telegraphUntil).toBe(startTime + 300)

    // At 250 ms, still in telegraph
    enemy.update(startTime + 250, 16)
    expect(enemy.attackPhase).toBe('telegraph')

    // At 300 ms, transitions to swing
    enemy.update(startTime + 300, 16)
    expect(enemy.attackPhase).toBe('swing')
    expect(enemy.lastAnimKey).toBe('goblin_brute_attack_down')
  })

  it('Criterion 2: Armored brute is NOT interrupted when taking damage mid-swing', () => {
    const enemy = new Enemy(mockScene, 130, 100, 'brute')
    const startTime = 1000
    mockScene.attackTokenManager.acquire(enemy)
    enemy.startAttack(startTime)
    expect(enemy.isAttacking).toBe(true)
    expect(mockScene.attackTokenManager.has(enemy)).toBe(true)

    // Player strikes brute while in telegraph
    const hit1 = enemy.takeDamage(5, startTime + 100)
    expect(hit1).toBe(true)
    expect(enemy.hp).toBe(20)
    // Must NOT cancel attack and must NOT drop token!
    expect(enemy.isAttacking).toBe(true)
    expect(enemy.attackPhase).toBe('telegraph')
    expect(enemy.is(ACTOR_STATES.HURT)).toBe(false)
    expect(mockScene.attackTokenManager.has(enemy)).toBe(true)

    // Advance to swing
    enemy.transitionToSwing(startTime + 300)
    expect(enemy.attackPhase).toBe('swing')

    // Player strikes brute mid-swing
    const hit2 = enemy.takeDamage(5, startTime + 400)
    expect(hit2).toBe(true)
    expect(enemy.hp).toBe(15)
    // Must NOT cancel attack and must NOT drop token!
    expect(enemy.isAttacking).toBe(true)
    expect(enemy.attackPhase).toBe('swing')
    expect(enemy.is(ACTOR_STATES.HURT)).toBe(false)
    expect(mockScene.attackTokenManager.has(enemy)).toBe(true)
  })

  it('Criterion 3: Knockback distance ≈ 260 px/s impulse passed on attack hit', () => {
    const enemy = new Enemy(mockScene, 110, 100, 'brute')
    enemy.facing = 'down'
    const now = 1000

    const hit = enemy.executeAttackHit(now)
    expect(hit).toBe(true)
    expect(mockScene.player.takeDamage).toHaveBeenCalled()

    const [dmg, hitTime, options] = mockScene.player.takeDamage.mock.calls[0]
    expect(dmg).toBe(BRUTE_BASE_DAMAGE)
    expect(options.knockbackSpeed).toBe(KNOCKBACK_IMPULSE)
    expect(options.knockbackSpeed).toBe(260)
  })

  it('enforces 1600 ms cooldown before another attack can be triggered', () => {
    const enemy = new Enemy(mockScene, 110, 100, 'brute')
    const now = 1000
    mockScene.attackTokenManager.acquire(enemy)
    enemy.startAttack(now)
    enemy.transitionToSwing(now + 300)
    enemy.finishAttack(now + 800)

    expect(enemy.isAttacking).toBe(false)
    expect(mockScene.attackTokenManager.has(enemy)).toBe(false)
    // Cooldown is 1600 ms base
    expect(enemy.attackCooldownUntil).toBeGreaterThanOrEqual(now + 800 + 1600)
  })

  it('transitions to DEAD when HP drops to 0, halts movement, and frees token', () => {
    const enemy = new Enemy(mockScene, 110, 100, 'brute')
    mockScene.attackTokenManager.acquire(enemy)
    enemy.startAttack(1000)

    // Fatal damage
    enemy.takeDamage(30, 1050)
    expect(enemy.hp).toBe(0)
    expect(enemy.is(ACTOR_STATES.DEAD)).toBe(true)
    expect(enemy.active).toBe(false)
    expect(mockScene.attackTokenManager.has(enemy)).toBe(false)
    expect(enemy.lastAnimKey).toBe('goblin_brute_death_down')
  })
})
