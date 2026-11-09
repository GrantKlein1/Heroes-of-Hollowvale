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
import { session } from '../session.js'
import {
  castFireball,
  castLightning,
  castLeech,
  castShield,
  castBlink,
  throwPoisonVial,
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

export const CLASS_SHEETS = Object.freeze({
  knight: {
    defaultSheet: 'knight',
    walkSheet: 'knight',
    hurtSheet: 'knight',
    attackSheet: 'knight_attack',
    dodgeSheet: 'knight_dodge',
    blockSheet: 'knight_block',
    deathSheet: 'knight_death',
    initialFrame: 'knight_idle_down',
  },
  thief: {
    defaultSheet: 'thief',
    walkSheet: 'thief',
    hurtSheet: 'thief',
    attackSheet: 'thief_attack',
    dodgeSheet: 'thief_dodge',
    deathSheet: 'thief_death',
    stealthSheet: 'thief_stealth',
    initialFrame: 'thief_idle_down',
  },
  dwarf: {
    defaultSheet: 'dwarf',
    walkSheet: 'dwarf',
    hurtSheet: 'dwarf',
    attackSheet: 'dwarf_attack',
    dodgeSheet: 'dwarf_dodge',
    deathSheet: 'dwarf_death',
    initialFrame: 'dwarf_idle_down',
  },
  mage: {
    defaultSheet: 'mage_walk',
    walkSheet: 'mage_walk',
    hurtSheet: 'mage_hurt',
    attackSheet: 'mage_attack2',
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

    // Listen for animation completion to transition out of non-looping states
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
          const cls = session.classId
          const item = session.equippedId
          if (cls === 'thief' && item === 'poison_vial') {
            scene._attacking = true
            return throwPoisonVial(scene, this, now)
          }
          if (cls === 'mage' && item === 'spellbook') {
            scene._attacking = true
            return this.cast(session.spellId || 'lightning', now)
          }
          scene._attacking = true
          return this.attack(now)
        }
        return origTryAttack(now)
      }

      const origHurtPlayer = scene._hurtPlayer ? scene._hurtPlayer.bind(scene) : null
      if (origHurtPlayer) {
        scene._hurtPlayer = (amount = 10, opts = {}) => {
          if (isBlendRenderer() && scene.player instanceof Player) {
            const tookDamage = this.takeDamage(
              amount,
              typeof performance !== 'undefined' ? performance.now() : Date.now(),
              opts
            )
            if (!tookDamage) return false
            const actualDamage = typeof this.lastDamageTaken === 'number' ? this.lastDamageTaken : amount
            return origHurtPlayer(actualDamage, opts)
          }
          return origHurtPlayer(amount, opts)
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
   * Resolves sheet key for a given animation action type based on active class.
   *
   * @param {string} animType - 'idle' | 'walk' | 'hurt' | 'attack' | 'cast' | 'dodge' | 'block' | 'death' | 'vanish'
   * @returns {string}
   */
  getSheetForAnim(animType) {
    const classDef = CLASS_SHEETS[this.classId] || CLASS_SHEETS.knight
    switch (animType) {
      case 'walk':
        return classDef.walkSheet
      case 'hurt':
        return classDef.hurtSheet
      case 'attack':
        return classDef.attackSheet
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
   * Special case: Mage melee staff bonk is named 'attack_2' in mage_attack2.json.
   * Special case: Mage spell casting is named 'cast' in mage_cast.json.
   *
   * @param {string} anim
   * @param {string} [dir=this.facing]
   * @returns {string}
   */
  getAnimKey(anim, dir = this.facing) {
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
    const targetSheet = this.getSheetForAnim(animName)
    if (targetSheet && targetSheet !== this.texture?.key) {
      this.applySheetOrigin(targetSheet)
    }

    const key = this.getAnimKey(animName)

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
    }

    if (targetSheet) {
      this.applySheetOrigin(targetSheet)
      this.applyFootprint(targetSheet)
    }

    return this
  }

  /**
   * Triggers an attack swing if the state machine permits.
   *
   * @param {number} [now=performance.now()]
   * @returns {boolean}
   */
  attack(now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (this.is(ACTOR_STATES.DEAD)) return false

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
          applyKnockback(this, attackerPos.x, attackerPos.y, 40, 100)
        }
        return true
      }
    }

    // 4. Full Hit
    this.lastDamageTaken = amount
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
    if (key.includes('hurt') && this.is(ACTOR_STATES.HURT)) {
      const consumed = this.consumeBuffer(Date.now())
      if (!consumed) {
        this.transition(ACTOR_STATES.IDLE, { force: true })
      }
    } else if ((key.includes('attack') || key.includes('cast')) && this.is(ACTOR_STATES.ATTACK)) {
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
    if (this.is(ACTOR_STATES.WALK)) {
      this.playAnim('walk', false)
    } else if (this.is(ACTOR_STATES.HURT)) {
      this.playAnim('hurt', false)
    } else if (this.is(ACTOR_STATES.ATTACK)) {
      this.playAnim(this.anims?.currentAnim?.key?.includes('cast') ? 'cast' : 'attack', false)
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
   * Checks for hitFrame triggers during active attack animation.
   *
   * @param {number} time
   */
  _checkAttackHitFrames(time) {
    const currentFrame = this.anims?.currentFrame
    const frameIndex = getAnimationFrameIndex(currentFrame)
    if (frameIndex >= 0 && !this._hitFramesProcessed.has(frameIndex)) {
      const sheetKey = this.getSheetForAnim('attack')
      const animMetaKey = this.classId === 'mage' ? 'attack_2' : 'attack'
      const hitFrames = getHitFrames(this.scene, sheetKey, animMetaKey)
      if (hitFrames.includes(frameIndex)) {
        this._hitFramesProcessed.add(frameIndex)
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
