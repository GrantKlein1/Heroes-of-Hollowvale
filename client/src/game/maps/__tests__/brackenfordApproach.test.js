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
