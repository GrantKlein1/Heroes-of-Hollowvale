/**
 * spells.js — Spells and Projectile Management for Heroes of Hollowvale.
 *
 * Implements:
 * - Meta-accurate spawn offsets and release timings for Mage & Thief
 * - Mage Fireball (meta offsets from mage_cast.json within +-2 px, 15 mana cost, fly/hit atlas anims)
 * - Mage Lightning (beam projectile from spell_fx with lightning_impact)
 * - Mage Life Leech (40% enemy HP drain, 10 s cooldown, leech_orb / leech_impact)
 * - Mage Mana Shield (shield_form -> shield_loop -> shield_break over mage feet origin)
 * - Mage Blink (blink_portal at departure/destination, collision-safe forward teleport)
 * - Thief Poison Vial (baked spin thief_fx_poison_vial, arced toss, poison_splash impact)
 */

import { Projectile } from '../actors/Projectile.js'
import { session } from '../session.js'
import { eventBus, GameEvents } from '../../lib/eventBus.js'
import { onSpellCast, onSpellImpact } from '../MainGameScene.js'
function safeSpellCast() {
  try {
    onSpellCast()
  } catch (_e) {
    // Audio stub for headless / node testing environments
  }
}

function safeSpellImpact() {
  try {
    onSpellImpact()
  } catch (_e) {
    // Audio stub for headless / node testing environments
  }
}
import {
  FIREBALL_SPEED,
  FIREBALL_DIST,
  FIRE_LINGER_MS,
} from './balance.js'

/** Fireball spawn offsets relative to feet pivot (from mage_cast.json meta) */
export const FIREBALL_SPAWN_OFFSETS = Object.freeze({
  down: Object.freeze({ x: -15, y: -56 }),
  left: Object.freeze({ x: -27, y: -65 }),
  right: Object.freeze({ x: 27, y: -58 }),
  up: Object.freeze({ x: 15, y: -67 }),
})

/** Mage spell spawn offsets relative to feet pivot (from mage_spells.json meta) */
export const SPELL_SPAWN_OFFSETS = Object.freeze({
  lightning: Object.freeze({
    down: Object.freeze({ x: 5, y: -40 }),
    left: Object.freeze({ x: -18, y: -43 }),
    right: Object.freeze({ x: 18, y: -45 }),
    up: Object.freeze({ x: -5, y: -48 }),
  }),
  leech: Object.freeze({
    down: Object.freeze({ x: 6, y: -40 }),
    left: Object.freeze({ x: -17, y: -43 }),
    right: Object.freeze({ x: 17, y: -45 }),
    up: Object.freeze({ x: -6, y: -47 }),
  }),
  shield: Object.freeze({
    down: Object.freeze({ x: 0, y: 0 }),
    left: Object.freeze({ x: 0, y: 0 }),
    right: Object.freeze({ x: 0, y: 0 }),
    up: Object.freeze({ x: 0, y: 0 }),
  }),
  blink: Object.freeze({
    down: Object.freeze({ x: 0, y: 0 }),
    left: Object.freeze({ x: 0, y: 0 }),
    right: Object.freeze({ x: 0, y: 0 }),
    up: Object.freeze({ x: 0, y: 0 }),
  }),
})

export const SPELL_RELEASE_FRAMES = Object.freeze({
  fireball: 6,
  lightning: 7,
  leech: 6,
  shield: 6,
  blink_vanish: 9,
  blink_appear: 0,
})

export const FIREBALL_MANA_COST = 15
export const MANA_REGEN_PER_SEC = 5
export const MANA_MAX = 100
export const LEECH_COOLDOWN_MS = 10000

/**
 * Calculates world coordinates for fireball spawn from player feet position and facing.
 *
 * @param {{ x: number, y: number }} player - Actor instance or coordinates object
 * @param {string} [facing='down'] - 'down' | 'left' | 'right' | 'up'
 * @returns {{ x: number, y: number }}
 */
export function getFireballSpawnPosition(player, facing = 'down') {
  const f = FIREBALL_SPAWN_OFFSETS[facing] || FIREBALL_SPAWN_OFFSETS.down
  return {
    x: (player?.x || 0) + f.x,
    y: (player?.y || 0) + f.y,
  }
}

/**
 * Calculates world coordinates for spell spawn from player feet position, spell id, and facing.
 *
 * @param {{ x: number, y: number }} player
 * @param {string} [spellId='lightning']
 * @param {string} [facing='down']
 * @returns {{ x: number, y: number }}
 */
export function getSpellSpawnPosition(player, spellId = 'lightning', facing = 'down') {
  const group = SPELL_SPAWN_OFFSETS[spellId] || SPELL_SPAWN_OFFSETS.lightning
  const offset = group[facing] || group.down || { x: 0, y: 0 }
  return {
    x: (player?.x || 0) + offset.x,
    y: (player?.y || 0) + offset.y,
  }
}

/**
 * Ensures all spell, projectile, and impact animations are registered in Phaser.
 *
 * @param {import('phaser').Scene} scene
 */
export function ensureSpellAnimations(scene) {
  if (!scene?.anims || typeof scene.anims.create !== 'function') return

  const createIfMissing = (config) => {
    if (typeof scene.anims.exists === 'function' && !scene.anims.exists(config.key)) {
      try {
        scene.anims.create(config)
      } catch (e) {
        // Safe fallback if textures are not yet loaded in mock/test
      }
    }
  }

  // 1. Fireball
  createIfMissing({
    key: 'fireball_fly',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'fireball', frame: `fireball_fly_${i}` })),
    frameRate: 12,
    repeat: -1,
  })
  createIfMissing({
    key: 'fireball_hit',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'fireball', frame: `fireball_hit_${i}` })),
    frameRate: 14,
    repeat: 0,
  })

  // 2. Spell FX (Lightning, Leech, Shield, Blink)
  createIfMissing({
    key: 'lightning_bolt',
    frames: Array.from({ length: 4 }, (_, i) => ({ key: 'spell_fx', frame: `lightning_bolt_${i}` })),
    frameRate: 16,
    repeat: -1,
  })
  createIfMissing({
    key: 'lightning_impact',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `lightning_impact_${i}` })),
    frameRate: 20,
    repeat: 0,
  })
  createIfMissing({
    key: 'leech_orb',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `leech_orb_${i}` })),
    frameRate: 12,
    repeat: -1,
  })
  createIfMissing({
    key: 'leech_impact',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `leech_impact_${i}` })),
    frameRate: 16,
    repeat: 0,
  })
  createIfMissing({
    key: 'leech_return',
    frames: Array.from({ length: 8 }, (_, i) => ({ key: 'spell_fx', frame: `leech_return_${i}` })),
    frameRate: 12,
    repeat: -1,
  })
  createIfMissing({
    key: 'leech_absorb',
    frames: Array.from({ length: 8 }, (_, i) => ({ key: 'spell_fx', frame: `leech_absorb_${i}` })),
    frameRate: 12,
    repeat: 0,
  })
  createIfMissing({
    key: 'shield_form',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `shield_form_${i}` })),
    frameRate: 14,
    repeat: 0,
  })
  createIfMissing({
    key: 'shield_loop',
    frames: Array.from({ length: 8 }, (_, i) => ({ key: 'spell_fx', frame: `shield_loop_${i}` })),
    frameRate: 10,
    repeat: -1,
  })
  createIfMissing({
    key: 'shield_break',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `shield_break_${i}` })),
    frameRate: 14,
    repeat: 0,
  })
  createIfMissing({
    key: 'blink_portal',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `blink_portal_${i}` })),
    frameRate: 14,
    repeat: 0,
  })

  // 3. Thief FX (Poison Vial & Splash)
  createIfMissing({
    key: 'thief_poison_vial',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'thief_fx', frame: `thief_fx_poison_vial_${i}` })),
    frameRate: 12,
    repeat: -1,
  })
  createIfMissing({
    key: 'thief_poison_splash',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'thief_fx', frame: `thief_fx_poison_splash_${i}` })),
    frameRate: 14,
    repeat: 0,
  })
}

/**
 * Normalizes a facing string into direction vector components [dx, dy].
 *
 * @param {string} facing - 'down' | 'left' | 'right' | 'up'
 * @returns {[number, number]}
 */
export function facingToVector(facing) {
  switch (facing) {
    case 'left': return [-1, 0]
    case 'right': return [1, 0]
    case 'up': return [0, -1]
    case 'down':
    default:
      return [0, 1]
  }
}

/**
 * Casts a Fireball projectile from the player character.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Projectile|null}
 */
export function castFireball(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  // Mana check
  const currentMana = scene.mana ?? session.mana ?? 100
  if (currentMana < FIREBALL_MANA_COST) {
    scene._notice?.('Not enough mana.')
    return null
  }

  // Deduct mana
  scene.mana = Math.max(0, currentMana - FIREBALL_MANA_COST)
  session.mana = scene.mana
  scene._publishVitals?.(false)

  ensureSpellAnimations(scene)
  safeSpellCast()

  // Direction and spawn position from meta
  const facing = player.facing || scene.facing?.() || 'down'
  const [dx, dy] = facingToVector(facing)
  const spawnPos = getFireballSpawnPosition(player, facing)

  const proj = new Projectile(scene, spawnPos.x, spawnPos.y, 'fireball', 'fireball_fly_0', {
    dirX: dx,
    dirY: dy,
    speed: FIREBALL_SPEED,
    maxDist: FIREBALL_DIST,
    size: 32,
    owner: 'player',
    damage: 10,
    impact: 'fire',
    lingerMs: FIRE_LINGER_MS,
    lingerDps: 2,
    flyAnim: 'fireball_fly',
    hitAnim: 'fireball_hit',
    lingerAnim: 'fireball_hit',
    onImpact: () => {
      safeSpellImpact()
    },
  })

  if (Array.isArray(scene.projectiles)) {
    scene.projectiles.push(proj)
  }

  return proj
}

/**
 * Casts a Lightning Bolt projectile.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Projectile|null}
 */
export function castLightning(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  ensureSpellAnimations(scene)
  safeSpellCast()

  const facing = player.facing || 'down'
  const [dx, dy] = facingToVector(facing)
  const spawnPos = getSpellSpawnPosition(player, 'lightning', facing)

  const proj = new Projectile(scene, spawnPos.x, spawnPos.y, 'spell_fx', 'lightning_bolt_0', {
    dirX: dx,
    dirY: dy,
    speed: 600,
    maxDist: 320,
    size: 32,
    origin: { x: 0.0, y: 0.5 }, // Anchor at left end
    owner: 'player',
    damage: 15,
    impact: 'lightning',
    flyAnim: 'lightning_bolt',
    hitAnim: 'lightning_impact',
    onImpact: () => {
      safeSpellImpact()
    },
  })

  if (Array.isArray(scene.projectiles)) {
    scene.projectiles.push(proj)
  }

  return proj
}

/**
 * Casts Life Leech spell.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Projectile|null}
 */
export function castLeech(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  if (now < (session.lifeLeechCooldownUntil || 0)) {
    return null
  }

  session.lifeLeechCooldownUntil = now + LEECH_COOLDOWN_MS
  scene._notice?.('Cast Life Leech')

  ensureSpellAnimations(scene)
  safeSpellCast()

  const facing = player.facing || 'down'
  const [dx, dy] = facingToVector(facing)
  const spawnPos = getSpellSpawnPosition(player, 'leech', facing)

  const proj = new Projectile(scene, spawnPos.x, spawnPos.y, 'spell_fx', 'leech_orb_0', {
    dirX: dx,
    dirY: dy,
    speed: FIREBALL_SPEED,
    maxDist: FIREBALL_DIST,
    size: 32,
    owner: 'player',
    impact: 'lifeLeech',
    special: 'lifeLeech',
    flyAnim: 'leech_orb',
    hitAnim: 'leech_impact',
    onImpact: () => {
      safeSpellImpact()
    },
  })

  if (Array.isArray(scene.projectiles)) {
    scene.projectiles.push(proj)
  }

  return proj
}

/**
 * Casts Mana Shield effect.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Phaser.GameObjects.Sprite|null}
 */
export function castShield(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  ensureSpellAnimations(scene)
  safeSpellCast()
  scene._notice?.('Activated Mana Shield')

  let shieldSprite = null
  if (scene.add && typeof scene.add.sprite === 'function') {
    shieldSprite = scene.add.sprite(player.x, player.y, 'spell_fx', 'shield_form_0')
    shieldSprite.setOrigin(0.5, 0.8828) // Mage feet origin
    shieldSprite.setDepth(player.depth + 10)

    if (shieldSprite.anims && typeof shieldSprite.anims.play === 'function') {
      shieldSprite.anims.play('shield_form')
      shieldSprite.once('animationcomplete', () => {
        shieldSprite.anims.play('shield_loop')
        // Automatically break / expire shield after 6 seconds
        scene.time?.delayedCall(6000, () => {
          if (shieldSprite.active) {
            shieldSprite.anims.play('shield_break')
            shieldSprite.once('animationcomplete', () => shieldSprite.destroy())
          }
        })
      })
    }

    // Attach to player position
    const followListener = () => {
      if (!shieldSprite.active) return
      shieldSprite.setPosition(player.x, player.y)
      shieldSprite.setDepth(player.depth + 10)
    }
    scene.events?.on('postupdate', followListener)
    shieldSprite.once('destroy', () => {
      scene.events?.off('postupdate', followListener)
    })
  }

  return shieldSprite
}

/**
 * Casts Blink teleport spell.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {boolean}
 */
export function castBlink(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return false

  ensureSpellAnimations(scene)
  safeSpellCast()

  const facing = player.facing || 'down'
  const [dx, dy] = facingToVector(facing)
  const blinkDistance = 96 * (scene.unit || 1)

  // Portal at departure point
  if (scene.add && typeof scene.add.sprite === 'function') {
    const portalStart = scene.add.sprite(player.x, player.y - 16, 'spell_fx', 'blink_portal_0')
    portalStart.setDepth(player.depth)
    portalStart.anims?.play?.('blink_portal')
    portalStart.once?.('animationcomplete', () => portalStart.destroy())
  }

  // Calculate destination avoiding solid colliders
  let targetX = player.x + dx * blinkDistance
  let targetY = player.y + dy * blinkDistance

  const solids = scene._solidRects || []
  const testBox = { x: targetX - 12, y: targetY - 12, w: 24, h: 24 }
  let blocked = false
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i]
    if (
      testBox.x < s.x + s.w &&
      testBox.x + testBox.w > s.x &&
      testBox.y < s.y + s.h &&
      testBox.y + testBox.h > s.y
    ) {
      blocked = true
      break
    }
  }

  if (!blocked) {
    player.setPosition(targetX, targetY)
  }

  // Portal at destination point
  if (scene.add && typeof scene.add.sprite === 'function') {
    const portalEnd = scene.add.sprite(player.x, player.y - 16, 'spell_fx', 'blink_portal_0')
    portalEnd.setDepth(player.depth)
    portalEnd.anims?.play?.('blink_portal')
    portalEnd.once?.('animationcomplete', () => portalEnd.destroy())
  }

  scene._notice?.('Blink!')
  return true
}

/**
 * Throws a Thief Poison Vial projectile.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Projectile|null}
 */
export function throwPoisonVial(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  ensureSpellAnimations(scene)

  const facing = player.facing || scene.facing?.() || 'down'
  const [dx, dy] = facingToVector(facing)
  const spawnX = player.x + dx * 12
  const spawnY = player.y - 16 + dy * 12

  const proj = new Projectile(scene, spawnX, spawnY, 'thief_fx', 'thief_fx_poison_vial_0', {
    dirX: dx,
    dirY: dy,
    speed: 380,
    maxDist: 200,
    size: 32,
    owner: 'player',
    damage: 8,
    impact: 'poison',
    isArc: true,
    arcHeight: 28,
    bakedSpin: true,
    flyAnim: 'thief_poison_vial',
    hitAnim: 'thief_poison_splash',
    lingerAnim: 'thief_poison_splash',
    lingerMs: 2000,
    lingerDps: 5,
    onImpact: () => {
      safeSpellImpact()
    },
  })

  if (Array.isArray(scene.projectiles)) {
    scene.projectiles.push(proj)
  }

  // Consume item
  eventBus.emit(GameEvents.ITEM_CONSUMED, { id: 'poison_vial', mode: 'search' })

  return proj
}
