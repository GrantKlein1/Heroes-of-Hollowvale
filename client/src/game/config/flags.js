/**
 * Game configuration and runtime URL feature flag parser.
 *
 * Supported flags:
 * - renderer: 'legacy' (default) | 'blend'
 * - maps: 'legacy' | 'tiled' | string | null
 * - qa: boolean (true when ?qa=1 or ?qa=true)
 * - seed: number | string | null
 * - debug: boolean (true when ?debug=1 or ?debug=true)
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
 *   renderer: 'legacy' | 'blend',
 *   maps: string | null,
 *   qa: boolean,
 *   seed: number | string | null,
 *   debug: boolean,
 *   raw: URLSearchParams
 * }}
 */
export function parseFlags(search) {
  const searchStr = resolveSearchString(search)
  const params = new URLSearchParams(searchStr)

  const rawRenderer = params.get('renderer')?.trim()?.toLowerCase()
  const renderer = rawRenderer === 'blend' ? 'blend' : 'legacy'

  const rawMaps = params.get('maps')?.trim() || null
  const maps = rawMaps

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
 * Returns the active renderer: 'blend' or 'legacy' (default).
 *
 * @param {string} [search]
 * @returns {'blend' | 'legacy'}
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
 * Returns the active maps flag (e.g. 'tiled') or null if unset.
 *
 * @param {string} [search]
 * @returns {string | null}
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
