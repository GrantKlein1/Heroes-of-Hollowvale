/**
 * Player — Playable character class mounted on Actor.
 *
 * Implements:
 * - Dynamic 4-class configuration (knight, mage, thief, dwarf)
 * - 4-directional animations for idle, walk, and hurt
 * - Automatic sheet origin resolution and footprint collider binding
 * - Multi-sheet asset handling (e.g. mage_walk vs mage_hurt)
 * - Priority StateMachine driven animations (IDLE, WALK, HURT)
 */

import Phaser from 'phaser'
import { Actor } from './Actor.js'
import { ACTOR_STATES } from './stateMachine.js'
import { isValidFacing, DEFAULT_FACING } from './facing.js'
import { buildAnimKey } from '../assets/animKeys.js'

export const CLASS_SHEETS = Object.freeze({
  knight: {
    defaultSheet: 'knight',
    walkSheet: 'knight',
    hurtSheet: 'knight',
    initialFrame: 'knight_idle_down',
  },
  thief: {
    defaultSheet: 'thief',
    walkSheet: 'thief',
    hurtSheet: 'thief',
    initialFrame: 'thief_idle_down',
  },
  dwarf: {
    defaultSheet: 'dwarf',
    walkSheet: 'dwarf',
    hurtSheet: 'dwarf',
    initialFrame: 'dwarf_idle_down',
  },
  mage: {
    defaultSheet: 'mage_walk',
    walkSheet: 'mage_walk',
    hurtSheet: 'mage_hurt',
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

    // Listen for animation completion to transition out of non-looping states (e.g. HURT)
    if (typeof this.on === 'function') {
      const animCompleteEvent = Phaser?.Animations?.Events?.ANIMATION_COMPLETE || 'animationcomplete'
      this.on(animCompleteEvent, (anim) => {
        this.onAnimationComplete(anim)
      })
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
    } else {
      this.playAnim('idle', false)
    }
  }

  /**
   * Resolves the sheet key for an animation (handles multi-sheet classes like mage).
   *
   * @param {string} animName
   * @returns {string}
   */
  getSheetForAnim(animName) {
    const classDef = CLASS_SHEETS[this.classId] || CLASS_SHEETS.knight
    if (animName === 'hurt') {
      return classDef.hurtSheet
    }
    return classDef.walkSheet
  }

  /**
   * Plays a player animation with 4-directional key resolution.
   * Automatically switches texture sheets and updates feet anchor when necessary.
   *
   * @param {string} animName - 'idle' | 'walk' | 'hurt'
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
      // Consume any valid buffered input or return to IDLE
      const consumed = this.consumeBuffer(Date.now())
      if (!consumed) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    }
  }

  /**
   * Sets facing explicitly and refreshes the current directional animation.
   *
   * @param {string} dir
   * @returns {string}
   */
  setFacing(dir) {
    const prev = this.facing
    super.setFacing(dir)
    if (this.facing !== prev) {
      this._lastFacing = this.facing
      this._refreshCurrentAnim()
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
    } else {
      this.playAnim('idle', false)
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

    const vx = this.body?.velocity?.x || 0
    const vy = this.body?.velocity?.y || 0
    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1

    if (isMoving) {
      if (!this.is(ACTOR_STATES.HURT) && !this.is(ACTOR_STATES.DEAD)) {
        if (!this.is(ACTOR_STATES.WALK)) {
          this.transition(ACTOR_STATES.WALK)
        }
      }
    } else {
      if (this.is(ACTOR_STATES.WALK)) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    }

    // Refresh animation if facing changed during update
    if (this.facing !== this._lastFacing) {
      this._lastFacing = this.facing
      this._refreshCurrentAnim()
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
