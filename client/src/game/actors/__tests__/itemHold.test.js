import { describe, it, expect } from 'vitest'
import {
  EFFECT_MS,
  USE_MS,
  getHeldItemId,
  holdClipFor,
  useClipFor,
  getItemAnchor,
} from '../itemHold.js'

describe('itemHold pure module (Package IT-1)', () => {
  describe('Timing Constants', () => {
    it('defines EFFECT_MS === 625 and USE_MS === 1000', () => {
      expect(EFFECT_MS).toBe(625)
      expect(USE_MS).toBe(1000)
    })
  })

  describe('getHeldItemId', () => {
    it('returns equipped consumable id when present in session', () => {
      expect(getHeldItemId({ equippedId: 'healing_potion', classId: 'knight' })).toBe('healing_potion')
      expect(getHeldItemId({ equippedId: 'mana_potion', classId: 'mage' })).toBe('mana_potion')
      expect(getHeldItemId({ equippedId: 'speed_potion', classId: 'thief' })).toBe('speed_potion')
      expect(getHeldItemId({ equippedId: 'apple', classId: 'dwarf' })).toBe('apple')
      expect(getHeldItemId({ equippedId: 'ale_flask', classId: 'knight' })).toBe('ale_flask')
    })

    it('returns null for weapons or unknown items', () => {
      expect(getHeldItemId({ equippedId: 'iron_sword', classId: 'knight' })).toBeNull()
      expect(getHeldItemId({ equippedId: 'twin_daggers', classId: 'thief' })).toBeNull()
      expect(getHeldItemId({ equippedId: null, classId: 'knight' })).toBeNull()
      expect(getHeldItemId(null)).toBeNull()
    })

    it('returns null when class is mage holding spellbook', () => {
      expect(getHeldItemId({ equippedId: 'spellbook', classId: 'mage' })).toBeNull()
    })
  })

  describe('holdClipFor', () => {
    it('returns hold_run when moving, else hold_idle', () => {
      expect(holdClipFor(true)).toBe('hold_run')
      expect(holdClipFor(false)).toBe('hold_idle')
    })
  })

  describe('useClipFor', () => {
    it('resolves correct clip for all 5 consumable items', () => {
      expect(useClipFor('healing_potion')).toBe('use_drink')
      expect(useClipFor('mana_potion')).toBe('use_drink')
      expect(useClipFor('speed_potion')).toBe('use_drink')
      expect(useClipFor('apple')).toBe('use_eat')
      expect(useClipFor('ale_flask')).toBe('use_drink')
    })

    it('returns null for non-consumable items', () => {
      expect(useClipFor('iron_sword')).toBeNull()
      expect(useClipFor('unknown_item')).toBeNull()
    })
  })

  describe('getItemAnchor', () => {
    it('looks up exact anchor coordinates and layer for known frames', () => {
      // Knight hold_idle down
      const knightIdleDown = getItemAnchor('knight', 'hold_idle', 'knight_hold_idle_down_0')
      expect(knightIdleDown).toBeDefined()
      expect(knightIdleDown.x).toBeCloseTo(-4.35, 2)
      expect(knightIdleDown.y).toBeCloseTo(-40.76, 2)
      expect(knightIdleDown.rotation).toBe(0.0)
      expect(knightIdleDown.layer).toBe('front')

      // Knight hold_run right
      const knightRunRight = getItemAnchor('knight', 'hold_run', 'knight_hold_run_right_0')
      expect(knightRunRight).toBeDefined()
      expect(typeof knightRunRight.x).toBe('number')
      expect(typeof knightRunRight.y).toBe('number')

      // Mage use_drink down frame 10 (effectFrame)
      const mageDrink10 = getItemAnchor('mage', 'use_drink', 'mage_use_drink_down_10')
      expect(mageDrink10).toBeDefined()
      expect(typeof mageDrink10.x).toBe('number')
      expect(typeof mageDrink10.y).toBe('number')

      // Dwarf use_eat up
      const dwarfEatUp = getItemAnchor('dwarf', 'use_eat', 'dwarf_use_eat_up_0')
      expect(dwarfEatUp).toBeDefined()
      expect(dwarfEatUp.layer).toBe('front') // Up facing is always front

      // Thief hold_idle left
      const thiefIdleLeft = getItemAnchor('thief', 'hold_idle', 'thief_hold_idle_left_0')
      expect(thiefIdleLeft).toBeDefined()
      expect(thiefIdleLeft.layer).toBe('behind')
    })

    it('returns null for missing hero or clip', () => {
      expect(getItemAnchor('nonexistent', 'hold_idle', 'frame')).toBeNull()
      expect(getItemAnchor('knight', 'invalid_clip', 'frame')).toBeNull()
    })

    it('exposes Batch 10 throw, lockpick, and pickaxe anchors', () => {
      const release = getItemAnchor('thief', 'use_throw', 'thief_use_throw_down_3')
      expect(release).toMatchObject({ x: -17.69, y: -34.81, layer: 'front' })
      const hidden = getItemAnchor('thief', 'use_throw', 'thief_use_throw_down_4')
      expect(hidden.layer).toBe('none')
      expect(getItemAnchor('thief', 'use_throw', 'thief_use_throw_left_3')).toMatchObject({
        x: -9.84,
        y: -40.54,
      })
      expect(getItemAnchor('thief', 'use_lockpick', 'thief_use_lockpick_down_0')).toBeTruthy()
      expect(getItemAnchor('dwarf', 'use_pickaxe', 'dwarf_use_pickaxe_down_0')).toBeTruthy()
      expect(getItemAnchor('dwarf', 'use_pickaxe', 'dwarf_use_pickaxe_up_4').layer).toBe('front')
    })
  })
})
