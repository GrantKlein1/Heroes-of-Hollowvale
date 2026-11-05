import { describe, it, expect } from 'vitest'
import {
  CLASS_SPEED,
  ATTACK_MS,
  MELEE_DMG,
  WEAPON,
  CONSUMABLE,
  FIREBALL_SPEED,
  FIREBALL_DIST,
  FIRE_LINGER_MS,
  ENEMY_BASE_HP,
  ENEMY_BASE_SPEED,
  ENEMY_BASE_DAMAGE,
  WAVE_SCALING,
  ARCHER_PROJECTILE,
  BASE_WAVE_SPAWNS,
  getEnemyHp,
  getEnemySpeed,
  getEnemyDamage,
} from '../balance.js'

describe('Combat Balance Constants & Formulas', () => {
  describe('Player Class Constants', () => {
    it('preserves exact class movement speed constants', () => {
      expect(CLASS_SPEED).toEqual({
        knight: 160,
        dwarf: 160,
        mage: 180,
        thief: 200,
      })
    })

    it('preserves exact class attack duration constants', () => {
      expect(ATTACK_MS).toEqual({
        mage: 650,
        thief: 300,
        knight: 450,
        dwarf: 600,
      })
    })

    it('preserves exact melee damage constants', () => {
      expect(MELEE_DMG).toEqual({
        thief: 8,
        knight: 12,
        dwarf: 15,
      })
    })

    it('preserves exact starting weapon mappings', () => {
      expect(WEAPON).toEqual({
        knight: 'iron_sword',
        mage: 'apprentice_staff',
        thief: 'twin_daggers',
        dwarf: 'battle_axe',
      })
    })

    it('preserves consumable items set', () => {
      expect(CONSUMABLE.has('healing_potion')).toBe(true)
      expect(CONSUMABLE.has('mana_potion')).toBe(true)
      expect(CONSUMABLE.has('speed_potion')).toBe(true)
      expect(CONSUMABLE.size).toBe(3)
    })
  })

  describe('Projectile & Spell Constants', () => {
    it('preserves fireball speed, distance, and linger constants', () => {
      expect(FIREBALL_SPEED).toBe(420)
      expect(FIREBALL_DIST).toBe(220)
      expect(FIRE_LINGER_MS).toBe(2000)
    })

    it('preserves archer projectile constants', () => {
      expect(ARCHER_PROJECTILE).toEqual({
        speed: 300,
        dist: 400,
        size: 12,
        damage: 7,
      })
    })
  })

  describe('Enemy Base Stats & Scaling Constants', () => {
    it('preserves enemy base HP values', () => {
      expect(ENEMY_BASE_HP).toEqual({
        brute: 25,
        archer: 10,
        goblin: 15,
      })
    })

    it('preserves enemy base speeds', () => {
      expect(ENEMY_BASE_SPEED).toEqual({
        brute: 55,
        archer: 80,
        goblin: 70,
      })
    })

    it('preserves enemy base contact damage', () => {
      expect(ENEMY_BASE_DAMAGE).toEqual({
        brute: 12,
        archer: 6,
        goblin: 8,
      })
    })

    it('preserves wave scaling rate constants', () => {
      expect(WAVE_SCALING).toEqual({
        hpPerWave: 0.12,
        speedPerWave: 0.05,
        damagePerWave: 0.05,
      })
    })

    it('preserves base wave spawns', () => {
      expect(BASE_WAVE_SPAWNS).toEqual([
        ['goblin', 0.47, 0.28],
        ['goblin', 0.53, 0.31],
        ['brute', 0.5, 0.22],
        ['archer', 0.56, 0.26],
      ])
    })
  })

  describe('Dynamic Enemy Formula Helpers', () => {
    it('calculates enemy HP at wave 1 identically to old constants', () => {
      expect(getEnemyHp('brute', 1)).toBe(25)
      expect(getEnemyHp('archer', 1)).toBe(10)
      expect(getEnemyHp('goblin', 1)).toBe(15)
      // default fallback
      expect(getEnemyHp('unknown', 1)).toBe(15)
    })

    it('scales enemy HP across higher waves correctly', () => {
      // wave 2: Math.round(base * (1 + 0.12 * 1))
      expect(getEnemyHp('brute', 2)).toBe(Math.round(25 * 1.12)) // 28
      expect(getEnemyHp('archer', 2)).toBe(Math.round(10 * 1.12)) // 11
      expect(getEnemyHp('goblin', 2)).toBe(Math.round(15 * 1.12)) // 17

      // wave 4: Math.round(base * (1 + 0.12 * 3)) = base * 1.36
      expect(getEnemyHp('brute', 4)).toBe(Math.round(25 * 1.36)) // 34
      expect(getEnemyHp('archer', 4)).toBe(Math.round(10 * 1.36)) // 14
      expect(getEnemyHp('goblin', 4)).toBe(Math.round(15 * 1.36)) // 20
    })

    it('calculates enemy speed at wave 1 with unit scaling identically to old logic', () => {
      expect(getEnemySpeed('brute', 1, 1)).toBe(55)
      expect(getEnemySpeed('archer', 1, 1)).toBe(80)
      expect(getEnemySpeed('goblin', 1, 1)).toBe(70)

      const unit = 1.25
      expect(getEnemySpeed('brute', 1, unit)).toBe(55 * 1.25)
      expect(getEnemySpeed('archer', 1, unit)).toBe(80 * 1.25)
      expect(getEnemySpeed('goblin', 1, unit)).toBe(70 * 1.25)
    })

    it('scales enemy speed across higher waves correctly', () => {
      // wave 3: base * (1 + 0.05 * 2) = base * 1.10
      expect(getEnemySpeed('brute', 3, 1)).toBeCloseTo(55 * 1.1)
      expect(getEnemySpeed('archer', 3, 1)).toBeCloseTo(80 * 1.1)
      expect(getEnemySpeed('goblin', 3, 1)).toBeCloseTo(70 * 1.1)
    })

    it('calculates enemy contact damage across waves identically to old logic', () => {
      expect(getEnemyDamage('brute', 1)).toBe(12)
      expect(getEnemyDamage('archer', 1)).toBe(6)
      expect(getEnemyDamage('goblin', 1)).toBe(8)

      // wave 3: Math.round(base * (1 + 0.05 * 2)) = Math.round(base * 1.10)
      expect(getEnemyDamage('brute', 3)).toBe(Math.round(12 * 1.1)) // 13
      expect(getEnemyDamage('archer', 3)).toBe(Math.round(6 * 1.1)) // 7
      expect(getEnemyDamage('goblin', 3)).toBe(Math.round(8 * 1.1)) // 9
    })
  })
})
