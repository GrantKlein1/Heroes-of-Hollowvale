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
      this.anims = {
        play: vi.fn((k) => {
          this.currentAnimKey = k
          return this
        }),
      }
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

import { getItemAnchor } from '../../actors/itemHold.js'
import { ARROW_VISUAL_SCALE, BOW_HAND_SCALE } from '../../items/registry.js'
import {
  spawnLightningArrow,
  ensureBowAnimations,
  getArrowSpawnOffset,
  getScaledArrowSpawnOffset,
  getBowTiming,
  ARROW_FLY_ANIM,
  ARROW_HIT_ANIM,
  ARROW_TEXTURE,
  ARROW_HIT_DROP_PX,
} from '../../combat/bowShot.js'

describe('lightning arrow (BOW-1)', () => {
  let scene

  beforeEach(() => {
    scene = {
      unit: 1,
      projectiles: [],
      _solidRects: [],
      enemies: { getChildren: vi.fn(() => []) },
      add: { existing: vi.fn((obj) => obj) },
      _float: vi.fn(),
      // the real scene reads the enemy physics body: a box on the feet row
      _enemyBox: vi.fn((e) => ({ x: e.x - 12, y: e.y - 12, w: 24, h: 12 })),
    }
  })

  it('release frame 6 is 500 ms in and the clip is 833 ms', () => {
    expect(getBowTiming()).toEqual({ releaseFrame: 6, releaseMs: 500, durationMs: 833, frames: 10 })
  })

  it('moves the release tip out with the enlarged bow and leaves the grip put', () => {
    const facing = 'right'
    const raw = getArrowSpawnOffset('knight', facing)
    const scaled = getScaledArrowSpawnOffset('knight', facing)
    const anchor = getItemAnchor('knight', 'use_bow', 'knight_use_bow_right_6')
    expect(BOW_HAND_SCALE).toBe(1.45)
    expect(scaled.x).toBeCloseTo(anchor.x + (raw.x - anchor.x) * BOW_HAND_SCALE, 4)
    expect(scaled.y).toBeCloseTo(anchor.y + (raw.y - anchor.y) * BOW_HAND_SCALE, 4)
    expect(Math.hypot(scaled.x - anchor.x, scaled.y - anchor.y)).toBeCloseTo(
      Math.hypot(raw.x - anchor.x, raw.y - anchor.y) * BOW_HAND_SCALE,
      4,
    )
  })

  it.each([
    ['down', 0, 1],
    ['up', 0, -1],
    ['left', -1, 0],
    ['right', 1, 0],
  ])('spawns tip-first facing %s with the registry numbers and the frame-6 arrow tip', (facing, dx, dy) => {
    const player = { x: 300, y: 400, classId: 'knight', scaleX: 1 }
    const arrow = spawnLightningArrow(scene, player, facing)
    const tip = getScaledArrowSpawnOffset('knight', facing)
    expect(scene.projectiles).toEqual([arrow])
    expect(arrow.texture.key).toBe(ARROW_TEXTURE)
    expect(arrow.x).toBeCloseTo(300 + tip.x, 3)
    expect(arrow.y).toBeCloseTo(400 + tip.y, 3)
    expect(arrow.vx).toBe(dx * 520)
    expect(arrow.vy).toBe(dy * 520)
    expect(arrow.maxDist).toBe(360)
    expect(arrow.size).toBe(24)
    expect(arrow.w).toBe(24)
    expect(arrow.h).toBe(24)
    expect(arrow.scaleX).toBeCloseTo(ARROW_VISUAL_SCALE, 5)
    expect(arrow.scaleY).toBeCloseTo(ARROW_VISUAL_SCALE, 5)
    expect(arrow.visualScale).toBe(ARROW_VISUAL_SCALE)
    expect(arrow.damage).toBe(14)
    expect(arrow.owner).toBe('player')
    expect(arrow.originX).toBeCloseTo(76 / 96, 4)
    expect(arrow.rotation).toBeCloseTo(Math.atan2(dy, dx), 5)
    expect(arrow.flyAnim).toBe(ARROW_FLY_ANIM)
    expect(arrow.hitAnim).toBe(ARROW_HIT_ANIM)
    expect(arrow.hitOffsetY).toBe(ARROW_HIT_DROP_PX)
  })

  it('hits an enemy standing on the feet row ahead of the hero: 14 damage, then the impact clip', () => {
    const player = { x: 100, y: 300, classId: 'thief', scaleX: 1 }
    const enemy = { x: 300, y: 300, hp: 30, hpMax: 30 }
    scene.enemies.getChildren.mockReturnValue([enemy])
    const arrow = spawnLightningArrow(scene, player, 'right')
    let t = 0
    for (let i = 0; i < 40 && !arrow.isImpacted; i++) {
      t += 16
      arrow.update(t, 0.016)
    }
    expect(arrow.isImpacted).toBe(true)
    expect(enemy.hp).toBe(16)
    expect(arrow.anims.play).toHaveBeenCalledWith(ARROW_HIT_ANIM, true)
    expect(scene._float).toHaveBeenCalledWith(enemy.x, enemy.y - 6, '-14', '#ff6161')
  })

  it('flies past an enemy that is off to the side, and stops at its range', () => {
    const player = { x: 100, y: 300, classId: 'mage', scaleX: 1 }
    scene.enemies.getChildren.mockReturnValue([{ x: 300, y: 380, hp: 30, hpMax: 30 }])
    const arrow = spawnLightningArrow(scene, player, 'right')
    let t = 0
    while (!arrow.isImpacted && t < 3000) { t += 16; arrow.update(t, 0.016) }
    expect(arrow.isImpacted).toBe(true)
    expect(arrow.distanceTraveled).toBeGreaterThanOrEqual(360)
    expect(scene.enemies.getChildren()[0].hp).toBe(30)
  })

  it('stops against a wall', () => {
    const player = { x: 100, y: 300, classId: 'dwarf', scaleX: 1 }
    scene._solidRects = [{ x: 200, y: 300 - 10, w: 20, h: 40 }]
    const arrow = spawnLightningArrow(scene, player, 'right')
    let t = 0
    while (!arrow.isImpacted && t < 3000) { t += 16; arrow.update(t, 0.016) }
    expect(arrow.isImpacted).toBe(true)
    expect(arrow.distanceTraveled).toBeLessThan(200)
  })

  it('creates the flight and impact clips under plain keys once the textures exist', () => {
    const created = []
    const anims = {
      exists: vi.fn((k) => created.includes(k)),
      create: vi.fn((cfg) => created.push(cfg.key)),
    }
    expect(ensureBowAnimations({ anims, textures: { exists: () => false } })).toBe(false)
    expect(created).toEqual([])
    expect(ensureBowAnimations({ anims, textures: { exists: () => true } })).toBe(true)
    expect(created).toEqual([ARROW_FLY_ANIM, ARROW_HIT_ANIM])
    const fly = anims.create.mock.calls[0][0]
    expect(fly).toMatchObject({ frameRate: 16, repeat: -1 })
    expect(fly.frames).toHaveLength(4)
    const hit = anims.create.mock.calls[1][0]
    expect(hit).toMatchObject({ frameRate: 16, repeat: 0 })
    expect(hit.frames).toHaveLength(7)
    expect(hit.frames[0]).toEqual({ key: 'lightning_arrow_impact_b12', frame: 'lightning_arrow_impact_b12_0' })
  })
})
