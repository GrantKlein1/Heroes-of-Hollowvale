/**
 * Pure slot-move logic for inventory and hotbar drag and drop (DRAG-1).
 *
 * An inventory is `{ armor: {head,chest,legs,boots,offhand}, storage: [], hotbar: [] }`.
 * A slot ref is `{ section: 'armor'|'storage'|'hotbar', key }`.
 * A held item is `{ id, count }` picked up from `from` (a slot ref or null).
 *
 * Nothing here touches React or the DOM, so Game.jsx and the unit tests
 * share one implementation.
 */

export const ARMOR_SLOTS = ['head', 'chest', 'legs', 'boots', 'offhand']

/** Item kinds that never merge into one slot. Unknown ids and consumables stack. */
const UNSTACKABLE_KINDS = new Set(['weapon', 'tool', 'armor', 'quest'])

/**
 * @param {(id:string)=>({kind?:string}|undefined)} [lookup] item def lookup (registry.getItem)
 * @returns {(id:string)=>boolean}
 */
export function makeIsStackable(lookup) {
  return (id) => {
    const def = lookup ? lookup(id) : undefined
    return !(def && UNSTACKABLE_KINDS.has(def.kind))
  }
}

export function getSlot(inv, ref) {
  if (!ref) return null
  if (ref.section === 'armor') return inv.armor[ref.key] || null
  if (ref.section === 'storage') return inv.storage[ref.key] || null
  if (ref.section === 'hotbar') return inv.hotbar[ref.key] || null
  return null
}

export function setSlot(inv, ref, value) {
  const next = { armor: { ...inv.armor }, storage: inv.storage.slice(), hotbar: inv.hotbar.slice() }
  if (ref.section === 'armor') next.armor[ref.key] = value
  else if (ref.section === 'storage') next.storage[ref.key] = value
  else if (ref.section === 'hotbar') next.hotbar[ref.key] = value
  return next
}

export function sameSlot(a, b) {
  return !!a && !!b && a.section === b.section && String(a.key) === String(b.key)
}

/** First empty slot: storage, then hotbar, then armor. */
export function firstEmptySlot(inv) {
  for (let i = 0; i < inv.storage.length; i++) if (!inv.storage[i]) return { section: 'storage', key: i }
  for (let i = 0; i < inv.hotbar.length; i++) if (!inv.hotbar[i]) return { section: 'hotbar', key: i }
  for (const key of ARMOR_SLOTS) if (!inv.armor[key]) return { section: 'armor', key }
  return null
}

/**
 * Put the held stack into `target`.
 *  - empty target: place it
 *  - same id and stackable: merge the counts
 *  - different (or unstackable) item: swap
 *
 * `swapTo` picks where the displaced item goes on a swap:
 *  - 'origin' (drag release): the slot the held item came from, if still empty; else it stays held.
 *  - 'hold' (click-to-place): the displaced item becomes the new held item.
 *
 * @returns {{ inventory: object, held: {id:string,count:number}|null }} held is whatever is still in hand
 */
export function placeHeld(inv, held, from, target, { isStackable = () => true, swapTo = 'origin' } = {}) {
  if (!held) return { inventory: inv, held: null }
  const cur = getSlot(inv, target)
  if (!cur) return { inventory: setSlot(inv, target, held), held: null }
  if (cur.id === held.id && isStackable(held.id)) {
    const merged = { id: cur.id, count: (cur.count || 1) + (held.count || 1) }
    return { inventory: setSlot(inv, target, merged), held: null }
  }
  // swap
  const placed = setSlot(inv, target, held)
  if (swapTo === 'origin' && from && !sameSlot(from, target) && !getSlot(placed, from)) {
    return { inventory: setSlot(placed, from, cur), held: null }
  }
  return { inventory: placed, held: cur }
}

/**
 * Send the held stack back where it came from. Falls back to merging into the
 * origin, then the first empty slot. Returns it as still held only when the
 * inventory is completely full.
 */
export function returnHeld(inv, held, from, { isStackable = () => true } = {}) {
  if (!held) return { inventory: inv, held: null }
  if (from) {
    const cur = getSlot(inv, from)
    if (!cur) return { inventory: setSlot(inv, from, held), held: null }
    if (cur.id === held.id && isStackable(held.id)) {
      return {
        inventory: setSlot(inv, from, { id: cur.id, count: (cur.count || 1) + (held.count || 1) }),
        held: null,
      }
    }
  }
  const empty = firstEmptySlot(inv)
  if (empty) return { inventory: setSlot(inv, empty, held), held: null }
  return { inventory: inv, held }
}

/**
 * Resolve a drag release. `target` is the slot ref under the pointer, or null
 * when the pointer is over nothing (outside the panel or between slots).
 * Dropping on nothing, or back on the origin slot, returns the item to its origin.
 */
export function dropHeld(inv, held, from, target, opts = {}) {
  if (!held) return { inventory: inv, held: null }
  if (!target || sameSlot(target, from)) return returnHeld(inv, held, from, opts)
  return placeHeld(inv, held, from, target, { ...opts, swapTo: 'origin' })
}

/** DOM-friendly slot id used by `data-inv-slot` attributes: `hotbar:3`, `armor:offhand`. */
export function slotId(section, key) {
  return `${section}:${key}`
}

/** Inverse of slotId. Storage and hotbar keys come back as numbers. Returns null for junk. */
export function parseSlotId(id) {
  if (typeof id !== 'string') return null
  const at = id.indexOf(':')
  if (at <= 0) return null
  const section = id.slice(0, at)
  const raw = id.slice(at + 1)
  if (section === 'armor') return ARMOR_SLOTS.includes(raw) ? { section, key: raw } : null
  if (section === 'storage' || section === 'hotbar') {
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 ? { section, key: n } : null
  }
  return null
}
