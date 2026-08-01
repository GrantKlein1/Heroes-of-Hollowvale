/**
 * Seeded PRNG contract — Phase 0 stub.
 *
 * Track B replaces this with a real mulberry32 implementation.
 *
 * @typedef {{
 *   next: () => number,
 *   int: (min: number, max: number) => number,
 *   pick: <T>(arr: T[]) => T,
 *   weighted: <T extends { weight?: number }>(items: T[]) => T
 * }} Rng
 */

/**
 * Hash a string into a uint32 seed.
 * @param {string} str
 * @returns {number}
 */
export function hashSeed(str) {
  let h = 2166136261 >>> 0
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Create a deterministic RNG from a seed (mulberry32).
 * @param {number|string} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let state = typeof seed === 'number' ? (seed >>> 0) : hashSeed(String(seed))
  if (state === 0) state = 1

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int(min, max) {
      const lo = Math.ceil(min)
      const hi = Math.floor(max)
      return lo + Math.floor(next() * (hi - lo + 1))
    },
    pick(arr) {
      if (!arr || !arr.length) throw new Error('createRng.pick: empty array')
      return arr[Math.floor(next() * arr.length)]
    },
    weighted(items) {
      if (!items || !items.length) throw new Error('createRng.weighted: empty array')
      const total = items.reduce((s, it) => s + (Number(it.weight) || 1), 0)
      let r = next() * total
      for (const it of items) {
        r -= Number(it.weight) || 1
        if (r <= 0) return it
      }
      return items[items.length - 1]
    },
  }
}
