import { describe, it, expect } from 'vitest'
import {
  TILE_SIZE,
  LEAGUE_TILES_X,
  LEAGUE_TILES_Y,
  LEAGUE_SCREEN_W,
  LEAGUE_SCREEN_H,
  TARGET_VIRTUAL_W,
  TARGET_VIRTUAL_H,
  TARGET_VIRTUAL_MIN_H,
  PAINTED_WORLD_W,
  PAINTED_WORLD_H,
  integerCoverZoom,
  integerTiledZoom,
} from '../worldMetrics.js'

describe('Package 1-3b: worldMetrics and Camera Calibration', () => {
  it('defines 32px tile metrics aligned with Blendsmith v4 standard', () => {
    expect(TILE_SIZE).toBe(32)
    expect(LEAGUE_TILES_X).toBe(20)
    expect(LEAGUE_TILES_Y).toBe(12)
    expect(LEAGUE_SCREEN_W).toBe(640)
    expect(LEAGUE_SCREEN_H).toBe(384)
    expect(TARGET_VIRTUAL_W).toBe(640)
    expect(TARGET_VIRTUAL_H).toBe(360)
    expect(TARGET_VIRTUAL_MIN_H).toBe(270)
  })

  describe('integerCoverZoom (painted scenes)', () => {
    it('calculates integer cover zoom for painted backdrop across standard viewports', () => {
      // 1280x720: cover is max(1280/1024, 720/1536) = 1.25 -> zoom 2
      expect(integerCoverZoom(1280, 720, PAINTED_WORLD_W, PAINTED_WORLD_H)).toBe(2)
      // 1920x1080: cover is max(1920/1024, 1080/1536) = 1.875 -> zoom 2
      expect(integerCoverZoom(1920, 1080, PAINTED_WORLD_W, PAINTED_WORLD_H)).toBe(2)
      // 2560x1440: cover is max(2560/1024, 1440/1536) = 2.5 -> zoom 3
      expect(integerCoverZoom(2560, 1440, PAINTED_WORLD_W, PAINTED_WORLD_H)).toBe(3)
    })

    it('handles edge cases safely', () => {
      expect(integerCoverZoom(0, 0, 1024, 1536)).toBe(1)
      expect(integerCoverZoom(800, 600, 0, 0)).toBe(1)
    })
  })

  describe('integerTiledZoom (32px Tiled maps)', () => {
    it('calibrates integer zoom to maintain ~640x360 virtual playfield without cover over-zooming', () => {
      // 1280x720 (720p): exact 2x integer scaling (640x360 world area)
      expect(integerTiledZoom(1280, 720)).toBe(2)
      // 1920x1080 (1080p): exact 3x integer scaling (640x360 world area)
      expect(integerTiledZoom(1920, 1080)).toBe(3)
      // 2560x1440 (1440p): exact 4x integer scaling (640x360 world area)
      expect(integerTiledZoom(2560, 1440)).toBe(4)
      // 3840x2160 (4K): exact 6x integer scaling (640x360 world area)
      expect(integerTiledZoom(3840, 2160)).toBe(6)
      // 1366x768 (laptop): floor yields zoom 2
      expect(integerTiledZoom(1366, 768)).toBe(2)
      // Laptop viewports with browser chrome (inner height ~540-680px) get crisp 2x zoom:
      expect(integerTiledZoom(1280, 580)).toBe(2)
      expect(integerTiledZoom(1366, 600)).toBe(2)
      expect(integerTiledZoom(1536, 680)).toBe(2)
    })

    it('handles edge cases safely', () => {
      expect(integerTiledZoom(0, 0)).toBe(1)
      expect(integerTiledZoom(-100, 720)).toBe(1)
    })
  })
})

