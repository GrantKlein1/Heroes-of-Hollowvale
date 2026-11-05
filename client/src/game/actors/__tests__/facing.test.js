import { describe, it, expect } from 'vitest'
import {
  FACINGS,
  FACING,
  DEFAULT_FACING,
  isValidFacing,
  resolveFacing,
  getFacingVector,
} from '../facing.js'

describe('Actor Facing System (facing.js)', () => {
  describe('Cardinal constants & validation', () => {
    it('defines 4 canonical facings without flipX', () => {
      expect(FACINGS).toEqual(['down', 'left', 'right', 'up'])
      expect(FACING.DOWN).toBe('down')
      expect(FACING.LEFT).toBe('left')
      expect(FACING.RIGHT).toBe('right')
      expect(FACING.UP).toBe('up')
      expect(DEFAULT_FACING).toBe('down')
    })

    it('validates facing strings correctly', () => {
      expect(isValidFacing('down')).toBe(true)
      expect(isValidFacing('left')).toBe(true)
      expect(isValidFacing('right')).toBe(true)
      expect(isValidFacing('up')).toBe(true)
      expect(isValidFacing('up_right')).toBe(false)
      expect(isValidFacing('north')).toBe(false)
      expect(isValidFacing(null)).toBe(false)
      expect(isValidFacing(undefined)).toBe(false)
      expect(isValidFacing(123)).toBe(false)
    })
  })

  describe('Dominant axis resolution', () => {
    it('resolves horizontal dominant directions', () => {
      // |dx| > |dy|
      expect(resolveFacing(2, 1)).toBe('right')
      expect(resolveFacing(10, -5)).toBe('right')
      expect(resolveFacing(-3, 1)).toBe('left')
      expect(resolveFacing(-100, -99)).toBe('left')
      expect(resolveFacing(1, 0)).toBe('right')
      expect(resolveFacing(-1, 0)).toBe('left')
    })

    it('resolves vertical dominant directions', () => {
      // |dy| > |dx|
      expect(resolveFacing(1, 2)).toBe('down')
      expect(resolveFacing(-5, 10)).toBe('down')
      expect(resolveFacing(1, -3)).toBe('up')
      expect(resolveFacing(-99, -100)).toBe('up')
      expect(resolveFacing(0, 1)).toBe('down')
      expect(resolveFacing(0, -1)).toBe('up')
    })
  })

  describe('Acceptance Criterion 1: facing tie keeps previous direction', () => {
    it('preserves previous direction when stationary (0, 0)', () => {
      expect(resolveFacing(0, 0, 'up')).toBe('up')
      expect(resolveFacing(0, 0, 'down')).toBe('down')
      expect(resolveFacing(0, 0, 'left')).toBe('left')
      expect(resolveFacing(0, 0, 'right')).toBe('right')
    })

    it('preserves previous direction on exact diagonal ties (|dx| === |dy| > 0)', () => {
      // Down-right diagonal tie: |1| === |1|
      expect(resolveFacing(1, 1, 'up')).toBe('up')
      expect(resolveFacing(1, 1, 'left')).toBe('left')
      expect(resolveFacing(1, 1, 'right')).toBe('right')
      expect(resolveFacing(1, 1, 'down')).toBe('down')

      // Down-left diagonal tie: |-10| === |10|
      expect(resolveFacing(-10, 10, 'up')).toBe('up')
      expect(resolveFacing(-10, 10, 'left')).toBe('left')
      expect(resolveFacing(-10, 10, 'right')).toBe('right')
      expect(resolveFacing(-10, 10, 'down')).toBe('down')

      // Up-right diagonal tie: |42.5| === |-42.5|
      expect(resolveFacing(42.5, -42.5, 'left')).toBe('left')
      expect(resolveFacing(42.5, -42.5, 'up')).toBe('up')

      // Up-left diagonal tie: |-100| === |-100|
      expect(resolveFacing(-100, -100, 'right')).toBe('right')
      expect(resolveFacing(-100, -100, 'down')).toBe('down')
    })

    it('defaults to "down" if no valid previous facing is provided on a tie', () => {
      expect(resolveFacing(0, 0)).toBe('down')
      expect(resolveFacing(5, 5, 'invalid_dir')).toBe('down')
      expect(resolveFacing(5, 5, null)).toBe('down')
    })

    it('handles NaN and non-numeric inputs safely by keeping previous facing', () => {
      expect(resolveFacing(NaN, 5, 'right')).toBe('right')
      expect(resolveFacing(5, NaN, 'up')).toBe('up')
      expect(resolveFacing('invalid', null, 'left')).toBe('left')
    })
  })

  describe('getFacingVector', () => {
    it('returns correct unit vector per direction', () => {
      expect(getFacingVector('down')).toEqual({ x: 0, y: 1 })
      expect(getFacingVector('up')).toEqual({ x: 0, y: -1 })
      expect(getFacingVector('left')).toEqual({ x: -1, y: 0 })
      expect(getFacingVector('right')).toEqual({ x: 1, y: 0 })
      expect(getFacingVector('unknown')).toEqual({ x: 0, y: 1 })
    })
  })
})

