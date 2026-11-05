/**
 * 4-facing directional rule and utilities for Heroes of Hollowvale.
 *
 * Enforces the core combat design contract:
 * - 4 cardinal facings rendered explicitly: 'down', 'left', 'right', 'up'.
 * - No horizontal flipping (flipX is forbidden).
 * - Dominant axis determines direction.
 * - In case of a tie (|dx| === |dy|), previous facing is strictly preserved.
 */

export const FACINGS = Object.freeze(['down', 'left', 'right', 'up'])

export const FACING = Object.freeze({
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  UP: 'up',
})

export const DEFAULT_FACING = FACING.DOWN

const FACING_SET = new Set(FACINGS)

/**
 * Checks whether a given string is a valid cardinal facing.
 *
 * @param {string} facing
 * @returns {boolean}
 */
export function isValidFacing(facing) {
  return typeof facing === 'string' && FACING_SET.has(facing)
}

/**
 * Resolves the 4-facing direction from a 2D velocity or movement vector (dx, dy).
 *
 * Dominant axis rule:
 * - If |dx| > |dy|: 'right' (dx > 0) or 'left' (dx < 0).
 * - If |dy| > |dx|: 'down' (dy > 0) or 'up' (dy < 0).
 * - Tie rule (|dx| === |dy|): preserves currentFacing.
 *
 * @param {number} dx - X component of movement or aim vector
 * @param {number} dy - Y component of movement or aim vector
 * @param {string} [currentFacing=DEFAULT_FACING] - Current facing to preserve on ties
 * @returns {string} - 'down' | 'left' | 'right' | 'up'
 */
export function resolveFacing(dx, dy, currentFacing = DEFAULT_FACING) {
  const safeCurrent = isValidFacing(currentFacing) ? currentFacing : DEFAULT_FACING

  if (typeof dx !== 'number' || typeof dy !== 'number' || Number.isNaN(dx) || Number.isNaN(dy)) {
    return safeCurrent
  }

  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  // Dominant axis tie (including stationary dx=0, dy=0 or exact diagonals |dx| === |dy| > 0)
  if (absX === absY) {
    return safeCurrent
  }

  if (absX > absY) {
    return dx > 0 ? FACING.RIGHT : FACING.LEFT
  } else {
    return dy > 0 ? FACING.DOWN : FACING.UP
  }
}

/**
 * Returns a normalized unit vector for the given facing.
 *
 * @param {string} facing
 * @returns {{ x: number, y: number }}
 */
export function getFacingVector(facing) {
  switch (facing) {
    case FACING.UP:
      return { x: 0, y: -1 }
    case FACING.RIGHT:
      return { x: 1, y: 0 }
    case FACING.LEFT:
      return { x: -1, y: 0 }
    case FACING.DOWN:
    default:
      return { x: 0, y: 1 }
  }
}

