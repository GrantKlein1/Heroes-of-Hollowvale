/**
 * critter.js — Ambient Wildlife AI for Heroes of Hollowvale.
 * Package 1b-4: Lane D Enemies.
 *
 * Implements:
 * - Ambient wildlife AI for squirrels, birds, and rats.
 * - Threat detection (player proximity within alert radius).
 * - Flee behavior directing movement away from the threat vector.
 * - Directional clip selection: Uses Left/Right facings; dynamically uses
 *   Up/Down facings when present in the manifest (e.g. run/fly/scurry).
 */

import { random } from '../rng.js'

/**
 * Supported wildlife archetypes and their configuration.
 */
export const CRITTER_CONFIGS = Object.freeze({
  squirrel_red: {
    moveAction: 'run',
    speed: 95,
    alertRadius: 100,
    escapeRadius: 220,
    hasVerticalMove: true,
    hasAlert: true,
  },
  squirrel_grey: {
    moveAction: 'run',
    speed: 95,
    alertRadius: 100,
    escapeRadius: 220,
    hasVerticalMove: true,
    hasAlert: true,
  },
  bird_sparrow: {
    moveAction: 'fly',
    speed: 130,
    alertRadius: 115,
    escapeRadius: 240,
    hasVerticalMove: true,
    hasAlert: false,
  },
  bird_finch: {
    moveAction: 'fly',
    speed: 130,
    alertRadius: 115,
    escapeRadius: 240,
    hasVerticalMove: true,
    hasAlert: false,
  },
  rat_grey: {
    moveAction: 'scurry',
    speed: 80,
    alertRadius: 90,
    escapeRadius: 190,
    hasVerticalMove: true,
    hasAlert: false,
  },
  rat_brown: {
    moveAction: 'scurry',
    speed: 80,
    alertRadius: 90,
    escapeRadius: 190,
    hasVerticalMove: true,
    hasAlert: false,
  },
})

export const CRITTER_STATES = Object.freeze({
  IDLE: 'idle',
  ALERT: 'alert',
  FLEE: 'flee',
})

/**
 * Resolves the optimal facing direction for a critter movement vector.
 * Per docs/ASSET_SPEC.md: Critters render Left and Right in Phase 1, but
 * run/fly/scurry have 4-way facings (including up/down).
 *
 * @param {number} vx - Horizontal movement delta or velocity
 * @param {number} vy - Vertical movement delta or velocity
 * @param {string[]} [availableDirs=['left', 'right', 'up', 'down']]
 * @param {string} [currentFacing='right']
 * @returns {'left'|'right'|'up'|'down'}
 */
export function resolveCritterFacing(vx, vy, availableDirs = ['left', 'right', 'up', 'down'], currentFacing = 'right') {
  const absX = Math.abs(vx)
  const absY = Math.abs(vy)

  const hasUp = availableDirs.includes('up')
  const hasDown = availableDirs.includes('down')

  if (absY > absX && (hasUp || hasDown)) {
    if (vy < 0 && hasUp) return 'up'
    if (vy > 0 && hasDown) return 'down'
  }

  if (vx < 0) return 'left'
  if (vx > 0) return 'right'

  // If no horizontal motion, fallback to nearest horizontal or current
  if (currentFacing === 'left' || currentFacing === 'right') {
    return currentFacing
  }
  return 'right'
}

/**
 * Builds canonical animation key for a critter.
 *
 * @param {string} critterType
 * @param {string} action - 'idle' | 'run' | 'fly' | 'scurry' | 'alert'
 * @param {string} dir - 'left' | 'right' | 'up' | 'down'
 * @returns {string}
 */
export function buildCritterAnimKey(critterType, action, dir) {
  // Idle and alert only have left and right in Blendsmith Phase 1
  let resolvedDir = dir
  if ((action === 'idle' || action === 'alert') && (dir === 'up' || dir === 'down')) {
    resolvedDir = dir === 'up' ? 'right' : 'left'
  }
  return `${critterType}_${action}_${resolvedDir}`
}

/**
 * Creates critter animations from sidecar metadata if not already registered in scene.
 *
 * @param {import('phaser').Scene} scene
 * @param {Array<object>} [animsData] - Optional anim definitions array
 */
export function ensureCritterAnimations(scene, animsData) {
  if (!scene?.anims || typeof scene.anims.create !== 'function') return

  const animsList = animsData || [
    // Red Squirrel
    { key: 'squirrel_red_idle_right', n: 6, fps: 7 },
    { key: 'squirrel_red_idle_left', n: 6, fps: 7 },
    { key: 'squirrel_red_run_right', n: 6, fps: 14 },
    { key: 'squirrel_red_run_left', n: 6, fps: 14 },
    { key: 'squirrel_red_run_down', n: 6, fps: 14 },
    { key: 'squirrel_red_run_up', n: 6, fps: 14 },
    { key: 'squirrel_red_alert_right', n: 4, fps: 8 },
    { key: 'squirrel_red_alert_left', n: 4, fps: 8 },

    // Grey Squirrel
    { key: 'squirrel_grey_idle_right', n: 6, fps: 7 },
    { key: 'squirrel_grey_idle_left', n: 6, fps: 7 },
    { key: 'squirrel_grey_run_right', n: 6, fps: 14 },
    { key: 'squirrel_grey_run_left', n: 6, fps: 14 },
    { key: 'squirrel_grey_run_down', n: 6, fps: 14 },
    { key: 'squirrel_grey_run_up', n: 6, fps: 14 },
    { key: 'squirrel_grey_alert_right', n: 4, fps: 8 },
    { key: 'squirrel_grey_alert_left', n: 4, fps: 8 },

    // Sparrow
    { key: 'bird_sparrow_idle_right', n: 6, fps: 7 },
    { key: 'bird_sparrow_idle_left', n: 6, fps: 7 },
    { key: 'bird_sparrow_fly_right', n: 6, fps: 14 },
    { key: 'bird_sparrow_fly_left', n: 6, fps: 14 },
    { key: 'bird_sparrow_fly_down', n: 6, fps: 14 },
    { key: 'bird_sparrow_fly_up', n: 6, fps: 14 },

    // Finch
    { key: 'bird_finch_idle_right', n: 6, fps: 7 },
    { key: 'bird_finch_idle_left', n: 6, fps: 7 },
    { key: 'bird_finch_fly_right', n: 6, fps: 14 },
    { key: 'bird_finch_fly_left', n: 6, fps: 14 },
    { key: 'bird_finch_fly_down', n: 6, fps: 14 },
    { key: 'bird_finch_fly_up', n: 6, fps: 14 },

    // Grey Rat
    { key: 'rat_grey_idle_right', n: 6, fps: 7 },
    { key: 'rat_grey_idle_left', n: 6, fps: 7 },
    { key: 'rat_grey_scurry_right', n: 6, fps: 14 },
    { key: 'rat_grey_scurry_left', n: 6, fps: 14 },
    { key: 'rat_grey_scurry_down', n: 6, fps: 14 },
    { key: 'rat_grey_scurry_up', n: 6, fps: 14 },

    // Brown Rat
    { key: 'rat_brown_idle_right', n: 6, fps: 7 },
    { key: 'rat_brown_idle_left', n: 6, fps: 7 },
    { key: 'rat_brown_scurry_right', n: 6, fps: 14 },
    { key: 'rat_brown_scurry_left', n: 6, fps: 14 },
    { key: 'rat_brown_scurry_down', n: 6, fps: 14 },
    { key: 'rat_brown_scurry_up', n: 6, fps: 14 },
  ]

  for (const def of animsList) {
    if (typeof scene.anims.exists === 'function' && scene.anims.exists(def.key)) {
      continue
    }

    const frameCount = def.n || 6
    const frames = Array.from({ length: frameCount }, (_, i) => ({
      key: 'critters',
      frame: `${def.key}_${i}`,
    }))

    try {
      scene.anims.create({
        key: def.key,
        frames,
        frameRate: def.frameRate || def.fps || 10,
        repeat: def.repeat ?? -1,
      })
    } catch (_err) {
      // Texture frames may not exist in unit test/mock environments
    }
  }
}

/**
 * Ambient Critter Entity.
 */
export class Critter {
  /**
   * @param {import('phaser').Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} [critterType='squirrel_red']
   */
  constructor(scene, x, y, critterType = 'squirrel_red') {
    this.scene = scene
    this.x = x
    this.y = y
    this.critterType = critterType
    this.config = CRITTER_CONFIGS[critterType] || CRITTER_CONFIGS.squirrel_red

    this.state = CRITTER_STATES.IDLE
    this.facing = 'right'
    this.lastAnimKey = ''
    this.animHistory = []
    this.active = true

    this.vx = 0
    this.vy = 0

    // Setup sprite if scene add exists
    if (scene?.physics?.add?.sprite) {
      this.sprite = scene.physics.add.sprite(x, y, 'critters', `${critterType}_idle_right_0`)
      this.sprite.setOrigin?.(0.5, 0.875)
      this.sprite.body?.setAllowGravity?.(false)
      this.sprite.critter = this
    }

    ensureCritterAnimations(scene)
    this.playAnim('idle')
  }

  /**
   * Plays the appropriate directional animation.
   *
   * @param {string} action - 'idle' | 'run' | 'fly' | 'scurry' | 'alert'
   * @param {string} [dir=this.facing]
   */
  playAnim(action, dir = this.facing) {
    const key = buildCritterAnimKey(this.critterType, action, dir)
    this.lastAnimKey = key
    this.animHistory.push(key)

    if (this.sprite?.anims?.play) {
      try {
        if (!this.sprite.anims.currentAnim || this.sprite.anims.currentAnim.key !== key) {
          this.sprite.anims.play(key, true)
        }
      } catch (_e) {
        // Mock fallback
      }
    }
  }

  /**
   * Sets sprite velocity or coordinates.
   *
   * @param {number} vx
   * @param {number} vy
   */
  setVelocity(vx, vy) {
    if (this.sprite?.body?.setVelocity) {
      this.sprite.body.setVelocity(vx, vy)
    }
    this.vx = vx
    this.vy = vy
  }

  /**
   * Per-frame AI update step.
   *
   * @param {number} [time=performance.now()]
   * @param {number} [delta=16]
   * @param {object} [targetOverride]
   */
  update(time = (typeof performance !== 'undefined' ? performance.now() : Date.now()), delta = 16, targetOverride = null) {
    if (!this.active) return

    const target = targetOverride || this.scene?.player
    if (!target) return

    const cx = this.sprite ? this.sprite.x : this.x
    const cy = this.sprite ? this.sprite.y : this.y

    const tx = target.x
    const ty = target.y

    const dx = cx - tx
    const dy = cy - ty
    const dist = Math.hypot(dx, dy) || 1

    const { alertRadius, escapeRadius, speed, moveAction, hasVerticalMove, hasAlert } = this.config

    if (this.state === CRITTER_STATES.IDLE) {
      if (dist <= alertRadius) {
        if (hasAlert) {
          this.state = CRITTER_STATES.ALERT
          this.alertUntil = time + 250
          this.facing = resolveCritterFacing(dx, dy, ['left', 'right'], this.facing)
          this.playAnim('alert', this.facing)
          this.setVelocity(0, 0)
          return
        } else {
          this.state = CRITTER_STATES.FLEE
        }
      } else {
        this.setVelocity(0, 0)
        this.playAnim('idle', this.facing)
        return
      }
    }

    if (this.state === CRITTER_STATES.ALERT) {
      if (time >= (this.alertUntil || 0) || dist <= alertRadius * 0.4) {
        this.state = CRITTER_STATES.FLEE
      } else {
        this.setVelocity(0, 0)
        return
      }
    }

    if (this.state === CRITTER_STATES.FLEE) {
      if (dist >= escapeRadius) {
        // Escaped: return to idle
        this.state = CRITTER_STATES.IDLE
        this.setVelocity(0, 0)
        this.playAnim('idle', this.facing)
      } else {
        // Flee away from threat
        const nx = dx / dist
        const ny = dy / dist

        const vx = nx * speed
        const vy = ny * speed

        const availableDirs = hasVerticalMove
          ? ['left', 'right', 'up', 'down']
          : ['left', 'right']

        this.facing = resolveCritterFacing(vx, vy, availableDirs, this.facing)
        this.setVelocity(vx, vy)
        this.playAnim(moveAction, this.facing)

        // Update coordinate tracking
        this.x = cx + vx * (delta / 1000)
        this.y = cy + vy * (delta / 1000)
        if (this.sprite) {
          this.x = this.sprite.x
          this.y = this.sprite.y
        }
      }
    }
  }

  /**
   * Destroys critter instance and removes its sprite.
   */
  destroy() {
    this.active = false
    if (this.sprite?.destroy) {
      this.sprite.destroy()
      this.sprite = null
    }
  }
}
