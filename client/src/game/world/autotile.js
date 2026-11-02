/**
 * Dual-grid transitions. A cell's four corners are shared with its neighbors,
 * so the tile chosen for a world cell does not depend on which league window
 * is asking. Mask 0 and 15 use the seamless base tile; 1–14 use the blob row.
 */

import { T, dualTile } from './tileCatalog.js'
import { mix } from './metrics.js'

const PRI = { grass: 0, plains: 1, forest: 2, cobble: 3, road: 4, water: 5 }

const PAIR = {
  'road|grass': 'road_grass',
  'road|forest': 'road_forest',
  'road|plains': 'road_plains',
  'road|cobble': 'road_cobble',
  'forest|grass': 'forest_grass',
  'forest|plains': 'forest_plains',
  'water|grass': 'water_grass',
  'water|forest': 'water_forest',
  'water|plains': 'water_plains',
  'plains|grass': 'plains_grass',
  'cobble|grass': 'cobble_grass',
}

function familyOf(kind) {
  switch (kind) {
    case 'forest':
    case 'thicket':
      return 'forest'
    case 'plains':
      return 'plains'
    case 'road':
    case 'gate':
      return 'road'
    case 'cobble':
      return 'cobble'
    case 'water':
    case 'ford':
    case 'bridge':
      return 'water'
    default:
      return 'grass'
  }
}

function cornerFamily(cx, cy, kindAt) {
  const samples = [
    kindAt(cx - 1, cy - 1), kindAt(cx, cy - 1),
    kindAt(cx - 1, cy), kindAt(cx, cy),
  ]
  let best = 'grass'
  let pri = -1
  for (let i = 0; i < samples.length; i++) {
    const f = familyOf(samples[i])
    const p = PRI[f]
    if (p > pri) {
      pri = p
      best = f
    }
  }
  return best
}

function baseTile(family, seed, wx, wy) {
  const h = mix(seed, wx, wy, 7) % 10
  if (family === 'forest') {
    if (h === 0) return T.forestB
    if (h === 1) return T.forestC
    return T.forest
  }
  if (family === 'plains') {
    if (h === 0) return T.plainsB
    if (h === 1) return T.plainsC
    return T.plains
  }
  if (family === 'road') return h === 0 ? T.road : T.road
  if (family === 'cobble') {
    if (h === 0) return T.cobbleB
    if (h === 1) return T.cobbleC
    return T.cobble
  }
  if (family === 'water') return T.water
  if (h === 0) return T.grassB
  if (h === 1) return T.grassC
  if (h === 2) return T.grassD
  return T.grass
}

function dedicated(kind, wx, wy, seed) {
  const h = mix(seed, wx, wy, 3) % 4
  if (kind === 'gate') return wx % 2 === 0 ? T.gateR : T.gateL
  if (kind === 'ford') return h % 2 === 0 ? T.ford : T.fordB
  if (kind === 'bridge') return wx % 2 === 0 ? T.bridgeH : T.bridgeHb
  if (kind === 'wall') return [T.wall, T.wallB, T.wallC, T.wallD][h]
  if (kind === 'thicket') return h % 2 === 0 ? T.thicket : T.thicketB
  if (kind === 'roof') return [T.roof, T.roofB, T.roofC, T.roof][h]
  if (kind === 'bwall') return [T.bwall, T.bwallB, T.bwallC, T.bwall][h]
  return T.grass
}

const STRUCTURAL = new Set(['wall', 'thicket', 'roof', 'bwall', 'gate', 'ford', 'bridge'])

/**
 * @param {number} wx
 * @param {number} wy
 * @param {(x:number,y:number)=>string} kindAt
 * @param {string} seed
 */
export function tileIndex(wx, wy, kindAt, seed) {
  const kind = kindAt(wx, wy)
  if (STRUCTURAL.has(kind)) return dedicated(kind, wx, wy, seed)
  const corners = [
    cornerFamily(wx, wy, kindAt),
    cornerFamily(wx + 1, wy, kindAt),
    cornerFamily(wx, wy + 1, kindAt),
    cornerFamily(wx + 1, wy + 1, kindAt),
  ]
  let fg = corners[0]
  for (let i = 1; i < 4; i++) {
    if (PRI[corners[i]] > PRI[fg]) fg = corners[i]
  }
  let mask = 0
  if (corners[0] === fg) mask |= 1
  if (corners[1] === fg) mask |= 2
  if (corners[2] === fg) mask |= 4
  if (corners[3] === fg) mask |= 8
  const own = familyOf(kind)
  if (mask === 0 || mask === 15) return baseTile(mask === 15 ? fg : own, seed, wx, wy)
  let bg = own === fg ? null : own
  for (let i = 0; i < 4 && (bg == null || bg === fg); i++) {
    if (corners[i] !== fg) bg = corners[i]
  }
  if (bg == null || bg === fg) bg = 'grass'
  const resolved = resolvePair(fg, bg)
  return dualTile(resolved.pair, resolved.mask(mask))
}

function resolvePair(fg, bg) {
  if (PAIR[`${fg}|${bg}`]) {
    return { pair: PAIR[`${fg}|${bg}`], mask: (m) => m }
  }
  if (PAIR[`${bg}|${fg}`]) {
    return { pair: PAIR[`${bg}|${fg}`], mask: (m) => m ^ 15 }
  }
  if (PAIR[`${fg}|grass`]) {
    return { pair: PAIR[`${fg}|grass`], mask: (m) => m }
  }
  return { pair: 'plains_grass', mask: (m) => m }
}
