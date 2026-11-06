/**
 * Hit System for Heroes of Hollowvale.
 *
 * Implements:
 * - Dynamic frame-accurate hit detection based on atlas metadata (hitFrames & hitbox)
 * - Zero hard-coded frame numbers (reads directly from sheet meta)
 * - AABB intersection of world-space hitbox vs target hurtbox
 * - Audio triggers (onMeleeHit), hit-stop, 2-stage flash, knockback, and FX sparks
 * - Target i-frame enforcement and damage deduction
 */

import { MELEE_DMG } from './balance.js'
import {
  applyHitStop,
  applyFlash,
  applyKnockback,
  spawnHitSpark,
  isEnemyHitOnSwing,
  recordEnemyHitOnSwing,
  ENEMY_PER_SWING_IFRAME_MS,
} from './feedback.js'
import { onMeleeHit } from '../MainGameScene.js'

/**
 * Extracts the 0-based animation frame index from an AnimationFrame object or frame string.
 *
 * @param {Phaser.Animations.AnimationFrame|object} frame
 * @returns {number} - 0-based frame index or -1 if unresolved
 */
export function getAnimationFrameIndex(frame) {
  if (!frame) return -1
  const texName = frame.textureFrame || frame.frame?.name || ''
  const match = typeof texName === 'string' ? texName.match(/_(\d+)$/) : null
  if (match) {
    return parseInt(match[1], 10)
  }
  if (typeof frame.index === 'number') {
    return frame.index - 1
  }
  return -1
}

/**
 * Reads the list of hit frames from the texture sheet atlas metadata.
 *
 * @param {import('phaser').Scene} scene
 * @param {string} sheetKey
 * @param {string} [animName='attack']
 * @returns {Array<number>}
 */
export function getHitFrames(scene, sheetKey, animName = 'attack') {
  if (!scene || !sheetKey) return []

  let meta = null
  if (scene.textures?.get) {
    const tex = scene.textures.get(sheetKey)
    meta = tex?.customData?.meta
  }

  const animMeta = meta?.anims?.[animName]
  if (Array.isArray(animMeta?.hitFrames)) {
    return animMeta.hitFrames
  }
  return []
}

/**
 * Resolves the relative hitbox definition for a specific animation frame and facing direction.
 *
 * @param {import('phaser').Scene} scene
 * @param {string} sheetKey
 * @param {number|string} frameIndex
 * @param {string} facing
 * @param {string} [animName='attack']
 * @returns {{ x: number, y: number, w: number, h: number }|null}
 */
export function getHitbox(scene, sheetKey, frameIndex, facing, animName = 'attack') {
  if (!scene || !sheetKey) return null

  let meta = null
  if (scene.textures?.get) {
    const tex = scene.textures.get(sheetKey)
    meta = tex?.customData?.meta
  }

  const animMeta = meta?.anims?.[animName]
  const frameStr = String(frameIndex)
  const dirDef = animMeta?.hitbox?.[frameStr]?.[facing] || animMeta?.hitbox?.[frameIndex]?.[facing]
  if (dirDef && typeof dirDef.w === 'number' && typeof dirDef.h === 'number') {
    return { ...dirDef }
  }
  return null
}

/**
 * Resolves the weapon tip offset relative to feet pivot.
 *
 * @param {import('phaser').Scene} scene
 * @param {string} sheetKey
 * @param {number|string} frameIndex
 * @param {string} facing
 * @param {string} [animName='attack']
 * @returns {{ x: number, y: number }|null}
 */
export function getWeaponTip(scene, sheetKey, frameIndex, facing, animName = 'attack') {
  if (!scene || !sheetKey) return null

  let meta = null
  if (scene.textures?.get) {
    const tex = scene.textures.get(sheetKey)
    meta = tex?.customData?.meta
  }

  const animMeta = meta?.anims?.[animName]
  const frameStr = String(frameIndex)
  const tip = animMeta?.weaponTipOffsetFromFeet?.[frameStr]?.[facing] || animMeta?.weaponTipOffsetFromFeet?.[frameIndex]?.[facing]
  if (tip && typeof tip.x === 'number' && typeof tip.y === 'number') {
    return { ...tip }
  }
  return null
}

/**
 * Computes world-space AABB bounding box for an attacker's hitbox definition.
 * Hitbox offsets in atlas metadata are relative to the feet pivot.
 *
 * @param {Phaser.GameObjects.Sprite} attacker
 * @param {{ x: number, y: number, w: number, h: number }} hitboxDef
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function computeWorldHitbox(attacker, hitboxDef) {
  const scale = attacker.scaleX || attacker.scale || 1
  // Attacker feet position
  const feetX = attacker.x
  const feetY = attacker.body?.bottom ?? attacker.y

  return {
    x: feetX + hitboxDef.x * scale,
    y: feetY + hitboxDef.y * scale,
    w: hitboxDef.w * scale,
    h: hitboxDef.h * scale,
  }
}

/**
 * Computes world-space AABB bounding box for a target's hurtbox.
 * Priority:
 * 1. target.hurtbox (set by Actor from atlas metadata)
 * 2. target texture customData.meta.hurtbox
 * 3. target.body bounding box (legacy fallback)
 *
 * @param {Phaser.GameObjects.GameObject} target
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function computeWorldHurtbox(target) {
  const scale = target.scaleX || target.scale || 1
  const feetX = target.x
  const feetY = target.body?.bottom ?? target.y

  // 1. Explicit hurtbox on target
  if (target.hurtbox && typeof target.hurtbox.w === 'number' && typeof target.hurtbox.h === 'number') {
    return {
      x: feetX + target.hurtbox.x * scale,
      y: feetY + target.hurtbox.y * scale,
      w: target.hurtbox.w * scale,
      h: target.hurtbox.h * scale,
    }
  }

  // 2. Texture metadata hurtbox
  if (target.texture?.customData?.meta?.hurtbox) {
    const hb = target.texture.customData.meta.hurtbox
    return {
      x: feetX + hb.x * scale,
      y: feetY + hb.y * scale,
      w: hb.w * scale,
      h: hb.h * scale,
    }
  }

  // 3. Fallback to physics body
  if (target.body) {
    return {
      x: target.body.x,
      y: target.body.y,
      w: target.body.width,
      h: target.body.height,
    }
  }

  // 4. Fallback to display dimensions
  const w = target.displayWidth || target.width || 32
  const h = target.displayHeight || target.height || 32
  return {
    x: target.x - w / 2,
    y: target.y - h / 2,
    w,
    h,
  }
}

/**
 * Checks whether two 2D axis-aligned bounding boxes intersect.
 *
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 * @returns {boolean}
 */
export function rectIntersects(a, b) {
  if (!a || !b) return false
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

/**
 * Executes a melee hit scan for a player on an active hitFrame.
 *
 * @param {import('../actors/Player.js').Player} player
 * @param {number} frameIndex - Active animation frame index
 * @param {number} [now=performance.now()] - Current timestamp
 * @returns {number} - Count of enemies struck
 */
export function executePlayerMeleeHit(player, frameIndex, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!player?.scene) return 0

  const scene = player.scene
  const sheetKey = player.getSheetForAnim ? player.getSheetForAnim('attack') : player.texture?.key
  const hitboxDef = getHitbox(scene, sheetKey, frameIndex, player.facing, 'attack')

  if (!hitboxDef) return 0

  const worldHitbox = computeWorldHitbox(player, hitboxDef)
  const enemiesGroup = scene.enemies
  const enemies = enemiesGroup && typeof enemiesGroup.getChildren === 'function'
    ? enemiesGroup.getChildren()
    : []

  const damage = MELEE_DMG[player.classId] || 12
  const swingId = player.currentSwingId || 1
  let hitCount = 0

  for (const enemy of enemies) {
    if (!enemy || !enemy.active || enemy.hp <= 0) continue

    // Respect 200 ms enemy per-swing i-frames
    if (isEnemyHitOnSwing(enemy, swingId, now)) continue

    const enemyHurtbox = computeWorldHurtbox(enemy)
    if (!rectIntersects(worldHitbox, enemyHurtbox)) continue

    // --- Apply Damage ---
    enemy.hp = Math.max(0, enemy.hp - damage)
    recordEnemyHitOnSwing(enemy, swingId, now, ENEMY_PER_SWING_IFRAME_MS)
    hitCount++

    // --- Audio & Combat Feedback ---
    try {
      onMeleeHit()
    } catch (_e) {
      // Audio stub
    }

    // 60 ms Hit-stop on both attacker and victim
    applyHitStop([player, enemy], 60)

    // 2-stage white -> red flash
    applyFlash(enemy, scene)

    // Knockback
    applyKnockback(enemy, player.x, player.y, 140, 150)

    // Hit spark placement: prefer weapon tip, otherwise center of intersection
    const scale = player.scaleX || player.scale || 1
    const tip = getWeaponTip(scene, sheetKey, frameIndex, player.facing, 'attack')
    let sparkX
    let sparkY

    if (tip) {
      sparkX = player.x + tip.x * scale
      sparkY = (player.body?.bottom ?? player.y) + tip.y * scale
    } else {
      const ix1 = Math.max(worldHitbox.x, enemyHurtbox.x)
      const ix2 = Math.min(worldHitbox.x + worldHitbox.w, enemyHurtbox.x + enemyHurtbox.w)
      const iy1 = Math.max(worldHitbox.y, enemyHurtbox.y)
      const iy2 = Math.min(worldHitbox.y + worldHitbox.h, enemyHurtbox.y + enemyHurtbox.h)
      sparkX = (ix1 + ix2) / 2
      sparkY = (iy1 + iy2) / 2
    }

    spawnHitSpark(scene, sparkX, sparkY)

    // Floating combat text
    if (typeof scene._float === 'function') {
      scene._float(enemy.x, enemy.y - 6, `-${damage}`, '#ff6161')
    }
  }

  return hitCount
}
