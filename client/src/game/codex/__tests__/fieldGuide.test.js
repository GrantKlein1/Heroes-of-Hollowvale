import { describe, it, expect, vi } from 'vitest'

vi.mock('phaser', () => ({
  default: {
    GameObjects: { Sprite: class Sprite {} },
  },
}))
import {
  MELEE_DMG,
  ENEMY_BASE_HP,
  CONSUMABLE_EFFECTS,
} from '../../combat/balance.js'
import { CLASS_SPRITES, DEFAULT_ITEM_ICON, ENEMY_SPRITES, ITEM_ICONS } from '../../../config/paths.js'
import {
  buildFieldGuide,
  FIELD_GUIDE_ITEM_IDS,
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

describe('field guide catalog', () => {
  const guide = buildFieldGuide()

  it('lists every hero, foe, and item', () => {
    expect(tab(guide, 'heroes').entries.map((item) => item.id)).toEqual(['knight', 'mage', 'thief', 'dwarf'])
    expect(tab(guide, 'enemies').entries.map((item) => item.id)).toEqual(['goblin', 'brute', 'archer', 'dragon', 'wildlife'])
    const itemIds = tab(guide, 'items').entries.map((item) => item.id)
    expect(itemIds).toEqual(expect.arrayContaining([...FIELD_GUIDE_ITEM_IDS]))
    expect(itemIds).toHaveLength(FIELD_GUIDE_ITEM_IDS.length)
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
    for (const id of FIELD_GUIDE_ITEM_IDS) {
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

  it('matches knight damage, brute health, and the healing potion', () => {
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
