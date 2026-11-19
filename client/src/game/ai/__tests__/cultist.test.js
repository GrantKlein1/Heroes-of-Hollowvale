import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 96, height: 96 }
      this.originX = 0.5
      this.originY = 0.5
      this.rotation = 0
      this.active = true
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
        currentFrame: null,
      }
    }
    setOrigin(x, y) { this.originX = x; this.originY = y; return this }
    setDepth(d) { this.depth = d; return this }
    setScale(s) { this.scale = s; return this }
    setRotation(r) { this.rotation = r; return this }
    setTexture(k) { this.texture = { key: k }; return this }
    play() { return this }
    destroy() { this.active = false }
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
import { ArcherAI } from '../archer.js'
import {
  CultistAI,
  CULTIST_AI_MODES,
  CULTIST_MIN_DISTANCE_PX,
  CULTIST_MAX_DISTANCE_PX,
  CULTIST_AGGRO_RADIUS_PX,
  CULTIST_COOLDOWN_MS,
  CULTIST_MELEE_RANGE_PX,
  CULTIST_RELEASE_ELAPSED_MS,
  CULTIST_TOTAL_ATTACK_MS,
  EMBER_BOLT_TEXTURE,
  EMBER_BOLT_FLY_ANIM,
  EMBER_BOLT_HIT_ANIM,
  EMBER_BOLT_SPAWN_FRAME,
  EMBER_BOLT_SCALE,
  ensureAshenBoltAnimations,
} from '../cultist.js'
import { AttackTokenManager } from '../tokens.js'

// Attack meta, copied from ashen_cultist.json.
const CULTIST_META = {
  origin: { x: 0.5, y: 0.9271 },
  footprint: { x: -14, y: -5, w: 28, h: 10, shape: 'ellipse' },
  hurtbox: { x: -16, y: -29, w: 32, h: 29 },
  anims: {
    attack: {
      frames: 7,
      hitFrames: [3],
      weaponTipOffsetFromFeet: {
        3: {
          down: { x: -19.8, y: -14.9 },
          right: { x: 30.8, y: -17.2 },
          up: { x: 19.8, y: -27.7 },
          left: { x: -30.8, y: -25.4 },
        },
      },
    },
  },
}

function createScene({ playerX = 100, playerY = 100 } = {}) {
  return {
    unit: 1,
    projectiles: [],
    _solidRects: [],
    textures: {
      get: vi.fn(() => ({ customData: { meta: CULTIST_META } })),
      exists: vi.fn(() => true),
    },
    anims: { exists: vi.fn((key) => !/_(spawn|alert|telegraph)_/.test(key)) },
    attackTokenManager: new AttackTokenManager(2),
    add: { existing: vi.fn((o) => o) },
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

/** Cultist standing `dist` px to the right of the player, already spawned and alerted. */
function cultistAt(scene, dist) {
  const c = new Enemy(scene, scene.player.x + dist, scene.player.y, 'ashen_cultist')
  c.ai.hasSpawned = true
  c.ai.hasAlerted = true
  return c
}

describe('CultistAI (Ashen Cultist)', () => {
  let scene
  beforeEach(() => {
    scene = createScene()
  })

  it('is an ArcherAI with the cultist numbers, fed by the def projectile', () => {
    const c = new Enemy(scene, 400, 100, 'ashen_cultist')
    expect(c.ai).toBeInstanceOf(CultistAI)
    expect(c.ai).toBeInstanceOf(ArcherAI)
    expect(c.ai.minDistance).toBe(CULTIST_MIN_DISTANCE_PX)
    expect(c.ai.maxDistance).toBe(CULTIST_MAX_DISTANCE_PX)
    expect(c.ai.aggroRadius).toBe(CULTIST_AGGRO_RADIUS_PX)
    expect(c.ai.cooldownMs).toBe(CULTIST_COOLDOWN_MS)
    expect(c.ai.damage).toBe(10)
    expect(c.ai.arrowSpeed).toBe(220)
    expect(c.ai.arrowRange).toBe(420)
    expect(c.hitFrames).toEqual([3])
  })

  it('patrols when the player is out of range', () => {
    const c = cultistAt(scene, 500)
    c.ai.update(1000, 16)
    expect(c.ai.mode).toBe(CULTIST_AI_MODES.PATROL)
  })

  it('advances when beyond 230 px and retreats when inside 150 px', () => {
    const far = cultistAt(scene, 280)
    far.ai.update(1000, 16)
    expect(far.ai.mode).toBe(CULTIST_AI_MODES.ADVANCE)
    expect(far.body.setVelocity.mock.calls.at(-1)[0]).toBeLessThan(0)

    const near = cultistAt(scene, 100)
    near.ai.update(1000, 16)
    expect(near.ai.mode).toBe(CULTIST_AI_MODES.RETREAT)
    expect(near.body.setVelocity.mock.calls.at(-1)[0]).toBeGreaterThan(0)
  })

  it('repositions instead of casting when a wall blocks the shot', () => {
    scene._solidRects = [{ x: 170, y: 80, w: 20, h: 40 }]
    const c = cultistAt(scene, 190)
    c.ai.update(1000, 16)
    expect(c.ai.mode).toBe(CULTIST_AI_MODES.REPOSITION)
    expect(c.ai.isAttacking).toBe(false)
    expect(scene.projectiles).toHaveLength(0)
  })

  it('casts from the firing band and releases ONE ember bolt on hit frame 3', () => {
    const c = cultistAt(scene, 190)
    c.ai.update(1000, 16)
    expect(c.ai.mode).toBe(CULTIST_AI_MODES.ATTACK)
    expect(c.ai.isAttacking).toBe(true)
    expect(c.animHistory).toContain('ashen_cultist_attack_left')
    expect(scene.projectiles).toHaveLength(0)

    // Still winding up: nothing yet. Enemy.update must leave the ranged cast to the AI.
    c.anims.currentFrame = { textureFrame: 'ashen_cultist_attack_left_1' }
    c.ai.update(1100, 16)
    expect(scene.projectiles).toHaveLength(0)

    // Atlas hit frame reached.
    c.anims.currentFrame = { textureFrame: 'ashen_cultist_attack_left_3' }
    c.ai.update(1150, 16)
    expect(scene.projectiles).toHaveLength(1)
    c.ai.update(1200, 16)
    expect(scene.projectiles).toHaveLength(1)

    const bolt = scene.projectiles[0]
    expect(EMBER_BOLT_TEXTURE).toBe('ashen_bolt')
    expect(EMBER_BOLT_FLY_ANIM).toBe('ashen_bolt_fly')
    expect(EMBER_BOLT_HIT_ANIM).toBe('ashen_bolt_hit')
    expect(EMBER_BOLT_SPAWN_FRAME).toBe('ashen_bolt_fly_0')
    expect(bolt.texture.key).toBe('ashen_bolt')
    expect(bolt.texture.key).not.toBe('fireball')
    expect(bolt.frame.name).toBe(EMBER_BOLT_SPAWN_FRAME)
    expect(bolt.flyAnim).toBe(EMBER_BOLT_FLY_ANIM)
    expect(bolt.hitAnim).toBe(EMBER_BOLT_HIT_ANIM)
    expect(bolt.scale).toBe(EMBER_BOLT_SCALE)
    expect(bolt.owner).toBe('enemy')
    expect(bolt.shooter).toBe(c)
    expect(bolt.damage).toBe(10)
    expect(bolt.maxDist).toBe(420)
    expect(bolt.size).toBe(14)
    // Spawns at the left-facing blade tip from meta, flies toward the player (left).
    expect(bolt.x).toBeCloseTo(c.x - 30.8)
    expect(bolt.y).toBeCloseTo(c.y - 25.4)
    expect(bolt.vx).toBeLessThan(0)
    expect(Math.hypot(bolt.vx, bolt.vy)).toBeCloseTo(220)
  })

  it('still releases the bolt at 390 ms if the frame event was missed', () => {
    const c = cultistAt(scene, 190)
    c.ai.update(1000, 16)
    c.ai.update(1000 + CULTIST_RELEASE_ELAPSED_MS - 1, 16)
    expect(scene.projectiles).toHaveLength(0)
    c.ai.update(1000 + CULTIST_RELEASE_ELAPSED_MS, 16)
    expect(scene.projectiles).toHaveLength(1)
  })

  it('spawns the bolt at the right tip for every facing', () => {
    const tips = { down: [-19.8, -14.9], right: [30.8, -17.2], up: [19.8, -27.7], left: [-30.8, -25.4] }
    for (const [facing, [tx, ty]] of Object.entries(tips)) {
      const c = cultistAt(scene, 190)
      const p = c.ai.getBoltSpawnPosition(facing)
      expect(p.x).toBeCloseTo(c.x + tx)
      expect(p.y).toBeCloseTo(c.y + ty)
    }
  })

  it('goes on cooldown after the cast and holds fire until it is over', () => {
    const c = cultistAt(scene, 190)
    c.ai.update(1000, 16)
    c.ai.update(1000 + CULTIST_TOTAL_ATTACK_MS, 16)
    expect(c.ai.isAttacking).toBe(false)
    expect(c.ai.attackCooldownUntil).toBe(1000 + CULTIST_TOTAL_ATTACK_MS + CULTIST_COOLDOWN_MS)
    expect(scene.attackTokenManager.tokens.has(c)).toBe(false)

    c.ai.update(1000 + CULTIST_TOTAL_ATTACK_MS + 500, 16)
    expect(c.ai.mode).toBe(CULTIST_AI_MODES.AIM)
    expect(c.ai.isAttacking).toBe(false)

    c.ai.update(c.ai.attackCooldownUntil, 16)
    expect(c.ai.mode).toBe(CULTIST_AI_MODES.ATTACK)
  })

  it('does not cast when no attack token is free', () => {
    scene.attackTokenManager.acquire({ id: 'a' })
    scene.attackTokenManager.acquire({ id: 'b' })
    const c = cultistAt(scene, 190)
    c.ai.update(1000, 16)
    expect(c.ai.isAttacking).toBe(false)
    expect(c.ai.mode).toBe(CULTIST_AI_MODES.AIM)
  })

  it('an interrupted cast (hurt) fires nothing and recovers after 600 ms', () => {
    const c = cultistAt(scene, 190)
    c.ai.update(1000, 16)
    expect(c.ai.isAttacking).toBe(true)
    c.ai.interruptAttack(1100)
    expect(c.ai.isAttacking).toBe(false)
    expect(c.ai.attackCooldownUntil).toBe(1700)
    expect(scene.projectiles).toHaveLength(0)
  })

  describe('ashen bolt clips', () => {
    function animScene({ textureLoaded = true } = {}) {
      const created = new Map()
      return {
        textures: { exists: vi.fn(() => textureLoaded) },
        anims: {
          create: vi.fn((config) => {
            created.set(config.key, { ...config, frames: config.frames.slice() })
            return created.get(config.key)
          }),
          exists: vi.fn((key) => created.has(key)),
          get: vi.fn((key) => created.get(key) || null),
          remove: vi.fn((key) => created.delete(key)),
        },
        created,
      }
    }

    it('registers fly at 12 fps looping and hit at 14 fps once', () => {
      const scene = animScene()
      const keys = ensureAshenBoltAnimations(scene)
      expect(keys).toEqual(['ashen_bolt_fly', 'ashen_bolt_hit'])

      const fly = scene.created.get('ashen_bolt_fly')
      const hit = scene.created.get('ashen_bolt_hit')
      expect(fly.frameRate).toBe(12)
      expect(fly.repeat).toBe(-1)
      expect(hit.frameRate).toBe(14)
      expect(hit.repeat).toBe(0)
      expect(fly.frames).toHaveLength(6)
      expect(hit.frames).toHaveLength(6)
      expect(fly.frames[0]).toEqual({ key: 'ashen_bolt', frame: 'ashen_bolt_fly_0' })
      expect(fly.frames[5]).toEqual({ key: 'ashen_bolt', frame: 'ashen_bolt_fly_5' })
      expect(hit.frames[0]).toEqual({ key: 'ashen_bolt', frame: 'ashen_bolt_hit_0' })
      expect(hit.frames[5]).toEqual({ key: 'ashen_bolt', frame: 'ashen_bolt_hit_5' })
      expect(scene.anims.create.mock.calls.map((c) => c[0].key)).not.toContain('fireball_fly')
      expect(scene.anims.create.mock.calls.map((c) => c[0].key)).not.toContain('fireball_hit')
    })

    it('does not register a second copy, and skips when the atlas is absent', () => {
      const scene = animScene()
      ensureAshenBoltAnimations(scene)
      expect(ensureAshenBoltAnimations(scene)).toEqual([])
      expect(scene.anims.create).toHaveBeenCalledTimes(2)

      const missing = animScene({ textureLoaded: false })
      expect(ensureAshenBoltAnimations(missing)).toEqual([])
      expect(missing.anims.create).not.toHaveBeenCalled()
    })

    it('replaces an empty stub clip so the bolt can play', () => {
      const scene = animScene()
      scene.anims.exists.mockImplementation(() => true)
      scene.anims.get.mockImplementation((key) => (key === 'ashen_bolt_fly' ? { frames: [] } : { frames: [{ key: 'ashen_bolt' }] }))
      const keys = ensureAshenBoltAnimations(scene)
      expect(scene.anims.remove).toHaveBeenCalledWith('ashen_bolt_fly')
      expect(keys).toEqual(['ashen_bolt_fly'])
    })
  })

  describe('melee fallback (cornered)', () => {
    it('swings the blade through Enemy melee when the player is on top of it', () => {
      const c = cultistAt(scene, CULTIST_MELEE_RANGE_PX - 8)
      c.ai.update(1000, 16)
      expect(c.ai.mode).toBe(CULTIST_AI_MODES.MELEE)
      expect(c.isAttacking).toBe(true)
      expect(c.attackPhase).toBe('swing')
      expect(c.ai.isAttacking).toBe(false)
      expect(scene.projectiles).toHaveLength(0)
      expect(scene.attackTokenManager.tokens.has(c)).toBe(true)
    })

    it('lands the blade on hit frame 3 with the def melee damage', () => {
      const c = cultistAt(scene, 24)
      c.ai.update(1000, 16)
      c.update(c.swingStartTime + 400, 16)
      expect(scene.player.takeDamage).toHaveBeenCalledTimes(1)
      expect(scene.player.takeDamage.mock.calls[0][0]).toBe(c.damage)
      expect(scene.projectiles).toHaveLength(0)
    })

    it('waits out the melee cooldown, and the kiting loop takes over after', () => {
      const c = cultistAt(scene, 30)
      c.ai.update(1000, 16)
      const t = c.swingStartTime + 950
      c.update(t, 16)
      expect(c.isAttacking).toBe(false)
      expect(c.attackCooldownUntil).toBeGreaterThan(t)
      c.ai.update(t + 50, 16)
      expect(c.ai.mode).toBe(CULTIST_AI_MODES.RETREAT)
      expect(c.isAttacking).toBe(false)
    })

    it('does not swing from beyond melee range', () => {
      const c = cultistAt(scene, CULTIST_MELEE_RANGE_PX + 20)
      c.ai.update(1000, 16)
      expect(c.isAttacking).toBe(false)
      expect(c.ai.mode).toBe(CULTIST_AI_MODES.RETREAT)
    })
  })
})
