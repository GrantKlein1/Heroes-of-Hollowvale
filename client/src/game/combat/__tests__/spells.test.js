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

import {
  FIREBALL_SPAWN_OFFSETS,
  FIREBALL_MANA_COST,
  MANA_REGEN_PER_SEC,
  MANA_MAX,
  LEECH_COOLDOWN_MS,
  getFireballSpawnPosition,
  getSpellSpawnPosition,
  castFireball,
  castLightning,
  castLeech,
  castShield,
  castBlink,
  throwPoisonVial,
  ensureSpellAnimations,
} from '../spells.js'
import { session } from '../../session.js'
import mageCastAtlas from '../../../../public/assets/characters/mage/mage_cast.json'
import thiefFxAtlas from '../../../../public/assets/characters/thief/fx/thief_fx.json'

describe('Spells & Projectile Mechanics (Package 1-5)', () => {
  let mockScene
  let mockPlayer

  beforeEach(() => {
    mockScene = {
      unit: 1,
      mana: 100,
      manaMax: 100,
      hp: 100,
      hpMax: 100,
      projectiles: [],
      _solidRects: [],
      _notices: [],
      _notice(msg) {
        this._notices.push(msg)
      },
      _publishVitals: vi.fn(),
      _float: vi.fn(),
      add: {
        existing: vi.fn((obj) => obj),
        sprite: vi.fn((x, y, key, frame) => ({
          x,
          y,
          key,
          frame,
          originX: 0.5,
          originY: 0.5,
          depth: 0,
          active: true,
          setOrigin(ox, oy) {
            this.originX = ox
            this.originY = oy
            return this
          },
          setDepth(d) {
            this.depth = d
            return this
          },
          setPosition(px, py) {
            this.x = px
            this.y = py
            return this
          },
          anims: {
            play: vi.fn(),
          },
          once: vi.fn(),
          destroy: vi.fn(() => {
            this.active = false
          }),
        })),
      },
      anims: {
        exists: vi.fn(() => false),
        create: vi.fn(),
      },
      events: {
        on: vi.fn(),
        off: vi.fn(),
      },
      time: {
        delayedCall: vi.fn(),
      },
      enemies: {
        getChildren: vi.fn(() => []),
      },
    }

    mockPlayer = {
      x: 200,
      y: 350,
      facing: 'down',
      depth: 1000,
      classId: 'mage',
      setPosition(px, py) {
        this.x = px
        this.y = py
      },
    }

    session.mana = 100
    session.manaMax = 100
    session.lifeLeechCooldownUntil = 0
  })

  describe('Acceptance Criterion 1: Fireball Spawn Within ±2 px of Meta Offset', () => {
    it('matches exact spawnOffsetFromFeet values from mage_cast.json across all 4 directions', () => {
      const metaOffsets = mageCastAtlas.meta.spawnOffsetFromFeet
      expect(metaOffsets).toBeDefined()

      const directions = ['down', 'left', 'right', 'up']
      for (const dir of directions) {
        const expectedOffset = metaOffsets[dir]
        const codedOffset = FIREBALL_SPAWN_OFFSETS[dir]

        expect(codedOffset.x).toBe(expectedOffset.x)
        expect(codedOffset.y).toBe(expectedOffset.y)

        mockPlayer.facing = dir
        const spawnPos = getFireballSpawnPosition(mockPlayer, dir)
        const expectedX = mockPlayer.x + expectedOffset.x
        const expectedY = mockPlayer.y + expectedOffset.y

        const deltaX = Math.abs(spawnPos.x - expectedX)
        const deltaY = Math.abs(spawnPos.y - expectedY)

        // Acceptance criterion: spawn within +-2 px
        expect(deltaX).toBeLessThanOrEqual(2)
        expect(deltaY).toBeLessThanOrEqual(2)
        expect(deltaX).toBe(0)
        expect(deltaY).toBe(0)
      }
    })

    it('spawns a fireball Projectile at the exact meta offset when castFireball is executed', () => {
      mockPlayer.facing = 'right'
      const proj = castFireball(mockScene, mockPlayer, 1000)

      expect(proj).toBeDefined()
      expect(proj.texture.key).toBe('fireball')
      expect(proj.flyAnim).toBe('fireball_fly')
      expect(proj.hitAnim).toBe('fireball_hit')

      // Meta offset for right: { x: 27, y: -58 }
      const expectedX = mockPlayer.x + 27
      const expectedY = mockPlayer.y - 58
      expect(Math.abs(proj.x - expectedX)).toBeLessThanOrEqual(2)
      expect(Math.abs(proj.y - expectedY)).toBeLessThanOrEqual(2)
      expect(proj.x).toBe(expectedX)
      expect(proj.y).toBe(expectedY)
    })
  })

  describe('Acceptance Criterion 2: Mana Cost & Regen Unchanged vs balance.js', () => {
    it('enforces exact mana constants: 15 cost, 5 regen/sec, 100 max', () => {
      expect(FIREBALL_MANA_COST).toBe(15)
      expect(MANA_REGEN_PER_SEC).toBe(5)
      expect(MANA_MAX).toBe(100)
    })

    it('deducts 15 mana on cast and publishes vitals', () => {
      mockScene.mana = 50
      session.mana = 50

      const proj = castFireball(mockScene, mockPlayer, 1000)
      expect(proj).not.toBeNull()
      expect(mockScene.mana).toBe(35)
      expect(session.mana).toBe(35)
      expect(mockScene._publishVitals).toHaveBeenCalledWith(false)
    })

    it('prevents fireball cast and warns when mana < 15', () => {
      mockScene.mana = 10
      session.mana = 10

      const proj = castFireball(mockScene, mockPlayer, 1000)
      expect(proj).toBeNull()
      expect(mockScene.mana).toBe(10)
      expect(mockScene._notices).toContain('Not enough mana.')
    })
  })

  describe('Acceptance Criterion 3: Poison Vial Uses Atlas Frames (No GIF)', () => {
    it('reads thief_fx.json metadata and spawns thief_poison_vial with baked spin', () => {
      expect(thiefFxAtlas.meta.anims.poison_vial).toBeDefined()
      expect(thiefFxAtlas.meta.anims.poison_splash).toBeDefined()

      const vial = throwPoisonVial(mockScene, mockPlayer, 1000)
      expect(vial).toBeDefined()
      expect(vial.texture.key).toBe('thief_fx')
      expect(vial.flyAnim).toBe('thief_poison_vial')
      expect(vial.hitAnim).toBe('thief_poison_splash')
      expect(vial.isArc).toBe(true)
      expect(vial.bakedSpin).toBe(true)
      expect(vial.lingerMs).toBe(2000)
      expect(vial.lingerDps).toBe(5)
    })
  })

  describe('Mage Spells: Lightning, Leech, Shield, Blink', () => {
    it('casts Lightning bolt with directional spawn offset and beam parameters', () => {
      mockPlayer.facing = 'left'
      const proj = castLightning(mockScene, mockPlayer, 1000)

      expect(proj).toBeDefined()
      expect(proj.texture.key).toBe('spell_fx')
      expect(proj.flyAnim).toBe('lightning_bolt')
      expect(proj.hitAnim).toBe('lightning_impact')
      expect(proj.impactType).toBe('lightning')
      expect(proj.originX).toBe(0.0) // Left-end pivot from notes
    })

    it('casts Life Leech, sets 10s cooldown, and drains 40% enemy HP on hit', () => {
      const proj = castLeech(mockScene, mockPlayer, 1000)
      expect(proj).toBeDefined()
      expect(proj.texture.key).toBe('spell_fx')
      expect(proj.special).toBe('lifeLeech')
      expect(session.lifeLeechCooldownUntil).toBe(1000 + LEECH_COOLDOWN_MS)

      // Next cast within 10s fails
      const duplicate = castLeech(mockScene, mockPlayer, 5000)
      expect(duplicate).toBeNull()

      // Hit enemy with 50 HP: 40% drain = 20 dmg, heals player by 20
      mockScene.hp = 70
      mockScene.hpMax = 100
      const enemy = { x: 300, y: 350, hp: 50, hpMax: 50 }
      proj._applyPlayerHit(enemy, 2000)

      expect(enemy.hp).toBe(30)
      expect(mockScene.hp).toBe(90)
    })

    it('casts Mana Shield anchored at mage feet (0.5, 0.8828)', () => {
      const shield = castShield(mockScene, mockPlayer, 1000)
      expect(shield).toBeDefined()
      expect(shield.key).toBe('spell_fx')
      expect(shield.originX).toBe(0.5)
      expect(shield.originY).toBe(0.8828)
    })

    it('casts Blink forward by 96 px if unblocked', () => {
      mockPlayer.facing = 'right'
      mockPlayer.x = 100
      mockPlayer.y = 100

      const success = castBlink(mockScene, mockPlayer, 1000)
      expect(success).toBe(true)
      expect(mockPlayer.x).toBe(196)
      expect(mockPlayer.y).toBe(100)
    })

    it('aborts Blink teleport if target location intersects solid obstacles', () => {
      mockPlayer.facing = 'right'
      mockPlayer.x = 100
      mockPlayer.y = 100
      // Obstacle directly at destination (196, 100)
      mockScene._solidRects = [{ x: 190, y: 90, w: 20, h: 20 }]

      const success = castBlink(mockScene, mockPlayer, 1000)
      expect(success).toBe(true)
      expect(mockPlayer.x).toBe(100) // Did not move through solid
    })
  })

  describe('Animation Registration (ensureSpellAnimations)', () => {
    it('registers all required spell and projectile animations without errors', () => {
      ensureSpellAnimations(mockScene)
      expect(mockScene.anims.create).toHaveBeenCalled()

      const createdKeys = mockScene.anims.create.mock.calls.map((call) => call[0].key)
      expect(createdKeys).toContain('fireball_fly')
      expect(createdKeys).toContain('fireball_hit')
      expect(createdKeys).toContain('lightning_bolt')
      expect(createdKeys).toContain('lightning_impact')
      expect(createdKeys).toContain('leech_orb')
      expect(createdKeys).toContain('leech_impact')
      expect(createdKeys).toContain('shield_form')
      expect(createdKeys).toContain('shield_loop')
      expect(createdKeys).toContain('blink_portal')
      expect(createdKeys).toContain('thief_poison_vial')
      expect(createdKeys).toContain('thief_poison_splash')
    })
  })
})
