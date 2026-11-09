/**
 * Projectile — Atlas-backed projectile and hazard sprite class.
 *
 * Implements:
 * - Direct atlas frame rendering (no external GIF / DOM elements)
 * - Linear flight trajectories and parabolic arced tosses (e.g. thief poison vial)
 * - Baked spin handling (cycles animation frames without rotating the sprite transform)
 * - Accurate collision against scene enemies and solid colliders
 * - Multi-stage lifecycle: Flight -> Impact -> Lingering hazard puddle -> Cleanup
 */

import Phaser from 'phaser'

// Safe sprite base resolution for both browser runtime and mocked test environments
const SpriteBase = (Phaser && Phaser.GameObjects && Phaser.GameObjects.Sprite)
  ? Phaser.GameObjects.Sprite
  : class FallbackSprite {
      constructor(scene, x, y, texture, frame) {
        this.scene = scene
        this.x = x
        this.y = y
        this.texture = { key: texture }
        this.frame = { name: frame }
        this.originX = 0.5
        this.originY = 0.5
        this.rotation = 0
        this.depth = 15000
        this.visible = true
        this.active = true
      }
      setOrigin(x, y) {
        this.originX = x
        this.originY = y !== undefined ? y : x
        return this
      }
      setDepth(d) {
        this.depth = d
        return this
      }
      setRotation(r) {
        this.rotation = r
        return this
      }
      setDisplaySize(w, h) {
        this.displayWidth = w
        this.displayHeight = h
        return this
      }
      setTexture(k, f) {
        this.texture = { key: k }
        this.frame = { name: f }
        return this
      }
      play(key, ignoreIfPlaying = false) {
        this.currentAnimKey = key
        return this
      }
      destroy() {
        this.active = false
        this.visible = false
      }
    }

/**
 * Checks axis-aligned bounding box intersection.
 *
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 * @returns {boolean}
 */
export function rectIntersects(a, b) {
  if (!a || !b) return false
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

export class Projectile extends SpriteBase {
  /**
   * @param {import('phaser').Scene} scene - Active Phaser scene
   * @param {number} x - Starting world X coordinate
   * @param {number} y - Starting world Y coordinate
   * @param {string} textureKey - Atlas texture key (e.g. 'fireball', 'spell_fx', 'thief_fx')
   * @param {string|number} [initialFrame] - Initial frame identifier
   * @param {object} [config={}] - Projectile configuration options
   */
  constructor(scene, x, y, textureKey, initialFrame, config = {}) {
    super(scene, x, y, textureKey, initialFrame)

    if (scene && scene.add && typeof scene.add.existing === 'function') {
      scene.add.existing(this)
    }

    this.setDepth(config.depth ?? 15000)

    // Base properties
    this.startX = x
    this.startY = y
    this.groundY = y
    this.distanceTraveled = 0
    this.maxDist = config.maxDist ?? 220
    this.owner = config.owner || 'player'
    this.shooter = config.shooter || null
    this.damage = config.damage ?? 10
    this.impactType = config.impact || ''
    this.special = config.special || ''
    this.unit = scene?.unit || 1

    // Size & Collision Box
    const baseSize = config.size ?? 32
    this.size = baseSize * this.unit
    this.w = this.size
    this.h = this.size

    // Physics / Velocity
    const speed = (config.speed ?? 420) * this.unit
    let dx = config.dirX ?? 1
    let dy = config.dirY ?? 0
    const len = Math.hypot(dx, dy) || 1
    this.dirX = dx / len
    this.dirY = dy / len
    this.vx = config.vx !== undefined ? config.vx : this.dirX * speed
    this.vy = config.vy !== undefined ? config.vy : this.dirY * speed

    // Flight modes
    this.isArc = Boolean(config.isArc)
    this.arcHeight = (config.arcHeight ?? 32) * this.unit
    this.bakedSpin = Boolean(config.bakedSpin)

    // Animation keys
    this.flyAnim = config.flyAnim || ''
    this.hitAnim = config.hitAnim || ''
    this.lingerAnim = config.lingerAnim || ''

    // Hazard lingering
    this.lingerMs = config.lingerMs ?? 0
    this.lingerDps = config.lingerDps ?? (this.impactType === 'poison' ? 5 : 2)
    this.lingerUntil = 0
    this.isLingering = false
    this.isImpacted = false

    // Callbacks
    this.onHit = config.onHit || null
    this.onImpactCallback = config.onImpact || null

    // Configure origin & rotation
    const origin = config.origin || { x: 0.5, y: 0.5 }
    this.setOrigin(origin.x, origin.y)

    if (!this.bakedSpin && (this.vx !== 0 || this.vy !== 0)) {
      this.rotation = Math.atan2(this.vy, this.vx)
    }

    // Start flying animation if provided
    if (this.flyAnim && this.anims && typeof this.anims.play === 'function') {
      this.anims.play(this.flyAnim, true)
    }
  }

  /**
   * Returns current bounding box for collision detection.
   *
   * @returns {{ x: number, y: number, w: number, h: number }}
   */
  getBounds() {
    return {
      x: this.x - this.w / 2,
      y: (this.isArc ? this.groundY : this.y) - this.h / 2,
      w: this.w,
      h: this.h,
    }
  }

  /**
   * Per-frame update logic called by scene.
   *
   * @param {number} now - Timestamp in ms
   * @param {number} dt - Delta time in seconds
   * @returns {boolean} - False if projectile finished and was destroyed
   */
  update(now, dt) {
    if (!this.active) return false

    // Handle lingering ground hazard zone
    if (this.isLingering) {
      if (now >= this.lingerUntil) {
        this.destroy()
        return false
      }
      this._updateLingeringDamage(now, dt)
      return true
    }

    // Handle active impact animation completion
    if (this.isImpacted) {
      return true
    }

    // Advance flight position
    const stepX = this.vx * dt
    const stepY = this.vy * dt
    this.x += stepX
    this.groundY += stepY
    this.distanceTraveled += Math.hypot(stepX, stepY)

    if (this.isArc) {
      const progress = Math.min(1, Math.max(0, this.distanceTraveled / this.maxDist))
      const arcOffset = -4 * this.arcHeight * progress * (1 - progress)
      this.y = this.groundY + arcOffset
    } else {
      this.y += stepY
    }

    // Check collision against world solids
    const bounds = this.getBounds()
    const solids = this.scene?._solidRects || []
    for (let i = 0; i < solids.length; i++) {
      if (rectIntersects(bounds, solids[i])) {
        this.impact(null, true, now)
        return true
      }
    }

    // Check collision against combatants
    if (this.owner === 'player') {
      const enemies = this.scene?.enemies?.getChildren?.() || []
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i]
        if (!e || e.hp <= 0) continue
        const eBox = typeof this.scene?._enemyBox === 'function'
          ? this.scene._enemyBox(e)
          : { x: e.x - 16, y: e.y - 16, w: 32, h: 32 }
        if (rectIntersects(bounds, eBox)) {
          this.impact(e, false, now)
          return true
        }
      }
    } else if (this.owner === 'enemy') {
      const playerBox = typeof this.scene?._readPlayerBox === 'function'
        ? this.scene._readPlayerBox()
        : (this.scene?.player ? { x: this.scene.player.x - 16, y: this.scene.player.y - 16, w: 32, h: 32 } : null)
      if (playerBox && rectIntersects(bounds, playerBox)) {
        this.impact(this.scene.player, false, now)
        return true
      }
    }

    // Reached max travel distance
    if (this.distanceTraveled >= this.maxDist) {
      this.impact(null, false, now)
      return true
    }

    return true
  }

  /**
   * Triggers projectile impact against target or obstacle.
   *
   * @param {object|null} target - Hit enemy or player instance
   * @param {boolean} [hitSolid=false] - Whether impact was against solid terrain
   * @param {number} [now]
   */
  impact(target = null, hitSolid = false, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.isImpacted || this.isLingering) return
    this.isImpacted = true
    this.vx = 0
    this.vy = 0

    if (this.isArc) {
      this.y = this.groundY
    }

    // Trigger onHit callback or direct combat logic
    if (target && typeof this.onHit === 'function') {
      this.onHit(target, this)
    } else if (target && this.owner === 'player') {
      this._applyPlayerHit(target, now)
    } else if (target && this.owner === 'enemy') {
      this._applyEnemyHit(target, now)
    }

    if (typeof this.onImpactCallback === 'function') {
      this.onImpactCallback(this.x, this.y, this)
    }

    // Play impact animation if available
    if (this.hitAnim && this.anims && typeof this.anims.play === 'function') {
      if (typeof this.setRotation === 'function') {
        this.setRotation(0)
      } else {
        this.rotation = 0
      }
      this.anims.play(this.hitAnim, true)
      if (typeof this.once === 'function') {
        const animComplete = Phaser?.Animations?.Events?.ANIMATION_COMPLETE || 'animationcomplete'
        this.once(animComplete, () => {
          this._afterImpact(now)
        })
      } else {
        this._afterImpact(now)
      }
    } else {
      this._afterImpact(now)
    }
  }

  /**
   * Internal transition following impact animation.
   *
   * @param {number} now
   * @private
   */
  _afterImpact(now) {
    if (this.lingerMs > 0) {
      this.isLingering = true
      this.isImpacted = false
      this.lingerUntil = now + this.lingerMs
      if (this.lingerAnim && this.anims && typeof this.anims.play === 'function') {
        this.anims.play(this.lingerAnim, true)
      }
    } else {
      this.destroy()
    }
  }

  /**
   * Applies direct damage and floaters on hit.
   *
   * @param {object} enemy
   * @param {number} now
   * @private
   */
  _applyPlayerHit(enemy, now) {
    if (this.special === 'lifeLeech') {
      const dmg = Math.max(1, Math.floor((enemy.hp || 10) * 0.4))
      enemy.hp = Math.max(0, enemy.hp - dmg)
      enemy.flashUntil = now + 180
      this.scene?._float?.(enemy.x, enemy.y - 6, `-${dmg}`, '#bb3cff')

      if (this.scene && typeof this.scene.hp === 'number') {
        const before = this.scene.hp
        this.scene.hp = Math.min(this.scene.hpMax || 100, this.scene.hp + dmg)
        const healed = this.scene.hp - before
        if (healed > 0 && this.scene.player) {
          this.scene._float?.(this.scene.player.x, this.scene.player.y - 12, `+${healed}`, '#7cfc7c')
        }
      }
    } else {
      const dmg = this.damage
      enemy.hp = Math.max(0, enemy.hp - dmg)
      enemy.flashUntil = now + 180
      const color = this.impactType === 'poison' ? '#6abe30' : '#ff6161'
      this.scene?._float?.(enemy.x, enemy.y - 6, `-${dmg}`, color)
    }
  }

  /**
   * Applies damage to player on enemy projectile hit.
   *
   * @param {object} player
   * @param {number} now
   * @private
   */
  _applyEnemyHit(player, now) {
    const dmg = this.damage
    if (typeof player?.takeDamage === 'function') {
      player.takeDamage(dmg, now, {
        attacker: this.shooter || null,
        fromX: this.x,
        fromY: this.y,
        projectile: this,
      })
    } else if (typeof this.scene?._hurtPlayer === 'function') {
      this.scene._hurtPlayer(dmg)
    }
    if (typeof this.scene?._float === 'function') {
      this.scene._float(player.x, player.y - 6, `-${dmg}`, '#ff4444')
    }
  }

  /**
   * Ticks damage over time inside lingering hazard area.
   *
   * @param {number} now
   * @param {number} dt
   * @private
   */
  _updateLingeringDamage(now, dt) {
    if (!this.scene?.enemies?.getChildren) return
    const enemies = this.scene.enemies.getChildren()
    const bounds = this.getBounds()
    const dmg = this.lingerDps * dt

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (!e || e.hp <= 0) continue
      const eBox = typeof this.scene?._enemyBox === 'function'
        ? this.scene._enemyBox(e)
        : { x: e.x - 16, y: e.y - 16, w: 32, h: 32 }
      if (rectIntersects(bounds, eBox)) {
        e.hp = Math.max(0, e.hp - dmg)
        e.flashUntil = now + 80
      }
    }
  }

  /**
   * Cleanup and removal from scene.
   */
  destroy(fromScene) {
    this.active = false
    if (Array.isArray(this.scene?.projectiles)) {
      const idx = this.scene.projectiles.indexOf(this)
      if (idx !== -1) {
        this.scene.projectiles.splice(idx, 1)
      }
    }
    super.destroy(fromScene)
  }
}
