/**
 * Item Hold & Use Pure Logic (Package IT-1)
 *
 * Centralizes consumable hold and use clip resolution, timing constants,
 * and anchor lookup for hero item sprites.
 * Pure module with zero Phaser dependency.
 */

import {
  getItem,
  consumableEffect,
  holdClipsFor,
  inhandFor,
  itemUsableBy,
  useClipNames,
} from '../items/registry.js'

export const EFFECT_MS = 625
export const USE_MS = 1000

/**
 * Atlas key for an equipped or in-use item sprite (from the item registry:
 * items_inhand, items_inhand_b10 or items_inhand_b11).
 *
 * @param {string|null|undefined} itemId
 * @returns {string}
 */
export function inhandAtlasKey(itemId) {
  return inhandFor(itemId).atlas
}

/**
 * Normalised grip origin of an item's in-hand cell. Existing items keep the
 * 12/24, 15.61/24 origin; Batch 11 items carry their own pivot.
 *
 * @param {string|null|undefined} itemId
 * @returns {readonly [number, number]}
 */
export function inhandOriginFor(itemId) {
  return inhandFor(itemId).origin
}

const anchorModules = import.meta.glob('../assets/itemAnchors/*.json', { eager: true })
const anchorFramesByHeroClip = new Map()

for (const [filePath, mod] of Object.entries(anchorModules)) {
  const filename = filePath.split('/').pop() || ''
  const match = filename.match(/^([a-z]+)_([a-z_]+)_anchors\.json$/)
  const data = mod.default || mod
  if (match && data) {
    const heroKey = match[1]
    const clipKey = match[2]
    anchorFramesByHeroClip.set(`${heroKey}_${clipKey}`, data.frames || {})
  }
}

/**
 * Resolves the currently equipped item that has a hold clip (consumables and
 * the Batch 11 weapons) from session.
 * Returns null if nothing holdable is equipped, the hero cannot hold it, or
 * if mage is holding a spellbook.
 *
 * @param {object} session
 * @returns {string|null}
 */
export function getHeldItemId(session) {
  if (!session) return null
  const equipped = session.equippedId
  const cls = session.classId || session.heroClass || session.characterClass
  if (cls === 'mage' && equipped === 'spellbook') return null
  if (!equipped) return null
  const item = getItem(equipped)
  if (!item?.hold || !itemUsableBy(equipped, cls)) return null
  if (item.kind === 'consumable' && !consumableEffect(equipped)) return null
  return equipped
}

/**
 * Returns the appropriate hold clip based on movement. With an item and hero
 * it resolves the registry's per-hero clip (the dwarf charm uses its own
 * `charm_hold_*` sheets); without them it is `hold_idle` / `hold_run`.
 *
 * @param {boolean} moving - True if walking or running
 * @param {string|null} [itemId]
 * @param {string} [classId]
 * @returns {string}
 */
export function holdClipFor(moving, itemId = null, classId = undefined) {
  const clips = itemId ? holdClipsFor(itemId, classId) : null
  if (clips) return moving ? clips.run : clips.idle
  return moving ? 'hold_run' : 'hold_idle'
}

/**
 * Frame-name stem of a clip. A republished clip (`charm_hold_idle`) keeps the
 * frame names of the clip it copies (`<hero>_hold_idle_<dir>_<i>`).
 *
 * @param {string} clip
 * @returns {string}
 */
export function clipFrameStem(clip) {
  return clip.startsWith('charm_') ? clip.slice('charm_'.length) : clip
}

/**
 * Returns the animation clip for using the given consumable item.
 *
 * @param {string} itemId
 * @returns {string|null} e.g. 'use_drink', 'use_eat', 'use_charm'
 */
export function useClipFor(itemId) {
  return consumableEffect(itemId)?.clip || null
}

/**
 * Glow overlay clip drawn above the hero while the item is used (healing charm).
 *
 * @param {string} itemId
 * @returns {string|null}
 */
export function useGlowClipFor(itemId) {
  return getItem(itemId)?.use?.glow || null
}

/**
 * True when an animation key is one of the registry's item-use clips.
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isItemUseAnimKey(key) {
  if (!key) return false
  for (const clip of useClipNames()) if (key.includes(clip)) return true
  return false
}

/**
 * Looks up the item hand anchor for a hero, clip, and frame name.
 *
 * @param {string} hero - 'knight' | 'mage' | 'thief' | 'dwarf'
 * @param {string} clip - 'hold_idle' | 'hold_run' | 'use_drink' | 'use_eat' | 'use_throw' | 'use_lockpick' | 'use_pickaxe'
 * @param {string} [frameName] - Specific frame name (e.g. 'knight_hold_idle_down_0')
 * @returns {{ x: number, y: number, rotation: number, layer: 'front'|'behind'|'none' } | object | null}
 */
export function getItemAnchor(hero, clip, frameName) {
  const frames = anchorFramesByHeroClip.get(`${hero}_${clip}`)
  if (!frames) return null
  if (!frameName) return frames
  return frames[frameName] || frames[`${frameName}_0`] || null
}
