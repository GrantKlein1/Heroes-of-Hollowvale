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
  LIGHTNING_MANA_COST,
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
  armMageV2Cast,
  tickMageV2Cast,
  getV2CastTiming,
  getVialThrowTiming,
  armPoisonVialThrow,
  tickPoisonVialThrow,
  cancelPoisonVialThrow,
  VIAL_THROW_COOLDOWN_MS,
} from '../spells.js'
import { session } from '../../session.js'
import { eventBus, GameEvents } from '../../../lib/eventBus.js'
import thiefUseThrowAtlas from '../../../../public/assets/characters/thief/thief_use_throw.json'
import thiefUseLockpickAtlas from '../../../../public/assets/characters/thief/thief_use_lockpick.json'
import dwarfUsePickaxeAtlas from '../../../../public/assets/characters/dwarf/dwarf_use_pickaxe.json'
import mageCastAtlas from '../../../../public/assets/characters/mage/mage_cast.json'
import mageSpellsV2Atlas from '../../../../public/assets/characters/mage/spells_v2/mage_spells_v2.json'
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

  describe('MANA-1: Lightning pays before the cast', () => {
    it('cast with 100 mana leaves 90 and keeps bolt damage at 15', () => {
      expect(LIGHTNING_MANA_COST).toBe(10)
      mockScene.mana = 100
      session.mana = 100

      const proj = castLightning(mockScene, mockPlayer, 1000)
      expect(proj).not.toBeNull()
      expect(proj.damage).toBe(15)
      expect(mockScene.mana).toBe(90)
      expect(session.mana).toBe(90)
      expect(mockScene._publishVitals).toHaveBeenCalledWith(false)
      expect(mockScene.mana).toBeGreaterThanOrEqual(0)

      mockPlayer._v2Cast = null
      mockScene.projectiles = []
      mockScene.mana = 100
      session.mana = 100
      const pending = armMageV2Cast(mockScene, mockPlayer, 'lightning', 2000)
      expect(pending).not.toBeNull()
      expect(mockPlayer._v2Cast).toBe(pending)
      expect(mockScene.projectiles).toHaveLength(0)
      expect(mockScene.mana).toBe(90)
      expect(session.mana).toBe(90)
    })

    it('with 5 mana casts nothing and notices, and mana never goes below 0', () => {
      mockScene.mana = 5
      session.mana = 5
      mockScene._publishVitals.mockClear()

      expect(castLightning(mockScene, mockPlayer, 1000)).toBeNull()
      expect(mockScene.projectiles).toHaveLength(0)
      expect(mockScene.mana).toBe(5)
      expect(session.mana).toBe(5)
      expect(mockScene._notices).toContain('Not enough mana.')
      expect(mockScene._publishVitals).not.toHaveBeenCalled()

      mockScene._notices = []
      expect(armMageV2Cast(mockScene, mockPlayer, 'lightning', 2000)).toBeNull()
      expect(mockPlayer._v2Cast).toBeUndefined()
      expect(mockScene.mana).toBe(5)
      expect(session.lifeLeechCooldownUntil).toBe(0)
      expect(mockScene._notices).toEqual(['Not enough mana.'])

      mockScene.mana = 0
      session.mana = 0
      mockScene._notices = []
      expect(castLightning(mockScene, mockPlayer, 3000)).toBeNull()
      expect(mockScene.mana).toBe(0)
      expect(session.mana).toBe(0)

      mockScene.mana = 10
      session.mana = 10
      const exact = castLightning(mockScene, mockPlayer, 4000)
      expect(exact).not.toBeNull()
      expect(exact.damage).toBe(15)
      expect(mockScene.mana).toBe(0)
      expect(session.mana).toBe(0)
      expect(mockScene.mana).toBeGreaterThanOrEqual(0)
    })

    it('does not charge leech, shield, or blink', () => {
      mockScene.mana = 100
      session.mana = 100
      const leech = castLeech(mockScene, mockPlayer, 1000)
      expect(leech).not.toBeNull()
      expect(mockScene.mana).toBe(100)
      expect(session.mana).toBe(100)

      session.lifeLeechCooldownUntil = 0
      mockPlayer._v2Cast = null
      const armed = armMageV2Cast(mockScene, mockPlayer, 'leech', 2000)
      expect(armed).not.toBeNull()
      expect(mockScene.mana).toBe(100)

      expect(castShield(mockScene, mockPlayer, 3000)).toBeTruthy()
      expect(castBlink(mockScene, mockPlayer, 4000)).toBe(true)
      expect(mockScene.mana).toBe(100)
      expect(session.mana).toBe(100)
    })
  })

  describe('Acceptance Criterion 3: Poison Vial Uses Atlas Frames (No GIF)', () => {
    const DIRS = ['down', 'left', 'right', 'up']

    it('ships throw, lockpick, and pickaxe clips for every facing', () => {
      for (const dir of DIRS) {
        expect(thiefUseThrowAtlas.frames[`thief_use_throw_${dir}_0`]).toBeDefined()
        expect(thiefUseThrowAtlas.frames[`thief_use_throw_${dir}_7`]).toBeDefined()
        expect(thiefUseLockpickAtlas.frames[`thief_use_lockpick_${dir}_0`]).toBeDefined()
        expect(thiefUseLockpickAtlas.frames[`thief_use_lockpick_${dir}_13`]).toBeDefined()
        expect(dwarfUsePickaxeAtlas.frames[`dwarf_use_pickaxe_${dir}_0`]).toBeDefined()
        expect(dwarfUsePickaxeAtlas.frames[`dwarf_use_pickaxe_${dir}_7`]).toBeDefined()
      }
      expect(thiefUseThrowAtlas.meta.anims.use_throw.frameNames).toBe('thief_use_throw_<dir>_<i>')
      expect(thiefUseLockpickAtlas.meta.anims.use_lockpick.frameNames).toBe('thief_use_lockpick_<dir>_<i>')
      expect(dwarfUsePickaxeAtlas.meta.anims.use_pickaxe.frameNames).toBe('dwarf_use_pickaxe_<dir>_<i>')
    })

    it('reads thief_fx.json metadata and spawns thief_poison_vial with baked spin after the wind-up', () => {
      expect(thiefFxAtlas.meta.anims.poison_vial).toBeDefined()
      expect(thiefFxAtlas.meta.anims.poison_splash).toBeDefined()

      mockPlayer.classId = 'thief'
      mockPlayer.facing = 'down'
      mockPlayer.x = 200
      mockPlayer.y = 350
      const timing = getVialThrowTiming('down')
      expect(timing.releaseFrame).toBe(3)
      expect(timing.releaseMs).toBe(250)
      expect(timing.key).toBe('thief_use_throw_down')
      expect(timing.offset).toMatchObject({
        x: thiefUseThrowAtlas.meta.anims.use_throw.spawnOffsetPx.down.x,
        y: thiefUseThrowAtlas.meta.anims.use_throw.spawnOffsetPx.down.y,
      })

      const consumed = []
      const off = eventBus.on(GameEvents.ITEM_CONSUMED, (evt) => consumed.push(evt))

      expect(throwPoisonVial(mockScene, mockPlayer, 1000)).toBeNull()
      expect(mockScene.projectiles).toHaveLength(0)
      expect(throwPoisonVial(mockScene, mockPlayer, 1000 + timing.releaseMs - 1)).toBeNull()
      expect(mockScene.projectiles).toHaveLength(0)
      expect(consumed).toHaveLength(0)
      expect(mockPlayer._vialCooldownUntil || 0).toBe(0)

      const vial = throwPoisonVial(mockScene, mockPlayer, 1000 + timing.releaseMs)
      expect(vial).toBeDefined()
      expect(vial.texture.key).toBe('thief_fx')
      expect(vial.flyAnim).toBe('thief_poison_vial')
      expect(vial.hitAnim).toBe('thief_poison_splash')
      expect(vial.isArc).toBe(true)
      expect(vial.bakedSpin).toBe(true)
      expect(vial.lingerMs).toBe(2000)
      expect(vial.lingerDps).toBe(5)
      expect(vial.damage).toBe(8)
      expect(Math.abs(vial.x - (mockPlayer.x + timing.offset.x))).toBeLessThanOrEqual(2)
      expect(Math.abs(vial.y - (mockPlayer.y + timing.offset.y))).toBeLessThanOrEqual(2)
      expect(consumed).toEqual([{ id: 'poison_vial', mode: 'search' }])
      expect(mockPlayer._vialCooldownUntil).toBe(1000 + timing.releaseMs + VIAL_THROW_COOLDOWN_MS)
      expect(mockScene._attackUntil).toBe(mockPlayer._vialCooldownUntil)
      off()
    })

    it('spawns within 2 px of the sheet offset for a second facing and ignores a frame before release', () => {
      mockPlayer.classId = 'thief'
      mockPlayer.facing = 'right'
      mockPlayer.x = 80
      mockPlayer.y = 120
      const timing = getVialThrowTiming('right')
      expect(timing.offset).toMatchObject({
        x: thiefUseThrowAtlas.meta.anims.use_throw.spawnOffsetPx.right.x,
        y: thiefUseThrowAtlas.meta.anims.use_throw.spawnOffsetPx.right.y,
      })

      armPoisonVialThrow(mockScene, mockPlayer, 2000)
      mockPlayer.anims = { currentFrame: { frame: { name: 'thief_use_throw_right_2' } } }
      expect(tickPoisonVialThrow(mockPlayer, 2000 + timing.releaseMs - 1)).toBeNull()

      mockPlayer.anims.currentFrame = { frame: { name: 'thief_use_throw_right_3' } }
      const vial = tickPoisonVialThrow(mockPlayer, 2000 + 100)
      expect(vial).toBeTruthy()
      expect(Math.abs(vial.x - (80 + timing.offset.x))).toBeLessThanOrEqual(2)
      expect(Math.abs(vial.y - (120 + timing.offset.y))).toBeLessThanOrEqual(2)
    })

    it('charges nothing when the wind-up is cancelled before release', () => {
      mockPlayer.classId = 'thief'
      mockPlayer.facing = 'down'
      const consumed = []
      const off = eventBus.on(GameEvents.ITEM_CONSUMED, (evt) => consumed.push(evt))
      armPoisonVialThrow(mockScene, mockPlayer, 3000)
      expect(cancelPoisonVialThrow(mockPlayer)).toBe(true)
      expect(tickPoisonVialThrow(mockPlayer, 3000 + 250)).toBeNull()
      expect(mockScene.projectiles).toHaveLength(0)
      expect(consumed).toHaveLength(0)
      expect(mockPlayer._vialCooldownUntil || 0).toBe(0)
      off()
    })
  })

  describe('Mage Spells: Lightning, Leech, Shield, Blink', () => {
    it('casts Lightning bolt with directional spawn offset and beam parameters', () => {
      mockPlayer.facing = 'left'
      const proj = castLightning(mockScene, mockPlayer, 1000)

      expect(proj).toBeDefined()
      expect(proj.texture.key).toBe('spell_fx_v2')
      expect(proj.flyAnim).toBe('lightning_bolt_v2')
      expect(proj.hitAnim).toBe('lightning_impact_v2')
      expect(proj.impactType).toBe('lightning')
      expect(proj.originX).toBe(0.0) // bolt pivot from spell_fx_v2 frame
    })

    it('casts Life Leech, sets 10s cooldown, and drains 40% enemy HP on hit', () => {
      const proj = castLeech(mockScene, mockPlayer, 1000)
      expect(proj).toBeDefined()
      expect(proj.texture.key).toBe('spell_fx_v2')
      expect(proj.flyAnim).toBe('leech_orb_v2')
      expect(proj.hitAnim).toBe('leech_impact_v2')
      expect(proj.returnAnim).toBe('leech_return_v2')
      expect(proj.absorbAnim).toBe('leech_absorb_v2')
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
      expect(createdKeys).toContain('lightning_bolt_v2')
      expect(createdKeys).toContain('lightning_impact_v2')
      expect(createdKeys).toContain('leech_orb_v2')
      expect(createdKeys).toContain('leech_impact_v2')
      expect(createdKeys).toContain('leech_return_v2')
      expect(createdKeys).toContain('leech_absorb_v2')
      expect(createdKeys).toContain('mage_cast_lightning_v2_down')
      expect(createdKeys).toContain('mage_cast_leech_v2_up')
      expect(createdKeys).toContain('shield_form')
      expect(createdKeys).toContain('shield_loop')
      expect(createdKeys).toContain('blink_portal')
      expect(createdKeys).toContain('thief_poison_vial')
      expect(createdKeys).toContain('thief_poison_splash')
    })
  })

  describe('Mage Lightning and Leech release on frame 5', () => {
    function expectSpawnAt(proj, spellId, facing) {
      const offset = mageSpellsV2Atlas.meta.spawnOffset[spellId][facing]
      expect(Math.abs(proj.x - (mockPlayer.x + offset.x))).toBeLessThanOrEqual(2)
      expect(Math.abs(proj.y - (mockPlayer.y + offset.y))).toBeLessThanOrEqual(2)
      expect(proj.x).toBe(mockPlayer.x + offset.x)
      expect(proj.y).toBe(mockPlayer.y + offset.y)
    }

    it('does not spawn Lightning before release and spawns at 312.5 ms on the meta offset', () => {
      mockPlayer.classId = 'mage'
      mockPlayer.facing = 'down'
      const timing = getV2CastTiming('lightning', 'down')
      expect(timing.releaseFrame).toBe(mageSpellsV2Atlas.meta.release.lightning)
      expect(timing.releaseMs).toBe(312.5)
      expect(timing.key).toBe('mage_cast_lightning_v2_down')

      const pending = armMageV2Cast(mockScene, mockPlayer, 'lightning', 1000)
      expect(pending.animKey).toBe('mage_cast_lightning_v2_down')
      expect(mockScene.projectiles).toHaveLength(0)

      expect(tickMageV2Cast(mockPlayer, 1000 + timing.releaseMs - 62.5)).toBeNull()
      expect(mockScene.projectiles).toHaveLength(0)

      const proj = tickMageV2Cast(mockPlayer, 1000 + timing.releaseMs)
      expect(proj).toBeTruthy()
      expect(pending.spawnedAt - pending.startedAt).toBe(312.5)
      expect(proj.texture.key).toBe('spell_fx_v2')
      expect(proj.flyAnim).toBe('lightning_bolt_v2')
      expect(proj.hitAnim).toBe('lightning_impact_v2')
      expectSpawnAt(proj, 'lightning', 'down')

      mockPlayer.facing = 'right'
      mockPlayer._v2Cast = null
      armMageV2Cast(mockScene, mockPlayer, 'lightning', 5000)
      const right = tickMageV2Cast(mockPlayer, 5000 + 312.5)
      expect(right.flyAnim).toBe('lightning_bolt_v2')
      expectSpawnAt(right, 'lightning', 'right')
    })

    it('releases the Leech orb on the same frame with return and absorb clips', () => {
      mockPlayer.classId = 'mage'
      mockPlayer.facing = 'down'
      const timing = getV2CastTiming('leech', 'down')
      expect(timing.releaseMs).toBe(312.5)
      expect(timing.key).toBe('mage_cast_leech_v2_down')

      const pending = armMageV2Cast(mockScene, mockPlayer, 'leech', 2000)
      expect(mockScene.projectiles).toHaveLength(0)
      expect(tickMageV2Cast(mockPlayer, 2000)).toBeNull()

      const proj = tickMageV2Cast(mockPlayer, 2000 + timing.releaseMs)
      expect(pending.spawnedAt - pending.startedAt).toBe(312.5)
      expect(proj.texture.key).toBe('spell_fx_v2')
      expect(proj.flyAnim).toBe('leech_orb_v2')
      expect(proj.hitAnim).toBe('leech_impact_v2')
      expect(proj.returnAnim).toBe('leech_return_v2')
      expect(proj.absorbAnim).toBe('leech_absorb_v2')
      expectSpawnAt(proj, 'leech', 'down')

      const enemy = { x: 420, y: 350, hp: 40, hpMax: 40 }
      proj.impact(enemy, false, 3000)
      expect(enemy.hp).toBe(24)
      expect(proj.isReturning).toBe(true)

      mockPlayer.facing = 'left'
      session.lifeLeechCooldownUntil = 0
      armMageV2Cast(mockScene, mockPlayer, 'leech', 8000)
      const left = tickMageV2Cast(mockPlayer, 8000 + 312.5)
      expectSpawnAt(left, 'leech', 'left')
    })

    it('spawns when the playing clip reaches release frame 5', () => {
      mockPlayer.classId = 'mage'
      mockPlayer.facing = 'up'
      armMageV2Cast(mockScene, mockPlayer, 'lightning', 1000)
      mockPlayer.anims = {
        currentFrame: { frame: { name: 'mage_cast_lightning_v2_up_4' } },
      }
      expect(tickMageV2Cast(mockPlayer, 1100)).toBeNull()
      mockPlayer.anims.currentFrame = { frame: { name: 'mage_cast_lightning_v2_up_5' } }
      const proj = tickMageV2Cast(mockPlayer, 1100)
      expect(proj).toBeTruthy()
      expect(mockPlayer._v2Cast.spawnedAt).toBe(1100)
      expectSpawnAt(proj, 'lightning', 'up')
    })
  })

  describe('Package BF-1: Mage v2 Animation Registration & Readiness', () => {
    it('(a) with textures.exists("mage_spells_v2") === false, ensureSpellAnimations creates no mage_cast_*_v2_* clips', () => {
      const scene = {
        textures: {
          exists: vi.fn((key) => key !== 'mage_spells_v2'),
        },
        anims: {
          exists: vi.fn(() => false),
          create: vi.fn(),
          get: vi.fn(() => null),
          remove: vi.fn(),
        },
      }

      ensureSpellAnimations(scene)

      const createdKeys = scene.anims.create.mock.calls.map((call) => call[0].key)
      const v2BodyClips = createdKeys.filter((k) => k.startsWith('mage_cast_'))
      expect(v2BodyClips).toHaveLength(0)
    })

    it('(b) after textures load, calling ensureSpellAnimations creates v2 clips with frames', () => {
      const scene = {
        textures: {
          exists: vi.fn(() => true),
        },
        anims: {
          exists: vi.fn(() => false),
          create: vi.fn(),
          get: vi.fn(() => null),
          remove: vi.fn(),
        },
      }

      ensureSpellAnimations(scene)

      const createdClips = scene.anims.create.mock.calls.map((call) => call[0])
      const lightningDown = createdClips.find((c) => c.key === 'mage_cast_lightning_v2_down')
      expect(lightningDown).toBeDefined()
      expect(lightningDown.frames.length).toBeGreaterThan(0)
      expect(lightningDown.frames[0].key).toBe('mage_spells_v2')
    })

    it('(c) a pre-existing 0-frame clip gets removed and replaced once texture exists', () => {
      const scene = {
        textures: {
          exists: vi.fn(() => true),
        },
        anims: {
          exists: vi.fn((key) => key === 'mage_cast_lightning_v2_down'),
          create: vi.fn(),
          get: vi.fn((key) => (key === 'mage_cast_lightning_v2_down' ? { key, frames: [] } : null)),
          remove: vi.fn(),
        },
      }

      ensureSpellAnimations(scene)

      expect(scene.anims.remove).toHaveBeenCalledWith('mage_cast_lightning_v2_down')
      const createdClips = scene.anims.create.mock.calls.map((call) => call[0])
      const lightningDown = createdClips.find((c) => c.key === 'mage_cast_lightning_v2_down')
      expect(lightningDown).toBeDefined()
      expect(lightningDown.frames.length).toBeGreaterThan(0)
    })

    it('(d) armMageV2Cast returns null while textures are missing and leaves lifeLeechCooldownUntil unchanged', () => {
      const scene = {
        textures: {
          exists: vi.fn((key) => key !== 'mage_spells_v2'),
        },
        anims: {
          exists: vi.fn(() => false),
          create: vi.fn(),
          get: vi.fn(() => null),
          remove: vi.fn(),
        },
        _notices: [],
        _notice(msg) {
          this._notices.push(msg)
        },
      }

      const player = {
        classId: 'mage',
        facing: 'down',
      }

      session.lifeLeechCooldownUntil = 0

      const lightningArm = armMageV2Cast(scene, player, 'lightning', 1000)
      expect(lightningArm).toBeNull()
      expect(scene._notices).toContain('Spells are still loading')
      expect(scene.mana).toBeUndefined()
      expect(session.mana).toBe(100)

      const leechArm = armMageV2Cast(scene, player, 'leech', 1000)
      expect(leechArm).toBeNull()
      expect(session.lifeLeechCooldownUntil).toBe(0)
    })
  })
})
