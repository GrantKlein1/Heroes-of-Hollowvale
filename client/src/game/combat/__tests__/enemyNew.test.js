import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

vi.mock('phaser', () => {
  class MockSprite {
    constructor(scene, x = 0, y = 0, texture = '', frame = '') {
      this.scene = scene
      this.x = x
      this.y = y
      this.texture = { key: texture }
      this.frame = { name: frame, width: 96, height: 96, realWidth: 96, realHeight: 96, pivot: null }
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

import { Enemy, ENEMY_SHEETS } from '../../actors/Enemy.js'
import { GoblinAI } from '../../ai/goblin.js'
import { BruteAI } from '../../ai/brute.js'
import { WolfAI } from '../../ai/wolf.js'
import { CultistAI } from '../../ai/cultist.js'
import { getEnemyHp, getEnemySpeed, getEnemyDamage, ENEMY_BASE_HP, ENEMY_BASE_SPEED, ENEMY_BASE_DAMAGE } from '../balance.js'
import { enemyLabel, generateSeededLoot, seededLootIdsWithoutSprites } from '../death.js'
import { ENEMY_DEFS, getEnemyDef, isEnemyType, resolveEnemyDef, pickEnemyTypeByWeight } from '../enemyDefs.js'
import { BIOME_SPAWN_TABLES } from '../../terrain/spawnTables.js'

const PUBLIC = path.resolve(__dirname, '../../../../public')
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'assets/manifest.json'), 'utf8'))
const readSheet = (id, key) =>
  JSON.parse(fs.readFileSync(path.join(PUBLIC, 'assets/enemies', id, `${key}.json`), 'utf8'))

function mockScene() {
  return {
    textures: { get: () => null, exists: () => false },
    anims: { exists: () => true },
    projectiles: [],
    add: { existing: (o) => o },
    player: { x: 0, y: 0, hp: 100, body: { bottom: 0, x: 0, y: 0, width: 1, height: 1 }, takeDamage() {}, is: () => false },
  }
}

// Placeholder numbers, Grant-tunable. Pinned here so a change is deliberate.
const NEW = {
  shadowfang_wolf: {
    label: 'Shadowfang Wolf',
    ai: 'WolfAI',
    AiClass: WolfAI,
    armored: false,
    hp: 30,
    speed: 130,
    damage: 7,
    loot: {
      gems: [{ type: 'emerald', chance: 0.2, count: 1 }],
      items: [{ id: 'speed_potion', chance: 0.2, count: 1 }],
    },
    spawnWeight: 2,
    cell: 128,
    origin: { x: 0.5, y: 0.9062 },
    footprint: { x: -26, y: -6, w: 52, h: 12 },
    hurtbox: { x: -26, y: -30, w: 52, h: 30 },
  },
  ashen_cultist: {
    label: 'Ashen Cultist',
    ai: 'CultistAI',
    AiClass: CultistAI,
    armored: false,
    hp: 28,
    speed: 70,
    damage: 6,
    projectile: { speed: 220, dist: 420, size: 14, damage: 10 },
    loot: {
      gems: [
        { type: 'ruby', chance: 0.3, count: 1 },
        { type: 'sapphire', chance: 0.2, count: 1 },
      ],
      items: [{ id: 'mana_potion', chance: 0.3, count: 1 }],
    },
    spawnWeight: 1,
    cell: 96,
    origin: { x: 0.5, y: 0.9271 },
    footprint: { x: -14, y: -5, w: 28, h: 10 },
    hurtbox: { x: -16, y: -29, w: 32, h: 29 },
  },
  ashen_revenant: {
    label: 'Ashen Revenant',
    ai: 'BruteAI',
    AiClass: BruteAI,
    armored: true,
    hp: 90,
    speed: 40,
    damage: 20,
    loot: {
      gems: [
        { type: 'ruby', chance: 0.5, count: 1 },
        { type: 'sapphire', chance: 0.4, count: 1 },
      ],
      items: [{ id: 'healing_potion', chance: 0.3, count: 1 }],
    },
    spawnWeight: 1,
    cell: 96,
    origin: { x: 0.5, y: 0.9271 },
    footprint: { x: -14, y: -5, w: 28, h: 10 },
    hurtbox: { x: -16, y: -30, w: 32, h: 30 },
  },
}

describe('Batch 11 enemies: defs', () => {
  for (const [id, want] of Object.entries(NEW)) {
    describe(id, () => {
      const def = getEnemyDef(id)

      it('is registered with its label, AI name, stats, loot and spawn weight', () => {
        expect(def).toBeTruthy()
        expect(isEnemyType(id)).toBe(true)
        expect(resolveEnemyDef(id)).toBe(def)
        expect(def.label).toBe(want.label)
        expect(enemyLabel(id)).toBe(want.label)
        expect(def.ai).toBe(want.ai)
        expect(def.armored).toBe(want.armored)
        expect(def.loot).toEqual(want.loot)
        expect(def.spawnWeight).toBe(want.spawnWeight)
        if (want.projectile) expect(def.projectile).toEqual(want.projectile)
        else expect(def.projectile).toBeUndefined()
      })

      it('reads HP, speed and damage through balance.js, scaling like the others', () => {
        expect(getEnemyHp(id)).toBe(want.hp)
        expect(getEnemySpeed(id)).toBe(want.speed)
        expect(getEnemyDamage(id)).toBe(want.damage)
        expect(ENEMY_BASE_HP[id]).toBe(want.hp)
        expect(ENEMY_BASE_SPEED[id]).toBe(want.speed)
        expect(ENEMY_BASE_DAMAGE[id]).toBe(want.damage)
        expect(getEnemyHp(id, 4)).toBe(Math.round(want.hp * 1.36))
        expect(getEnemyDamage(id, 4)).toBe(Math.round(want.damage * 1.15))
      })

      it('only drops items that have a world pickup sprite', () => {
        expect(seededLootIdsWithoutSprites()).toEqual([])
        expect(generateSeededLoot(id, () => 0)).toEqual({
          gems: {
            ruby: 0, sapphire: 0, emerald: 0,
            ...Object.fromEntries(want.loot.gems.map((g) => [g.type, g.count])),
          },
          items: want.loot.items.map((i) => ({ id: i.id, count: i.count })),
        })
        expect(generateSeededLoot(id, () => 0.999)).toEqual({
          gems: { ruby: 0, sapphire: 0, emerald: 0 },
          items: [],
        })
      })

      it('points its sheets at atlases that exist in the manifest and on disk', () => {
        const sheets = ENEMY_SHEETS[id]
        expect(sheets.assetId).toBe(id)
        for (const key of [sheets.defaultSheet, sheets.walkSheet, sheets.hurtSheet, sheets.attackSheet, sheets.deathSheet]) {
          const entry = manifest.assets[id].sheets[key]
          expect(entry, key).toBeTruthy()
          expect(fs.existsSync(path.join(PUBLIC, entry.image)), entry.image).toBe(true)
          expect(fs.existsSync(path.join(PUBLIC, entry.json)), entry.json).toBe(true)
        }
        expect(sheets.telegraphSheet).toBeUndefined()
        expect(manifest.groups.wilderness).toContain(id)
        expect(manifest.assets[id].anchor).toEqual(want.origin)
      })

      it('has frames for every clip and facing, with the art footprint, hurtbox and hit frame 3', () => {
        const base = readSheet(id, id)
        const death = readSheet(id, `${id}_death`)
        expect(base.meta.origin).toEqual(want.origin)
        expect(death.meta.origin.x).toBe(want.origin.x)
        expect(base.meta.footprint).toMatchObject(want.footprint)
        expect(base.meta.hurtbox).toMatchObject(want.hurtbox)
        expect(base.meta.anims.attack.hitFrames).toEqual([3])
        expect(base.meta.anims.attack.frames).toBe(7)
        expect(base.meta.anims.attack.frameDurationsMs.reduce((a, b) => a + b, 0)).toBe(930)
        for (const dir of ['down', 'left', 'right', 'up']) {
          expect(base.frames[`${id}_idle_${dir}`], `idle ${dir}`).toBeTruthy()
          expect(base.meta.anims.attack.weaponTipOffsetFromFeet['3'][dir], `tip ${dir}`).toBeTruthy()
          for (const [clip, n] of [['walk', 8], ['hurt', 5], ['attack', 7]]) {
            for (let i = 0; i < n; i++) expect(base.frames[`${id}_${clip}_${dir}_${i}`], `${clip} ${dir} ${i}`).toBeTruthy()
          }
          for (let i = 0; i < 8; i++) expect(death.frames[`${id}_death_${dir}_${i}`], `death ${dir} ${i}`).toBeTruthy()
        }
        const w = base.frames[`${id}_idle_down`].frame.w
        expect(w).toBe(want.cell)
      })

      it('builds an Enemy that resolves the right AI and carries its numbers', () => {
        const e = new Enemy(mockScene(), 10, 20, id)
        expect(e.enemyType).toBe(id)
        expect(e.ai).toBeInstanceOf(want.AiClass)
        expect(e.hpMax).toBe(want.hp)
        expect(e.hp).toBe(want.hp)
        expect(e.speed).toBe(want.speed)
        expect(e.damage).toBe(want.damage)
        expect(e.isArmored).toBe(want.armored)
        expect(e.texture.key).toBe(id)
        expect(e.getSheetForAnim('death')).toBe(`${id}_death`)
        expect(e.getSheetForAnim('attack')).toBe(id)
        expect(e.getSheetForAnim('telegraph')).toBeUndefined()
        expect(e.getAnimKey('walk')).toBe(`${id}_walk_down`)
        expect(e.getAnimKey('death')).toBe(`${id}_death_down`)
        expect(e.takeDamage(10, 1000)).toBe(true)
        expect(e.hp).toBe(want.hp - 10)
      })
    })
  }

  it('the revenant is the tanky one and the wolf is the fast one', () => {
    const wolf = getEnemyDef('shadowfang_wolf')
    const cultist = getEnemyDef('ashen_cultist')
    const revenant = getEnemyDef('ashen_revenant')
    const brute = getEnemyDef('brute')
    expect(revenant.hp).toBeGreaterThan(brute.hp)
    expect(revenant.speed).toBeLessThan(brute.speed)
    expect(revenant.damage).toBeGreaterThan(brute.damage)
    expect(wolf.speed).toBeGreaterThan(getEnemyDef('goblin').speed)
    expect(wolf.damage).toBeLessThan(getEnemyDef('goblin').damage)
    expect(cultist.projectile.damage).toBeGreaterThanOrEqual(getEnemyDef('archer').projectile.damage)
    expect(cultist.projectile.speed).toBeLessThan(getEnemyDef('archer').projectile.speed)
  })

  it('leaves the built-in enemies exactly as they were', () => {
    expect(ENEMY_DEFS.goblin.ai).toBe('GoblinAI')
    expect(new Enemy(mockScene(), 0, 0, 'goblin').ai).toBeInstanceOf(GoblinAI)
    expect(ENEMY_DEFS.goblin.hp).toBe(36)
    expect(ENEMY_DEFS.brute.hp).toBe(72)
    expect(ENEMY_DEFS.archer.hp).toBe(24)
    expect(ENEMY_DEFS.archer.projectile).toEqual({ speed: 300, dist: 400, size: 12, damage: 10 })
  })
})

describe('Batch 11 enemies: spawn tables', () => {
  it('wolves live in emberwood and the wastes; cultists and revenants only in the wastes', () => {
    const wastes = BIOME_SPAWN_TABLES.ashen_wastes.weights
    const ember = BIOME_SPAWN_TABLES.emberwood_forest.weights
    expect(wastes.shadowfang_wolf).toBeGreaterThan(0)
    expect(wastes.ashen_cultist).toBeGreaterThan(0)
    expect(wastes.ashen_revenant).toBeGreaterThan(0)
    expect(ember.shadowfang_wolf).toBeGreaterThan(0)
    expect(ember.ashen_cultist).toBeUndefined()
    expect(ember.ashen_revenant).toBeUndefined()
    expect(BIOME_SPAWN_TABLES.plains.weights.shadowfang_wolf).toBeUndefined()
  })

  it('keeps the goblin the most common enemy outside the wastes, and never outweighed by a new one', () => {
    for (const [biome, table] of Object.entries(BIOME_SPAWN_TABLES)) {
      for (const id of Object.keys(NEW)) {
        if (table.weights[id]) expect(table.weights[id], `${biome}:${id}`).toBeLessThan(table.weights.goblin)
      }
    }
    const e = BIOME_SPAWN_TABLES.emberwood_forest.weights
    expect(Math.max(...Object.values(e))).toBe(e.goblin)
  })

  it('rolls every new id from a weights map', () => {
    const w = BIOME_SPAWN_TABLES.ashen_wastes.weights
    const seen = new Set()
    for (let i = 0; i < 200; i++) seen.add(pickEnemyTypeByWeight(() => i / 200, w))
    for (const id of Object.keys(NEW)) expect(seen.has(id), id).toBe(true)
  })
})
