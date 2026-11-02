/**
 * Tile index map into the Ninja Adventure sheet (28 × 40).
 * Gameplay collision for terrain still comes from the kind (water, wall,
 * roof). These shapes are the trunk and prop footprints, plus the tileset
 * file the baker writes for Tiled.
 */

import { PACK_COLS, PACK_ROWS, cell } from './packMap.js'

export const SHEET_COLS = PACK_COLS
export const SHEET_ROWS = PACK_ROWS
export const TILE_COUNT = SHEET_COLS * SHEET_ROWS

export const T = {
  grass: cell(14, 15),
  plains: cell(12, 15),
  forest: cell(16, 16),
  water: cell(20, 8),
  road: cell(9, 32),
  cobble: cell(26, 4),
  ford: cell(19, 11),
  fordB: cell(20, 11),
  wall: cell(20, 1),
  wallB: cell(21, 1),
  wallC: cell(20, 0),
  wallD: cell(22, 0),
  gateL: cell(9, 32),
  gateR: cell(10, 33),
  bridgeH: cell(24, 8),
  bridgeHb: cell(25, 8),

  bridgeV: cell(24, 7),
  bridgeVb: cell(25, 7),
  thicket: cell(23, 11),
  roof: cell(0, 1),
  roofB: cell(1, 1),
  bwall: cell(0, 2),
  bwallB: cell(1, 2),
  door: cell(8, 3),
  milestone: cell(10, 7),
  fenceN: cell(16, 4),
  fenceE: cell(17, 4),
  fenceS: cell(18, 4),
  fenceW: cell(19, 4),
  fencePost: cell(6, 27),
  flower: cell(1, 8),
  flowerB: cell(4, 15),

  flowerC: cell(5, 15),
  mushroom: cell(0, 8),
  mushroomB: cell(2, 8),
  bush: cell(0, 6),
  bushB: cell(9, 8),
  bushC: cell(10, 8),
  bushD: cell(12, 8),
  rock: cell(1, 7),
  rockB: cell(0, 7),
  rockC: cell(8, 8),
  rockD: cell(8, 7),
  log: cell(7, 8),
  logB: cell(1, 6),
  grassB: cell(11, 16),
  grassC: cell(14, 16),
  plainsB: cell(13, 15),
  forestB: cell(10, 16),
  cobbleB: cell(27, 4),

  canopy0: cell(0, 10),
  canopy1: cell(3, 10),
  canopy2: cell(6, 10),
  canopy3: cell(9, 10),
  satchel: cell(11, 6),
  herb: cell(1, 8),
  cache: cell(3, 6),
  offering: cell(11, 6),
  sign: cell(8, 6),
  board: cell(9, 7),
  grassD: cell(15, 16),
  plainsC: cell(17, 15),
  forestC: cell(11, 17),
  cobbleC: cell(15, 7),
  pebble: cell(0, 7),
  reed: cell(10, 6),

  trunk0: cell(0, 11),
  trunk1: cell(3, 11),
  trunk2: cell(6, 11),
  trunk3: cell(9, 11),
  bushD2: cell(11, 8),
  rockE: cell(9, 8),
  fungi: cell(0, 9),
  fungiB: cell(0, 9),
  flowerD: cell(1, 8),
  fenceCorner: cell(4, 8),
  milestoneB: cell(4, 7),
  doorB: cell(2, 6),
  roofC: cell(2, 1),
  bwallC: cell(2, 2),
  thicketB: cell(24, 17),
  logC: cell(5, 8),
}

const FULL = { x: 0, y: 0, w: 16, h: 16 }

const SOLID = new Map([
  [T.water, { ...FULL }],
  [T.wall, { ...FULL }],
  [T.wallB, { ...FULL }],
  [T.wallC, { ...FULL }],
  [T.wallD, { ...FULL }],
  [T.thicket, { ...FULL }],
  [T.thicketB, { ...FULL }],
  [T.roof, { ...FULL }],
  [T.roofB, { ...FULL }],
  [T.roofC, { ...FULL }],
  [T.bwall, { ...FULL }],
  [T.bwallB, { ...FULL }],
  [T.bwallC, { ...FULL }],
])

/**
 * Trunk cells are the dirt base of a round tree. The brown oval is ground;
 * the collider is the stem in the middle of that base, not the 16×16 box.
 */
const TRUNK = { x: 5, y: 5, w: 6, h: 9 }

const PARTIAL = new Map([
  [T.trunk0, TRUNK],
  [T.trunk1, TRUNK],
  [T.trunk2, TRUNK],
  [T.trunk3, TRUNK],
  [T.bush, { x: 3, y: 4, w: 10, h: 10 }],
  [T.bushB, { x: 2, y: 4, w: 12, h: 10 }],
  [T.bushC, { x: 2, y: 4, w: 12, h: 10 }],
  [T.bushD, { x: 3, y: 5, w: 10, h: 9 }],
  [T.rock, { x: 2, y: 5, w: 12, h: 9 }],
  [T.rockB, { x: 3, y: 5, w: 10, h: 9 }],
  [T.rockC, { x: 2, y: 6, w: 12, h: 8 }],
  [T.rockD, { x: 3, y: 6, w: 10, h: 8 }],
  [T.log, { x: 1, y: 6, w: 14, h: 8 }],
  [T.logB, { x: 2, y: 4, w: 12, h: 10 }],
  [T.logC, { x: 1, y: 6, w: 14, h: 8 }],
  [T.milestone, { x: 4, y: 1, w: 8, h: 14 }],
  [T.milestoneB, { x: 2, y: 3, w: 12, h: 11 }],
  [T.fenceN, { x: 0, y: 4, w: 16, h: 8 }],
  [T.fenceS, { x: 0, y: 4, w: 16, h: 8 }],
  [T.fenceE, { x: 6, y: 2, w: 6, h: 12 }],
  [T.fenceW, { x: 4, y: 2, w: 6, h: 12 }],
  [T.fencePost, { x: 6, y: 3, w: 8, h: 12 }],
  [T.fenceCorner, { x: 2, y: 6, w: 12, h: 8 }],
  [T.doorB, { x: 2, y: 3, w: 12, h: 11 }],
])

/** @returns {{x:number,y:number,w:number,h:number}|null} tile-local collision */
export function collisionForTile(index) {
  if (SOLID.has(index)) return SOLID.get(index)
  if (PARTIAL.has(index)) return PARTIAL.get(index)
  return null
}

export const PASSABLE_KINDS = new Set([
  'grass', 'plains', 'forest', 'road', 'cobble', 'ford', 'gate', 'bridge',
])

export function isPassableKind(kind) {
  return PASSABLE_KINDS.has(kind)
}

/**
 * Forest is 6/8 of road pace. Open grass and plains use road pace:
 * the lore states a forest day and a road day, and does not give a
 * separate plains figure (guess, noted in the PR).
 */
export function speedFactor(kind) {
  if (kind === 'forest') return 6 / 8
  return 1
}
