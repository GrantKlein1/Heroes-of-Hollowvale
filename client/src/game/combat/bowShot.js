/**
 * bowShot.js: the lightning bow (BOW-1).
 *
 * Space with the bow in hand plays the hero's `<hero>_use_bow_<facing>` clip
 * (10 frames at 12 fps). The arrow leaves on the release frame (6, 500 ms in),
 * at that frame's `arrowTip` from `<hero>_use_bow_anchors.json`, flying the way
 * the hero faces. Wind-up, release and cooldown mirror the poison vial's
 * (spells.js): nothing spawns until the release frame, and a hurt, dodge, death
 * or weapon swap during the draw drops the shot.
 *
 * The arrow reuses the Projectile class (the same flight, solid and enemy hit
 * code as the mage lightning bolt) with the blue-and-white `lightning_arrow_b12`
 * flight clip and `lightning_arrow_impact_b12` impact clip.
 */

import { Projectile } from '../actors/Projectile.js'
import { getItemAnchor } from '../actors/itemHold.js'
import { getItem, isRangedWeapon } from '../items/registry.js'
import { onSpellCast, onSpellImpact } from '../MainGameScene.js'
import { getAnimationFrameIndex } from './hitSystem.js'
import { facingToVector } from './spells.js'

export const BOW_ITEM_ID = 'lightning_bow'
export const BOW_CLIP = 'use_bow'

/** Texture and clip keys of the arrow FX (manifest group `bow_b12`). */
export const ARROW_TEXTURE = 'lightning_arrow_b12'
export const ARROW_IMPACT_TEXTURE = 'lightning_arrow_impact_b12'
export const ARROW_FLY_ANIM = 'lightning_arrow_fly'
export const ARROW_HIT_ANIM = 'lightning_arrow_hit'

const ARROW_FPS = 16
const ARROW_FRAMES = 4
const IMPACT_FRAMES = 7
/** The arrow flies at chest height; walls and foes are hit at the feet row, so the hit box drops by this much. */
export const ARROW_HIT_DROP_PX = 40

function safe(fn) {
  try {
    fn()
  } catch (_e) {
    // Audio stub for headless / node testing environments
  }
}

/**
 * Release frame, release time and clip length of the draw, from the registry's
 * per-frame durations (they match every hero's use_bow sheet meta).
 *
 * @returns {{ releaseFrame: number, releaseMs: number, durationMs: number, frames: number }}
 */
export function getBowTiming() {
  const use = getItem(BOW_ITEM_ID)?.use
  const durations = use?.durations || []
  const releaseFrame = Number.isInteger(use?.effectFrame) ? use.effectFrame : 6
  const releaseMs = durations.slice(0, releaseFrame).reduce((a, b) => a + b, 0)
  const durationMs = durations.reduce((a, b) => a + b, 0)
  return { releaseFrame, releaseMs, durationMs, frames: durations.length }
}

/** The next shot waits until this draw finishes (one full clip, counted from the press). */
export function getBowCooldownMs() {
  return getBowTiming().durationMs
}

/**
 * Feet-relative arrow spawn point for a hero and facing: the `arrowTip` of the
 * release frame in the hero's use_bow anchors.
 *
 * @param {string} classId
 * @param {string} facing
 * @returns {{ x: number, y: number }}
 */
export function getArrowSpawnOffset(classId, facing = 'down') {
  const { releaseFrame } = getBowTiming()
  const anchor = getItemAnchor(classId, BOW_CLIP, `${classId}_use_bow_${facing}_${releaseFrame}`)
  const tip = anchor?.arrowTip
  if (Array.isArray(tip) && tip.length >= 2) return { x: tip[0], y: tip[1] }
  return { x: 0, y: -44 }
}

/**
 * Creates the arrow flight and impact clips under plain keys once their textures are loaded.
 *
 * @param {import('phaser').Scene} scene
 * @returns {boolean} true when both clips exist
 */
export function ensureBowAnimations(scene) {
  if (!scene?.anims || typeof scene.anims.create !== 'function') return false
  const make = (key, texture, count, frameRate, repeat) => {
    if (typeof scene.anims.exists === 'function' && scene.anims.exists(key)) return true
    if (typeof scene.textures?.exists === 'function' && !scene.textures.exists(texture)) return false
    try {
      scene.anims.create({
        key,
        frames: Array.from({ length: count }, (_, i) => ({ key: texture, frame: `${texture}_${i}` })),
        frameRate,
        repeat,
      })
      return true
    } catch (_e) {
      return false
    }
  }
  const fly = make(ARROW_FLY_ANIM, ARROW_TEXTURE, ARROW_FRAMES, ARROW_FPS, -1)
  const hit = make(ARROW_HIT_ANIM, ARROW_IMPACT_TEXTURE, IMPACT_FRAMES, ARROW_FPS, 0)
  return fly && hit
}

/**
 * Loads the arrow FX group on demand (it normally rides along with the village,
 * wilderness, cavern and boss groups) and registers the clips.
 *
 * @param {import('phaser').Scene} scene
 */
export function ensureBowFx(scene) {
  const registry = scene?.assetRegistry
  if (registry && typeof registry.loadGroup === 'function') {
    const loaded = typeof registry.isGroupLoaded === 'function' && registry.isGroupLoaded('bow_b12')
    if (!loaded) registry.loadGroup('bow_b12')
  }
  return ensureBowAnimations(scene)
}

function shotInterrupted(player) {
  if (!player) return true
  if (typeof player.is === 'function' && (player.is('HURT') || player.is('DODGE') || player.is('DEAD'))) return true
  return false
}

/**
 * Drops an in-progress draw. Spawns nothing.
 *
 * @param {object} player
 * @returns {boolean}
 */
export function cancelBowShot(player) {
  const pending = player?._bowShot
  if (!pending || pending.released) return false
  pending.cancelled = true
  player._bowShot = null
  if (player.itemUseState?.clip === BOW_CLIP) {
    player.itemUseState = { active: false, itemId: null, startTime: 0, clip: null }
  }
  return true
}

/**
 * Starts a draw. The arrow is not created yet.
 *
 * @param {import('phaser').Scene} scene
 * @param {object} player
 * @param {number} [now]
 * @returns {object|null}
 */
export function armBowShot(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null
  if (!isRangedWeapon(BOW_ITEM_ID)) return null
  if (shotInterrupted(player)) return null
  const existing = player._bowShot
  if (existing && !existing.released && !existing.cancelled) return existing
  if (now < (player._bowCooldownUntil || 0)) return null

  const facing = player.facing || 'down'
  const timing = getBowTiming()
  const pending = {
    scene,
    facing,
    animKey: `${player.classId}_use_bow_${facing}`,
    releaseFrame: timing.releaseFrame,
    releaseMs: timing.releaseMs,
    durationMs: timing.durationMs,
    startedAt: now,
    released: false,
    cancelled: false,
    animStarted: false,
    spawnedAt: null,
    projectile: null,
  }
  player._bowShot = pending
  return pending
}

/**
 * Spawns the lightning arrow at the release frame's arrow tip, flying the way the hero faces.
 *
 * @param {import('phaser').Scene} scene
 * @param {object} player
 * @param {string} facing
 * @returns {Projectile|null}
 */
export function spawnLightningArrow(scene, player, facing) {
  const item = getItem(BOW_ITEM_ID)
  const shot = item?.projectile
  if (!scene || !player || !shot) return null
  ensureBowFx(scene)
  const [dx, dy] = facingToVector(facing)
  const offset = getArrowSpawnOffset(player.classId, facing)
  const scale = player.scaleX || 1
  const proj = new Projectile(scene, player.x + offset.x * scale, player.y + offset.y * scale, ARROW_TEXTURE, `${ARROW_TEXTURE}_0`, {
    dirX: dx,
    dirY: dy,
    speed: shot.speed,
    maxDist: shot.maxDist,
    size: shot.size,
    owner: 'player',
    damage: item.weapon.damage,
    impact: 'lightning',
    // The arrowhead is at x 76 of the 96 px cell: pin it to the spawn point and fly it tip first.
    origin: { x: shot.tipX ?? 0.5, y: 0.5 },
    hitOrigin: { x: 0.5, y: 0.5 },
    flyAnim: ARROW_FLY_ANIM,
    hitAnim: ARROW_HIT_ANIM,
    hitOffsetY: ARROW_HIT_DROP_PX * scale,
    onImpact: () => {
      safe(onSpellImpact)
    },
  })
  proj.isBowArrow = true
  if (Array.isArray(scene.projectiles)) scene.projectiles.push(proj)
  return proj
}

/**
 * Fires the armed arrow on frame 6 while the draw is playing. 500 ms is the backstop only when that clip is not playing.
 *
 * @param {object} player
 * @param {number} now
 * @returns {Projectile|null}
 */
export function tickBowShot(player, now) {
  const pending = player?._bowShot
  if (!pending || pending.released || pending.cancelled) return null
  if (shotInterrupted(player)) {
    cancelBowShot(player)
    return null
  }
  const facing = player.facing || pending.facing || 'down'
  const frame = player.anims?.currentFrame
  const frameName = frame?.frame?.name || frame?.textureFrame || ''
  const frameIndex = getAnimationFrameIndex(frame)
  const onClip = typeof frameName === 'string' && frameName.startsWith(`${player.classId}_use_bow_`)
  const frameDue = onClip && frameIndex >= pending.releaseFrame
  const elapsed = now - pending.startedAt
  // Wall-clock time fires only when the draw clip is not playing (unit tests, a missing
  // animation). While it is on screen, the arrow leaves on frame 6 and not before,
  // even if the animation clock is behind the press.
  const timeDue = !onClip && elapsed >= pending.releaseMs
  if (!frameDue && !timeDue) return null

  pending.released = true
  pending.facing = facing
  pending.spawnedAt = now
  const scene = pending.scene || player.scene
  const proj = spawnLightningArrow(scene, player, facing)
  pending.projectile = proj
  // The draw itself is the cooldown: the next shot can start when this clip ends,
  // not a full draw after the release (that left the hero idle and unable to fire).
  player._bowCooldownUntil = pending.startedAt + (pending.durationMs || getBowCooldownMs())
  safe(onSpellCast)
  return proj
}
