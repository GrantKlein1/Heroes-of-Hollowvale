/**
 * Animation key building, parsing, and frame duration formatting.
 *
 * Enforces the Hollowvale asset convention:
 * - Directional anim keys: `<asset>_<anim>_<dir>` (e.g. `knight_walk_down`, `goblin_archer_attack_right`)
 * - Non-directional anim keys: `<asset>_<anim>` (e.g. `fx_common_hit_spark`)
 * - 4 standard facings: 'down', 'left', 'right', 'up'
 */

export const CARDINAL_DIRECTIONS = ['down', 'left', 'right', 'up']
const DIRECTION_SET = new Set(CARDINAL_DIRECTIONS)

/**
 * Builds an animation key from asset id, animation name, and optional direction.
 *
 * @param {string} asset - Asset identifier (e.g. 'knight', 'goblin_archer')
 * @param {string} anim - Animation name (e.g. 'walk', 'attack', 'hit_spark')
 * @param {string} [dir] - Direction ('down', 'left', 'right', 'up')
 * @returns {string} - e.g. 'knight_walk_down' or 'fx_common_hit_spark'
 */
export function buildAnimKey(asset, anim, dir = '') {
  if (!asset || !anim) {
    throw new Error(`buildAnimKey requires asset and anim (got asset="${asset}", anim="${anim}")`)
  }
  if (dir) {
    return `${asset}_${anim}_${dir}`
  }
  return `${asset}_${anim}`
}

/**
 * Parses an animation key into its constituent parts: asset, anim, and dir.
 *
 * @param {string} key - Animation key to parse
 * @param {Iterable<string>|Array<string>} [knownAssets] - Optional set or list of known asset IDs for exact prefix matching
 * @returns {{ asset: string, anim: string, dir: string|null }}
 */
export function parseAnimKey(key, knownAssets = null) {
  if (!key || typeof key !== 'string') {
    return { asset: '', anim: '', dir: null }
  }

  let dir = null
  let remainder = key

  // Check if key ends with a cardinal direction suffix (_down, _left, _right, _up)
  for (const d of CARDINAL_DIRECTIONS) {
    const suffix = `_${d}`
    if (remainder.endsWith(suffix)) {
      dir = d
      remainder = remainder.slice(0, -suffix.length)
      break
    }
  }

  // Resolve asset and anim
  let asset = ''
  let anim = ''

  if (knownAssets) {
    const assetList = Array.from(knownAssets).sort((a, b) => b.length - a.length)
    for (const candidate of assetList) {
      if (remainder === candidate) {
        asset = candidate
        anim = ''
        break
      }
      if (remainder.startsWith(`${candidate}_`)) {
        asset = candidate
        anim = remainder.slice(candidate.length + 1)
        break
      }
    }
  }

  if (!asset) {
    const lastUnderscore = remainder.lastIndexOf('_')
    if (lastUnderscore !== -1) {
      asset = remainder.slice(0, lastUnderscore)
      anim = remainder.slice(lastUnderscore + 1)
    } else {
      asset = remainder
      anim = ''
    }
  }

  return { asset, anim, dir }
}

/**
 * Resolves a frame name template with direction and frame index.
 * Supported template tokens:
 * - `<dir>`: replaced with the direction string
 * - `<i>`: replaced with the frame index
 *
 * @param {string} template - e.g. "knight_walk_<dir>_<i>", "knight_idle_<dir>", "fx_dust_puff_<i>"
 * @param {string} [dir=''] - Direction string
 * @param {number} [index=0] - Frame index
 * @returns {string} - Resolved frame name
 */
export function buildFrameName(template, dir = '', index = 0) {
  if (!template || typeof template !== 'string') return ''
  let result = template
  if (dir) {
    result = result.replace('<dir>', dir)
  }
  if (result.includes('<i>')) {
    result = result.replace('<i>', String(index))
  }
  return result
}

/**
 * Formats and validates per-frame durations in milliseconds.
 *
 * @param {Array<number>} [durations] - Array of frame durations in ms
 * @param {number} [frameCount=0] - Expected total number of frames
 * @returns {Array<number>|null} - Array of valid numeric durations, or null if not provided
 */
export function formatFrameDurations(durations, frameCount = 0) {
  if (!Array.isArray(durations) || durations.length === 0) {
    return null
  }
  const count = frameCount > 0 ? frameCount : durations.length
  const result = []
  for (let i = 0; i < count; i++) {
    const val = durations[i]
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      result.push(val)
    } else if (result.length > 0) {
      // Fallback to previous frame duration if partially specified
      result.push(result[result.length - 1])
    } else {
      result.push(100) // Default 100ms
    }
  }
  return result
}

/**
 * Builds an array of Phaser animation frame config objects.
 * Supports per-frame durations (e.g. for archer attack variable timing).
 *
 * @param {object} options
 * @param {string} options.atlasKey - Key of the loaded texture atlas
 * @param {string} options.frameNames - Template pattern for frame names
 * @param {number} [options.frameCount=1] - Number of frames in animation
 * @param {string} [options.dir=''] - Facing direction ('down', 'left', etc.)
 * @param {Array<number>} [options.frameDurationsMs] - Optional array of per-frame durations in ms
 * @returns {Array<{ key: string, frame: string, duration?: number }>}
 */
export function buildFrameConfigs({
  atlasKey,
  frameNames,
  frameCount = 1,
  dir = '',
  frameDurationsMs = null,
}) {
  if (!atlasKey || !frameNames) {
    return []
  }
  const count = Math.max(1, Number(frameCount) || 1)
  const durations = formatFrameDurations(frameDurationsMs, count)
  const frames = []

  for (let i = 0; i < count; i++) {
    const frameName = buildFrameName(frameNames, dir, i)
    const config = {
      key: atlasKey,
      frame: frameName,
    }
    if (durations && durations[i] !== undefined) {
      config.duration = durations[i]
    }
    frames.push(config)
  }

  return frames
}
