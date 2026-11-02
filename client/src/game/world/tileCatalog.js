/**
 * Terrain sheet baked from the Zelda-like atlas (16px cells, 16 columns).
 * Indices match client/public/maps/zelda-like/bake.py. Objects are not
 * tiles; they are whole sprites. Gameplay collision for water, walls, and
 * thicket still comes from the kind. These shapes are what Tiled stores.
 */

export const SHEET_COLS = 16
export const SHEET_ROWS = 3
export const TILE_COUNT = SHEET_COLS * SHEET_ROWS

/** Piece order inside each 13-tile autotile set. */
export const PIECES = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se', 'inw', 'ine', 'isw', 'ise']

export const TERRAIN = {
  grass: 0,
  grassDetail1: 1,
  grassDetail2: 2,
  dirt: 3,
  cobble: 16,
  water: 29,
  waterDeep: 42,
  wall: 43,
  thicket: 44,
  ford: 45,
}

export function pieceIndex(base, name) {
  const i = PIECES.indexOf(name)
  if (i < 0) throw new Error(`unknown autotile piece ${name}`)
  return base + i
}

const FULL = { x: 0, y: 0, w: 16, h: 16 }

/** Tile indices the generator is allowed to emit. */
export function mappedTerrainIds() {
  const ids = [
    TERRAIN.grass,
    TERRAIN.grassDetail1,
    TERRAIN.grassDetail2,
    TERRAIN.waterDeep,
    TERRAIN.wall,
    TERRAIN.thicket,
    TERRAIN.ford,
  ]
  for (let i = 0; i < PIECES.length; i++) {
    ids.push(TERRAIN.dirt + i, TERRAIN.cobble + i, TERRAIN.water + i)
  }
  return ids
}

/**
 * @returns {{x:number,y:number,w:number,h:number}|null}
 * Water and the rim brakes are solid. Fords, bridges, roads, and grass are not.
 * Tree trunks live on the prop, not on a tile.
 */
export function collisionForTile(index) {
  if (index === TERRAIN.wall || index === TERRAIN.thicket || index === TERRAIN.waterDeep) return { ...FULL }
  if (index >= TERRAIN.water && index < TERRAIN.water + PIECES.length) return { ...FULL }
  return null
}

export const PASSABLE_KINDS = new Set([
  'grass', 'plains', 'forest', 'road', 'cobble', 'ford', 'gate', 'bridge',
])

export function isPassableKind(kind) {
  return PASSABLE_KINDS.has(kind)
}

/**
 * Forest is 6/8 of road pace. Open grass and plains use road pace:
 * the lore states a forest day and a road day, and does not give a
 * separate plains figure (guess, noted in the PR).
 */
export function speedFactor(kind) {
  if (kind === 'forest') return 6 / 8
  return 1
}

/** Names kept for the collision test and Tiled readers. */
export const T = {
  grass: TERRAIN.grass,
  water: pieceIndex(TERRAIN.water, 'c'),
  ford: TERRAIN.ford,
  bridgeH: TERRAIN.ford,
  wall: TERRAIN.wall,
  thicket: TERRAIN.thicket,
}
