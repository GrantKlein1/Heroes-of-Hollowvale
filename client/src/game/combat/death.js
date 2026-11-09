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
import { PAINTED_SCENES } from '../sceneCatalog.js'

/**
 * Loot drop probability definitions per enemy archetype.
 */
export const LOOT_TABLES = Object.freeze({
  goblin: {
    gems: [
      { type: 'ruby', chance: 0.35, count: 1 },
      { type: 'emerald', chance: 0.15, count: 1 },
    ],
    items: [
      { id: 'speed_potion', chance: 0.15, count: 1 },
    ],
  },
  brute: {
    gems: [
      { type: 'ruby', chance: 0.60, count: 1 },
      { type: 'sapphire', chance: 0.50, count: 1 },
    ],
    items: [
      { id: 'healing_potion', chance: 0.25, count: 1 },
    ],
  },
  archer: {
    gems: [
      { type: 'sapphire', chance: 0.30, count: 1 },
    ],
    items: [
      { id: 'mana_potion', chance: 0.25, count: 1 },
    ],
  },
})

/**
 * Maps enemy archetype identifier to user-facing display label.
 *
 * @param {string} type
 * @returns {string}
 */
export function enemyLabel(type) {
  if (type === 'goblin') return 'Goblin'
  if (type === 'brute') return 'Goblin Brute'
  if (type === 'archer') return 'Goblin Archer'
  return type || 'Unknown'
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

  const table = LOOT_TABLES[enemyType]
  if (!table) {
    return { gems, items }
  }

  for (const gemDef of table.gems) {
    if (nextVal() < gemDef.chance) {
      gems[gemDef.type] = (gems[gemDef.type] || 0) + (gemDef.count || 1)
    }
  }

  for (const itemDef of table.items) {
    if (nextVal() < itemDef.chance) {
      items.push({ id: itemDef.id, count: itemDef.count || 1 })
    }
  }

  return { gems, items }
}

/**
 * Finalizes enemy death once the death animation has completed.
 * Generates seeded loot, emits GameEvents.LOOT, displays float icon, and removes actor.
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

  // 1. Generate seeded loot
  const { gems, items } = generateSeededLoot(enemyType, rng)
  const hasLoot = gems.ruby > 0 || gems.sapphire > 0 || gems.emerald > 0 || items.length > 0
  if (hasLoot) {
    eventBus.emit(GameEvents.LOOT, { gems, items })
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

  // 3. Painted scene catalog default spawn
  const sceneId = scene?.sceneId || 'village'
  const def = PAINTED_SCENES[sceneId]
  if (def?.spawn) {
    return {
      x: def.spawn.nx * worldW,
      y: def.spawn.ny * worldH,
    }
  }

  // 4. Generic safe entrance fallback
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
