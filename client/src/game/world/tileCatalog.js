/**
 * Tile index map for the 16×16 hollowvale sheet (16 columns × 16 rows).
 * Dual-grid transition sets occupy one row each, column = 4-bit corner mask.
 */

export const SHEET_COLS = 16
export const SHEET_ROWS = 16
export const TILE_COUNT = SHEET_COLS * SHEET_ROWS

function at(col, row) {
  return row * SHEET_COLS + col
}

export const T = {
  grass: at(0, 0),
  plains: at(1, 0),
  forest: at(2, 0),
  water: at(3, 0),
  road: at(4, 0),
  cobble: at(5, 0),
  ford: at(6, 0),
  fordB: at(7, 0),
  wall: at(8, 0),
  wallB: at(9, 0),
  wallC: at(10, 0),
  wallD: at(11, 0),
  gateL: at(12, 0),
  gateR: at(13, 0),
  bridgeH: at(14, 0),
  bridgeHb: at(15, 0),

  bridgeV: at(0, 1),
  bridgeVb: at(1, 1),
  thicket: at(2, 1),
  roof: at(3, 1),
  roofB: at(4, 1),
  bwall: at(5, 1),
  bwallB: at(6, 1),
  door: at(7, 1),
  milestone: at(8, 1),
  fenceN: at(9, 1),
  fenceE: at(10, 1),
  fenceS: at(11, 1),
  fenceW: at(12, 1),
  fencePost: at(13, 1),
  flower: at(14, 1),
  flowerB: at(15, 1),

  flowerC: at(0, 2),
  mushroom: at(1, 2),
  mushroomB: at(2, 2),
  bush: at(3, 2),
  bushB: at(4, 2),
  bushC: at(5, 2),
  rock: at(6, 2),
  rockB: at(7, 2),
  rockC: at(8, 2),
  log: at(9, 2),
  logB: at(10, 2),
  grassB: at(11, 2),
  grassC: at(12, 2),
  plainsB: at(13, 2),
  forestB: at(14, 2),
  cobbleB: at(15, 2),

  canopy0: at(0, 3),
  canopy1: at(1, 3),
  canopy2: at(2, 3),
  canopy3: at(3, 3),
  satchel: at(4, 3),
  herb: at(5, 3),
  cache: at(6, 3),
  offering: at(7, 3),
  sign: at(8, 3),
  board: at(9, 3),
  grassD: at(10, 3),
  plainsC: at(11, 3),
  forestC: at(12, 3),
  cobbleC: at(13, 3),
  pebble: at(14, 3),
  reed: at(15, 3),

  trunk0: at(0, 4),
  trunk1: at(1, 4),
  trunk2: at(2, 4),
  trunk3: at(3, 4),
  bushD: at(4, 4),
  rockD: at(5, 4),
  fungi: at(6, 4),
  fungiB: at(7, 4),
  flowerD: at(8, 4),
  fenceCorner: at(9, 4),
  milestoneB: at(10, 4),
  doorB: at(11, 4),
  roofC: at(12, 4),
  bwallC: at(13, 4),
  thicketB: at(14, 4),
  logC: at(15, 4),
}

/** Row index of each 16-tile dual-grid pair. Column = corner mask. */
export const DUAL_ROWS = {
  road_grass: 5,
  road_forest: 6,
  road_plains: 7,
  road_cobble: 8,
  forest_grass: 9,
  forest_plains: 10,
  water_grass: 11,
  water_forest: 12,
  water_plains: 13,
  plains_grass: 14,
  cobble_grass: 15,
}

export function dualTile(pair, mask) {
  const row = DUAL_ROWS[pair]
  if (row == null) throw new Error(`unknown dual pair ${pair}`)
  return row * SHEET_COLS + (mask & 15)
}

export const TREE_FRAMES = [0, 1, 2, 3]

const FULL = { x: 0, y: 0, w: 16, h: 16 }

function fullSolid(ids) {
  const out = new Map()
  for (const id of ids) out.set(id, { ...FULL })
  return out
}

const SOLID = fullSolid([
  T.water, T.wall, T.wallB, T.wallC, T.wallD, T.thicket, T.thicketB,
  T.roof, T.roofB, T.roofC, T.bwall, T.bwallB, T.bwallC,
])

const PARTIAL = new Map([
  [T.trunk0, { x: 4, y: 6, w: 8, h: 10 }],
  [T.trunk1, { x: 4, y: 6, w: 8, h: 10 }],
  [T.trunk2, { x: 5, y: 6, w: 7, h: 10 }],
  [T.trunk3, { x: 4, y: 5, w: 8, h: 11 }],
  [T.bush, { x: 3, y: 6, w: 10, h: 9 }],
  [T.bushB, { x: 2, y: 7, w: 12, h: 8 }],
  [T.bushC, { x: 3, y: 6, w: 10, h: 9 }],
  [T.bushD, { x: 4, y: 7, w: 8, h: 8 }],
  [T.rock, { x: 2, y: 5, w: 12, h: 10 }],
  [T.rockB, { x: 3, y: 4, w: 11, h: 11 }],
  [T.rockC, { x: 2, y: 6, w: 12, h: 9 }],
  [T.rockD, { x: 4, y: 5, w: 9, h: 10 }],
  [T.log, { x: 1, y: 8, w: 14, h: 6 }],
  [T.logB, { x: 1, y: 8, w: 14, h: 6 }],
  [T.logC, { x: 0, y: 7, w: 16, h: 6 }],
  [T.milestone, { x: 4, y: 2, w: 8, h: 14 }],
  [T.milestoneB, { x: 5, y: 2, w: 7, h: 14 }],
  [T.fenceN, { x: 0, y: 3, w: 16, h: 6 }],
  [T.fenceS, { x: 0, y: 7, w: 16, h: 6 }],
  [T.fenceE, { x: 8, y: 2, w: 6, h: 14 }],
  [T.fenceW, { x: 2, y: 2, w: 6, h: 14 }],
  [T.fencePost, { x: 5, y: 2, w: 6, h: 14 }],
  [T.fenceCorner, { x: 2, y: 2, w: 12, h: 12 }],
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
