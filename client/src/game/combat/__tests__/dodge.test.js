import { describe, it, expect } from 'vitest'
import {
  DODGE_COOLDOWN_MS,
  DEFAULT_DODGE_META,
  MAGE_DODGE_META,
  getDodgeMeta,
  isDodgeInvulnerable,
  getFacingDisplacement,
} from '../dodge.js'

describe('Dodge Mechanics (Package 1-6)', () => {
  it('defines standard 600 ms cooldown', () => {
    expect(DODGE_COOLDOWN_MS).toBe(600)
  })

  it('provides default metadata for knight, thief, and dwarf ([1, 4] i-frames, 48px travel)', () => {
    expect(DEFAULT_DODGE_META.iFrames).toEqual([1, 4])
    expect(DEFAULT_DODGE_META.travelPx).toBe(48)
    expect(DEFAULT_DODGE_META.travelPerFrame).toEqual([0, 7.2, 21.6, 36, 45.6, 48])
    expect(DEFAULT_DODGE_META.iFramesMs).toEqual([62, 312])
  })

  it('provides specialized metadata for mage ([1, 3] i-frames, 40px travel)', () => {
    expect(MAGE_DODGE_META.iFrames).toEqual([1, 3])
    expect(MAGE_DODGE_META.travelPx).toBe(40)
    expect(MAGE_DODGE_META.travelPerFrame).toEqual([0, 6, 18, 30, 38, 40])
    expect(MAGE_DODGE_META.iFramesMs).toEqual([62, 250])
  })

  it('retrieves dodge metadata from scene texture or class defaults', () => {
    const metaKnight = getDodgeMeta(null, null, 'knight')
    expect(metaKnight.travelPx).toBe(48)

    const metaMage = getDodgeMeta(null, null, 'mage')
    expect(metaMage.travelPx).toBe(40)
    expect(metaMage.iFrames).toEqual([1, 3])

    // With scene texture customData
    const mockScene = {
      textures: {
        get: (key) => ({
          customData: {
            meta: {
              anims: {
                dodge: {
                  iFrames: [2, 5],
                  travelPx: 50,
                },
              },
            },
          },
        }),
      },
    }
    const custom = getDodgeMeta(mockScene, 'custom_dodge', 'knight')
    expect(custom.iFrames).toEqual([2, 5])
    expect(custom.travelPx).toBe(50)
  })

  describe('isDodgeInvulnerable', () => {
    it('returns false if dodgeState is inactive', () => {
      expect(isDodgeInvulnerable(null, 2)).toBe(false)
      expect(isDodgeInvulnerable({ active: false }, 2)).toBe(false)
    })

    it('accurately evaluates frame index against iFrames range [1, 4]', () => {
      const state = { active: true, meta: DEFAULT_DODGE_META }
      expect(isDodgeInvulnerable(state, 0)).toBe(false)
      expect(isDodgeInvulnerable(state, 1)).toBe(true)
      expect(isDodgeInvulnerable(state, 2)).toBe(true)
      expect(isDodgeInvulnerable(state, 3)).toBe(true)
      expect(isDodgeInvulnerable(state, 4)).toBe(true)
      expect(isDodgeInvulnerable(state, 5)).toBe(false)
    })

    it('accurately evaluates frame index against Mage iFrames range [1, 3]', () => {
      const state = { active: true, meta: MAGE_DODGE_META }
      expect(isDodgeInvulnerable(state, 0)).toBe(false)
      expect(isDodgeInvulnerable(state, 1)).toBe(true)
      expect(isDodgeInvulnerable(state, 2)).toBe(true)
      expect(isDodgeInvulnerable(state, 3)).toBe(true)
      expect(isDodgeInvulnerable(state, 4)).toBe(false)
    })

    it('evaluates elapsed time when frameIndex is not available', () => {
      const state = { active: true, startTime: 1000, meta: DEFAULT_DODGE_META }
      // Before iFramesMs (t < 1062)
      expect(isDodgeInvulnerable(state, -1, 1050)).toBe(false)
      // Inside iFramesMs (1062 <= t <= 1312)
      expect(isDodgeInvulnerable(state, -1, 1100)).toBe(true)
      expect(isDodgeInvulnerable(state, -1, 1312)).toBe(true)
      // After iFramesMs (t > 1312)
      expect(isDodgeInvulnerable(state, -1, 1320)).toBe(false)
    })
  })

  describe('getFacingDisplacement', () => {
    it('calculates cardinal displacements correctly', () => {
      expect(getFacingDisplacement('right', 10)).toEqual({ dx: 10, dy: 0 })
      expect(getFacingDisplacement('left', 10)).toEqual({ dx: -10, dy: 0 })
      expect(getFacingDisplacement('up', 10)).toEqual({ dx: 0, dy: -10 })
      expect(getFacingDisplacement('down', 10)).toEqual({ dx: 0, dy: 10 })
    })
  })
})

