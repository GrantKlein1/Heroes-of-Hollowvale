/**
 * Biome recipes. Ground/path/object ids must resolve against
 * `client/src/config/terrainAssets.js` or the renderer falls back to flat fills.
 *
 * @typedef {{
 *   id: string,
 *   groundTileId: string,
 *   pathTileId?: string,
 *   grassVariants?: string[],
 *   objectDensity: number,
 *   palette: string[],
 *   allowedObjectIds: string[]
 * }} BiomeRecipe
 */

const GRASS_VARIANTS = ['grass_version1', 'grass_version2']

/** @type {Record<string, BiomeRecipe>} */
export const BIOMES = {
  emberwood_forest: {
    id: 'emberwood_forest',
    groundTileId: 'grass_version1',
    pathTileId: 'path_top_bottom',
    grassVariants: GRASS_VARIANTS,
    objectDensity: 0.35,
    palette: ['#2d4a1e', '#1a2e12', '#4a6b2f'],
    allowedObjectIds: ['tree', 'rock', 'bush'],
  },
  ashen_wastes: {
    id: 'ashen_wastes',
    groundTileId: 'grass_version2',
    pathTileId: 'path_top_bottom',
    grassVariants: GRASS_VARIANTS,
    objectDensity: 0.2,
    palette: ['#5a5348', '#3d3830', '#7a6f60'],
    allowedObjectIds: ['rock'],
  },
  plains: {
    id: 'plains',
    groundTileId: 'grass_version1',
    pathTileId: 'path_top_bottom',
    grassVariants: GRASS_VARIANTS,
    objectDensity: 0.15,
    palette: ['#5a8a3a', '#7aaa4a', '#3d6b28'],
    allowedObjectIds: ['bush', 'rock'],
  },
}

/** @param {string} id @returns {BiomeRecipe} */
export function getBiome(id) {
  const b = BIOMES[id]
  if (!b) throw new Error(`Unknown biome: ${id}`)
  return b
}
