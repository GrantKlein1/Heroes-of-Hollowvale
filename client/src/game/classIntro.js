/**
 * Human-readable class select copy, derived from live combat numbers and the
 * starting slots in seedInventoryForClass (Game.jsx).
 *
 * Pace bands: under 150 slow, 150 steady, 180 quick, 200 swift.
 * Blow bands: under 12 light, 12 solid, 15 heavy.
 * Swing words follow ATTACK_MS: a longer cooldown is a slower swing.
 * Consumable sentences read CONSUMABLE_EFFECTS. They do not restate those numbers.
 */
import {
  ATTACK_MS,
  CLASS_HP,
  CLASS_SPEED,
  CONSUMABLE_EFFECTS,
  MELEE_DMG,
  WEAPON,
} from './combat/balance.js'
import { BLOCK_DAMAGE_REDUCTION } from './combat/block.js'

export const CLASS_ORDER = Object.freeze(['knight', 'mage', 'thief', 'dwarf'])

export const KIT_FOOTNOTE = 'What you wear and what you hold mark the calling. They do not add health or damage. Only a raised shield lessens a blow.'

/** Potion words are measured against a 100-point pool, the same scale the market drinks were written for. */
const FULL_HEALTH = 100
const FULL_MANA = 100

/** Same fallback hitSystem.js uses when a class has no MELEE_DMG entry. */
const MELEE_FALLBACK = 12

const NAMES = Object.freeze({
  knight: 'Knight',
  mage: 'Mage',
  thief: 'Thief',
  dwarf: 'Dwarf',
})

const ROLES = Object.freeze({
  knight: 'A sword in hand and a shield on the arm.',
  mage: 'A staff in hand and a spellbook in the pack.',
  thief: 'Daggers in hand and lockpicks in the pack.',
  dwarf: 'An axe in hand, with a pick and a flask on the belt.',
})

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
  ruby: 'Ruby',
  sapphire: 'Sapphire',
  emerald: 'Emerald',
})

const SLOT_LABELS = Object.freeze({
  hand: 'in hand',
  arm: 'on your arm',
  worn: 'worn',
  belt: 'on your belt',
  pack: 'in your pack',
})

/**
 * Slots mirror seedInventoryForClass:
 * hotbar[0] is in hand, later hotbar slots are on the belt,
 * armor.offhand is on the arm, armor.chest is worn, storage is in the pack.
 * Gems are the two-count stacks placed on the hotbar from the right.
 */
const SEED_KITS = Object.freeze({
  knight: Object.freeze([
    Object.freeze({ id: WEAPON.knight, count: 1, slot: 'hand' }),
    Object.freeze({ id: 'wooden_shield', count: 1, slot: 'arm' }),
    Object.freeze({ id: 'chainmail_armor', count: 1, slot: 'worn' }),
    Object.freeze({ id: 'healing_potion', count: 1, slot: 'belt' }),
  ]),
  mage: Object.freeze([
    Object.freeze({ id: WEAPON.mage, count: 1, slot: 'hand' }),
    Object.freeze({ id: 'cloth_robes', count: 1, slot: 'worn' }),
    Object.freeze({ id: 'spellbook', count: 1, slot: 'pack' }),
    Object.freeze({ id: 'mana_potion', count: 2, slot: 'belt' }),
  ]),
  thief: Object.freeze([
    Object.freeze({ id: WEAPON.thief, count: 1, slot: 'hand' }),
    Object.freeze({ id: 'leather_armor', count: 1, slot: 'worn' }),
    Object.freeze({ id: 'lockpicks', count: 1, slot: 'pack' }),
    Object.freeze({ id: 'poison_vial', count: 1, slot: 'belt' }),
  ]),
  dwarf: Object.freeze([
    Object.freeze({ id: WEAPON.dwarf, count: 1, slot: 'hand' }),
    Object.freeze({ id: 'dwarf_armor', count: 1, slot: 'worn' }),
    Object.freeze({ id: 'dwarf_pickaxe', count: 1, slot: 'belt' }),
    Object.freeze({ id: 'ale_flask', count: 1, slot: 'belt' }),
  ]),
})

const GEM_STACKS = Object.freeze([
  Object.freeze({ id: 'ruby', count: 2, slot: 'belt' }),
  Object.freeze({ id: 'sapphire', count: 2, slot: 'belt' }),
  Object.freeze({ id: 'emerald', count: 2, slot: 'belt' }),
])

const COUNT_WORDS = Object.freeze(['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'])

function meleeOf(id) {
  return MELEE_DMG[id] || MELEE_FALLBACK
}

function paceBand(speed) {
  if (speed >= 200) return 'swift'
  if (speed >= 180) return 'quick'
  if (speed >= 150) return 'steady'
  return 'slow'
}

function blowBand(damage) {
  if (damage >= 15) return 'heavy'
  if (damage >= 12) return 'solid'
  return 'light'
}

function portion(amount, full) {
  if (!(amount > 0) || !(full > 0)) return 'none'
  const ratio = amount / full
  if (ratio >= 0.5) return 'most'
  if (ratio >= 0.2) return 'some'
  return 'a little'
}

function durationWords(ms) {
  if (ms <= 6000) return 'a few seconds'
  if (ms <= 20000) return 'a short while'
  return 'a while'
}

function countWord(count) {
  return COUNT_WORDS[count] || String(count)
}

function capitalize(text) {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * @param {object|null|undefined} effect
 * @returns {string}
 */
export function consumableEffectPhrase(effect) {
  if (!effect) return ''
  const bits = []
  if (effect.heal > 0) {
    const share = portion(effect.heal, FULL_HEALTH)
    bits.push(share === 'a little' ? 'restores a little health' : `restores ${share} of your health`)
  }
  if (effect.mana > 0) {
    const share = portion(effect.mana, FULL_MANA)
    bits.push(share === 'a little' ? 'restores a little mana' : `restores ${share} of your mana`)
  }
  if (effect.damageMult > 1) {
    const span = effect.durationMs > 0 ? ` for ${durationWords(effect.durationMs)}` : ''
    bits.push(`makes your blows stronger${span}`)
  }
  if (effect.speedMs > 0) {
    bits.push(`quickens your pace for ${durationWords(effect.speedMs)}`)
  }
  if (bits.length === 0) return ''
  return `${capitalize(bits.join(' and '))}.`
}

function turnedAsideWord() {
  if (BLOCK_DAMAGE_REDUCTION >= 0.5) return 'most'
  if (BLOCK_DAMAGE_REDUCTION > 0) return 'part'
  return 'none'
}

function swingClause(id) {
  const ms = ATTACK_MS[id]
  const times = CLASS_ORDER.map((classId) => ATTACK_MS[classId])
  const fastest = Math.min(...times)
  const slowest = Math.max(...times)
  if (ms === fastest) return 'the quickest swing'
  if (ms === slowest) return 'the slowest swing'
  const mid = (fastest + slowest) / 2
  if (ms <= mid) return 'a measured swing'
  return 'a slower swing'
}

function healthPhrase(id) {
  const hp = CLASS_HP[id]
  const pools = CLASS_ORDER.map((classId) => CLASS_HP[classId])
  const highest = Math.max(...pools)
  const lowest = Math.min(...pools)
  if (hp === highest) return 'The toughest measure of health.'
  if (hp === lowest) return 'The lightest measure of health.'
  if (hp >= 90) return 'A stout measure of health.'
  return 'A lighter measure of health.'
}

function pacePhrase(id) {
  const speed = CLASS_SPEED[id]
  const band = paceBand(speed)
  const speeds = CLASS_ORDER.map((classId) => CLASS_SPEED[classId])
  const fastest = Math.max(...speeds)
  const slowest = Math.min(...speeds)
  if (band === 'swift' && speed === fastest) return 'The swiftest pace.'
  if (band === 'quick') return 'A quick pace.'
  if (band === 'slow' && speed === slowest) return 'The slowest pace.'
  if (band === 'slow') return 'A slow pace.'
  if (band === 'steady' && id !== 'knight' && speed === CLASS_SPEED.knight) {
    return 'A steady pace, the same as the knight.'
  }
  return 'A steady pace.'
}

function paceFill(id) {
  const fastest = Math.max(...CLASS_ORDER.map((classId) => CLASS_SPEED[classId]))
  if (!(fastest > 0)) return 0
  return CLASS_SPEED[id] / fastest
}

function blowPhrase(id) {
  const damage = meleeOf(id)
  const band = blowBand(damage)
  const swing = swingClause(id)
  const blows = CLASS_ORDER.map(meleeOf)
  const heaviest = Math.max(...blows)
  const lightest = Math.min(...blows)
  if (band === 'heavy' && damage === heaviest) return `The heaviest blows, with ${swing}.`
  if (band === 'light' && damage === lightest) return `The lightest blows, with ${swing}.`
  if (band === 'light') return `Light blows, with ${swing}.`
  return `Solid blows, with ${swing}.`
}

function blowFill(id) {
  const heaviest = Math.max(...CLASS_ORDER.map(meleeOf))
  if (!(heaviest > 0)) return 0
  return meleeOf(id) / heaviest
}

function guardPhrase(id) {
  if (id !== 'knight') return 'Nothing you wear or hold lessens a blow.'
  const share = turnedAsideWord()
  if (share === 'none') return 'A raised shield is on your arm.'
  return `A raised shield turns aside ${share} of a frontal blow.`
}

function guardFill(id) {
  if (id !== 'knight') return 0
  return BLOCK_DAMAGE_REDUCTION
}

function itemEffect(id) {
  const consumable = CONSUMABLE_EFFECTS[id]
  if (consumable) return consumableEffectPhrase(consumable)
  if (id === 'wooden_shield') {
    const share = turnedAsideWord()
    if (share === 'none') return 'Hold C to raise it.'
    return `Hold C to raise it. It turns aside ${share} of a frontal blow.`
  }
  if (id === 'iron_sword') return 'Space swings it.'
  if (id === 'chainmail_armor' || id === 'cloth_robes' || id === 'leather_armor' || id === 'dwarf_armor') {
    return 'Marks the calling. It does not add health or damage.'
  }
  if (id === 'apprentice_staff') return 'Space swings it while it is in hand.'
  if (id === 'spellbook') {
    return 'In hand, K chooses lightning, blink, life leech, or a mana shimmer, and Space casts.'
  }
  if (id === 'twin_daggers') return 'Space uses them.'
  if (id === 'lockpicks') return 'Hold E beside a locked chest.'
  if (id === 'poison_vial') return 'When held, a thrown burn.'
  if (id === 'battle_axe') return 'Space swings it.'
  if (id === 'dwarf_pickaxe') return 'Hold E beside rock to mine a gem.'
  if (id === 'ruby' || id === 'sapphire' || id === 'emerald') return 'For the market.'
  return ''
}

function describeItem(entry) {
  return {
    id: entry.id,
    name: ITEM_NAMES[entry.id] || entry.id,
    count: entry.count,
    slot: entry.slot,
    slotLabel: SLOT_LABELS[entry.slot] || entry.slot,
    effect: itemEffect(entry.id),
  }
}

function kitFor(id) {
  return [...SEED_KITS[id], ...GEM_STACKS].map(describeItem)
}

function purseLine(kit) {
  const countOf = (itemId) => kit.find((item) => item.id === itemId)?.count || 0
  const ruby = countOf('ruby')
  const sapphire = countOf('sapphire')
  const emerald = countOf('emerald')
  return `${ruby} rubies, ${sapphire} sapphires, and ${emerald} emeralds, for the market.`
}

function manaSentence(kit) {
  const count = kit.find((item) => item.id === 'mana_potion')?.count || 0
  const share = portion(CONSUMABLE_EFFECTS.mana_potion?.mana || 0, FULL_MANA)
  const amount = share === 'a little' ? 'a little of it' : `${share} of it`
  const noun = count === 1 ? 'mana potion restores' : 'mana potions restore'
  return `A full pool that refills on its own. ${countWord(count)} ${noun} ${amount}.`
}

function aleClause() {
  const phrase = consumableEffectPhrase(CONSUMABLE_EFFECTS.ale_flask)
  if (!phrase) return 'is on your belt'
  return phrase.charAt(0).toLowerCase() + phrase.slice(1, -1)
}

function fightText(id, kit) {
  if (id === 'knight') {
    const share = turnedAsideWord()
    const aside = share === 'none'
      ? 'Hold C to raise your shield. Shift rolls you clear. Space swings the sword in your hand.'
      : `Hold C to raise your shield. It turns aside ${share} of a blow from the front. Shift rolls you clear. Space swings the sword in your hand.`
    return aside
  }
  if (id === 'mage') {
    return `You begin with the staff in hand, so Space swings it. The spellbook is in your pack. With the book in hand, K chooses lightning, blink, life leech, or a mana shimmer, and Space casts it. Shift or C rolls you clear. ${manaSentence(kit)}`
  }
  if (id === 'thief') {
    return 'Space uses what is in your hand. Press J to vanish for a short while; foes miss you, then the trick must recover. The poison vial, when held, is a thrown burn. Hold E beside a locked chest to use the lockpicks. Shift or C rolls you clear.'
  }
  if (id === 'dwarf') {
    return `Space swings the axe. Hold E with the pickaxe beside rock to mine a gem. The ale flask ${aleClause()}. Shift or C rolls you clear.`
  }
  return ''
}

function buildClassIntro(id) {
  const kit = kitFor(id)
  return {
    id,
    name: NAMES[id],
    role: ROLES[id],
    health: healthPhrase(id),
    pace: { phrase: pacePhrase(id), fill: paceFill(id) },
    blows: { phrase: blowPhrase(id), fill: blowFill(id) },
    guard: { phrase: guardPhrase(id), fill: guardFill(id) },
    fight: fightText(id, kit),
    kit,
    footnote: KIT_FOOTNOTE,
    purse: purseLine(kit),
  }
}

export const CLASS_INTROS = Object.freeze(CLASS_ORDER.map(buildClassIntro))

export function introPlainText(intro) {
  const kitBits = intro.kit.flatMap((item) => [item.name, item.slotLabel, item.effect])
  return [
    intro.name,
    intro.role,
    intro.health,
    intro.pace.phrase,
    intro.blows.phrase,
    intro.guard.phrase,
    intro.fight,
    ...kitBits,
    intro.footnote,
    intro.purse,
  ].join('\n')
}
