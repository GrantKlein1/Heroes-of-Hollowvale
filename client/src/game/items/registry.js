/**
 * Item registry (ITEM-NEW-1): the single source for every item's id, name,
 * icon, kind, effect, price, loot behaviour and hold/use clips.
 *
 * Game.jsx (catalog, market, prices), config/paths.js (ITEM_ICONS),
 * combat/balance.js (CONSUMABLE_EFFECTS), combat/death.js (LOOT_PICKUP_IDS),
 * actors/itemHold.js and the scene's consume path all read from here.
 *
 * This module is a leaf: it imports nothing, so balance.js, paths.js and
 * death.js can import it without a cycle.
 *
 * Item def shape:
 * {
 *   id, name, icon,
 *   kind:     'consumable' | 'weapon' | 'tool' | 'trinket' | 'quest' | 'armor' | 'currency',
 *   effect:   { heal?, mana?, speedMs?, damageMult?, durationMs? } | null   // consumables
 *   price:    { ruby, sapphire, emerald } | null                            // market price
 *   market:   category string | null                                        // null = not sold
 *   loot:     { pickupAtlas: string|null, random: boolean }                  // world pickup sprite / may roll randomly
 *   hold:     { idle, run, byClass? } | null                                // hold clips (null = never held in-hand)
 *   use:      { clip, glow?, weapon?, effectFrame?, durations? } | null     // one-shot use clip (null = cannot be used)
 *   inhand:   { atlas, origin: [x, y] } | null                              // in-hand sprite atlas and grip origin
 *   classes:  string[] | null                                               // heroes that can hold/wield it (null = all)
 *   weapon:   { damage, ranged? } | null                                     // weapon stats (melee unless ranged)
 *   projectile: { speed, maxDist, size, ... } | null                         // ranged weapons: the shot Space fires
 *   sellable: boolean
 * }
 */

export const ITEM_KINDS = Object.freeze([
  'consumable',
  'weapon',
  'tool',
  'trinket',
  'quest',
  'armor',
  'currency',
])

const IMAGES = '/images'

/** Default in-hand grip origin (items_inhand and items_inhand_b10 cells). */
export const DEFAULT_INHAND_ORIGIN = Object.freeze([12 / 24, 15.61 / 24])

export const LOOT_ATLAS_MAIN = 'loot_pickups'
export const LOOT_ATLAS_B11 = 'loot_pickups_b11'
export const LOOT_ATLAS_B12 = 'loot_pickups_b12'

const HOLD_DEFAULT = Object.freeze({ idle: 'hold_idle', run: 'hold_run' })
/** Dwarf charm uses the Batch 9 potion-grip hold; `dwarf_hold_*` is the tool grip. */
const HOLD_CHARM = Object.freeze({
  idle: 'hold_idle',
  run: 'hold_run',
  byClass: Object.freeze({
    dwarf: Object.freeze({ idle: 'charm_hold_idle', run: 'charm_hold_run' }),
  }),
})

/**
 * Lightning bow hold: the hero's potion-grip hold clip (the dwarf's is `charm_hold_*`) with a
 * resting string-and-runes glow overlay on the idle pose (`<hero>_bow_hold_idle_glow`).
 */
const HOLD_BOW = Object.freeze({ ...HOLD_CHARM, glowIdle: 'bow_hold_idle_glow' })

/**
 * BOW-SIZE-1. The carried bow and the drawn overlay (weapon + glow) render at this
 * multiple of the authored art. The grip stays on the hand; 1 leaves other items alone.
 */
export const BOW_HAND_SCALE = 1.45
/**
 * Lightning-arrow sprite scale. The 96px flight cell is longer than the bow, and
 * 0.65 of it is still about as long as the bow drawn at BOW_HAND_SCALE. 0.42 keeps
 * the projectile shorter than the bow in hand. The hit box stays `projectile.size`.
 */
export const ARROW_VISUAL_SCALE = 0.42

const inhand = (atlas, origin = DEFAULT_INHAND_ORIGIN, scale = 1) => Object.freeze({
  atlas,
  origin: Object.freeze([...origin]),
  scale,
})
const price = (ruby = 0, sapphire = 0, emerald = 0) => Object.freeze({ ruby, sapphire, emerald })
const pickup = (atlas = LOOT_ATLAS_MAIN, random = true) => Object.freeze({ pickupAtlas: atlas, random })
const NO_LOOT = Object.freeze({ pickupAtlas: null, random: false })

/**
 * Built-in items. Order matters in two places: it is the market listing order
 * inside a category, and LOOT_PICKUP_IDS keeps the order of the pickup items.
 */
const BUILTIN_ITEMS = [
  // --- Gems (currency)
  { id: 'ruby', name: 'Ruby', icon: `${IMAGES}/ruby.png`, kind: 'currency', loot: pickup() },
  { id: 'sapphire', name: 'Sapphire', icon: `${IMAGES}/sapphire.png`, kind: 'currency', loot: pickup() },
  { id: 'emerald', name: 'Emerald', icon: `${IMAGES}/emerald.png`, kind: 'currency', loot: pickup() },
  // --- Potions
  {
    id: 'healing_potion', name: 'Healing Potion', icon: `${IMAGES}/healPotion.png`, kind: 'consumable',
    effect: { heal: 70, mana: 0, speedMs: 0 }, use: { clip: 'use_drink' },
    market: 'Potions', price: price(1, 0, 0), loot: pickup(), hold: HOLD_DEFAULT,
  },
  {
    id: 'mana_potion', name: 'Mana Potion', icon: `${IMAGES}/manaPotion.png`, kind: 'consumable',
    effect: { heal: 0, mana: 75, speedMs: 0 }, use: { clip: 'use_drink' },
    market: 'Potions', price: price(0, 1, 0), loot: pickup(), hold: HOLD_DEFAULT,
  },
  {
    id: 'speed_potion', name: 'Speed Potion', icon: `${IMAGES}/speedPotion.png`, kind: 'consumable',
    effect: { heal: 0, mana: 0, speedMs: 10000 }, use: { clip: 'use_drink' },
    market: 'Potions', price: price(0, 0, 2), loot: pickup(), hold: HOLD_DEFAULT,
  },
  // --- Magic
  {
    id: 'apprentice_staff', name: 'Apprentice Staff', icon: `${IMAGES}/mageStaff.png`, kind: 'weapon',
    market: 'Magic', price: price(5, 2, 0),
  },
  {
    id: 'spellbook', name: 'Spellbook', icon: `${IMAGES}/mageSpellBook.png`, kind: 'tool',
    market: 'Magic', price: price(1, 3, 0),
  },
  // --- Food
  {
    id: 'apple', name: 'Apple', icon: `${IMAGES}/apple.png`, kind: 'consumable',
    effect: { heal: 25, mana: 0, speedMs: 0 }, use: { clip: 'use_eat' }, // Grant-tunable: modest first-pass values
    market: 'Food', price: price(1, 0, 0), hold: HOLD_DEFAULT,
  },
  {
    id: 'ale_flask', name: 'Ale Flask', icon: `${IMAGES}/dwarfAle.png`, kind: 'consumable',
    // 4-2: "make it 10hp and 5 second damage/strength boost"
    effect: { heal: 10, mana: 0, damageMult: 1.25, durationMs: 5000 }, use: { clip: 'use_drink' },
    market: 'Food', price: price(0, 0, 2), hold: HOLD_DEFAULT,
  },
  // --- Weaponry
  {
    id: 'iron_sword', name: 'Iron Sword', icon: `${IMAGES}/knightSword.png`, kind: 'weapon',
    market: 'Weaponry', price: price(4, 0, 2),
  },
  {
    id: 'twin_daggers', name: 'Twin Daggers', icon: `${IMAGES}/thiefDaggers.png`, kind: 'weapon',
    market: 'Weaponry', price: price(3, 3, 0),
  },
  {
    id: 'battle_axe', name: 'Battle Axe', icon: `${IMAGES}/dwarfAxe.png`, kind: 'weapon',
    market: 'Weaponry', price: price(0, 4, 2),
  },
  // --- Armor
  {
    id: 'chainmail_armor', name: 'Chainmail Armor', icon: `${IMAGES}/knightArmor.png`, kind: 'armor',
    market: 'Armor', price: price(4, 0, 1),
  },
  {
    id: 'leather_armor', name: 'Leather Armor', icon: `${IMAGES}/thiefCloak.png`, kind: 'armor',
    market: 'Armor', price: price(1, 0, 2),
  },
  {
    id: 'dwarf_armor', name: 'Dwarf Armor', icon: `${IMAGES}/dwarfArmor.png`, kind: 'armor',
    market: 'Armor', price: price(5, 1, 0),
  },
  {
    id: 'cloth_robes', name: 'Cloth Robes', icon: `${IMAGES}/mageRobes.png`, kind: 'armor',
    market: 'Armor', price: price(1, 2, 0),
  },
  // --- Tools
  {
    id: 'lockpicks', name: 'Lockpicks', icon: `${IMAGES}/thiefLockpick.png`, kind: 'tool',
    market: 'Tools', price: price(1, 2, 1), inhand: inhand('items_inhand_b10'),
  },
  {
    id: 'dwarf_pickaxe', name: 'Dwarf Pickaxe', icon: `${IMAGES}/dwarfPickaxe.png`, kind: 'tool',
    market: 'Tools', price: price(2, 0, 2), inhand: inhand('items_inhand_b10'),
  },
  // --- Not sold
  { id: 'wooden_shield', name: 'Wooden Shield', icon: `${IMAGES}/knightShield.png`, kind: 'armor' },
  {
    id: 'poison_vial', name: 'Poison Vial', icon: `${IMAGES}/thiefPoison.png`, kind: 'tool',
    inhand: inhand('items_inhand_b10'),
  },
  // --- ITEM-NEW-1 (Batch 11, Grant-approved and frozen). Numbers marked // tunable are placeholders.
  {
    id: 'nightfang_dagger', name: 'Nightfang Dagger', icon: `${IMAGES}/nightfang_dagger.png`, kind: 'weapon',
    classes: ['thief'],
    weapon: { damage: 9 }, // tunable (twin_daggers = 7)
    market: 'Weaponry', price: price(4, 3, 1), // tunable (twin_daggers = 3 ruby 3 sapphire)
    loot: pickup(LOOT_ATLAS_B11),
    hold: HOLD_DEFAULT,
    inhand: inhand('items_inhand_b11', [12 / 24, 16.7 / 24]),
  },
  {
    id: 'stonehollow_hammer', name: 'Stonehollow Hammer', icon: `${IMAGES}/stonehollow_hammer.png`, kind: 'weapon',
    classes: ['dwarf'],
    weapon: { damage: 26 }, // tunable (battle_axe = 22)
    market: 'Weaponry', price: price(2, 4, 2), // tunable (battle_axe = 4 sapphire 2 emerald)
    loot: pickup(LOOT_ATLAS_B11),
    hold: HOLD_DEFAULT,
    inhand: inhand('items_inhand_b11', [16 / 32, 24.49 / 32]),
  },
  {
    id: 'healing_charm', name: 'Healing Charm', icon: `${IMAGES}/healing_charm.png`, kind: 'consumable',
    effect: { heal: 45, mana: 0, speedMs: 0 }, // tunable (apple = 25, healing_potion = 70)
    use: { clip: 'use_charm', glow: 'use_charm_glow', effectFrame: 10 },
    market: 'Magic', price: price(1, 1, 0), // tunable
    loot: pickup(LOOT_ATLAS_B11),
    hold: HOLD_CHARM,
    inhand: inhand('items_inhand_b11', [12 / 24, 10.56 / 24]),
  },
  // Quest items: no use clip, never consumed or sold, not in random loot. A future quest grants them.
  {
    id: 'seranyas_tear', name: "Amulet of Seranya's Tear", icon: `${IMAGES}/seranyas_tear.png`, kind: 'quest',
    loot: pickup(LOOT_ATLAS_B11, false),
  },
  {
    id: 'ember_chalice', name: 'The Embered Flagon Chalice', icon: `${IMAGES}/ember_chalice.png`, kind: 'quest',
    loot: pickup(LOOT_ATLAS_B11, false),
  },
  // --- BOW-1 (Batch 12, Grant-approved and frozen). Any hero can hold and fire it.
  // BOW-SHOP-1: also sold in Weaponry. Still found in the cavern treasure chest and as a rare goblin archer drop (enemyDefs.js).
  {
    id: 'lightning_bow', name: 'Lightning Bow', icon: `${IMAGES}/lightning_bow.png`, kind: 'weapon',
    classes: null, // any class
    market: 'Weaponry', price: price(5, 3, 2), // tunable (BOW-SHOP-1): premium any-class ranged; nightfang 4/3/1, stonehollow 2/4/2, iron_sword 4/0/2
    // Space draws and fires. Numbers marked // tunable are placeholders: lightning spell = 15 dmg for
    // 10 mana at 600 px/s over 320 px, twin_daggers 7, iron_sword 12, battle_axe 22.
    weapon: { damage: 14, ranged: true }, // tunable
    // visualScale is the arrow sprite only. size is the hit box and does not follow the sprite.
    projectile: { speed: 520, maxDist: 360, size: 24, tipX: 76 / 96, visualScale: ARROW_VISUAL_SCALE }, // tunable; tipX = arrowhead on the 96 px cell
    loot: pickup(LOOT_ATLAS_B12, false),
    hold: HOLD_BOW,
    // use_bow is 10 frames at 12 fps (83/83/84 ms), release on frame 6 (500 ms in). weapon and glow are
    // overlay sheets (`<hero>_use_bow_weapon`, `<hero>_use_bow_glow`) drawn over the body.
    // BOW_HAND_SCALE grows those sheets and the in-hand cell around the grip.
    use: {
      clip: 'use_bow', weapon: 'use_bow_weapon', glow: 'use_bow_glow', effectFrame: 6,
      durations: [83, 83, 84, 83, 83, 84, 83, 83, 84, 83],
    },
    inhand: inhand('items_inhand_b12', [0.5, 0.5], BOW_HAND_SCALE),
  },
]

/** Live table. Built-ins first; registerItem adds more. Read it, do not mutate it directly. */
const ITEMS = Object.create(null)
const ORDER = []

function freezeDeep(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) return obj
  Object.freeze(obj)
  for (const v of Object.values(obj)) freezeDeep(v)
  return obj
}

/**
 * Fills defaults and derives flags. Throws on an unusable def.
 *
 * @param {object} def
 * @returns {object}
 */
function normalizeItem(def) {
  if (!def || typeof def.id !== 'string' || !def.id) throw new Error('registerItem: def.id is required')
  if (!def.name) throw new Error(`registerItem(${def.id}): name is required`)
  if (!ITEM_KINDS.includes(def.kind)) throw new Error(`registerItem(${def.id}): unknown kind "${def.kind}"`)
  const quest = def.kind === 'quest'
  if (quest && (def.use || def.effect || def.market || def.price)) {
    throw new Error(`registerItem(${def.id}): quest items have no use clip, effect or market row`)
  }
  if (def.market && !def.price) throw new Error(`registerItem(${def.id}): a market item needs a price`)
  return freezeDeep({
    id: def.id,
    name: def.name,
    icon: def.icon || `${IMAGES}/${def.id}.png`,
    kind: def.kind,
    effect: def.effect || null,
    price: def.price || null,
    market: def.market || null,
    loot: def.loot || NO_LOOT,
    hold: def.hold || null,
    use: def.use || null,
    inhand: def.inhand || null,
    classes: def.classes || null,
    weapon: def.weapon || null,
    projectile: def.projectile || null,
    sellable: quest ? false : def.sellable !== false,
  })
}

/**
 * Adds (or replaces) an item. This is the only call a new item needs for the
 * market, the catalog and the consume path to pick it up.
 *
 * @param {object} def
 * @returns {object} the frozen, normalised def
 */
export function registerItem(def) {
  const item = normalizeItem(def)
  if (!ITEMS[item.id]) ORDER.push(item.id)
  ITEMS[item.id] = item
  return item
}

/**
 * Removes an item (test cleanup).
 *
 * @param {string} id
 * @returns {boolean}
 */
export function unregisterItem(id) {
  if (!ITEMS[id]) return false
  delete ITEMS[id]
  ORDER.splice(ORDER.indexOf(id), 1)
  return true
}

for (const def of BUILTIN_ITEMS) registerItem(def)

/** @param {string} id @returns {object|undefined} */
export function getItem(id) {
  return typeof id === 'string' ? ITEMS[id] : undefined
}

/** @returns {object[]} every item, in registration order */
export function listItems() {
  return ORDER.map((id) => ITEMS[id])
}

/**
 * Catalog entry the inventory UI reads: `{ name, icon }` with the same
 * `/images/<id>.png` fallback unknown ids always had.
 *
 * @param {string} id
 * @returns {{ name: string, icon: string }}
 */
export function getItemDef(id) {
  const item = getItem(id)
  if (item) return item
  return { name: id, icon: `${IMAGES}/${id}.png` }
}

/** @returns {Array<{ id: string, category: string }>} market rows in listing order */
export function marketItems() {
  return listItems().filter((it) => it.market).map((it) => ({ id: it.id, category: it.market }))
}

const FREE = Object.freeze({ ruby: 0, sapphire: 0, emerald: 0 })

/** @param {string} id @returns {{ ruby: number, sapphire: number, emerald: number }} */
export function marketPrice(id) {
  return getItem(id)?.market ? getItem(id).price : FREE
}

/** @returns {Record<string, {ruby:number,sapphire:number,emerald:number}>} */
export function marketPrices() {
  const out = {}
  for (const it of listItems()) if (it.market) out[it.id] = it.price
  return out
}

/** @returns {Record<string, string>} id -> icon path */
export function itemIcons() {
  const out = {}
  for (const it of listItems()) out[it.id] = it.icon
  return out
}

/** @param {string} id @returns {boolean} */
export function isQuestItem(id) {
  return getItem(id)?.kind === 'quest'
}

/** @param {string} id @returns {boolean} false for quest items and anything flagged unsellable */
export function isSellable(id) {
  return Boolean(getItem(id)?.sellable)
}

/**
 * Consumable effect with its use clip merged in, in the shape balance.js has
 * always exported (`{ heal, mana, speedMs, clip }`). Null for non-consumables.
 *
 * @param {string} id
 * @returns {object|null}
 */
export function consumableEffect(id) {
  const item = getItem(id)
  if (!item || item.kind !== 'consumable' || !item.effect || !item.use) return null
  return Object.freeze({ ...item.effect, clip: item.use.clip })
}

/** @param {string} id @returns {boolean} */
export function isConsumable(id) {
  return consumableEffect(id) !== null
}

/** @returns {Record<string, object>} frozen snapshot of every consumable effect */
export function consumableEffects() {
  const out = {}
  for (const it of listItems()) {
    const effect = consumableEffect(it.id)
    if (effect) out[it.id] = effect
  }
  return Object.freeze(out)
}

/**
 * True when a hero may hold or wield the item.
 *
 * @param {string} id
 * @param {string} [classId]
 * @returns {boolean}
 */
export function itemUsableBy(id, classId) {
  const item = getItem(id)
  if (!item) return false
  return !item.classes || item.classes.includes(classId)
}

/**
 * Hold clip names for an item and hero.
 *
 * @param {string} id
 * @param {string} [classId]
 * @returns {{ idle: string, run: string }|null}
 */
export function holdClipsFor(id, classId) {
  const hold = getItem(id)?.hold
  if (!hold) return null
  return hold.byClass?.[classId] || { idle: hold.idle, run: hold.run }
}

/** @param {string} id @returns {string[]} ids with a world pickup sprite, in registry order */
export function lootPickupIds() {
  return listItems().filter((it) => it.loot.pickupAtlas).map((it) => it.id)
}

/** @param {string} id @returns {string|null} atlas key holding `loot_<id>_idle` */
export function lootAtlasFor(id) {
  return getItem(id)?.loot.pickupAtlas || null
}

/** @param {string} id @returns {boolean} may a random loot table roll it */
export function isRandomLoot(id) {
  return Boolean(getItem(id)?.loot.random)
}

/** @param {string} id @returns {{ atlas: string, origin: readonly number[], scale: number }} */
export function inhandFor(id) {
  return getItem(id)?.inhand || { atlas: 'items_inhand', origin: DEFAULT_INHAND_ORIGIN, scale: 1 }
}

/**
 * Extra draw scale for an in-hand sprite and its full-cell overlays. 1 for every
 * item except the lightning bow.
 *
 * @param {string} id
 * @returns {number}
 */
export function inhandScaleFor(id) {
  const scale = inhandFor(id).scale
  return typeof scale === 'number' && scale > 0 ? scale : 1
}

/** Every use clip name a registered item plays (for animation-complete matching). */
export function useClipNames() {
  const names = new Set()
  for (const it of listItems()) if (it.use?.clip) names.add(it.use.clip)
  return names
}

/**
 * Overlay sheet clip names drawn above the body while an item's use clip plays
 * (the lightning bow's `use_bow_weapon` and `use_bow_glow`).
 *
 * @param {string} id
 * @returns {{ weapon: string|null, glow: string|null }}
 */
export function useLayersFor(id) {
  const use = getItem(id)?.use
  return { weapon: use?.weapon || null, glow: use?.glow || null }
}

/**
 * Resting glow overlay sheet clip for a held item's idle pose, or null.
 *
 * @param {string} id
 * @returns {string|null}
 */
export function holdGlowFor(id) {
  return getItem(id)?.hold?.glowIdle || null
}

/** @param {string} id @returns {boolean} true for a weapon that fires a projectile (the lightning bow) */
export function isRangedWeapon(id) {
  const item = getItem(id)
  return Boolean(item?.kind === 'weapon' && item.weapon?.ranged && item.projectile)
}
