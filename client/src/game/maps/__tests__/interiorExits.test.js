import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MapLoader } from '../MapLoader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../../..')
const mapsDir = path.join(repoRoot, 'client/public/maps')

const knightFootprint = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'client/public/assets/characters/knight/knight.json'), 'utf8')
).meta.footprint

const loaders = new Map()

function loadMap(filename) {
  if (!loaders.has(filename)) {
    const mapData = JSON.parse(fs.readFileSync(path.join(mapsDir, filename), 'utf8'))
    loaders.set(filename, new MapLoader(mapData))
  }
  return loaders.get(filename)
}

function knightBody(feetX, feetY) {
  return {
    x: feetX + knightFootprint.x,
    y: feetY + knightFootprint.y,
    width: knightFootprint.w,
    height: knightFootprint.h,
  }
}

function rectsOverlap(a, b) {
  const aw = a.width ?? 0
  const ah = a.height ?? 0
  const bw = b.width ?? 0
  const bh = b.height ?? 0
  return !(a.x + aw <= b.x || b.x + bw <= a.x || a.y + ah <= b.y || b.y + bh <= a.y)
}

function linkedExits(loader) {
  return loader.getZones().getAll().filter((zone) => {
    const kind = String(zone.properties.kind || '')
    const isExitOrDoor = zone.type === 'exit' || zone.type === 'door' || kind === 'exit' || kind === 'door'
    return isExitOrDoor && typeof zone.properties.targetSpawn === 'string' && zone.properties.targetSpawn.length > 0
  })
}

describe('Package MX-1: interior exits land on walkable spawns', () => {
  const maps = ['brackenford.tmj', 'market.tmj', 'tavern.tmj']

  it('resolves every targetSpawn to a collision-free spawn, except the walkable tavern door', () => {
    const seen = []

    for (const filename of maps) {
      const loader = loadMap(filename)
      for (const zone of linkedExits(loader)) {
        const targetFile = zone.properties.targetMap
        expect(targetFile, `${filename} ${zone.name} targetMap`).toBeTruthy()
        const targetLoader = loadMap(targetFile)
        const target = targetLoader.getZone(zone.properties.targetSpawn)
        expect(target, `${filename} ${zone.name} -> ${zone.properties.targetSpawn}`).toBeTruthy()

        // Tavern return is already walkable at the door_tavern centre (288, 144).
        // MX-1 does not retarget it; this locks that landing.
        if (filename === 'tavern.tmj' && zone.name === 'exit_village') {
          expect(zone.properties.targetSpawn).toBe('door_tavern')
          expect(target.type).toBe('door')
          expect(target.properties.kind).toBe('door')
          const feetX = target.x + target.width / 2
          const feetY = target.y + target.height / 2
          expect(feetX).toBe(288)
          expect(feetY).toBe(144)
          expect(targetLoader.checkCollision({ x: target.x, y: target.y, width: target.width, height: target.height })).toBe(false)
          expect(targetLoader.checkCollision(knightBody(feetX, feetY))).toBe(false)
          seen.push(`${filename}:${zone.name}`)
          continue
        }

        expect(target.type, `${filename} ${zone.name}`).toBe('spawn')
        expect(target.properties.kind, `${filename} ${zone.name}`).toBe('spawn')
        const rect = { x: target.x, y: target.y, width: target.width, height: target.height }
        expect(targetLoader.checkCollision(rect), `${target.name} rect`).toBe(false)
        const blockingZones = targetLoader
          .getZones()
          .getAll()
          .filter((other) => (other.isDoor || other.isExit) && other.name !== target.name && rectsOverlap(rect, other))
        expect(blockingZones.map((other) => other.name), `${target.name} overlaps a door or exit`).toEqual([])
        seen.push(`${filename}:${zone.name}->${target.name}`)
      }
    }

    expect(seen).toEqual([
      'brackenford.tmj:exit_south->spawn_north',
      'market.tmj:exit_village->spawn_from_market',
      'tavern.tmj:exit_village',
    ])
  })

  it('places spawn_from_market on the walkable cell east of the market door', () => {
    const market = loadMap('market.tmj')
    const exit = market.getZone('exit_village')
    expect(exit.properties.targetSpawn).toBe('spawn_from_market')
    expect(exit.properties.targetMap).toBe('brackenford.tmj')

    const brackenford = loadMap('brackenford.tmj')
    const spawn = brackenford.getZone('spawn_from_market')
    expect(spawn.type).toBe('spawn')
    expect(spawn.properties.kind).toBe('spawn')
    expect(spawn.x).toBe(128)
    expect(spawn.y).toBe(192)
    expect(spawn.width).toBe(32)
    expect(spawn.height).toBe(32)

    const feetX = spawn.x + spawn.width / 2
    const feetY = spawn.y + spawn.height / 2
    expect(feetX).toBe(144)
    expect(feetY).toBe(208)
    expect(brackenford.checkCollision(knightBody(feetX, feetY))).toBe(false)

    const door = brackenford.getZone('door_market')
    expect(door.x + door.width / 2).toBe(96)
    expect(door.y + door.height / 2).toBe(160)
    expect(brackenford.checkCollision(knightBody(96, 160))).toBe(true)
  })
})

describe('Package TAVERN-1: Tharos talk rect and tavern exit mat', () => {
  const tavern = loadMap('tavern.tmj')
  const props = tavern.getLayer('props').objects
  const counter = props.find((prop) => prop.name === 'tavern_bar_counter')
  const tharos = tavern.getZone('Tharos')
  const exit = tavern.getZone('exit_village')
  const spawn = tavern.getZone('spawn_tavern')

  it('overlaps the counter front on the open floor and a reachable knight footprint', () => {
    expect(counter).toBeTruthy()
    expect(tharos.type).toBe('npc')
    expect(tharos.properties.prompt).toBe('Press E to talk to Tharos')

    // Southern edge of the counter sprite: the side facing the room.
    const counterFront = {
      x: counter.x,
      y: counter.y + counter.height - 16,
      width: counter.width,
      height: 16,
    }
    const openFloor = { x: counter.x, y: 168, width: counter.width, height: 40 }

    expect(rectsOverlap(tharos, counterFront)).toBe(true)
    expect(rectsOverlap(tharos, openFloor)).toBe(true)

    // Walk-up stops on the south edge of the middle stool. Feet (352, 200)
    // put the 23x7 footprint on that edge, inside the talk rect, off the solids.
    const body = knightBody(352, 200)
    expect(tavern.checkCollision(body)).toBe(false)
    expect(rectsOverlap(body, tharos)).toBe(true)
  })

  it('keeps the exit on a 64x32 door mat clear of props and spawn_tavern', () => {
    expect(exit.properties.targetMap).toBe('brackenford.tmj')
    expect(exit.properties.targetSpawn).toBe('door_tavern')
    expect(exit.width).toBeLessThanOrEqual(64)
    expect(exit.height).toBeLessThanOrEqual(32)

    const doorway = { x: 9 * 32, y: 10 * 32, width: 64, height: 32 }
    expect(rectsOverlap(exit, doorway)).toBe(true)

    expect(tavern.propFootprints.length).toBeGreaterThan(0)
    const overlapping = tavern.propFootprints.filter((fp) => rectsOverlap(exit, fp.bounds))
    expect(overlapping.map((fp) => fp.name)).toEqual([])

    expect(rectsOverlap(spawn, exit)).toBe(false)
    const spawnFeet = knightBody(spawn.x + spawn.width / 2, spawn.y + spawn.height / 2)
    expect(rectsOverlap(spawnFeet, exit)).toBe(false)

    // South of the round table, where the old 128x128 mat used to fire the exit prompt.
    const atTable = knightBody(280, 300)
    expect(tavern.checkCollision(atTable)).toBe(false)
    expect(rectsOverlap(atTable, exit)).toBe(false)
  })
})
