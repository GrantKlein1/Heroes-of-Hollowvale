/**
 * Cell map for the Ninja Adventure tileset (Pixel-Boy & AAA, CC0).
 * Sheet is 28 × 40 tiles of 16px: client/public/maps/ninja-adventure/tileset.png.
 * Indices are row-major. Road edges, pond shores, and trees are cells from
 * that sheet, not repainted pixels.
 */

export const PACK_COLS = 28
export const PACK_ROWS = 40

export function cell(col, row) {
  return row * PACK_COLS + col
}

export const WATER_COL = 20
export const WATER_ROW = 8

const GRASS = [cell(14, 16), cell(22, 11), cell(19, 17), cell(14, 15)]
const PLAINS = [cell(14, 16), cell(22, 11), cell(19, 17), cell(14, 16)]
const FOREST = [cell(23, 11), cell(24, 17), cell(23, 11), cell(24, 17)]
const COBBLE = [cell(16, 32), cell(17, 33), cell(26, 4)]

const ROAD_FILL = [cell(9, 32), cell(10, 33), cell(9, 32), cell(9, 32)]

/** Cardinal mask: N=1, E=2, S=4, W=8. Bit set means that neighbor is road. */
const ROAD_EDGE = {
  15: null,
  7: cell(8, 32),
  13: cell(11, 32),
  14: cell(9, 31),
  11: cell(9, 33),
  6: cell(8, 31),
  12: cell(11, 31),
  3: cell(8, 33),
  9: cell(11, 33),
  5: null,
  10: null,
  1: cell(9, 33),
  4: cell(9, 31),
  2: cell(8, 32),
  8: cell(11, 32),
  0: null,
}

/**
 * Shore tiles sit on the land cell. The key is which sides of that cell
 * are deep water (N=1, E=2, S=4, W=8).
 */
const SHORE = {
  4: cell(20, 6),
  1: cell(20, 10),
  2: cell(18, 8),
  8: cell(22, 8),
  6: cell(18, 6),
  12: cell(22, 6),
  3: cell(18, 10),
  9: cell(22, 10),
  5: cell(20, 6),
  10: cell(18, 8),
  7: cell(18, 6),
  13: cell(22, 6),
  14: cell(18, 6),
  11: cell(18, 10),
  15: cell(20, 8),
}

export const TREES = [
  { col: 0, row: 10, tw: 2, th: 2 },
  { col: 3, row: 10, tw: 2, th: 2 },
  { col: 6, row: 10, tw: 2, th: 2 },
  { col: 9, row: 10, tw: 2, th: 2 },
]

/** Cells whose transparent pixels are filled with grass so roofs and posts don't punch holes. */
export const UNDERPAINT = []
for (let row = 0; row <= 2; row++) {
  for (let col = 0; col <= 15; col++) UNDERPAINT.push([col, row])
}
for (let row = 0; row <= 1; row++) {
  for (let col = 19; col <= 24; col++) UNDERPAINT.push([col, row])
}

export function variant(list, hash) {
  return list[hash % list.length]
}

export function grassTile(hash) {
  return variant(GRASS, hash)
}

export function plainsTile(hash) {
  return variant(PLAINS, hash)
}

export function forestTile(hash) {
  return variant(FOREST, hash)
}

export function cobbleTile(hash) {
  return variant(COBBLE, hash)
}

export function roadTile(mask, hash) {
  const edge = ROAD_EDGE[mask]
  if (edge == null) return variant(ROAD_FILL, hash)
  return edge
}

export function shoreTile(mask) {
  return SHORE[mask] ?? null
}

/**
 * Cottage slices. Flagon is the full 4-wide house; the market and east
 * cottage are 3 columns of the neighboring houses.
 */
export function buildingCell(wx, wy) {
  if (wx >= 8 && wx <= 11 && (wy === 2 || wy === 3)) {
    const row = wy === 2 ? 1 : 2
    return cell(wx - 8, row)
  }
  if (wx >= 2 && wx <= 4 && wy >= 3 && wy <= 5) {
    return cell(4 + (wx - 2), wy - 3)
  }
  if (wx >= 13 && wx <= 15 && (wy === 3 || wy === 4)) {
    const row = wy === 3 ? 1 : 2
    return cell(8 + (wx - 13), row)
  }
  return cell(0, 2)
}

export function wallTile(wx, wy) {
  const horizontal = wy === 1 || wy === 10
  const vertical = wx === 1 || wx === 18
  if (horizontal && vertical) return cell(19, 0)
  if (horizontal) return wx % 2 === 0 ? cell(20, 1) : cell(21, 1)
  return wy % 2 === 0 ? cell(20, 0) : cell(21, 0)
}
