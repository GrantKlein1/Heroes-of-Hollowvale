/**
 * One data table for every enemy type.
 *
 * To add an enemy, add ONE entry to BUILTIN_ENEMY_DEFS below. Everything that
 * used to be spread across Enemy.js (sheets, AI choice), balance.js (HP, speed,
 * damage), death.js (loot, label) and HollowvaleScene.js (spawn eligibility)
 * reads from here.
 *
 * This file is a leaf: it imports nothing, so balance.js, death.js, Enemy.js
 * and the scene can all import it without an import cycle. The AI is named by
 * a string (see ENEMY_AI_CLASSES in actors/Enemy.js), not imported here.
 *
 * Def shape:
 * {
 *   id:          'goblin'                 // table key, also Enemy.enemyType
 *   aliases:     ['goblin_brute']         // optional: other type strings that use these sheets and AI
 *   label:       'Goblin'                 // display name (kill feed, death notice)
 *   ai:          'GoblinAI'               // key into ENEMY_AI_CLASSES ('GoblinAI' | 'BruteAI' | 'ArcherAI' | 'WolfAI' | 'CultistAI'), or an AI class itself
 *   armored:     false                    // heavy tuning: slower telegraph, longer cooldown, big knockback
 *   hp:          36                       // wave-1 max HP
 *   speed:       100                      // wave-1 walk speed
 *   damage:      10                       // wave-1 contact / melee damage
 *   projectile:  { speed, dist, size, damage }   // optional, ranged enemies only (ArcherAI, CultistAI)
 *   sheets:      { assetId?, defaultSheet, walkSheet, hurtSheet, attackSheet,
 *                  telegraphSheet?, deathSheet, spawnSheet?, alertSheet?, initialFrame }
 *                (no telegraphSheet: the attack clip's first frames are the wind-up)
 *   loot:        { gems: [{ type, chance, count }], items: [{ id, chance, count }] }
 *   spawnWeight: 6                        // relative weight for weighted spawn tables
 * }
 */

const BUILTIN_ENEMY_DEFS = [
  {
    id: 'goblin',
    label: 'Goblin',
    ai: 'GoblinAI',
    armored: false,
    hp: 36,
    speed: 100,
    damage: 10,
    sheets: {
      defaultSheet: 'goblin',
      walkSheet: 'goblin',
      hurtSheet: 'goblin',
      attackSheet: 'goblin',
      telegraphSheet: 'goblin_telegraph',
      deathSheet: 'goblin_death',
      spawnSheet: 'goblin_spawn',
      alertSheet: 'goblin_alert',
      initialFrame: 'goblin_idle_down',
    },
    loot: {
      gems: [
        { type: 'ruby', chance: 0.35, count: 1 },
        { type: 'emerald', chance: 0.15, count: 1 },
      ],
      items: [
        { id: 'speed_potion', chance: 0.15, count: 1 },
        { id: 'healing_charm', chance: 0.06, count: 1 }, // tunable (ITEM-NEW-1)
      ],
    },
    spawnWeight: 6,
  },
  {
    id: 'brute',
    aliases: ['goblin_brute'],
    label: 'Goblin Brute',
    ai: 'BruteAI',
    armored: true,
    hp: 72,
    speed: 50,
    damage: 16,
    sheets: {
      assetId: 'goblin_brute',
      defaultSheet: 'goblin_brute',
      walkSheet: 'goblin_brute',
      hurtSheet: 'goblin_brute',
      attackSheet: 'goblin_brute',
      telegraphSheet: 'goblin_brute_telegraph',
      deathSheet: 'goblin_brute_death',
      spawnSheet: 'goblin_brute_spawn',
      alertSheet: 'goblin_brute_alert',
      initialFrame: 'goblin_brute_idle_down',
    },
    loot: {
      gems: [
        { type: 'ruby', chance: 0.6, count: 1 },
        { type: 'sapphire', chance: 0.5, count: 1 },
      ],
      items: [
        { id: 'healing_potion', chance: 0.25, count: 1 },
        { id: 'stonehollow_hammer', chance: 0.04, count: 1 }, // tunable (ITEM-NEW-1)
      ],
    },
    spawnWeight: 1,
  },
  {
    id: 'archer',
    aliases: ['goblin_archer'],
    label: 'Goblin Archer',
    ai: 'ArcherAI',
    armored: false,
    hp: 24,
    speed: 80,
    damage: 6,
    projectile: { speed: 300, dist: 400, size: 12, damage: 10 },
    sheets: {
      assetId: 'goblin_archer',
      defaultSheet: 'goblin_archer',
      walkSheet: 'goblin_archer',
      hurtSheet: 'goblin_archer',
      attackSheet: 'goblin_archer',
      deathSheet: 'goblin_archer_death',
      spawnSheet: 'goblin_archer_spawn',
      alertSheet: 'goblin_archer_alert',
      initialFrame: 'goblin_archer_idle_down',
    },
    loot: {
      gems: [{ type: 'sapphire', chance: 0.3, count: 1 }],
      items: [
        { id: 'mana_potion', chance: 0.25, count: 1 },
        { id: 'nightfang_dagger', chance: 0.04, count: 1 }, // tunable (ITEM-NEW-1)
        { id: 'lightning_bow', chance: 0.05, count: 1 }, // tunable (BOW-1): rare, an archer's bow
      ],
    },
    spawnWeight: 2,
  },
  // --- Batch 11 enemies (lore: newLore.txt Part X). ---
  // Stats, loot and spawn weights below are placeholders picked to sit next to the
  // goblin family. Grant-tunable: change the numbers here and nowhere else.
  {
    id: 'shadowfang_wolf',
    label: 'Shadowfang Wolf',
    ai: 'WolfAI',
    armored: false,
    hp: 30,
    speed: 130,
    damage: 7,
    sheets: {
      assetId: 'shadowfang_wolf',
      defaultSheet: 'shadowfang_wolf',
      walkSheet: 'shadowfang_wolf',
      hurtSheet: 'shadowfang_wolf',
      attackSheet: 'shadowfang_wolf',
      deathSheet: 'shadowfang_wolf_death',
      initialFrame: 'shadowfang_wolf_idle_down',
    },
    loot: {
      gems: [{ type: 'emerald', chance: 0.2, count: 1 }],
      items: [{ id: 'speed_potion', chance: 0.2, count: 1 }],
    },
    spawnWeight: 2,
  },
  {
    id: 'ashen_cultist',
    label: 'Ashen Cultist',
    ai: 'CultistAI',
    armored: false,
    hp: 28,
    speed: 70,
    damage: 6,
    projectile: { speed: 220, dist: 420, size: 14, damage: 10 },
    // First opaque row in the 96px cell (the pointed hood). The health bar sits just above it.
    hpBarVisibleTop: 20,
    sheets: {
      assetId: 'ashen_cultist',
      defaultSheet: 'ashen_cultist',
      walkSheet: 'ashen_cultist',
      hurtSheet: 'ashen_cultist',
      attackSheet: 'ashen_cultist',
      deathSheet: 'ashen_cultist_death',
      initialFrame: 'ashen_cultist_idle_down',
    },
    loot: {
      gems: [
        { type: 'ruby', chance: 0.3, count: 1 },
        { type: 'sapphire', chance: 0.2, count: 1 },
      ],
      items: [{ id: 'mana_potion', chance: 0.3, count: 1 }],
    },
    spawnWeight: 1,
  },
  {
    id: 'ashen_revenant',
    label: 'Ashen Revenant',
    ai: 'BruteAI',
    armored: true,
    hp: 90,
    speed: 40,
    damage: 20,
    // First opaque row in the 96px cell (the flame crown). The health bar sits just above it.
    hpBarVisibleTop: 10,
    sheets: {
      assetId: 'ashen_revenant',
      defaultSheet: 'ashen_revenant',
      walkSheet: 'ashen_revenant',
      hurtSheet: 'ashen_revenant',
      attackSheet: 'ashen_revenant',
      deathSheet: 'ashen_revenant_death',
      initialFrame: 'ashen_revenant_idle_down',
    },
    loot: {
      gems: [
        { type: 'ruby', chance: 0.5, count: 1 },
        { type: 'sapphire', chance: 0.4, count: 1 },
      ],
      items: [{ id: 'healing_potion', chance: 0.3, count: 1 }],
    },
    spawnWeight: 1,
  },
]

/** Live table. Built-ins first; registerEnemyDef adds more. Read it, do not mutate it directly. */
export const ENEMY_DEFS = {}
const ALIAS_TO_ID = {}

/**
 * Adds (or replaces) one enemy def. Aliases resolve to the same def for
 * sheets, AI and spawning.
 *
 * @param {object} def
 * @returns {object} the def
 */
export function registerEnemyDef(def) {
  if (!def || typeof def.id !== 'string' || !def.id) throw new Error('enemy def needs an id')
  ENEMY_DEFS[def.id] = def
  for (const alias of def.aliases || []) ALIAS_TO_ID[alias] = def.id
  return def
}

/**
 * Removes one def and its aliases. For tests that register a fake enemy.
 *
 * @param {string} id
 */
export function unregisterEnemyDef(id) {
  const def = ENEMY_DEFS[id]
  if (!def) return
  for (const alias of def.aliases || []) {
    if (ALIAS_TO_ID[alias] === id) delete ALIAS_TO_ID[alias]
  }
  delete ENEMY_DEFS[id]
}

for (const def of BUILTIN_ENEMY_DEFS) registerEnemyDef(def)

/**
 * Exact-key lookup. No alias, no fallback. Stats, loot and labels use this so
 * an unknown or alias type behaves as it always did.
 *
 * @param {string} type
 * @returns {object|undefined}
 */
export function getEnemyDef(type) {
  return Object.prototype.hasOwnProperty.call(ENEMY_DEFS, type) ? ENEMY_DEFS[type] : undefined
}

/**
 * Alias-aware lookup. 'goblin_brute' resolves to the brute def.
 *
 * @param {string} type
 * @returns {object|undefined}
 */
export function resolveEnemyDef(type) {
  return getEnemyDef(type) || getEnemyDef(ALIAS_TO_ID[type])
}

/**
 * True when the type is spawned as an Enemy actor (a def exists).
 *
 * @param {string} type
 * @returns {boolean}
 */
export function isEnemyType(type) {
  return !!resolveEnemyDef(type)
}

/**
 * Picks one enemy id by weight.
 *
 * With no `weights`, every def's own spawnWeight is used. With `weights`
 * ({ [defId]: weight }), only those ids are rolled, in the order given, and
 * ids with no def or a weight of 0 are skipped.
 *
 * @param {() => number} rand - returns [0, 1)
 * @param {Record<string, number>} [weights]
 * @returns {string|null}
 */
export function pickEnemyTypeByWeight(rand, weights) {
  const weightOf = (id) => (weights ? weights[id] : ENEMY_DEFS[id].spawnWeight) || 0
  const pool = weights ? Object.keys(weights).filter((id) => ENEMY_DEFS[id]) : Object.keys(ENEMY_DEFS)
  const ids = pool.filter((id) => weightOf(id) > 0)
  const total = ids.reduce((sum, id) => sum + weightOf(id), 0)
  if (!(total > 0)) return null
  let roll = rand() * total
  for (const id of ids) {
    roll -= weightOf(id)
    if (roll < 0) return id
  }
  return ids[ids.length - 1]
}

/**
 * Snapshot of the built-in defs as plain tables, for the old exported
 * constants (ENEMY_BASE_HP and friends). Only built-ins; the functions that
 * read live defs also see registered ones.
 *
 * @param {(def: object) => any} pick
 * @returns {Readonly<Record<string, any>>}
 */
export function builtinTable(pick) {
  const out = {}
  for (const def of BUILTIN_ENEMY_DEFS) out[def.id] = pick(def)
  return Object.freeze(out)
}
