/**
 * Wolf AI Controller (Shadowfang Wolf).
 *
 * A fast melee pouncer built on GoblinAI's patrol / alert / chase / attack
 * loop. What is different:
 * - Wider senses: aggro at 230 px, and it starts a bite from 76 px out.
 * - Telegraph is the clip itself. The wolf has no separate telegraph sheet; the
 *   first two attack frames (crouch, then rear back, 320 ms) are the warning.
 * - Lunge: Enemy.update asks attackVelocity() each frame of the swing. Between
 *   LUNGE_START_MS and LUNGE_END_MS the wolf is driven along its facing, so the
 *   jaws arrive at hit frame 3 (390 ms) already on top of the target. Outside
 *   that window it holds still, like every other melee swing.
 * - Feral: no retreat at low HP (retreatHpRatio 0).
 * - Short recovery: a bite is followed by 750 ms (+ jitter) of cooldown, not
 *   the goblin's 900 ms. During cooldown the mode is COOLDOWN: it waits, and if
 *   the lunge left it on top of the player it steps back to 44 px first
 *   (hit and run). Nothing in the game collides enemies with the player.
 *
 * All numbers here are placeholders Grant can tune.
 */

import { GoblinAI, GOBLIN_AI_MODES } from './goblin.js'
import { ACTOR_STATES } from '../actors/stateMachine.js'

export const WOLF_AI_MODES = Object.freeze({
  ...GOBLIN_AI_MODES,
  COOLDOWN: 'COOLDOWN',
})

export const WOLF_AGGRO_RADIUS_PX = 230
export const WOLF_ATTACK_RANGE_PX = 76
export const WOLF_COOLDOWN_MS = 750

/** Lunge window, ms after the swing starts. Hit frame 3 begins at 390 ms. */
export const LUNGE_START_MS = 280
export const LUNGE_END_MS = 400
/** Lunge speed (px/s). About 46 px of travel over the window. */
export const LUNGE_SPEED = 380
/** The lunge stops this far (px) short of the player's feet, so it does not run through them. */
export const LUNGE_STOP_PX = 30
/** During cooldown the wolf steps back if the player is closer than this (px). */
export const WOLF_BACKOFF_PX = 44

const FACING_VECTORS = Object.freeze({
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
})

export class WolfAI extends GoblinAI {
  /**
   * @param {import('../actors/Enemy.js').Enemy} enemy
   * @param {object} [options]
   */
  constructor(enemy, options = {}) {
    super(enemy, {
      // No alert clip and no reason to stand still: the pack hunter closes at once.
      hasAlerted: true,
      aggroRadius: WOLF_AGGRO_RADIUS_PX,
      attackRange: WOLF_ATTACK_RANGE_PX,
      retreatHpRatio: 0,
      ...options,
    })
    if (this.enemy) {
      this.enemy.baseCooldown = WOLF_COOLDOWN_MS
    }
  }

  /**
   * Velocity the Enemy should apply this frame while its swing is running.
   * Called by Enemy.update. Null means hold still.
   *
   * @param {number} time
   * @returns {{ x: number, y: number }|null}
   */
  attackVelocity(time) {
    const enemy = this.enemy
    if (!enemy || !enemy.isAttacking || enemy.attackPhase !== 'swing') return null
    const t = time - enemy.swingStartTime
    if (t < LUNGE_START_MS || t >= LUNGE_END_MS) return null
    if (this._lungeSwing !== enemy.swingStartTime) {
      // First lunge frame of this swing: size the lunge to the gap that is left.
      this._lungeSwing = enemy.swingStartTime
      const player = enemy.scene?.player
      const gap = player ? Math.hypot(player.x - enemy.x, player.y - enemy.y) - LUNGE_STOP_PX : Infinity
      const windowS = (LUNGE_END_MS - LUNGE_START_MS) / 1000
      this._lungeSpeed = Math.max(0, Math.min(LUNGE_SPEED, gap / windowS))
    }
    const [vx, vy] = FACING_VECTORS[enemy.facing] || FACING_VECTORS.down
    return { x: vx * this._lungeSpeed, y: vy * this._lungeSpeed }
  }

  /**
   * In bite range: bite when ready, otherwise wait out the cooldown.
   *
   * @param {object} player
   * @param {number} dx
   * @param {number} dy
   * @param {number} time
   */
  doAttackOrWait(player, dx, dy, time) {
    const enemy = this.enemy
    const onCooldown = time < enemy.attackCooldownUntil
    this.mode = onCooldown ? WOLF_AI_MODES.COOLDOWN : WOLF_AI_MODES.ATTACK
    const dist = Math.hypot(dx, dy)
    if (onCooldown && dist < WOLF_BACKOFF_PX) {
      this.backOff(dx, dy, dist)
      return
    }
    super.doAttackOrWait(player, dx, dy, time)
  }

  /**
   * Steps away from the player while still facing it.
   *
   * @param {number} dx - player.x - enemy.x
   * @param {number} dy - player.y - enemy.y
   * @param {number} dist
   */
  backOff(dx, dy, dist) {
    const enemy = this.enemy
    let ux = dist > 1 ? dx / dist : 0
    let uy = dist > 1 ? dy / dist : 0
    if (dist <= 1) {
      // Standing exactly on the player: back out the way it is facing.
      const [fx, fy] = FACING_VECTORS[enemy.facing] || FACING_VECTORS.down
      ux = fx
      uy = fy
    }
    const speed = (enemy.speed || 100) * 0.7
    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(-ux * speed, -uy * speed)
    }
    if (dist > 1) enemy.updateFacing(dx, dy)
    enemy.transition(ACTOR_STATES.WALK)
    enemy.playAnim('walk')
  }
}
