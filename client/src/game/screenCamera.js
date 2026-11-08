import { integerCoverZoom, integerTiledZoom } from './worldMetrics.js'

/**
 * Calculate camera bounds that keep the world map centered when the camera viewport
 * is larger than the map, preventing Phaser's clamp from anchoring it top-left.
 *
 * When the viewport in world units (viewW / zoom) exceeds map width, Phaser's clampX
 * collapses max scroll to min scroll (0), locking the map to the left. Expanding the
 * bounds symmetrically by (dw - width) allows the camera to center the map with equal
 * margins on both sides.
 *
 * @param {number} viewW - Viewport width in screen pixels
 * @param {number} viewH - Viewport height in screen pixels
 * @param {{ x?: number, y?: number, width: number, height: number }} bounds - World bounds
 * @param {number} [zoom=1] - Camera zoom
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function centeredCameraBounds(viewW, viewH, bounds, zoom = 1) {
  const z = Math.max(1e-4, zoom || 1)
  const baseX = bounds.x ?? 0
  const baseY = bounds.y ?? 0
  const width = bounds.width
  const height = bounds.height

  const dw = viewW / z
  const dh = viewH / z

  const adjW = Math.max(width, dw)
  const adjH = Math.max(height, dh)
  const adjX = baseX - (adjW - width) / 2
  const adjY = baseY - (adjH - height) / 2

  const marginX = Math.max(0, Math.round((viewW - width * z) / 2))
  const marginY = Math.max(0, Math.round((viewH - height * z) / 2))

  return {
    x: adjX,
    y: adjY,
    width: adjW,
    height: adjH,
    marginX,
    marginY,
  }
}

/**
 * Camera clamp for one screen.
 *
 * Today a "screen" is a whole painted backdrop or one wilderness grid.
 * The map PR will pass a 20×12 league rectangle (see worldMetrics) and a
 * short slide when the player walks off an edge. `slideMs` 0 snaps, which
 * is what the current scene changes use.
 */
export class ScreenCamera {
  /**
   * @param {import('phaser').Scene} scene
   */
  constructor(scene) {
    this.scene = scene
    this.bounds = { x: 0, y: 0, width: 1024, height: 1536 }
    this.isTiled = false
    this._onResize = () => this.refreshZoom()
    scene.scale.on('resize', this._onResize)
  }

  destroy() {
    this.scene?.scale?.off('resize', this._onResize)
  }

  /**
   * @param {{ x: number, y: number, width: number, height: number, isTiled?: boolean }} bounds
   * @param {{ slideMs?: number, isTiled?: boolean }} [opts]
   */
  setScreenBounds(bounds, opts = {}) {
    this.isTiled = Boolean(opts.isTiled ?? bounds.isTiled ?? this.isTiled)
    const slideMs = opts.slideMs || 0
    if (!(slideMs > 0)) {
      this.bounds = bounds
      this.refreshZoom()
      return
    }
    this._slideTo(bounds, slideMs)
  }

  follow(target) {
    const cam = this.scene.cameras.main
    cam.startFollow(target, true, 1, 1)
    cam.setLerp(1, 1)
    this.refreshZoom()
  }

  refreshZoom() {
    const cam = this.scene.cameras.main
    const { width, height } = this.bounds
    const isTiled = Boolean(this.isTiled || (width <= 640 && height <= 384))
    const zoom = isTiled
      ? integerTiledZoom(this.scene.scale.width, this.scene.scale.height)
      : integerCoverZoom(this.scene.scale.width, this.scene.scale.height, width, height)
    cam.setZoom(zoom)
    const adj = centeredCameraBounds(this.scene.scale.width, this.scene.scale.height, this.bounds, zoom)
    cam.setBounds(adj.x, adj.y, adj.width, adj.height)
    cam.roundPixels = true
    // Look slightly below the sprite so the feet sit above the hotbar.
    cam.setFollowOffset(0, -(56 / zoom))
  }

  /**
   * Pan across the union of the current and next screen, then clamp.
   * Caller should pause follow for the duration; HollowvaleScene does that
   * when slideMs > 0. Not used by today's instant scene swaps.
   * @param {{ x: number, y: number, width: number, height: number }} bounds
   * @param {number} durationMs
   */
  _slideTo(bounds, durationMs) {
    const cam = this.scene.cameras.main
    const from = this.bounds
    const x = Math.min(from.x, bounds.x)
    const y = Math.min(from.y, bounds.y)
    const right = Math.max(from.x + from.width, bounds.x + bounds.width)
    const bottom = Math.max(from.y + from.height, bounds.y + bounds.height)
    cam.stopFollow()
    cam.setBounds(x, y, right - x, bottom - y)
    const zoom = cam.zoom || 1
    const destX = bounds.x + bounds.width / 2 - cam.width / (2 * zoom)
    const destY = bounds.y + bounds.height / 2 - cam.height / (2 * zoom)
    this.scene.tweens.add({
      targets: cam,
      scrollX: destX,
      scrollY: destY,
      duration: durationMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.bounds = bounds
        this.refreshZoom()
      },
    })
  }
}
