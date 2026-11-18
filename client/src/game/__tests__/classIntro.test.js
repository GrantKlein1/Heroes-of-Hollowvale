import { describe, expect, it } from 'vitest'
import { ATTACK_MS, CONSUMABLE_EFFECTS, MELEE_DMG, WEAPON } from '../combat/balance.js'
import { CLASS_INTROS, CLASS_ORDER, introPlainText } from '../classIntro.js'

const BANNED = ['Shield Bash', 'Frost Nova', 'Backstab', 'Cleave', 'critical', 'stamina', 'low health']

function byId(id) {
  return CLASS_INTROS.find((entry) => entry.id === id)
}

describe('class intro copy', () => {
  it('gives each calling its own health', () => {
    expect(CLASS_ORDER).toEqual(['knight', 'mage', 'thief', 'dwarf'])
    const phrases = CLASS_INTROS.map((entry) => entry.health)
    expect(new Set(phrases).size).toBe(CLASS_ORDER.length)
    expect(byId('knight').health.toLowerCase()).toContain('toughest')
    expect(byId('mage').health.toLowerCase()).toContain('lightest')
    expect(byId('dwarf').health.toLowerCase()).toContain('stout')
    expect(byId('thief').health.toLowerCase()).toContain('lighter')
  })

  it('gives the shield to the knight alone', () => {
    const shielded = CLASS_INTROS.filter((entry) => entry.kit.some((item) => item.id === 'wooden_shield'))
    expect(shielded.map((entry) => entry.id)).toEqual(['knight'])
    const guarding = CLASS_INTROS.filter((entry) => entry.guard.fill > 0)
    expect(guarding.map((entry) => entry.id)).toEqual(['knight'])
    expect(byId('knight').guard.phrase.toLowerCase()).toContain('shield')
    for (const entry of CLASS_INTROS.filter((item) => item.id !== 'knight')) {
      expect(entry.guard.phrase.toLowerCase()).not.toContain('shield')
    }
  })

  it('calls the thief the fastest and the lightest, and the dwarf the heaviest', () => {
    const thief = byId('thief')
    const dwarf = byId('dwarf')
    expect(thief.pace.fill).toBe(Math.max(...CLASS_INTROS.map((entry) => entry.pace.fill)))
    expect(thief.pace.phrase.toLowerCase()).toContain('swift')
    expect(thief.blows.fill).toBe(Math.min(...CLASS_INTROS.map((entry) => entry.blows.fill)))
    expect(thief.blows.phrase.toLowerCase()).toContain('light')
    expect(dwarf.blows.fill).toBe(Math.max(...CLASS_INTROS.map((entry) => entry.blows.fill)))
    expect(dwarf.blows.phrase.toLowerCase()).toContain('heaviest')
    expect(dwarf.pace.fill).toBe(Math.min(...CLASS_INTROS.map((entry) => entry.pace.fill)))
    expect(dwarf.pace.phrase.toLowerCase()).toContain('slow')
  })

  it('puts the mage spellbook in the pack and swings from attack timing', () => {
    const book = byId('mage').kit.find((item) => item.id === 'spellbook')
    expect(book).toMatchObject({ slot: 'pack', slotLabel: 'in your pack' })
    expect(MELEE_DMG.mage).toBeLessThan(MELEE_DMG.knight)
    expect(byId('mage').blows.fill).toBeLessThan(byId('knight').blows.fill)
    expect(byId('mage').blows.phrase.toLowerCase()).toContain('light')
    const slowestId = CLASS_ORDER.reduce((slowest, id) => (
      ATTACK_MS[id] > ATTACK_MS[slowest] ? id : slowest
    ), CLASS_ORDER[0])
    expect(byId(slowestId).blows.phrase.toLowerCase()).toContain('slowest')
    expect(byId('thief').blows.phrase.toLowerCase()).toContain('quickest')
  })

  it('gives every calling gem stacks and the real weapon in hand', () => {
    for (const entry of CLASS_INTROS) {
      for (const gem of ['ruby', 'sapphire', 'emerald']) {
        expect(entry.kit).toEqual(expect.arrayContaining([
          expect.objectContaining({ id: gem, count: 2 }),
        ]))
      }
      expect(entry.kit).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: WEAPON[entry.id], slot: 'hand', count: 1 }),
      ]))
      expect(entry.purse).toBe('2 rubies, 2 sapphires, and 2 emeralds, for the market.')
    }
  })

  it('phrases potions from consumable effects and leaves the old blurbs out', () => {
    const healing = byId('knight').kit.find((item) => item.id === 'healing_potion')
    const ale = byId('dwarf').kit.find((item) => item.id === 'ale_flask')
    const mana = byId('mage').kit.find((item) => item.id === 'mana_potion')
    expect(healing.effect).toBe('Restores most of your health.')
    expect(healing.effect).not.toContain(String(CONSUMABLE_EFFECTS.healing_potion.heal))
    expect(ale.effect.toLowerCase()).toContain('a little health')
    expect(ale.effect.toLowerCase()).toContain('stronger')
    expect(ale.effect).not.toContain(String(CONSUMABLE_EFFECTS.ale_flask.heal))
    expect(mana.count).toBe(2)
    expect(byId('mage').fight).toContain('Two mana potions restore most of it.')
    expect(byId('mage').fight.toLowerCase()).not.toContain('firebolt')
    expect(byId('mage').fight.toLowerCase()).not.toContain('frost')
    expect(byId('mage').fight.toLowerCase()).not.toContain('block')

    const blob = CLASS_INTROS.map(introPlainText).join('\n').toLowerCase()
    for (const word of BANNED) {
      expect(blob).not.toContain(word.toLowerCase())
    }
  })
})
