import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Phaser Sprite & Scene
vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 64, height: 64 }
      this.originX = 0.5
      this.originY = 0.5
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
    }
    setOrigin(x, y) { this.originX = x; this.originY = y; return this }
    setDepth(d) { this.depth = d; return this }
    setTexture(k, f) { this.texture = { key: k }; return this }
    on() { return this }
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
import { GoblinAI, GOBLIN_AI_MODES, AGGRO_RADIUS_PX, ATTACK_RANGE_PX, RETREAT_HP_RATIO } from '../goblin.js'
import { AttackTokenManager } from '../tokens.js'

function createMockScene() {
  const tokenManager = new AttackTokenManager(2)
  return {
    textures: {
      get: vi.fn(() => ({
        customData: { meta: { origin: { x: 0.5, y: 0.9375 }, footprint: { x: -13, y: -4, w: 26, h: 8 } } },
        _frameDef: { w: 64, h: 64, pivot: { x: 0.5, y: 0.9375 } },
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
      takeDamage: vi.fn(),
      is: vi.fn(() => false),
    },
  }
}

describe('Goblin AI — Package 1b-1', () => {
  let mockScene

  beforeEach(() => {
    mockScene = createMockScene()
  })

  it('patrols when player is beyond aggro radius (> 160 px)', () => {
    // Enemy at (400, 400), player at (100, 100) -> distance ~424 px
    const enemy = new Enemy(mockScene, 400, 400, 'goblin')
    const ai = enemy.ai
    expect(ai).toBeInstanceOf(GoblinAI)

    ai.update(1000, 16)
    expect(ai.mode).toBe(GOBLIN_AI_MODES.PATROL)
  })

  it('enters chase mode and moves toward player when within 160 px', () => {
    // Enemy at (180, 100), player at (100, 100) -> distance 80 px (<= 160 px, > 36 px)
    const enemy = new Enemy(mockScene, 180, 100, 'goblin')
    const ai = enemy.ai

    ai.update(1000, 16)
    expect(ai.mode).toBe(GOBLIN_AI_MODES.CHASE)
    // Velocity must be directed towards player (-x direction)
    const [vx] = enemy.body.setVelocity.mock.calls[0]
    expect(vx).toBeLessThan(0)
    expect(enemy.facing).toBe('left')
  })

  it('triggers attack when within 36 px and acquires attack token', () => {
    // Enemy at (125, 100), player at (100, 100) -> distance 25 px (<= 36 px)
    const enemy = new Enemy(mockScene, 125, 100, 'goblin')
    const ai = enemy.ai

    ai.update(1000, 16)
    expect(ai.mode).toBe(GOBLIN_AI_MODES.ATTACK)
    expect(mockScene.attackTokenManager.has(enemy)).toBe(true)
    expect(enemy.isAttacking).toBe(true)
    expect(enemy.attackPhase).toBe('telegraph')
    expect(enemy.lastAnimKey).toBe('goblin_telegraph_left')
  })

  it('waits and does not attack if 2 tokens are already held by other enemies', () => {
    const enemy1 = { id: 'goblin_1' }
    const enemy2 = { id: 'goblin_2' }
    mockScene.attackTokenManager.acquire(enemy1)
    mockScene.attackTokenManager.acquire(enemy2)
    expect(mockScene.attackTokenManager.count).toBe(2)

    // 3rd goblin within 36 px range
    const enemy3 = new Enemy(mockScene, 125, 100, 'goblin')
    const ai3 = enemy3.ai

    ai3.update(1000, 16)
    expect(ai3.mode).toBe(GOBLIN_AI_MODES.ATTACK)
    // Must be denied token
    expect(mockScene.attackTokenManager.has(enemy3)).toBe(false)
    expect(enemy3.isAttacking).toBe(false)
    // Halts and plays idle facing player
    expect(enemy3.lastAnimKey).toBe('goblin_idle_left')
  })

  it('enters retreat mode when HP falls below 25%', () => {
    // Goblin base HP 15; 25% threshold is 3.75 HP.
    const enemy = new Enemy(mockScene, 125, 100, 'goblin')
    enemy.hp = 3 // 3 / 15 = 20% < 25%
    const ai = enemy.ai

    ai.update(1000, 16)
    expect(ai.mode).toBe(GOBLIN_AI_MODES.RETREAT)
    // Velocity must flee away from player (positive x direction, player is at x=100)
    const [vx] = enemy.body.setVelocity.mock.calls[0]
    expect(vx).toBeGreaterThan(0)
    expect(enemy.facing).toBe('right')
    expect(enemy.lastAnimKey).toBe('goblin_walk_right')
  })
})
