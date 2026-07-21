/**
 * Hand-authored fixture layout.
 * Central corridor ~x=0.4..0.6 is intentionally clear so exits remain reachable.
 * Colliders approximate tree/rock footprints.
 *
 * @type {import('../generate.js').TerrainLayout}
 */
export const fixtureLayout = {
  biome: 'emberwood_forest',
  groundTileId: 'fixture_grass',
  objects: [
    { assetId: 'fixture_tree', nx: 0.22, ny: 0.35, scale: 1, collide: true },
    { assetId: 'fixture_tree', nx: 0.78, ny: 0.40, scale: 1.1, collide: true },
    { assetId: 'fixture_rock', nx: 0.30, ny: 0.70, scale: 1, collide: true },
    { assetId: 'fixture_bush', nx: 0.65, ny: 0.62, scale: 1, collide: false },
    { assetId: 'fixture_rock', nx: 0.82, ny: 0.78, scale: 0.9, collide: true },
  ],
  colliders: [
    { x: 0.17, y: 0.30, w: 0.10, h: 0.08 },
    { x: 0.73, y: 0.35, w: 0.11, h: 0.09 },
    { x: 0.25, y: 0.64, w: 0.10, h: 0.08 },
    { x: 0.77, y: 0.72, w: 0.09, h: 0.07 },
  ],
  exits: {
    north: true,
    south: true,
    east: true,
    west: false,
  },
}

export default fixtureLayout
