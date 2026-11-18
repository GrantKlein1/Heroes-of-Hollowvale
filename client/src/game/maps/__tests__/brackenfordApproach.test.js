import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MapLoader } from '../MapLoader.js'
import { validateMap } from '../../../../../tools/maps/validate_map.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../../..')
const brackenfordPath = path.resolve(repoRoot, 'client/public/maps/brackenford.tmj')
const lorePath = path.resolve(repoRoot, 'newLore_expanded.txt')

describe('Package BF-1: Brackenford Market Approach & Barrel Move', () => {
  const rawMap = fs.readFileSync(brackenfordPath, 'utf8')
  const mapData = JSON.parse(rawMap)
  const loader = new MapLoader(mapData)

  it('validates brackenford.tmj with 0 errors via validateMap', () => {
    const result = validateMap(mapData, { lorePath })
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('asserts that no propFootprints entry intersects rectangle x 64-224, y 192-224', () => {
    const approachRect = { x: 64, y: 192, width: 224 - 64, height: 224 - 192 }
    for (const propEntry of loader.propFootprints) {
      const b = propEntry.bounds
      const intersects = !(
        approachRect.x + approachRect.width <= b.x ||
        approachRect.x >= b.x + b.width ||
        approachRect.y + approachRect.height <= b.y ||
        approachRect.y >= b.y + b.height
      )
      expect(intersects, `Prop "${propEntry.prop?.name}" intersects approach`).toBe(false)
    }
  })

  it('sweeps a 23x7 knight box from feet (192, 220) to (96, 208) without colliding', () => {
    // 23x7 footprint centered at feetX, bottom at feetY
    const collider = { x: 192 - 11.5, y: 220 - 7, width: 23, height: 7 }
    const deltaX = 96 - 192 // -96
    const deltaY = 208 - 220 // -12

    const result = loader.sweep(collider, deltaX, deltaY)

    expect(result.collided).toBe(false)
    expect(result.collidedX).toBe(false)
    expect(result.collidedY).toBe(false)
    expect(result.blocked).toBe(false)
    expect(result.x).toBeCloseTo(96 - 11.5, 1)
    expect(result.y).toBeCloseTo(208 - 7, 1)
  })

  it('sweeps a 23x7 knight box from ford feet (320, 220) to (96, 208) without colliding', () => {
    const collider = { x: 320 - 11.5, y: 220 - 7, width: 23, height: 7 }
    const deltaX = 96 - 320 // -224
    const deltaY = 208 - 220 // -12

    const result = loader.sweep(collider, deltaX, deltaY)

    expect(result.collided).toBe(false)
    expect(result.collidedX).toBe(false)
    expect(result.collidedY).toBe(false)
    expect(result.blocked).toBe(false)
    expect(result.x).toBeCloseTo(96 - 11.5, 1)
    expect(result.y).toBeCloseTo(208 - 7, 1)
  })
})

// HollowvaleScene._drawBeacons turns an exit prompt on when the hero body
// intersects the exit rectangle. The zone code adds no extra radius.
const EXIT_PROMPT_RADIUS = 0
const EXIT_PROMPT_CLEARANCE = EXIT_PROMPT_RADIUS + 48
const KEPT_SPAWNS = new Set(['spawn_default', 'spawn_from_market'])

function zoneCenter(zone) {
  return {
    x: zone.x + zone.width / 2,
    y: zone.y + zone.height / 2,
  }
}

function distancePointToRect(px, py, rect) {
  const nearestX = Math.max(rect.x, Math.min(px, rect.x + rect.width))
  const nearestY = Math.max(rect.y, Math.min(py, rect.y + rect.height))
  return Math.hypot(px - nearestX, py - nearestY)
}

describe('Package SPAWN-1: Brackenford arrival stays outside exit prompts', () => {
  const rawMap = fs.readFileSync(brackenfordPath, 'utf8')
  const mapData = JSON.parse(rawMap)
  const loader = new MapLoader(mapData)
  const zones = loader.zones.getAll()
  const spawns = zones.filter((zone) => zone.isSpawn)
  const exits = zones.filter((zone) => zone.isExit && !zone.isDoor)

  it('keeps the south gate and the spawns other specs depend on', () => {
    const exitSouth = loader.getZone('exit_south')
    expect(exitSouth.x).toBe(288)
    expect(exitSouth.y).toBe(320)
    expect(exitSouth.width).toBe(64)
    expect(exitSouth.height).toBe(32)

    const spawnDefault = loader.getZone('spawn_default')
    expect(spawnDefault.x).toBe(320)
    expect(spawnDefault.y).toBe(192)

    const fromMarket = loader.getZone('spawn_from_market')
    expect(fromMarket.x).toBe(128)
    expect(fromMarket.y).toBe(192)
  })

  it('places every other spawn point at least the prompt radius plus 48px from every exit', () => {
    const checked = []
    for (const spawn of spawns) {
      if (KEPT_SPAWNS.has(spawn.name)) continue
      const point = zoneCenter(spawn)
      for (const exit of exits) {
        const distance = distancePointToRect(point.x, point.y, exit)
        expect(distance, `${spawn.name} centre to ${exit.name}`).toBeGreaterThanOrEqual(EXIT_PROMPT_CLEARANCE)
        checked.push(spawn.name)
      }
    }
    expect(checked).toContain('spawn_south')

    const south = zoneCenter(loader.getZone('spawn_south'))
    expect(south).toEqual({ x: 304, y: 272 })
    expect(distancePointToRect(south.x, south.y, loader.getZone('exit_south'))).toBe(48)
  })
})
