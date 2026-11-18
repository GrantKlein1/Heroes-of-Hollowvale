import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('phaser', () => ({
  default: {
    GameObjects: { Sprite: class Sprite {} },
  },
}))
import {
  MELEE_DMG,
  ENEMY_BASE_HP,
  CONSUMABLE_EFFECTS,
  ATTACK_MS,
} from '../../combat/balance.js'
import { ENEMY_DEFS, getEnemyDef, registerEnemyDef, unregisterEnemyDef } from '../../combat/enemyDefs.js'
import { getItem, listItems, registerItem, unregisterItem } from '../../items/registry.js'
import { CLASS_SPRITES, DEFAULT_ITEM_ICON, ENEMY_SPRITES, ITEM_ICONS } from '../../../config/paths.js'
import {
  buildFieldGuide,
  fieldGuideItemIds,
  healthLine,
  paceWord,
  damageLine,
  secondsLabel,
  chanceWord,
} from '../fieldGuide.js'

function tab(guide, id) {
  return guide.tabs.find((entry) => entry.id === id)
}

function entry(guide, tabId, entryId) {
  return tab(guide, tabId).entries.find((item) => item.id === entryId)
}

const REGISTERED_ENEMY_IDS = Object.keys(ENEMY_DEFS)
const EXTRA_ENEMY_IDS = ['dragon', 'wildlife']

describe('field guide catalog', () => {
  const guide = buildFieldGuide()

  it('lists every registered enemy and item, plus the dragon and wildlife', () => {
    expect(tab(guide, 'heroes').entries.map((item) => item.id)).toEqual(['knight', 'mage', 'thief', 'dwarf'])
    expect(tab(guide, 'enemies').entries.map((item) => item.id)).toEqual([
      ...REGISTERED_ENEMY_IDS,
      ...EXTRA_ENEMY_IDS,
    ])
    for (const id of REGISTERED_ENEMY_IDS) {
      expect(entry(guide, 'enemies', id)).toBeTruthy()
      expect(entry(guide, 'enemies', id).name).toBe(ENEMY_DEFS[id].label)
    }
    const itemIds = tab(guide, 'items').entries.map((item) => item.id)
    const registeredItems = fieldGuideItemIds()
    expect(registeredItems).toEqual(listItems().map((item) => item.id))
    expect(itemIds).toEqual(expect.arrayContaining(registeredItems))
    expect(itemIds).toHaveLength(registeredItems.length)
  })

  it('keeps the original foe and item copy, and adds the new batch', () => {
    expect(entry(guide, 'enemies', 'goblin').blurb).toBe('Closes in to strike, then falls back when badly hurt.')
    expect(entry(guide, 'enemies', 'brute').blurb).toBe('Winds up a heavy swing you can see coming, then knocks you back.')
    expect(entry(guide, 'enemies', 'archer').blurb).toBe('Keeps its distance and shoots.')
    expect(entry(guide, 'enemies', 'archer').stats.find((row) => row.label === 'Arrow')).toBeTruthy()
    expect(entry(guide, 'items', 'iron_sword').blurb).toBe('The knight’s sword.')
    expect(entry(guide, 'items', 'wooden_shield').category).toBe('Weapons')

    expect(entry(guide, 'enemies', 'shadowfang_wolf').name).toBe('Shadowfang Wolf')
    expect(entry(guide, 'enemies', 'ashen_cultist').name).toBe('Ashen Cultist')
    expect(entry(guide, 'enemies', 'ashen_revenant').name).toBe('Ashen Revenant')
    expect(entry(guide, 'items', 'nightfang_dagger').name).toBe('Nightfang Dagger')
    expect(entry(guide, 'items', 'stonehollow_hammer').name).toBe('Stonehollow Hammer')
    expect(entry(guide, 'items', 'healing_charm').name).toBe('Healing Charm')
    expect(entry(guide, 'items', "seranyas_tear").name).toBe("Amulet of Seranya's Tear")
    expect(entry(guide, 'items', 'ember_chalice').name).toBe('The Embered Flagon Chalice')
  })

  it('gives every hero, item, and foe a non-empty image', () => {
    for (const id of ['knight', 'mage', 'thief', 'dwarf']) {
      expect(entry(guide, 'heroes', id).image.src).toBe(CLASS_SPRITES[id])
      expect(entry(guide, 'heroes', id).image.src.length).toBeGreaterThan(0)
    }
    for (const id of ['goblin', 'brute', 'archer']) {
      expect(entry(guide, 'enemies', id).image.src).toBe(ENEMY_SPRITES[id])
      expect(entry(guide, 'enemies', id).image.src.length).toBeGreaterThan(0)
    }
    const dragon = entry(guide, 'enemies', 'dragon').image
    expect(dragon.src).toMatch(/red_dragon_p1_a\.png$/)
    expect(dragon.frame.w).toBeGreaterThan(0)
    expect(dragon.sheet.w).toBeGreaterThan(dragon.frame.w)
    const wildlife = entry(guide, 'enemies', 'wildlife').image
    expect(wildlife.src).toMatch(/critters\.png$/)
    expect(wildlife.frame.w).toBeGreaterThan(0)
    expect(wildlife.sheet.h).toBeGreaterThan(wildlife.frame.h)
    for (const id of ['shadowfang_wolf', 'ashen_cultist', 'ashen_revenant']) {
      const image = entry(guide, 'enemies', id).image
      expect(image.src).toContain(`/assets/enemies/${id}/`)
      expect(image.frame.w).toBeGreaterThan(0)
      expect(image.sheet.w).toBeGreaterThan(image.frame.w)
    }
    for (const id of fieldGuideItemIds()) {
      const src = entry(guide, 'items', id).image.src
      expect(src).toBe(ITEM_ICONS[id] || DEFAULT_ITEM_ICON(id))
      expect(src.length).toBeGreaterThan(0)
    }
  })

  it('gives every entry a blurb and at least one stat', () => {
    for (const section of guide.tabs) {
      for (const item of section.entries) {
        expect(item.blurb.length).toBeGreaterThan(0)
        expect(item.stats.length).toBeGreaterThan(0)
        for (const row of item.stats) {
          expect(row.label.length).toBeGreaterThan(0)
          expect(row.value.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('reads numbers from enemy defs and the item registry, without hand-copied values', () => {
    const knight = entry(guide, 'heroes', 'knight')
    const strike = knight.stats.find((row) => row.label === 'Strike')
    expect(strike.value).toBe(damageLine(MELEE_DMG.knight))
    expect(strike.value).toContain(String(MELEE_DMG.knight))

    const brute = entry(guide, 'enemies', 'brute')
    const health = brute.stats.find((row) => row.label === 'Health')
    expect(health.value).toBe(healthLine(ENEMY_BASE_HP.brute))
    expect(health.value).toContain(String(ENEMY_BASE_HP.brute))

    const potion = entry(guide, 'items', 'healing_potion')
    const heal = potion.stats.find((row) => row.label === 'Heal')
    expect(heal.value).toContain(String(CONSUMABLE_EFFECTS.healing_potion.heal))

    const wolf = getEnemyDef('shadowfang_wolf')
    const wolfEntry = entry(guide, 'enemies', 'shadowfang_wolf')
    expect(wolfEntry.stats.find((row) => row.label === 'Health').value).toBe(healthLine(wolf.hp))
    expect(wolfEntry.stats.find((row) => row.label === 'Pace').value).toBe(paceWord(wolf.speed))
    expect(wolfEntry.stats.find((row) => row.label === 'Strike').value).toBe(damageLine(wolf.damage))

    const cultist = getEnemyDef('ashen_cultist')
    const bolt = entry(guide, 'enemies', 'ashen_cultist').stats.find((row) => row.label === 'Bolt')
    expect(bolt.value).toBe(damageLine(cultist.projectile.damage))

    const dagger = getItem('nightfang_dagger')
    const daggerStrike = entry(guide, 'items', 'nightfang_dagger').stats.find((row) => row.label === 'Strike')
    expect(daggerStrike.value).toBe(damageLine(dagger.weapon.damage))
    const daggerSwing = entry(guide, 'items', 'nightfang_dagger').stats.find((row) => row.label === 'Swing')
    expect(daggerSwing.value).toBe(`Every ${secondsLabel(ATTACK_MS.thief)}`)

    const hammer = getItem('stonehollow_hammer')
    const hammerStrike = entry(guide, 'items', 'stonehollow_hammer').stats.find((row) => row.label === 'Strike')
    expect(hammerStrike.value).toBe(damageLine(hammer.weapon.damage))

    const bow = getItem('lightning_bow')
    const bowEntry = entry(guide, 'items', 'lightning_bow')
    expect(bowEntry.name).toBe('Lightning Bow')
    expect(bowEntry.category).toBe('Weapons')
    expect(bowEntry.stats.find((row) => row.label === 'Strike').value).toBe(damageLine(bow.weapon.damage))
    expect(bowEntry.stats.find((row) => row.label === 'Draw').value).toContain(secondsLabel(833))
    expect(bowEntry.stats.find((row) => row.label === 'Range').value).toContain(String(bow.projectile.maxDist))
    expect(bowEntry.stats.find((row) => row.label === 'Price').value).not.toMatch(/ruby|sapphire|emerald/i)
    expect(entry(guide, 'enemies', 'archer').stats.find((row) => row.label === 'Drops').value).toContain('Lightning Bow')

    const charm = getItem('healing_charm')
    const charmHeal = entry(guide, 'items', 'healing_charm').stats.find((row) => row.label === 'Heal')
    expect(charmHeal.value).toContain(String(charm.effect.heal))

    const goblinDrops = entry(guide, 'enemies', 'goblin').stats.find((row) => row.label === 'Drops')
    expect(goblinDrops.value).toContain('Healing Charm')
    expect(goblinDrops.value).not.toMatch(/healing_charm/)
  })

  it('keeps the wave note on the enemies tab only', () => {
    expect(tab(guide, 'enemies').note).toMatch(/later wave/i)
    expect(tab(guide, 'heroes').note).toBeUndefined()
    expect(entry(guide, 'enemies', 'goblin').blurb).not.toMatch(/later wave/i)
  })

  it('formats health, pace, damage, and time in words', () => {
    expect(healthLine(10)).toBe('Frail (10 health)')
    expect(healthLine(25)).toBe('Light (25 health)')
    expect(healthLine(100)).toBe('Formidable (100 health)')
    expect(healthLine(1200)).toBe('Boss (1200 health)')
    expect(paceWord(160)).toBe('Steady')
    expect(paceWord(180)).toBe('Quick')
    expect(paceWord(200)).toBe('Swift')
    expect(paceWord(55)).toBe('Much slower')
    expect(damageLine(12)).toBe('Solid hit (12)')
    expect(damageLine(15)).toBe('Heavy hit (15)')
    expect(damageLine(40)).toBe('Brutal hit (40)')
    expect(secondsLabel(600)).toBe('0.6s')
    expect(secondsLabel(10000)).toBe('10s')
    expect(chanceWord(0.6)).toBe('Often')
    expect(chanceWord(0.25)).toBe('Sometimes')
    expect(chanceWord(0.15)).toBe('Rarely')
  })
})

describe('field guide registry follow-through', () => {
  afterEach(() => {
    unregisterEnemyDef('guide_test_foe')
    unregisterItem('guide_test_relic')
  })

  it('adds a later registered enemy and item automatically', () => {
    registerEnemyDef({
      id: 'guide_test_foe',
      label: 'Guide Test Foe',
      ai: 'GoblinAI',
      armored: false,
      hp: 11,
      speed: 50,
      damage: 3,
      sheets: { defaultSheet: 'guide_test_foe', initialFrame: 'guide_test_foe_idle_down' },
      loot: { gems: [], items: [] },
      spawnWeight: 0,
    })
    registerItem({
      id: 'guide_test_relic',
      name: 'Guide Test Relic',
      kind: 'quest',
      icon: '/images/guide_test_relic.png',
    })

    const guide = buildFieldGuide()
    const foe = entry(guide, 'enemies', 'guide_test_foe')
    expect(foe).toBeTruthy()
    expect(foe.name).toBe('Guide Test Foe')
    expect(foe.blurb).toBe('Closes in to strike.')
    expect(foe.stats.find((row) => row.label === 'Health').value).toBe(healthLine(11))
    expect(foe.stats.find((row) => row.label === 'Strike').value).toBe(damageLine(3))

    const relic = entry(guide, 'items', 'guide_test_relic')
    expect(relic).toBeTruthy()
    expect(relic.name).toBe('Guide Test Relic')
    expect(relic.category).toBe('Quest')
    expect(relic.blurb.length).toBeGreaterThan(0)
    expect(fieldGuideItemIds()).toContain('guide_test_relic')
  })
})
