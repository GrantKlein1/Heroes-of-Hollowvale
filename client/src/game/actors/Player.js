/**
 * Player — Playable character class mounted on Actor.
 *
 * Implements:
 * - Dynamic 4-class configuration (knight, mage, thief, dwarf)
 * - 4-directional animations for idle, walk, hurt, and attack
 * - Automatic sheet origin resolution and footprint collider binding
 * - Multi-sheet asset handling (e.g. mage_walk vs mage_hurt, knight vs knight_attack)
 * - Priority StateMachine driven animations (IDLE, WALK, HURT, ATTACK)
 * - Frame-accurate melee attack hits on meta hitFrames with combat feedback
 * - 600 ms I-frame protected takeDamage implementation
 */

import Phaser from 'phaser'
import { Actor } from './Actor.js'
import { ACTOR_STATES } from './stateMachine.js'
import { isValidFacing, DEFAULT_FACING } from './facing.js'
import { buildAnimKey } from '../assets/animKeys.js'
import { isBlendRenderer } from '../config/flags.js'
import { onMeleeSwing } from '../MainGameScene.js'
import {
  getAnimationFrameIndex,
  getHitFrames,
  executePlayerMeleeHit,
} from '../combat/hitSystem.js'
import {
  isPlayerInvulnerable,
  setPlayerInvulnerable,
  applyFlash,
  applyKnockback,
  PLAYER_IFRAME_DURATION_MS,
} from '../combat/feedback.js'

export const CLASS_SHEETS = Object.freeze({
  knight: {
    defaultSheet: 'knight',
    walkSheet: 'knight',
    hurtSheet: 'knight',
    attackSheet: 'knight_attack',
    initialFrame: 'knight_idle_down',
  },
  thief: {
    defaultSheet: 'thief',
    walkSheet: 'thief',
    hurtSheet: 'thief',
    attackSheet: 'thief_attack',
    initialFrame: 'thief_idle_down',
  },
  dwarf: {
    defaultSheet: 'dwarf',
    walkSheet: 'dwarf',
    hurtSheet: 'dwarf',
    attackSheet: 'dwarf_attack',
    initialFrame: 'dwarf_idle_down',
  },
  mage: {
    defaultSheet: 'mage_walk',
    walkSheet: 'mage_walk',
    hurtSheet: 'mage_hurt',
    attackSheet: 'mage_attack2',
    initialFrame: 'mage_idle_down',
  },
})

export class Player extends Actor {
  /**
   * @param {import('phaser').Scene} scene - Active Phaser scene
   * @param {number} x - Initial X coordinate
   * @param {number} y - Initial Y coordinate
   * @param {string} [classId='knight'] - Character class ('knight' | 'mage' | 'thief' | 'dwarf')
   * @param {object} [options] - Additional Actor options
   */
  constructor(scene, x = 0, y = 0, classId = 'knight', options = {}) {
    const validClass = classId in CLASS_SHEETS ? classId : 'knight'
    const classDef = CLASS_SHEETS[validClass]

    super(scene, x, y, classDef.defaultSheet, classDef.initialFrame, {
      ...options,
      assetId: validClass,
      facing: options.facing || DEFAULT_FACING,
    })

    this.classId = validClass
    this._lastFacing = this.facing
    this.currentSwingId = 0
    this._hitFramesProcessed = new Set()
    this.invulnerableUntil = 0

    // Listen for animation completion to transition out of non-looping states (HURT, ATTACK)
    if (typeof this.on === 'function') {
      const animCompleteEvent = Phaser?.Animations?.Events?.ANIMATION_COMPLETE || 'animationcomplete'
      this.on(animCompleteEvent, (anim) => {
        this.onAnimationComplete(anim)
      })
    }

    // Hook scene attack and hurt handlers if mounted in HollowvaleScene
    if (scene && typeof scene._tryAttack === 'function' && !scene._hitSystemHooked) {
      scene._hitSystemHooked = true
      const origTryAttack = scene._tryAttack.bind(scene)
      scene._tryAttack = (now) => {
        if (isBlendRenderer() && scene.player instanceof Player) {
          scene._attacking = true
          scene._attackUntil = (now || performance.now()) + 450
          return this.attack(now)
        }
        return origTryAttack(now)
      }

      const origHurtPlayer = scene._hurtPlayer ? scene._hurtPlayer.bind(scene) : null
      if (origHurtPlayer) {
        scene._hurtPlayer = (amount = 10) => {
          if (isBlendRenderer() && scene.player instanceof Player) {
            const tookDamage = this.takeDamage(
              amount,
              typeof performance !== 'undefined' ? performance.now() : Date.now()
            )
            if (!tookDamage) return false
          }
          return origHurtPlayer(amount)
        }
      }
    }

    // Expose lastFx getter on __hv if available
    if (typeof window !== 'undefined' && window.__hv && !window.__hv.lastFx) {
      window.__hv.lastFx = () => this.scene?._lastFx || this._lastFx || null
    }

    // Start with idle animation if scene anims are available
    this.playAnim('idle')
  }

  /**
   * Re-skins and re-configures the player for a new class.
   *
   * @param {string} classId - 'knight' | 'mage' | 'thief' | 'dwarf'
   */
  setClass(classId) {
    if (!(classId in CLASS_SHEETS)) return
    this.classId = classId
    this.assetId = classId

    const classDef = CLASS_SHEETS[classId]

    if (typeof this.setTexture === 'function') {
      this.setTexture(classDef.defaultSheet, classDef.initialFrame)
    }

    this.applySheetOrigin(classDef.defaultSheet)
    this.applyFootprint(classDef.defaultSheet)

    // Replay active animation with new class asset
    if (this.is(ACTOR_STATES.WALK)) {
      this.playAnim('walk', false)
    } else if (this.is(ACTOR_STATES.HURT)) {
      this.playAnim('hurt', false)
    } else if (this.is(ACTOR_STATES.ATTACK)) {
      this.playAnim('attack', false)
    } else {
      this.playAnim('idle', false)
    }
  }

  /**
   * Resolves the sheet key for an animation (handles multi-sheet classes).
   *
   * @param {string} animName
   * @returns {string}
   */
  getSheetForAnim(animName) {
    const classDef = CLASS_SHEETS[this.classId] || CLASS_SHEETS.knight
    if (animName === 'hurt') {
      return classDef.hurtSheet
    }
    if (animName === 'attack') {
      return classDef.attackSheet || classDef.defaultSheet
    }
    return classDef.walkSheet
  }

  /**
   * Plays a player animation with 4-directional key resolution.
   * Automatically switches texture sheets and updates feet anchor when necessary.
   *
   * @param {string} animName - 'idle' | 'walk' | 'hurt' | 'attack'
   * @param {boolean} [ignoreIfPlaying=true]
   * @returns {Player}
   */
  playAnim(animName, ignoreIfPlaying = true) {
    const targetSheet = this.getSheetForAnim(animName)
    if (targetSheet && targetSheet !== this.texture?.key) {
      this.applySheetOrigin(targetSheet)
    }

    const key = this.getAnimKey(animName)
    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(key, ignoreIfPlaying)
    }
    return this
  }

  /**
   * Initiates a melee attack swing.
   * Transitions state machine to ATTACK, plays directional attack animation,
   * locks aim direction during swing, and clears hit tracking.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  attack(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.is(ACTOR_STATES.DEAD)) return false

    // StateMachine priority: ATTACK (3) can interrupt WALK (1) or IDLE (0)
    // If currently HURT (5) or DODGE (4), cannot interrupt; buffer input!
    if (!this.stateMachine.canInterrupt(ACTOR_STATES.ATTACK)) {
      this.bufferInput(ACTOR_STATES.ATTACK, now)
      return false
    }

    const transitioned = this.transition(ACTOR_STATES.ATTACK, { time: now })
    if (!transitioned) return false

    this.currentSwingId = (this.currentSwingId || 0) + 1
    this._hitFramesProcessed = new Set()

    try {
      onMeleeSwing()
    } catch (_e) {
      // Audio stub
    }

    return true
  }

  /**
   * Receives incoming damage with 600 ms I-frame protection.
   *
   * @param {number} [amount=10]
   * @param {number} [now=performance.now()]
   * @param {object} [options]
   * @returns {boolean} - True if damage was taken, false if blocked by I-frames
   */
  takeDamage(amount = 10, now = (typeof performance !== 'undefined' ? performance.now() : Date.now()), options = {}) {
    if (this.is(ACTOR_STATES.DEAD)) return false
    if (isPlayerInvulnerable(this, now)) {
      return false
    }

    setPlayerInvulnerable(this, now, PLAYER_IFRAME_DURATION_MS)
    applyFlash(this, this.scene)

    if (options.fromX !== undefined && options.fromY !== undefined) {
      applyKnockback(this, options.fromX, options.fromY, 120, 150)
    }

    this.transition(ACTOR_STATES.HURT)
    return true
  }

  /**
   * Hook called when StateMachine enters a new state.
   *
   * @param {string} newState
   * @param {string} prevState
   * @param {object} options
   */
  onStateEnter(newState, prevState, options) {
    super.onStateEnter(newState, prevState, options)

    if (newState === ACTOR_STATES.WALK) {
      this.playAnim('walk')
    } else if (newState === ACTOR_STATES.IDLE) {
      this.playAnim('idle')
    } else if (newState === ACTOR_STATES.HURT) {
      this.playAnim('hurt', false)
    } else if (newState === ACTOR_STATES.ATTACK) {
      this.playAnim('attack', false)
    }
  }

  /**
   * Animation completion handler.
   *
   * @param {Phaser.Animations.Animation} [anim]
   */
  onAnimationComplete(anim) {
    const key = anim?.key || this.anims?.currentAnim?.key || ''
    if (key.includes('hurt') && this.is(ACTOR_STATES.HURT)) {
      const consumed = this.consumeBuffer(Date.now())
      if (!consumed) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    } else if (key.includes('attack') && this.is(ACTOR_STATES.ATTACK)) {
      if (this.scene) {
        this.scene._attacking = false
      }
      const consumed = this.consumeBuffer(Date.now())
      if (!consumed) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    }
  }

  /**
   * Sets facing explicitly and refreshes the current directional animation
   * unless in a directional locked state (e.g. ATTACK).
   *
   * @param {string} dir
   * @returns {string}
   */
  setFacing(dir) {
    const prev = this.facing
    super.setFacing(dir)
    if (this.facing !== prev) {
      this._lastFacing = this.facing
      if (!this.is(ACTOR_STATES.ATTACK)) {
        this._refreshCurrentAnim()
      }
    }
    return this.facing
  }

  /**
   * Refreshes the currently playing animation in the new facing direction.
   */
  _refreshCurrentAnim() {
    if (this.is(ACTOR_STATES.WALK)) {
      this.playAnim('walk', false)
    } else if (this.is(ACTOR_STATES.HURT)) {
      this.playAnim('hurt', false)
    } else if (this.is(ACTOR_STATES.ATTACK)) {
      this.playAnim('attack', false)
    } else {
      this.playAnim('idle', false)
    }
  }

  /**
   * Checks for hitFrame triggers during active attack animation.
   *
   * @param {number} time
   */
  _checkAttackHitFrames(time) {
    const currentFrame = this.anims?.currentFrame
    const frameIndex = getAnimationFrameIndex(currentFrame)
    if (frameIndex >= 0 && !this._hitFramesProcessed.has(frameIndex)) {
      const sheetKey = this.getSheetForAnim('attack')
      const hitFrames = getHitFrames(this.scene, sheetKey, 'attack')
      if (hitFrames.includes(frameIndex)) {
        this._hitFramesProcessed.add(frameIndex)
        executePlayerMeleeHit(this, frameIndex, time)
      }
    }
  }

  /**
   * Per-frame update step.
   *
   * @param {number} time
   * @param {number} delta
   */
  update(time = Date.now(), delta = 0) {
    super.update(time, delta)

    // Check hitFrames during active attack
    if (this.is(ACTOR_STATES.ATTACK)) {
      this._checkAttackHitFrames(time)
    }

    const vx = this.body?.velocity?.x || 0
    const vy = this.body?.velocity?.y || 0
    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1

    if (isMoving) {
      if (!this.is(ACTOR_STATES.HURT) && !this.is(ACTOR_STATES.DEAD) && !this.is(ACTOR_STATES.ATTACK)) {
        if (!this.is(ACTOR_STATES.WALK)) {
          this.transition(ACTOR_STATES.WALK)
        }
      }
    } else {
      if (this.is(ACTOR_STATES.WALK)) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    }

    // Refresh animation if facing changed during update (except during attack)
    if (this.facing !== this._lastFacing) {
      this._lastFacing = this.facing
      if (!this.is(ACTOR_STATES.ATTACK)) {
        this._refreshCurrentAnim()
      }
    }
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
