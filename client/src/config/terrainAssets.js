/**
 * Terrain asset manifest — Track A (real sprites).
 *
 * Transparent PNGs live under client/public/images/terrain/ as type_WxH.png.
 * Ground tiles (grass, dirt) are seamless squares for tiling.
 *
 * @typedef {{
 *   id: string,
 *   src: string,
 *   w: number,
 *   h: number,
 *   category: 'ground'|'object',
 *   collide: boolean,
 *   footprint: { x: number, y: number, w: number, h: number },
 *   anchor: 'bottom'|'center',
 *   biomes: string[],
 *   weight: number
 * }} TerrainAsset
 */

/** @type {TerrainAsset[]} */
export const TERRAIN_ASSETS = [
  {
    id: 'grass',
    src: '/images/terrain/grass_64x64.png',
    w: 64,
    h: 64,
    category: 'ground',
    collide: false,
    footprint: { x: 0, y: 0, w: 1, h: 1 },
    anchor: 'center',
    biomes: ['emberwood_forest', 'plains'],
    weight: 1,
  },
  {
    id: 'dirt',
    src: '/images/terrain/dirt_64x64.png',
    w: 64,
    h: 64,
    category: 'ground',
    collide: false,
    footprint: { x: 0, y: 0, w: 1, h: 1 },
    anchor: 'center',
    biomes: ['emberwood_forest', 'ashen_wastes', 'plains'],
    weight: 1,
  },
  {
    id: 'rock',
    src: '/images/terrain/rock_64x64.png',
    w: 64,
    h: 64,
    category: 'object',
    collide: true,
    footprint: { x: 0.15, y: 0.45, w: 0.7, h: 0.45 },
    anchor: 'bottom',
    biomes: ['emberwood_forest', 'ashen_wastes', 'plains'],
    weight: 1.2,
  },
  {
    id: 'bush',
    src: '/images/terrain/bush_48x48.png',
    w: 48,
    h: 48,
    category: 'object',
    collide: false,
    footprint: { x: 0.2, y: 0.5, w: 0.6, h: 0.4 },
    anchor: 'bottom',
    biomes: ['emberwood_forest', 'plains'],
    weight: 1.5,
  },
  {
    id: 'tree',
    src: '/images/terrain/tree_128x160.png',
    w: 128,
    h: 160,
    category: 'object',
    collide: true,
    // Trunk-only collider near the bottom of the sprite
    footprint: { x: 0.35, y: 0.75, w: 0.3, h: 0.22 },
    anchor: 'bottom',
    biomes: ['emberwood_forest'],
    weight: 1,
  },
  {
    id: 'tree_b',
    src: '/images/terrain/tree_b_128x160.png',
    w: 128,
    h: 160,
    category: 'object',
    collide: true,
    footprint: { x: 0.35, y: 0.75, w: 0.3, h: 0.22 },
    anchor: 'bottom',
    biomes: ['emberwood_forest', 'ashen_wastes'],
    weight: 0.9,
  },
]

const byId = new Map(TERRAIN_ASSETS.map((a) => [a.id, a]))

/** @param {string} id @returns {TerrainAsset|undefined} */
export function getAsset(id) {
  return byId.get(id)
}

/** @param {string} biome @returns {TerrainAsset[]} */
export function assetsForBiome(biome) {
  return TERRAIN_ASSETS.filter((a) => a.biomes.includes(biome))
}
