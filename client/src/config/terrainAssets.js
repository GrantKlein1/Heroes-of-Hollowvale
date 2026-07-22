/**
 * Terrain asset manifest — real PNGs under client/public/images/terrain/.
 *
 * Naming: `{type}_{version?}_{connections?}_{W}x{H}.png`
 * Source art is 1024×1024 (filenames keep the 16x16 art-grid label).
 *
 * Path connection suffixes are absolute (top/right/bottom/left). Missing
 * orientations are derived by rotating the closest base asset at draw time.
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
 *   weight: number,
 *   tileType?: 'grass'|'path'|'object',
 *   version?: number,
 *   connections?: Array<'top'|'right'|'bottom'|'left'>,
 * }} TerrainAsset
 */

const ALL_BIOMES = ['emberwood_forest', 'ashen_wastes', 'plains']
const GROUND_FOOTPRINT = { x: 0, y: 0, w: 1, h: 1 }

/** @type {TerrainAsset[]} */
export const TERRAIN_ASSETS = [
  {
    id: 'grass_version1',
    src: '/images/terrain/grass_version1_16x16.png',
    w: 1024,
    h: 1024,
    category: 'ground',
    collide: false,
    footprint: GROUND_FOOTPRINT,
    anchor: 'center',
    biomes: ALL_BIOMES,
    weight: 1,
    tileType: 'grass',
    version: 1,
  },
  {
    id: 'grass_version2',
    src: '/images/terrain/grass_version2_16x16.png',
    w: 1024,
    h: 1024,
    category: 'ground',
    collide: false,
    footprint: GROUND_FOOTPRINT,
    anchor: 'center',
    biomes: ALL_BIOMES,
    weight: 1,
    tileType: 'grass',
    version: 2,
  },
  {
    id: 'path_top_bottom',
    src: '/images/terrain/path_top_bottom_16x16.png',
    w: 1024,
    h: 1024,
    category: 'ground',
    collide: false,
    footprint: GROUND_FOOTPRINT,
    anchor: 'center',
    biomes: ALL_BIOMES,
    weight: 1,
    tileType: 'path',
    connections: ['top', 'bottom'],
  },
  {
    id: 'path_top_right',
    src: '/images/terrain/path_top_right_16x16.png',
    w: 1024,
    h: 1024,
    category: 'ground',
    collide: false,
    footprint: GROUND_FOOTPRINT,
    anchor: 'center',
    biomes: ALL_BIOMES,
    weight: 1,
    tileType: 'path',
    connections: ['top', 'right'],
  },
  {
    id: 'path_top_right_bottom',
    src: '/images/terrain/path_top_right_bottom_16x16.png',
    w: 1024,
    h: 1024,
    category: 'ground',
    collide: false,
    footprint: GROUND_FOOTPRINT,
    anchor: 'center',
    biomes: ALL_BIOMES,
    weight: 1,
    tileType: 'path',
    connections: ['top', 'right', 'bottom'],
  },
  {
    id: 'path_top_right_bottom_left',
    src: '/images/terrain/path_top_right_bottom_left_16x16.png',
    w: 1024,
    h: 1024,
    category: 'ground',
    collide: false,
    footprint: GROUND_FOOTPRINT,
    anchor: 'center',
    biomes: ALL_BIOMES,
    weight: 1,
    tileType: 'path',
    connections: ['top', 'right', 'bottom', 'left'],
  },
  // Object placeholders until prop art lands — render falls back to color boxes
  {
    id: 'fixture_rock',
    src: '/images/terrain/rock_64x64.png',
    w: 64,
    h: 64,
    category: 'object',
    collide: true,
    footprint: { x: 0.15, y: 0.45, w: 0.7, h: 0.45 },
    anchor: 'bottom',
    biomes: ALL_BIOMES,
    weight: 1.2,
    tileType: 'object',
  },
  {
    id: 'fixture_bush',
    src: '/images/terrain/bush_48x48.png',
    w: 48,
    h: 48,
    category: 'object',
    collide: false,
    footprint: { x: 0.2, y: 0.5, w: 0.6, h: 0.4 },
    anchor: 'bottom',
    biomes: ['emberwood_forest', 'plains'],
    weight: 1.5,
    tileType: 'object',
  },
  {
    id: 'fixture_tree',
    src: '/images/terrain/tree_128x160.png',
    w: 128,
    h: 160,
    category: 'object',
    collide: true,
    footprint: { x: 0.35, y: 0.75, w: 0.3, h: 0.22 },
    anchor: 'bottom',
    biomes: ['emberwood_forest'],
    weight: 1,
    tileType: 'object',
  },
]

/** Ground variants used when scattering grass cells. */
export const GRASS_TILE_IDS = ['grass_version1', 'grass_version2']

export const DEFAULT_GROUND_ID = 'grass_version1'
export const DEFAULT_PATH_ID = 'path_top_bottom'

const byId = new Map(TERRAIN_ASSETS.map((a) => [a.id, a]))

/** @param {string} id @returns {TerrainAsset|undefined} */
export function getAsset(id) {
  return byId.get(id)
}

/** @param {string} biome @returns {TerrainAsset[]} */
export function assetsForBiome(biome) {
  return TERRAIN_ASSETS.filter((a) => a.biomes.includes(biome))
}

/**
 * Pick a grass variant id from a deterministic 0..1 roll.
 * @param {string[]} [variants]
 * @param {number} roll  in [0, 1)
 * @returns {string}
 */
export function pickGrassVariantId(variants, roll) {
  const list = variants?.length ? variants : GRASS_TILE_IDS
  const i = Math.min(list.length - 1, Math.floor(roll * list.length))
  return list[i] || DEFAULT_GROUND_ID
}

/**
 * Map path neighbor connections → base asset id + clockwise rotation (degrees).
 * Base assets: straight N–S, corner N–E, T missing W, and full cross.
 *
 * @param {{ top?: boolean, right?: boolean, bottom?: boolean, left?: boolean }} conn
 * @returns {{ id: string, rotation: number } | null}
 */
export function pathTileForConnections(conn) {
  const top = !!conn?.top
  const right = !!conn?.right
  const bottom = !!conn?.bottom
  const left = !!conn?.left
  const n = (top ? 1 : 0) + (right ? 1 : 0) + (bottom ? 1 : 0) + (left ? 1 : 0)

  if (n === 0) return null

  if (n === 4) {
    return { id: 'path_top_right_bottom_left', rotation: 0 }
  }

  if (n === 3) {
    // Base art: top + right + bottom (missing left)
    if (!left) return { id: 'path_top_right_bottom', rotation: 0 }
    if (!top) return { id: 'path_top_right_bottom', rotation: 90 }
    if (!right) return { id: 'path_top_right_bottom', rotation: 180 }
    return { id: 'path_top_right_bottom', rotation: 270 } // !bottom
  }

  if (n === 2) {
    if (top && bottom) return { id: 'path_top_bottom', rotation: 0 }
    if (left && right) return { id: 'path_top_bottom', rotation: 90 }
    // Corners — base art: top + right
    if (top && right) return { id: 'path_top_right', rotation: 0 }
    if (right && bottom) return { id: 'path_top_right', rotation: 90 }
    if (bottom && left) return { id: 'path_top_right', rotation: 180 }
    return { id: 'path_top_right', rotation: 270 } // left && top
  }

  // Dead-end (n === 1): reuse straight, oriented toward the open side
  if (top || bottom) return { id: 'path_top_bottom', rotation: 0 }
  return { id: 'path_top_bottom', rotation: 90 }
}
