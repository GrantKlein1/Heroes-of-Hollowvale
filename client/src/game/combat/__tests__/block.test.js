import { describe, it, expect } from 'vitest'
import {
  BLOCK_DAMAGE_REDUCTION,
  BLOCK_ARC_DEG,
  BLOCK_KNOCKBACK_PX,
  isFrontalHit,
  calculateBlockMitigation,
  normalizeAngleDeg,
} from '../block.js'

describe('Knight Shield Block (Package 1-6)', () => {
  it('specifies 70% damage reduction, 120-degree arc, and 3px knockback', () => {
    expect(BLOCK_DAMAGE_REDUCTION).toBe(0.70)
    expect(BLOCK_ARC_DEG).toBe(120)
    expect(BLOCK_KNOCKBACK_PX).toBe(3)
  })

  describe('normalizeAngleDeg', () => {
    it('normalizes angles into [-180, 180]', () => {
      expect(normalizeAngleDeg(0)).toBe(0)
      expect(normalizeAngleDeg(180)).toBe(180)
      expect(normalizeAngleDeg(270)).toBe(-90)
      expect(normalizeAngleDeg(-270)).toBe(90)
      expect(normalizeAngleDeg(360)).toBe(0)
    })
  })

  describe('isFrontalHit', () => {
    const playerPos = { x: 100, y: 100 }

    it('detects frontal hit when player faces right (0 deg)', () => {
      // Directly in front (x: 150, y: 100) -> 0 deg diff -> frontal
      expect(isFrontalHit('right', playerPos, { x: 150, y: 100 })).toBe(true)

      // 45 degrees up and in front (x: 150, y: 50) -> diff 45 <= 60 -> frontal
      expect(isFrontalHit('right', playerPos, { x: 150, y: 50 })).toBe(true)

      // Behind player (x: 50, y: 100) -> 180 deg diff -> NOT frontal
      expect(isFrontalHit('right', playerPos, { x: 50, y: 100 })).toBe(false)
    })

    it('detects frontal hit when player faces down (90 deg)', () => {
      // Directly below (x: 100, y: 150) -> frontal
      expect(isFrontalHit('down', playerPos, { x: 100, y: 150 })).toBe(true)

      // Directly above (x: 100, y: 50) -> behind -> NOT frontal
      expect(isFrontalHit('down', playerPos, { x: 100, y: 50 })).toBe(false)
    })

    it('detects frontal hit when player faces up (-90 deg)', () => {
      // Directly above (x: 100, y: 50) -> frontal
      expect(isFrontalHit('up', playerPos, { x: 100, y: 50 })).toBe(true)

      // Directly below (x: 100, y: 150) -> behind -> NOT frontal
      expect(isFrontalHit('up', playerPos, { x: 100, y: 150 })).toBe(false)
    })

    it('detects frontal hit when player faces left (180 deg)', () => {
      // Directly to left (x: 50, y: 100) -> frontal
      expect(isFrontalHit('left', playerPos, { x: 50, y: 100 })).toBe(true)

      // Directly to right (x: 150, y: 100) -> behind -> NOT frontal
      expect(isFrontalHit('left', playerPos, { x: 150, y: 100 })).toBe(false)
    })
  })

  describe('calculateBlockMitigation', () => {
    const mockKnight = {
      classId: 'knight',
      facing: 'right',
      x: 100,
      y: 100,
      isBlocking: () => true,
    }

    it('reduces frontal damage by 70% for Knight', () => {
      const attackerFront = { x: 140, y: 100 }
      const res = calculateBlockMitigation(mockKnight, 10, attackerFront)

      expect(res.blocked).toBe(true)
      expect(res.isFrontal).toBe(true)
      // 10 raw damage reduced by 70% = 3 damage taken (10 * 0.3)
      expect(res.finalDamage).toBe(3)
      expect(res.knockbackPx).toBe(3)
    })

    it('does NOT reduce damage when struck from behind', () => {
      const attackerBehind = { x: 60, y: 100 }
      const res = calculateBlockMitigation(mockKnight, 10, attackerBehind)

      expect(res.blocked).toBe(false)
      expect(res.isFrontal).toBe(false)
      expect(res.finalDamage).toBe(10)
      expect(res.knockbackPx).toBe(0)
    })

    it('does NOT mitigate if player is not Knight or not blocking', () => {
      const mockMage = {
        classId: 'mage',
        facing: 'right',
        x: 100,
        y: 100,
        isBlocking: () => true,
      }
      const resMage = calculateBlockMitigation(mockMage, 10, { x: 140, y: 100 })
      expect(resMage.blocked).toBe(false)
      expect(resMage.finalDamage).toBe(10)

      const nonBlockingKnight = {
        ...mockKnight,
        isBlocking: () => false,
      }
      const resNonBlock = calculateBlockMitigation(nonBlockingKnight, 10, { x: 140, y: 100 })
      expect(resNonBlock.blocked).toBe(false)
      expect(resNonBlock.finalDamage).toBe(10)
    })
  })
})

