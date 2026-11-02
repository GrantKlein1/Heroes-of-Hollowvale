/**
 * Fixed 9-piece + 4 inner-corner lookup.
 * The generator stores a terrain kind. This picks the atlas tile from
 * the cardinal neighbours (and the four diagonals when all four cardinals match).
 * Piece names match the sand/water sets in atlas.json:
 *   n = grass along the north edge of the tile (terrain continues south).
 */

import { mix, unit } from './metrics.js'
import { PIECES, TERRAIN, pieceIndex } from './tileCatalog.js'

const ROAD = new Set(['road', 'gate'])
const WATER = new Set(['water', 'ford', 'bridge'])
const COBBLE = new Set(['cobble'])

/**
 * Cardinal mask: N=1, E=2, S=4, W=8.
 * Opposite-only corridors (N+S, E+W) use the center; the pack has no
 * "grass on both sides" tile, and the road is four tiles wide so those
 * masks are not how the Ember Road is drawn.
 */
const PIECE_FOR_MASK = [
  'c', 's', 'w', 'sw',
  'n', 'c', 'nw', 'w',
  'e', 'se', 'c', 's',
  'ne', 'e', 'n', 'c',
]

const DIAGONALS = [[-1, -1, 'nw'], [1, -1, 'ne'], [-1, 1, 'sw'], [1, 1, 'se']]

export function cardinalMask(wx, wy, kindAt, group) {
  let mask = 0
  if (group.has(kindAt(wx, wy - 1))) mask |= 1
  if (group.has(kindAt(wx + 1, wy))) mask |= 2
  if (group.has(kindAt(wx, wy + 1))) mask |= 4
  if (group.has(kindAt(wx - 1, wy))) mask |= 8
  return mask
}

function groupFor(kind) {
  if (ROAD.has(kind)) return ROAD
  if (WATER.has(kind)) return WATER
  if (COBBLE.has(kind)) return COBBLE
  return null
}

/**
 * @param {number} base first index of a 13-tile set
 * @param {number} mask cardinal mask 0..15
 * @param {{nw?:boolean,ne?:boolean,sw?:boolean,se?:boolean}} [diag]
 */
export function tileForMask(base, mask, diag) {
  if (mask === 15 && diag) {
    const missing = DIAGONALS.filter(([, , name]) => diag[name] === false)
    if (missing.length === 1) return pieceIndex(base, `i${missing[0][2]}`)
  }
  const piece = PIECE_FOR_MASK[mask]
  if (!piece || !PIECES.includes(piece)) return pieceIndex(base, 'c')
  return pieceIndex(base, piece)
}

function autotile(base, wx, wy, kindAt, group) {
  const mask = cardinalMask(wx, wy, kindAt, group)
  if (mask !== 15) return tileForMask(base, mask, null)
  const diag = { nw: true, ne: true, sw: true, se: true }
  for (let i = 0; i < DIAGONALS.length; i++) {
    const [dx, dy, name] = DIAGONALS[i]
    diag[name] = group.has(kindAt(wx + dx, wy + dy))
  }
  return tileForMask(base, mask, diag)
}

function deepWater(wx, wy, kindAt) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      if (!WATER.has(kindAt(wx + dx, wy + dy))) return false
    }
  }
  return true
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {(x:number,y:number)=>string} kindAt
 * @param {string} seed
 */
export function tileIndex(wx, wy, kindAt, seed) {
  const kind = kindAt(wx, wy)
  if (kind === 'wall') return TERRAIN.wall
  if (kind === 'thicket') return TERRAIN.thicket
  if (kind === 'ford' || kind === 'bridge') return TERRAIN.ford
  if (kind === 'roof' || kind === 'bwall') return TERRAIN.grass
  if (ROAD.has(kind)) return autotile(TERRAIN.dirt, wx, wy, kindAt, ROAD)
  if (COBBLE.has(kind)) return autotile(TERRAIN.cobble, wx, wy, kindAt, COBBLE)
  if (kind === 'water') {
    const id = autotile(TERRAIN.water, wx, wy, kindAt, WATER)
    if (id === pieceIndex(TERRAIN.water, 'c') && deepWater(wx, wy, kindAt)) return TERRAIN.waterDeep
    return id
  }
  // One base grass. Details are sparse and seeded, never a block of variants.
  if (unit(seed, wx, wy, 7) < 0.08) {
    return (mix(seed, wx, wy, 8) & 1) === 0 ? TERRAIN.grassDetail1 : TERRAIN.grassDetail2
  }
  return TERRAIN.grass
}

/** Mask string for every autotiled cell, so tests can list the combos in use. */
export function usedAutotileKey(wx, wy, kindAt) {
  const kind = kindAt(wx, wy)
  const group = groupFor(kind === 'gate' ? 'road' : kind)
  if (!group) return null
  const mask = cardinalMask(wx, wy, kindAt, group)
  if (mask !== 15) return `${kind}:${mask}`
  let extra = ''
  for (let i = 0; i < DIAGONALS.length; i++) {
    const [dx, dy, name] = DIAGONALS[i]
    if (!group.has(kindAt(wx + dx, wy + dy))) extra += name
  }
  return `${kind}:15:${extra}`
}
