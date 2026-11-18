import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseFlags,
  getFlags,
  isQa,
  getSeed,
  isDebug,
} from '../flags.js'

describe('Runtime URL Feature Flags (flags.js)', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    globalThis.window = {
      location: {
        search: '',
      },
    }
  })

  afterEach(() => {
    globalThis.window = originalWindow
  })

  describe('renderer and maps', () => {
    it('ignores a renderer or maps query and stays on blend and tiled', () => {
      const flagged = parseFlags('?renderer=legacy&maps=legacy')
      expect(flagged.renderer).toBe('blend')
      expect(flagged.maps).toBe('tiled')

      const plain = parseFlags('')
      expect(plain.renderer).toBe('blend')
      expect(plain.maps).toBe('tiled')
    })
  })

  describe('qa flag', () => {
    it('defaults to false when ?qa is omitted', () => {
      expect(isQa('')).toBe(false)
    })

    it('returns true when ?qa=1 or ?qa=true', () => {
      expect(isQa('?qa=1')).toBe(true)
      expect(isQa('?qa=true')).toBe(true)
      expect(isQa('?qa=TRUE')).toBe(true)
    })

    it('returns false when ?qa=0 or other values', () => {
      expect(isQa('?qa=0')).toBe(false)
      expect(isQa('?qa=false')).toBe(false)
    })
  })

  describe('seed flag', () => {
    it('returns null when ?seed is omitted', () => {
      expect(getSeed('')).toBeNull()
    })

    it('parses numeric seeds', () => {
      expect(getSeed('?seed=12345')).toBe(12345)
      expect(getSeed('?seed=0')).toBe(0)
    })

    it('parses alphanumeric/string seeds', () => {
      expect(getSeed('?seed=test-seed-xyz')).toBe('test-seed-xyz')
    })
  })

  describe('debug flag', () => {
    it('defaults to false when ?debug is omitted', () => {
      expect(isDebug('')).toBe(false)
    })

    it('returns true when ?debug=1 or ?debug=true', () => {
      expect(isDebug('?debug=1')).toBe(true)
      expect(isDebug('?debug=true')).toBe(true)
    })

    it('reads ?debug=1 from window.location.search when no search is passed', () => {
      globalThis.window = { location: { search: '?debug=1' } }
      expect(isDebug()).toBe(true)
    })
  })

  describe('combined flags and getFlags()', () => {
    it('parses multiple flags in a single query string', () => {
      const flags = getFlags('?renderer=blend&maps=tiled&qa=1&seed=9999&debug=1')
      expect(flags.renderer).toBe('blend')
      expect(flags.maps).toBe('tiled')
      expect(flags.qa).toBe(true)
      expect(flags.seed).toBe(9999)
      expect(flags.debug).toBe(true)
    })
  })
})
