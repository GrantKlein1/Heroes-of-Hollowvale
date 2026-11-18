import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 128, height: 128 }
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
    setTexture(k) { this.texture = { key: k }; return this }
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
import { GoblinAI } from '../goblin.js'
import {
  WolfAI,
  WOLF_AI_MODES,
  WOLF_AGGRO_RADIUS_PX,
  WOLF_ATTACK_RANGE_PX,
  WOLF_COOLDOWN_MS,
  LUNGE_START_MS,
  LUNGE_END_MS,
  LUNGE_SPEED,
  WOLF_BACKOFF_PX,
  LUNGE_STOP_PX,
} from '../wolf.js'
import { AttackTokenManager } from '../tokens.js'

// Wolf attack meta, copied from shadowfang_wolf.json.
const WOLF_META = {
  origin: { x: 0.5, y: 0.9062 },
  footprint: { x: -26, y: -6, w: 52, h: 12, shape: 'ellipse' },
  hurtbox: { x: -26, y: -30, w: 52, h: 30 },
  anims: {
    attack: {
      frames: 7,
      hitFrames: [3],
      weaponTipOffsetFromFeet: {
        3: {
          down: { x: 0, y: -7.6 },
          right: { x: 41.6, y: -16.2 },
          up: { x: 0, y: -24.9 },
          left: { x: -41.6, y: -16.2 },
        },
      },
    },
  },
}

function createScene({ playerX = 100, playerY = 100 } = {}) {
  return {
    textures: {
      get: vi.fn(() => ({ customData: { meta: WOLF_META } })),
      exists: vi.fn(() => true),
    },
    // Only the clips a wolf really has: no spawn, alert or telegraph sheet.
    anims: { exists: vi.fn((key) => !/_(spawn|alert|telegraph)_/.test(key)) },
    attackTokenManager: new AttackTokenManager(2),
    player: {
      x: playerX,
      y: playerY,
      hp: 100,
      body: { bottom: playerY, x: playerX - 16, y: playerY - 30, width: 32, height: 30 },
      hurtbox: { x: -16, y: -29, w: 32, h: 29 },
      takeDamage: vi.fn(() => true),
      is: vi.fn(() => false),
    },
  }
}

function wolfAt(scene, x, y) {
  const wolf = new Enemy(scene, x, y, 'shadowfang_wolf')
  wolf.ai.hasSpawned = true
  return wolf
}

describe('WolfAI (Shadowfang Wolf)', () => {
  let scene
  beforeEach(() => {
    scene = createScene()
  })

  it('is the AI the wolf def resolves to, built on GoblinAI with wolf numbers', () => {
    const wolf = new Enemy(scene, 400, 400, 'shadowfang_wolf')
    expect(wolf.ai).toBeInstanceOf(WolfAI)
    expect(wolf.ai).toBeInstanceOf(GoblinAI)
    expect(wolf.ai.aggroRadius).toBe(WOLF_AGGRO_RADIUS_PX)
    expect(wolf.ai.attackRange).toBe(WOLF_ATTACK_RANGE_PX)
    expect(wolf.ai.retreatHpRatio).toBe(0)
    expect(wolf.baseCooldown).toBe(WOLF_COOLDOWN_MS)
    expect(wolf.ai.hasAlerted).toBe(true)
    expect(wolf.hitFrames).toEqual([3])
  })

  it('holds still while it spawns, then patrols when the player is far away', () => {
    const wolf = new Enemy(scene, 600, 600, 'shadowfang_wolf')
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.SPAWN)
    wolf.ai.update(100, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.SPAWN)
    wolf.ai.update(1000, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.PATROL)
  })

  it('aggros from 230 px (wider than a goblin) and chases without an alert pause', () => {
    // 200 px away: a goblin (160 px) would ignore it.
    const wolf = wolfAt(scene, 300, 100)
    wolf.ai.update(1000, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.CHASE)
    const [vx] = wolf.body.setVelocity.mock.calls.at(-1)
    expect(vx).toBeCloseTo(-wolf.speed)
    expect(wolf.facing).toBe('left')
  })

  it('stays on patrol past 230 px', () => {
    const wolf = wolfAt(scene, 400, 100)
    wolf.ai.update(1000, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.PATROL)
  })

  it('starts a bite from 76 px and goes straight to the swing (no telegraph sheet)', () => {
    const wolf = wolfAt(scene, 170, 100)
    wolf.ai.update(1000, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.ATTACK)
    expect(wolf.isAttacking).toBe(true)
    expect(wolf.attackPhase).toBe('swing')
    expect(wolf.animHistory).toContain('shadowfang_wolf_attack_left')
    expect(wolf.animHistory.some((k) => k.includes('telegraph'))).toBe(false)
    expect(scene.attackTokenManager.tokens.has(wolf)).toBe(true)
  })

  it('does not bite when the attack tokens are taken, and idles instead', () => {
    scene.attackTokenManager.acquire({ id: 'a' })
    scene.attackTokenManager.acquire({ id: 'b' })
    const wolf = wolfAt(scene, 170, 100)
    wolf.ai.update(1000, 16)
    expect(wolf.isAttacking).toBe(false)
  })

  it('lunges along its facing only inside the lunge window of the swing', () => {
    const wolf = wolfAt(scene, 176, 100)
    wolf.ai.update(1000, 16)
    expect(wolf.facing).toBe('left')
    const start = wolf.swingStartTime

    expect(wolf.ai.attackVelocity(start + LUNGE_START_MS - 1)).toBeNull()
    expect(wolf.ai.attackVelocity(start + LUNGE_START_MS)).toEqual({ x: -LUNGE_SPEED, y: 0 })
    expect(wolf.ai.attackVelocity(start + LUNGE_END_MS - 1)).toEqual({ x: -LUNGE_SPEED, y: 0 })
    expect(wolf.ai.attackVelocity(start + LUNGE_END_MS)).toBeNull()
  })

  it('shortens the lunge so it stops 30 px from the player instead of running through', () => {
    // 50 px out: only 20 px of gap, so the lunge speed is 20 px over the 120 ms window.
    const wolf = wolfAt(scene, 150, 100)
    wolf.ai.update(1000, 16)
    const v = wolf.ai.attackVelocity(wolf.swingStartTime + LUNGE_START_MS + 1)
    expect(v.y).toBe(0)
    expect(v.x).toBeCloseTo(-(50 - LUNGE_STOP_PX) / ((LUNGE_END_MS - LUNGE_START_MS) / 1000))
    expect(Math.abs(v.x)).toBeLessThan(LUNGE_SPEED)

    // Already inside the stop distance: no lunge at all.
    const close = wolfAt(scene, 120, 100)
    close.ai.update(1000, 16)
    expect(close.ai.attackVelocity(close.swingStartTime + LUNGE_START_MS + 1)).toEqual({ x: -0, y: 0 })
  })

  it('lunges up, down and right too, and not at all when it is not mid-swing', () => {
    const wolf = wolfAt(scene, 176, 100)
    expect(wolf.ai.attackVelocity(5000)).toBeNull()
    wolf.isAttacking = true
    wolf.attackPhase = 'swing'
    wolf.swingStartTime = 0
    const t = LUNGE_START_MS + 10
    for (const [facing, vec] of [['down', [0, 1]], ['up', [0, -1]], ['left', [-1, 0]], ['right', [1, 0]]]) {
      wolf.facing = facing
      expect(wolf.ai.attackVelocity(t)).toEqual({ x: vec[0] * LUNGE_SPEED, y: vec[1] * LUNGE_SPEED })
    }
    wolf.attackPhase = 'telegraph'
    expect(wolf.ai.attackVelocity(t)).toBeNull()
  })

  it('Enemy.update drives the body with the lunge, then holds still after it', () => {
    const wolf = wolfAt(scene, 176, 100)
    wolf.ai.update(1000, 16)
    const start = wolf.swingStartTime
    wolf.update(start + LUNGE_START_MS + 5, 16)
    expect(wolf.body.setVelocity).toHaveBeenLastCalledWith(-LUNGE_SPEED, 0)
    wolf.update(start + LUNGE_END_MS + 5, 16)
    expect(wolf.body.setVelocity).toHaveBeenLastCalledWith(0, 0)
  })

  it('bites on hit frame 3 using the weapon tip, hurting a player in reach', () => {
    // Wolf facing left, player 30 px away: inside the jaw tip box at hit frame 3.
    const wolf = wolfAt(scene, 130, 100)
    wolf.ai.update(1000, 16)
    expect(wolf.isAttacking).toBe(true)
    wolf.update(wolf.swingStartTime + 400, 16)
    expect(scene.player.takeDamage).toHaveBeenCalledTimes(1)
    expect(scene.player.takeDamage.mock.calls[0][0]).toBe(wolf.damage)
  })

  it('goes on COOLDOWN after a bite and does not bite again until it is over', () => {
    const wolf = wolfAt(scene, 170, 100)
    wolf.ai.update(1000, 16)
    const t = wolf.swingStartTime + 950
    wolf.update(t, 16) // swing runs past 900 ms: finishAttack
    expect(wolf.isAttacking).toBe(false)
    expect(wolf.attackCooldownUntil).toBeGreaterThanOrEqual(t + WOLF_COOLDOWN_MS)
    expect(wolf.attackCooldownUntil).toBeLessThanOrEqual(t + WOLF_COOLDOWN_MS + 300)

    wolf.ai.update(t + 100, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.COOLDOWN)
    expect(wolf.isAttacking).toBe(false)

    wolf.ai.update(wolf.attackCooldownUntil + 1, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.ATTACK)
    expect(wolf.isAttacking).toBe(true)
  })

  it('steps back to 44 px during cooldown if the lunge left it on top of the player', () => {
    const wolf = wolfAt(scene, 120, 100)
    wolf.attackCooldownUntil = 5000
    wolf.ai.update(1000, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.COOLDOWN)
    const [vx, vy] = wolf.body.setVelocity.mock.calls.at(-1)
    expect(vx).toBeGreaterThan(0) // away from the player (player is at x 100, wolf at 120)
    expect(vy).toBeCloseTo(0)
    expect(Math.abs(vx)).toBeCloseTo(wolf.speed * 0.7)
    expect(wolf.facing).toBe('left') // still faces the player
    expect(wolf.animHistory.at(-1)).toBe('shadowfang_wolf_walk_left')
  })

  it('holds still during cooldown once it is clear of the player', () => {
    const wolf = wolfAt(scene, 100 + WOLF_BACKOFF_PX + 6, 100)
    wolf.attackCooldownUntil = 5000
    wolf.ai.update(1000, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.COOLDOWN)
    expect(wolf.body.setVelocity).toHaveBeenLastCalledWith(0, 0)
    expect(wolf.isAttacking).toBe(false)
  })

  it('backs out along its facing if it is exactly on the player', () => {
    const wolf = wolfAt(scene, 100, 100)
    wolf.facing = 'down'
    wolf.attackCooldownUntil = 5000
    wolf.ai.update(1000, 16)
    const [vx, vy] = wolf.body.setVelocity.mock.calls.at(-1)
    expect(vx).toBeCloseTo(0)
    expect(vy).toBeLessThan(0)
  })

  it('never retreats, even at 1 HP', () => {
    const wolf = wolfAt(scene, 300, 100)
    wolf.hp = 1
    wolf.ai.update(1000, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.CHASE)
  })

  it('stops acting when the player is dead', () => {
    scene.player.hp = 0
    const wolf = wolfAt(scene, 170, 100)
    wolf.ai.update(1000, 16)
    expect(wolf.ai.mode).toBe(WOLF_AI_MODES.PATROL)
    expect(wolf.isAttacking).toBe(false)
  })
})
