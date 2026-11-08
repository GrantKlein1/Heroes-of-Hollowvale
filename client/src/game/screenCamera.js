import { integerCoverZoom, integerTiledZoom } from './worldMetrics.js'

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
    const { x, y, width, height } = this.bounds
    const isTiled = Boolean(this.isTiled || (width <= 640 && height <= 384))
    const zoom = isTiled
      ? integerTiledZoom(this.scene.scale.width, this.scene.scale.height)
      : integerCoverZoom(this.scene.scale.width, this.scene.scale.height, width, height)
    cam.setZoom(zoom)
    cam.setBounds(x, y, width, height)
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
