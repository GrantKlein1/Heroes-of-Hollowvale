/**
 * Overworld connectivity.
 *
 * The wilderness is unbounded: node ids encode integer grid coordinates and
 * neighbors are derived arithmetically, so any direction always yields another
 * wilderness screen. The single exception is the entrance node's north edge,
 * which is reserved for the return trip to the hub scene.
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

import { hashSeed } from './rng.js'

/** Hub entrance node — reached from the dungeon entrance scene. */
export const WILDERNESS_ENTRANCE_ID = 'wild_0_0'

const BIOME_ORDER = ['plains', 'emberwood_forest', 'ashen_wastes']

/** @param {number} col @param {number} row @returns {string} */
export function nodeIdAt(col, row) {
  return `wild_${col}_${row}`
}

/** @param {string} id @returns {{ col: number, row: number }|null} */
function parseId(id) {
  const m = /^wild_(-?\d+)_(-?\d+)$/.exec(String(id ?? ''))
  if (!m) return null
  return { col: Number(m[1]), row: Number(m[2]) }
}

/** @param {string} id @returns {string} */
export function biomeFor(id) {
  return BIOME_ORDER[hashSeed(`biome:${id}`) % BIOME_ORDER.length]
}

/** Sample of the grid kept for tooling/tests that expect a node list. */
export const WORLD_NODES = [0, 1, 2].flatMap((col) =>
  [0, 1].map((row) => buildNode(nodeIdAt(col, row)))
)

/** @param {string} id @returns {WorldNode} */
function buildNode(id) {
  const at = parseId(id)
  if (!at) {
    return { id: WILDERNESS_ENTRANCE_ID, biome: biomeFor(WILDERNESS_ENTRANCE_ID), exits: {} }
  }
  const { col, row } = at
  const isEntrance = id === WILDERNESS_ENTRANCE_ID
  return {
    id,
    biome: biomeFor(id),
    exits: {
      // Entrance north leads back to the hub scene, not to another screen.
      north: isEntrance ? null : nodeIdAt(col, row - 1),
      south: nodeIdAt(col, row + 1),
      east: nodeIdAt(col + 1, row),
      west: nodeIdAt(col - 1, row),
    },
  }
}

/** @param {string} id @returns {WorldNode|undefined} */
export function getNode(id) {
  return parseId(id) ? buildNode(id) : undefined
}

/**
 * @param {string} id
 * @returns {{ north: string|null, south: string|null, east: string|null, west: string|null }}
 */
export function getNeighbors(id) {
  const node = getNode(id)
  if (!node) return { north: null, south: null, east: null, west: null }
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
