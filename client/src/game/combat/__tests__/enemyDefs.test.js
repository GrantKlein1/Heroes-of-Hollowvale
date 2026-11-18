import { describe, it, expect, afterEach, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 64, height: 64, realWidth: 64, realHeight: 64, pivot: null }
      this.originX = 0.5
      this.originY = 0.5
      this.depth = 0
      this.body = {
        setSize: vi.fn(),
        setOffset: vi.fn(),
        setVelocity: vi.fn(),
        setAllowGravity: vi.fn(),
        setCollideWorldBounds: vi.fn(),
        setPushable: vi.fn(),
        velocity: { x: 0, y: 0 },
        bottom: y,
        enable: true,
      }
      this.anims = { play: vi.fn(), currentAnim: null }
      this._eventListeners = new Map()
    }
    on() { return this }
    emit() {}
    setOrigin(x, y) { this.originX = x; this.originY = y ?? x; return this }
    setDepth(d) { this.depth = d; return this }
    setTexture(key) { this.texture = { key }; return this }
  }
  return {
    default: {
      Animations: { Events: { ANIMATION_COMPLETE: 'animationcomplete' } },
      Physics: { Arcade: { Sprite: MockSprite } },
      GameObjects: { Sprite: MockSprite },
    },
  }
})

import { Enemy, ENEMY_SHEETS, registerEnemyAI } from '../../actors/Enemy.js'
import { GoblinAI } from '../../ai/goblin.js'
import { BruteAI } from '../../ai/brute.js'
import { ArcherAI } from '../../ai/archer.js'
import { getEnemyHp, getEnemySpeed, getEnemyDamage, ARCHER_PROJECTILE } from '../balance.js'
import { LOOT_TABLES, enemyLabel, generateSeededLoot } from '../death.js'
import {
  ENEMY_DEFS,
  getEnemyDef,
  isEnemyType,
  pickEnemyTypeByWeight,
  registerEnemyDef,
  unregisterEnemyDef,
} from '../enemyDefs.js'

function mockScene() {
  return {
    textures: { get: () => null, exists: () => false },
    anims: { exists: () => true },
    projectiles: [],
    add: { existing: (o) => o },
    player: { x: 0, y: 0, hp: 100, body: { bottom: 0, x: 0, y: 0, width: 1, height: 1 }, takeDamage() {}, is: () => false },
  }
}

describe('enemyDefs: built-in numbers are unchanged', () => {
  // Literal values copied from main at 6765213 (Grant's d3b37ac rebalance included).
  const EXPECTED = {
    goblin: { hp: 36, speed: 100, damage: 10, label: 'Goblin' },
    brute: { hp: 72, speed: 50, damage: 16, label: 'Goblin Brute' },
    archer: { hp: 24, speed: 80, damage: 6, label: 'Goblin Archer' },
  }

  it('keeps HP, speed, damage and label per type, wave 1 and scaled', () => {
    for (const [type, e] of Object.entries(EXPECTED)) {
      expect(getEnemyHp(type)).toBe(e.hp)
      expect(getEnemySpeed(type)).toBe(e.speed)
      expect(getEnemyDamage(type)).toBe(e.damage)
      expect(enemyLabel(type)).toBe(e.label)
      expect(getEnemyHp(type, 4)).toBe(Math.round(e.hp * 1.36))
      expect(getEnemySpeed(type, 4, 2)).toBeCloseTo(e.speed * 1.15 * 2)
      expect(getEnemyDamage(type, 4)).toBe(Math.round(e.damage * 1.15))
    }
    expect(getEnemyHp('nope')).toBe(36)
    expect(enemyLabel('nope')).toBe('nope')
    expect(enemyLabel()).toBe('Unknown')
  })

  it('keeps the archer arrow numbers', () => {
    expect(ARCHER_PROJECTILE).toEqual({ speed: 300, dist: 400, size: 12, damage: 10 })
  })

  it('keeps the loot tables', () => {
    // Original three only; the Batch 11 enemies are pinned in enemyNew.test.js.
    expect(LOOT_TABLES).toMatchObject({
      goblin: {
        gems: [
          { type: 'ruby', chance: 0.35, count: 1 },
          { type: 'emerald', chance: 0.15, count: 1 },
        ],
        items: [
          { id: 'speed_potion', chance: 0.15, count: 1 },
          { id: 'healing_charm', chance: 0.06, count: 1 },
        ],
      },
      brute: {
        gems: [
          { type: 'ruby', chance: 0.6, count: 1 },
          { type: 'sapphire', chance: 0.5, count: 1 },
        ],
        items: [
          { id: 'healing_potion', chance: 0.25, count: 1 },
          { id: 'stonehollow_hammer', chance: 0.04, count: 1 },
        ],
      },
      archer: {
        gems: [{ type: 'sapphire', chance: 0.3, count: 1 }],
        items: [
          { id: 'mana_potion', chance: 0.25, count: 1 },
          { id: 'nightfang_dagger', chance: 0.04, count: 1 },
        ],
      },
    })
  })

  it('keeps the sheet keys, including the goblin_archer and goblin_brute aliases', () => {
    const brute = {
      assetId: 'goblin_brute',
      defaultSheet: 'goblin_brute',
      walkSheet: 'goblin_brute',
      hurtSheet: 'goblin_brute',
      attackSheet: 'goblin_brute',
      telegraphSheet: 'goblin_brute_telegraph',
      deathSheet: 'goblin_brute_death',
      spawnSheet: 'goblin_brute_spawn',
      alertSheet: 'goblin_brute_alert',
      initialFrame: 'goblin_brute_idle_down',
    }
    const archer = {
      assetId: 'goblin_archer',
      defaultSheet: 'goblin_archer',
      walkSheet: 'goblin_archer',
      hurtSheet: 'goblin_archer',
      attackSheet: 'goblin_archer',
      deathSheet: 'goblin_archer_death',
      spawnSheet: 'goblin_archer_spawn',
      alertSheet: 'goblin_archer_alert',
      initialFrame: 'goblin_archer_idle_down',
    }
    expect(Object.keys(ENEMY_SHEETS).sort()).toEqual([
      'archer',
      'ashen_cultist',
      'ashen_revenant',
      'brute',
      'goblin',
      'goblin_archer',
      'goblin_brute',
      'shadowfang_wolf',
    ])
    expect(ENEMY_SHEETS.goblin).toEqual({
      defaultSheet: 'goblin',
      walkSheet: 'goblin',
      hurtSheet: 'goblin',
      attackSheet: 'goblin',
      telegraphSheet: 'goblin_telegraph',
      deathSheet: 'goblin_death',
      spawnSheet: 'goblin_spawn',
      alertSheet: 'goblin_alert',
      initialFrame: 'goblin_idle_down',
    })
    expect(ENEMY_SHEETS.brute).toEqual(brute)
    expect(ENEMY_SHEETS.goblin_brute).toEqual(brute)
    expect(ENEMY_SHEETS.archer).toEqual(archer)
    expect(ENEMY_SHEETS.goblin_archer).toEqual(archer)
  })

  it('picks the AI class from the def', () => {
    const scene = mockScene()
    expect(new Enemy(scene, 0, 0, 'goblin').ai).toBeInstanceOf(GoblinAI)
    expect(new Enemy(scene, 0, 0, 'brute').ai).toBeInstanceOf(BruteAI)
    expect(new Enemy(scene, 0, 0, 'goblin_brute').ai).toBeInstanceOf(BruteAI)
    expect(new Enemy(scene, 0, 0, 'archer').ai).toBeInstanceOf(ArcherAI)
    expect(new Enemy(scene, 0, 0, 'archer').ai.damage).toBe(10)
    expect(new Enemy(scene, 0, 0, 'goblin_archer').ai).toBeInstanceOf(ArcherAI)
    expect(new Enemy(scene, 0, 0, 'brute').isArmored).toBe(true)
    expect(new Enemy(scene, 0, 0, 'goblin').isArmored).toBe(false)
    expect(new Enemy(scene, 0, 0, 'archer').isArmored).toBe(false)
  })

  it('has a spawn weight on every built-in', () => {
    for (const type of Object.keys(EXPECTED)) expect(getEnemyDef(type).spawnWeight).toBeGreaterThan(0)
    expect(pickEnemyTypeByWeight(() => 0)).toBe('goblin')
    // Last def in the table gets the top of the roll.
    expect(pickEnemyTypeByWeight(() => 0.99)).toBe('ashen_revenant')
    expect(pickEnemyTypeByWeight(() => 0.99, { goblin: 6, archer: 2 })).toBe('archer')
  })
})

describe('enemyDefs: a new enemy is one def entry', () => {
  afterEach(() => unregisterEnemyDef('test_enemy'))

  it('spawns, takes damage, drops loot and gets a label with no other edits', () => {
    class TestAI {
      constructor(enemy) {
        this.enemy = enemy
      }
    }
    registerEnemyDef({
      id: 'test_enemy',
      label: 'Test Enemy',
      ai: TestAI,
      armored: false,
      hp: 50,
      speed: 77,
      damage: 9,
      sheets: {
        defaultSheet: 'test_enemy',
        walkSheet: 'test_enemy',
        hurtSheet: 'test_enemy',
        attackSheet: 'test_enemy',
        deathSheet: 'test_enemy_death',
        spawnSheet: 'test_enemy_spawn',
        alertSheet: 'test_enemy_alert',
        initialFrame: 'test_enemy_idle_down',
      },
      loot: {
        gems: [{ type: 'emerald', chance: 1, count: 2 }],
        items: [{ id: 'apple', chance: 1, count: 3 }],
      },
      spawnWeight: 3,
    })

    expect(isEnemyType('test_enemy')).toBe(true)
    expect(ENEMY_DEFS.test_enemy.label).toBe('Test Enemy')
    expect(enemyLabel('test_enemy')).toBe('Test Enemy')
    expect(getEnemyHp('test_enemy')).toBe(50)
    expect(getEnemyHp('test_enemy', 3)).toBe(Math.round(50 * 1.24))
    expect(getEnemySpeed('test_enemy')).toBe(77)
    expect(getEnemyDamage('test_enemy')).toBe(9)

    const enemy = new Enemy(mockScene(), 10, 20, 'test_enemy', { wave: 1 })
    expect(enemy.enemyType).toBe('test_enemy')
    expect(enemy.hpMax).toBe(50)
    expect(enemy.speed).toBe(77)
    expect(enemy.damage).toBe(9)
    expect(enemy.ai).toBeInstanceOf(TestAI)
    expect(enemy.texture.key).toBe('test_enemy')
    expect(enemy.getSheetForAnim('death')).toBe('test_enemy_death')
    expect(enemy.getSheetForAnim('alert')).toBe('test_enemy_alert')

    expect(enemy.takeDamage(20, 1000)).toBe(true)
    expect(enemy.hp).toBe(30)

    expect(generateSeededLoot('test_enemy', () => 0)).toEqual({
      gems: { ruby: 0, sapphire: 0, emerald: 2 },
      items: [{ id: 'apple', count: 3 }],
    })
    expect(pickEnemyTypeByWeight(() => 0.999)).toBe('test_enemy')
  })

  it('accepts an AI by registered name', () => {
    class NamedAI {}
    registerEnemyAI('NamedAI', NamedAI)
    registerEnemyDef({
      id: 'test_enemy',
      label: 'Test Enemy',
      ai: 'NamedAI',
      hp: 5,
      speed: 5,
      damage: 5,
      sheets: { defaultSheet: 'test_enemy', initialFrame: 'x' },
      loot: { gems: [], items: [] },
      spawnWeight: 0,
    })
    expect(new Enemy(mockScene(), 0, 0, 'test_enemy').ai).toBeInstanceOf(NamedAI)
  })

  it('is gone after unregister', () => {
    expect(isEnemyType('test_enemy')).toBe(false)
    expect(getEnemyHp('test_enemy')).toBe(36)
  })
})
