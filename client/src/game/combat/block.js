/**
 * Shield block mechanics module for Heroes of Hollowvale.
 *
 * Implements:
 * - Knight-exclusive shield blocking
 * - 70% frontal damage reduction
 * - 120-degree frontal protection arc centered on facing direction
 * - Recoil knockback on blocked hits (knockbackPx: 3)
 */

export const BLOCK_DAMAGE_REDUCTION = 0.70
export const BLOCK_ARC_DEG = 120
export const BLOCK_KNOCKBACK_PX = 3

/** Facing angle mapping in degrees (0 = right, 90 = down, 180 = left, -90 = up) */
export const FACING_ANGLES_DEG = Object.freeze({
  right: 0,
  down: 90,
  left: 180,
  up: -90,
})

/**
 * Normalizes an angle difference to the range [-180, 180] degrees.
 *
 * @param {number} angleDeg
 * @returns {number}
 */
export function normalizeAngleDeg(angleDeg) {
  let a = angleDeg % 360
  if (a > 180) a -= 360
  if (a < -180) a += 360
  return a
}

/**
 * Determines whether an attacker position lies within the player's frontal block arc.
 *
 * @param {string} playerFacing - 'down' | 'left' | 'right' | 'up'
 * @param {{ x: number, y: number }} playerPos - Player world position
 * @param {{ x: number, y: number }} attackerPos - Attacker world position
 * @param {number} [arcDeg=BLOCK_ARC_DEG] - Frontal protection cone in degrees (default 120)
 * @returns {boolean} - True if hit arrives within frontal cone, false if struck from behind/flank
 */
export function isFrontalHit(playerFacing, playerPos, attackerPos, arcDeg = BLOCK_ARC_DEG) {
  if (!playerPos || !attackerPos) {
    // If attacker position unknown, default to frontal for safety
    return true
  }

  const dx = attackerPos.x - playerPos.x
  const dy = attackerPos.y - playerPos.y

  if (Math.hypot(dx, dy) < 0.001) {
    return true
  }

  // Angle from player to attacker
  const angleToAttackerDeg = (Math.atan2(dy, dx) * 180) / Math.PI
  const facingDeg = FACING_ANGLES_DEG[playerFacing] ?? 90

  const diff = Math.abs(normalizeAngleDeg(angleToAttackerDeg - facingDeg))
  const halfArc = arcDeg / 2

  return diff <= halfArc
}

/**
 * Calculates damage mitigation when a player is in the BLOCK state.
 *
 * @param {object} player - Player instance
 * @param {number} rawDamage - Incoming raw damage
 * @param {{ x: number, y: number }} [attackerPos] - Attacker position
 * @param {number} [arcDeg=BLOCK_ARC_DEG]
 * @returns {{ blocked: boolean, isFrontal: boolean, finalDamage: number, knockbackPx: number }}
 */
export function calculateBlockMitigation(player, rawDamage, attackerPos = null, arcDeg = BLOCK_ARC_DEG) {
  if (!player) {
    return { blocked: false, isFrontal: false, finalDamage: rawDamage, knockbackPx: 0 }
  }

  const isKnight = player.classId === 'knight'
  const isBlocking = player.isBlocking ? player.isBlocking() : false

  if (!isKnight || !isBlocking) {
    return { blocked: false, isFrontal: false, finalDamage: rawDamage, knockbackPx: 0 }
  }

  const playerPos = { x: player.x, y: player.y }
  const frontal = attackerPos ? isFrontalHit(player.facing, playerPos, attackerPos, arcDeg) : true

  if (frontal) {
    // 70% reduction: player takes 30% of incoming damage
    const reduced = Math.max(1, Math.round(rawDamage * (1 - BLOCK_DAMAGE_REDUCTION)))
    return {
      blocked: true,
      isFrontal: true,
      finalDamage: reduced,
      knockbackPx: BLOCK_KNOCKBACK_PX,
    }
  }

  // Struck from behind: no mitigation
  return {
    blocked: false,
    isFrontal: false,
    finalDamage: rawDamage,
    knockbackPx: 0,
  }
}

