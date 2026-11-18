/**
 * Cultist AI Controller (Ashen Cultist).
 *
 * A ranged fire caster built on ArcherAI, so it keeps the same kiting,
 * line-of-sight and attack-token behavior:
 * - Holds 150-230 px from the player: advances when too far, backs away when
 *   too close, repositions when a wall blocks the shot.
 * - Throws one ember bolt per cast. The cast is the blade-swing clip. The bolt
 *   is released on the atlas hit frame (3, from meta hitFrames) and spawns at
 *   the blade tip from meta weaponTipOffsetFromFeet, per facing.
 * - Bolt art is the mage's fireball clip, scaled down. It is slower than an
 *   arrow so it can be dodged.
 * - Melee fallback: if the player is right on top of it and it is off cooldown,
 *   it swings the blade instead (Enemy's own melee path, hit on frame 3).
 *   This is what a cornered caster does when retreat is not possible.
 *
 * All numbers here are placeholders Grant can tune.
 */

import { ArcherAI, ARCHER_AI_MODES } from './archer.js'
import { Projectile } from '../actors/Projectile.js'
import { ACTOR_STATES } from '../actors/stateMachine.js'
import { DEFAULT_FACING } from '../actors/facing.js'
import { getAnimationFrameIndex, getWeaponTip } from '../combat/hitSystem.js'

export const CULTIST_AI_MODES = Object.freeze({
  ...ARCHER_AI_MODES,
  MELEE: 'MELEE',
})

export const CULTIST_MIN_DISTANCE_PX = 150
export const CULTIST_MAX_DISTANCE_PX = 230
export const CULTIST_AGGRO_RADIUS_PX = 320
export const CULTIST_COOLDOWN_MS = 2200
/** Blade swing range for the melee fallback. */
export const CULTIST_MELEE_RANGE_PX = 48

/** Attack clip timing: 7 frames, 930 ms, hit frame 3 starts at 390 ms. */
export const CULTIST_RELEASE_FRAME = 3
export const CULTIST_RELEASE_ELAPSED_MS = 390
export const CULTIST_TOTAL_ATTACK_MS = 930

/** Ember bolt, drawn with the mage fireball clips from the 'fireball' atlas. */
export const EMBER_BOLT_TEXTURE = 'fireball'
export const EMBER_BOLT_FLY_ANIM = 'fireball_fly'
export const EMBER_BOLT_HIT_ANIM = 'fireball_hit'
export const EMBER_BOLT_SCALE = 0.7

/** Fallback bolt spawn offsets from the feet if the atlas has no weapon tip. */
const FALLBACK_SPAWN = Object.freeze({
  down: { x: -19.8, y: -14.9 },
  right: { x: 30.8, y: -17.2 },
  up: { x: 19.8, y: -27.7 },
  left: { x: -30.8, y: -25.4 },
})

export class CultistAI extends ArcherAI {
  /**
   * @param {import('../actors/Enemy.js').Enemy|object} enemy
   * @param {object} [options] - { damage, arrowSpeed, arrowRange, projectileSize, ... }
   */
  constructor(enemy, options = {}) {
    super(enemy, {
      minDistance: CULTIST_MIN_DISTANCE_PX,
      maxDistance: CULTIST_MAX_DISTANCE_PX,
      aggroRadius: CULTIST_AGGRO_RADIUS_PX,
      cooldownMs: CULTIST_COOLDOWN_MS,
      ...options,
    })
    this.projectileSize = options.projectileSize ?? 14
    this.meleeRange = options.meleeRange ?? CULTIST_MELEE_RANGE_PX
  }

  /**
   * Same loop as ArcherAI, plus the melee fallback when cornered.
   *
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    const enemy = this.enemy
    if (enemy && this.hasSpawned && !this.isAttacking && this.mode !== ARCHER_AI_MODES.ALERT) {
      const player = enemy.scene?.player
      const alive = player && !player.is?.(ACTOR_STATES.DEAD) && !(typeof player.hp === 'number' && player.hp <= 0)
      if (alive && time >= (enemy.attackCooldownUntil || 0)) {
        const dx = player.x - enemy.x
        const dy = player.y - enemy.y
        if (Math.hypot(dx, dy) <= this.meleeRange && this.startMelee(dx, dy, time)) {
          return
        }
      }
    }
    super.update(time, delta)
  }

  /**
   * Starts the blade swing through the Enemy melee path.
   *
   * @param {number} dx
   * @param {number} dy
   * @param {number} time
   * @returns {boolean}
   */
  startMelee(dx, dy, time) {
    const enemy = this.enemy
    if (typeof enemy.startAttack !== 'function') return false
    const tokens = enemy.scene?.attackTokenManager
    if (tokens && !tokens.acquire(enemy)) return false
    enemy.updateFacing?.(dx, dy)
    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(0, 0)
    }
    if (!enemy.startAttack(time)) {
      tokens?.release(enemy)
      return false
    }
    this.mode = CULTIST_AI_MODES.MELEE
    return true
  }

  /**
   * Releases the bolt on the atlas hit frame, with a timing backstop.
   *
   * @param {number} time
   */
  updateAttack(time) {
    const enemy = this.enemy
    const elapsed = time - this.attackStartTime

    if (enemy.body && typeof enemy.body.setVelocity === 'function') {
      enemy.body.setVelocity(0, 0)
    }

    const releaseFrame = Array.isArray(enemy.hitFrames) && Number.isFinite(enemy.hitFrames[0])
      ? enemy.hitFrames[0]
      : CULTIST_RELEASE_FRAME
    const frameIdx = getAnimationFrameIndex(enemy.anims?.currentFrame)
    if (!this._arrowSpawned && (frameIdx === releaseFrame || elapsed >= CULTIST_RELEASE_ELAPSED_MS)) {
      this._arrowSpawned = true
      this.spawnArrow(time)
    }

    if (elapsed >= CULTIST_TOTAL_ATTACK_MS) {
      this.finishAttack(time)
    }
  }

  /**
   * Blade-tip spawn point for the current facing, from the attack sheet meta.
   *
   * @param {string} facing
   * @returns {{ x: number, y: number }}
   */
  getBoltSpawnPosition(facing) {
    const enemy = this.enemy
    const scene = enemy?.scene
    const sheet = enemy?.getSheetForAnim?.('attack') || enemy?.texture?.key
    const frame = Array.isArray(enemy?.hitFrames) && Number.isFinite(enemy.hitFrames[0]) ? enemy.hitFrames[0] : CULTIST_RELEASE_FRAME
    const tip = getWeaponTip(scene, sheet, frame, facing, 'attack') || FALLBACK_SPAWN[facing] || FALLBACK_SPAWN.down
    return { x: (enemy?.x || 0) + tip.x, y: (enemy?.y || 0) + tip.y }
  }

  /**
   * Spawns the ember bolt, aimed at the player's body.
   *
   * @param {number} _time
   * @returns {Projectile|null}
   */
  spawnArrow(_time) {
    const enemy = this.enemy
    const scene = enemy?.scene
    if (!scene) return null

    const facing = enemy.facing || DEFAULT_FACING
    const spawn = this.getBoltSpawnPosition(facing)

    let dirX = 0
    let dirY = 1
    const player = scene.player
    if (player) {
      const pdx = player.x - spawn.x
      const pdy = player.y - 12 - spawn.y
      const len = Math.hypot(pdx, pdy) || 1
      dirX = pdx / len
      dirY = pdy / len
    }

    const bolt = new Projectile(scene, spawn.x, spawn.y, EMBER_BOLT_TEXTURE, 'fireball_fly_0', {
      dirX,
      dirY,
      speed: this.arrowSpeed,
      maxDist: this.arrowRange,
      size: this.projectileSize,
      owner: 'enemy',
      shooter: enemy,
      damage: this.damage,
      flyAnim: EMBER_BOLT_FLY_ANIM,
      hitAnim: EMBER_BOLT_HIT_ANIM,
    })
    bolt.setScale?.(EMBER_BOLT_SCALE)

    if (Array.isArray(scene.projectiles)) {
      scene.projectiles.push(bolt)
    }
    return bolt
  }
}

