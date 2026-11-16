/**
 * fallbacks.js — Combat fallbacks for missing clips.
 * Package 4-1: Wire Blendsmith P2 clips.
 *
 * Generic fallbacks for hero run, attack_2, charge_hold/charged_release,
 * goblin spawn, and critter 4-way vertical facings have been removed because
 * those clips are now delivered in the atlas manifests.
 *
 * Goblin family alert clips shipped in AV-1, so the proven-missing list is empty.
 * resolveAnimWithFallback still covers a key the scene has not created.
 */

/**
 * Registry of clips proven missing from Blendsmith atlas metadata.
 */
export const KNOWN_MISSING_CLIPS = Object.freeze([])

const MISSING_CLIPS_SET = new Set(KNOWN_MISSING_CLIPS)

/**
 * Checks if a clip name or key corresponds to a proven missing asset.
 *
 * @param {string} clipKey
 * @returns {boolean}
 */
export function isProvenMissingClip(clipKey) {
  if (!clipKey || typeof clipKey !== 'string') return false
  for (const missing of MISSING_CLIPS_SET) {
    if (clipKey.includes(missing)) return true
  }
  return false
}

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

/**
 * Performs a safe procedural flash for an alert state when an enemy lacks a dedicated alert clip.
 *
 * @param {import('phaser').GameObjects.Sprite} actor
 * @param {number} [durationMs=250]
 * @param {number} [tint=0xffee66]
 */
export function applyGenericAlert(actor, durationMs = 250, tint = 0xffee66) {
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
