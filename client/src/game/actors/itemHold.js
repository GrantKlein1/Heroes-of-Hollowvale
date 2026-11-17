/**
 * Item Hold & Use Pure Logic (Package IT-1)
 *
 * Centralizes consumable hold and use clip resolution, timing constants,
 * and anchor lookup for hero item sprites.
 * Pure module with zero Phaser dependency.
 */

import { CONSUMABLE, CONSUMABLE_EFFECTS } from '../combat/balance.js'

export const EFFECT_MS = 625
export const USE_MS = 1000

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
 * Resolves the currently equipped consumable item ID from session.
 * Returns null if no consumable is equipped or if mage is holding a spellbook.
 *
 * @param {object} session
 * @returns {string|null}
 */
export function getHeldItemId(session) {
  if (!session) return null
  const equipped = session.equippedId
  const cls = session.classId || session.heroClass || session.characterClass
  if (cls === 'mage' && equipped === 'spellbook') return null
  if (equipped && CONSUMABLE.has(equipped)) return equipped
  return null
}

/**
 * Returns the appropriate hold clip based on movement.
 *
 * @param {boolean} moving - True if walking or running
 * @returns {'hold_run' | 'hold_idle'}
 */
export function holdClipFor(moving) {
  return moving ? 'hold_run' : 'hold_idle'
}

/**
 * Returns the animation clip for using the given consumable item.
 *
 * @param {string} itemId
 * @returns {'use_drink' | 'use_eat' | null}
 */
export function useClipFor(itemId) {
  return CONSUMABLE_EFFECTS[itemId]?.clip || null
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
