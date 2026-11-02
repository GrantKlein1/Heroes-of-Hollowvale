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

/** One grass. Detail tiles are the same field with a flower or tuft, used rarely. */
export const GRASS_BASE = cell(14, 16)
const GRASS_DETAIL = [cell(14, 15), cell(19, 17)]

const COBBLE_FILL = [cell(16, 32), cell(17, 33)]
/** Stone-path edges, same layout as the sand road shifted seven columns. */
const COBBLE_EDGE = {
  15: null,
  7: cell(15, 32),
  13: cell(18, 32),
  14: cell(16, 31),
  11: cell(16, 33),
  6: cell(15, 31),
  12: cell(18, 31),
  3: cell(15, 33),
  9: cell(18, 33),
  5: null,
  10: null,
  1: cell(16, 33),
  4: cell(16, 31),
  2: cell(15, 32),
  8: cell(18, 32),
  0: null,
}

const ROAD_FILL = [cell(9, 32), cell(10, 33)]

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

/**
 * Full tree sprites, pixel rects on the sheet. Each one is a complete
 * tree (or a joined grove), not a quadrant of a larger drawing.
 */
export const TREES = [
  { name: 'pine', x: 96, y: 144, w: 32, h: 48 },
]

/** Complete houses. wx/wy is the bottom-left tile the sprite sits on. */
export const BUILDINGS = [
  { name: 'flagon', x: 0, y: 0, w: 64, h: 48, wx: 8, wy: 3 },
  { name: 'market', x: 64, y: 0, w: 64, h: 48, wx: 2, wy: 5 },
  { name: 'east', x: 128, y: 0, w: 64, h: 48, wx: 13, wy: 4 },
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
  if (hash % 11 === 0) return GRASS_DETAIL[0]
  if (hash % 13 === 0) return GRASS_DETAIL[1]
  return GRASS_BASE
}

export function cobbleTile(mask, hash) {
  const edge = COBBLE_EDGE[mask]
  if (edge == null) return variant(COBBLE_FILL, hash)
  return edge
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
/** Roof and wall cells stay walk-blocked. The picture is the full house sprite. */
export function buildingCell() {
  return GRASS_BASE
}

export function wallTile(wx, wy) {
  const horizontal = wy === 1 || wy === 10
  const vertical = wx === 1 || wx === 18
  if (horizontal && vertical) return cell(19, 0)
  if (horizontal) return wx % 2 === 0 ? cell(20, 1) : cell(21, 1)
  return wy % 2 === 0 ? cell(20, 0) : cell(21, 0)
}

function pushIndex(out, name, index) {
  if (index == null) return
  out.push({
    name,
    x: (index % PACK_COLS) * 16,
    y: Math.floor(index / PACK_COLS) * 16,
    w: 16,
    h: 16,
  })
}

/** Every sheet rect the overworld actually draws. The atlas test rejects empty and solid-black cells. */
export function auditRects() {
  const out = []
  pushIndex(out, 'grass', GRASS_BASE)
  for (const index of GRASS_DETAIL) pushIndex(out, 'grass-detail', index)
  for (const index of ROAD_FILL) pushIndex(out, 'road-fill', index)
  for (const [mask, index] of Object.entries(ROAD_EDGE)) pushIndex(out, `road-${mask}`, index)
  for (const index of COBBLE_FILL) pushIndex(out, 'cobble-fill', index)
  for (const [mask, index] of Object.entries(COBBLE_EDGE)) pushIndex(out, `cobble-${mask}`, index)
  for (const [mask, index] of Object.entries(SHORE)) pushIndex(out, `shore-${mask}`, index)
  pushIndex(out, 'water', cell(WATER_COL, WATER_ROW))
  pushIndex(out, 'ford', cell(19, 11))
  pushIndex(out, 'ford-b', cell(18, 11))
  pushIndex(out, 'bridge', cell(24, 8))
  pushIndex(out, 'bridge-b', cell(25, 8))
  pushIndex(out, 'wall-n', cell(20, 1))
  pushIndex(out, 'wall-n2', cell(21, 1))
  pushIndex(out, 'wall-post', cell(20, 0))
  pushIndex(out, 'wall-corner', cell(19, 0))
  pushIndex(out, 'thicket', cell(23, 11))
  for (const tree of TREES) out.push({ name: `tree-${tree.name}`, x: tree.x, y: tree.y, w: tree.w, h: tree.h })
  for (const house of BUILDINGS) out.push({ name: `house-${house.name}`, x: house.x, y: house.y, w: house.w, h: house.h })
  return out
}
