/**
 * Generic combat fallbacks for missing clips (P2 gaps) and telegraph safety.
 *
 * Ensures that if an animation key or clip is not present in the scene/manifest,
 * the actor gracefully falls back to a safe animation or procedural flash
 * without locking or freezing the state machine.
 */

/**
 * Resolves a safe animation key with fallback options.
 *
 * @param {import('phaser').Scene} scene
 * @param {string} desiredKey - The animation key we want to play
 * @param {string} [fallbackKey] - The fallback animation key if desiredKey doesn't exist
 * @returns {string|null} - The key to play, or null if neither exists
 */
export function resolveAnimWithFallback(scene, desiredKey, fallbackKey = null) {
  if (!scene?.anims?.exists) {
    return desiredKey
  }

  if (scene.anims.exists(desiredKey)) {
    return desiredKey
  }

  if (fallbackKey && scene.anims.exists(fallbackKey)) {
    return fallbackKey
  }

  return null
}

/**
 * Performs a safe fallback telegraph action when an enemy or actor lacks a dedicated telegraph clip.
 *
 * @param {import('phaser').GameObjects.Sprite} actor
 * @param {number} [durationMs=250]
 * @param {number} [tint=0xffaa44]
 */
export function applyGenericTelegraph(actor, durationMs = 250, tint = 0xffaa44) {
  if (!actor) return

  if (typeof actor.setTint === 'function') {
    actor.setTint(tint)
  }

  if (actor.scene?.time?.delayedCall) {
    actor.scene.time.delayedCall(durationMs, () => {
      if (actor.active && typeof actor.clearTint === 'function') {
        actor.clearTint()
      }
    })
  }
}

