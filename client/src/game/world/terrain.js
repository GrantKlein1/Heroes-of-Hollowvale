/**
 * World-cell kinds. Pure function of (seed, wx, wy).
 * Rim brakes, the Ember Road, and the Bracken are continuous across leagues.
 * Stamps only replace interiors.
 */

import {
  MAX_WX, MAX_WY, MIN_WX, MIN_WY, WORLD_SEED, unit,
} from './metrics.js'
import { isRoad, riverKind } from './roads.js'
import { stampKind } from './stamps.js'

function rimKind(wx, wy) {
  if (wy <= MIN_WY + 1 || wy >= MAX_WY - 1) return 'thicket'
  if (wx <= MIN_WX + 1) return 'thicket'
  if (wx >= MAX_WX - 1) return 'water'
  // The west-northwest exit stops in a brake. The road itself ends at wx -4.
  if (wx === -6 && wy >= 44 && wy <= 51) return 'thicket'
  if (wx === -5 && wy >= 45 && wy <= 49) return 'thicket'
  return null
}

function biomeKind(wx, wy, seed) {
  const dx = 9.5 - wx
  const h = unit(seed, wx, wy, 1)
  const south = Math.max(0, Math.min(1, (wy - 11) / 44))
  if (dx >= 6) return h < 0.82 ? 'forest' : 'grass'
  if (dx >= 3) {
    const t = (dx - 3) / 3 + south * 0.12
    return h < t ? 'forest' : 'grass'
  }
  if (dx <= -5) return h < 0.78 ? 'plains' : 'grass'
  if (dx <= -2) {
    const t = (-dx - 2) / 3
    return h < t ? 'plains' : 'grass'
  }
  return 'grass'
}

export function computeKind(wx, wy, seed = WORLD_SEED) {
  const rim = rimKind(wx, wy)
  if (rim) return rim
  const stamped = stampKind(wx, wy)
  if (stamped) return stamped
  if (isRoad(wx, wy)) return 'road'
  const river = riverKind(wx, wy)
  if (river) return river
  return biomeKind(wx, wy, seed)
}
