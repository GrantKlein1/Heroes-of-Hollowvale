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

/** Canvas rows reserved for the health bar + hotbar overlay. */
const HUD_RESERVE_PX = 104

/**
 * Where leaving the wilderness northward puts the player: the painted path at
 * the bottom-right of the dungeon entrance, i.e. the zone they entered from.
 */
export const HUB_RETURN_SPAWN = { scene: 'dungeon', nx: 0.87, ny: 0.88 }

/**
 * How close a sprite edge must get to the frame border to count as crossing.
 * Tested against the leading edge rather than the sprite centre, because
 * Game.jsx clamps the whole sprite rect inside the frame — a centre-based test
 * is unreachable for any sprite taller/wider than 2x the margin.
 */
const EDGE_MARGIN = 0.012

/** Fallback corridor band when a layout predates `exitBands`. */
const DEFAULT_BAND = { start: 0.39, end: 0.61 }

/**
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {'north'|'south'|'east'|'west'} edge
 * @returns {{ start: number, end: number }}
 */
function bandFor(layout, edge) {
  return layout?.exitBands?.[edge] || DEFAULT_BAND
}

/**
 * Spawn just inside `edge`, centred on that edge's corridor.
 * @param {'north'|'south'|'east'|'west'} edge
 * @param {import('./generate.js').TerrainLayout} [layout]
 * @returns {{ nx: number, ny: number }}
 */
export function spawnAtEdge(edge, layout) {
  const band = bandFor(layout, edge)
  const mid = (band.start + band.end) / 2
  const inset = 0.12
  switch (edge) {
    case 'south':
      return { nx: mid, ny: 1 - inset }
    case 'west':
      return { nx: inset, ny: mid }
    case 'east':
      return { nx: 1 - inset, ny: mid }
    default:
      return { nx: mid, ny: inset }
  }
}

/**
 * Spawn just inside the north edge when arriving from the hub.
 * @param {import('./generate.js').TerrainLayout} [layout]
 * @returns {{ nx: number, ny: number }}
 */
export function spawnFromHub(layout) {
  return spawnAtEdge('north', layout)
}

/**
 * Contain-fit the virtual wilderness frame into the canvas, leaving room for
 * the HUD so the south exit is never hidden behind the hotbar.
 * @param {number} cw
 * @param {number} ch
 * @returns {{ dx: number, dy: number, dw: number, dh: number }}
 */
export function wildernessFrame(cw, ch) {
  const usableH = Math.max(120, ch - HUD_RESERVE_PX)
  const scale = Math.min(cw / WILDERNESS_FRAME_W, usableH / WILDERNESS_FRAME_H)
  const dw = WILDERNESS_FRAME_W * scale
  const dh = WILDERNESS_FRAME_H * scale
  return {
    dx: (cw - dw) / 2,
    dy: (usableH - dh) / 2,
    dw,
    dh,
  }
}

/**
 * Build a fresh layout for a node.
 * @param {string} nodeId
 * @returns {import('./generate.js').TerrainLayout}
 */
export function loadWildernessScreen(nodeId) {
  return getLayout(nodeId)
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
 * Detect the player walking out through an open exit corridor.
 * @param {{ x: number, y: number, w: number, h: number }} rect player sprite in normalized frame space
 * @param {import('./generate.js').TerrainLayout} layout
 * @returns {'north'|'south'|'east'|'west'|null}
 */
export function detectCrossedEdge(rect, layout) {
  if (!layout?.exits || !rect) return null
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const within = (t, edge) => {
    const band = bandFor(layout, edge)
    return t >= band.start && t <= band.end
  }

  if (layout.exits.north && rect.y <= EDGE_MARGIN && within(cx, 'north')) return 'north'
  if (layout.exits.south && rect.y + rect.h >= 1 - EDGE_MARGIN && within(cx, 'south')) return 'south'
  if (layout.exits.west && rect.x <= EDGE_MARGIN && within(cy, 'west')) return 'west'
  if (layout.exits.east && rect.x + rect.w >= 1 - EDGE_MARGIN && within(cy, 'east')) return 'east'
  return null
}

/**
 * Normalized prompt rects for open wilderness exits (HUD beacons).
 * @param {import('./generate.js').TerrainLayout} layout
 * @param {string} nodeId
 * @returns {Array<{ edge: string, rect: { x:number,y:number,w:number,h:number }, short: string, label: string, kind: string }>}
 */
export function wildernessExitPrompts(layout, nodeId) {
  const exits = layout?.exits || {}
  const prompts = []
  const strip = 0.045

  const add = (edge, rect, short, label) =>
    prompts.push({ edge, rect, short, label, kind: 'exit' })

  if (exits.north) {
    const b = bandFor(layout, 'north')
    const toHub = nodeId === WILDERNESS_ENTRANCE_ID
    add(
      'north',
      { x: b.start, y: 0, w: b.end - b.start, h: strip },
      toHub ? 'Dungeon Entrance' : 'North',
      toHub ? 'Walk north to return to the Dungeon Entrance' : 'Walk north to continue'
    )
  }
  if (exits.south) {
    const b = bandFor(layout, 'south')
    add('south', { x: b.start, y: 1 - strip, w: b.end - b.start, h: strip }, 'South', 'Walk south to continue')
  }
  if (exits.west) {
    const b = bandFor(layout, 'west')
    add('west', { x: 0, y: b.start, w: strip, h: b.end - b.start }, 'West', 'Walk west to continue')
  }
  if (exits.east) {
    const b = bandFor(layout, 'east')
    add('east', { x: 1 - strip, y: b.start, w: strip, h: b.end - b.start }, 'East', 'Walk east to continue')
  }
  return prompts
}

/**
 * Colliders for a layout. The generator already carves border gaps aligned to
 * each corridor, so this is a straight pass-through kept for call-site clarity.
 * @param {import('./generate.js').TerrainLayout} layout
 * @returns {Array<{ x:number,y:number,w:number,h:number }>}
 */
export function collidersWithExitGaps(layout) {
  return layout?.colliders || []
}

/**
 * Preload terrain PNGs keyed by asset id. Assets with no `src` (prop art that
 * has not shipped) are skipped so nothing 404s; render draws color boxes.
 * @param {(src: string) => Promise<CanvasImageSource|null>} loadSafe
 * @returns {Promise<Record<string, CanvasImageSource>>}
 */
export async function preloadTerrainImages(loadSafe) {
  const byId = {}
  await Promise.all(
    TERRAIN_ASSETS.filter((a) => a.src).map(async (a) => {
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
