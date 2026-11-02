/**
 * Continuous league grid.
 *
 * League (0,0) is Brackenford. East is +x, south is +y.
 * Each league is a 20×12 window of 16px tiles. Windows overlap by one tile
 * (stride 19×11) so a shared edge is the same world cells on both screens.
 */

import { hashSeed } from '../terrain/rng.js'

export const TILE = 16
export const LEAGUE_W = 20
export const LEAGUE_H = 12
export const STRIDE_X = 19
export const STRIDE_Y = 11
export const SCREEN_W = LEAGUE_W * TILE
export const SCREEN_H = LEAGUE_H * TILE

export const WORLD_SEED = 'hollowvale-1477'

export const LEAGUE_MIN_X = -18
export const LEAGUE_MAX_X = 2
export const LEAGUE_MIN_Y = -4
export const LEAGUE_MAX_Y = 5

export const MIN_WX = LEAGUE_MIN_X * STRIDE_X
export const MAX_WX = LEAGUE_MAX_X * STRIDE_X + LEAGUE_W - 1
export const MIN_WY = LEAGUE_MIN_Y * STRIDE_Y
export const MAX_WY = LEAGUE_MAX_Y * STRIDE_Y + LEAGUE_H - 1

/** Knight crosses one league of road (192px) in 8 seconds. */
export const ROAD_PX_PER_SEC = SCREEN_H / 8
/** Lore: 8 leagues/day on a road, 6 in forest. */
export const FOREST_PACE = 6 / 8

export const SLIDE_MS = 250

export function posMod(n, m) {
  return ((n % m) + m) % m
}

export function isStrideEdge(wx, wy) {
  return posMod(wx, STRIDE_X) === 0 || posMod(wy, STRIDE_Y) === 0
}

export function leagueOrigin(lx, ly) {
  return {
    x: lx * STRIDE_X * TILE,
    y: ly * STRIDE_Y * TILE,
    width: SCREEN_W,
    height: SCREEN_H,
  }
}

export function worldTile(lx, ly, tx, ty) {
  return { wx: lx * STRIDE_X + tx, wy: ly * STRIDE_Y + ty }
}

export function inLeague(lx, ly, wx, wy) {
  const x0 = lx * STRIDE_X
  const y0 = ly * STRIDE_Y
  return wx >= x0 && wx < x0 + LEAGUE_W && wy >= y0 && wy < y0 + LEAGUE_H
}

export function leagueInBounds(lx, ly) {
  return lx >= LEAGUE_MIN_X && lx <= LEAGUE_MAX_X && ly >= LEAGUE_MIN_Y && ly <= LEAGUE_MAX_Y
}

export function tileCenter(wx, wy) {
  return { x: wx * TILE + TILE / 2, y: wy * TILE + TILE / 2 }
}

export function tileKey(wx, wy) {
  return `${wx},${wy}`
}

/**
 * Deterministic uint32 mix. No Math.random.
 * @param {string|number} seed
 */
export function mix(seed, x, y, salt = 0) {
  let h = (typeof seed === 'number' ? seed : hashSeed(String(seed))) >>> 0
  h ^= Math.imul(x | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h ^= Math.imul(y | 0, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f)
  h ^= salt >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x165667b1)
  return h >>> 0
}

export function unit(seed, x, y, salt = 0) {
  return mix(seed, x, y, salt) / 4294967296
}

export function forEachLeague(fn) {
  for (let ly = LEAGUE_MIN_Y; ly <= LEAGUE_MAX_Y; ly++) {
    for (let lx = LEAGUE_MIN_X; lx <= LEAGUE_MAX_X; lx++) fn(lx, ly)
  }
}
