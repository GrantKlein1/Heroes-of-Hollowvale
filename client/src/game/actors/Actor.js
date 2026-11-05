/**
 * Actor — Base sprite class for all characters, enemies, and interactive combatants.
 *
 * Implements:
 * - Dynamic per-sheet feet origin resolution from atlas metadata / AssetRegistry
 * - Accurate footprint collision body from meta.footprint relative to feet pivot
 * - 4-facing directional rule (dominant axis, tie keeps previous, no flipX)
 * - Integrated priority StateMachine with 150 ms input buffering
 * - Feet Y-sorting depth management
 */

import Phaser from 'phaser'
import { resolveFacing, DEFAULT_FACING, isValidFacing } from './facing.js'
import { StateMachine, ACTOR_STATES, DEFAULT_BUFFER_WINDOW_MS } from './stateMachine.js'
import { buildAnimKey } from '../assets/animKeys.js'

// Safe sprite base resolution for both browser runtime and mocked test environments
const SpriteBase = (Phaser && Phaser.Physics && Phaser.Physics.Arcade && Phaser.Physics.Arcade.Sprite)
  ? Phaser.Physics.Arcade.Sprite
  : (Phaser && Phaser.GameObjects && Phaser.GameObjects.Sprite)
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
          this.width = 64
          this.height = 96
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
        setTexture(k, f) {
          this.texture = { key: k }
          this.frame = { name: f }
          return this
        }
      }

export class Actor extends SpriteBase {
  /**
   * @param {import('phaser').Scene} scene - Active Phaser scene
   * @param {number} x - Initial X coordinate
   * @param {number} y - Initial Y coordinate
   * @param {string} texture - Initial texture sheet key
   * @param {string|number} [frame] - Initial frame name or index
   * @param {object} [options] - Configuration options
   * @param {string} [options.assetId] - Logical asset ID (e.g. 'knight', 'goblin')
   * @param {string} [options.facing='down'] - Initial facing direction
   * @param {string} [options.initialState='IDLE'] - Initial state
   * @param {number} [options.bufferWindowMs=150] - Input buffer window in ms
   * @param {object} [options.footprint] - Explicit footprint override
   * @param {object} [options.anchor] - Explicit anchor override
   */
  constructor(scene, x = 0, y = 0, texture = '', frame = '', options = {}) {
    super(scene, x, y, texture, frame)

    this.scene = scene
    this.assetId = options.assetId || (typeof texture === 'string' ? texture : '')

    // Add to scene display and physics if available
    if (scene) {
      if (scene.add?.existing) {
        scene.add.existing(this)
      }
      if (scene.physics?.add?.existing) {
        scene.physics.add.existing(this)
      }
    }

    // 1. Initialize facing (4 cardinal directions; no flipX)
    this.facing = isValidFacing(options.facing) ? options.facing : DEFAULT_FACING

    // 2. Initialize priority state machine with 150 ms buffer
    this.stateMachine = new StateMachine(options.initialState || ACTOR_STATES.IDLE, {
      bufferWindowMs: options.bufferWindowMs || DEFAULT_BUFFER_WINDOW_MS,
      defaultState: options.defaultState || ACTOR_STATES.IDLE,
      startTime: options.time || 0,
    })

    this.stateMachine.onEnter((newState, prevState, stateOpts) => {
      this.onStateEnter(newState, prevState, stateOpts)
    })

    // 3. Resolve and apply dynamic feet origin from sheet metadata
    const sheetKey = typeof texture === 'string' ? texture : this.texture?.key || ''
    this.applySheetOrigin(sheetKey, options.anchor)

    // 4. Resolve and apply footprint collision body
    this.applyFootprint(sheetKey, options.footprint)

    // 5. Initial depth based on feet position
    this.updateDepth()
  }

  /**
   * Resolves the anchor for a sheet from AssetRegistry, texture metadata, or frame pivot.
   *
   * @param {string} sheetKey
   * @returns {{ x: number, y: number }}
   */
  resolveAnchor(sheetKey) {
    // 1. Query scene.assetRegistry if present
    if (this.scene?.assetRegistry && typeof this.scene.assetRegistry.getAnchor === 'function') {
      return this.scene.assetRegistry.getAnchor(sheetKey)
    }

    // 2. Query Phaser texture customData / meta
    if (typeof this.scene?.textures?.get === 'function') {
      const textureObj = this.scene.textures.get(sheetKey)
      const meta = textureObj?.customData?.meta
      if (meta?.origin && typeof meta.origin.x === 'number' && typeof meta.origin.y === 'number') {
        return { x: Number(meta.origin.x), y: Number(meta.origin.y) }
      }
      if (meta?.anchor && typeof meta.anchor.x === 'number' && typeof meta.anchor.y === 'number') {
        return { x: Number(meta.anchor.x), y: Number(meta.anchor.y) }
      }

      // Check frame pivot
      if (typeof textureObj?.getFrameNames === 'function') {
        const names = textureObj.getFrameNames()
        if (names.length > 0) {
          const frameObj = textureObj.get(names[0])
          const pivot = frameObj?.customData?.pivot || frameObj?.pivot
          if (pivot && typeof pivot.x === 'number' && typeof pivot.y === 'number') {
            return { x: Number(pivot.x), y: Number(pivot.y) }
          }
        }
      }
    }

    // 3. Check current frame pivot
    const framePivot = this.frame?.customData?.pivot || this.frame?.pivot
    if (framePivot && typeof framePivot.x === 'number' && typeof framePivot.y === 'number') {
      return { x: Number(framePivot.x), y: Number(framePivot.y) }
    }

    // 4. Fallback center origin
    return { x: 0.5, y: 0.5 }
  }

  /**
   * Applies the feet origin to this sprite for the given sheet.
   *
   * @param {string} sheetKey
   * @param {{ x: number, y: number }} [explicitAnchor]
   * @returns {{ x: number, y: number }}
   */
  applySheetOrigin(sheetKey, explicitAnchor = null) {
    const anchor = explicitAnchor || this.resolveAnchor(sheetKey)
    if (typeof this.setOrigin === 'function') {
      this.setOrigin(anchor.x, anchor.y)
    }
    this.anchor = { ...anchor }
    return this.anchor
  }

  /**
   * Resolves footprint metadata and configures the Arcade Physics collision body.
   *
   * Footprint coordinates in meta are relative to feet pivot:
   *   offsetX = pivotX + footprint.x
   *   offsetY = pivotY + footprint.y
   *
   * @param {string} [sheetKey]
   * @param {object} [explicitFootprint]
   */
  applyFootprint(sheetKey, explicitFootprint = null) {
    const key = sheetKey || (typeof this.texture === 'string' ? this.texture : this.texture?.key)
    let meta = null

    if (this.scene?.textures?.get) {
      const tex = this.scene.textures.get(key)
      meta = tex?.customData?.meta
    }

    const fp = explicitFootprint || meta?.footprint
    if (meta?.hurtbox) {
      this.hurtbox = { ...meta.hurtbox }
    }

    if (!fp || typeof fp.w !== 'number' || typeof fp.h !== 'number') {
      return
    }

    this.footprint = { ...fp }

    // Resolve frame dimensions and feet pivot in pixels
    const frameW = this.frame?.realWidth || this.frame?.width || this.width || 64
    const frameH = this.frame?.realHeight || this.frame?.height || this.height || 96

    const originX = typeof this.originX === 'number' ? this.originX : (this.anchor?.x ?? 0.5)
    const originY = typeof this.originY === 'number' ? this.originY : (this.anchor?.y ?? 0.9271)

    const pivotX = originX * frameW
    const pivotY = originY * frameH

    // Offset in sprite frame coordinate space
    const offsetX = Math.round(pivotX + (fp.x || 0))
    const offsetY = Math.round(pivotY + (fp.y || 0))

    if (this.body) {
      if (typeof this.body.setSize === 'function') {
        this.body.setSize(fp.w, fp.h, false)
      }
      if (typeof this.body.setOffset === 'function') {
        this.body.setOffset(offsetX, offsetY)
      }
    }
  }

  /**
   * Updates facing using dominant axis rule (tie keeps previous).
   *
   * @param {number} dx
   * @param {number} dy
   * @returns {string} - Updated facing
   */
  updateFacing(dx, dy) {
    this.facing = resolveFacing(dx, dy, this.facing)
    return this.facing
  }

  /**
   * Sets facing explicitly if valid.
   *
   * @param {string} dir
   * @returns {string}
   */
  setFacing(dir) {
    if (isValidFacing(dir)) {
      this.facing = dir
    }
    return this.facing
  }

  /**
   * Hook called when state machine enters a new state.
   * Can be overridden by subclasses.
   *
   * @param {string} newState
   * @param {string} prevState
   * @param {object} options
   */
  onStateEnter(newState, prevState, options) {
    // Subclasses override to trigger animations or sounds
  }

  /**
   * Returns anim key formatted as `<assetId>_<anim>_<facing>`.
   *
   * @param {string} anim
   * @param {string} [dir=this.facing]
   * @returns {string}
   */
  getAnimKey(anim, dir = this.facing) {
    const asset = this.assetId || this.texture?.key || 'actor'
    return buildAnimKey(asset, anim, dir)
  }

  /**
   * Plays an animation with 4-directional key resolution.
   *
   * @param {string} animName
   * @param {boolean} [ignoreIfPlaying=true]
   * @returns {Phaser.GameObjects.Sprite}
   */
  playAnim(animName, ignoreIfPlaying = true) {
    const key = this.getAnimKey(animName)
    if (this.anims && typeof this.anims.play === 'function') {
      return this.anims.play(key, ignoreIfPlaying)
    }
    return this
  }

  /**
   * Updates depth for top-down Y-sorting (based on feet position).
   */
  updateDepth() {
    const feetY = this.body?.bottom ?? this.y
    if (typeof this.setDepth === 'function') {
      this.setDepth(feetY)
    }
  }

  /**
   * Per-frame update step.
   *
   * @param {number} time
   * @param {number} delta
   */
  update(time = Date.now(), delta = 0) {
    // 1. Update state machine
    this.stateMachine.update(time, delta)

    // 2. Update facing from velocity if moving
    if (this.body?.velocity) {
      const vx = this.body.velocity.x || 0
      const vy = this.body.velocity.y || 0
      if (vx !== 0 || vy !== 0) {
        this.updateFacing(vx, vy)
      }
    }

    // 3. Update depth
    this.updateDepth()
  }

  // --- StateMachine Pass-Through API ---

  get state() {
    return this.stateMachine.state
  }

  transition(targetState, options) {
    return this.stateMachine.transition(targetState, options)
  }

  requestState(targetState, options) {
    return this.stateMachine.requestState(targetState, options)
  }

  bufferInput(inputState, time, options) {
    return this.stateMachine.bufferInput(inputState, time, options)
  }

  consumeBuffer(currentTime) {
    return this.stateMachine.consumeBuffer(currentTime)
  }

  is(state) {
    return this.stateMachine.is(state)
  }
}

