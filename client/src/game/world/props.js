/**
 * Prop footprints. Trees collide on the stem only; the canopy is drawn
 * above the cell and has no collider. Footprints are the opaque body of
 * the Ninja Adventure sprite, not the sprite's full rectangle.
 */

import { T } from './tileCatalog.js'
import { TILE } from './metrics.js'

export const PROP_KINDS = {
  tree: {
    frames: [0, 1, 2, 3],
    tall: true,
    blocks: true,
    collision: { x: 5, y: 6, w: 6, h: 8 },
  },
  bush: {
    frames: [T.bush, T.bushB, T.bushC, T.bushD],
    blocks: true,
    collision: { x: 3, y: 6, w: 10, h: 8 },
  },
  rock: {
    frames: [T.rock, T.rockB, T.rockC, T.rockD],
    blocks: true,
    collision: { x: 3, y: 6, w: 10, h: 8 },
  },
  log: {
    frames: [T.log, T.logB, T.logC],
    sprites: [
      { col: 7, row: 8, tw: 1, th: 1 },
      { col: 1, row: 6, tw: 1, th: 1 },
      { col: 5, row: 8, tw: 2, th: 1 },
    ],
    blocks: true,
    collision: { x: 1, y: 8, w: 14, h: 6 },
  },
  fence: {
    frames: [T.fencePost, T.fenceE, T.fenceW],
    sprites: [
      { col: 6, row: 27, tw: 1, th: 1 },
      { col: 7, row: 27, tw: 1, th: 1 },
      { col: 20, row: 4, tw: 1, th: 1 },
    ],
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
  cart: {
    frames: [T.logC],
    sprites: [{ col: 5, row: 8, tw: 2, th: 1 }],
    blocks: true,
    collision: { x: 1, y: 8, w: 14, h: 6 },
  },
  campfire: {
    frames: [T.fungiB],
    sprites: [{ col: 0, row: 9, tw: 1, th: 1 }],
    blocks: false,
    collision: null,
  },
  hay: {
    frames: [T.fenceCorner],
    sprites: [{ col: 4, row: 8, tw: 1, th: 1 }],
    blocks: true,
    collision: { x: 2, y: 8, w: 12, h: 6 },
  },
  crate: {
    frames: [T.doorB],
    sprites: [{ col: 2, row: 6, tw: 1, th: 1 }],
    blocks: true,
    collision: { x: 2, y: 4, w: 12, h: 10 },
  },
  barrel: {
    frames: [T.logB],
    sprites: [{ col: 1, row: 6, tw: 1, th: 1 }],
    blocks: true,
    collision: { x: 3, y: 5, w: 10, h: 9 },
  },
  well: {
    frames: [T.milestoneB],
    sprites: [{ col: 4, row: 7, tw: 1, th: 1 }],
    blocks: true,
    collision: { x: 2, y: 4, w: 12, h: 10 },
  },
  lamp: {
    frames: [T.reed],
    sprites: [{ col: 10, row: 6, tw: 1, th: 1 }],
    blocks: false,
    collision: null,
  },
  sign: {
    frames: [T.sign],
    sprites: [{ col: 8, row: 6, tw: 1, th: 1 }],
    blocks: false,
    collision: null,
  },
  board: {
    frames: [T.board],
    sprites: [{ col: 9, row: 7, tw: 1, th: 1 }],
    blocks: false,
    collision: null,
  },
}

export const DECORATION_KINDS = new Set([
  'tree', 'bush', 'rock', 'log', 'fence', 'flower', 'mushroom',
  'cart', 'campfire', 'hay', 'crate', 'barrel', 'lamp', 'sign', 'board',
  'satchel', 'herb', 'cache', 'offering',
])

export function propSprite(kind, variant) {
  const def = PROP_KINDS[kind]
  if (def.sprites) return def.sprites[variant % def.sprites.length]
  const frame = def.frames[variant % def.frames.length]
  return { col: frame % 28, row: Math.floor(frame / 28), tw: 1, th: 1 }
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
