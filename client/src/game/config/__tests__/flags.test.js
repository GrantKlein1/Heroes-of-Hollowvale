import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseFlags,
  getFlags,
  getRenderer,
  isBlendRenderer,
  getMaps,
  isTiledMaps,
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

  describe('renderer flag', () => {
    it('defaults to "legacy" when no search parameters are given', () => {
      const flags = parseFlags('')
      expect(flags.renderer).toBe('legacy')
      expect(getRenderer('')).toBe('legacy')
      expect(isBlendRenderer('')).toBe(false)
    })

    it('reads "?renderer=blend" and returns "blend"', () => {
      const flags = parseFlags('?renderer=blend')
      expect(flags.renderer).toBe('blend')
      expect(getRenderer('?renderer=blend')).toBe('blend')
      expect(isBlendRenderer('?renderer=blend')).toBe(true)
    })

    it('handles query strings without leading "?"', () => {
      expect(getRenderer('renderer=blend')).toBe('blend')
      expect(isBlendRenderer('renderer=blend')).toBe(true)
    })

    it('handles case-insensitivity and whitespace for blend', () => {
      expect(getRenderer('?renderer=BLEND')).toBe('blend')
      expect(getRenderer('?renderer=%20blend%20')).toBe('blend')
    })

    it('explicitly returns "legacy" when ?renderer=legacy', () => {
      const flags = parseFlags('?renderer=legacy')
      expect(flags.renderer).toBe('legacy')
      expect(getRenderer('?renderer=legacy')).toBe('legacy')
      expect(isBlendRenderer('?renderer=legacy')).toBe(false)
    })

    it('falls back to "legacy" for any unrecognized renderer value', () => {
      expect(getRenderer('?renderer=threejs')).toBe('legacy')
      expect(getRenderer('?renderer=canvas')).toBe('legacy')
      expect(getRenderer('?renderer=')).toBe('legacy')
    })

    it('reads renderer from window.location.search when search parameter is omitted', () => {
      globalThis.window = { location: { search: '?renderer=blend' } }
      expect(getRenderer()).toBe('blend')
      expect(isBlendRenderer()).toBe(true)

      globalThis.window = { location: { search: '?renderer=legacy' } }
      expect(getRenderer()).toBe('legacy')
      expect(isBlendRenderer()).toBe(false)

      globalThis.window = { location: { search: '' } }
      expect(getRenderer()).toBe('legacy')
      expect(isBlendRenderer()).toBe(false)
    })

    it('falls back gracefully when window is undefined', () => {
      delete globalThis.window
      expect(getRenderer()).toBe('legacy')
      expect(isBlendRenderer()).toBe(false)
    })
  })

  describe('maps flag', () => {
    it('returns null when ?maps is not provided', () => {
      expect(getMaps('')).toBeNull()
      expect(isTiledMaps('')).toBe(false)
    })

    it('reads ?maps=tiled correctly', () => {
      expect(getMaps('?maps=tiled')).toBe('tiled')
      expect(isTiledMaps('?maps=tiled')).toBe(true)
    })

    it('preserves other custom map modes', () => {
      expect(getMaps('?maps=custom')).toBe('custom')
      expect(isTiledMaps('?maps=custom')).toBe(false)
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
