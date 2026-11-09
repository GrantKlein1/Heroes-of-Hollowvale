/**
 * Dodge mechanics module for Heroes of Hollowvale.
 *
 * Implements:
 * - 600 ms dodge cooldown
 * - Metadata-driven I-frame extraction from atlas meta (knight, thief, dwarf: [1, 4], mage: [1, 3])
 * - Frame and time-based invulnerability checks
 * - Forward displacement translation along the facing direction using travelPerFrame
 */

export const DODGE_COOLDOWN_MS = 600
export const DEFAULT_DODGE_DURATION_MS = 375

export const DEFAULT_DODGE_META = Object.freeze({
  fps: 16,
  durationMs: 375,
  iFrames: [1, 4],
  iFramesMs: [62, 312],
  travelPx: 48,
  travelPerFrame: [0, 7.2, 21.6, 36, 45.6, 48],
})

export const MAGE_DODGE_META = Object.freeze({
  fps: 16,
  durationMs: 375,
  iFrames: [1, 3],
  iFramesMs: [62, 250],
  travelPx: 40,
  travelPerFrame: [0, 6, 18, 30, 38, 40],
})

/**
 * Retrieves dodge metadata for an actor/scene, falling back to class defaults.
 *
 * @param {import('phaser').Scene} [scene]
 * @param {string} [sheetKey]
 * @param {string} [classId='knight']
 * @returns {object}
 */
export function getDodgeMeta(scene, sheetKey, classId = 'knight') {
  let meta = null
  if (scene?.textures?.get && sheetKey) {
    const tex = scene.textures.get(sheetKey)
    meta = tex?.customData?.meta
  }

  const dodgeDef = meta?.anims?.dodge
  if (dodgeDef && Array.isArray(dodgeDef.iFrames)) {
    return dodgeDef
  }

  return classId === 'mage' ? MAGE_DODGE_META : DEFAULT_DODGE_META
}

/**
 * Determines whether the actor is currently in an invulnerable dodge window.
 * Checks both frame index (if available) and elapsed dodge duration against iFramesMs.
 *
 * @param {object} dodgeState - State tracking object on the player
 * @param {number} [frameIndex=-1] - Current active animation frame index (0-5)
 * @param {number} [now=Date.now()] - Current timestamp
 * @param {object} [dodgeMeta] - Dodge metadata
 * @returns {boolean}
 */
export function isDodgeInvulnerable(dodgeState, frameIndex = -1, now = Date.now(), dodgeMeta = null) {
  if (!dodgeState || !dodgeState.active) {
    return false
  }

  const meta = dodgeMeta || dodgeState.meta || DEFAULT_DODGE_META
  const [startFrame, endFrame] = Array.isArray(meta.iFrames) ? meta.iFrames : [1, 4]

  // Frame-accurate check if valid frame index is provided
  if (typeof frameIndex === 'number' && frameIndex >= 0) {
    return frameIndex >= startFrame && frameIndex <= endFrame
  }

  // Fallback to elapsed time within iFramesMs window
  const elapsed = Math.max(0, now - (dodgeState.startTime || 0))
  const [startMs, endMs] = Array.isArray(meta.iFramesMs) ? meta.iFramesMs : [62, 312]
  return elapsed >= startMs && elapsed <= endMs
}

/**
 * Calculates directional displacement along facing direction for a given frame step.
 *
 * @param {string} facing - 'down' | 'left' | 'right' | 'up'
 * @param {number} deltaPx - Pixels to move
 * @returns {{ dx: number, dy: number }}
 */
export function getFacingDisplacement(facing, deltaPx) {
  switch (facing) {
    case 'left':
      return { dx: -deltaPx, dy: 0 }
    case 'right':
      return { dx: deltaPx, dy: 0 }
    case 'up':
      return { dx: 0, dy: -deltaPx }
    case 'down':
    default:
      return { dx: 0, dy: deltaPx }
  }
}

