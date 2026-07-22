/**
 * Wilderness draw + collider helpers (Track D).
 *
 * `drawWilderness` is the Canvas2D path used by MainGameScene (offscreen
 * canvas → Phaser texture). When layout.tiles is present, grass/path cells
 * are drawn (paths rotated per cell); otherwise falls back to a single ground
 * fill. Missing sprites → tinted color-box by category.
 *
 * @typedef {{ dx: number, dy: number, dw: number, dh: number }} Frame
 */

import { getAsset } from '../../config/terrainAssets.js'

const FALLBACK_COLORS = {
  ground: 'rgba(74, 107, 47, 0.9)',
  object: 'rgba(92, 64, 40, 0.95)',
  unknown: 'rgba(120, 120, 120, 0.8)',
  path: 'rgba(140, 110, 70, 0.95)',
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
 * Draw an image centered in a cell, optionally rotated (degrees CW).
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} img
 * @param {number} x  cell top-left
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [rotationDeg=0]
 */
function drawRotatedTile(ctx, img, x, y, w, h, rotationDeg = 0) {
  const cx = x + w / 2
  const cy = y + h / 2
  const rot = ((Number(rotationDeg) || 0) * Math.PI) / 180
  ctx.save()
  ctx.translate(cx, cy)
  if (rot) ctx.rotate(rot)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {Record<string, CanvasImageSource|undefined>} imagesById
 * @param {Frame} frame
 */
function drawTileGrid(ctx, layout, imagesById, frame) {
  const grid = layout.tiles || layout.tileGrid
  if (!grid?.cols || !grid?.rows || !grid.cells?.length) return false

  const { cols, rows, cells } = grid
  const tw = frame.dw / cols
  const th = frame.dh / rows

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    // Support legacy 0/1 masks if a stale layout slips through
    const normalized =
      typeof cell === 'number'
        ? {
            kind: cell === 1 ? 'path' : 'grass',
            assetId: cell === 1 ? 'path_top_bottom' : layout.groundTileId,
            rotation: 0,
          }
        : cell

    const c = i % cols
    const r = Math.floor(i / cols)
    const x = frame.dx + c * tw
    const y = frame.dy + r * th
    const img = imagesById?.[normalized.assetId]

    if (img) {
      drawRotatedTile(ctx, img, x, y, tw, th, normalized.rotation)
    } else {
      ctx.fillStyle =
        normalized.kind === 'path' ? FALLBACK_COLORS.path : FALLBACK_COLORS.ground
      ctx.fillRect(x, y, tw + 0.5, th + 0.5)
    }
  }
  return true
}

/**
 * Draw a wilderness layout onto a Canvas2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {Record<string, CanvasImageSource|undefined>} imagesById  keyed by asset id
 * @param {Frame} frame
 */
export function drawWilderness(ctx, layout, imagesById, frame) {
  if (!ctx || !layout || !frame) return

  ctx.imageSmoothingEnabled = false

  const tiled = drawTileGrid(ctx, layout, imagesById, frame)

  if (!tiled) {
    const ground = getAsset(layout.groundTileId)
    const groundImg = imagesById?.[layout.groundTileId]
    if (groundImg) {
      ctx.drawImage(groundImg, frame.dx, frame.dy, frame.dw, frame.dh)
    } else {
      ctx.fillStyle = FALLBACK_COLORS.ground
      ctx.fillRect(frame.dx, frame.dy, frame.dw, frame.dh)
    }
    void ground
  }

  // Objects sorted by ny (painter's algorithm — player passes behind tall props)
  const objs = [...(layout.objects || [])].sort((a, b) => a.ny - b.ny)
  for (const o of objs) {
    const asset = getAsset(o.assetId)
    const img = imagesById?.[o.assetId]
    const scale = Number(o.scale) || 1

    if (asset && img) {
      const pw = (asset.w / 1024) * frame.dw * scale
      const ph = (asset.h / 1536) * frame.dh * scale
      const px = frame.dx + o.nx * frame.dw - pw / 2
      const py =
        asset.anchor === 'center'
          ? frame.dy + o.ny * frame.dh - ph / 2
          : frame.dy + o.ny * frame.dh - ph
      ctx.drawImage(img, px, py, pw, ph)
    } else {
      const nw = asset ? (asset.w / 1024) * scale : 0.06
      const nh = asset ? (asset.h / 1536) * scale : 0.08
      const r = mapRect(
        { x: o.nx - nw / 2, y: o.ny - nh, w: nw, h: nh },
        frame,
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
