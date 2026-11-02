/**
 * Picks a Ninja Adventure cell for a world tile.
 * Roads use the pack's sand-path edge tiles (cardinal mask).
 * Deep water is the pond center; the bank tiles sit on the land beside it.
 * Cottages are slices of the sheet's houses, aligned to the stamp.
 */

import { mix } from './metrics.js'
import { T } from './tileCatalog.js'
import {
  buildingCell,
  cobbleTile,
  grassTile,
  roadTile,
  shoreTile,
  wallTile,
} from './packMap.js'

const ROAD_LIKE = new Set(['road', 'gate'])

function roadMask(wx, wy, kindAt) {
  let mask = 0
  if (ROAD_LIKE.has(kindAt(wx, wy - 1))) mask |= 1
  if (ROAD_LIKE.has(kindAt(wx + 1, wy))) mask |= 2
  if (ROAD_LIKE.has(kindAt(wx, wy + 1))) mask |= 4
  if (ROAD_LIKE.has(kindAt(wx - 1, wy))) mask |= 8
  return mask
}

function cobbleMask(wx, wy, kindAt) {
  const stone = (x, y) => kindAt(x, y) === 'cobble'
  let mask = 0
  if (stone(wx, wy - 1)) mask |= 1
  if (stone(wx + 1, wy)) mask |= 2
  if (stone(wx, wy + 1)) mask |= 4
  if (stone(wx - 1, wy)) mask |= 8
  return mask
}

function waterMask(wx, wy, kindAt) {
  const deep = (x, y) => kindAt(x, y) === 'water'
  let mask = 0
  if (deep(wx, wy - 1)) mask |= 1
  if (deep(wx + 1, wy)) mask |= 2
  if (deep(wx, wy + 1)) mask |= 4
  if (deep(wx - 1, wy)) mask |= 8
  return mask
}

function dedicated(kind, wx, wy, seed) {
  const h = mix(seed, wx, wy, 3)
  if (kind === 'gate') return h % 2 === 0 ? T.gateL : T.gateR
  if (kind === 'ford') return h % 2 === 0 ? T.ford : T.fordB
  if (kind === 'bridge') return wx % 2 === 0 ? T.bridgeH : T.bridgeHb
  if (kind === 'wall') return wallTile(wx, wy)
  if (kind === 'thicket') return h % 2 === 0 ? T.thicket : T.thicketB
  if (kind === 'roof' || kind === 'bwall') return buildingCell(wx, wy)
  return T.grass
}

const STRUCTURAL = new Set(['wall', 'thicket', 'roof', 'bwall', 'gate', 'ford', 'bridge'])

/**
 * @param {number} wx
 * @param {number} wy
 * @param {(x:number,y:number)=>string} kindAt
 * @param {string} seed
 */
export function tileIndex(wx, wy, kindAt, seed) {
  const kind = kindAt(wx, wy)
  if (STRUCTURAL.has(kind)) return dedicated(kind, wx, wy, seed)
  if (kind === 'road') return roadTile(roadMask(wx, wy, kindAt), mix(seed, wx, wy, 7))
  if (kind === 'water') return T.water
  if (kind === 'cobble') return cobbleTile(cobbleMask(wx, wy, kindAt), mix(seed, wx, wy, 7))
  const bank = waterMask(wx, wy, kindAt)
  if (bank !== 0) {
    const shore = shoreTile(bank)
    if (shore != null) return shore
  }
  // Forest, plains, and meadow share one grass. The wood edge is the
  // trees and bushes placed on it, not a darker ground block.
  return grassTile(mix(seed, wx, wy, 7))
}
