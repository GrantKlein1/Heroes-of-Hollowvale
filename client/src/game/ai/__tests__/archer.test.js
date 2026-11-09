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
      this.originY = 0.9375
      this.rotation = 0
      this.active = true
      this.visible = true
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
        currentFrame: { index: 0 },
      }
    }
    setOrigin(x, y) { this.originX = x; this.originY = y; return this }
    setDepth(d) { this.depth = d; return this }
    setRotation(r) { this.rotation = r; return this }
    setTexture(k, f) { this.texture = { key: k }; this.frame = { name: f }; return this }
    play(k) { this.currentAnimKey = k; return this }
    destroy() { this.active = false; this.visible = false }
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

import {
  ArcherAI,
  ARCHER_AI_MODES,
  MIN_DISTANCE_PX,
  MAX_DISTANCE_PX,
  AGGRO_RADIUS_PX,
  ARROW_SPEED,
  ARROW_RANGE,
  ATTACK_COOLDOWN_MS,
  RELEASE_FRAME,
  RELEASE_ELAPSED_MS,
  TOTAL_ATTACK_DURATION_MS,
  SPAWN_OFFSETS,
  hasLineOfSight,
  lineIntersectsRect,
  getArrowSpawnPosition,
} from '../archer.js'
import { AttackTokenManager } from '../tokens.js'

function createMockEnemy(scene, x = 300, y = 100) {
  return {
    scene,
    x,
    y,
    hp: 12,
    hpMax: 12,
    speed: 60,
    damage: 8,
    facing: 'left',
    texture: { key: 'goblin_archer' },
    body: {
      setVelocity: vi.fn(),
      velocity: { x: 0, y: 0 },
    },
    anims: {
      play: vi.fn(),
      currentFrame: { index: 0 },
    },
    playAnim: vi.fn(),
    transition: vi.fn(),
    is: vi.fn((st) => false),
  }
}

function createMockScene() {
  const tokenManager = new AttackTokenManager(2)
  return {
    unit: 1,
    projectiles: [],
    _solidRects: [],
    attackTokenManager: tokenManager,
    player: {
      x: 100,
      y: 100,
      hp: 100,
      takeDamage: vi.fn(),
      is: vi.fn(() => false),
    },
    add: {
      existing: vi.fn((obj) => obj),
    },
    _float: vi.fn(),
    _hurtPlayer: vi.fn(),
  }
}

describe('Archer AI Controller (Package 1b-3)', () => {
  let mockScene

  beforeEach(() => {
    mockScene = createMockScene()
  })

  describe('Criterion 1: Arrow spawn offset matches meta within +-2 px', () => {
    it('matches exact meta spawnOffsetFromFeet for all 4 facings', () => {
      const archerPos = { x: 200, y: 200 }

      const expectedOffsets = {
        down: { x: -3.5, y: -26.0 },
        right: { x: 27.5, y: -31.0 },
        up: { x: 3.5, y: -37.4 },
        left: { x: -27.5, y: -32.4 },
      }

      for (const [dir, expected] of Object.entries(expectedOffsets)) {
        const spawnPos = getArrowSpawnPosition(archerPos, dir)
        const expectedX = archerPos.x + expected.x
        const expectedY = archerPos.y + expected.y

        const diffX = Math.abs(spawnPos.x - expectedX)
        const diffY = Math.abs(spawnPos.y - expectedY)

        expect(diffX).toBeLessThanOrEqual(2)
        expect(diffY).toBeLessThanOrEqual(2)
        expect(spawnPos.x).toBeCloseTo(expectedX)
        expect(spawnPos.y).toBeCloseTo(expectedY)
      }
    })

    it('spawns Projectile at meta offset when release frame is reached', () => {
      const enemy = createMockEnemy(mockScene, 300, 100)
      enemy.facing = 'left'
      const ai = new ArcherAI(enemy)

      // Start attack at t = 1000
      ai.startAttack(1000)
      expect(ai.isAttacking).toBe(true)
      expect(mockScene.projectiles.length).toBe(0)

      // Advance to release frame (t = 1760, elapsed = 760 ms)
      ai.update(1760, 16)
      expect(mockScene.projectiles.length).toBe(1)

      const proj = mockScene.projectiles[0]
      const expectedOffset = SPAWN_OFFSETS.left // { x: -27.5, y: -32.4 }
      expect(proj.x).toBeCloseTo(300 + expectedOffset.x)
      expect(proj.y).toBeCloseTo(100 + expectedOffset.y)
      expect(Math.abs(proj.x - (300 + expectedOffset.x))).toBeLessThanOrEqual(2)
      expect(Math.abs(proj.y - (100 + expectedOffset.y))).toBeLessThanOrEqual(2)
    })
  })

  describe('Criterion 2: Archer does not shoot through walls/colliders (Line of Sight)', () => {
    it('lineIntersectsRect accurately detects line vs solid collider intersection', () => {
      const wall = { x: 180, y: 80, w: 40, h: 40 }

      // Line straight through the wall from (100, 100) to (300, 100)
      expect(lineIntersectsRect(100, 100, 300, 100, wall)).toBe(true)

      // Line clear above wall from (100, 50) to (300, 50)
      expect(lineIntersectsRect(100, 50, 300, 50, wall)).toBe(false)

      // Line clear below wall from (100, 150) to (300, 150)
      expect(lineIntersectsRect(100, 150, 300, 150, wall)).toBe(false)
    })

    it('hasLineOfSight returns false when solid is between archer and player', () => {
      mockScene._solidRects = [{ x: 200, y: 80, w: 30, h: 40 }]

      expect(hasLineOfSight(100, 100, 300, 100, mockScene._solidRects)).toBe(false)
      expect(hasLineOfSight(100, 200, 300, 200, mockScene._solidRects)).toBe(true)
    })

    it('repositions and does NOT start attack when line of sight is obstructed', () => {
      // Archer at (280, 100), player at (100, 100). Distance = 180 px (within [140, 220] range)
      const enemy = createMockEnemy(mockScene, 280, 100)
      const ai = new ArcherAI(enemy)

      // Place a wall directly between them
      mockScene._solidRects = [{ x: 180, y: 80, w: 40, h: 40 }]

      ai.update(1000, 16)

      expect(ai.mode).toBe(ARCHER_AI_MODES.REPOSITION)
      expect(ai.isAttacking).toBe(false)
      expect(mockScene.projectiles.length).toBe(0)
    })

    it('engages in attack when line of sight is clear', () => {
      // Archer at (280, 100), player at (100, 100). Distance = 180 px, no walls
      const enemy = createMockEnemy(mockScene, 280, 100)
      const ai = new ArcherAI(enemy)
      mockScene._solidRects = []

      ai.update(1000, 16)

      expect(ai.mode).toBe(ARCHER_AI_MODES.ATTACK)
      expect(ai.isAttacking).toBe(true)
    })
  })

  describe('Criterion 3: arrow_impact plays on hit', () => {
    it('sets hitAnim to goblin_archer_arrow_impact and plays impact animation on hit', () => {
      const enemy = createMockEnemy(mockScene, 280, 100)
      const ai = new ArcherAI(enemy)

      ai.startAttack(1000)
      ai.update(1760, 16) // Spawns arrow

      expect(mockScene.projectiles.length).toBe(1)
      const arrow = mockScene.projectiles[0]
      expect(arrow.hitAnim).toBe('goblin_archer_arrow_impact')

      arrow.anims = {
        play: vi.fn(),
      }

      // Arrow hits player
      arrow.impact(mockScene.player, false, 2000)

      expect(arrow.isImpacted).toBe(true)
      expect(arrow.anims.play).toHaveBeenCalledWith('goblin_archer_arrow_impact', true)
      expect(arrow.rotation).toBe(0)
    })

    it('plays arrow_impact when colliding with solid terrain', () => {
      const enemy = createMockEnemy(mockScene, 280, 100)
      const ai = new ArcherAI(enemy)

      ai.startAttack(1000)
      ai.update(1760, 16)

      const arrow = mockScene.projectiles[0]
      arrow.anims = { play: vi.fn() }

      // Arrow impacts wall
      arrow.impact(null, true, 2000)

      expect(arrow.isImpacted).toBe(true)
      expect(arrow.anims.play).toHaveBeenCalledWith('goblin_archer_arrow_impact', true)
    })
  })

  describe('Distance Keeping: Kiting between 140 and 220 px', () => {
    it('advances towards player when distance > 220 px', () => {
      // Distance = 260 px
      const enemy = createMockEnemy(mockScene, 360, 100)
      const ai = new ArcherAI(enemy)

      ai.update(1000, 16)

      expect(ai.mode).toBe(ARCHER_AI_MODES.ADVANCE)
      const [vx] = enemy.body.setVelocity.mock.calls[0]
      expect(vx).toBeLessThan(0) // Moves left towards player at x = 100
    })

    it('retreats away from player when distance < 140 px', () => {
      // Distance = 100 px
      const enemy = createMockEnemy(mockScene, 200, 100)
      const ai = new ArcherAI(enemy)

      ai.update(1000, 16)

      expect(ai.mode).toBe(ARCHER_AI_MODES.RETREAT)
      const [vx] = enemy.body.setVelocity.mock.calls[0]
      expect(vx).toBeGreaterThan(0) // Moves right away from player at x = 100
    })

    it('halts and maintains position when distance is between 140 and 220 px', () => {
      // Distance = 180 px
      const enemy = createMockEnemy(mockScene, 280, 100)
      const ai = new ArcherAI(enemy)

      ai.update(1000, 16)

      const [vx, vy] = enemy.body.setVelocity.mock.calls[0]
      expect(vx).toBe(0)
      expect(vy).toBe(0)
    })
  })

  describe('Attack Timing, Per-Frame Durations, and 1800 ms Cooldown', () => {
    it('enforces release at 760 ms and total attack duration of 980 ms', () => {
      const enemy = createMockEnemy(mockScene, 280, 100)
      const ai = new ArcherAI(enemy)

      // Start attack at t = 1000
      ai.startAttack(1000)

      // t = 1500 (elapsed 500 ms): frame 4, arrow NOT spawned
      ai.update(1500, 16)
      expect(ai.isAttacking).toBe(true)
      expect(mockScene.projectiles.length).toBe(0)

      // t = 1760 (elapsed 760 ms): frame 6 release!
      ai.update(1760, 16)
      expect(mockScene.projectiles.length).toBe(1)

      // t = 1970 (elapsed 970 ms): attack still concluding
      ai.update(1970, 16)
      expect(ai.isAttacking).toBe(true)

      // t = 1980 (elapsed 980 ms): attack finishes, cooldown set to 1980 + 1800 = 3780
      ai.update(1980, 16)
      expect(ai.isAttacking).toBe(false)
      expect(ai.attackCooldownUntil).toBe(1980 + ATTACK_COOLDOWN_MS)
    })

    it('respects 1800 ms cooldown before allowing next attack', () => {
      const enemy = createMockEnemy(mockScene, 280, 100)
      const ai = new ArcherAI(enemy)

      ai.startAttack(1000)
      ai.update(1980, 16) // Finished at 1980, cooldown until 3780

      // t = 3000 (elapsed 1020 ms into cooldown < 1800 ms): stays in AIM mode, does not attack
      ai.update(3000, 16)
      expect(ai.mode).toBe(ARCHER_AI_MODES.AIM)
      expect(ai.isAttacking).toBe(false)

      // t = 3780 (cooldown expired): initiates new attack
      ai.update(3780, 16)
      expect(ai.mode).toBe(ARCHER_AI_MODES.ATTACK)
      expect(ai.isAttacking).toBe(true)
    })

    it('creates arrow with speed 300 px/s and range 400 px', () => {
      const enemy = createMockEnemy(mockScene, 280, 100)
      const ai = new ArcherAI(enemy)

      ai.startAttack(1000)
      ai.update(1760, 16)

      const arrow = mockScene.projectiles[0]
      expect(arrow.maxDist).toBe(ARROW_RANGE) // 400
      expect(Math.hypot(arrow.vx, arrow.vy)).toBeCloseTo(ARROW_SPEED) // 300
    })
  })
})

