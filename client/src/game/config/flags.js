/**
 * Game configuration and runtime URL feature flag parser.
 *
 * Supported flags:
 * - renderer: always 'blend'. Package 3-4 removed the painted renderer.
 * - maps: always 'tiled'. Package 3-4 removed the maps opt-out.
 * - qa: boolean (true when ?qa=1 or ?qa=true)
 * - seed: number | string | null
 * - debug: boolean (true when ?debug=1 or ?debug=true)
 *
 * Follow-up: getRenderer, isBlendRenderer, getMaps, and isTiledMaps are
 * constant-returning so existing imports (Player.js) keep working. Delete
 * them once those call sites stop branching.
 */

/**
 * Resolves the query search string.
 *
 * @param {string} [search]
 * @returns {string}
 */
function resolveSearchString(search) {
  if (typeof search === 'string') {
    return search.startsWith('?') ? search.slice(1) : search
  }
  if (typeof window !== 'undefined' && window.location && typeof window.location.search === 'string') {
    const s = window.location.search
    return s.startsWith('?') ? s.slice(1) : s
  }
  return ''
}

/**
 * Parses all standard URL query flags from a search string or window.location.search.
 *
 * @param {string} [search]
 * @returns {{
 *   renderer: 'blend',
 *   maps: 'tiled',
 *   qa: boolean,
 *   seed: number | string | null,
 *   debug: boolean,
 *   raw: URLSearchParams
 * }}
 */
export function parseFlags(search) {
  const searchStr = resolveSearchString(search)
  const params = new URLSearchParams(searchStr)

  // Painted renderer and the maps opt-out were removed in package 3-4.
  // Any renderer or maps query value is ignored.
  const renderer = 'blend'
  const maps = 'tiled'

  const rawQa = params.get('qa')?.trim()?.toLowerCase()
  const qa = rawQa === '1' || rawQa === 'true'

  const rawSeed = params.get('seed')
  let seed = null
  if (rawSeed !== null && rawSeed.trim() !== '') {
    const trimmed = rawSeed.trim()
    const num = Number(trimmed)
    seed = Number.isFinite(num) ? num : trimmed
  }

  const rawDebug = params.get('debug')?.trim()?.toLowerCase()
  const debug = rawDebug === '1' || rawDebug === 'true'

  return {
    renderer,
    maps,
    qa,
    seed,
    debug,
    raw: params,
  }
}

/**
 * Convenience accessor for parsed flags.
 *
 * @param {string} [search]
 * @returns {ReturnType<typeof parseFlags>}
 */
export function getFlags(search) {
  return parseFlags(search)
}

/**
 * Returns the active renderer. Always 'blend' after package 3-4.
 *
 * @param {string} [search]
 * @returns {'blend'}
 */
export function getRenderer(search) {
  return parseFlags(search).renderer
}

/**
 * Returns true if the blend renderer is enabled.
 *
 * @param {string} [search]
 * @returns {boolean}
 */
export function isBlendRenderer(search) {
  return getRenderer(search) === 'blend'
}

/**
 * Returns the active maps flag. Always 'tiled' after package 3-4.
 *
 * @param {string} [search]
 * @returns {'tiled'}
 */
export function getMaps(search) {
  return parseFlags(search).maps
}

/**
 * Returns true if Tiled maps mode is enabled.
 *
 * @param {string} [search]
 * @returns {boolean}
 */
export function isTiledMaps(search) {
  return getMaps(search) === 'tiled'
}

/**
 * Returns true if QA mode is enabled.
 *
 * @param {string} [search]
 * @returns {boolean}
 */
export function isQa(search) {
  return parseFlags(search).qa
}

/**
 * Returns the parsed seed, or null if unset.
 *
 * @param {string} [search]
 * @returns {number | string | null}
 */
export function getSeed(search) {
  return parseFlags(search).seed
}

/**
 * Returns true if debug mode is enabled.
 *
 * @param {string} [search]
 * @returns {boolean}
 */
export function isDebug(search) {
  return parseFlags(search).debug
}
