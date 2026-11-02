/**
 * DOM <img> pool for GIF projectiles and the thief stealth overlay.
 * Positions are written from the camera each frame without allocating.
 */
export class DomFxLayer {
  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    this.layer = document.createElement('div')
    this.layer.setAttribute('data-fx-layer', 'true')
    this.layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;'
    parent.appendChild(this.layer)
    this.pool = []
    this.live = []
  }

  /**
   * @param {string} src
   * @param {number} x world px, top-left
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  spawn(src, x, y, w, h) {
    const img = this.pool.pop() || document.createElement('img')
    img.alt = ''
    img.draggable = false
    if (img.getAttribute('data-src') !== src) {
      img.src = src
      img.setAttribute('data-src', src)
    }
    img.style.display = 'block'
    img.style.position = 'absolute'
    img.style.left = '0'
    img.style.top = '0'
    img.style.imageRendering = 'pixelated'
    img.style.pointerEvents = 'none'
    this.layer.appendChild(img)
    const node = { img, x, y, w, h }
    this.live.push(node)
    return node
  }

  /** @param {{ img: HTMLImageElement }} node */
  release(node) {
    if (!node) return
    const list = this.live
    const last = list.length - 1
    for (let i = last; i >= 0; i--) {
      if (list[i] !== node) continue
      if (i !== last) list[i] = list[last]
      list.pop()
      break
    }
    node.img.remove()
    this.pool.push(node.img)
  }

  clear() {
    while (this.live.length) this.release(this.live[this.live.length - 1])
  }

  /**
   * @param {import('phaser').Cameras.Scene2D.Camera} cam
   */
  sync(cam) {
    const z = cam.zoom
    const vx = cam.worldView.x
    const vy = cam.worldView.y
    const list = this.live
    for (let i = 0; i < list.length; i++) {
      const n = list[i]
      const img = n.img
      img.style.transform = `translate3d(${(n.x - vx) * z}px,${(n.y - vy) * z}px,0)`
      img.style.width = `${n.w * z}px`
      img.style.height = `${n.h * z}px`
    }
  }

  destroy() {
    this.clear()
    this.pool.length = 0
    this.layer.remove()
  }
}
