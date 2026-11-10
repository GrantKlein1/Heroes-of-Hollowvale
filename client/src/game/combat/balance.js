/**
 * Centralized combat balance constants and formula helpers for Heroes of Hollowvale.
 *
 * Extracted from HollowvaleScene.js to preserve identical baseline values.
 */

/** Player movement speeds per class */
export const CLASS_SPEED = Object.freeze({
  knight: 160,
  dwarf: 160,
  mage: 180,
  thief: 200,
})

/** Base attack animation / cooldown durations in milliseconds */
export const ATTACK_MS = Object.freeze({
  mage: 650,
  thief: 300,
  knight: 450,
  dwarf: 600,
})

/** Base melee attack damage per class */
export const MELEE_DMG = Object.freeze({
  thief: 8,
  knight: 12,
  dwarf: 15,
})

/** Required weapon items per class */
export const WEAPON = Object.freeze({
  knight: 'iron_sword',
  mage: 'apprentice_staff',
  thief: 'twin_daggers',
  dwarf: 'battle_axe',
})

/** Supported consumable items */
export const CONSUMABLE = new Set(['healing_potion', 'mana_potion', 'speed_potion'])

/** Projectile speed, travel distance, and lingering duration */
export const FIREBALL_SPEED = 420
export const FIREBALL_DIST = 220
export const FIRE_LINGER_MS = 2000

/** Enemy baseline vital stats */
export const ENEMY_BASE_HP = Object.freeze({
  brute: 25,
  archer: 10,
  goblin: 15,
})

export const ENEMY_BASE_SPEED = Object.freeze({
  brute: 55,
  archer: 80,
  goblin: 70,
})

export const ENEMY_BASE_DAMAGE = Object.freeze({
  brute: 12,
  archer: 6,
  goblin: 8,
})

/** Wave scaling rates */
export const WAVE_SCALING = Object.freeze({
  hpPerWave: 0.12,
  speedPerWave: 0.05,
  damagePerWave: 0.05,
})

/** Enemy archer projectile parameters */
export const ARCHER_PROJECTILE = Object.freeze({
  speed: 300,
  dist: 400,
  size: 12,
  damage: 7,
})

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
  const base = ENEMY_BASE_HP[type] ?? 15
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
  const base = ENEMY_BASE_SPEED[type] ?? 70
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
  const base = ENEMY_BASE_DAMAGE[type] ?? 8
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
export const METEOR_MARKER_KEY = 'dfx_meteor_0'

