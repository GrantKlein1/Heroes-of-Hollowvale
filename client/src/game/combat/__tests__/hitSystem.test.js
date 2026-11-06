import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAnimationFrameIndex,
  getHitFrames,
  getHitbox,
  getWeaponTip,
  computeWorldHitbox,
  computeWorldHurtbox,
  rectIntersects,
  executePlayerMeleeHit,
} from '../hitSystem.js'

describe('Hit System (hitSystem.js)', () => {
  describe('getAnimationFrameIndex', () => {
    it('extracts index from trailing frame name suffix', () => {
      expect(getAnimationFrameIndex({ textureFrame: 'knight_attack_down_3' })).toBe(3)
      expect(getAnimationFrameIndex({ frame: { name: 'thief_attack_left_1' } })).toBe(1)
      expect(getAnimationFrameIndex({ textureFrame: 'dwarf_attack_up_0' })).toBe(0)
    })

    it('falls back to 0-based index from frame.index', () => {
      expect(getAnimationFrameIndex({ index: 4 })).toBe(3)
      expect(getAnimationFrameIndex({ index: 1 })).toBe(0)
    })

    it('returns -1 for invalid frame', () => {
      expect(getAnimationFrameIndex(null)).toBe(-1)
      expect(getAnimationFrameIndex({})).toBe(-1)
    })
  })

  describe('Atlas Metadata Resolution (getHitFrames, getHitbox, getWeaponTip)', () => {
    let mockScene

    beforeEach(() => {
      mockScene = {
        textures: {
          get: vi.fn((key) => {
            if (key === 'knight_attack') {
              return {
                customData: {
                  meta: {
                    anims: {
                      attack: {
                        hitFrames: [3],
                        hitbox: {
                          '3': {
                            down: { x: -68, y: -68, w: 56, h: 40 },
                            right: { x: 12, y: -68, w: 56, h: 40 },
                          },
                        },
                        weaponTipOffsetFromFeet: {
                          '3': {
                            down: { x: -40.4, y: -60.2 },
                            right: { x: 19.9, y: -56.7 },
                          },
                        },
                      },
                    },
                  },
                },
              }
            }
            if (key === 'thief_attack') {
              return {
                customData: {
                  meta: {
                    anims: {
                      attack: {
                        hitFrames: [1, 3],
                        hitbox: {
                          '1': { down: { x: -42, y: -29, w: 40, h: 37 } },
                          '3': { down: { x: 3, y: -29, w: 40, h: 37 } },
                        },
                      },
                    },
                  },
                },
              }
            }
            return null
          }),
        },
      }
    })

    it('reads hitFrames dynamically from sheet metadata', () => {
      expect(getHitFrames(mockScene, 'knight_attack', 'attack')).toEqual([3])
      expect(getHitFrames(mockScene, 'thief_attack', 'attack')).toEqual([1, 3])
      expect(getHitFrames(mockScene, 'unknown_sheet', 'attack')).toEqual([])
    })

    it('reads directional hitbox for active frame from metadata', () => {
      const boxDown = getHitbox(mockScene, 'knight_attack', 3, 'down', 'attack')
      expect(boxDown).toEqual({ x: -68, y: -68, w: 56, h: 40 })

      const boxRight = getHitbox(mockScene, 'knight_attack', 3, 'right', 'attack')
      expect(boxRight).toEqual({ x: 12, y: -68, w: 56, h: 40 })

      // Non-hit frame returns null
      expect(getHitbox(mockScene, 'knight_attack', 0, 'down', 'attack')).toBeNull()
    })

    it('reads weapon tip offset relative to feet pivot', () => {
      const tip = getWeaponTip(mockScene, 'knight_attack', 3, 'down', 'attack')
      expect(tip).toEqual({ x: -40.4, y: -60.2 })
    })
  })

  describe('World Space Geometry & Intersection', () => {
    it('computes world hitbox relative to attacker feet scaled by integer scale', () => {
      const attacker = {
        x: 200,
        y: 300,
        scaleX: 2,
        scaleY: 2,
        body: { bottom: 300 },
      }
      const hitboxDef = { x: 10, y: -40, w: 30, h: 20 }

      const worldBox = computeWorldHitbox(attacker, hitboxDef)
      expect(worldBox).toEqual({
        x: 200 + 10 * 2, // 220
        y: 300 + -40 * 2, // 220
        w: 30 * 2, // 60
        h: 20 * 2, // 40
      })
    })

    it('computes world hurtbox for target with meta hurtbox', () => {
      const target = {
        x: 240,
        y: 250,
        scaleX: 2,
        body: { bottom: 250 },
        hurtbox: { x: -16, y: -23, w: 31, h: 23 },
      }

      const worldHurtbox = computeWorldHurtbox(target)
      expect(worldHurtbox).toEqual({
        x: 240 + -16 * 2, // 208
        y: 250 + -23 * 2, // 204
        w: 31 * 2, // 62
        h: 23 * 2, // 46
      })
    })

    it('correctly detects intersecting and non-intersecting AABB boxes', () => {
      const boxA = { x: 100, y: 100, w: 50, h: 50 }
      const boxB = { x: 130, y: 120, w: 40, h: 40 } // overlaps
      const boxC = { x: 200, y: 200, w: 20, h: 20 } // far away

      expect(rectIntersects(boxA, boxB)).toBe(true)
      expect(rectIntersects(boxA, boxC)).toBe(false)
    })
  })

  describe('executePlayerMeleeHit', () => {
    let mockScene
    let mockPlayer
    let mockEnemy

    beforeEach(() => {
      mockEnemy = {
        active: true,
        x: 220,
        y: 220,
        scaleX: 2,
        hp: 15,
        hpMax: 15,
        body: {
          x: 210,
          y: 210,
          width: 30,
          height: 30,
          bottom: 240,
          setVelocity: vi.fn(),
        },
        hurtbox: { x: -15, y: -20, w: 30, h: 20 },
        setTintFill: vi.fn(),
        setTint: vi.fn(),
        clearTint: vi.fn(),
      }

      mockScene = {
        enemies: {
          getChildren: vi.fn(() => [mockEnemy]),
        },
        textures: {
          get: vi.fn(() => ({
            customData: {
              meta: {
                anims: {
                  attack: {
                    hitFrames: [3],
                    hitbox: {
                      '3': {
                        right: { x: 0, y: -40, w: 40, h: 40 },
                      },
                    },
                    weaponTipOffsetFromFeet: {
                      '3': {
                        right: { x: 20, y: -20 },
                      },
                    },
                  },
                },
              },
            },
          })),
        },
        time: {
          delayedCall: vi.fn((ms, cb) => cb()),
        },
        add: {
          sprite: vi.fn(() => ({
            setOrigin: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            anims: { play: vi.fn() },
            once: vi.fn(),
            destroy: vi.fn(),
          })),
        },
        _float: vi.fn(),
      }

      mockPlayer = {
        scene: mockScene,
        classId: 'knight',
        facing: 'right',
        x: 200,
        y: 240,
        scaleX: 2,
        currentSwingId: 1,
        getSheetForAnim: vi.fn(() => 'knight_attack'),
        body: {
          bottom: 240,
          velocity: { x: 0, y: 0 },
          setVelocity: vi.fn(),
        },
        anims: {
          isPlaying: true,
          pause: vi.fn(),
          resume: vi.fn(),
        },
      }
    })

    it('damages enemy within hitbox on frame 3 and triggers feedback', () => {
      // Knight base damage is 12
      const hits = executePlayerMeleeHit(mockPlayer, 3, 1000)

      expect(hits).toBe(1)
      expect(mockEnemy.hp).toBe(15 - 12) // 3 HP left
      expect(mockScene._lastFx).toBe('fx_common_hit_spark')
      expect(mockScene._float).toHaveBeenCalledWith(220, 214, '-12', '#ff6161')
    })

    it('does not re-hit enemy within 200 ms on the same swing', () => {
      executePlayerMeleeHit(mockPlayer, 3, 1000)
      expect(mockEnemy.hp).toBe(3)

      // Same swing 50 ms later
      const secondHits = executePlayerMeleeHit(mockPlayer, 3, 1050)
      expect(secondHits).toBe(0)
      expect(mockEnemy.hp).toBe(3) // Unchanged
    })

    it('ignores frame that is not a hitFrame', () => {
      const hits = executePlayerMeleeHit(mockPlayer, 0, 1000)
      expect(hits).toBe(0)
      expect(mockEnemy.hp).toBe(15) // Not damaged
    })
  })
})

