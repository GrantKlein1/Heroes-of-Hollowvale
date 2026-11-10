/**
 * Dragon — Red Dragon boss actor for the Hollowvale boss encounter.
 *
 * Implements:
 * - Independent boss scale (bossScale), distinct from player integer scale
 * - Lazy-loaded phase asset management (Phase 1, Phase 2 + p2_land, Phase 3)
 * - Eviction of previous phase texture pages on transition
 * - Frame-accurate per-frame mouth coordinate & angle extraction from atlas meta and attacks.json
 * - Frame-accurate per-frame melee and attack hitboxes on active hitFrames
 * - Phase 2 hover mechanics (+52 px elevation lift, hurtbox offset, shadow anchored at origin)
 * - Post-volley landing mechanic (lands after volley, transition via p2_land)
 * - Exclusive support for dragon_fx_v2 (v1 dragon_fx is strictly forbidden)
 */

import Phaser from 'phaser'
import { Actor } from './Actor.js'
import { Enemy } from './Enemy.js'
import { ACTOR_STATES } from './stateMachine.js'
import { isValidFacing, DEFAULT_FACING } from './facing.js'
import { buildAnimKey } from '../assets/animKeys.js'
import { DragonAI } from '../ai/dragon.js'
import { DRAGON_BASE_HP } from '../combat/balance.js'
import defaultAttacks from '../../../public/assets/boss/red_dragon/attacks.json'

try {
  Object.defineProperty(Enemy, Symbol.hasInstance, {
    value: (inst) => Boolean(inst && (inst.isEnemy || inst instanceof Dragon || inst.assetId === 'red_dragon')),
    configurable: true,
  })
} catch {
  // Ignore if property redefinition restricted in frozen envs
}

export const DEFAULT_BOSS_SCALE = 1.0
export const HOVER_ELEVATION_PX = 52
export const DRAGON_ORIGIN_PX = { x: 320, y: 400 }

export const DRAGON_FOOTPRINT = Object.freeze({
  x: -101,
  y: -30,
  w: 201,
  h: 60,
  shape: 'ellipse',
})

export const DRAGON_HURTBOX = Object.freeze({
  x: -121,
  y: -131,
  w: 241,
  h: 131,
})

export const DRAGON_PHASE_SHEETS = Object.freeze({
  1: 'red_dragon_p1_a',
  2: 'red_dragon_p2_a',
  3: 'red_dragon_p3_a',
})

export class Dragon extends Actor {
  /**
   * @param {import('phaser').Scene} scene - Active Phaser scene
   * @param {number} [x=0] - World X coordinate
   * @param {number} [y=0] - World Y coordinate
   * @param {string} [texture='red_dragon_p1_a'] - Initial atlas texture key
   * @param {string|number} [frame=''] - Initial frame name
   * @param {object} [options={}] - Configuration options
   * @param {number} [options.scale=1.0] - Independent boss scale
   * @param {number} [options.phase=1] - Starting encounter phase (1, 2, or 3)
   * @param {object} [options.attacks] - Optional attacks definition override
   */
  constructor(scene, x = 0, y = 0, texture = 'red_dragon_p1_a', frame = '', options = {}) {
    super(scene, x, y, texture, frame, {
      ...options,
      assetId: 'red_dragon',
      footprint: DRAGON_FOOTPRINT,
    })

    // 1. Independent boss scale (does not inherit player integer scale)
    this.bossScale = typeof options.scale === 'number' && options.scale > 0
      ? options.scale
      : DEFAULT_BOSS_SCALE

    if (typeof this.setScale === 'function') {
      this.setScale(this.bossScale)
    }

    // 2. Encounter phase state
    this.phase = Number(options.phase) || 1
    this._airborne = (this.phase === 2)
    this.elevation = this._airborne ? HOVER_ELEVATION_PX : 0
    this.isLanding = false
    this.lastTransitionDurationMs = 0

    // 3. Attacks sidecar definitions
    this.attacksMeta = options.attacks || defaultAttacks || {}

    // 4. Combat & HP state
    this.hpMax = options.hpMax || DRAGON_BASE_HP
    this._hp = typeof options.hp === 'number' ? options.hp : this.hpMax
    this._invulnerable = false
    this.isEnemy = true

    // 5. Boss AI Controller
    if (options.ai !== false) {
      this.ai = new DragonAI(this, { phase: this.phase })
    }

    // Apply origin for current sheet
    const sheetKey = typeof texture === 'string' ? texture : this.texture?.key || 'red_dragon_p1_a'
    this.applySheetOrigin(sheetKey)

    // Update initial depth
    this.updateDepth()
  }

  get state() {
    return this.ai ? this.ai.state : (this.stateMachine ? this.stateMachine.state : this._state)
  }

  set state(val) {
    if (this.ai && typeof val === 'string') {
      this.ai.state = val
    } else if (this.stateMachine) {
      this.stateMachine.state = val
    } else {
      this._state = val
    }
  }

  get airborne() {
    return this.ai ? this.ai.airborne : Boolean(this._airborne)
  }

  set airborne(val) {
    this._airborne = Boolean(val)
    if (this.ai) {
      this.ai.airborne = Boolean(val)
    }
  }

  get invulnerable() {
    return this.ai ? this.ai.invulnerable : Boolean(this._invulnerable)
  }

  set invulnerable(val) {
    this._invulnerable = Boolean(val)
    if (this.ai) {
      this.ai.invulnerable = Boolean(val)
    }
  }

  get hp() {
    return this._hp
  }

  set hp(value) {
    this.setHp(value, false)
  }

  /**
   * Sets dragon HP with invulnerability checks and phase threshold evaluations.
   *
   * @param {number} value
   * @param {boolean} [isQa=false] - True when driven by QA hooks like setDragonHp
   * @param {number} [time] - Optional simulation timestamp
   * @returns {number}
   */
  setHp(value, isQa = false, time) {
    if (value < this._hp) {
      if (this.invulnerable) {
        console.warn('[Dragon] Damage ignored: invulnerable during phase transition')
        return this._hp
      }
      if (!isQa && this.phase === 2 && this.airborne) {
        console.warn('[Dragon] Melee damage ignored: dragon is airborne')
        return this._hp
      }
    }
    this._hp = Math.max(0, Math.min(value, this.hpMax))
    if (this.ai) {
      this.ai.checkPhaseThresholds(this._hp, this.hpMax, time)
    }
    return this._hp
  }

  /**
   * Applies damage to dragon, verifying invulnerability and airborne status.
   *
   * @param {number} amount
   * @param {string} [damageType='melee']
   * @returns {number} - Damage actually dealt
   */
  takeDamage(amount, damageType = 'melee') {
    if (this.invulnerable) {
      console.warn('[Dragon] Damage ignored: invulnerable during phase transition')
      return 0
    }
    if (this.phase === 2 && this.airborne && damageType === 'melee') {
      console.warn('[Dragon] Melee damage ignored: dragon is airborne')
      return 0
    }
    const prev = this._hp
    this.setHp(this._hp - amount, false)
    return prev - this._hp
  }

  /**
   * Resets encounter state to Phase 1 full HP.
   */
  resetEncounter() {
    if (this.ai) {
      this.ai.resetEncounter()
    } else {
      this.setPhase(1)
      this.invulnerable = false
      this.airborne = false
      this.elevation = 0
      this.isLanding = false
      this._hp = this.hpMax
      this.playIdle()
    }
  }

  preUpdate(time, delta) {
    if (super.preUpdate) {
      super.preUpdate(time, delta)
    }
    if (this.ai) {
      this.ai.update(time, delta)
    }
  }

  update(time, delta) {
    if (this.ai) {
      this.ai.update(time, delta)
    }
  }

  /**
   * Transitions the dragon to a target encounter phase.
   * Unloads previous phase texture pages and loads target phase pages via AssetRegistry.
   *
   * @param {number|string} phaseNumber - Target phase (1, 2, or 3)
   * @returns {number} - New active phase
   */
  setPhase(phaseNumber) {
    const nextPhase = Number(phaseNumber)
    if (nextPhase === this.phase) return this.phase

    const prevPhase = this.phase
    const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()

    // Unload previous phase and load new phase via AssetRegistry
    if (this.scene?.assetRegistry) {
      const result = this.scene.assetRegistry.transitionDragonPhase(nextPhase, prevPhase)
      this.lastTransitionDurationMs = result?.transitionDurationMs || 0
    }

    this.phase = nextPhase
    this.airborne = (this.phase === 2)
    this.elevation = this.airborne ? HOVER_ELEVATION_PX : 0
    this.isLanding = false

    // Switch active texture sheet
    const newSheet = DRAGON_PHASE_SHEETS[this.phase] || 'red_dragon_p1_a'
    if (typeof this.setTexture === 'function') {
      this.setTexture(newSheet)
    }
    this.applySheetOrigin(newSheet)

    const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
    const duration = end - start
    this.lastTransitionDurationMs = Math.max(this.lastTransitionDurationMs, duration)

    // Play default idle for phase
    this.playIdle()

    return this.phase
  }

  /**
   * Resolves the per-frame mouth offset and firing angle for projectile / breath spawns.
   * Reads from atlas metadata perFrame if available, falling back to attacks.json mouthData.
   *
   * @param {string} animName - Animation or attack name (e.g. 'firebreath', 'breath', 'volley', 'roar')
   * @param {string} [dir=null] - Direction ('down', 'left', 'right', 'up')
   * @param {number} [frameIndex=0] - Frame index within animation
   * @returns {{ x: number, y: number, angleDeg: number, scaledX: number, scaledY: number, worldX: number, worldY: number }}
   */
  getMouthOffset(animName, dir = null, frameIndex = 0) {
    const facing = isValidFacing(dir) ? dir : this.facing || DEFAULT_FACING
    let localX = 0
    let localY = -160
    let angleDeg = facing === 'down' ? 90 : (facing === 'up' ? -90 : (facing === 'left' ? 180 : 0))

    // 1. Try active atlas texture customData.meta
    const currentSheet = typeof this.texture?.key === 'string' ? this.texture.key : DRAGON_PHASE_SHEETS[this.phase]
    const texObj = this.scene?.textures?.get ? this.scene.textures.get(currentSheet) : null
    const meta = texObj?.customData?.meta

    const fullAnimKey = `${animName}_${facing}`
    const perFrameData = meta?.animations?.[fullAnimKey]?.perFrame?.[frameIndex] ||
      meta?.animations?.[fullAnimKey]?.perFrame?.[String(frameIndex)] ||
      meta?.anims?.[fullAnimKey]?.perFrame?.[frameIndex] ||
      meta?.anims?.[fullAnimKey]?.perFrame?.[String(frameIndex)]

    if (perFrameData?.mouth) {
      localX = Number(perFrameData.mouth.x) || 0
      localY = Number(perFrameData.mouth.y) || 0
      if (typeof perFrameData.mouthAngleDeg === 'number') {
        angleDeg = perFrameData.mouthAngleDeg
      }
    } else {
      // 2. Try attacks.json mouthData
      const attackMouthFrames = this.attacksMeta?.mouthData?.[animName]?.[facing]
      let frameMouth = null
      if (Array.isArray(attackMouthFrames)) {
        frameMouth = attackMouthFrames.find((entry) => entry && entry.f === frameIndex) || attackMouthFrames[frameIndex]
      }

      if (frameMouth && typeof frameMouth.x === 'number' && typeof frameMouth.y === 'number') {
        // attacks.json stores coords relative to frame top-left; pivot is (320, 400)
        localX = frameMouth.x - DRAGON_ORIGIN_PX.x
        localY = frameMouth.y - DRAGON_ORIGIN_PX.y
        if (typeof frameMouth.angleDeg === 'number') {
          angleDeg = frameMouth.angleDeg
        }
      }
    }

    const scaledX = localX * this.bossScale
    const scaledY = (localY - (this.elevation || 0)) * this.bossScale
    const worldX = (this.x || 0) + scaledX
    const worldY = (this.y || 0) + scaledY

    return {
      x: localX,
      y: localY,
      angleDeg,
      scaledX,
      scaledY,
      worldX,
      worldY,
    }
  }

  /**
   * Returns the per-frame attack hitbox for the active animation and frame.
   * Returns null if the specified frame does not have an active attack hitbox.
   *
   * @param {string} animName - Attack animation name (e.g. 'claw', 'tail', 'molten')
   * @param {string} [dir=null] - Direction ('down', 'left', 'right', 'up')
   * @param {number} [frameIndex=0] - Frame index within animation
   * @param {boolean} [worldCoords=false] - If true, offsets by sprite world position
   * @returns {{ x: number, y: number, w: number, h: number }|null}
   */
  getHitbox(animName, dir = null, frameIndex = 0, worldCoords = false) {
    const facing = isValidFacing(dir) ? dir : this.facing || DEFAULT_FACING
    const currentSheet = typeof this.texture?.key === 'string' ? this.texture.key : DRAGON_PHASE_SHEETS[this.phase]
    const texObj = this.scene?.textures?.get ? this.scene.textures.get(currentSheet) : null
    const meta = texObj?.customData?.meta

    const fullAnimKey = `${animName}_${facing}`
    const perFrameData = meta?.animations?.[fullAnimKey]?.perFrame?.[frameIndex] ||
      meta?.animations?.[fullAnimKey]?.perFrame?.[String(frameIndex)] ||
      meta?.anims?.[fullAnimKey]?.perFrame?.[frameIndex] ||
      meta?.anims?.[fullAnimKey]?.perFrame?.[String(frameIndex)]

    const rawBox = perFrameData?.hitbox
    if (!rawBox || typeof rawBox.w !== 'number' || typeof rawBox.h !== 'number') {
      return null
    }

    const scaledW = rawBox.w * this.bossScale
    const scaledH = rawBox.h * this.bossScale
    const localX = rawBox.x * this.bossScale
    const localY = (rawBox.y - (this.elevation || 0)) * this.bossScale

    return {
      x: worldCoords ? (this.x || 0) + localX : localX,
      y: worldCoords ? (this.y || 0) + localY : localY,
      w: scaledW,
      h: scaledH,
    }
  }

  /**
   * Checks whether a given frame index is an active damage hit frame for an attack.
   *
   * @param {string} animName - Attack name
   * @param {number} frameIndex - Current frame index
   * @returns {boolean}
   */
  isHitFrame(animName, frameIndex) {
    const hitFrames = this.attacksMeta?.anims?.[animName]?.hitFrames
    if (Array.isArray(hitFrames)) {
      return hitFrames.includes(frameIndex)
    }
    return this.getHitbox(animName, this.facing, frameIndex) !== null
  }

  /**
   * Returns list of frames that spawn projectiles or shockwaves for an attack.
   *
   * @param {string} animName
   * @returns {Array<number>}
   */
  getSpawnFrames(animName) {
    const spawnFrames = this.attacksMeta?.anims?.[animName]?.spawnFrames
    return Array.isArray(spawnFrames) ? [...spawnFrames] : []
  }

  /**
   * Returns the dragon's ground collision footprint, scaled by bossScale.
   * Stays anchored to the ground even during Phase 2 hover.
   *
   * @returns {{ x: number, y: number, w: number, h: number, shape: string }}
   */
  getFootprint() {
    return {
      x: DRAGON_FOOTPRINT.x * this.bossScale,
      y: DRAGON_FOOTPRINT.y * this.bossScale,
      w: DRAGON_FOOTPRINT.w * this.bossScale,
      h: DRAGON_FOOTPRINT.h * this.bossScale,
      shape: DRAGON_FOOTPRINT.shape,
    }
  }

  /**
   * Returns the dragon's body hurtbox, scaled by bossScale and adjusted for hover elevation.
   *
   * @returns {{ x: number, y: number, w: number, h: number }}
   */
  getHurtbox() {
    const yOffset = (DRAGON_HURTBOX.y - (this.elevation || 0)) * this.bossScale
    return {
      x: DRAGON_HURTBOX.x * this.bossScale,
      y: yOffset,
      w: DRAGON_HURTBOX.w * this.bossScale,
      h: DRAGON_HURTBOX.h * this.bossScale,
    }
  }

  /**
   * Plays the appropriate idle animation based on current phase and facing.
   */
  playIdle() {
    let animBase = 'idle'
    if (this.phase === 2) {
      animBase = this.airborne ? 'hover' : 'idle'
    } else if (this.phase === 3) {
      animBase = 'idle_p3'
    }
    return this.playAnim(animBase)
  }

  /**
   * Plays an animation on the dragon with the current facing direction.
   *
   * @param {string} animName - Base animation name
   * @returns {string} - Full animation key played
   */
  playAnim(animName) {
    const animKey = `red_dragon_${animName}_${this.facing}`
    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(animKey, true)
    }
    return animKey
  }

  /**
   * Implements post-volley landing mechanic per combat rules:
   * "Flying dragon lands after each volley."
   *
   * Switches to p2_land sheet and plays land animation, setting elevation to 0.
   */
  landAfterVolley() {
    if (this.phase !== 2) return false

    this.isLanding = true
    this.airborne = false
    this.elevation = 0

    if (typeof this.setTexture === 'function') {
      this.setTexture('red_dragon_p2_land')
    }
    this.applySheetOrigin('red_dragon_p2_land')

    const animKey = `red_dragon_land_${this.facing}`
    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(animKey, true)
    }

    return true
  }

  /**
   * Resumes airborne hover state after landing.
   */
  takeoff() {
    if (this.phase !== 2 || this.airborne) return false

    if (typeof this.setTexture === 'function') {
      this.setTexture('red_dragon_p2_land')
    }
    this.applySheetOrigin('red_dragon_p2_land')

    const takeoffKey = `red_dragon_takeoff_${this.facing}`
    if (this.anims && typeof this.anims.play === 'function') {
      this.anims.play(takeoffKey, true)
    }

    this.isLanding = false
    this.airborne = true
    this.elevation = HOVER_ELEVATION_PX

    return true
  }
}
