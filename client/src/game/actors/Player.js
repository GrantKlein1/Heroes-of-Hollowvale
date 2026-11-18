/**
 * Player — Playable character class mounted on Actor.
 *
 * Implements:
 * - Dynamic 4-class configuration (knight, mage, thief, dwarf)
 * - 4-directional animations for idle, walk, hurt, attack, dodge, block, stealth, and death
 * - Automatic sheet origin resolution and footprint collider binding
 * - Multi-sheet asset handling (e.g. mage_walk vs mage_hurt, knight vs knight_attack/block/dodge)
 * - Priority StateMachine driven animations (IDLE, WALK, BLOCK, ATTACK, DODGE, HURT, DEAD)
 * - Frame-accurate melee attack hits on meta hitFrames with combat feedback
 * - Dodge roll with metadata-driven I-frame range and 600 ms cooldown
 * - Knight shield block with 70% frontal damage reduction, block_start/hold/hit states
 * - Real Blendsmith death animations with holdLast on completion
 * - Thief stealth vanish and reappear mechanics
 * - Mage spell casting (Fireball, Lightning, Leech, Shield, Blink) and Thief poison vial
 */

import Phaser from 'phaser'
import { Actor } from './Actor.js'
import { ACTOR_STATES } from './stateMachine.js'
import { isValidFacing, DEFAULT_FACING } from './facing.js'
import { buildAnimKey } from '../assets/animKeys.js'
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
import { session } from '../session.js'
import { getHeldItemId, holdClipFor, useClipFor, getItemAnchor, inhandAtlasKey } from './itemHold.js'
import {
  castFireball,
  castLightning,
  castLeech,
  castShield,
  castBlink,
  armPoisonVialThrow,
  tickPoisonVialThrow,
  cancelPoisonVialThrow,
  getVialThrowTiming,
  armMageV2Cast,
  tickMageV2Cast,
  ensureMageSpellsGroup,
  getV2CastFramePivot,
  getV2CastBodyLayout,
} from '../combat/spells.js'
import {
  DODGE_COOLDOWN_MS,
  getDodgeMeta,
  isDodgeInvulnerable,
  getFacingDisplacement,
} from '../combat/dodge.js'
import {
  calculateBlockMitigation,
} from '../combat/block.js'
import { attackAnimTimeScale } from '../combat/balance.js'

export const CLASS_SHEETS = Object.freeze({
  knight: {
    defaultSheet: 'knight',
    walkSheet: 'knight',
    runSheet: 'knight_run',
    hurtSheet: 'knight',
    attackSheet: 'knight_attack',
    attack2Sheet: 'knight_attack2',
    chargedSheet: 'knight_charged',
    dodgeSheet: 'knight_dodge',
    blockSheet: 'knight_block',
    deathSheet: 'knight_death',
    initialFrame: 'knight_idle_down',
  },
  thief: {
    defaultSheet: 'thief',
    walkSheet: 'thief',
    runSheet: 'thief_run',
    hurtSheet: 'thief',
    attackSheet: 'thief_attack',
    attack2Sheet: 'thief_attack2',
    chargedSheet: 'thief_charged',
    dodgeSheet: 'thief_dodge',
    deathSheet: 'thief_death',
    stealthSheet: 'thief_stealth',
    initialFrame: 'thief_idle_down',
  },
  dwarf: {
    defaultSheet: 'dwarf',
    walkSheet: 'dwarf',
    runSheet: 'dwarf_run',
    hurtSheet: 'dwarf',
    attackSheet: 'dwarf_attack',
    attack2Sheet: 'dwarf_attack2',
    chargedSheet: 'dwarf_charged',
    dodgeSheet: 'dwarf_dodge',
    deathSheet: 'dwarf_death',
    initialFrame: 'dwarf_idle_down',
  },
  mage: {
    defaultSheet: 'mage_walk',
    walkSheet: 'mage_walk',
    runSheet: 'mage_run',
    hurtSheet: 'mage_hurt',
    attackSheet: 'mage_attack2',
    attack2Sheet: 'mage_attack2',
    chargedSheet: 'mage_charged',
    castSheet: 'mage_cast',
    dodgeSheet: 'mage_dodge',
    deathSheet: 'mage_death',
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
    this.lastDamageTaken = 0

    // Dodge & Block states
    this.dodgeCooldownUntil = 0
    this.dodgeState = { active: false, startTime: 0, meta: null, frameIndex: 0 }
    this._lastDodgeFrame = -1

    this.blockState = { active: false, stage: 'idle', startTime: 0, holding: false, qaHolding: false }
    this.vanishState = { active: false, startTime: 0, invisible: false }

    // P2 Combat States: Combo, Charge, Run
    this.currentAttackType = null
    this.comboQueued = false
    this.chargeState = { active: false, startTime: 0, charged: false }
    this.isRunning = false

    // Item hold and use states (Package IT-1)
    this.itemUseState = { active: false, itemId: null, startTime: 0, clip: null }
    this.itemSprite = null
    this._vialThrow = null
    this._vialCooldownUntil = 0

    // Listen for animation completion to transition out of non-looping states
    if (typeof this.on === 'function') {
      const animCompleteEvent = Phaser?.Animations?.Events?.ANIMATION_COMPLETE || 'animationcomplete'
      this.on(animCompleteEvent, (anim) => {
        this.onAnimationComplete(anim)
      })
    }

    // Hook scene attack and hurt handlers if mounted in HollowvaleScene.
    // The painted-renderer fallback is gone; these always run the blend player.
    if (scene && typeof scene._tryAttack === 'function' && !scene._hitSystemHooked) {
      scene._hitSystemHooked = true
      scene._tryAttack = (now) => {
        const cls = session.classId
        const item = session.equippedId
        if (cls === 'thief' && item === 'poison_vial') {
          return this.beginVialThrow(now)
        }
        if (cls === 'mage' && item === 'spellbook') {
          scene._attacking = true
          return this.cast(session.spellId || 'lightning', now)
        }
        scene._attacking = true
        return this.attack(now)
      }

      const origHurtPlayer = scene._hurtPlayer ? scene._hurtPlayer.bind(scene) : null
      if (origHurtPlayer) {
        scene._hurtPlayer = (amount = 10, opts = {}) => {
          const tookDamage = this.takeDamage(
            amount,
            typeof performance !== 'undefined' ? performance.now() : Date.now(),
            { ...opts, fromSceneHurt: true }
          )
          if (!tookDamage) return false
          const actualDamage = typeof this.lastDamageTaken === 'number' ? this.lastDamageTaken : amount
          return origHurtPlayer(actualDamage, opts)
        }
      }
    }

    // Expose lastFx and cast getters on __hv if available
    if (typeof window !== 'undefined' && window.__hv) {
      if (!window.__hv.lastFx) {
        window.__hv.lastFx = () => this.scene?._lastFx || this._lastFx || null
      }
      if (!window.__hv.cast) {
        window.__hv.cast = (spellId) => this.cast(spellId)
      }
    }

    if (this.classId === 'mage') {
      ensureMageSpellsGroup(this.scene)
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
    if (this._vialThrow && !this._vialThrow.released) {
      cancelPoisonVialThrow(this)
    }
    if (this.itemSprite) {
      if (typeof this.itemSprite.destroy === 'function') {
        this.itemSprite.destroy()
      }
      this.itemSprite = null
    }
    this.classId = classId
    this.assetId = classId
    if (this.classId === 'mage') {
      ensureMageSpellsGroup(this.scene)
    }

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
      this.playAnim('attack', true)
    } else if (this.is(ACTOR_STATES.DODGE)) {
      this.playAnim('dodge', false)
    } else if (this.is(ACTOR_STATES.BLOCK)) {
      this.playAnim(this.blockState?.stage === 'hold' ? 'block_hold' : 'block_start', false)
    } else if (this.is(ACTOR_STATES.DEAD)) {
      this.playAnim('death', false)
    } else {
      this.playAnim('idle', false)
    }
  }

  /**
   * Checks whether the player is currently moving at run speed.
   *
   * @returns {boolean}
   */
  isAtRunSpeed() {
    if (this.isRunning) return true
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (session?.speedBoostUntil && session.speedBoostUntil > now) return true
    const vx = this.body?.velocity?.x || 0
    const vy = this.body?.velocity?.y || 0
    const currentSpeed = Math.hypot(vx, vy)
    const unit = this.scene?.unit || 1
    const baseSpeed = (session?.baseSpeed || 160) * unit
    return currentSpeed >= baseSpeed * 1.2
  }

  /**
   * Resolves sheet key for a given animation action type based on active class.
   *
   * @param {string} animType - 'idle' | 'walk' | 'run' | 'hurt' | 'attack' | 'attack_2' | 'charge_hold' | 'charged_release' | 'cast' | 'dodge' | 'block' | 'death' | 'vanish'
   * @returns {string}
   */
  getSheetForAnim(animType) {
    const classDef = CLASS_SHEETS[this.classId] || CLASS_SHEETS.knight
    if (this.currentAttackType === 'attack_2' && animType === 'attack') {
      return classDef.attack2Sheet || classDef.attackSheet
    }
    if (this.currentAttackType === 'charged_release' && animType === 'attack') {
      return classDef.chargedSheet || classDef.attackSheet
    }
    switch (animType) {
      case 'walk':
        return classDef.walkSheet
      case 'run':
        return classDef.runSheet || classDef.walkSheet
      case 'hurt':
        return classDef.hurtSheet
      case 'attack':
        return classDef.attackSheet
      case 'attack_2':
        return classDef.attack2Sheet || classDef.attackSheet
      case 'charge_hold':
      case 'charged_release':
        return classDef.chargedSheet || classDef.attackSheet
      case 'cast':
        return classDef.castSheet || classDef.attackSheet || classDef.defaultSheet
      case 'dodge':
        return classDef.dodgeSheet || classDef.defaultSheet
      case 'block':
      case 'block_start':
      case 'block_hold':
      case 'block_hit':
        return classDef.blockSheet || classDef.defaultSheet
      case 'death':
        return classDef.deathSheet || classDef.defaultSheet
      case 'vanish':
      case 'reappear':
        return classDef.stealthSheet || classDef.defaultSheet
      default:
        return classDef.defaultSheet
    }
  }

  /**
   * Resolves canonical animation key for a given action and direction.
   *
   * @param {string} anim
   * @param {string} [dir=this.facing]
   * @returns {string}
   */
  getAnimKey(anim, dir = this.facing) {
    if (anim === 'run') {
      return buildAnimKey(this.assetId, 'run', dir)
    }
    if (anim === 'attack_2') {
      return buildAnimKey(this.assetId, 'attack_2', dir)
    }
    if (anim === 'charge_hold') {
      return buildAnimKey(this.assetId, 'charge_hold', dir)
    }
    if (anim === 'charged_release') {
      return buildAnimKey(this.assetId, 'charged_release', dir)
    }
    if (anim === 'attack' && this.classId === 'mage') {
      return buildAnimKey(this.assetId, 'attack_2', dir)
    }
    if (anim === 'cast' && this.classId === 'mage') {
      return buildAnimKey(this.assetId, 'cast', dir)
    }
    return super.getAnimKey(anim, dir)
  }

  /**
   * Plays the directional animation for the given action type.
   *
   * @param {string} animName - 'idle' | 'walk' | 'hurt' | 'attack' | 'cast' | 'dodge' | 'block_start' | 'death'
   * @param {boolean} [ignoreIfPlaying=true]
   * @returns {Player}
   */
  playAnim(animName, ignoreIfPlaying = true) {
    if (this.itemUseState?.active) {
      if (animName === 'idle' || animName === 'walk' || animName === 'run') {
        this._syncItemInHandSprite()
        return this
      }
    }

    const isBusy = (
      this.is(ACTOR_STATES.ATTACK) ||
      this.is(ACTOR_STATES.DODGE) ||
      this.is(ACTOR_STATES.BLOCK) ||
      this.is(ACTOR_STATES.HURT) ||
      this.is(ACTOR_STATES.DEAD) ||
      Boolean(this.vanishState?.invisible)
    )

    const heldItem = !isBusy ? getHeldItemId(session) : null
    let targetSheet
    let key

    if (heldItem && (animName === 'idle' || animName === 'walk' || animName === 'run')) {
      const clip = holdClipFor(animName === 'walk' || animName === 'run')
      targetSheet = `${this.classId}_${clip}`
      key = `${this.classId}_${clip}_${this.facing}`
    } else {
      targetSheet = this.getSheetForAnim(animName)
      key = this.getAnimKey(animName)
    }

    if (targetSheet && targetSheet !== this.texture?.key) {
      this.applySheetOrigin(targetSheet)
    }

    if (this.scene?.anims && typeof this.scene.anims.exists === 'function' && !this.scene.anims.exists(key)) {
      console.warn(`[Player] Animation key "${key}" not found in scene anims.`)
      if (this.is(ACTOR_STATES.ATTACK) || this.is(ACTOR_STATES.HURT) || this.is(ACTOR_STATES.DODGE)) {
        if (this.scene) {
          this.scene._attacking = false
        }
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
      return this
    }

    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(key, ignoreIfPlaying)
      this.anims.timeScale = attackAnimTimeScale(this.classId, animName)
    }

    if (targetSheet) {
      this.applySheetOrigin(targetSheet)
      this.applyFootprint(targetSheet)
    }

    this._syncItemInHandSprite()

    return this
  }

  /**
   * Triggers an attack swing or chains attack_2 combo if inside combo window.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  attack(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.is(ACTOR_STATES.DEAD)) return false

    // Combo check: if already in attack swing 1, check combo window
    if (this.is(ACTOR_STATES.ATTACK) && (!this.currentAttackType || this.currentAttackType === 'attack')) {
      const frameIndex = getAnimationFrameIndex(this.anims?.currentFrame)
      if (frameIndex >= 3) {
        this.currentAttackType = 'attack_2'
        this.comboQueued = false
        this.currentSwingId = (this.currentSwingId || 0) + 1
        this._hitFramesProcessed = new Set()
        this.playAnim('attack_2', false)
        try {
          onMeleeSwing()
        } catch (_e) {}
        return true
      } else {
        this.comboQueued = true
        return true
      }
    }

    if (!this.stateMachine.canInterrupt(ACTOR_STATES.ATTACK)) {
      this.bufferInput(ACTOR_STATES.ATTACK, now)
      return false
    }

    const transitioned = this.transition(ACTOR_STATES.ATTACK, { time: now })
    if (!transitioned) return false

    this.currentAttackType = 'attack'
    this.comboQueued = false
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
   * Begins charging a melee attack (hold).
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  startCharge(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.is(ACTOR_STATES.DEAD)) return false
    if (!this.stateMachine.canInterrupt(ACTOR_STATES.ATTACK)) {
      return false
    }

    const transitioned = this.transition(ACTOR_STATES.ATTACK, { time: now })
    if (!transitioned) return false

    this.chargeState = {
      active: true,
      startTime: now,
      charged: false,
    }
    this.currentAttackType = 'charge_hold'
    this.playAnim('charge_hold', false)

    if (this.body && typeof this.body.setVelocity === 'function') {
      this.body.setVelocity(0, 0)
    }

    return true
  }

  /**
   * Releases a charged melee attack.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  releaseCharge(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!this.chargeState?.active) return false

    const isCharged = this.chargeState.charged || (now - this.chargeState.startTime >= 600)
    this.chargeState.active = false

    this.currentSwingId = (this.currentSwingId || 0) + 1
    this._hitFramesProcessed = new Set()

    if (isCharged) {
      this.currentAttackType = 'charged_release'
      this.playAnim('charged_release', false)
      try {
        onMeleeSwing()
      } catch (_e) {}
      return true
    } else {
      this.currentAttackType = 'attack'
      this.playAnim('attack', false)
      try {
        onMeleeSwing()
      } catch (_e) {}
      return true
    }
  }

  /**
   * Initiates a spell cast (Mage Fireball, Lightning, Leech, Shield, Blink).
   *
   * @param {string} [spellId='fireball']
   * @param {number} [now]
   * @returns {boolean}
   */
  cast(spellId = 'fireball', now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.is(ACTOR_STATES.DEAD)) return false

    if (!this.stateMachine.canInterrupt(ACTOR_STATES.ATTACK)) {
      this.bufferInput(ACTOR_STATES.ATTACK, now)
      return false
    }

    const v2MageCast = this.classId === 'mage' && (spellId === 'lightning' || spellId === 'leech')
    if (v2MageCast) {
      const pending = armMageV2Cast(this.scene, this, spellId, now)
      if (!pending) return false
      this.currentAttackType = `cast_${spellId}`
      const transitioned = this.transition(ACTOR_STATES.ATTACK, { time: now })
      if (!transitioned) {
        this._v2Cast = null
        this.currentAttackType = null
        return false
      }
      return true
    }

    let success = false
    if (spellId === 'fireball') {
      const proj = castFireball(this.scene, this, now)
      if (proj) success = true
    } else if (spellId === 'lightning') {
      const proj = castLightning(this.scene, this, now)
      if (proj) success = true
    } else if (spellId === 'leech') {
      const proj = castLeech(this.scene, this, now)
      if (proj) success = true
    } else if (spellId === 'shield') {
      const s = castShield(this.scene, this, now)
      if (s) success = true
    } else if (spellId === 'blink') {
      success = castBlink(this.scene, this, now)
    }

    if (success) {
      const transitioned = this.transition(ACTOR_STATES.ATTACK, { time: now })
      if (transitioned) {
        this.playAnim('cast', false)
      }
      return true
    }

    return false
  }

  /**
   * Initiates a dodge roll (all 4 classes) with 600 ms cooldown.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  dodge(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.is(ACTOR_STATES.DEAD)) return false
    if (now < this.dodgeCooldownUntil) return false

    if (!this.stateMachine.canInterrupt(ACTOR_STATES.DODGE)) {
      this.bufferInput(ACTOR_STATES.DODGE, now)
      return false
    }

    const transitioned = this.transition(ACTOR_STATES.DODGE, { time: now })
    if (!transitioned) return false

    this.dodgeCooldownUntil = now + DODGE_COOLDOWN_MS
    const dodgeMeta = getDodgeMeta(this.scene, this.getSheetForAnim('dodge'), this.classId)
    this.dodgeState = {
      active: true,
      startTime: now,
      meta: dodgeMeta,
      frameIndex: 0,
    }
    this._lastDodgeFrame = -1

    if (this.body && typeof this.body.setVelocity === 'function') {
      this.body.setVelocity(0, 0)
    }

    return true
  }

  /**
   * Begins shield blocking (Knight exclusive).
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  startBlock(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.classId !== 'knight') return false
    if (this.is(ACTOR_STATES.DEAD)) return false

    if (this.is(ACTOR_STATES.BLOCK)) {
      if (this.blockState) this.blockState.holding = true
      return true
    }

    if (!this.stateMachine.canInterrupt(ACTOR_STATES.BLOCK)) {
      this.bufferInput(ACTOR_STATES.BLOCK, now)
      return false
    }

    const hadQaHolding = Boolean(this.blockState?.qaHolding)
    const transitioned = this.transition(ACTOR_STATES.BLOCK, { time: now })
    if (!transitioned) return false

    this.blockState = {
      active: true,
      stage: 'start',
      startTime: now,
      holding: true,
      qaHolding: hadQaHolding,
    }

    if (this.body && typeof this.body.setVelocity === 'function') {
      this.body.setVelocity(0, 0)
    }

    return true
  }

  /**
   * Releases shield block.
   */
  stopBlock() {
    if (this.blockState) {
      this.blockState.holding = false
      this.blockState.active = false
      this.blockState.qaHolding = false
    }
    if (this.is(ACTOR_STATES.BLOCK)) {
      this.transition(ACTOR_STATES.IDLE, { force: true })
    }
  }

  /**
   * Checks whether the player is currently blocking.
   *
   * @returns {boolean}
   */
  isBlocking() {
    return this.classId === 'knight' && this.is(ACTOR_STATES.BLOCK) && Boolean(this.blockState?.active)
  }

  /**
   * Checks whether the player is currently dodging.
   *
   * @returns {boolean}
   */
  isDodging() {
    return this.is(ACTOR_STATES.DODGE) && Boolean(this.dodgeState?.active)
  }

  /**
   * Plays the real Blendsmith death animation and permanently halts movement.
   */
  die() {
    if (this.is(ACTOR_STATES.DEAD)) return
    this.transition(ACTOR_STATES.DEAD, { force: true })
    if (this.body && typeof this.body.setVelocity === 'function') {
      this.body.setVelocity(0, 0)
    }
    this.playAnim('death', false)
  }

  /**
   * Resets player state to IDLE upon area entrance respawn.
   */
  respawn() {
    this.transition(ACTOR_STATES.IDLE, { force: true })
    if (this.body && typeof this.body.setVelocity === 'function') {
      this.body.setVelocity(0, 0)
    }
    if (this.body) {
      this.body.enable = true
    }
    this.lastDamageTaken = 0
    this.playAnim('idle', false)
  }

  /**
   * Triggers Thief stealth vanish animation.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  vanish(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.classId !== 'thief' || this.is(ACTOR_STATES.DEAD)) return false
    this.vanishState = { active: true, startTime: now, invisible: false }
    this.playAnim('vanish', false)
    return true
  }

  /**
   * Restores Thief visibility via reappear animation.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  reappear(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.classId !== 'thief' || this.is(ACTOR_STATES.DEAD)) return false
    if (typeof this.setVisible === 'function') {
      this.setVisible(true)
    } else {
      this.visible = true
    }
    this.vanishState = { active: false, startTime: now, invisible: false }
    this.playAnim('reappear', false)
    return true
  }

  /**
   * Takes incoming damage with dodge I-frame, block frontal mitigation, and hurt I-frame checks.
   *
   * @param {number} [amount=10]
   * @param {number} [now=performance.now()]
   * @param {object} [options]
   * @returns {boolean} - False if blocked/dodged (0 damage), or true if damage was taken
   */
  takeDamage(amount = 10, now = (typeof performance !== 'undefined' ? performance.now() : Date.now()), options = {}) {
    if (this.is(ACTOR_STATES.DEAD)) return false

    // 1. Dodge I-frames: taking 0 damage
    if (this.is(ACTOR_STATES.DODGE) && this.dodgeState?.active) {
      const frameIndex = getAnimationFrameIndex(this.anims?.currentFrame)
      if (isDodgeInvulnerable(this.dodgeState, frameIndex, now)) {
        return false // Dodged: 0 damage
      }
    }

    // 2. Hurt I-frames
    if (isPlayerInvulnerable(this, now)) {
      return false
    }

    // 3. Knight Shield Block (70% frontal reduction, 120° arc)
    if (this.is(ACTOR_STATES.BLOCK) && this.classId === 'knight') {
      const attackerPos = (options.fromX !== undefined && options.fromY !== undefined)
        ? { x: options.fromX, y: options.fromY }
        : (options.attacker ? { x: options.attacker.x, y: options.attacker.y } : null)

      const blockResult = calculateBlockMitigation(this, amount, attackerPos)
      if (blockResult.blocked && blockResult.isFrontal) {
        const blockedDamage = blockResult.finalDamage
        this.lastDamageTaken = blockedDamage
        this.blockState.stage = 'hit'
        this.playAnim('block_hit', false)

        setPlayerInvulnerable(this, now, 200)
        applyFlash(this, this.scene)

        if (attackerPos) {
          const blockKnockbackSpeed = options.knockbackSpeed ? Math.round(options.knockbackSpeed * 0.4) : 40
          applyKnockback(this, attackerPos.x, attackerPos.y, blockKnockbackSpeed, 100)
        }
        if (!options.fromSceneHurt && this.scene && typeof this.scene.hp === 'number') {
          this.scene.hp = Math.max(0, this.scene.hp - this.lastDamageTaken)
          if (typeof this.scene._publishVitals === 'function') {
            this.scene._publishVitals(true)
          }
        }
        return true
      }
    }

    // 4. Full Hit
    this.lastDamageTaken = amount
    setPlayerInvulnerable(this, now, PLAYER_IFRAME_DURATION_MS)
    applyFlash(this, this.scene)

    if (options.fromX !== undefined && options.fromY !== undefined) {
      const knockbackSpeed = options.knockbackSpeed ?? 120
      const knockbackDuration = options.knockbackDuration ?? 150
      applyKnockback(this, options.fromX, options.fromY, knockbackSpeed, knockbackDuration)
    }

    if (!options.fromSceneHurt && this.scene && typeof this.scene.hp === 'number') {
      this.scene.hp = Math.max(0, this.scene.hp - this.lastDamageTaken)
      if (typeof this.scene._publishVitals === 'function') {
        this.scene._publishVitals(true)
      }
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

    if (
      newState === ACTOR_STATES.HURT
      || newState === ACTOR_STATES.DODGE
      || newState === ACTOR_STATES.DEAD
    ) {
      if (this._vialThrow && !this._vialThrow.released) {
        cancelPoisonVialThrow(this)
      }
    }

    if (newState === ACTOR_STATES.WALK) {
      this.playAnim(this.isAtRunSpeed() ? 'run' : 'walk')
    } else if (newState === ACTOR_STATES.IDLE) {
      this.playAnim('idle')
    } else if (newState === ACTOR_STATES.HURT) {
      this.playAnim('hurt', false)
    } else if (newState === ACTOR_STATES.ATTACK) {
      if (this.currentAttackType === 'charge_hold') {
        this.playAnim('charge_hold', false)
      } else if (this.currentAttackType === 'charged_release') {
        this.playAnim('charged_release', false)
      } else if (this.currentAttackType === 'attack_2') {
        this.playAnim('attack_2', false)
      } else if (typeof this.currentAttackType === 'string' && this.currentAttackType.startsWith('cast_')) {
        this._playV2CastBody()
      } else {
        this.playAnim(this.anims?.currentAnim?.key?.includes('cast') ? 'cast' : 'attack', false)
      }
    } else if (newState === ACTOR_STATES.DODGE) {
      this.playAnim('dodge', false)
    } else if (newState === ACTOR_STATES.BLOCK) {
      this.playAnim(this.blockState?.stage === 'hold' ? 'block_hold' : 'block_start', false)
    } else if (newState === ACTOR_STATES.DEAD) {
      this.playAnim('death', false)
    }
  }

  /**
   * Animation completion handler.
   *
   * @param {Phaser.Animations.Animation} [anim]
   */
  onAnimationComplete(anim) {
    const key = anim?.key || this.anims?.currentAnim?.key || ''
    if (key.includes('use_drink') || key.includes('use_eat') || key.includes('use_throw')) {
      if (this.itemUseState?.active) {
        this.itemUseState = { active: false, itemId: null, startTime: 0, clip: null }
        this._refreshCurrentAnim()
        this._syncItemInHandSprite()
      }
      return
    }
    if (key.includes('hurt') && this.is(ACTOR_STATES.HURT)) {
      const consumed = this.consumeBuffer(Date.now())
      if (!consumed) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    } else if ((key.includes('attack') || key.includes('cast') || key.includes('charged_release')) && this.is(ACTOR_STATES.ATTACK)) {
      if (this.currentAttackType === 'charge_hold') {
        return // Loop while held
      }
      if (typeof this.currentAttackType === 'string' && this.currentAttackType.startsWith('cast_')) {
        this._v2Cast = null
      }
      if (this.currentAttackType === 'attack' && this.comboQueued) {
        this.comboQueued = false
        this.currentAttackType = 'attack_2'
        this.currentSwingId = (this.currentSwingId || 0) + 1
        this._hitFramesProcessed = new Set()
        this.playAnim('attack_2', false)
        try {
          onMeleeSwing()
        } catch (_e) {}
        return
      }
      this.currentAttackType = null
      this.comboQueued = false
      if (this.scene) {
        this.scene._attacking = false
      }
      const consumed = this.consumeBuffer(Date.now())
      if (!consumed) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    } else if (key.includes('dodge') && this.is(ACTOR_STATES.DODGE)) {
      this.dodgeState.active = false
      this._lastDodgeFrame = -1
      const consumed = this.consumeBuffer(Date.now())
      if (!consumed) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    } else if (key.includes('block_start') && this.is(ACTOR_STATES.BLOCK)) {
      if (this.blockState?.holding) {
        this.blockState.stage = 'hold'
        this.playAnim('block_hold', true)
      } else {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    } else if (key.includes('block_hit') && this.is(ACTOR_STATES.BLOCK)) {
      if (this.blockState?.holding) {
        this.blockState.stage = 'hold'
        this.playAnim('block_hold', true)
      } else {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    } else if (key.includes('death')) {
      if (this.anims?.pause) {
        this.anims.pause()
      }
    } else if (key.includes('vanish')) {
      if (typeof this.setVisible === 'function') {
        this.setVisible(false)
      } else {
        this.visible = false
      }
      this.vanishState.invisible = true
    } else if (key.includes('reappear')) {
      const consumed = this.consumeBuffer(Date.now())
      if (!consumed) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    }
  }

  /**
   * Sets facing explicitly and refreshes the current directional animation
   * unless in a directional locked state (e.g. ATTACK, DODGE, DEAD).
   *
   * @param {string} dir
   * @returns {string}
   */
  setFacing(dir) {
    const prev = this.facing
    super.setFacing(dir)
    if (this.facing !== prev) {
      this._lastFacing = this.facing
      if (!this.is(ACTOR_STATES.ATTACK) && !this.is(ACTOR_STATES.DODGE) && !this.is(ACTOR_STATES.DEAD)) {
        this._refreshCurrentAnim()
      }
    }
    return this.facing
  }

  /**
   * Refreshes the currently playing animation in the new facing direction.
   */
  _refreshCurrentAnim() {
    if (this.itemUseState?.active) {
      const clip = this.itemUseState.clip || 'use_drink'
      const newKey = `${this.classId}_${clip}_${this.facing}`
      const sheetKey = `${this.classId}_${clip}`
      const frameIndex = getAnimationFrameIndex(this.anims?.currentFrame)

      this.applySheetOrigin(sheetKey)
      if (this.anims && typeof this.anims.play === 'function') {
        this.anims.play(newKey, false)
        if (frameIndex >= 0) {
          const animObj = typeof this.scene?.anims?.get === 'function' ? this.scene.anims.get(newKey) : null
          const targetFrame = animObj?.frames?.[frameIndex] || this.anims?.currentAnim?.frames?.[frameIndex]
          if (targetFrame && typeof this.anims?.setCurrentFrame === 'function') {
            this.anims.setCurrentFrame(targetFrame)
          }
        }
      }
      this.applySheetOrigin(sheetKey)
      this.applyFootprint(sheetKey)
      this._syncItemInHandSprite()
      return
    }

    if (this.is(ACTOR_STATES.WALK)) {
      this.playAnim(this.isAtRunSpeed() ? 'run' : 'walk', false)
    } else if (this.is(ACTOR_STATES.HURT)) {
      this.playAnim('hurt', false)
    } else if (this.is(ACTOR_STATES.ATTACK)) {
      if (this.currentAttackType === 'charge_hold') {
        this.playAnim('charge_hold', false)
      } else if (this.currentAttackType === 'charged_release') {
        this.playAnim('charged_release', false)
      } else if (this.currentAttackType === 'attack_2') {
        this.playAnim('attack_2', false)
      } else if (typeof this.currentAttackType === 'string' && this.currentAttackType.startsWith('cast_')) {
        this._playV2CastBody()
      } else {
        this.playAnim(this.anims?.currentAnim?.key?.includes('cast') ? 'cast' : 'attack', false)
      }
    } else if (this.is(ACTOR_STATES.DODGE)) {
      this.playAnim('dodge', false)
    } else if (this.is(ACTOR_STATES.BLOCK)) {
      this.playAnim(this.blockState?.stage === 'hold' ? 'block_hold' : 'block_start', false)
    } else if (this.is(ACTOR_STATES.DEAD)) {
      this.playAnim('death', false)
    } else {
      this.playAnim('idle', false)
    }

    this._syncItemInHandSprite()
  }

  /**
   * Starts the thief poison-vial wind-up. The projectile, item cost, and
   * cooldown wait until releaseFrame 3. Facing changes reuse the use-clip path.
   *
   * @param {number} [now]
   * @returns {object|null}
   */
  beginVialThrow(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.classId !== 'thief') return null
    if (this.is(ACTOR_STATES.DEAD) || this.is(ACTOR_STATES.HURT) || this.is(ACTOR_STATES.DODGE)) return null
    if (this.itemUseState?.active && this.itemUseState.clip !== 'use_throw') return null

    const alreadyWinding = Boolean(this._vialThrow && !this._vialThrow.released && !this._vialThrow.cancelled)
    const pending = armPoisonVialThrow(this.scene, this, now)
    if (!pending) return null
    if (alreadyWinding || pending.animStarted) return pending

    pending.animStarted = true
    this.itemUseState = { active: true, itemId: 'poison_vial', startTime: now, clip: 'use_throw' }
    const key = pending.animKey
    const sheetKey = 'thief_use_throw'

    if (this.scene?.anims && typeof this.scene.anims.exists === 'function' && !this.scene.anims.exists(key)) {
      console.warn(`[Player] Animation key "${key}" not found in scene anims.`)
    }

    this.applySheetOrigin(sheetKey)
    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(key, false)
    }
    this.applySheetOrigin(sheetKey)
    this.applyFootprint(sheetKey)
    this._syncItemInHandSprite()
    return pending
  }

  /**
   * Releases or cancels the vial wind-up, then ends the body clip when it finishes.
   *
   * @param {number} time
   */
  _tickVialThrow(time) {
    const pending = this._vialThrow
    if (!pending || pending.cancelled) return

    if (!pending.released) {
      const interrupted = this.classId !== 'thief'
        || this.is(ACTOR_STATES.HURT)
        || this.is(ACTOR_STATES.DODGE)
        || this.is(ACTOR_STATES.DEAD)
      if (interrupted) {
        cancelPoisonVialThrow(this)
        this._syncItemInHandSprite()
        return
      }
      tickPoisonVialThrow(this, time)
    }

    const active = this._vialThrow
    if (active?.released && this.itemUseState?.clip === 'use_throw') {
      const durationMs = active.durationMs ?? getVialThrowTiming(this.facing).durationMs
      if (time - active.startedAt >= durationMs) {
        this.itemUseState = { active: false, itemId: null, startTime: 0, clip: null }
        this._refreshCurrentAnim()
        this._syncItemInHandSprite()
      }
    }
  }

  /**
   * Starts consuming an item, playing the one-shot use clip from frame 0.
   *
   * @param {string} itemId
   * @param {number} [now=Date.now()]
   * @returns {Player}
   */
  beginItemUse(itemId, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    const clip = useClipFor(itemId) || 'use_drink'
    this.itemUseState = { active: true, itemId, startTime: now, clip }
    const key = `${this.classId}_${clip}_${this.facing}`
    const sheetKey = `${this.classId}_${clip}`

    if (this.scene?.anims && typeof this.scene.anims.exists === 'function' && !this.scene.anims.exists(key)) {
      console.warn(`[Player] Animation key "${key}" not found in scene anims.`)
    }

    this.applySheetOrigin(sheetKey)
    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(key, false)
    }
    this.applySheetOrigin(sheetKey)
    this.applyFootprint(sheetKey)
    this._syncItemInHandSprite()
    return this
  }

  /**
   * Cancels or completes an active item use.
   *
   * @returns {Player}
   */
  endItemUse() {
    if (!this.itemUseState?.active) return this
    this.itemUseState = { active: false, itemId: null, startTime: 0, clip: null }
    this._refreshCurrentAnim()
    this._syncItemInHandSprite()
    return this
  }

  /**
   * Starts a tool clip (lockpick or pickaxe) on the same item-use path as a consumable.
   * The scene decides when the effect lands; this only plays and tracks the clip.
   *
   * @param {{ id?: string, classId?: string, itemId?: string, clip?: string, sheetKey?: string }} spec
   * @param {number} [now]
   * @returns {Player|null}
   */
  beginToolUse(spec, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (!spec?.itemId || !spec?.clip) return null
    if (spec.classId && spec.classId !== this.classId) return null
    if (
      this.is(ACTOR_STATES.DEAD) ||
      this.is(ACTOR_STATES.HURT) ||
      this.is(ACTOR_STATES.DODGE) ||
      this.is(ACTOR_STATES.ATTACK) ||
      this.is(ACTOR_STATES.BLOCK)
    ) {
      return null
    }
    if (this.itemUseState?.active) return null

    this.itemUseState = {
      active: true,
      itemId: spec.itemId,
      startTime: now,
      clip: spec.clip,
      tool: spec.id || true,
    }
    const key = `${this.classId}_${spec.clip}_${this.facing}`
    const sheetKey = spec.sheetKey || `${this.classId}_${spec.clip}`

    if (this.scene?.anims && typeof this.scene.anims.exists === 'function' && !this.scene.anims.exists(key)) {
      console.warn(`[Player] Animation key "${key}" not found in scene anims.`)
    }

    this.applySheetOrigin(sheetKey)
    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(key, false)
    }
    this.applySheetOrigin(sheetKey)
    this.applyFootprint(sheetKey)
    this._syncItemInHandSprite()
    return this
  }

  /**
   * Stops a tool clip before its effect. Leaves a non-tool item use alone.
   *
   * @returns {Player}
   */
  cancelToolUse() {
    if (!this.itemUseState?.active || !this.itemUseState.tool) return this
    return this.endItemUse()
  }

  /**
   * Ends a tool clip after its effect has been applied.
   *
   * @returns {Player}
   */
  completeToolUse() {
    if (!this.itemUseState?.active || !this.itemUseState.tool) return this
    return this.endItemUse()
  }

  /**
   * Destroys this actor and its associated item sprite.
   *
   * @param {boolean} [fromScene]
   */
  destroy(fromScene) {
    if (this.itemSprite) {
      if (typeof this.itemSprite.destroy === 'function') {
        this.itemSprite.destroy()
      }
      this.itemSprite = null
    }
    if (typeof super.destroy === 'function') {
      super.destroy(fromScene)
    }
  }

  /**
   * Lazily creates or returns the in-hand item sprite.
   *
   * @returns {Phaser.GameObjects.Image|object|null}
   */
  _getItemSprite() {
    if (!this.itemSprite && this.scene) {
      const activeItemId = this.itemUseState?.active ? this.itemUseState.itemId : getHeldItemId(session)
      const frameName = activeItemId ? `${activeItemId}_${this.facing}` : 'healing_potion_down'
      const atlasKey = inhandAtlasKey(activeItemId)
      if (this.scene.add && typeof this.scene.add.image === 'function') {
        this.itemSprite = this.scene.add.image(this.x, this.y, atlasKey, frameName)
      } else {
        this.itemSprite = {
          x: this.x,
          y: this.y,
          visible: false,
          rotation: 0,
          depth: 0,
          originX: 0.5,
          originY: 0.5,
          texture: { key: atlasKey },
          frame: { name: frameName },
          setOrigin(ox, oy) { this.originX = ox; this.originY = oy; return this; },
          setTexture(key, fn) { this.texture = { key }; this.frame = { name: fn }; return this; },
          setFrame(fn) { this.frame = { name: fn }; return this; },
          setRotation(rad) { this.rotation = rad; return this; },
          setAngle(deg) { this.rotation = deg * (Math.PI / 180); return this; },
          setDepth(d) { this.depth = d; return this; },
          setPosition(px, py) { this.x = px; this.y = py; return this; },
          setVisible(v) { this.visible = v; return this; },
          destroy() { this.visible = false; },
        }
      }
    }
    return this.itemSprite
  }

  /**
   * Synchronizes the in-hand item sprite's frame, position, rotation, and depth.
   */
  _syncItemInHandSprite() {
    const isBusy = (
      this.is(ACTOR_STATES.ATTACK) ||
      this.is(ACTOR_STATES.DODGE) ||
      this.is(ACTOR_STATES.BLOCK) ||
      this.is(ACTOR_STATES.HURT) ||
      this.is(ACTOR_STATES.DEAD) ||
      Boolean(this.vanishState?.invisible)
    )
    const isUsing = Boolean(this.itemUseState?.active)
    const activeItemId = isUsing ? this.itemUseState.itemId : getHeldItemId(session)

    if (!activeItemId || (isBusy && !isUsing)) {
      if (this.itemSprite) {
        if (typeof this.itemSprite.setVisible === 'function') {
          this.itemSprite.setVisible(false)
        } else {
          this.itemSprite.visible = false
        }
      }
      return
    }

    const sprite = this._getItemSprite()
    if (!sprite) return

    const itemFrameName = `${activeItemId}_${this.facing}`
    const atlasKey = inhandAtlasKey(activeItemId)
    if (sprite.texture?.key !== atlasKey && typeof sprite.setTexture === 'function') {
      sprite.setTexture(atlasKey, itemFrameName)
    } else if (typeof sprite.setFrame === 'function') {
      sprite.setFrame(itemFrameName)
    } else if (typeof sprite.setTexture === 'function') {
      sprite.setTexture(atlasKey, itemFrameName)
    }

    let clip = 'hold_idle'
    if (isUsing) {
      clip = this.itemUseState.clip || 'use_drink'
    } else {
      const isMoving = this.is(ACTOR_STATES.WALK) || this.isAtRunSpeed() || this.isRunning
      clip = holdClipFor(isMoving)
    }

    let playerFrameName = this.anims?.currentFrame?.frame?.name
    if (!playerFrameName) {
      playerFrameName = this.frame?.name
    }
    if (!playerFrameName || !playerFrameName.startsWith(`${this.classId}_${clip}`)) {
      playerFrameName = `${this.classId}_${clip}_${this.facing}_0`
    }

    const anchor = getItemAnchor(this.classId, clip, playerFrameName) || {
      x: 0,
      y: 0,
      rotation: 0,
      layer: this.facing === 'up' ? 'front' : 'front'
    }
    this._lastAnchor = anchor

    if (anchor.layer === 'none') {
      if (typeof sprite.setVisible === 'function') {
        sprite.setVisible(false)
      } else {
        sprite.visible = false
      }
      return
    }

    const ox = 12.0 / 24
    const oy = 15.61 / 24
    if (typeof sprite.setOrigin === 'function') {
      sprite.setOrigin(ox, oy)
    } else {
      sprite.originX = ox
      sprite.originY = oy
    }

    const scale = this.scaleX !== undefined ? this.scaleX : (this.scale !== undefined ? this.scale : 1)
    const posX = this.x + anchor.x * scale
    const posY = this.y + anchor.y * scale

    if (typeof sprite.setPosition === 'function') {
      sprite.setPosition(posX, posY)
    } else {
      sprite.x = posX
      sprite.y = posY
    }

    if (typeof sprite.setAngle === 'function') {
      sprite.setAngle(anchor.rotation)
    } else if (typeof sprite.setRotation === 'function') {
      sprite.setRotation(anchor.rotation * (Math.PI / 180))
    } else {
      sprite.rotation = anchor.rotation * (Math.PI / 180)
    }

    const layer = (this.facing === 'up' || anchor.layer === 'front') ? 'front' : 'behind'
    const depthBias = layer === 'front' ? 1 : -1
    const targetDepth = (this.depth ?? 0) + depthBias
    if (typeof sprite.setDepth === 'function') {
      sprite.setDepth(targetDepth)
    } else {
      sprite.depth = targetDepth
    }

    if (typeof sprite.setVisible === 'function') {
      sprite.setVisible(true)
    } else {
      sprite.visible = true
    }
  }

  /**
   * Sets whether the player is running.
   *
   * @param {boolean} running
   */
  setRunning(running = true) {
    this.isRunning = Boolean(running)
    if (this.is(ACTOR_STATES.WALK)) {
      this.playAnim(this.isRunning ? 'run' : 'walk', true)
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
      const isAttack2 = this.currentAttackType === 'attack_2' || this.anims?.currentAnim?.key?.includes('attack_2')
      const isCharged = this.currentAttackType === 'charged_release' || this.anims?.currentAnim?.key?.includes('charged_release')

      let animMetaKey = 'attack'
      if (isCharged) {
        animMetaKey = 'charged_release'
      } else if (isAttack2 || this.classId === 'mage') {
        animMetaKey = 'attack_2'
      }

      const sheetKey = this.getSheetForAnim(isCharged ? 'charged_release' : (isAttack2 ? 'attack_2' : 'attack'))
      const hitFrames = getHitFrames(this.scene, sheetKey, animMetaKey)
      if (hitFrames.includes(frameIndex)) {
        this._hitFramesProcessed.add(frameIndex)
        if (isAttack2) {
          console.log(`[Hit] attack_2 frame ${frameIndex}`)
        } else if (isCharged) {
          console.log(`[Hit] charged_release frame ${frameIndex}`)
        }
        executePlayerMeleeHit(this, frameIndex, time, animMetaKey)
      }
    }
  }

  /**
   * Updates dodge travel displacement along facing direction.
   */
  _updateDodgeMotion() {
    if (!this.is(ACTOR_STATES.DODGE) || !this.dodgeState?.active) return

    const currentFrame = this.anims?.currentFrame
    const frameIndex = getAnimationFrameIndex(currentFrame)
    if (frameIndex >= 0 && frameIndex !== this._lastDodgeFrame) {
      const meta = this.dodgeState.meta
      if (Array.isArray(meta?.travelPerFrame)) {
        const prevTravel = this._lastDodgeFrame >= 0 ? (meta.travelPerFrame[this._lastDodgeFrame] || 0) : 0
        const curTravel = meta.travelPerFrame[frameIndex] || 0
        const stepPx = Math.max(0, curTravel - prevTravel)
        if (stepPx > 0) {
          const { dx, dy } = getFacingDisplacement(this.facing, stepPx)
          this.x += dx
          this.y += dy
          if (this.body) {
            this.body.x += dx
            this.body.y += dy
          }
        }
      }
      this._lastDodgeFrame = frameIndex
    }
  }

  /**
   * Plays the facing's v2 body clip. Does not use the generic mage_cast key and does not flipX.
   */
  _playV2CastBody() {
    const pending = this._v2Cast
    if (!pending?.animKey) return
    if (this.anims?.currentAnim?.key === pending.animKey) {
      this._syncV2CastPivot()
      return
    }

    const clip = typeof this.scene?.anims?.get === 'function' ? this.scene.anims.get(pending.animKey) : null
    if (!clip?.frames?.length) {
      this.playAnim('cast', false)
      return
    }

    ensureMageSpellsGroup(this.scene)
    const layout = getV2CastBodyLayout()
    const frameName = `${pending.animKey}_0`
    if (typeof this.setTexture === 'function') {
      this.setTexture(layout.sheet, frameName)
    }
    const pivot = getV2CastFramePivot(frameName)
    if (pivot && typeof this.setOrigin === 'function') {
      this.setOrigin(pivot.x, pivot.y)
    }
    if (typeof this.setFlipX === 'function') this.setFlipX(false)
    this.flipX = false
    if (layout.hurtbox) this.hurtbox = { ...layout.hurtbox }
    if (layout.footprint) this.applyFootprint(layout.sheet, layout.footprint)
    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(pending.animKey, false)
    }
  }

  /**
   * Keeps the sprite origin on the current cast frame's pivot.
   */
  _syncV2CastPivot() {
    const pending = this._v2Cast
    if (!pending?.animKey) return
    const frameName = this.anims?.currentFrame?.frame?.name
      || this.anims?.currentFrame?.textureFrame
      || this.frame?.name
    if (!frameName || !String(frameName).startsWith(`${pending.animKey}_`)) return
    const pivot = getV2CastFramePivot(frameName)
    if (!pivot || typeof this.setOrigin !== 'function') return
    if (this.originX !== pivot.x || this.originY !== pivot.y) {
      this.setOrigin(pivot.x, pivot.y)
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
    this._syncItemInHandSprite()
    this._tickVialThrow(time)

    const v2Casting = typeof this.currentAttackType === 'string' && this.currentAttackType.startsWith('cast_')
    if (this._v2Cast && !this._v2Cast.released && !this.is(ACTOR_STATES.ATTACK)) {
      this._v2Cast = null
      if (v2Casting) this.currentAttackType = null
    }

    // Check hitFrames during active attack. v2 casts release a projectile instead of melee.
    if (this.is(ACTOR_STATES.ATTACK)) {
      if (v2Casting) {
        this._syncV2CastPivot()
        if (this._v2Cast && !this._v2Cast.released) {
          tickMageV2Cast(this, time)
        }
      } else {
        this._checkAttackHitFrames(time)

        // Combo queue check: if combo queued, trigger when frame >= 3 reached
        if (this.comboQueued && (!this.currentAttackType || this.currentAttackType === 'attack')) {
          const frameIndex = getAnimationFrameIndex(this.anims?.currentFrame)
          if (frameIndex >= 3) {
            this.comboQueued = false
            this.currentAttackType = 'attack_2'
            this.currentSwingId = (this.currentSwingId || 0) + 1
            this._hitFramesProcessed = new Set()
            this.playAnim('attack_2', false)
            try {
              onMeleeSwing()
            } catch (_e) {}
          }
        }

        // Charge hold check: mark charged after 600 ms hold
        if (this.chargeState?.active) {
          if (time - this.chargeState.startTime >= 600) {
            this.chargeState.charged = true
          }
          if (this.body && typeof this.body.setVelocity === 'function') {
            this.body.setVelocity(0, 0)
          }
        }
      }
    }

    // Process dodge travel displacement
    if (this.is(ACTOR_STATES.DODGE)) {
      this._updateDodgeMotion()
      return
    }

    if (this.is(ACTOR_STATES.BLOCK) || this.is(ACTOR_STATES.DEAD)) {
      return
    }

    const vx = this.body?.velocity?.x || 0
    const vy = this.body?.velocity?.y || 0
    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1

    if (isMoving) {
      if (!this.is(ACTOR_STATES.HURT) && !this.is(ACTOR_STATES.DEAD) && !this.is(ACTOR_STATES.ATTACK)) {
        if (!this.is(ACTOR_STATES.WALK)) {
          this.transition(ACTOR_STATES.WALK)
        } else {
          // Dynamic run vs walk animation transition based on run speed
          const shouldRun = this.isAtRunSpeed()
          const currentAnim = this.anims?.currentAnim?.key || ''
          if (shouldRun && !currentAnim.includes('run')) {
            this.playAnim('run', true)
          } else if (!shouldRun && currentAnim.includes('run')) {
            this.playAnim('walk', true)
          }
        }
      }
    } else {
      if (this.is(ACTOR_STATES.WALK)) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    }

    // Refresh animation if facing changed during update (except during attack/dodge)
    if (this.facing !== this._lastFacing) {
      this._lastFacing = this.facing
      if (!this.is(ACTOR_STATES.ATTACK) && !this.is(ACTOR_STATES.DODGE) && !this.is(ACTOR_STATES.DEAD)) {
        this._refreshCurrentAnim()
      }
    }

    this._syncItemInHandSprite()
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
