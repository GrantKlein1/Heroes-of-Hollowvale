import { describe, it, expect } from 'vitest'
import wildPropsAtlas from '../../../../public/assets/env/wild_props/wild_props.json' with { type: 'json' }
import wildProps4bAtlas from '../../../../public/assets/env/wild_props_4b/wild_props_4b.json' with { type: 'json' }
import emberVentAtlas from '../../../../public/assets/env/ember_vent/ember_vent.json' with { type: 'json' }
import { biomeFor } from '../worldGraph.js'
import {
  GRID_COLS,
  GRID_ROWS,
  TILESET_CATALOG,
  edgeCells,
  generateScreen,
  gidFor,
  tileForAshMask,
  wangMask,
} from '../generate.js'

const ALL = { north: true, south: true, east: true, west: true }

function gids(layout) {
  return layout.tiles.cells.map((cell) => cell.gid)
}

function pathIndexes(cells) {
  const found = []
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].kind === 'path') found.push(i)
  }
  return found
}

describe('wilderness tile gids', () => {
  it('selects the Wang frame for every ash mask', () => {
    for (let mask = 0; mask < 16; mask++) {
      const nw = !!(mask & 1)
      const ne = !!(mask & 2)
      const sw = !!(mask & 4)
      const se = !!(mask & 8)
      expect(wangMask(nw, ne, sw, se)).toBe(mask)
      const tile = tileForAshMask(mask, 'forest_floor', 3, 2)
      if (mask === 0) {
        expect(tile).toEqual({ tileset: 'forest_floor', frame: 3, kind: 'forest' })
      } else if (mask === 15) {
        expect(tile).toEqual({ tileset: 'ash_fill', frame: 2, kind: 'ash_fill' })
      } else {
        expect(tile).toEqual({ tileset: 'ash_ground', frame: mask, kind: 'ash' })
      }
      expect(gidFor(tile.tileset, tile.frame)).toBeGreaterThan(0)
    }
  })

  it('assigns non-overlapping gids across the wilderness tilesets', () => {
    const seen = new Set()
    for (const ts of TILESET_CATALOG) {
      for (let frame = 0; frame < ts.count; frame++) {
        const gid = gidFor(ts.name, frame)
        expect(seen.has(gid)).toBe(false)
        seen.add(gid)
      }
    }
  })

  it('repeats gids for the same seed', () => {
    const a = generateScreen({ nodeId: 'wild_2_3', seed: 11, biome: 'emberwood_forest', exits: ALL })
    const b = generateScreen({ nodeId: 'wild_2_3', seed: 11, biome: 'emberwood_forest', exits: ALL })
    expect(gids(a)).toEqual(gids(b))
    expect(JSON.stringify(a.objects)).toBe(JSON.stringify(b.objects))
    expect(a.tiles.cols).toBe(GRID_COLS)
    expect(a.tiles.rows).toBe(GRID_ROWS)
  })

  it('keeps edge gids stable when the visit seed changes', () => {
    const a = generateScreen({ nodeId: 'wild_4_5', seed: 1, biome: biomeFor('wild_4_5'), exits: ALL })
    const b = generateScreen({ nodeId: 'wild_4_5', seed: 99, biome: biomeFor('wild_4_5'), exits: ALL })
    for (const edge of ['north', 'south', 'east', 'west']) {
      expect(edgeCells(a, edge).map((cell) => cell.gid)).toEqual(edgeCells(b, edge).map((cell) => cell.gid))
    }
    expect(a.exitBands).toEqual(b.exitBands)
  })

  it('matches neighbour edges: shared corners, mouths, and exit gaps', () => {
    const northId = 'wild_1_2'
    const southId = 'wild_1_3'
    const eastId = 'wild_2_2'
    const north = generateScreen({ nodeId: northId, seed: 3, biome: biomeFor(northId), exits: ALL })
    const south = generateScreen({ nodeId: southId, seed: 80, biome: biomeFor(southId), exits: ALL })
    const east = generateScreen({ nodeId: eastId, seed: 15, biome: biomeFor(eastId), exits: ALL })

    expect(north.exitBands.south).toEqual(south.exitBands.north)
    expect(north.exitBands.east).toEqual(east.exitBands.west)
    // Historical normalized gaps: 3/12 horizontally, min(3/18, 0.2) vertically.
    expect(north.exitBands.south.end - north.exitBands.south.start).toBeCloseTo(0.25, 5)
    expect(north.exitBands.east.end - north.exitBands.east.start).toBeCloseTo(0.2, 5)

    const southEdge = edgeCells(north, 'south')
    const northEdge = edgeCells(south, 'north')
    expect(pathIndexes(southEdge)).toEqual(pathIndexes(northEdge))
    expect(pathIndexes(southEdge)).toHaveLength(1)
    for (let i = 0; i < southEdge.length; i++) {
      expect(southEdge[i].corners.se).toBe(northEdge[i].corners.ne)
      expect(southEdge[i].corners.sw).toBe(northEdge[i].corners.nw)
    }

    const eastEdge = edgeCells(north, 'east')
    const westEdge = edgeCells(east, 'west')
    expect(pathIndexes(eastEdge)).toEqual(pathIndexes(westEdge))
    for (let i = 0; i < eastEdge.length; i++) {
      expect(eastEdge[i].corners.ne).toBe(westEdge[i].corners.nw)
      expect(eastEdge[i].corners.se).toBe(westEdge[i].corners.sw)
    }
  })

  it('dresses Emberwood with forest_floor and wild_props_4b at sample density', () => {
    const layout = generateScreen({
      nodeId: 'wild_0_0',
      seed: 4,
      biome: 'emberwood_forest',
      exits: ALL,
    })
    const tilesets = new Set(layout.tiles.cells.map((cell) => cell.tileset))
    expect(tilesets.has('forest_floor')).toBe(true)
    expect(tilesets.has('dirt_road')).toBe(true)
    const counts = {}
    for (const obj of layout.objects) {
      counts[obj.assetId] = (counts[obj.assetId] || 0) + 1
      const meta = wildProps4bAtlas.meta.props[obj.assetId]
      expect(obj.atlas).toBe('wild_props_4b')
      expect(obj.anchor).toEqual(meta.anchor)
      expect(obj.footprint).toEqual(meta.footprint)
      expect(obj.collide).toBe(!!meta.collides)
    }
    for (const id of ['fern', 'flowers', 'mushroom_cluster', 'stump_mossy', 'log_fallen']) {
      expect(counts[id]).toBeGreaterThan(0)
    }
    // wilderness_4b's forest half is about a dozen props. A full screen is
    // larger, and corridor clearance keeps dressing off the roads.
    expect(layout.objects.length).toBeGreaterThanOrEqual(8)
    expect(layout.objects.length).toBeLessThan(80)

    const cells = layout.tiles.cells
    const cols = layout.tiles.cols
    const frames = new Set()
    let compared = 0
    let sameNeighbor = 0
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      if (cell.tileset !== 'forest_floor') continue
      frames.add(cell.frame)
      if (i % cols === cols - 1) continue
      const right = cells[i + 1]
      if (right.tileset !== 'forest_floor') continue
      compared++
      if (right.frame === cell.frame) sameNeighbor++
    }
    expect(frames.has(0)).toBe(true)
    expect(frames.size).toBeGreaterThan(1)
    expect(sameNeighbor / compared).toBeGreaterThan(0.75)
  })

  it('dresses the Ashen Wastes with Wang ash, paired canopies, and decals', () => {
    const layout = generateScreen({
      nodeId: 'wild_6_1',
      seed: 8,
      biome: 'ashen_wastes',
      exits: ALL,
    })
    const tilesets = new Set(layout.tiles.cells.map((cell) => cell.tileset))
    expect(tilesets.has('ash_ground')).toBe(true)
    expect(tilesets.has('ash_fill')).toBe(true)
    expect(tilesets.has('grass')).toBe(true)

    const byId = {}
    for (const obj of layout.objects) byId[obj.assetId] = (byId[obj.assetId] || []).concat(obj)

    expect(byId.tree_dead_base?.length).toBeGreaterThan(0)
    expect(byId.tree_dead_canopy?.length).toBe(byId.tree_dead_base.length)
    for (const base of byId.tree_dead_base) {
      const canopy = byId.tree_dead_canopy.find((obj) => obj.nx === base.nx && obj.ny === base.ny)
      expect(canopy).toBeTruthy()
      expect(canopy.layer).toBe('overhead')
      expect(canopy.collide).toBe(false)
      expect(canopy.flipX).toBe(base.flipX)
      expect(canopy.scale).toBe(base.scale)
      expect(base.collide).toBe(true)
      expect(base.anchor).toEqual(wildPropsAtlas.meta.props.tree_dead_base.anchor)
      expect(base.footprint).toEqual(wildPropsAtlas.meta.props.tree_dead_base.footprint)
    }

    expect(byId.stump_charred?.length).toBeGreaterThan(0)
    expect(byId.cinder_patch?.length).toBeGreaterThan(0)
    expect(byId.ember_fleck?.length).toBeGreaterThan(0)
    expect(byId.ember_vent_burn_down_0?.length).toBeGreaterThan(0)
    for (const vent of byId.ember_vent_burn_down_0) {
      expect(vent.anim).toBe('ember_vent_burn_down')
      expect(vent.atlas).toBe('ember_vent')
      expect(vent.anchor).toEqual(emberVentAtlas.meta.props.ember_vent_burn_down_0.anchor)
      expect(vent.collide).toBe(true)
    }
    for (const id of ['ash_drift_pool_a', 'ash_drift_pool_b', 'ash_drift_streak_a', 'ash_drift_streak_b']) {
      expect(byId[id]?.length).toBeGreaterThan(0)
      for (const drift of byId[id]) {
        expect(drift.collide).toBe(false)
        expect(drift.layer).toBe('decal')
        expect(drift.anchor).toEqual(wildPropsAtlas.meta.props[id].anchor)
      }
    }
    for (const fleck of byId.ember_fleck) expect(fleck.collide).toBe(false)
    for (const patch of byId.cinder_patch) expect(patch.collide).toBe(false)
  })
})
