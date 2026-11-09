/**
 * Enemy — Base class for all non-boss enemy combatants mounted on Actor.
 *
 * Implements:
 * - Dynamic per-sheet feet origin resolution from atlas metadata / AssetRegistry
 * - Accurate footprint collision body from meta.footprint
 * - 4-directional facings (down, left, right, up, dominant axis, no flipX)
 * - Multi-sheet asset resolution (e.g. goblin, goblin_telegraph, goblin_death, goblin_spawn)
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

export const ENEMY_SHEETS = Object.freeze({
  goblin: {
    defaultSheet: 'goblin',
    walkSheet: 'goblin',
    hurtSheet: 'goblin',
    attackSheet: 'goblin',
    telegraphSheet: 'goblin_telegraph',
    deathSheet: 'goblin_death',
    spawnSheet: 'goblin_spawn',
    initialFrame: 'goblin_idle_down',
  },
  brute: {
    assetId: 'goblin_brute',
    defaultSheet: 'goblin_brute',
    walkSheet: 'goblin_brute',
    hurtSheet: 'goblin_brute',
    attackSheet: 'goblin_brute',
    telegraphSheet: 'goblin_brute_telegraph',
    deathSheet: 'goblin_brute_death',
    spawnSheet: 'goblin_brute_spawn',
    initialFrame: 'goblin_brute_idle_down',
  },
  goblin_brute: {
    assetId: 'goblin_brute',
    defaultSheet: 'goblin_brute',
    walkSheet: 'goblin_brute',
    hurtSheet: 'goblin_brute',
    attackSheet: 'goblin_brute',
    telegraphSheet: 'goblin_brute_telegraph',
    deathSheet: 'goblin_brute_death',
    spawnSheet: 'goblin_brute_spawn',
    initialFrame: 'goblin_brute_idle_down',
  },
})

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
    const sheetDef = ENEMY_SHEETS[enemyType] || ENEMY_SHEETS.goblin
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

    this.isArmored = options.isArmored ?? (enemyType === 'brute' || enemyType === 'goblin_brute')
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

    // Attach archetype AI controller
    if (enemyType === 'goblin') {
      this.ai = new GoblinAI(this)
    } else if (enemyType === 'brute' || enemyType === 'goblin_brute') {
      this.ai = new BruteAI(this)
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
   * Resolves the texture atlas sheet key for a given animation action.
   *
   * @param {string} animName
   * @returns {string}
   */
  getSheetForAnim(animName) {
    const sheetDef = ENEMY_SHEETS[this.enemyType] || ENEMY_SHEETS.goblin
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
    console.log(`[Enemy anim] ${key}`)

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

    if (key.includes('death')) {
      if (this.body) {
        this.body.enable = false
      }
      onEnemyDeathComplete(this)
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

    // Armored enemies mid-swing ignore hurt interruption and do not drop attack token
    if (this.isArmored && this.isAttacking) {
      return true
    }

    // If currently attacking, interrupt and release token
    if (this.isAttacking) {
      if (this.scene?.attackTokenManager) {
        this.scene.attackTokenManager.release(this)
      }
      this.isAttacking = false
      this.attackPhase = 'none'
    }

    this.transition(ACTOR_STATES.HURT, { force: true })
    this.playAnim('hurt', false)
    return true
  }

  /**
   * Triggers enemy death sequence and permanently halts movement.
   */
  die() {
    if (this.is(ACTOR_STATES.DEAD)) return

    // Release any allocated attack token
    if (this.scene?.attackTokenManager) {
      this.scene.attackTokenManager.release(this)
    }

    this.isAttacking = false
    this.attackPhase = 'none'
    this.active = false
    this._deathProcessed = true

    this.transition(ACTOR_STATES.DEAD, { force: true })

    if (this.body && typeof this.body.setVelocity === 'function') {
      this.body.setVelocity(0, 0)
    }

    this.playAnim('death', false)
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
      return
    }

    // 1. Manage active attack phase and timing fallbacks
    if (this.isAttacking) {
      if (this.attackPhase === 'telegraph') {
        if (time >= this.telegraphUntil) {
          this.transitionToSwing(time)
        }
      } else if (this.attackPhase === 'swing') {
        // Frame-accurate hit detection: frame 3 or timing fallback (~390 ms)
        const frameIdx = getAnimationFrameIndex(this.anims?.currentFrame)
        const hitFrames = getHitFrames(this.scene, this.getSheetForAnim('attack'), 'attack')
        const targetHitFrame = hitFrames.length > 0 ? hitFrames[0] : 3

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
