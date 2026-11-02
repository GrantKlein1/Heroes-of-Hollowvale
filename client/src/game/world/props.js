/**
 * Prop footprints. Sprites are whole images from the Zelda-like pack
 * (or authored in that palette). Collision is the measured body in the
 * anchor tile: a tree blocks on the stem, a canopy does not.
 */

import { TILE } from './metrics.js'
import { SPRITES } from './spriteManifest.js'

export const PROP_KINDS = {}
for (const [kind, spec] of Object.entries(SPRITES)) {
  if (!spec.prop) continue
  PROP_KINDS[kind] = {
    frames: [0],
    blocks: !!spec.blocks,
    tall: !!spec.tall,
    collision: spec.collision,
    sprite: kind,
  }
}

export const DECORATION_KINDS = new Set([
  'tree', 'bush', 'rock', 'log', 'fence', 'flower', 'mushroom',
  'cart', 'campfire', 'hay', 'crate', 'barrel', 'lamp', 'sign', 'board',
  'satchel', 'herb', 'cache', 'offering',
])

export function propRect(prop) {
  const def = PROP_KINDS[prop.kind]
  if (!def?.collision) return null
  const c = def.collision
  return {
    x: prop.wx * TILE + c.x,
    y: prop.wy * TILE + c.y,
    w: c.w,
    h: c.h,
  }
}

export function containsPoint(rect, x, y) {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h
}
