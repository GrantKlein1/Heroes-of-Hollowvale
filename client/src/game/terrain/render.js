/**
 * Wilderness draw + collider helpers — Phase 0 stub.
 *
 * Track D owns the real implementation and Phaser wiring.
 * Color-box fallback: if a sprite is missing from imagesById, draw a tinted
 * rectangle by category so Track D never blocks on Track A art.
 *
 * @typedef {{ dx: number, dy: number, dw: number, dh: number }} Frame
 */

import { getAsset } from '../../config/terrainAssets.js'

const FALLBACK_COLORS = {
  ground: 'rgba(74, 107, 47, 0.9)',
  object: 'rgba(92, 64, 40, 0.95)',
  unknown: 'rgba(120, 120, 120, 0.8)',
}

/**
 * Map a normalized rect into pixel space for the given frame.
 * @param {{ x:number, y:number, w:number, h:number }} r
 * @param {Frame} frame
 */
function mapRect(r, frame) {
  return {
    x: frame.dx + r.x * frame.dw,
    y: frame.dy + r.y * frame.dh,
    w: r.w * frame.dw,
    h: r.h * frame.dh,
  }
}

/**
 * Draw a wilderness layout onto a Canvas2D context.
 * Phaser Track D may call this into an offscreen canvas, or reimplement with
 * Phaser sprites while keeping the same layout + fallback semantics.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {Record<string, CanvasImageSource|undefined>} imagesById  keyed by asset id
 * @param {Frame} frame
 */
export function drawWilderness(ctx, layout, imagesById, frame) {
  if (!ctx || !layout || !frame) return

  // Ground fill (tiled conceptually; stub draws a single full-frame box/image)
  const ground = getAsset(layout.groundTileId)
  const groundImg = imagesById?.[layout.groundTileId]
  if (groundImg) {
    // Simple cover draw; Track D may implement true tiling with ground.w/h
    ctx.drawImage(groundImg, frame.dx, frame.dy, frame.dw, frame.dh)
  } else {
    ctx.fillStyle = FALLBACK_COLORS.ground
    ctx.fillRect(frame.dx, frame.dy, frame.dw, frame.dh)
  }

  // Objects sorted by ny (painter's algorithm — player passes behind tall props)
  const objs = [...(layout.objects || [])].sort((a, b) => a.ny - b.ny)
  for (const o of objs) {
    const asset = getAsset(o.assetId)
    const img = imagesById?.[o.assetId]
    const scale = Number(o.scale) || 1

    if (asset && img) {
      const pw = (asset.w / 1024) * frame.dw * scale // assets sized vs 1024-wide frame convention
      const ph = (asset.h / 1536) * frame.dh * scale
      const px = frame.dx + o.nx * frame.dw - pw / 2
      const py =
        asset.anchor === 'center'
          ? frame.dy + o.ny * frame.dh - ph / 2
          : frame.dy + o.ny * frame.dh - ph
      ctx.drawImage(img, px, py, pw, ph)
    } else {
      // Color-box fallback — sized from asset dims when known
      const nw = asset ? (asset.w / 1024) * scale : 0.06
      const nh = asset ? (asset.h / 1536) * scale : 0.08
      const r = mapRect(
        { x: o.nx - nw / 2, y: o.ny - nh, w: nw, h: nh },
        frame
      )
      ctx.fillStyle = FALLBACK_COLORS[asset?.category] || FALLBACK_COLORS.unknown
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.strokeRect(r.x, r.y, r.w, r.h)
    }
  }

  // Debug: mark open exits as thin edge indicators
  const exitColor = 'rgba(255, 220, 80, 0.85)'
  ctx.fillStyle = exitColor
  if (layout.exits?.north) ctx.fillRect(frame.dx + frame.dw * 0.4, frame.dy, frame.dw * 0.2, 4)
  if (layout.exits?.south) ctx.fillRect(frame.dx + frame.dw * 0.4, frame.dy + frame.dh - 4, frame.dw * 0.2, 4)
  if (layout.exits?.west) ctx.fillRect(frame.dx, frame.dy + frame.dh * 0.4, 4, frame.dh * 0.2)
  if (layout.exits?.east) ctx.fillRect(frame.dx + frame.dw - 4, frame.dy + frame.dh * 0.4, 4, frame.dh * 0.2)

  // Silence unused when ground resolved without dims
  void ground
}

/**
 * Convert layout colliders to pixel-space AABBs for the given frame.
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {Frame} frame
 * @returns {Array<{ x:number, y:number, w:number, h:number }>}
 */
export function wildernessCollidersPx(layout, frame) {
  if (!layout?.colliders || !frame) return []
  return layout.colliders.map((c) => mapRect(c, frame))
}
