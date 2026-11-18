/**
 * Enemy — Base class for all non-boss enemy combatants mounted on Actor.
 *
 * Implements:
 * - Dynamic per-sheet feet origin resolution from atlas metadata / AssetRegistry
 * - Accurate footprint collision body from meta.footprint
 * - 4-directional facings (down, left, right, up, dominant axis, no flipX)
 * - Multi-sheet asset resolution (e.g. goblin, goblin_alert, goblin_telegraph, goblin_death, goblin_spawn)
 * - Integrated StateMachine (IDLE, WALK, ATTACK, HURT, DEAD)
 * - Telegraph clip playback before melee attack swing
 * - Frame-accurate melee attack hits on meta hitFrames
 * - Attack token coordination via AttackTokenManager
 * - Cooldown management with 900 ms base + seeded jitter (client/src/game/rng.js)
 */

import Phaser from 'phaser'
import { Actor } from './Actor.js'
import { ACTOR_STATES } from './stateMachine.js'
import { DEFAULT_FACING } from './facing.js'
import { buildAnimKey } from '../assets/animKeys.js'
import { random } from '../rng.js'
import {
  getAnimationFrameIndex,
  getHitFrames,
  getHitbox,
  getWeaponTip,
  computeWorldHitbox,
  computeWorldHurtbox,
  rectIntersects,
} from '../combat/hitSystem.js'
import { onEnemyDeathComplete } from '../combat/death.js'
import {
  applyFlash,
  applyKnockback,
  spawnHitSpark,
} from '../combat/feedback.js'
import {
  getEnemyHp,
  getEnemySpeed,
  getEnemyDamage,
} from '../combat/balance.js'
import { GoblinAI } from '../ai/goblin.js'
import { BruteAI } from '../ai/brute.js'
import { ArcherAI } from '../ai/archer.js'
import { isDebug } from '../config/flags.js'
import { ENEMY_DEFS, resolveEnemyDef } from '../combat/enemyDefs.js'

/**
 * AI controller classes, by the name a def uses in its `ai` field.
 * A new enemy that reuses one of these needs no edit here. A brand-new AI
 * class is one extra line (or registerEnemyAI in a test).
 */
export const ENEMY_AI_CLASSES = {
  GoblinAI,
  BruteAI,
  ArcherAI,
}

/**
 * @param {string} name
 * @param {Function} AiClass
 */
export function registerEnemyAI(name, AiClass) {
  ENEMY_AI_CLASSES[name] = AiClass
}

/**
 * Sheet keys per enemy type, built from enemyDefs. Includes alias keys
 * ('goblin_archer', 'goblin_brute'). Snapshot of the built-in defs.
 */
export const ENEMY_SHEETS = Object.freeze(
  Object.fromEntries(
    Object.values(ENEMY_DEFS).flatMap((def) => [def.id, ...(def.aliases || [])].map((key) => [key, def.sheets])),
  ),
)

export class Enemy extends Actor {
  /**
   * @param {import('phaser').Scene} scene - Active Phaser scene
   * @param {number} x - Initial X coordinate
   * @param {number} y - Initial Y coordinate
   * @param {string} [enemyType='goblin'] - Enemy archetype ('goblin' | 'archer' | 'brute')
   * @param {object} [options] - Additional Enemy configuration
   * @param {number} [options.wave=1] - Spawn wave number for scaling
   * @param {number} [options.hp] - Explicit HP override
   * @param {number} [options.speed] - Explicit speed override
   * @param {number} [options.damage] - Explicit damage override
   */
  constructor(scene, x = 0, y = 0, enemyType = 'goblin', options = {}) {
    const def = resolveEnemyDef(enemyType)
    const sheetDef = def?.sheets || ENEMY_DEFS.goblin.sheets
    const initialSheet = sheetDef.defaultSheet
    const initialFrame = sheetDef.initialFrame || ''

    super(scene, x, y, initialSheet, initialFrame, {
      ...options,
      assetId: sheetDef.assetId || (enemyType === 'brute' ? 'goblin_brute' : enemyType),
      facing: options.facing || DEFAULT_FACING,
    })

    this.enemyType = enemyType
    this.wave = options.wave || 1

    const baseHp = getEnemyHp(enemyType, this.wave)
    this.hpMax = options.hpMax ?? (options.hp ?? baseHp)
    this.hp = options.hp ?? this.hpMax

    this.speed = options.speed ?? getEnemySpeed(enemyType, this.wave)
    this.damage = options.damage ?? getEnemyDamage(enemyType, this.wave)

    this.isEnemy = true
    this.active = true
    this._deathProcessed = false

    this.attackCooldownUntil = 0
    this.isAttacking = false
    this.attackPhase = 'none' // 'none' | 'telegraph' | 'swing'
    this.telegraphUntil = 0
    this.swingStartTime = 0
    this._hitFrameProcessed = false

    this.animHistory = []
    this.lastAnimKey = null

    this.isArmored = options.isArmored ?? !!def?.armored
    this.telegraphDuration = options.telegraphDuration ?? (this.isArmored ? 300 : 375)
    this.baseCooldown = options.baseCooldown ?? (this.isArmored ? 1600 : 900)
    this.knockbackImpulse = options.knockbackImpulse ?? (this.isArmored ? 260 : 100)

    // Configure arcade body if present
    if (this.body) {
      if (typeof this.body.setAllowGravity === 'function') {
        this.body.setAllowGravity(false)
      }
      if (typeof this.body.setCollideWorldBounds === 'function') {
        this.body.setCollideWorldBounds(true)
      }
      if (typeof this.body.setPushable === 'function') {
        this.body.setPushable(false)
      }
    }

    this._readAtlasCombatMeta()

    // Attach archetype AI controller from the def
    const AiClass = typeof def?.ai === 'function' ? def.ai : ENEMY_AI_CLASSES[def?.ai]
    if (AiClass) {
      this.ai = def.projectile ? new AiClass(this, { damage: def.projectile.damage }) : new AiClass(this)
    }

    // Listen for animation completion events to chain telegraph -> attack -> idle
    if (typeof this.on === 'function') {
      const animCompleteEvent = Phaser?.Animations?.Events?.ANIMATION_COMPLETE || 'animationcomplete'
      this.on(animCompleteEvent, (anim) => {
        this.onAnimationComplete(anim)
      })
    }

    // Initial idle animation
    this.playAnim('idle')
  }

  /**
   * Hit frames and arrow spawn offsets come from the attack sheet meta.
   * Anchor stays on Actor.resolveAnchor (atlas meta / registry), never a fixed origin.
   */
  _readAtlasCombatMeta() {
    const sheetKey = this.getSheetForAnim('attack')
    const meta = this.scene?.textures?.get?.(sheetKey)?.customData?.meta
    const attack = meta?.anims?.attack
    if (!attack) return

    if (Array.isArray(attack.hitFrames) && attack.hitFrames.length > 0) {
      this.hitFrames = attack.hitFrames.map((frame) => Number(frame))
    } else if (Number.isFinite(Number(attack.releaseFrame))) {
      this.hitFrames = [Number(attack.releaseFrame)]
    } else if (Number.isFinite(Number(attack.spawnFrame))) {
      this.hitFrames = [Number(attack.spawnFrame)]
    }

    if (attack.spawnOffsetFromFeet && typeof attack.spawnOffsetFromFeet === 'object') {
      this.spawnOffsetFromFeet = attack.spawnOffsetFromFeet
    }
  }

  /**
   * Resolves the texture atlas sheet key for a given animation action.
   *
   * @param {string} animName
   * @returns {string}
   */
  getSheetForAnim(animName) {
    const sheetDef = resolveEnemyDef(this.enemyType)?.sheets || ENEMY_DEFS.goblin.sheets
    if (animName === 'telegraph') {
      return sheetDef.telegraphSheet
    }
    if (animName === 'death') {
      return sheetDef.deathSheet
    }
    if (animName === 'spawn') {
      return sheetDef.spawnSheet
    }
    if (animName === 'hurt') {
      return sheetDef.hurtSheet
    }
    if (animName === 'attack') {
      return sheetDef.attackSheet
    }
    if (animName === 'alert') {
      return sheetDef.alertSheet || sheetDef.defaultSheet
    }
    if (animName === 'walk') {
      return sheetDef.walkSheet
    }
    return sheetDef.defaultSheet
  }

  /**
   * Plays an animation with 4-directional key resolution and sheet switching.
   *
   * @param {string} animName - 'idle' | 'walk' | 'hurt' | 'attack' | 'telegraph' | 'death'
   * @param {boolean} [ignoreIfPlaying=true]
   * @returns {Enemy}
   */
  playAnim(animName, ignoreIfPlaying = true) {
    const targetSheet = this.getSheetForAnim(animName)
    if (targetSheet && targetSheet !== this.texture?.key) {
      this.applySheetOrigin(targetSheet)
    }

    const key = this.getAnimKey(animName)
    this.lastAnimKey = key
    this.animHistory.push(key)
    if (isDebug()) {
      console.log(`[Enemy anim] ${key}`)
    }

    // Record on scene for debug/test inspection if available
    if (this.scene) {
      this.scene._enemyAnimHistory = this.scene._enemyAnimHistory || []
      this.scene._enemyAnimHistory.push({
        enemyType: this.enemyType,
        anim: key,
        time: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      })
    }

    // Missing key safety
    if (this.scene?.anims && typeof this.scene.anims.exists === 'function' && !this.scene.anims.exists(key)) {
      if (this.is(ACTOR_STATES.ATTACK)) {
        this.finishAttack(typeof performance !== 'undefined' ? performance.now() : Date.now())
      }
      return this
    }

    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(key, ignoreIfPlaying)
    }

    if (targetSheet) {
      this.applySheetOrigin(targetSheet)
      this.applyFootprint(targetSheet)
    }

    return this
  }

  /**
   * Animation completion handler.
   *
   * @param {Phaser.Animations.Animation} anim
   */
  onAnimationComplete(anim) {
    const key = anim?.key || this.anims?.currentAnim?.key || ''
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()

    if (key.includes('telegraph') && this.attackPhase === 'telegraph') {
      this.transitionToSwing(now)
      return
    }

    if (key.includes('attack') && this.attackPhase === 'swing') {
      this.finishAttack(now)
      return
    }

    if (key.includes('hurt') && this.is(ACTOR_STATES.HURT)) {
      this.transition(ACTOR_STATES.IDLE, { force: true })
      this.playAnim('idle')
      return
    }

    if (key.includes('death') && (this._deathClipPlaying || this.is(ACTOR_STATES.DEAD))) {
      this.completeDeath()
    }
  }

  /**
   * Initiates the attack sequence: starts with wind-up telegraph.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  startAttack(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.is(ACTOR_STATES.DEAD) || this.is(ACTOR_STATES.HURT)) return false
    if (this.isAttacking) return false

    const transitioned = this.transition(ACTOR_STATES.ATTACK, { time: now })
    if (!transitioned) return false

    this.isAttacking = true
    this.attackPhase = 'telegraph'
    this._hitFrameProcessed = false

    // Halt physics velocity during telegraph and attack
    if (this.body && typeof this.body.setVelocity === 'function') {
      this.body.setVelocity(0, 0)
    }

    // Telegraph duration: 300 ms for brute, 375 ms for standard goblin
    const telegraphMs = this.telegraphDuration ?? (this.isArmored ? 300 : 375)
    this.telegraphUntil = now + telegraphMs
    this.playAnim('telegraph', false)
    return true
  }

  /**
   * Transitions from telegraph wind-up to the active attack swing.
   *
   * @param {number} [now=performance.now()]
   */
  transitionToSwing(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this.attackPhase = 'swing'
    this.swingStartTime = now
    this._hitFrameProcessed = false
    this.playAnim('attack', false)
  }

  /**
   * Concludes the attack sequence, releases attack token, and sets cooldown.
   *
   * @param {number} [now=performance.now()]
   */
  finishAttack(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this.isAttacking = false
    this.attackPhase = 'none'

    // Release attack token
    if (this.scene?.attackTokenManager) {
      this.scene.attackTokenManager.release(this)
    }

    // Cooldown: 1600 ms base for brute, 900 ms base for goblin + seeded jitter
    const baseCooldown = this.baseCooldown ?? (this.isArmored ? 1600 : 900)
    const jitter = random() * 300
    this.attackCooldownUntil = now + baseCooldown + jitter

    if (!this.is(ACTOR_STATES.DEAD)) {
      this.transition(ACTOR_STATES.IDLE, { force: true })
      this.playAnim('idle')
    }
  }

  /**
   * Executes hit detection against the player on the active hitFrame.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean} - True if player was struck
   */
  executeAttackHit(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this._deathClipPlaying || this.is(ACTOR_STATES.DEAD) || this.hp <= 0) return false
    if (this.body && this.body.enable === false) return false

    const scene = this.scene
    const player = scene?.player
    if (!player || player.hp <= 0 || player.is?.(ACTOR_STATES.DEAD)) {
      return false
    }

    const sheetKey = this.getSheetForAnim('attack')
    let hitboxDef = getHitbox(scene, sheetKey, 3, this.facing, 'attack')

    // If metadata lacks an explicit hitbox object, construct one from weapon tip or facing direction
    if (!hitboxDef) {
      const tip = getWeaponTip(scene, sheetKey, 3, this.facing, 'attack')
      if (tip) {
        hitboxDef = {
          x: tip.x - 14,
          y: tip.y - 14,
          w: 28,
          h: 28,
        }
      } else {
        const size = 32
        let ox = -size / 2
        let oy = -size / 2
        if (this.facing === 'down') oy += 16
        else if (this.facing === 'up') oy -= 24
        else if (this.facing === 'left') ox -= 24
        else if (this.facing === 'right') ox += 24
        hitboxDef = { x: ox, y: oy, w: size, h: size }
      }
    }

    const worldHitbox = computeWorldHitbox(this, hitboxDef)
    const playerHurtbox = computeWorldHurtbox(player)

    if (rectIntersects(worldHitbox, playerHurtbox)) {
      const dmg = this.damage || 8
      let tookDamage = true

      if (typeof player.takeDamage === 'function') {
        const res = player.takeDamage(dmg, now, {
          attacker: this,
          fromX: this.x,
          fromY: this.y,
          enemyType: this.enemyType,
          knockbackSpeed: this.knockbackImpulse ?? (this.isArmored ? 260 : 120),
        })
        if (!res) {
          tookDamage = false
        }
      } else if (typeof scene._hurtPlayer === 'function') {
        scene._hurtPlayer(dmg)
      }

      if (tookDamage) {
        spawnHitSpark(scene, (worldHitbox.x + playerHurtbox.x) / 2, (worldHitbox.y + playerHurtbox.y) / 2)
      }

      return tookDamage
    }

    return false
  }

  /**
   * Receives incoming damage from player attacks or spells.
   *
   * @param {number} [amount=10]
   * @param {number} [now=performance.now()]
   * @param {object} [options]
   * @returns {boolean}
   */
  takeDamage(amount = 10, now = (typeof performance !== 'undefined' ? performance.now() : Date.now()), options = {}) {
    if (this.is(ACTOR_STATES.DEAD)) return false

    this.hp = Math.max(0, this.hp - amount)

    applyFlash(this, this.scene)

    if (options.fromX !== undefined && options.fromY !== undefined) {
      applyKnockback(this, options.fromX, options.fromY, 100, 120)
    }

    if (this.hp <= 0) {
      this.die()
      return true
    }

    const aiAttacking = Boolean(this.ai?.isAttacking)

    // Armored enemies mid-swing ignore hurt interruption and do not drop attack token
    if (this.isArmored && (this.isAttacking || aiAttacking)) {
      return true
    }

    // If currently attacking, interrupt and release token
    if (this.isAttacking || aiAttacking) {
      if (this.scene?.attackTokenManager) {
        this.scene.attackTokenManager.release(this)
      }
      this.isAttacking = false
      this.attackPhase = 'none'
      if (typeof this.ai?.interruptAttack === 'function') {
        this.ai.interruptAttack(now)
      }
    }

    this.transition(ACTOR_STATES.HURT, { force: true })
    this.playAnim('hurt', false)
    return true
  }

  /**
   * Turns collision and motion off without removing the sprite from the update list.
   * Phaser does not advance animations on inactive game objects.
   */
  disableCombatBody() {
    // Phaser disableBody calls this.body.stop() with no guard. After a scene
    // change the body is already gone, and that read throws.
    if (this.body && typeof this.disableBody === 'function') {
      this.disableBody(false, false)
    }
    const body = this.body
    if (!body) return
    if (typeof body.setVelocity === 'function') body.setVelocity(0, 0)
    body.enable = false
    if (body.checkCollision) body.checkCollision.none = true
  }

  /**
   * Milliseconds of the death clip from atlas meta, or 0 when the sheet has no playable length.
   * @returns {number}
   */
  deathClipMetaDurationMs() {
    const sheetKey = this.getSheetForAnim('death')
    const def = this.scene?.textures?.get?.(sheetKey)?.customData?.meta?.anims?.death
    if (!def) return 0
    const frames = Array.isArray(def.frames) ? def.frames.length : Number(def.frames) || 0
    const fps = Number(def.fps || def.frameRate) || 0
    if (!(frames > 0) || !(fps > 0)) return 0
    return Math.round((frames / fps) * 1000)
  }

  /**
   * @param {object} [clip]
   * @returns {number}
   */
  clipDurationMs(clip) {
    if (!clip) return 0
    if (typeof clip.duration === 'number' && clip.duration > 0) return clip.duration
    const frames = Array.isArray(clip.frames) ? clip.frames.length : 0
    const fps = Number(clip.frameRate || clip.fps) || 0
    if (frames > 0 && fps > 0) return Math.round((frames / fps) * 1000)
    return 0
  }

  /**
   * Whether the death animation can actually advance.
   * A missing registry entry or a clip with 0 frames cannot.
   * @returns {{ playable: boolean, durationMs: number, key: string }}
   */
  inspectDeathClip() {
    const key = this.getAnimKey('death')
    const anims = this.scene?.anims
    const metaMs = this.deathClipMetaDurationMs()
    if (anims && typeof anims.exists === 'function' && !anims.exists(key)) {
      return { playable: false, durationMs: metaMs, key }
    }
    if (anims && typeof anims.get === 'function') {
      const clip = anims.get(key)
      if (clip) {
        const count = Array.isArray(clip.frames) ? clip.frames.length : 0
        if (count <= 0) {
          return { playable: false, durationMs: this.clipDurationMs(clip) || metaMs, key }
        }
        return { playable: true, durationMs: this.clipDurationMs(clip) || metaMs, key }
      }
    }
    return { playable: true, durationMs: metaMs, key }
  }

  /**
   * @param {number} ms
   * @returns {boolean} True when a scene clock accepted the fallback
   */
  armDeathTimer(ms) {
    if (!(ms > 0)) return false
    const clock = this.scene?.time
    if (typeof clock?.delayedCall !== 'function') return false
    this.clearDeathTimer()
    this._deathTimer = clock.delayedCall(ms, () => {
      this._deathTimer = null
      if (this._destroyed || !this.scene) return
      this.completeDeath()
    })
    return Boolean(this._deathTimer)
  }

  clearDeathTimer() {
    const timer = this._deathTimer
    this._deathTimer = null
    if (timer && typeof timer.remove === 'function') timer.remove(false)
  }

  /**
   * Drops loot and removes the actor. Idempotent via onEnemyDeathComplete.
   * @returns {boolean}
   */
  completeDeath() {
    if (this._deathCompleted) return false
    if (this._destroyed || !this.scene) {
      this.clearDeathTimer()
      return false
    }
    this.clearDeathTimer()
    this.disableCombatBody()
    this.active = false
    return onEnemyDeathComplete(this)
  }

  /**
   * @param {boolean} [fromScene]
   */
  destroy(fromScene) {
    this._destroyed = true
    this.clearDeathTimer()
    if (typeof super.destroy === 'function') super.destroy(fromScene)
  }

  /**
   * Triggers enemy death sequence and permanently halts movement.
   * The sprite stays active until the death clip finishes so Phaser can advance it.
   */
  die() {
    if (this._deathClipPlaying || this.is(ACTOR_STATES.DEAD)) return

    if (this.scene?.attackTokenManager) {
      this.scene.attackTokenManager.release(this)
    }

    this.isAttacking = false
    this.attackPhase = 'none'
    this._hitFrameProcessed = true
    this._deathProcessed = true
    this._deathClipPlaying = true
    this.hp = 0

    this.transition(ACTOR_STATES.DEAD, { force: true })
    this.disableCombatBody()
    this.active = true

    const status = this.inspectDeathClip()
    if (!status.playable) {
      const armed = status.durationMs > 0 && this.armDeathTimer(status.durationMs)
      if (!armed) this.completeDeath()
      return
    }

    this.playAnim('death', false)
    if (!this._deathCompleted) this.active = true
    if (!this._deathCompleted && status.durationMs > 0) {
      // Event wins when the clip finishes; this only covers a missed animationcomplete.
      this.armDeathTimer(status.durationMs + 150)
    }
  }

  /**
   * Per-frame update step.
   *
   * @param {number} [time=Date.now()]
   * @param {number} [delta=0]
   */
  update(time = (typeof performance !== 'undefined' ? performance.now() : Date.now()), delta = 0) {
    if (this.hp <= 0 && !this.is(ACTOR_STATES.DEAD)) {
      this.die()
      return
    }

    if (this.is(ACTOR_STATES.DEAD)) {
      this.disableCombatBody()
      return
    }

    // Ranged controllers (ArcherAI) own their wind-up. Melee uses this.isAttacking.
    const rangedAttack = Boolean(this.ai?.isAttacking)

    // 1. Manage active attack phase and timing fallbacks
    if (this.isAttacking && !rangedAttack) {
      if (this.attackPhase === 'telegraph') {
        if (time >= this.telegraphUntil) {
          this.transitionToSwing(time)
        }
      } else if (this.attackPhase === 'swing') {
        // Frame-accurate hit detection from atlas hitFrames, else the swing timing window
        const frameIdx = getAnimationFrameIndex(this.anims?.currentFrame)
        const metaHitFrames = Array.isArray(this.hitFrames) && this.hitFrames.length > 0
          ? this.hitFrames
          : getHitFrames(this.scene, this.getSheetForAnim('attack'), 'attack')
        const targetHitFrame = metaHitFrames.length > 0 ? metaHitFrames[0] : 3

        const isHitFrame = frameIdx === targetHitFrame || (time >= this.swingStartTime + 390 && time < this.swingStartTime + 550)

        if (isHitFrame && !this._hitFrameProcessed) {
          this._hitFrameProcessed = true
          this.executeAttackHit(time)
        }

        // Conclude attack if animation finishes or elapsed > 900 ms
        if (time >= this.swingStartTime + 900) {
          this.finishAttack(time)
        }
      }

      // Attacking locks velocity and facing
      if (this.body && typeof this.body.setVelocity === 'function') {
        this.body.setVelocity(0, 0)
      }
    } else if (!this.is(ACTOR_STATES.HURT)) {
      // 2. Run AI update when not attacking or stunned in HURT
      if (this.ai && typeof this.ai.update === 'function') {
        this.ai.update(time, delta)
      }
    }

    // 3. Base Actor update: updates state machine, facing, feet Y-sorting
    super.update(time, delta)
  }

  // --- StateMachine Pass-Through API (with setter to prevent Phaser GameObject collision) ---
  get state() {
    return this.stateMachine ? this.stateMachine.state : this._state
  }

  set state(val) {
    if (this.stateMachine) {
      this.stateMachine.state = val
    } else {
      this._state = val
    }
  }
}
