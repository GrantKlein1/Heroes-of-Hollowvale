/**
 * Map layer depth constants and feet-anchored Y-sorting utilities.
 * Follows 32px orthographic top-down convention (ASSET_SPEC.md §Tiles).
 */

/** Canonical layer names required for Tiled .tmj maps */
export const MAP_LAYERS = Object.freeze([
  'ground',
  'ground_detail',
  'walls',
  'props',
  'collision',
  'zones',
  'overhead',
])

/** Static base depths for standard map layers */
export const LAYER_DEPTHS = Object.freeze({
  ground: 0,
  ground_detail: 10,
  walls: 20,
  props: 100,
  overhead: 30000,
  collision: 40000,
  zones: 40001,
})

/**
 * Returns default depth for a named layer.
 * @param {string} layerName
 * @returns {number}
 */
export function getLayerDepth(layerName) {
  return LAYER_DEPTHS[layerName] ?? 0
}

/**
 * Calculates depth for dynamic actors or props based on feet Y coordinate.
 * Standard Phaser top-down convention: depth = feetY (+ optional bias).
 *
 * @param {number} feetY - World Y coordinate of the entity's feet/base
 * @param {number} [offset=0] - Additional depth bias
 * @returns {number}
 */
export function calculateDepth(feetY, offset = 0) {
  return Math.round(Number(feetY) || 0) + (Number(offset) || 0)
}

/**
 * Resolves feet Y for a prop or entity object.
 *
 * @param {{ feetY?: number, y?: number, height?: number, h?: number }} obj
 * @returns {number}
 */
export function resolveFeetY(obj) {
  if (!obj) return 0
  if (typeof obj.feetY === 'number') return obj.feetY
  const y = obj.y ?? 0
  const h = obj.height ?? obj.h ?? 0
  return y + h
}

/**
 * Applies depth to a display object or Phaser GameObject.
 *
 * @param {object} gameObject
 * @param {number} feetY
 * @param {number} [offset=0]
 * @returns {number}
 */
export function applyDepth(gameObject, feetY, offset = 0) {
  const depth = calculateDepth(feetY, offset)
  if (gameObject) {
    if (typeof gameObject.setDepth === 'function') {
      gameObject.setDepth(depth)
    } else {
      gameObject.depth = depth
    }
  }
  return depth
}

/**
 * Comparator for sorting entities or props by their feet Y coordinate (ascending).
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareFeetY(a, b) {
  return resolveFeetY(a) - resolveFeetY(b)
}

/**
 * Returns a new array of items sorted by feet Y coordinate.
 *
 * @template T
 * @param {T[]} items
 * @returns {T[]}
 */
export function sortByFeet(items) {
  if (!Array.isArray(items)) return []
  return [...items].sort(compareFeetY)
}
