/**
 * spells.js — Spells and Projectile Management for Heroes of Hollowvale.
 *
 * Implements:
 * - Meta-accurate spawn offsets and release timings for Mage & Thief
 * - Mage Fireball (meta offsets from mage_cast.json within +-2 px, 15 mana cost, fly/hit atlas anims)
 * - Mage Lightning (spell_fx_v2 bolt + impact, spawned on the v2 release frame)
 * - Mage Life Leech (40% enemy HP drain, 10 s cooldown, leech orb / impact / return / absorb)
 * - Mage Mana Shield (shield_form -> shield_loop -> shield_break over mage feet origin)
 * - Mage Blink (blink_portal at departure/destination, collision-safe forward teleport)
 * - Thief Poison Vial (baked spin thief_fx_poison_vial, arced toss, poison_splash impact)
 */

import { Projectile } from '../actors/Projectile.js'
import { session } from '../session.js'
import { eventBus, GameEvents } from '../../lib/eventBus.js'
import { onSpellCast, onSpellImpact } from '../MainGameScene.js'
import { buildV2CastAnimKey } from '../assets/animKeys.js'
import { getAnimationFrameIndex } from './hitSystem.js'
import mageSpellsV2Atlas from '../../../public/assets/characters/mage/spells_v2/mage_spells_v2.json'
import spellFxV2Atlas from '../../../public/assets/characters/mage/spells_v2/spell_fx_v2.json'
function safeSpellCast() {
  try {
    onSpellCast()
  } catch (_e) {
    // Audio stub for headless / node testing environments
  }
}

function safeSpellImpact() {
  try {
    onSpellImpact()
  } catch (_e) {
    // Audio stub for headless / node testing environments
  }
}
import {
  FIREBALL_SPEED,
  FIREBALL_DIST,
  FIRE_LINGER_MS,
} from './balance.js'

/** Used only when a v2 clip omits frameRate. Authored sheets set frameRate in meta. */
const V2_CAST_FPS_FALLBACK = 16

/**
 * spell_fx_v2 clip names. Each value must exist on the sheet; nothing is invented.
 * lightning: bolt + impact. leech: orb, impact, return, absorb.
 */
const V2_FX_CLIPS = Object.freeze({
  lightning: Object.freeze({
    fly: 'lightning_bolt_v2',
    hit: 'lightning_impact_v2',
  }),
  leech: Object.freeze({
    fly: 'leech_orb_v2',
    hit: 'leech_impact_v2',
    return: 'leech_return_v2',
    absorb: 'leech_absorb_v2',
  }),
})

for (const group of Object.values(V2_FX_CLIPS)) {
  for (const clipName of Object.values(group)) {
    if (!spellFxV2Atlas.meta?.anims?.[clipName]) {
      throw new Error(`spell_fx_v2 meta is missing clip "${clipName}"`)
    }
  }
}

/**
 * @param {object} atlas
 * @param {string} frameName
 * @returns {{ x: number, y: number }|null}
 */
export function getAtlasFramePivot(atlas, frameName) {
  const pivot = atlas?.frames?.[frameName]?.pivot
  if (pivot && typeof pivot.x === 'number' && typeof pivot.y === 'number') {
    return { x: pivot.x, y: pivot.y }
  }
  return null
}

/**
 * Feet-relative spawn offset for a v2 Lightning or Leech facing.
 * Prefers meta.spawnOffset, then the clip's spawnOffsetFromFeet.
 *
 * @param {string} spellId
 * @param {string} facing
 * @returns {{ x: number, y: number }}
 */
export function readV2SpawnOffset(spellId, facing) {
  const named = mageSpellsV2Atlas.meta?.spawnOffset?.[spellId]?.[facing]
  if (named && typeof named.x === 'number' && typeof named.y === 'number') {
    return { x: named.x, y: named.y }
  }
  const clip = mageSpellsV2Atlas.meta?.anims?.[buildV2CastAnimKey(spellId, facing)]
  const pair = clip?.spawnOffsetFromFeet
  if (Array.isArray(pair) && pair.length >= 2) {
    return { x: pair[0], y: pair[1] }
  }
  return { x: 0, y: 0 }
}

function freezeFacingOffsets(spellId) {
  return Object.freeze({
    down: Object.freeze(readV2SpawnOffset(spellId, 'down')),
    left: Object.freeze(readV2SpawnOffset(spellId, 'left')),
    right: Object.freeze(readV2SpawnOffset(spellId, 'right')),
    up: Object.freeze(readV2SpawnOffset(spellId, 'up')),
  })
}

/**
 * Release frame, release time, and body-clip key for one facing.
 *
 * @param {string} spellId
 * @param {string} [facing='down']
 * @returns {{ key: string, releaseFrame: number, releaseMs: number, frameRate: number, offset: { x: number, y: number } }}
 */
export function getV2CastTiming(spellId, facing = 'down') {
  const key = buildV2CastAnimKey(spellId, facing)
  const clip = mageSpellsV2Atlas.meta?.anims?.[key]
  const releaseFrame = clip?.releaseFrame ?? mageSpellsV2Atlas.meta?.release?.[spellId]
  const frameRate = clip?.frameRate > 0 ? clip.frameRate : V2_CAST_FPS_FALLBACK
  const releaseMs = typeof clip?.releaseMs === 'number'
    ? clip.releaseMs
    : (Number(releaseFrame) / frameRate) * 1000
  return {
    key,
    releaseFrame,
    releaseMs,
    frameRate,
    offset: readV2SpawnOffset(spellId, facing),
  }
}

/**
 * Pivot for a v2 cast body frame. Falls back to the sheet origin in meta.
 *
 * @param {string} frameName
 * @returns {{ x: number, y: number }|null}
 */
export function getV2CastFramePivot(frameName) {
  const pivot = getAtlasFramePivot(mageSpellsV2Atlas, frameName)
  if (pivot) return pivot
  const origin = mageSpellsV2Atlas.meta?.origin
  if (origin && typeof origin.x === 'number' && typeof origin.y === 'number') {
    return { x: origin.x, y: origin.y }
  }
  return null
}

/**
 * Sheet key plus footprint and hurtbox copied from mage_spells_v2 meta.
 *
 * @returns {{ sheet: string, footprint: object|null, hurtbox: object|null }}
 */
export function getV2CastBodyLayout() {
  const meta = mageSpellsV2Atlas.meta || {}
  return {
    sheet: 'mage_spells_v2',
    footprint: meta.footprint || null,
    hurtbox: meta.hurtbox || null,
  }
}

function fxFramePivot(clipName) {
  const first = spellFxV2Atlas.meta?.anims?.[clipName]?.frames?.[0]
  return getAtlasFramePivot(spellFxV2Atlas, first) || { x: 0.5, y: 0.5 }
}

function readLeechReturnOffset(facing) {
  const named = mageSpellsV2Atlas.meta?.returnOffset?.leech?.[facing]
  if (named && typeof named.x === 'number' && typeof named.y === 'number') {
    return { x: named.x, y: named.y }
  }
  return { x: 0, y: 0 }
}

/** Fireball spawn offsets relative to feet pivot (from mage_cast.json meta) */
export const FIREBALL_SPAWN_OFFSETS = Object.freeze({
  down: Object.freeze({ x: -15, y: -56 }),
  left: Object.freeze({ x: -27, y: -65 }),
  right: Object.freeze({ x: 27, y: -58 }),
  up: Object.freeze({ x: 15, y: -67 }),
})

/** Mage spell spawn offsets relative to feet pivot (v2 atlas meta for lightning and leech) */
export const SPELL_SPAWN_OFFSETS = Object.freeze({
  lightning: freezeFacingOffsets('lightning'),
  leech: freezeFacingOffsets('leech'),
  shield: Object.freeze({
    down: Object.freeze({ x: 0, y: 0 }),
    left: Object.freeze({ x: 0, y: 0 }),
    right: Object.freeze({ x: 0, y: 0 }),
    up: Object.freeze({ x: 0, y: 0 }),
  }),
  blink: Object.freeze({
    down: Object.freeze({ x: 0, y: 0 }),
    left: Object.freeze({ x: 0, y: 0 }),
    right: Object.freeze({ x: 0, y: 0 }),
    up: Object.freeze({ x: 0, y: 0 }),
  }),
})

export const SPELL_RELEASE_FRAMES = Object.freeze({
  fireball: 6,
  lightning: 7,
  leech: 6,
  shield: 6,
  blink_vanish: 9,
  blink_appear: 0,
})

export const FIREBALL_MANA_COST = 15
export const MANA_REGEN_PER_SEC = 5
export const MANA_MAX = 100
export const LEECH_COOLDOWN_MS = 10000

/**
 * Calculates world coordinates for fireball spawn from player feet position and facing.
 *
 * @param {{ x: number, y: number }} player - Actor instance or coordinates object
 * @param {string} [facing='down'] - 'down' | 'left' | 'right' | 'up'
 * @returns {{ x: number, y: number }}
 */
export function getFireballSpawnPosition(player, facing = 'down') {
  const f = FIREBALL_SPAWN_OFFSETS[facing] || FIREBALL_SPAWN_OFFSETS.down
  return {
    x: (player?.x || 0) + f.x,
    y: (player?.y || 0) + f.y,
  }
}

/**
 * Calculates world coordinates for spell spawn from player feet position, spell id, and facing.
 *
 * @param {{ x: number, y: number }} player
 * @param {string} [spellId='lightning']
 * @param {string} [facing='down']
 * @returns {{ x: number, y: number }}
 */
export function getSpellSpawnPosition(player, spellId = 'lightning', facing = 'down') {
  const group = SPELL_SPAWN_OFFSETS[spellId] || SPELL_SPAWN_OFFSETS.lightning
  const offset = group[facing] || group.down || { x: 0, y: 0 }
  return {
    x: (player?.x || 0) + offset.x,
    y: (player?.y || 0) + offset.y,
  }
}

/**
 * Ensures all spell, projectile, and impact animations are registered in Phaser.
 *
 * @param {import('phaser').Scene} scene
 */
export function ensureSpellAnimations(scene) {
  if (!scene?.anims || typeof scene.anims.create !== 'function') return

  const createIfMissing = (config) => {
    const textureKey = config.frames?.[0]?.key
    if (textureKey && scene.textures && typeof scene.textures.exists === 'function') {
      if (!scene.textures.exists(textureKey)) {
        return
      }
    }
    if (typeof scene.anims.exists === 'function' && scene.anims.exists(config.key)) {
      const existing = typeof scene.anims.get === 'function' ? scene.anims.get(config.key) : null
      if (existing && (!existing.frames || existing.frames.length === 0)) {
        if (typeof scene.anims.remove === 'function') {
          scene.anims.remove(config.key)
        }
      } else {
        return
      }
    }
    try {
      scene.anims.create(config)
    } catch (e) {
      // Safe fallback if textures are not yet loaded in mock/test
    }
  }

  // 1. Fireball
  createIfMissing({
    key: 'fireball_fly',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'fireball', frame: `fireball_fly_${i}` })),
    frameRate: 12,
    repeat: -1,
  })
  createIfMissing({
    key: 'fireball_hit',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'fireball', frame: `fireball_hit_${i}` })),
    frameRate: 14,
    repeat: 0,
  })

  // 2. Spell FX (Lightning, Leech, Shield, Blink)
  createIfMissing({
    key: 'lightning_bolt',
    frames: Array.from({ length: 4 }, (_, i) => ({ key: 'spell_fx', frame: `lightning_bolt_${i}` })),
    frameRate: 16,
    repeat: -1,
  })
  createIfMissing({
    key: 'lightning_impact',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `lightning_impact_${i}` })),
    frameRate: 20,
    repeat: 0,
  })
  createIfMissing({
    key: 'leech_orb',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `leech_orb_${i}` })),
    frameRate: 12,
    repeat: -1,
  })
  createIfMissing({
    key: 'leech_impact',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `leech_impact_${i}` })),
    frameRate: 16,
    repeat: 0,
  })
  createIfMissing({
    key: 'leech_return',
    frames: Array.from({ length: 8 }, (_, i) => ({ key: 'spell_fx', frame: `leech_return_${i}` })),
    frameRate: 12,
    repeat: -1,
  })
  createIfMissing({
    key: 'leech_absorb',
    frames: Array.from({ length: 8 }, (_, i) => ({ key: 'spell_fx', frame: `leech_absorb_${i}` })),
    frameRate: 12,
    repeat: 0,
  })
  createIfMissing({
    key: 'shield_form',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `shield_form_${i}` })),
    frameRate: 14,
    repeat: 0,
  })
  createIfMissing({
    key: 'shield_loop',
    frames: Array.from({ length: 8 }, (_, i) => ({ key: 'spell_fx', frame: `shield_loop_${i}` })),
    frameRate: 10,
    repeat: -1,
  })
  createIfMissing({
    key: 'shield_break',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `shield_break_${i}` })),
    frameRate: 14,
    repeat: 0,
  })
  createIfMissing({
    key: 'blink_portal',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'spell_fx', frame: `blink_portal_${i}` })),
    frameRate: 14,
    repeat: 0,
  })

  // 3. Thief FX (Poison Vial & Splash)
  createIfMissing({
    key: 'thief_poison_vial',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'thief_fx', frame: `thief_fx_poison_vial_${i}` })),
    frameRate: 12,
    repeat: -1,
  })
  createIfMissing({
    key: 'thief_poison_splash',
    frames: Array.from({ length: 6 }, (_, i) => ({ key: 'thief_fx', frame: `thief_fx_poison_splash_${i}` })),
    frameRate: 14,
    repeat: 0,
  })

  registerSheetAnims(scene, 'mage_spells_v2', mageSpellsV2Atlas.meta?.anims, createIfMissing)
  registerSheetAnims(scene, 'spell_fx_v2', spellFxV2Atlas.meta?.anims, createIfMissing)
}

/**
 * Creates one Phaser animation per atlas meta entry. Keys are the sheet's own names.
 *
 * @param {import('phaser').Scene} scene
 * @param {string} textureKey
 * @param {object} anims
 * @param {(config: object) => void} createIfMissing
 */
function registerSheetAnims(scene, textureKey, anims, createIfMissing) {
  if (!anims || typeof anims !== 'object') return
  for (const [key, def] of Object.entries(anims)) {
    if (!def || !Array.isArray(def.frames) || def.frames.length === 0) continue
    createIfMissing({
      key,
      frames: def.frames.map((frame) => ({ key: textureKey, frame })),
      frameRate: def.frameRate > 0 ? def.frameRate : V2_CAST_FPS_FALLBACK,
      repeat: typeof def.repeat === 'number' ? def.repeat : 0,
    })
  }
}

/**
 * Loads the mage_spells group (mage_spells_v2 + spell_fx_v2) and registers clips.
 * Scene preload does not include this group; the mage actor asks the registry.
 *
 * @param {import('phaser').Scene} scene
 */
export function ensureMageSpellsGroup(scene) {
  const registry = scene?.assetRegistry
  if (registry && typeof registry.loadGroup === 'function') {
    const loaded = typeof registry.isGroupLoaded === 'function' && registry.isGroupLoaded('mage_spells')
    if (!loaded) {
      registry.loadGroup('mage_spells')
      watchMageSpellTextures(scene)
    }
  }
  ensureSpellAnimations(scene)
}

function watchMageSpellTextures(scene) {
  const loader = scene?.load
  if (!loader || typeof loader.on !== 'function' || scene._hvMageSpellsWatch) return
  scene._hvMageSpellsWatch = true
  const handler = (key) => {
    if (key !== 'mage_spells_v2' && key !== 'spell_fx_v2') return
    ensureSpellAnimations(scene)
  }
  loader.on('filecomplete', handler)
}

function pushProjectile(scene, proj) {
  if (proj && Array.isArray(scene?.projectiles)) {
    scene.projectiles.push(proj)
  }
  return proj
}

/**
 * Spawns the v2 bolt or orb at the player's current feet plus the locked facing offset.
 *
 * @param {import('phaser').Scene} scene
 * @param {object} player
 * @param {string} spellId
 * @param {string} facing
 * @returns {Projectile|null}
 */
function spawnV2Spell(scene, player, spellId, facing) {
  const fx = V2_FX_CLIPS[spellId]
  if (!scene || !player || !fx) return null
  const [dx, dy] = facingToVector(facing)
  const spawnPos = getSpellSpawnPosition(player, spellId, facing)
  const shared = {
    dirX: dx,
    dirY: dy,
    size: 32,
    owner: 'player',
    origin: fxFramePivot(fx.fly),
    hitOrigin: fxFramePivot(fx.hit),
    flyAnim: fx.fly,
    hitAnim: fx.hit,
    onImpact: () => {
      safeSpellImpact()
    },
  }

  const proj = spellId === 'lightning'
    ? new Projectile(scene, spawnPos.x, spawnPos.y, 'spell_fx_v2', `${fx.fly}_0`, {
      ...shared,
      speed: 600,
      maxDist: 320,
      damage: 15,
      impact: 'lightning',
    })
    : new Projectile(scene, spawnPos.x, spawnPos.y, 'spell_fx_v2', `${fx.fly}_0`, {
      ...shared,
      speed: FIREBALL_SPEED,
      maxDist: FIREBALL_DIST,
      impact: 'lifeLeech',
      special: 'lifeLeech',
      returnAnim: fx.return,
      absorbAnim: fx.absorb,
      returnOrigin: fxFramePivot(fx.return),
      absorbOrigin: fxFramePivot(fx.absorb),
      returnOffset: readLeechReturnOffset(facing),
      caster: player,
      aimImpactAtCaster: true,
    })

  return pushProjectile(scene, proj)
}

/**
 * Normalizes a facing string into direction vector components [dx, dy].
 *
 * @param {string} facing - 'down' | 'left' | 'right' | 'up'
 * @returns {[number, number]}
 */
export function facingToVector(facing) {
  switch (facing) {
    case 'left': return [-1, 0]
    case 'right': return [1, 0]
    case 'up': return [0, -1]
    case 'down':
    default:
      return [0, 1]
  }
}

/**
 * Casts a Fireball projectile from the player character.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Projectile|null}
 */
export function castFireball(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  // Mana check
  const currentMana = scene.mana ?? session.mana ?? 100
  if (currentMana < FIREBALL_MANA_COST) {
    scene._notice?.('Not enough mana.')
    return null
  }

  // Deduct mana
  scene.mana = Math.max(0, currentMana - FIREBALL_MANA_COST)
  session.mana = scene.mana
  scene._publishVitals?.(false)

  ensureSpellAnimations(scene)
  safeSpellCast()

  // Direction and spawn position from meta
  const facing = player.facing || scene.facing?.() || 'down'
  const [dx, dy] = facingToVector(facing)
  const spawnPos = getFireballSpawnPosition(player, facing)

  const proj = new Projectile(scene, spawnPos.x, spawnPos.y, 'fireball', 'fireball_fly_0', {
    dirX: dx,
    dirY: dy,
    speed: FIREBALL_SPEED,
    maxDist: FIREBALL_DIST,
    size: 32,
    owner: 'player',
    damage: 10,
    impact: 'fire',
    lingerMs: FIRE_LINGER_MS,
    lingerDps: 2,
    flyAnim: 'fireball_fly',
    hitAnim: 'fireball_hit',
    lingerAnim: 'fireball_hit',
    onImpact: () => {
      safeSpellImpact()
    },
  })

  if (Array.isArray(scene.projectiles)) {
    scene.projectiles.push(proj)
  }

  return proj
}

/**
 * Casts a Lightning Bolt projectile.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Projectile|null}
 */
export function castLightning(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  ensureMageSpellsGroup(scene)
  safeSpellCast()
  return spawnV2Spell(scene, player, 'lightning', player.facing || 'down')
}

/**
 * Arms a mage Lightning or Leech cast. The bolt or orb is not spawned yet.
 *
 * @param {import('phaser').Scene} scene
 * @param {object} player
 * @param {string} spellId
 * @param {number} [now]
 * @returns {object|null}
 */
export function armMageV2Cast(scene, player, spellId, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null
  if (spellId !== 'lightning' && spellId !== 'leech') return null
  if (player.classId && player.classId !== 'mage') return null
  if (spellId === 'leech' && now < (session.lifeLeechCooldownUntil || 0)) return null

  const facing = player.facing || 'down'
  const timing = getV2CastTiming(spellId, facing)

  const textureMissing = typeof scene.textures?.exists === 'function' && !scene.textures.exists('mage_spells_v2')
  const clip = typeof scene.anims?.get === 'function' ? scene.anims.get(timing.key) : null
  const clipNotPlayable = typeof scene.anims?.get === 'function' ? (!clip || !clip.frames || clip.frames.length === 0) : false

  if (textureMissing || clipNotPlayable) {
    scene._notice?.('Spells are still loading')
    return null
  }

  if (spellId === 'leech') {
    session.lifeLeechCooldownUntil = now + LEECH_COOLDOWN_MS
    scene._notice?.('Cast Life Leech')
  }

  ensureMageSpellsGroup(scene)
  safeSpellCast()

  const pending = {
    scene,
    spellId,
    facing,
    animKey: timing.key,
    releaseFrame: timing.releaseFrame,
    releaseMs: timing.releaseMs,
    startedAt: now,
    released: false,
    spawnedAt: null,
    projectile: null,
  }
  player._v2Cast = pending
  return pending
}

/**
 * Spawns the armed bolt or orb once the release frame (or its timestamp) is reached.
 * Earlier calls leave the scene without a new projectile.
 *
 * @param {object} player
 * @param {number} now
 * @returns {Projectile|null}
 */
export function tickMageV2Cast(player, now) {
  const pending = player?._v2Cast
  if (!pending || pending.released) return null

  const frame = player.anims?.currentFrame
  const frameName = frame?.frame?.name || frame?.textureFrame || ''
  const frameIndex = getAnimationFrameIndex(frame)
  const onClip = typeof frameName === 'string' && frameName.startsWith(`${pending.animKey}_`)
  const frameDue = onClip && frameIndex >= pending.releaseFrame
  const timeDue = now - pending.startedAt >= pending.releaseMs
  if (!frameDue && !timeDue) return null

  pending.released = true
  pending.spawnedAt = now
  const proj = spawnV2Spell(pending.scene || player.scene, player, pending.spellId, pending.facing)
  pending.projectile = proj
  return proj
}

/**
 * Casts Life Leech spell.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Projectile|null}
 */
export function castLeech(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  if (now < (session.lifeLeechCooldownUntil || 0)) {
    return null
  }

  session.lifeLeechCooldownUntil = now + LEECH_COOLDOWN_MS
  scene._notice?.('Cast Life Leech')

  ensureMageSpellsGroup(scene)
  safeSpellCast()
  return spawnV2Spell(scene, player, 'leech', player.facing || 'down')
}

/**
 * Casts Mana Shield effect.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Phaser.GameObjects.Sprite|null}
 */
export function castShield(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  ensureSpellAnimations(scene)
  safeSpellCast()
  scene._notice?.('Activated Mana Shield')

  let shieldSprite = null
  if (scene.add && typeof scene.add.sprite === 'function') {
    shieldSprite = scene.add.sprite(player.x, player.y, 'spell_fx', 'shield_form_0')
    shieldSprite.setOrigin(0.5, 0.8828) // Mage feet origin
    shieldSprite.setDepth(player.depth + 10)

    if (shieldSprite.anims && typeof shieldSprite.anims.play === 'function') {
      shieldSprite.anims.play('shield_form')
      shieldSprite.once('animationcomplete', () => {
        shieldSprite.anims.play('shield_loop')
        // Automatically break / expire shield after 6 seconds
        scene.time?.delayedCall(6000, () => {
          if (shieldSprite.active) {
            shieldSprite.anims.play('shield_break')
            shieldSprite.once('animationcomplete', () => shieldSprite.destroy())
          }
        })
      })
    }

    // Attach to player position
    const followListener = () => {
      if (!shieldSprite.active) return
      shieldSprite.setPosition(player.x, player.y)
      shieldSprite.setDepth(player.depth + 10)
    }
    scene.events?.on('postupdate', followListener)
    shieldSprite.once('destroy', () => {
      scene.events?.off('postupdate', followListener)
    })
  }

  return shieldSprite
}

/**
 * Casts Blink teleport spell.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {boolean}
 */
export function castBlink(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return false

  ensureSpellAnimations(scene)
  safeSpellCast()

  const facing = player.facing || 'down'
  const [dx, dy] = facingToVector(facing)
  const blinkDistance = 96 * (scene.unit || 1)

  // Portal at departure point
  if (scene.add && typeof scene.add.sprite === 'function') {
    const portalStart = scene.add.sprite(player.x, player.y - 16, 'spell_fx', 'blink_portal_0')
    portalStart.setDepth(player.depth)
    portalStart.anims?.play?.('blink_portal')
    portalStart.once?.('animationcomplete', () => portalStart.destroy())
  }

  // Calculate destination avoiding solid colliders
  let targetX = player.x + dx * blinkDistance
  let targetY = player.y + dy * blinkDistance

  const solids = scene._solidRects || []
  const testBox = { x: targetX - 12, y: targetY - 12, w: 24, h: 24 }
  let blocked = false
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i]
    if (
      testBox.x < s.x + s.w &&
      testBox.x + testBox.w > s.x &&
      testBox.y < s.y + s.h &&
      testBox.y + testBox.h > s.y
    ) {
      blocked = true
      break
    }
  }

  if (!blocked) {
    player.setPosition(targetX, targetY)
  }

  // Portal at destination point
  if (scene.add && typeof scene.add.sprite === 'function') {
    const portalEnd = scene.add.sprite(player.x, player.y - 16, 'spell_fx', 'blink_portal_0')
    portalEnd.setDepth(player.depth)
    portalEnd.anims?.play?.('blink_portal')
    portalEnd.once?.('animationcomplete', () => portalEnd.destroy())
  }

  scene._notice?.('Blink!')
  return true
}

/**
 * Throws a Thief Poison Vial projectile.
 *
 * @param {import('phaser').Scene} scene
 * @param {import('../actors/Player.js').Player} player
 * @param {number} [now]
 * @returns {Projectile|null}
 */
export function throwPoisonVial(scene, player, now = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
  if (!scene || !player) return null

  ensureSpellAnimations(scene)

  const facing = player.facing || scene.facing?.() || 'down'
  const [dx, dy] = facingToVector(facing)
  const spawnX = player.x + dx * 12
  const spawnY = player.y - 16 + dy * 12

  const proj = new Projectile(scene, spawnX, spawnY, 'thief_fx', 'thief_fx_poison_vial_0', {
    dirX: dx,
    dirY: dy,
    speed: 380,
    maxDist: 200,
    size: 32,
    owner: 'player',
    damage: 8,
    impact: 'poison',
    isArc: true,
    arcHeight: 28,
    bakedSpin: true,
    flyAnim: 'thief_poison_vial',
    hitAnim: 'thief_poison_splash',
    lingerAnim: 'thief_poison_splash',
    lingerMs: 2000,
    lingerDps: 5,
    onImpact: () => {
      safeSpellImpact()
    },
  })

  if (Array.isArray(scene.projectiles)) {
    scene.projectiles.push(proj)
  }

  // Consume item
  eventBus.emit(GameEvents.ITEM_CONSUMED, { id: 'poison_vial', mode: 'search' })

  return proj
}
