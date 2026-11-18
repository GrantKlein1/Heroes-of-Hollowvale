/**
 * Biome spawn tables and the deterministic per-screen spawn planner.
 *
 * To make a new enemy show up in the wilderness, add its def id (from
 * combat/enemyDefs.js) and a weight to the biome rows below. That is all.
 *
 * The planner is a pure function: same world seed + same screen id + same
 * layout + same player spot gives the same spawns. Types and counts depend
 * only on (seed, screen id), so they do not change when the screen's props are
 * regenerated on a later visit. Positions are drawn from the same stream and
 * then filtered against the layout.
 */

import { createRng, hashSeed } from './rng.js'
import { pickEnemyTypeByWeight, getEnemyDef } from '../combat/enemyDefs.js'

/** Hard cap on enemies placed on one screen. */
export const MAX_SPAWNS_PER_SCREEN = 3

/** Nothing spawns closer than this (px) to an exit or to the player. */
export const SPAWN_CLEARANCE_PX = 128

/** Keep spawns this far (px) from the screen border. */
const BORDER_MARGIN_PX = 48

/** Half-size (px) of the box a spawn must keep clear of colliders. */
const BODY_HALF_PX = 24

/** Spawns keep at least this far (px) from each other. */
const MIN_SEPARATION_PX = 72

/** Position attempts per enemy before it is dropped. */
const MAX_PLACE_TRIES = 40

/** Scene ids that get wilderness spawns. Town, interiors and the cavern wave loop do not. */
const SPAWN_SCENES = new Set(['wilderness'])

/**
 * Per-biome rows. Keys are biome ids from terrain/biomes.js. `weights` keys are
 * enemy def ids from combat/enemyDefs.js. `count` is [min, max] per screen
 * (max is also clamped to MAX_SPAWNS_PER_SCREEN).
 *
 * @type {Record<string, { count: [number, number], weights: Record<string, number> }>}
 */
export const BIOME_SPAWN_TABLES = {
  plains: { count: [1, 2], weights: { goblin: 8, archer: 1 } },
  emberwood_forest: { count: [2, 3], weights: { goblin: 6, archer: 3, brute: 1, shadowfang_wolf: 2 } },
  ashen_wastes: {
    count: [2, 3],
    weights: { goblin: 3, archer: 3, brute: 3, shadowfang_wolf: 2, ashen_cultist: 2, ashen_revenant: 1 },
  },
}

/**
 * @param {string} biomeId
 * @returns {{ count: [number, number], weights: Record<string, number> }|null}
 */
export function getBiomeSpawnTable(biomeId) {
  return BIOME_SPAWN_TABLES[biomeId] || null
}

/**
 * @param {string} sceneId
 * @returns {boolean}
 */
export function sceneHasSpawns(sceneId) {
  return SPAWN_SCENES.has(sceneId)
}

/** Distance from a point to a rect. 0 when inside. */
function distToRect(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w))
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h))
  return Math.hypot(dx, dy)
}

/**
 * Plan the spawns for one screen. Returns pixel positions, at most
 * MAX_SPAWNS_PER_SCREEN of them.
 *
 * @param {{
 *   sceneId?: string,
 *   worldSeed: number|string,
 *   nodeId: string,
 *   biome: string,
 *   worldW: number,
 *   worldH: number,
 *   colliders?: Array<{ x: number, y: number, w: number, h: number }>,   // normalized 0..1, like layout.colliders
 *   exitRects?: Array<{ x: number, y: number, w: number, h: number }>,   // normalized 0..1, like wildernessExitPrompts rects
 *   player?: { x: number, y: number },                                   // pixels
 * }} opts
 * @returns {Array<{ type: string, x: number, y: number }>}
 */
export function planScreenSpawns(opts) {
  const {
    sceneId = 'wilderness',
    worldSeed,
    nodeId,
    biome,
    worldW,
    worldH,
    colliders = [],
    exitRects = [],
    player = null,
  } = opts
  if (!sceneHasSpawns(sceneId)) return []
  const table = getBiomeSpawnTable(biome)
  if (!table) return []

  const rng = createRng(hashSeed(`spawn:${worldSeed}:${nodeId}`))
  const [lo, hi] = table.count
  const want = Math.min(MAX_SPAWNS_PER_SCREEN, rng.int(lo, Math.min(hi, MAX_SPAWNS_PER_SCREEN)))

  // Types first, so they never depend on the layout.
  const types = []
  for (let i = 0; i < want; i++) {
    const type = pickEnemyTypeByWeight(rng.next, table.weights)
    if (type && getEnemyDef(type)) types.push(type)
  }

  const solids = colliders.map((c) => ({ x: c.x * worldW, y: c.y * worldH, w: c.w * worldW, h: c.h * worldH }))
  const exits = exitRects.map((c) => ({ x: c.x * worldW, y: c.y * worldH, w: c.w * worldW, h: c.h * worldH }))

  const out = []
  for (const type of types) {
    for (let t = 0; t < MAX_PLACE_TRIES; t++) {
      const x = Math.round(BORDER_MARGIN_PX + rng.next() * (worldW - 2 * BORDER_MARGIN_PX))
      const y = Math.round(BORDER_MARGIN_PX + rng.next() * (worldH - 2 * BORDER_MARGIN_PX))
      if (player && Math.hypot(x - player.x, y - player.y) < SPAWN_CLEARANCE_PX) continue
      if (exits.some((r) => distToRect(x, y, r) < SPAWN_CLEARANCE_PX)) continue
      const body = { x: x - BODY_HALF_PX, y: y - BODY_HALF_PX, w: BODY_HALF_PX * 2, h: BODY_HALF_PX * 2 }
      if (solids.some((r) => !(body.x + body.w <= r.x || body.x >= r.x + r.w || body.y + body.h <= r.y || body.y >= r.y + r.h))) continue
      if (out.some((o) => Math.hypot(x - o.x, y - o.y) < MIN_SEPARATION_PX)) continue
      out.push({ type, x, y })
      break
    }
  }
  return out
}
