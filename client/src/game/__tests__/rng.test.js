import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  rng,
  random,
  next,
  int,
  pick,
  weighted,
  setSeed,
  getSeed,
  getRng,
  parseSeedFromUrl,
  getInitialSeed,
  syncSeedFromUrl,
  createRng,
  hashSeed,
} from '../rng.js'
import fs from 'node:fs'
import path from 'node:path'

describe('Seeded Random Number Generator (rng.js)', () => {
  beforeEach(() => {
    setSeed(1337)
  })

  describe('Determinism & Differentiation', () => {
    it('produces identical sequences given the same numeric seed', () => {
      setSeed(42)
      const seq1 = Array.from({ length: 10 }, () => random())

      setSeed(42)
      const seq2 = Array.from({ length: 10 }, () => random())

      expect(seq1).toEqual(seq2)
    })

    it('produces different sequences given different numeric seeds', () => {
      setSeed(42)
      const seq1 = Array.from({ length: 10 }, () => random())

      setSeed(99)
      const seq2 = Array.from({ length: 10 }, () => random())

      expect(seq1).not.toEqual(seq2)
    })

    it('produces identical sequences given the same string seed', () => {
      setSeed('hollowvale-canon')
      const seq1 = Array.from({ length: 10 }, () => random())

      setSeed('hollowvale-canon')
      const seq2 = Array.from({ length: 10 }, () => random())

      expect(seq1).toEqual(seq2)
    })

    it('produces different sequences given different string seeds', () => {
      setSeed('dragon-phase-1')
      const seq1 = Array.from({ length: 10 }, () => random())

      setSeed('dragon-phase-2')
      const seq2 = Array.from({ length: 10 }, () => random())

      expect(seq1).not.toEqual(seq2)
    })

    it('generates values strictly in [0, 1)', () => {
      setSeed(12345)
      for (let i = 0; i < 100; i++) {
        const val = random()
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(1)
      }
    })
  })

  describe('Convenience Functions (int, pick, weighted)', () => {
    it('generates integers within [min, max] inclusive and deterministically', () => {
      setSeed(777)
      const r1 = Array.from({ length: 20 }, () => int(5, 10))

      setSeed(777)
      const r2 = Array.from({ length: 20 }, () => int(5, 10))

      expect(r1).toEqual(r2)
      for (const val of r1) {
        expect(Number.isInteger(val)).toBe(true)
        expect(val).toBeGreaterThanOrEqual(5)
        expect(val).toBeLessThanOrEqual(10)
      }
    })

    it('picks elements deterministically from an array', () => {
      const items = ['sword', 'shield', 'potion', 'gem']
      setSeed(2026)
      const picked1 = Array.from({ length: 10 }, () => pick(items))

      setSeed(2026)
      const picked2 = Array.from({ length: 10 }, () => pick(items))

      expect(picked1).toEqual(picked2)
      expect(picked1.every((item) => items.includes(item))).toBe(true)
    })

    it('throws error when pick is called with empty array', () => {
      expect(() => pick([])).toThrow('empty array')
    })

    it('selects weighted elements deterministically', () => {
      const pool = [
        { id: 'common', weight: 80 },
        { id: 'rare', weight: 19 },
        { id: 'legendary', weight: 1 },
      ]
      setSeed(999)
      const choices1 = Array.from({ length: 20 }, () => weighted(pool).id)

      setSeed(999)
      const choices2 = Array.from({ length: 20 }, () => weighted(pool).id)

      expect(choices1).toEqual(choices2)
      expect(choices1.includes('common')).toBe(true)
    })
  })

  describe('createRng Instance & Exports', () => {
    it('exports createRng which creates isolated deterministic RNG instances', () => {
      const rngA = createRng(100)
      const rngB = createRng(100)
      const rngC = createRng(200)

      const seqA = [rngA.next(), rngA.next(), rngA.next()]
      const seqB = [rngB.next(), rngB.next(), rngB.next()]
      const seqC = [rngC.next(), rngC.next(), rngC.next()]

      expect(seqA).toEqual(seqB)
      expect(seqA).not.toEqual(seqC)
    })

    it('exposes default and named exports matching identical interface', () => {
      expect(rng.random).toBe(random)
      expect(rng.next).toBe(next)
      expect(rng.int).toBe(int)
      expect(rng.pick).toBe(pick)
      expect(rng.weighted).toBe(weighted)
      expect(rng.setSeed).toBe(setSeed)
      expect(rng.getSeed).toBe(getSeed)
      expect(rng.createRng).toBe(createRng)
      expect(rng.hashSeed).toBe(hashSeed)
    })
  })

  describe('URL Parameter Parsing (?seed=N)', () => {
    it('parses positive numeric seed', () => {
      expect(parseSeedFromUrl('?seed=42')).toBe(42)
      expect(parseSeedFromUrl('seed=42')).toBe(42)
    })

    it('parses seed 0 correctly', () => {
      expect(parseSeedFromUrl('?seed=0')).toBe(0)
    })

    it('parses negative numeric seed', () => {
      expect(parseSeedFromUrl('?seed=-15')).toBe(-15)
    })

    it('parses alphanumeric/string seeds', () => {
      expect(parseSeedFromUrl('?seed=alpha-beta-123')).toBe('alpha-beta-123')
    })

    it('parses seed among multiple query parameters', () => {
      expect(parseSeedFromUrl('?renderer=blend&seed=8888&debug=1')).toBe(8888)
    })

    it('returns null when seed parameter is missing', () => {
      expect(parseSeedFromUrl('?renderer=blend&debug=1')).toBeNull()
      expect(parseSeedFromUrl('')).toBeNull()
      expect(parseSeedFromUrl('?')).toBeNull()
    })

    it('returns null when seed parameter is empty', () => {
      expect(parseSeedFromUrl('?seed=')).toBeNull()
      expect(parseSeedFromUrl('?seed=   ')).toBeNull()
    })

    describe('window.location integration', () => {
      const originalWindow = globalThis.window

      afterEach(() => {
        globalThis.window = originalWindow
      })

      it('reads window.location.search when search parameter is omitted', () => {
        globalThis.window = {
          location: {
            search: '?seed=54321',
          },
        }

        expect(parseSeedFromUrl()).toBe(54321)
      })

      it('falls back gracefully when window is undefined', () => {
        delete globalThis.window
        expect(parseSeedFromUrl()).toBeNull()
      })
    })

    it('getInitialSeed honors parsed seed when available', () => {
      expect(getInitialSeed('?seed=123')).toBe(123)
    })

    it('getInitialSeed provides a valid numeric fallback when seed is absent', () => {
      const fallback = getInitialSeed('')
      expect(typeof fallback).toBe('number')
      expect(Number.isFinite(fallback)).toBe(true)
    })

    it('syncSeedFromUrl updates active seed when valid query string is passed', () => {
      syncSeedFromUrl('?seed=9876')
      expect(getSeed()).toBe(9876)

      const seq1 = Array.from({ length: 5 }, () => random())
      setSeed(9876)
      const seq2 = Array.from({ length: 5 }, () => random())
      expect(seq1).toEqual(seq2)
    })
  })

  describe('Verification: native random containment in client/src/game', () => {
    it('ensures no other game module calls the unseeded native random method', () => {
      const gameDir = path.resolve(__dirname, '..')
      const targetToken = ['Math', 'random'].join('.')

      function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        const matches = []

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '__tests__') {
              matches.push(...scanDir(fullPath))
            }
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            const relPath = path.relative(gameDir, fullPath).replace(/\\/g, '/')
            // client/src/game/rng.js is the only file allowed to contain the target token
            if (relPath !== 'rng.js') {
              const content = fs.readFileSync(fullPath, 'utf8')
              if (content.includes(targetToken)) {
                matches.push(relPath)
              }
            }
          }
        }
        return matches
      }

      const filesWithNativeRandom = scanDir(gameDir)
      expect(filesWithNativeRandom).toEqual([])
    })
  })
})
