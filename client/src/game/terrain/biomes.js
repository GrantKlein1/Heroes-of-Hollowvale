/**
 * Biome recipes — Phase 0 stub.
 *
 * Track B owns the real recipes (density, palettes, allowed object ids).
 * Initial biome ids align with lore region names in newLore.txt Part VII.
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
    objectDensity: 0.35,
    palette: ['#2d4a1e', '#1a2e12', '#4a6b2f'],
    allowedObjectIds: ['fixture_tree', 'fixture_rock', 'fixture_bush'],
  },
  ashen_wastes: {
    id: 'ashen_wastes',
    groundTileId: 'fixture_dirt',
    pathTileId: 'fixture_dirt',
    objectDensity: 0.2,
    palette: ['#5a5348', '#3d3830', '#7a6f60'],
    allowedObjectIds: ['fixture_rock'],
  },
  plains: {
    id: 'plains',
    groundTileId: 'fixture_grass',
    pathTileId: 'fixture_dirt',
    objectDensity: 0.15,
    palette: ['#5a8a3a', '#7aaa4a', '#3d6b28'],
    allowedObjectIds: ['fixture_bush', 'fixture_rock'],
  },
}

/** @param {string} id @returns {BiomeRecipe} */
export function getBiome(id) {
  const b = BIOMES[id]
  if (!b) throw new Error(`Unknown biome: ${id}`)
  return b
}
