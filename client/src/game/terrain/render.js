/**
 * Wilderness Canvas2D renderer.
 *
 * The terrain PNGs are 1024x1024 detail art, not literal 16x16 sprites, so a
 * per-frame 17x downscale would shimmer. Each (asset, rotation, size) combo is
 * therefore resampled once into an offscreen canvas with high-quality
 * filtering and afterwards blitted 1:1 with smoothing off, which stays sharp
 * and costs one drawImage per cell.
 *
 * All 16 path connection masks are covered by rotating the four shipped path
 * tiles: the base set (straight, corner, T, cross) is rotationally complete.
 *
 * @typedef {{ dx: number, dy: number, dw: number, dh: number }} Frame
 */

import { getAsset } from '../../config/terrainAssets.js'

const FALLBACK_COLORS = {
  ground: 'rgba(74, 107, 47, 0.9)',
  object: 'rgba(92, 64, 40, 0.95)',
  path: 'rgba(140, 110, 70, 0.95)',
  unknown: 'rgba(120, 120, 120, 0.8)',
}

/** @type {Map<string, HTMLCanvasElement|OffscreenCanvas>} */
const tileBakes = new Map()
const MAX_BAKES = 96

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

function createSurface(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h)
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * Resample a tile to its on-screen size at the given rotation, once.
 * @param {CanvasImageSource} img
 * @param {string} assetId
 * @param {number} rotationDeg  multiple of 90, clockwise
 * @param {number} size  square edge in device pixels
 */
function bakeTile(img, assetId, rotationDeg, size) {
  const rot = ((Math.round(rotationDeg / 90) % 4) + 4) % 4
  const key = `${assetId}|${rot}|${size}`
  const cached = tileBakes.get(key)
  if (cached) return cached

  const surface = createSurface(size, size)
  if (!surface) return null
  const g = surface.getContext('2d')
  if (!g) return null

  g.imageSmoothingEnabled = true
  if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high'
  g.translate(size / 2, size / 2)
  if (rot) g.rotate((rot * Math.PI) / 2)
  g.drawImage(img, -size / 2, -size / 2, size, size)

  if (tileBakes.size >= MAX_BAKES) tileBakes.clear()
  tileBakes.set(key, surface)
  return surface
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {Record<string, CanvasImageSource|undefined>} imagesById
 * @param {Frame} frame
 * @returns {boolean} true when the grid was drawn
 */
function drawTileGrid(ctx, layout, imagesById, frame) {
  const grid = layout.tiles
  if (!grid?.cols || !grid?.rows || !grid.cells?.length) return false

  const { cols, rows, cells } = grid
  const tw = frame.dw / cols
  const th = frame.dh / rows
  // Bake square so a rotated tile lands on the same pixel lattice as its
  // neighbours; cells are square whenever the frame aspect matches the grid.
  const bakeSize = Math.max(8, Math.ceil(Math.max(tw, th)))

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    if (!cell) continue
    const col = i % cols
    const row = (i - col) / cols
    const x = frame.dx + col * tw
    const y = frame.dy + row * th
    const img = imagesById?.[cell.assetId]

    if (img) {
      const baked = bakeTile(img, cell.assetId, cell.rotation || 0, bakeSize)
      if (baked) {
        ctx.drawImage(baked, Math.round(x), Math.round(y), Math.ceil(tw) + 1, Math.ceil(th) + 1)
        continue
      }
    }
    ctx.fillStyle = cell.kind === 'path' ? FALLBACK_COLORS.path : FALLBACK_COLORS.ground
    ctx.fillRect(x, y, tw + 0.5, th + 0.5)
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

  if (!drawTileGrid(ctx, layout, imagesById, frame)) {
    const groundImg = imagesById?.[layout.groundTileId]
    if (groundImg) {
      ctx.drawImage(groundImg, frame.dx, frame.dy, frame.dw, frame.dh)
    } else {
      ctx.fillStyle = FALLBACK_COLORS.ground
      ctx.fillRect(frame.dx, frame.dy, frame.dw, frame.dh)
    }
  }

  // Painter's algorithm so the player passes behind tall props
  const objs = [...(layout.objects || [])].sort((a, b) => a.ny - b.ny)
  for (const o of objs) {
    const asset = getAsset(o.assetId)
    const img = imagesById?.[o.assetId]
    const scale = Number(o.scale) || 1
    const nw = asset ? (asset.w / 1024) * scale : 0.06
    const nh = asset ? (asset.h / 1536) * scale : 0.08
    const pw = nw * frame.dw
    const ph = nh * frame.dh
    const px = frame.dx + o.nx * frame.dw - pw / 2
    const py =
      asset?.anchor === 'center'
        ? frame.dy + o.ny * frame.dh - ph / 2
        : frame.dy + o.ny * frame.dh - ph

    if (img) {
      ctx.drawImage(img, px, py, pw, ph)
      continue
    }
    ctx.fillStyle =
      asset?.placeholderColor || FALLBACK_COLORS[asset?.category] || FALLBACK_COLORS.unknown
    ctx.fillRect(px, py, pw, ph)
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1)
  }
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
