/**
 * Brute AI Controller.
 *
 * Implements:
 * - Patrol: Wanders when target distance > 180 px
 * - Aggro: Triggers at <= 180 px, enters chase
 * - Chase: Moves toward player at base brute speed (55 px/s)
 * - Attack: Triggers at <= 44 px if cooldown expired and attack token acquired
 * - Concurrency: Max 2 attack tokens enforced via scene.attackTokenManager
 * - Telegraph: 300 ms wind-up clip before attack swing
 * - Hit on Meta Frame: Strikes on frame 3 with knockback impulse ≈ 260 px/s
 * - Cooldown: 1600 ms base recovery between attacks
 * - Armored: Relentless juggernaut (no retreat, taking damage mid-swing does not interrupt attack)
 * - Seeded randomness: Uses client/src/game/rng.js for jitter and patrol
 */

import { random } from '../rng.js'
import { ACTOR_STATES } from '../actors/stateMachine.js'
import { resolveAnimWithFallback } from '../combat/fallbacks.js'
import { isDebug } from '../config/flags.js'

export const BRUTE_AI_MODES = Object.freeze({
  SPAWN: 'SPAWN',
  PATROL: 'PATROL',
  ALERT: 'ALERT',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
})

export const TELEGRAPH_DURATION_MS = 300
export const KNOCKBACK_IMPULSE = 260
export const COOLDOWN_MS = 1600
export const AGGRO_RADIUS_PX = 180
export const ATTACK_RANGE_PX = 44
export const BRUTE_BASE_HP = 25
export const BRUTE_BASE_SPEED = 55
export const BRUTE_BASE_DAMAGE = 12

export class BruteAI {
  /**
   * @param {import('../actors/Enemy.js').Enemy} enemy
   * @param {object} [options]
   * @param {boolean} [options.hasSpawned=false]
   * @param {boolean} [options.hasAlerted=false]
   */
  constructor(enemy, options = {}) {
    this.enemy = enemy
    this.hasSpawned = options.hasSpawned ?? false
    this.mode = this.hasSpawned ? BRUTE_AI_MODES.PATROL : BRUTE_AI_MODES.SPAWN
    this.patrolDirX = 0
    this.patrolDirY = 0
    this.nextPatrolChangeAt = 0
    this.isPatrolMoving = false

    this.spawnUntil = 0
    this.hasAlerted = options.hasAlerted ?? false
    this.alertUntil = 0

    // Initialize brute combat properties on enemy instance
    if (this.enemy) {
      this.enemy.isArmored = true
      this.enemy.telegraphDuration = TELEGRAPH_DURATION_MS
      this.enemy.baseCooldown = COOLDOWN_MS
      this.enemy.knockbackImpulse = KNOCKBACK_IMPULSE

      if (!this.hasSpawned) {
        this.enemy.playAnim?.('spawn')
      }
    }
  }

  /**
   * Per-frame AI update step.
   *
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    const enemy = this.enemy
    if (!enemy || enemy.is(ACTOR_STATES.DEAD)) {
      return
    }

    // 0. Spawn phase
    if (!this.hasSpawned) {
      if (this.spawnUntil === 0) {
        this.spawnUntil = time + 400
        enemy.playAnim?.('spawn')
      }
      if (time < this.spawnUntil) {
        this.mode = BRUTE_AI_MODES.SPAWN
        if (enemy.body && typeof enemy.body.setVelocity === 'function') {
          enemy.body.setVelocity(0, 0)
        }
        return
      }
      this.hasSpawned = true
      this.mode = BRUTE_AI_MODES.PATROL
    }

    // 0.5. Alert holding phase
    if (this.mode === BRUTE_AI_MODES.ALERT) {
      if (time < this.alertUntil) {
        if (enemy.body && typeof enemy.body.setVelocity === 'function') {
          enemy.body.setVelocity(0, 0)
        }
        return
      }
      // Alert window elapsed, proceed to chase or attack
    }

    const scene = enemy.scene
    const player = scene?.player

    // If player is missing or dead, patrol
    if (!player || player.is?.(ACTOR_STATES.DEAD) || (typeof player.hp === 'number' && player.hp <= 0)) {
      this.mode = BRUTE_AI_MODES.PATROL
      this.doPatrol(time)
      return
    }

    // 1. Measure distance to player
    const dx = player.x - enemy.x
    const dy = player.y - enemy.y
    const dist = Math.hypot(dx, dy)

    // 2. Patrol check: distance > 180 px
    if (dist > AGGRO_RADIUS_PX) {
      this.mode = BRUTE_AI_MODES.PATROL
      this.doPatrol(time)
      return
    }

    // 3. In aggro radius (<= 180 px): Play alert before first telegraph
    if (!this.hasAlerted) {
      this.hasAlerted = true
      this.mode = BRUTE_AI_MODES.ALERT
      this.alertUntil = time + 250
      enemy.updateFacing?.(dx, dy)
      if (enemy.body && typeof enemy.body.setVelocity === 'function') {
        enemy.body.setVelocity(0, 0)
      }
      const alertKey = enemy.getAnimKey?.('alert') || `goblin_brute_alert_${enemy.facing || 'down'}`
      if (enemy.animHistory) {
        enemy.animHistory.push(alertKey)
      }
      enemy.lastAnimKey = alertKey
      if (isDebug()) {
        console.log(`[Enemy anim] ${alertKey}`)
      }
      const clipToPlay = resolveAnimWithFallback(scene, alertKey, enemy.getAnimKey?.('telegraph'))
      if (clipToPlay && scene?.anims?.exists(clipToPlay)) {
        try {
          enemy.anims?.play?.(clipToPlay, true)
        } catch (_e) {}
      }
      return
    }

    // 4. Aggro engagement: attack or chase
    if (dist <= ATTACK_RANGE_PX) {
      this.mode = BRUTE_AI_MODES.ATTACK
      this.doAttackOrWait(player, dx, dy, time)
    } else {
      this.mode = BRUTE_AI_MODES.CHASE
      this.doChase(player, dx, dy, dist)
    }
  }

  /**
   * Patrol behavior: wanders around using seeded PRNG.
   *
   * @param {number} time
   */
  doPatrol(time) {
    const enemy = this.enemy

    if (time >= this.nextPatrolChangeAt) {
      // 50% chance to pause/stand idle, 50% chance to wander
      this.isPatrolMoving = random() > 0.5
      if (this.isPatrolMoving) {
        const angle = random() * Math.PI * 2
        this.patrolDirX = Math.cos(angle)
        this.patrolDirY = Math.sin(angle)
      } else {
        this.patrolDirX = 0
        this.patrolDirY = 0
      }
      this.nextPatrolChangeAt = time + 1400 + random() * 1600
    }

    if (this.isPatrolMoving && (this.patrolDirX !== 0 || this.patrolDirY !== 0)) {
      const patrolSpeed = (enemy.speed || BRUTE_BASE_SPEED) * 0.5
      if (enemy.body && typeof enemy.body.setVelocity === 'function') {
        enemy.body.setVelocity(this.patrolDirX * patrolSpeed, this.patrolDirY * patrolSpeed)
      }
      enemy.updateFacing(this.patrolDirX, this.patrolDirY)
      enemy.transition(ACTOR_STATES.WALK)
      enemy.playAnim('walk')
    } else {
      if (enemy.body && typeof enemy.body.setVelocity === 'function') {
        enemy.body.setVelocity(0, 0)
      }
      enemy.transition(ACTOR_STATES.IDLE)
      enemy.playAnim('idle')
    }
  }

  /**
   * Chase behavior: relentlessly pursues the player at base movement speed.
   *
   * @param {object} player
   * @param {number} dx
   * @param {number} dy
   * @param {number} dist
   */
  doChase(player, dx, dy, dist) {
    const enemy = this.enemy
    const len = dist || 1
    const vx = (dx / len) * (enemy.speed || BRUTE_BASE_SPEED)
    const vy = (dy / len) * (enemy.speed || BRUTE_BASE_SPEED)

    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(vx, vy)
    }

    enemy.updateFacing(dx, dy)
    enemy.transition(ACTOR_STATES.WALK)
    enemy.playAnim('walk')
  }

  /**
   * Attack or Wait behavior: within attack range (44 px).
   *
   * @param {object} player
   * @param {number} dx
   * @param {number} dy
   * @param {number} time
   */
  doAttackOrWait(player, dx, dy, time) {
    const enemy = this.enemy

    // Face player
    enemy.updateFacing(dx, dy)

    // Halt movement while in attack proximity
    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(0, 0)
    }

    // Check cooldown
    if (time < enemy.attackCooldownUntil) {
      enemy.transition(ACTOR_STATES.IDLE)
      enemy.playAnim('idle')
      return
    }

    // Attempt to acquire attack token from scene coordinator
    const tokenManager = enemy.scene?.attackTokenManager
    const canAttack = tokenManager ? tokenManager.acquire(enemy) : true

    if (canAttack) {
      enemy.startAttack(time)
    } else {
      // Cannot attack right now due to token capacity
      enemy.transition(ACTOR_STATES.IDLE)
      enemy.playAnim('idle')
    }
  }
}
