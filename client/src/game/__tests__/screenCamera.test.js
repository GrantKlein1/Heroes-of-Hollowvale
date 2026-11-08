import { describe, it, expect } from 'vitest'
import { centeredCameraBounds } from '../screenCamera.js'

describe('ScreenCamera: centeredCameraBounds', () => {
  const mapBounds = { x: 0, y: 0, width: 640, height: 384 }

  it('keeps exact map bounds when map matches or exceeds viewport dimensions', () => {
    // 1280x720 at zoom 2: dw = 640, dh = 360.
    // dw matches map width (640), dh is smaller than map height (384).
    const bounds720 = centeredCameraBounds(1280, 720, mapBounds, 2)
    expect(bounds720.x).toBe(0)
    expect(bounds720.y).toBe(0)
    expect(bounds720.width).toBe(640)
    expect(bounds720.height).toBe(384)
    expect(bounds720.marginX).toBe(0)
    expect(bounds720.marginY).toBe(0)

    // 1920x1080 at zoom 3: dw = 640, dh = 360.
    const bounds1080 = centeredCameraBounds(1920, 1080, mapBounds, 3)
    expect(bounds1080.x).toBe(0)
    expect(bounds1080.y).toBe(0)
    expect(bounds1080.width).toBe(640)
    expect(bounds1080.height).toBe(384)
    expect(bounds1080.marginX).toBe(0)
    expect(bounds1080.marginY).toBe(0)
  })

  it('expands bounds symmetrically with intentional margins when viewport is wider than map', () => {
    // 1400x900 at zoom 2: dw = 700, dh = 450.
    // dw > 640 by 60px (30px on each side).
    // dh > 384 by 66px (33px on each side).
    const bounds = centeredCameraBounds(1400, 900, mapBounds, 2)
    expect(bounds.width).toBe(700)
    expect(bounds.height).toBe(450)
    expect(bounds.x).toBe(-30)
    expect(bounds.y).toBe(-33)
    // Screen margins: (1400 - 640*2)/2 = 60px, (900 - 384*2)/2 = 66px
    expect(bounds.marginX).toBe(60)
    expect(bounds.marginY).toBe(66)
  })

  it('handles 16:10 laptop viewports (e.g. 1280x800) with intentional vertical centering', () => {
    // 1280x800 at zoom 2: dw = 640, dh = 400.
    // dh > 384 by 16px (8px top/bottom).
    const bounds = centeredCameraBounds(1280, 800, mapBounds, 2)
    expect(bounds.x).toBe(0)
    expect(bounds.width).toBe(640)
    expect(bounds.height).toBe(400)
    expect(bounds.y).toBe(-8)
    expect(bounds.marginX).toBe(0)
    expect(bounds.marginY).toBe(16) // (800 - 384*2)/2 = 16px
  })

  it('handles ultrawide viewports (e.g. 2560x1080) with intentional horizontal centering', () => {
    // 2560x1080 at zoom 3: dw = 853.33, dh = 360.
    // Map width 640 is smaller than dw (853.33).
    const bounds = centeredCameraBounds(2560, 1080, mapBounds, 3)
    expect(bounds.width).toBeCloseTo(853.33, 1)
    expect(bounds.x).toBeCloseTo(-(853.33 - 640) / 2, 1)
    expect(bounds.y).toBe(0)
    expect(bounds.height).toBe(384)
    expect(bounds.marginX).toBe(Math.round((2560 - 640 * 3) / 2)) // 320px
    expect(bounds.marginY).toBe(0)
  })

  it('handles zoom 1 on desktop window without anchoring to top-left', () => {
    // 1920x1080 at zoom 1: dw = 1920, dh = 1080.
    const bounds = centeredCameraBounds(1920, 1080, mapBounds, 1)
    expect(bounds.width).toBe(1920)
    expect(bounds.height).toBe(1080)
    expect(bounds.x).toBe(-(1920 - 640) / 2) // -640
    expect(bounds.y).toBe(-(1080 - 384) / 2) // -348
    expect(bounds.marginX).toBe(640)
    expect(bounds.marginY).toBe(348)
  })
})

