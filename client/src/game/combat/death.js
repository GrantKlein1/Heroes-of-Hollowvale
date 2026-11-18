/**
 * death.js — Death, respawn, and seeded loot mechanics for Heroes of Hollowvale.
 * Package 1b-4: Lane D Enemies.
 *
 * Implements:
 * - Deterministic seeded enemy loot tables (same seed -> same loot).
 * - Full enemy death animation playback before drop and removal.
 * - Player death animation -> GameEvents.DIED -> respawn at area entrance with full HP/mana (no penalty).
 */

import { getRng, random } from '../rng.js'
import { eventBus, GameEvents } from '../../lib/eventBus.js'
import { ACTOR_STATES } from '../actors/stateMachine.js'
import { buildAnimKey } from '../assets/animKeys.js'
import { ENEMY_DEFS, builtinTable, getEnemyDef } from './enemyDefs.js'
import { lootPickupIds, lootAtlasFor, isQuestItem } from '../items/registry.js'

/**
 * World-drop atlas imported in AS-3. Idle cells use the sheet anchor; collect is centred.
 * The Batch 11 pickups live on a second atlas (`loot_pickups_b11`); the item registry
 * names the atlas per item and `loot_collect` is always read from this one.
 */
export const LOOT_PICKUP_ATLAS = 'loot_pickups'

/** 32×32 collect area centred on the drop. */
export const LOOT_COLLECT_SIZE = 32

/** Horizontal gap so neighbouring 32 px collect boxes do not overlap. */
export const LOOT_PICKUP_SPACING = 36

/**
 * Ids that have a `loot_{id}_idle` clip on a loot atlas, read from the item
 * registry (items/registry.js). Anything else keeps the pre-Batch-7 behaviour:
 * grant immediately, no world sprite. Snapshot of the built-ins; `lootHasSprite`
 * asks the registry live.
 */
export const LOOT_PICKUP_IDS = Object.freeze(lootPickupIds())

/**
 * @param {string} id
 * @returns {boolean}
 */
export function lootHasSprite(id) {
  return lootAtlasFor(id) !== null
}

/**
 * Every item id the seeded tables can roll.
 * @returns {string[]}
 */
export function seededLootIds() {
  const ids = []
  for (const def of Object.values(ENEMY_DEFS)) {
    const table = def.loot || {}
    for (const gem of table.gems || []) {
      if (gem?.type && !ids.includes(gem.type)) ids.push(gem.type)
    }
    for (const item of table.items || []) {
      if (item?.id && !ids.includes(item.id)) ids.push(item.id)
    }
  }
  return ids
}

/**
 * Seeded-table ids with no loot_pickups clip. These keep the old grant.
 * @returns {string[]}
 */
export function seededLootIdsWithoutSprites() {
  return seededLootIds().filter((id) => !lootHasSprite(id))
}

/**
 * @param {string} id
 * @returns {string}
 */
export function lootIdleAnimKey(id) {
  return buildAnimKey(lootAtlasFor(id) || LOOT_PICKUP_ATLAS, `loot_${id}_idle`, 'down')
}

/**
 * @returns {string}
 */
export function lootCollectAnimKey() {
  return buildAnimKey(LOOT_PICKUP_ATLAS, 'loot_collect', 'down')
}

/**
 * Flattens a loot roll into one drop per unit.
 *
 * @param {{ ruby?: number, sapphire?: number, emerald?: number }} gems
 * @param {Array<{ id: string, count?: number }>} items
 * @returns {Array<{ id: string, kind: 'gem'|'item' }>}
 */
export function listLootDrops(gems, items) {
  const drops = []
  for (const id of ['ruby', 'sapphire', 'emerald']) {
    const count = Number(gems?.[id]) || 0
    for (let i = 0; i < count; i++) drops.push({ id, kind: 'gem' })
  }
  for (const item of items || []) {
    if (!item?.id) continue
    const count = Number(item.count) || 1
    for (let i = 0; i < count; i++) drops.push({ id: item.id, kind: 'item' })
  }
  return drops
}

/**
 * Loot drop probability definitions per enemy archetype.
 * Snapshot of the built-in defs in enemyDefs.js; drops read live defs.
 */
export const LOOT_TABLES = builtinTable((def) => def.loot)

/**
 * Maps enemy archetype identifier to user-facing display label.
 *
 * @param {string} type
 * @returns {string}
 */
export function enemyLabel(type) {
  return getEnemyDef(type)?.label || type || 'Unknown'
}

/**
 * Generates deterministic loot based on the active seeded PRNG.
 *
 * @param {string} enemyType - 'goblin' | 'brute' | 'archer'
 * @param {import('../rng.js').Rng|{next: () => number}} [rng] - Optional PRNG instance
 * @returns {{ gems: { ruby: number, sapphire: number, emerald: number }, items: Array<{ id: string, count: number }> }}
 */
export function generateSeededLoot(enemyType, rng) {
  const nextVal = rng && typeof rng.next === 'function'
    ? () => rng.next()
    : (typeof rng === 'function' ? rng : random)

  const gems = { ruby: 0, sapphire: 0, emerald: 0 }
  const items = []

  const table = getEnemyDef(enemyType)?.loot
  if (!table) {
    return { gems, items }
  }

  for (const gemDef of table.gems) {
    if (nextVal() < gemDef.chance) {
      gems[gemDef.type] = (gems[gemDef.type] || 0) + (gemDef.count || 1)
    }
  }

  for (const itemDef of table.items) {
    // Quest items are granted by a quest, never rolled. The roll above still
    // consumes its random number so the seeded sequence does not shift.
    if (nextVal() < itemDef.chance && !isQuestItem(itemDef.id)) {
      items.push({ id: itemDef.id, count: itemDef.count || 1 })
    }
  }

  return { gems, items }
}

/**
 * Origin for one clip, read from that anim's atlas meta.
 * Sheet anchor is the idle fallback (0.5, 0.875). Collect fallback is centre.
 *
 * @param {object} scene
 * @param {string} animName - meta.anims key, e.g. `loot_ruby_idle` or `loot_collect`
 * @param {{ x: number, y: number }} fallback
 * @param {string} [atlas] - atlas holding the clip (default the main loot atlas)
 * @returns {{ x: number, y: number }}
 */
export function lootAnimOrigin(scene, animName, fallback, atlas = LOOT_PICKUP_ATLAS) {
  const texture = scene?.textures?.get?.(atlas)
  const animOrigin = texture?.customData?.meta?.anims?.[animName]?.origin
  if (typeof animOrigin?.x === 'number' && typeof animOrigin?.y === 'number') {
    return { x: animOrigin.x, y: animOrigin.y }
  }
  const sheetOrigin = texture?.customData?.meta?.origin
  if (animName !== 'loot_collect' && typeof sheetOrigin?.x === 'number' && typeof sheetOrigin?.y === 'number') {
    return { x: sheetOrigin.x, y: sheetOrigin.y }
  }
  const anchor = scene?.assetRegistry?.getAnchor?.(atlas)
  if (animName !== 'loot_collect' && typeof anchor?.x === 'number' && typeof anchor?.y === 'number') {
    return { x: anchor.x, y: anchor.y }
  }
  return fallback
}

/**
 * @param {{ id: string, kind: 'gem'|'item' }} drop
 */
function grantLootDrop(drop) {
  if (drop.kind === 'gem') {
    const gems = { ruby: 0, sapphire: 0, emerald: 0 }
    gems[drop.id] = 1
    eventBus.emit(GameEvents.LOOT, { gems, items: [] })
    return
  }
  eventBus.emit(GameEvents.LOOT, {
    gems: { ruby: 0, sapphire: 0, emerald: 0 },
    items: [{ id: drop.id, count: 1 }],
  })
}

/**
 * @param {object} scene
 * @param {import('phaser').GameObjects.Sprite} sprite
 * @param {{ id: string, kind: 'gem'|'item' }} drop
 */
function bindLootPickup(scene, sprite, drop) {
  const half = LOOT_COLLECT_SIZE / 2
  const onUpdate = () => {
    if (!sprite || sprite.lootCollected || sprite.destroyed) return
    const player = scene?.player
    if (!player || scene.dead) return
    const dx = Math.abs((player.x ?? 0) - sprite.x)
    const dy = Math.abs((player.y ?? 0) - sprite.y)
    if (dx > half || dy > half) return

    sprite.lootCollected = true
    grantLootDrop(drop)

    const collectOrigin = lootAnimOrigin(scene, 'loot_collect', { x: 0.5, y: 0.5 })
    scene._lastLootCollect = {
      id: drop.id,
      anim: lootCollectAnimKey(),
      originX: collectOrigin.x,
      originY: collectOrigin.y,
    }
    if (typeof sprite.setOrigin === 'function') {
      sprite.setOrigin(collectOrigin.x, collectOrigin.y)
    }
    const collectKey = lootCollectAnimKey()
    const finish = () => {
      if (typeof scene?.events?.off === 'function') {
        scene.events.off('update', onUpdate)
      }
      if (Array.isArray(scene?.lootPickups)) {
        const idx = scene.lootPickups.indexOf(sprite)
        if (idx >= 0) scene.lootPickups.splice(idx, 1)
      }
      if (typeof sprite.destroy === 'function') sprite.destroy()
    }

    const canPlay = typeof sprite.anims?.play === 'function'
      && (typeof scene?.anims?.exists !== 'function' || scene.anims.exists(collectKey))
    if (canPlay) {
      sprite.anims.play(collectKey, false)
      if (typeof sprite.once === 'function') {
        sprite.once('animationcomplete', finish)
      } else if (typeof scene?.time?.delayedCall === 'function') {
        scene.time.delayedCall(312, finish)
      } else {
        finish()
      }
    } else {
      finish()
    }
  }

  if (typeof scene?.events?.on === 'function') {
    scene.events.on('update', onUpdate)
  }
  sprite._lootUnbind = () => {
    if (typeof scene?.events?.off === 'function') scene.events.off('update', onUpdate)
  }
}

/**
 * @param {object} scene
 */
function ensureLootGroup(scene) {
  const registry = scene?.assetRegistry
  if (!registry) return
  if (typeof registry.isGroupLoaded === 'function' && !registry.isGroupLoaded('loot')) {
    registry.loadGroup?.('loot')
  } else if (typeof registry.isGroupLoaded !== 'function') {
    registry.loadGroup?.('loot')
  }
  registry.createAnims?.('loot')
}

/**
 * Places world pickups for ids that have a loot_pickups clip.
 * Ids without a clip are granted immediately (the pre-Batch-7 path).
 * Scenes that cannot spawn a sprite grant the whole roll immediately.
 *
 * @param {object} scene
 * @param {number} x
 * @param {number} y
 * @param {{ ruby?: number, sapphire?: number, emerald?: number }} gems
 * @param {Array<{ id: string, count?: number }>} items
 * @returns {{ pickups: object[], legacyIds: string[] }}
 */
export function presentLootDrop(scene, x, y, gems, items) {
  const drops = listLootDrops(gems, items)
  if (drops.length === 0) return { pickups: [], legacyIds: [] }

  const canSprite = typeof scene?.add?.sprite === 'function'
  if (!canSprite) {
    eventBus.emit(GameEvents.LOOT, { gems, items })
    return { pickups: [], legacyIds: drops.map((drop) => drop.id) }
  }

  const legacy = drops.filter((drop) => !lootHasSprite(drop.id))
  const mapped = drops.filter((drop) => lootHasSprite(drop.id))
  if (legacy.length > 0) {
    const legacyGems = { ruby: 0, sapphire: 0, emerald: 0 }
    const legacyItems = []
    for (const drop of legacy) {
      if (drop.kind === 'gem') legacyGems[drop.id] = (legacyGems[drop.id] || 0) + 1
      else legacyItems.push({ id: drop.id, count: 1 })
    }
    eventBus.emit(GameEvents.LOOT, { gems: legacyGems, items: legacyItems })
  }

  if (mapped.length === 0) {
    return { pickups: [], legacyIds: legacy.map((drop) => drop.id) }
  }

  ensureLootGroup(scene)
  if (!Array.isArray(scene.lootPickups)) scene.lootPickups = []

  const pickups = []
  const count = mapped.length
  mapped.forEach((drop, index) => {
    const px = x + (index - (count - 1) / 2) * LOOT_PICKUP_SPACING
    const py = y
    const idleName = `loot_${drop.id}_idle`
    const atlas = lootAtlasFor(drop.id) || LOOT_PICKUP_ATLAS
    const origin = lootAnimOrigin(scene, idleName, { x: 0.5, y: 0.875 }, atlas)
    const sprite = scene.add.sprite(px, py, atlas, `${idleName}_down_0`)
    if (typeof sprite.setOrigin === 'function') sprite.setOrigin(origin.x, origin.y)
    if (typeof sprite.setDepth === 'function') sprite.setDepth(Math.round(py) - 1)
    sprite.lootPickup = true
    sprite.lootId = drop.id
    sprite.lootKind = drop.kind
    sprite.lootCollected = false

    const idleKey = lootIdleAnimKey(drop.id)
    const canPlay = typeof sprite.anims?.play === 'function'
      && (typeof scene?.anims?.exists !== 'function' || scene.anims.exists(idleKey))
    if (canPlay) sprite.anims.play(idleKey, true)

    bindLootPickup(scene, sprite, drop)
    scene.lootPickups.push(sprite)
    pickups.push(sprite)
  })

  return { pickups, legacyIds: legacy.map((drop) => drop.id) }
}

/**
 * Finalizes enemy death once the death animation has completed.
 * Generates seeded loot, spawns loot_pickups (or grants immediately when
 * the scene cannot show a sprite), displays float icon, and removes actor.
 *
 * @param {import('../actors/Enemy.js').Enemy} enemy
 * @param {object} [options]
 * @returns {boolean} True if death completion was processed
 */
export function onEnemyDeathComplete(enemy, options = {}) {
  if (!enemy || enemy._deathCompleted) return false
  enemy._deathCompleted = true

  const scene = enemy.scene
  const enemyType = enemy.enemyType || 'goblin'
  const rng = options.rng || getRng()

  // 1. Generate seeded loot and present it (world sprite, or immediate grant)
  const { gems, items } = generateSeededLoot(enemyType, rng)
  const hasLoot = gems.ruby > 0 || gems.sapphire > 0 || gems.emerald > 0 || items.length > 0
  if (hasLoot) {
    presentLootDrop(scene, enemy.x, enemy.y, gems, items)
  }

  // 2. Display visual float if scene supports it
  if (scene && typeof scene._float === 'function') {
    scene._float(enemy.x, enemy.y, '✕', '#ff4444')
  }

  // 3. Clean up HP text
  if (enemy.hpText && typeof enemy.hpText.destroy === 'function') {
    enemy.hpText.destroy()
    enemy.hpText = null
  }

  // 4. Destroy enemy sprite & remove from group
  if (scene?.enemies && typeof scene.enemies.remove === 'function') {
    scene.enemies.remove(enemy, true, true)
  } else if (typeof enemy.destroy === 'function') {
    enemy.destroy()
  }

  return true
}

/**
 * Resolves the area entrance coordinates for the current active scene.
 *
 * @param {import('../scenes/HollowvaleScene.js').default} scene
 * @returns {{ x: number, y: number }}
 */
export function resolveAreaEntrance(scene) {
  const worldW = scene?.worldW || 960
  const worldH = scene?.worldH || 540

  // 1. Scene recorded entrance spawn
  if (scene?._areaEntrance) {
    const sp = scene._areaEntrance
    if (typeof sp.x === 'number' && typeof sp.y === 'number') {
      return { x: sp.x, y: sp.y }
    }
    if (typeof sp.nx === 'number' && typeof sp.ny === 'number') {
      return { x: sp.nx * worldW, y: sp.ny * worldH }
    }
  }

  // 2. Tiled map spawn_default
  if (scene?.mapLoader?.getSpawns) {
    const spawns = scene.mapLoader.getSpawns()
    const defSpawn = spawns.find((s) => s.name === 'spawn_default') || spawns[0]
    if (defSpawn) {
      return {
        x: defSpawn.x + (defSpawn.width ? defSpawn.width / 2 : 0),
        y: defSpawn.y + (defSpawn.height ? defSpawn.height / 2 : 0),
      }
    }
  }

  // 3. Generic safe entrance fallback
  return { x: worldW / 2, y: worldH * 0.85 }
}

/**
 * Respawns the player at the current area entrance with 100% HP, 100% Mana, and zero penalties.
 *
 * @param {import('../scenes/HollowvaleScene.js').default} scene
 * @returns {{ x: number, y: number, hp: number, mana: number }}
 */
export function respawnPlayer(scene) {
  if (!scene) return null

  const spawn = resolveAreaEntrance(scene)

  // 1. Reposition player actor
  if (scene.player) {
    scene.player.setPosition(spawn.x, spawn.y)
    if (scene.player.body?.reset) {
      scene.player.body.reset(spawn.x, spawn.y)
    }
    if (scene.player.body) {
      scene.player.body.enable = true
      if (typeof scene.player.body.setVelocity === 'function') {
        scene.player.body.setVelocity(0, 0)
      }
    }
  }

  // 2. Full HP / Mana, reset dead flag
  scene.dead = false
  scene._iframeUntil = 0
  scene.hp = scene.hpMax ?? 100
  scene.mana = scene.manaMax ?? 0

  // 3. Reset player actor state to IDLE
  if (typeof scene.player?.respawn === 'function') {
    scene.player.respawn()
  } else if (scene.player?.transition) {
    scene.player.transition(ACTOR_STATES.IDLE, { force: true })
    scene.player.playAnim?.('idle', false)
  }

  // 4. Publish restored vitals to React UI
  if (typeof scene._publishVitals === 'function') {
    scene._publishVitals(true)
  }

  // 5. Emit events bridging React state & notice
  eventBus.emit(GameEvents.RESPAWN, {
    x: spawn.x,
    y: spawn.y,
    hp: scene.hp,
    mana: scene.mana,
  })

  eventBus.emit(GameEvents.NOTICE, {
    text: 'Respawned at area entrance',
  })

  return {
    x: spawn.x,
    y: spawn.y,
    hp: scene.hp,
    mana: scene.mana,
  }
}

/**
 * Coordinates player lethal damage:
 * Plays death animation -> emits GameEvents.DIED -> respawns at area entrance with full HP/mana.
 *
 * @param {import('../scenes/HollowvaleScene.js').default} scene
 * @param {string} [killer='Unknown']
 * @param {object} [options]
 * @param {boolean} [options.immediate=false] - For tests / sync completion
 * @param {number} [options.fallbackMs] - Fallback timer before respawn
 */
export function handlePlayerDeath(scene, killer = 'Unknown', options = {}) {
  if (!scene || scene.dead) return
  scene.dead = true

  // 1. Halt movement
  if (scene.player?.body?.setVelocity) {
    scene.player.body.setVelocity(0, 0)
  }

  // 2. Trigger player death animation
  if (typeof scene.player?.die === 'function') {
    scene.player.die()
  } else if (scene.player?.playAnim) {
    scene.player.playAnim('death', false)
  }

  // 3. Publish vitals showing 0 HP
  scene.hp = 0
  if (typeof scene._publishVitals === 'function') {
    scene._publishVitals(true)
  }

  const killerDisplay = enemyLabel(killer)

  const finalizeRespawn = () => {
    eventBus.emit(GameEvents.DIED, { killer: killerDisplay })
    respawnPlayer(scene)
  }

  // Fast-track for unit tests / immediate option
  if (options.immediate) {
    finalizeRespawn()
    return
  }

  // Listen for animation complete if available
  let completed = false
  const onAnimComplete = (anim) => {
    const key = anim?.key || scene.player?.anims?.currentAnim?.key || ''
    if (key.includes('death') && !completed) {
      completed = true
      if (typeof scene.player?.off === 'function') {
        scene.player.off('animationcomplete', onAnimComplete)
      }
      finalizeRespawn()
    }
  }

  if (scene.player && typeof scene.player.on === 'function') {
    scene.player.on('animationcomplete', onAnimComplete)
  }

  // Delay fallback: ~1200ms allows the death clip to be seen visually before respawn
  const fallbackMs = options.fallbackMs ?? (scene.time ? 1200 : 0)
  if (fallbackMs === 0) {
    if (!completed) {
      completed = true
      finalizeRespawn()
    }
  } else if (scene.time?.delayedCall) {
    scene.time.delayedCall(fallbackMs, () => {
      if (!completed) {
        completed = true
        if (typeof scene.player?.off === 'function') {
          scene.player.off('animationcomplete', onAnimComplete)
        }
        finalizeRespawn()
      }
    })
  } else {
    setTimeout(() => {
      if (!completed) {
        completed = true
        if (typeof scene.player?.off === 'function') {
          scene.player.off('animationcomplete', onAnimComplete)
        }
        finalizeRespawn()
      }
    }, fallbackMs)
  }
}
