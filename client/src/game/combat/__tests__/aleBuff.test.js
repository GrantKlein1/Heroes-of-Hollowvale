import { afterEach, describe, expect, it } from 'vitest'
import {
  CONSUMABLE_EFFECTS,
  applyConsumableEffects,
  scaleOutgoingDamage,
} from '../balance.js'
import { executePlayerMeleeHit } from '../hitSystem.js'
import { session } from '../../session.js'

function vitals(hp, extra = {}) {
  return {
    hp,
    hpMax: 100,
    mana: 0,
    manaMax: 0,
    speedBoostUntil: 0,
    damageMult: 1,
    damageBoostUntil: 0,
    ...extra,
  }
}

function clearDamageBuff() {
  session.damageMult = 1
  session.damageBoostUntil = 0
}

describe('ale flask heal and damage boost', () => {
  afterEach(() => {
    clearDamageBuff()
  })

  it('drinks ale for exactly +10 HP, clamped to max HP, with no speed change', () => {
    const ale = CONSUMABLE_EFFECTS.ale_flask
    const low = applyConsumableEffects(ale, vitals(20, { speedBoostUntil: 4000 }), 1000)
    expect(low.hp).toBe(30)
    expect(low.speedBoostUntil).toBe(4000)

    const clamped = applyConsumableEffects(ale, vitals(95), 1000)
    expect(clamped.hp).toBe(100)

    const full = applyConsumableEffects(ale, vitals(100), 1000)
    expect(full.hp).toBe(100)

    const noMax = applyConsumableEffects(ale, vitals(10, { hpMax: 0 }), 1000)
    expect(noMax.hp).toBe(10)
  })

  it('multiplies outgoing damage by 1.25 for 5000 ms and then expires', () => {
    const drunk = applyConsumableEffects(CONSUMABLE_EFFECTS.ale_flask, vitals(40), 1000)
    expect(drunk.damageMult).toBe(1.25)
    expect(drunk.damageBoostUntil).toBe(6000)

    expect(scaleOutgoingDamage(12, 1000, drunk)).toBe(15)
    expect(scaleOutgoingDamage(8, 5999, drunk)).toBe(10)
    expect(scaleOutgoingDamage(15, 1000, drunk)).toBe(19)
    expect(scaleOutgoingDamage(12, 6000, drunk)).toBe(12)
    expect(scaleOutgoingDamage(12, 9000, drunk)).toBe(12)
  })

  it('refreshes the damage buff timer instead of stacking a second ale', () => {
    const first = applyConsumableEffects(CONSUMABLE_EFFECTS.ale_flask, vitals(40), 1000)
    const second = applyConsumableEffects(CONSUMABLE_EFFECTS.ale_flask, first, 2500)
    expect(second.hp).toBe(60)
    expect(second.damageMult).toBe(1.25)
    expect(second.damageBoostUntil).toBe(7500)
    expect(scaleOutgoingDamage(12, 7000, second)).toBe(15)
    expect(scaleOutgoingDamage(12, 7499, second)).toBe(15)
    expect(scaleOutgoingDamage(12, 7500, second)).toBe(12)
  })

  it('keeps the apple at +25 HP with no damage buff and no speed boost', () => {
    const eaten = applyConsumableEffects(CONSUMABLE_EFFECTS.apple, vitals(20), 1000)
    expect(eaten.hp).toBe(45)
    expect(eaten.damageMult).toBe(1)
    expect(eaten.damageBoostUntil).toBe(0)
    expect(eaten.speedBoostUntil).toBe(0)
    expect(scaleOutgoingDamage(12, 1000, eaten)).toBe(12)

    const duringAle = applyConsumableEffects(
      CONSUMABLE_EFFECTS.apple,
      vitals(20, { damageMult: 1.25, damageBoostUntil: 6000 }),
      2000,
    )
    expect(duringAle.hp).toBe(45)
    expect(duringAle.damageMult).toBe(1.25)
    expect(duringAle.damageBoostUntil).toBe(6000)
  })

  it('still grants the speed potion its speed buff and no damage buff', () => {
    const sped = applyConsumableEffects(CONSUMABLE_EFFECTS.speed_potion, vitals(20), 1000)
    expect(sped.hp).toBe(20)
    expect(sped.speedBoostUntil).toBe(11000)
    expect(sped.damageMult).toBe(1)
    expect(sped.damageBoostUntil).toBe(0)
  })

  it('applies the active buff to a player melee hit, then stops after expiry', () => {
    const enemy = {
      active: true,
      x: 220,
      y: 220,
      scaleX: 2,
      hp: 30,
      hpMax: 30,
      body: {
        x: 210,
        y: 210,
        width: 30,
        height: 30,
        bottom: 240,
        setVelocity: vi.fn(),
      },
      hurtbox: { x: -15, y: -20, w: 30, h: 20 },
      scene: null,
      setTintFill: vi.fn(),
      setTint: vi.fn(),
      clearTint: vi.fn(),
    }
    const scene = {
      enemies: { getChildren: () => [enemy] },
      textures: {
        get: () => ({
          customData: {
            meta: {
              anims: {
                attack: {
                  hitFrames: [3],
                  hitbox: { 3: { right: { x: 0, y: -40, w: 40, h: 40 } } },
                  weaponTipOffsetFromFeet: { 3: { right: { x: 20, y: -20 } } },
                },
              },
            },
          },
        }),
      },
      time: { delayedCall: (_ms, cb) => cb() },
      add: {
        sprite: () => ({
          setOrigin: () => {},
          setDepth: () => {},
          anims: { play: () => {} },
          once: () => {},
          destroy: () => {},
        }),
      },
      _float: vi.fn(),
    }
    enemy.scene = scene
    const player = {
      scene,
      classId: 'knight',
      facing: 'right',
      x: 200,
      y: 240,
      scaleX: 2,
      currentSwingId: 1,
      getSheetForAnim: () => 'knight_attack',
      body: { bottom: 240, velocity: { x: 0, y: 0 }, setVelocity: () => {} },
      anims: { isPlaying: true, pause: () => {}, resume: () => {} },
    }

    session.damageMult = 1.25
    session.damageBoostUntil = 6000
    expect(executePlayerMeleeHit(player, 3, 1000)).toBe(1)
    expect(enemy.hp).toBe(15)
    expect(scene._float).toHaveBeenCalledWith(220, 214, '-15', '#ff6161')

    enemy.hp = 30
    player.currentSwingId = 2
    expect(executePlayerMeleeHit(player, 3, 6000)).toBe(1)
    expect(enemy.hp).toBe(18)
    expect(scene._float).toHaveBeenCalledWith(220, 214, '-12', '#ff6161')
  })
})
