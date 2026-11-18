/**
 * Goblin AI Controller.
 *
 * Implements:
 * - Patrol: Wanders when target distance > 160 px
 * - Aggro: Triggers at <= 160 px, enters chase
 * - Chase: Moves toward player at base speed
 * - Attack: Triggers at <= 36 px if cooldown expired and attack token acquired
 * - Concurrency: Max 2 attack tokens enforced via scene.attackTokenManager
 * - Retreat: Flees away from player when HP < 25%
 * - Seeded randomness: Uses client/src/game/rng.js for jitter and patrol
 */

import { random } from '../rng.js'
import { ACTOR_STATES } from '../actors/stateMachine.js'
import { resolveAnimWithFallback } from '../combat/fallbacks.js'
import { isDebug } from '../config/flags.js'

export const GOBLIN_AI_MODES = Object.freeze({
  SPAWN: 'SPAWN',
  PATROL: 'PATROL',
  ALERT: 'ALERT',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  RETREAT: 'RETREAT',
})

export const AGGRO_RADIUS_PX = 160
export const ATTACK_RANGE_PX = 36
export const RETREAT_HP_RATIO = 0.25

export class GoblinAI {
  /**
   * @param {import('../actors/Enemy.js').Enemy} enemy
   * @param {object} [options]
   * @param {boolean} [options.hasSpawned=false]
   * @param {boolean} [options.hasAlerted=false]
   */
  constructor(enemy, options = {}) {
    this.enemy = enemy
    this.hasSpawned = options.hasSpawned ?? false
    this.mode = this.hasSpawned ? GOBLIN_AI_MODES.PATROL : GOBLIN_AI_MODES.SPAWN

    // Ranges are per-instance so a subclass (WolfAI) can reuse this controller
    // with its own numbers. The defaults are the goblin's.
    this.aggroRadius = options.aggroRadius ?? AGGRO_RADIUS_PX
    this.attackRange = options.attackRange ?? ATTACK_RANGE_PX
    this.retreatHpRatio = options.retreatHpRatio ?? RETREAT_HP_RATIO
    this.patrolDirX = 0
    this.patrolDirY = 0
    this.nextPatrolChangeAt = 0
    this.isPatrolMoving = false

    this.spawnUntil = 0
    this.hasAlerted = options.hasAlerted ?? false
    this.alertUntil = 0

    if (this.enemy && !this.hasSpawned) {
      this.enemy.playAnim?.('spawn')
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
        this.mode = GOBLIN_AI_MODES.SPAWN
        if (enemy.body && typeof enemy.body.setVelocity === 'function') {
          enemy.body.setVelocity(0, 0)
        }
        return
      }
      this.hasSpawned = true
      this.mode = GOBLIN_AI_MODES.PATROL
    }

    // 0.5. Alert holding phase
    if (this.mode === GOBLIN_AI_MODES.ALERT) {
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
      this.mode = GOBLIN_AI_MODES.PATROL
      this.doPatrol(time)
      return
    }

    // 1. Retreat check: HP < 25%
    const hpRatio = enemy.hp / (enemy.hpMax || 1)
    if (hpRatio < this.retreatHpRatio) {
      this.mode = GOBLIN_AI_MODES.RETREAT
      this.doRetreat(player, time)
      return
    }

    // 2. Measure distance to player
    const dx = player.x - enemy.x
    const dy = player.y - enemy.y
    const dist = Math.hypot(dx, dy)

    // 3. Patrol check: distance > 160 px
    if (dist > this.aggroRadius) {
      this.mode = GOBLIN_AI_MODES.PATROL
      this.doPatrol(time)
      return
    }

    // 4. In aggro radius (<= 160 px): Play alert before first telegraph
    if (!this.hasAlerted) {
      this.hasAlerted = true
      this.mode = GOBLIN_AI_MODES.ALERT
      this.alertUntil = time + 250
      enemy.updateFacing?.(dx, dy)
      if (enemy.body && typeof enemy.body.setVelocity === 'function') {
        enemy.body.setVelocity(0, 0)
      }
      const alertKey = enemy.getAnimKey?.('alert') || `goblin_alert_${enemy.facing || 'down'}`
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

    // 5. Aggro engagement: attack or chase
    if (dist <= this.attackRange) {
      this.mode = GOBLIN_AI_MODES.ATTACK
      this.doAttackOrWait(player, dx, dy, time)
    } else {
      this.mode = GOBLIN_AI_MODES.CHASE
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
      // 40% chance to pause/stand idle, 60% chance to wander
      this.isPatrolMoving = random() > 0.4
      if (this.isPatrolMoving) {
        const angle = random() * Math.PI * 2
        this.patrolDirX = Math.cos(angle)
        this.patrolDirY = Math.sin(angle)
      } else {
        this.patrolDirX = 0
        this.patrolDirY = 0
      }
      this.nextPatrolChangeAt = time + 1200 + random() * 1500
    }

    if (this.isPatrolMoving && (this.patrolDirX !== 0 || this.patrolDirY !== 0)) {
      const patrolSpeed = (enemy.speed || 70) * 0.5
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
   * Chase behavior: pursues the player at base movement speed.
   *
   * @param {object} player
   * @param {number} dx
   * @param {number} dy
   * @param {number} dist
   */
  doChase(player, dx, dy, dist) {
    const enemy = this.enemy
    const len = dist || 1
    const vx = (dx / len) * (enemy.speed || 70)
    const vy = (dy / len) * (enemy.speed || 70)

    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(vx, vy)
    }

    enemy.updateFacing(dx, dy)
    enemy.transition(ACTOR_STATES.WALK)
    enemy.playAnim('walk')
  }

  /**
   * Attack or Wait behavior: within 36 px attack range.
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
      // Cannot attack right now due to token capacity (max 2 active)
      enemy.transition(ACTOR_STATES.IDLE)
      enemy.playAnim('idle')
    }
  }

  /**
   * Retreat behavior: flees in the opposite direction from the player.
   *
   * @param {object} player
   * @param {number} time
   */
  doRetreat(player, time) {
    const enemy = this.enemy
    let rx = enemy.x - player.x
    let ry = enemy.y - player.y
    const dist = Math.hypot(rx, ry) || 1
    rx /= dist
    ry /= dist

    const retreatSpeed = (enemy.speed || 70) * 0.9
    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(rx * retreatSpeed, ry * retreatSpeed)
    }

    enemy.updateFacing(rx, ry)
    enemy.transition(ACTOR_STATES.WALK)
    enemy.playAnim('walk')
  }
}
