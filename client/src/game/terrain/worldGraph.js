/**
 * Overworld connectivity graph — Track C.
 *
 * Grid is authored as biome cells; N/S/E/W edges are derived so every open
 * edge is bidirectional. Exit value = neighbor node id, or null if closed.
 *
 * @typedef {{
 *   id: string,
 *   biome: string,
 *   exits: {
 *     north?: string|null,
 *     south?: string|null,
 *     east?: string|null,
 *     west?: string|null
 *   }
 * }} WorldNode
 */

/** Hub entrance node — Track D wires an existing scene exit into this id. */
export const WILDERNESS_ENTRANCE_ID = 'wild_0_0'

/**
 * Biome grid: rows = southward, cols = eastward.
 * Cell id is `wild_${col}_${row}` so entrance (0,0) sits NW.
 *
 * Band layout:
 *   row 0 — plains fringe near the hub
 *   row 1 — emberwood forest belt
 *   row 2 — ashen wastes frontier
 */
const BIOME_GRID = [
  ['plains', 'plains', 'plains'],
  ['emberwood_forest', 'ashen_wastes', 'emberwood_forest'],
  ['emberwood_forest', 'ashen_wastes', 'ashen_wastes'],
]

const ROWS = BIOME_GRID.length
const COLS = BIOME_GRID[0].length

function cellId(col, row) {
  return `wild_${col}_${row}`
}

/**
 * Build a fully linked WorldNode table from BIOME_GRID.
 * Interior edges always open both ways; outer borders stay closed (null).
 * @returns {WorldNode[]}
 */
function buildWorldNodes() {
  /** @type {WorldNode[]} */
  const nodes = []

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const biome = BIOME_GRID[row][col]
      nodes.push({
        id: cellId(col, row),
        biome,
        exits: {
          north: row > 0 ? cellId(col, row - 1) : null,
          south: row < ROWS - 1 ? cellId(col, row + 1) : null,
          west: col > 0 ? cellId(col - 1, row) : null,
          east: col < COLS - 1 ? cellId(col + 1, row) : null,
        },
      })
    }
  }

  return nodes
}

/** @type {WorldNode[]} */
export const WORLD_NODES = buildWorldNodes()

const byId = new Map(WORLD_NODES.map((n) => [n.id, n]))

/** @param {string} id @returns {WorldNode|undefined} */
export function getNode(id) {
  return byId.get(id)
}

/**
 * @param {string} id
 * @returns {{ north: string|null, south: string|null, east: string|null, west: string|null }}
 */
export function getNeighbors(id) {
  const node = byId.get(id)
  if (!node) {
    return { north: null, south: null, east: null, west: null }
  }
  return {
    north: node.exits.north ?? null,
    south: node.exits.south ?? null,
    east: node.exits.east ?? null,
    west: node.exits.west ?? null,
  }
}

/**
 * @param {'north'|'south'|'east'|'west'} edge
 * @returns {'north'|'south'|'east'|'west'}
 */
export function oppositeEdge(edge) {
  const map = { north: 'south', south: 'north', east: 'west', west: 'east' }
  const opp = map[edge]
  if (!opp) throw new Error(`oppositeEdge: invalid edge ${edge}`)
  return opp
}
