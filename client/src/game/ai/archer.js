/**
 * Archer AI Controller — Package 1b-3.
 *
 * Implements:
 * - Kiting / Distance Keeping: Maintains 140–220 px optimal firing range.
 *   - Distance > 220 px: Advances towards player.
 *   - Distance < 140 px: Retreats / kites away from player.
 *   - Distance 140–220 px: In firing position.
 * - Line of Sight (LoS): Raycasts against world colliders (scene._solidRects).
 *   - Archer will not fire through walls or obstacles.
 *   - Repositions if line of sight is obstructed.
 * - Meta-accurate Spawning & Frame Durations:
 *   - Per-frame durations: [120, 100, 100, 120, 250, 70, 100, 120] ms
 *   - Frame 6 release at 760 ms elapsed. Total duration 980 ms.
 *   - spawnOffsetFromFeet per facing (down, right, up, left) within +-2 px.
 * - Atlas Arrow Projectile:
 *   - Speed: 300 px/s
 *   - Range / maxDist: 400 px
 *   - Cooldown: 1800 ms
 *   - Impact animation: goblin_archer_arrow_impact on hit.
 */

import { random } from '../rng.js'
import { ACTOR_STATES } from '../actors/stateMachine.js'
import { resolveFacing, DEFAULT_FACING } from '../actors/facing.js'
import { Projectile } from '../actors/Projectile.js'

export const ARCHER_AI_MODES = Object.freeze({
  PATROL: 'PATROL',
  ADVANCE: 'ADVANCE',
  RETREAT: 'RETREAT',
  AIM: 'AIM',
  ATTACK: 'ATTACK',
  REPOSITION: 'REPOSITION',
})

// Distance thresholds (px)
export const MIN_DISTANCE_PX = 140
export const MAX_DISTANCE_PX = 220
export const AGGRO_RADIUS_PX = 320

// Projectile & Combat parameters
export const ARROW_SPEED = 300
export const ARROW_RANGE = 400
export const ATTACK_COOLDOWN_MS = 1800

// Animation & Meta timing
export const RELEASE_FRAME = 6
export const RELEASE_ELAPSED_MS = 760
export const TOTAL_ATTACK_DURATION_MS = 980
export const FRAME_DURATIONS_MS = Object.freeze([120, 100, 100, 120, 250, 70, 100, 120])

// Spawn offsets relative to feet pivot from goblin_archer.json / attack_spawn.json
export const SPAWN_OFFSETS = Object.freeze({
  down: Object.freeze({ x: -3.5, y: -26.0 }),
  right: Object.freeze({ x: 27.5, y: -31.0 }),
  up: Object.freeze({ x: 3.5, y: -37.4 }),
  left: Object.freeze({ x: -27.5, y: -32.4 }),
})

/**
 * Checks whether a 2D line segment intersects an axis-aligned bounding box (AABB).
 * Uses the Liang-Barsky parametric clipping algorithm.
 *
 * @param {number} x1 - Segment start X
 * @param {number} y1 - Segment start Y
 * @param {number} x2 - Segment end X
 * @param {number} y2 - Segment end Y
 * @param {{ x: number, y: number, w: number, h: number }} rect - AABB collider
 * @returns {boolean} - True if segment intersects or is contained within rect
 */
export function lineIntersectsRect(x1, y1, x2, y2, rect) {
  if (!rect) return false

  const rx1 = rect.x
  const ry1 = rect.y
  const rx2 = rect.x + rect.w
  const ry2 = rect.y + rect.h

  // Quick bounding rejection
  if ((x1 < rx1 && x2 < rx1) || (x1 > rx2 && x2 > rx2) ||
      (y1 < ry1 && y2 < ry1) || (y1 > ry2 && y2 > ry2)) {
    return false
  }

  // Check if either endpoint is inside the rectangle
  if (x1 >= rx1 && x1 <= rx2 && y1 >= ry1 && y1 <= ry2) return true
  if (x2 >= rx1 && x2 <= rx2 && y2 >= ry1 && y2 <= ry2) return true

  const dx = x2 - x1
  const dy = y2 - y1

  let t0 = 0
  let t1 = 1

  const p = [-dx, dx, -dy, dy]
  const q = [x1 - rx1, rx2 - x1, y1 - ry1, ry2 - y1]

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        if (t > t1) return false
        if (t > t0) t0 = t
      } else {
        if (t < t0) return false
        if (t < t1) t1 = t
      }
    }
  }

  return t0 <= t1
}

/**
 * Checks line of sight between two points against a list of solid obstacles.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {Array<{ x: number, y: number, w: number, h: number }>} solids
 * @returns {boolean} - True if line of sight is unobstructed
 */
export function hasLineOfSight(x1, y1, x2, y2, solids = []) {
  if (!Array.isArray(solids) || solids.length === 0) return true
  for (let i = 0; i < solids.length; i++) {
    if (lineIntersectsRect(x1, y1, x2, y2, solids[i])) {
      return false
    }
  }
  return true
}

/**
 * Resolves the arrow spawn position from archer feet position and facing.
 *
 * @param {{ x: number, y: number }} archer
 * @param {string} [facing='down']
 * @returns {{ x: number, y: number }}
 */
export function getArrowSpawnPosition(archer, facing = 'down') {
  const offset = SPAWN_OFFSETS[facing] || SPAWN_OFFSETS.down
  return {
    x: (archer?.x || 0) + offset.x,
    y: (archer?.y || 0) + offset.y,
  }
}

/**
 * Converts cardinal facing direction to unit velocity vector [dx, dy].
 *
 * @param {string} facing
 * @returns {[number, number]}
 */
export function facingToVector(facing) {
  switch (facing) {
    case 'left': return [-1, 0]
    case 'right': return [1, 0]
    case 'up': return [0, -1]
    case 'down':
    default:
      return [0, 1]
  }
}

export class ArcherAI {
  /**
   * @param {import('../actors/Enemy.js').Enemy|object} enemy - Controlled enemy entity
   * @param {object} [options] - Configuration options
   */
  constructor(enemy, options = {}) {
    this.enemy = enemy
    this.mode = ARCHER_AI_MODES.PATROL

    this.minDistance = options.minDistance ?? MIN_DISTANCE_PX
    this.maxDistance = options.maxDistance ?? MAX_DISTANCE_PX
    this.aggroRadius = options.aggroRadius ?? AGGRO_RADIUS_PX
    this.cooldownMs = options.cooldownMs ?? ATTACK_COOLDOWN_MS
    this.arrowSpeed = options.arrowSpeed ?? ARROW_SPEED
    this.arrowRange = options.arrowRange ?? ARROW_RANGE
    this.damage = options.damage ?? 10

    this.attackCooldownUntil = 0
    this.isAttacking = false
    this.attackStartTime = 0
    this._arrowSpawned = false

    // Patrol wandering state
    this.patrolDirX = 0
    this.patrolDirY = 0
    this.nextPatrolChangeAt = 0
    this.isPatrolMoving = false

    // Reposition state for LoS recovery
    this.repositionDirX = 0
    this.repositionDirY = 0
    this.repositionUntil = 0
  }

  /**
   * Per-frame AI update step.
   *
   * @param {number} time - Current timestamp in ms
   * @param {number} delta - Delta time in ms
   */
  update(time, delta) {
    const enemy = this.enemy
    if (!enemy || enemy.is?.(ACTOR_STATES.DEAD) || (typeof enemy.hp === 'number' && enemy.hp <= 0)) {
      return
    }

    // 1. If currently in attack animation sequence, manage timing and arrow release
    if (this.isAttacking) {
      this.updateAttack(time)
      return
    }

    const scene = enemy.scene
    const player = scene?.player

    // If target is missing or dead, revert to patrol
    if (!player || player.is?.(ACTOR_STATES.DEAD) || (typeof player.hp === 'number' && player.hp <= 0)) {
      this.mode = ARCHER_AI_MODES.PATROL
      this.doPatrol(time)
      return
    }

    // 2. Measure distance and direction to player
    const dx = player.x - enemy.x
    const dy = player.y - enemy.y
    const dist = Math.hypot(dx, dy)

    // Check aggro radius
    if (dist > this.aggroRadius) {
      this.mode = ARCHER_AI_MODES.PATROL
      this.doPatrol(time)
      return
    }

    // Facing follows target with dominant axis
    const facing = resolveFacing(dx, dy, enemy.facing || DEFAULT_FACING)
    enemy.facing = facing

    // 3. Line of sight check
    const solids = scene?._solidRects || []
    const hasLos = hasLineOfSight(enemy.x, enemy.y, player.x, player.y, solids)

    // 4. Kiting / Distance Keeping
    if (dist > this.maxDistance) {
      // Too far: advance toward player
      this.mode = ARCHER_AI_MODES.ADVANCE
      this.doMoveTowards(dx, dy, dist, 1)
    } else if (dist < this.minDistance) {
      // Too close: retreat / kite away from player
      this.mode = ARCHER_AI_MODES.RETREAT
      this.doMoveTowards(dx, dy, dist, -1)
    } else {
      // In optimal firing zone [140, 220] px
      if (!hasLos) {
        // Line of sight blocked by colliders: archer does NOT shoot through walls!
        this.mode = ARCHER_AI_MODES.REPOSITION
        this.doReposition(dx, dy, dist, time)
      } else {
        // Clear shot with line of sight
        this.stopMovement()

        if (time >= this.attackCooldownUntil) {
          // Check attack token coordination if manager exists
          if (scene?.attackTokenManager) {
            const tm = scene.attackTokenManager
            const hasToken = typeof tm.acquire === 'function' ? tm.acquire(enemy) : (typeof tm.request === 'function' ? tm.request(enemy) : true)
            if (hasToken) {
              this.startAttack(time)
            } else {
              this.mode = ARCHER_AI_MODES.AIM
            }
          } else {
            this.startAttack(time)
          }
        } else {
          this.mode = ARCHER_AI_MODES.AIM
          if (enemy.playAnim && typeof enemy.playAnim === 'function') {
            enemy.playAnim('idle')
          }
        }
      }
    }
  }

  /**
   * Advances or retreats towards/away from target.
   *
   * @param {number} dx
   * @param {number} dy
   * @param {number} dist
   * @param {number} directionMultiplier - 1 for advance, -1 for retreat
   */
  doMoveTowards(dx, dy, dist, directionMultiplier = 1) {
    const enemy = this.enemy
    const speed = enemy.speed || 60
    const safeDist = dist || 1

    const vx = (dx / safeDist) * speed * directionMultiplier
    const vy = (dy / safeDist) * speed * directionMultiplier

    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(vx, vy)
    }

    if (enemy.transition && typeof enemy.transition === 'function') {
      enemy.transition(ACTOR_STATES.WALK)
    }
    if (enemy.playAnim && typeof enemy.playAnim === 'function') {
      enemy.playAnim('walk')
    }
  }

  /**
   * Repositions when in range but blocked by world colliders.
   * Maneuvers perpendicular to player to flank the obstacle and regain line of sight.
   *
   * @param {number} dx
   * @param {number} dy
   * @param {number} dist
   * @param {number} time
   */
  doReposition(dx, dy, dist, time) {
    const enemy = this.enemy
    const speed = (enemy.speed || 60) * 0.85
    const safeDist = dist || 1

    if (time >= this.repositionUntil) {
      // Pick a perpendicular flanking direction
      const sign = random() < 0.5 ? 1 : -1
      this.repositionDirX = (-dy / safeDist) * sign
      this.repositionDirY = (dx / safeDist) * sign
      this.repositionUntil = time + 600 + Math.floor(random() * 400)
    }

    const vx = this.repositionDirX * speed
    const vy = this.repositionDirY * speed

    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(vx, vy)
    }

    if (enemy.transition && typeof enemy.transition === 'function') {
      enemy.transition(ACTOR_STATES.WALK)
    }
    if (enemy.playAnim && typeof enemy.playAnim === 'function') {
      enemy.playAnim('walk')
    }
  }

  /**
   * Stops physics movement.
   */
  stopMovement() {
    const enemy = this.enemy
    if (enemy?.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(0, 0)
    }
    if (enemy?.transition && typeof enemy.transition === 'function') {
      enemy.transition(ACTOR_STATES.IDLE)
    }
  }

  /**
   * Initiates attack animation sequence.
   *
   * @param {number} time
   * @returns {boolean}
   */
  startAttack(time) {
    const enemy = this.enemy
    if (!enemy || enemy.is?.(ACTOR_STATES.DEAD) || enemy.is?.(ACTOR_STATES.HURT)) {
      return false
    }

    this.isAttacking = true
    this.attackStartTime = time
    this._arrowSpawned = false
    this.mode = ARCHER_AI_MODES.ATTACK

    this.stopMovement()

    if (enemy.transition && typeof enemy.transition === 'function') {
      enemy.transition(ACTOR_STATES.ATTACK, { time })
    }
    if (enemy.playAnim && typeof enemy.playAnim === 'function') {
      enemy.playAnim('attack', false)
    }

    return true
  }

  /**
   * Advances attack timer, releases arrow on frame 6, and completes attack.
   *
   * @param {number} time
   */
  updateAttack(time) {
    const enemy = this.enemy
    const elapsed = time - this.attackStartTime

    // Ensure velocity remains 0 during attack
    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(0, 0)
    }

    // Check for frame 6 release:
    // Either by current animation frame index === 6, or by elapsed time >= RELEASE_ELAPSED_MS (760 ms)
    const currentFrameIdx = enemy.anims?.currentFrame?.index ?? -1
    const isReleaseFrame = currentFrameIdx === RELEASE_FRAME || elapsed >= RELEASE_ELAPSED_MS

    if (isReleaseFrame && !this._arrowSpawned) {
      this._arrowSpawned = true
      this.spawnArrow(time)
    }

    // Conclude attack when total animation duration finishes
    if (elapsed >= TOTAL_ATTACK_DURATION_MS) {
      this.finishAttack(time)
    }
  }

  /**
   * Spawns arrow projectile with exact metadata offsets and trajectory.
   *
   * @param {number} time
   * @returns {Projectile|null}
   */
  spawnArrow(time) {
    const enemy = this.enemy
    const scene = enemy?.scene
    if (!scene) return null

    const facing = enemy.facing || DEFAULT_FACING
    const spawnPos = getArrowSpawnPosition(enemy, facing)

    // Calculate aim direction: aim directly towards player center
    const player = scene.player
    let dirX = 0
    let dy = 0
    if (player) {
      const pdx = player.x - spawnPos.x
      const pdy = player.y - spawnPos.y
      const plen = Math.hypot(pdx, pdy) || 1
      dirX = pdx / plen
      dy = pdy / plen
    } else {
      const vec = facingToVector(facing)
      dirX = vec[0]
      dy = vec[1]
    }

    // Atlas arrow frame and impact anim
    const sheetKey = enemy.texture?.key || 'goblin_archer'
    const initialFrame = `${sheetKey}_arrow_${facing}`
    const hitAnim = `${sheetKey}_arrow_impact`

    const projectile = new Projectile(scene, spawnPos.x, spawnPos.y, sheetKey, initialFrame, {
      dirX,
      dirY: dy,
      speed: this.arrowSpeed,
      maxDist: this.arrowRange,
      size: 16,
      owner: 'enemy',
      shooter: enemy,
      damage: this.damage,
      hitAnim,
    })

    if (Array.isArray(scene.projectiles)) {
      scene.projectiles.push(projectile)
    }

    return projectile
  }

  /**
   * Concludes attack, sets cooldown, and returns to IDLE.
   *
   * @param {number} time
   */
  finishAttack(time) {
    this.isAttacking = false
    this.attackCooldownUntil = time + this.cooldownMs

    const enemy = this.enemy
    const scene = enemy?.scene

    // Release attack token
    if (scene?.attackTokenManager) {
      scene.attackTokenManager.release(enemy)
    }

    if (!enemy.is?.(ACTOR_STATES.DEAD)) {
      if (enemy.transition && typeof enemy.transition === 'function') {
        enemy.transition(ACTOR_STATES.IDLE, { force: true })
      }
      if (enemy.playAnim && typeof enemy.playAnim === 'function') {
        enemy.playAnim('idle')
      }
    }
  }

  /**
   * Interrupts an ongoing attack (e.g. when taking damage / knocked back).
   *
   * @param {number} time
   */
  interruptAttack(time) {
    if (!this.isAttacking) return

    this.isAttacking = false
    this.attackCooldownUntil = time + 600

    const enemy = this.enemy
    const scene = enemy?.scene
    if (scene?.attackTokenManager) {
      scene.attackTokenManager.release(enemy)
    }
  }

  /**
   * Wanders periodically using seeded PRNG.
   *
   * @param {number} time
   */
  doPatrol(time) {
    const enemy = this.enemy
    if (time >= this.nextPatrolChangeAt) {
      this.isPatrolMoving = random() > 0.4
      if (this.isPatrolMoving) {
        const angle = random() * Math.PI * 2
        this.patrolDirX = Math.cos(angle)
        this.patrolDirY = Math.sin(angle)
      } else {
        this.patrolDirX = 0
        this.patrolDirY = 0
      }
      this.nextPatrolChangeAt = time + 1200 + Math.floor(random() * 1500)
    }

    if (this.isPatrolMoving) {
      const speed = (enemy.speed || 60) * 0.5
      if (enemy.body && typeof enemy.body.setVelocity === 'function') {
        enemy.body.setVelocity(this.patrolDirX * speed, this.patrolDirY * speed)
      }
      enemy.facing = resolveFacing(this.patrolDirX, this.patrolDirY, enemy.facing || DEFAULT_FACING)
      if (enemy.transition && typeof enemy.transition === 'function') {
        enemy.transition(ACTOR_STATES.WALK)
      }
      if (enemy.playAnim && typeof enemy.playAnim === 'function') {
        enemy.playAnim('walk')
      }
    } else {
      this.stopMovement()
      if (enemy.playAnim && typeof enemy.playAnim === 'function') {
        enemy.playAnim('idle')
      }
    }
  }
}
