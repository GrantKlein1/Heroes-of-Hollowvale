/**
 * Game configuration and runtime URL feature flag parser.
 *
 * Supported flags:
 * - renderer: 'blend' (default) | 'legacy' (`?renderer=legacy`)
 * - maps: 'tiled' (default) | 'legacy' (`?maps=legacy`) | other string
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
 *   renderer: 'blend' | 'legacy',
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

  const rendererParam = params.get('renderer')
  const rawRenderer = rendererParam?.trim()?.toLowerCase()
  // No renderer param → blend. Explicit blend stays blend. `?renderer=legacy`
  // and any other explicit value stay on the painted renderer.
  const renderer = rendererParam === null || rawRenderer === 'blend' ? 'blend' : 'legacy'

  const mapsParam = params.get('maps')
  const rawMaps = mapsParam?.trim() || null
  // No maps param → tiled. `?maps=legacy` (or any other explicit value) opts out.
  const maps = mapsParam === null ? 'tiled' : rawMaps

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
 * Returns the active renderer: 'blend' (default) or 'legacy'.
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
 * Returns the active maps flag. Defaults to 'tiled' when the param is absent.
 * An explicit empty value stays null so only a real mode string opts out.
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
