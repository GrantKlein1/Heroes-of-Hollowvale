/**
 * Overworld connectivity graph — Phase 0 stub.
 *
 * Track C owns the real node table and neighbor helpers.
 * Exit value = neighbor node id, or null if that edge is closed.
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

/** @type {WorldNode[]} */
export const WORLD_NODES = [
  {
    id: 'wild_0_0',
    biome: 'plains',
    exits: { north: null, south: 'wild_0_1', east: 'wild_1_0', west: null },
  },
  {
    id: 'wild_0_1',
    biome: 'emberwood_forest',
    exits: { north: 'wild_0_0', south: 'wild_0_2', east: 'wild_1_1', west: null },
  },
  {
    id: 'wild_0_2',
    biome: 'emberwood_forest',
    exits: { north: 'wild_0_1', south: null, east: 'wild_1_2', west: null },
  },
  {
    id: 'wild_1_0',
    biome: 'plains',
    exits: { north: null, south: 'wild_1_1', east: null, west: 'wild_0_0' },
  },
  {
    id: 'wild_1_1',
    biome: 'ashen_wastes',
    exits: { north: 'wild_1_0', south: 'wild_1_2', east: null, west: 'wild_0_1' },
  },
  {
    id: 'wild_1_2',
    biome: 'ashen_wastes',
    exits: { north: 'wild_1_1', south: null, east: null, west: 'wild_0_2' },
  },
]

const byId = new Map(WORLD_NODES.map((n) => [n.id, n]))

/** Hub entrance node — Track D wires an existing scene exit into this id. */
export const WILDERNESS_ENTRANCE_ID = 'wild_0_0'

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
