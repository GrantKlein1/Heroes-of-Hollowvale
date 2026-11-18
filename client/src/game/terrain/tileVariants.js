/**
 * Batch 11 package B tile ids (append-only variants) and the pure helpers that
 * pick them. No Phaser, no RNG state: every function is a pure function of its
 * arguments, so the wilderness generator (generate.js) and the .tmj builders
 * under tools/maps can share one table.
 *
 * Corner masks use the repo-wide Wang bits NW=1 NE=2 SW=4 SE=8.
 *
 * Ids (docs: art-source/blendsmith/tiles/MANIFEST.md, "TILES-VARIANTS"):
 *   forest_floor 0-7   calm forest floor (package A)
 *   forest_floor 8-22  forest to grass blend, id = 7 + grassMask (22 = all grass)
 *   water_shore 0-15   sand to water Wang tiles (mask = water corners)
 *   water_shore 64-78  sand to grass blend, id = 63 + grassMask (78 = all grass)
 *   dirt_road / cliff 16-23  alternates for the straight masks 3, 5, 10, 12
 *   water 64-71        alternates for the straight masks (animation frames 72-95)
 *   cliff_face 4-7     cap_left, cap_right and two extra face variants
 */

/** Wang masks of the straight edges, the only ones that have alternates. */
export const STRAIGHT_MASKS = [3, 5, 10, 12]

/**
 * Tile ids per straight mask: [base, alt1, alt2]. Alternates keep the same Wang
 * colours and edge pair as the base tile, so they can be swapped freely.
 * @type {Record<'dirt_road'|'cliff'|'water', Record<number, number[]>>}
 */
export const STRAIGHT_VARIANTS = {
  dirt_road: { 3: [3, 16, 20], 5: [5, 17, 21], 10: [10, 18, 22], 12: [12, 19, 23] },
  cliff: { 3: [3, 16, 20], 5: [5, 17, 21], 10: [10, 18, 22], 12: [12, 19, 23] },
  water: { 3: [3, 64, 68], 5: [5, 65, 69], 10: [10, 66, 70], 12: [12, 67, 71] },
}

/** Share of straight tiles that keep the base art (the rest split between the two alternates). */
export const BASE_SHARE = 0.4

/**
 * Pick the id for a straight-run Wang tile.
 * @param {'dirt_road'|'cliff'|'water'} tileset
 * @param {number} mask Wang mask 0..15
 * @param {number} roll uniform [0, 1)
 * @returns {number} the id (the mask itself when the mask has no alternates)
 */
export function straightVariantId(tileset, mask, roll) {
  const ids = STRAIGHT_VARIANTS[tileset]?.[mask]
  if (!ids) return mask
  if (roll < BASE_SHARE) return ids[0]
  return roll < BASE_SHARE + (1 - BASE_SHARE) / 2 ? ids[1] : ids[2]
}

/** forest_floor frame for a forest to grass corner blend. */
export const FOREST_GRASS_FIRST_ID = 8
export const FOREST_GRASS_ALL_ID = 22

/**
 * Pick the forest_floor frame for a tile whose set bits are the GRASS corners.
 * @param {number} grassMask 0..15
 * @returns {number} 0 = plain forest (caller keeps its own forest variant),
 *   8..21 = blend, 22 = all grass
 */
export function forestGrassId(grassMask) {
  const m = grassMask & 15
  if (m === 0) return 0
  return FOREST_GRASS_FIRST_ID - 1 + m
}

/** water_shore frames for the sand to grass blend. */
export const SHORE_GRASS_FIRST_ID = 64
export const SHORE_GRASS_ALL_ID = 78

/**
 * Pick the water_shore frame for a tile whose set bits are the GRASS corners
 * (the other corners are sand).
 * @param {number} grassMask 0..15
 * @returns {number} 0 = all sand, 64..77 = blend, 78 = all grass
 */
export function shoreGrassId(grassMask) {
  const m = grassMask & 15
  if (m === 0) return 0
  return SHORE_GRASS_FIRST_ID - 1 + m
}

/**
 * water_shore frame for a tile whose set bits are the WATER corners over sand.
 * The ids 0..15 are the Wang tiles themselves.
 * @param {number} waterMask 0..15
 */
export function shoreWaterId(waterMask) {
  return waterMask & 15
}

/** cliff_face ids. 0..3 are the face tiles, 6 and 7 are extra variants. */
export const CLIFF_FACE_CAP_LEFT = 4
export const CLIFF_FACE_CAP_RIGHT = 5
export const CLIFF_FACE_VARIANTS = [6, 7]

/**
 * Pick the cliff_face id for one cell of a horizontal face run.
 * Run ends get a cap (left end, right end); a one-cell run keeps a plain face.
 * @param {number} index position of the cell in the run, 0-based
 * @param {number} length run length
 * @param {number} roll uniform [0, 1): decides an extra variant in the middle of the run
 * @param {number} [variantShare] share of middle cells that use ids 6 and 7
 */
export function cliffFaceId(index, length, roll, variantShare = 0.3) {
  if (length > 1 && index === 0) return CLIFF_FACE_CAP_LEFT
  if (length > 1 && index === length - 1) return CLIFF_FACE_CAP_RIGHT
  if (roll < variantShare) {
    return CLIFF_FACE_VARIANTS[roll < variantShare / 2 ? 0 : 1]
  }
  return index % 4
}
