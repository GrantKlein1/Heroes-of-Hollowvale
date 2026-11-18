import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CLIFF_FACE_CAP_LEFT,
  CLIFF_FACE_CAP_RIGHT,
  STRAIGHT_MASKS,
  STRAIGHT_VARIANTS,
  cliffFaceId,
  forestGrassId,
  shoreGrassId,
  shoreWaterId,
  straightVariantId,
} from '../tileVariants.js'
import {
  GRID_COLS,
  GRID_ROWS,
  edgeCells,
  generateScreen,
  gidFor,
  variantRoll,
  wangMask,
} from '../generate.js'
import { biomeFor, nodeIdAt } from '../worldGraph.js'
import { computeRiverShore, computeKind, dirtRoadVariant } from '../../../../../tools/maps/generate_tmj.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TILES = path.resolve(__dirname, '../../../../public/assets/tiles')
const readTsj = (name) => JSON.parse(fs.readFileSync(path.join(TILES, `${name}.tsj`), 'utf8'))
const prop = (tsj, id, name) => {
  const tile = (tsj.tiles ?? []).find((t) => t.id === id)
  return (tile?.properties ?? []).find((p) => p.name === name)?.value
}

describe('forest to grass corner blend selection', () => {
  it('maps every grass corner mask to the matching forest_floor id (id = 7 + mask)', () => {
    const tsj = readTsj('forest_floor')
    expect(forestGrassId(0)).toBe(0)
    for (let mask = 1; mask <= 15; mask++) {
      const id = forestGrassId(mask)
      expect(id).toBe(7 + mask)
      expect(prop(tsj, id, 'grassMask')).toBe(mask)
      expect(prop(tsj, id, 'collides')).toBe(false)
    }
  })

  it('picks the corner tile from the neighbour mask: NW=1 NE=2 SW=4 SE=8 are the grass corners', () => {
    expect(forestGrassId(wangMask(true, false, false, false))).toBe(8) // grass NW only
    expect(forestGrassId(wangMask(false, true, false, false))).toBe(9) // grass NE only
    expect(forestGrassId(wangMask(true, true, false, false))).toBe(10) // grass along the north edge
    expect(forestGrassId(wangMask(false, false, true, true))).toBe(19) // grass along the south edge
    expect(forestGrassId(wangMask(true, false, true, false))).toBe(12) // grass along the west edge
    expect(forestGrassId(wangMask(false, true, false, true))).toBe(17) // grass along the east edge
    expect(forestGrassId(wangMask(true, true, true, false))).toBe(14) // forest only in the SE corner
    expect(forestGrassId(15)).toBe(22) // all grass
  })

  it('ties the mask to the tile Wang corners in the tsj (grass = colour 2)', () => {
    const tsj = readTsj('forest_floor')
    const set = tsj.wangsets.find((w) => w.name === 'forest_floor_blob16')
    expect(set).toBeTruthy()
    for (let mask = 1; mask <= 14; mask++) {
      const wt = set.wangtiles.find((t) => t.tileid === 7 + mask)
      // wangid is [top, NE, right, SE, bottom, SW, left, NW]
      const [, ne, , se, , sw, , nw] = wt.wangid
      expect([nw === 2, ne === 2, sw === 2, se === 2].map(Number)).toEqual(
        [mask & 1, (mask >> 1) & 1, (mask >> 2) & 1, (mask >> 3) & 1],
      )
    }
  })
})

describe('sand to grass shore blend selection', () => {
  it('maps every grass corner mask to the matching water_shore id (id = 63 + mask)', () => {
    const tsj = readTsj('water_shore')
    expect(shoreGrassId(0)).toBe(0)
    for (let mask = 1; mask <= 15; mask++) {
      const id = shoreGrassId(mask)
      expect(id).toBe(63 + mask)
      expect(prop(tsj, id, 'grassMask')).toBe(mask)
      expect(prop(tsj, id, 'collides')).toBe(false)
    }
    expect(shoreGrassId(wangMask(true, true, false, false))).toBe(66)
    expect(shoreGrassId(wangMask(false, false, true, true))).toBe(75)
    expect(shoreGrassId(15)).toBe(78)
  })

  it('keeps the sand to water tiles on ids 0-15 (mask = water corners)', () => {
    for (let mask = 0; mask < 16; mask++) expect(shoreWaterId(mask)).toBe(mask)
  })

  it('puts the sand bank, its blend and plain grass in the right rows around the Brackenford river', () => {
    // River along wy = 7. Open grass columns at wx 0..4: bank rows 6 (sand over water),
    // blend row 5 (grass above, sand below); south bank row 8, blend row 9.
    const shore = computeRiverShore((wx, wy) => computeKind(wx, wy), 0, 0, 20, 12)
    const at = (x, y) => shore.get(y * 20 + x)
    expect(at(2, 6)).toBe(12) // water at SW and SE
    expect(at(2, 8)).toBe(3) // water at NW and NE
    expect(at(2, 5)).toBe(shoreGrassId(wangMask(true, true, false, false))) // grass north, sand south
    expect(at(2, 9)).toBe(shoreGrassId(wangMask(false, false, true, true))) // sand north, grass south
    expect(at(2, 3)).toBeUndefined() // open grass keeps the plain grass tile
    expect(at(2, 7)).toBeUndefined() // the river row itself is untouched
    // Cobble, road, ford and bridge keep their own tiles.
    expect(at(6, 6)).toBeUndefined()
    expect(at(9, 8)).toBeUndefined()
  })
})

describe('ground variants', () => {
  it('only straight masks have alternates, and the alternates collide like their base', () => {
    for (const set of ['dirt_road', 'cliff', 'water']) {
      const tsj = readTsj(set)
      for (const mask of STRAIGHT_MASKS) {
        const ids = STRAIGHT_VARIANTS[set][mask]
        expect(ids[0]).toBe(mask)
        for (const id of ids) {
          expect(prop(tsj, id, 'collides') ?? false).toBe(set === 'cliff')
        }
      }
    }
    for (const mask of [0, 1, 2, 4, 7, 8, 11, 13, 14, 15]) {
      expect(straightVariantId('dirt_road', mask, 0.9)).toBe(mask)
    }
  })

  it('splits rolls between the base and both alternates, and is a pure function', () => {
    expect(straightVariantId('dirt_road', 3, 0)).toBe(3)
    expect(straightVariantId('dirt_road', 3, 0.5)).toBe(16)
    expect(straightVariantId('dirt_road', 3, 0.95)).toBe(20)
    expect(straightVariantId('cliff', 12, 0.95)).toBe(23)
    expect(straightVariantId('water', 5, 0.5)).toBe(65)
    expect(straightVariantId('dirt_road', 10, 0.5)).toBe(straightVariantId('dirt_road', 10, 0.5))
  })

  it('caps both ends of a cliff face run and keeps the face ids otherwise', () => {
    expect(cliffFaceId(0, 24, 0.9)).toBe(CLIFF_FACE_CAP_LEFT)
    expect(cliffFaceId(23, 24, 0.9)).toBe(CLIFF_FACE_CAP_RIGHT)
    expect(cliffFaceId(5, 24, 0.9)).toBe(1)
    expect([6, 7]).toContain(cliffFaceId(5, 24, 0.1))
    expect(cliffFaceId(0, 1, 0.9)).toBe(0) // a single cell is not capped
    const tsj = readTsj('cliff_face')
    for (const id of [4, 5, 6, 7]) expect(prop(tsj, id, 'collides')).toBe(true)
  })

  it('picks tmj road variants deterministically per seed, and different seeds differ', () => {
    const sample = (seed) => {
      const out = []
      for (let y = 0; y < 40; y++) out.push(dirtRoadVariant(3, seed, 8, y))
      return out
    }
    expect(sample('hollowvale-1477')).toEqual(sample('hollowvale-1477'))
    expect(sample('hollowvale-1477')).not.toEqual(sample('another-seed'))
    expect(new Set(sample('hollowvale-1477'))).toEqual(new Set([3, 16, 20]))
    expect(dirtRoadVariant(15, 'hollowvale-1477', 8, 3)).toBe(15)
  })

  it('picks wilderness variant rolls from the world cell only', () => {
    expect(variantRoll('road', 10, 20)).toBe(variantRoll('road', 10, 20))
    expect(variantRoll('road', 10, 20)).not.toBe(variantRoll('road', 11, 20))
    const roll = variantRoll('road', 3, 4)
    expect(roll).toBeGreaterThanOrEqual(0)
    expect(roll).toBeLessThan(1)
  })
})

describe('wilderness forest edges', () => {
  const ALL = { north: true, south: true, east: true, west: true }
  const findEmberwood = (wantNeighbor) => {
    for (let c = -8; c <= 8; c++) {
      for (let r = -8; r <= 8; r++) {
        const id = nodeIdAt(c, r)
        if (biomeFor(id) !== 'emberwood_forest') continue
        const east = biomeFor(nodeIdAt(c + 1, r))
        const west = biomeFor(nodeIdAt(c - 1, r))
        if (wantNeighbor === 'east' && east !== 'emberwood_forest' && west === 'emberwood_forest') {
          return { id, c, r }
        }
      }
    }
    return null
  }

  it('blends the forest into grass along a biome border and keeps the interior plain', () => {
    const found = findEmberwood('east')
    expect(found).not.toBeNull()
    const layout = generateScreen({ nodeId: found.id, seed: 1, biome: 'emberwood_forest', exits: ALL })
    const { cols, rows, cells } = layout.tiles
    const at = (c, r) => cells[r * cols + c]
    let blended = 0
    for (let r = 0; r < rows; r++) {
      const cell = at(cols - 1, r)
      if (cell.roadMask) continue
      // east neighbour is not Emberwood, so both east corners are grass
      expect(cell.forestMask & 10).toBe(10)
      expect(cell.tileset).toBe('forest_floor')
      expect(cell.frame).toBe(7 + cell.forestMask)
      expect(cell.gid).toBe(gidFor('forest_floor', 7 + cell.forestMask))
      blended++
    }
    expect(blended).toBeGreaterThan(rows / 2)
    // Interior cells away from the border and the road keep their plain forest variants.
    const interior = at(1, 1)
    if (!interior.roadMask) {
      expect(interior.forestMask).toBe(0)
      expect(interior.frame).toBeLessThan(8)
    }
    // Every blend tile id is one of the forest_floor blend ids.
    for (const cell of cells) {
      if (cell.tileset === 'forest_floor' && cell.forestMask) {
        expect(cell.frame).toBeGreaterThanOrEqual(8)
        expect(cell.frame).toBeLessThanOrEqual(21)
      }
    }
  })

  it('blends the forest into the grass fringe of a dirt road', () => {
    const found = findEmberwood('east')
    const layout = generateScreen({ nodeId: found.id, seed: 1, biome: 'emberwood_forest', exits: ALL })
    const { cols, rows, cells } = layout.tiles
    let checked = 0
    for (let r = 2; r < rows - 2; r++) {
      for (let c = 2; c < cols - 3; c++) {
        const cell = cells[r * cols + c]
        if (cell.tileset !== 'forest_floor') continue
        const touchesRoad = [-1, 0, 1].some((dy) =>
          [-1, 0, 1].some((dx) => cells[(r + dy) * cols + c + dx].roadMask > 0),
        )
        if (touchesRoad) {
          expect(cell.forestMask).toBeGreaterThan(0)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('is deterministic for the same node and seed, and the ground does not depend on the seed', () => {
    const found = findEmberwood('east')
    const make = (seed) => generateScreen({ nodeId: found.id, seed, biome: 'emberwood_forest', exits: ALL })
    expect(make(7).tiles.cells.map((c) => c.gid)).toEqual(make(7).tiles.cells.map((c) => c.gid))
    // neighbouring screens must agree on a shared edge whatever the visit seed
    for (const edge of ['north', 'south', 'east', 'west']) {
      expect(edgeCells(make(7), edge).map((c) => c.gid)).toEqual(edgeCells(make(99), edge).map((c) => c.gid))
    }
  })

  it('picks dirt road variants on straight edges only, from the dirt_road ids', () => {
    const layout = generateScreen({ nodeId: 'wild_0_1', seed: 1, biome: biomeFor('wild_0_1'), exits: ALL })
    const seen = new Set()
    for (const cell of layout.tiles.cells) {
      if (cell.tileset !== 'dirt_road') continue
      seen.add(cell.frame)
      if (cell.roadMask === 15 || ![3, 5, 10, 12].includes(cell.roadMask)) {
        expect(cell.frame).toBe(cell.roadMask)
      } else {
        expect(STRAIGHT_VARIANTS.dirt_road[cell.roadMask]).toContain(cell.frame)
      }
    }
    expect(seen.size).toBeGreaterThan(1)
    expect(GRID_COLS * GRID_ROWS).toBe(layout.tiles.cells.length)
  })
})
