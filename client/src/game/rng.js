/**
 * Game-wide seeded PRNG.
 *
 * Routes gameplay randomness through a deterministic mulberry32 generator
 * (backed by client/src/game/terrain/rng.js).
 * Supports `?seed=N` via URL search parameters for reproducible runs.
 */

import { createRng, hashSeed } from './terrain/rng.js'

/**
 * Parse a seed from a query search string or window.location.search.
 *
 * @param {string} [search] - Optional search string (e.g. "?seed=12345" or "seed=12345")
 * @returns {number|string|null} Parsed seed, or null if unspecified / not in browser
 */
export function parseSeedFromUrl(search) {
  let searchStr = search
  if (searchStr === undefined && typeof window !== 'undefined' && window.location) {
    searchStr = window.location.search
  }
  if (typeof searchStr === 'string' && searchStr.length > 0) {
    const clean = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr
    const params = new URLSearchParams(clean)
    const val = params.get('seed')
    if (val !== null && val.trim() !== '') {
      const trimmed = val.trim()
      const num = Number(trimmed)
      return Number.isFinite(num) ? num : trimmed
    }
  }
  return null
}

/**
 * Resolves the initial seed:
 * Uses `?seed=N` if present, otherwise falls back to a timestamp/random seed.
 *
 * @param {string} [search]
 * @returns {number|string}
 */
export function getInitialSeed(search) {
  const parsed = parseSeedFromUrl(search)
  if (parsed !== null) return parsed
  return ((Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0)
}

let activeSeed = getInitialSeed()
let activeRng = createRng(activeSeed)

/**
 * Set or reset the active seed and PRNG state.
 * @param {number|string} seed
 * @returns {import('./terrain/rng.js').Rng}
 */
export function setSeed(seed) {
  activeSeed = seed
  activeRng = createRng(seed)
  return activeRng
}

/**
 * Returns the currently active seed.
 * @returns {number|string}
 */
export function getSeed() {
  return activeSeed
}

/**
 * Sync active seed from the given search string or window.location.search.
 * If a valid seed is present, sets it; returns the active seed.
 * @param {string} [search]
 * @returns {number|string}
 */
export function syncSeedFromUrl(search) {
  const parsed = parseSeedFromUrl(search)
  if (parsed !== null) {
    setSeed(parsed)
    return parsed
  }
  return activeSeed
}

/**
 * Returns the active Rng instance.
 * @returns {import('./terrain/rng.js').Rng}
 */
export function getRng() {
  return activeRng
}

/**
 * Returns a pseudorandom number in [0, 1). Drop-in replacement for Math.random().
 * @returns {number}
 */
export function random() {
  return activeRng.next()
}

/**
 * Generates next float in [0, 1).
 * @returns {number}
 */
export function next() {
  return activeRng.next()
}

/**
 * Returns a random integer in [min, max] inclusive.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function int(min, max) {
  return activeRng.int(min, max)
}

/**
 * Picks a random item from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function pick(arr) {
  return activeRng.pick(arr)
}

/**
 * Picks an item based on item.weight.
 * @template T
 * @param {T[]} items
 * @returns {T}
 */
export function weighted(items) {
  return activeRng.weighted(items)
}

export { createRng, hashSeed }

export const rng = {
  next,
  random,
  int,
  pick,
  weighted,
  setSeed,
  getSeed,
  syncSeedFromUrl,
  getRng,
  createRng,
  hashSeed,
  parseSeedFromUrl,
  getInitialSeed,
}

export default rng
