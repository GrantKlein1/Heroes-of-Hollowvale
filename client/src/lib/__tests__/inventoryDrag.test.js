import { describe, it, expect } from 'vitest'
import {
  dropHeld,
  placeHeld,
  returnHeld,
  makeIsStackable,
  sameSlot,
  firstEmptySlot,
  getSlot,
  slotId,
  parseSlotId,
} from '../inventoryDrag'

const emptyInv = () => ({
  armor: { head: null, chest: null, legs: null, boots: null, offhand: null },
  storage: Array(4).fill(null),
  hotbar: Array(9).fill(null),
})

const at = (section, key) => ({ section, key })

describe('dropHeld', () => {
  it('drops onto an empty slot', () => {
    const inv = emptyInv() // the held item was already lifted out of storage 0
    const held = { id: 'spellbook', count: 1 }
    const res = dropHeld(inv, held, at('storage', 0), at('hotbar', 2))
    expect(res.held).toBeNull()
    expect(res.inventory.hotbar[2]).toEqual(held)
    expect(res.inventory.storage[0]).toBeNull()
  })

  it('does not mutate the input inventory', () => {
    const inv = emptyInv()
    const snapshot = JSON.stringify(inv)
    dropHeld(inv, { id: 'apple', count: 1 }, at('storage', 0), at('hotbar', 1))
    expect(JSON.stringify(inv)).toBe(snapshot)
  })

  it('swaps with an occupied slot and sends the displaced item to the origin', () => {
    const inv = emptyInv()
    inv.hotbar[3] = { id: 'iron_sword', count: 1 }
    const held = { id: 'spellbook', count: 1 }
    const res = dropHeld(inv, held, at('storage', 1), at('hotbar', 3))
    expect(res.held).toBeNull()
    expect(res.inventory.hotbar[3]).toEqual(held)
    expect(res.inventory.storage[1]).toEqual({ id: 'iron_sword', count: 1 })
  })

  it('keeps the displaced item in hand when the origin was refilled', () => {
    const inv = emptyInv()
    inv.hotbar[3] = { id: 'iron_sword', count: 1 }
    inv.storage[1] = { id: 'apple', count: 1 }
    const res = dropHeld(inv, { id: 'spellbook', count: 1 }, at('storage', 1), at('hotbar', 3))
    expect(res.held).toEqual({ id: 'iron_sword', count: 1 })
    expect(res.inventory.hotbar[3]).toEqual({ id: 'spellbook', count: 1 })
  })

  it('merges stackables of the same id', () => {
    const inv = emptyInv()
    inv.hotbar[0] = { id: 'healing_potion', count: 2 }
    const res = dropHeld(inv, { id: 'healing_potion', count: 3 }, at('storage', 0), at('hotbar', 0))
    expect(res.held).toBeNull()
    expect(res.inventory.hotbar[0]).toEqual({ id: 'healing_potion', count: 5 })
  })

  it('treats a missing count as 1 when merging', () => {
    const inv = emptyInv()
    inv.hotbar[0] = { id: 'apple' }
    const res = dropHeld(inv, { id: 'apple' }, at('storage', 0), at('hotbar', 0))
    expect(res.inventory.hotbar[0]).toEqual({ id: 'apple', count: 2 })
  })

  it('swaps instead of merging unstackable items of the same id', () => {
    const isStackable = makeIsStackable((id) => (id === 'iron_sword' ? { kind: 'weapon' } : undefined))
    const inv = emptyInv()
    inv.hotbar[0] = { id: 'iron_sword', count: 1 }
    const res = dropHeld(inv, { id: 'iron_sword', count: 1 }, at('storage', 0), at('hotbar', 0), { isStackable })
    expect(res.inventory.hotbar[0]).toEqual({ id: 'iron_sword', count: 1 })
    expect(res.inventory.storage[0]).toEqual({ id: 'iron_sword', count: 1 })
  })

  it('returns the item to its origin when dropped on nothing', () => {
    const inv = emptyInv()
    const held = { id: 'spellbook', count: 1 }
    const res = dropHeld(inv, held, at('storage', 2), null)
    expect(res.held).toBeNull()
    expect(res.inventory.storage[2]).toEqual(held)
  })

  it('returns the item to its origin when dropped back on the origin slot', () => {
    const inv = emptyInv()
    const res = dropHeld(inv, { id: 'apple', count: 4 }, at('hotbar', 5), at('hotbar', 5))
    expect(res.inventory.hotbar[5]).toEqual({ id: 'apple', count: 4 })
    expect(res.held).toBeNull()
  })

  it('falls back to the first empty slot when the origin is taken by another item', () => {
    const inv = emptyInv()
    inv.storage[0] = { id: 'iron_sword', count: 1 }
    const res = dropHeld(inv, { id: 'spellbook', count: 1 }, at('storage', 0), null)
    expect(res.held).toBeNull()
    expect(res.inventory.storage[0]).toEqual({ id: 'iron_sword', count: 1 })
    expect(res.inventory.storage[1]).toEqual({ id: 'spellbook', count: 1 })
  })

  it('stays in hand only when nothing has room', () => {
    const inv = emptyInv()
    inv.storage = inv.storage.map(() => ({ id: 'x', count: 1 }))
    inv.hotbar = inv.hotbar.map(() => ({ id: 'x', count: 1 }))
    for (const k of Object.keys(inv.armor)) inv.armor[k] = { id: 'x', count: 1 }
    const held = { id: 'spellbook', count: 1 }
    const res = dropHeld(inv, held, at('storage', 0), null)
    expect(res.held).toEqual(held)
    expect(res.inventory).toBe(inv)
  })

  it('does nothing without a held item', () => {
    const inv = emptyInv()
    expect(dropHeld(inv, null, null, at('hotbar', 0))).toEqual({ inventory: inv, held: null })
  })
})

describe('placeHeld click mode', () => {
  it('hands the displaced item to the cursor on swap', () => {
    const inv = emptyInv()
    inv.hotbar[1] = { id: 'iron_sword', count: 1 }
    const res = placeHeld(inv, { id: 'spellbook', count: 1 }, at('storage', 0), at('hotbar', 1), { swapTo: 'hold' })
    expect(res.held).toEqual({ id: 'iron_sword', count: 1 })
    expect(res.inventory.hotbar[1]).toEqual({ id: 'spellbook', count: 1 })
  })
})

describe('helpers', () => {
  it('makeIsStackable defaults to stackable for unknown ids', () => {
    expect(makeIsStackable()('ruby')).toBe(true)
    expect(makeIsStackable(() => ({ kind: 'consumable' }))('x')).toBe(true)
    expect(makeIsStackable(() => ({ kind: 'quest' }))('x')).toBe(false)
  })
  it('sameSlot compares numeric and string keys', () => {
    expect(sameSlot(at('storage', 1), at('storage', '1'))).toBe(true)
    expect(sameSlot(at('storage', 1), at('hotbar', 1))).toBe(false)
    expect(sameSlot(null, at('hotbar', 1))).toBe(false)
  })
  it('firstEmptySlot and getSlot read the right sections', () => {
    const inv = emptyInv()
    inv.storage = inv.storage.map(() => ({ id: 'x', count: 1 }))
    expect(firstEmptySlot(inv)).toEqual(at('hotbar', 0))
    expect(getSlot(inv, at('storage', 0))).toEqual({ id: 'x', count: 1 })
    expect(getSlot(inv, null)).toBeNull()
  })
  it('returnHeld merges into a same-id origin', () => {
    const inv = emptyInv()
    inv.storage[0] = { id: 'apple', count: 1 }
    const res = returnHeld(inv, { id: 'apple', count: 2 }, at('storage', 0))
    expect(res.inventory.storage[0]).toEqual({ id: 'apple', count: 3 })
  })
  it('slotId and parseSlotId round-trip', () => {
    expect(parseSlotId(slotId('hotbar', 3))).toEqual(at('hotbar', 3))
    expect(parseSlotId(slotId('armor', 'offhand'))).toEqual(at('armor', 'offhand'))
    expect(parseSlotId('armor:tail')).toBeNull()
    expect(parseSlotId('storage:-1')).toBeNull()
    expect(parseSlotId('nope')).toBeNull()
    expect(parseSlotId(undefined)).toBeNull()
  })
})
