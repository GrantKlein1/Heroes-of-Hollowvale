/**
 * Fixture terrain manifest — no real PNGs required.
 * Tracks B/C/D develop against these ids until Track A lands real art.
 *
 * src paths point at the eventual /images/terrain/ location; render.js
 * color-box fallback covers missing files.
 */

/** @type {import('../../../config/terrainAssets.js').TerrainAsset[]} */
export const FIXTURE_MANIFEST = [
  {
    id: 'fixture_grass',
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
    id: 'fixture_dirt',
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
    id: 'fixture_rock',
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
  },
  {
    id: 'fixture_tree',
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
]
