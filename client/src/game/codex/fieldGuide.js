/**
 * Field Guide catalog. Numbers are read from combat modules.
 * Short sentences are the only hand-written copy.
 * Item names and market prices match Game.jsx.
 */

import {
  CLASS_HP,
  CLASS_SPEED,
  ATTACK_MS,
  MELEE_DMG,
  WEAPON,
  CONSUMABLE_EFFECTS,
  ENEMY_BASE_HP,
  ENEMY_BASE_SPEED,
  ENEMY_BASE_DAMAGE,
  ARCHER_PROJECTILE,
  DRAGON_BASE_HP,
  DRAGON_DAMAGE,
  DRAGON_PHASE_THRESHOLDS,
  FIRE_LINGER_MS,
} from '../combat/balance.js'
import {
  FIREBALL_MANA_COST,
  MANA_REGEN_PER_SEC,
  MANA_MAX,
  LEECH_COOLDOWN_MS,
} from '../combat/spells.js'
import { BLOCK_DAMAGE_REDUCTION } from '../combat/block.js'
import { DODGE_COOLDOWN_MS } from '../combat/dodge.js'
import { LOOT_TABLES } from '../combat/death.js'
import { CRITTER_CONFIGS } from '../ai/critter.js'
import { CLASS_SPRITES, DEFAULT_ITEM_ICON, ENEMY_SPRITES, ITEM_ICONS } from '../../config/paths.js'

/** Mage staff swing. The staff is a light poke; spells do the real work. */
export const STAFF_SWING_DAMAGE = MELEE_DMG.mage || 12

/** spawnV2Spell lightning projectile damage. */
export const LIGHTNING_DAMAGE = 15

/** castFireball projectile damage. */
export const FIREBALL_DAMAGE = 10

/** castShield delayedCall duration. */
export const SHIELD_DURATION_MS = 6000

/** HollowvaleScene._tryVanish active window and cooldown. */
export const VANISH_MS = 1000
export const VANISH_COOLDOWN_MS = 10000

/** Life Leech drains 40% of current foe health (Projectile.js and HollowvaleScene). */
export const LEECH_FRACTION = 0.4

/** spawnPoisonVial impact damage and splash duration. */
export const POISON_HIT = 8
export const POISON_LINGER_MS = 2000

const KNIGHT_PACE = CLASS_SPEED.knight

const ITEM_NAMES = Object.freeze({
  iron_sword: 'Iron Sword',
  wooden_shield: 'Wooden Shield',
  chainmail_armor: 'Chainmail Armor',
  healing_potion: 'Healing Potion',
  apprentice_staff: 'Apprentice Staff',
  spellbook: 'Spellbook',
  cloth_robes: 'Cloth Robes',
  mana_potion: 'Mana Potion',
  twin_daggers: 'Twin Daggers',
  leather_armor: 'Leather Armor',
  lockpicks: 'Lockpicks',
  poison_vial: 'Poison Vial',
  battle_axe: 'Battle Axe',
  dwarf_armor: 'Dwarf Armor',
  dwarf_pickaxe: 'Dwarf Pickaxe',
  ale_flask: 'Ale Flask',
  speed_potion: 'Speed Potion',
  apple: 'Apple',
  ruby: 'Ruby',
  sapphire: 'Sapphire',
  emerald: 'Emerald',
})

/** Same prices as Game.jsx MARKET_PRICES. Absent ids are not sold. */
const MARKET_PRICES = Object.freeze({
  healing_potion: { ruby: 1, sapphire: 0, emerald: 0 },
  mana_potion: { ruby: 0, sapphire: 1, emerald: 0 },
  speed_potion: { ruby: 0, sapphire: 0, emerald: 2 },
  apprentice_staff: { ruby: 5, sapphire: 2, emerald: 0 },
  spellbook: { ruby: 1, sapphire: 3, emerald: 0 },
  apple: { ruby: 1, sapphire: 0, emerald: 0 },
  ale_flask: { ruby: 0, sapphire: 0, emerald: 2 },
  iron_sword: { ruby: 4, sapphire: 0, emerald: 2 },
  twin_daggers: { ruby: 3, sapphire: 3, emerald: 0 },
  battle_axe: { ruby: 0, sapphire: 4, emerald: 2 },
  chainmail_armor: { ruby: 4, sapphire: 0, emerald: 1 },
  leather_armor: { ruby: 1, sapphire: 0, emerald: 2 },
  dwarf_armor: { ruby: 5, sapphire: 1, emerald: 0 },
  cloth_robes: { ruby: 1, sapphire: 2, emerald: 0 },
  lockpicks: { ruby: 1, sapphire: 2, emerald: 1 },
  dwarf_pickaxe: { ruby: 2, sapphire: 0, emerald: 2 },
})

const CATEGORY_ORDER = ['Weapons', 'Armor', 'Magic', 'Potions', 'Food', 'Tools', 'Gems']

/**
 * @param {number} ms
 * @returns {string}
 */
export function secondsLabel(ms) {
  const seconds = ms / 1000
  if (Number.isInteger(seconds)) return `${seconds}s`
  const rounded = Math.round(seconds * 100) / 100
  return `${rounded}s`
}

/**
 * @param {number} hp
 * @returns {string}
 */
export function healthLine(hp) {
  let word = 'Formidable'
  if (hp >= 500) word = 'Boss'
  else if (hp < 20) word = 'Frail'
  else if (hp < 40) word = 'Light'
  else if (hp < 90) word = 'Sturdy'
  else if (hp < 100) word = 'Hardy'
  return `${word} (${hp} health)`
}

/**
 * Pace word measured against the knight's walk speed.
 * @param {number} speed
 * @returns {string}
 */
export function paceWord(speed) {
  const ratio = speed / KNIGHT_PACE
  if (ratio >= 1.2) return 'Swift'
  if (ratio >= 1.08) return 'Quick'
  if (ratio >= 0.92) return 'Steady'
  if (ratio >= 0.6) return 'Slower'
  return 'Much slower'
}

/**
 * @param {number} damage
 * @returns {string}
 */
export function damageLine(damage) {
  let word = 'Solid'
  if (damage <= 8) word = 'Light'
  else if (damage <= 12) word = 'Solid'
  else if (damage <= 20) word = 'Heavy'
  else word = 'Brutal'
  return `${word} hit (${damage})`
}

/**
 * @param {number} chance
 * @returns {'Often' | 'Sometimes' | 'Rarely'}
 */
export function chanceWord(chance) {
  if (chance >= 0.5) return 'Often'
  if (chance >= 0.25) return 'Sometimes'
  return 'Rarely'
}

function article(name) {
  return /^[aeiou]/i.test(name) ? 'an' : 'a'
}

function gemLabel(type, count) {
  const name = ITEM_NAMES[type] || type
  if (count === 1) return name
  if (name === 'Ruby') return `${count} Rubies`
  return `${count} ${name}s`
}

/**
 * @param {{ ruby?: number, sapphire?: number, emerald?: number } | undefined} price
 * @returns {string}
 */
export function priceLine(price) {
  if (!price) return 'Not sold at the market.'
  const parts = []
  if (price.ruby) parts.push(gemLabel('ruby', price.ruby))
  if (price.sapphire) parts.push(gemLabel('sapphire', price.sapphire))
  if (price.emerald) parts.push(gemLabel('emerald', price.emerald))
  if (parts.length === 0) return 'Not sold at the market.'
  return `Market price: ${parts.join(', ')}.`
}

function dropLine(enemyType) {
  const table = LOOT_TABLES[enemyType]
  if (!table) return null
  const groups = new Map()
  const add = (chance, name) => {
    const word = chanceWord(chance)
    const list = groups.get(word) || []
    list.push(name)
    groups.set(word, list)
  }
  for (const gem of table.gems || []) add(gem.chance, ITEM_NAMES[gem.type] || gem.type)
  for (const item of table.items || []) add(item.chance, ITEM_NAMES[item.id] || item.id)
  const sentences = []
  for (const word of ['Often', 'Sometimes', 'Rarely']) {
    const names = groups.get(word)
    if (!names?.length) continue
    const listed = names.map((name) => `${article(name)} ${name}`)
    const joined = listed.length === 1
      ? listed[0]
      : `${listed.slice(0, -1).join(', ')} or ${listed[listed.length - 1]}`
    sentences.push(`${word} ${joined}.`)
  }
  return sentences.join(' ')
}

function phaseWord(ratio) {
  if (Math.abs(ratio - 0.66) < 0.02) return 'two-thirds'
  if (Math.abs(ratio - 0.33) < 0.02) return 'one-third'
  return `${Math.round(ratio * 100)}%`
}

function stat(label, value) {
  return { label, value }
}

/** Same icon path as Game.jsx ITEMS and the inventory fallback. */
function itemIcon(id) {
  return ITEM_ICONS[id] || DEFAULT_ITEM_ICON(id)
}

/**
 * Phase-1 atlas, first frame `red_dragon_idle_left_0`.
 * Cropped in the guide so the rest of the sheet stays hidden.
 */
const DRAGON_IMAGE = Object.freeze({
  src: '/assets/boss/red_dragon/red_dragon_p1_a.png',
  frame: Object.freeze({ x: 0, y: 0, w: 388, h: 293 }),
  sheet: Object.freeze({ w: 4055, h: 4096 }),
})

/**
 * There is no single wildlife group image.
 * Red squirrel idle (`squirrel_red_idle_right_0`) stands in for the critters.
 */
const WILDLIFE_IMAGE = Object.freeze({
  src: '/assets/ambient/critters/critters.png',
  frame: Object.freeze({ x: 0, y: 256, w: 32, h: 32 }),
  sheet: Object.freeze({ w: 192, h: 1408 }),
})

function heroEntry(id, name, blurb, extraStats) {
  return {
    id,
    name,
    category: 'Heroes',
    blurb,
    image: { src: CLASS_SPRITES[id] },
    stats: [
      stat('Health', healthLine(CLASS_HP[id])),
      stat('Pace', paceWord(CLASS_SPEED[id])),
      ...extraStats,
    ],
  }
}

function buildHeroes() {
  const dodge = `Dodge with Shift (${secondsLabel(DODGE_COOLDOWN_MS)} cooldown). Attack with Space.`
  const dodgeOrC = `Dodge with Shift or C (${secondsLabel(DODGE_COOLDOWN_MS)} cooldown). Attack with Space.`
  const blockPct = Math.round(BLOCK_DAMAGE_REDUCTION * 100)
  const ale = CONSUMABLE_EFFECTS.ale_flask

  return [
    heroEntry(
      'knight',
      'Knight',
      'The toughest hero. A steady sword, and a shield for the blows that get through.',
      [
        stat('Strike', damageLine(MELEE_DMG.knight)),
        stat('Swing', `Every ${secondsLabel(ATTACK_MS.knight)}`),
        stat('Block', `Hold C. About ${blockPct}% of a hit from the front is turned aside.`),
        stat('Dodge', dodge),
        stat('Starts with', 'Iron Sword, Wooden Shield, Chainmail Armor, a Healing Potion, and 2 of each gem.'),
      ],
    ),
    heroEntry(
      'mage',
      'Mage',
      'The frailest hero. The staff is a light poke. The spellbook does the fighting.',
      [
        stat('Staff', damageLine(STAFF_SWING_DAMAGE)),
        stat('Mana', `${MANA_MAX} mana, recovering ${MANA_REGEN_PER_SEC} each second.`),
        stat('Spellbook', 'Hold K, press 1–4, then Space. Lightning Bolt, Blink, Life Leech, or Mana Shield.'),
        stat('Lightning', damageLine(LIGHTNING_DAMAGE)),
        stat('Life Leech', `Drains about ${Math.round(LEECH_FRACTION * 100)}% of a foe's health and heals you for the same. Then wait ${secondsLabel(LEECH_COOLDOWN_MS)}.`),
        stat('Fireball', `Costs ${FIREBALL_MANA_COST} mana, ${damageLine(FIREBALL_DAMAGE).toLowerCase()}, then burns for ${secondsLabel(FIRE_LINGER_MS)}.`),
        stat('Shield', `Mana Shield stays up for about ${secondsLabel(SHIELD_DURATION_MS)}. Blink steps you forward unless a wall is in the way.`),
        stat('Dodge', dodgeOrC),
        stat('Starts with', 'Apprentice Staff, Spellbook, Cloth Robes, 2 Mana Potions, and 2 of each gem.'),
      ],
    ),
    heroEntry(
      'thief',
      'Thief',
      'The swiftest hero, with the lightest strikes, a thrown vial, and a short vanish.',
      [
        stat('Strike', damageLine(MELEE_DMG.thief)),
        stat('Swing', `Every ${secondsLabel(ATTACK_MS.thief)}`),
        stat('Vanish', `Press J. Hidden for ${secondsLabel(VANISH_MS)}, then wait ${secondsLabel(VANISH_COOLDOWN_MS)}.`),
        stat('Poison vial', `${damageLine(POISON_HIT)} on the throw, then the splash lasts ${secondsLabel(POISON_LINGER_MS)}.`),
        stat('Dodge', dodgeOrC),
        stat('Starts with', 'Twin Daggers, Leather Armor, Lockpicks, a Poison Vial, and 2 of each gem.'),
      ],
    ),
    heroEntry(
      'dwarf',
      'Dwarf',
      'The hardest hitter. Slow to walk and slow to swing.',
      [
        stat('Strike', damageLine(MELEE_DMG.dwarf)),
        stat('Swing', `Every ${secondsLabel(ATTACK_MS.dwarf)}`),
        stat('Ale', `Restores ${ale.heal} health and makes hits about a quarter stronger for ${secondsLabel(ale.durationMs)}. Hold K to drink.`),
        stat('Pickaxe', 'Mines a cracked spot and can drop one gem.'),
        stat('Dodge', dodgeOrC),
        stat('Starts with', 'Battle Axe, Dwarf Armor, Dwarf Pickaxe, an Ale Flask, and 2 of each gem.'),
      ],
    ),
  ]
}

function buildEnemies() {
  const foes = [
    {
      id: 'goblin',
      name: 'Goblin',
      blurb: 'Closes in to strike, then falls back when badly hurt.',
      damage: ENEMY_BASE_DAMAGE.goblin,
    },
    {
      id: 'brute',
      name: 'Goblin Brute',
      blurb: 'Winds up a heavy swing you can see coming, then knocks you back.',
      damage: ENEMY_BASE_DAMAGE.brute,
    },
    {
      id: 'archer',
      name: 'Goblin Archer',
      blurb: 'Keeps its distance and shoots.',
      damage: ENEMY_BASE_DAMAGE.archer,
    },
  ]

  const cards = foes.map((foe) => {
    const stats = [
      stat('Health', healthLine(ENEMY_BASE_HP[foe.id])),
      stat('Pace', paceWord(ENEMY_BASE_SPEED[foe.id])),
      stat('Strike', damageLine(foe.damage)),
    ]
    if (foe.id === 'archer') {
      stats.push(stat('Arrow', damageLine(ARCHER_PROJECTILE.damage)))
    }
    const drops = dropLine(foe.id)
    if (drops) stats.push(stat('Drops', drops))
    return {
      id: foe.id,
      name: foe.name,
      category: 'Foes',
      blurb: foe.blurb,
      image: { src: ENEMY_SPRITES[foe.id] },
      stats,
    }
  })

  cards.push({
    id: 'dragon',
    name: 'Dragon',
    category: 'Boss',
    blurb: 'A three-phase boss. It lands after each volley.',
    image: DRAGON_IMAGE,
    stats: [
      stat('Health', healthLine(DRAGON_BASE_HP)),
      stat('Phases', `Changes around ${phaseWord(DRAGON_PHASE_THRESHOLDS.p1ToP2)} health, then around ${phaseWord(DRAGON_PHASE_THRESHOLDS.p2ToP3)}.`),
      stat('Melee', `Claw ${damageLine(DRAGON_DAMAGE.claw).toLowerCase()}, tail ${damageLine(DRAGON_DAMAGE.tail).toLowerCase()}, dive ${damageLine(DRAGON_DAMAGE.dive).toLowerCase()}.`),
      stat('Breath', `Fire breath ${damageLine(DRAGON_DAMAGE.firebreath).toLowerCase()}. A later breath is ${damageLine(DRAGON_DAMAGE.breath).toLowerCase()}, a volley ${damageLine(DRAGON_DAMAGE.volley).toLowerCase()}, and a gust ${damageLine(DRAGON_DAMAGE.gust).toLowerCase()}.`),
      stat('Meteor', `${damageLine(DRAGON_DAMAGE.meteor)}, the hardest single hit. Molten ground is ${damageLine(DRAGON_DAMAGE.molten).toLowerCase()}.`),
    ],
  })

  const critterNames = Object.keys(CRITTER_CONFIGS)
  cards.push({
    id: 'wildlife',
    name: 'Wildlife',
    category: 'Wildlife',
    blurb: 'Red and grey squirrels, sparrows, finches, and grey and brown rats scatter when you come close.',
    image: WILDLIFE_IMAGE,
    stats: [
      stat('Fight', 'They do not attack or drop loot.'),
      stat('Kinds', `${critterNames.length} kinds, all of them timid.`),
    ],
  })

  return cards
}

function itemStats(id) {
  const lines = []
  const effect = CONSUMABLE_EFFECTS[id]
  if (effect?.heal) lines.push(stat('Heal', `Restores ${effect.heal} health.`))
  if (effect?.mana) lines.push(stat('Mana', `Restores ${effect.mana} mana.`))
  if (effect?.speedMs) lines.push(stat('Effect', `You move faster for ${secondsLabel(effect.speedMs)}.`))
  if (effect?.damageMult && effect?.durationMs) {
    lines.push(stat('Strength', `Hits are about a quarter stronger for ${secondsLabel(effect.durationMs)}.`))
  }

  const wielder = Object.entries(WEAPON).find(([, weaponId]) => weaponId === id)
  if (wielder) {
    const [classId] = wielder
    const melee = MELEE_DMG[classId]
    if (typeof melee === 'number') {
      lines.push(stat('Strike', damageLine(melee)))
      lines.push(stat('Swing', `Every ${secondsLabel(ATTACK_MS[classId])}`))
    }
  }

  if (id === 'wooden_shield') {
    lines.push(stat('Block', `Hold C. About ${Math.round(BLOCK_DAMAGE_REDUCTION * 100)}% of a hit from the front is turned aside.`))
  }
  if (id === 'poison_vial') {
    lines.push(stat('Throw', `${damageLine(POISON_HIT)}. The splash lasts ${secondsLabel(POISON_LINGER_MS)}.`))
  }
  if (id === 'spellbook') {
    lines.push(stat('Cast', 'Hold K to choose a spell, then Space.'))
    lines.push(stat('Lightning', damageLine(LIGHTNING_DAMAGE)))
    lines.push(stat('Life Leech', `About ${Math.round(LEECH_FRACTION * 100)}% of a foe's health, then ${secondsLabel(LEECH_COOLDOWN_MS)} before you can cast it again.`))
  }
  if (id === 'ruby' || id === 'sapphire' || id === 'emerald') {
    lines.push(stat('Pocket', 'You begin with 2.'))
  }

  lines.push(stat('Price', priceLine(MARKET_PRICES[id])))
  return lines
}

const ITEM_COPY = [
  ['iron_sword', 'Weapons', 'The knight’s sword.'],
  ['twin_daggers', 'Weapons', 'The thief’s blades.'],
  ['battle_axe', 'Weapons', 'The dwarf’s axe.'],
  ['wooden_shield', 'Weapons', 'The knight’s off-hand shield. It is not a weapon of its own.'],
  ['poison_vial', 'Weapons', 'A vial the thief throws with Space while it is in hand.'],
  ['chainmail_armor', 'Armor', 'Worn by the knight. It has no separate defense rating.'],
  ['leather_armor', 'Armor', 'Worn by the thief. It has no separate defense rating.'],
  ['dwarf_armor', 'Armor', 'Worn by the dwarf. It has no separate defense rating.'],
  ['cloth_robes', 'Armor', 'Worn by the mage. They have no separate defense rating.'],
  ['apprentice_staff', 'Magic', 'The mage’s weapon. Spells are chosen from the spellbook.'],
  ['spellbook', 'Magic', 'The mage’s spell list: Lightning Bolt, Blink, Life Leech, and Mana Shield.'],
  ['healing_potion', 'Potions', 'A drink that restores health. Hold K to use it.'],
  ['mana_potion', 'Potions', 'A drink that restores mana. Hold K to use it.'],
  ['speed_potion', 'Potions', 'A drink that makes you move faster. Hold K to use it.'],
  ['apple', 'Food', 'A quick bite of health. Hold K to eat it.'],
  ['ale_flask', 'Food', 'A drink that heals a little and strengthens your hits. Hold K to use it.'],
  ['lockpicks', 'Tools', 'The thief’s tool for a locked chest.'],
  ['dwarf_pickaxe', 'Tools', 'The dwarf’s tool for a mineable spot. A break can drop one gem.'],
  ['ruby', 'Gems', 'Market currency, red.'],
  ['sapphire', 'Gems', 'Market currency, blue.'],
  ['emerald', 'Gems', 'Market currency, green.'],
]

function buildItems() {
  return ITEM_COPY.map(([id, category, blurb]) => ({
    id,
    name: ITEM_NAMES[id],
    category,
    blurb,
    image: { src: itemIcon(id) },
    stats: itemStats(id),
  })).sort((a, b) => {
    const cat = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    if (cat !== 0) return cat
    return a.name.localeCompare(b.name)
  })
}

/**
 * @returns {{
 *   enemyWaveNote: string,
 *   tabs: Array<{ id: string, label: string, note?: string, entries: Array<{ id: string, name: string, category: string, blurb: string, image: { src: string, frame?: { x: number, y: number, w: number, h: number }, sheet?: { w: number, h: number } }, stats: Array<{ label: string, value: string }> }> }>
 * }}
 */
export function buildFieldGuide() {
  const enemyWaveNote = 'These are first-encounter numbers. Each later wave adds health, and a little speed and damage. The dragon and the wildlife do not use that growth.'
  return {
    enemyWaveNote,
    tabs: [
      { id: 'heroes', label: 'Heroes', entries: buildHeroes() },
      { id: 'enemies', label: 'Enemies', note: enemyWaveNote, entries: buildEnemies() },
      { id: 'items', label: 'Items', entries: buildItems() },
    ],
  }
}

export const FIELD_GUIDE_ITEM_IDS = Object.freeze(Object.keys(ITEM_NAMES))
