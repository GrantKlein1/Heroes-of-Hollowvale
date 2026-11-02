/**
 * Whole building sprites. Footprints stay solid kinds (roof / bwall) in the
 * stamp; the door is the walkable cell south of the footprint. `wy` is the
 * bottom tile of that footprint. The sprite is centered on it and drawn
 * from its base, so the roof hangs above the collider.
 */

export const BUILDINGS = [
  { id: 'flagon', sprite: 'cottage', wx: 8, wy: 3, tiles: 4 },
  { id: 'market', sprite: 'cottage', wx: 2, wy: 5, tiles: 3 },
  { id: 'smithy', sprite: 'cottage', wx: 13, wy: 4, tiles: 3 },
  { id: 'barn', sprite: 'house', wx: 2, wy: 19, tiles: 4 },
]
