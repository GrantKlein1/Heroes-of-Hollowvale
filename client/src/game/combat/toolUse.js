/**
 * Tool use for the Batch 10 lockpick and pickaxe clips (Package B10-2).
 *
 * Timings (contactFrame, effectFrame, start/loop/end) are read from the
 * sheet's anim meta. Drop tables and the reach used to stand at a target
 * live here so balance.js stays untouched.
 * Pure module: no Phaser.
 */

import { getAnimationFrameIndex } from './hitSystem.js'
import { random } from '../rng.js'

/** Phaser sprite event fired each time a playing animation changes frame. */
export const PICKAXE_FRAME_EVENT = 'animationupdate'

export const TOOL_UNLOCK_EVENT = 'tool:unlock'
export const TOOL_MINE_EVENT = 'tool:mine'

/** Extra pixels around a zone or prop the hero can stand in and still use it. */
export const TOOL_REACH_PX = 16

/**
 * Seeded gem ids a broken mineable can drop. One roll, one gem.
 * @type {readonly ['ruby', 'sapphire', 'emerald']}
 */
export const MINE_GEMS = Object.freeze(['ruby', 'sapphire', 'emerald'])

export const TOOLS = Object.freeze({
  lockpick: Object.freeze({
    id: 'lockpick',
    classId: 'thief',
    itemId: 'lockpicks',
    clip: 'use_lockpick',
    sheetKey: 'thief_use_lockpick',
    animName: 'use_lockpick',
    hold: true,
  }),
  pickaxe: Object.freeze({
    id: 'pickaxe',
    classId: 'dwarf',
    itemId: 'dwarf_pickaxe',
    clip: 'use_pickaxe',
    sheetKey: 'dwarf_use_pickaxe',
    animName: 'use_pickaxe',
    hold: false,
  }),
})

/**
 * @param {string} classId
 * @param {string} toolId
 * @returns {boolean}
 */
export function canUseTool(classId, toolId) {
  const tool = TOOLS[toolId]
  return Boolean(tool && classId === tool.classId)
}

/**
 * @param {number} value
 * @returns {number|null}
 */
function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Atlas JSON lives on texture.customData. Phaser keeps the whole file,
 * so anims may sit under meta.anims or directly on customData.
 *
 * @param {object|null|undefined} texture
 * @param {string} animName
 * @returns {object|null}
 */
export function animMetaFromTexture(texture, animName) {
  const data = texture?.customData
  if (!data || !animName) return null
  const anims = data.meta?.anims || data.anims || null
  if (!anims || typeof anims !== 'object') return null
  return anims[animName] || null
}

/**
 * Lockpick phase lengths from the use_lockpick anim meta.
 * Unlock fires at the end of the loop (start + loop).
 *
 * @param {object|null|undefined} anim
 * @returns {{ fps: number, startFrames: number, loopFrames: number, endFrames: number, startMs: number, loopMs: number, endMs: number, unlockMs: number, totalMs: number }|null}
 */
export function readLockpickTiming(anim) {
  if (!anim || typeof anim !== 'object') return null
  const fps = finiteNumber(anim.fps)
  const startFrames = finiteNumber(anim.startFrames)
  const loopFrames = finiteNumber(anim.loopFrames)
  const endFrames = finiteNumber(anim.endFrames)
  if (fps === null || fps <= 0 || startFrames === null || loopFrames === null || endFrames === null) {
    return null
  }
  const frameMs = 1000 / fps
  const authoredStart = finiteNumber(anim.durationMsStart)
  const authoredLoop = finiteNumber(anim.durationMsLoop)
  const authoredEnd = finiteNumber(anim.durationMsEnd)
  const startMs = authoredStart === null ? startFrames * frameMs : authoredStart
  const loopMs = authoredLoop === null ? loopFrames * frameMs : authoredLoop
  const endMs = authoredEnd === null ? endFrames * frameMs : authoredEnd
  return {
    fps,
    startFrames,
    loopFrames,
    endFrames,
    startMs,
    loopMs,
    endMs,
    unlockMs: startMs + loopMs,
    totalMs: startMs + loopMs + endMs,
  }
}

/**
 * Pickaxe contact time from effectFrame/contactFrame and the per-frame
 * durations on the use_pickaxe anim meta. effectFrame 4 is the first
 * contact frame, so the wait is the sum of the frames before it.
 *
 * @param {object|null|undefined} anim
 * @returns {{ effectMs: number, totalMs: number, effectFrame: number, contactFrame: number, fps: number|null, frames: number|null }|null}
 */
export function readPickaxeTiming(anim) {
  if (!anim || typeof anim !== 'object') return null
  const effectFrame = finiteNumber(anim.effectFrame)
  const contactFrame = finiteNumber(anim.contactFrame)
  const frame = effectFrame === null ? contactFrame : effectFrame
  if (frame === null || frame < 0) return null

  const durations = Array.isArray(anim.durations) ? anim.durations : null
  let effectMs = null
  if (durations && durations.length >= frame) {
    effectMs = 0
    for (let i = 0; i < frame; i++) {
      const slice = finiteNumber(durations[i])
      if (slice === null) return null
      effectMs += slice
    }
  } else {
    const fps = finiteNumber(anim.fps)
    if (fps === null || fps <= 0) return null
    effectMs = (frame / fps) * 1000
  }

  let totalMs = null
  if (durations && durations.length > 0) {
    totalMs = 0
    for (let i = 0; i < durations.length; i++) {
      const slice = finiteNumber(durations[i])
      if (slice === null) return null
      totalMs += slice
    }
  } else if (finiteNumber(anim.durationMs) !== null) {
    totalMs = anim.durationMs
  } else if (finiteNumber(anim.fps) !== null && finiteNumber(anim.frames) !== null && anim.fps > 0) {
    totalMs = (anim.frames / anim.fps) * 1000
  }
  if (effectMs === null || totalMs === null) return null

  return {
    effectMs,
    totalMs,
    effectFrame: frame,
    contactFrame: contactFrame === null ? frame : contactFrame,
    fps: finiteNumber(anim.fps),
    frames: finiteNumber(anim.frames),
  }
}

/**
 * @param {{ hurt?: boolean, dodge?: boolean, dead?: boolean, attack?: boolean, block?: boolean, moving?: boolean, elapsed?: number }} flags
 * @returns {boolean}
 */
export function toolShouldCancel(flags) {
  if (!flags) return false
  if (flags.hurt || flags.dodge || flags.dead || flags.attack || flags.block) return true
  if (flags.moving && (flags.elapsed || 0) > 0) return true
  return false
}

/**
 * @param {{ elapsed: number, timing: { unlockMs: number, totalMs: number }, holding: boolean, inRange: boolean, interrupted: boolean, unlocked: boolean }} input
 * @returns {{ action: 'cancel'|'continue'|'complete', unlock: boolean, unlocked: boolean }}
 */
export function stepLockpick(input) {
  const unlocked = Boolean(input.unlocked)
  const interrupted = Boolean(input.interrupted) || !input.holding || !input.inRange
  if (!unlocked && interrupted) {
    return { action: 'cancel', unlock: false, unlocked: false }
  }
  const unlock = !unlocked && input.elapsed >= input.timing.unlockMs
  const nowUnlocked = unlocked || unlock
  if (nowUnlocked && (interrupted || input.elapsed >= input.timing.totalMs)) {
    return { action: 'complete', unlock, unlocked: true }
  }
  return { action: 'continue', unlock, unlocked: nowUnlocked }
}

/**
 * Frame name prefix for a hero's use_pickaxe clip (`dwarf_use_pickaxe_down_4`).
 *
 * @param {string} classId
 * @returns {string}
 */
function pickaxeClipPrefix(classId) {
  return `${classId || ''}_${TOOLS.pickaxe.clip}_`
}

/**
 * The use_pickaxe frame on screen, read the same way the bow and the spells
 * read their release frames. `onClip` is false when that animation is not
 * the one playing (missing atlas, or the swing was replaced).
 *
 * @param {object|null|undefined} player
 * @returns {{ onClip: boolean, frameIndex: number, frameName: string }}
 */
export function readPickaxeFrame(player) {
  const frame = player?.anims?.currentFrame
  const frameName = frame?.frame?.name || frame?.textureFrame || ''
  const name = typeof frameName === 'string' ? frameName : ''
  const frameIndex = getAnimationFrameIndex(frame)
  const onClip = name.startsWith(pickaxeClipPrefix(player?.classId))
  return { onClip, frameIndex, frameName: name }
}

/**
 * Contact frame index from one `animationupdate`, or -1 when this payload
 * is not the use_pickaxe clip at or past effectFrame.
 *
 * Phaser passes `(animation, frame, gameObject, frameKey)`.
 *
 * @param {object|null|undefined} anim
 * @param {object|null|undefined} frame
 * @param {string} [frameKey]
 * @param {string} classId
 * @param {number} effectFrame
 * @returns {number}
 */
export function pickaxeContactIndex(anim, frame, frameKey, classId, effectFrame) {
  const contact = finiteNumber(effectFrame)
  if (contact === null || contact < 0) return -1
  const key = typeof anim?.key === 'string' ? anim.key : ''
  const named = frame?.textureFrame || frame?.frame?.name || frameKey || ''
  const name = typeof named === 'string' ? named : ''
  const prefix = pickaxeClipPrefix(classId)
  if (!key.startsWith(prefix) && !name.startsWith(prefix)) return -1
  const index = getAnimationFrameIndex(
    frame?.textureFrame || frame?.frame?.name ? frame : { textureFrame: name },
  )
  return index >= contact ? index : -1
}

/**
 * Subscribes to the sprite's animation frame event. `onContact` runs once,
 * on the first use_pickaxe frame at or past effectFrame, and never after
 * unbind or when `isCancelled()` is true.
 *
 * @param {object|null|undefined} sprite
 * @param {{ classId: string, effectFrame: number, isCancelled?: () => boolean, onContact: (frameIndex: number) => void }} options
 * @returns {() => void} unbind
 */
export function watchPickaxeContact(sprite, options) {
  if (!sprite || typeof sprite.on !== 'function' || !options || typeof options.onContact !== 'function') {
    return () => {}
  }
  const isCancelled = typeof options.isCancelled === 'function' ? options.isCancelled : () => false
  let fired = false
  let bound = true
  const handler = (anim, frame, _gameObject, frameKey) => {
    if (!bound || fired || isCancelled()) return
    const index = pickaxeContactIndex(anim, frame, frameKey, options.classId, options.effectFrame)
    if (index < 0) return
    fired = true
    options.onContact(index)
  }
  sprite.on(PICKAXE_FRAME_EVENT, handler)
  return () => {
    bound = false
    if (typeof sprite.off === 'function') sprite.off(PICKAXE_FRAME_EVENT, handler)
  }
}

/**
 * The mine lands when use_pickaxe actually reaches effectFrame. effectMs is
 * only the fallback when that clip cannot play (`animPlayable` false and the
 * clip is not on screen). A cancel on the contact tick does not fire, and a
 * swing that already fired does not fire again.
 *
 * @param {{ elapsed: number, timing: { effectMs: number, totalMs: number, effectFrame?: number }, interrupted?: boolean, cancelled?: boolean, effectFired?: boolean, onClip?: boolean, frameIndex?: number, animPlayable?: boolean }} input
 * @returns {{ action: 'cancel'|'continue'|'complete', effect: boolean }}
 */
export function stepPickaxe(input) {
  const timing = input.timing
  const effectFired = Boolean(input.effectFired)
  const cancelled = Boolean(input.interrupted) || Boolean(input.cancelled)
  if (!effectFired && cancelled) {
    return { action: 'cancel', effect: false }
  }

  const effectFrame = finiteNumber(timing?.effectFrame)
  const frameIndex = finiteNumber(input.frameIndex)
  const onClip = input.onClip === true
  // Omitted animPlayable keeps the clock path for callers that do not have a
  // clip (the existing timing tests, a missing atlas). A clip that is on
  // screen never falls through to the clock, even when it is running late.
  const animPlayable = input.animPlayable === true || onClip
  const frameDue = !effectFired
    && onClip
    && effectFrame !== null
    && frameIndex !== null
    && frameIndex >= effectFrame
  const timeDue = !effectFired && !animPlayable && input.elapsed >= timing.effectMs
  const effect = frameDue || timeDue
  const fired = effectFired || effect
  if (fired && (cancelled || input.elapsed >= timing.totalMs)) {
    return { action: 'complete', effect }
  }
  return { action: 'continue', effect }
}

/**
 * One seeded gem. `next` defaults to the game RNG.
 *
 * @param {() => number} [next]
 * @returns {{ id: string, gems: { ruby: number, sapphire: number, emerald: number }, items: [] }}
 */
export function rollMineLoot(next = random) {
  const roll = typeof next === 'function' ? next() : random()
  const span = MINE_GEMS.length
  const index = Math.min(span - 1, Math.max(0, Math.floor(roll * span)))
  const id = MINE_GEMS[index]
  const gems = { ruby: 0, sapphire: 0, emerald: 0 }
  gems[id] = 1
  return { id, gems, items: [] }
}

/**
 * @param {object|null|undefined} entity
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function entityRect(entity) {
  return {
    x: Number(entity?.x) || 0,
    y: Number(entity?.y) || 0,
    w: Number(entity?.width) || 0,
    h: Number(entity?.height) || 0,
  }
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {number} [pad]
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function expandedRect(rect, pad = TOOL_REACH_PX) {
  const extra = Number(pad) || 0
  return {
    x: rect.x - extra,
    y: rect.y - extra,
    w: rect.w + extra * 2,
    h: rect.h + extra * 2,
  }
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 * @returns {boolean}
 */
export function rectsOverlap(a, b) {
  if (!a || !b) return false
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * @param {object|null|undefined} entity
 * @param {string} name
 * @returns {any}
 */
export function readPropFlag(entity, name) {
  if (!entity || !name) return undefined
  const direct = entity.properties
  if (direct && !Array.isArray(direct) && Object.prototype.hasOwnProperty.call(direct, name)) {
    return direct[name]
  }
  const list = Array.isArray(direct) ? direct : entity.raw?.properties
  if (!Array.isArray(list)) return undefined
  const hit = list.find((entry) => entry && entry.name === name)
  return hit ? hit.value : undefined
}

/**
 * @param {object|null|undefined} zone
 * @returns {boolean}
 */
export function isLockedTarget(zone) {
  if (!zone || zone.opened) return false
  return zone.properties?.locked === true
}

/**
 * @param {object|null|undefined} entity
 * @returns {boolean}
 */
export function isMineableTarget(entity) {
  if (!entity || entity.mined || entity.broken) return false
  return readPropFlag(entity, 'mineable') === true
}

/**
 * @param {string} toolId
 * @param {object[]} zones
 * @param {object[]} props
 * @param {{ x: number, y: number, w: number, h: number }} box
 * @returns {object|null}
 */
export function findToolTarget(toolId, zones, props, box) {
  const within = (entity) => rectsOverlap(box, expandedRect(entityRect(entity)))
  if (toolId === 'lockpick') {
    for (const zone of zones || []) {
      if (isLockedTarget(zone) && within(zone)) return zone
    }
    return null
  }
  if (toolId === 'pickaxe') {
    for (const prop of props || []) {
      if (isMineableTarget(prop) && within(prop)) return prop
    }
    for (const zone of zones || []) {
      if (isMineableTarget(zone) && within(zone)) return zone
    }
  }
  return null
}

/**
 * Feet point of a prop, the in-world sprite placed on those feet, and the
 * static body created for its footprint (same order as propFootprints).
 *
 * @param {object|null|undefined} loader
 * @param {object|null|undefined} prop
 * @returns {{ x: number, y: number, sprite: object|null, body: object|null }}
 */
export function locateMineVisual(loader, prop) {
  const x = (Number(prop?.x) || 0) + (Number(prop?.width) || 0) / 2
  const y = (Number(prop?.y) || 0) + (Number(prop?.height) || 0)
  const sprites = Array.isArray(loader?.propSprites) ? loader.propSprites : []
  let sprite = null
  for (let i = 0; i < sprites.length; i++) {
    const candidate = sprites[i]
    if (!candidate) continue
    if (Math.abs(candidate.x - x) <= 1 && Math.abs(candidate.y - y) <= 1) {
      sprite = candidate
      break
    }
  }
  const footprints = Array.isArray(loader?.propFootprints) ? loader.propFootprints : []
  const index = footprints.findIndex((fp) => fp && fp.id === prop?.id)
  const children = typeof loader?.propGroup?.getChildren === 'function' ? loader.propGroup.getChildren() : []
  const body = index >= 0 ? children[index] || null : null
  return { x, y, sprite, body }
}
