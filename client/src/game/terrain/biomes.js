/**
 * Biome recipes for wilderness screens.
 * Object ids reference __fixtures__/fixtureManifest.js until Track A lands.
 *
 * @typedef {{
 *   id: string,
 *   groundTileId: string,
 *   pathTileId?: string,
 *   objectDensity: number,
 *   palette: string[],
 *   allowedObjectIds: string[]
 * }} BiomeRecipe
 */

/** @type {Record<string, BiomeRecipe>} */
export const BIOMES = {
  emberwood_forest: {
    id: 'emberwood_forest',
    groundTileId: 'fixture_grass',
    pathTileId: 'fixture_dirt',
    objectDensity: 0.42,
    palette: ['#1e3314', '#2d4a1e', '#4a6b2f', '#6b3a1a'],
    allowedObjectIds: ['fixture_tree', 'fixture_rock', 'fixture_bush'],
  },
  ashen_wastes: {
    id: 'ashen_wastes',
    groundTileId: 'fixture_dirt',
    pathTileId: 'fixture_dirt',
    objectDensity: 0.18,
    palette: ['#3d3830', '#5a5348', '#7a6f60', '#2a2620'],
    allowedObjectIds: ['fixture_rock'],
  },
  plains: {
    id: 'plains',
    groundTileId: 'fixture_grass',
    pathTileId: 'fixture_dirt',
    objectDensity: 0.22,
    palette: ['#3d6b28', '#5a8a3a', '#7aaa4a', '#c4b896'],
    allowedObjectIds: ['fixture_bush', 'fixture_rock'],
  },
}

/**
 * @param {string} id
 * @returns {BiomeRecipe}
 */
export function getBiome(id) {
  const b = BIOMES[id]
  if (!b) throw new Error(`Unknown biome: ${id}`)
  return b
}
