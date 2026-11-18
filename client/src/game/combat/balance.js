/**
 * Centralized combat balance constants and formula helpers for Heroes of Hollowvale.
 *
 * Each hero is good at one thing and ordinary at the rest. The staff is a
 * light poke; the mage's spells are the weapon. Armor in the pack does not
 * change these numbers. Only a raised shield lessens a blow.
 *
 * Sword, axe, and dagger clips are the same 7 frames at 11 fps (about 0.64s).
 * The staff bonk is 7 frames at 12 fps (about 0.58s). ATTACK_PLAYBACK is what
 * makes the axe chop slower and the dagger flurry faster. The swing time is
 * that on-screen length, and the next swing waits until the clip finishes.
 */

import { builtinTable, getEnemyDef } from './enemyDefs.js'

/**
 * Health for the body, not the weapon.
 * Knight is the toughest. The mage is the frailest. The dwarf is stout
 * without being the tank, and the thief sits between the mage and the dwarf.
 */
export const CLASS_HP = Object.freeze({
  knight: 120,
  mage: 70,
  thief: 85,
  dwarf: 95,
})

/**
 * Walk speed. The knight is the steady baseline the field guide measures
 * against. The dwarf is the slowest. The thief is the swiftest.
 */
export const CLASS_SPEED = Object.freeze({
  knight: 160,
  dwarf: 120,
  mage: 180,
  thief: 210,
})

/**
 * Authored attack-clip length in milliseconds.
 * Knight, dwarf, and thief: 7 frames at 11 fps. Mage staff: 7 frames at 12 fps.
 */
export const ATTACK_CLIP_MS = Object.freeze({
  knight: Math.round((7 / 11) * 1000),
  dwarf: Math.round((7 / 11) * 1000),
  thief: Math.round((7 / 11) * 1000),
  mage: Math.round((7 / 12) * 1000),
})

/**
 * Playback rate for attack and attack_2. 1 plays the clip as drawn.
 * The dwarf's chop is slowed to three quarters. The thief's flurry is
 * sped up by half. Knight and mage stay on the authored timing.
 */
export const ATTACK_PLAYBACK = Object.freeze({
  knight: 1,
  mage: 1,
  thief: 1.5,
  dwarf: 0.75,
})

/**
 * On-screen length of one swing. The clip plays at ATTACK_PLAYBACK, so this
 * is the authored length divided by that rate.
 *
 * @param {number} clipMs
 * @param {number} playback
 * @returns {number}
 */
function onScreenSwingMs(clipMs, playback) {
  return Math.round(clipMs / playback)
}

/**
 * One weapon each. Damage is one hit. Swing is how long that clip takes
 * on screen, which is also how soon the next swing can start.
 */
export const WEAPON_STATS = Object.freeze({
  iron_sword: Object.freeze({
    damage: 12,
    swingMs: onScreenSwingMs(ATTACK_CLIP_MS.knight, ATTACK_PLAYBACK.knight),
  }),
  apprentice_staff: Object.freeze({
    damage: 8,
    swingMs: onScreenSwingMs(ATTACK_CLIP_MS.mage, ATTACK_PLAYBACK.mage),
  }),
  twin_daggers: Object.freeze({
    damage: 7,
    swingMs: onScreenSwingMs(ATTACK_CLIP_MS.thief, ATTACK_PLAYBACK.thief),
  }),
  battle_axe: Object.freeze({
    damage: 22,
    swingMs: onScreenSwingMs(ATTACK_CLIP_MS.dwarf, ATTACK_PLAYBACK.dwarf),
  }),
})

/** Required weapon items per class */
export const WEAPON = Object.freeze({
  knight: 'iron_sword',
  mage: 'apprentice_staff',
  thief: 'twin_daggers',
  dwarf: 'battle_axe',
})

/** Base attack animation / cooldown durations in milliseconds */
export const ATTACK_MS = Object.freeze({
  knight: WEAPON_STATS.iron_sword.swingMs,
  mage: WEAPON_STATS.apprentice_staff.swingMs,
  thief: WEAPON_STATS.twin_daggers.swingMs,
  dwarf: WEAPON_STATS.battle_axe.swingMs,
})

/**
 * Phaser animation timeScale for a swing. Other clips stay at 1.
 *
 * @param {string} classId
 * @param {string} animName
 * @returns {number}
 */
export function attackAnimTimeScale(classId, animName) {
  if (animName !== 'attack' && animName !== 'attack_2') return 1
  const scale = ATTACK_PLAYBACK[classId]
  return typeof scale === 'number' && scale > 0 ? scale : 1
}

/** Base melee attack damage per class, read from the weapon that class wields */
export const MELEE_DMG = Object.freeze({
  knight: WEAPON_STATS.iron_sword.damage,
  mage: WEAPON_STATS.apprentice_staff.damage,
  thief: WEAPON_STATS.twin_daggers.damage,
  dwarf: WEAPON_STATS.battle_axe.damage,
})

/** Supported consumable items and effects */
export const CONSUMABLE_EFFECTS = Object.freeze({
  healing_potion: Object.freeze({ heal: 70, mana: 0, speedMs: 0, clip: 'use_drink' }),
  mana_potion: Object.freeze({ heal: 0, mana: 75, speedMs: 0, clip: 'use_drink' }),
  speed_potion: Object.freeze({ heal: 0, mana: 0, speedMs: 10000, clip: 'use_drink' }),
  apple: Object.freeze({ heal: 25, mana: 0, speedMs: 0, clip: 'use_eat' }), // Grant-tunable: modest first-pass values
  ale_flask: Object.freeze({
    heal: 10, // 4-2: "make it 10hp and 5 second damage/strength boost"
    mana: 0,
    damageMult: 1.25, // 4-2: "make it 10hp and 5 second damage/strength boost"
    durationMs: 5000, // 4-2: "make it 10hp and 5 second damage/strength boost"
    clip: 'use_drink',
  }),
})

export const CONSUMABLE = new Set(Object.keys(CONSUMABLE_EFFECTS))
CONSUMABLE.effects = CONSUMABLE_EFFECTS

/**
 * Applies one consumable onto a copy of player vitals.
 * A damage boost replaces damageMult and damageBoostUntil. A second drink
 * refreshes that timer; it does not multiply the multiplier again.
 * Heal and mana use the same clamp as HollowvaleScene._heal / _addMana.
 *
 * @param {object|null|undefined} effect
 * @param {{ hp?: number, hpMax?: number, mana?: number, manaMax?: number, speedBoostUntil?: number, damageMult?: number, damageBoostUntil?: number }} state
 * @param {number} now
 * @returns {{ hp: number, hpMax: number, mana: number, manaMax: number, speedBoostUntil: number, damageMult: number, damageBoostUntil: number }}
 */
export function applyConsumableEffects(effect, state, now) {
  const hpMax = state?.hpMax || 0
  const manaMax = state?.manaMax || 0
  let hp = state?.hp || 0
  let mana = state?.mana || 0
  let speedBoostUntil = state?.speedBoostUntil || 0
  let damageMult = state?.damageMult || 1
  let damageBoostUntil = state?.damageBoostUntil || 0
  if (effect) {
    if (effect.heal && hpMax > 0) hp = Math.min(hpMax, hp + effect.heal)
    if (effect.mana && manaMax > 0) mana = Math.min(manaMax, mana + effect.mana)
    if (effect.speedMs) speedBoostUntil = now + effect.speedMs
    if (effect.damageMult && effect.durationMs) {
      damageMult = effect.damageMult
      damageBoostUntil = now + effect.durationMs
    }
  }
  return { hp, hpMax, mana, manaMax, speedBoostUntil, damageMult, damageBoostUntil }
}

/**
 * Multiplies one outgoing damage amount by an active damage buff.
 * Active while now < damageBoostUntil. Math.round matches getEnemyDamage.
 *
 * @param {number} baseDamage
 * @param {number} now
 * @param {{ damageMult?: number, damageBoostUntil?: number } | null | undefined} buffState
 * @returns {number}
 */
export function scaleOutgoingDamage(baseDamage, now, buffState) {
  const mult = buffState?.damageMult
  const until = buffState?.damageBoostUntil || 0
  if (typeof mult !== 'number' || !(mult > 0) || mult === 1 || !(now < until)) return baseDamage
  return Math.round(baseDamage * mult)
}

/** Projectile speed, travel distance, and lingering duration */
export const FIREBALL_SPEED = 420
export const FIREBALL_DIST = 220
export const FIRE_LINGER_MS = 2000

/**
 * First-wave bodies. The numbers live in enemyDefs.js; these tables are
 * snapshots of the built-in defs. The get* helpers below read live defs.
 * Later waves grow from WAVE_SCALING.
 * A knight's sword is 12, so these health totals are whole swings:
 * goblin three, brute six, archer two.
 * The brute is the slow heavy hitter. The goblin is quicker and lighter.
 * The archer's jab is weak; the arrow below is the real hit.
 */
export const ENEMY_BASE_HP = builtinTable((def) => def.hp)

export const ENEMY_BASE_SPEED = builtinTable((def) => def.speed)

export const ENEMY_BASE_DAMAGE = builtinTable((def) => def.damage)

/** Wave scaling rates */
export const WAVE_SCALING = Object.freeze({
  hpPerWave: 0.12,
  speedPerWave: 0.05,
  damagePerWave: 0.05,
})

/** Enemy archer projectile parameters */
export const ARCHER_PROJECTILE = Object.freeze({ ...getEnemyDef('archer').projectile })

/** Base dungeon wave spawn positions: [enemyType, nx, ny] */
export const BASE_WAVE_SPAWNS = Object.freeze([
  ['goblin', 0.47, 0.28],
  ['goblin', 0.53, 0.31],
  ['brute', 0.5, 0.22],
  ['archer', 0.56, 0.26],
])

/**
 * Calculates max HP for an enemy type at a specific wave number.
 * Matches: Math.round(hpMax * (1 + 0.12 * Math.max(0, wave - 1)))
 *
 * @param {string} type - 'brute' | 'archer' | 'goblin'
 * @param {number} [wave=1] - 1-based wave index
 * @returns {number}
 */
export function getEnemyHp(type, wave = 1) {
  const base = (getEnemyDef(type) ?? getEnemyDef('goblin')).hp
  return Math.round(base * (1 + WAVE_SCALING.hpPerWave * Math.max(0, wave - 1)))
}

/**
 * Calculates movement speed for an enemy type at a specific wave number.
 * Matches: speed * (1 + 0.05 * Math.max(0, wave - 1)) * unit
 *
 * @param {string} type - 'brute' | 'archer' | 'goblin'
 * @param {number} [wave=1] - 1-based wave index
 * @param {number} [unit=1] - World scaling unit
 * @returns {number}
 */
export function getEnemySpeed(type, wave = 1, unit = 1) {
  const base = (getEnemyDef(type) ?? getEnemyDef('goblin')).speed
  return base * (1 + WAVE_SCALING.speedPerWave * Math.max(0, wave - 1)) * unit
}

/**
 * Calculates contact attack damage dealt by an enemy type at a specific wave number.
 * Matches: Math.round(base * (1 + 0.05 * Math.max(0, wave - 1)))
 *
 * @param {string} type - 'brute' | 'archer' | 'goblin'
 * @param {number} [wave=1] - 1-based wave index
 * @returns {number}
 */
export function getEnemyDamage(type, wave = 1) {
  const base = (getEnemyDef(type) ?? getEnemyDef('goblin')).damage
  return Math.round(base * (1 + WAVE_SCALING.damagePerWave * Math.max(0, wave - 1)))
}

// ---------------------------------------------------------------------------
// DRAGON (Boss encounter balance constants — untested default, tune in 4-2)
// ---------------------------------------------------------------------------
export const DRAGON_BASE_HP = 1200

export const DRAGON_DAMAGE = Object.freeze({
  claw: 20,
  tail: 25,
  firebreath: 30,
  breath: 25,
  volley: 15,
  gust: 10,
  dive: 35,
  meteor: 40,
  molten: 30,
})

export const DRAGON_PHASE_THRESHOLDS = Object.freeze({
  p1ToP2: 0.66,
  p2ToP3: 0.33,
})

export const DRAGON_LANDING_DURATION_MS = 3000
export const DRAGON_METEOR_MARKER_DELAY_MS = 700
/** Warning clip on `dragon_fx_extra` (7 frames @ 10 fps). Single marker key. */
export const METEOR_MARKER_KEY = 'dfx_meteor_marker'

