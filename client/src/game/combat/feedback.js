/**
 * Combat Feedback System for Heroes of Hollowvale.
 *
 * Implements:
 * - 60 ms hit-stop (pause animations and velocity on attacker & target)
 * - White → Red flash (pure white tint during hit-stop, red damage flash for 120 ms, then clear)
 * - Knockback impulse along strike vector + dust_puff FX at victim feet
 * - 600 ms player invulnerability frames (I-frames)
 * - 200 ms enemy per-swing I-frames (prevents duplicate hits on the same swing)
 * - Visual FX helpers for hit_spark and dust_puff from the fx_common atlas
 */

import { buildAnimKey } from '../assets/animKeys.js'

export const HIT_STOP_DURATION_MS = 60
export const FLASH_WHITE_DURATION_MS = 60
export const FLASH_RED_DURATION_MS = 120
export const PLAYER_IFRAME_DURATION_MS = 600
export const ENEMY_PER_SWING_IFRAME_MS = 200
export const DEFAULT_KNOCKBACK_SPEED = 140
export const DEFAULT_KNOCKBACK_DURATION_MS = 150

/**
 * Applies hit-stop to one or more game objects (attacker and victims).
 * Pauses animations and zeroes physics velocity for durationMs, then resumes.
 *
 * @param {Array<Phaser.GameObjects.GameObject>|Phaser.GameObjects.GameObject} targets
 * @param {number} [durationMs=HIT_STOP_DURATION_MS]
 */
export function applyHitStop(targets, durationMs = HIT_STOP_DURATION_MS) {
  const list = Array.isArray(targets) ? targets : [targets]
  const valid = list.filter(Boolean)
  if (valid.length === 0) return

  for (const obj of valid) {
    // 1. Pause animation if currently playing
    if (obj.anims && typeof obj.anims.pause === 'function' && obj.anims.isPlaying) {
      obj.anims.pause()
      obj._hitStopPaused = true
    }

    // 2. Pause velocity if physics body exists
    if (obj.body && typeof obj.body.setVelocity === 'function') {
      obj._preHitStopVelocity = {
        x: obj.body.velocity?.x || 0,
        y: obj.body.velocity?.y || 0,
      }
      obj.body.setVelocity(0, 0)
    }
  }

  // Find active scene timer
  const scene = valid[0]?.scene
  const resume = () => {
    for (const obj of valid) {
      if (obj._hitStopPaused && obj.anims && typeof obj.anims.resume === 'function') {
        obj.anims.resume()
        delete obj._hitStopPaused
      }
      if (obj._preHitStopVelocity && obj.body && typeof obj.body.setVelocity === 'function') {
        obj.body.setVelocity(obj._preHitStopVelocity.x, obj._preHitStopVelocity.y)
        delete obj._preHitStopVelocity
      }
    }
  }

  if (scene?.time?.delayedCall) {
    scene.time.delayedCall(durationMs, resume)
  } else if (typeof setTimeout === 'function') {
    setTimeout(resume, durationMs)
  } else {
    resume()
  }
}

/**
 * Applies a 2-stage white → red hit flash to a target.
 *
 * Stage 1 (0 to whiteMs): pure white flash (solid fill if available)
 * Stage 2 (whiteMs to whiteMs + redMs): red damage flash
 * Stage 3: clear tint
 *
 * @param {Phaser.GameObjects.Sprite} target
 * @param {import('phaser').Scene} [scene]
 * @param {object} [options]
 * @param {number} [options.whiteMs=FLASH_WHITE_DURATION_MS]
 * @param {number} [options.redMs=FLASH_RED_DURATION_MS]
 */
export function applyFlash(target, scene = target?.scene, options = {}) {
  if (!target) return

  const whiteMs = options.whiteMs ?? FLASH_WHITE_DURATION_MS
  const redMs = options.redMs ?? FLASH_RED_DURATION_MS

  // Stage 1: White flash
  if (typeof target.setTintFill === 'function') {
    target.setTintFill(0xffffff)
  } else if (typeof target.setTint === 'function') {
    target.setTint(0xffffff)
  }

  const delayFn = (ms, cb) => {
    if (scene?.time?.delayedCall) {
      return scene.time.delayedCall(ms, cb)
    }
    if (typeof setTimeout === 'function') {
      return setTimeout(cb, ms)
    }
    cb()
    return null
  }

  // Stage 2: Transition to Red flash
  delayFn(whiteMs, () => {
    if (!target.active && target.active !== undefined) return
    if (typeof target.setTint === 'function') {
      target.setTint(0xff4444)
    }

    // Stage 3: Clear tint
    delayFn(redMs, () => {
      if (!target.active && target.active !== undefined) return
      if (typeof target.clearTint === 'function') {
        target.clearTint()
      }
    })
  })
}

/**
 * Applies directional knockback away from a point of impact.
 *
 * @param {Phaser.GameObjects.GameObject} target
 * @param {number} fromX - Attacker or impact center X
 * @param {number} fromY - Attacker or impact center Y
 * @param {number} [strength=DEFAULT_KNOCKBACK_SPEED] - Initial impulse velocity
 * @param {number} [durationMs=DEFAULT_KNOCKBACK_DURATION_MS] - Duration of knockback slide
 */
export function applyKnockback(target, fromX, fromY, strength = DEFAULT_KNOCKBACK_SPEED, durationMs = DEFAULT_KNOCKBACK_DURATION_MS) {
  if (!target?.body) return

  let dx = target.x - fromX
  let dy = target.y - fromY
  const dist = Math.hypot(dx, dy)

  if (dist < 0.001) {
    dx = 1
    dy = 0
  } else {
    dx /= dist
    dy /= dist
  }

  const vx = dx * strength
  const vy = dy * strength

  if (typeof target.body.setVelocity === 'function') {
    target.body.setVelocity(vx, vy)
  }

  const scene = target.scene
  const stopKnockback = () => {
    if (target.body && typeof target.body.setVelocity === 'function') {
      target.body.setVelocity(0, 0)
    }
  }

  if (scene?.time?.delayedCall) {
    scene.time.delayedCall(durationMs, stopKnockback)
  } else if (typeof setTimeout === 'function') {
    setTimeout(stopKnockback, durationMs)
  } else {
    stopKnockback()
  }

  // Spawn dust puff at target's feet
  const feetY = target.body?.bottom ?? target.y
  spawnDustPuff(scene, target.x, feetY)
}

/**
 * Spawns a hit_spark FX sprite centered at the contact point.
 *
 * @param {import('phaser').Scene} scene
 * @param {number} x - Contact point X
 * @param {number} y - Contact point Y
 * @returns {Phaser.GameObjects.Sprite|null}
 */
export function spawnHitSpark(scene, x, y) {
  if (!scene?.add?.sprite) return null

  const animKey = buildAnimKey('fx_common', 'hit_spark')
  const spark = scene.add.sprite(x, y, 'fx_common')
  spark.setOrigin(0.5, 0.5)
  spark.setDepth(20000)

  // Track on scene and global QA interface for test assertions
  scene._lastFx = animKey
  if (scene.player) {
    scene.player._lastFx = animKey
  }
  if (typeof window !== 'undefined' && window.__hv) {
    window.__hv.lastFx = () => animKey
  }

  if (spark.anims && typeof spark.anims.play === 'function') {
    spark.anims.play(animKey)
    spark.once('animationcomplete', () => {
      spark.destroy()
    })
  } else {
    spark.destroy()
  }

  return spark
}

/**
 * Spawns a dust_puff FX sprite at bottom-center on feet.
 *
 * @param {import('phaser').Scene} scene
 * @param {number} x - Feet X
 * @param {number} y - Feet Y
 * @returns {Phaser.GameObjects.Sprite|null}
 */
export function spawnDustPuff(scene, x, y) {
  if (!scene?.add?.sprite) return null

  const animKey = buildAnimKey('fx_common', 'dust_puff')
  const dust = scene.add.sprite(x, y, 'fx_common')
  dust.setOrigin(0.5, 1.0)
  dust.setDepth((y || 0) + 1)

  if (dust.anims && typeof dust.anims.play === 'function') {
    dust.anims.play(animKey)
    dust.once('animationcomplete', () => {
      dust.destroy()
    })
  } else {
    dust.destroy()
  }

  return dust
}

/**
 * Checks whether a player is currently invulnerable (I-frames).
 *
 * @param {object} player
 * @param {number} [now=performance.now()]
 * @returns {boolean}
 */
export function isPlayerInvulnerable(player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!player) return false
  return now < (player.invulnerableUntil || 0)
}

/**
 * Grants player invulnerability for durationMs and triggers alpha flicker.
 *
 * @param {object} player
 * @param {number} [now=performance.now()]
 * @param {number} [durationMs=PLAYER_IFRAME_DURATION_MS]
 */
export function setPlayerInvulnerable(player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now()), durationMs = PLAYER_IFRAME_DURATION_MS) {
  if (!player) return
  player.invulnerableUntil = now + durationMs

  // If scene tracks iframeUntil, sync it
  if (player.scene) {
    player.scene._iframeUntil = now + durationMs
  }

  // Alpha flicker during i-frames
  if (player.scene?.tweens) {
    player.scene.tweens.add({
      targets: player,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      repeat: Math.floor(durationMs / 160),
      onComplete: () => {
        if (typeof player.setAlpha === 'function') {
          player.setAlpha(1.0)
        }
      },
    })
  }
}

/**
 * Checks if an enemy has already been hit during this swing or is within per-swing i-frames.
 *
 * @param {object} enemy
 * @param {number|string} swingId
 * @param {number} [now=performance.now()]
 * @returns {boolean}
 */
export function isEnemyHitOnSwing(enemy, swingId, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!enemy) return true
  if (enemy._lastHitSwingId === swingId) {
    return true
  }
  if (now < (enemy.perSwingIFrameUntil || 0)) {
    return true
  }
  return false
}

/**
 * Records that an enemy was hit by this swing and starts the per-swing i-frame window.
 *
 * @param {object} enemy
 * @param {number|string} swingId
 * @param {number} [now=performance.now()]
 * @param {number} [durationMs=ENEMY_PER_SWING_IFRAME_MS]
 */
export function recordEnemyHitOnSwing(enemy, swingId, now = (typeof performance !== 'undefined' ? performance.now() : Date.now()), durationMs = ENEMY_PER_SWING_IFRAME_MS) {
  if (!enemy) return
  enemy._lastHitSwingId = swingId
  enemy.perSwingIFrameUntil = now + durationMs
}

