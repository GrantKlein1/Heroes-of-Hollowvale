/**
 * Builds a deterministic league window from the world seed.
 * Revisiting a coordinate rebuilds the same tiles, props, loot, and encounters.
 */

import { tileIndex } from './autotile.js'
import {
  ENCOUNTER_RULES,
  ENCOUNTER_TABLES,
  FIXED_LOOT,
  FIXED_PROPS,
  HERB_RULE,
  INTERACTABLES,
  SCRIPTED_ENCOUNTERS,
  SPAWNS,
} from './content.js'
import {
  LEAGUE_H,
  LEAGUE_MAX_X,
  LEAGUE_MAX_Y,
  LEAGUE_MIN_X,
  LEAGUE_MIN_Y,
  LEAGUE_W,
  STRIDE_X,
  STRIDE_Y,
  TILE,
  WORLD_SEED,
  forEachLeague,
  inLeague,
  isStrideEdge,
  leagueOrigin,
  mix,
  tileCenter,
  tileKey,
  unit,
} from './metrics.js'
import { PROP_KINDS, containsPoint, propRect } from './props.js'
import { isPassableKind } from './tileCatalog.js'
import { computeKind } from './terrain.js'

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function makeProp(kind, variant, wx, wy) {
  const def = PROP_KINDS[kind]
  const frame = def.frames[variant % def.frames.length]
  const prop = { kind, variant: variant % def.frames.length, frame, wx, wy, blocks: def.blocks, tall: !!def.tall }
  prop.rect = propRect(prop)
  return prop
}

function leagueConnected(lx, ly, kindAt, blocked) {
  const x0 = lx * STRIDE_X
  const y0 = ly * STRIDE_Y
  const pass = (tx, ty) => {
    const wx = x0 + tx
    const wy = y0 + ty
    if (!isPassableKind(kindAt(wx, wy))) return false
    if (blocked.has(tileKey(wx, wy))) return false
    return true
  }
  const seen = Array.from({ length: LEAGUE_H }, () => Array(LEAGUE_W).fill(false))
  const q = []
  const push = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= LEAGUE_W || ty >= LEAGUE_H) return
    if (seen[ty][tx] || !pass(tx, ty)) return
    seen[ty][tx] = true
    q.push([tx, ty])
  }
  for (let tx = 0; tx < LEAGUE_W; tx++) {
    push(tx, 0)
    push(tx, LEAGUE_H - 1)
  }
  for (let ty = 0; ty < LEAGUE_H; ty++) {
    push(0, ty)
    push(LEAGUE_W - 1, ty)
  }
  let qi = 0
  while (qi < q.length) {
    const [tx, ty] = q[qi++]
    for (let d = 0; d < DIRS.length; d++) push(tx + DIRS[d][0], ty + DIRS[d][1])
  }
  for (let ty = 0; ty < LEAGUE_H; ty++) {
    for (let tx = 0; tx < LEAGUE_W; tx++) {
      if (pass(tx, ty) && !seen[ty][tx]) return false
    }
  }
  return true
}

function ownerLeague(wx, wy) {
  for (let ly = LEAGUE_MIN_Y; ly <= LEAGUE_MAX_Y; ly++) {
    for (let lx = LEAGUE_MIN_X; lx <= LEAGUE_MAX_X; lx++) {
      if (inLeague(lx, ly, wx, wy)) return { lx, ly }
    }
  }
  return null
}

function placeProps(kindAt, seed) {
  const blocked = new Set()
  const props = []
  const occupied = new Set()

  const tryPlace = (kind, variant, wx, wy) => {
    if (occupied.has(tileKey(wx, wy))) return false
    if (isStrideEdge(wx, wy)) return false
    if (!isPassableKind(kindAt(wx, wy))) return false
    const owner = ownerLeague(wx, wy)
    if (!owner) return false
    const def = PROP_KINDS[kind]
    if (def.blocks) {
      blocked.add(tileKey(wx, wy))
      if (!leagueConnected(owner.lx, owner.ly, kindAt, blocked)) {
        blocked.delete(tileKey(wx, wy))
        return false
      }
    }
    occupied.add(tileKey(wx, wy))
    props.push(makeProp(kind, variant, wx, wy))
    return true
  }

  for (let i = 0; i < FIXED_PROPS.length; i++) {
    const p = FIXED_PROPS[i]
    tryPlace(p.kind, p.variant, p.wx, p.wy)
  }
  const reserve = (wx, wy) => occupied.add(tileKey(wx, wy))
  for (let i = 0; i < FIXED_LOOT.length; i++) reserve(FIXED_LOOT[i].wx, FIXED_LOOT[i].wy)
  for (let i = 0; i < INTERACTABLES.length; i++) {
    const it = INTERACTABLES[i]
    const w = it.w || 1
    const h = it.h || 1
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) reserve(it.wx + dx, it.wy + dy)
    }
  }
  for (let i = 0; i < SCRIPTED_ENCOUNTERS.length; i++) reserve(SCRIPTED_ENCOUNTERS[i].wx, SCRIPTED_ENCOUNTERS[i].wy)
  reserve(SPAWNS.start.wx, SPAWNS.start.wy)
  reserve(SPAWNS.market.wx, SPAWNS.market.wy)
  reserve(SPAWNS.stub.wx, SPAWNS.stub.wy)

  for (let wy = LEAGUE_MIN_Y * STRIDE_Y; wy <= LEAGUE_MAX_Y * STRIDE_Y + LEAGUE_H - 1; wy++) {
    for (let wx = LEAGUE_MIN_X * STRIDE_X; wx <= LEAGUE_MAX_X * STRIDE_X + LEAGUE_W - 1; wx++) {
      if (isStrideEdge(wx, wy)) continue
      const kind = kindAt(wx, wy)
      const roll = unit(seed, wx, wy, 11)
      let propKind = null
      let variant = mix(seed, wx, wy, 12) % 4
      if (kind === 'forest') {
        if (roll < 0.16) propKind = 'tree'
        else if (roll < 0.24) propKind = 'bush'
        else if (roll < 0.28) propKind = 'mushroom'
        else if (roll < 0.31) propKind = 'rock'
        else if (roll < 0.34) propKind = 'log'
      } else if (kind === 'plains') {
        if (roll < 0.1) propKind = 'flower'
        else if (roll < 0.13) propKind = 'rock'
      } else if (kind === 'grass') {
        if (roll < 0.08) propKind = 'flower'
        else if (roll < 0.1) propKind = 'mushroom'
      }
      if (propKind) tryPlace(propKind, variant, wx, wy)
    }
  }
  return props
}

function weighted(seed, wx, wy, salt, table) {
  let total = 0
  for (let i = 0; i < table.length; i++) total += table[i].weight
  let r = unit(seed, wx, wy, salt) * total
  for (let i = 0; i < table.length; i++) {
    r -= table[i].weight
    if (r <= 0) return table[i]
  }
  return table[table.length - 1]
}

function townInterior(wx, wy) {
  return wx >= 1 && wx <= 18 && wy >= 1 && wy <= 10
}

function near(a, b, spacing) {
  return Math.abs(a.wx - b.wx) <= spacing && Math.abs(a.wy - b.wy) <= spacing
}

function spiral(wx, wy, walkable) {
  if (walkable(wx, wy)) return { wx, wy }
  for (let rad = 1; rad <= 4; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) !== rad && Math.abs(dy) !== rad) continue
        const x = wx + dx
        const y = wy + dy
        if (walkable(x, y)) return { wx: x, wy: y }
      }
    }
  }
  return null
}

function buildEncounters(lx, ly, kindAt, walkable, seed, props) {
  const x0 = lx * STRIDE_X
  const y0 = ly * STRIDE_Y
  const list = []
  const spacing = ENCOUNTER_RULES.minSpacing
  const consider = (enc) => {
    if (list.length >= ENCOUNTER_RULES.maxPerLeague) return
    if (townInterior(enc.wx, enc.wy)) return
    const spot = spiral(enc.wx, enc.wy, (x, y) => walkable(x, y) && !townInterior(x, y))
    if (!spot) return
    if (!inLeague(lx, ly, spot.wx, spot.wy)) return
    const placed = { ...enc, wx: spot.wx, wy: spot.wy }
    for (let i = 0; i < list.length; i++) {
      if (near(list[i], placed, spacing)) return
    }
    list.push(placed)
  }
  for (let i = 0; i < SCRIPTED_ENCOUNTERS.length; i++) {
    const e = SCRIPTED_ENCOUNTERS[i]
    if (inLeague(lx, ly, e.wx, e.wy)) consider(e)
  }
  for (let ty = 1; ty < LEAGUE_H - 1 && list.length < ENCOUNTER_RULES.maxPerLeague; ty++) {
    for (let tx = 1; tx < LEAGUE_W - 1 && list.length < ENCOUNTER_RULES.maxPerLeague; tx++) {
      const wx = x0 + tx
      const wy = y0 + ty
      const kind = kindAt(wx, wy)
      let table = null
      let chance = 0
      if (kind === 'forest') {
        table = ENCOUNTER_TABLES.forest
        chance = ENCOUNTER_RULES.forestChance
      } else if (kind === 'plains') {
        table = ENCOUNTER_TABLES.plains
        chance = ENCOUNTER_RULES.plainsChance
      }
      if (!table) continue
      if (unit(seed, wx, wy, 21) >= chance) continue
      const pick = weighted(seed, wx, wy, 22, table)
      consider({
        id: `enc-${lx}-${ly}-${wx}-${wy}`,
        wx,
        wy,
        type: pick.type,
        name: pick.name,
        table: kind,
      })
    }
  }
  void props
  return list
}

function herbCells(lx, ly, kindAt, walkable, seed, taken) {
  const x0 = lx * STRIDE_X
  const y0 = ly * STRIDE_Y
  const found = []
  for (let ty = 1; ty < LEAGUE_H - 1; ty++) {
    for (let tx = 1; tx < LEAGUE_W - 1; tx++) {
      if (found.length >= HERB_RULE.maxPerLeague) return found
      const wx = x0 + tx
      const wy = y0 + ty
      if (kindAt(wx, wy) !== 'forest') continue
      if (!walkable(wx, wy)) continue
      if (taken.has(tileKey(wx, wy))) continue
      let edge = false
      for (let d = 0; d < DIRS.length; d++) {
        const n = kindAt(wx + DIRS[d][0], wy + DIRS[d][1])
        if (n === 'grass' || n === 'plains') edge = true
      }
      if (!edge) continue
      if (unit(seed, wx, wy, 31) >= HERB_RULE.chance) continue
      found.push({
        id: `herb-${wx}-${wy}`,
        wx,
        wy,
        marker: 'herb',
        label: 'Press E to pick emberleaf',
        short: 'Herbs',
        items: [{ id: HERB_RULE.item, count: 1 }],
        gems: null,
      })
    }
  }
  return found
}

function buildColliders(kindAt, props) {
  const rects = []
  const minX = LEAGUE_MIN_X * STRIDE_X
  const maxX = LEAGUE_MAX_X * STRIDE_X + LEAGUE_W - 1
  const minY = LEAGUE_MIN_Y * STRIDE_Y
  const maxY = LEAGUE_MAX_Y * STRIDE_Y + LEAGUE_H - 1
  for (let wy = minY; wy <= maxY; wy++) {
    let run = null
    for (let wx = minX; wx <= maxX + 1; wx++) {
      const solid = wx <= maxX && !isPassableKind(kindAt(wx, wy))
      if (solid) {
        if (!run) run = { x: wx * TILE, y: wy * TILE, w: TILE, h: TILE }
        else run.w += TILE
      } else if (run) {
        rects.push(run)
        run = null
      }
    }
  }
  for (let i = 0; i < props.length; i++) {
    if (props[i].rect) rects.push(props[i].rect)
  }
  return rects
}

export function createWorld(seed = WORLD_SEED) {
  const kindCache = new Map()
  function kindAt(wx, wy) {
    const k = tileKey(wx, wy)
    const hit = kindCache.get(k)
    if (hit) return hit
    const v = computeKind(wx, wy, seed)
    kindCache.set(k, v)
    return v
  }
  const props = placeProps(kindAt, seed)
  const propBy = new Map()
  for (let i = 0; i < props.length; i++) propBy.set(tileKey(props[i].wx, props[i].wy), props[i])

  function pointBlocked(wx, wy, px, py) {
    if (!isPassableKind(kindAt(wx, wy))) return true
    const prop = propBy.get(tileKey(wx, wy))
    if (prop?.rect && containsPoint(prop.rect, px, py)) return true
    return false
  }

  function walkable(wx, wy) {
    const c = tileCenter(wx, wy)
    return !pointBlocked(wx, wy, c.x, c.y)
  }

  function tileAt(wx, wy) {
    return tileIndex(wx, wy, kindAt, seed)
  }

  const colliders = buildColliders(kindAt, props)

  function league(lx, ly) {
    const kinds = []
    const tiles = []
    const walk = []
    for (let ty = 0; ty < LEAGUE_H; ty++) {
      const kr = []
      const tr = []
      const wr = []
      for (let tx = 0; tx < LEAGUE_W; tx++) {
        const wx = lx * STRIDE_X + tx
        const wy = ly * STRIDE_Y + ty
        kr.push(kindAt(wx, wy))
        tr.push(tileAt(wx, wy))
        wr.push(walkable(wx, wy))
      }
      kinds.push(kr)
      tiles.push(tr)
      walk.push(wr)
    }
    const taken = new Set()
    const loot = []
    for (let i = 0; i < FIXED_LOOT.length; i++) {
      const item = FIXED_LOOT[i]
      if (!inLeague(lx, ly, item.wx, item.wy)) continue
      if (!walkable(item.wx, item.wy)) continue
      loot.push(item)
      taken.add(tileKey(item.wx, item.wy))
    }
    const herbs = herbCells(lx, ly, kindAt, walkable, seed, taken)
    for (let i = 0; i < herbs.length; i++) loot.push(herbs[i])
    const interactables = []
    for (let i = 0; i < INTERACTABLES.length; i++) {
      const it = INTERACTABLES[i]
      if (!inLeague(lx, ly, it.wx, it.wy)) continue
      if (!walkable(it.wx, it.wy)) continue
      interactables.push(it)
    }
    const encounters = buildEncounters(lx, ly, kindAt, walkable, seed, props)
    const leagueProps = []
    for (let i = 0; i < props.length; i++) {
      if (inLeague(lx, ly, props[i].wx, props[i].wy)) leagueProps.push(props[i])
    }
    for (let i = 0; i < loot.length; i++) {
      const item = loot[i]
      if (!item.marker) continue
      if (propBy.has(tileKey(item.wx, item.wy))) continue
      leagueProps.push(makeProp(item.marker, 0, item.wx, item.wy))
    }
    return {
      lx,
      ly,
      origin: leagueOrigin(lx, ly),
      kinds,
      tiles,
      walk,
      loot,
      encounters,
      interactables,
      props: leagueProps,
    }
  }

  return { seed, kindAt, tileAt, walkable, props, colliders, league, pointBlocked }
}

let cached = null
let cachedSeed = null

export function getWorld(seed = WORLD_SEED) {
  if (!cached || cachedSeed !== seed) {
    cached = createWorld(seed)
    cachedSeed = seed
  }
  return cached
}

export function clearWorldCache() {
  cached = null
  cachedSeed = null
}

export function eachLeaguePair(fn) {
  forEachLeague((lx, ly) => {
    if (ly < LEAGUE_MAX_Y) fn(lx, ly, lx, ly + 1, 'south')
    if (lx < LEAGUE_MAX_X) fn(lx, ly, lx + 1, ly, 'east')
  })
}

/**
 * Flood-fill walkable tiles from every walkable border cell.
 * @returns {{reachable:boolean[][], lost:Array<{tx:number,ty:number}>}}
 */
export function floodLeague(view) {
  const seen = Array.from({ length: LEAGUE_H }, () => Array(LEAGUE_W).fill(false))
  const q = []
  const push = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= LEAGUE_W || ty >= LEAGUE_H) return
    if (seen[ty][tx] || !view.walk[ty][tx]) return
    seen[ty][tx] = true
    q.push([tx, ty])
  }
  for (let tx = 0; tx < LEAGUE_W; tx++) {
    push(tx, 0)
    push(tx, LEAGUE_H - 1)
  }
  for (let ty = 0; ty < LEAGUE_H; ty++) {
    push(0, ty)
    push(LEAGUE_W - 1, ty)
  }
  let qi = 0
  while (qi < q.length) {
    const [tx, ty] = q[qi++]
    for (let d = 0; d < DIRS.length; d++) push(tx + DIRS[d][0], ty + DIRS[d][1])
  }
  const lost = []
  for (let ty = 0; ty < LEAGUE_H; ty++) {
    for (let tx = 0; tx < LEAGUE_W; tx++) {
      if (view.walk[ty][tx] && !seen[ty][tx]) lost.push({ tx, ty })
    }
  }
  return { reachable: seen, lost }
}

export function roadConnected(world) {
  const start = { wx: 9, wy: 10 }
  const goal = { wx: 7, wy: 48 }
  const seen = new Set()
  const q = [start]
  seen.add(tileKey(start.wx, start.wy))
  let qi = 0
  while (qi < q.length) {
    const cur = q[qi++]
    if (cur.wx === goal.wx && cur.wy === goal.wy) return true
    for (let d = 0; d < DIRS.length; d++) {
      const wx = cur.wx + DIRS[d][0]
      const wy = cur.wy + DIRS[d][1]
      const k = tileKey(wx, wy)
      if (seen.has(k)) continue
      const kind = world.kindAt(wx, wy)
      if (kind !== 'road' && kind !== 'gate') continue
      seen.add(k)
      q.push({ wx, wy })
    }
  }
  return false
}
