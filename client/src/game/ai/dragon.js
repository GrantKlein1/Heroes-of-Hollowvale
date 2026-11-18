/**
 * Dragon AI Controller — Package 3b-2.
 *
 * Implements:
 * - Deterministic AI driven by seeded PRNG (client/src/game/rng.js)
 * - Phase 1 (ground): claw, tail sweep, firebreath
 * - Phase Transitions at 66% and 33% HP thresholds with invulnerability windows
 * - Phase 2 (air): hover elevation (+52 px), breath, volley, gust
 * - Post-volley landing mechanic: "flying dragon lands after each volley", vulnerable to melee while landed
 * - Phase 3 (enraged ground): dive shockwaves, meteors with 700 ms ground markers before impact, molten sweep, death clip
 * - resetEncounter(): restores full HP, phase 1, clears timers and markers, resets pages
 */

import { random } from '../rng.js'
import { buildAnimKey } from '../assets/animKeys.js'
import { LAYER_DEPTHS } from '../maps/depth.js'
import {
  DRAGON_BASE_HP,
  DRAGON_DAMAGE,
  DRAGON_PHASE_THRESHOLDS,
  DRAGON_LANDING_DURATION_MS,
  DRAGON_METEOR_MARKER_DELAY_MS,
  METEOR_MARKER_KEY,
} from '../combat/balance.js'
import { isDebug } from '../config/flags.js'

/**
 * Batch 7 warning marker (boss_fx_extra / dragon_fx_extra).
 * 7 frames @ 10 fps = 700 ms, matching DRAGON_METEOR_MARKER_DELAY_MS.
 * The packed ellipse is authored to a 32 px impact radius; display it at scale 1.
 * Clip name is balance.js METEOR_MARKER_KEY. Timing stays on DRAGON_METEOR_MARKER_DELAY_MS.
 */
export const DRAGON_METEOR_MARKER_ATLAS = 'dragon_fx_extra'
export const DRAGON_METEOR_MARKER_ANIM = METEOR_MARKER_KEY
export const DRAGON_METEOR_MARKER_FRAME = `${METEOR_MARKER_KEY}_0`
export const DRAGON_METEOR_HIT_RADIUS = 32

/** Above ground_detail, below walls, so the telegraph sits on the ground. */
const METEOR_GROUND_DEPTH = LAYER_DEPTHS.ground_detail + 1

export const HOVER_ELEVATION_PX = 52

export const DRAGON_AI_STATES = Object.freeze({
  IDLE: 'IDLE',
  ATTACK: 'ATTACK',
  TRANSITION: 'TRANSITION',
  LANDED: 'LANDED',
  TAKEOFF: 'TAKEOFF',
  DEAD: 'DEAD',
})

export const DRAGON_PHASE_ATTACKS = Object.freeze({
  1: Object.freeze(['claw', 'tail', 'firebreath']),
  2: Object.freeze(['breath', 'volley', 'gust']),
  3: Object.freeze(['dive', 'meteor', 'molten']),
})

export const TRANSITION_DURATION_MS = 1000
export const ATTACK_COOLDOWN_MS = 1200
export const TAKEOFF_DURATION_MS = 600

export class DragonAI {
  /**
   * @param {import('../actors/Dragon.js').Dragon} dragon - Host dragon actor
   * @param {object} [options={}]
   * @param {number} [options.phase=1] - Starting encounter phase
   */
  constructor(dragon, options = {}) {
    this.dragon = dragon
    this.phase = Number(options.phase) || (dragon?.phase ? Number(dragon.phase) : 1)
    this.state = DRAGON_AI_STATES.IDLE

    this.invulnerable = false
    this.airborne = (this.phase === 2)
    this.landed = !this.airborne

    this.activeAttack = null
    this.attackStartTime = 0
    this.attackUntil = 0
    this.attackCooldownUntil = 3000

    this.landingUntil = 0
    this.takeoffUntil = 0
    this.transitionUntil = 0
    this.pendingNextPhase = null

    this.activeMarkers = []
    this.history = []

    this.isAiMoving = false
    this.lastTime = 0
  }

  getCurrentTime(now) {
    if (typeof now === 'number') {
      this.lastTime = now
      return now
    }
    if (typeof this.lastTime === 'number' && this.lastTime > 0) {
      return this.lastTime
    }
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
  }

  /**
   * Checks current HP against phase transition and death thresholds.
   *
   * @param {number} currentHp
   * @param {number} maxHp
   * @param {number} [now]
   */
  checkPhaseThresholds(currentHp, maxHp, now) {
    const currentTime = this.getCurrentTime(now)
    if (this.state === DRAGON_AI_STATES.DEAD || this.state === DRAGON_AI_STATES.TRANSITION) {
      return
    }

    if (currentHp <= 0) {
      this.triggerDeath(currentTime)
      return
    }

    if (this.phase === 1 && currentHp <= maxHp * DRAGON_PHASE_THRESHOLDS.p1ToP2) {
      this.triggerTransition(2, currentTime)
      return
    }

    if (this.phase === 2 && currentHp <= maxHp * DRAGON_PHASE_THRESHOLDS.p2ToP3) {
      this.triggerTransition(3, currentTime)
      return
    }
  }

  /**
   * Triggers an encounter phase transition.
   * Dragon becomes invulnerable during the entire transition sequence.
   *
   * @param {number} nextPhase
   * @param {number} [now]
   */
  triggerTransition(nextPhase, now) {
    if (this.state === DRAGON_AI_STATES.TRANSITION) return

    const currentTime = this.getCurrentTime(now)
    this.state = DRAGON_AI_STATES.TRANSITION
    this.invulnerable = true
    if (this.dragon) {
      this.dragon.invulnerable = true
    }

    this.pendingNextPhase = nextPhase
    this.activeAttack = null

    // Clean up any pending markers or landings
    this.clearMarkers()

    const animKey = nextPhase === 2 ? 't12' : 't23'
    if (this.dragon && typeof this.dragon.playAnim === 'function') {
      this.dragon.playAnim(animKey)
    }

    const duration = TRANSITION_DURATION_MS
    this.transitionUntil = currentTime + duration

    this.history.push({
      action: 'transition_start',
      fromPhase: this.phase,
      toPhase: nextPhase,
      time: currentTime,
    })

    if (isDebug() && typeof console !== 'undefined' && console.log) {
      console.log(`[DragonAI] Transitioning P${this.phase} -> P${nextPhase} (invulnerable)`)
    }
  }

  /**
   * Completes the phase transition: swaps texture pages via setPhase and restores vulnerability.
   *
   * @param {number} [now]
   */
  completeTransition(now) {
    if (!this.pendingNextPhase) return

    const currentTime = this.getCurrentTime(now)
    const targetPhase = this.pendingNextPhase
    this.pendingNextPhase = null

    if (this.dragon && typeof this.dragon.setPhase === 'function') {
      this.dragon.setPhase(targetPhase)
    }

    this.phase = targetPhase
    this.invulnerable = false
    if (this.dragon) {
      this.dragon.invulnerable = false
    }

    if (targetPhase === 2) {
      this.airborne = true
      this.landed = false
      if (this.dragon) {
        this.dragon.airborne = true
        this.dragon.elevation = HOVER_ELEVATION_PX
        this.dragon.isLanding = false
      }
    } else {
      this.airborne = false
      this.landed = true
      if (this.dragon) {
        this.dragon.airborne = false
        this.dragon.elevation = 0
        this.dragon.isLanding = false
      }
    }

    this.state = DRAGON_AI_STATES.IDLE
    this.attackCooldownUntil = currentTime + 400

    if (this.dragon && typeof this.dragon.playIdle === 'function') {
      this.dragon.playIdle()
    }

    this.history.push({
      action: 'transition_complete',
      phase: this.phase,
      time: currentTime,
    })
  }

  /**
   * Selects and triggers an attack appropriate for the current phase.
   *
   * @param {string} [overrideAttack]
   * @param {number} [now]
   */
  triggerAttack(overrideAttack = null, now) {
    if (this.state !== DRAGON_AI_STATES.IDLE && !overrideAttack) return null

    const currentTime = this.getCurrentTime(now)
    let attack = overrideAttack
    if (!attack) {
      const candidates = DRAGON_PHASE_ATTACKS[this.phase] || DRAGON_PHASE_ATTACKS[1]
      const idx = Math.floor(random() * candidates.length)
      attack = candidates[idx] || candidates[0]
    }

    this.state = DRAGON_AI_STATES.ATTACK
    this.activeAttack = attack
    this.attackStartTime = currentTime

    // Determine attack duration based on animation metadata if available
    let duration = 900
    if (this.dragon?.attacksMeta?.anims?.[attack]) {
      const meta = this.dragon.attacksMeta.anims[attack]
      const fps = meta.frameRate || 10
      const frames = Array.isArray(meta.hitFrames) ? Math.max(...meta.hitFrames, 8) + 2 : 10
      duration = Math.round((frames / fps) * 1000)
    }
    this.attackUntil = currentTime + duration

    if (this.dragon && typeof this.dragon.playAnim === 'function') {
      this.dragon.playAnim(attack)
    }

    // Special Phase 3 Meteor marker handling
    if (attack === 'meteor') {
      this.spawnMeteorMarkers(currentTime)
    }

    this.history.push({
      action: 'attack_start',
      attack,
      phase: this.phase,
      time: currentTime,
    })

    return attack
  }

  /**
   * Makes sure the phase-3 extra atlas is queued and its clips exist.
   * AssetRegistry also pulls boss_fx_extra when boss_p3 loads.
   *
   * @param {object} scene
   */
  ensureMeteorMarkerAssets(scene) {
    const registry = scene?.assetRegistry
    if (!registry) return
    if (typeof registry.isGroupLoaded === 'function' && !registry.isGroupLoaded('boss_fx_extra')) {
      registry.loadGroup?.('boss_fx_extra')
    } else if (typeof registry.isGroupLoaded !== 'function') {
      registry.loadGroup?.('boss_fx_extra')
    }
    registry.createAnims?.('boss_fx_extra')
  }

  /**
   * Pivot and hit radius from dragon_fx_extra meta. Fallbacks match the atlas contract.
   *
   * @param {object} scene
   * @returns {{ origin: { x: number, y: number }, hitRadius: number }}
   */
  readMeteorMarkerMetrics(scene) {
    const meta = scene?.textures?.get?.(DRAGON_METEOR_MARKER_ATLAS)?.customData?.meta
    const animOrigin = meta?.anims?.[DRAGON_METEOR_MARKER_ANIM]?.origin
    const sheetOrigin = meta?.origin
    const anchor = scene?.assetRegistry?.getAnchor?.(DRAGON_METEOR_MARKER_ATLAS)
    let origin = { x: 0.5, y: 0.5 }
    if (typeof animOrigin?.x === 'number' && typeof animOrigin?.y === 'number') {
      origin = { x: animOrigin.x, y: animOrigin.y }
    } else if (typeof sheetOrigin?.x === 'number' && typeof sheetOrigin?.y === 'number') {
      origin = { x: sheetOrigin.x, y: sheetOrigin.y }
    } else if (typeof anchor?.x === 'number' && typeof anchor?.y === 'number') {
      origin = { x: anchor.x, y: anchor.y }
    }
    const fromMeta = meta?.effects?.meteor_marker?.hitRadius
    const hitRadius = typeof fromMeta === 'number' && fromMeta > 0 ? fromMeta : DRAGON_METEOR_HIT_RADIUS
    return { origin, hitRadius }
  }

  /**
   * Spawns ground markers for the meteor attack (700 ms before impact).
   * The marker loops dfx_meteor_marker for DRAGON_METEOR_MARKER_DELAY_MS.
   *
   * @param {number} now
   */
  spawnMeteorMarkers(now) {
    const scene = this.dragon?.scene
    const targetX = scene?.player?.x ?? (this.dragon?.x || 300)
    const targetY = scene?.player?.y ?? (this.dragon?.y || 250)

    this.ensureMeteorMarkerAssets(scene)
    const { origin, hitRadius } = this.readMeteorMarkerMetrics(scene)
    const animKey = buildAnimKey(DRAGON_METEOR_MARKER_ATLAS, DRAGON_METEOR_MARKER_ANIM)

    // Spawn 1 to 3 markers using seeded RNG offsets
    const count = 2
    for (let i = 0; i < count; i++) {
      const offsetX = (random() * 2 - 1) * 80
      const offsetY = (random() * 2 - 1) * 80
      const markerX = targetX + offsetX
      const markerY = targetY + offsetY

      let markerSprite = null
      if (scene?.add?.sprite) {
        markerSprite = scene.add.sprite(markerX, markerY, DRAGON_METEOR_MARKER_ATLAS, DRAGON_METEOR_MARKER_FRAME)
        if (typeof markerSprite.setOrigin === 'function') markerSprite.setOrigin(origin.x, origin.y)
        if (typeof markerSprite.setScale === 'function') markerSprite.setScale(1)
        if (typeof markerSprite.setDepth === 'function') markerSprite.setDepth(METEOR_GROUND_DEPTH)
        if (typeof markerSprite.setRotation === 'function') markerSprite.setRotation(0)
        const canPlay = typeof markerSprite.anims?.play === 'function'
          && (typeof scene?.anims?.exists !== 'function' || scene.anims.exists(animKey))
        if (canPlay) markerSprite.anims.play(animKey, true)
      }

      this.activeMarkers.push({
        x: markerX,
        y: markerY,
        spawnTime: now,
        impactTime: now + DRAGON_METEOR_MARKER_DELAY_MS,
        hitRadius,
        atlas: DRAGON_METEOR_MARKER_ATLAS,
        anim: animKey,
        sprite: markerSprite,
      })
    }
  }

  /**
   * Updates and resolves active meteor markers.
   *
   * @param {number} now
   */
  updateMeteorMarkers(now) {
    for (let i = this.activeMarkers.length - 1; i >= 0; i--) {
      const marker = this.activeMarkers[i]
      if (now >= marker.impactTime) {
        // Destroy ground marker sprite
        if (marker.sprite && typeof marker.sprite.destroy === 'function') {
          marker.sprite.destroy()
        }

        // Spawn impact FX if scene available
        const scene = this.dragon?.scene
        if (scene?.add?.sprite) {
          const impact = scene.add.sprite(marker.x, marker.y, 'dragon_fx_v2', 'dfx_impact_0')
          if (impact?.anims?.play) {
            impact.anims.play('dragon_fx_v2_dfx_impact_0', true)
          }
          // Self cleanup impact after 500 ms
          if (scene.time?.delayedCall) {
            scene.time.delayedCall(500, () => impact.destroy())
          }
        }

        this.history.push({
          action: 'meteor_impact',
          x: marker.x,
          y: marker.y,
          time: now,
        })

        this.activeMarkers.splice(i, 1)
      }
    }
  }

  /**
   * Clears and destroys all active meteor markers.
   */
  clearMarkers() {
    for (const marker of this.activeMarkers) {
      if (marker.sprite && typeof marker.sprite.destroy === 'function') {
        marker.sprite.destroy()
      }
    }
    this.activeMarkers = []
  }

  /**
   * Completes active attack, triggering landing if completing Phase 2 volley.
   *
   * @param {number} [now]
   */
  completeAttack(now) {
    const currentTime = this.getCurrentTime(now)
    const finishedAttack = this.activeAttack
    this.activeAttack = null

    // Mandatory landing mechanic: "flying dragon lands after each volley"
    if (this.phase === 2 && finishedAttack === 'volley') {
      this.triggerLanding(currentTime)
      return
    }

    this.state = DRAGON_AI_STATES.IDLE
    this.attackCooldownUntil = currentTime + ATTACK_COOLDOWN_MS

    if (this.dragon && typeof this.dragon.playIdle === 'function') {
      this.dragon.playIdle()
    }

    this.history.push({
      action: 'attack_complete',
      attack: finishedAttack,
      time: currentTime,
    })
  }

  /**
   * Lands the dragon after a volley attack in Phase 2.
   * The dragon becomes grounded and vulnerable to melee.
   *
   * @param {number} [now]
   */
  triggerLanding(now) {
    const currentTime = this.getCurrentTime(now)
    this.state = DRAGON_AI_STATES.LANDED

    if (this.dragon && typeof this.dragon.landAfterVolley === 'function') {
      this.dragon.landAfterVolley()
    }

    this.airborne = false
    this.landed = true
    if (this.dragon) {
      this.dragon.elevation = 0
    }

    this.landingUntil = currentTime + DRAGON_LANDING_DURATION_MS

    this.history.push({
      action: 'landing',
      time: currentTime,
    })
  }

  /**
   * Resumes airborne state after landing duration expires in Phase 2.
   *
   * @param {number} [now]
   */
  triggerTakeoff(now) {
    const currentTime = this.getCurrentTime(now)
    this.state = DRAGON_AI_STATES.TAKEOFF

    if (this.dragon && typeof this.dragon.takeoff === 'function') {
      this.dragon.takeoff()
    }

    this.takeoffUntil = currentTime + TAKEOFF_DURATION_MS

    this.history.push({
      action: 'takeoff',
      time: currentTime,
    })
  }

  /**
   * Completes takeoff animation, returning dragon to hover state.
   *
   * @param {number} [now]
   */
  completeTakeoff(now) {
    const currentTime = this.getCurrentTime(now)
    this.airborne = true
    this.landed = false
    this.state = DRAGON_AI_STATES.IDLE
    this.attackCooldownUntil = currentTime + ATTACK_COOLDOWN_MS

    if (this.dragon) {
      this.dragon.airborne = true
      this.dragon.elevation = HOVER_ELEVATION_PX
      this.dragon.isLanding = false
    }

    if (this.dragon && typeof this.dragon.playIdle === 'function') {
      this.dragon.playIdle()
    }

    this.history.push({
      action: 'takeoff_complete',
      time: currentTime,
    })
  }

  /**
   * Triggers the dragon death sequence.
   *
   * @param {number} [now]
   */
  triggerDeath(now) {
    const currentTime = this.getCurrentTime(now)
    this.state = DRAGON_AI_STATES.DEAD
    this.invulnerable = true
    if (this.dragon) {
      this.dragon.invulnerable = true
    }
    this.activeAttack = null
    this.clearMarkers()

    if (this.dragon && typeof this.dragon.playAnim === 'function') {
      this.dragon.playAnim('death')
    }

    this.history.push({
      action: 'death',
      time: currentTime,
    })
  }

  /**
   * Resets the entire boss encounter: full HP, Phase 1, timers cleared, phase pages reset.
   */
  resetEncounter() {
    this.phase = 1
    this.state = DRAGON_AI_STATES.IDLE

    this.invulnerable = false
    this.airborne = false
    this.landed = true

    this.activeAttack = null
    this.attackStartTime = 0
    this.attackUntil = 0
    this.attackCooldownUntil = 0
    this.landingUntil = 0
    this.takeoffUntil = 0
    this.transitionUntil = 0
    this.pendingNextPhase = null

    this.clearMarkers()

    if (this.dragon) {
      this.dragon.invulnerable = false
      this.dragon.airborne = false
      this.dragon.elevation = 0
      this.dragon.isLanding = false
      if (typeof this.dragon.setPhase === 'function') {
        this.dragon.setPhase(1)
      }
      this.dragon.hp = this.dragon.hpMax || DRAGON_BASE_HP
      if (typeof this.dragon.playIdle === 'function') {
        this.dragon.playIdle()
      }
    }

    this.history.push({
      action: 'encounter_reset',
      time: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    })
  }

  /**
   * Main per-frame AI tick.
   *
   * @param {number} [time=Date.now()]
   * @param {number} [delta=0]
   */
  update(time = (typeof performance !== 'undefined' ? performance.now() : Date.now()), delta = 0) {
    // Scene.update passes performance.now(); Phaser preUpdate passes the game
    // loop clock. Ignore a backwards sample so the 700 ms marker is not cut short.
    if (typeof time === 'number' && this.lastTime > 0 && time < this.lastTime) {
      time = this.lastTime
    }
    this.lastTime = time

    // 1. Process active meteor markers
    this.updateMeteorMarkers(time)

    // 2. State-specific processing
    switch (this.state) {
      case DRAGON_AI_STATES.TRANSITION:
        if (time >= this.transitionUntil) {
          this.completeTransition(time)
        }
        break

      case DRAGON_AI_STATES.ATTACK:
        if (time >= this.attackUntil) {
          this.completeAttack(time)
        }
        break

      case DRAGON_AI_STATES.LANDED:
        if (time >= this.landingUntil) {
          this.triggerTakeoff(time)
        }
        break

      case DRAGON_AI_STATES.TAKEOFF:
        if (time >= this.takeoffUntil) {
          this.completeTakeoff(time)
        }
        break

      case DRAGON_AI_STATES.IDLE:
        if (time >= this.attackCooldownUntil) {
          this.triggerAttack(null, time)
        }
        break

      case DRAGON_AI_STATES.DEAD:
      default:
        break
    }
  }
}
