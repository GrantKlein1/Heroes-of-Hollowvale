/**
 * Canvas Game.jsx bridge for procedural wilderness screens.
 * Keeps edge/spawn/collider helpers out of the large Game component.
 */

import { TERRAIN_ASSETS } from '../../config/terrainAssets.js'
import {
  WILDERNESS_ENTRANCE_ID,
  getNeighbors,
  oppositeEdge,
} from './worldGraph.js'
import { getLayout, preloadNeighbors, evictBeyond } from './screenCache.js'

/** Virtual wilderness frame (matches render.js asset sizing convention). */
export const WILDERNESS_FRAME_W = 1024
export const WILDERNESS_FRAME_H = 1536

/** Hub return spawn on the path scene (near toWilderness zone). */
export const HUB_RETURN_SPAWN = { scene: 'path', nx: 0.55, ny: 0.58 }

/** Normalized exit strip thickness for walk-across detection. */
const EDGE_MARGIN = 0.045
/** Corridor width around center for N/S exits (and mid for E/W). */
const EDGE_CORRIDOR = 0.22

/**
 * @param {'north'|'south'|'east'|'west'} edge
 * @returns {{ nx: number, ny: number }}
 */
export function spawnAtEdge(edge) {
  const map = {
    north: { nx: 0.5, ny: 0.12 },
    south: { nx: 0.5, ny: 0.88 },
    east: { nx: 0.88, ny: 0.5 },
    west: { nx: 0.12, ny: 0.5 },
  }
  return map[edge] || map.north
}

/**
 * Spawn just inside the north edge when arriving from the hub.
 * @returns {{ nx: number, ny: number }}
 */
export function spawnFromHub() {
  return spawnAtEdge('north')
}

/**
 * Contain-fit the virtual wilderness frame into the canvas.
 * @param {number} cw
 * @param {number} ch
 * @returns {{ dx: number, dy: number, dw: number, dh: number }}
 */
export function wildernessFrame(cw, ch) {
  const scale = Math.min(cw / WILDERNESS_FRAME_W, ch / WILDERNESS_FRAME_H)
  const dw = WILDERNESS_FRAME_W * scale
  const dh = WILDERNESS_FRAME_H * scale
  return {
    dx: (cw - dw) / 2,
    dy: (ch - dh) / 2,
    dw,
    dh,
  }
}

/**
 * Load layout for a node and kick cache warm/evict policy.
 * @param {string} nodeId
 * @returns {import('./generate.js').TerrainLayout}
 */
export function loadWildernessScreen(nodeId) {
  const layout = getLayout(nodeId)
  preloadNeighbors(nodeId)
  evictBeyond(nodeId)
  return layout
}

/**
 * @param {string} nodeId
 * @param {'north'|'south'|'east'|'west'} edge
 * @returns {{ type: 'neighbor', nodeId: string, appearAt: 'north'|'south'|'east'|'west' } | { type: 'hub' } | null}
 */
export function resolveEdgeTransition(nodeId, edge) {
  const neighbors = getNeighbors(nodeId)
  const nextId = neighbors[edge]
  if (nextId) {
    return { type: 'neighbor', nodeId: nextId, appearAt: oppositeEdge(edge) }
  }
  // Entrance north is forced open by screenCache — returns to hub, not a graph neighbor
  if (nodeId === WILDERNESS_ENTRANCE_ID && edge === 'north') {
    return { type: 'hub' }
  }
  return null
}

/**
 * Detect walk-across of an open exit corridor.
 * @param {number} nx player center in [0,1]
 * @param {number} ny
 * @param {import('./generate.js').TerrainLayout} layout
 * @returns {'north'|'south'|'east'|'west'|null}
 */
export function detectCrossedEdge(nx, ny, layout) {
  if (!layout?.exits) return null
  const half = EDGE_CORRIDOR / 2
  const inBand = (t) => t >= 0.5 - half && t <= 0.5 + half

  if (layout.exits.north && ny < EDGE_MARGIN && inBand(nx)) return 'north'
  if (layout.exits.south && ny > 1 - EDGE_MARGIN && inBand(nx)) return 'south'
  if (layout.exits.west && nx < EDGE_MARGIN && inBand(ny)) return 'west'
  if (layout.exits.east && nx > 1 - EDGE_MARGIN && inBand(ny)) return 'east'
  return null
}

/**
 * Normalized prompt rects for open wilderness exits (HUD beacons).
 * @param {import('./generate.js').TerrainLayout} layout
 * @returns {Array<{ edge: string, rect: { x:number,y:number,w:number,h:number }, short: string, label: string }>}
 */
export function wildernessExitPrompts(layout, nodeId) {
  const exits = layout?.exits || {}
  const prompts = []
  const strip = 0.06
  const band = EDGE_CORRIDOR
  const x0 = 0.5 - band / 2

  if (exits.north) {
    const toHub = nodeId === WILDERNESS_ENTRANCE_ID
    prompts.push({
      edge: 'north',
      rect: { x: x0, y: 0, w: band, h: strip },
      short: toHub ? 'Hub (North)' : 'North',
      label: toHub ? 'Walk north to return to the Path' : 'Walk north to continue',
      kind: 'exit',
    })
  }
  if (exits.south) {
    prompts.push({
      edge: 'south',
      rect: { x: x0, y: 1 - strip, w: band, h: strip },
      short: 'South',
      label: 'Walk south to continue',
      kind: 'exit',
    })
  }
  if (exits.west) {
    prompts.push({
      edge: 'west',
      rect: { x: 0, y: x0, w: strip, h: band },
      short: 'West',
      label: 'Walk west to continue',
      kind: 'exit',
    })
  }
  if (exits.east) {
    prompts.push({
      edge: 'east',
      rect: { x: 1 - strip, y: x0, w: strip, h: band },
      short: 'East',
      label: 'Walk east to continue',
      kind: 'exit',
    })
  }
  return prompts
}

/**
 * Identify stub full-side border walls from generateScreen.
 * @param {{ x:number,y:number,w:number,h:number }} c
 * @returns {'north'|'south'|'east'|'west'|null}
 */
function borderEdge(c) {
  if (c.y < 0 && c.w >= 0.99) return 'north'
  if (c.y >= 0.99 && c.w >= 0.99) return 'south'
  if (c.x < 0 && c.h >= 0.99) return 'west'
  if (c.x >= 0.99 && c.h >= 0.99) return 'east'
  return null
}

/**
 * Layout colliders with center gaps on open exits so the player can cross.
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {number} [gap=0.24]
 * @returns {Array<{ x:number,y:number,w:number,h:number }>}
 */
export function collidersWithExitGaps(layout, gap = 0.24) {
  const exits = layout?.exits || {}
  const out = []
  for (const c of layout?.colliders || []) {
    const edge = borderEdge(c)
    if (!edge || !exits[edge]) {
      out.push(c)
      continue
    }
    const g0 = 0.5 - gap / 2
    const g1 = 0.5 + gap / 2
    if (edge === 'north' || edge === 'south') {
      out.push({ x: 0, y: c.y, w: g0, h: c.h })
      out.push({ x: g1, y: c.y, w: 1 - g1, h: c.h })
    } else {
      out.push({ x: c.x, y: 0, w: c.w, h: g0 })
      out.push({ x: c.x, y: g1, w: c.w, h: 1 - g1 })
    }
  }
  return out
}

/**
 * Preload terrain PNGs keyed by asset id (missing files → omitted; render color-boxes).
 * @param {(src: string) => Promise<CanvasImageSource|null>} loadSafe
 * @returns {Promise<Record<string, CanvasImageSource>>}
 */
export async function preloadTerrainImages(loadSafe) {
  const byId = {}
  await Promise.all(
    TERRAIN_ASSETS.map(async (a) => {
      try {
        const img = await loadSafe(a.src)
        if (img) byId[a.id] = img
      } catch {
        /* color-box fallback at draw time */
      }
    })
  )
  return byId
}

export { WILDERNESS_ENTRANCE_ID, getLayout, preloadNeighbors, evictBeyond, oppositeEdge }
