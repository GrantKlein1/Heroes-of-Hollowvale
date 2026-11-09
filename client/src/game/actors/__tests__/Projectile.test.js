import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame }
      this.originX = 0.5
      this.originY = 0.5
      this.depth = 0
      this.active = true
      this.visible = true
      this.rotation = 0
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
    setRotation(r) {
      this.rotation = r
      return this
    }
    setPosition(x, y) {
      this.x = x
      this.y = y
      return this
    }
    setDisplaySize(w, h) {
      this.displayWidth = w
      this.displayHeight = h
      return this
    }
    setTexture(k, f) {
      this.texture = { key: k }
      this.frame = { name: f }
      return this
    }
    play(k) {
      this.currentAnimKey = k
      return this
    }
    destroy() {
      this.active = false
      this.visible = false
    }
  }

  class MockEventEmitter {
    on() { return this }
    once() { return this }
    emit() { return true }
    off() { return this }
  }

  return {
    default: {
      Events: {
        EventEmitter: MockEventEmitter,
      },
      GameObjects: {
        Sprite: MockSprite,
      },
      Animations: {
        Events: {
          ANIMATION_COMPLETE: 'animationcomplete',
        },
      },
    },
  }
})

import { Projectile, rectIntersects } from '../Projectile.js'

describe('Projectile Class (Package 1-5)', () => {
  let mockScene

  beforeEach(() => {
    mockScene = {
      unit: 1,
      projectiles: [],
      _solidRects: [],
      enemies: {
        getChildren: vi.fn(() => []),
      },
      add: {
        existing: vi.fn((obj) => obj),
      },
      _float: vi.fn(),
      _enemyBox: vi.fn((e) => ({ x: e.x - 16, y: e.y - 16, w: 32, h: 32 })),
    }
  })

  it('initializes with atlas texture, direction, speed, and bounds', () => {
    const proj = new Projectile(mockScene, 100, 100, 'fireball', 'fireball_fly_0', {
      dirX: 1,
      dirY: 0,
      speed: 400,
      maxDist: 200,
      damage: 12,
    })

    expect(proj.x).toBe(100)
    expect(proj.y).toBe(100)
    expect(proj.vx).toBe(400)
    expect(proj.vy).toBe(0)
    expect(proj.maxDist).toBe(200)
    expect(proj.damage).toBe(12)

    const bounds = proj.getBounds()
    expect(bounds.x).toBe(100 - 16)
    expect(bounds.y).toBe(100 - 16)
    expect(bounds.w).toBe(32)
    expect(bounds.h).toBe(32)
  })

  it('updates linear flight position over time and reaches max distance', () => {
    const proj = new Projectile(mockScene, 100, 100, 'fireball', 'fireball_fly_0', {
      dirX: 1,
      dirY: 0,
      speed: 100,
      maxDist: 50,
    })

    // Advance 0.2s -> travel 20 px
    proj.update(1000, 0.2)
    expect(proj.x).toBeCloseTo(120)
    expect(proj.y).toBe(100)
    expect(proj.isImpacted).toBe(false)

    // Advance 0.4s -> travel total 60 px > maxDist 50 -> impacts
    proj.update(1200, 0.4)
    expect(proj.isImpacted).toBe(true)
    expect(proj.vx).toBe(0)
    expect(proj.vy).toBe(0)
  })

  it('calculates parabolic arc trajectory for arced projectiles (poison vial)', () => {
    const proj = new Projectile(mockScene, 0, 100, 'thief_fx', 'thief_fx_poison_vial_0', {
      dirX: 1,
      dirY: 0,
      speed: 100,
      maxDist: 100,
      isArc: true,
      arcHeight: 20,
      bakedSpin: true,
    })

    expect(proj.bakedSpin).toBe(true)
    expect(proj.rotation).toBe(0) // Does not rotate sprite transform to angle

    // Mid-flight (progress = 0.5) -> arc offset = -4 * 20 * 0.5 * 0.5 = -20 px
    proj.update(1000, 0.5)
    expect(proj.x).toBeCloseTo(50)
    expect(proj.groundY).toBeCloseTo(100)
    expect(proj.y).toBeCloseTo(80) // 100 - 20

    // Landing (progress = 1.0) -> y returns to groundY
    proj.update(1500, 0.5)
    expect(proj.isImpacted).toBe(true)
    expect(proj.y).toBeCloseTo(100)
  })

  it('detects collision with solid world geometry and impacts', () => {
    mockScene._solidRects = [{ x: 150, y: 80, w: 40, h: 40 }]

    const proj = new Projectile(mockScene, 100, 100, 'fireball', 'fireball_fly_0', {
      dirX: 1,
      dirY: 0,
      speed: 100,
      maxDist: 200,
    })

    // Step into solid
    proj.update(1000, 0.4) // x reaches 140, bounds overlap 150-190
    expect(proj.isImpacted).toBe(true)
  })

  it('detects collision with enemies, applies damage, and transitions to impact/linger', () => {
    const mockEnemy = {
      x: 150,
      y: 100,
      hp: 30,
      hpMax: 30,
    }
    mockScene.enemies.getChildren.mockReturnValue([mockEnemy])

    const proj = new Projectile(mockScene, 100, 100, 'thief_fx', 'thief_fx_poison_vial_0', {
      dirX: 1,
      dirY: 0,
      speed: 100,
      maxDist: 200,
      damage: 8,
      impact: 'poison',
      lingerMs: 2000,
      lingerDps: 5,
    })

    proj.update(1000, 0.4) // Hits enemy at 150
    expect(proj.isLingering).toBe(true)
    expect(mockEnemy.hp).toBe(22) // 30 - 8
    expect(proj.isLingering).toBe(true)
    expect(proj.lingerUntil).toBe(1000 + 2000)

    // Ticks damage inside puddle
    proj.update(1600, 0.2) // 5 dps * 0.2 = 1 dmg
    expect(mockEnemy.hp).toBeCloseTo(21)

    // Expires after lingerMs
    const active = proj.update(3500, 0.1)
    expect(active).toBe(false)
    expect(proj.active).toBe(false)
  })

  it('detects collision of enemy projectile with player and plays impact animation', () => {
    mockScene.player = {
      x: 200,
      y: 100,
      takeDamage: vi.fn(),
    }

    const proj = new Projectile(mockScene, 100, 100, 'goblin_archer', 'goblin_archer_arrow_right', {
      owner: 'enemy',
      dirX: 1,
      dirY: 0,
      speed: 300,
      maxDist: 400,
      damage: 10,
      hitAnim: 'goblin_archer_arrow_impact',
    })

    proj.anims = {
      play: vi.fn(),
    }

    // Step 0.35s -> travel 105 px -> reach x = 205 (overlaps player at 200)
    proj.update(1000, 0.35)

    expect(proj.isImpacted).toBe(true)
    expect(mockScene.player.takeDamage).toHaveBeenCalledWith(10, 1000, expect.objectContaining({
      projectile: proj,
      fromX: proj.x,
      fromY: proj.y,
    }))
    expect(proj.anims.play).toHaveBeenCalledWith('goblin_archer_arrow_impact', true)
    expect(proj.rotation).toBe(0)
  })

  it('rectIntersects accurately determines overlap', () => {
    expect(rectIntersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
    expect(rectIntersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(false)
    expect(rectIntersects(null, { x: 0, y: 0, w: 10, h: 10 })).toBe(false)
  })
})
