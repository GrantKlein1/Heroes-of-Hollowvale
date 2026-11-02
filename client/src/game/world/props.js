/**
 * Prop footprints. Trees collide on the trunk only; the canopy is the tile
 * above and is drawn as part of a 16×32 sprite with no collision of its own.
 */

import { T } from './tileCatalog.js'
import { TILE } from './metrics.js'

export const PROP_KINDS = {
  tree: {
    frames: [0, 1, 2, 3],
    tall: true,
    blocks: true,
    collision: { x: 4, y: 6, w: 8, h: 10 },
  },
  bush: {
    frames: [T.bush, T.bushB, T.bushC, T.bushD],
    blocks: true,
    collision: { x: 3, y: 6, w: 10, h: 9 },
  },
  rock: {
    frames: [T.rock, T.rockB, T.rockC, T.rockD],
    blocks: true,
    collision: { x: 2, y: 5, w: 12, h: 10 },
  },
  log: {
    frames: [T.log, T.logB, T.logC],
    blocks: true,
    collision: { x: 1, y: 8, w: 14, h: 6 },
  },
  fence: {
    frames: [T.fenceE, T.fenceW, T.fencePost],
    blocks: true,
    collision: { x: 4, y: 3, w: 8, h: 12 },
  },
  milestone: {
    frames: [T.milestone, T.milestoneB],
    blocks: true,
    collision: { x: 4, y: 2, w: 8, h: 14 },
  },
  flower: {
    frames: [T.flower, T.flowerB, T.flowerC, T.flowerD],
    blocks: false,
    collision: null,
  },
  mushroom: {
    frames: [T.mushroom, T.mushroomB, T.fungi, T.fungiB],
    blocks: false,
    collision: null,
  },
  satchel: { frames: [T.satchel], blocks: false, collision: null },
  herb: { frames: [T.herb], blocks: false, collision: null },
  cache: { frames: [T.cache], blocks: false, collision: null },
  offering: { frames: [T.offering], blocks: false, collision: null },
}

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
