import { describe, it, expect } from 'vitest'
import {
  CLASS_HP,
  CLASS_SPEED,
  ATTACK_MS,
  ATTACK_CLIP_MS,
  ATTACK_PLAYBACK,
  attackAnimTimeScale,
  MELEE_DMG,
  WEAPON,
  WEAPON_STATS,
  CONSUMABLE,
  CONSUMABLE_EFFECTS,
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
    it('gives each hero a different job from the same weapon table', () => {
      expect(CLASS_HP).toEqual({
        knight: 120,
        mage: 70,
        thief: 85,
        dwarf: 95,
      })
      expect(CLASS_SPEED).toEqual({
        knight: 160,
        dwarf: 120,
        mage: 180,
        thief: 210,
      })
      expect(ATTACK_CLIP_MS).toEqual({
        knight: 636,
        dwarf: 636,
        thief: 636,
        mage: 583,
      })
      expect(ATTACK_PLAYBACK).toEqual({
        knight: 1,
        mage: 1,
        thief: 1.5,
        dwarf: 0.75,
      })
      expect(WEAPON_STATS).toEqual({
        iron_sword: { damage: 12, swingMs: 636 },
        apprentice_staff: { damage: 8, swingMs: 583 },
        twin_daggers: { damage: 7, swingMs: 424 },
        battle_axe: { damage: 22, swingMs: 848 },
      })
      expect(attackAnimTimeScale('dwarf', 'attack')).toBe(0.75)
      expect(attackAnimTimeScale('thief', 'attack_2')).toBe(1.5)
      expect(attackAnimTimeScale('knight', 'walk')).toBe(1)
      expect(attackAnimTimeScale('mage', 'cast')).toBe(1)
      expect(ATTACK_MS).toEqual({
        knight: WEAPON_STATS.iron_sword.swingMs,
        mage: WEAPON_STATS.apprentice_staff.swingMs,
        thief: WEAPON_STATS.twin_daggers.swingMs,
        dwarf: WEAPON_STATS.battle_axe.swingMs,
      })
      expect(MELEE_DMG).toEqual({
        knight: WEAPON_STATS.iron_sword.damage,
        mage: WEAPON_STATS.apprentice_staff.damage,
        thief: WEAPON_STATS.twin_daggers.damage,
        dwarf: WEAPON_STATS.battle_axe.damage,
      })
      expect(WEAPON).toEqual({
        knight: 'iron_sword',
        mage: 'apprentice_staff',
        thief: 'twin_daggers',
        dwarf: 'battle_axe',
      })

      expect(CLASS_HP.knight).toBe(Math.max(...Object.values(CLASS_HP)))
      expect(CLASS_HP.mage).toBe(Math.min(...Object.values(CLASS_HP)))
      expect(CLASS_SPEED.dwarf).toBe(Math.min(...Object.values(CLASS_SPEED)))
      expect(CLASS_SPEED.thief).toBe(Math.max(...Object.values(CLASS_SPEED)))
      expect(MELEE_DMG.dwarf).toBe(Math.max(...Object.values(MELEE_DMG)))
      expect(MELEE_DMG.thief).toBe(Math.min(...Object.values(MELEE_DMG)))
      expect(ATTACK_MS.dwarf).toBe(Math.max(...Object.values(ATTACK_MS)))
      expect(ATTACK_MS.thief).toBe(Math.min(...Object.values(ATTACK_MS)))

      expect(ATTACK_MS.knight).toBe(Math.round(ATTACK_CLIP_MS.knight / ATTACK_PLAYBACK.knight))
      expect(ATTACK_MS.dwarf).toBe(Math.round(ATTACK_CLIP_MS.dwarf / ATTACK_PLAYBACK.dwarf))
      expect(ATTACK_MS.thief).toBe(Math.round(ATTACK_CLIP_MS.thief / ATTACK_PLAYBACK.thief))
      expect(ATTACK_MS.mage).toBe(Math.round(ATTACK_CLIP_MS.mage / ATTACK_PLAYBACK.mage))
    })

    it('preserves consumable items set and effect table', () => {
      expect(CONSUMABLE.has('healing_potion')).toBe(true)
      expect(CONSUMABLE.has('mana_potion')).toBe(true)
      expect(CONSUMABLE.has('speed_potion')).toBe(true)
      expect(CONSUMABLE.has('apple')).toBe(true)
      expect(CONSUMABLE.has('ale_flask')).toBe(true)
      // ITEM-NEW-1 adds healing_charm to the five ITEMS/IT-1 consumables.
      expect(CONSUMABLE.has('healing_charm')).toBe(true)
      expect(CONSUMABLE.size).toBe(6)

      expect(CONSUMABLE_EFFECTS.healing_potion).toEqual({
        heal: 70,
        mana: 0,
        speedMs: 0,
        clip: 'use_drink',
      })
      expect(CONSUMABLE_EFFECTS.mana_potion).toEqual({
        heal: 0,
        mana: 75,
        speedMs: 0,
        clip: 'use_drink',
      })
      expect(CONSUMABLE_EFFECTS.speed_potion).toEqual({
        heal: 0,
        mana: 0,
        speedMs: 10000,
        clip: 'use_drink',
      })
      expect(CONSUMABLE_EFFECTS.apple).toEqual({
        heal: 25,
        mana: 0,
        speedMs: 0,
        clip: 'use_eat',
      })
      expect(CONSUMABLE_EFFECTS.ale_flask).toEqual({
        heal: 10,
        mana: 0,
        damageMult: 1.25,
        durationMs: 5000,
        clip: 'use_drink',
      })
      expect(Object.isFrozen(CONSUMABLE_EFFECTS)).toBe(true)
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
        damage: 10,
      })
    })
  })

  describe('Enemy Base Stats & Scaling Constants', () => {
    it('preserves enemy base HP values', () => {
      // Original three only; the Batch 11 enemies are pinned in enemyNew.test.js.
      expect(ENEMY_BASE_HP).toMatchObject({
        brute: 72,
        archer: 24,
        goblin: 36,
      })
      expect(ENEMY_BASE_HP.goblin).toBe(MELEE_DMG.knight * 3)
      expect(ENEMY_BASE_HP.brute).toBe(MELEE_DMG.knight * 6)
      expect(ENEMY_BASE_HP.archer).toBe(MELEE_DMG.knight * 2)
    })

    it('preserves enemy base speeds', () => {
      // Original three only; the Batch 11 enemies are pinned in enemyNew.test.js.
      expect(ENEMY_BASE_SPEED).toMatchObject({
        brute: 50,
        archer: 80,
        goblin: 100,
      })
      expect(ENEMY_BASE_SPEED.brute).toBeLessThan(ENEMY_BASE_SPEED.archer)
      expect(ENEMY_BASE_SPEED.archer).toBeLessThan(ENEMY_BASE_SPEED.goblin)
      expect(ENEMY_BASE_SPEED.goblin).toBeLessThan(CLASS_SPEED.knight)
    })

    it('preserves enemy base contact damage', () => {
      // Original three only; the Batch 11 enemies are pinned in enemyNew.test.js.
      expect(ENEMY_BASE_DAMAGE).toMatchObject({
        brute: 16,
        archer: 6,
        goblin: 10,
      })
      expect(ENEMY_BASE_DAMAGE.brute).toBeGreaterThan(ENEMY_BASE_DAMAGE.goblin)
      expect(ENEMY_BASE_DAMAGE.archer).toBeLessThan(ARCHER_PROJECTILE.damage)
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
    it('calculates enemy HP at wave 1 from the base table', () => {
      expect(getEnemyHp('brute', 1)).toBe(ENEMY_BASE_HP.brute)
      expect(getEnemyHp('archer', 1)).toBe(ENEMY_BASE_HP.archer)
      expect(getEnemyHp('goblin', 1)).toBe(ENEMY_BASE_HP.goblin)
      expect(getEnemyHp('unknown', 1)).toBe(ENEMY_BASE_HP.goblin)
    })

    it('scales enemy HP across higher waves correctly', () => {
      expect(getEnemyHp('brute', 2)).toBe(Math.round(ENEMY_BASE_HP.brute * 1.12))
      expect(getEnemyHp('archer', 2)).toBe(Math.round(ENEMY_BASE_HP.archer * 1.12))
      expect(getEnemyHp('goblin', 2)).toBe(Math.round(ENEMY_BASE_HP.goblin * 1.12))

      expect(getEnemyHp('brute', 4)).toBe(Math.round(ENEMY_BASE_HP.brute * 1.36))
      expect(getEnemyHp('archer', 4)).toBe(Math.round(ENEMY_BASE_HP.archer * 1.36))
      expect(getEnemyHp('goblin', 4)).toBe(Math.round(ENEMY_BASE_HP.goblin * 1.36))
    })

    it('calculates enemy speed at wave 1 with unit scaling from the base table', () => {
      expect(getEnemySpeed('brute', 1, 1)).toBe(ENEMY_BASE_SPEED.brute)
      expect(getEnemySpeed('archer', 1, 1)).toBe(ENEMY_BASE_SPEED.archer)
      expect(getEnemySpeed('goblin', 1, 1)).toBe(ENEMY_BASE_SPEED.goblin)

      const unit = 1.25
      expect(getEnemySpeed('brute', 1, unit)).toBe(ENEMY_BASE_SPEED.brute * unit)
      expect(getEnemySpeed('archer', 1, unit)).toBe(ENEMY_BASE_SPEED.archer * unit)
      expect(getEnemySpeed('goblin', 1, unit)).toBe(ENEMY_BASE_SPEED.goblin * unit)
    })

    it('scales enemy speed across higher waves correctly', () => {
      expect(getEnemySpeed('brute', 3, 1)).toBeCloseTo(ENEMY_BASE_SPEED.brute * 1.1)
      expect(getEnemySpeed('archer', 3, 1)).toBeCloseTo(ENEMY_BASE_SPEED.archer * 1.1)
      expect(getEnemySpeed('goblin', 3, 1)).toBeCloseTo(ENEMY_BASE_SPEED.goblin * 1.1)
    })

    it('calculates enemy contact damage across waves from the base table', () => {
      expect(getEnemyDamage('brute', 1)).toBe(ENEMY_BASE_DAMAGE.brute)
      expect(getEnemyDamage('archer', 1)).toBe(ENEMY_BASE_DAMAGE.archer)
      expect(getEnemyDamage('goblin', 1)).toBe(ENEMY_BASE_DAMAGE.goblin)
      expect(getEnemyDamage('unknown', 1)).toBe(ENEMY_BASE_DAMAGE.goblin)

      expect(getEnemyDamage('brute', 3)).toBe(Math.round(ENEMY_BASE_DAMAGE.brute * 1.1))
      expect(getEnemyDamage('archer', 3)).toBe(Math.round(ENEMY_BASE_DAMAGE.archer * 1.1))
      expect(getEnemyDamage('goblin', 3)).toBe(Math.round(ENEMY_BASE_DAMAGE.goblin * 1.1))
    })
  })
})
