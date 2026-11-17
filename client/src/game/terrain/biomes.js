/**
 * Biome recipes for the wilderness generator.
 *
 * Ground and road ids are manifest tileset names (`client/public/assets/manifest.json`):
 * plains and roads stay on the AS-2 `grass` / `dirt_road` sheets; Emberwood uses
 * `forest_floor`; the Ashen Wastes blend `ash_ground` Wang corners into that
 * base with `ash_fill` interiors.
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
    groundTileId: 'forest_floor',
    pathTileId: 'dirt_road',
    objectDensity: 0.14,
    palette: ['#2d4a1e', '#1a2e12', '#4a6b2f'],
    allowedObjectIds: ['fern', 'flowers', 'mushroom_cluster', 'stump_mossy', 'log_fallen'],
  },
  ashen_wastes: {
    id: 'ashen_wastes',
    groundTileId: 'ash_fill',
    pathTileId: 'dirt_road',
    objectDensity: 0.08,
    palette: ['#5a5348', '#3d3830', '#7a6f60'],
    allowedObjectIds: [
      'tree_dead_base',
      'tree_dead_canopy',
      'stump_charred',
      'ash_drift_pool_a',
      'ash_drift_pool_b',
      'ash_drift_streak_a',
      'ash_drift_streak_b',
      'cinder_patch',
      'ember_fleck',
      'ember_vent_burn_down_0',
      'rock_ash',
    ],
  },
  plains: {
    id: 'plains',
    groundTileId: 'grass',
    pathTileId: 'dirt_road',
    objectDensity: 0.02,
    palette: ['#5a8a3a', '#7aaa4a', '#3d6b28'],
    allowedObjectIds: [],
  },
}

/** @param {string} id @returns {BiomeRecipe} */
export function getBiome(id) {
  const b = BIOMES[id]
  if (!b) throw new Error(`Unknown biome: ${id}`)
  return b
}
